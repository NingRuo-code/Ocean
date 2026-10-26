"""Controlled-month contracts, separate from actual research qualification."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Finite = Annotated[float, Field(strict=True, allow_inf_nan=False)]
NonNegative = Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)]
Month = Annotated[str, Field(pattern=r"^[12]\d{3}-(0[1-9]|1[0-2])$")]


class ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MonthlyRequest(ClosedModel):
    purpose: Literal["monthly_spatial_example"]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]
    radius_km: Literal[10, 20, 30]
    month: Month
    input_version: Annotated[str, Field(min_length=1, max_length=100)]
    method_version: Annotated[str, Field(min_length=1, max_length=100)]
    parameter_version: Annotated[str, Field(min_length=1, max_length=100)]


class KnownUnit(ClosedModel):
    id: Annotated[str, Field(min_length=1, max_length=100)]
    hours: NonNegative | None
    area_km2: NonNegative | None
    front_support: Literal["valid", "unknown", "missing"]
    effort_support: Literal["valid", "unknown", "missing"]


class KnownDay(ClosedModel):
    date: str
    state: Literal["ready", "missing", "unprepared", "read_failed"]
    units: Annotated[list[KnownUnit], Field(max_length=1000)]

    @model_validator(mode="after")
    def valid_day(self):
        if date.fromisoformat(self.date).isoformat() != self.date:
            raise ValueError("Noncanonical date")
        if len({u.id for u in self.units}) != len(self.units):
            raise ValueError("Duplicate spatial unit")
        if self.state != "ready" and self.units:
            raise ValueError("Unavailable day cannot contain observations")
        return self


class KnownCircle(ClosedModel):
    id: Annotated[str, Field(min_length=1, max_length=100)]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]
    radius_km: Literal[10, 20, 30]
    month: Month
    support_scope: Literal["known_synthetic_units_for_declared_circle"]
    days: Annotated[list[KnownDay], Field(max_length=31)]

    @model_validator(mode="after")
    def calendar_identity(self):
        if len({d.date for d in self.days}) != len(self.days):
            raise ValueError("Duplicate date")
        if any(d.date[:7] != self.month for d in self.days):
            raise ValueError("Observation belongs to another month")
        return self


class MonthlyExample(ClosedModel):
    schema_version: Literal["ocean-controlled-month-input/v1"] = Field(alias="schema")
    id: Annotated[str, Field(min_length=1, max_length=100)]
    version: Annotated[str, Field(min_length=1, max_length=100)]
    evidence_kind: Literal["synthetic_example"]
    license: Annotated[str, Field(min_length=1, max_length=500)]
    public_aggregate_allowed: Literal[True]
    research_ready: Literal[False]
    unit: Literal["fishing_hours"]
    support_evidence: Annotated[str, Field(min_length=1, max_length=500)]
    conditions: Annotated[list[KnownCircle], Field(min_length=1, max_length=16)]

    @model_validator(mode="after")
    def unique_conditions(self):
        keys = {(c.longitude, c.latitude, c.radius_km, c.month) for c in self.conditions}
        if len(keys) != len(self.conditions) or len({c.id for c in self.conditions}) != len(keys):
            raise ValueError("Ambiguous condition registration")
        return self
