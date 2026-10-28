import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("inventory_runtime", Path(__file__).parents[1] / "inventory-runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def cli_workspace(tmp_path):
    registry = tmp_path / "registry.json"
    registry.write_text(json.dumps({"schema": "ocean-source-registry/v1", "processing_version": "independent-example/v1", "sources": []}), encoding="utf-8")
    snapshot = tmp_path / "snapshot.json"
    result = subprocess.run(["node", str(ROOT / "tools/audit-research-baseline.mjs"), "--source-registry", str(registry), "--out", str(snapshot)], capture_output=True, text=True, encoding="utf-8", timeout=20)
    assert result.returncode == 0, result.stderr
    return tmp_path, snapshot


def run_cli(workspace, *options):
    root, snapshot = workspace
    return subprocess.run([sys.executable, str(ROOT / "tools/inventory-runtime.py"), "--root", str(root), "--snapshot", str(snapshot), "--out", str(root / "inventory.json"), *options], capture_output=True, text=True, encoding="utf-8", timeout=30)


def directory_link(target, link):
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError:
        if os.name != "nt":
            pytest.skip("directory links unavailable on this host")
        result = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], capture_output=True, timeout=10)
        if result.returncode:
            pytest.skip("directory links unavailable on this host")


def test_cli_file_in_place_of_layer_is_unknown_not_empty(cli_workspace):
    root, _ = cli_workspace
    (root / "data").mkdir()
    (root / "data/raw").write_bytes(b"abc")
    result = run_cli(cli_workspace)
    assert result.returncode == 0, result.stderr
    layer = json.loads((root / "inventory.json").read_text(encoding="utf-8"))["layers"]["raw"]
    assert layer["status"] == "unavailable"
    assert layer["reason"] == "not_directory"
    assert layer["bytes"] is None
    assert layer["files"] is None


def test_cli_budget_reports_only_known_lower_bound_and_keeps_totals_unknown(cli_workspace):
    root, _ = cli_workspace
    raw = root / "data/raw"
    raw.mkdir(parents=True)
    for i in range(4):
        (raw / str(i)).write_bytes(b"abc")
    result = run_cli(cli_workspace, "--max-entries", "2")
    assert result.returncode == 0, result.stderr
    report = json.loads((root / "inventory.json").read_text(encoding="utf-8"))
    layer = report["layers"]["raw"]
    assert layer["status"] == "partial"
    assert "entry_budget" in layer["reasons"]
    assert layer["bytes"] is None
    assert layer["files"] is None
    assert layer["observed_bytes"] == 6
    assert layer["observed_files"] == 2
    assert report["scan"]["entries_examined"] == 2
    assert report["production"]["status"] == "unverified"


def test_cli_excludes_intermediate_directory_links_for_layers_and_routes(cli_workspace):
    root, _ = cli_workspace
    outside = root / "outside"
    (outside / "raw").mkdir(parents=True)
    (outside / "raw/private.csv").write_bytes(b"private-record")
    (outside / "nginx").mkdir()
    (outside / "nginx/ocean.conf").write_bytes(b"private-config")
    directory_link(outside, root / "data")
    directory_link(outside, root / "deploy")
    result = run_cli(cli_workspace)
    assert result.returncode == 0, result.stderr
    report = json.loads((root / "inventory.json").read_text(encoding="utf-8"))
    assert report["layers"]["raw"]["bytes"] is None
    assert report["layers"]["raw"]["status"] == "partial"
    assert report["route_config_sha256"]["deploy/nginx/ocean.conf"] is None
    assert report["route_config_status"]["deploy/nginx/ocean.conf"] == "excluded_link"


@pytest.mark.parametrize("mode", ["identity", "duplicate", "qualification"])
def test_cli_rejects_invalid_source_identity_without_publishing(cli_workspace, mode):
    root, snapshot = cli_workspace
    text = snapshot.read_text(encoding="utf-8")
    if mode == "duplicate":
        text = text.replace('"schema":', '"schema":"PRIVATE_SENTINEL","schema":', 1)
    else:
        value = json.loads(text)
        if mode == "identity":
            value["snapshot_id"] = "sha256:forged"
        else:
            value["research_ready"] = True
        text = json.dumps(value)
    snapshot.write_text(text, encoding="utf-8")
    result = run_cli(cli_workspace)
    assert result.returncode != 0
    assert not (root / "inventory.json").exists()
    assert str(root) not in result.stderr
    assert "PRIVATE_SENTINEL" not in result.stderr


@pytest.mark.parametrize("target", ["existing", "snapshot"])
def test_cli_never_overwrites_existing_files(cli_workspace, target):
    root, snapshot = cli_workspace
    path = snapshot if target == "snapshot" else root / "inventory.json"
    if target == "existing":
        path.write_bytes(b"PRIVATE_SENTINEL-existing-evidence")
    before = path.read_bytes()
    result = run_cli(cli_workspace, "--out", str(path))
    assert result.returncode != 0
    assert path.read_bytes() == before
    assert str(root) not in result.stderr
    assert "PRIVATE_SENTINEL" not in result.stderr


def test_cli_normal_inventory_keeps_empty_missing_and_output_side_effects_distinct(cli_workspace):
    root, snapshot = cli_workspace
    (root / "data/raw").mkdir(parents=True)
    hot = root / "frontend/prototype/data"
    hot.mkdir(parents=True)
    (hot / "known.js").write_bytes(b"abc")
    output = root / "data/cache/inventory.json"
    result = run_cli(cli_workspace, "--out", str(output))
    assert result.returncode == 0, result.stderr
    report = json.loads(output.read_text(encoding="utf-8"))
    assert report["source_snapshot_id"] == json.loads(snapshot.read_text(encoding="utf-8"))["snapshot_id"]
    assert report["layers"]["raw"]["bytes"] == 0
    assert report["layers"]["raw"]["status"] == "measured"
    assert report["layers"]["hot_display"]["bytes"] == 3
    assert report["layers"]["hot_display"]["files"] == 1
    assert report["layers"]["cache"]["status"] == "missing"
    assert report["layers"]["cache"]["bytes"] is None
    assert str(root) not in json.dumps(report)
    assert report["capacity"]["cache_budget_bytes"] is None


@pytest.mark.parametrize("option,value", [("--max-entries", "0"), ("--max-entries", "1000001"), ("--max-seconds", "nan"), ("--max-seconds", "inf"), ("--max-seconds", "0")])
def test_cli_rejects_invalid_scan_budget(cli_workspace, option, value):
    root, _ = cli_workspace
    result = run_cli(cli_workspace, option, value)
    assert result.returncode != 0
    assert not (root / "inventory.json").exists()


def test_local_inventory_distinguishes_missing_from_empty_and_never_claims_server(tmp_path):
    raw = tmp_path / "data/raw"
    raw.mkdir(parents=True)
    hot = tmp_path / "frontend/prototype/data"
    hot.mkdir(parents=True)
    (hot / "example.js").write_bytes(b"abc")
    report = module.inventory(tmp_path, {"snapshot_id": "sha256:fixture"})
    assert report["layers"]["raw"]["bytes"] == 0
    assert report["layers"]["hot_display"]["bytes"] == 3
    assert report["layers"]["cache"]["bytes"] is None
    assert report["production"]["ram"] is None
    assert report["capacity"]["concurrency_budget"] is None
    assert str(tmp_path) not in str(report)


def test_excluded_directory_link_is_partial(tmp_path):
    data = tmp_path / "data/raw"
    data.mkdir(parents=True)
    outside = tmp_path / "separate"
    outside.mkdir()
    (outside / "file.csv").write_bytes(b"abc")
    directory_link(outside, data / "link")
    assert module.measure(tmp_path, "data/raw")["status"] == "partial"
