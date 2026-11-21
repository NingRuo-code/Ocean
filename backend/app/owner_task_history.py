"""Bounded owner-history projection over the existing terminal run records."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .analysis_support import content_id
from .comparison_models import Identity
from .monthly_models import ClosedModel

OwnerPurpose = Literal["monthly_spatial_example", "monthly_distance_reference"]
HistoryStatus = Literal["completed", "failed", "cancelled", "interrupted"]


class OwnerHistoryQuery(ClosedModel):
    purpose: OwnerPurpose | None = None
    status: HistoryStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    limit: Annotated[int, Field(ge=1, le=16)] = 8
    offset: Annotated[int, Field(ge=0, le=128)] = 0
    history_id: Identity | None = None

    @model_validator(mode="after")
    def valid_filters(self):
        if self.start_date is not None and self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("Start date must not follow end date")
        if self.offset and not self.history_id:
            raise ValueError("A history identity is required after the first page")
        return self


def catalog_time(value):
    if not isinstance(value, str):
        return None
    try:
        instant = datetime.fromisoformat(value)
        return instant.astimezone(UTC) if instant.tzinfo is not None else None
    except (ValueError, OverflowError):
        return None


def catalog_status(record):
    if record.get("cancelled") is True:
        return "cancelled"
    if record.get("failure_reason") in ("execution_evidence_changed", "execution_timed_out"):
        return "interrupted"
    return record["state"]


def owner_history_page(catalogs, filters):
    matches = []
    earliest = datetime.min.replace(tzinfo=UTC)
    for purpose, records in catalogs:
        for record in records:
            status = catalog_status(record)
            if filters.status is not None and status != filters.status:
                continue
            submitted = catalog_time(record.get("submitted_at"))
            if filters.start_date is not None and (submitted is None or submitted.date() < filters.start_date):
                continue
            if filters.end_date is not None and (submitted is None or submitted.date() > filters.end_date):
                continue
            finished = catalog_time(record.get("finished_at"))
            matches.append((submitted or earliest, purpose, {
                **record,
                "status": status,
                "submitted_at": submitted.isoformat() if submitted else None,
                "finished_at": finished.isoformat() if finished else None,
            }))
    matches.sort(key=lambda item: (item[0], item[1], item[2]["id"]), reverse=True)
    end = filters.offset + filters.limit
    return {
        "schema_version": "ocean-owner-task-history/v1",
        "history_id": content_id([record["record_id"] for _, _, record in matches]),
        "runs": [record for _, _, record in matches[filters.offset:end]],
        "total": len(matches),
        "next_offset": end if end < len(matches) else None,
        "filters": filters.model_dump(mode="json"),
    }
