"""The registered archive preview only reads the authorized registry."""

import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.owner_preparation import create_owner_preparation_router

API = "/data/owner-preparation"
AUTH = {"Authorization": "Bearer preparation-test"}
SOURCE_VERSION = "sha256:" + "a" * 64
ARTIFACT_ID = "sha256:" + "b" * 64
BODY = {
    "source_id": "verified-front",
    "start_date": "2024-08-05",
    "end_date": "2024-08-06",
    "region_id": "east_china",
    "layers": ["front"],
    "purpose": "map",
    "target": "day_artifact",
}


def source_registration(**changes):
    return {
        "source_id": "verified-front",
        "source_type": "front",
        "display_name": "Controllable registered archive",
        "credential_mode": "none",
        "credential_env_var": None,
        "date_coverage": {"start": "2024-08-01", "end": "2024-08-31"},
        "spatial_coverage": {"prototype_bbox": [120, 27, 128, 34]},
        "preparation": {
            "source_version": SOURCE_VERSION,
            "archive_access": "verified",
            "connector": "verified",
            "processing": "verified",
            "license": "verified",
            "cost": "verified",
            "regions": {"east_china": [120, 27, 128, 34]},
            "layers": ["front"],
            "purposes": ["map"],
            "targets": ["day_artifact"],
            "estimated_bytes_per_unit": 20,
            "reusable_units": [{
                "date": "2024-08-05", "region_id": "east_china", "layer": "front",
                "target": "day_artifact", "source_version": SOURCE_VERSION, "artifact_id": ARTIFACT_ID,
            }],
        },
        **changes,
    }


def client_for(tmp_path, *sources):
    registry = tmp_path / "sources.json"
    registry.write_text(json.dumps({
        "schema_version": "ocean-source-registry/v1", "sources": sources,
    }), encoding="utf-8")
    config = settings.model_copy(update={
        "monthly_execution_token": SecretStr("preparation-test"),
        "owner_preparation_registry_path": registry,
        "raw_data_dir": tmp_path / "raw",
        "cache_dir": tmp_path / "cache",
    })
    app = FastAPI()
    app.include_router(create_owner_preparation_router(config))
    return TestClient(app)


def test_registered_plan_lists_reuse_and_missing_units_without_writes(tmp_path):
    client = client_for(tmp_path, source_registration())
    before = set(tmp_path.rglob("*"))
    assert client.get(API + "/registry").status_code == 401
    assert client.post(API + "/plan", json=BODY).status_code == 401
    registry = client.get(API + "/registry", headers=AUTH)
    assert registry.status_code == 200
    assert registry.json()["sources"][0]["source_id"] == "verified-front"

    response = client.post(API + "/plan", json=BODY, headers=AUTH)
    assert response.status_code == 200, response.text
    plan = response.json()
    assert plan["schema_version"] == "ocean-owner-preparation-plan/v1"
    assert plan["can_prepare"] is True
    assert plan["execution_started"] is False
    assert plan["estimated_preparation_bytes"] == 20
    assert [(unit["date"], unit["state"]) for unit in plan["units"]] == [
        ("2024-08-05", "reusable"), ("2024-08-06", "to_prepare"),
    ]
    assert plan["units"][0]["artifact_id"] == ARTIFACT_ID
    assert client.post(API + "/plan", json=BODY, headers=AUTH).json() == plan
    assert set(tmp_path.rglob("*")) == before


def test_invalid_or_unverified_registration_does_not_claim_preparation(tmp_path):
    blocked = source_registration(
        source_id="credential-needed",
        credential_mode="env_token",
        credential_env_var="OCEAN_SOURCE_T02_TEST_CREDENTIAL",
    )
    blocked["preparation"] = {**blocked["preparation"], "connector": "unsupported", "source_version": None}
    client = client_for(tmp_path, blocked)
    response = client.post(API + "/plan", json={**BODY, "source_id": "credential-needed"}, headers=AUTH)
    assert response.status_code == 200, response.text
    plan = response.json()
    assert plan["can_prepare"] is False
    assert {"credential_unavailable", "connector_unsupported", "source_version_unknown"}.issubset(plan["reasons"])
    assert plan["execution_started"] is False
    assert "OCEAN_SOURCE_T02_TEST_CREDENTIAL" not in response.text
    assert client.post(API + "/plan", json={**BODY, "source_id": "https://example.invalid"}, headers=AUTH).status_code == 422
    assert client.post(API + "/plan", json={**BODY, "source_id": "credential-needed", "region_id": "global"}, headers=AUTH).status_code == 422


def test_configured_credential_still_requires_saved_verification(tmp_path, monkeypatch):
    source = source_registration(
        credential_mode="env_token",
        credential_env_var="OCEAN_SOURCE_T02_TEST_CREDENTIAL",
    )
    monkeypatch.setenv("OCEAN_SOURCE_T02_TEST_CREDENTIAL", "disposable-test-value")
    client = client_for(tmp_path, source)
    plan = client.post(API + "/plan", json=BODY, headers=AUTH)
    assert plan.status_code == 200
    assert plan.json()["can_prepare"] is False
    assert "credential_check_unknown" in plan.json()["reasons"]
    assert "disposable-test-value" not in plan.text
    source["preparation"]["credential_check"] = "verified"
    verified = client_for(tmp_path, source).post(API + "/plan", json=BODY, headers=AUTH).json()
    assert verified["can_prepare"] is True


def test_example_registry_never_asserts_archive_preparation_is_ready():
    config = settings.model_copy(update={
        "monthly_execution_token": SecretStr("preparation-test"),
        "owner_preparation_registry_path": None,
    })
    app = FastAPI()
    app.include_router(create_owner_preparation_router(config))
    client = TestClient(app)
    discovery = client.get(API + "/registry", headers=AUTH)
    assert discovery.status_code == 200, discovery.text
    entry = next(item for item in discovery.json()["sources"] if item["source_id"] == "zenodo_front_location")
    assert "source_version_unknown" in entry["reasons"]
    plan = client.post(API + "/plan", json={**BODY, "source_id": "zenodo_front_location", "region_id": "prototype"},
                       headers=AUTH).json()
    assert plan["can_prepare"] is False
    assert all(unit["state"] == "blocked" for unit in plan["units"])
    assert plan["estimated_preparation_bytes"] is None
