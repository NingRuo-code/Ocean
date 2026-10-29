"""Owner-only software archive of verified public CC0 synthetic month reports."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field, field_validator

from .analysis_support import content_id
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


def create_case_router(settings, published_path):
    router = APIRouter(dependencies=[Depends(owner_requirement(settings))])
    store = CaseStore(settings.case_store_path)

    def guarded(work):
        try:
            return work()
        except CaseStoreError as error:
            code = str(error)
            status = 404 if code == "not_found" else 409 if code in {"intent_conflict", "capacity", "version_conflict"} else 503
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
    def catalog(response: Response):
        response.headers["Cache-Control"] = "no-store"
        return {"schema_version": "ocean-synthetic-case-catalog/v1", "cases": guarded(store.catalog)}

    @router.get("/{case_id}")
    def read(case_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store.read(case_id))

    return router
