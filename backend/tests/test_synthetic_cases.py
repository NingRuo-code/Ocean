"""Private persistence and protection for owner cases using known CC0 reports."""

import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.monthly_analysis import create_monthly_router

AUTH = {"Authorization": "Bearer self-authored-case-owner"}
BASE = "/api/query/monthly-analysis"


def case_client(tmp_path):
    published = tmp_path / "published.json"
    if not published.exists():
        published.write_bytes((Path(__file__).parents[1] / "app/examples/regional-known-snapshots.json").read_bytes())
    config = settings.model_copy(update={"monthly_execution_token": SecretStr("self-authored-case-owner"), "case_store_path": tmp_path / "cases.sqlite3"})
    app = FastAPI()
    app.include_router(create_monthly_router(config, published_path=published))
    return TestClient(app), published


def save_request(client, intent="a" * 32):
    item = client.get(BASE + "/published").json()["results"][0]
    report = client.get(BASE + "/published/" + item["result_id"] + "/report", params={"projection_id": item["projection_id"]}).json()
    return {"result_id": item["result_id"], "projection_id": item["projection_id"], "report_id": report["report_id"], "intent_id": intent, "title": "我的合成案例", "tags": ["验证"], "note": "人工笔记，不是科学解释"}


def test_owner_saves_one_frozen_case_and_reopens_after_service_restart(tmp_path):
    client, published = case_client(tmp_path)
    request = save_request(client)
    response = client.post(BASE + "/cases", json=request, headers=AUTH)
    assert response.status_code == 200
    saved = response.json()
    assert saved["version"] == 1
    assert saved["report"]["result"]["metrics"]["total_hours"] == 40
    assert saved["report"]["result"]["metrics"]["area_time_km2_days"] == 7
    assert saved["report"]["result"]["daily"][1]["hours"] == 0
    assert saved["report"]["result"]["daily"][2]["hours"] is None
    assert client.post(BASE + "/cases", json=request, headers=AUTH).json() == saved
    restarted, _ = case_client(tmp_path)
    published.unlink()
    read = restarted.get(BASE + "/cases/" + saved["case_id"], headers=AUTH)
    assert read.status_code == 200 and read.json() == saved
    assert read.headers["cache-control"] == "no-store"
    assert len(restarted.get(BASE + "/cases", headers=AUTH).json()["cases"]) == 1
    assert restarted.post(BASE + "/cases", json=request, headers=AUTH).json() == saved
    assert "self-authored-case-owner" not in read.text
    assert str(tmp_path) not in read.text


def test_owner_gate_precedes_store_access_and_reads_do_not_create_files(tmp_path):
    client, _ = case_client(tmp_path)
    request = save_request(client)
    for method, url in [("GET", BASE + "/cases"), ("POST", BASE + "/cases"), ("GET", BASE + "/cases/" + "a" * 32)]:
        response = client.request(method, url, json=request if method == "POST" else None)
        assert response.status_code == 401
        assert response.headers["cache-control"] == "no-store"
    assert client.get(BASE + "/cases", headers=AUTH).json()["cases"] == []
    assert not (tmp_path / "cases.sqlite3").exists()


def test_concurrent_same_intent_is_one_case_and_conflicting_payload_is_rejected(tmp_path):
    client, _ = case_client(tmp_path)
    request = save_request(client)
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: client.post(BASE + "/cases", json=request, headers=AUTH), range(4)))
    assert all(r.status_code == 200 for r in responses)
    assert len({r.json()["case_id"] for r in responses}) == 1
    changed = {**request, "title": "另一个意图的内容"}
    assert client.post(BASE + "/cases", json=changed, headers=AUTH).status_code == 409
    assert len(client.get(BASE + "/cases", headers=AUTH).json()["cases"]) == 1


def test_concurrent_save_during_first_database_initialization(tmp_path, monkeypatch):
    client, _ = case_client(tmp_path)
    request = save_request(client)
    first_opened = Event()
    resume_first = Event()
    connect = sqlite3.connect

    class PausableConnection(sqlite3.Connection):
        def execute(self, sql, parameters=()):
            if sql == "BEGIN IMMEDIATE" and not first_opened.is_set():
                first_opened.set()
                assert resume_first.wait(timeout=10)
            return super().execute(sql, parameters)

    def pausable_connect(*args, **kwargs):
        return connect(*args, factory=PausableConnection, **kwargs)

    def save():
        return client.post(BASE + "/cases", json=request, headers=AUTH)

    monkeypatch.setattr(sqlite3, "connect", pausable_connect)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(save)
        try:
            assert first_opened.wait(timeout=5)
            second = pool.submit(save).result(timeout=8)
        finally:
            resume_first.set()
        first = first.result(timeout=5)

    assert (first.status_code, second.status_code) == (200, 200)
    assert first.json() == second.json()
    assert client.get(BASE + "/cases", headers=AUTH).json()["total"] == 1


@pytest.mark.parametrize("mode", ["private", "changed", "corrupt_store", "foreign_store", "empty_unknown_store"])
def test_failed_saves_never_publish_cases_or_replace_unknown_material(tmp_path, mode):
    client, published = case_client(tmp_path)
    request = save_request(client)
    db = tmp_path / "cases.sqlite3"
    before = None
    if mode in {"private", "changed"}:
        pack = json.loads(published.read_text(encoding="utf-8"))
        if mode == "private":
            pack["snapshots"][0]["access"] = "owner_only"
        else:
            request["projection_id"] = "sha256:" + "0" * 64
        published.write_text(json.dumps(pack), encoding="utf-8")
    elif mode == "corrupt_store":
        db.write_bytes(b"self-authored unknown material; preserve")
        before = db.read_bytes()
    elif mode == "empty_unknown_store":
        db.write_bytes(b"")
        before = b""
    else:
        with sqlite3.connect(db) as connection:
            connection.execute("CREATE TABLE unrelated(value TEXT)")
        before = db.read_bytes()
    response = client.post(BASE + "/cases", json=request, headers=AUTH)
    assert response.status_code == (403 if mode == "private" else 409 if mode == "changed" else 503)
    assert "case_id" not in response.text and str(tmp_path) not in response.text
    if before is not None:
        assert db.read_bytes() == before
    else:
        assert not db.exists()


def test_notes_update_is_a_new_immutable_version_with_conflict_and_search(tmp_path):
    client, _ = case_client(tmp_path)
    first = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    url = BASE + "/cases/" + first["case_id"]
    update = {"title": "更新后的人工标题", "tags": ["海域甲"], "note": "人工复核，科学值未修改", "base_version": 1, "base_version_id": first["version_id"], "intent_id": "b" * 32}
    response = client.put(url, json=update, headers=AUTH)
    assert response.status_code == 200
    second = response.json()
    assert second["version"] == 2 and second["case_id"] == first["case_id"]
    assert second["version_id"] != first["version_id"]
    assert second["report"] == first["report"]
    assert client.put(url, json=update, headers=AUTH).json() == second
    assert client.get(url, params={"version": 1}, headers=AUTH).json() == first
    conflict = client.put(url, json={**update, "intent_id": "c" * 32, "note": "陈旧草稿"}, headers=AUTH)
    assert conflict.status_code == 409
    assert client.get(url, headers=AUTH).json() == second
    assert len(client.get(url + "/versions", headers=AUTH).json()["versions"]) == 2
    assert len(client.get(BASE + "/cases", params={"q": "海域甲"}, headers=AUTH).json()["cases"]) == 1
    assert client.get(BASE + "/cases", params={"q": "不匹配"}, headers=AUTH).json()["cases"] == []


def test_concurrent_different_edits_cannot_overwrite_or_mutate_science(tmp_path):
    client, _ = case_client(tmp_path)
    first = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    url = BASE + "/cases/" + first["case_id"]
    base = {**first["metadata"], "base_version": 1, "base_version_id": first["version_id"]}
    edits = [{**base, "note": str(i), "intent_id": f"{i+20:032x}"} for i in range(4)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda body: client.put(url, json=body, headers=AUTH), edits))
    assert sorted(r.status_code for r in responses) == [200, 409, 409, 409]
    newest = client.get(url, headers=AUTH).json()
    assert newest["version"] == 2 and newest["report"] == first["report"]
    assert client.get(url, params={"version": 1}, headers=AUTH).json() == first
    assert client.put(url, json={**edits[0], "report": {}}, headers=AUTH).status_code == 422
    assert client.get(url + "/versions").status_code == 401
    assert client.put(url, json=edits[0]).status_code == 401


def test_version_limit_and_noop_leave_all_old_versions_readable(tmp_path):
    client, _ = case_client(tmp_path)
    current = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    url = BASE + "/cases/" + current["case_id"]
    for number in range(2, 17):
        request = {**current["metadata"], "note": f"笔记{number}", "base_version": current["version"], "base_version_id": current["version_id"], "intent_id": f"{number+40:032x}"}
        response = client.put(url, json=request, headers=AUTH)
        assert response.status_code == 200
        current = response.json()
    extra = {**current["metadata"], "note": "第17版", "base_version": 16, "base_version_id": current["version_id"], "intent_id": "f" * 32}
    assert client.put(url, json=extra, headers=AUTH).status_code == 409
    assert client.get(url, headers=AUTH).json() == current
    unchanged = {**current["metadata"], "base_version": 16, "base_version_id": current["version_id"], "intent_id": "d" * 32}
    assert client.put(url, json=unchanged, headers=AUTH).json()["detail"] == "Case no_changes"
    assert len(client.get(url + "/versions", headers=AUTH).json()["versions"]) == 16
    assert client.get(url, params={"version": 1}, headers=AUTH).json()["version"] == 1


def test_case_limit_is_explicit_and_query_is_complete_and_literal(tmp_path):
    client, _ = case_client(tmp_path)
    initial = save_request(client)
    for i in range(64):
        request = {**initial, "intent_id": f"{i+100:032x}", "title": "🚢" * 120, "tags": ["sea_%" + "🚢" * 35] + [str(k) + "🚢" * 39 for k in range(7)], "note": "🚢" * 4000}
        assert client.post(BASE + "/cases", json=request, headers=AUTH).status_code == 200
    assert client.post(BASE + "/cases", json={**initial, "intent_id": "e" * 32}, headers=AUTH).status_code == 409
    response = client.get(BASE + "/cases", params={"q": "sea_%"}, headers=AUTH)
    data = response.json()
    assert data["total"] == len(data["cases"]) == 64 and data["complete"] is True
    assert len(response.content) < 1_048_576
    assert all("note" not in item["metadata"] for item in data["cases"])
    assert client.get(BASE + "/cases", params={"q": "' OR 1=1 --"}, headers=AUTH).json()["total"] == 0


def test_storage_lock_failure_preserves_prior_success_and_old_versions(tmp_path):
    import sqlite3
    client, _ = case_client(tmp_path)
    first = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    url = BASE + "/cases/" + first["case_id"]
    update = {**first["metadata"], "note": "锁期间不能保存", "base_version": 1, "base_version_id": first["version_id"], "intent_id": "c" * 32}
    with sqlite3.connect(tmp_path / "cases.sqlite3", isolation_level=None) as lock:
        lock.execute("BEGIN EXCLUSIVE")
        try:
            response = client.put(url, json=update, headers=AUTH)
            assert response.status_code == 503 and str(tmp_path) not in response.text
        finally:
            lock.rollback()
    assert client.get(url, headers=AUTH).json() == first
    assert len(client.get(url + "/versions", headers=AUTH).json()["versions"]) == 1




def test_protection_failure_rolls_back_case_and_intent_while_preserving_other_references(tmp_path, monkeypatch):
    from app import saved_case_store
    from app.synthetic_run_store import RunStoreError

    client, _ = case_client(tmp_path)
    first = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    dependencies = first["protected_dependencies"]
    assert set(dependencies) == {"result", "projection", "report", "chart_basis", "map_basis"}
    request = save_request(client, intent="b" * 32)
    original = saved_case_store.change_reference
    inserted = []

    def fail_after_first(db, artifact, kind, reference, present):
        if inserted:
            raise RunStoreError("unavailable")
        original(db, artifact, kind, reference, present)
        inserted.append(artifact)

    with monkeypatch.context() as patch:
        patch.setattr(saved_case_store, "change_reference", fail_after_first)
        failed = client.post(BASE + "/cases", json=request, headers=AUTH)
    assert failed.status_code == 503
    assert "protection unavailable" in failed.text
    assert inserted
    with sqlite3.connect(tmp_path / "cases.sqlite3") as db:
        assert db.execute("SELECT count(*) FROM cases").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM versions").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM intents").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM preparation_references").fetchone()[0] == 5
    assert client.get(BASE + "/cases/" + first["case_id"], headers=AUTH).json() == first
    restored = client.post(BASE + "/cases", json=request, headers=AUTH)
    assert restored.status_code == 200
    assert restored.json()["protected_dependencies"] == dependencies


def test_damaged_case_protection_never_replays_false_success(tmp_path):
    client, _ = case_client(tmp_path)
    request = save_request(client)
    saved = client.post(BASE + "/cases", json=request, headers=AUTH).json()
    db_path = tmp_path / "cases.sqlite3"
    with sqlite3.connect(db_path) as db:
        db.execute("DELETE FROM preparation_references WHERE artifact=?",
                   (saved["protected_dependencies"]["chart_basis"],))
    case_uri = BASE + "/cases/" + saved["case_id"]
    assert client.get(case_uri).status_code == 401
    assert client.get(case_uri, headers=AUTH).status_code == 503
    assert client.post(BASE + "/cases", json=request, headers=AUTH).status_code == 503




def test_legacy_version_reopens_and_next_version_gets_protection(tmp_path):
    from app.analysis_support import content_id

    client, _ = case_client(tmp_path)
    saved = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    case_uri = BASE + "/cases/" + saved["case_id"]
    with sqlite3.connect(tmp_path / "cases.sqlite3") as db:
        old = dict(saved)
        old.pop("protected_dependencies")
        old.pop("version_id")
        old["version_id"] = content_id(old)
        db.execute("UPDATE versions SET payload=?", (json.dumps(old),))
        db.execute("DROP TABLE preparation_references")
        db.execute("DROP TABLE preparation_reference_registry")
    assert client.get(case_uri, headers=AUTH).json() == old
    created = client.put(case_uri, headers=AUTH, json={
        **old["metadata"], "note": "本次修订有独立保护", "base_version": 1,
        "base_version_id": old["version_id"], "intent_id": "f" * 32,
    }).json()
    assert created["version"] == 2
    assert created["protected_dependencies"] == saved["protected_dependencies"]
    assert client.get(case_uri + "?version=1", headers=AUTH).json() == old




def test_damaged_protection_keeps_other_cases_and_legacy_versions_discoverable(tmp_path):
    from app.analysis_support import content_id

    client, _ = case_client(tmp_path)
    first = client.post(BASE + "/cases", json=save_request(client), headers=AUTH).json()
    path = BASE + "/cases/" + first["case_id"]
    old = {key: value for key, value in first.items() if key not in {"version_id", "protected_dependencies"}}
    old["version_id"] = content_id(old)
    with sqlite3.connect(tmp_path / "cases.sqlite3") as db:
        db.execute("UPDATE versions SET payload=?", (json.dumps(old),))
    updated = client.put(path, headers=AUTH, json={
        **old["metadata"], "note": "第二版", "base_version": 1,
        "base_version_id": old["version_id"], "intent_id": "b" * 32,
    }).json()
    other = client.get(BASE + "/published").json()["results"][1]
    report = client.get(BASE + "/published/" + other["result_id"] + "/report",
                        params={"projection_id": other["projection_id"]}).json()
    unrelated = client.post(BASE + "/cases", headers=AUTH, json={
        **save_request(client, intent="c" * 32), "result_id": other["result_id"],
        "projection_id": other["projection_id"], "report_id": report["report_id"],
    }).json()
    with sqlite3.connect(tmp_path / "cases.sqlite3") as db:
        db.execute("DELETE FROM preparation_references WHERE artifact=?",
                   (updated["protected_dependencies"]["chart_basis"],))
    listed = {item["case_id"]: item for item in client.get(BASE + "/cases", headers=AUTH).json()["cases"]}
    assert listed[first["case_id"]]["availability"] == "protection_unavailable"
    assert listed[first["case_id"]]["readable_version"] == 1
    assert listed[unrelated["case_id"]]["availability"] == "protected"
    assert client.get(path, headers=AUTH).status_code == 503
    assert client.get(path + "?version=1", headers=AUTH).json() == old
    versions = client.get(path + "/versions", headers=AUTH).json()["versions"]
    assert [(item["version"], item["availability"]) for item in versions] == [
        (2, "protection_unavailable"), (1, "legacy_unverified"),
    ]




def test_case_catalog_filters_pages_and_rejects_changed_catalog(tmp_path):
    client, _ = case_client(tmp_path)
    request = {**save_request(client), "title": "同名海域案例", "tags": ["东海"]}
    cases = []
    for marker in ("a", "b", "c"):
        cases.append(client.post(BASE + "/cases", headers=AUTH, json={**request, "intent_id": marker * 32}).json())
    day = cases[0]["created_at"][:10]
    query = {"q": "东海", "kind": "monthly_spatial_example", "start_date": day, "end_date": day, "limit": 2}
    first = client.get(BASE + "/cases", params=query, headers=AUTH).json()
    assert first["total"] == 3
    assert first["next_offset"] == 2
    assert len({row["case_id"] for row in first["cases"]}) == 2
    next_page = {**query, "offset": 2, "catalog_id": first["catalog_id"]}
    second = client.get(BASE + "/cases", params=next_page, headers=AUTH).json()
    assert second["next_offset"] is None
    assert second["cases"][0]["case_id"] == cases[0]["case_id"]
    assert client.get(BASE + "/cases", params={**query, "start_date": "2030-01-01"}, headers=AUTH).status_code == 422
    assert client.get(BASE + "/cases", params={**query, "start_date": "2000-01-01", "end_date": "2000-12-31"},
                      headers=AUTH).json()["total"] == 0
    client.post(BASE + "/cases", headers=AUTH, json={**request, "intent_id": "d" * 32})
    assert client.get(BASE + "/cases", params=next_page, headers=AUTH).status_code == 409


def test_case_rebinding_and_chapters_create_one_new_protected_version(tmp_path):
    client, published = case_client(tmp_path)
    first = client.post(BASE + "/cases", headers=AUTH, json=save_request(client)).json()
    other = client.get(BASE + "/published").json()["results"][1]
    original = client.get(BASE + "/published/" + other["result_id"] + "/report",
                          params={"projection_id": other["projection_id"]}).json()
    binding = {"result_id": other["result_id"], "projection_id": other["projection_id"],
               "report_id": original["report_id"]}
    case_uri = BASE + "/cases/" + first["case_id"]
    edit = {**first["metadata"], "base_version": 1, "base_version_id": first["version_id"],
            "intent_id": "b" * 32, "sections": ["limits", "summary"], "report_binding": binding}
    outdated = {**edit, "report_binding": {**binding, "report_id": "sha256:" + "0" * 64}}
    assert client.put(case_uri, headers=AUTH, json=outdated).status_code == 409
    response = client.put(case_uri, headers=AUTH, json=edit)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["version"] == 2
    assert updated["report"] == original
    assert updated["sections"] == ["summary", "limits"]
    assert updated["protected_dependencies"]["report"] == binding["report_id"]
    assert client.get(case_uri + "?version=1", headers=AUTH).json() == first
    packed = json.loads(published.read_bytes())
    packed["snapshots"] = [entry for entry in packed["snapshots"]
                           if entry["result"]["result_id"] != first["report"]["result"]["result_id"]]
    published.write_text(json.dumps(packed), encoding="utf-8")
    original_absent = client.get(case_uri, params={"version": 1, "include_source_status": True}, headers=AUTH).json()
    assert original_absent.pop("current_published_snapshot") == "projection_missing"
    assert original_absent == first
    published.unlink()
    assert client.put(case_uri, headers=AUTH, json=edit).json() == updated
    source_missing = client.get(case_uri, params={"include_source_status": True}, headers=AUTH).json()
    assert source_missing.pop("current_published_snapshot") == "missing"
    assert source_missing == updated
    assert len(client.get(case_uri + "/versions", headers=AUTH).json()["versions"]) == 2
    with sqlite3.connect(tmp_path / "cases.sqlite3") as db:
        all_references = db.execute("SELECT artifact FROM preparation_references WHERE reference=?",
                                    (first["case_id"],)).fetchall()
    assert {row[0] for row in all_references} >= {first["report"]["report_id"], original["report_id"]}
