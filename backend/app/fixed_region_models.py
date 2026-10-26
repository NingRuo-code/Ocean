"""Fixed-region synthetic event request and source contract; not real GIS qualification."""

from datetime import date
from typing import Annotated, Literal

from pydantic import Field, StrictBool, model_validator

from .monthly_models import ClosedModel, Finite, KnownDay, NonNegative


class FixedRegionRequest(ClosedModel):
    purpose: Literal["fixed_region_event_example"]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]
    radius_km: Literal[10, 20, 30]
    search_start: Annotated[str, Field(min_length=10, max_length=10)]
    search_end: Annotated[str, Field(min_length=10, max_length=10)]
    input_version: Annotated[str, Field(min_length=1, max_length=100)]
    method_version: Literal["observed-entry-example/v1"]
    parameter_version: Literal["fixed-support-windows/v1"]

    @model_validator(mode="after")
    def calendar_range(self):
        first, last = date.fromisoformat(self.search_start), date.fromisoformat(self.search_end)
        if first.isoformat() != self.search_start or last.isoformat() != self.search_end:
            raise ValueError("Noncanonical search dates")
        if not 1000 <= first.year <= last.year <= 2999 or not 0 <= (last - first).days <= 30:
            raise ValueError("Search period exceeds controlled scope")
        return self


class EventDay(KnownDay):
    front_present: StrictBool | None


class FixedSupportUnit(ClosedModel):
    id: Annotated[str, Field(min_length=1, max_length=100)]
    area_km2: NonNegative | None


class FixedCircle(ClosedModel):
    id: Annotated[str, Field(min_length=1, max_length=100)]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]
    radius_km: Literal[10, 20, 30]
    support_scope: Literal["known_synthetic_units_for_declared_circle"]
    fixed_support: Annotated[list[FixedSupportUnit], Field(min_length=1, max_length=1000)]
    days: Annotated[list[EventDay], Field(max_length=62)]

    @model_validator(mode="after")
    def unique_days(self):
        if len({d.date for d in self.days}) != len(self.days):
            raise ValueError("Duplicate date")
        if len({u.id for u in self.fixed_support}) != len(self.fixed_support):
            raise ValueError("Duplicate fixed support unit")
        return self


class FixedRegionInput(ClosedModel):
    schema_version: Literal["ocean-controlled-event-input/v1"] = Field(alias="schema")
    id: Annotated[str, Field(min_length=1, max_length=100)]
    version: Annotated[str, Field(min_length=1, max_length=100)]
    evidence_kind: Literal["synthetic_example"]
    license: Annotated[str, Field(min_length=1, max_length=500)]
    public_aggregate_allowed: Literal[True]
    research_ready: Literal[False]
    unit: Literal["fishing_hours"]
    support_evidence: Annotated[str, Field(min_length=1, max_length=500)]
    conditions: Annotated[list[FixedCircle], Field(min_length=1, max_length=16)]

    @model_validator(mode="after")
    def unique_regions(self):
        keys = {(c.longitude, c.latitude, c.radius_km) for c in self.conditions}
        if len(keys) != len(self.conditions) or len({c.id for c in self.conditions}) != len(keys):
            raise ValueError("Ambiguous fixed-region registration")
        return self
