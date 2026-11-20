"""Owner-only adapter over the same small synthetic month calculation."""

import hashlib
from subprocess import SubprocessError
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field

from .analysis_support import content_id, read_controlled_input
from .comparison_models import Identity
from .monthly_distance_reference import (
    QualificationInputMismatch,
    calculate_distance_reference,
    distance_execution_environment,
    distance_execution_sources,
    read_distance_input,
)
from .monthly_execution_qualification import qualify_execution
from .monthly_models import ClosedModel, MonthlyDistanceRequest, MonthlyExample, MonthlyRequest
from .owner_access import owner_requirement
from .synthetic_run_export import render_run_file
from .synthetic_run_store import RunStore, RunStoreError


class OwnerSubmission(ClosedModel):
    intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]
    input_sha256: Identity
    request: MonthlyRequest | MonthlyDistanceRequest


def prepare_distance(settings, submission):
    request = submission.request
    if request.support_snapshot_id is None or request.input_version != submission.input_sha256:
        raise HTTPException(409, "Qualified distance identity required", headers={"Cache-Control": "no-store"})
    qualification = qualify_execution(settings, request)
    try:
        raw = read_distance_input(settings.monthly_distance_input_path)
        sources = distance_execution_sources()
        environment = distance_execution_environment(sources)
    except (OSError, ValueError, TypeError, AttributeError, ImportError):
        raise HTTPException(503, "Registered distance reference unavailable", headers={"Cache-Control": "no-store"}) from None
    if "sha256:" + hashlib.sha256(raw).hexdigest() != submission.input_sha256:
        raise HTTPException(409, "Registered distance input changed", headers={"Cache-Control": "no-store"})
    return qualification, raw, sources, environment


def create_synthetic_run_router(settings, example_path, calculate, method_version, parameter_version):
    router = APIRouter(prefix="/owner-runs", dependencies=[Depends(owner_requirement(settings))])
    store = RunStore(settings.synthetic_run_store_path)

    def guarded(work):
        try:
            return work()
        except RunStoreError as error:
            code = str(error)
            status = 404 if code == "not_found" else 409 if code in {"intent_conflict", "capacity"} else 503
            raise HTTPException(status, "Synthetic run " + (code if status != 503 else "store unavailable"), headers={"Cache-Control": "no-store"}) from None

    def input_snapshot():
        try:
            data, fingerprint = read_controlled_input(example_path, MonthlyExample)
            if data.license.partition(";")[0].strip() != "CC0-1.0":
                raise ValueError("Unsupported synthetic license")
            return data, fingerprint
        except (OSError, ValueError, TypeError, ArithmeticError):
            raise HTTPException(503, "Registered synthetic input unavailable", headers={"Cache-Control": "no-store"}) from None

    @router.get("/options")
    def options(response: Response):
        response.headers["Cache-Control"] = "no-store"
        guarded(store.check_available)
        data, fingerprint = input_snapshot()
        return {"schema_version": "ocean-owner-synthetic-options/v1", "input_sha256": fingerprint,
                "input_version": data.version, "method_version": method_version, "parameter_version": parameter_version,
                "conditions": [c.model_dump(exclude={"days"}) for c in data.conditions],
                "evidence_kind": "synthetic_example", "research_ready": False,
                "license": data.license, "execution": "synchronous_atomic_terminal_record"}

    @router.post("")
    def submit(submission: OwnerSubmission, response: Response):
        response.headers["Cache-Control"] = "no-store"
        body = submission.model_dump()
        old = guarded(lambda: store.find(submission.intent_id, content_id(body)))
        if old:
            return old
        if isinstance(submission.request, MonthlyDistanceRequest):
            prepared_distance = prepare_distance(settings, submission)
            qualification, raw, sources, _ = prepared_distance

            def check_distance():
                if prepare_distance(settings, submission) != prepared_distance:
                    raise HTTPException(409, "Registered distance evidence changed", headers={"Cache-Control": "no-store"})

            def execute_distance():
                check_distance()
                try:
                    result = calculate_distance_reference(submission.request, raw, sources, qualification)
                except QualificationInputMismatch:
                    raise HTTPException(409, "Distance input does not match qualification", headers={"Cache-Control": "no-store"}) from None
                except (OSError, ValueError, TypeError, ImportError, SubprocessError):
                    result = None
                check_distance()
                if result is None:
                    return None, {"code": "calculation_failed"}
                result["versions"]["direct_result_id"] = result.pop("result_id")
                result["result_id"] = content_id(result)
                return result, None

            return guarded(lambda: store.submit(body, execute_distance, qualification=qualification))

        def prepared():
            data, fingerprint = input_snapshot()
            request = submission.request
            if fingerprint != submission.input_sha256:
                raise HTTPException(409, "Synthetic input identity changed", headers={"Cache-Control": "no-store"})
            if (request.input_version != data.version or request.method_version != method_version
                    or request.parameter_version != parameter_version):
                raise HTTPException(422, "Unsupported synthetic versions", headers={"Cache-Control": "no-store"})
            circle = next((c for c in data.conditions if all(getattr(c, key) == getattr(request, key) for key in ("longitude", "latitude", "radius_km", "month"))), None)
            if circle is None:
                raise HTTPException(422, "No registered synthetic condition", headers={"Cache-Control": "no-store"})
            return data, fingerprint, circle

        prepared()

        def execute():
            data, fingerprint, circle = prepared()
            try:
                result, error = calculate(submission.request, circle, data, fingerprint), None
            except (ArithmeticError, ValueError, TypeError):
                result, error = None, {"code": "calculation_failed"}
            if input_snapshot()[1] != fingerprint:
                raise HTTPException(409, "Synthetic input changed before acceptance", headers={"Cache-Control": "no-store"})
            return result, error

        return guarded(lambda: store.submit(body, execute))

    @router.get("")
    def history(response: Response, purpose: Literal["monthly_spatial_example", "monthly_distance_reference"] = "monthly_spatial_example"):
        response.headers["Cache-Control"] = "no-store"
        return {"schema_version": "ocean-owner-synthetic-history/v1", "runs": guarded(lambda: store.catalog(purpose))}

    @router.get("/intents/{intent_id}")
    def read_intent(intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store.read_intent(intent_id))

    @router.get("/{run_id}")
    def read(run_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store.read(run_id))

    @router.get("/{run_id}/exports/{representation}")
    def export(run_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")],
               representation: Literal["markdown", "csv"], record_id: Identity, result_id: Identity):
        run = guarded(lambda: store.read(run_id))
        if (run["request"]["purpose"] != "monthly_spatial_example" or run["record_id"] != record_id
                or run["state"] != "completed" or run["result"]["result_id"] != result_id):
            raise HTTPException(409, "Completed synthetic record identity mismatch", headers={"Cache-Control": "no-store"})
        try:
            data = render_run_file(run, representation)
        except (ValueError, KeyError, TypeError, ArithmeticError, AttributeError):
            raise HTTPException(503, "Synthetic file unavailable", headers={"Cache-Control": "no-store"}) from None
        extension, media = {"markdown": ("md", "text/markdown"), "csv": ("csv", "text/csv")}[representation]
        filename = f"Ocean-run-{run_id}-{record_id[7:19]}.{extension}"
        return Response(data, media_type=media, headers={
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Ocean-Record-Id": record_id, "X-Ocean-Result-Id": result_id,
            "X-Content-Sha256": "sha256:" + hashlib.sha256(data).hexdigest(),
        })

    return router
