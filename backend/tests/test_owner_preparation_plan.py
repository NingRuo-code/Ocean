"""The registered archive preview only reads the authorized registry."""

import json
import sqlite3
from hashlib import sha256
from pathlib import Path

import pytest
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


def client_for(tmp_path, *sources, bind_manifest=True, executable=False):
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
        "owner_preparation_store_path": (tmp_path / "preparation.sqlite3") if executable else None,
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



def verified_single_day_client(tmp_path, *, corrupt=False):
    original = Path(__file__).resolve().parents[2] / "data/raw/front/2024/front_location20240805.nc"
    digest = "37610c878649fc39eb43a7d1203ea48b14cab7d9c7fa21de2ecad81d0dc8e2c5"
    if not original.is_file() or sha256(original.read_bytes()).hexdigest() != digest:
        pytest.skip("Checked original front member is not installed")
    source = source_registration()
    source["preparation"]["reusable_units"] = []
    client = client_for(tmp_path, source, executable=True)
    path = tmp_path / "artifact-manifest.json"
    manifest = json.loads(path.read_bytes())
    proof = manifest["preparation_evidence"]["zenodo_front_location"]["archive_check"]["sources"]["front"]
    proof["members"][0]["sha256"] = digest
    path.write_text(json.dumps(manifest), encoding="utf-8")
    staged = tmp_path / "raw/front/2024" / original.name
    staged.parent.mkdir(parents=True)
    data = original.read_bytes()
    staged.write_bytes(data[:-1] + bytes([data[-1] ^ 1]) if corrupt else data)
    scoped = {**BODY, "end_date": BODY["start_date"]}
    plan = client.post(API + "/plan", json=scoped, headers=AUTH).json()
    assert plan["can_prepare"] is True
    assert plan["can_execute"] is True
    return client, {"intent_id": "a" * 32, "plan_id": plan["plan_id"], "request": scoped}


def test_real_preparation_auth_bound_intent_and_private_stage_registration(tmp_path):
    client, body = verified_single_day_client(tmp_path)
    assert client.post(API + "/tasks", json=body).status_code == 401
    assert client.post(API + "/tasks", json={**body, "plan_id": "sha256:" + "0" * 64}, headers=AUTH).status_code == 409
    assert not (tmp_path / "preparation.sqlite3").exists()
    response = client.post(API + "/tasks", json=body, headers=AUTH)
    assert response.status_code == 202, response.text
    accepted = response.json()
    assert accepted["state"] == "accepted"
    uri = API + "/tasks/" + accepted["id"]
    assert client.get(uri).status_code == 401
    ready = client.get(uri, headers=AUTH).json()
    assert ready["state_history"] == ["accepted", "processing", "validating", "registering", "ready"]
    assert ready["artifact"]["support"] == {"valid": 19102, "missing": 3298, "front": 411, "resolution_deg": 0.05}
    assert ready["artifact"]["research_ready"] is False
    assert client.get(uri + "/artifact", headers=AUTH).json()["artifact_id"] == ready["artifact"]["artifact_id"]
    assert client.get(API + "/intents/" + body["intent_id"], headers=AUTH).json() == ready
    (tmp_path / "artifact-manifest.json").unlink()
    assert client.post(API + "/tasks", json=body, headers=AUTH).json() == ready
    assert client.post(API + "/tasks", json={**body, "plan_id": "sha256:" + "1" * 64}, headers=AUTH).status_code == 409


def test_failed_real_preparation_records_no_artifact(tmp_path):
    client, body = verified_single_day_client(tmp_path, corrupt=True)
    accepted = client.post(API + "/tasks", json=body, headers=AUTH).json()
    uri = API + "/tasks/" + accepted["id"]
    failed = client.get(uri, headers=AUTH).json()
    assert failed["state_history"] == ["accepted", "processing", "failed"]
    assert failed["artifact"] is None
    assert failed["error"] == "processing_failed"
    assert client.get(uri + "/artifact", headers=AUTH).status_code == 404


def test_history_summary_survives_a_missing_original_and_display_artifact(tmp_path):
    client, body = verified_single_day_client(tmp_path)
    accepted = client.post(API + "/tasks", json=body, headers=AUTH).json()
    uri = API + "/tasks/" + accepted["id"]
    assert client.get(uri + "/evidence").status_code == 401
    evidence = client.get(uri + "/evidence", headers=AUTH).json()
    assert evidence["aggregate"] == {"valid": 19102, "missing": 3298, "front": 411,
                                     "resolution_deg": 0.05, "research_ready": False}
    roles = {role["role"]: role for role in evidence["roles"]}
    assert roles["source_data"]["physical_state"] == "present_unverified"
    assert roles["ordinary_artifact"]["readable_by_owner"] is True
    assert roles["ordinary_artifact"]["published_in_project"] is False
    (tmp_path / "raw/front/2024/front_location20240805.nc").unlink()
    with sqlite3.connect(tmp_path / "preparation.sqlite3") as db:
        db.execute("DELETE FROM preparation_artifacts")
    changed = client.get(uri + "/evidence", headers=AUTH).json()
    assert changed["record_id"] == evidence["record_id"]
    assert changed["aggregate"] == evidence["aggregate"]
    assert changed["original_recomputation"] == "source_missing"
    changed_roles = {role["role"]: role for role in changed["roles"]}
    assert changed_roles["source_data"]["physical_state"] == "missing"
    assert changed_roles["ordinary_artifact"]["physical_state"] == "missing"
    assert client.get(uri + "/artifact", headers=AUTH).status_code == 404



def test_inline_preparation_record_remains_readable(tmp_path):
    client, body = verified_single_day_client(tmp_path)
    accepted = client.post(API + "/tasks", json=body, headers=AUTH).json()
    uri = API + "/tasks/" + accepted["id"]
    from app.analysis_support import content_id

    with sqlite3.connect(tmp_path / "preparation.sqlite3") as db:
        record = json.loads(db.execute("SELECT payload FROM runs").fetchone()[0])
        artifact = json.loads(db.execute("SELECT payload FROM preparation_artifacts").fetchone()[0])
        record.pop("artifact_storage")
        record.pop("finished_at")
        record.pop("record_id")
        record["artifact"] = artifact
        record["record_id"] = content_id(record)
        db.execute("UPDATE runs SET payload=?", (json.dumps(record),))
        db.execute("DROP TABLE preparation_artifacts")
    assert client.get(uri + "/artifact", headers=AUTH).json() == artifact
    evidence = client.get(uri + "/evidence", headers=AUTH).json()
    assert evidence["record_id"] == record["record_id"]
    assert next(row for row in evidence["roles"] if row["role"] == "ordinary_artifact")["physical_state"] == "stored"




def test_evidence_survives_an_unreadable_artifact_lookup(tmp_path, monkeypatch):
    from app.owner_preparation_store import PreparationStore
    from app.synthetic_run_store import RunStoreError

    client, body = verified_single_day_client(tmp_path)
    accepted = client.post(API + "/tasks", json=body, headers=AUTH).json()
    uri = API + "/tasks/" + accepted["id"] + "/evidence"

    def unavailable(*args):
        raise RunStoreError("unavailable")

    monkeypatch.setattr(PreparationStore, "stored_artifact", unavailable)
    evidence = client.get(uri, headers=AUTH).json()
    assert evidence["aggregate"]["valid"] == 19102
    role = next(role for role in evidence["roles"] if role["role"] == "ordinary_artifact")
    assert role["physical_state"] == "unverified"
    assert role["eligible_for_publication"] is False
    assert role["readable_by_owner"] is False




def test_real_task_registers_use_and_owner_can_pin_or_release_only_own_reference(tmp_path, monkeypatch):
    from app import owner_preparation
    from app.owner_preparation_store import PreparationStore

    client, body = verified_single_day_client(tmp_path)
    store = PreparationStore(tmp_path / "preparation.sqlite3")
    observed = []
    original = owner_preparation.run_front_day

    def during_real_process(settings, expected, expires_at):
        observed.append(store.protection("sha256:" + expected["raw_sha256"])["active_references"])
        return original(settings, expected, expires_at)

    monkeypatch.setattr(owner_preparation, "run_front_day", during_real_process)
    accepted = client.post(API + "/tasks", json=body, headers=AUTH).json()
    uri = API + "/tasks/" + accepted["id"]
    evidence = client.get(uri + "/evidence", headers=AUTH).json()
    assert observed == [1]
    source = next(role for role in evidence["roles"] if role["role"] == "source_data")
    assert source["referenced"] is None
    assert evidence["protection"] == {"state": "protected", "pinned": False, "active_references": 1,
                                      "task_reference": True}
    assert client.put(uri + "/protection", json={"pinned": True}).status_code == 401
    assert client.put(uri + "/protection", headers=AUTH, json={"pinned": "yes"}).status_code == 422
    pinned = client.put(uri + "/protection", headers=AUTH, json={"pinned": True}).json()
    assert pinned["pinned"] is True
    artifact = pinned["artifact_id"]
    assert PreparationStore(tmp_path / "preparation.sqlite3").protection(artifact)["state"] == "protected"
    store.change_result_dependency(accepted["id"], "saved_case", "controlled-first-case", True)
    store.change_result_dependency(accepted["id"], "saved_report", "controlled-second-report", True)
    unlocked = client.put(uri + "/protection", headers=AUTH, json={"pinned": False}).json()
    assert unlocked["pinned"] is False
    assert unlocked["active_references"] == 3
    store.change_result_dependency(accepted["id"], "saved_case", "controlled-first-case", False)
    restored = client.get(uri + "/evidence", headers=AUTH).json()
    assert restored["protection"] == {"state": "protected", "pinned": False, "active_references": 2,
                                     "task_reference": True}
    assert restored["record_id"] == evidence["record_id"]




def test_two_executed_tasks_share_one_output_with_independent_references(tmp_path):
    from app.owner_preparation_store import PreparationStore
    from app.synthetic_run_store import RunStoreError

    client, body = verified_single_day_client(tmp_path)
    first = client.post(API + "/tasks", json=body, headers=AUTH).json()
    second = client.post(API + "/tasks", json={**body, "intent_id": "b" * 32}, headers=AUTH).json()
    assert first["id"] != second["id"]
    first_uri = API + "/tasks/" + first["id"]
    second_uri = API + "/tasks/" + second["id"]
    first_detail = client.get(first_uri, headers=AUTH).json()
    second_detail = client.get(second_uri, headers=AUTH).json()
    artifact_id = first_detail["artifact"]["artifact_id"]
    assert second_detail["artifact"]["artifact_id"] == artifact_id
    assert client.put(first_uri + "/result-reference", json={"retained": False}).status_code == 401
    lost_one = client.put(first_uri + "/result-reference", headers=AUTH, json={"retained": False}).json()
    assert lost_one["state"] == "protected"
    assert lost_one["task_reference"] is False
    assert lost_one["active_references"] == 1
    second_evidence = client.get(second_uri + "/evidence", headers=AUTH).json()
    assert second_evidence["protection"]["task_reference"] is True
    store = PreparationStore(tmp_path / "preparation.sqlite3")
    reserved = store.protection(artifact_id)
    with pytest.raises(RunStoreError, match="protection_changed"), store.guard_artifact_cleanup(
        artifact_id, reserved["deletion_guard"]
    ):
        pytest.fail("A live task reference may not pass the cleanup lock")
    released = client.put(second_uri + "/result-reference", headers=AUTH, json={"retained": False}).json()
    assert released["state"] == "unprotected"
    assert released["active_references"] == 0
    current = store.protection(artifact_id)
    with store.guard_artifact_cleanup(artifact_id, current["deletion_guard"]) as db:
        assert db.in_transaction
    assert client.get(first_uri, headers=AUTH).json() == first_detail



def test_recreating_missing_output_does_not_invent_historical_reference_authority(tmp_path):
    client, body = verified_single_day_client(tmp_path)
    first = client.post(API + "/tasks", json=body, headers=AUTH).json()
    uri = API + "/tasks/" + first["id"]
    artifact_id = client.get(uri, headers=AUTH).json()["artifact"]["artifact_id"]
    with sqlite3.connect(tmp_path / "preparation.sqlite3") as db:
        db.execute("DELETE FROM preparation_artifacts WHERE identity=?", (artifact_id,))
        db.execute("DELETE FROM preparation_references WHERE artifact=?", (artifact_id,))
        db.execute("DELETE FROM preparation_reference_registry WHERE artifact=?", (artifact_id,))
    second = client.post(API + "/tasks", json={**body, "intent_id": "b" * 32}, headers=AUTH).json()
    second_uri = API + "/tasks/" + second["id"]
    assert client.get(second_uri, headers=AUTH).json()["artifact"]["artifact_id"] == artifact_id
    released = client.put(second_uri + "/result-reference", headers=AUTH, json={"retained": False}).json()
    assert released["state"] == "unknown"
    assert released["active_references"] is None
