"""Read approved, already-frozen synthetic monthly aggregates; never submit an analysis."""

import calendar
import math
import re
from datetime import date
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import Field, model_validator

from .analysis_support import content_id, known_period_summary, read_controlled_input
from .comparison_models import KnownMetrics, SnapshotPack, SnapshotSource
from .known_month_report import build_known_month_report, render_report_file
from .monthly_models import ClosedModel, MonthlyRequest, NonNegative

PUBLISHED_PATH = Path(__file__).parent / "examples/regional-known-snapshots.json"
UNITS = {
    "total_hours": "fishing_hours",
    "area_time_km2_days": "km2*d",
    "mean_hours_per_supported_day": "fishing_hours/d",
    "density_hours_per_km2_day": "fishing_hours/(km2*d)",
}


class PublishedDay(ClosedModel):
    date: str
    state: Literal[
        "ready",
        "partial_support",
        "unprepared",
        "missing",
        "read_failed",
        "no_records",
        "unknown_support",
    ]
    hours: NonNegative | None
    effective_area_km2: NonNegative | None
    area_time_km2_days: NonNegative | None
    excluded_units: Annotated[int, Field(strict=True, ge=0, le=1000)]

    @model_validator(mode="after")
    def observed_support(self):
        if date.fromisoformat(self.date).isoformat() != self.date:
            raise ValueError("Noncanonical day")
        if self.state in {"ready", "partial_support"}:
            if (self.state == "ready") != (self.excluded_units == 0):
                raise ValueError("Invalid daily exclusion state")
            if (
                self.hours is None
                or self.effective_area_km2 is None
                or self.effective_area_km2 <= 0
                or self.area_time_km2_days != self.effective_area_km2
            ):
                raise ValueError("Invalid known daily support")
        elif any(
            v is not None for v in [self.hours, self.effective_area_km2, self.area_time_km2_days]
        ):
            raise ValueError("Unknown day cannot supply zero")
        return self


def _project(entry):
    raw = entry.result
    if (
        not re.fullmatch(r"sha256:[0-9a-f]{64}", raw["result_id"])
        or content_id(raw) != entry.snapshot_sha256
        or raw.get("kind") != "monthly_spatial_example"
        or raw.get("evidence_kind") != "synthetic_example"
        or raw.get("research_ready") is not False
        or raw.get("units") != UNITS
        or raw.get("intervals") is not None
    ):
        raise ValueError("Unsupported published contract")
    request = MonthlyRequest.model_validate(raw["parameters"])
    source = SnapshotSource.model_validate(raw["source"])
    metrics = KnownMetrics.model_validate(raw["metrics"])
    if (
        request.method_version != "monthly-known-support/v1"
        or request.parameter_version != "known-unit-membership/v1"
        or source.version != request.input_version
        or not source.license.startswith("CC0-1.0")
        or raw.get("status") not in {"available", "partial", "unavailable"}
        or raw.get("coverage", {}).get("support_scope")
        != "known_synthetic_units_for_declared_circle"
    ):
        raise ValueError("Unsupported published semantics")
    daily = [PublishedDay.model_validate(d).model_dump() for d in raw["daily"]]
    year, month = map(int, request.month.split("-"))
    count = calendar.monthrange(year, month)[1]
    expected_dates = [f"{request.month}-{day:02d}" for day in range(1, count + 1)]
    if [d["date"] for d in daily] != expected_dates:
        raise ValueError("Incomplete frozen calendar")
    expected = known_period_summary(daily)
    expected_status = (
        "unavailable"
        if metrics.supported_days == 0
        else "partial"
        if metrics.supported_days < count or any(d["excluded_units"] for d in daily)
        else "available"
    )
    if raw["status"] != expected_status:
        raise ValueError("Invalid published coverage status")
    for key, value in metrics.model_dump().items():
        reference = expected[key]
        if value is None or reference is None:
            if value != reference:
                raise ValueError("Inconsistent frozen support")
        elif not math.isclose(value, reference, rel_tol=1e-12, abs_tol=1e-12):
            raise ValueError("Inconsistent frozen metrics")
    notes = raw["caveats"]
    if (
        not isinstance(notes, list)
        or not 1 <= len(notes) <= 16
        or any(not isinstance(note, str) or not 1 <= len(note) <= 500 for note in notes)
    ):
        raise ValueError("Invalid published caveats")
    result = {
        "schema_version": "ocean-published-month/v1",
        "result_id": raw["result_id"],
        "kind": raw["kind"],
        "status": raw["status"],
        "parameters": request.model_dump(),
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "public_aggregate_allowed": True,
        "source": source.model_dump(),
        "metrics": metrics.model_dump(),
        "units": UNITS.copy(),
        "daily": daily,
        "intervals": None,
        "caveats": notes,
    }
    result["projection_id"] = content_id(result)
    return result


def project_public_month(entry):
    """Shared approved month projection for public reads and controlled G3 composition."""
    if entry.access != "public_aggregate" or entry.public_aggregate_allowed is not True:
        raise PermissionError("Source is not approved for public reading")
    return _project(entry)


def published_month_results(path=PUBLISHED_PATH):
    """Shared read/projection for the API and explicitly shipped offline public sample."""
    pack, _ = read_controlled_input(path, SnapshotPack)
    return [
        project_public_month(entry)
        for entry in pack.snapshots
        if entry.access == "public_aggregate"
        and entry.public_aggregate_allowed is True
        and entry.result.get("kind") == "monthly_spatial_example"
    ]


def published_month_reference(result):
    """Only the public identity/conditions needed for deliberate saved-result selection."""
    return {
        key: result[key]
        for key in [
            "result_id",
            "projection_id",
            "parameters",
            "evidence_kind",
            "research_ready",
            "public_aggregate_allowed",
            "source",
        ]
    }


def create_published_router(path=PUBLISHED_PATH):
    router = APIRouter()

    def read_pack():
        try:
            return read_controlled_input(path, SnapshotPack)[0]
        except (OSError, ValueError, TypeError):
            raise HTTPException(
                503, "Published monthly results unavailable", headers={"Cache-Control": "no-store"}
            ) from None

    def project(entry):
        try:
            return project_public_month(entry)
        except (ValueError, TypeError, KeyError, ArithmeticError, AttributeError):
            raise HTTPException(
                503,
                "Published monthly result cannot be verified",
                headers={"Cache-Control": "no-store"},
            ) from None

    @router.get("")
    def catalog(response: Response):
        response.headers["Cache-Control"] = "no-store"
        results = [
            project(entry)
            for entry in read_pack().snapshots
            if entry.access == "public_aggregate"
            and entry.public_aggregate_allowed is True
            and entry.result.get("kind") == "monthly_spatial_example"
        ]
        return {
            "schema_version": "ocean-published-month-catalog/v1",
            "results": [published_month_reference(result) for result in results],
        }

    @router.get("/{result_id}")
    def read(result_id: str, response: Response):
        response.headers["Cache-Control"] = "no-store"
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", result_id):
            raise HTTPException(
                404, "Published result unavailable", headers={"Cache-Control": "no-store"}
            )
        entry = next(
            (e for e in read_pack().snapshots if e.result.get("result_id") == result_id), None
        )
        if entry is None:
            raise HTTPException(
                404, "Published result unavailable", headers={"Cache-Control": "no-store"}
            )
        if entry.access != "public_aggregate" or entry.public_aggregate_allowed is not True:
            raise HTTPException(
                403, "Published source is not public", headers={"Cache-Control": "no-store"}
            )
        return project(entry)

    @router.get("/{result_id}/report")
    def report(
        result_id: str,
        response: Response,
        projection_id: Annotated[str, Query(pattern=r"^sha256:[0-9a-f]{64}$")],
    ):
        value = read(result_id, response)
        if value["projection_id"] != projection_id:
            raise HTTPException(
                409, "Published projection changed; read the result again",
                headers={"Cache-Control": "no-store"},
            )
        return build_known_month_report(value)

    @router.get("/{result_id}/report/{representation}")
    def download_report(
        result_id: str,
        representation: Literal["markdown", "csv"],
        response: Response,
        projection_id: Annotated[str, Query(pattern=r"^sha256:[0-9a-f]{64}$")],
        report_id: Annotated[str, Query(pattern=r"^sha256:[0-9a-f]{64}$")],
    ):
        value = report(result_id, response, projection_id)
        if value["report_id"] != report_id:
            raise HTTPException(
                409, "Report changed; read the preview again",
                headers={"Cache-Control": "no-store"},
            )
        result = value["result"]
        extension = "md" if representation == "markdown" else "csv"
        filename = f"Ocean-month-{result['parameters']['month']}-{result_id[7:19]}-{report_id[7:19]}.{extension}"
        return Response(
            render_report_file(value, representation),
            media_type="text/markdown" if representation == "markdown" else "text/csv",
            headers={"Cache-Control": "no-store", "Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return router
