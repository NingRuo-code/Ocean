"""Freeze and compare bounded variants of a registered synthetic month reference."""

import argparse
import copy
import json
import math
import re
from datetime import datetime, timedelta
from itertools import pairwise
from pathlib import Path

import audit_regional_support as p0
import numpy as np
from shapely.errors import GEOSException

VERSION = "ocean-month-sensitivity-plan/v1"
AXES = {
    "radius_km",
    "allocation",
    "distance_edges_km",
    "minimum_circle_coverage",
    "large_cell_hours_above",
}
DRAFT_FIELDS = {
    "version",
    "frozen_at",
    "prior_target_effect_seen",
    "rationale",
    "variants",
}
EXECUTION_FILES = (
    "audit_daily_sources.py",
    "audit_regional_support.py",
    "audit_support_qualification.py",
    "compute_monthly_distance.py",
    "monthly_block_uncertainty.py",
    "monthly_distance_background.py",
    "monthly_sensitivity_plan.py",
    "monthly_side_environment.py",
)


def identity(value):
    return "sha256:" + p0.digest(value)


def _require(condition, reason):
    if not condition:
        raise ValueError(reason)


def _note(value):
    return isinstance(value, str) and 1 <= len(value) <= 500 and bool(value.strip())


def _valid_value(axis, value):
    if axis == "radius_km":
        return type(value) is int and value in (10, 20, 30)
    if axis == "allocation":
        return value in ("overlap_uniform", "cell_center")
    if axis == "distance_edges_km":
        return (
            isinstance(value, list)
            and 1 <= len(value) <= 6
            and all(p0.finite(item) and 0 < item <= 100 for item in value)
            and sorted(set(value)) == value
        )
    if axis == "minimum_circle_coverage":
        return p0.finite(value) and 0 <= value <= 1
    return axis == "large_cell_hours_above" and p0.finite(value) and value > 0


def _validate_draft(draft):
    _require(
        isinstance(draft, dict) and set(draft) == DRAFT_FIELDS, "invalid_plan_fields"
    )
    _require(draft["version"] == VERSION, "invalid_plan_version")
    stamp = datetime.fromisoformat(draft["frozen_at"])
    _require(
        stamp.utcoffset() == timedelta(0) and stamp.isoformat() == draft["frozen_at"],
        "invalid_plan_time",
    )
    _require(
        type(draft["prior_target_effect_seen"]) is bool and _note(draft["rationale"]),
        "invalid_plan_rationale",
    )
    variants = draft["variants"]
    _require(
        isinstance(variants, list) and 1 <= len(variants) <= 6, "invalid_variant_budget"
    )
    ids, choices = set(), set()
    for row in variants:
        _require(
            isinstance(row, dict) and set(row) == {"id", "axis", "value", "rationale"},
            "invalid_variant_fields",
        )
        name, axis, value = row["id"], row["axis"], row["value"]
        _require(
            isinstance(name, str)
            and re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", name)
            and name not in ids
            and isinstance(axis, str)
            and axis in AXES
            and _valid_value(axis, value)
            and _note(row["rationale"]),
            "invalid_variant_condition",
        )
        choice = (axis, identity(value))
        _require(choice not in choices, "duplicate_variant_condition")
        ids.add(name)
        choices.add(choice)


def _base(data):
    return {key: value for key, value in data.items() if key != "sensitivity_plan"}


def _execution_protocol():
    return {
        "code": {
            name: "sha256:" + p0.file_digest(Path(__file__).with_name(name))
            for name in EXECUTION_FILES
        },
        "runtime": {
            "numpy": np.__version__,
            "shapely": p0.shapely.__version__,
            "pyproj": p0.pyproj.__version__,
            "geos": p0.shapely.geos_version_string,
            "proj": p0.pyproj.proj_version_str,
        },
    }


def freeze_plan(data, draft):
    _validate_draft(draft)
    _require(
        data["schema"] == "ocean-month-distance-input/v1"
        and data["regional_cells"]["evidence_kind"] == "synthetic"
        and data.get("distance_comparison") is not None
        and "sensitivity_plan" not in data,
        "freeze_requires_unplanned_synthetic_comparison",
    )
    envelope = {
        **draft,
        "primary_input_id": identity(data),
        "protocol": _execution_protocol(),
    }
    return {**data, "sensitivity_plan": {**envelope, "plan_id": identity(envelope)}}


def verify_plan(data):
    plan = data["sensitivity_plan"]
    _require(
        isinstance(plan, dict)
        and set(plan) == DRAFT_FIELDS | {"primary_input_id", "plan_id", "protocol"},
        "invalid_frozen_plan_fields",
    )
    _validate_draft({key: value for key, value in plan.items() if key in DRAFT_FIELDS})
    _require(
        plan["primary_input_id"] == identity(_base(data))
        and plan["plan_id"]
        == identity({key: value for key, value in plan.items() if key != "plan_id"}),
        "frozen_plan_identity_mismatch",
    )
    _require(plan["protocol"] == _execution_protocol(), "frozen_plan_protocol_changed")
    return plan


def require_budget(days, lines, variant_count, step_m):
    runs = 1 + variant_count
    cells = [
        cell for layers in days.values() for layer in layers for cell in layer["cells"]
    ]
    vertices = math.fsum(
        2 * (math.ceil((east - west) / 0.002) + math.ceil((north - south) / 0.002))
        for west, south, east, north in (cell["bounds"] for cell in cells)
    )
    layer_counts = {
        day: {layer["kind"]: len(layer["cells"]) for layer in layers}
        for day, layers in days.items()
    }
    distance_work = 0
    for day, paths in lines.items():
        activity = layer_counts.get(day.isoformat(), {}).get("activity", 0)
        if activity:
            samples = sum(
                1
                + sum(
                    max(1, math.ceil(p0.GEOD.inv(*left, *right)[2] / step_m))
                    for left, right in pairwise(path)
                )
                for path in paths
            )
            distance_work += activity * samples
    sst_work = sum(
        counts.get("activity", 0) * counts.get("sst", 0)
        for counts in layer_counts.values()
    )
    _require(
        len(cells) <= 120
        and vertices * runs <= 200_000
        and distance_work * runs <= 250_000
        and sst_work * runs <= 12_000,
        "sensitivity_plan_work_budget_exceeded",
    )


def variant_input(data, row):
    variant = copy.deepcopy(_base(data))
    axis, value = row["axis"], row["value"]
    removed = []
    if axis == "radius_km":
        variant["conditions"]["geometries"][0]["radius_km"] = value
    elif axis == "allocation":
        variant["conditions"]["allocation"] = value
    elif axis == "distance_edges_km":
        variant["distance_edges_km"] = value
    elif axis == "minimum_circle_coverage":
        variant["distance_comparison"][axis] = value
    else:
        for day in variant["regional_cells"]["days"]:
            for layer in day["layers"]:
                if layer["kind"] != "activity":
                    continue
                kept = []
                for cell in layer["cells"]:
                    if p0.finite(cell.get("hours")) and cell["hours"] > value:
                        removed.append(cell["hours"])
                    else:
                        kept.append(cell)
                layer["cells"] = kept
    return variant, len(removed), math.fsum(removed)


def _comparison_summary(result):
    comparison = result["month"]["distance_comparison"]
    interval = comparison.get("uncertainty")
    return {
        "result_id": result["result_id"],
        "conditions": {
            "radius_km": result["parameters"]["radius_km"],
            "allocation": result["p0_conditions"]["allocation"],
            "distance_edges_km": result["distance_edges_km"],
            "minimum_circle_coverage": comparison["policy"].get(
                "minimum_circle_coverage"
            ),
        },
        "paired_dates": comparison["paired_dates"],
        "excluded_reason_counts": comparison["excluded_reason_counts"],
        "target": comparison["target"],
        "reference": comparison["reference"],
        "status": comparison["status"],
        "effect_hours_per_km2_day": comparison["difference_hours_per_km2_day"],
        "uncertainty": (
            {
                "status": interval["status"],
                "reason": interval["reason"],
                "lower": interval["lower"],
                "upper": interval["upper"],
            }
            if interval
            else {"status": "not_requested"}
        ),
    }


def _selected_support(result):
    return [
        (
            day["date"],
            row["covariates"]["target"]["support_id"],
            row["covariates"]["reference"]["support_id"],
        )
        for day in result["days"]
        if (row := day["distance_comparison"])["included"]
    ]


def compare_variants(data, request, plan, primary, evaluate):
    primary_support = _selected_support(primary)
    rows = []
    for specification in plan["variants"]:
        row = dict(specification)
        try:
            packed, count, hours = variant_input(data, specification)
            packed_id = identity(packed)
            derived_request = {
                **request,
                "input_version": packed_id,
                "radius_km": packed["conditions"]["geometries"][0]["radius_km"],
            }
            row.update(
                input_id=packed_id, removed_input_cells=count, removed_input_hours=hours
            )
            result = evaluate(packed, derived_request, packed_id)
        except OverflowError:
            rows.append(
                {
                    **row,
                    "status": "variant_unavailable",
                    "reason": "variant_numeric_range_exceeded",
                }
            )
            continue
        except (
            ValueError,
            TypeError,
            KeyError,
            ArithmeticError,
            GEOSException,
        ) as error:
            reason = str(error)
            rows.append(
                {
                    **row,
                    "status": "variant_unavailable",
                    "reason": reason
                    if re.fullmatch(r"[a-z][a-z0-9_]{0,80}", reason)
                    else "variant_invalid",
                }
            )
            continue
        support = _selected_support(result)
        rows.append(
            {
                **row,
                **_comparison_summary(result),
                "support_comparison": (
                    "no_paired_support_for_comparison"
                    if not primary_support or not support
                    else "same_selected_support"
                    if primary_support == support
                    else "different_selected_support"
                ),
            }
        )
    return {
        "version": VERSION,
        "plan_id": plan["plan_id"],
        "primary_input_id": plan["primary_input_id"],
        "protocol": plan["protocol"],
        "frozen_at": plan["frozen_at"],
        "scope": "synthetic_exploratory",
        "prior_target_effect_seen": plan["prior_target_effect_seen"],
        "rationale": plan["rationale"],
        "primary": _comparison_summary(primary),
        "variants": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        frozen = freeze_plan(
            p0.controlled_json(args.input), p0.controlled_json(args.plan)
        )
        raw = json.dumps(
            frozen, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ).encode()
        _require(
            len(raw) <= p0.MAX_CONTROLLED_JSON_BYTES, "frozen_plan_budget_exceeded"
        )
        with args.out.open("xb") as file:
            file.write(raw)
    except (OSError, ValueError, TypeError, KeyError):
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
