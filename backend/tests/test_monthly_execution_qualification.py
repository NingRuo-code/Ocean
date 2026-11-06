"""Real P0 CLI output gates explicit monthly submission before any detailed read."""

import hashlib
import json
import subprocess
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from test_monthly_distance_reference import AUTH, URL, layer, reference_fixture

from app.config import settings
from app.monthly_analysis import create_monthly_router
from app.monthly_models import MonthlyResearchApproval

CLI = Path(__file__).resolve().parents[2] / "tools" / "audit-research-baseline.mjs"


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


def fixture(
    tmp_path,
    *,
    missing_day=False,
    layer_use="front_effort",
    snapshot_source_differs=False,
    blocked_license=False,
    audited_contract_fixture=False,
    stale_runtime=False,
):
    reference = reference_fixture()
    reference["conditions"]["layer_use"] = layer_use
    front = layer("front", [-0.4, -0.4, 0.4, 0.4])
    activity = layer("activity", [-0.4, -0.4, 0.4, 0.4], 40)
    dates = [f"2024-08-{day:02d}" for day in range(1, 31 if missing_day else 32)]
    cells = reference["regional_cells"]
    cells["days"] = [{"date": date, "layers": [front, activity]} for date in dates]
    if audited_contract_fixture:
        # Exercises the audited-cells protocol with invented evidence in a disposable test app.
        cells["evidence_kind"] = "audited_cells"
        evidence_id = "sha256:" + "1" * 64
        cells["qualification_evidence"] = {
            "schema": "ocean-support-evidence/v1",
            "source_versions": dict.fromkeys(("front-original", "effort-original"), evidence_id),
            "processing_version": evidence_id,
            "license": {"state": "verified", "evidence_id": evidence_id},
            "quality_rule": {
                "state": "verified",
                "evidence_id": evidence_id,
                "id": "complete-common-support/v1",
            },
            "geometry": {
                "circle": {
                    "state": "verified",
                    "evidence_id": evidence_id,
                    "request_geometry": reference["conditions"]["geometries"][0],
                },
            },
        }
    if blocked_license:
        cells["qualification_evidence"] = {
            "schema": "ocean-support-evidence/v1",
            "license": {"state": "blocked"},
        }
    reference["front_days"] = [
        {"date": date, "source_id": "front-original", "lines": []} for date in dates
    ]
    conditions_file = tmp_path / "conditions.json"
    cells_file = tmp_path / "audited-cells.json"
    snapshot = tmp_path / "support.json"
    reference_file = tmp_path / "reference.json"
    conditions_file.write_bytes(encoded(reference["conditions"]))
    cells_file.write_bytes(encoded(cells))
    run = subprocess.run(
        [
            "node",
            str(CLI),
            "--support-request",
            str(conditions_file),
            "--regional-input",
            str(cells_file),
            "--out",
            str(snapshot),
        ],
        capture_output=True,
        timeout=30,
        check=False,
    )
    assert run.returncode == 0, run.stderr
    if snapshot_source_differs:
        reference["regional_cells"]["days"][0]["layers"][1]["cells"][0]["hours"] = 80
    reference_raw = encoded(reference)
    reference_file.write_bytes(reference_raw)
    expected = json.loads(snapshot.read_bytes())
    if stale_runtime:
        expected["method"]["GEOS"] = "0.0.0"
        del expected["support_snapshot_id"]
        expected["support_snapshot_id"] = "sha256:" + hashlib.sha256(encoded(expected)).hexdigest()
        snapshot.write_bytes(encoded(expected))
    request = {
        "purpose": "monthly_distance_reference",
        "month": "2024-08",
        "longitude": 0,
        "latitude": 0,
        "radius_km": 10,
        "layer_use": layer_use,
        "support_snapshot_id": expected["support_snapshot_id"],
        "input_version": "sha256:" + hashlib.sha256(reference_raw).hexdigest(),
        "method_version": "wgs84-distance-bands/v1",
        "parameter_version": "half-open-bands/v1",
    }
    return configured_client(snapshot, reference_file), reference_file, request, expected


def configured_client(snapshot, reference_file, approval=None):
    app = FastAPI()
    app.include_router(
        create_monthly_router(
            settings.model_copy(
                update={
                    "monthly_execution_token": SecretStr("reference-test"),
                    "monthly_distance_input_path": reference_file,
                    "monthly_research_input_path": reference_file if approval else None,
                    "monthly_research_approval": approval,
                    "support_snapshot_path": snapshot,
                    "support_state_path": None,
                }
            )
        )
    )
    return TestClient(app)


def test_explicit_reference_submission_uses_exact_p0_full_month_evidence(tmp_path):
    client, _, request, expected = fixture(tmp_path)
    assert client.post(URL, json=request).status_code == 401
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    assert result["qualification"]["snapshot_id"] == expected["support_snapshot_id"]
    assert result["qualification"]["scope"] == "frozen_synthetic_validation"
    assert result["research_ready"] is False


@pytest.mark.parametrize("conditions", [{"missing_day": True}, {"layer_use": "front_effort_sst"}])
def test_incomplete_required_support_rejects_before_opening_detailed_input(tmp_path, conditions):
    client, reference_file, request, _ = fixture(tmp_path, **conditions)
    reference_file.unlink()
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    detail = denied.json()["detail"]
    assert detail["reason"] == "incomplete_required_support"
    assert detail["support"]["month"]["included_days"] < 31
    assert detail["can_execute"] is False


def test_stale_condition_version_and_synthetic_research_attempt_are_rejected(tmp_path):
    client, reference_file, request, _ = fixture(tmp_path)
    reference_file.unlink()
    for changes, reason in [
        ({"support_snapshot_id": "sha256:" + "1" * 64}, "support_snapshot_identity_mismatch"),
        ({"radius_km": 20}, "requested_geometry_not_in_snapshot"),
        ({"month": "2024-09"}, "requested_conditions_not_in_snapshot"),
        ({"layer_use": "front_effort_sst"}, "requested_conditions_not_in_snapshot"),
        ({"method_version": "wrong"}, "analysis_method_or_parameter_version_mismatch"),
        ({"parameter_version": "wrong"}, "analysis_method_or_parameter_version_mismatch"),
        ({"input_version": "unknown"}, "analysis_input_version_unverified"),
        ({"purpose": "monthly_spatial_research"}, "formal_research_qualification_missing"),
        (
            {"purpose": "monthly_spatial_research", "analysis_scope": "side"},
            "side_specific_support_not_verified",
        ),
    ]:
        denied = client.post(URL, headers=AUTH, json={**request, **changes})
        assert denied.status_code == 409, denied.text
        assert denied.json()["detail"]["reason"] == reason

    (tmp_path / "support.json").unlink()
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409
    assert denied.json()["detail"]["reason"] == "audit_snapshot_unavailable"
    assert denied.headers["cache-control"] == "no-store"


def test_compatible_shape_is_not_enough_when_registered_source_content_differs(tmp_path):
    client, _, request, _ = fixture(tmp_path, snapshot_source_differs=True)
    failed = client.post(URL, headers=AUTH, json=request)
    assert failed.status_code == 200, failed.text
    assert failed.json()["state"] == "failed" and failed.json()["result"] is None
    assert failed.json()["error"]["code"] == "qualification_input_or_conditions_mismatch"


def test_explicit_license_block_rejects_even_with_complete_calendar(tmp_path):
    client, reference_file, request, _ = fixture(tmp_path, blocked_license=True)
    reference_file.unlink()
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    detail = denied.json()["detail"]
    assert detail["reason"] == "support_evidence_explicitly_blocked"
    assert detail["support"]["month"]["included_days"] == 31


def test_changed_geometry_runtime_cannot_reuse_a_frozen_snapshot(tmp_path):
    client, _, request, _ = fixture(tmp_path, stale_runtime=True)
    failed = client.post(URL, headers=AUTH, json=request)
    assert failed.status_code == 200, failed.text
    assert failed.json()["state"] == "failed" and failed.json()["result"] is None
    assert failed.json()["error"]["code"] == "qualification_input_or_conditions_mismatch"


def test_p0_claims_cannot_launch_research_without_separate_exact_approval(tmp_path):
    client, reference_file, request, expected = fixture(tmp_path, audited_contract_fixture=True)
    assert expected["regions"][0]["month"]["data_gate_passed"] is True
    request["purpose"] = "monthly_spatial_research"
    denied = client.post(URL, headers=AUTH, json=request)
    assert denied.status_code == 409, denied.text
    assert (
        denied.json()["detail"]["reason"]
        == "current_source_identity_and_research_approval_not_verified"
    )
    assert denied.json()["detail"]["support"]["month"]["total_hours"] is None

    approval = MonthlyResearchApproval(
        approval_id="sha256:" + "2" * 64,
        **{
            key: request[key]
            for key in (
                "support_snapshot_id",
                "input_version",
                "method_version",
                "parameter_version",
            )
        },
    )
    approved = configured_client(tmp_path / "support.json", reference_file, approval)
    mismatch = approved.post(
        URL, headers=AUTH, json={**request, "input_version": "sha256:" + "3" * 64}
    )
    assert mismatch.status_code == 409, mismatch.text
    assert mismatch.json()["detail"]["reason"] == "research_approval_identity_mismatch"
    run = approved.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    assert record["result"]["qualification"]["approval_id"] == approval.approval_id
    assert record["result"]["research_ready"] is False
    assert approved.get(f"{URL}/{record['id']}").status_code == 401
    assert approved.get(f"{URL}/{record['id']}", headers=AUTH).json() == record
