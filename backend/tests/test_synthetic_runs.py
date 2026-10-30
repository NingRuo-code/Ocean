"""Owner-run contracts observed at the actual monthly service boundary."""

import json
import shutil
import sqlite3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.analysis_support import content_id
from app.config import settings
from app.monthly_analysis import create_monthly_router
from test_monthly_analysis import AUTH, REQUEST

BASE = "/api/query/monthly-analysis/owner-runs"


def run_client(root, source=None, *, configured=True, enabled=True):
    source = source or root / "monthly.json"
    if not source.exists():
        shutil.copyfile(Path(__file__).parents[1] / "app/examples/monthly-known-units.json", source)
    config = settings.model_copy(update={"monthly_execution_token": SecretStr("synthetic-owner-test") if enabled else None, "synthetic_run_store_path": root / "runs.sqlite3" if configured else None})
    app = FastAPI()
    app.include_router(create_monthly_router(config, example_path=source))
    return TestClient(app), source


def submission(source, intent="a" * 32):
    return {"intent_id": intent, "input_sha256": content_id(json.loads(source.read_text(encoding="utf-8"))), "request": REQUEST}


def test_owner_submits_once_and_another_service_reads_the_same_frozen_result_without_source(tmp_path):
    client, source = run_client(tmp_path)
    body = submission(source)
    response = client.post(BASE, headers=AUTH, json=body)
    assert response.status_code == 200
    run = response.json()
    assert run["state"] == "completed"
    assert run["result"]["metrics"]["total_hours"] == 40
    assert run["result"]["metrics"]["area_time_km2_days"] == 7
    assert run["result"]["metrics"]["supported_days"] == 2
    assert len(run["result"]["daily"]) == 29
    assert run["result"]["daily"][1]["hours"] == 0
    assert run["result"]["daily"][2]["hours"] is None
    assert run["request"] == REQUEST and run["input_sha256"] == body["input_sha256"]
    assert client.post(BASE, headers=AUTH, json=body).json() == run
    other, _ = run_client(tmp_path, source)
    source.unlink()
    assert other.get(BASE + "/" + run["id"], headers=AUTH).json() == run
    assert other.post(BASE, headers=AUTH, json=body).json() == run


def test_rejected_input_never_poisons_a_new_store_and_all_zero_intent_is_valid(tmp_path):
    client, source = run_client(tmp_path)
    valid = submission(source, "0" * 32)
    bad = {**valid, "input_sha256": "sha256:" + "0" * 64}
    assert client.post(BASE, headers=AUTH, json=bad).status_code == 409
    response = client.post(BASE, headers=AUTH, json=valid)
    assert response.status_code == 200
    assert client.get(BASE + "/options", headers=AUTH).status_code == 200


def test_inconsistent_persisted_request_is_not_returned_as_a_verified_task(tmp_path):
    client, source = run_client(tmp_path)
    run = client.post(BASE, headers=AUTH, json=submission(source)).json()
    with sqlite3.connect(tmp_path / "runs.sqlite3") as db:
        value = json.loads(db.execute("SELECT payload FROM runs").fetchone()[0])
        value["request"]["month"] = "2024-03"
        value.pop("record_id")
        value["record_id"] = content_id(value)
        db.execute("UPDATE runs SET payload=?", (json.dumps(value),))
    assert client.get(BASE + "/" + run["id"], headers=AUTH).status_code == 503


def test_owner_required_before_any_private_storage_access_and_reads_never_initialize(tmp_path):
    client, source = run_client(tmp_path)
    for method, path, kwargs in [("get", BASE + "/options", {}), ("get", BASE + "/" + "a" * 32, {}), ("post", BASE, {"json": submission(source)})]:
        assert getattr(client, method)(path, **kwargs).status_code == 401
    assert not (tmp_path / "runs.sqlite3").exists()
    assert client.get(BASE + "/options", headers=AUTH).status_code == 200
    assert client.get(BASE + "/" + "a" * 32, headers=AUTH).status_code == 404
    assert not (tmp_path / "runs.sqlite3").exists()
    disabled, _ = run_client(tmp_path, configured=False)
    assert disabled.post(BASE, headers=AUTH, json=submission(source)).status_code == 503
    unowned, _ = run_client(tmp_path, enabled=False)
    assert unowned.get(BASE + "/options", headers=AUTH).status_code == 503
    assert not (tmp_path / "runs.sqlite3").exists()


def test_intent_conflict_is_rejected_without_replacing_original_task(tmp_path):
    client, source = run_client(tmp_path)
    body = submission(source)
    run = client.post(BASE, headers=AUTH, json=body).json()
    changed = {**body, "request": {**REQUEST, "month": "2024-03"}}
    assert client.post(BASE, headers=AUTH, json=changed).status_code == 409
    assert client.get(BASE + "/" + run["id"], headers=AUTH).json() == run


def test_source_change_and_non_cc0_input_are_rejected_before_acceptance(tmp_path):
    client, source = run_client(tmp_path)
    body = submission(source)
    value = json.loads(source.read_text(encoding="utf-8"))
    value["version"] = "synthetic-month/v2"
    source.write_text(json.dumps(value), encoding="utf-8")
    assert client.post(BASE, headers=AUTH, json=body).status_code == 409
    assert not (tmp_path / "runs.sqlite3").exists()
    value["license"] = "unknown"
    source.write_text(json.dumps(value), encoding="utf-8")
    assert client.get(BASE + "/options", headers=AUTH).status_code == 503
    assert not (tmp_path / "runs.sqlite3").exists()


def test_two_service_instances_accept_one_terminal_record_for_the_same_intent(tmp_path):
    first, source = run_client(tmp_path)
    second, _ = run_client(tmp_path, source)
    body = submission(source)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda client: client.post(BASE, headers=AUTH, json=body), [first, second]))
    assert [r.status_code for r in responses] == [200, 200]
    assert responses[0].json() == responses[1].json()


def test_capacity_preserves_old_records_and_allows_replay_after_source_loss(tmp_path):
    client, source = run_client(tmp_path)
    first = None
    for n in range(64):
        response = client.post(BASE, headers=AUTH, json=submission(source, f"{n:032x}"))
        assert response.status_code == 200
        first = first or response.json()
    original = submission(source, "0" * 32)
    assert client.post(BASE, headers=AUTH, json=submission(source, "f" * 32)).status_code == 409
    history = client.get(BASE, headers=AUTH)
    assert len(history.json()["runs"]) == 64
    assert len(history.content) <= 1_048_576
    source.unlink()
    assert client.post(BASE, headers=AUTH, json=original).json() == first
    assert client.get(BASE + "/" + first["id"], headers=AUTH).json() == first


def test_actual_arithmetic_failure_is_a_durable_terminal_record_without_partial_result(tmp_path):
    client, source = run_client(tmp_path)
    value = json.loads(source.read_text(encoding="utf-8"))
    for unit in value["conditions"][0]["days"][0]["units"]:
        unit["hours"] = 1e308
    source.write_text(json.dumps(value), encoding="utf-8")
    response = client.post(BASE, headers=AUTH, json=submission(source))
    assert response.status_code == 200
    run = response.json()
    assert run["state"] == "failed" and run["result"] is None
    assert run["error"] == {"code": "calculation_failed"}
    other, _ = run_client(tmp_path, source)
    assert other.get(BASE + "/" + run["id"], headers=AUTH).json() == run


@pytest.mark.parametrize("content", [b"private unknown database", b"SQLite format 3\0broken"])
def test_unknown_storage_is_not_replaced_and_private_paths_are_not_echoed(tmp_path, content):
    client, source = run_client(tmp_path)
    path = tmp_path / "runs.sqlite3"
    path.write_bytes(content)
    response = client.post(BASE, headers=AUTH, json=submission(source))
    assert response.status_code == 503
    assert str(tmp_path) not in response.text
    assert path.read_bytes() == content


def test_write_lock_failure_keeps_old_readable_record_and_can_explicitly_retry(tmp_path):
    client, source = run_client(tmp_path)
    original = client.post(BASE, headers=AUTH, json=submission(source)).json()
    body = submission(source, "b" * 32)
    with sqlite3.connect(tmp_path / "runs.sqlite3", isolation_level=None) as db:
        db.execute("BEGIN IMMEDIATE")
        assert client.post(BASE, headers=AUTH, json=body).status_code == 503
        assert client.get(BASE + "/" + original["id"], headers=AUTH).json() == original
        db.rollback()
    assert client.post(BASE, headers=AUTH, json=body).status_code == 200


def test_authorized_history_and_intent_recover_the_original_record_after_service_restart(tmp_path):
    client, source = run_client(tmp_path)
    assert client.get(BASE, headers=AUTH).json()["runs"] == []
    assert not (tmp_path / "runs.sqlite3").exists()
    first_body = submission(source, "1" * 32)
    first = client.post(BASE, headers=AUTH, json=first_body).json()
    second = client.post(BASE, headers=AUTH, json=submission(source, "2" * 32)).json()
    other, _ = run_client(tmp_path, source)
    source.unlink()
    history = other.get(BASE, headers=AUTH).json()
    assert history["schema_version"] == "ocean-owner-synthetic-history/v1"
    assert [r["id"] for r in history["runs"]] == [second["id"], first["id"]]
    assert all("result" not in r for r in history["runs"])
    assert other.get(BASE + "/intents/" + first_body["intent_id"], headers=AUTH).json() == first
    assert other.get(BASE + "/intents/" + "f" * 32, headers=AUTH).status_code == 404
    assert other.get(BASE).status_code == 401
    assert other.get(BASE + "/intents/" + first_body["intent_id"]).status_code == 401


def test_currently_missing_intent_can_later_commit_and_is_not_negative_acceptance_proof(tmp_path):
    client, source = run_client(tmp_path)
    client.post(BASE, headers=AUTH, json=submission(source))
    body = submission(source, "c" * 32)
    with ThreadPoolExecutor(max_workers=1) as pool:
        with sqlite3.connect(tmp_path / "runs.sqlite3", isolation_level=None) as db:
            db.execute("BEGIN IMMEDIATE")
            future = pool.submit(client.post, BASE, headers=AUTH, json=body)
            assert client.get(BASE + "/intents/" + body["intent_id"], headers=AUTH).status_code == 404
            db.rollback()
        response = future.result()
    assert response.status_code == 200
    assert client.get(BASE + "/intents/" + body["intent_id"], headers=AUTH).json() == response.json()


def test_actual_storage_write_failure_rolls_back_acceptance_and_preserves_old_results(tmp_path):
    client, source = run_client(tmp_path)
    old = client.post(BASE, headers=AUTH, json=submission(source)).json()
    body = submission(source, "d" * 32)
    with sqlite3.connect(tmp_path / "runs.sqlite3") as db:
        db.execute("CREATE TRIGGER controlled_failure BEFORE INSERT ON runs BEGIN SELECT RAISE(ABORT,'self-authored write failure'); END")
    response = client.post(BASE, headers=AUTH, json=body)
    assert response.status_code == 503
    assert client.get(BASE + "/intents/" + body["intent_id"], headers=AUTH).status_code == 404
    assert client.get(BASE + "/" + old["id"], headers=AUTH).json() == old
    with sqlite3.connect(tmp_path / "runs.sqlite3") as db:
        db.execute("DROP TRIGGER controlled_failure")
    assert client.post(BASE, headers=AUTH, json=body).status_code == 200
