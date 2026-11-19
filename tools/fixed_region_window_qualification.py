"""Join frozen fixed-region observations to existing P0 event support snapshots."""

import hashlib
import json
import sys
from datetime import timedelta
from pathlib import Path

import audit_regional_support as p0
from audit_support_qualification import SCHEMA as SUPPORT_SCHEMA
from audit_support_qualification import validate_conditions

METHOD = "fixed-event-window-qualification/v1"
PARAMETER = "p0-event-calendar/v1"
LAYERS = ("front_effort", "front_effort_sst")
WINDOWS = {
    "pre7": range(-7, 0),
    "event_day": range(1),
    "post3": range(1, 4),
    "post7": range(1, 8),
}
GEOMETRY_KEYS = ("longitude", "latitude", "radius_km")
REQUEST_KEYS = {
    "purpose",
    *GEOMETRY_KEYS,
    "search_start",
    "search_end",
    "input_version",
    "method_version",
    "parameter_version",
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def json_object(text):
    value = json.loads(text, object_pairs_hook=p0.unique_json_object)
    require(isinstance(value, dict), "expected_object")
    return value


def text_digest(text):
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def read_front(bundle, request):
    summary = json_object(bundle["front_summary_json"])
    manifest = json_object(bundle["front_manifest_json"])
    require(
        manifest["schema_version"] == "front-response-experiment-manifest/v2"
        and manifest["state"] == "completed"
        and manifest["artifacts"]["summary.json"]
        == text_digest(bundle["front_summary_json"])
        and manifest["result_id"] == summary["result_id"]
        and manifest["parameters"] == summary["parameters"]
        and manifest["inputs"] == [summary["source"]]
        and manifest["purpose"] == summary["kind"] == request["purpose"]
        and manifest["evidence_kind"] == summary["evidence_kind"] == "synthetic_example"
        and manifest["research_ready"] is False
        and summary["research_ready"] is False
        and summary["schema_version"] == "fixed-region-front-observation/v1"
        and summary["source"]["license"] == "CC0-1.0",
        "invalid_frozen_front_result",
    )
    conditions = (*GEOMETRY_KEYS, "search_start", "search_end")
    require(
        all(request[key] == summary["parameters"][key] for key in conditions),
        "front_conditions_mismatch",
    )
    return summary


def read_support(text, request, anchors, front_source_id):
    snapshot = json_object(text)
    payload = {
        key: value for key, value in snapshot.items() if key != "support_snapshot_id"
    }
    require(
        snapshot["schema"] == SUPPORT_SCHEMA
        and snapshot["evidence_kind"] == "synthetic"
        and snapshot["research_ready"] is False
        and snapshot["support_snapshot_id"] == "sha256:" + p0.digest(payload),
        "invalid_frozen_support_identity",
    )
    conditions = snapshot["conditions"]
    resolved = validate_conditions(conditions)
    use = conditions["layer_use"]
    event = conditions.get("event_date")
    require(
        conditions["purpose"] == "B_event"
        and event in anchors
        and use in LAYERS
        and resolved == snapshot["resolved_conditions"],
        "event_support_conditions_mismatch",
    )
    require(
        resolved.get("source_ids", {"front": "front-original"}).get("front")
        == front_source_id,
        "event_front_source_mismatch",
    )
    matches = [
        region
        for region in snapshot["regions"]
        if region["geometry"]["type"] == "circle"
        and region["geometry"]["center"] == [request["longitude"], request["latitude"]]
        and region["geometry"]["radius_km"] == request["radius_km"]
    ]
    require(len(matches) == 1, "event_support_geometry_mismatch")
    return (event, use), (snapshot, matches[0])


def window_days(anchor):
    return {
        name: [(anchor + timedelta(days=offset)).isoformat() for offset in offsets]
        for name, offsets in WINDOWS.items()
    }


def daily_context(when, candidate, other_events, observations):
    phase = observations.get(when, "unknown")

    def in_recorded_span(event):
        if when < event["first_near_date"] or (
            event["exit_observed_date"] is not None
            and when >= event["exit_observed_date"]
        ):
            return False
        return None if phase == "unknown" else True

    return {
        "front_exposure": phase,
        "within_candidate_span": in_recorded_span(candidate),
        "other_anchors": [
            event["anchor_date"]
            for event in other_events
            if event["anchor_date"] and in_recorded_span(event) is True
        ],
        "unresolved_overlap_starts": [
            event["first_near_date"]
            for event in other_events
            if in_recorded_span(event) is None
            or (in_recorded_span(event) is True and event["anchor_date"] is None)
        ],
    }


def project_day(row, disclose):
    return {
        "state": row["state"],
        "included": row["included"],
        "source_states": row["source_states"],
        "reasons": row["exclusion_reasons"],
        **{
            key: row[key] if disclose else None
            for key in ("hours", "area_time_km2_days", "common_support_id")
        },
    }


def window_results(dates, rows, region, allowed, license_state):
    by_date = {row["date"]: row for row in rows}
    windows = {}
    for name, expected in dates.items():
        days = [by_date[date] for date in expected]
        missing = [row["date"] for row in days if not row["included"]]
        if name == "event_day":
            day = days[0]
            support = "supported" if day["included"] else day["state"]
            reasons = day["reasons"]
            hours, area_time = day["hours"], day["area_time_km2_days"]
        else:
            window = region["windows"][name]
            require(
                window["dates"] == expected and window["excluded_days"] == len(missing),
                "event_window_mismatch",
            )
            support = window["computational_support"]
            reasons = window["missing_prerequisites"]
            hours, area_time = (
                window["summary"][key] for key in ("total_hours", "area_time_km2_days")
            )
        status = (
            support
            if allowed
            else (
                "blocked_by_license"
                if license_state == "blocked"
                else "license_unverified"
            )
        )
        windows[name] = {
            "status": status,
            "dates": expected,
            "excluded_dates": missing,
            "computational_support": support,
            "reasons": reasons,
            "data_gate_passed": False,
            "hours_available": allowed and not missing and hours is not None,
            "area_time_available": allowed
            and not missing
            and area_time is not None
            and area_time > 0,
        }
    return windows


def project_support(audited, dates, context):
    if audited is None:
        return {
            "status": "snapshot_not_registered",
            "support_snapshot_id": None,
            "windows": {
                name: {
                    "dates": rows,
                    "status": "snapshot_not_registered",
                    "data_gate_passed": False,
                }
                for name, rows in dates.items()
            },
            "daily": [
                {"date": day, "state": "not_prepared", **facts}
                for day, facts in context.items()
            ],
        }
    snapshot, region = audited
    rows = {row["date"]: row for row in region["days"]}
    require(context.keys() <= rows.keys(), "incomplete_p0_calendar")
    license_state = (
        (snapshot.get("qualification_evidence") or {}).get("license", {}).get("state")
    )
    allowed = license_state == "verified" and not any(
        "license_evidence_unverified" in window["missing_prerequisites"]
        for window in region["windows"].values()
    )
    daily = [
        {"date": day, **project_day(rows[day], allowed), **facts}
        for day, facts in context.items()
    ]
    return {
        "status": "window_support_reported",
        "support_snapshot_id": snapshot["support_snapshot_id"],
        "conditions": snapshot["conditions"],
        "license_state": license_state,
        "p0_versions": {
            key: snapshot[key]
            for key in (
                "input_sha256",
                "regional_engine_sha256",
                "source_reader_sha256",
                "auditor_sha256",
            )
        },
        "windows": window_results(dates, daily, region, allowed, license_state),
        "daily": daily,
    }


def evaluate(request, bundle, source_hash):
    require(
        request.keys() == REQUEST_KEYS
        and request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "window_request_identity",
    )
    require(
        bundle.keys()
        == {"schema", "front_summary_json", "front_manifest_json", "support_snapshots"}
        and bundle["schema"] == "ocean-fixed-region-window-evidence/v1"
        and isinstance(bundle["support_snapshots"], list)
        and len(bundle["support_snapshots"]) <= 32,
        "window_input_schema",
    )
    front = read_front(bundle, request)
    observed_events = front["selection"]["events"]
    candidates = [event for event in observed_events if event["accepted"]]
    anchors = {event["anchor_date"] for event in candidates}
    require(len(anchors) == len(candidates), "duplicate_front_anchor")
    observations = {
        row["date"]: row["phase"] for row in front["selection"]["observations"]
    }
    snapshots = {}
    for raw in bundle["support_snapshots"]:
        key, audited = read_support(
            raw, request, anchors, front["source"]["front_source_id"]
        )
        require(key not in snapshots, "duplicate_event_support")
        snapshots[key] = audited
    events = []
    for candidate in candidates:
        anchor = candidate["anchor_date"]
        dates = window_days(p0.iso_day(anchor))
        other_events = [event for event in observed_events if event is not candidate]
        context = {
            when: daily_context(when, candidate, other_events, observations)
            for when in sorted({when for days in dates.values() for when in days})
        }
        events.append(
            {
                "anchor_date": anchor,
                "front_event": candidate,
                "support": {
                    use: project_support(snapshots.get((anchor, use)), dates, context)
                    for use in LAYERS
                },
            }
        )
    result = {
        "schema_version": "fixed-region-window-qualification/v1",
        "kind": request["purpose"],
        "parameters": request,
        "source": {"id": "frozen-front-and-p0-snapshots", "input_sha256": source_hash},
        "engine_sha256": p0.file_digest(Path(__file__)),
        "front_result_id": front["result_id"],
        "front_read_range": front["read_range"],
        "status": front["status"],
        "research_ready": False,
        "evidence_kind": "synthetic_example",
        "events": events,
        "event_day_rule": "exclude_event_day/v1",
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
