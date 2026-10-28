import importlib.util
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
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


def two_observations(workspace, change, *options, expected_error=False):
    root, snapshot = workspace
    process = subprocess.Popen([sys.executable, str(ROOT / "tools/inventory-runtime.py"),
                                "--root", str(root), "--snapshot", str(snapshot),
                                "--out", str(root / "inventory.json"), "--samples", "2",
                                "--interval-seconds", "1", *options],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            try:
                line = pool.submit(process.stdout.readline).result(timeout=15)
            except TimeoutError:
                process.kill()
                process.wait(timeout=5)
                raise
        assert line, "CLI did not emit its first observation event"
        assert json.loads(line) == {"event": "inventory_observation_complete", "sample": 1, "samples": 2}
        assert not (root / "inventory.json").exists(), "Observation is not completed publication"
        change(root)
        _, error = process.communicate(timeout=20)
        if expected_error:
            assert process.returncode != 0
            return error
        assert process.returncode == 0, error
        return json.loads((root / "inventory.json").read_text(encoding="utf-8"))
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()


def test_cli_two_observations_report_signed_changes_and_keep_missing_unknown(cli_workspace):
    root, _ = cli_workspace
    (root / "data/raw").mkdir(parents=True)
    (root / "data/cache").mkdir()
    (root / "frontend/prototype/data").mkdir(parents=True)
    (root / "data/cache/old.bin").write_bytes(b"1234")

    def change(root):
        (root / "data/raw/new.bin").write_bytes(b"1234567")
        (root / "data/cache/old.bin").unlink()

    report = two_observations(cli_workspace, change)
    samples = report["observations"]
    assert samples["count"] == 2
    assert samples["elapsed_between_starts_ms"] >= 1000
    assert samples["before"]["layers"]["raw"]["bytes"] == 0
    assert report["layers"]["raw"]["bytes"] == 7
    assert samples["changes"]["raw"]["bytes_delta"] == 7
    assert samples["changes"]["raw"]["files_delta"] == 1
    assert samples["changes"]["cache"]["bytes_delta"] == -4
    assert samples["changes"]["cache"]["files_delta"] == -1
    assert samples["changes"]["backup"]["bytes_delta"] is None
    assert samples["changes"]["backup"]["status"] == "unavailable"
    assert samples["changes"]["hot_display"]["status"] == "comparable"
    assert samples["changes"]["hot_display"]["bytes_delta"] == 0
    assert report["production"]["status"] == "unverified"


def test_cli_two_partial_observations_do_not_turn_equal_lower_bounds_into_zero_change(cli_workspace):
    root, _ = cli_workspace
    raw = root / "data/raw"
    raw.mkdir(parents=True)
    for name in ("a", "b"):
        (raw / name).write_bytes(b"abc")
    report = two_observations(cli_workspace, lambda root: None, "--max-entries", "1")
    observations = report["observations"]
    assert observations["before"]["layers"]["raw"]["observed_bytes"] == 3
    assert report["layers"]["raw"]["observed_bytes"] == 3
    assert observations["changes"]["raw"]["status"] == "unavailable"
    assert observations["changes"]["raw"]["bytes_delta"] is None
    assert observations["changes"]["raw"]["files_delta"] is None


def test_cli_two_observations_do_not_replace_a_writer_that_publishes_during_interval(cli_workspace):
    root, _ = cli_workspace
    error = two_observations(cli_workspace, lambda root: (root / "inventory.json").write_bytes(b"PRIVATE_SENTINEL"), expected_error=True)
    assert (root / "inventory.json").read_bytes() == b"PRIVATE_SENTINEL"
    assert str(root) not in error
    assert "PRIVATE_SENTINEL" not in error


@pytest.mark.parametrize("options", [("--samples", "3"), ("--samples", "2", "--interval-seconds", "-1"), ("--samples", "2", "--interval-seconds", "nan"), ("--samples", "2", "--interval-seconds", "31"), ("--interval-seconds", "0")])
def test_cli_rejects_invalid_observation_options(cli_workspace, options):
    root, _ = cli_workspace
    result = run_cli(cli_workspace, *options)
    assert result.returncode != 0
    assert not (root / "inventory.json").exists()


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
