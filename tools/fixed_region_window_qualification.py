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


def read_frozen_input(summary_text, manifest_text, request, schema):
    summary = json_object(summary_text)
    manifest = json_object(manifest_text)
    require(
        manifest["schema_version"] == "front-response-experiment-manifest/v2"
        and manifest["state"] == "completed"
        and manifest["artifacts"]["summary.json"] == text_digest(summary_text)
        and manifest["result_id"] == summary["result_id"]
        and manifest["parameters"] == summary["parameters"]
        and manifest["inputs"] == [summary["source"]]
        and manifest["purpose"] == summary["kind"] == request["purpose"]
        and manifest["evidence_kind"] == summary["evidence_kind"] == "synthetic_example"
        and manifest["research_ready"] is False
        and summary["research_ready"] is False
        and summary["schema_version"] == schema,
        "invalid_frozen_experiment_result",
    )
    conditions = (*GEOMETRY_KEYS, "search_start", "search_end")
    require(
        all(p0.finite(request[key]) for key in ("longitude", "latitude"))
        and type(request["radius_km"]) is int
        and all(request[key] == summary["parameters"][key] for key in conditions),
        "frozen_experiment_conditions_mismatch",
    )
    return summary


def read_support(text, request, anchors, front_source):
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
    front_id = front_source["front_source_id"]
    require(
        resolved.get("source_ids", {"front": "front-original"}).get("front")
        == front_id,
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
    proof = snapshot.get("qualification_evidence") or {}
    audit_version = proof.get("source_versions", {}).get(front_id)
    front_version = front_source.get("front_source_version")
    if not front_version or not audit_version:
        compatibility = "front_version_unverified"
    elif front_version != audit_version:
        compatibility = "front_version_mismatch"
    else:
        compatibility = "front_version_matched"
    return (event, use), (snapshot, matches[0], compatibility)


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


def window_results(dates, rows, region, hold):
    by_date = {row["date"]: row for row in rows}
    windows = {}
    for name, expected in dates.items():
        days = [by_date[date] for date in expected]
        missing = [row["date"] for row in days if not row["included"]]
        if name == "event_day":
            day = days[0]
            support = "supported" if day["included"] else day["state"]
            level = None
            intended_use = "event_day_diagnostic"
            reasons = day["reasons"]
            hours, area_time = day["hours"], day["area_time_km2_days"]
        else:
            window = region["windows"][name]
            require(
                window["dates"] == expected and window["excluded_days"] == len(missing),
                "event_window_mismatch",
            )
            support = window["computational_support"]
            level = window["support_level"]
            intended_use = (
                "local_description"
                if "local_description" in window["available_uses"]
                else None
            )
            reasons = window["missing_prerequisites"]
            hours, area_time = (
                window["summary"][key] for key in ("total_hours", "area_time_km2_days")
            )
        status = hold or level or "event_day_diagnostic"
        usable = not hold and intended_use is not None and not missing
        hours_available = usable and hours is not None
        area_time_available = usable and area_time is not None and area_time > 0
        windows[name] = {
            "status": status,
            "dates": expected,
            "excluded_dates": missing,
            "computational_support": support,
            "support_level": level,
            "reasons": reasons,
            "data_gate_passed": False,
            "hours_available": hours_available,
            "area_time_available": area_time_available,
            "eligible_for_synthetic_effect": level == "supported"
            and hours_available
            and area_time_available,
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
    snapshot, region, compatibility = audited
    rows = {row["date"]: row for row in region["days"]}
    require(context.keys() <= rows.keys(), "incomplete_p0_calendar")
    proof = snapshot.get("qualification_evidence") or {}
    license_state = (proof.get("license") or {}).get("state")
    allowed_license = license_state == "verified" and not any(
        "license_evidence_unverified" in window["missing_prerequisites"]
        for window in region["windows"].values()
    )
    if compatibility != "front_version_matched":
        hold = compatibility
    elif not allowed_license:
        hold = (
            "blocked_by_license" if license_state == "blocked" else "license_unverified"
        )
    else:
        hold = None
    daily = [
        {"date": day, **project_day(rows[day], hold is None), **facts}
        for day, facts in context.items()
    ]
    return {
        "status": "window_support_reported",
        "support_snapshot_id": snapshot["support_snapshot_id"],
        "conditions": snapshot["conditions"],
        "license_state": license_state,
        "front_version_status": compatibility,
        "source_provenance": {
            "source_versions": proof.get("source_versions", {}),
            "processing_version": proof.get("processing_version"),
            "scope": snapshot["evidence_scope"],
        },
        "p0_versions": {
            key: snapshot[key]
            for key in (
                "input_sha256",
                "regional_engine_sha256",
                "source_reader_sha256",
                "auditor_sha256",
            )
        },
        "windows": window_results(dates, daily, region, hold),
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
    front = read_frozen_input(
        bundle["front_summary_json"],
        bundle["front_manifest_json"],
        request,
        "fixed-region-front-observation/v1",
    )
    require(front["source"]["license"] == "CC0-1.0", "invalid_frozen_front_license")
    observed_events = front["selection"]["events"]
    candidates = [event for event in observed_events if event["accepted"]]
    anchors = {event["anchor_date"] for event in candidates}
    require(len(anchors) == len(candidates), "duplicate_front_anchor")
    observations = {
        row["date"]: row["phase"] for row in front["selection"]["observations"]
    }
    snapshots = {}
    for raw in bundle["support_snapshots"]:
        key, audited = read_support(raw, request, anchors, front["source"])
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
