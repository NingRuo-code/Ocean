"""Owner case API: saved public CC0 reports, not real scientific case protection."""

import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

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
        import sqlite3
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
        request = {**initial, "intent_id": f"{i+100:032x}", "title": f"同名案例 {i}", "tags": ["sea_%"]}
        assert client.post(BASE + "/cases", json=request, headers=AUTH).status_code == 200
    assert client.post(BASE + "/cases", json={**initial, "intent_id": "e" * 32}, headers=AUTH).status_code == 409
    data = client.get(BASE + "/cases", params={"q": "sea_%"}, headers=AUTH).json()
    assert data["total"] == len(data["cases"]) == 64 and data["complete"] is True
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
