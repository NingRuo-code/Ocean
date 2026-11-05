"""Purpose-specific calendar qualification using the existing regional support engine."""

import argparse
import calendar
import json
import re
import sys
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

import audit_regional_support as regional

SCHEMA = "ocean-support-qualification/v1"
QUALITY = "complete-common-support/v1"


def validate_conditions(value):
    allowed = {
        "schema",
        "purpose",
        "month",
        "layer_use",
        "method_version",
        "quality_rule",
        "allocation",
        "geometries",
        "source_ids",
        "event_date",
        "event_day_rule",
    }
    if (
        not isinstance(value, dict)
        or value.get("schema") != "ocean-support-request/v1"
        or set(value) - allowed
    ):
        raise ValueError("invalid_support_request")
    if value.get("purpose") not in {"A_month", "B_event", "description", "map"}:
        raise ValueError("unsupported_analysis_purpose")
    if value.get("quality_rule") != QUALITY:
        raise ValueError("unsupported_quality_rule")
    if value.get("method_version") != regional.METHOD:
        raise ValueError("unsupported_method_version")
    month = value["month"]
    if not isinstance(month, str) or not re.fullmatch(r"\d{4}-\d{2}", month):
        raise ValueError("invalid_month")
    start = date.fromisoformat(month + "-01")
    end = start.replace(day=calendar.monthrange(start.year, start.month)[1])
    if value["purpose"] == "B_event":
        event = regional.iso_day(value["event_date"])
        if (
            event.strftime("%Y-%m") != month
            or value.get("event_day_rule") != "exclude_event_day/v1"
        ):
            raise ValueError("invalid_event_day_rule_or_month")
        if any(g.get("type") == "front_buffer" for g in value["geometries"]):
            raise ValueError("fixed_event_geometry_required")
        start = min(start, event - timedelta(days=7))
        end = max(end, event + timedelta(days=7))
    elif "event_date" in value or "event_day_rule" in value:
        raise ValueError("unexpected_event_conditions")
    request = {
        "schema": "ocean-regional-request/v1",
        "purpose": value["layer_use"],
        "start": start.isoformat(),
        "end": end.isoformat(),
        "allocation": value["allocation"],
        "method_version": value["method_version"],
        "geometries": value["geometries"],
    }
    if "source_ids" in value:
        request["source_ids"] = value["source_ids"]
    regional.validate_request(request)
    return request


def qualify_period(rows):
    included = []
    for row in rows:
        reasons = list(row["reasons"])
        if row["unknown_request_area_km2"] > regional.AREA_TOL:
            reasons.append("unknown_spatial_support")
        if (row["outside_request_selected_area_km2"] or 0) > regional.AREA_TOL:
            reasons.append("allocation_extends_requested_geometry")
        if row["hours"] is None or not row["area_time_km2_days"]:
            reasons.append("same_support_numerator_or_denominator_unavailable")
        row["included"] = not reasons
        row["exclusion_reasons"] = sorted(set(reasons))
        if row["included"]:
            included.append(row)
    descriptive = any(r["hours"] is not None and r["area_time_km2_days"] for r in rows)
    computational = (
        "supported"
        if len(included) == len(rows)
        else "limited"
        if descriptive
        else "unsupported"
        if all(
            r["state"] == "zero_support"
            and r["unknown_request_area_km2"] <= regional.AREA_TOL
            for r in rows
        )
        else "unverified"
    )
    summary = regional.summarize_period(rows)
    if len(included) != len(rows):
        for key in [
            "total_hours",
            "mean_hours_per_supported_day",
            "mean_hours_per_requested_day",
            "area_time_km2_days",
            "density_hours_per_km2_day",
        ]:
            summary[key] = None
    return {
        "expected_days": len(rows),
        "included_days": len(included),
        "excluded_days": len(rows) - len(included),
        "computational_support": computational,
        "summary": summary,
        "exclusion_reason_counts": dict(
            sorted(
                Counter(
                    reason for r in rows for reason in r["exclusion_reasons"]
                ).items()
            )
        ),
        "layer_material_states": {
            kind: dict(sorted(Counter(r["source_states"][kind] for r in rows).items()))
            for kind in rows[0]["source_states"]
        },
        "support_level": "unverified",
        "formal_research_permitted": False,
        "missing_prerequisites": [
            "license_evidence_unverified",
            "granularity_evidence_unverified",
            "quality_rule_approval_unverified",
        ],
    }


def valid_identity(value):
    return (
        isinstance(value, str)
        and re.fullmatch(r"sha256:[a-f0-9]{64}", value) is not None
    )


def evidence_status(value, geometry, source_ids):
    if value is None:
        return [
            "license_evidence_unverified",
            "granularity_evidence_unverified",
            "quality_rule_approval_unverified",
            "source_versions_unverified",
            "processing_version_unverified",
        ], False
    if (
        not isinstance(value, dict)
        or value.get("schema") != "ocean-support-evidence/v1"
        or set(value)
        - {
            "schema",
            "source_versions",
            "processing_version",
            "license",
            "quality_rule",
            "geometry",
        }
    ):
        raise ValueError("invalid_qualification_evidence")
    versions = value.get("source_versions", {})
    if not isinstance(versions, dict) or any(
        not isinstance(k, str)
        or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", k)
        or not valid_identity(v)
        for k, v in versions.items()
    ):
        raise ValueError("invalid_source_versions")
    gaps = []
    if any(source_id not in versions for source_id in source_ids):
        gaps.append("source_versions_unverified")
    if not valid_identity(value.get("processing_version")):
        gaps.append("processing_version_unverified")
    geometry_proofs = value.get("geometry", {})
    if not isinstance(geometry_proofs, dict) or len(geometry_proofs) > 3:
        raise ValueError("invalid_geometry_evidence")
    blocked = False
    for key, proof, allowed, reason in [
        (
            "license",
            value.get("license"),
            {"state", "evidence_id"},
            "license_evidence_unverified",
        ),
        (
            "quality_rule",
            value.get("quality_rule"),
            {"state", "evidence_id", "id"},
            "quality_rule_approval_unverified",
        ),
        (
            "granularity",
            geometry_proofs.get(geometry["id"]),
            {"state", "evidence_id", "request_geometry"},
            "granularity_evidence_unverified",
        ),
    ]:
        if proof is None:
            gaps.append(reason)
            continue
        if (
            not isinstance(proof, dict)
            or set(proof) - allowed
            or proof.get("state") not in {"verified", "unverified", "blocked"}
            or ("evidence_id" in proof and not valid_identity(proof["evidence_id"]))
        ):
            raise ValueError("invalid_verification_claim")
        blocked = blocked or proof["state"] == "blocked"
        if proof["state"] != "verified" or not valid_identity(proof.get("evidence_id")):
            gaps.append(reason)
        if key == "quality_rule" and proof.get("id") != QUALITY:
            gaps.append("quality_rule_evidence_mismatch")
        if key == "granularity" and proof.get("request_geometry") != geometry:
            gaps.append("granularity_geometry_mismatch")
    return sorted(set(gaps)), blocked


def apply_evidence(period, gaps, blocked, evidence_kind, purpose):
    gaps = list(gaps)
    if period["computational_support"] != "supported":
        gaps.append("incomplete_common_support")
    period["support_level"] = (
        "unsupported"
        if blocked
        else "unverified"
        if gaps and any(x != "incomplete_common_support" for x in gaps)
        else period["computational_support"]
    )
    period["missing_prerequisites"] = sorted(set(gaps))
    period["available_uses"] = []
    license_ok = "license_evidence_unverified" not in gaps
    if license_ok and period["summary"]["supported_subset"]["hours"] is not None:
        period["available_uses"] = ["local_description"]
        if purpose == "description" and period["support_level"] != "supported":
            period["support_level"] = "limited"
    if (
        purpose == "map"
        and license_ok
        and any(
            any(
                state in {"parsed", "declared_cells"} and count > 0
                for state, count in states.items()
            )
            for states in period["layer_material_states"].values()
        )
    ):
        period["available_uses"] = ["local_material_inspection"]
        if period["support_level"] != "supported":
            period["support_level"] = "limited"
    period["data_gate_passed"] = (
        period["support_level"] == "supported"
        and evidence_kind == "audited_cells"
        and purpose in {"A_month", "B_event"}
    )
    period["formal_research_permitted"] = False
    period["evidence_scope"] = (
        "provided_verification_claims_not_independently_dereferenced"
    )


def evaluate_conditions(conditions, data):
    request = validate_conditions(conditions)
    evaluated = regional.evaluate(request, data)
    source_ids = request.get(
        "source_ids",
        {
            "front": "front-original",
            "activity": "effort-original",
            "sst": "sst-original",
        },
    )
    required_source_ids = [source_ids.get(k, "") for k in evaluated["required_layers"]]
    claims = data.get("qualification_evidence")
    for region in evaluated["regions"]:
        gaps, blocked = evidence_status(claims, region["geometry"], required_source_ids)
        region["month"] = qualify_period(
            [
                r
                for r in region["days"]
                if r["date"].startswith(conditions["month"] + "-")
            ]
        )
        apply_evidence(
            region["month"], gaps, blocked, data["evidence_kind"], conditions["purpose"]
        )
        for row in region["days"]:
            row["periods"] = (
                ["month"] if row["date"].startswith(conditions["month"] + "-") else []
            )
        if conditions["purpose"] == "B_event":
            region["month"]["data_gate_passed"] = False
            region["month"]["scope"] = "month_calendar_only_not_event_eligibility"
            event = regional.iso_day(conditions["event_date"])
            region["windows"] = {}
            for key, offsets in {
                "pre7": range(-7, 0),
                "post3": range(1, 4),
                "post7": range(1, 8),
            }.items():
                dates = [(event + timedelta(days=i)).isoformat() for i in offsets]
                rows = [r for r in region["days"] if r["date"] in dates]
                for row in rows:
                    row["periods"].append(key)
                window = qualify_period(rows)
                apply_evidence(
                    window, gaps, blocked, data["evidence_kind"], conditions["purpose"]
                )
                window["dates"] = dates
                region["windows"][key] = window
            region["event_data_gate_passed"] = {
                key: region["windows"]["pre7"]["data_gate_passed"]
                and region["windows"][key]["data_gate_passed"]
                for key in ["post3", "post7"]
            }
    return {
        "schema": SCHEMA,
        "conditions": conditions,
        "resolved_conditions": request,
        "quality_rule": {
            "id": QUALITY,
            "calendar": "complete requested Gregorian month; missing dates retained",
            "temporal_support": "verified full day only",
            "unknown_area_tolerance_km2": regional.AREA_TOL,
            "approval": "separate evidence required; no default scientific threshold approval",
        },
        "evidence_kind": data["evidence_kind"],
        "qualification_evidence": claims,
        "evidence_scope": "provided_verification_claims_not_independently_dereferenced",
        "required_layers": evaluated["required_layers"],
        "method": evaluated["method"],
        "regions": evaluated["regions"],
        "research_ready": False,
        "public_release_approved": False,
    }


def render_report(result):
    lines = [
        "# Calendar support qualification",
        "",
        f"Snapshot: {result['support_snapshot_id']}",
        "",
        "Verification references are maintainer claims; this report does not independently establish research or publication approval.",
        "",
        "| Region | Period | Computational | Support | Included/required | Missing prerequisites |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for region in result["regions"]:
        periods = {"month": region["month"], **region.get("windows", {})}
        for name, period in periods.items():
            lines.append(
                f"| {region['geometry']['id']} | {name} | {period['computational_support']} | {period['support_level']} | {period['included_days']}/{period['expected_days']} | {', '.join(period['missing_prerequisites'])} |"
            )
    lines += [
        "",
        "| Region | Date | Included | Hours | Effective km² | km²-days | Exclusion reasons |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for region in result["regions"]:
        for row in region["days"]:
            values = [
                region["geometry"]["id"],
                row["date"],
                row["included"],
                row["hours"],
                row["effective_area_km2"],
                row["area_time_km2_days"],
                ", ".join(row["exclusion_reasons"]),
            ]
            lines.append(
                "| "
                + " | ".join("unknown" if x is None else str(x) for x in values)
                + " |"
            )
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--support-request", type=Path)
    parser.add_argument("--read-support-snapshot", type=Path)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--regional-input", type=Path)
    group.add_argument("--daily-snapshot", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--report-out", type=Path)
    args = parser.parse_args()
    if args.read_support_snapshot:
        if any(
            [
                args.support_request,
                args.regional_input,
                args.daily_snapshot,
                args.out,
                args.report_out,
            ]
        ):
            raise ValueError("mixed_read_and_compute_arguments")
        result = regional.controlled_json(args.read_support_snapshot)
        if (
            not isinstance(result, dict)
            or result.get("schema") != SCHEMA
            or result.get("support_snapshot_id")
            != "sha256:"
            + regional.digest(
                {k: v for k, v in result.items() if k != "support_snapshot_id"}
            )
        ):
            raise ValueError("invalid_support_snapshot_identity")
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return
    source = args.regional_input or args.daily_snapshot
    if not source or not args.support_request or not args.out:
        raise ValueError("missing_support_compute_arguments")
    outputs = [p for p in [args.out, args.report_out] if p is not None]
    if any(
        regional.paths_overlap(out, p)
        for out in outputs
        for p in [args.support_request, source]
    ) or (len(outputs) == 2 and regional.paths_overlap(*outputs)):
        raise ValueError("output_overlaps_input_or_output")
    conditions = regional.controlled_json(args.support_request)
    resolved = validate_conditions(conditions)
    data = regional.controlled_json(source)
    if not isinstance(data, dict):
        raise TypeError("invalid_regional_cells")
    source_id = None
    if args.daily_snapshot:
        source_id = data.get("daily_snapshot_id")
        data = regional.from_daily_snapshot(data, resolved)
    elif data.get("evidence_kind") == "real_source_audit":
        raise ValueError("daily_snapshot_required")
    result = evaluate_conditions(conditions, data)
    result["input_sha256"] = regional.file_digest(source)
    result["input_daily_snapshot_id"] = source_id
    result["regional_engine_sha256"] = regional.file_digest(Path(regional.__file__))
    result["source_reader_sha256"] = regional.file_digest(
        Path(__file__).with_name("audit_daily_sources.py")
    )
    result["auditor_sha256"] = regional.file_digest(Path(__file__))
    result["support_snapshot_id"] = "sha256:" + regional.digest(result)
    regional.atomic_text(
        args.out,
        json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
    )
    if args.report_out:
        regional.atomic_text(args.report_out, render_report(result))
    print("Calendar support audit complete; research approval remains separate.")


if __name__ == "__main__":
    try:
        main()
    except (
        ValueError,
        TypeError,
        KeyError,
        IndexError,
        OSError,
        OverflowError,
        RecursionError,
    ) as error:
        message = str(error)
        print(
            "Support audit failed: "
            + (message if re.fullmatch("[a-z_]+", message) else type(error).__name__),
            file=sys.stderr,
        )
        raise SystemExit(1) from None
