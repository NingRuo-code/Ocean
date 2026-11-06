"""Existing capability query consumes the real CLI's frozen P0 audit, without raw inputs."""

import hashlib
import json
import subprocess
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.monthly_analysis import create_monthly_router

ROOT = Path(__file__).resolve().parents[2]
QUERY = {"month": "2024-08", "longitude": 124, "latitude": 30, "radius_km": 20}


def audited_snapshot(tmp_path, *, synthetic=False, claims=None, **overrides):
    request = tmp_path / "conditions.json"
    source = tmp_path / "daily.json"
    output = tmp_path / "support.json"
    source.write_bytes(
        (ROOT / "docs/reports/ocean-real-source-adapter-audit-2026-11-05.json").read_bytes()
    )
    if synthetic:
        layers = []
        for kind, unit in [("front", "classification_code"), ("activity", "fishing_hours")]:
            layers.append(
                {
                    "id": "front-original" if kind == "front" else "effort-original",
                    "kind": kind,
                    "role": "analysis_source",
                    "unit": unit,
                    "time_verified": True,
                    "bounds_verified": True,
                    "support_verified": True,
                    "duration_days": 1,
                    "cells": [
                        {
                            "bounds": [123.5, 29.5, 124.5, 30.5],
                            "support": "valid",
                            "hours": 100 if kind == "activity" else None,
                            "side": "unknown",
                        }
                    ],
                }
            )
        source.write_text(
            json.dumps(
                {
                    "schema": "ocean-regional-cells/v1",
                    "evidence_kind": "synthetic",
                    **({"qualification_evidence": claims} if claims is not None else {}),
                    "days": [
                        {"date": f"2024-08-{day:02d}", "layers": layers} for day in range(1, 32)
                    ],
                }
            ),
            encoding="utf-8",
        )
    request.write_text(
        json.dumps(
            {
                "schema": "ocean-support-request/v1",
                "purpose": "A_month",
                "month": "2024-08",
                "layer_use": "front_effort",
                "method_version": "wgs84-laea-uniform/v1",
                "quality_rule": "complete-common-support/v1",
                "allocation": "overlap_uniform",
                "geometries": [
                    {"id": "ecs20", "type": "circle", "center": [124, 30], "radius_km": 20}
                ],
                **overrides,
            }
        ),
        encoding="utf-8",
    )
    run = subprocess.run(
        [
            "node",
            str(ROOT / "tools/audit-research-baseline.mjs"),
            "--support-request",
            str(request),
            "--regional-input" if synthetic else "--daily-snapshot",
            str(source),
            "--out",
            str(output),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert run.returncode == 0, run.stderr
    data = json.loads(output.read_text(encoding="utf-8"))
    request.unlink()
    source.unlink()
    return output, data


def client_for(path, state_path=None):
    config = settings.model_copy(
        update={"support_snapshot_path": path, "support_state_path": state_path}
    )
    app = FastAPI()
    app.include_router(create_monthly_router(config))
    return TestClient(app)


def test_existing_query_reads_the_same_audit_after_source_inputs_are_removed(tmp_path):
    path, expected = audited_snapshot(tmp_path)
    client = client_for(path)
    first = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert first.status_code == 200, first.text
    data = first.json()
    audit = data["audited_support"]
    assert audit["status"] == "audited_snapshot" and audit["freshness"] == "unknown"
    assert audit["support_level"] == "unverified"
    assert audit["snapshot_id"] == expected["support_snapshot_id"]
    assert audit["month"]["included_days"] == 0 and audit["month"]["expected_days"] == 31
    assert audit["month"]["total_hours"] is None and audit["month"]["area_time_km2_days"] is None
    assert (
        audit["month"]["layer_material_states"]
        == expected["regions"][0]["month"]["layer_material_states"]
    )
    assert audit["research_ready"] is False and data["execution"]["can_submit"] is False
    assert data["qualification"]["status"] == "not_handed_off"
    assert str(tmp_path) not in first.text
    second = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert second.status_code == 200 and second.json()["audited_support"] == audit
    assert first.headers["cache-control"] == "no-store"


def test_event_query_consumes_separate_windows_and_exact_conditions(tmp_path):
    path, expected = audited_snapshot(
        tmp_path, purpose="B_event", event_date="2024-08-01", event_day_rule="exclude_event_day/v1"
    )
    client = client_for(path)
    response = client.get(
        "/api/query/monthly-analysis/capability",
        params={**QUERY, "purpose": "B_event", "event_date": "2024-08-01"},
    )
    assert response.status_code == 200, response.text
    audit = response.json()["audited_support"]
    assert audit["snapshot_id"] == expected["support_snapshot_id"]
    assert audit["actual_conditions"]["purpose"] == "B_event"
    assert audit["support_level"] is None
    assert audit["month"]["scope"] == "month_calendar_only_not_event_eligibility"
    assert audit["event_data_gate_passed"] == {"post3": False, "post7": False}
    assert audit["windows"]["pre7"]["dates"][0] == "2024-07-25"
    assert audit["windows"]["post3"]["expected_days"] == 3
    assert audit["windows"]["post7"]["expected_days"] == 7
    assert audit["windows"]["post7"]["total_hours"] is None
    other = client.get(
        "/api/query/monthly-analysis/capability",
        params={**QUERY, "purpose": "B_event", "event_date": "2024-08-02"},
    )
    assert other.status_code == 200 and other.json()["audited_support"]["status"] == "not_audited"


def write_snapshot(path, data):
    payload = {k: v for k, v in data.items() if k != "support_snapshot_id"}
    data["support_snapshot_id"] = (
        "sha256:"
        + hashlib.sha256(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode(
                "utf-8"
            )
        ).hexdigest()
    )
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
    )


def test_positive_numbers_are_hidden_until_publication_approval_and_remain_historical(tmp_path):
    path, data = audited_snapshot(tmp_path, synthetic=True)
    assert data["regions"][0]["month"]["summary"]["total_hours"] > 0
    data["operator_note"] = str(tmp_path / "private-marker")
    write_snapshot(path, data)
    client = client_for(path)
    hidden = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert hidden.status_code == 200, hidden.text
    audit = hidden.json()["audited_support"]
    assert audit["numeric_visibility"] == "withheld_public_boundary"
    assert audit["month"]["total_hours"] is None and audit["days"][0]["hours"] is None
    assert "private-marker" not in hidden.text and str(tmp_path) not in hidden.text
    # This is an owned synthetic fixture: explicit publication approval is separate from the auditor.
    data["public_release_approved"] = True
    write_snapshot(path, data)
    public = client.get("/api/query/monthly-analysis/capability", params=QUERY).json()[
        "audited_support"
    ]
    assert public["numeric_visibility"] == "approved_aggregate"
    assert public["month"]["total_hours"] == data["regions"][0]["month"]["summary"]["total_hours"]
    assert (
        public["month"]["supported_subset"]["area_time_km2_days"]
        == data["regions"][0]["month"]["summary"]["supported_subset"]["area_time_km2_days"]
    )
    assert public["days"][0]["hours"] == data["regions"][0]["days"][0]["hours"]
    assert public["freshness"] == "unknown" and public["research_ready"] is False
    assert public["evidence_kind"] == "synthetic"

    data["evidence_kind"] = "audited_cells"
    write_snapshot(path, data)
    real = client.get("/api/query/monthly-analysis/capability", params=QUERY).json()[
        "audited_support"
    ]
    assert real["month"]["total_hours"] is None and real["days"][0]["hours"] is None


def test_projects_evidence_references_without_disclosing_evidence_bodies(tmp_path):
    ref = "sha256:" + "e" * 64
    geometry = {"id": "ecs20", "type": "circle", "center": [124, 30], "radius_km": 20}
    claim = {"state": "verified", "evidence_id": ref}
    path, data = audited_snapshot(
        tmp_path,
        synthetic=True,
        claims={
            "schema": "ocean-support-evidence/v1",
            "source_versions": {
                "front-original": ref,
                "effort-original": ref,
                "private-source": ref,
            },
            "processing_version": ref,
            "license": claim,
            "quality_rule": {**claim, "id": "complete-common-support/v1"},
            "geometry": {"ecs20": {**claim, "request_geometry": geometry}},
        },
    )
    client = client_for(path)
    response = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    audit = response.json()["audited_support"]
    assert audit["versions"]["sources"] == {"front": ref, "activity": ref}
    assert audit["versions"]["processing"] == ref
    assert audit["evidence"] == {"license": claim, "quality_rule": claim, "granularity": claim}
    assert audit["month"]["available_uses"] == ["local_description"]
    assert "private-source" not in response.text and audit["research_ready"] is False
    data["conditions"]["allocation"] = str(tmp_path / "private-marker")
    write_snapshot(path, data)
    bad = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert bad.json()["audited_support"]["status"] == "invalid_snapshot"
    assert "private-marker" not in bad.text


def test_missing_tampered_and_unmatched_snapshots_never_reuse_a_previous_qualification(tmp_path):
    path, data = audited_snapshot(tmp_path)
    client = client_for(path)
    for change in [
        {"month": "2024-07"},
        {"longitude": 124.1},
        {"radius_km": 10},
        {"layer_use": "front_effort_sst"},
    ]:
        r = client.get("/api/query/monthly-analysis/capability", params={**QUERY, **change})
        assert r.status_code == 200 and r.json()["audited_support"]["status"] == "not_audited"
    data["regions"][0]["month"]["included_days"] = 31
    path.write_text(json.dumps(data), encoding="utf-8")
    bad = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert bad.status_code == 200 and bad.json()["audited_support"]["status"] == "invalid_snapshot"
    assert str(tmp_path) not in bad.text and bad.json()["execution"]["can_submit"] is False
    path.unlink()
    missing = client.get("/api/query/monthly-analysis/capability", params=QUERY)
    assert (
        missing.status_code == 200 and missing.json()["audited_support"]["status"] == "not_prepared"
    )


def test_illegal_event_conditions_are_rejected_at_existing_query(tmp_path):
    client = client_for(tmp_path / "not-opened.json")
    for change in [
        {"purpose": "B_event"},
        {"event_date": "2024-08-01"},
        {"purpose": "B_event", "event_date": "2024-09-01"},
        {"purpose": "B_event", "event_date": "1722470400"},
    ]:
        r = client.get("/api/query/monthly-analysis/capability", params={**QUERY, **change})
        assert r.status_code == 422


def test_expired_and_scanning_states_do_not_present_previous_qualification(tmp_path):
    path, data = audited_snapshot(tmp_path)
    state_path = tmp_path / "support-state.json"
    client = client_for(path, state_path)
    for state, freshness in [("expired", "stale"), ("scanning", "unknown")]:
        state_path.write_text(
            json.dumps({"schema": "ocean-support-state/v1", "state": state}), encoding="utf-8"
        )
        response = client.get("/api/query/monthly-analysis/capability", params=QUERY)
        audit = response.json()["audited_support"]
        assert response.status_code == 200 and audit["status"] == state
        assert audit["freshness"] == freshness and audit["research_ready"] is False
        assert data["support_snapshot_id"] not in response.text
