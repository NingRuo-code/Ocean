"""Real P0 CLI output gates explicit monthly submission before any detailed read."""

import asyncio
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier, Event

import anyio
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from test_monthly_distance_reference import AUTH, URL, layer, reference_fixture

from app import monthly_distance_reference, synthetic_runs
from app.config import settings
from app.monthly_analysis import create_monthly_router
from app.monthly_models import MonthlyResearchApproval

CLI = Path(__file__).resolve().parents[2] / "tools" / "audit-research-baseline.mjs"


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


def fixture(
    tmp_path,
    *,
    missing_day=False,
    layer_use="front_effort",
    snapshot_source_differs=False,
    blocked_license=False,
    audited_contract_fixture=False,
    stale_runtime=False,
):
    reference = reference_fixture()
    reference["conditions"]["layer_use"] = layer_use
    front = layer("front", [-0.4, -0.4, 0.4, 0.4])
    activity = layer("activity", [-0.4, -0.4, 0.4, 0.4], 40)
    dates = [f"2024-08-{day:02d}" for day in range(1, 31 if missing_day else 32)]
    cells = reference["regional_cells"]
    cells["days"] = [{"date": date, "layers": [front, activity]} for date in dates]
    if audited_contract_fixture:
        # Exercises the audited-cells protocol with invented evidence in a disposable test app.
        cells["evidence_kind"] = "audited_cells"
        evidence_id = "sha256:" + "1" * 64
        cells["qualification_evidence"] = {
            "schema": "ocean-support-evidence/v1",
            "source_versions": dict.fromkeys(("front-original", "effort-original"), evidence_id),
            "processing_version": evidence_id,
            "license": {"state": "verified", "evidence_id": evidence_id},
            "quality_rule": {
                "state": "verified",
                "evidence_id": evidence_id,
                "id": "complete-common-support/v1",
            },
            "geometry": {
                "circle": {
                    "state": "verified",
                    "evidence_id": evidence_id,
                    "request_geometry": reference["conditions"]["geometries"][0],
                },
            },
        }
    if blocked_license:
        cells["qualification_evidence"] = {
            "schema": "ocean-support-evidence/v1",
            "license": {"state": "blocked"},
        }
    reference["front_days"] = [
        {"date": date, "source_id": "front-original", "lines": []} for date in dates
    ]
    conditions_file = tmp_path / "conditions.json"
    cells_file = tmp_path / "audited-cells.json"
    snapshot = tmp_path / "support.json"
    reference_file = tmp_path / "reference.json"
    conditions_file.write_bytes(encoded(reference["conditions"]))
    cells_file.write_bytes(encoded(cells))
    run = subprocess.run(
        [
            "node",
            str(CLI),
            "--support-request",
            str(conditions_file),
            "--regional-input",
            str(cells_file),
            "--out",
            str(snapshot),
        ],
        capture_output=True,
        timeout=30,
        check=False,
    )
    assert run.returncode == 0, run.stderr
    if snapshot_source_differs:
        reference["regional_cells"]["days"][0]["layers"][1]["cells"][0]["hours"] = 80
    reference_raw = encoded(reference)
    reference_file.write_bytes(reference_raw)
    expected = json.loads(snapshot.read_bytes())
    if stale_runtime:
        expected["method"]["GEOS"] = "0.0.0"
        del expected["support_snapshot_id"]
        expected["support_snapshot_id"] = "sha256:" + hashlib.sha256(encoded(expected)).hexdigest()
        snapshot.write_bytes(encoded(expected))
    request = {
        "purpose": "monthly_distance_reference",
        "month": "2024-08",
        "longitude": 0,
        "latitude": 0,
        "radius_km": 10,
        "layer_use": layer_use,
        "support_snapshot_id": expected["support_snapshot_id"],
        "input_version": "sha256:" + hashlib.sha256(reference_raw).hexdigest(),
        "method_version": "wgs84-distance-bands/v1",
        "parameter_version": "half-open-bands/v1",
    }
    return configured_client(snapshot, reference_file), reference_file, request, expected


def configured_client(snapshot, reference_file, approval=None, run_store=None, legacy_store=None):
    app = FastAPI()
    app.include_router(
        create_monthly_router(
            settings.model_copy(
                update={
                    "monthly_execution_token": SecretStr("reference-test"),
                    "monthly_distance_input_path": reference_file,
                    "monthly_research_input_path": reference_file if approval else None,
                    "monthly_research_approval": approval,
                    "support_snapshot_path": snapshot,
                    "support_state_path": None,
                    "synthetic_run_store_path": legacy_store,
                    "qualified_distance_run_store_path": run_store,
                }
            )
        )
    )
    return TestClient(app)


def test_explicit_reference_submission_uses_exact_p0_full_month_evidence(tmp_path):
    client, _, request, expected = fixture(tmp_path)
    assert client.post(URL, json=request).status_code == 401
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    assert result["qualification"]["snapshot_id"] == expected["support_snapshot_id"]
    assert result["qualification"]["scope"] == "frozen_synthetic_validation"
    assert result["research_ready"] is False


def test_owner_persists_exact_p0_reference_and_freezes_the_original_intent(tmp_path):
    original, reference, request, expected = fixture(tmp_path)
    store = tmp_path / "owner-runs.sqlite3"
    snapshot = tmp_path / "support.json"
    legacy = tmp_path / "legacy.sqlite3"
    client = configured_client(snapshot, reference, run_store=store, legacy_store=legacy)
    url = URL + "/owner-runs"
    submission = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    assert client.post(url, json=submission).status_code == 401
    assert not store.exists()
    unqualified = {**submission, "request": {k: v for k, v in request.items()
                                              if k not in {"support_snapshot_id", "layer_use"}}}
    assert client.post(url, headers=AUTH, json=unqualified).status_code == 409
    assert not store.exists()
    response = client.post(url, headers=AUTH, json=submission)
    assert response.status_code == 200, response.text
    record = response.json()
    assert record["schema_version"] == "ocean-owner-qualified-distance-run/v1"
    assert record["state"] == "completed"
    assert record["result"]["qualification"]["snapshot_id"] == expected["support_snapshot_id"]
    assert record["result"]["research_ready"] is False
    direct = original.post(URL, headers=AUTH, json=request).json()["result"]
    assert record["result"]["month"] == direct["month"]
    assert record["result"]["days"] == direct["days"]
    assert record["result"]["versions"]["direct_result_id"] == direct["versions"]["direct_result_id"]
    assert client.get(url, headers=AUTH).json()["runs"] == []
    assert not legacy.exists()
    assert client.get(url, headers=AUTH, params={"purpose": request["purpose"]}).json()["runs"][0]["id"] == record["id"]

    snapshot.unlink()
    reference.unlink()
    reopened = configured_client(snapshot, reference, run_store=store)
    query = {"purpose": request["purpose"]}
    assert reopened.get(url + "/" + record["id"], headers=AUTH, params=query).json() == record
    assert reopened.post(url, headers=AUTH, json=submission).json() == record
    rejected = reopened.post(url, headers=AUTH, json={**submission, "intent_id": "b" * 32})
    assert rejected.status_code == 409
    assert rejected.json()["detail"]["reason"] == "audit_snapshot_unavailable"
    assert len(reopened.get(url, headers=AUTH, params={"purpose": request["purpose"]}).json()["runs"]) == 1


def test_owner_distance_options_prepare_exact_current_p0_without_starting_a_task(
    tmp_path, monkeypatch
):
    _, reference, request, _ = fixture(tmp_path)
    store = tmp_path / "qualified.sqlite3"
    snapshot = tmp_path / "support.json"
    client = configured_client(snapshot, reference, run_store=store)
    url = URL + "/owner-runs/distance-options"
    conditions = {key: request[key] for key in ("longitude", "latitude", "radius_km", "month", "layer_use")}

    def unexpected_engine(*args):
        pytest.fail("distance options must not start the calculation")

    monkeypatch.setattr(synthetic_runs, "calculate_distance_reference", unexpected_engine)
    assert client.get(url, params=conditions).status_code == 401
    assert client.get(url, headers=AUTH, params={**conditions, "latitude": 1}).status_code == 409
    response = client.get(url, headers=AUTH, params=conditions)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "schema_version": "ocean-owner-distance-options/v1",
        "input_sha256": request["input_version"],
        "request": request,
        "research_ready": False,
    }
    raw = json.loads(reference.read_bytes())
    raw["conditions"]["geometries"][0]["id"] = "another-circle"
    reference.write_bytes(encoded(raw))
    changed_geometry_id = client.get(url, headers=AUTH, params=conditions)
    assert changed_geometry_id.status_code == 409, changed_geometry_id.text
    raw["conditions"]["geometries"][0]["id"] = "circle"
    raw["regional_cells"]["days"][0]["layers"][1]["cells"][0]["hours"] += 1
    reference.write_bytes(encoded(raw))
    conflict = client.get(url, headers=AUTH, params=conditions)
    assert conflict.status_code == 409, conflict.text
    assert not store.exists()


def test_owner_distance_keeps_interruption_without_publishing_if_qualification_is_withdrawn(
    tmp_path, monkeypatch
):
    _, reference, request, _ = fixture(tmp_path)
    store = tmp_path / "owner-runs.sqlite3"
    snapshot = tmp_path / "support.json"
    client = configured_client(snapshot, reference, run_store=store)
    url = URL + "/owner-runs"
    submission = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    original = client.post(url, headers=AUTH, json=submission)
    assert original.status_code == 200
    record = original.json()
    calculate = synthetic_runs.calculate_distance_reference

    def run_then_withdraw(*args):
        result = calculate(*args)
        snapshot.unlink()
        return result

    monkeypatch.setattr(synthetic_runs, "calculate_distance_reference", run_then_withdraw)
    new_intent = "b" * 32
    interrupted_body = {**submission, "intent_id": new_intent}
    interrupted = client.post(url, headers=AUTH, json=interrupted_body)
    assert interrupted.status_code == 200, interrupted.text
    stopped = interrupted.json()
    assert stopped["state"] == "failed"
    assert stopped["error"] == {"code": "calculation_failed"}
    assert stopped["failure_reason"] == "execution_evidence_changed"
    assert stopped["result"] is None
    assert stopped["qualification"] == record["qualification"]
    assert stopped["id"] != record["id"]
    query = {"purpose": request["purpose"]}
    reopened = configured_client(snapshot, reference, run_store=store)
    assert reopened.get(url + "/intents/" + new_intent, params=query).status_code == 401
    assert reopened.get(url + "/intents/" + new_intent, headers=AUTH, params=query).json() == stopped
    assert reopened.get(url + "/" + stopped["id"], headers=AUTH, params=query).json() == stopped
    assert reopened.post(url, headers=AUTH, json=interrupted_body).json() == stopped
    assert reopened.get(url + "/" + record["id"], headers=AUTH, params=query).json() == record
    fresh = reopened.post(url, headers=AUTH, json={**submission, "intent_id": "c" * 32})
    assert fresh.status_code == 409
    assert fresh.json()["detail"]["reason"] == "audit_snapshot_unavailable"
    assert reopened.get(url + "/intents/" + "c" * 32, headers=AUTH, params=query).status_code == 404
    assert len(reopened.get(url, headers=AUTH, params=query).json()["runs"]) == 2


def test_owner_distance_timeout_is_terminal_and_replays_without_running_again(tmp_path, monkeypatch):
    _, reference, request, _ = fixture(tmp_path)
    store = tmp_path / "owner-runs.sqlite3"
    snapshot = tmp_path / "support.json"
    client = configured_client(snapshot, reference, run_store=store)
    url = URL + "/owner-runs"
    body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    query = {"purpose": request["purpose"]}
    with monkeypatch.context() as shortened:
        shortened.setattr(monthly_distance_reference, "DISTANCE_EXECUTION_TIMEOUT_SECONDS", 0.01)
        response = client.post(url, headers=AUTH, json=body)
    assert response.status_code == 200, response.text
    stopped = response.json()
    assert stopped["state"] == "failed"
    assert stopped["result"] is None
    assert stopped["error"] == {"code": "calculation_failed"}
    assert stopped["failure_reason"] == "execution_timed_out"
    assert client.get(url + "/" + stopped["id"], headers=AUTH, params=query).json() == stopped
    assert client.post(url, headers=AUTH, json=body).json() == stopped
    assert len(client.get(url, headers=AUTH, params=query).json()["runs"]) == 1


def test_duplicate_distance_intents_wait_and_legacy_store_remains_independent(tmp_path, monkeypatch):
    _, reference, request, _ = fixture(tmp_path)
    snapshot = tmp_path / "support.json"
    store = tmp_path / "qualified.sqlite3"
    legacy = tmp_path / "legacy.sqlite3"
    client = configured_client(snapshot, reference, run_store=store, legacy_store=legacy)
    other = configured_client(snapshot, reference, run_store=store, legacy_store=legacy)
    url = URL + "/owner-runs"
    body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    started, release = Event(), Event()
    original = synthetic_runs.calculate_distance_reference

    def hold_first(*args):
        started.set()
        assert release.wait(10)
        return original(*args)

    monkeypatch.setattr(synthetic_runs, "calculate_distance_reference", hold_first)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(client.post, url, headers=AUTH, json=body)
        try:
            assert started.wait(10)
            duplicate = pool.submit(other.post, url, headers=AUTH, json=body)
            # The original legacy write ceiling was one second.
            with pytest.raises(TimeoutError):
                duplicate.result(1.8)
            options = client.get(url + "/options", headers=AUTH).json()
            condition = {k: options["conditions"][0][k] for k in ("longitude", "latitude", "radius_km", "month")}
            legacy_body = {
                "intent_id": "b" * 32, "input_sha256": options["input_sha256"],
                "request": {**condition, "purpose": "monthly_spatial_example",
                            **{key: options[key] for key in ("method_version", "parameter_version")},
                            "input_version": options["input_version"]},
            }
            legacy_run = client.post(url, headers=AUTH, json=legacy_body)
            assert legacy_run.status_code == 200, legacy_run.text
        finally:
            release.set()
        left, right = first.result(30), duplicate.result(30)
    assert left.status_code == right.status_code == 200
    assert left.json() == right.json()
    assert len(client.get(url, headers=AUTH).json()["runs"]) == 1
    assert len(client.get(url, headers=AUTH, params={"purpose": request["purpose"]}).json()["runs"]) == 1


def test_distance_submission_keeps_shared_sync_reads_available(tmp_path, monkeypatch):
    _, reference, request, _ = fixture(tmp_path)
    client = configured_client(
        tmp_path / "support.json", reference, run_store=tmp_path / "qualified.sqlite3",
        legacy_store=tmp_path / "legacy.sqlite3",
    )
    url = URL + "/owner-runs"
    body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    started, release = Event(), Event()
    original = synthetic_runs.calculate_distance_reference

    def hold_first(*args):
        started.set()
        assert release.wait(10)
        return original(*args)

    monkeypatch.setattr(synthetic_runs, "calculate_distance_reference", hold_first)

    async def requests():
        anyio.to_thread.current_default_thread_limiter().total_tokens = 1
        transport = httpx.ASGITransport(app=client.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as browser:
            post = asyncio.create_task(browser.post(url, headers=AUTH, json=body))
            try:
                async with asyncio.timeout(6):
                    while not started.is_set():
                        await asyncio.sleep(0.02)
                options = await asyncio.wait_for(browser.get(url + "/options", headers=AUTH), 2)
                assert options.status_code == 200
                assert not post.done()
            finally:
                release.set()
                response = await post
            assert response.status_code == 200, response.text

    asyncio.run(requests())


def test_excess_qualified_submissions_return_promptly_without_new_runs(tmp_path, monkeypatch):
    _, reference, request, _ = fixture(tmp_path)
    store = tmp_path / "qualified.sqlite3"
    client = configured_client(
        tmp_path / "support.json", reference, run_store=store,
        legacy_store=tmp_path / "legacy.sqlite3",
    )
    url = URL + "/owner-runs"
    conditions = {key: request[key] for key in ("longitude", "latitude", "radius_km", "month")}
    body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    committed = client.post(url, headers=AUTH, json=body)
    assert committed.status_code == 200, committed.text
    fresh_body = {**body, "intent_id": "b" * 32}
    active, release = Event(), Event()
    ready = Barrier(2, action=active.set)
    registered_material = synthetic_runs.registered_distance_material

    def hold_registered_material(*args):
        if not active.is_set():
            ready.wait(timeout=8)
        assert release.wait(8)
        return registered_material(*args)

    monkeypatch.setattr(synthetic_runs, "registered_distance_material", hold_registered_material)

    async def requests():
        transport = httpx.ASGITransport(app=client.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as browser:
            checks = [
                asyncio.create_task(browser.get(url + "/distance-options", headers=AUTH, params=conditions))
                for _ in range(2)
            ]
            try:
                async with asyncio.timeout(6):
                    while not active.is_set():
                        await asyncio.sleep(0.02)
                regular = await asyncio.wait_for(browser.get(url + "/options", headers=AUTH), 2)
                assert regular.status_code == 200
                replay = await asyncio.wait_for(browser.post(url, headers=AUTH, json=body), 2)
                assert replay.status_code == 200, replay.text
                assert replay.json() == committed.json()
                conflict = await asyncio.wait_for(
                    browser.post(url, headers=AUTH, json={**body, "input_sha256": "sha256:" + "f" * 64}), 2
                )
                assert conflict.status_code == 409, conflict.text
                checks[0].cancel()
                with pytest.raises(asyncio.CancelledError):
                    await checks[0]
                extra = await asyncio.wait_for(browser.post(url, headers=AUTH, json=fresh_body), 2)
                assert extra.status_code == 503, extra.text
                assert extra.headers["retry-after"] == "1"
                missing = await browser.get(
                    url + "/intents/" + fresh_body["intent_id"], headers=AUTH,
                    params={"purpose": request["purpose"]},
                )
                assert missing.status_code == 404
            finally:
                release.set()
                results = await asyncio.gather(*checks, return_exceptions=True)
            assert results[1].status_code == 200, results[1].text
            allowed = await browser.post(url, headers=AUTH, json=fresh_body)
            assert allowed.status_code == 200, allowed.text
            assert allowed.json()["state"] == "completed"

    asyncio.run(requests())


def test_invalid_distance_output_never_poisons_the_history(tmp_path, monkeypatch):
    _, reference, request, _ = fixture(tmp_path)
    snapshot = tmp_path / "support.json"
    client = configured_client(snapshot, reference, run_store=tmp_path / "qualified.sqlite3")
    url = URL + "/owner-runs"
    original = synthetic_runs.calculate_distance_reference

    def mismatched_output(*args):
        result = original(*args)
        result["versions"]["input"] = "sha256:" + "e" * 64
        return result

    monkeypatch.setattr(synthetic_runs, "calculate_distance_reference", mismatched_output)
    body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    failed = client.post(url, headers=AUTH, json=body)
    assert failed.status_code == 503
    assert client.get(url, headers=AUTH, params={"purpose": request["purpose"]}).json()["runs"] == []


@pytest.mark.parametrize("conditions", [{"missing_day": True}, {"layer_use": "front_effort_sst"}])
def test_incomplete_required_support_rejects_before_opening_detailed_input(tmp_path, conditions):
    client, reference_file, request, _ = fixture(tmp_path, **conditions)
    reference_file.unlink()
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    detail = denied.json()["detail"]
    assert detail["reason"] == "incomplete_required_support"
    assert detail["support"]["month"]["included_days"] < 31
    assert detail["can_execute"] is False


def test_stale_condition_version_and_synthetic_research_attempt_are_rejected(tmp_path):
    client, reference_file, request, _ = fixture(tmp_path)
    reference_file.unlink()
    for changes, reason in [
        ({"support_snapshot_id": "sha256:" + "1" * 64}, "support_snapshot_identity_mismatch"),
        ({"radius_km": 20}, "requested_geometry_not_in_snapshot"),
        ({"month": "2024-09"}, "requested_conditions_not_in_snapshot"),
        ({"layer_use": "front_effort_sst"}, "requested_conditions_not_in_snapshot"),
        ({"method_version": "wrong"}, "analysis_method_or_parameter_version_mismatch"),
        ({"parameter_version": "wrong"}, "analysis_method_or_parameter_version_mismatch"),
        ({"input_version": "unknown"}, "analysis_input_version_unverified"),
        ({"purpose": "monthly_spatial_research"}, "formal_research_qualification_missing"),
        (
            {"purpose": "monthly_spatial_research", "analysis_scope": "side"},
            "side_specific_support_not_verified",
        ),
    ]:
        denied = client.post(URL, headers=AUTH, json={**request, **changes})
        assert denied.status_code == 409, denied.text
        assert denied.json()["detail"]["reason"] == reason

    (tmp_path / "support.json").unlink()
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409
    assert denied.json()["detail"]["reason"] == "audit_snapshot_unavailable"
    assert denied.headers["cache-control"] == "no-store"


def test_compatible_shape_is_not_enough_when_registered_source_content_differs(tmp_path):
    client, _, request, _ = fixture(tmp_path, snapshot_source_differs=True)
    failed = client.post(URL, headers=AUTH, json=request)
    assert failed.status_code == 200, failed.text
    assert failed.json()["state"] == "failed" and failed.json()["result"] is None
    assert failed.json()["error"]["code"] == "qualification_input_or_conditions_mismatch"


def test_explicit_license_block_rejects_even_with_complete_calendar(tmp_path):
    client, reference_file, request, _ = fixture(tmp_path, blocked_license=True)
    reference_file.unlink()
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    detail = denied.json()["detail"]
    assert detail["reason"] == "support_evidence_explicitly_blocked"
    assert detail["support"]["month"]["included_days"] == 31


def test_changed_geometry_runtime_cannot_reuse_a_frozen_snapshot(tmp_path):
    client, _, request, _ = fixture(tmp_path, stale_runtime=True)
    failed = client.post(URL, headers=AUTH, json=request)
    assert failed.status_code == 200, failed.text
    assert failed.json()["state"] == "failed" and failed.json()["result"] is None
    assert failed.json()["error"]["code"] == "qualification_input_or_conditions_mismatch"


def test_p0_claims_cannot_launch_research_without_separate_exact_approval(tmp_path):
    client, reference_file, request, expected = fixture(tmp_path, audited_contract_fixture=True)
    assert expected["regions"][0]["month"]["data_gate_passed"] is True
    request["purpose"] = "monthly_spatial_research"
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    assert (
        denied.json()["detail"]["reason"]
        == "current_source_identity_and_research_approval_not_verified"
    )
    assert denied.json()["detail"]["support"]["month"]["total_hours"] is None

    approval = MonthlyResearchApproval(
        approval_id="sha256:" + "2" * 64,
        distance_engine_sha256="sha256:"
        + hashlib.sha256(CLI.with_name("compute_monthly_distance.py").read_bytes()).hexdigest(),
        **{
            key: request[key]
            for key in (
                "support_snapshot_id",
                "input_version",
                "method_version",
                "parameter_version",
            )
        },
    )
    approved = configured_client(tmp_path / "support.json", reference_file, approval)
    stale_engine = configured_client(
        tmp_path / "support.json",
        reference_file,
        approval.model_copy(update={"distance_engine_sha256": "sha256:" + "3" * 64}),
    )
    denied = stale_engine.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    assert denied.json()["detail"]["reason"] == "research_approval_engine_version_mismatch"
    mismatch = approved.post(
        URL, headers=AUTH, json={**request, "input_version": "sha256:" + "3" * 64}
    )
    assert mismatch.status_code == 409, mismatch.text
    assert mismatch.json()["detail"]["reason"] == "research_approval_identity_mismatch"
    run = approved.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    assert record["result"]["qualification"]["approval_id"] == approval.approval_id
    assert record["result"]["research_ready"] is False
    assert "side_hours" not in record["result"]["days"][0]["common"]
    assert approved.get(f"{URL}/{record['id']}").status_code == 401
    assert approved.get(f"{URL}/{record['id']}", headers=AUTH).json() == record
    evidence = f"{URL}/{record['id']}/evidence"
    assert approved.get(evidence).status_code == 401
    assert approved.get(evidence, headers=AUTH).status_code == 200
    assert approved.get(evidence, headers=AUTH, params={"format": "zip"}).status_code == 403
    preview = approved.get(f"{URL}/{record['id']}/report", headers=AUTH,
                           params={"result_id": record["result"]["result_id"]})
    assert preview.status_code == 200 and preview.headers["Cache-Control"] == "no-store"
    report = preview.json()
    assert report["content"]["evidence_kind"] == "audited_cells"
    assert report["content"]["audience"] == "owner_aggregate"
    assert report["html"] == approved.get(evidence, headers=AUTH).text
    assert approved.post(URL, headers=AUTH, json=request).json() == record
    (tmp_path / "support.json").unlink()
    assert approved.post(URL, headers=AUTH, json=request).status_code == 409
    assert approved.get(f"{URL}/{record['id']}", headers=AUTH).json() == record
