"""Explicit, bounded regional-support arithmetic; never grants research qualification."""

import argparse
import json
import math
import re
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

import pyproj
import shapely
from audit_daily_sources import digest, file_digest, unique_json_object
from pyproj import CRS, Geod, Transformer
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

SCHEMA = "ocean-regional-support/v1"
METHOD = "wgs84-laea-uniform/v1"
AREA_TOL = 1e-6
MAX_CONTROLLED_JSON_BYTES = 16 * 1024 * 1024
GEOD = Geod(ellps="WGS84")
pyproj.network.set_network_enabled(False)


def finite(value):
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and math.isfinite(value)
    )


def iso_day(value):
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError("invalid_date")
    return parsed


def controlled_json_bytes(path):
    with path.open("rb") as stream:
        raw = stream.read(MAX_CONTROLLED_JSON_BYTES + 1)
    if len(raw) > MAX_CONTROLLED_JSON_BYTES:
        raise ValueError("input_budget_exceeded")
    return raw


def controlled_json(path):
    return json.loads(
        controlled_json_bytes(path).decode("utf-8"),
        object_pairs_hook=unique_json_object,
    )


def bounds(value):
    if (
        not isinstance(value, list)
        or len(value) != 4
        or not all(finite(v) for v in value)
        or not -180 <= value[0] < value[2] <= 180
        or not -80 <= value[1] < value[3] <= 80
        or value[2] - value[0] > 12
        or value[3] - value[1] > 12
    ):
        raise ValueError("unsupported_or_invalid_bounds")
    return value


class MetricPlane:
    """Local WGS84 equal-area plane, retaining constant-latitude cell edges."""

    def __init__(self, longitude, latitude):
        self.longitude, self.latitude = longitude, latitude
        crs = CRS.from_proj4(
            f"+proj=laea +lat_0={latitude} +lon_0={longitude} +datum=WGS84 +units=m"
        )
        self.forward = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform

    def rectangle(self, value):
        west, south, east, north = bounds(value)
        if any(abs(x - self.longitude) > 6 for x in [west, east]) or any(
            abs(y - self.latitude) > 6 for y in [south, north]
        ):
            raise ValueError("source_outside_local_projection_domain")
        nx, ny = (
            max(1, math.ceil((east - west) / 0.002)),
            max(1, math.ceil((north - south) / 0.002)),
        )
        points = (
            [(west + (east - west) * i / nx, south) for i in range(nx)]
            + [(east, south + (north - south) * i / ny) for i in range(ny)]
            + [(east - (east - west) * i / nx, north) for i in range(nx)]
            + [(west, north - (north - south) * i / ny) for i in range(ny)]
        )
        return self.project(Polygon(points))

    def project(self, shape):
        return shapely.transform(shape, self.forward, interleaved=False)

    def circle(self, center, radius):
        angles = [i * 0.5 for i in range(720)]
        lon, lat, _ = GEOD.fwd(
            [center[0]] * 720, [center[1]] * 720, angles, [radius * 1000] * 720
        )
        if any(
            abs(x - center[0]) > 6 or abs(y) > 80 for x, y in zip(lon, lat, strict=True)
        ):
            raise ValueError("unsupported_geometry_extent")
        return self.project(Polygon(zip(lon, lat, strict=True)))


def validate_request(value):
    if (
        not isinstance(value, dict)
        or value.get("schema") != "ocean-regional-request/v1"
    ):
        raise ValueError("invalid_regional_request")
    if set(value) - {
        "schema",
        "purpose",
        "start",
        "end",
        "allocation",
        "geometries",
        "source_ids",
        "method_version",
        "baseline_hours",
    }:
        raise ValueError("unknown_request_fields")
    if value.get("method_version", METHOD) != METHOD:
        raise ValueError("unsupported_method_version")
    if "baseline_hours" in value and (
        not finite(value["baseline_hours"]) or value["baseline_hours"] < 0
    ):
        raise ValueError("invalid_baseline")
    if value.get("purpose") not in {"front_effort", "front_effort_sst"}:
        raise ValueError("unsupported_purpose")
    if value.get("allocation") not in {"overlap_uniform", "cell_center"}:
        raise ValueError("unsupported_allocation")
    ids = value.get(
        "source_ids",
        {
            "front": "front-original",
            "activity": "effort-original",
            "sst": "sst-original",
        },
    )
    if (
        not isinstance(ids, dict)
        or set(ids) - {"front", "activity", "sst"}
        or any(
            not isinstance(v, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", v)
            for v in ids.values()
        )
    ):
        raise ValueError("invalid_source_ids")
    start, end = iso_day(value["start"]), iso_day(value["end"])
    if not 0 <= (end - start).days <= 366:
        raise ValueError("invalid_date_range")
    geometries = value["geometries"]
    if not isinstance(geometries, list) or not 1 <= len(geometries) <= 3:
        raise ValueError("invalid_geometry_budget")
    ids = []
    for geometry in geometries:
        if not isinstance(geometry, dict) or geometry.get("type") not in {
            "bbox",
            "circle",
            "front_buffer",
        }:
            raise ValueError("unsupported_geometry")
        name = geometry.get("id")
        if not isinstance(name, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", name):
            raise ValueError("invalid_geometry_id")
        ids.append(name)
        allowed = {
            "bbox": {"id", "type", "bounds"},
            "circle": {"id", "type", "center", "radius_km"},
            "front_buffer": {"id", "type", "lines", "radius_km"},
        }[geometry["type"]]
        if set(geometry) - allowed:
            raise ValueError("unknown_geometry_fields")
        if geometry["type"] == "bbox":
            bounds(geometry["bounds"])
        elif geometry["type"] == "circle":
            center, radius = geometry["center"], geometry["radius_km"]
            if (
                not isinstance(center, list)
                or len(center) != 2
                or not all(finite(v) for v in center)
                or not -180 < center[0] < 180
                or not -80 < center[1] < 80
                or not finite(radius)
                or radius not in {10, 20, 30}
            ):
                raise ValueError("invalid_circle")
        else:
            lines, radius = geometry["lines"], geometry["radius_km"]
            if (
                not isinstance(lines, list)
                or not 1 <= len(lines) <= 64
                or not finite(radius)
                or radius not in {10, 20, 30}
            ):
                raise ValueError("invalid_buffer")
            points = []
            for line in lines:
                if not isinstance(line, list) or not 2 <= len(line) <= 128:
                    raise ValueError("invalid_front_line")
                for point in line:
                    if (
                        not isinstance(point, list)
                        or len(point) != 2
                        or not all(finite(v) for v in point)
                        or not -180 < point[0] < 180
                        or not -79.5 < point[1] < 79.5
                    ):
                        raise ValueError("invalid_front_line")
                if len({tuple(point) for point in line}) < 2:
                    raise ValueError("invalid_front_line")
                points.extend(line)
            if (
                len(points) > 1024
                or max(p[0] for p in points) - min(p[0] for p in points) > 2
                or max(p[1] for p in points) - min(p[1] for p in points) > 2
            ):
                raise ValueError("unsupported_buffer_extent")
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate_geometry_id")
    return start, end


def from_daily_snapshot(snapshot, request):
    if (
        not isinstance(snapshot, dict)
        or snapshot.get("schema") != "ocean-daily-source-audit/v1"
        or snapshot.get("daily_snapshot_id")
        != "sha256:"
        + digest({k: v for k, v in snapshot.items() if k != "daily_snapshot_id"})
    ):
        raise ValueError("invalid_daily_snapshot_identity")
    sources = snapshot["sources"]
    if (
        not isinstance(sources, list)
        or len(sources) > 16
        or len({s["id"] for s in sources}) != len(sources)
    ):
        raise ValueError("invalid_daily_sources")
    source_ids = request.get(
        "source_ids",
        {
            "front": "front-original",
            "activity": "effort-original",
            "sst": "sst-original",
        },
    )
    dates = sorted({row["date"] for source in sources for row in source["days"]})
    if len(dates) > 367:
        raise ValueError("invalid_day_budget")
    days = []
    for day in dates:
        layers = []
        for kind, source_id in source_ids.items():
            source = next((s for s in sources if s["id"] == source_id), None)
            if source is None:
                continue
            if source["kind"] != kind:
                raise ValueError("source_kind_mismatch")
            rows = [r for r in source["days"] if r["date"] == day]
            state = (
                rows[0]["state"]
                if len(rows) == 1
                else "conflict"
                if rows
                else "missing"
            )
            row = rows[0] if len(rows) == 1 else {}
            if state not in {"parsed", "unverified", "missing", "conflict"}:
                raise ValueError("invalid_daily_state")
            unit = {
                "activity": row.get("unit", "unknown"),
                "front": "classification_code"
                if row.get("code_basis") not in {None, "unverified"}
                else "unknown",
                "sst": "degree_C"
                if (row.get("decoding") or {}).get("unit_basis") == "file_attribute"
                else "unknown",
            }[kind]
            layers.append(
                {
                    "kind": kind,
                    "id": source_id,
                    "role": source["role"],
                    "unit": unit,
                    "time_verified": row.get("time_verified") is True,
                    "bounds_verified": row.get("bounds_verified") is True,
                    "support_verified": False,
                    "duration_days": None,
                    "cells": [],
                    "source_day_state": state,
                    "source_cells_unprepared": True,
                }
            )
        days.append({"date": day, "layers": layers})
    return {
        "schema": "ocean-regional-cells/v1",
        "evidence_kind": "real_source_audit",
        "days": days,
    }


def validate_cells(value):
    if (
        not isinstance(value, dict)
        or value.get("schema") != "ocean-regional-cells/v1"
        or value.get("evidence_kind")
        not in {"synthetic", "audited_cells", "real_source_audit"}
    ):
        raise TypeError("invalid_regional_cells")
    days = value["days"]
    if not isinstance(days, list) or len(days) > 367:
        raise ValueError("invalid_day_budget")
    result, cell_count, vertices = {}, 0, 0
    for day in days:
        key = iso_day(day["date"]).isoformat()
        if key in result:
            raise ValueError("duplicate_day")
        layers = day["layers"]
        if not isinstance(layers, list) or len(layers) > 3:
            raise ValueError("invalid_layer_budget")
        kinds = set()
        for layer in layers:
            if set(layer) - {
                "id",
                "kind",
                "role",
                "unit",
                "time_verified",
                "bounds_verified",
                "support_verified",
                "duration_days",
                "cells",
                "source_day_state",
                "source_cells_unprepared",
            }:
                raise ValueError("unknown_layer_fields")
            kind = layer["kind"]
            if kind not in {"front", "activity", "sst"} or kind in kinds:
                raise ValueError("duplicate_or_unknown_layer")
            kinds.add(kind)
            if "source_day_state" in layer and layer["source_day_state"] not in {
                "parsed",
                "unverified",
                "missing",
                "conflict",
                "unprepared",
            }:
                raise ValueError("invalid_source_day_state")
            for flag in [
                "time_verified",
                "bounds_verified",
                "support_verified",
                "source_cells_unprepared",
            ]:
                if flag in layer and type(layer[flag]) is not bool:
                    raise ValueError("invalid_verification_flag")
            cells = layer["cells"]
            if not isinstance(cells, list) or len(cells) > 12_000:
                raise ValueError("invalid_cell_budget")
            cell_count += len(cells)
            for cell in cells:
                b = bounds(cell["bounds"])
                vertices += 2 * (
                    math.ceil((b[2] - b[0]) / 0.002) + math.ceil((b[3] - b[1]) / 0.002)
                )
                if cell.get("support") not in {"valid", "land", "missing", "unknown"}:
                    raise ValueError("invalid_support_state")
                if cell.get("side", "unknown") not in {"cold", "warm", "unknown"}:
                    raise ValueError("invalid_side")
                hours = cell.get("hours")
                if hours is not None and (not finite(hours) or hours < 0):
                    raise ValueError("invalid_cell_hours")
        result[key] = layers
    if cell_count > 120_000 or vertices > 6_000_000:
        raise ValueError("geometry_budget_exceeded")
    return result


def prepare_layer_geometry(layer, plane):
    shapes, valid, classified, weighted = [], [], [], []
    for cell in layer["cells"]:
        shape = plane.rectangle(cell["bounds"])
        shapes.append(shape)
        state = cell["support"]
        usable = state == "valid" and (
            layer["kind"] != "activity" or cell.get("hours") is not None
        )
        if usable:
            valid.append(shape)
        if state in {"land", "missing"} or usable:
            classified.append(shape)
        if usable and layer["kind"] == "activity":
            weighted.append((cell["hours"], shape))
        if usable and layer["kind"] == "front":
            weighted.append((cell.get("side", "unknown"), shape))
    union = unary_union(shapes)
    if math.fsum(shape.area for shape in shapes) - union.area > AREA_TOL * 1e6:
        raise ValueError("overlapping_source_cells")
    return {
        "valid": unary_union(valid),
        "known": unary_union(classified),
        "weighted": weighted,
    }


def regional_day(day, layers, required, region, plane, allocation, source_ids):
    area = region.area / 1e6
    row = {
        "date": day,
        "state": "unverified",
        "hours": None,
        "effective_area_km2": None,
        "area_time_km2_days": None,
        "density_hours_per_km2_day": None,
        "unknown_request_area_km2": area,
        "known_excluded_area_km2": None,
        "outside_request_selected_area_km2": None,
        "side_hours": {"cold": None, "warm": None, "unknown": None},
        "common_support_id": None,
        "reasons": [],
    }
    by_kind = {layer["kind"]: layer for layer in layers}
    row["source_states"] = {
        kind: by_kind.get(kind, {}).get(
            "source_day_state", "declared_cells" if kind in by_kind else "unprepared"
        )
        for kind in required
    }
    selected, prepared = [], {}
    row["layer_support"] = {}
    for kind in required:
        before = len(row["reasons"])
        detail = {
            "effective_area_km2": None,
            "unknown_request_area_km2": area,
            "known_excluded_area_km2": None,
            "reasons": [],
        }
        row["layer_support"][kind] = detail
        layer = by_kind.get(kind)
        if layer is None:
            row["reasons"].append(f"missing_required_{kind}_layer")
            detail["reasons"] = row["reasons"][before:]
            continue
        if layer.get("id") != source_ids.get(kind):
            row["reasons"].append(f"{kind}_source_identity_mismatch")
        if layer.get("source_cells_unprepared"):
            row["reasons"].append(f"{kind}_verified_cells_unprepared")
        if layer.get("source_day_state", "parsed") != "parsed":
            row["reasons"].append(f"{kind}_source_day_{layer['source_day_state']}")
        if layer.get("role") != "analysis_source":
            row["reasons"].append(f"{kind}_is_not_analysis_source")
        for flag in ["time_verified", "bounds_verified", "support_verified"]:
            if layer.get(flag) is not True:
                row["reasons"].append(f"{kind}_{flag}_unknown")
        expected_unit = {
            "activity": "fishing_hours",
            "front": "classification_code",
            "sst": "degree_C",
        }[kind]
        if layer.get("unit") != expected_unit:
            row["reasons"].append(f"{kind}_unit_unverified")
        duration = layer.get("duration_days")
        if not finite(duration) or not 0 < duration <= 1:
            row["reasons"].append(f"{kind}_duration_unknown")
        elif duration != 1:
            row["reasons"].append(f"{kind}_full_day_support_required")
        detail["reasons"] = row["reasons"][before:]
        if not detail["reasons"]:
            selected.append(layer)
            prepared[kind] = prepare_layer_geometry(layer, plane)
            part = prepared[kind]
            valid_area = region.intersection(part["valid"]).area / 1e6
            unknown_area = region.difference(part["known"]).area / 1e6
            detail.update(
                effective_area_km2=valid_area,
                unknown_request_area_km2=unknown_area,
                known_excluded_area_km2=max(0, area - unknown_area - valid_area),
            )
    if row["reasons"]:
        return row
    durations = [layer["duration_days"] for layer in selected]
    if max(durations) - min(durations) > 1e-12:
        row["reasons"].append("inconsistent_temporal_support")
        return row
    domain = region
    if allocation == "cell_center":
        chosen = []
        for cell in by_kind["activity"]["cells"]:
            if cell["support"] != "valid" or cell.get("hours") is None:
                continue
            b = cell["bounds"]
            center = Point(plane.forward((b[0] + b[2]) / 2, (b[1] + b[3]) / 2))
            if region.distance(center) <= 0.001:
                chosen.append(plane.rectangle(b))
        domain = unary_union(chosen)
    joint, known = domain, region
    activity, fronts = prepared["activity"]["weighted"], prepared["front"]["weighted"]
    for layer in selected:
        part = prepared[layer["kind"]]
        joint = joint.intersection(part["valid"])
        known = known.intersection(part["known"])
    joint_area = joint.area / 1e6
    unknown = max(0.0, region.difference(known).area / 1e6)
    row.update(
        unknown_request_area_km2=unknown,
        outside_request_selected_area_km2=joint.difference(region).area / 1e6,
        known_excluded_area_km2=max(
            0.0, area - unknown - region.intersection(joint).area / 1e6
        ),
    )
    if joint_area <= AREA_TOL:
        row["state"] = "zero_support"
        row["effective_area_km2"] = 0.0
        row["area_time_km2_days"] = 0.0
        row["reasons"].append("no_qualified_common_support")
        return row
    hours = math.fsum(
        value * shape.intersection(joint).area / shape.area for value, shape in activity
    )
    sides = {
        side: unary_union([shape for value, shape in fronts if value == side])
        for side in ["cold", "warm", "unknown"]
    }
    row.update(
        state="partial" if abs(area - joint_area) > AREA_TOL else "computed",
        common_support_id="sha256:" + digest(joint.normalize().wkb_hex),
        hours=hours,
        effective_area_km2=joint_area,
        area_time_km2_days=joint_area * durations[0],
        density_hours_per_km2_day=hours / (joint_area * durations[0]),
        side_hours={
            side: math.fsum(
                value * shape.intersection(joint).intersection(part).area / shape.area
                for value, shape in activity
            )
            for side, part in sides.items()
        },
    )
    return row


def summarize_period(rows, baseline=None):
    supported = [
        r
        for r in rows
        if r["hours"] is not None
        and r["area_time_km2_days"] is not None
        and r["area_time_km2_days"] > 0
    ]
    count = len(supported)
    hours = math.fsum(r["hours"] for r in supported) if count else None
    exposure = math.fsum(r["area_time_km2_days"] for r in supported) if count else None
    complete = count == len(rows)
    fixed_support = count > 0 and len({r["common_support_id"] for r in supported}) == 1
    total = hours if complete else None
    return {
        "requested_days": len(rows),
        "supported_days": count,
        "excluded_days": len(rows) - count,
        "total_hours": total,
        "mean_hours_per_supported_day": hours / count if fixed_support else None,
        "mean_hours_per_requested_day": total / len(rows)
        if complete and fixed_support
        else None,
        "daily_mean_reason": None
        if fixed_support
        else "daily_spatial_support_changes"
        if count
        else "no_supported_days",
        "area_time_km2_days": exposure if complete else None,
        "density_hours_per_km2_day": hours / exposure if complete else None,
        "supported_subset": {
            "hours": hours,
            "arithmetic_mean_hours_over_varying_support": hours / count
            if count
            else None,
            "area_time_km2_days": exposure,
            "density_hours_per_km2_day": hours / exposure if count else None,
        },
        "baseline_comparison": None
        if baseline is None
        else {
            "baseline_hours": baseline,
            "absolute_hours_change": total - baseline if total is not None else None,
            "relative_change": (total - baseline) / baseline
            if total is not None and baseline > 0
            else None,
            "reason": "zero_baseline"
            if baseline == 0
            else "incomplete_period"
            if not complete
            else None,
            "scope": "caller-supplied same-period total; descriptive arithmetic only",
        },
    }


def evaluate(request, data):
    start, end = validate_request(request)
    days = validate_cells(data)
    required = ["front", "activity"] + (
        ["sst"] if request["purpose"].endswith("_sst") else []
    )
    source_ids = request.get(
        "source_ids",
        {
            "front": "front-original",
            "activity": "effort-original",
            "sst": "sst-original",
        },
    )
    regions = []
    for geometry in request["geometries"]:
        if geometry["type"] == "bbox":
            b = geometry["bounds"]
            plane = MetricPlane((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
            shape = plane.rectangle(b)
        elif geometry["type"] == "circle":
            plane = MetricPlane(*geometry["center"])
            shape = plane.circle(geometry["center"], geometry["radius_km"])
        else:
            points = [p for line in geometry["lines"] for p in line]
            plane = MetricPlane(
                sum(p[0] for p in points) / len(points),
                sum(p[1] for p in points) / len(points),
            )
            shape = unary_union(
                [
                    plane.project(LineString(line)).buffer(
                        geometry["radius_km"] * 1000, quad_segs=180
                    )
                    for line in geometry["lines"]
                ]
            )
        rows = []
        for i in range((end - start).days + 1):
            day = (start + timedelta(days=i)).isoformat()
            inputs = days.get(day, [])
            alternatives = {
                mode: regional_day(
                    day, inputs, required, shape, plane, mode, source_ids
                )
                for mode in ["overlap_uniform", "cell_center"]
            }
            row = alternatives[request["allocation"]]
            row["boundary_sensitivity"] = {
                mode + "_hours": value["hours"] for mode, value in alternatives.items()
            }
            rows.append(row)
        regions.append(
            {
                "geometry": geometry,
                "requested_area_km2": shape.area / 1e6,
                "days": rows,
                "summary": summarize_period(rows, request.get("baseline_hours")),
            }
        )
    return {
        "schema": SCHEMA,
        "request": request,
        "evidence_kind": data["evidence_kind"],
        "method": {
            "id": METHOD,
            "crs": "WGS84 / local Lambert azimuthal equal-area",
            "rectangle_edge_step_deg": 0.002,
            "absolute_area_tolerance_km2": AREA_TOL,
            "circle_azimuth_step_deg": 0.5,
            "cell_center_boundary_tolerance_m": 0.001,
            "front_buffer": "union; local_projected_distance; line_extent_at_most_2_degrees",
            "shapely": shapely.__version__,
            "pyproj": pyproj.__version__,
            "GEOS": shapely.geos_version_string,
            "PROJ": pyproj.proj_version_str,
            "assumption": "hours uniformly distributed within each verified source cell",
        },
        "required_layers": required,
        "regions": regions,
        "research_ready": False,
        "public_release_approved": False,
    }


def atomic_text(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(value)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def paths_overlap(left, right):
    a, b = left.resolve(), right.resolve()
    return (
        a == b
        or a in b.parents
        or b in a.parents
        or (a.is_file() and b.is_file() and a.samefile(b))
    )


def render_report(result):
    lines = [
        "# Regional support audit",
        "",
        f"Snapshot: {result['regional_snapshot_id']}",
        "",
        "Research qualification and public release remain unapproved.",
        "",
        "| Region | Day | State | Hours | Effective km² | km²-days | Reasons |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for region in result["regions"]:
        for row in region["days"]:
            values = [
                region["geometry"]["id"],
                row["date"],
                row["state"],
                row["hours"],
                row["effective_area_km2"],
                row["area_time_km2_days"],
                ", ".join(row["reasons"]),
            ]
            lines.append(
                "| "
                + " | ".join("unknown" if v is None else str(v) for v in values)
                + " |"
            )
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--regional-request", type=Path)
    parser.add_argument("--read-regional-snapshot", type=Path)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--regional-input", type=Path)
    group.add_argument("--daily-snapshot", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--report-out", type=Path)
    args = parser.parse_args()
    if args.read_regional_snapshot:
        if any(
            [
                args.regional_request,
                args.regional_input,
                args.daily_snapshot,
                args.out,
                args.report_out,
            ]
        ):
            raise ValueError("mixed_read_and_compute_arguments")
        result = controlled_json(args.read_regional_snapshot)
        if (
            not isinstance(result, dict)
            or result.get("schema") != SCHEMA
            or result.get("regional_snapshot_id")
            != "sha256:"
            + digest({k: v for k, v in result.items() if k != "regional_snapshot_id"})
        ):
            raise ValueError("invalid_regional_snapshot_identity")
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return
    input_path = args.regional_input or args.daily_snapshot
    if not args.regional_request or not input_path or not args.out:
        raise ValueError("missing_regional_compute_arguments")
    outputs = [p for p in [args.out, args.report_out] if p is not None]
    if any(
        paths_overlap(out, source)
        for out in outputs
        for source in [args.regional_request, input_path]
    ) or (len(outputs) == 2 and paths_overlap(*outputs)):
        raise ValueError("output_overlaps_input_or_output")
    request = controlled_json(args.regional_request)
    validate_request(request)
    data = controlled_json(input_path)
    if not isinstance(data, dict):
        raise TypeError("invalid_regional_cells")
    snapshot_id = None
    if args.daily_snapshot:
        snapshot_id = data.get("daily_snapshot_id")
        data = from_daily_snapshot(data, request)
    elif data.get("evidence_kind") == "real_source_audit":
        raise ValueError("daily_snapshot_required")
    result = evaluate(request, data)
    result["input_sha256"] = file_digest(input_path)
    result["input_daily_snapshot_id"] = snapshot_id
    result["source_reader_sha256"] = file_digest(
        Path(__file__).with_name("audit_daily_sources.py")
    )
    result["auditor_sha256"] = file_digest(Path(__file__))
    result["regional_snapshot_id"] = "sha256:" + digest(result)
    atomic_text(
        args.out,
        json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
    )
    if args.report_out:
        atomic_text(args.report_out, render_report(result))
    print("Regional support audit complete; research qualification remains separate.")


if __name__ == "__main__":
    try:
        main()
    except (
        ValueError,
        TypeError,
        KeyError,
        IndexError,
        OSError,
        OverflowError,
        RecursionError,
    ) as error:
        message = str(error)
        print(
            "Regional support audit failed: "
            + (message if re.fullmatch("[a-z_]+", message) else type(error).__name__),
            file=sys.stderr,
        )
        raise SystemExit(1) from None
