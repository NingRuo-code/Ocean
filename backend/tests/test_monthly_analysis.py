import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.main import app
from app.monthly_analysis import create_monthly_router

AUTH = {"Authorization": "Bearer synthetic-owner-test"}
REQUEST = {
    "purpose": "monthly_spatial_example",
    "longitude": 124.5,
    "latitude": 30.2,
    "radius_km": 20,
    "month": "2024-02",
    "input_version": "synthetic-month/v1",
    "method_version": "monthly-known-support/v1",
    "parameter_version": "known-unit-membership/v1",
}


def controlled_client(tmp_path, record_limit=64, enabled=True):
    source = tmp_path / "monthly-example.json"
    shutil.copyfile(Path(__file__).parents[1] / "app/examples/monthly-known-units.json", source)
    config = settings.model_copy(
        update={
            "monthly_execution_token": SecretStr("synthetic-owner-test") if enabled else None,
        }
    )
    isolated = FastAPI()
    isolated.include_router(
        create_monthly_router(config, example_path=source, record_limit=record_limit)
    )
    return TestClient(isolated), source


def test_monthly_examples_are_readable_without_running_an_analysis():
    client = TestClient(app)
    response = client.get("/api/query/monthly-analysis/examples")
    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence_kind"] == "synthetic_example"
    assert payload["research_ready"] is False
    assert len(payload["conditions"]) >= 3
    assert {c["month"] for c in payload["conditions"]} == {"2024-02", "2024-03"}
    assert len({(c["longitude"], c["latitude"]) for c in payload["conditions"]}) == 2
    assert client.post("/api/query/monthly-analysis", json={}).status_code in {401, 403, 422, 503}


def test_explicit_month_submission_computes_a_hand_worked_leap_calendar_and_freezes_reading(
    tmp_path,
):
    client, source = controlled_client(tmp_path)
    response = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH)
    assert response.status_code == 200
    run = response.json()
    assert run["state"] == "completed"
    result = run["result"]
    assert result["parameters"] == REQUEST
    assert result["evidence_kind"] == "synthetic_example"
    assert result["research_ready"] is False
    assert len(result["daily"]) == 29
    assert result["daily"][-1]["date"] == "2024-02-29"
    # Day 1: 30+10 hours over 2+3 km²; day 2: explicit 0 over 2 km².
    # The unsupported unit on day 2 contributes to neither side of H/E.
    metrics = result["metrics"]
    assert metrics["total_hours"] == 40
    assert metrics["supported_days"] == 2
    assert metrics["area_time_km2_days"] == 7
    assert metrics["mean_hours_per_supported_day"] == 20
    assert metrics["density_hours_per_km2_day"] == pytest.approx(40 / 7)
    assert result["daily"][1]["hours"] == 0
    assert result["daily"][2]["state"] == "no_records"
    assert result["daily"][3]["state"] == "missing"
    assert result["daily"][4]["state"] == "unprepared"
    assert result["daily"][5]["state"] == "read_failed"
    # Ordinary reading must use the frozen result, even if source is gone.
    source.unlink()
    reopened = client.get("/api/query/monthly-analysis/" + run["id"])
    assert reopened.status_code == 200
    assert reopened.json() == run


def test_a_different_month_and_point_use_their_own_support_without_changing_old_runs(tmp_path):
    client, _ = controlled_client(tmp_path)
    feb = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH).json()
    march_request = {**REQUEST, "month": "2024-03"}
    march = client.post("/api/query/monthly-analysis", json=march_request, headers=AUTH).json()
    second_request = {**march_request, "longitude": 125.5, "latitude": 31.2, "radius_km": 10}
    second = client.post("/api/query/monthly-analysis", json=second_request, headers=AUTH).json()
    assert march["result"]["metrics"]["calendar_days"] == 31
    assert march["result"]["metrics"]["total_hours"] == 6
    assert march["result"]["metrics"]["density_hours_per_km2_day"] == 1
    assert second["result"]["metrics"]["total_hours"] == 12
    assert second["result"]["metrics"]["density_hours_per_km2_day"] == 3
    assert second["result"]["parameters"] == second_request
    assert len({r["result"]["result_id"] for r in [feb, march, second]}) == 3
    assert client.get("/api/query/monthly-analysis/" + feb["id"]).json() == feb


@pytest.mark.parametrize("area,expected", [(4, 0), (0, None), (None, None)])
def test_explicit_zero_is_distinct_from_zero_or_unknown_area(tmp_path, area, expected):
    client, source = controlled_client(tmp_path)
    data = json.loads(source.read_text(encoding="utf-8"))
    data["conditions"][0]["days"] = [
        {
            "date": "2024-02-01",
            "state": "ready",
            "units": [
                {
                    "id": "known-zero",
                    "hours": 0,
                    "area_km2": area,
                    "front_support": "valid",
                    "effort_support": "valid",
                }
            ],
        }
    ]
    source.write_text(json.dumps(data), encoding="utf-8")
    run = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH).json()
    assert run["state"] == "completed"
    metrics = run["result"]["metrics"]
    assert metrics["total_hours"] == expected
    assert metrics["mean_hours_per_supported_day"] == expected
    assert metrics["density_hours_per_km2_day"] == expected
    assert metrics["area_time_km2_days"] == (4 if area == 4 else None)
    assert metrics["supported_days"] == (1 if area == 4 else 0)


def test_owner_execution_and_public_read_are_separate_and_closed_by_default(tmp_path):
    client, _ = controlled_client(tmp_path)
    assert client.post("/api/query/monthly-analysis", json=REQUEST).status_code == 401
    assert (
        client.post(
            "/api/query/monthly-analysis", json=REQUEST, headers={"Authorization": "Bearer wrong"}
        ).status_code
        == 401
    )
    run = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH).json()
    public = client.get("/api/query/monthly-analysis/" + run["id"])
    assert public.status_code == 200
    text = public.text
    assert "synthetic-owner-test" not in text
    assert str(tmp_path) not in text
    assert '"units":[' not in text  # No per-unit source records.
    disabled, _ = controlled_client(tmp_path, enabled=False)
    assert (
        disabled.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH).status_code == 503
    )
    assert disabled.get("/api/query/monthly-analysis/examples").status_code == 200
    # A new process-local adapter never silently recreates an old execution.
    assert disabled.get("/api/query/monthly-analysis/" + run["id"]).status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        {"longitude": 120.0},
        {"radius_km": 30},
        {"month": "2024-04"},
        {"input_version": "unknown"},
        {"method_version": "unknown"},
        {"parameter_version": "unknown"},
        {"purpose": "real_monthly_research"},
        {"source_path": "private-input"},
        {"research_ready": True},
        {"longitude": True},
        {"month": "2024-13"},
    ],
)
def test_unsupported_conditions_and_client_supplied_privileges_are_rejected(tmp_path, change):
    client, _ = controlled_client(tmp_path)
    response = client.post("/api/query/monthly-analysis", json={**REQUEST, **change}, headers=AUTH)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "damage",
    [
        "missing",
        "invalid-json",
        "duplicate-day",
        "duplicate-unit",
        "wrong-month",
        "real-source",
        "not-public",
        "unit-conflict",
    ],
)
def test_source_failure_produces_a_readable_failed_run_without_half_a_result(tmp_path, damage):
    client, source = controlled_client(tmp_path)
    data = json.loads(source.read_text(encoding="utf-8"))
    if damage == "missing":
        source.unlink()
    elif damage == "invalid-json":
        source.write_text('{"invalid":', encoding="utf-8")
    else:
        circle = data["conditions"][0]
        if damage == "duplicate-day":
            circle["days"].append(circle["days"][0])
        elif damage == "duplicate-unit":
            circle["days"][0]["units"].append(circle["days"][0]["units"][0])
        elif damage == "wrong-month":
            circle["days"][0]["date"] = "2024-03-01"
        elif damage == "real-source":
            data["evidence_kind"] = "real"
        elif damage == "not-public":
            data["public_aggregate_allowed"] = False
        else:
            data["unit"] = "minutes"
        source.write_text(json.dumps(data), encoding="utf-8")
    response = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH)
    assert response.status_code == 200
    run = response.json()
    assert run["state"] == "failed"
    assert run["result"] is None
    assert run["error"] == {"code": "input_unavailable_or_invalid"}
    assert run["state_history"] == ["submitted", "running", "failed"]
    assert str(tmp_path) not in response.text
    assert client.get("/api/query/monthly-analysis/" + run["id"]).json() == run


def test_capacity_rejects_new_execution_and_preserves_frozen_results(tmp_path):
    client, source = controlled_client(tmp_path, record_limit=1)
    first = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH).json()
    response = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH)
    assert response.status_code == 503
    source.unlink()
    assert client.get("/api/query/monthly-analysis/" + first["id"]).json() == first


def test_concurrent_submissions_keep_their_original_conditions_and_results(tmp_path):
    client, _ = controlled_client(tmp_path)
    requests = [REQUEST, {**REQUEST, "month": "2024-03"}]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(client.post, "/api/query/monthly-analysis", json=r, headers=AUTH)
            for r in requests
        ]
        runs = [f.result().json() for f in futures]
    assert runs[0]["id"] != runs[1]["id"]
    for request, run, expected in zip(requests, runs, [40, 6], strict=True):
        assert run["state"] == "completed"
        assert run["request"] == request
        assert run["result"]["parameters"] == request
        assert run["result"]["metrics"]["total_hours"] == expected
        assert client.get("/api/query/monthly-analysis/" + run["id"]).json() == run


def test_excessively_nested_corrupt_source_is_a_frozen_failure_not_a_server_error(tmp_path):
    client, source = controlled_client(tmp_path)
    source.write_text("[" * 1200 + "0" + "]" * 1200, encoding="utf-8")
    response = client.post("/api/query/monthly-analysis", json=REQUEST, headers=AUTH)
    assert response.status_code == 200
    run = response.json()
    assert run["state"] == "failed" and run["result"] is None
    assert client.get("/api/query/monthly-analysis/" + run["id"]).json() == run
    assert client.get("/api/query/monthly-analysis/examples").status_code == 503
