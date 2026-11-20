"""Coverage-only G3 review of explicitly provided P0 qualification snapshots."""

from calendar import monthrange
from datetime import date as calendar_date
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from .analysis_support import content_id
from .audited_support import evidence_id, project_frozen_support, unavailable
from .comparison_models import Identity
from .g3_models import G3Region, Label, Seasons
from .monthly_models import ClosedModel, LayerUse, Month

ISODate = Annotated[str, Field(pattern=r"^[12]\d{3}-\d{2}-\d{2}$")]
ReviewYear = Annotated[int, Field(strict=True, ge=1000, le=2999)]


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
    years: Annotated[list[ReviewYear], Field(min_length=1, max_length=12)] | None = None
    layer_use: LayerUse
    seasons: Seasons
    regions: Annotated[list[G3Region], Field(min_length=1, max_length=8)]
    candidates: Annotated[list[ReviewCandidate], Field(min_length=1, max_length=24)]

    @model_validator(mode="after")
    def validate_partition(self):
        regions = {region.id for region in self.regions}
        months = [month for season in self.seasons.values() for month in season]
        candidate_ids = {candidate.id for candidate in self.candidates}
        years = set(self.years) if self.years is not None else None
        conditions = {
            (candidate.month, candidate.region_id, candidate.radius_km)
            for candidate in self.candidates
        }
        if (
            len(regions) != len(self.regions)
            or len(months) != len(set(months))
            or len(candidate_ids) != len(self.candidates)
            or len(conditions) != len(self.candidates)
            or (years is not None and len(years) != len(self.years))
        ):
            raise ValueError("Duplicate candidate or partition")
        for candidate in self.candidates:
            if (
                (years is not None and int(candidate.month[:4]) not in years)
                or candidate.region_id not in regions
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
    days = {day["date"]: _day_metadata(day) for day in audit["days"]}
    if conditions["purpose"] == "A_month":
        month = conditions["month"]
        count = monthrange(int(month[:4]), int(month[5:]))[1]
        dates = [f"{month}-{day:02d}" for day in range(1, count + 1)]
        period = audit["month"]
        if (
            set(days) != set(dates)
            or period["expected_days"] != count
            or period["included_days"] != sum(day["included"] for day in days.values())
        ):
            return unavailable("invalid_snapshot", "audit_daily_support_inconsistent")
        return {**metadata, "calendar": _period_metadata(period), "days": [days[d] for d in dates]}
    anchor = conditions["event_date"]
    window_dates = {anchor}
    for period in audit["windows"].values():
        dates = period["dates"]
        window_dates.update(dates)
        if not set(dates) <= days.keys() or period["included_days"] != sum(
            days[d]["included"] for d in dates
        ):
            return unavailable("invalid_snapshot", "audit_daily_support_inconsistent")
    if anchor not in days:
        return unavailable("invalid_snapshot", "audit_daily_support_inconsistent")
    windows = audit["windows"]
    event_gates = audit["event_data_gate_passed"]
    # The anchor has its own coverage record. Native P0 event eligibility
    # requires the pre-window and the corresponding post-window only.
    if any(
        event_gates[name]
        != (windows["pre7"]["data_gate_passed"] and windows[name]["data_gate_passed"])
        for name in ("post3", "post7")
    ):
        return unavailable("invalid_snapshot", "audit_event_gate_inconsistent")
    return {
        **metadata,
        "event_day": days[anchor],
        "window_days": [days[day] for day in sorted(window_dates)],
        "windows": {name: _period_metadata(period) for name, period in windows.items()},
        "event_data_gate_passed": event_gates,
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
            "identification_context": "not_evaluated",
        },
    }


def _strata(request, rows):
    strata = []
    years = request.years or {int(candidate.month[:4]) for candidate in request.candidates}
    for year in sorted(years):
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
    parameters = request.model_dump(
        mode="json", exclude={"years"} if request.years is None else None
    )
    result = {
        "kind": request.purpose,
        "status": "metadata_reviewed"
        if any(
            row[purpose]["status"] == "audited_snapshot"
            for row in rows
            for purpose in ("monthly", "event")
        )
        else "not_ready",
        "parameters": parameters,
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
