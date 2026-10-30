"""Frozen owner evidence files observed through the actual monthly router."""

import csv
import hashlib
import io
import json
import sqlite3

import pytest

from app.analysis_support import content_id
from test_monthly_analysis import AUTH
from test_synthetic_runs import BASE, run_client, submission


def target(run, representation="csv", **overrides):
    return BASE + "/" + run["id"] + "/exports/" + representation, {"record_id": run["record_id"], "result_id": run["result"]["result_id"], **overrides}


def test_completed_frozen_files_survive_service_reopen_and_source_loss_without_publishing(tmp_path):
    client, source = run_client(tmp_path)
    run = client.post(BASE, headers=AUTH, json=submission(source)).json()
    original = client.get(*target(run)[:1], params=target(run)[1], headers=AUTH)
    assert original.status_code == 200
    assert original.content[:3] == b"\xef\xbb\xbf"
    rows = list(csv.reader(io.StringIO(original.content.decode("utf-8-sig"))))
    split = rows.index([])
    metadata = dict(rows[:split])
    assert len(metadata) == split
    assert metadata["run_id"] == run["id"] and metadata["record_id"] == run["record_id"]
    assert metadata["result_id"] == run["result"]["result_id"]
    assert metadata["total_hours"] == "40.0" and metadata["area_time_km2_days"] == "7.0"
    assert metadata["supported_days"] == "2" and metadata["calendar_days"] == "29"
    assert metadata["export_purpose"] == "owner_local_download" and metadata["automatically_published"] == "false"
    assert "projection_id" not in metadata and "public_aggregate_allowed" not in metadata
    assert rows[split+2] == ["2024-02-01", "ready", "40.0", "5.0", "5.0", "0"]
    assert rows[split+3] == ["2024-02-02", "partial_support", "0.0", "2.0", "2.0", "1"]
    assert rows[split+4] == ["2024-02-03", "no_records", "", "", "", "0"]
    assert len(rows[split+2:]) == 29
    other, _ = run_client(tmp_path, source)
    source.unlink()
    for representation in ["csv", "markdown"]:
        path, query = target(run, representation)
        response = other.get(path, params=query, headers=AUTH)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-ocean-record-id"] == run["record_id"]
        assert response.headers["x-ocean-result-id"] == run["result"]["result_id"]
        assert response.headers["x-content-sha256"] == "sha256:" + hashlib.sha256(response.content).hexdigest()
        assert len(response.content) <= 1_048_576
        assert "真实研究资格未通过" in response.text
        assert str(tmp_path) not in response.text and AUTH["Authorization"] not in response.text
    assert other.get(*target(run)[:1], params=target(run)[1], headers=AUTH).content == original.content
    assert len(other.get(BASE, headers=AUTH).json()["runs"]) == 1


@pytest.mark.parametrize("field", ["record_id", "result_id"])
def test_exact_frozen_identity_is_required_and_never_silently_exports_another_result(tmp_path, field):
    client, source = run_client(tmp_path)
    run = client.post(BASE, headers=AUTH, json=submission(source)).json()
    path, query = target(run, **{field: "sha256:"+"0"*64})
    assert client.get(path, params=query, headers=AUTH).status_code == 409
    assert client.get(path, params={}, headers=AUTH).status_code == 422
    assert client.get(path.replace("/csv", "/pdf"), params=query, headers=AUTH).status_code == 422


def test_exports_check_owner_before_storage_and_failed_tasks_have_no_success_file(tmp_path):
    client, source = run_client(tmp_path)
    path = BASE + "/" + "a"*32 + "/exports/csv"
    query = {"record_id": "sha256:"+"0"*64, "result_id": "sha256:"+"0"*64}
    for headers in [{}, {"Authorization":"Bearer wrong"}]:
        assert client.get(path, params=query, headers=headers).status_code == 401
    assert client.get(path, params=query, headers=AUTH).status_code == 404
    assert not (tmp_path / "runs.sqlite3").exists()
    value = json.loads(source.read_text(encoding="utf-8"))
    for unit in value["conditions"][0]["days"][0]["units"]:
        unit["hours"] = 1e308
    source.write_text(json.dumps(value), encoding="utf-8")
    run = client.post(BASE, headers=AUTH, json=submission(source)).json()
    assert run["state"] == "failed"
    assert client.get(path.replace("a"*32, run["id"]), params={**query, "record_id": run["record_id"]}, headers=AUTH).status_code == 409


def test_csv_source_text_is_formula_safe_and_markdown_remains_plain_text(tmp_path):
    client, source = run_client(tmp_path)
    value = json.loads(source.read_text(encoding="utf-8"))
    value["id"] = '=HYPERLINK("https://example.invalid")'
    value["support_evidence"] = '<script>alert("synthetic")</script>\n| fake |'
    source.write_text(json.dumps(value), encoding="utf-8")
    run = client.post(BASE, headers=AUTH, json=submission(source)).json()
    path, query = target(run)
    response = client.get(path, params=query, headers=AUTH)
    assert response.status_code == 200
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert dict(rows[:rows.index([])])["source_id"].startswith("'=HYPERLINK")
    md = client.get(path.replace("/csv", "/markdown"), params=query, headers=AUTH)
    assert md.status_code == 200 and '<script>' not in md.text and r'\<script\>' in md.text


def test_incomplete_frozen_calendar_is_not_exported_as_a_complete_evidence_file(tmp_path):
    client, source = run_client(tmp_path)
    run = client.post(BASE, headers=AUTH, json=submission(source)).json()
    # Fault-inject a self-consistent stored envelope with incomplete evidence, not a fake service.
    run["result"]["daily"].pop()
    run["result"]["result_id"] = content_id({k:v for k,v in run["result"].items() if k!="result_id"})
    run["record_id"] = content_id({k:v for k,v in run.items() if k!="record_id"})
    with sqlite3.connect(tmp_path / "runs.sqlite3") as db:
        db.execute("UPDATE runs SET payload=?", (json.dumps(run),))
    path, query = target(run)
    response = client.get(path, params=query, headers=AUTH)
    assert response.status_code == 503
