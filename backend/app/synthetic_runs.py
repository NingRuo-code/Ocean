"""Owner-only adapter over the same small synthetic month calculation."""

import hashlib
from asyncio import Task, create_task, shield
from dataclasses import dataclass
from subprocess import SubprocessError, TimeoutExpired
from typing import Annotated, Literal, get_args

from anyio import CapacityLimiter, Semaphore, WouldBlock, to_thread
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import Field

from .analysis_support import content_id, decode_controlled_json, read_controlled_input
from .audited_support import snapshot_digest
from .comparison_models import Identity
from .monthly_capability import MonthlyDraft
from .monthly_distance_process import DistanceExecutionCancelled, DistanceRunControl
from .monthly_distance_reference import (
    MAX_INPUT_BYTES,
    QualificationInputMismatch,
    calculate_distance_reference,
    distance_execution_environment,
    distance_execution_sources,
    read_distance_input,
)
from .monthly_execution_qualification import (
    qualify_execution,
    qualify_support,
    read_execution_support,
)
from .monthly_models import (
    ClosedModel,
    DistanceMethod,
    DistanceParameters,
    MonthlyDistanceRequest,
    MonthlyExample,
    MonthlyRequest,
)
from .owner_access import owner_requirement
from .synthetic_run_export import render_run_file
from .synthetic_run_store import RunStore, RunStoreError

OwnerPurpose = Literal["monthly_spatial_example", "monthly_distance_reference"]


class OwnerSubmission(ClosedModel):
    intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]
    input_sha256: Identity
    request: MonthlyRequest | MonthlyDistanceRequest


def registered_distance_material(settings):
    try:
        raw = read_distance_input(settings.monthly_distance_input_path)
        sources = distance_execution_sources()
        environment = distance_execution_environment(sources)
    except (OSError, ValueError, TypeError, AttributeError, ImportError):
        raise HTTPException(503, "Registered distance reference unavailable", headers={"Cache-Control": "no-store"}) from None
    return raw, sources, environment


def prepare_distance(settings, submission):
    request = submission.request
    if request.support_snapshot_id is None or request.input_version != submission.input_sha256:
        raise HTTPException(409, "Qualified distance identity required", headers={"Cache-Control": "no-store"})
    qualification = qualify_execution(settings, request)
    raw, sources, environment = registered_distance_material(settings)
    if "sha256:" + hashlib.sha256(raw).hexdigest() != submission.input_sha256:
        raise HTTPException(409, "Registered distance input changed", headers={"Cache-Control": "no-store"})
    return qualification, raw, sources, environment


def check_distance_candidate(raw, support, environment):
    try:
        data = decode_controlled_json(raw, MAX_INPUT_BYTES)
        conditions = data["conditions"]
        versions = support["versions"]
        packages = environment["packages"]
        proj, geos = environment["geometry_runtime"]
        matches = (
            data["schema"] == "ocean-month-distance-input/v1"
            and len(conditions["geometries"]) == 1
            and content_id(conditions) == versions["declared_conditions_id"]
            and snapshot_digest(data["regional_cells"]) == versions["input_sha256"]
            and versions["geometry_runtime"] == {
                "shapely": packages["shapely"], "pyproj": packages["pyproj"], "GEOS": geos, "PROJ": proj,
            }
            and all(
                versions[key] == "sha256:" + environment["engines"][name]
                for key, name in (
                    ("auditor_sha256", "audit_support_qualification.py"),
                    ("regional_engine_sha256", "audit_regional_support.py"),
                    ("source_reader_sha256", "audit_daily_sources.py"),
                )
            )
        )
    except (ValueError, TypeError, KeyError, AttributeError):
        matches = False
    if not matches:
        raise HTTPException(409, "Registered distance input does not match the current P0 snapshot",
                            headers={"Cache-Control": "no-store"})


@dataclass(frozen=True)
class ActiveDistanceRun:
    submission_id: str
    control: DistanceRunControl
    task: Task


def create_synthetic_run_router(settings, example_path, calculate, method_version, parameter_version):
    router = APIRouter(prefix="/owner-runs", dependencies=[Depends(owner_requirement(settings))])
    store = RunStore(settings.synthetic_run_store_path)
    # Keep distance work off the shared HTTP workers without queuing excess requests.
    distance_workers = CapacityLimiter(2)
    distance_slots = Semaphore(distance_workers.total_tokens)
    distance_store = RunStore(settings.qualified_distance_run_store_path, qualified_distance=True)
    if distance_store.path == store.path:
        distance_store = RunStore(None, qualified_distance=True)

    active_distance_work = set()
    active_distance_runs = {}

    def distance_rejection(status, detail, headers=None):
        return HTTPException(status, detail, headers={
            **(headers or {}),
            "Cache-Control": "no-store",
            "X-Ocean-Submission-State": "rejected",
        })

    def release_distance_work(task, intent_id):
        if intent_id is not None:
            active_distance_runs.pop(intent_id)
        active_distance_work.discard(task)
        distance_slots.release()
        if not task.cancelled():
            task.exception()

    async def run_distance_work(work, *args, replay_if_busy=None, submission_key=None):
        intent_id, fingerprint = submission_key if submission_key else (None, None)
        running = active_distance_runs.get(intent_id)
        if running is not None:
            if running.submission_id != fingerprint:
                raise HTTPException(409, "Synthetic run intent_conflict", headers={"Cache-Control": "no-store"})
            return await shield(running.task)
        try:
            distance_slots.acquire_nowait()
        except WouldBlock:
            if replay_if_busy is not None:
                previous = await to_thread.run_sync(replay_if_busy, *args)
                if previous is not None:
                    return previous
                raise distance_rejection(503, "Qualified distance request capacity is busy",
                                         {"Retry-After": "1"}) from None
            raise HTTPException(
                503,
                "Qualified distance request capacity is busy",
                headers={"Cache-Control": "no-store", "Retry-After": "1"},
            ) from None
        # The slot and cancellation state belong to the worker even if its caller stops waiting.
        control = None
        if intent_id is not None:
            control = DistanceRunControl()
            args = (*args, control)
        task = create_task(to_thread.run_sync(work, *args, limiter=distance_workers))
        active_distance_work.add(task)
        if control is not None:
            active_distance_runs[intent_id] = ActiveDistanceRun(fingerprint, control, task)
        task.add_done_callback(lambda finished: release_distance_work(finished, intent_id))
        return await shield(task)

    def store_for(purpose):
        return distance_store if purpose == "monthly_distance_reference" else store

    def guarded(work, *, distance_submission=False):
        try:
            return work()
        except RunStoreError as error:
            code = str(error)
            if distance_submission and code == "capacity":
                raise distance_rejection(409, "Synthetic run capacity") from None
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

    def distance_candidate(draft):
        guarded(distance_store.check_available)
        draft = draft.model_copy(update={"layer_use": draft.layer_use or "front_effort"})
        support = read_execution_support(settings, draft, include_declared_conditions_id=True)
        raw, _, environment = registered_distance_material(settings)
        fingerprint = "sha256:" + hashlib.sha256(raw).hexdigest()
        request = MonthlyDistanceRequest(
            **draft.model_dump(include={"month", "longitude", "latitude", "radius_km", "layer_use"}),
            purpose="monthly_distance_reference",
            input_version=fingerprint,
            support_snapshot_id=support["snapshot_id"],
            method_version=get_args(DistanceMethod)[0],
            parameter_version=get_args(DistanceParameters)[0],
        )
        qualify_support(settings, request, support)
        check_distance_candidate(raw, support, environment)
        return {"schema_version": "ocean-owner-distance-options/v1", "input_sha256": fingerprint,
                "request": request.model_dump(), "research_ready": False}

    @router.get("/distance-options")
    async def distance_options(draft: Annotated[MonthlyDraft, Query()], response: Response):
        response.headers["Cache-Control"] = "no-store"
        if draft.purpose not in {None, "A_month"}:
            raise HTTPException(422, "A monthly distance draft is required", headers={"Cache-Control": "no-store"})
        return await run_distance_work(distance_candidate, draft)

    def find_distance_replay(submission, body):
        return guarded(lambda: distance_store.find(submission.intent_id, content_id(body)))

    def submit_distance(submission, body, control):
        old = find_distance_replay(submission, body)
        if old:
            return old
        try:
            prepared_distance = prepare_distance(settings, submission)
        except HTTPException as error:
            raise distance_rejection(error.status_code, error.detail, error.headers) from None
        qualification, raw, sources, _ = prepared_distance
        control.enable_cancellation()
        cancelled = (None, {"code": "execution_cancelled"})

        def reject_before_publication(error):
            if not control.begin_publication():
                return cancelled
            raise distance_rejection(error.status_code, error.detail, error.headers) from None

        def check_distance():
            if prepare_distance(settings, submission) != prepared_distance:
                raise HTTPException(409, "Registered distance evidence changed", headers={"Cache-Control": "no-store"})

        def execute_distance():
            result = None
            failure = "calculation_failed"
            if not control.cancelled.is_set():
                try:
                    check_distance()
                except HTTPException as error:
                    return reject_before_publication(error)
                try:
                    result = calculate_distance_reference(submission.request, raw, sources, qualification, control.cancelled)
                except QualificationInputMismatch:
                    return reject_before_publication(HTTPException(409, "Distance input does not match qualification"))
                except TimeoutExpired:
                    failure = "execution_timed_out"
                except (DistanceExecutionCancelled, OSError, ValueError, TypeError, ImportError, SubprocessError):
                    pass
            if not control.cancelled.is_set():
                try:
                    check_distance()
                except HTTPException as error:
                    if error.status_code not in {409, 503}:
                        raise
                    result = None
                    failure = "execution_evidence_changed"
            if not control.begin_publication():
                return cancelled
            if result is None:
                return None, {"code": failure}
            result["versions"]["direct_result_id"] = result.pop("result_id")
            result["result_id"] = content_id(result)
            return result, None

        return guarded(lambda: distance_store.submit(body, execute_distance, qualification=qualification),
                       distance_submission=True)

    def submit_legacy(submission):
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

    @router.post("")
    async def submit(submission: OwnerSubmission, response: Response):
        response.headers["Cache-Control"] = "no-store"
        if isinstance(submission.request, MonthlyDistanceRequest):
            body = submission.model_dump()
            return await run_distance_work(
                submit_distance, submission, body, replay_if_busy=find_distance_replay,
                submission_key=(submission.intent_id, content_id(body)),
            )
        return await to_thread.run_sync(submit_legacy, submission)

    @router.get("")
    def history(response: Response, purpose: OwnerPurpose = "monthly_spatial_example"):
        response.headers["Cache-Control"] = "no-store"
        return {"schema_version": "ocean-owner-synthetic-history/v1", "runs": guarded(store_for(purpose).catalog)}

    @router.post("/intents/{intent_id}/cancel")
    async def cancel_distance(intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response):
        response.headers["Cache-Control"] = "no-store"
        running = active_distance_runs.get(intent_id)
        run_id = None
        if running is not None and not running.task.done():
            state = running.control.request_cancel()
        else:
            run = await to_thread.run_sync(lambda: guarded(lambda: distance_store.read_intent(intent_id)))
            run_id = run["id"]
            state = "cancelled" if run.get("cancelled") is True else run["state"]
        return {
            "schema_version": "ocean-owner-distance-cancel/v1",
            "intent_id": intent_id,
            "run_id": run_id,
            "state": state,
        }

    @router.get("/intents/{intent_id}")
    def read_intent(intent_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response,
                    purpose: OwnerPurpose = "monthly_spatial_example"):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store_for(purpose).read_intent(intent_id))

    @router.get("/{run_id}")
    def read(run_id: Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")], response: Response,
             purpose: OwnerPurpose = "monthly_spatial_example"):
        response.headers["Cache-Control"] = "no-store"
        return guarded(lambda: store_for(purpose).read(run_id))

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
