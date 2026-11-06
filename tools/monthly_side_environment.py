"""Side classification and optional SST on the direct reference's common support."""

import math
from collections import Counter

import audit_regional_support as p0
from shapely.errors import GEOSException
from shapely.geometry import GeometryCollection
from shapely.ops import unary_union
from shapely.strtree import STRtree

VERSION = "p0-side-and-sst/v1"
SIDES = ("cold", "warm", "unknown")
MAX_DAILY_SST_CELL_PAIRS = 4096


def side_masks(layers, plane):
    layer = next(item for item in layers if item["kind"] == "front")
    weighted = p0.prepare_layer_geometry(layer, plane)["weighted"]
    return {
        side: unary_union([shape for label, shape in weighted if label == side])
        for side in SIDES[:-1]
    }


def classify_side(piece, masks, distance_state, distance_lower_km):
    if distance_state == "not_detected_within_search":
        return "unknown", "no_detected_line_for_side"
    if distance_lower_km is None or distance_state == "insufficient_search_support":
        return "unknown", "same_day_line_position_unverified"
    if distance_lower_km == 0:
        return "unknown", "within_line_position_uncertainty"
    candidates = [
        side
        for side, mask in masks.items()
        if piece.difference(mask).area <= piece.area * 1e-10
    ]
    if len(candidates) != 1:
        return "unknown", "side_ambiguous_or_unavailable"
    return candidates[0], "whole_contribution_on_one_product_side"


def _summary(parts, *, known_empty=False):
    hours = math.fsum(part[0] for part in parts)
    exposure = math.fsum(part[1] for part in parts)
    if not exposure:
        return {
            "hours": None,
            "area_time_km2_days": 0.0 if known_empty else None,
            "density_hours_per_km2_day": None,
            "reason": "no_supported_contribution"
            if known_empty
            else "support_unavailable",
        }
    return {
        "hours": hours,
        "area_time_km2_days": exposure,
        "density_hours_per_km2_day": hours / exposure,
        "reason": None,
    }


def _sst_parts(day, layers, plane, circle, ids, allocation, fragments=None):
    by_kind = {layer["kind"]: layer for layer in layers}
    if "sst" not in by_kind:
        return [], "missing_required_sst_layer", None, None
    layer = by_kind["sst"]
    activity_cells = by_kind.get("activity", {}).get("cells", [])
    if len(activity_cells) * len(layer["cells"]) > MAX_DAILY_SST_CELL_PAIRS:
        return [], "optional_sst_pair_budget_exceeded", None, None
    parts, ambiguous_exposures = [], []

    def contribute(pieces, _front_valid, duration):
        values, shapes = [], []
        for cell in layer["cells"]:
            if cell["support"] == "valid" and p0.finite(cell.get("temperature_c")):
                values.append(cell["temperature_c"])
                shapes.append(plane.rectangle(cell["bounds"]))
        if not shapes:
            return
        tree = STRtree(shapes)
        for hours, piece in pieces if fragments is None else fragments:
            candidates = []
            seen, ambiguous = GeometryCollection(), GeometryCollection()
            for index in sorted(tree.query(piece)):
                intersection = piece.intersection(shapes[index])
                if intersection.area > 0:
                    ambiguous = ambiguous.union(seen.intersection(intersection))
                    seen = seen.union(intersection)
                    candidates.append((index, intersection))
            ambiguous_exposures.append(ambiguous.area / 1e6 * duration)
            for index, intersection in candidates:
                area = intersection.difference(ambiguous).area
                if area > 0:
                    exposure = area / 1e6 * duration
                    parts.append(
                        (hours * area / piece.area, exposure, exposure * values[index])
                    )

    try:
        common = p0.regional_day(
            day,
            layers,
            ["front", "activity", "sst"],
            circle,
            plane,
            allocation,
            ids,
            on_common=contribute,
        )
    except ValueError as error:
        if str(error) not in {
            "overlapping_source_cells",
            "unsupported_geometry_extent",
            "source_outside_local_projection_domain",
        }:
            raise
        return [], "sst_geometry_unusable", None, None
    except GEOSException:
        return [], "sst_geometry_unusable", None, None
    reasons = common["reasons"]
    reason = (
        None
        if parts
        else reasons[0]
        if reasons
        else "no_same_day_supported_temperature"
    )
    return parts, reason, layer["id"] if parts else None, math.fsum(ambiguous_exposures)


def _sst_summary(parts, reason=None):
    summary = _summary(parts)
    exposure = summary["area_time_km2_days"]
    return {
        **summary,
        "reason": reason if exposure is None else None,
        "mean_temperature_c": math.fsum(part[2] for part in parts) / exposure
        if exposure
        else None,
        "unit": "degree_C",
        "match": "same_day_spatial_overlap_area_time_weighted",
        "time_offset_days": 0,
    }


def summarize_day(
    day, layers, plane, circle, ids, allocation, side_parts, side_reasons, common
):
    if common["hours"] is None:
        sst_parts, reason, source, ambiguous = (
            [],
            "main_support_unavailable",
            None,
            None,
        )
    else:
        sst_parts, reason, source, ambiguous = _sst_parts(
            day, layers, plane, circle, ids, allocation
        )
    sides = {
        side: _summary(parts, known_empty=common["hours"] is not None)
        for side, parts in side_parts.items()
    }
    if common["hours"] is not None and (
        not math.isclose(
            math.fsum(
                item["hours"] for item in sides.values() if item["hours"] is not None
            ),
            common["hours"],
            rel_tol=1e-12,
            abs_tol=1e-10,
        )
        or not math.isclose(
            math.fsum(item["area_time_km2_days"] or 0 for item in sides.values()),
            common["area_time_km2_days"],
            rel_tol=1e-10,
            abs_tol=p0.AREA_TOL,
        )
    ):
        raise ValueError("side_partition_not_conserved")
    return {
        "sides": sides,
        "side_reasons_by_unit_count": dict(side_reasons),
        "sst": _sst_evidence(sst_parts, reason, source, ambiguous),
    }


def _sst_evidence(parts, reason, source, ambiguous):
    return {
        **_sst_summary(parts, reason),
        "source_id": source,
        "ambiguous_area_time_km2_days": ambiguous,
    }


def summarize_sst_subset(day, layers, plane, circle, ids, allocation, fragments):
    if not fragments:
        return _sst_evidence([], "no_band_area", None, None)
    return _sst_evidence(
        *_sst_parts(day, layers, plane, circle, ids, allocation, fragments)
    )


def summarize_month(days):
    rows = [day["side_environment"] for day in days]
    supported_days = sum(day["common"]["hours"] is not None for day in days)
    sides = {}
    for side in SIDES:
        parts = [
            (entry["hours"], entry["area_time_km2_days"])
            for row in rows
            if (entry := row["sides"][side])["hours"] is not None
        ]
        sides[side] = {
            **_summary(parts, known_empty=supported_days > 0),
            "days": len(parts),
        }
    sst = [row["sst"] for row in rows if row["sst"]["hours"] is not None]
    parts = [
        (
            row["hours"],
            row["area_time_km2_days"],
            row["area_time_km2_days"] * row["mean_temperature_c"],
        )
        for row in sst
    ]
    return {
        "version": VERSION,
        "main_supported_days": supported_days,
        "sides": sides,
        "sst": {
            **_sst_summary(parts, "no_same_day_supported_temperature"),
            "days": len(sst),
            "sources": sorted({row["source_id"] for row in sst}),
            "missing_reasons_by_day_count": dict(
                Counter(row["sst"]["reason"] for row in rows if row["sst"]["reason"])
            ),
            "limitations": [
                "SST is an area-time weighted measured subset, not frontal strength or a gradient.",
                "Missing SST changes this subset only; it does not change the front-effort main analysis.",
            ],
        },
    }
