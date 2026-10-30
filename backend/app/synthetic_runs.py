"""Owner-only adapter over the same small synthetic month calculation."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field

from .analysis_support import content_id, read_controlled_input
from .comparison_models import Identity
from .monthly_models import ClosedModel, MonthlyExample, MonthlyRequest
from .owner_access import owner_requirement
from .synthetic_run_store import RunStore, RunStoreError


class SyntheticSubmission(ClosedModel):
    intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]
    input_sha256: Identity
    request: MonthlyRequest


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
            if not data.license.startswith("CC0-1.0"):
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
    def submit(submission: SyntheticSubmission, response: Response):
        response.headers["Cache-Control"] = "no-store"
        body = submission.model_dump()
        old = guarded(lambda: store.find(submission.intent_id, content_id(body)))
        if old:
            return old

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

    @router.get("/{run_id}")
    def read(run_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store.read(run_id))

    return router
