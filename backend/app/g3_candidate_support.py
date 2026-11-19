"""Coverage-only G3 review of explicitly provided P0 qualification snapshots."""

from datetime import date as calendar_date
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from .analysis_support import content_id
from .audited_support import evidence_id, project_frozen_support, unavailable
from .comparison_models import Identity
from .g3_models import G3Region, Label, Seasons
from .monthly_models import ClosedModel, LayerUse, Month

ISODate = Annotated[str, Field(pattern=r"^[12]\d{3}-\d{2}-\d{2}$")]


class EventWindow(ClosedModel):
    date: ISODate
    snapshot_id: Identity | None = None

    @field_validator("date")
    @classmethod
    def valid_calendar_date(cls, value):
        return calendar_date.fromisoformat(value).isoformat()


class ReviewCandidate(ClosedModel):
    id: Label
    month: Month
    season: Label
    region_id: Label
    radius_km: Literal[10, 20, 30]
    monthly_snapshot_id: Identity | None = None
    event: EventWindow | None = None


class CandidateReview(ClosedModel):
    purpose: Literal["g3_candidate_support"]
    method_version: Literal["candidate-support/v1"]
    season_year_rule: Literal["calendar_year"]
    layer_use: LayerUse
    seasons: Seasons
    regions: Annotated[list[G3Region], Field(min_length=1, max_length=8)]
    candidates: Annotated[list[ReviewCandidate], Field(min_length=1, max_length=24)]

    @model_validator(mode="after")
    def validate_partition(self):
        regions = {region.id for region in self.regions}
        months = [month for season in self.seasons.values() for month in season]
        candidate_ids = {candidate.id for candidate in self.candidates}
        conditions = {
            (candidate.month, candidate.region_id, candidate.radius_km)
            for candidate in self.candidates
        }
        if (
            len(regions) != len(self.regions)
            or len(months) != len(set(months))
            or len(candidate_ids) != len(self.candidates)
            or len(conditions) != len(self.candidates)
        ):
            raise ValueError("Duplicate candidate or partition")
        for candidate in self.candidates:
            if (
                candidate.region_id not in regions
                or int(candidate.month[5:]) not in self.seasons.get(candidate.season, [])
                or (candidate.event and candidate.event.date[:7] != candidate.month)
            ):
                raise ValueError("Candidate is outside the declared partition")
        return self


def _index_snapshots(pack):
    if (
        not isinstance(pack, dict)
        or set(pack) != {"schema", "snapshots"}
        or pack["schema"] != "ocean-g3-support-pack/v1"
        or not isinstance(pack["snapshots"], list)
        or len(pack["snapshots"]) > 16
    ):
        raise ValueError("Invalid frozen support pack")
    snapshots = {}
    for snapshot in pack["snapshots"]:
        identity = (
            evidence_id(snapshot.get("support_snapshot_id")) if isinstance(snapshot, dict) else None
        )
        if not identity or identity in snapshots:
            raise ValueError("Invalid or duplicate support reference")
        snapshots[identity] = snapshot
    return snapshots


def _period_metadata(period):
    names = {
        "scope",
        "dates",
        "support_level",
        "computational_support",
        "expected_days",
        "included_days",
        "excluded_days",
        "layer_material_states",
        "missing_prerequisites",
        "exclusion_reason_counts",
        "available_uses",
        "data_gate_passed",
    }
    return {name: value for name, value in period.items() if name in names}


def _day_metadata(row):
    return {
        key: row[key] for key in ("date", "state", "included", "source_states", "exclusion_reasons")
    }


def _review_audit(snapshot_id, snapshots, conditions):
    if snapshot_id not in snapshots:
        reason = (
            "support_snapshot_not_supplied" if snapshot_id else "support_snapshot_not_registered"
        )
        return unavailable("not_prepared", reason)
    audit = project_frozen_support(snapshots[snapshot_id], conditions)
    if audit["status"] != "audited_snapshot":
        return audit
    metadata = {
        key: audit[key]
        for key in (
            "status",
            "snapshot_id",
            "required_layers",
            "versions",
            "evidence",
            "freshness",
            "evidence_kind",
            "research_ready",
            "actual_conditions",
        )
    }
    if conditions["purpose"] == "A_month":
        return {
            **metadata,
            "calendar": _period_metadata(audit["month"]),
            "days": [_day_metadata(day) for day in audit["days"]],
        }
    event_day = next(
        (day for day in audit["days"] if day["date"] == conditions["event_date"]), None
    )
    return {
        **metadata,
        "event_day": _day_metadata(event_day) if event_day else None,
        "windows": {name: _period_metadata(period) for name, period in audit["windows"].items()},
        "event_data_gate_passed": audit["event_data_gate_passed"],
    }


def _candidate_row(candidate, region, layer_use, snapshots):
    conditions = {
        "longitude": region.longitude,
        "latitude": region.latitude,
        "radius_km": candidate.radius_km,
        "month": candidate.month,
        "layer_use": layer_use,
    }
    event = candidate.event
    event_conditions = {**conditions, "purpose": "B_event"}
    if event:
        event_conditions["event_date"] = event.date
    return {
        "candidate": candidate.model_dump(mode="json"),
        "monthly": _review_audit(
            candidate.monthly_snapshot_id, snapshots, {**conditions, "purpose": "A_month"}
        ),
        "event": {
            **_review_audit(event.snapshot_id if event else None, snapshots, event_conditions),
            "identification": "not_evaluated",
        },
    }


def _strata(request, rows):
    strata = []
    for year in sorted({int(candidate.month[:4]) for candidate in request.candidates}):
        for season in sorted(request.seasons):
            for region in request.regions:
                matches = [
                    row
                    for row in rows
                    if int(row["candidate"]["month"][:4]) == year
                    and row["candidate"]["season"] == season
                    and row["candidate"]["region_id"] == region.id
                ]
                strata.append(
                    {
                        "year": year,
                        "season": season,
                        "region_id": region.id,
                        "candidate_ids": [row["candidate"]["id"] for row in matches],
                        "status": "registered_candidates" if matches else "no_candidates",
                    }
                )
    return strata


def review_candidate_support(request_payload, pack_payload):
    request = CandidateReview.model_validate(request_payload)
    snapshots = _index_snapshots(pack_payload)
    regions = {region.id: region for region in request.regions}
    rows = [
        _candidate_row(candidate, regions[candidate.region_id], request.layer_use, snapshots)
        for candidate in request.candidates
    ]
    result = {
        "kind": request.purpose,
        "status": "metadata_reviewed"
        if any(
            row[purpose]["status"] == "audited_snapshot"
            for row in rows
            for purpose in ("monthly", "event")
        )
        else "not_ready",
        "parameters": request.model_dump(mode="json"),
        "evidence_kind": "coverage_metadata",
        "research_ready": False,
        "source": {
            "id": "explicit-frozen-p0-support",
            "version": request.method_version,
            "input_sha256": content_id(pack_payload),
        },
        "rows": rows,
        "strata": _strata(request, rows),
        "caveats": [
            "Frozen coverage metadata only; fishing hours, valid zero values and effect values are withheld.",
            "Missing or excluded observations are not evidence of zero activity or absence of an event.",
            "Monthly and event proofs are separate; a supplied anchor is not an independently verified event.",
            "Snapshot evidence does not verify present-source freshness or authorize scientific execution.",
        ],
    }
    result["result_id"] = content_id(result)
    return result
