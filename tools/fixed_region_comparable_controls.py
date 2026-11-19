"""Match an explicitly registered fixed non-front area to each frozen B effect."""

import json
import re
import sys
from collections import Counter
from pathlib import Path

import audit_regional_support as p0
from fixed_region_window_effects import FOLLOW_UPS, event_effect, has_measures
from fixed_region_window_qualification import (
    REQUEST_KEYS,
    json_object,
    project_support,
    read_frozen_input,
    read_support,
    require,
    text_digest,
    window_days,
)
from monthly_distance_background import compare_day

METHOD = "fixed-event-comparable-controls/v1"
PARAMETER = "frozen-single-control/v1"
COVARIATES = ("distance_to_coast_km", "sst_c", "depth_m")
STATIC_COVARIATES = {"distance_to_coast_km", "depth_m"}


def registered_policy(policy):
    require(
        policy.keys()
        == {
            "required_window",
            "max_center_distance_km",
            "minimum_area_ratio",
            "control_clearance_km",
            "front_position_error_km",
            "covariate_limits",
        }
        and policy["required_window"] in FOLLOW_UPS,
        "control_policy_schema",
    )
    require(
        p0.finite(policy["max_center_distance_km"])
        and 0 < policy["max_center_distance_km"] <= 200
        and p0.finite(policy["minimum_area_ratio"])
        and 0 < policy["minimum_area_ratio"] <= 1
        and p0.finite(policy["control_clearance_km"])
        and 0 < policy["control_clearance_km"] <= 30
        and p0.finite(policy["front_position_error_km"])
        and 0 <= policy["front_position_error_km"] <= 5,
        "control_policy_geometry",
    )
    limits = policy["covariate_limits"]
    require(
        limits.keys() <= set(COVARIATES)
        and all(p0.finite(x) and x >= 0 for x in limits.values()),
        "control_policy_covariates",
    )
    return policy


def covariates(values):
    require(
        values.keys() <= STATIC_COVARIATES
        and all(
            isinstance(proof, dict)
            and proof.keys() == {"value", "evidence_id", "scope"}
            and proof["scope"] == "static_for_registered_circle"
            and isinstance(proof["evidence_id"], str)
            and re.fullmatch(r"sha256:[0-9a-f]{64}", proof["evidence_id"])
            and p0.finite(proof["value"])
            and proof["value"] >= 0
            for proof in values.values()
        ),
        "control_covariates_schema",
    )
    return values


def register_control(raw, target, anchors):
    require(
        raw.keys()
        == {
            "id",
            "longitude",
            "latitude",
            "radius_km",
            "search_start",
            "search_end",
            "covariates",
            "front_summary_json",
            "front_manifest_json",
            "support_snapshots",
        }
        and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,47}", raw["id"]),
        "control_region_schema",
    )
    require(
        raw["radius_km"] == target["radius_km"]
        and isinstance(raw["support_snapshots"], list)
        and len(raw["support_snapshots"]) <= len(anchors) * 2,
        "control_region_contract",
    )
    request = {
        key: raw[key]
        for key in ("longitude", "latitude", "radius_km", "search_start", "search_end")
    }
    request["purpose"] = target["purpose"]
    front = read_frozen_input(
        raw["front_summary_json"],
        raw["front_manifest_json"],
        request,
        "fixed-region-front-observation/v1",
    )
    require(front["source"]["license"] == "CC0-1.0", "invalid_control_front_license")
    snapshots = {}
    for document in raw["support_snapshots"]:
        key, entry = read_support(document, request, anchors, front["source"])
        require(key not in snapshots, "duplicate_control_event_support")
        snapshots[key] = entry
    _, _, metres = p0.GEOD.inv(
        target["longitude"], target["latitude"], raw["longitude"], raw["latitude"]
    )
    return {
        "id": raw["id"],
        "geometry": [raw["longitude"], raw["latitude"], raw["radius_km"]],
        "distance_km": metres / 1000,
        "covariates": covariates(raw["covariates"]),
        "front_result_id": front["result_id"],
        "front_read_range": front["read_range"],
        "front_position_error_km": front["geometry"]["front_position_error_km"],
        "observations": {
            day["date"]: {
                "phase": day["phase"],
                "lower_km": day["distance_km"]["lower"],
            }
            for day in front["selection"]["observations"]
        },
        "snapshots": snapshots,
    }


def covariate_checks(target, candidate, limits):
    output = {}
    for key in COVARIATES:
        target_proof, control_proof = target.get(key, {}), candidate.get(key, {})
        left, right = target_proof.get("value"), control_proof.get("value")
        difference = (
            abs(left - right) if left is not None and right is not None else None
        )
        maximum = limits.get(key)
        if maximum is None:
            status = "not_required"
        elif key == "sst_c":
            status = "unverified_temporal_support"
        elif difference is None:
            status = "unknown"
        else:
            status = "matched" if difference <= maximum else "outside_limit"
        output[key] = {
            "target": left,
            "control": right,
            "difference": difference,
            "limit": maximum,
            "status": status,
            "target_evidence_id": target_proof.get("evidence_id"),
            "control_evidence_id": control_proof.get("evidence_id"),
        }
    return output


def pair_rows(target, control, days, minimum):
    # Both inputs are full-day P0 included rows. Each already passed its own circle cutoff.
    active = {row["date"]: row for row in target["daily"]}
    reference = {row["date"]: row for row in control["daily"]}
    pairs = []
    for day in days:
        left, right = active[day], reference[day]
        # Legacy frozen B03 did not carry this number. Inclusion still attests the P0 tolerance bound.
        target_outside = left.get("outside_request_selected_area_km2", p0.AREA_TOL)
        control_outside = right.get("outside_request_selected_area_km2", p0.AREA_TOL)
        candidate = {
            "date": day,
            "bands": [left, right],
            "common": {
                "effective_area_km2": left["area_time_km2_days"],
                "outside_request_selected_area_km2": target_outside,
            },
            "_comparison_covariates": {
                "target": {"outside_requested_circle_area_km2": target_outside},
                "reference": {"outside_requested_circle_area_km2": control_outside},
            },
        }
        pair = compare_day(
            candidate,
            {"target_band": 0, "reference_band": 1, "minimum_area_ratio": minimum},
            left["area_time_km2_days"],
        )
        pairs.append(
            {
                "date": day,
                "area_ratio": pair["smaller_to_larger_area_ratio"],
                "reason": pair["reason"],
            }
        )
    return pairs


def clearance_proven(row, radius, threshold):
    lower = row.get("lower_km")
    return (
        row.get("phase") == "clear"
        and p0.finite(lower)
        and radius + lower >= radius + threshold
    )


def evaluate_candidate(candidate, target, dates, policy, target_covariates):
    anchor = target["anchor_date"]
    required = [*dates["pre7"], *dates["event_day"], *dates[policy["required_window"]]]
    observations = candidate["observations"]
    radius = candidate["geometry"][2]
    exposed, missing, weak_clearance = [], [], []
    for day in required:
        row = observations.get(day, {})
        phase = row.get("phase")
        if phase in {"near", "between_thresholds"}:
            exposed.append(day)
        elif phase != "clear":
            missing.append(day)
        elif not clearance_proven(row, radius, policy["control_clearance_km"]):
            weak_clearance.append(day)
    evidence = {
        key: candidate[key]
        for key in (
            "id",
            "geometry",
            "distance_km",
            "front_result_id",
            "front_read_range",
            "front_position_error_km",
        )
    }
    checks = covariate_checks(
        target_covariates, candidate["covariates"], policy["covariate_limits"]
    )
    evidence.update(
        covariates=checks,
        exposure_dates=exposed,
        missing_observation_dates=missing,
        unproven_clearance_dates=weak_clearance,
        pair_checks=[],
    )
    if (
        not 2 * candidate["geometry"][2]
        <= candidate["distance_km"]
        <= policy["max_center_distance_km"]
    ):
        return {**evidence, "reason": "outside_registered_control_domain"}, None
    if exposed or missing:
        reason = "front_exposure_not_clear" if exposed else "front_observation_unknown"
        return {**evidence, "reason": reason}, None
    if candidate["front_position_error_km"] != policy["front_position_error_km"]:
        return {**evidence, "reason": "front_position_error_mismatch"}, None
    if weak_clearance:
        return {**evidence, "reason": "front_clearance_not_proven"}, None
    if any(
        check["status"] not in {"matched", "not_required"} for check in checks.values()
    ):
        return {**evidence, "reason": "covariates_not_matched"}, None
    frozen = candidate["snapshots"].get((anchor, "front_effort"))
    if frozen is None:
        return {**evidence, "reason": "control_p0_snapshot_missing"}, None
    context = {
        day: {"front_exposure": observations.get(day, {}).get("phase", "unknown")}
        for day in sorted(set(dates["pre7"] + dates["event_day"] + dates["post7"]))
    }
    audited = project_support(frozen, dates, context)
    control = event_effect(
        {
            "anchor_date": anchor,
            "front_event": None,
            "support": {"front_effort": audited},
        }
    )
    evidence["support_snapshot_id"] = control["support_snapshot_id"]
    if control["provenance"] != target["provenance"]:
        return {**evidence, "reason": "control_provenance_mismatch"}, None
    if control["changes"][policy["required_window"]]["status"] != "comparable":
        return {**evidence, "reason": "control_event_windows_not_comparable"}, None
    paired = pair_rows(
        target,
        control,
        dates["pre7"] + dates[policy["required_window"]],
        policy["minimum_area_ratio"],
    )
    evidence["pair_checks"] = paired
    if any(row["reason"] for row in paired):
        return {**evidence, "reason": "same_day_support_imbalance"}, None
    return {**evidence, "reason": None}, control


def contrast(target, control, name):
    def comparison(part):
        left, right = target["windows"][part], control["windows"][part]
        a, b = (row["density_hours_per_km2_day"] for row in (left, right))
        return {
            "dates": left["dates"],
            "target_hours": left["total_hours"],
            "control_hours": right["total_hours"],
            "target_area_time": left["area_time_km2_days"],
            "control_area_time": right["area_time_km2_days"],
            "target_density": a,
            "control_density": b,
            "same_day_density_difference": a - b,
        }

    baseline, later = comparison("pre7"), comparison(name)
    return {
        "pre7": baseline,
        "post": later,
        "change_difference": later["same_day_density_difference"]
        - baseline["same_day_density_difference"],
    }


def match_event(target, controls, policy, target_covariates):
    candidates, eligible = [], []
    dates = window_days(p0.iso_day(target["anchor_date"]))
    if target["changes"][policy["required_window"]]["status"] != "comparable":
        candidates = [
            {"id": control["id"], "reason": "target_event_windows_not_comparable"}
            for control in controls
        ]
    else:
        for candidate in controls:
            evidence, result = evaluate_candidate(
                candidate, target, dates, policy, target_covariates
            )
            candidates.append(evidence)
            if result is not None:
                eligible.append((evidence, result, candidate))
    selected, contrasts, control_days, paired_dates, descriptive_dates = (
        None,
        dict.fromkeys(FOLLOW_UPS),
        {},
        set(),
        set(),
    )
    if eligible:
        evidence, control, candidate = min(
            eligible, key=lambda item: (item[0]["distance_km"], item[0]["id"])
        )
        selected = {**evidence, "weight": 1, "scope": "retrospective_full_window"}
        paired_dates = {pair["date"] for pair in evidence["pair_checks"]}
        if (
            policy["required_window"] == "post3"
            and target["changes"]["post7"]["status"] == "comparable"
        ):
            extended, qualified = evaluate_candidate(
                candidate,
                target,
                dates,
                {**policy, "required_window": "post7"},
                target_covariates,
            )
            selected["same_control_post7"] = extended
            if qualified is not None:
                control = qualified
                paired_dates = {row["date"] for row in extended["pair_checks"]}
        control_days = {row["date"]: row for row in control["daily"]}
        eligible_dates = [
            row["date"]
            for row in target["daily"]
            if has_measures(row)
            and has_measures(control_days.get(row["date"], {}))
            and clearance_proven(
                candidate["observations"].get(row["date"], {}),
                candidate["geometry"][2],
                policy["control_clearance_km"],
            )
        ]
        daily_checks = pair_rows(
            target, control, eligible_dates, policy["minimum_area_ratio"]
        )
        descriptive_dates = {
            row["date"] for row in daily_checks if row["reason"] is None
        }
        selected["descriptive_day_checks"] = daily_checks
        for part in FOLLOW_UPS:
            if (
                target["changes"][part]["status"] != "comparable"
                or control["changes"][part]["status"] != "comparable"
                or not set(dates[part]) <= paired_dates
            ):
                continue
            contrasts[part] = contrast(target, control, part)
    return {
        "anchor_date": target["anchor_date"],
        "target_front_event": target["front_event"],
        "target_support_snapshot_id": target["support_snapshot_id"],
        "target_provenance": target["provenance"],
        "daily": [
            {
                "date": row["date"],
                "target": row,
                "control": control_days.get(row["date"]),
                "matched_for_window": row["date"] in paired_dates,
                "matched_for_descriptive_day": row["date"] in descriptive_dates,
            }
            for row in target["daily"]
        ],
        "target_changes": target["changes"],
        "contrasts": contrasts,
        "matching": {
            "selected": selected,
            "candidates": candidates,
            "candidate_count": len(candidates),
            "eligible_count": len(eligible),
        },
    }


def evaluate(request, bundle, source_hash):
    require(
        request.keys() == REQUEST_KEYS
        and request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "control_request_identity",
    )
    require(
        bundle.keys()
        == {
            "schema",
            "target_summary_json",
            "target_manifest_json",
            "target_covariates",
            "policy",
            "controls",
        }
        and bundle["schema"] == "ocean-fixed-region-controls-input/v1"
        and isinstance(bundle["controls"], list)
        and len(bundle["controls"]) <= 8,
        "control_input_schema",
    )
    policy = registered_policy(bundle["policy"])
    target = read_frozen_input(
        bundle["target_summary_json"],
        bundle["target_manifest_json"],
        request,
        "fixed-region-window-effects/v1",
    )
    target_covariates = covariates(bundle["target_covariates"])
    anchors = {event["anchor_date"] for event in target["events"]}
    controls = [register_control(raw, request, anchors) for raw in bundle["controls"]]
    require(
        len({c["id"] for c in controls})
        == len({tuple(c["geometry"]) for c in controls})
        == len(controls),
        "duplicate_control_regions",
    )
    events = [
        match_event(event, controls, policy, target_covariates)
        for event in target["events"]
    ]
    reuse = Counter(
        event["matching"]["selected"]["id"]
        for event in events
        if event["matching"]["selected"] is not None
    )
    result = {
        "schema_version": "fixed-region-comparable-controls/v1",
        "kind": request["purpose"],
        "parameters": request,
        "source": {"id": "frozen-fixed-region-controls", "input_sha256": source_hash},
        "engine_versions": {
            name: p0.file_digest(Path(__file__).with_name(name))
            for name in (
                Path(__file__).name,
                "fixed_region_window_effects.py",
                "fixed_region_window_qualification.py",
                "monthly_distance_background.py",
                "audit_regional_support.py",
                "audit_support_qualification.py",
            )
        },
        "target_result_id": target["result_id"],
        "front_lineage": target.get("front_lineage"),
        "front_candidate_count": target.get("front_candidate_count"),
        "policy": policy,
        "events": events,
        "matched_events": sum(reuse.values()),
        "match_rate": sum(reuse.values()) / len(events) if events else None,
        "control_reuse": dict(sorted(reuse.items())),
        "candidate_count": len(controls),
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "limit": "retrospective matched same-day association; gear and other unrecorded differences remain unmeasured",
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
