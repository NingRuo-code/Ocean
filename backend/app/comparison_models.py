"""Bounded requests for reading existing, explicitly public synthetic snapshots."""

from datetime import date
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .fixed_region_models import FixedRegionRequest
from .monthly_models import ClosedModel, Finite, Month, NonNegative

Identity = Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]
Text = Annotated[str, Field(min_length=1, max_length=500)]


class SnapshotSource(ClosedModel):
    id: Text
    version: Text
    input_sha256: Identity
    license: Text
    support_evidence: Text


class RegionCandidate(ClosedModel):
    id: Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
    name: Annotated[str, Field(min_length=1, max_length=80)]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]
    result_id: Identity
    snapshot_sha256: Identity
    source: SnapshotSource

    @model_validator(mode="after")
    def readable_name(self):
        if not self.name.strip() or any(ord(c) < 32 for c in self.name):
            raise ValueError("Invalid region label")
        return self


class ComparisonRequest(ClosedModel):
    purpose: Literal["regional_comparison_example"]
    analysis_kind: Literal["monthly_spatial_example", "fixed_region_event_example"]
    radius_km: Literal[10, 20, 30]
    month: Month | None = None
    search_start: Annotated[str, Field(min_length=10, max_length=10)] | None = None
    search_end: Annotated[str, Field(min_length=10, max_length=10)] | None = None
    evidence_use: Literal["descriptive_side_by_side"]
    support_policy: Literal["read_existing_support"]
    method_version: Literal["known-snapshots/v1"]
    candidates: Annotated[list[RegionCandidate], Field(min_length=2, max_length=8)]

    @model_validator(mode="after")
    def distinct_regions(self):
        if self.analysis_kind == "monthly_spatial_example":
            if self.month is None or self.search_start is not None or self.search_end is not None:
                raise ValueError("Monthly evidence requires only a month")
        else:
            if self.month is not None or self.search_start is None or self.search_end is None:
                raise ValueError("Event evidence requires only a search period")
            FixedRegionRequest.model_validate(
                {
                    "purpose": self.analysis_kind,
                    "longitude": 0.0,
                    "latitude": 0.0,
                    "radius_km": self.radius_km,
                    "search_start": self.search_start,
                    "search_end": self.search_end,
                    "input_version": "validation-only",
                    "method_version": "observed-entry-example/v1",
                    "parameter_version": "fixed-support-windows/v1",
                }
            )
        points = {
            (0 if abs(c.latitude) == 90 else (c.longitude + 180) % 360, c.latitude)
            for c in self.candidates
        }
        if len(points) != len(self.candidates):
            raise ValueError("Duplicate circle; a label is not a second region")
        if len({c.id for c in self.candidates}) != len(self.candidates):
            raise ValueError("Duplicate stable candidate ID")
        return self


class ExistingChange(ClosedModel):
    absolute_density_change: Finite | None
    relative_density_change_percent: Finite | None
    reason: Text | None


class KnownMetrics(ClosedModel):
    total_hours: NonNegative | None
    area_time_km2_days: NonNegative | None
    supported_days: Annotated[int, Field(strict=True, ge=0, le=366)]
    calendar_days: Annotated[int, Field(strict=True, ge=1, le=366)]
    mean_hours_per_supported_day: NonNegative | None
    density_hours_per_km2_day: NonNegative | None

    @model_validator(mode="after")
    def support_bounds(self):
        if self.supported_days > self.calendar_days:
            raise ValueError("Invalid source support")
        numbers = [
            self.total_hours,
            self.area_time_km2_days,
            self.mean_hours_per_supported_day,
            self.density_hours_per_km2_day,
        ]
        if self.supported_days == 0 and any(value is not None for value in numbers):
            raise ValueError("Unknown support cannot supply zero metrics")
        if self.supported_days and (
            any(value is None for value in numbers) or self.area_time_km2_days <= 0
        ):
            raise ValueError("Known metrics require positive area-time support")
        return self


class ExistingWindow(KnownMetrics):
    status: Literal["complete", "incomplete", "unavailable"]
    start_date: str
    end_date: str
    relative_days: Annotated[
        list[Annotated[int, Field(strict=True)]], Field(min_length=2, max_length=2)
    ]
    dates: Annotated[list[str], Field(min_length=1, max_length=7)]
    excluded_day_states: dict[
        Literal[
            "missing",
            "unprepared",
            "read_failed",
            "no_records",
            "unknown_support",
            "partial_support",
            "front_observation_unknown",
            "fixed_support_unverified_or_changed",
        ],
        Annotated[int, Field(strict=True, ge=1, le=7)],
    ]

    @model_validator(mode="after")
    def canonical_dates(self):
        for iso in [self.start_date, self.end_date, *self.dates]:
            if date.fromisoformat(iso).isoformat() != iso:
                raise ValueError("Noncanonical window date")
        if (
            self.dates[0] != self.start_date
            or self.dates[-1] != self.end_date
            or len(self.dates) != self.calendar_days
            or len(set(self.dates)) != len(self.dates)
        ):
            raise ValueError("Inconsistent existing window dates")
        if self.status == "complete" and self.supported_days != self.calendar_days:
            raise ValueError("Incomplete support cannot be complete")
        if sum(self.excluded_day_states.values()) != self.calendar_days - self.supported_days:
            raise ValueError("Exclusion counts must match supported days")
        if (self.status == "unavailable") != (self.supported_days == 0):
            raise ValueError("Unavailable window cannot supply supported days")
        return self


class ExistingEvent(ClosedModel):
    anchor_date: str
    meaning: Literal["first confirmed observed entry"]

    @model_validator(mode="after")
    def canonical_anchor(self):
        if date.fromisoformat(self.anchor_date).isoformat() != self.anchor_date:
            raise ValueError("Noncanonical anchor")
        return self


class SnapshotEntry(ClosedModel):
    access: Literal["public_aggregate", "owner_only", "unknown"]
    public_aggregate_allowed: Annotated[bool, Field(strict=True)]
    snapshot_sha256: Identity
    result: dict


class SnapshotPack(ClosedModel):
    schema_version: Literal["ocean-controlled-comparison-snapshots/v1"] = Field(alias="schema")
    snapshots: Annotated[list[SnapshotEntry], Field(max_length=16)]

    @model_validator(mode="after")
    def unambiguous_ids(self):
        ids = [entry.result.get("result_id") for entry in self.snapshots]
        if any(not isinstance(identity, str) for identity in ids) or len(set(ids)) != len(ids):
            raise ValueError("Ambiguous snapshot registration")
        return self
