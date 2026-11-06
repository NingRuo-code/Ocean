"""Direct monthly distance reference over prepared P0 cells and same-day detected lines."""

import bisect
import hashlib
import json
import math
import sys
from collections import Counter
from datetime import timedelta
from itertools import pairwise
from pathlib import Path

import audit_regional_support as p0
import monthly_side_environment as environment
from audit_support_qualification import validate_conditions
from pyproj.enums import TransformDirection
from shapely.geometry import LineString, MultiLineString

METHOD = "wgs84-distance-bands/v1"
PARAMETERS = "half-open-bands/v1"
STEP_M = 50
MAX_SAMPLES = 20_000
DEFAULT_IDS = {
    "front": "front-original",
    "activity": "effort-original",
    "sst": "sst-original",
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def front_days(rows, start, end, source_id):
    require(isinstance(rows, list) and len(rows) <= 31, "invalid_front_day_budget")
    by_date = {}
    for row in rows:
        day = p0.iso_day(row["date"])
        require(start <= day <= end and day not in by_date, "invalid_front_date")
        require(row["source_id"] == source_id, "front_source_identity_mismatch")
        lines = row["lines"]
        require(
            isinstance(lines, list) and len(lines) <= 64, "invalid_front_line_budget"
        )
        if lines:
            # Reuse the P0 local line geometry limits, independently of the analysis circle.
            p0.validate_request(
                {
                    "schema": "ocean-regional-request/v1",
                    "purpose": "front_effort",
                    "start": row["date"],
                    "end": row["date"],
                    "allocation": "overlap_uniform",
                    "geometries": [
                        {
                            "id": "search",
                            "type": "front_buffer",
                            "radius_km": 10,
                            "lines": lines,
                        }
                    ],
                }
            )
        by_date[day] = lines
    return by_date


def sample_geodesics(lines, plane, valid, samples_by_line=None):
    """Sample geodesic segments with a known maximum along-line gap."""
    samples = []
    seen = set()
    for line in lines:
        if samples_by_line is not None:
            path = tuple(tuple(point) for point in line)
            key = min(path, path[::-1])
            if key in seen:
                continue
            seen.add(key)
        points = [tuple(line[0])]
        for left, right in pairwise(line):
            _, _, length = p0.GEOD.inv(*left, *right)
            sections = max(1, math.ceil(length / STEP_M))
            require(
                len(samples) + len(points) + sections <= MAX_SAMPLES,
                "front_sample_budget_exceeded",
            )
            if sections > 1:
                points.extend(p0.GEOD.npts(*left, *right, sections - 1))
            points.append(tuple(right))
        if not valid.covers(plane.project(LineString(points)).buffer(0.001)):
            return None
        if samples_by_line is not None:
            samples_by_line.append(points)
        samples.extend(points)
    return samples


def has_competing_fronts(point, by_line, position_error):
    if len(by_line) < 2:
        return False
    distances = []
    for line in by_line:
        lon, lat = zip(*line, strict=True)
        _, _, measured = p0.GEOD.inv(
            [point[0]] * len(line), [point[1]] * len(line), lon, lat
        )
        distances.append(min(measured) / 1000)
    first, second = sorted(distances)[:2]
    return second - first <= STEP_M / 2000 + 2 * position_error


def classify(point, samples, front_valid, plane, edges, position_error):
    unknown = len(edges) + 1
    if samples is None:
        return unknown, "front_line_support_unverified", None, None
    upper = None
    lower = None
    if samples:
        lon, lat = zip(*samples, strict=True)
        n = len(samples)
        _, _, measured = p0.GEOD.inv([point[0]] * n, [point[1]] * n, lon, lat)
        nearest = min(measured) / 1000
        upper = nearest + position_error
        lower = max(0.0, nearest - STEP_M / 2000 - position_error)

    def search_covers(radius):
        # P0 circle vertices are spaced 0.5°; the small outward guard covers the chord gap.
        guarded = (radius + position_error) / math.cos(math.radians(0.25)) + 0.001
        try:
            search = plane.circle(point, guarded)
        except ValueError as error:
            if str(error) != "unsupported_geometry_extent":
                raise
            return False
        return front_valid.covers(search)

    far = len(edges)
    if (lower is None or lower >= edges[-1]) and search_covers(edges[-1]):
        return (
            far,
            "not_detected_within_search" if not samples else "bounded_far",
            edges[-1],
            upper,
        )
    if upper is not None and lower < edges[-1] and search_covers(upper):
        first, last = (
            bisect.bisect_right(edges, lower),
            bisect.bisect_right(edges, upper),
        )
        if first == last:
            return first, "detected_within_band", lower, upper
        return unknown, "distance_interval_crosses_band", lower, upper
    # A detected line outside complete search remains an upper bound, not proof it was nearest.
    checked = next(
        (
            edge
            for edge in reversed(edges)
            if (lower is None or lower >= edge) and search_covers(edge)
        ),
        None,
    )
    return unknown, "insufficient_search_support", checked, upper


def summarize(parts):
    if not parts:
        return {
            "hours": None,
            "area_time_km2_days": None,
            "density_hours_per_km2_day": None,
        }
    hours = math.fsum(x[0] for x in parts)
    exposure = math.fsum(x[1] for x in parts)
    return {
        "hours": hours,
        "area_time_km2_days": exposure,
        "density_hours_per_km2_day": hours / exposure if exposure > 0 else None,
    }


def evaluate_day(
    day,
    layers,
    front_lines,
    plane,
    circle,
    required,
    ids,
    allocation,
    edges,
    error,
    side_enabled=False,
):
    bins = [[] for _ in range(len(edges) + 2)]
    states = Counter()
    bounds = []
    side_parts = {side: [] for side in environment.SIDES} if side_enabled else {}
    side_reasons = Counter()

    def contribute(pieces, front_valid, duration):
        by_line = [] if side_enabled else None
        samples = (
            None
            if front_lines is None
            else sample_geodesics(front_lines, plane, front_valid, by_line)
        )
        masks = environment.side_masks(layers, plane) if side_enabled else None
        projected_lines = (
            plane.project(MultiLineString(by_line))
            if side_enabled and samples and by_line
            else None
        )
        for hours, contribution in pieces:
            anchor = contribution.representative_point()
            point = plane.forward(
                anchor.x, anchor.y, direction=TransformDirection.INVERSE
            )
            group, state, lower, upper = classify(
                point, samples, front_valid, plane, edges, error
            )
            states[
                state if front_lines is not None else "front_line_material_missing"
            ] += 1
            bounds.append((lower, upper))
            part = (hours, contribution.area / 1e6 * duration)
            bins[group].append(part)
            if masks is not None:
                side, reason = environment.classify_side(contribution, masks, lower)
                # Allow for half the sampling interval and distortion inside the P0 local domain.
                if (
                    side != "unknown"
                    and projected_lines is not None
                    and contribution.distance(projected_lines)
                    <= (error * 1000 + STEP_M / 2) * 1.05
                ):
                    side, reason = "unknown", "within_line_position_uncertainty"
                if side != "unknown" and has_competing_fronts(point, by_line, error):
                    side, reason = "unknown", "competing_nearest_fronts"
                side_parts[side].append(part)
                side_reasons[reason] += 1

    common = p0.regional_day(
        day.isoformat(),
        layers,
        required,
        circle,
        plane,
        allocation,
        ids,
        on_common=contribute,
    )
    parts = [part for group in bins for part in group]
    if common["hours"] is not None:
        require(
            math.isclose(
                math.fsum(x[0] for x in parts),
                common["hours"],
                rel_tol=1e-12,
                abs_tol=1e-10,
            )
            and math.isclose(
                math.fsum(x[1] for x in parts),
                common["area_time_km2_days"],
                rel_tol=1e-10,
                abs_tol=p0.AREA_TOL,
            ),
            "distance_partition_not_conserved",
        )
    row = {
        "date": day.isoformat(),
        "common": common,
        "bands": [summarize(x) for x in bins],
        "distance_states": dict(states),
        "minimum_proven_lower_km": min(
            (x[0] for x in bounds if x[0] is not None), default=None
        ),
        "maximum_known_upper_km": max(
            (x[1] for x in bounds if x[1] is not None), default=None
        ),
    }
    if side_enabled:
        common.pop("side_hours", None)
        row["side_environment"] = environment.summarize_day(
            day.isoformat(),
            layers,
            plane,
            circle,
            ids,
            allocation,
            side_parts,
            side_reasons,
            common,
        )
    return row, bins


def month_activity_accounting(days):
    rows = [row["common"]["activity_accounting"] for row in days]
    result = {}
    for key in (
        "observed_hours",
        "observed_area_time_km2_days",
        "observed_not_assigned_hours",
        "observed_not_assigned_area_time_km2_days",
    ):
        known = [row[key] for row in rows if row[key] is not None]
        result[key] = math.fsum(known) if known else None
    result["reasons_by_day_count"] = dict(Counter(row["reason"] for row in rows))
    result["scope"] = (
        "sum of known observed contributions; unavailable days are not zero"
    )
    return result


class QualificationInputMismatch(ValueError):
    pass


def verify_qualification(source, resolved, conditions, request, qualification):
    if qualification is None:
        if request.get("support_snapshot_id") is not None:
            raise QualificationInputMismatch
        return
    actual = {
        "input_sha256": "sha256:" + p0.digest(source),
        "parameter": "sha256:"
        + hashlib.sha256(
            json.dumps(
                resolved, sort_keys=True, separators=(",", ":"), allow_nan=False
            ).encode()
        ).hexdigest(),
        "auditor_sha256": "sha256:"
        + p0.file_digest(Path(__file__).with_name("audit_support_qualification.py")),
        "regional_engine_sha256": "sha256:" + p0.file_digest(Path(p0.__file__)),
        "source_reader_sha256": "sha256:"
        + p0.file_digest(Path(__file__).with_name("audit_daily_sources.py")),
        "geometry_runtime": {
            "shapely": p0.shapely.__version__,
            "pyproj": p0.pyproj.__version__,
            "GEOS": p0.shapely.geos_version_string,
            "PROJ": p0.pyproj.proj_version_str,
        },
    }
    if (
        request["layer_use"] != conditions["layer_use"]
        or request["support_snapshot_id"] != qualification["snapshot_id"]
        or qualification["versions"] != actual
        or (
            request["purpose"] == "monthly_spatial_research"
            and qualification.get("distance_engine_sha256")
            != "sha256:" + p0.file_digest(Path(__file__))
        )
    ):
        raise QualificationInputMismatch


def evaluate(data, request, identity, qualification=None):
    require(data["schema"] == "ocean-month-distance-input/v1", "invalid_distance_input")
    conditions = data["conditions"]
    resolved = validate_conditions(conditions)
    start, end = p0.validate_request(resolved)
    require(
        conditions["purpose"] == "A_month" and len(resolved["geometries"]) == 1,
        "requires_one_month_circle",
    )
    geometry = resolved["geometries"][0]
    require(geometry["type"] == "circle", "requires_one_month_circle")
    require(
        geometry["center"] == [request["longitude"], request["latitude"]]
        and geometry["radius_km"] == request["radius_km"]
        and request["month"] == conditions["month"],
        "requested_conditions_not_registered",
    )
    require(
        request["input_version"] == identity
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETERS,
        "reference_version_mismatch",
    )
    source = data["regional_cells"]
    verify_qualification(source, resolved, conditions, request, qualification)
    research = request["purpose"] == "monthly_spatial_research"
    side_version = data.get("side_environment_version")
    require(
        side_version is None or (side_version == environment.VERSION and not research),
        "side_environment_registration_not_qualified",
    )
    require(
        source["evidence_kind"] == ("audited_cells" if research else "synthetic")
        and (
            not research
            or (
                qualification is not None
                and qualification.get("scope")
                == "approved_frozen_input_direct_reference"
                and qualification.get("approval_id")
                and request.get("analysis_scope") == "distance"
            )
        ),
        "real_input_requires_separate_qualification",
    )
    daily_layers = p0.validate_cells(source)
    require(
        sum(len(layer["cells"]) for day in daily_layers.values() for layer in day)
        <= 1000,
        "distance_cell_budget_exceeded",
    )
    ids = resolved.get("source_ids", DEFAULT_IDS)
    required = ["front", "activity"] + (
        ["sst"] if conditions["layer_use"].endswith("_sst") else []
    )
    edges, error = data["distance_edges_km"], data["front_position_error_km"]
    require(
        isinstance(edges, list)
        and 1 <= len(edges) <= 6
        and all(p0.finite(e) and 0 < e <= 100 for e in edges)
        and sorted(set(edges)) == edges,
        "invalid_distance_edges",
    )
    require(p0.finite(error) and 0 <= error <= 5, "invalid_front_position_error")
    lines = front_days(data["front_days"], start, end, ids.get("front"))
    plane = p0.MetricPlane(*geometry["center"])
    circle = plane.circle(geometry["center"], geometry["radius_km"])
    days, month_parts = [], [[] for _ in range(len(edges) + 2)]
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        row, bins = evaluate_day(
            day,
            daily_layers.get(day.isoformat(), []),
            lines.get(day),
            plane,
            circle,
            required,
            ids,
            conditions["allocation"],
            edges,
            error,
            side_enabled=side_version is not None,
        )
        if research:
            # This distance authorization does not cover the side subanalysis.
            row["common"].pop("side_hours", None)
        days.append(row)
        for destination, parts in zip(month_parts, bins, strict=True):
            destination.extend(parts)
    result = {
        "kind": request["purpose"],
        "evidence_kind": source["evidence_kind"],
        "research_ready": False,
        "parameters": request,
        "p0_conditions": conditions,
        "distance_edges_km": edges,
        "band_rule": "[lower,upper); last finite edge starts far; final entry is unknown",
        "position_error_km": error,
        "sample_step_m": STEP_M,
        "spatial_unit": "representative point of activity cell contribution on P0 common support",
        "versions": {
            "input": identity,
            "p0_engine": p0.file_digest(Path(p0.__file__)),
            "p0_qualification_contract": p0.file_digest(
                Path(__file__).with_name("audit_support_qualification.py")
            ),
            "distance_engine": p0.file_digest(Path(__file__)),
            "method": METHOD,
            "parameter": PARAMETERS,
            "proj": p0.pyproj.proj_version_str,
            "geos": p0.shapely.geos_version_string,
        },
        "days": days,
        "month": {
            "common": summarize([part for group in month_parts for part in group]),
            "bands": [summarize(group) for group in month_parts],
            "activity_accounting": month_activity_accounting(days),
            "scope": "known common support subset; missing or unresolved days are not full monthly coverage",
        },
    }
    if side_version is not None:
        result["month"]["side_environment"] = environment.summarize_month(days)
        result["versions"]["side_environment"] = p0.file_digest(
            Path(environment.__file__)
        )
    if qualification is not None:
        result["qualification"] = qualification
    result["result_id"] = "sha256:" + p0.digest(result)
    return result


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(p0.MAX_CONTROLLED_JSON_BYTES + 1)
        require(
            len(raw) <= p0.MAX_CONTROLLED_JSON_BYTES, "distance_input_budget_exceeded"
        )
        data = json.loads(raw, object_pairs_hook=p0.unique_json_object)
        request = json.loads(sys.argv[1])
        qualification = json.loads(sys.argv[2]) if len(sys.argv) == 3 else None
        identity = "sha256:" + hashlib.sha256(raw).hexdigest()
        print(
            json.dumps(
                evaluate(data, request, identity, qualification),
                allow_nan=False,
                ensure_ascii=True,
            )
        )
    except QualificationInputMismatch:
        print("qualification_input_or_conditions_mismatch", file=sys.stderr)
        raise SystemExit(1) from None
    except (
        ValueError,
        TypeError,
        OSError,
        KeyError,
        ArithmeticError,
        AttributeError,
        IndexError,
    ):
        raise SystemExit(1) from None
