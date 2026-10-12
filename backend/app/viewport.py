from __future__ import annotations

from datetime import date as DateType

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

FIXTURE_VERSION = "viewport-fixture-v1"
FIXTURE_DATE = DateType(2024, 8, 5)
FIXTURE_BBOX = (120.0, 30.0, 121.0, 31.0)


def _round_bbox(bbox: list[float] | tuple[float, float, float, float]) -> list[float]:
    return [round(value, 4) for value in bbox]


def _intersect_bbox(
    left: list[float],
    right: tuple[float, float, float, float],
) -> tuple[float, float, float, float] | None:
    min_lon = max(left[0], right[0])
    min_lat = max(left[1], right[1])
    max_lon = min(left[2], right[2])
    max_lat = min(left[3], right[3])
    if min_lon >= max_lon or min_lat >= max_lat:
        return None
    return (min_lon, min_lat, max_lon, max_lat)


def _is_inside_fixture(bbox: list[float]) -> bool:
    return (
        bbox[0] >= FIXTURE_BBOX[0]
        and bbox[1] >= FIXTURE_BBOX[1]
        and bbox[2] <= FIXTURE_BBOX[2]
        and bbox[3] <= FIXTURE_BBOX[3]
    )


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
            cache=ViewportCacheMetadata(enabled=False, hit=False, version=FIXTURE_VERSION),
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
