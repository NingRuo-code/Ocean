"""Read bounded frozen P0 outputs; never import an auditor or reopen original sources."""

import hashlib
import json
import math
import re
from datetime import date, timedelta

from .analysis_support import content_id, decode_controlled_json

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
    require(isinstance(value, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", value))
    return value


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
    with path.open("rb") as stream:
        return decode_controlled_json(stream.read(max_bytes + 1), max_bytes=max_bytes)


def read_audited_support(path, request, state_path=None):
    try:
        if state_path is not None:
            state = read_json(state_path, 4096)
            require(state.get("schema") == "ocean-support-state/v1")
            if state.get("state") == "scanning":
                return unavailable("scanning", "audit_refresh_in_progress")
            if state.get("state") == "expired":
                return unavailable("expired", "audit_snapshot_marked_expired", "stale")
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
        calculated = (
            "sha256:"
            + hashlib.sha256(
                json.dumps(
                    payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False
                ).encode("utf-8")
            ).hexdigest()
        )
        require(identity == calculated)
        conditions = snapshot["conditions"]
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
        disclose = snapshot.get("public_release_approved") is True
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
            k: fingerprint("sha256:" + snapshot[k])
            for k in [
                "input_sha256",
                "regional_engine_sha256",
                "source_reader_sha256",
                "auditor_sha256",
            ]
        }
        versions.update(
            method=conditions["method_version"],
            quality_rule=conditions["quality_rule"],
            parameter=content_id(snapshot["resolved_conditions"]),
        )
        daily = snapshot.get("input_daily_snapshot_id")
        versions["daily_snapshot_id"] = None if daily is None else fingerprint(daily)
        period = period_projection(region["month"], disclose)
        result = {
            "status": "audited_snapshot",
            "snapshot_id": identity,
            "requested_conditions": request,
            "actual_conditions": actual,
            "required_layers": required,
            "support_level": period["support_level"],
            "month": period,
            "days": rows,
            "versions": versions,
            "freshness": "unknown",
            "freshness_reason": "current_source_identity_not_checked",
            "research_ready": False,
            "numeric_visibility": "approved_aggregate" if disclose else "withheld_public_boundary",
            "evidence_kind": snapshot["evidence_kind"],
            "evidence_scope": "frozen_audit_summary_not_independent_source_verification",
        }
        if conditions["purpose"] == "B_event":
            windows = region["windows"]
            require(set(windows) == {"pre7", "post3", "post7"})
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
