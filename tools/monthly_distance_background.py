"""Same-circle comparison on paired days, with explicit evidence and exclusions."""

import math
from collections import Counter

import audit_regional_support as p0
from monthly_side_environment import summarize_sst_subset

VERSION = "same-day-distance-background/v1"


def validate_comparison(policy, edges):
    required = {"version", "target_band", "reference_band", "minimum_area_ratio"}
    if (
        not isinstance(policy, dict)
        or not required <= set(policy) <= required | {"minimum_circle_coverage"}
        or policy["version"] != VERSION
        or type(policy["target_band"]) is not int
        or type(policy["reference_band"]) is not int
        or not 0 <= policy["target_band"] < policy["reference_band"] <= len(edges)
        or not p0.finite(policy["minimum_area_ratio"])
        or not 0 < policy["minimum_area_ratio"] <= 1
        or (
            "minimum_circle_coverage" in policy
            and (
                not p0.finite(policy["minimum_circle_coverage"])
                or not 0 <= policy["minimum_circle_coverage"] <= 1
            )
        )
    ):
        raise ValueError("invalid_same_circle_comparison_policy")
    return policy


def compare_day(day, policy, requested_area_km2):
    target = day["bands"][policy["target_band"]]
    reference = day["bands"][policy["reference_band"]]
    target_area = target["area_time_km2_days"]
    reference_area = reference["area_time_km2_days"]
    covariates = day.pop("_comparison_covariates")
    common_area = day["common"]["effective_area_km2"]
    outside_area = day["common"]["outside_request_selected_area_km2"] or 0
    coverage = (
        min(1.0, max(0.0, common_area - outside_area) / requested_area_km2)
        if common_area is not None
        else None
    )
    area_ratio = None
    if not target_area and not reference_area:
        reason = "neither_band_has_supported_area"
    elif not target_area:
        reason = "no_target_area"
    elif not reference_area:
        reason = "no_reference_area"
    else:
        area_ratio = min(target_area, reference_area) / max(target_area, reference_area)
        if any(
            group["outside_requested_circle_area_km2"] > p0.AREA_TOL
            for group in covariates.values()
        ):
            reason = "selected_support_extends_requested_circle"
        elif coverage is None or coverage < policy.get("minimum_circle_coverage", 0):
            reason = "insufficient_circle_coverage"
        elif area_ratio < policy["minimum_area_ratio"]:
            reason = "support_area_imbalance"
        else:
            reason = None
    return {
        "date": day["date"],
        "target": target,
        "reference": reference,
        "smaller_to_larger_area_ratio": area_ratio,
        "included": reason is None,
        "reason": reason,
        "target_weight": None,
        "reference_weight": None,
        "covariates": covariates,
        "common_circle_coverage": coverage,
    }


def band_covariates(day, fragments, layers, plane, circle, ids, allocation):
    areas, moments, outside = [], [], []
    for _, piece in fragments:
        anchor = piece.representative_point()
        areas.append(piece.area)
        moments.append(piece.area * math.hypot(anchor.x, anchor.y) / 1000)
        outside.append(piece.difference(circle).area)
    area = math.fsum(areas)
    return {
        "mean_local_distance_to_circle_center_km": math.fsum(moments) / area
        if area
        else None,
        "outside_requested_circle_area_km2": math.fsum(outside) / 1e6,
        "support_id": (
            "sha256:"
            + p0.digest(sorted(piece.normalize().wkb_hex for _, piece in fragments))
            if fragments
            else None
        ),
        "sst": summarize_sst_subset(
            day, layers, plane, circle, ids, allocation, fragments
        ),
    }


def _pool(paired, group):
    if not paired:
        return {
            "hours": None,
            "area_time_km2_days": None,
            "density_hours_per_km2_day": None,
        }
    hours = math.fsum(row[group]["hours"] for row in paired)
    exposure = math.fsum(row[group]["area_time_km2_days"] for row in paired)
    return {
        "hours": hours,
        "area_time_km2_days": exposure,
        "density_hours_per_km2_day": hours / exposure,
    }


def _paired_temperature(rows):
    pairs = []
    for row in rows:
        measurements = [
            row["covariates"][group]["sst"] for group in ("target", "reference")
        ]
        if all(entry["mean_temperature_c"] is not None for entry in measurements):
            pairs.append((row["date"], *measurements))
    if not pairs:
        return [], None

    def pooled_temperature(index):
        entries = [pair[index] for pair in pairs]
        exposure = math.fsum(row["area_time_km2_days"] for row in entries)
        return math.fsum(
            row["mean_temperature_c"] * (row["area_time_km2_days"] / exposure)
            for row in entries
        )

    return [pair[0] for pair in pairs], pooled_temperature(1) - pooled_temperature(2)


def compare_month(days, policy, edges, requested_area_km2):
    rows = [compare_day(day, policy, requested_area_km2) for day in days]
    paired = [row for row in rows if row["included"]]
    target, reference = _pool(paired, "target"), _pool(paired, "reference")
    for day, row in zip(days, rows, strict=True):
        if row["included"]:
            row["target_weight"] = (
                row["target"]["area_time_km2_days"] / target["area_time_km2_days"]
            )
            row["reference_weight"] = (
                row["reference"]["area_time_km2_days"] / reference["area_time_km2_days"]
            )
        day["distance_comparison"] = row
    density = target["density_hours_per_km2_day"]
    background = reference["density_hours_per_km2_day"]
    ratio = density / background if background else None
    relative_reason = None
    if ratio is not None and not math.isfinite(ratio):
        ratio, relative_reason = None, "relative_effect_outside_numeric_range"
    elif ratio is None:
        relative_reason = "zero_reference_density" if paired else "no_comparable_dates"
    sst_dates, sst_difference = _paired_temperature(paired)

    def band(index):
        return {
            "index": index,
            "lower_km": edges[index - 1] if index else 0,
            "upper_km_exclusive": edges[index] if index < len(edges) else None,
        }

    return {
        "policy": policy,
        "target_band": band(policy["target_band"]),
        "reference_band": band(policy["reference_band"]),
        "candidate_dates": [row["date"] for row in rows],
        "paired_dates": [row["date"] for row in paired],
        "excluded_reason_counts": dict(
            Counter(row["reason"] for row in rows if not row["included"])
        ),
        "target": target,
        "reference": reference,
        "difference_hours_per_km2_day": density - background if paired else None,
        "density_ratio": ratio,
        "relative_difference": ratio - 1 if ratio is not None else None,
        "relative_reason": relative_reason,
        "reason": None if paired else "no_comparable_dates",
        "status": "paired_descriptive_distance_difference"
        if paired
        else "descriptive_distance_only",
        "comparability": {
            "matched": [
                "same_date",
                "same_requested_circle",
                "same_p0_rules_and_sources",
            ],
            "weight": "area_time_within_each_band_over_the_same_paired_dates",
            "external_background": "not_registered",
            "uncontrolled": [
                "within_circle_position",
                "distance_to_coast",
                "sst",
                "water_depth",
                "gear",
            ],
            "position_diagnostic": "area_weighted_local_distance_to_circle_center_by_band",
            "sst_paired_dates": sst_dates,
            "target_minus_reference_temperature_c": sst_difference,
            "sst_reason": None
            if sst_dates
            else "no_paired_band_level_verified_temperature",
            "limitation": "Association within this support only; not a causal or predictive estimate.",
        },
    }
