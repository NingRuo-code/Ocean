"""Facts for the known-fixture compatibility contract, not real P0 qualification."""

from typing import Annotated, Literal

from pydantic import Field, model_validator

from .comparison_models import Identity
from .monthly_models import ClosedModel, Finite, NonNegative

Term = Annotated[str, Field(min_length=1, max_length=100)]


class MetricGroup(ClosedModel):
    id: Term
    lower: Finite | None = None
    upper: Finite | None = None
    unit: Term
    side: Term

    @model_validator(mode="after")
    def bounds(self):
        if self.lower is not None and self.upper is not None and self.lower >= self.upper:
            raise ValueError("Invalid group bounds")
        return self


class MetricDefinition(ClosedModel):
    quantity: Term
    estimand: Term
    weighting: Term
    groups: Annotated[list[MetricGroup], Field(max_length=16)]

    @model_validator(mode="after")
    def group_identity(self):
        if len({g.id for g in self.groups}) != len(self.groups):
            raise ValueError("Duplicate group identity")
        return self


class ComparisonFacts(ClosedModel):
    schema_version: Literal["ocean-known-comparison-facts/v1"] = Field(alias="schema")
    result_id: Identity
    snapshot_sha256: Identity
    source_state: Literal["completed", "running", "failed", "unprepared"]
    freshness: Literal["verified_frozen", "unknown", "stale"]
    product: Term
    processing: Term
    quality: Term
    day_boundary: Term
    geometry: Term
    grain: Term
    boundary_rule: Term
    sea_area_km2: NonNegative | None
    support_policy: Term
    control_ids: Annotated[list[Term], Field(max_length=32)]
    definitions: Annotated[dict[Term, object], Field(max_length=16)]
