"""Read-only preview of a bounded, server-registered archive preparation request."""

import os
import re
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator, model_validator

from .analysis_support import content_id, decode_controlled_json, read_regular_bytes
from .comparison_models import Identity
from .config import PROJECT_ROOT
from .monthly_models import ClosedModel
from .owner_access import owner_requirement

RegistryId = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9_.-]{0,63}$")]
Layer = Literal["front", "front_intensity", "sst", "effort"]
Purpose = Literal["map", "A_month", "B_event", "description"]
Target = Literal["day_artifact", "support_input"]
EvidenceState = Literal["verified", "unknown", "unavailable", "unsupported", "blocked"]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
BBox = tuple[Longitude, Latitude, Longitude, Latitude]
REGISTRY_LIMIT = 512 * 1024
EXAMPLE = PROJECT_ROOT / "server_data" / "sources" / "sources.example.json"
DEFAULT_LAYERS = {
    "front": "front",
    "front_intensity": "front_intensity",
    "sst": "sst",
    "gfw_ais_effort": "effort",
    "partner_ais_derivative": "effort",
}


class PreparationRequest(ClosedModel):
    source_id: RegistryId
    start_date: date
    end_date: date
    region_id: RegistryId
    layers: Annotated[list[Layer], Field(min_length=1, max_length=4)]
    purpose: Purpose
    target: Target

    @field_validator("layers")
    @classmethod
    def normalized_layers(cls, layers):
        if len(set(layers)) != len(layers):
            raise ValueError("Repeated requested layers")
        return sorted(layers)

    @model_validator(mode="after")
    def bounded_period(self):
        if not 0 <= (self.end_date - self.start_date).days < 31:
            raise ValueError("Select one to 31 explicit observation days")
        return self


class ReusableUnit(ClosedModel):
    date: date
    region_id: RegistryId
    layer: Layer
    target: Target
    source_version: Identity
    artifact_id: Identity


class PreparationEvidence(ClosedModel):
    source_version: Identity | None = None
    archive_access: EvidenceState = "unknown"
    credential_check: EvidenceState = "unknown"
    connector: EvidenceState = "unknown"
    processing: EvidenceState = "unknown"
    license: EvidenceState = "unknown"
    cost: EvidenceState = "unknown"
    regions: Annotated[dict[RegistryId, BBox], Field(max_length=16)]
    layers: Annotated[list[Layer], Field(max_length=4)]
    purposes: Annotated[list[Purpose], Field(max_length=4)]
    targets: Annotated[list[Target], Field(max_length=2)]
    estimated_bytes_per_unit: Annotated[int, Field(ge=0, le=10**12)] | None = None
    reusable_units: Annotated[list[ReusableUnit], Field(max_length=366)] = Field(default_factory=list)

    @model_validator(mode="after")
    def consistent_registration(self):
        if any(west >= east or south >= north for west, south, east, north in self.regions.values()):
            raise ValueError("Registered regions require a bounded non-wrapping box")
        keys = {(unit.date, unit.region_id, unit.layer, unit.target, unit.source_version) for unit in self.reusable_units}
        if len(keys) != len(self.reusable_units):
            raise ValueError("Duplicate registered units")
        if any(unit.region_id not in self.regions or unit.layer not in self.layers
               or unit.target not in self.targets for unit in self.reusable_units):
            raise ValueError("Unit outside its registration")
        return self


class DateCoverage(BaseModel):
    start: date | None = None
    end: date | None = None

    @model_validator(mode="after")
    def ordered_coverage(self):
        if self.start is not None and self.end is not None and self.start > self.end:
            raise ValueError("Registered date coverage is out of order")
        return self


class SpatialCoverage(BaseModel):
    prototype_bbox: BBox | None = None


class RegisteredSource(BaseModel):
    source_id: RegistryId
    source_type: RegistryId
    display_name: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    credential_mode: str | None = None
    credential_env_var: str | None = None
    date_coverage: DateCoverage = Field(default_factory=DateCoverage)
    spatial_coverage: SpatialCoverage = Field(default_factory=SpatialCoverage)
    preparation: PreparationEvidence | None = None


class SourceRegistry(BaseModel):
    schema_version: Literal["ocean-source-registry/v1"]
    sources: Annotated[list[RegisteredSource], Field(max_length=32)]

    @model_validator(mode="after")
    def unique_sources(self):
        if len({source.source_id for source in self.sources}) != len(self.sources):
            raise ValueError("Duplicate registered source")
        return self


def registered_scope(source, evidence):
    if evidence is not None:
        return evidence.regions, evidence.layers, evidence.purposes, evidence.targets
    bbox = source.spatial_coverage.prototype_bbox
    regions = {"prototype": bbox} if bbox is not None else {}
    layer = DEFAULT_LAYERS.get(source.source_type)
    return regions, [layer] if layer else [], ["map"], ["day_artifact"]


def preparation_reasons(source, evidence):
    reasons = []
    environment_key = source.credential_env_var or ""
    if source.credential_mode is None:
        reasons.append("credential_unknown")
    elif source.credential_mode != "none":
        if (
            not re.fullmatch(r"OCEAN_SOURCE_[A-Z0-9_]+_CREDENTIAL", environment_key)
            or not os.environ.get(environment_key, "").strip()
        ):
            reasons.append("credential_unavailable")
        elif evidence is None or evidence.credential_check != "verified":
            state = evidence.credential_check if evidence else "unknown"
            reasons.append(f"credential_check_{state}")
    if evidence is None or evidence.source_version is None:
        reasons.append("source_version_unknown")
    for field in ("archive_access", "connector", "processing", "license", "cost"):
        state = getattr(evidence, field) if evidence else "unknown"
        if state != "verified":
            reasons.append(f"{field}_{state}")
    coverage = source.date_coverage
    if coverage.start is None or coverage.end is None:
        reasons.append("coverage_unknown")
    return reasons


def create_owner_preparation_router(settings):
    router = APIRouter(prefix="/data/owner-preparation", dependencies=[Depends(owner_requirement(settings))])

    def registry_snapshot():
        configured = settings.owner_preparation_registry_path
        path = configured or EXAMPLE
        try:
            raw = read_regular_bytes(path, REGISTRY_LIMIT)
            registry = SourceRegistry.model_validate(decode_controlled_json(raw, REGISTRY_LIMIT))
        except (OSError, TypeError, ValueError, ArithmeticError):
            raise HTTPException(503, "Registered archive metadata is unavailable",
                                headers={"Cache-Control": "no-store"}) from None
        authoritative = configured is not None and not path.name.endswith(".example.json")
        return registry, content_id(registry.model_dump(mode="json")), authoritative

    @router.get("/registry")
    def preparation_registry(response: Response):
        response.headers["Cache-Control"] = "no-store"
        registry, identity, authoritative = registry_snapshot()
        items = []
        for source in registry.sources:
            evidence = source.preparation if authoritative else None
            regions, layers, purposes, targets = registered_scope(source, evidence)
            items.append({
                "source_id": source.source_id,
                "name": source.display_name or source.source_id,
                "date_coverage": source.date_coverage.model_dump(mode="json"),
                "regions": list(regions),
                "layers": layers,
                "purposes": purposes,
                "targets": targets,
                "reasons": preparation_reasons(source, evidence),
            })
        return {"schema_version": "ocean-owner-preparation-registry/v1", "registry_id": identity, "sources": items}

    @router.post("/plan")
    def preview(request: PreparationRequest, response: Response):
        response.headers["Cache-Control"] = "no-store"
        registry, identity, authoritative = registry_snapshot()
        source = next((item for item in registry.sources if item.source_id == request.source_id), None)
        if source is None:
            raise HTTPException(422, "Source is outside the registered archive scope",
                                headers={"Cache-Control": "no-store"})
        evidence = source.preparation if authoritative else None
        regions, layers, purposes, targets = registered_scope(source, evidence)
        coverage = source.date_coverage
        if (
            request.region_id not in regions or not set(request.layers).issubset(layers)
            or request.purpose not in purposes or request.target not in targets
            or (coverage.start is not None and request.start_date < coverage.start)
            or (coverage.end is not None and request.end_date > coverage.end)
        ):
            raise HTTPException(422, "Requested preparation is outside the registered archive scope",
                                headers={"Cache-Control": "no-store"})
        reasons = preparation_reasons(source, evidence)
        reusable = {
            (unit.date, unit.layer): unit.artifact_id for unit in evidence.reusable_units
            if unit.region_id == request.region_id and unit.target == request.target
            and unit.source_version == evidence.source_version
        } if not reasons and evidence else {}
        units = []
        for offset in range((request.end_date - request.start_date).days + 1):
            day = request.start_date + timedelta(days=offset)
            for layer in request.layers:
                artifact_id = reusable.get((day, layer))
                units.append({
                    "date": day.isoformat(), "layer": layer,
                    "state": "blocked" if reasons else "reusable" if artifact_id else "to_prepare",
                    "artifact_id": artifact_id,
                })
        remaining = sum(unit["state"] == "to_prepare" for unit in units)
        bytes_per_unit = evidence.estimated_bytes_per_unit if evidence else None
        plan = {
            "schema_version": "ocean-owner-preparation-plan/v1",
            "registry_id": identity,
            "request": request.model_dump(mode="json"),
            "source_version": evidence.source_version if evidence else None,
            "bbox": regions[request.region_id],
            "can_prepare": not reasons and remaining > 0,
            "execution_started": False,
            "estimated_preparation_bytes": bytes_per_unit * remaining if bytes_per_unit is not None and not reasons else None,
            "units": units,
            "reasons": reasons,
        }
        return {**plan, "plan_id": content_id(plan)}

    return router
