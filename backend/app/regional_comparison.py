"""C01 reads existing results; it never computes A/B metrics or source qualification."""

import copy
import json
import sys
from datetime import date, timedelta

from .analysis_support import content_id, decode_controlled_json
from .comparability import add_compatibility, source_lifecycle
from .comparison_models import (
    ComparisonRequest,
    ExistingChange,
    ExistingEvent,
    ExistingWindow,
    KnownMetrics,
    SnapshotPack,
    SnapshotSource,
)
from .fixed_region_models import FixedRegionRequest
from .monthly_models import MonthlyRequest

MONTHLY_UNITS = {
    "total_hours": "fishing_hours",
    "area_time_km2_days": "km2*d",
    "mean_hours_per_supported_day": "fishing_hours/d",
    "density_hours_per_km2_day": "fishing_hours/(km2*d)",
}
MONTHLY_METHODS = {"monthly-known-support/v1", "monthly-known-support/v1.0-label"}


def _monthly_projection(snapshot, *, compatibility=False):
    parameters = MonthlyRequest.model_validate(snapshot["parameters"])
    if (
        parameters.method_version
        not in (MONTHLY_METHODS if compatibility else {"monthly-known-support/v1"})
        or parameters.parameter_version != "known-unit-membership/v1"
        or (not compatibility and snapshot["units"] != MONTHLY_UNITS)
        or snapshot["status"] not in {"available", "partial", "unavailable"}
        or not isinstance(snapshot.get("coverage"), dict)
        or snapshot["coverage"].get("support_scope") != "known_synthetic_units_for_declared_circle"
    ):
        raise ValueError("Unsupported source semantics")
    KnownMetrics.model_validate(snapshot["metrics"])
    units = snapshot["units"]
    if compatibility:
        units = {
            key: unit if isinstance(unit, str) and 1 <= len(unit) <= 100 else None
            for key in MONTHLY_UNITS
            for unit in [units.get(key) if isinstance(units, dict) else None]
        }
    result = {
        "metrics": copy.deepcopy(snapshot["metrics"]),
        "units": copy.deepcopy(units),
        "source_status": snapshot["status"],
        "support_scope": snapshot["coverage"]["support_scope"],
    }
    if compatibility:
        result["comparison_daily"] = copy.deepcopy(snapshot.get("daily"))
        result["method_equivalence"] = {
            "semantic_id": "known-support-H-E/v1",
            "evidence": "known-fixture-label-equivalence/v1; frozen H/E contract, not an algorithm upgrade",
            "original_method": parameters.method_version,
        }
    return result


def _event_projection(snapshot, *, compatibility=False):
    FixedRegionRequest.model_validate(snapshot["parameters"])
    if (
        snapshot["schema_version"] != "fixed-region-event-example/v1"
        or snapshot["metric"] != "apparent_fishing_effort"
        or snapshot["unit"] != "fishing_hours"
        or snapshot["status"]
        not in {
            "available",
            "partial",
            "multiple_candidates",
            "unknown",
            "no_observed_entry",
        }
    ):
        raise ValueError("Unsupported event semantics")
    windows, changes = snapshot["windows"], snapshot["changes"]
    expected = {"pre7": [-7, -1], "event_day": [0, 0], "post1_3": [1, 3], "post1_7": [1, 7]}
    if not isinstance(windows, dict) or not isinstance(changes, dict):
        raise TypeError("Invalid window container")
    if windows and not compatibility and set(windows) != set(expected):
        raise ValueError("Incomplete event window contract")
    event = ExistingEvent.model_validate(snapshot["event"]) if snapshot["event"] else None
    if bool(windows) != bool(event):
        raise ValueError("Event and windows must identify the same result")
    projected, issues = {}, {}
    for name, window in windows.items():
        try:
            if name not in expected:
                raise ValueError("Unknown window")
            ExistingWindow.model_validate(window)
            if window["relative_days"] != expected[name]:
                raise ValueError("Changed event window definition")
            if compatibility:
                anchor = date.fromisoformat(event.anchor_date)
                a, b = expected[name]
                if window["dates"] != [
                    (anchor + timedelta(days=n)).isoformat() for n in range(a, b + 1)
                ]:
                    raise ValueError("Window dates differ from anchor")
            projected[name] = copy.deepcopy(window)
        except (ValueError, KeyError, TypeError):
            if not compatibility:
                raise
            if name in expected:
                issues[name] = "window_contract_unverified"
    if not compatibility and set(changes) != ({"post1_3", "post1_7"} if windows else set()):
        raise ValueError("Changed event change contract")
    if not compatibility:
        for change in changes.values():
            ExistingChange.model_validate(change)
    result = {
        "windows": projected,
        "changes": {} if compatibility else copy.deepcopy(changes),
        "event": copy.deepcopy(snapshot["event"]),
        "units": copy.deepcopy(MONTHLY_UNITS),
        "source_status": snapshot["status"],
        "support_scope": "known_synthetic_units_for_declared_circle",
    }
    if compatibility:
        result.update(comparison_daily=copy.deepcopy(snapshot.get("daily")), window_issues=issues)
    return result


def _read_candidate(candidate, request, snapshots):
    row = {"candidate": candidate.model_dump(), "status": "not_ready", "reason": None}
    kind = "A" if request.analysis_kind == "monthly_spatial_example" else "B"
    entry = snapshots.get(candidate.result_id)
    if entry is None:
        return {**row, "reason": "source_result_missing", "required": f"existing_{kind}_result"}
    if entry.access != "public_aggregate" or entry.public_aggregate_allowed is not True:
        return {**row, "reason": "source_not_public", "required": "source_access_clearance"}
    snapshot = entry.result
    if (
        snapshot.get("evidence_kind") != "synthetic_example"
        or snapshot.get("research_ready") is not False
    ):
        return {
            **row,
            "reason": "source_not_controlled_example",
            "required": "qualified_AB_adapter",
        }
    try:
        identity = snapshot["result_id"]
        if (
            content_id(snapshot) != entry.snapshot_sha256
            or entry.snapshot_sha256 != candidate.snapshot_sha256
        ):
            raise ValueError("Snapshot content changed")
        if request.method_version == "known-snapshots/v2":
            state = source_lifecycle(entry, candidate)
            if state and state != "completed":
                return {**row, "reason": "source_" + state, "required": "completed_source_result"}
        source = SnapshotSource.model_validate(snapshot["source"])
        if request.method_version == "known-snapshots/v2":
            if not source.license.startswith("CC0-1.0"):
                return {
                    **row,
                    "reason": "source_license_unverified",
                    "required": "source_use_clearance",
                }
            if snapshot.get("kind") != request.analysis_kind:
                return {
                    **row,
                    "reason": "source_purpose_mismatch",
                    "required": f"existing_{kind}_result",
                }
            if kind == "A":
                native = MonthlyRequest.model_validate(snapshot["parameters"])
                if (
                    native.method_version not in MONTHLY_METHODS
                    or native.parameter_version != "known-unit-membership/v1"
                ):
                    return {
                        **row,
                        "reason": "native_method_equivalence_unverified",
                        "differences": [
                            {
                                "field": "native_method",
                                "actual": [native.method_version, native.parameter_version],
                            }
                        ],
                        "required": "registered_AB_method_equivalence",
                    }
        if (
            source != candidate.source
            or snapshot.get("kind") != request.analysis_kind
            or not source.license.startswith("CC0-1.0")
            or source.version != snapshot["parameters"]["input_version"]
        ):
            raise ValueError("Snapshot source identity or purpose changed")
        projection = (
            _monthly_projection(
                snapshot, compatibility=request.method_version == "known-snapshots/v2"
            )
            if kind == "A"
            else _event_projection(
                snapshot, compatibility=request.method_version == "known-snapshots/v2"
            )
        )
        caveats = snapshot.get("caveats")
        if (
            not isinstance(caveats, list)
            or not 1 <= len(caveats) <= 16
            or any(not isinstance(note, str) or not 1 <= len(note) <= 500 for note in caveats)
        ):
            raise ValueError("Invalid original caveats")
        actual = snapshot["parameters"]
        expected = {
            "longitude": candidate.longitude,
            "latitude": candidate.latitude,
            "radius_km": request.radius_km,
        }
        expected.update(
            {"month": request.month}
            if kind == "A"
            else {
                "search_start": request.search_start,
                "search_end": request.search_end,
            }
        )
        conflicts = [key for key, value in expected.items() if actual.get(key) != value]
        if conflicts:
            mismatch = {
                **row,
                "reason": "source_condition_mismatch",
                "conflicts": conflicts,
                "required": f"existing_{kind}_result_for_requested_conditions",
            }
            if request.method_version == "known-snapshots/v2":
                mismatch["differences"] = [
                    {"field": key, "actual": actual[key], "expected": expected[key]}
                    for key in conflicts
                ]
            return mismatch
        return {
            **row,
            **projection,
            "status": "limited_side_by_side",
            "reason": "support_not_aligned",
            "original_parameters": copy.deepcopy(actual),
            "source": source.model_dump(),
            "source_result_id": identity,
            "snapshot_sha256": entry.snapshot_sha256,
            "source_caveats": copy.deepcopy(caveats),
            "access": {"access": entry.access, "public_aggregate_allowed": True},
        }
    except (ValueError, TypeError, KeyError, ArithmeticError):
        return {
            **row,
            "reason": "source_identity_or_contract_invalid",
            "required": f"verified_existing_{kind}_result",
        }


def compare_known_snapshots(request_payload, pack_payload):
    """Explicit, deterministic snapshot composition at the agreed controlled seam."""
    request = ComparisonRequest.model_validate(request_payload)
    pack = SnapshotPack.model_validate(pack_payload)
    snapshots = {entry.result["result_id"]: entry for entry in pack.snapshots}
    rows = [_read_candidate(candidate, request, snapshots) for candidate in request.candidates]
    result = {
        "kind": request.purpose,
        "analysis_kind": request.analysis_kind,
        "status": "limited_side_by_side"
        if any(row["status"] == "limited_side_by_side" for row in rows)
        else "not_ready",
        "parameters": request.model_dump(exclude_none=True),
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "source": {
            "id": "explicit-existing-snapshots",
            "version": "known-snapshots/v1",
            "input_sha256": content_id(pack_payload),
        },
        "rows": rows,
        "caveats": [
            "Only explicitly public synthetic snapshots; not qualified real regional research.",
            "Each value retains its own original support; equal radius/month does not align support.",
            "No ranking, difference, joint inference or fishery recommendation is produced.",
            "Reading does not run A/B, prepare archives, download data or invoke a model.",
            "Content identities detect accidental changes; they are not issuer signatures.",
            "Native A/B result IDs remain opaque; imported content is bound separately.",
        ],
    }
    if request.method_version == "known-snapshots/v2":
        result["source"]["version"] = request.method_version
        add_compatibility(result, request, snapshots)
    result["result_id"] = content_id(result)
    return result


def main():
    try:
        envelope = decode_controlled_json(sys.stdin.buffer.read(4_194_305), 4_194_304)
        if not isinstance(envelope, dict) or set(envelope) != {"request_json", "input_json"}:
            raise ValueError("Invalid comparison envelope")
        request = decode_controlled_json(envelope["request_json"], 16_384)
        pack = decode_controlled_json(envelope["input_json"])
        result = compare_known_snapshots(request, pack)
        print(json.dumps({"state": "completed", "result": result}, allow_nan=False))
    except (OSError, ValueError, TypeError, ArithmeticError, RecursionError):
        print(json.dumps({"state": "failed", "error": {"code": "controlled_comparison_failed"}}))
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
