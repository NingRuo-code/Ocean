"""Read bounded frozen P0 outputs; never import an auditor or reopen original sources."""

import hashlib
import json
import math
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from .analysis_support import content_id, decode_controlled_json, read_regular_bytes

LEVELS = {"supported", "limited", "unsupported", "unverified"}
KINDS = {"front", "activity", "sst"}
STATES = {"parsed", "unverified", "missing", "conflict", "unprepared", "declared_cells"}
METRICS = [
    "total_hours",
    "mean_hours_per_supported_day",
    "mean_hours_per_requested_day",
    "area_time_km2_days",
    "density_hours_per_km2_day",
]
PROTOCOL_HASHES = ("auditor_sha256", "regional_engine_sha256", "source_reader_sha256")
OBSERVED_ROLES = {"request", "prepared_source", "auditor", "regional_engine", "source_reader"}


def require(value):
    if not value:
        raise ValueError("Invalid support snapshot")


def reason_list(values):
    require(isinstance(values, list) and len(values) <= 64)
    require(all(isinstance(v, str) and re.fullmatch(r"[a-z][a-z0-9_]{0,127}", v) for v in values))
    return list(values)


def number(value):
    require(
        value is None
        or (
            not isinstance(value, bool)
            and isinstance(value, (int, float))
            and math.isfinite(value)
            and value >= 0
        )
    )
    return value


def fingerprint(value):
    require(evidence_id(value) is not None)
    return value


def evidence_id(value):
    return value if isinstance(value, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", value) else None


def evidence_projection(snapshot, geometry, required):
    claims = snapshot["qualification_evidence"]
    if claims is None:
        claims = {}
    else:
        require(claims.get("schema") == "ocean-support-evidence/v1")
    declared = claims.get("source_versions", {})
    source_ids = snapshot["resolved_conditions"].get(
        "source_ids",
        {"front": "front-original", "activity": "effort-original", "sst": "sst-original"},
    )
    versions = {kind: evidence_id(declared.get(source_ids.get(kind))) for kind in required}
    references = {}
    for key, proof in {
        "license": claims.get("license"),
        "quality_rule": claims.get("quality_rule"),
        "granularity": claims.get("geometry", {}).get(geometry["id"]),
    }.items():
        if proof is None:
            references[key] = None
            continue
        require(proof["state"] in {"verified", "unverified", "blocked"})
        references[key] = {
            "state": proof["state"],
            "evidence_id": evidence_id(proof.get("evidence_id")),
        }
    return references, versions, evidence_id(claims.get("processing_version"))


def period_projection(period, disclose):
    require(period["support_level"] in LEVELS and period["computational_support"] in LEVELS)
    expected, included, excluded = (
        period[k] for k in ["expected_days", "included_days", "excluded_days"]
    )
    require(
        all(type(v) is int for v in [expected, included, excluded])
        and 1 <= expected <= 367
        and 0 <= included <= expected
        and excluded == expected - included
    )
    layers = period["layer_material_states"]
    require(isinstance(layers, dict) and set(layers) <= KINDS)
    for states in layers.values():
        require(
            isinstance(states, dict)
            and set(states) <= STATES
            and all(type(v) is int and 0 <= v <= expected for v in states.values())
            and sum(states.values()) == expected
        )
    result = {
        k: period[k]
        for k in [
            "support_level",
            "computational_support",
            "expected_days",
            "included_days",
            "excluded_days",
        ]
    }
    result["layer_material_states"] = layers
    result["missing_prerequisites"] = reason_list(period["missing_prerequisites"])
    reasons = period["exclusion_reason_counts"]
    require(isinstance(reasons, dict))
    reason_list(list(reasons))
    require(all(type(v) is int and 0 <= v <= expected for v in reasons.values()))
    result["exclusion_reason_counts"] = reasons
    result["numeric_visibility"] = "approved_aggregate" if disclose else "withheld_public_boundary"
    for metric in METRICS:
        value = number(period["summary"][metric])
        result[metric] = value if disclose else None
    summary = period["summary"]
    uses = period["available_uses"]
    require(
        isinstance(uses, list) and set(uses) <= {"local_description", "local_material_inspection"}
    )
    require(type(period["data_gate_passed"]) is bool)
    subset = {
        k: number(summary["supported_subset"][k])
        for k in ["hours", "area_time_km2_days", "density_hours_per_km2_day"]
    }
    supported_days = summary["supported_days"]
    require(type(supported_days) is int and included <= supported_days <= expected)
    reason = summary["daily_mean_reason"]
    require(reason in {None, "daily_spatial_support_changes", "no_supported_days"})
    result.update(
        available_uses=uses,
        data_gate_passed=period["data_gate_passed"],
        daily_mean_reason=reason,
        supported_subset={
            "days": supported_days,
            **{k: v if disclose else None for k, v in subset.items()},
        },
    )
    result["research_ready"] = False
    if "dates" in period:
        dates = period["dates"]
        require(isinstance(dates, list) and len(dates) == expected and len(set(dates)) == expected)
        require(all(isinstance(v, str) and date.fromisoformat(v).isoformat() == v for v in dates))
        result["dates"] = dates
    return result


def day_projection(row, disclose):
    require(
        isinstance(row["date"], str) and date.fromisoformat(row["date"]).isoformat() == row["date"]
    )
    require(
        row["state"] in {"computed", "partial", "zero_support", "unverified"}
        and type(row["included"]) is bool
    )
    result = {k: row[k] for k in ["date", "state", "included"]}
    result["exclusion_reasons"] = reason_list(row["exclusion_reasons"])
    states = row["source_states"]
    require(
        isinstance(states, dict)
        and set(states) <= KINDS
        and all(v in STATES for v in states.values())
    )
    result["source_states"] = states
    for key in [
        "hours",
        "effective_area_km2",
        "area_time_km2_days",
        "density_hours_per_km2_day",
        "unknown_request_area_km2",
        "known_excluded_area_km2",
    ]:
        value = number(row[key])
        result[key] = value if disclose else None
    result["layer_support"] = {}
    for kind, part in row["layer_support"].items():
        require(kind in KINDS)
        detail = {"reasons": reason_list(part["reasons"])}
        for key in ["effective_area_km2", "unknown_request_area_km2", "known_excluded_area_km2"]:
            value = number(part[key])
            detail[key] = value if disclose else None
        result["layer_support"][kind] = detail
    return result


def unavailable(status, reason, freshness="unknown"):
    return {"status": status, "reason": reason, "freshness": freshness, "research_ready": False}


def read_json(path, max_bytes):
    return decode_controlled_json(read_regular_bytes(path, max_bytes), max_bytes=max_bytes)


def snapshot_digest(payload):
    return (
        "sha256:"
        + hashlib.sha256(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode(
                "utf-8"
            )
        ).hexdigest()
    )


def observed_files_status(state):
    records = state["observed_files"]
    require(set(records) == OBSERVED_ROLES)
    for record in records.values():
        path = Path(record["path"])
        expected = record["stat"]
        require(
            path.is_absolute()
            and isinstance(expected, list)
            and len(expected) == 5
            and all(type(v) is int for v in expected)
        )
        try:
            actual = path.stat()
        except OSError:
            return unavailable("freshness_unknown", "registered_input_or_protocol_unavailable")
        current = [
            actual.st_dev,
            actual.st_ino,
            actual.st_size,
            actual.st_mtime_ns,
            actual.st_ctime_ns,
        ]
        if current != expected:
            return unavailable("expired", "registered_input_or_protocol_changed", "stale")
    return None


def read_audited_support(path, request, state_path=None):
    try:
        ready = None
        if state_path is not None:
            state = read_json(state_path, 4096)
            require(state.get("schema") == "ocean-support-state/v1")
            if state.get("state") == "scanning":
                return unavailable("scanning", "audit_refresh_in_progress")
            if state.get("state") == "expired":
                return unavailable("expired", "audit_snapshot_marked_expired", "stale")
            if state.get("state") == "failed":
                return unavailable("audit_failed", "audit_refresh_failed")
            if state.get("state") == "ready":
                ready = state
                frozen_id = fingerprint(ready["snapshot_id"])
                require(set(ready["protocol"]) == set(PROTOCOL_HASHES))
                for identity in [
                    ready["input_sha256"],
                    ready["conditions_id"],
                    *ready["protocol"].values(),
                ]:
                    fingerprint(identity)
                generated = datetime.fromisoformat(ready["generated_at"])
                require(
                    generated.utcoffset() == UTC.utcoffset(generated)
                    and generated.isoformat() == ready["generated_at"]
                )
                if problem := observed_files_status(ready):
                    return problem
                path = state_path.with_name(state_path.name + ".snapshots") / (
                    frozen_id[7:] + ".json"
                )
            else:
                require(state.get("state") == "unknown")
        if path is None:
            return unavailable("not_prepared", "audit_snapshot_not_configured")
        snapshot = read_json(path, 16 * 1024 * 1024)
        require(
            isinstance(snapshot, dict)
            and snapshot.get("schema") == "ocean-support-qualification/v1"
        )
        require(
            snapshot.get("research_ready") is False
            and type(snapshot.get("public_release_approved")) is bool
        )
        require(
            snapshot.get("evidence_kind") in {"synthetic", "audited_cells", "real_source_audit"}
        )
        identity = fingerprint(snapshot["support_snapshot_id"])
        payload = {k: v for k, v in snapshot.items() if k != "support_snapshot_id"}
        require(identity == snapshot_digest(payload))
        conditions = snapshot["conditions"]
        if ready is not None and (
            identity != ready["snapshot_id"]
            or "sha256:" + snapshot["input_sha256"] != ready["input_sha256"]
            or snapshot_digest(conditions) != ready["conditions_id"]
            or any("sha256:" + snapshot[k] != ready["protocol"][k] for k in PROTOCOL_HASHES)
        ):
            return unavailable("expired", "audit_snapshot_identity_mismatch", "stale")
        require(conditions.get("schema") == "ocean-support-request/v1")
        if (
            conditions["purpose"] != request.get("purpose", "A_month")
            or conditions["month"] != request["month"]
            or conditions["layer_use"] != request.get("layer_use", "front_effort")
        ):
            return unavailable("not_audited", "requested_conditions_not_in_snapshot")
        if conditions["purpose"] == "B_event" and (
            conditions.get("event_date") != request.get("event_date")
            or conditions.get("event_day_rule") != "exclude_event_day/v1"
        ):
            return unavailable("not_audited", "requested_event_not_in_snapshot")
        require(
            conditions["method_version"] == "wgs84-laea-uniform/v1"
            and conditions["quality_rule"] == "complete-common-support/v1"
            and conditions["allocation"] in {"overlap_uniform", "cell_center"}
        )
        require(isinstance(snapshot["regions"], list) and 1 <= len(snapshot["regions"]) <= 3)
        matches = [
            r
            for r in snapshot["regions"]
            if r["geometry"]["type"] == "circle"
            and r["geometry"]["center"] == [request["longitude"], request["latitude"]]
            and r["geometry"]["radius_km"] == request["radius_km"]
        ]
        if not matches:
            return unavailable("not_audited", "requested_geometry_not_in_snapshot")
        require(len(matches) == 1)
        region = matches[0]
        disclose = (
            snapshot["evidence_kind"] == "synthetic" and snapshot["public_release_approved"] is True
        )
        required = snapshot["required_layers"]
        require(
            isinstance(required, list)
            and required
            == ["front", "activity"]
            + (["sst"] if conditions["layer_use"] == "front_effort_sst" else [])
        )
        require(isinstance(region["days"], list) and 1 <= len(region["days"]) <= 367)
        rows = [day_projection(row, disclose) for row in region["days"]]
        require(len({r["date"] for r in rows}) == len(rows))
        actual = {
            k: conditions[k]
            for k in [
                "purpose",
                "month",
                "layer_use",
                "allocation",
                "method_version",
                "quality_rule",
            ]
        }
        actual["geometry"] = {
            "type": "circle",
            "center": [request["longitude"], request["latitude"]],
            "radius_km": request["radius_km"],
        }
        if conditions["purpose"] == "B_event":
            actual.update(
                event_date=conditions["event_date"], event_day_rule=conditions["event_day_rule"]
            )
        versions = {
            k: fingerprint("sha256:" + snapshot[k]) for k in ("input_sha256", *PROTOCOL_HASHES)
        }
        versions.update(
            method=conditions["method_version"],
            quality_rule=conditions["quality_rule"],
            parameter=content_id(snapshot["resolved_conditions"]),
        )
        daily = snapshot.get("input_daily_snapshot_id")
        versions["daily_snapshot_id"] = None if daily is None else fingerprint(daily)
        references, versions["sources"], versions["processing"] = evidence_projection(
            snapshot, region["geometry"], required
        )
        period = period_projection(region["month"], disclose)
        is_event = conditions["purpose"] == "B_event"
        result = {
            "status": "audited_snapshot",
            "snapshot_schema": "ocean-support-qualification/v1",
            "snapshot_id": identity,
            "audited_at": None,
            "qualification_scope": "frozen_snapshot_only",
            "requested_conditions": request,
            "actual_conditions": actual,
            "required_layers": required,
            "support_level": None if is_event else period["support_level"],
            "month": period,
            "days": rows,
            "versions": versions,
            "evidence": references,
            "freshness": "unknown",
            "freshness_reason": "current_source_identity_not_checked",
            "research_ready": False,
            "numeric_visibility": "approved_aggregate" if disclose else "withheld_public_boundary",
            "evidence_kind": snapshot["evidence_kind"],
            "evidence_scope": "frozen_audit_summary_not_independent_source_verification",
        }
        if is_event:
            windows = region["windows"]
            require(set(windows) == {"pre7", "post3", "post7"})
            require(region["month"]["scope"] == "month_calendar_only_not_event_eligibility")
            period["scope"] = "month_calendar_only_not_event_eligibility"
            event_gates = region["event_data_gate_passed"]
            require(
                set(event_gates) == {"post3", "post7"}
                and all(type(v) is bool for v in event_gates.values())
            )
            result["event_data_gate_passed"] = event_gates
            result["windows"] = {}
            event = date.fromisoformat(conditions["event_date"])
            for key, offsets in {
                "pre7": range(-7, 0),
                "post3": range(1, 4),
                "post7": range(1, 8),
            }.items():
                projected = period_projection(windows[key], disclose)
                require(
                    projected["dates"] == [(event + timedelta(days=i)).isoformat() for i in offsets]
                )
                result["windows"][key] = projected
        if ready is not None:
            if read_json(state_path, 4096) != ready:
                return unavailable("refresh_changed", "audit_state_changed_during_read")
            if problem := observed_files_status(ready):
                return problem
            result.update(
                audited_at=ready["generated_at"],
                registered_receipt_match=True,
                freshness_reason="receipt_matches_live_content_not_rechecked",
                raw_source_freshness="unknown",
            )
        return result
    except PermissionError:
        return unavailable("permission_denied", "audit_snapshot_permission_denied")
    except FileNotFoundError:
        return unavailable("not_prepared", "audit_snapshot_unavailable")
    except (
        OSError,
        ValueError,
        TypeError,
        KeyError,
        IndexError,
        AttributeError,
        OverflowError,
        RecursionError,
    ):
        return unavailable("invalid_snapshot", "audit_snapshot_invalid_or_unreadable")
