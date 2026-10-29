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
