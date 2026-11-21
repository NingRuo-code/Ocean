"""Read-only preview of a bounded, server-registered archive preparation request."""

import json
import os
import re
import subprocess
import sys
from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryFile
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, Field, field_validator, model_validator

from .analysis_support import content_id, decode_controlled_json, read_regular_bytes
from .comparison_models import Identity
from .config import PROJECT_ROOT
from .monthly_models import ClosedModel
from .owner_access import owner_requirement
from .owner_preparation_store import RECORD_LIMIT, PreparationStore, checked_artifact, task_status
from .owner_task_evidence import path_state, preparation_evidence
from .synthetic_run_store import RunStoreError

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


IntentId = Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]


class PreparationSubmission(ClosedModel):
    intent_id: IntentId
    plan_id: Identity
    request: PreparationRequest


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
    status: str | None = None

    @model_validator(mode="after")
    def ordered_coverage(self):
        if self.start is not None and self.end is not None and self.start > self.end:
            raise ValueError("Registered date coverage is out of order")
        return self


class SpatialCoverage(BaseModel):
    prototype_bbox: BBox | None = None

    @field_validator("prototype_bbox")
    @classmethod
    def ordered_box(cls, bbox):
        if bbox is not None and (bbox[0] >= bbox[2] or bbox[1] >= bbox[3]):
            raise ValueError("Registered regions require a bounded non-wrapping box")
        return bbox


class RegisteredSource(BaseModel):
    source_id: RegistryId
    source_type: RegistryId
    display_name: Annotated[str, Field(min_length=1, max_length=160)] | None = None
    credential_mode: str | None = None
    credential_env_var: str | None = None
    access_level: str | None = None
    authorization_scope: str | None = None
    license: str | None = None
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


class ArchiveMemberReceipt(BaseModel):
    date: date
    name: Annotated[str, Field(pattern=r"^[A-Za-z0-9_.-]{1,128}$")]
    status: Literal["matched", "missing", "invalid", "unreadable", "size_mismatch", "crc_mismatch"]
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")] | None = None


class ArchiveSourceReceipt(BaseModel):
    record: int
    members: Annotated[list[ArchiveMemberReceipt], Field(max_length=31)]

    @model_validator(mode="after")
    def unique_days(self):
        if len({row.date for row in self.members}) != len(self.members):
            raise ValueError("Duplicate archive members")
        return self


class ArchiveMemberCheck(BaseModel):
    schema_name: Literal["ocean-august-archive-member-check/v1"] = Field(alias="schema")
    month: Literal["2024-08"]
    catalog_sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    sources: Annotated[dict[str, ArchiveSourceReceipt], Field(max_length=8)]


class PreparationReceipt(ClosedModel):
    source_version: Identity
    archive_check: ArchiveMemberCheck
    connector_sha256: Identity
    processor_sha256: Identity
    license_evidence_id: Identity
    cost_evidence_id: Identity
    reusable_units: Annotated[list[ReusableUnit], Field(max_length=366)] = Field(default_factory=list)


class ArtifactManifest(BaseModel):
    schema_version: Literal["ocean-artifact-manifest/v1"]
    registry_id: Identity
    preparation_evidence: Annotated[dict[RegistryId, PreparationReceipt], Field(max_length=16)]


def front_archive_catalog():
    try:
        catalog_path = PROJECT_ROOT / "docs/data/august-2024-archive-members.json"
        data = decode_controlled_json(read_regular_bytes(catalog_path, REGISTRY_LIMIT), REGISTRY_LIMIT)
        canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
        front = data["sources"]["front"]
        days = {date.fromisoformat(f"{data['month']}-{member['day']:02}") for member in front["members"]}
        return sha256(canonical.encode("utf-8")).hexdigest(), front["record"], days
    except (OSError, KeyError, TypeError, ValueError):
        return None, None, set()


def archive_catalog_digest():
    return front_archive_catalog()[0]


def recorded_front_members(source, evidence, receipt):
    if (
        receipt is None or evidence is None or receipt.source_version != evidence.source_version
        or source.source_id != "zenodo_front_location" or source.source_type != "front"
        or receipt.source_version != "sha256:" + receipt.archive_check.catalog_sha256
    ):
        return None
    catalog_id, record, days = front_archive_catalog()
    archived = receipt.archive_check.sources.get("front")
    if catalog_id != receipt.archive_check.catalog_sha256 or archived is None or archived.record != record:
        return None
    matched = {
        member.date: member.sha256 for member in archived.members
        if member.status == "matched" and member.sha256 and member.date in days
        and member.name == f"front_location{member.date:%Y%m%d}.nc"
    }
    return days, matched


def authorized_for_preparation(source, evidence, receipt):
    return (
        evidence is not None and receipt is not None and evidence.license == "verified"
        and source.access_level == "public" and source.authorization_scope == "public_open_data"
        and source.license == "CC BY 4.0"
        and source.date_coverage.status not in {"not_authorized", "revoked", "blocked", "not_connected"}
    )


def adapter_fingerprints():
    def fingerprint(relative_path):
        return "sha256:" + sha256(read_regular_bytes(PROJECT_ROOT / relative_path, REGISTRY_LIMIT)).hexdigest()

    try:
        connector = fingerprint("backend/scripts/fetch_zenodo_front_samples.py")
        processing_sources = (
            "backend/app/frontend_payload.py", "backend/scripts/export_prototype_data.py",
            "tools/audit_daily_sources.py", "tools/prepare_owner_front_day.py", "tools/verify_august_archive_members.py",
        )
        processor = content_id({path: fingerprint(path) for path in processing_sources})
        return connector, processor
    except (OSError, ValueError):
        return None, None


def registered_scope(source, evidence):
    if evidence is not None:
        return evidence.regions, evidence.layers, evidence.purposes, evidence.targets
    bbox = source.spatial_coverage.prototype_bbox
    regions = {"prototype": bbox} if bbox is not None else {}
    layer = DEFAULT_LAYERS.get(source.source_type)
    return regions, [layer] if layer else [], ["map"], ["day_artifact"]


def preparation_reasons(source, evidence, receipt, archived, adapters):
    reasons = []
    if not authorized_for_preparation(source, evidence, receipt):
        reasons.append("authorization_unverified")
    if archived is None:
        reasons.append("archive_manifest_unverified")
    if receipt is None or (receipt.connector_sha256, receipt.processor_sha256) != adapters:
        reasons.append("adapter_unverified")
    environment_key = source.credential_env_var or ""
    if source.credential_mode not in {"none", "env_token", "server_secret"}:
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
    if (coverage.status in {"not_authorized", "revoked", "blocked", "not_connected"}
            or source.authorization_scope in {"not_authorized", "revoked", "blocked"}):
        reasons.append("authorization_blocked")
    if coverage.start is None or coverage.end is None:
        reasons.append("coverage_unknown")
    return reasons


def within_front_budget(bbox):
    west, south, east, north = bbox
    width, height = east - west, north - south
    return (
        -180 <= west < east <= 180 and -90 <= south < north <= 90
        and width <= 22 and height <= 22 and (width * 20 + 2) * (height * 20 + 2) <= 200_000
    )


def run_front_day(settings, expected, expires_at):
    command = [
        sys.executable, "-m", "tools.prepare_owner_front_day", str(settings.raw_data_dir.resolve()),
        expected["date"], expected["raw_sha256"], *map(str, expected["bbox"]),
        "--processor-id", expected["registration"]["processor_id"],
    ]
    remaining = (datetime.fromisoformat(expires_at) - datetime.now(UTC)).total_seconds() - 2
    if remaining <= 0:
        raise subprocess.TimeoutExpired(command, 0)
    # Resolve the app in the same checkout even if the service was launched from the backend directory.
    pythonpath = os.pathsep.join(filter(None, (str(PROJECT_ROOT / "backend"), os.environ.get("PYTHONPATH"))))
    with TemporaryFile() as output:
        subprocess.run(command, cwd=PROJECT_ROOT, stdout=output, stderr=subprocess.DEVNULL, check=True,
                       timeout=min(30, remaining), env={**os.environ, "PYTHONPATH": pythonpath})
        output.seek(0)
        result = decode_controlled_json(output.read(RECORD_LIMIT + 1), RECORD_LIMIT)
    worker_id = result.pop("artifact_id")
    if worker_id != content_id(result) or result.pop("processor_id") != expected["registration"]["processor_id"]:
        raise ValueError("Front processing returned a mismatched result")
    result["registration"] = expected["registration"]
    return {**result, "artifact_id": content_id(result)}


class PreparationRoute(APIRoute):
    def get_route_handler(self):
        existing = super().get_route_handler()

        async def handle(request):
            try:
                return await existing(request)
            except RequestValidationError:
                raise HTTPException(422, "Invalid registered archive request",
                                    headers={"Cache-Control": "no-store"}) from None

        return handle


def create_owner_preparation_router(settings):
    router = APIRouter(prefix="/data/owner-preparation", route_class=PreparationRoute,
                       dependencies=[Depends(owner_requirement(settings))])
    store = PreparationStore(settings.owner_preparation_store_path)
    analysis_paths = (settings.synthetic_run_store_path, settings.qualified_distance_run_store_path)
    if any(path is not None and store.path == Path(os.path.abspath(path)) for path in analysis_paths):
        store = PreparationStore(None)

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
        identity = "sha256:" + sha256(raw).hexdigest()
        manifest_path = settings.owner_preparation_manifest_path
        if not authoritative or manifest_path is None or manifest_path.name.endswith(".example.json"):
            return registry, identity, authoritative, {}, None
        try:
            manifest_raw = read_regular_bytes(manifest_path, REGISTRY_LIMIT)
            manifest = ArtifactManifest.model_validate(decode_controlled_json(manifest_raw, REGISTRY_LIMIT))
        except (OSError, TypeError, ValueError, ArithmeticError):
            return registry, identity, authoritative, {}, None
        if manifest.registry_id != identity:
            return registry, identity, authoritative, {}, None
        return registry, identity, authoritative, manifest.preparation_evidence, "sha256:" + sha256(manifest_raw).hexdigest()

    @router.get("/registry")
    def preparation_registry(response: Response):
        response.headers["Cache-Control"] = "no-store"
        registry, identity, authoritative, receipts, evidence_id = registry_snapshot()
        items = []
        adapters = adapter_fingerprints() if receipts else (None, None)
        for source in registry.sources:
            evidence = source.preparation if authoritative else None
            regions, layers, purposes, targets = registered_scope(source, evidence)
            receipt = receipts.get(source.source_id)
            archived = recorded_front_members(source, evidence, receipt)
            items.append({
                "source_id": source.source_id,
                "name": source.display_name or source.source_id,
                "date_coverage": source.date_coverage.model_dump(mode="json", include={"start", "end"}),
                "regions": list(regions),
                "layers": layers,
                "purposes": purposes,
                "targets": targets,
                "reasons": preparation_reasons(source, evidence, receipt, archived, adapters),
            })
        return {"schema_version": "ocean-owner-preparation-registry/v1", "registry_id": identity,
                "preparation_evidence_id": evidence_id, "sources": items}

    def build_preview(request, snapshot):
        registry, identity, authoritative, receipts, evidence_id = snapshot
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
        receipt = receipts.get(source.source_id)
        adapters = adapter_fingerprints() if receipt else (None, None)
        archived = recorded_front_members(source, evidence, receipt)
        reasons = preparation_reasons(source, evidence, receipt, archived, adapters)
        supported_scope = request.layers == ["front"] and request.purpose == "map" and request.target == "day_artifact"
        if not supported_scope:
            reasons.append("scope_adapter_unsupported")
        reusable = {}
        if supported_scope and archived is not None and authorized_for_preparation(source, evidence, receipt):
            catalog_days, _ = archived
            corroborated = {content_id(unit.model_dump(mode="json")) for unit in receipt.reusable_units}
            reusable = {
                (unit.date, unit.layer): unit.artifact_id for unit in evidence.reusable_units
                if unit.date in catalog_days and unit.region_id == request.region_id and unit.target == request.target
                and unit.source_version == evidence.source_version
                and content_id(unit.model_dump(mode="json")) in corroborated
            }
        days = [request.start_date + timedelta(days=offset)
                for offset in range((request.end_date - request.start_date).days + 1)]
        if archived is not None and any(
            day not in archived[1] and any((day, layer) not in reusable for layer in request.layers) for day in days
        ):
            reasons.append("archive_unit_evidence_unknown")
        units = []
        for day in days:
            for layer in request.layers:
                artifact_id = reusable.get((day, layer))
                units.append({
                    "date": day.isoformat(), "layer": layer,
                    "state": "reusable" if artifact_id else "blocked" if reasons else "to_prepare",
                    "artifact_id": artifact_id,
                })
        remaining = sum(unit["state"] == "to_prepare" for unit in units)
        bytes_per_unit = evidence.estimated_bytes_per_unit if evidence else None
        plan = {
            "schema_version": "ocean-owner-preparation-plan/v1",
            "registry_id": identity,
            "preparation_evidence_id": evidence_id,
            "request": request.model_dump(mode="json"),
            "source_version": evidence.source_version if evidence else None,
            "bbox": regions[request.region_id],
            "can_prepare": not reasons and remaining > 0,
            "execution_started": False,
            "estimated_preparation_bytes": bytes_per_unit * remaining if bytes_per_unit is not None and not reasons else None,
            "units": units,
            "reasons": reasons,
        }
        can_execute = (
            store.path is not None and plan["can_prepare"] and len(units) == 1
            and within_front_budget(plan["bbox"])
        )
        result = {**plan, "can_execute": can_execute}
        proof = None
        if can_execute:
            proof = {"date": request.start_date.isoformat(), "bbox": list(plan["bbox"]),
                     "raw_sha256": archived[1][request.start_date],
                     "registration": {"source_version": evidence.source_version, "processor_id": adapters[1],
                                      "region_id": request.region_id, "target": request.target}}
        return {**result, "plan_id": content_id(result)}, proof

    @router.post("/plan")
    def preview(request: PreparationRequest, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return build_preview(request, registry_snapshot())[0]

    def store_failure(exc):
        status = {"not_found": 404, "intent_conflict": 409, "busy": 429, "capacity": 503}.get(str(exc), 503)
        return HTTPException(status, "Private preparation task is unavailable",
                             headers={"Cache-Control": "no-store"})

    def execute(id_, request, plan_id, expected, expires_at):
        error = "processing_failed"
        try:
            if not store.transition(id_, "processing"):
                return
            artifact = run_front_day(settings, expected, expires_at)
            if not store.transition(id_, "validating"):
                return
            checked_artifact(artifact, expected)
            if not store.transition(id_, "registering"):
                return
            error = "evidence_changed"
            fresh, proof = build_preview(request, registry_snapshot())
            if fresh["plan_id"] == plan_id and proof == expected:
                error = "processing_failed"
                store.transition(id_, "ready", artifact=artifact)
                return
        except (RunStoreError, OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError, HTTPException):
            pass
        try:
            store.transition(id_, "failed", error=error)
        except RunStoreError:
            # An unavailable database leaves the accepted record bounded by its original lease.
            pass

    @router.post("/tasks", status_code=202)
    def submit(submission: PreparationSubmission, response: Response, background: BackgroundTasks):
        response.headers["Cache-Control"] = "no-store"
        body = submission.model_dump(mode="json")
        try:
            old = store.find(submission.intent_id, content_id(body))
            if old is not None:
                return task_status(old)
            snapshot, proof = build_preview(submission.request, registry_snapshot())
            if snapshot["plan_id"] != submission.plan_id or proof is None:
                raise HTTPException(409, "Preview no longer authorizes this one-day preparation",
                                    headers={"Cache-Control": "no-store"})
            record, created = store.accept(body, proof)
        except RunStoreError as exc:
            raise store_failure(exc) from None
        if created:
            background.add_task(execute, record["id"], submission.request, submission.plan_id, proof, record["expires_at"])
        return task_status(record)

    @router.get("/intents/{intent_id}")
    def read_intent(intent_id: IntentId, response: Response):
        response.headers["Cache-Control"] = "no-store"
        try:
            return task_status(store.read_intent(intent_id))
        except RunStoreError as exc:
            raise store_failure(exc) from None

    @router.get("/tasks/{task_id}")
    def read_task(task_id: IntentId, response: Response):
        response.headers["Cache-Control"] = "no-store"
        try:
            return task_status(store.read(task_id))
        except RunStoreError as exc:
            raise store_failure(exc) from None

    @router.get("/tasks/{task_id}/artifact")
    def read_artifact(task_id: IntentId, response: Response):
        response.headers["Cache-Control"] = "no-store"
        try:
            record = store.read(task_id)
        except RunStoreError as exc:
            raise store_failure(exc) from None
        try:
            physical, artifact = store.stored_artifact(record)
        except RunStoreError as exc:
            raise store_failure(exc) from None
        if physical != "stored":
            raise HTTPException(404, "Private preparation artifact is unavailable",
                                headers={"Cache-Control": "no-store"})
        return artifact

    @router.get("/tasks/{task_id}/evidence")
    def read_task_evidence(task_id: IntentId, response: Response):
        response.headers["Cache-Control"] = "no-store"
        try:
            record = store.read(task_id)
        except RunStoreError as exc:
            raise store_failure(exc) from None
        try:
            physical, _ = store.stored_artifact(record)
        except RunStoreError:
            physical = "unverified"
        day = date.fromisoformat(record["expected"]["date"])
        raw_path = settings.raw_data_dir / "front" / str(day.year) / f"front_location{day:%Y%m%d}.nc"
        return preparation_evidence(record, task_status(record), physical, path_state(raw_path))

    return router
