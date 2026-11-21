"""The owner aggregate CSV preserves authorized source values and independent protection."""

import csv
import json
import sqlite3
from hashlib import sha256
from io import StringIO

from test_synthetic_cases import AUTH, BASE, case_client, save_request


def test_csv_artifact_is_checked_and_protected_for_the_exact_frozen_case(tmp_path, monkeypatch):
    from app import saved_case_store

    client, published = case_client(tmp_path)
    request = {**save_request(client), "title": "=私人标题", "note": "不进入汇总", "tags": ["私有"]}
    saved = client.post(BASE + "/cases", headers=AUTH, json=request).json()
    url = BASE + f"/cases/{saved['case_id']}/versions/1/exports/aggregate-csv"
    query = {"version_id": saved["version_id"], "report_id": saved["report"]["report_id"]}
    assert client.post(url, params=query).status_code == 401
    assert client.get(url, headers=AUTH, params=query).status_code == 404
    assert client.post(url, params={**query, "version_id": "sha256:" + "0" * 64}, headers=AUTH).status_code == 409
    published.unlink()
    response = client.post(url, headers=AUTH, params=query)
    assert response.status_code == 200, response.text
    manifest = response.json()
    assert manifest["protection"] == "saved_case"
    assert manifest["version_id"] == saved["version_id"]
    binary = client.get(url, headers=AUTH, params=query)
    assert binary.status_code == 200
    assert len(binary.content) == manifest["byte_length"]
    assert "sha256:" + sha256(binary.content).hexdigest() == manifest["sha256"]
    assert binary.headers["X-Ocean-Artifact-SHA256"] == manifest["sha256"]
    assert binary.headers["content-type"].startswith("text/csv")
    assert "私人标题" not in binary.text and "不进入汇总" not in binary.text
    rows = list(csv.DictReader(StringIO(binary.content.decode("utf-8"))))
    month = {row["metric"]: row for row in rows if row["scope"] == "month"}
    assert month["total_hours"]["value"] == "40.0"
    assert month["total_hours"]["unit"] == "h"
    assert month["area_time_km2_days"]["value"] == "7.0"
    assert month["area_time_km2_days"]["unit"] == "km2*d"
    assert month["interval"]["value_state"] == "not_estimated"
    assert float(month["density_hours_per_km2_day"]["value"]) == 40 / 7
    assert {row["value_state"] for row in rows if row["scope"] == "day" and row["metric"] == "hours"} == {
        "known", "known_zero", "unknown",
    }
    assert {row["version_id"] for row in rows} == {saved["version_id"]}
    assert {row["region_id"] for row in rows} == {rows[0]["region_id"]}
    assert {row["group_id"] for row in rows} == {rows[0]["group_id"]}
    assert len({row["window_id"] for row in rows}) == 30
    assert len({row["window_id"] for row in rows if row["scope"] == "month"}) == 1

    def no_regeneration(*args):
        raise AssertionError("stored aggregate must be read rather than rendered again")

    monkeypatch.setattr(saved_case_store, "render_case_aggregate_csv", no_regeneration)
    assert client.post(url, headers=AUTH, params=query).json() == manifest
    assert client.get(url, headers=AUTH, params=query).content == binary.content
    assert client.get(url, params=query).status_code == 401
    with sqlite3.connect(tmp_path / "cases.sqlite3") as db:
        assert db.execute("SELECT count(*) FROM case_export_artifacts").fetchone()[0] == 1
        db.execute("DELETE FROM preparation_references WHERE artifact=?", (manifest["artifact_id"],))
    assert client.get(url, headers=AUTH, params=query).status_code == 503




def test_unavailable_public_projection_has_undefined_mean_and_safe_provenance(tmp_path):
    from app.analysis_support import content_id

    client, published = case_client(tmp_path)
    packed = json.loads(published.read_bytes())
    entry = packed["snapshots"][0]
    result = entry["result"]
    result["status"] = "unavailable"
    result["metrics"].update(total_hours=None, area_time_km2_days=None, supported_days=0,
                             mean_hours_per_supported_day=None, density_hours_per_km2_day=None)
    for day in result["daily"]:
        day.update(state="unprepared", hours=None, effective_area_km2=None, area_time_km2_days=None, excluded_units=0)
    result["coverage"].update(status="unavailable", excluded_day_states={"unprepared": len(result["daily"])},
                              excluded_units=0)
    result["source"]["id"] = "C:private-metadata.txt"
    result["source"]["input_sha256"] = content_id(result["daily"])
    result["result_id"] = content_id({"controlled": "no support", "daily": result["daily"]})
    entry["snapshot_sha256"] = content_id(result)
    published.write_text(json.dumps(packed), encoding="utf-8")
    request = save_request(client)
    saved = client.post(BASE + "/cases", headers=AUTH, json=request).json()
    url = BASE + f"/cases/{saved['case_id']}/versions/1/exports/aggregate-csv"
    params = {"version_id": saved["version_id"], "report_id": saved["report"]["report_id"]}
    assert client.post(url, headers=AUTH, params=params).status_code == 200
    response = client.get(url, headers=AUTH, params=params)
    rows = list(csv.DictReader(StringIO(response.text)))
    month = {row["metric"]: row for row in rows if row["scope"] == "month"}
    assert month["mean_hours_per_supported_day"]["value_state"] == "not_applicable"
    assert month["density_hours_per_km2_day"]["value_state"] == "unknown"
    assert month["interval"]["value_state"] == "not_estimated"
    assert {row["source_id"] for row in rows} == {"unknown"}
    assert {row["source_input_id"] for row in rows} == {result["source"]["input_sha256"]}
    assert "private-metadata" not in response.text
