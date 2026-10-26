import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analysis_support import content_id
from app.config import settings
from app.monthly_analysis import create_monthly_router


def client_for(tmp_path):
    path = tmp_path / "published.json"
    path.write_bytes(
        (Path(__file__).parents[1] / "app/examples/regional-known-snapshots.json").read_bytes()
    )
    app = FastAPI()
    app.include_router(create_monthly_router(settings, published_path=path))
    return TestClient(app), path


def test_read_existing_published_month_has_original_identity_values_and_no_execution(tmp_path):
    client, path = client_for(tmp_path)
    catalog = client.get("/api/query/monthly-analysis/published")
    assert catalog.status_code == 200
    assert len(catalog.json()["results"]) == 2
    item = catalog.json()["results"][0]
    result = client.get("/api/query/monthly-analysis/published/" + item["result_id"])
    assert result.status_code == 200
    value = result.json()
    assert (
        value["result_id"]
        == "sha256:d90e75c6573eeccea442e0bded57b5faffb7401bb1ca9b4bef05b2f197b736ea"
    )
    assert value["metrics"]["total_hours"] == 40
    assert value["metrics"]["area_time_km2_days"] == 7
    assert value["metrics"]["supported_days"] == 2
    assert value["metrics"]["calendar_days"] == 29
    assert value["daily"][1]["hours"] == 0
    assert value["daily"][2]["hours"] is None
    assert value["intervals"] is None and value["research_ready"] is False
    assert result.headers["cache-control"] == "no-store"
    assert client.get("/api/query/monthly-analysis/" + item["result_id"]).status_code == 404
    assert str(path) not in result.text


@pytest.mark.parametrize("mode", ["private", "unknown", "not_allowed"])
def test_published_reader_checks_each_source_before_exposing_catalog_or_values(tmp_path, mode):
    client, path = client_for(tmp_path)
    pack = json.loads(path.read_text(encoding="utf-8"))
    first = pack["snapshots"][0]
    identity = first["result"]["result_id"]
    if mode == "not_allowed":
        first["public_aggregate_allowed"] = False
    else:
        first["access"] = "owner_only" if mode == "private" else "unknown"
    first["result"]["private_payload"] = "PRIVATE_DO_NOT_EXPOSE"
    path.write_text(json.dumps(pack), encoding="utf-8")
    catalog = client.get("/api/query/monthly-analysis/published")
    assert catalog.status_code == 200 and len(catalog.json()["results"]) == 1
    response = client.get("/api/query/monthly-analysis/published/" + identity)
    assert response.status_code == 403 and response.headers["cache-control"] == "no-store"
    assert "PRIVATE_DO_NOT_EXPOSE" not in response.text + catalog.text


@pytest.mark.parametrize(
    "mode",
    ["missing", "tampered", "wrong_unit", "false_zero", "inconsistent_total", "real", "invalid_id"],
)
def test_unverifiable_published_sources_fail_without_repair_or_private_locations(tmp_path, mode):
    client, path = client_for(tmp_path)
    if mode == "missing":
        path.unlink()
    else:
        pack = json.loads(path.read_text(encoding="utf-8"))
        entry = pack["snapshots"][0]
        if mode == "real":
            entry["result"]["evidence_kind"] = "real"
        elif mode == "invalid_id":
            entry["result"]["result_id"] = "not-an-id"
        elif mode == "wrong_unit":
            entry["result"]["units"]["total_hours"] = "vessel_count"
        elif mode == "false_zero":
            entry["result"]["daily"][2]["hours"] = 0
        else:
            entry["result"]["metrics"]["total_hours"] = 999
        if mode != "tampered":
            entry["snapshot_sha256"] = content_id(entry["result"])
        path.write_text(json.dumps(pack), encoding="utf-8")
    response = client.get("/api/query/monthly-analysis/published")
    assert response.status_code == 503
    assert str(path) not in response.text and "999" not in response.text


def test_valid_zero_and_wholly_unknown_months_remain_distinct(tmp_path):
    client, path = client_for(tmp_path)
    catalog = client.get("/api/query/monthly-analysis/published").json()
    zero = client.get(
        "/api/query/monthly-analysis/published/" + catalog["results"][1]["result_id"]
    ).json()
    assert zero["metrics"]["total_hours"] == 0 and zero["metrics"]["supported_days"] == 1
    pack = json.loads(path.read_text(encoding="utf-8"))
    entry = pack["snapshots"][0]
    for day in entry["result"]["daily"]:
        day.update(
            state="unprepared",
            hours=None,
            effective_area_km2=None,
            area_time_km2_days=None,
            excluded_units=0,
        )
    entry["result"]["metrics"].update(
        total_hours=None,
        area_time_km2_days=None,
        supported_days=0,
        mean_hours_per_supported_day=None,
        density_hours_per_km2_day=None,
    )
    entry["result"]["status"] = "unavailable"
    entry["snapshot_sha256"] = content_id(entry["result"])
    path.write_text(json.dumps(pack), encoding="utf-8")
    unknown = client.get(
        "/api/query/monthly-analysis/published/" + entry["result"]["result_id"]
    ).json()
    assert unknown["metrics"]["total_hours"] is None and unknown["status"] == "unavailable"


def test_offline_public_bundle_and_api_share_the_same_approved_projection(tmp_path):
    client, _ = client_for(tmp_path)
    root = Path(__file__).parents[2]
    raw = (root / "frontend/prototype/data/published-months.js").read_text(encoding="utf-8")
    offline = json.loads(
        raw.split("window.OceanPublishedMonths = ", 1)[1].strip().removesuffix(";")
    )
    catalog = client.get("/api/query/monthly-analysis/published").json()
    for entry in catalog["results"]:
        live = client.get("/api/query/monthly-analysis/published/" + entry["result_id"]).json()
        assert live == next(r for r in offline["results"] if r["result_id"] == entry["result_id"])
