"""The registered archive preview only reads the authorized registry."""

import json
from hashlib import sha256

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.owner_preparation import (
    adapter_fingerprints,
    archive_catalog_digest,
    create_owner_preparation_router,
)

API = "/data/owner-preparation"
AUTH = {"Authorization": "Bearer preparation-test"}
SOURCE_VERSION = "sha256:" + archive_catalog_digest()
ARTIFACT_ID = "sha256:" + "b" * 64
BODY = {
    "source_id": "zenodo_front_location",
    "start_date": "2024-08-05",
    "end_date": "2024-08-06",
    "region_id": "east_china",
    "layers": ["front"],
    "purpose": "map",
    "target": "day_artifact",
}


def source_registration(**changes):
    return {
        "source_id": "zenodo_front_location",
        "source_type": "front",
        "display_name": "Controllable registered archive",
        "credential_mode": "none",
        "credential_env_var": None,
        "access_level": "public",
        "authorization_scope": "public_open_data",
        "license": "CC BY 4.0",
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


def client_for(tmp_path, *sources, bind_manifest=True):
    registry = tmp_path / "sources.json"
    registry.write_text(json.dumps({
        "schema_version": "ocean-source-registry/v1", "sources": sources,
    }), encoding="utf-8")
    manifest = tmp_path / "artifact-manifest.json"
    connector, processor = adapter_fingerprints()
    recorded_units = next((source["preparation"]["reusable_units"] for source in sources
                           if source["source_id"] == "zenodo_front_location"), [])
    if bind_manifest:
        manifest.write_text(json.dumps({
            "schema_version": "ocean-artifact-manifest/v1",
            "registry_id": "sha256:" + sha256(registry.read_bytes()).hexdigest(),
            "preparation_evidence": {"zenodo_front_location": {
                "source_version": SOURCE_VERSION,
                "archive_check": {
                    "schema": "ocean-august-archive-member-check/v1",
                    "month": "2024-08",
                    "catalog_sha256": archive_catalog_digest(),
                    "sources": {"front": {"record": 20356239, "members": [
                        {"date": "2024-08-05", "name": "front_location20240805.nc", "status": "matched", "sha256": "c" * 64},
                        {"date": "2024-08-06", "name": "front_location20240806.nc", "status": "matched", "sha256": "d" * 64},
                    ]}},
                },
                "connector_sha256": connector,
                "processor_sha256": processor,
                "license_evidence_id": "sha256:" + "e" * 64,
                "cost_evidence_id": "sha256:" + "f" * 64,
                "reusable_units": recorded_units,
            }},
        }), encoding="utf-8")
    config = settings.model_copy(update={
        "monthly_execution_token": SecretStr("preparation-test"),
        "owner_preparation_registry_path": registry,
        "owner_preparation_manifest_path": manifest if bind_manifest else None,
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
    assert registry.json()["sources"][0]["source_id"] == "zenodo_front_location"

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
    rejected = client.post(API + "/plan", json={**BODY, "source_id": "https://example.invalid/private",
                                             "credential_path": "/private/fixture-token"}, headers=AUTH)
    assert rejected.status_code == 422
    assert rejected.headers["cache-control"] == "no-store"
    assert "example.invalid" not in rejected.text
    assert "fixture-token" not in rejected.text
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


def test_registry_flags_cannot_replace_an_archive_receipt_and_revoked_scope_changes_plan(tmp_path):
    source = source_registration()
    client = client_for(tmp_path, source, bind_manifest=False)
    unverified = client.post(API + "/plan", json=BODY, headers=AUTH).json()
    assert unverified["can_prepare"] is False
    assert "archive_manifest_unverified" in unverified["reasons"]
    assert all(unit["state"] == "blocked" for unit in unverified["units"])

    client = client_for(tmp_path, source)
    original = client.post(API + "/plan", json=BODY, headers=AUTH).json()
    assert original["can_prepare"] is True
    registry_path = tmp_path / "sources.json"
    raw = json.loads(registry_path.read_bytes())
    raw["sources"][0]["authorization_scope"] = "revoked"
    registry_path.write_text(json.dumps(raw), encoding="utf-8")
    revoked = client.post(API + "/plan", json=BODY, headers=AUTH).json()
    assert revoked["plan_id"] != original["plan_id"]
    assert revoked["registry_id"] != original["registry_id"]
    assert revoked["can_prepare"] is False
    assert "authorization_unverified" in revoked["reasons"]


def test_proved_reuse_does_not_depend_on_new_preparation_credential(tmp_path):
    source = source_registration(credential_mode="env_token",
                                 credential_env_var="OCEAN_SOURCE_T02_ABSENT_CREDENTIAL")
    client = client_for(tmp_path, source)
    plan = client.post(API + "/plan", json=BODY, headers=AUTH).json()
    assert plan["can_prepare"] is False
    assert "credential_unavailable" in plan["reasons"]
    assert [unit["state"] for unit in plan["units"]] == ["reusable", "blocked"]


def test_catalog_dates_and_adapter_scope_limit_ready_units(tmp_path):
    source = source_registration(date_coverage={"start": "2024-08-01", "end": "2024-09-30"})
    units = source["preparation"]["reusable_units"]
    units.extend([{**units[0], "date": "2024-09-01"}, {**units[0], "date": "2024-08-09"}])
    source["preparation"]["layers"].append("sst")
    source["preparation"]["purposes"].append("A_month")
    source["preparation"]["targets"].append("support_input")
    client = client_for(tmp_path, source)
    path = tmp_path / "artifact-manifest.json"
    manifest = json.loads(path.read_bytes())
    archive = manifest["preparation_evidence"]["zenodo_front_location"]["archive_check"]["sources"]["front"]
    archive["members"].extend([
        {"date": "2024-09-01", "name": "front_location20240901.nc", "status": "matched", "sha256": "c" * 64},
        {"date": "2024-08-07", "name": "front_location20240808.nc", "status": "matched", "sha256": "d" * 64},
        {"date": "2024-08-08", "name": "front_location20240808.nc", "status": "crc_mismatch"},
    ])
    path.write_text(json.dumps(manifest), encoding="utf-8")
    for day in ["2024-08-07", "2024-08-08", "2024-09-01"]:
        plan = client.post(API + "/plan", json={**BODY, "start_date": day, "end_date": day}, headers=AUTH).json()
        assert plan["can_prepare"] is False
        assert plan["units"][0]["state"] == "blocked"
        assert "archive_unit_evidence_unknown" in plan["reasons"]
    reuse_date = {"start_date": "2024-08-09", "end_date": "2024-08-09"}
    reuse = client.post(API + "/plan", json={**BODY, **reuse_date}, headers=AUTH).json()
    assert reuse["units"][0]["state"] == "reusable"
    assert "archive_unit_evidence_unknown" not in reuse["reasons"]
    for override in [{"layers": ["sst"]}, {"purpose": "A_month"}, {"target": "support_input"}]:
        plan = client.post(API + "/plan", json={**BODY, **override}, headers=AUTH).json()
        assert plan["can_prepare"] is False
        assert "scope_adapter_unsupported" in plan["reasons"]
    assert client.post(API + "/plan", json=BODY, headers=AUTH).json()["can_prepare"] is True
