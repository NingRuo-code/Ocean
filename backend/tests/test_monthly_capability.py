from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.monthly_analysis import create_monthly_router

QUERY = {"month": "2024-02", "longitude": 124.5, "latitude": 30.2, "radius_km": 20}


def test_capability_echoes_fixed_month_and_never_promotes_a_saved_example_to_execution():
    client = TestClient(app)
    response = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert response.status_code == 200
    data = response.json()
    assert data["request"] == {**QUERY, "scheme": "monthly-main"}
    assert data["schema_version"] == "ocean-month-capability/v1"
    assert data["request_id"].startswith("sha256:")
    assert data["capability_id"].startswith("sha256:")
    assert data["checked_at"].endswith("+00:00")
    assert data["qualification"]["status"] == "not_handed_off"
    assert data["execution"] == {
        "status": "not_implemented",
        "can_submit": False,
        "permission": "not_checked",
    }
    assert data["versions"] == {
        "input": None,
        "method": None,
        "parameter": None,
        "qualification": None,
    }
    assert len(data["saved_results"]) == 1
    assert data["saved_results"][0]["evidence_kind"] == "synthetic_example"
    assert data["saved_results"][0]["parameters"]["month"] == "2024-02"
    assert response.headers["cache-control"] == "no-store"


def test_registered_results_are_exact_point_month_radius_matches_and_not_geo_window_matches():
    client = TestClient(app)
    first = client.get("/api/query/monthly-analysis/capability", params=QUERY).json()
    for override in [{"month": "2024-03"}, {"longitude": 124.6}, {"radius_km": 10}]:
        data = client.get(
            "/api/query/monthly-analysis/capability", params={**QUERY, **override}
        ).json()
        assert data["saved_results"] == []
        assert data["request_id"] != first["request_id"]
        assert data["qualification"]["status"] == "not_handed_off"
        assert data["execution"]["can_submit"] is False


def test_invalid_or_unfrozen_condition_queries_are_rejected_without_execution():
    client = TestClient(app)
    for override in [
        {"month": "2024-2"},
        {"longitude": 181},
        {"latitude": "nan"},
        {"radius_km": 15},
        {"scheme": "custom"},
    ]:
        assert (
            client.get(
                "/api/query/monthly-analysis/capability", params={**QUERY, **override}
            ).status_code
            == 422
        )


def test_unreadable_registry_stays_service_unavailable_without_reconstructing_source(tmp_path):
    isolated = FastAPI()
    path = tmp_path / "missing.json"
    isolated.include_router(create_monthly_router(settings, published_path=path))
    r = TestClient(isolated).get("/api/query/monthly-analysis/capability", params=QUERY)
    assert r.status_code == 503
    assert str(path) not in r.text
    assert r.headers["cache-control"] == "no-store"


def test_private_or_unapproved_entries_never_become_capability_references(tmp_path):
    import json

    source = Path(__file__).parents[1] / "app/examples/regional-known-snapshots.json"
    data = json.loads(source.read_text(encoding="utf-8"))
    for entry in data["snapshots"]:
        entry["access"] = "owner_only"
        entry["result"]["source"]["id"] = "private-source-marker"
    path = tmp_path / "registered.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    isolated = FastAPI()
    isolated.include_router(create_monthly_router(settings, published_path=path))
    response = TestClient(isolated).get("/api/query/monthly-analysis/capability", params=QUERY)
    assert response.status_code == 200
    assert response.json()["saved_results"] == []
    assert "private-source-marker" not in response.text
    assert response.json()["execution"]["can_submit"] is False
