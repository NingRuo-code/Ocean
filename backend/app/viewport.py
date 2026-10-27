from __future__ import annotations

import hashlib
import json
import os
import re
from collections import Counter
from datetime import date as DateType
from pathlib import Path
from typing import Any

from .analysis_support import decode_controlled_json
from .schemas import (
    ViewportCacheMetadata,
    ViewportCoverage,
    ViewportLayerCoverage,
    ViewportLayers,
    ViewportMeta,
    ViewportRequest,
    ViewportResolution,
    ViewportResponse,
)
from .viewport_inputs import (
    DayExport,
    FrontObject,
    ResponseExport,
    ResponseIdentity,
    ResponseRecord,
    SstExport,
)

FIXTURE_VERSION = "viewport-fixture-v1"
STATIC_PROTOTYPE_VERSION = "static-prototype-v1"
VIEWPORT_CACHE_VERSION = f"{STATIC_PROTOTYPE_VERSION}-contract-v2"
VIEWPORT_CACHE_SUBDIR = "viewport"
FIXTURE_DATE = DateType(2024, 8, 5)
FIXTURE_BBOX = (120.0, 30.0, 121.0, 31.0)
DISPLAY_PRECISION = 4
MAX_STATIC_BYTES = 32 * 1024 * 1024


def _round_float(value: object, digits: int = DISPLAY_PRECISION) -> float:
    return round(float(value), digits)


def _round_bbox(bbox: list[float] | tuple[float, float, float, float]) -> list[float]:
    return [_round_float(value) for value in bbox]


def _round_point(point: list[object] | tuple[object, object]) -> list[float]:
    return [_round_float(point[0]), _round_float(point[1])]


def _intersect_bbox(
    left: list[float] | tuple[float, float, float, float],
    right: list[float] | tuple[float, float, float, float],
) -> tuple[float, float, float, float] | None:
    min_lon = max(float(left[0]), float(right[0]))
    min_lat = max(float(left[1]), float(right[1]))
    max_lon = min(float(left[2]), float(right[2]))
    max_lat = min(float(left[3]), float(right[3]))
    if min_lon >= max_lon or min_lat >= max_lat:
        return None
    return (min_lon, min_lat, max_lon, max_lat)


def _contains_bbox(
    outer: list[float] | tuple[float, float, float, float],
    inner: list[float],
) -> bool:
    return (
        inner[0] >= float(outer[0]) - 1e-9
        and inner[1] >= float(outer[1]) - 1e-9
        and inner[2] <= float(outer[2]) + 1e-9
        and inner[3] <= float(outer[3]) + 1e-9
    )


def _is_inside_fixture(bbox: list[float]) -> bool:
    return _contains_bbox(FIXTURE_BBOX, bbox)


def _empty_layers() -> ViewportLayers:
    return ViewportLayers(
        fronts={"type": "FeatureCollection", "features": []},
        sst={"unit": "celsius", "cells": []},
        fishing_effort={
            "metric": "apparent_fishing_effort",
            "unit": "fishing_hours",
            "cells": [],
        },
    )


def _fixture_layers(bbox: tuple[float, float, float, float]) -> ViewportLayers:
    min_lon, min_lat, max_lon, max_lat = bbox
    center_lon = round((min_lon + max_lon) / 2, 4)
    center_lat = round((min_lat + max_lat) / 2, 4)
    front_start_lon = round(min_lon + (max_lon - min_lon) * 0.25, 4)
    front_end_lon = round(min_lon + (max_lon - min_lon) * 0.75, 4)
    front_lat = round(center_lat, 4)
    return ViewportLayers(
        fronts={
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "frontId": "fixture-front-001",
                        "kind": "ocean_front",
                        "sideStructure": "cold_warm_side_fixture",
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[front_start_lon, front_lat], [front_end_lon, front_lat]],
                    },
                }
            ],
        },
        sst={
            "unit": "celsius",
            "cells": [
                {
                    "lon": center_lon,
                    "lat": center_lat,
                    "value": 24.6,
                }
            ],
        },
        fishing_effort={
            "metric": "apparent_fishing_effort",
            "unit": "fishing_hours",
            "cells": [
                {
                    "lon": center_lon,
                    "lat": center_lat,
                    "hours": 2.5,
                }
            ],
        },
    )


def _cache_request_payload(request: ViewportRequest) -> dict[str, object]:
    return {
        "version": VIEWPORT_CACHE_VERSION,
        "date": request.date.isoformat(),
        "bbox": _round_bbox(request.bbox),
        "step": request.step,
    }


def _cache_key(request: ViewportRequest) -> str:
    payload = json.dumps(_cache_request_payload(request), ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _cache_path(cache_dir: Path, request: ViewportRequest) -> Path:
    return Path(cache_dir) / VIEWPORT_CACHE_SUBDIR / VIEWPORT_CACHE_VERSION / f"{_cache_key(request)}.json"


def _with_cache_metadata(response: ViewportResponse, *, enabled: bool, hit: bool) -> ViewportResponse:
    response.meta.cache = ViewportCacheMetadata(enabled=enabled, hit=hit, version=VIEWPORT_CACHE_VERSION)
    return response


def _read_cached_viewport(path: Path, request: ViewportRequest) -> ViewportResponse | None:
    try:
        if not path.is_file():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    if payload.get("version") != VIEWPORT_CACHE_VERSION or payload.get("cache_key") != _cache_key(request):
        return None
    response_payload = payload.get("response")
    if not isinstance(response_payload, dict):
        return None
    try:
        response = ViewportResponse.model_validate(response_payload)
    except ValueError:
        return None
    return _with_cache_metadata(response, enabled=True, hit=True)


def _write_cached_viewport(path: Path, request: ViewportRequest, response: ViewportResponse) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        payload = {
            "version": VIEWPORT_CACHE_VERSION,
            "cache_key": _cache_key(request),
            "request": _cache_request_payload(request),
            "response": response.model_dump(mode="json", by_alias=True),
        }
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        pass


def build_cached_viewport(
    request: ViewportRequest,
    cache_dir: Path,
    prototype_data_dir: Path,
) -> ViewportResponse:
    path = _cache_path(cache_dir, request)
    cached = _read_cached_viewport(path, request)
    if cached is not None:
        return cached

    response = _with_cache_metadata(
        build_static_prototype_viewport(request, prototype_data_dir),
        enabled=True,
        hit=False,
    )
    _write_cached_viewport(path, request, response)
    return response


def build_cached_fixture_viewport(request: ViewportRequest, cache_dir: Path) -> ViewportResponse:
    path = _cache_path(cache_dir, request)
    cached = _read_cached_viewport(path, request)
    if cached is not None:
        return cached

    response = _with_cache_metadata(build_fixture_viewport(request), enabled=True, hit=False)
    _write_cached_viewport(path, request, response)
    return response


def _extract_json_object(text: str, marker: str) -> dict[str, Any] | None:
    marker_index = text.find(marker)
    if marker_index < 0:
        return None
    start = text.find("{", marker_index)
    if start < 0:
        return None
    container = re.escape(marker.split("[", 1)[0])
    prefix = re.sub(r"/\*.*?\*/|//[^\r\n]*", "", text[:marker_index], flags=re.DOTALL)
    initializer = rf"\s*(?:{container}\s*=\s*{container}\s*\|\|\s*\{{\s*\}}\s*;)?\s*"
    wrapped = bool(re.fullmatch(r'\s*\(function\s*\(\s*\)\s*\{\s*(?:[\'"]use strict[\'"]\s*;)?\s*', prefix))
    if (not wrapped and not re.fullmatch(initializer, prefix)) or text[marker_index + len(marker):start].strip() != "=":
        return None
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                suffix = re.sub(r"/\*.*?\*/|//[^\r\n]*", "", text[index + 1:], flags=re.DOTALL).strip()
                if wrapped and not re.fullmatch(r";?\s*\}\s*\)\s*\(\s*\)\s*;?", suffix):
                    return None
                if not wrapped and suffix not in {"", ";"}:
                    return None
                payload = decode_controlled_json(text[start : index + 1], max_bytes=MAX_STATIC_BYTES)
                json.dumps(payload, allow_nan=False)
                return payload if isinstance(payload, dict) else None
    return None


def _load_js_assignment(path: Path, marker: str) -> dict[str, Any] | None:
    try:
        with path.open("rb") as stream:
            raw = stream.read(MAX_STATIC_BYTES + 1)
        if len(raw) > MAX_STATIC_BYTES:
            return None
        text = raw.decode("utf-8")
        return _extract_json_object(text, marker)
    except (OSError, ValueError, RecursionError):
        return None


def _load_day_payload(prototype_data_dir: Path, observation_date: str) -> dict[str, Any] | None:
    marker = f'window.OF_DATA_DAYS["{observation_date}"]'
    raw = _load_js_assignment(prototype_data_dir / "day" / f"{observation_date}.js", marker)
    try:
        day = DayExport.model_validate(raw)
        if day.date is not None and day.date != observation_date:
            return None
    except ValueError:
        return None
    result = day.model_dump(mode="json")
    counts = Counter(item.get("front_id") for item in day.objects
                     if isinstance(item, dict) and isinstance(item.get("front_id"), str))
    objects = []
    for raw_object in day.objects:
        try:
            parsed = FrontObject.model_validate(raw_object)
            if counts[parsed.front_id] == 1:
                objects.append(parsed.model_dump(mode="json"))
        except ValueError:
            continue
    result["objects"] = objects
    result["_excluded_objects"] = len(day.objects) - len(result["objects"])
    return result


def _load_sst_payload(prototype_data_dir: Path, observation_date: str) -> dict[str, Any] | None:
    marker = f'window.OF_DATA_SST["{observation_date}"]'
    raw = _load_js_assignment(prototype_data_dir / "sst" / f"{observation_date}.js", marker)
    try:
        parsed = SstExport.model_validate(raw)
        if parsed.date is not None and parsed.date != observation_date:
            return None
        return parsed.model_dump(mode="json")
    except ValueError:
        return None


def _load_response_payload(prototype_data_dir: Path) -> dict[str, Any] | None:
    raw = _load_js_assignment(prototype_data_dir / "front_response" / "events.js", "window.OF_FRONT_RESPONSE")
    try:
        return ResponseExport.model_validate(raw).model_dump(mode="json")
    except ValueError:
        return None


def _grid_bbox(grid: dict[str, Any]) -> tuple[float, float, float, float]:
    lon0 = float(grid["lon0"])
    lat0 = float(grid["lat0"])
    dlon = float(grid["dlon"])
    dlat = float(grid["dlat"])
    nx = int(grid["nx"])
    ny = int(grid["ny"])
    return (
        lon0 - dlon / 2,
        lat0 - dlat / 2,
        lon0 + dlon * (nx - 0.5),
        lat0 + dlat * (ny - 0.5),
    )


def _grid_resolution(grid: dict[str, Any]) -> float:
    return _round_float(max(abs(float(grid["dlon"])), abs(float(grid["dlat"]))))


def _bbox_status(request_bbox: list[float], data_bbox: tuple[float, float, float, float]) -> tuple[str, list[float] | None]:
    intersection = _intersect_bbox(request_bbox, data_bbox)
    if intersection is None:
        return "empty", None
    if _contains_bbox(data_bbox, request_bbox):
        return "ok", _round_bbox(request_bbox)
    return "partial", _round_bbox(intersection)


def _coverage_layer_status(raw_status: str, viewport_status: str) -> str:
    if raw_status in {"empty", "unavailable"}:
        return raw_status
    return "partial" if "partial" in {raw_status, viewport_status} else "available"


def _feature_for_front(front: dict[str, Any]) -> dict[str, Any]:
    coordinates = [_round_point(point) for point in front.get("line", []) if isinstance(point, list) and len(point) == 2]
    return {
        "type": "Feature",
        "properties": {
            "frontId": str(front.get("front_id", "")),
            "kind": "ocean_front",
            "pixelCount": front.get("pixel_count"),
            "lengthKm": _round_float(front["length_km"], 1) if front["length_km"] is not None else None,
            "centroid": _round_point(front.get("centroid") or [0, 0]),
            "bbox": _round_bbox(front.get("bbox") or [0, 0, 0, 0]),
            "codes": [int(code) for code in front.get("codes", [])],
        },
        "geometry": {"type": "LineString", "coordinates": coordinates},
    }


def _front_bbox_touches(query: list[float], bounds: list[float]) -> bool:
    # A line's envelope may have zero width/height; it does not need raster area.
    return (bounds[0] <= query[2] and bounds[2] >= query[0]
            and bounds[1] <= query[3] and bounds[3] >= query[1])


def _front_layers(day_payload: dict[str, Any], query_bbox: list[float]) -> tuple[dict[str, Any], str]:
    features = []
    for front in day_payload.get("objects", []):
        if not isinstance(front, dict):
            continue
        front_bbox = front.get("bbox")
        if isinstance(front_bbox, list) and len(front_bbox) == 4 and _front_bbox_touches(query_bbox, front_bbox):
            features.append(_feature_for_front(front))
    layer = {
        "type": "FeatureCollection",
        "features": features,
        "source": {
            "kind": "static_prototype_day",
            "file": day_payload.get("source_file"),
            "objectCount": len(day_payload.get("objects", [])),
            "excludedObjects": day_payload.get("_excluded_objects", 0),
        },
    }
    if day_payload.get("_excluded_objects"):
        return layer, "partial" if features else "unavailable"
    return layer, "available" if features else "empty"


def _sample_sst_cells(
    sst_payload: dict[str, Any],
    query_bbox: list[float],
    step: int,
) -> list[dict[str, object]]:
    grid = sst_payload.get("grid") or {}
    lon0 = float(grid["lon0"])
    lat0 = float(grid["lat0"])
    dlon = float(grid["dlon"])
    dlat = float(grid["dlat"])
    nx = int(grid["nx"])
    ny = int(grid["ny"])
    sample_step = max(1, step)
    cells: list[dict[str, object]] = []
    bin_c = float(sst_payload.get("bin_c") or (sst_payload.get("product") or {}).get("bin_c") or 1)
    for run in sst_payload.get("runs", []):
        if not isinstance(run, list) or len(run) != 4:
            continue
        row, start, count, bin_value = [int(value) for value in run]
        if row < 0 or row >= ny or row % sample_step != 0:
            continue
        lat = lat0 + row * dlat
        if lat < query_bbox[1] or lat > query_bbox[3]:
            continue
        stop = min(start + count, nx)
        for col in range(max(0, start), stop):
            if col % sample_step != 0:
                continue
            lon = lon0 + col * dlon
            if query_bbox[0] <= lon <= query_bbox[2]:
                cells.append(
                    {
                        "lon": _round_float(lon),
                        "lat": _round_float(lat),
                        "value": _round_float(bin_value * bin_c, 2),
                        "bin": bin_value,
                    }
                )
    return cells


def _sst_layer(
    sst_payload: dict[str, Any] | None,
    query_bbox: list[float],
    step: int,
) -> tuple[dict[str, Any], str]:
    if sst_payload is None:
        return {"unit": "celsius", "cells": [], "source": {"kind": "unavailable_static_prototype_sst"}}, "unavailable"
    cells = _sample_sst_cells(sst_payload, query_bbox, step)
    product = sst_payload.get("product") if isinstance(sst_payload.get("product"), dict) else {}
    return (
        {
            "unit": "celsius",
            "sourceUnit": product.get("unit", "degree_C"),
            "cells": cells,
            "source": {
                "kind": "static_prototype_sst",
                "file": sst_payload.get("source_file"),
                "product": product,
            },
            "stats": sst_payload.get("stats") or {},
        },
        "available" if cells else "empty",
    )


def _front_centroids(day_payload: dict[str, Any]) -> dict[str, list[float]]:
    centroids: dict[str, list[float]] = {}
    for front in day_payload.get("objects", []):
        if not isinstance(front, dict):
            continue
        front_id = str(front.get("front_id") or "")
        centroid = front.get("centroid")
        if front_id and isinstance(centroid, list) and len(centroid) == 2:
            centroids[front_id] = _round_point(centroid)
    return centroids


def _front_bbox_by_id(day_payload: dict[str, Any]) -> dict[str, list[float]]:
    bboxes: dict[str, list[float]] = {}
    for front in day_payload.get("objects", []):
        if not isinstance(front, dict):
            continue
        front_id = str(front.get("front_id") or "")
        bbox = front.get("bbox")
        if front_id and isinstance(bbox, list) and len(bbox) == 4:
            bboxes[front_id] = _round_bbox(bbox)
    return bboxes


def _response_records_for_date(response_payload: dict[str, Any] | None, observation_date: str) -> list[dict[str, Any]]:
    if response_payload is None:
        return []
    by_date = response_payload.get("by_date")
    if isinstance(by_date, dict):
        date_payload = by_date.get(observation_date)
        if isinstance(date_payload, dict):
            by_range = date_payload.get("by_range")
            if isinstance(by_range, dict):
                return [record for record in by_range.values() if isinstance(record, dict)]
    records = []
    for event in response_payload.get("events", []):
        if isinstance(event, dict) and event.get("date") == observation_date:
            records.append(event)
    return records


def _fishing_layer(
    response_payload: dict[str, Any] | None,
    day_payload: dict[str, Any],
    observation_date: str,
    query_bbox: list[float],
) -> tuple[dict[str, Any], str]:
    source = (response_payload or {}).get("source") if isinstance((response_payload or {}).get("source"), dict) else {}
    layer = {
        "metric": "apparent_fishing_effort",
        "unit": "fishing_hours",
        "cells": [],
        "source": source or {"kind": "unavailable_front_response"},
        "representation": "front_response_aggregate_points",
    }
    if response_payload is None:
        return layer, "unavailable"
    centroids = _front_centroids(day_payload)
    front_bboxes = _front_bbox_by_id(day_payload)
    records = _response_records_for_date(response_payload, observation_date)
    cells = []
    rejected = 0
    identities = []
    for record in records:
        try:
            identity = ResponseIdentity.model_validate(record)
            identities.append((identity.front_id, identity.buffer_km))
        except ValueError:
            identities.append(None)
    counts = Counter(key for key in identities if key is not None)
    partial = response_payload.get("status") == "partial"
    for record, identity in zip(records, identities, strict=True):
        if identity is None or counts[identity] != 1:
            rejected += 1
            continue
        try:
            record = ResponseRecord.model_validate(record).model_dump()
        except ValueError:
            rejected += 1
            continue
        if record["date"] is not None and record["date"] != observation_date:
            rejected += 1
            continue
        front_id = str(record.get("front_id") or "")
        centroid = centroids.get(front_id)
        front_bbox = front_bboxes.get(front_id)
        if centroid is None or front_bbox is None or not _front_bbox_touches(query_bbox, front_bbox):
            continue
        partial = partial or "partial" in {record["coverage_status"], record["status"]}
        cells.append(
            {
                "lon": centroid[0],
                "lat": centroid[1],
                "frontId": front_id,
                "bufferKm": record["buffer_km"],
                "hours": _round_float(record["post1_3_hours"], 2),
                "pre7Hours": _round_float(record["pre7_hours"], 2) if record["pre7_hours"] is not None else None,
                "controlHours": _round_float(record["non_front_control_hours"], 2) if record["non_front_control_hours"] is not None else None,
                "liftPercent": _round_float(record["lift_percent"], 2) if record["lift_percent"] is not None else None,
                "enhanced": record["enhanced_flag"],
                "responseId": record.get("response_id"),
                "coverageStatus": record.get("coverage_status") or record.get("status"),
            }
        )
    layer["cells"] = cells
    layer["timeWindow"] = (response_payload or {}).get("time_window") or {}
    layer["spatialWindow"] = (response_payload or {}).get("spatial_window") or {}
    layer["excludedRecords"] = rejected
    return layer, ("partial" if rejected or partial else "available") if cells else "unavailable"


def _overall_status(
    viewport_status: str,
    fronts_status: str,
    sst_status: str,
    fishing_status: str,
) -> str:
    layer_statuses = [fronts_status, sst_status, fishing_status]
    if viewport_status in {"empty", "unavailable"}:
        return viewport_status
    if viewport_status == "partial":
        return "partial"
    if all(status == "available" for status in layer_statuses):
        return "ok"
    if all(status == "empty" for status in layer_statuses):
        return "empty"
    return "partial"


def _static_caveats(
    status: str,
    fronts_status: str,
    sst_status: str,
    fishing_status: str,
) -> list[str]:
    caveats = [
        "Static prototype data is served through the backend viewport contract; raw NetCDF and raw AIS/GFW ingestion are not part of this endpoint yet.",
        "Fishing layer uses apparent fishing effort measured as fishing hours, not catch or yield.",
        "SST values are returned in Celsius and come from the committed static prototype SST artifact.",
        "Response points represent post1_3_hours at front centroids, not same-day activity grid cells; missing metrics are not zero.",
    ]
    if status == "partial":
        caveats.append("Partial coverage: returned data only covers the overlap with committed prototype artifacts.")
    if status == "empty":
        caveats.append("Empty coverage means the requested bbox has no covered static prototype cells here, not zero activity.")
    if status == "unavailable":
        caveats.append("Unavailable coverage means a required static prototype artifact is missing for this request, not zero activity.")
    if "unavailable" in {fronts_status, sst_status, fishing_status}:
        caveats.append("At least one layer is unavailable for this date or source; clients must keep this distinct from zero values.")
    return caveats


def build_static_prototype_viewport(request: ViewportRequest, prototype_data_dir: Path) -> ViewportResponse:
    observation_date = request.date.isoformat()
    rounded_bbox = _round_bbox(request.bbox)
    day_payload = _load_day_payload(prototype_data_dir, observation_date)
    if day_payload is None:
        caveats = _static_caveats("unavailable", "unavailable", "unavailable", "unavailable")
        return ViewportResponse(
            meta=ViewportMeta(
                status="unavailable",
                source="static_prototype",
                date=request.date,
                bbox=rounded_bbox,
                step=request.step,
                resolution=ViewportResolution(spatial_deg=0.05),
                cache=ViewportCacheMetadata(enabled=False, hit=False, version=VIEWPORT_CACHE_VERSION),
            ),
            layers=_empty_layers(),
            coverage=ViewportCoverage(
                status="unavailable",
                bbox=None,
                request_bbox=rounded_bbox,
                covered_bbox=None,
                layers=ViewportLayerCoverage(
                    fronts="unavailable",
                    sst="unavailable",
                    fishing_effort="unavailable",
                ),
            ),
            caveats=caveats,
        )

    grid = day_payload.get("grid") if isinstance(day_payload.get("grid"), dict) else {}
    data_bbox = _grid_bbox(grid)
    viewport_status, covered_bbox = _bbox_status(rounded_bbox, data_bbox)
    if viewport_status == "empty":
        caveats = _static_caveats("empty", "empty", "empty", "empty")
        return ViewportResponse(
            meta=ViewportMeta(
                status="empty",
                source="static_prototype",
                date=request.date,
                bbox=rounded_bbox,
                step=request.step,
                resolution=ViewportResolution(spatial_deg=_grid_resolution(grid)),
                cache=ViewportCacheMetadata(enabled=False, hit=False, version=VIEWPORT_CACHE_VERSION),
            ),
            layers=_empty_layers(),
            coverage=ViewportCoverage(
                status="empty",
                bbox=None,
                request_bbox=rounded_bbox,
                covered_bbox=None,
                layers=ViewportLayerCoverage(fronts="empty", sst="empty", fishing_effort="empty"),
            ),
            caveats=caveats,
        )

    query_bbox = covered_bbox or rounded_bbox
    fronts, raw_fronts_status = _front_layers(day_payload, query_bbox)
    sst, raw_sst_status = _sst_layer(_load_sst_payload(prototype_data_dir, observation_date), query_bbox, request.step)
    fishing, raw_fishing_status = _fishing_layer(
        _load_response_payload(prototype_data_dir),
        day_payload,
        observation_date,
        query_bbox,
    )
    fronts_status = _coverage_layer_status(raw_fronts_status, viewport_status)
    sst_status = _coverage_layer_status(raw_sst_status, viewport_status)
    fishing_status = _coverage_layer_status(raw_fishing_status, viewport_status)
    status = _overall_status(viewport_status, fronts_status, sst_status, fishing_status)

    return ViewportResponse(
        meta=ViewportMeta(
            status=status,
            source="static_prototype",
            date=request.date,
            bbox=rounded_bbox,
            step=request.step,
            resolution=ViewportResolution(spatial_deg=_grid_resolution(grid)),
            cache=ViewportCacheMetadata(enabled=False, hit=False, version=VIEWPORT_CACHE_VERSION),
        ),
        layers=ViewportLayers(fronts=fronts, sst=sst, fishing_effort=fishing),
        coverage=ViewportCoverage(
            status=status,
            bbox=covered_bbox,
            request_bbox=rounded_bbox,
            covered_bbox=covered_bbox,
            layers=ViewportLayerCoverage(
                fronts=fronts_status,
                sst=sst_status,
                fishing_effort=fishing_status,
            ),
        ),
        caveats=_static_caveats(status, fronts_status, sst_status, fishing_status),
    )


def build_fixture_viewport(request: ViewportRequest) -> ViewportResponse:
    rounded_bbox = _round_bbox(request.bbox)
    intersection = _intersect_bbox(rounded_bbox, FIXTURE_BBOX)
    covered_bbox: list[float] | None
    if request.date != FIXTURE_DATE:
        status = "unavailable"
        covered_bbox = None
        layers = _empty_layers()
        coverage_layers = ViewportLayerCoverage(
            fronts="unavailable",
            sst="unavailable",
            fishing_effort="unavailable",
        )
        caveats = [
            f"Fixture viewport coverage is only available for {FIXTURE_DATE.isoformat()}.",
            "Unavailable coverage means the layer is missing for this request, not zero activity.",
        ]
    elif intersection is None:
        status = "empty"
        covered_bbox = None
        layers = _empty_layers()
        coverage_layers = ViewportLayerCoverage(
            fronts="empty",
            sst="empty",
            fishing_effort="empty",
        )
        caveats = [
            "Requested bbox is outside fixture coverage.",
            "Empty fixture coverage means no covered cells are available here, not zero activity.",
        ]
    elif _is_inside_fixture(rounded_bbox):
        status = "ok"
        covered_bbox = rounded_bbox
        layers = _fixture_layers(tuple(rounded_bbox))
        coverage_layers = ViewportLayerCoverage(
            fronts="available",
            sst="available",
            fishing_effort="available",
        )
        caveats = [
            "Fixture viewport payload for API contract validation; not a scientific result.",
        ]
    else:
        status = "partial"
        covered_bbox = _round_bbox(intersection)
        layers = _fixture_layers(intersection)
        coverage_layers = ViewportLayerCoverage(
            fronts="partial",
            sst="partial",
            fishing_effort="partial",
        )
        caveats = [
            "Partial fixture coverage: returned cells only cover the overlap with the fixture bbox.",
            "Missing coverage outside the overlap must not be interpreted as zero activity.",
        ]
    caveats.append(
        "Fishing layer uses apparent fishing effort measured as fishing hours, not catch or yield."
    )

    return ViewportResponse(
        meta=ViewportMeta(
            status=status,
            source="fixture",
            date=request.date,
            bbox=rounded_bbox,
            step=request.step,
            resolution=ViewportResolution(spatial_deg=0.05),
            cache=ViewportCacheMetadata(enabled=False, hit=False, version=VIEWPORT_CACHE_VERSION),
        ),
        layers=layers,
        coverage=ViewportCoverage(
            status=status,
            bbox=covered_bbox,
            request_bbox=rounded_bbox,
            covered_bbox=covered_bbox,
            layers=coverage_layers,
        ),
        caveats=caveats,
    )
