"""G3 V01 composes known public A aggregates, without scientific qualification/inference."""

import calendar
import json
import sys
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .analysis_support import content_id, decode_controlled_json, known_period_summary
from .comparison_models import Identity, SnapshotPack
from .monthly_models import ClosedModel, Finite, Month
from .published_months import UNITS, project_public_month

Label = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")]
Reference = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]{0,63}/v[1-9][0-9]*$")]
MonthNumber = Annotated[int, Field(strict=True, ge=1, le=12)]


class ValidationRegion(ClosedModel):
    id: Label
    name: Annotated[str, Field(pattern=r"^[\w .-]{1,80}$")]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]


class ValidationCandidate(ClosedModel):
    id: Label
    month: Month
    season: Label
    result_id: Identity
    snapshot_sha256: Identity


class ValidationRequest(ClosedModel):
    purpose: Literal["stratified_validation_example"]
    analysis_kind: Literal["monthly_spatial_example"]
    method_version: Literal["known-strata/v1"]
    protocol_ref: Reference
    partition_ref: Reference
    source_ref: Identity
    region: ValidationRegion
    radius_km: Literal[10, 20, 30]
    season_year_rule: Literal["calendar_year"]
    seasons: Annotated[
        dict[Label, Annotated[list[MonthNumber], Field(min_length=1, max_length=12)]],
        Field(min_length=1, max_length=12),
    ]
    aggregation: Literal["sum_known_nonoverlapping_H_over_E"]
    candidates: Annotated[list[ValidationCandidate], Field(min_length=1, max_length=12)]

    @model_validator(mode="after")
    def unique_support(self):
        months = [month for values in self.seasons.values() for month in values]
        if len(months) != len(set(months)):
            raise ValueError("Season month definitions overlap")
        for key in ("id", "month", "result_id"):
            values = [getattr(c, key) for c in self.candidates]
            if len(values) != len(set(values)):
                raise ValueError("Duplicate candidate/support identity")
        for candidate in self.candidates:
            if int(candidate.month[5:]) not in self.seasons.get(candidate.season, []):
                raise ValueError("Month and declared season disagree")
        return self


def _read_candidate(candidate, request, snapshots):
    row = {"candidate": candidate.model_dump(), "status": "not_ready"}
    entry = snapshots.get(candidate.result_id)
    if entry is None:
        return {**row, "reason": "source_result_missing"}
    if entry.access != "public_aggregate" or entry.public_aggregate_allowed is not True:
        return {**row, "reason": "source_not_public"}
    if entry.result.get("kind") != request.analysis_kind:
        return {**row, "reason": "source_analysis_kind_mismatch"}
    try:
        if entry.snapshot_sha256 != candidate.snapshot_sha256:
            raise ValueError("Different requested source content")
        result = project_public_month(entry)
        if content_id(result["source"]) != request.source_ref:
            return {**row, "reason": "source_support_mismatch"}
        p = result["parameters"]
        if (
            p["month"] != candidate.month
            or p["radius_km"] != request.radius_km
            or any(p[key] != getattr(request.region, key) for key in ("longitude", "latitude"))
        ):
            return {**row, "reason": "source_conditions_mismatch"}
        supported = result["metrics"]["supported_days"] > 0
        return {
            **row,
            "status": "known_support" if supported else "unknown_support",
            "reason": "known_partial_support" if supported else "no_known_support",
            "source_result_id": result["result_id"],
            "source_projection_id": result["projection_id"],
            "snapshot_sha256": entry.snapshot_sha256,
            "original_parameters": p,
            "source": result["source"],
            "source_status": result["status"],
            "metrics": result["metrics"],
            "units": result["units"],
            "daily": result["daily"],
            "source_caveats": result["caveats"],
        }
    except (OSError, ValueError, TypeError, KeyError, ArithmeticError, AttributeError):
        return {**row, "reason": "source_identity_or_contract_invalid"}


def _strata(request, rows):
    strata = []
    for year in sorted({int(c.month[:4]) for c in request.candidates}):
        for season in sorted(request.seasons):
            selected = [
                row
                for row in rows
                if int(row["candidate"]["month"][:4]) == year
                and row["candidate"]["season"] == season
            ]
            loaded = [row for row in selected if "daily" in row]
            # A's known-support arithmetic only: additive disjoint calendar months, same circle/method/units.
            metrics = known_period_summary([day for row in loaded for day in row["daily"]])
            planned = sum(
                calendar.monthrange(
                    int(row["candidate"]["month"][:4]), int(row["candidate"]["month"][5:])
                )[1]
                for row in selected
            )
            status = (
                "no_candidates"
                if not selected
                else "unknown_support"
                if metrics["total_hours"] is None
                else "known_support"
                if metrics["supported_days"] == planned
                and len(loaded) == len(selected)
                and all(row["source_status"] == "available" for row in loaded)
                and all(day["excluded_units"] == 0 for row in loaded for day in row["daily"])
                else "partial_known_support"
            )
            strata.append(
                {
                    "year": year,
                    "season": season,
                    "candidate_ids": [row["candidate"]["id"] for row in selected],
                    "loaded_candidate_ids": [row["candidate"]["id"] for row in loaded],
                    "contributing_candidate_ids": [
                        row["candidate"]["id"]
                        for row in loaded
                        if row["metrics"]["supported_days"] > 0
                    ],
                    "excluded_candidates": [
                        {"id": row["candidate"]["id"], "reason": row["reason"]}
                        for row in selected
                        if row["status"] != "known_support"
                    ],
                    "status": status,
                    "metrics": metrics,
                    "planned_calendar_days": planned,
                    "units": UNITS.copy(),
                    "intervals": None,
                    "independence": "not_assessed",
                }
            )
    return strata


def validate_known_months(request_payload, pack_payload):
    """Public controlled calculation boundary: fixed candidate list to frozen descriptive evidence."""
    request = ValidationRequest.model_validate(request_payload)
    pack = SnapshotPack.model_validate(pack_payload)
    snapshots = {entry.result["result_id"]: entry for entry in pack.snapshots}
    rows = [_read_candidate(candidate, request, snapshots) for candidate in request.candidates]
    any_known = any(row["status"] == "known_support" for row in rows)
    result = {
        "kind": request.purpose,
        "analysis_kind": request.analysis_kind,
        "parameters": request.model_dump(),
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "confirmatory": False,
        "independence": "not_assessed",
        "protocol_status": "reference_only",
        "partition_status": "reference_only",
        "random_seed": None,
        "randomness": "not_used",
        "intervals": None,
        "status": "partial" if any_known else "not_ready",
        "source": {
            "id": "explicit-known-month-snapshots",
            "version": request.method_version,
            "input_sha256": content_id(pack_payload),
        },
        "rows": rows,
        "strata": _strata(request, rows),
        "caveats": [
            "Authored CC0 synthetic evidence only; no P0 qualification or real independent research.",
            "Protocol and partition are references only; scientific freezing/contact guards are not integrated.",
            "Same-circle nonoverlapping calendar months only; sum known H / same-support E is descriptive, not mean monthly effect.",
            "Unknown/excluded candidates remain visible and never contribute invented zeros; A/B are not pooled.",
            "No interval, p-value, stability, independence, causal or fishing-success claim is produced.",
            "Reading reuses approved existing A results, never invokes A/B, archives, downloads or a model.",
            "Native result IDs are opaque; imported content and public projections have separate identities, not authorization signatures.",
        ],
    }
    result["result_id"] = content_id(result)
    return result


def main():
    try:
        envelope = decode_controlled_json(sys.stdin.buffer.read(4_194_305), 4_194_304)
        if not isinstance(envelope, dict) or set(envelope) != {"request_json", "input_json"}:
            raise ValueError("Invalid G3 envelope")
        result = validate_known_months(
            decode_controlled_json(envelope["request_json"], 16_384),
            decode_controlled_json(envelope["input_json"]),
        )
        print(json.dumps({"state": "completed", "result": result}, allow_nan=False))
    except (OSError, ValueError, TypeError, ArithmeticError, RecursionError):
        print(json.dumps({"state": "failed", "error": {"code": "controlled_validation_failed"}}))
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
