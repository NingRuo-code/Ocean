"""Whole-event group uncertainty over frozen, matched fixed-region contrasts."""

import json
import math
import sys
from collections import Counter
from itertools import combinations
from pathlib import Path

import audit_regional_support as p0
import numpy as np
from fixed_region_window_qualification import (
    REQUEST_KEYS,
    json_object,
    read_frozen_input,
    require,
    text_digest,
    window_days,
)
from monthly_block_uncertainty import draw_component_totals, percentile_bounds

METHOD = "fixed-event-group-uncertainty/v1"
PARAMETER = "registered-group-percentile/v1"


def validate_policy(policy):
    require(
        policy.keys()
        == {
            "window",
            "estimand",
            "adjacency_days",
            "confidence_level",
            "iterations",
            "seed",
            "minimum_groups",
            "assumption",
            "rationale",
        },
        "event_group_policy_schema",
    )
    require(
        policy["window"] in {"post3", "post7"}
        and policy["estimand"] in {"equal_event", "pooled_area_time"}
        and type(policy["adjacency_days"]) is int
        and 0 <= policy["adjacency_days"] <= 31
        and p0.finite(policy["confidence_level"])
        and 0.5 < policy["confidence_level"] < 1
        and type(policy["iterations"]) is int
        and 200 <= policy["iterations"] <= 10_000
        and type(policy["seed"]) is int
        and 0 <= policy["seed"] < 2**32
        and type(policy["minimum_groups"]) is int
        and 2 <= policy["minimum_groups"] <= 31
        and policy["assumption"] in {"between_groups_registered", "unverified"}
        and isinstance(policy["rationale"], str)
        and 0 < len(policy["rationale"].strip()) <= 500,
        "event_group_policy_invalid",
    )
    return policy


def registered_runs(bundle, request):
    raw = bundle["control_runs"]
    require(isinstance(raw, list) and 1 <= len(raw) <= 3, "control_variant_budget")
    runs = {}
    for artifact in raw:
        require(
            artifact.keys() == {"summary_json", "manifest_json"},
            "frozen_control_artifact",
        )
        summary = json_object(artifact["summary_json"])
        radius = summary["parameters"]["radius_km"]
        require(
            type(radius) is int and radius in (10, 20, 30) and radius not in runs,
            "duplicate_control_variant",
        )
        case = {**request, "radius_km": radius}
        runs[radius] = read_frozen_input(
            artifact["summary_json"],
            artifact["manifest_json"],
            case,
            "fixed-region-comparable-controls/v1",
        )
    require(request["radius_km"] in runs, "primary_control_variant_unavailable")
    return runs


def variant_statuses(runs, primary_radius):
    primary = runs[primary_radius]
    expected = primary.get("front_lineage") or {}
    statuses = {primary_radius: "primary"}
    for radius, case in runs.items():
        if radius == primary_radius:
            continue
        current = case.get("front_lineage") or {}
        if not expected.get("source_version") or not current.get("source_version"):
            status = "front_lineage_unverified"
        elif expected != current:
            status = "front_lineage_mismatch"
        elif primary["policy"] != case["policy"]:
            status = "control_policy_mismatch"
        else:
            status = "linked_variant"
        statuses[radius] = status
    return statuses


def event_rows(runs, window, primary_radius):
    rows = []
    for radius, run in sorted(runs.items()):
        for event in run["events"]:
            anchor = p0.iso_day(event["anchor_date"])
            periods = window_days(anchor)
            control = event["matching"]["selected"]
            contrast = event["contrasts"][window]
            if contrast is not None:
                require(
                    contrast["pre7"]["dates"] == periods["pre7"]
                    and contrast["post"]["dates"] == periods[window]
                    and control is not None,
                    "aligned_frozen_contrast_required",
                )
            rows.append(
                {
                    "id": f"{anchor.isoformat()}/{radius}km",
                    "anchor": anchor,
                    "radius": radius,
                    "dates": set(
                        periods["pre7"] + periods["event_day"] + periods[window]
                    ),
                    "control": control,
                    "contrast": contrast,
                    "provenance": event.get("target_provenance"),
                    "eligible": radius == primary_radius and contrast is not None,
                }
            )
    require(
        len({row["id"] for row in rows}) == len(rows) <= 93,
        "event_row_budget_or_duplicates",
    )
    return rows


def dependence(left, right, adjacency):
    reasons = []
    shared = sorted(left["dates"] & right["dates"])
    if abs((left["anchor"] - right["anchor"]).days) <= adjacency:
        reasons.append("nearby_anchors")
    if shared:
        reasons.extend(["shared_window_dates", "overlapping_fixed_site_on_same_dates"])
        if left["radius"] != right["radius"]:
            reasons.append("nested_radii_on_shared_dates")
    if left["anchor"] == right["anchor"] and left["radius"] != right["radius"]:
        reasons.append("same_anchor_radius_variant")
    a, b = left["control"], right["control"]
    if a is not None and b is not None:
        first, second = a["geometry"], b["geometry"]
        distance_m = p0.GEOD.inv(*first[:2], *second[:2])[2]
        if distance_m <= 1e-6:
            reasons.append("reused_control_location")
        elif shared and distance_m <= (first[2] + second[2]) * 1000:
            reasons.append("overlapping_controls_on_shared_dates")
    return reasons, shared


def group_rows(rows, adjacency):
    parent = {row["id"]: row["id"] for row in rows}

    def root(key):
        while parent[key] != key:
            key = parent[key]
        return key

    links = []
    for left, right in combinations(rows, 2):
        reasons, dates = dependence(left, right, adjacency)
        if reasons:
            a, b = root(left["id"]), root(right["id"])
            parent[max(a, b)] = min(a, b)
            links.append(
                {
                    "first": left["id"],
                    "second": right["id"],
                    "reasons": reasons,
                    "shared_dates": dates,
                }
            )
    groups = {}
    for row in rows:
        groups.setdefault(root(row["id"]), []).append(row)
    return [groups[key] for key in sorted(groups)], links


def additive_components(row, weighting):
    value = row["contrast"]
    if weighting == "equal_event":
        return [value["change_difference"], 1]
    return [
        value[period][f"{side}_{quantity}"]
        for period in ("pre7", "post")
        for side in ("target", "control")
        for quantity in ("hours", "area_time")
    ]


def contrast_of_totals(totals, weighting):
    with np.errstate(over="ignore", invalid="ignore", divide="ignore"):
        if weighting == "equal_event":
            numerator, count = totals
            return numerator / count
        (
            before_target_h,
            before_target_e,
            before_control_h,
            before_control_e,
            post_target_h,
            post_target_e,
            post_control_h,
            post_control_e,
        ) = totals
        before = before_target_h / before_target_e - before_control_h / before_control_e
        after = post_target_h / post_target_e - post_control_h / post_control_e
        return after - before


def estimate(groups, policy):
    selected = [[row for row in group if row["eligible"]] for group in groups]
    usable = [group for group in selected if group]
    rows = [row for group in usable for row in group]
    weighting = policy["estimand"]
    result = {
        "status": "not_reliably_estimable",
        "estimate": None,
        "reason": None,
        "lower": None,
        "upper": None,
        "unit": "h/(km2*d)",
        "valid_iterations": 0,
        "requested_iterations": policy["iterations"],
        "failed_fraction": None,
        "rng": "NumPy PCG64",
        "numpy_version": np.__version__,
        "quantile_method": "linear",
        "numeric_tolerance": 1e-12,
        "permutation": "not_performed",
    }
    if not rows:
        return {**result, "reason": "no_paired_support"}, usable
    if any(row["provenance"] is None for row in rows):
        return {**result, "reason": "event_provenance_unverified"}, usable
    reference = rows[0]["provenance"]
    if any(row["provenance"] != reference for row in rows):
        return {**result, "reason": "incompatible_event_provenance"}, usable
    if weighting == "pooled_area_time":
        used = Counter(
            day
            for row in rows
            for phase in ("pre7", "post")
            for day in row["contrast"][phase]["dates"]
        )
        if any(n > 1 for n in used.values()):
            return {**result, "reason": "overlapping_dates_for_pooled_estimate"}, usable
    components = np.array(
        [
            [
                math.fsum(part)
                for part in zip(
                    *(additive_components(row, weighting) for row in group), strict=True
                )
            ]
            for group in usable
        ],
        dtype=np.float64,
    )
    central = contrast_of_totals(components.sum(axis=0), weighting)
    if not math.isfinite(central):
        return {**result, "reason": "invalid_or_zero_exposure"}, usable
    result["estimate"] = float(central)
    if policy["assumption"] != "between_groups_registered":
        return {**result, "reason": "between_group_assumptions_unverified"}, usable
    if len(usable) < policy["minimum_groups"]:
        return {**result, "reason": "insufficient_registered_groups"}, usable
    tail = (1 - policy["confidence_level"]) / 2
    if policy["iterations"] * tail < 1:
        return {**result, "reason": "percentile_tail_below_sampling_resolution"}, usable
    effects = contrast_of_totals(
        draw_component_totals(components, policy["iterations"], policy["seed"]),
        weighting,
    )
    valid = int(np.isfinite(effects).sum())
    result.update(
        valid_iterations=valid, failed_fraction=(len(effects) - valid) / len(effects)
    )
    if valid != len(effects):
        return {**result, "reason": "invalid_or_zero_exposure_resamples"}, usable
    reason, lower, upper = percentile_bounds(effects, tail)
    if reason:
        return {**result, "reason": reason}, usable
    return {
        **result,
        "status": "estimated_for_registered_assumptions",
        "lower": lower,
        "upper": upper,
    }, usable


def evaluate(request, bundle, source_hash):
    require(
        request.keys() == REQUEST_KEYS
        and request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "event_group_request_identity",
    )
    require(
        bundle.keys() == {"schema", "control_runs", "policy"}
        and bundle["schema"] == "ocean-fixed-region-event-inference-input/v1",
        "event_group_input_schema",
    )
    policy = validate_policy(bundle["policy"])
    runs = registered_runs(bundle, request)
    statuses = variant_statuses(runs, request["radius_km"])
    all_rows = event_rows(runs, policy["window"], request["radius_km"])
    rows = [
        row
        for row in all_rows
        if statuses[row["radius"]] in {"primary", "linked_variant"}
    ]
    groups, links = group_rows(rows, policy["adjacency_days"])
    inference, usable = estimate(groups, policy)
    eligible = [row for row in rows if row["eligible"]]
    result = {
        "schema_version": "fixed-region-event-group-uncertainty/v1",
        "kind": request["purpose"],
        "parameters": request,
        "source": {
            "id": "frozen-fixed-region-matched-effects",
            "input_sha256": source_hash,
        },
        "versions": {
            name: p0.file_digest(Path(__file__).with_name(name))
            for name in (
                Path(__file__).name,
                "monthly_block_uncertainty.py",
                "fixed_region_window_qualification.py",
            )
        },
        "control_result_ids": {
            str(radius): run["result_id"] for radius, run in sorted(runs.items())
        },
        "radius_compatibility": {
            str(radius): status for radius, status in sorted(statuses.items())
        },
        "policy": policy,
        "counts": {
            "front_candidate_events": runs[request["radius_km"]].get(
                "front_candidate_count"
            ),
            "candidate_events": len(runs[request["radius_km"]]["events"]),
            "eligible_events": len(eligible),
            "event_radius_rows": len(all_rows),
            "grouped_radius_rows": len(rows),
            "groups": len(groups),
            "usable_groups": len(usable),
            "eligible_dates": len(
                {
                    day
                    for row in eligible
                    for part in ("pre7", "post")
                    for day in row["contrast"][part]["dates"]
                }
            ),
        },
        "groups": [
            {
                "id": index + 1,
                "members": [row["id"] for row in group],
                "eligible_members": [row["id"] for row in group if row["eligible"]],
            }
            for index, group in enumerate(groups)
        ],
        "dependence_links": links,
        "individual_effects": [
            {
                "event": row["id"],
                "estimate": row["contrast"]["change_difference"],
                "provenance_available": row["provenance"] is not None,
            }
            for row in eligible
        ],
        "inference": inference,
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "limitations": [
            "group links are conservative under this fixed-site scope, and do not establish independence",
            "calculations use the primary radius; other radii contribute dependence only",
            "group-level permutation requires separate evidence of exchangeability",
        ],
    }
    result["result_id"] = "sha256:" + p0.digest(result)
    return result


def main():
    try:
        raw = sys.stdin.buffer.read(4_194_305)
        require(len(raw) <= 4_194_304, "controlled_input_budget")
        envelope = json_object(raw)
        require(
            envelope.keys() == {"request_json", "input_json"}, "controlled_envelope"
        )
        request, source = (
            json_object(envelope[key]) for key in ("request_json", "input_json")
        )
        result = evaluate(request, source, text_digest(envelope["input_json"]))
        print(json.dumps({"state": "completed", "result": result}, allow_nan=False))
    except (
        OSError,
        ValueError,
        ArithmeticError,
        TypeError,
        KeyError,
        AttributeError,
        IndexError,
        RecursionError,
    ):
        print(
            json.dumps(
                {"state": "failed", "error": {"code": "controlled_event_failed"}}
            )
        )
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
