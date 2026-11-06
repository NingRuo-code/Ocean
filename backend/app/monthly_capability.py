"""Lightweight draft check: public result registry only, never audit, source scan or submit."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import Field, field_validator, model_validator

from .analysis_support import content_id
from .audited_support import read_audited_support
from .monthly_models import ClosedModel, Month
from .published_months import published_month_reference, published_month_results


class MonthlyDraft(ClosedModel):
    month: Month
    longitude: Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
    latitude: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
    radius_km: int
    scheme: Literal["monthly-main"] = "monthly-main"
    purpose: Literal["A_month", "B_event", "description", "map"] | None = None
    layer_use: Literal["front_effort", "front_effort_sst"] | None = None
    event_date: date | None = None

    @field_validator("event_date", mode="before")
    @classmethod
    def canonical_event_date(cls, value):
        if value is not None and (
            not isinstance(value, str) or date.fromisoformat(value).isoformat() != value
        ):
            raise ValueError("Event date must use YYYY-MM-DD")
        return value

    @model_validator(mode="after")
    def valid_event_conditions(self):
        if self.purpose == "B_event":
            if self.event_date is None or self.event_date.isoformat()[:7] != self.month:
                raise ValueError("Event date must belong to requested month")
        elif self.event_date is not None:
            raise ValueError("Event date requires event purpose")
        return self

    @field_validator("radius_km")
    @classmethod
    def registered_radius(cls, value):
        if value not in {10, 20, 30}:
            raise ValueError("Unsupported radius")
        return value


def create_capability_router(published_path, support_snapshot_path=None, support_state_path=None):
    router = APIRouter()

    @router.get("/capability")
    def check(request: Annotated[MonthlyDraft, Query()], response: Response):
        response.headers["Cache-Control"] = "no-store"
        try:
            results = published_month_results(published_path)
        except (OSError, ValueError, TypeError, KeyError, ArithmeticError, AttributeError):
            raise HTTPException(
                503, "Published support unavailable", headers={"Cache-Control": "no-store"}
            ) from None
        conditions = request.model_dump(mode="json", exclude_none=True)
        matches = [
            published_month_reference(result)
            for result in results
            if all(
                result["parameters"][key] == conditions[key]
                for key in ("month", "longitude", "latitude", "radius_km")
            )
        ]
        payload = {
            "schema_version": "ocean-month-capability/v1",
            "request": conditions,
            "request_id": content_id(conditions),
            "checked_at": datetime.now(UTC).isoformat(),
            "saved_results": matches,
            "qualification": {
                "status": "not_handed_off",
                "reason": "real_P0_month_qualification_not_integrated",
            },
            "execution": {
                "status": "not_implemented",
                "can_submit": False,
                "permission": "not_checked",
            },
            "versions": {"input": None, "method": None, "parameter": None, "qualification": None},
            "audited_support": read_audited_support(
                support_snapshot_path, conditions, support_state_path
            ),
        }
        if support_snapshot_path is not None:
            payload["qualification"]["reason"] = (
                "research_execution_not_handed_off; see audited_support for P0 audit"
            )
        payload["capability_id"] = content_id(payload)
        return payload

    return router
