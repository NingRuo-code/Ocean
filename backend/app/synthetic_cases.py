"""Owner-only software archive of verified public CC0 synthetic month reports."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import Field, field_validator, model_validator

from .analysis_support import content_id
from .case_chart import render_case_chart
from .case_export import case_filename, render_case_bundle, render_case_file
from .comparison_models import Identity
from .known_month_report import build_known_month_report
from .monthly_models import ClosedModel
from .owner_access import owner_requirement
from .owner_task_evidence import path_state
from .published_months import read_public_month
from .saved_case_store import CASE_SECTIONS, CaseStore, CaseStoreError


class CaseMetadata(ClosedModel):
    title: Annotated[str, Field(min_length=1, max_length=120)]
    tags: Annotated[list[Annotated[str, Field(min_length=1, max_length=40)]], Field(max_length=8)] = Field(default_factory=list)
    note: Annotated[str, Field(max_length=4000)] = ""

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        if not value.strip() or any(ord(c) < 32 for c in value):
            raise ValueError("Invalid title")
        return value.strip()

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values):
        if any(not v.strip() or any(ord(c) < 32 for c in v) for v in values):
            raise ValueError("Invalid tag")
        return list(dict.fromkeys(v.strip() for v in values))

    @field_validator("note")
    @classmethod
    def clean_note(cls, value):
        if any(ord(c) < 32 and c not in "\n\r\t" for c in value):
            raise ValueError("Invalid note")
        return value


class CaseCreate(CaseMetadata):
    result_id: Identity
    projection_id: Identity
    report_id: Identity
    intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]


class CaseReportBinding(ClosedModel):
    result_id: Identity
    projection_id: Identity
    report_id: Identity


class CaseCatalogQuery(ClosedModel):
    q: Annotated[str, Field(max_length=120)] = ""
    kind: Literal["monthly_spatial_example"] | None = None
    start_date: date | None = None
    end_date: date | None = None
    limit: Annotated[int, Field(ge=1, le=16)] | None = None
    offset: Annotated[int, Field(ge=0, le=64)] = 0
    catalog_id: Identity | None = None

    @model_validator(mode="after")
    def ordered_range(self):
        if self.start_date is not None and self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("Invalid case date range")
        if self.offset and (self.catalog_id is None or self.limit is None):
            raise ValueError("A page needs its catalog identity and limit")
        return self


class CaseUpdate(CaseMetadata):
    base_version: Annotated[int, Field(strict=True, ge=1, le=16)]
    base_version_id: Identity
    intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]
    report_binding: CaseReportBinding | None = None
    sections: Annotated[list[Literal["summary", "daily", "limits"]], Field(min_length=1, max_length=3)] | None = None

    @field_validator("sections")
    @classmethod
    def ordered_sections(cls, value):
        if value is None:
            return None
        if len(set(value)) != len(value):
            raise ValueError("Repeated report section")
        return [section for section in CASE_SECTIONS if section in value]


def create_case_router(settings, published_path):
    router = APIRouter(dependencies=[Depends(owner_requirement(settings))])
    store = CaseStore(settings.case_store_path)

    def guarded(work):
        try:
            return work()
        except CaseStoreError as error:
            code = str(error)
            status = 404 if code == "not_found" else 409 if code in {"intent_conflict", "capacity", "version_conflict", "no_changes"} else 503
            message = "protection unavailable" if code == "protection_unavailable" else (
                code if status != 503 else "store unavailable"
            )
            raise HTTPException(status, "Case " + message, headers={"Cache-Control": "no-store"}) from None

    def verified_report(binding):
        result = read_public_month(published_path, binding.result_id)
        report = build_known_month_report(result)
        if result["projection_id"] != binding.projection_id or report["report_id"] != binding.report_id:
            raise HTTPException(409, "Report changed; preview again", headers={"Cache-Control": "no-store"})
        return report

    @router.post("")
    def save(request: CaseCreate, response: Response):
        response.headers["Cache-Control"] = "no-store"
        fingerprint = content_id({"action": "create", **request.model_dump(exclude={"intent_id"})})
        replay = guarded(lambda: store.find_intent(request.intent_id, fingerprint))
        if replay:
            return replay
        report = verified_report(request)
        return guarded(lambda: store.create(request.intent_id, fingerprint, request.model_dump(include={"title", "tags", "note"}), report))

    @router.get("")
    def catalog(filters: Annotated[CaseCatalogQuery, Query()], response: Response):
        response.headers["Cache-Control"] = "no-store"
        scope = filters.model_dump(mode="json", include={"q", "kind", "start_date", "end_date"})
        values = guarded(lambda: store.catalog(**scope))
        identity = content_id({"scope": scope, "cases": values})
        if filters.catalog_id and filters.catalog_id != identity:
            raise HTTPException(409, "Case catalog changed", headers={"Cache-Control": "no-store"})
        end = filters.offset + (filters.limit or 64)
        return {
            "schema_version": "ocean-synthetic-case-catalog/v1", "cases": values[filters.offset:end],
            "total": len(values), "query": filters.q, "complete": end >= len(values), "catalog_id": identity,
            "offset": filters.offset, "next_offset": end if end < len(values) else None, "scope": scope,
        }

    @router.put("/{case_id}")
    def edit(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], request: CaseUpdate, response: Response):
        response.headers["Cache-Control"] = "no-store"
        fingerprint = content_id({"action": "update", "case_id": case_id,
                                  **request.model_dump(exclude={"intent_id"}, exclude_none=True)})
        replay = guarded(lambda: store.find_intent(request.intent_id, fingerprint))
        if replay:
            return replay
        report = verified_report(request.report_binding) if request.report_binding else None
        return guarded(lambda: store.update(
            case_id, request.base_version, request.base_version_id, request.intent_id, fingerprint,
            request.model_dump(include={"title", "tags", "note"}), report=report, sections=request.sections,
        ))

    @router.get("/{case_id}/versions")
    def versions(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        return {"schema_version": "ocean-synthetic-case-versions/v1", "case_id": case_id, "versions": guarded(lambda: store.versions(case_id))}

    def current_snapshot(record):
        physical = path_state(published_path)
        if physical != "present_unverified":
            return physical
        saved = record["report"]
        try:
            candidate = read_public_month(published_path, saved["result"]["result_id"])
        except HTTPException as exc:
            return "projection_missing" if exc.status_code in (403, 404) else "unknown"
        if (candidate["projection_id"] != saved["result"]["projection_id"]
                or build_known_month_report(candidate)["report_id"] != saved["report_id"]):
            return "projection_changed"
        return "present_verified"

    @router.get("/{case_id}")
    def read(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response,
             version: Annotated[int | None, Query(ge=1, le=16)] = None, include_source_status: bool = False):
        response.headers["Cache-Control"] = "no-store"
        record = guarded(lambda: store.read(case_id, version))
        if include_source_status:
            return {**record, "current_published_snapshot": current_snapshot(record)}
        return record

    @router.get("/{case_id}/versions/{version}/exports/{representation}")
    def export(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")],
               version: Annotated[int, Field(ge=1, le=16)],
               representation: Literal["markdown", "csv", "bundle", "chart"], version_id: Identity, report_id: Identity):
        case = guarded(lambda: store.read(case_id, version))
        if case["version_id"] != version_id or case["report"]["report_id"] != report_id:
            raise HTTPException(409, "Saved version identity mismatch", headers={"Cache-Control": "no-store"})
        try:
            body = render_case_chart(case) if representation == "chart" else render_case_bundle(case) if representation == "bundle" else render_case_file(case, representation)
        except (ValueError, KeyError, TypeError):
            raise HTTPException(503, "Saved report unavailable", headers={"Cache-Control": "no-store"}) from None
        extension, media = {"markdown": ("md", "text/markdown"), "csv": ("csv", "text/csv"), "bundle": ("zip", "application/zip"), "chart": ("chart-v1.svg", "image/svg+xml")}[representation]
        return Response(body, media_type=media, headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": f'attachment; filename="{case_filename(case, extension)}"'})

    return router
