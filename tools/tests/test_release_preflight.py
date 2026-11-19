"""Isolated release admission through the public CLI."""

import hashlib
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

import pytest

CLI = Path(__file__).resolve().parents[2] / "deploy/release.py"
COMMIT = "a" * 40
LAYERS = (
    "raw", "hot_display", "derived_unclassified", "indexes",
    "staging", "cache", "results", "backup",
)
SNAPSHOT = "sha256:" + "1" * 64


def sha256(content):
    return "sha256:" + hashlib.sha256(content).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def cli(*args):
    return subprocess.run(
        [sys.executable, str(CLI), *map(str, args)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=20,
        check=False,
    )


@pytest.fixture
def release_target(tmp_path):
    asset = b"minimal checked release asset\n"
    name = "backend/app/test_fixture.py"
    manifest = {
        "schema": "ocean-isolated-release/v1",
        "profile": "isolated-read-only/v1",
        "source_commit": COMMIT,
        "runtime": {
            "python": platform.python_version(),
            "implementation": sys.implementation.name,
            "cache_tag": sys.implementation.cache_tag,
            "platform": sys.platform,
            "machine": platform.machine(),
        },
        "files": {name: {"bytes": len(asset), "sha256": sha256(asset)}},
    }
    manifest["release_id"] = sha256(encode(manifest))
    manifest_bytes = encode(manifest)
    bundle = tmp_path / "candidate.zip"
    with ZipFile(bundle, "w") as archive:
        archive.writestr("manifest.json", manifest_bytes)
        archive.writestr(name, asset)
    report = tmp_path / "inventory.json"
    report.write_bytes(encode({
        "schema": "ocean-runtime-inventory/v1",
        "source_snapshot_id": SNAPSHOT,
        "layers": {
            key: {"status": "measured", "bytes": 31, "files": 1} if key == "raw"
            else {"status": "missing", "bytes": None, "files": None}
            for key in LAYERS
        },
    }))
    target = tmp_path / "isolation"
    initialized = cli("init", "--root", target)
    assert initialized.returncode == 0, initialized.stderr
    arguments = (
        "--bundle", bundle, "--expected", sha256(bundle.read_bytes()),
        "--commit", COMMIT, "--root", target,
    )
    return target, report, arguments, len(manifest_bytes) + len(asset)


def test_preflight_consumes_inventory_and_checks_isolated_target_without_changes(release_target):
    target, inventory, arguments, expanded = release_target
    marker = (target / "isolation.json").read_bytes()
    run = cli("preflight", *arguments, "--inventory", inventory, "--reserve-bytes", 2048)
    assert run.returncode == 0, run.stderr
    result = json.loads(run.stdout)
    assert result["status"] == "eligible_for_isolated_install"
    assert result["production_status"] == "unverified"
    assert result["source_commit"] == COMMIT
    assert result["space"]["expanded_bytes"] == expanded
    assert result["space"]["required_bytes"] == expanded + 2048
    assert result["inventory"]["source_snapshot_id"] == SNAPSHOT
    assert result["inventory"]["layers"]["raw"] == {"status": "measured", "bytes": 31, "files": 1}
    assert result["inventory"]["layers"]["backup"]["bytes"] is None
    assert str(target.parent) not in run.stdout
    assert (target / "isolation.json").read_bytes() == marker
    assert list((target / "versions").iterdir()) == []


def test_preflight_refuses_malformed_inventory_without_printing_input(release_target):
    target, inventory, arguments, _ = release_target
    inventory.write_bytes(b'["PRIVATE_SENTINEL"]')
    report = cli("preflight", *arguments, "--inventory", inventory, "--reserve-bytes", 0)
    assert report.returncode == 1
    assert json.loads(report.stderr) == {"error": "invalid_inventory_report"}
    assert report.stdout == ""
    assert list((target / "versions").iterdir()) == []


def test_guarded_install_uses_verified_candidate_and_preserves_an_installed_release(release_target):
    target, inventory, arguments, _ = release_target
    options = ("--inventory", inventory, "--reserve-bytes", 2048)
    admission = cli("preflight", *arguments, *options)
    assert admission.returncode == 0, admission.stderr
    installed = cli("install", *arguments, "--reserve-bytes", 2048)
    assert installed.returncode == 0, installed.stderr
    identity = json.loads(admission.stdout)["release_id"]
    assert json.loads(installed.stdout)["release_id"] == identity

    refused = cli("preflight", *arguments, *options)
    assert refused.returncode == 1
    assert json.loads(refused.stderr) == {"error": "release_already_installed"}
    assert [path.name for path in (target / "versions").iterdir()] == [identity[7:]]


def test_preflight_and_install_recheck_candidate_target_and_mounted_space(release_target):
    target, inventory, arguments, _ = release_target
    options = ("--inventory", inventory, "--reserve-bytes", 0)
    allowed = cli("preflight", *arguments, *options)
    assert allowed.returncode == 0, allowed.stderr

    def reject(result, reason):
        assert result.returncode == 1
        assert json.loads(result.stderr) == {"error": reason}
        assert list((target / "versions").iterdir()) == []

    reject(cli("preflight", *arguments, *options, "--commit", "b" * 40), "source_commit_mismatch")
    oversized = 2**63 - 1
    assert shutil.disk_usage(target).total < oversized
    for command, extras in (("preflight", options), ("install", ())):
        result = cli(command, *arguments, *extras, "--reserve-bytes", oversized)
        reject(result, "insufficient_target_space")

    marker = target / "isolation.json"
    original = marker.read_bytes()
    marker.write_bytes(b"{}")
    reject(cli("install", *arguments, "--reserve-bytes", 0), "not_an_isolation_root")
    marker.write_bytes(original)
    bundle = arguments[1]
    with bundle.open("ab") as output:
        output.write(b"changed after preflight")
    reject(cli("install", *arguments, "--reserve-bytes", 0), "bundle_integrity_failed")
