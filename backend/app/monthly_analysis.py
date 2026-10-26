"""Explicit synthetic-month adapter; no research qualification or background queue."""

import calendar
import copy
import hashlib
import json
import math
import secrets
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from .config import Settings
from .monthly_models import KnownCircle, MonthlyExample, MonthlyRequest
from .schemas import BasicQueryEvidence

EXAMPLE_PATH = Path(__file__).parent / "examples" / "monthly-known-units.json"
METHOD_VERSION = "monthly-known-support/v1"
PARAMETER_VERSION = "known-unit-membership/v1"


def _digest(value):
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("Duplicate JSON key")
        value[key] = item
    return value


def _read_example(path):
    with path.open("rb") as source:
        raw = source.read(1_048_577)
    if len(raw) > 1_048_576:
        raise ValueError("Example input exceeds budget")
    try:
        value = json.loads(raw, object_pairs_hook=_unique_object)
    except RecursionError:
        raise ValueError("Example input exceeds nesting budget") from None
    return MonthlyExample.model_validate(value), _digest(value)


def _calculate(request: MonthlyRequest, circle: KnownCircle, data, fingerprint):
    year, month = map(int, request.month.split("-"))
    count = calendar.monthrange(year, month)[1]
    by_date = {day.date: day for day in circle.days}
    daily = []
    for number in range(1, count + 1):
        iso = f"{request.month}-{number:02d}"
        day = by_date.get(iso)
        row = {
            "date": iso,
            "state": day.state if day else "unprepared",
            "hours": None,
            "effective_area_km2": None,
            "area_time_km2_days": None,
            "excluded_units": 0,
        }
        if day and day.state == "ready":
            valid = [
                u
                for u in day.units
                if u.front_support == "valid"
                and u.effort_support == "valid"
                and u.hours is not None
                and u.area_km2 is not None
                and u.area_km2 > 0
            ]
            row["excluded_units"] = len(day.units) - len(valid)
            if valid:
                hours, area = (
                    math.fsum(u.hours for u in valid),
                    math.fsum(u.area_km2 for u in valid),
                )
                row.update(
                    state="partial_support" if row["excluded_units"] else "ready",
                    hours=hours,
                    effective_area_km2=area,
                    area_time_km2_days=area,
                )
            else:
                row["state"] = "unknown_support" if day.units else "no_records"
        daily.append(row)
    supported = [row for row in daily if row["hours"] is not None]
    hours = math.fsum(row["hours"] for row in supported) if supported else None
    area_time = math.fsum(row["area_time_km2_days"] for row in supported) if supported else None
    metrics = {
        "total_hours": hours,
        "supported_days": len(supported),
        "calendar_days": count,
        "area_time_km2_days": area_time,
        "mean_hours_per_supported_day": hours / len(supported) if supported else None,
        "density_hours_per_km2_day": hours / area_time if supported else None,
    }
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
    result["result_id"] = _digest(result)
    return result


def create_monthly_router(settings: Settings, *, example_path=EXAMPLE_PATH, record_limit=64):
    if not isinstance(record_limit, int) or not 1 <= record_limit <= 256:
        raise ValueError("Invalid controlled record budget")
    router = APIRouter(prefix=f"{settings.api_prefix}/query/monthly-analysis")
    records, lock = {}, RLock()
    bearer = HTTPBearer(auto_error=False)

    owner_credentials = Depends(bearer)

    def require_owner(credentials: HTTPAuthorizationCredentials | None = owner_credentials):
        token = settings.monthly_execution_token
        if not token or not token.get_secret_value():
            raise HTTPException(503, "Controlled execution is disabled")
        if not credentials or not secrets.compare_digest(
            credentials.credentials.encode("utf-8"), token.get_secret_value().encode("utf-8")
        ):
            raise HTTPException(
                401, "Owner authorization is required", headers={"WWW-Authenticate": "Bearer"}
            )

    def reserve(request):
        with lock:
            if len(records) >= record_limit:
                raise HTTPException(503, "Controlled capacity reached; existing results retained")
            run_id = uuid4().hex
            records[run_id] = {
                "id": run_id,
                "state": "running",
                "request": request.model_dump(),
                "submitted_at": datetime.now(UTC).isoformat(),
                "state_history": ["submitted", "running"],
                "result": None,
                "error": None,
            }
            return run_id

    def finish(run_id, result=None, error=None):
        with lock:
            record = records[run_id]
            record.update(
                state="failed" if error else "completed",
                result=result,
                error=error,
                finished_at=datetime.now(UTC).isoformat(),
            )
            record["state_history"].append(record["state"])
            return copy.deepcopy(record)

    @router.get("/examples")
    def examples():
        try:
            data, fingerprint = _read_example(example_path)
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
    def submit(request: MonthlyRequest):
        try:
            data, fingerprint = _read_example(example_path)
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
    def read(run_id: str):
        with lock:
            if run_id not in records:
                raise HTTPException(404, "Run unavailable in this process; reads never restart it")
            return copy.deepcopy(records[run_id])

    return router
