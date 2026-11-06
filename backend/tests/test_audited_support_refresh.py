"""Replay explicit audit refreshes through the existing CLI and read-only FastAPI query."""

import json
import os
import subprocess
import sys

import pytest
from test_audited_capability import QUERY, ROOT, client_for

ENDPOINT = "/api/query/monthly-analysis/capability"
CLI = ["node", str(ROOT / "tools/audit-research-baseline.mjs")]


def write_json(path, value):
    path.write_text(json.dumps(value), encoding="utf-8")


@pytest.fixture
def refresh(tmp_path):
    conditions = tmp_path / "conditions.json"
    source = tmp_path / "prepared-source.json"
    state = tmp_path / "support-state.json"
    write_json(
        conditions,
        {
            "schema": "ocean-support-request/v1",
            "purpose": "A_month",
            "month": "2024-08",
            "layer_use": "front_effort",
            "method_version": "wgs84-laea-uniform/v1",
            "quality_rule": "complete-common-support/v1",
            "allocation": "overlap_uniform",
            "geometries": [{"id": "ecs20", "type": "circle", "center": [124, 30], "radius_km": 20}],
        },
    )
    write_json(
        source, {"schema": "ocean-regional-cells/v1", "evidence_kind": "synthetic", "days": []}
    )
    return conditions, source, state


def refresh_args(paths):
    conditions, source, state = paths
    return [
        "--support-request",
        str(conditions),
        "--regional-input",
        str(source),
        "--support-state",
        str(state),
    ]


def run_refresh(paths, *, success=True):
    _, _, state = paths
    run = subprocess.run(
        [*CLI, *refresh_args(paths)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert (run.returncode == 0) is success, run.stderr
    return json.loads(state.read_text(encoding="utf-8"))


def audit(client, **conditions):
    response = client.get(ENDPOINT, params={**QUERY, **conditions})
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    return response.json()["audited_support"]


def frozen_path(state, receipt):
    return state.with_name(state.name + ".snapshots") / (receipt["snapshot_id"][7:] + ".json")


def test_same_input_keeps_identity_and_same_path_replacement_expires_it(refresh):
    _, source, state = refresh
    client = client_for(None, state)
    first = run_refresh(refresh)
    initial = audit(client)
    old = frozen_path(state, first)
    report = old.with_suffix(".md")
    old_bytes = old.read_bytes()
    assert initial["snapshot_id"] == first["snapshot_id"]
    assert initial["freshness"] == "unknown" and initial["registered_receipt_match"] is True
    assert initial["research_ready"] is False and initial["audited_at"] == first["generated_at"]
    assert initial["snapshot_id"] in report.read_text(encoding="utf-8")
    repeat = run_refresh(refresh)
    assert repeat["snapshot_id"] == first["snapshot_id"] and old.read_bytes() == old_bytes
    assert repeat["generated_at"] != first["generated_at"]

    data = json.loads(source.read_text(encoding="utf-8"))
    data["days"] = [{"date": "2024-08-06", "layers": []}]
    write_json(source, data)
    stale = audit(client)
    assert stale["status"] == "expired" and stale["freshness"] == "stale" and "month" not in stale
    replacement = run_refresh(refresh)
    current = audit(client)
    assert current["snapshot_id"] == replacement["snapshot_id"] != first["snapshot_id"]
    assert current["versions"]["input_sha256"] != initial["versions"]["input_sha256"]
    assert old.read_bytes() == old_bytes and audit(client, radius_km=10)["status"] == "not_audited"
    prior = subprocess.check_output(
        [*CLI, "--read-support-snapshot", str(old)], encoding="utf-8", timeout=30
    )
    assert json.loads(prior)["support_snapshot_id"] == first["snapshot_id"]


def test_same_input_method_change_and_mismatched_receipt_never_reuse_old_qualification(refresh):
    conditions, _, state = refresh
    first = run_refresh(refresh)
    client = client_for(None, state)
    original = audit(client)
    request = json.loads(conditions.read_text(encoding="utf-8"))
    request["allocation"] = "cell_center"
    write_json(conditions, request)
    assert audit(client)["status"] == "expired"
    second = run_refresh(refresh)
    updated = audit(client)
    assert updated["snapshot_id"] == second["snapshot_id"] != first["snapshot_id"]
    assert updated["versions"]["input_sha256"] == original["versions"]["input_sha256"]
    assert updated["versions"]["parameter"] != original["versions"]["parameter"]
    assert updated["actual_conditions"]["allocation"] == "cell_center"
    second["snapshot_id"] = first["snapshot_id"]
    write_json(state, second)
    mismatch = audit(client)
    assert mismatch["status"] == "expired" and "snapshot_id" not in mismatch


def test_missing_source_and_failed_refresh_preserve_prior_frozen_result(refresh):
    _, source, state = refresh
    receipt = run_refresh(refresh)
    old = frozen_path(state, receipt)
    old_bytes = old.read_bytes()
    old_report = old.with_suffix(".md").read_bytes()
    client = client_for(old, state)
    source.unlink()
    missing = audit(client)
    assert missing["freshness"] == "unknown" and "snapshot_id" not in missing
    failed = run_refresh(refresh, success=False)
    assert failed["state"] == "failed"
    assert failed["failure_reason"] == "FileNotFoundError"
    assert (
        failed["conditions_id"] == receipt["conditions_id"]
        and failed["started_at"] < failed["failed_at"]
    )
    assert old.with_suffix(".md").read_bytes() == old_report
    assert audit(client)["status"] == "audit_failed" and old.read_bytes() == old_bytes
    assert audit(client_for(old))["freshness"] == "unknown"


def test_interrupted_refresh_never_reuses_old_result_and_lock_excludes_second_writer(refresh):
    _, _, state = refresh
    receipt = run_refresh(refresh)
    old = frozen_path(state, receipt)
    old_bytes = old.read_bytes()
    client = client_for(old, state)
    interrupt_after_scanning = (
        "import os; import audit_support_qualification as tool; "
        "tool.evaluate_conditions = lambda *args: os._exit(75); tool.main()"
    )
    interrupted = subprocess.run(
        [
            sys.executable,
            "-c",
            interrupt_after_scanning,
            *refresh_args(refresh),
        ],
        cwd=ROOT / "tools",
        capture_output=True,
        timeout=30,
        check=False,
    )
    assert interrupted.returncode == 75, interrupted.stderr
    lock = state.with_name(state.name + ".lock")
    assert lock.is_file()
    assert audit(client)["status"] == "scanning"
    still_scanning = run_refresh(refresh, success=False)
    assert still_scanning["state"] == "scanning" and old.read_bytes() == old_bytes
    lock.unlink()
    recovered = run_refresh(refresh)
    assert recovered["snapshot_id"] == receipt["snapshot_id"]
    assert audit(client)["registered_receipt_match"] is True


def test_equal_file_metadata_cannot_establish_current_source_identity(refresh):
    _, source, state = refresh
    data = json.loads(source.read_text(encoding="utf-8"))
    data["days"] = [{"date": "2024-08-05", "layers": []}]
    write_json(source, data)
    first = run_refresh(refresh)
    before = source.stat()
    original = source.read_bytes()
    updated = original.replace(b"2024-08-05", b"2024-08-06")
    assert len(updated) == len(original) and updated != original
    source.write_bytes(updated)
    os.utime(source, ns=(before.st_atime_ns, before.st_mtime_ns))
    observed = audit(client_for(None, state))
    if observed["status"] == "expired":
        assert "snapshot_id" not in observed
    else:
        assert observed["status"] == "audited_snapshot" and observed["freshness"] == "unknown"
        assert observed["qualification_scope"] == "frozen_snapshot_only"
    second = run_refresh(refresh)
    assert first["snapshot_id"] != second["snapshot_id"]


def test_bounded_input_that_would_produce_oversize_output_cannot_become_ready(refresh):
    _, source, state = refresh
    original = run_refresh(refresh)
    old = frozen_path(state, original)
    before = old.with_suffix(".md").read_bytes()
    data = json.loads(source.read_text(encoding="utf-8"))
    data["qualification_evidence"] = {
        "schema": "ocean-support-evidence/v1",
        "source_versions": {f"source{i:058d}": "sha256:" + "a" * 64 for i in range(117000)},
    }
    write_json(source, data)
    assert source.stat().st_size < 16 * 1024 * 1024
    failure = run_refresh(refresh, success=False)
    assert (
        failure["state"] == "failed"
        and failure["failure_reason"] == "support_snapshot_budget_exceeded"
    )
    assert (
        list(old.parent.glob("*.json")) == [old] and old.with_suffix(".md").read_bytes() == before
    )
