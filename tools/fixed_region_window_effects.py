"""Descriptive effects on exact common support in frozen B event windows."""

import json
import math
import sys
from collections import Counter
from pathlib import Path

import audit_regional_support as p0
from fixed_region_window_qualification import (
    REQUEST_KEYS,
    json_object,
    read_frozen_input,
    require,
    text_digest,
    window_days,
)

METHOD = "fixed-event-window-effects/v1"
PARAMETER = "exact-common-support/v1"
FOLLOW_UPS = ("post3", "post7")


def metrics(rows):
    if not rows:
        return {
            "total_hours": None,
            "area_time_km2_days": None,
            "mean_hours_per_supported_day": None,
            "density_hours_per_km2_day": None,
        }
    hours = math.fsum(row["hours"] for row in rows)
    area_time = math.fsum(row["area_time_km2_days"] for row in rows)
    return {
        "total_hours": hours,
        "area_time_km2_days": area_time,
        "mean_hours_per_supported_day": hours / len(rows),
        "density_hours_per_km2_day": hours / area_time,
    }


def has_measures(row):
    hours, area_time = row.get("hours"), row.get("area_time_km2_days")
    return (
        row.get("included") is True
        and p0.finite(hours)
        and hours >= 0
        and p0.finite(area_time)
        and area_time > 0
    )


def summarize_window(anchor, dates, window, days):
    require(window["dates"] == dates, "frozen_window_dates_mismatch")
    rows = [days[day] for day in dates]
    selected = [row for row in rows if has_measures(row)]
    complete = len(selected) == len(rows)
    identities = {row.get("common_support_id") for row in selected}
    support = next(iter(identities)) if len(identities) == 1 else None
    if not selected or None in identities:
        support_status = "unknown"
    else:
        support_status = "exact" if support else "varies_within_window"
    return {
        "anchor_date": anchor,
        "dates": dates,
        "requested_days": len(rows),
        "supported_days": len(selected),
        "excluded_dates": [row["date"] for row in rows if not has_measures(row)],
        "p0_status": window["status"],
        "comparison_eligible": window.get("eligible_for_synthetic_effect") is True,
        "common_support_status": support_status,
        "common_support_id": support,
        **metrics(selected if complete else []),
        "known_subset": metrics(selected),
    }


def change(before, after):
    values = {
        "absolute_density_change": None,
        "relative_change_percent": None,
        "relative_reason": None,
    }
    if (
        before["supported_days"] < before["requested_days"]
        or after["supported_days"] < after["requested_days"]
    ):
        return {**values, "status": "incomplete_window"}
    if not before["comparison_eligible"] or not after["comparison_eligible"]:
        return {**values, "status": "qualification_not_supported"}
    if (
        before["common_support_status"] == "unknown"
        or after["common_support_status"] == "unknown"
    ):
        return {**values, "status": "common_support_unknown"}
    if (
        not before["common_support_id"]
        or before["common_support_id"] != after["common_support_id"]
    ):
        return {**values, "status": "common_support_changed"}
    left, right = (window["density_hours_per_km2_day"] for window in (before, after))
    difference = right - left
    values.update(status="comparable", absolute_density_change=difference)
    if left == 0:
        values["relative_reason"] = "zero_baseline"
    else:
        percentage = difference / left * 100
        if math.isfinite(percentage):
            values["relative_change_percent"] = percentage
        else:
            values["relative_reason"] = "relative_change_outside_numeric_range"
    return values


def event_effect(event):
    anchor = event["anchor_date"]
    audited = event["support"]["front_effort"]
    dates = window_days(p0.iso_day(anchor))
    daily = {row["date"]: row for row in audited["daily"]}
    require(
        len(daily) == len(audited["daily"])
        and set(daily) == set(dates["pre7"] + dates["event_day"] + dates["post7"]),
        "frozen_daily_calendar_mismatch",
    )
    windows = {
        name: summarize_window(anchor, phase, audited["windows"][name], daily)
        for name, phase in dates.items()
    }
    return {
        "anchor_date": anchor,
        "front_event": event["front_event"],
        "support_snapshot_id": audited["support_snapshot_id"],
        "daily": audited["daily"],
        "windows": windows,
        "changes": {
            name: change(windows["pre7"], windows[name]) for name in FOLLOW_UPS
        },
    }


def aggregate(events, phase):
    eligible = [
        event for event in events if event["changes"][phase]["status"] == "comparable"
    ]
    date_counts = Counter(
        day
        for event in eligible
        for name in ("pre7", phase)
        for day in event["windows"][name]["dates"]
    )
    shared = sorted(day for day, count in date_counts.items() if count > 1)
    effect = {
        "event_count": len(eligible),
        "eligible_anchors": [event["anchor_date"] for event in eligible],
        "overlapping_dates": shared,
        "equal_event_difference": None,
        "pooled_density_difference": None,
        "pooled_status": "no_comparable_events",
    }
    if not eligible:
        return effect
    effect["equal_event_difference"] = math.fsum(
        event["changes"][phase]["absolute_density_change"] for event in eligible
    ) / len(eligible)
    if shared:
        effect["pooled_status"] = "overlapping_dates"
        return effect
    rates = {}
    for name in ("pre7", phase):
        hours = math.fsum(event["windows"][name]["total_hours"] for event in eligible)
        area_time = math.fsum(
            event["windows"][name]["area_time_km2_days"] for event in eligible
        )
        rates[name] = {
            "hours": hours,
            "area_time_km2_days": area_time,
            "density_hours_per_km2_day": hours / area_time,
        }
    effect.update(
        pooled_status="available",
        pooled_windows=rates,
        pooled_density_difference=rates[phase]["density_hours_per_km2_day"]
        - rates["pre7"]["density_hours_per_km2_day"],
    )
    return effect


def evaluate(request, bundle, source_hash):
    require(
        request.keys() == REQUEST_KEYS
        and request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "window_effect_request_identity",
    )
    require(
        bundle.keys() == {"schema", "window_summary_json", "window_manifest_json"}
        and bundle["schema"] == "ocean-fixed-region-window-effects-input/v1",
        "window_effect_input_schema",
    )
    qualified = read_frozen_input(
        bundle["window_summary_json"],
        bundle["window_manifest_json"],
        request,
        "fixed-region-window-qualification/v1",
    )
    events = [event_effect(event) for event in qualified["events"]]
    anchors = {event["anchor_date"] for event in events}
    require(len(anchors) == len(events), "duplicate_event_anchor")
    result = {
        "schema_version": "fixed-region-window-effects/v1",
        "kind": request["purpose"],
        "parameters": request,
        "source": {"id": "frozen-b03-event-windows", "input_sha256": source_hash},
        "engine_sha256": p0.file_digest(Path(__file__)),
        "window_result_id": qualified["result_id"],
        "front_result_id": qualified["front_result_id"],
        "front_read_range": qualified["front_read_range"],
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "events": events,
        "pooled": {name: aggregate(events, name) for name in FOLLOW_UPS},
        "units": {
            "hours": "h",
            "area_time": "km2*d",
            "density": "h/(km2*d)",
            "relative_change": "%",
        },
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
