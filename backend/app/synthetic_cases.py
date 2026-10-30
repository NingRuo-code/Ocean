"""Owner-only software archive of verified public CC0 synthetic month reports."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import Field, field_validator

from .analysis_support import content_id
from .case_export import case_filename, render_case_bundle, render_case_file
from .case_chart import render_case_chart
from .comparison_models import Identity
from .known_month_report import build_known_month_report
from .monthly_models import ClosedModel
from .owner_access import owner_requirement
from .published_months import read_public_month
from .saved_case_store import CaseStore, CaseStoreError


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


class CaseUpdate(CaseMetadata):
    base_version: Annotated[int, Field(strict=True, ge=1, le=16)]
    base_version_id: Identity
    intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]


def create_case_router(settings, published_path):
    router = APIRouter(dependencies=[Depends(owner_requirement(settings))])
    store = CaseStore(settings.case_store_path)

    def guarded(work):
        try:
            return work()
        except CaseStoreError as error:
            code = str(error)
            status = 404 if code == "not_found" else 409 if code in {"intent_conflict", "capacity", "version_conflict", "no_changes"} else 503
            raise HTTPException(status, "Case " + (code if status != 503 else "store unavailable"), headers={"Cache-Control": "no-store"}) from None

    @router.post("")
    def save(request: CaseCreate, response: Response):
        response.headers["Cache-Control"] = "no-store"
        fingerprint = content_id({"action": "create", **request.model_dump(exclude={"intent_id"})})
        replay = guarded(lambda: store.find_intent(request.intent_id, fingerprint))
        if replay:
            return replay
        result = read_public_month(published_path, request.result_id)
        report = build_known_month_report(result)
        if result["projection_id"] != request.projection_id or report["report_id"] != request.report_id:
            raise HTTPException(409, "Report changed; preview again", headers={"Cache-Control": "no-store"})
        return guarded(lambda: store.create(request.intent_id, fingerprint, request.model_dump(include={"title", "tags", "note"}), report))

    @router.get("")
    def catalog(response: Response, q: Annotated[str, Query(max_length=120)] = ""):
        response.headers["Cache-Control"] = "no-store"
        values = guarded(lambda: store.catalog(q))
        return {"schema_version": "ocean-synthetic-case-catalog/v1", "cases": values, "total": len(values), "query": q, "complete": True}

    @router.put("/{case_id}")
    def edit(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], request: CaseUpdate, response: Response):
        response.headers["Cache-Control"] = "no-store"
        fingerprint = content_id({"action": "update", "case_id": case_id, **request.model_dump(exclude={"intent_id"})})
        return guarded(lambda: store.update(case_id, request.base_version, request.base_version_id, request.intent_id, fingerprint, request.model_dump(include={"title", "tags", "note"})))

    @router.get("/{case_id}/versions")
    def versions(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        return {"schema_version": "ocean-synthetic-case-versions/v1", "case_id": case_id, "versions": guarded(lambda: store.versions(case_id))}

    @router.get("/{case_id}")
    def read(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response, version: Annotated[int | None, Query(ge=1, le=16)] = None):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store.read(case_id, version))

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
