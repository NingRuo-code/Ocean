"""Recomputable public-bundle consistency checks without original source files."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "docs/reports/ocean-preferred-month-audit-verification-2026-11-05.json"
PROJECTION = ROOT / "docs/reports/ocean-candidate-support-verification-2026-11-05.json"


def run(bundle=BUNDLE, projection=PROJECTION):
    return subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/verify_preferred_month_audit.py"),
            "--bundle",
            str(bundle),
            "--projection",
            str(projection),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
        check=False,
    )


def test_committed_audit_can_be_verified_without_private_sources():
    result = run()
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["runs"] == 9 and data["geometries"] == 27 and data["outcomes"] == 3
    assert (
        data["local_snapshots_checked"] is False
        and data["gd_research_gate"] == "unverified"
    )


def test_tampered_bundle_is_rejected_without_disclosing_its_path(tmp_path):
    data = json.loads(BUNDLE.read_text(encoding="utf-8"))
    data["a_research_unblocked"] = True
    path = tmp_path / "private-bundle.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    result = run(bundle=path)
    assert result.returncode != 0 and "invalid_bundle_identity" in result.stderr
    assert str(path) not in result.stderr


def test_changed_projection_bytes_cannot_reuse_the_bundle_identity(tmp_path):
    data = json.loads(PROJECTION.read_text(encoding="utf-8"))
    data["research_ready"] = True
    path = tmp_path / "projection.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    result = run(projection=path)
    assert result.returncode != 0 and "projection_bytes_mismatch" in result.stderr
