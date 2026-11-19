"""Controlled monthly submission, qualification and frozen result reads."""

import calendar
import copy
import hashlib
import subprocess
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock, RLock
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from .analysis_support import (
    content_id,
    known_day_summary,
    known_period_summary,
    read_controlled_input,
)
from .config import Settings
from .monthly_capability import create_capability_router
from .monthly_distance_reference import (
    QualificationInputMismatch,
    calculate_distance_reference,
    distance_execution_environment,
    distance_execution_sources,
    read_distance_input,
)
from .monthly_evidence import render_monthly_evidence, zip_monthly_evidence
from .monthly_execution_qualification import qualify_execution
from .monthly_models import (
    KnownCircle,
    MonthlyDistanceRequest,
    MonthlyExample,
    MonthlyRequest,
    MonthlyResearchRequest,
)
from .owner_access import owner_requirement
from .published_months import PUBLISHED_PATH, create_published_router
from .schemas import BasicQueryEvidence
from .synthetic_cases import create_case_router
from .synthetic_runs import create_synthetic_run_router

EXAMPLE_PATH = Path(__file__).parent / "examples" / "monthly-known-units.json"
METHOD_VERSION = "monthly-known-support/v1"
PARAMETER_VERSION = "known-unit-membership/v1"
OPTIONAL_OWNER = HTTPBearer(auto_error=False)


def _calculate(request: MonthlyRequest, circle: KnownCircle, data, fingerprint):
    year, month = map(int, request.month.split("-"))
    count = calendar.monthrange(year, month)[1]
    by_date = {day.date: day for day in circle.days}
    daily = []
    for number in range(1, count + 1):
        iso = f"{request.month}-{number:02d}"
        daily.append(known_day_summary(iso, by_date.get(iso)))
    metrics = known_period_summary(daily)
    supported = [row for row in daily if row["hours"] is not None]
    hours, area_time = metrics["total_hours"], metrics["area_time_km2_days"]
    excluded = Counter(row["state"] for row in daily if row["hours"] is None)
    status = (
        "unavailable"
        if not supported
        else "partial"
        if excluded or any(row["excluded_units"] for row in daily)
        else "available"
    )
    result = {
        "kind": request.purpose,
        "status": status,
        "parameters": request.model_dump(),
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "source": {
            "id": data.id,
            "version": data.version,
            "input_sha256": fingerprint,
            "license": data.license,
            "support_evidence": data.support_evidence,
        },
        "metrics": metrics,
        "daily": daily,
        "units": {
            "total_hours": "fishing_hours",
            "area_time_km2_days": "km2*d",
            "mean_hours_per_supported_day": "fishing_hours/d",
            "density_hours_per_km2_day": "fishing_hours/(km2*d)",
        },
        "coverage": {
            "status": status,
            "support_scope": circle.support_scope,
            "requested_circle": {
                k: getattr(request, k) for k in ("longitude", "latitude", "radius_km")
            },
            "required_layers": ["fronts", "fishing_effort"],
            "excluded_day_states": dict(excluded),
            "excluded_units": sum(row["excluded_units"] for row in daily),
        },
        "evidence": [
            BasicQueryEvidence(
                id="known-support-H-E",
                label="Same-support numerator and denominator",
                value=f"H={hours}; E={area_time}; D={len(supported)}",
                detail="Only common valid front/activity units enter H/E; missing is not zero.",
                source_files=[data.id],
            ).model_dump()
        ],
        "caveats": [
            "Synthetic example only; not qualified real monthly research or fishery advice.",
            "Known unit membership/areas are declared for this circle, not computed GIS geometry.",
            "Known-support partial totals are not whole-circle totals; missing days are not filled.",
            "Apparent fishing effort is not catch, biomass, revenue or guaranteed fishing success.",
        ],
    }
    result["result_id"] = content_id(result)
    return result


def create_monthly_router(
    settings: Settings, *, example_path=EXAMPLE_PATH, record_limit=64, published_path=PUBLISHED_PATH
):
    if not isinstance(record_limit, int) or not 1 <= record_limit <= 256:
        raise ValueError("Invalid controlled record budget")
    router = APIRouter(prefix=f"{settings.api_prefix}/query/monthly-analysis")
    router.include_router(create_published_router(published_path), prefix="/published")
    router.include_router(
        create_capability_router(
            published_path, settings.support_snapshot_path, settings.support_state_path
        )
    )
    router.include_router(create_case_router(settings, published_path), prefix="/cases")
    router.include_router(
        create_synthetic_run_router(
            settings, example_path, _calculate, METHOD_VERSION, PARAMETER_VERSION
        )
    )
    records, reuse_index, lock = {}, {}, RLock()
    distance_lock = Lock()
    require_owner = owner_requirement(settings)

    def reserve(request):
        with lock:
            if len(records) >= record_limit:
                raise HTTPException(503, "Controlled capacity reached; existing results retained")
            run_id = uuid4().hex
            records[run_id] = {
                "id": run_id,
                "state": "running",
                "request": request.model_dump(exclude_none=True),
                "submitted_at": datetime.now(UTC).isoformat(),
                "state_history": ["submitted", "running"],
                "result": None,
                "error": None,
            }
            return run_id

    def finish(run_id, result=None, error=None, execution_id=None):
        with lock:
            record = records[run_id]
            record.update(
                state="failed" if error else "completed",
                result=result,
                error=error,
                finished_at=datetime.now(UTC).isoformat(),
            )
            record["state_history"].append(record["state"])
            if execution_id is not None:
                record.update(execution_id=execution_id, source_freshness="unknown")
                reuse_index[execution_id] = run_id
            return copy.deepcopy(record)

    @router.get("/examples")
    def examples():
        try:
            data, fingerprint = read_controlled_input(example_path, MonthlyExample)
        except (OSError, ValueError, ValidationError):
            raise HTTPException(503, "Registered synthetic example is unavailable") from None
        return {
            "purpose": "monthly_spatial_example",
            "evidence_kind": "synthetic_example",
            "research_ready": False,
            "input_version": data.version,
            "input_sha256": fingerprint,
            "method_version": METHOD_VERSION,
            "parameter_version": PARAMETER_VERSION,
            "conditions": [c.model_dump(exclude={"days"}) for c in data.conditions],
            "execution": "explicit owner-only; synchronous; bounded process-local records",
        }

    @router.post("", dependencies=[Depends(require_owner)])
    def submit(
        request: MonthlyRequest | MonthlyDistanceRequest | MonthlyResearchRequest,
        response: Response,
    ):
        if isinstance(request, (MonthlyDistanceRequest, MonthlyResearchRequest)):
            response.headers["Cache-Control"] = "no-store"
            qualification = (
                qualify_execution(settings, request) if request.support_snapshot_id else None
            )
            source = (
                settings.monthly_research_input_path
                if isinstance(request, MonthlyResearchRequest)
                else settings.monthly_distance_input_path
            )
            if source is None:
                raise HTTPException(503, "Registered distance reference is unavailable")
            if not distance_lock.acquire(blocking=False):
                raise HTTPException(409, "A controlled distance calculation is already running")
            try:
                run_id = None
                try:
                    coordinates = {key: getattr(request, key) or 0.0 for key in ("longitude", "latitude")}
                    request = request.model_copy(update=coordinates)
                    raw = read_distance_input(source)
                    sources = distance_execution_sources()
                    environment = distance_execution_environment(sources)
                    execution_id = content_id({
                        "request": request.model_dump(exclude_none=True),
                        "input_sha256": hashlib.sha256(raw).hexdigest(),
                        "qualification": qualification,
                        "environment": environment,
                    })
                    with lock:
                        if (previous := reuse_index.get(execution_id)) is not None:
                            return copy.deepcopy(records[previous])
                    run_id = reserve(request)
                    result = calculate_distance_reference(request, raw, sources, qualification)
                    if distance_execution_environment(sources) != environment:
                        return finish(run_id, error={"code": "distance_execution_environment_changed"})
                    result["versions"]["execution_id"] = execution_id
                    result["versions"]["direct_result_id"] = result.pop("result_id")
                    result["result_id"] = content_id(result)
                except QualificationInputMismatch:
                    return finish(
                        run_id or reserve(request),
                        error={"code": "qualification_input_or_conditions_mismatch"},
                    )
                except (
                    OSError, ValueError, TypeError, AttributeError, ImportError, subprocess.SubprocessError
                ):
                    return finish(
                        run_id or reserve(request),
                        error={"code": "distance_reference_unavailable_or_invalid"},
                    )
                return finish(run_id, result=result, execution_id=execution_id)
            finally:
                distance_lock.release()
        try:
            data, fingerprint = read_controlled_input(example_path, MonthlyExample)
        except (OSError, ValueError, ValidationError):
            return finish(reserve(request), error={"code": "input_unavailable_or_invalid"})
        if (
            request.input_version != data.version
            or request.method_version != METHOD_VERSION
            or request.parameter_version != PARAMETER_VERSION
        ):
            raise HTTPException(422, "Unsupported input, method or parameter version")
        circle = next(
            (
                c
                for c in data.conditions
                if all(
                    getattr(c, key) == getattr(request, key)
                    for key in ("longitude", "latitude", "radius_km", "month")
                )
            ),
            None,
        )
        if circle is None:
            raise HTTPException(422, "No registered synthetic support for requested circle/month")
        run_id = reserve(request)
        try:
            result = _calculate(request, circle, data, fingerprint)
        except (ArithmeticError, ValueError, TypeError):
            return finish(run_id, error={"code": "calculation_failed"})
        return finish(run_id, result=result)

    @router.get("/{run_id}")
    def read(
        run_id: str,
        response: Response,
        credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(OPTIONAL_OWNER)],
    ):
        with lock:
            if run_id not in records:
                raise HTTPException(404, "Run unavailable in this process; reads never restart it")
            if records[run_id]["request"]["purpose"] in {
                "monthly_distance_reference",
                "monthly_spatial_research",
            }:
                require_owner(credentials)
                response.headers["Cache-Control"] = "no-store"
            return copy.deepcopy(records[run_id])

    @router.get("/{run_id}/evidence", dependencies=[Depends(require_owner)])
    def evidence(run_id: str, format: Literal["html", "zip"] = "html"):
        headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
        with lock:
            record = records.get(run_id)
            if record is None:
                raise HTTPException(404, "Run unavailable in this process", headers=headers)
            if record["state"] != "completed":
                raise HTTPException(409, "Only completed runs have evidence", headers=headers)
            result = record["result"]
            if result["kind"] not in {"monthly_distance_reference", "monthly_spatial_research"}:
                raise HTTPException(409, "Distance evidence is unavailable for this run", headers=headers)
        if format == "zip" and result["evidence_kind"] != "synthetic":
            raise HTTPException(403, "An export license is required for this result", headers=headers)
        page, figure, daily, monthly = render_monthly_evidence(result)
        if format == "html":
            headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
            return Response(page, media_type="text/html", headers=headers)
        headers["Content-Disposition"] = 'attachment; filename="ocean-month-evidence.zip"'
        return Response(
            zip_monthly_evidence(result, page, figure, daily, monthly),
            media_type="application/zip",
            headers=headers,
        )

    return router
