"""Relative-day reading of frozen target/control rows and their registered cohorts."""

import json
import math
import sys
from datetime import timedelta
from pathlib import Path

import audit_regional_support as p0
from fixed_region_event_inference import event_rows, group_rows
from fixed_region_window_qualification import (
    REQUEST_KEYS,
    json_object,
    read_frozen_input,
    require,
    text_digest,
)

METHOD = "fixed-event-lag-cohort/v1"
PARAMETER = "paired-relative-day/v1"
OFFSETS = range(-7, 8)


def measured(row):
    row = row or {}
    return {
        "hours": row.get("hours"),
        "area_time": row.get("area_time_km2_days"),
        "support_id": row.get("common_support_id"),
        "included": row.get("included", False),
        "front_exposure": row.get("front_exposure", "unknown"),
        "within_candidate_span": row.get("within_candidate_span"),
        "other_anchors": row.get("other_anchors", []),
        "unresolved_overlap_starts": row.get("unresolved_overlap_starts", []),
        "reasons": row.get("reasons", []),
    }


def has_pair_value(row):
    return all(
        side["included"]
        and p0.finite(side["hours"])
        and side["hours"] >= 0
        and p0.finite(side["area_time"])
        and side["area_time"] > 0
        and side["support_id"]
        for side in (row["target"], row["control"])
    )


def project_event(event, group_id):
    anchor = p0.iso_day(event["anchor_date"])
    original = event.get("daily", [])
    by_date = {row["date"]: row for row in original}
    require(len(by_date) == len(original), "duplicate_frozen_daily_date")
    rows = []
    for offset in OFFSETS:
        current = (anchor + timedelta(days=offset)).isoformat()
        day = by_date.get(current, {})
        row = {
            "offset": offset,
            "date": current,
            "target": measured(day.get("target")),
            "control": measured(day.get("control")),
            "registered_pair": day.get("matched_for_window", False),
        }
        row["pair_available"] = has_pair_value(row) and (
            row["registered_pair"] or offset == 0
        )
        rows.append(row)
    return {
        "anchor_date": event["anchor_date"],
        "group_id": group_id,
        "control_id": (event["matching"]["selected"] or {}).get("id"),
        "front_event": event.get("target_front_event"),
        "provenance": event.get("target_provenance"),
        "target_changes": event["target_changes"],
        "contrasts": event["contrasts"],
        "daily": rows,
    }


def phase_cohort(events, window):
    matched = [event for event in events if event["contrasts"][window] is not None]
    frozen = [
        event
        for event in matched
        if all(
            row["pair_available"]
            for row in event["daily"]
            if -7 <= row["offset"] <= (3 if window == "post3" else 7)
            and row["offset"] != 0
        )
    ]
    return matched, frozen


def combine_daily(events, offset):
    members = [
        (event, event["daily"][offset + 7])
        for event in events
        if event["daily"][offset + 7]["pair_available"]
    ]
    result = {
        "offset": offset,
        "members": [event["anchor_date"] for event, _ in members],
        "group_ids": sorted({event["group_id"] for event, _ in members}),
        "event_count": len(members),
        "target": {"hours": None, "area_time": None, "density": None},
        "control": {"hours": None, "area_time": None, "density": None},
        "density_difference": None,
        "status": "anchor_day_diagnostic"
        if offset == 0
        else "missing_same_day_support",
    }
    if not members:
        return result
    provenance = members[0][0]["provenance"]
    if provenance is None or any(
        event["provenance"] != provenance for event, _ in members
    ):
        return {**result, "status": "mixed_or_unverified_provenance"}
    for side in ("target", "control"):
        hours = math.fsum(row[side]["hours"] for _, row in members)
        area = math.fsum(row[side]["area_time"] for _, row in members)
        result[side] = {"hours": hours, "area_time": area, "density": hours / area}
    if offset != 0:
        result.update(
            status="descriptive_pair",
            density_difference=result["target"]["density"]
            - result["control"]["density"],
        )
    return result


def cohort_summary(members, actual_rows, windows):
    result = {
        "member_anchors": [event["anchor_date"] for event in members],
        "event_count": len(members),
        "complete_daily_anchors": [event["anchor_date"] for event in actual_rows],
        "equal_event_window_effects": dict.fromkeys(windows),
        "effect_status": "no_complete_daily_cohort",
    }
    if not actual_rows:
        return result
    provenance = actual_rows[0]["provenance"]
    if provenance is None or any(
        event["provenance"] != provenance for event in actual_rows
    ):
        return {**result, "effect_status": "mixed_or_unverified_provenance"}
    result["equal_event_window_effects"] = {
        window: math.fsum(
            event["contrasts"][window]["change_difference"] for event in actual_rows
        )
        / len(actual_rows)
        for window in windows
    }
    result["effect_status"] = "descriptive_pair"
    return result


def evaluate(request, bundle, source_hash):
    require(
        request.keys() == REQUEST_KEYS
        and request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "lag_request_identity",
    )
    require(
        bundle.keys()
        == {"schema", "control_summary_json", "control_manifest_json", "policy"}
        and bundle["schema"] == "ocean-fixed-region-event-lag-input/v1",
        "lag_input_schema",
    )
    policy = bundle["policy"]
    require(
        policy.keys() == {"cohort_mode", "group_adjacency_days"}
        and policy["cohort_mode"] == "common_long_window_support/v1"
        and type(policy["group_adjacency_days"]) is int
        and 0 <= policy["group_adjacency_days"] <= 31,
        "lag_cohort_policy",
    )
    controls = read_frozen_input(
        bundle["control_summary_json"],
        bundle["control_manifest_json"],
        request,
        "fixed-region-comparable-controls/v1",
    )
    radius = request["radius_km"]
    candidates = event_rows({radius: controls}, "post7", radius)
    groups, links = group_rows(candidates, policy["group_adjacency_days"])
    memberships = {
        row["anchor"].isoformat(): index + 1
        for index, rows in enumerate(groups)
        for row in rows
    }
    events = [
        project_event(event, memberships[event["anchor_date"]])
        for event in controls["events"]
    ]
    short, short_daily = phase_cohort(events, "post3")
    long, long_daily = phase_cohort(events, "post7")
    short_dates = {event["anchor_date"] for event in short_daily}
    common = [event for event in long_daily if event["anchor_date"] in short_dates]
    result = {
        "schema_version": "fixed-region-event-lag/v1",
        "kind": request["purpose"],
        "parameters": request,
        "source": {
            "id": "frozen-matched-fixed-region-daily-evidence",
            "input_sha256": source_hash,
        },
        "control_result_id": controls["result_id"],
        "policy": policy,
        "versions": {
            name: p0.file_digest(Path(__file__).with_name(name))
            for name in (
                Path(__file__).name,
                "fixed_region_event_inference.py",
                "fixed_region_window_qualification.py",
            )
        },
        "events": events,
        "dependence_links": links,
        "cohorts": {
            "post3": cohort_summary(short, short_daily, ("post3",)),
            "post7": cohort_summary(long, long_daily, ("post7",)),
            "common": cohort_summary(common, common, ("post3", "post7")),
        },
        "profiles": {
            "available": [combine_daily(events, offset) for offset in OFFSETS],
            "common": [combine_daily(common, offset) for offset in OFFSETS],
        },
        "units": {
            "hours": "h",
            "area_time": "km2*d",
            "density_difference": "h/(km2*d)",
        },
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "limitations": [
            "offsets are days since observed anchor, including potential continuing exposure",
            "available-case membership can change by offset",
            "event day is diagnostic only",
            "these are descriptive pooled daily rates without per-day inference",
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
