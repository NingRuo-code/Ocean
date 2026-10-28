"""Read-only public report contracts; literals describe CC0 synthetic support only."""

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.monthly_analysis import create_monthly_router


def report_client(tmp_path):
    path = tmp_path / "published.json"
    path.write_bytes(
        (Path(__file__).parents[1] / "app/examples/regional-known-snapshots.json").read_bytes()
    )
    app = FastAPI()
    app.include_router(
        create_monthly_router(settings, published_path=path, example_path=tmp_path / "absent.json")
    )
    return TestClient(app), path


def selected(client, index=0):
    item = client.get("/api/query/monthly-analysis/published").json()["results"][index]
    return (
        "/api/query/monthly-analysis/published/" + item["result_id"],
        {"projection_id": item["projection_id"]},
    )


def test_report_reads_same_frozen_month_with_units_calendar_and_no_scientific_input(tmp_path):
    client, path = report_client(tmp_path)
    url, params = selected(client)
    result = client.get(url).json()
    response = client.get(url + "/report", params=params)
    assert response.status_code == 200
    report = response.json()
    assert report["schema_version"] == "ocean-known-month-report/v1"
    assert report["report_version"] == "known-month-report/v1"
    assert report["result"] == result
    assert report["result"]["metrics"]["total_hours"] == 40
    assert report["result"]["metrics"]["area_time_km2_days"] == 7
    assert report["result"]["metrics"]["supported_days"] == 2
    assert report["result"]["metrics"]["calendar_days"] == 29
    assert report["result"]["daily"][1]["hours"] == 0
    assert report["result"]["daily"][2]["hours"] is None
    assert "关系" in report["interpretation"]["relationship"]
    assert "未估计" in report["interpretation"]["intervals"]
    assert report["result"]["research_ready"] is False
    assert client.get(url + "/report", params=params).json() == report
    assert response.headers["cache-control"] == "no-store"
    assert str(path) not in response.text


@pytest.mark.parametrize("mode", ["private", "unknown", "not_allowed", "tampered", "changed"])
def test_report_rechecks_permission_integrity_and_selected_projection(tmp_path, mode):
    client, path = report_client(tmp_path)
    url, params = selected(client)
    pack = json.loads(path.read_text(encoding="utf-8"))
    entry = pack["snapshots"][0]
    if mode in {"private", "unknown"}:
        entry["access"] = "owner_only" if mode == "private" else "unknown"
    elif mode == "not_allowed":
        entry["public_aggregate_allowed"] = False
    elif mode == "tampered":
        entry["result"]["metrics"]["total_hours"] = 999
    else:
        params["projection_id"] = "sha256:" + "0" * 64
    path.write_text(json.dumps(pack), encoding="utf-8")
    response = client.get(url + "/report", params=params)
    assert response.status_code == (503 if mode == "tampered" else 409 if mode == "changed" else 403)
    assert response.headers["cache-control"] == "no-store"
    assert str(path) not in response.text
    assert "report_id" not in response.text


def test_shipped_offline_reports_are_the_same_as_verified_service_reports(tmp_path):
    client, _ = report_client(tmp_path)
    path = Path(__file__).parents[2] / "frontend/prototype/data/known-month-reports.js"
    offline = json.loads(path.read_text(encoding="utf-8").split("window.OceanKnownMonthReports = ")[1].rstrip(";\n"))
    for i in range(2):
        url, params = selected(client, i)
        report = client.get(url + "/report", params=params).json()
        assert report == offline["reports"][i]
    assert offline["reports"][1]["result"]["metrics"]["total_hours"] == 0
