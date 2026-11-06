"""Resample registered calendar groups while retaining paired additive evidence."""

import math
from calendar import monthrange
from collections import defaultdict
from datetime import date

import numpy as np

VERSION = "calendar-block-percentile/v1"
FIELDS = {
    "version",
    "block_days",
    "confidence_level",
    "iterations",
    "seed",
    "minimum_groups",
    "assumption",
    "rationale",
}


def validate_uncertainty(policy):
    if (
        not isinstance(policy, dict)
        or set(policy) != FIELDS
        or policy["version"] != VERSION
        or type(policy["block_days"]) is not int
        or not 1 <= policy["block_days"] <= 31
        or type(policy["confidence_level"]) not in (int, float)
        or not 0.5 < policy["confidence_level"] < 1
        or type(policy["iterations"]) is not int
        or not 200 <= policy["iterations"] <= 10_000
        or type(policy["seed"]) is not int
        or not 0 <= policy["seed"] < 2**32
        or type(policy["minimum_groups"]) is not int
        or not 2 <= policy["minimum_groups"] <= 31
        or policy["assumption"] not in ("between_blocks_supported", "unverified")
        or not isinstance(policy["rationale"], str)
        or len(policy["rationale"]) > 500
        or not policy["rationale"].strip()
    ):
        raise ValueError("invalid_uncertainty_policy")
    return policy


def _components(rows, group):
    return {
        key: math.fsum(row["distance_comparison"][group][key] for row in rows)
        for key in ("hours", "area_time_km2_days")
    }


def _block_support(days, length):
    first = date.fromisoformat(days[0]["date"])
    n_days = monthrange(first.year, first.month)[1]
    by_block = defaultdict(list)
    for row in days:
        if row["distance_comparison"]["included"]:
            day = date.fromisoformat(row["date"]).day
            by_block[(day - 1) // length].append(row)
    return [
        {
            "start": first.replace(day=index * length + 1).isoformat(),
            "end": first.replace(day=min((index + 1) * length, n_days)).isoformat(),
            "paired_dates": [row["date"] for row in rows],
            "distance_contributions": sum(
                sum(row["distance_states"].values()) for row in rows
            ),
            "target": _components(rows, "target"),
            "reference": _components(rows, "reference"),
        }
        for index, rows in sorted(by_block.items())
    ]


def estimate_uncertainty(days, comparison, policy):
    groups = _block_support(days, policy["block_days"])
    result = {
        "status": "not_reliably_estimable",
        "reason": None,
        "estimate": comparison["difference_hours_per_km2_day"],
        "unit": "fishing_hours_per_km2_day",
        "lower": None,
        "upper": None,
        "policy": policy,
        "rng": "NumPy PCG64",
        "numpy_version": np.__version__,
        "quantile_method": "linear",
        "requested_iterations": policy["iterations"],
        "valid_iterations": 0,
        "paired_days": len(comparison["paired_dates"]),
        "distance_contributions_on_paired_days": sum(
            group["distance_contributions"] for group in groups
        ),
        "supported_groups": len(groups),
        "groups": groups,
        "permutation": "not_performed",
        "limitations": [
            "Calendar blocks preserve within-block dependence but do not establish independence between blocks.",
            "Missing calendar blocks are not closed up. Only paired dates enter selected blocks.",
            "The registered assumptions are for this reference, not a formal research approval.",
            "Permutation and sign flipping require a separate exchangeability justification.",
        ],
    }
    if not groups:
        return {**result, "reason": "no_paired_support"}
    if policy["assumption"] != "between_blocks_supported":
        return {**result, "reason": "between_group_assumptions_unverified"}
    if len(groups) < policy["minimum_groups"]:
        return {**result, "reason": "insufficient_registered_groups"}
    components = np.array(
        [
            [
                group[side][key]
                for side in ("target", "reference")
                for key in ("hours", "area_time_km2_days")
            ]
            for group in groups
        ],
        dtype=np.float64,
    )
    rng = np.random.Generator(np.random.PCG64(policy["seed"]))
    draw = rng.integers(0, len(groups), size=(policy["iterations"], len(groups)))
    with np.errstate(over="ignore", divide="ignore", invalid="ignore"):
        target_h, target_e, reference_h, reference_e = components[draw].sum(axis=1).T
        effects = target_h / target_e - reference_h / reference_e
    valid = (
        (target_e > 0)
        & (reference_e > 0)
        & np.isfinite(target_e)
        & np.isfinite(reference_e)
        & np.isfinite(effects)
    )
    result["valid_iterations"] = int(valid.sum())
    if not bool(valid.all()):
        return {**result, "reason": "invalid_or_zero_exposure_resamples"}
    if math.isclose(
        float(effects.min()), float(effects.max()), rel_tol=1e-12, abs_tol=1e-12
    ):
        return {**result, "reason": "degenerate_block_distribution"}
    tail = (1 - policy["confidence_level"]) / 2
    with np.errstate(over="ignore", invalid="ignore"):
        lower, upper = np.quantile(effects, [tail, 1 - tail], method="linear")
    if not all(math.isfinite(bound) for bound in (lower, upper)):
        return {**result, "reason": "nonfinite_percentile_bounds"}
    if math.isclose(lower, upper, rel_tol=1e-12, abs_tol=1e-12):
        return {**result, "reason": "degenerate_percentile_interval"}
    return {
        **result,
        "status": "estimated_for_registered_assumptions",
        "lower": float(lower),
        "upper": float(upper),
    }
