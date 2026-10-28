"""Read-only public report contracts; literals describe CC0 synthetic support only."""

import csv
import io
import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analysis_support import content_id
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


@pytest.mark.parametrize("format", ["markdown", "csv"])
def test_download_is_bound_to_preview_and_preserves_zero_unknown_and_provenance(tmp_path, format):
    client, _ = report_client(tmp_path)
    url, params = selected(client)
    preview = client.get(url + "/report", params=params).json()
    params["report_id"] = preview["report_id"]
    response = client.get(url + "/report/" + format, params=params)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"].startswith('attachment; filename="Ocean-month-2024-02-')
    assert "真实研究资格未通过" in response.text
    if format == "markdown":
        assert "text/markdown" in response.headers["content-type"]
        assert "# Ocean 月度活动报告" in response.text
        assert "40" in response.text and "km²·d" in response.text
        assert "2024\\-02\\-02 | partial\\_support | 0" in response.text
        assert "2024\\-02\\-03 | no\\_records | 未知" in response.text
    else:
        assert "text/csv" in response.headers["content-type"]
        rows = list(csv.reader(io.StringIO(response.text.lstrip("\ufeff"))))
        meta = {r[0]: r[1] for r in rows if len(r) == 2}
        assert meta["report_id"] == preview["report_id"]
        assert meta["total_hours"] == "40.0"
        assert meta["area_time_km2_days"] == "7.0"
        assert meta["calendar_days"] == "29"
        assert [r for r in rows if r and r[0] == "2024-02-02"] == [["2024-02-02", "partial_support", "0.0", "2.0", "2.0"]]
        assert [r for r in rows if r and r[0] == "2024-02-03"] == [["2024-02-03", "no_records", "", "", ""]]


@pytest.mark.parametrize("format", ["markdown", "csv"])
@pytest.mark.parametrize("mode", ["private", "tampered", "projection", "report"])
def test_download_rechecks_access_and_both_preview_identities(tmp_path, format, mode):
    client, path = report_client(tmp_path)
    url, params = selected(client)
    preview = client.get(url + "/report", params=params).json()
    params["report_id"] = preview["report_id"]
    pack = json.loads(path.read_text(encoding="utf-8"))
    if mode == "private":
        pack["snapshots"][0]["access"] = "owner_only"
    elif mode == "tampered":
        pack["snapshots"][0]["result"]["metrics"]["total_hours"] = 999
    elif mode == "projection":
        params["projection_id"] = "sha256:" + "0" * 64
    else:
        params["report_id"] = "sha256:" + "0" * 64
    path.write_text(json.dumps(pack), encoding="utf-8")
    before = path.read_bytes()
    response = client.get(url + "/report/" + format, params=params)
    assert response.status_code == (403 if mode == "private" else 503 if mode == "tampered" else 409)
    assert "content-disposition" not in response.headers
    assert response.headers["cache-control"] == "no-store"
    assert path.read_bytes() == before


@pytest.mark.parametrize("format", ["markdown", "csv"])
def test_zero_result_offline_download_matches_the_same_server_renderer(tmp_path, format):
    client, _ = report_client(tmp_path)
    url, params = selected(client, 1)
    report = client.get(url + "/report", params=params).json()
    params["report_id"] = report["report_id"]
    response = client.get(url + "/report/" + format, params=params)
    offline_path = Path(__file__).parents[2] / "frontend/prototype/data/known-month-reports.js"
    offline = json.loads(offline_path.read_text(encoding="utf-8").split("window.OceanKnownMonthReports = ")[1].rstrip(";\n"))
    assert response.status_code == 200
    assert response.text == offline["exports"][report["report_id"]][format]
    assert report["result"]["metrics"]["total_hours"] == 0


def test_exported_source_text_cannot_inject_spreadsheet_formulas_html_or_links(tmp_path):
    client, path = report_client(tmp_path)
    pack = json.loads(path.read_text(encoding="utf-8"))
    entry = pack["snapshots"][0]
    entry["result"]["source"]["id"] = '\t=HYPERLINK("https://example.invalid")'
    entry["result"]["source"]["support_evidence"] = "<script>alert(1)</script> [click](https://example.invalid)"
    entry["snapshot_sha256"] = content_id(entry["result"])
    path.write_text(json.dumps(pack), encoding="utf-8")
    url, params = selected(client)
    params["report_id"] = client.get(url + "/report", params=params).json()["report_id"]
    csv_text = client.get(url + "/report/csv", params=params).text
    rows = list(csv.reader(io.StringIO(csv_text.lstrip("\ufeff"))))
    assert {r[0]: r[1] for r in rows if len(r) == 2}["source_id"].startswith("'\t=")
    markdown = client.get(url + "/report/markdown", params=params).text
    assert "<script>" not in markdown and "](https://" not in markdown
