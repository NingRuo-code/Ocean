"""Public intake CLI with a synthetic HTTP response; no GFW access or real coverage."""

import hashlib
import io
import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "tools/pipeline/fetch_gfw_effort.py"


def test_archive_only_preserves_entire_response_and_request_without_claiming_coverage(
    tmp_path,
):
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr("data.csv", "date,lat,lon,hours\n2024-08-05,30,124,0\n")
        archive.writestr("caveats.txt", "Synthetic fixture; no research evidence.")
    source = tmp_path / "fixture.zip"
    source.write_bytes(payload.getvalue())
    # Only the external HTTP transport is replaced. The real CLI performs all persistence.
    harness = """
import pathlib, requests, runpy, sys
payload = pathlib.Path(sys.argv.pop(1)).read_bytes()
def response(*args, **kwargs):
    result = requests.Response()
    result.status_code = 200
    result._content = payload
    result.headers['Content-Type'] = 'application/zip'
    return result
requests.post = response
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
"""
    output = tmp_path / "intake"
    env = {**os.environ, "GFW_TOKEN": "synthetic-secret-never-log"}
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            harness,
            str(source),
            str(CLI),
            "--start",
            "2024-08-05",
            "--end",
            "2024-08-06",
            "--bbox",
            "123.5,29.5,125.5,31.5",
            "--resolution",
            "HIGH",
            "--group-by",
            "GEARTYPE",
            "--archive-only",
            "--dataset-version",
            "v20990101",
            "--out-dir",
            str(output),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    manifests = list(output.glob("archives/*/request.json"))
    assert len(manifests) == 1
    record = json.loads(manifests[0].read_text(encoding="utf-8"))
    assert record["request"]["params"]["spatial-aggregation"] == "false"
    assert (
        record["request"]["params"]["datasets[0]"]
        == "public-global-fishing-effort:v20990101"
    )
    assert record["request"]["params"]["spatial-resolution"] == "HIGH"
    assert record["request"]["params"]["date-range"] == "2024-08-05,2024-08-06"
    assert (
        record["response"]["sha256"] == hashlib.sha256(payload.getvalue()).hexdigest()
    )
    assert (manifests[0].parent / "response.bin").read_bytes() == payload.getvalue()
    assert record["license"] == "CC BY-NC 4.0"
    assert record["research_ready"] is False
    assert record["dataset_version_verified"] is False
    assert not list(output.glob("effort-*.json"))
    assert not (output / "manifest.json").exists()
    assert (
        "synthetic-secret-never-log"
        not in result.stdout + result.stderr + manifests[0].read_text()
    )
    original_manifest = manifests[0].read_bytes()
    repeated = subprocess.run(
        result.args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=30,
        check=False,
    )
    assert repeated.returncode == 0, repeated.stderr
    assert len(list(output.glob("archives/*/request.json"))) == 2
    assert manifests[0].read_bytes() == original_manifest
    assert (manifests[0].parent / "response.bin").read_bytes() == payload.getvalue()


def test_archive_dry_run_is_credential_free_and_writes_nothing(tmp_path):
    output = tmp_path / "intake"
    env = {key: value for key, value in os.environ.items() if key != "GFW_TOKEN"}
    args = [
        sys.executable,
        str(CLI),
        "--start",
        "2024-08-05",
        "--end",
        "2024-08-08",
        "--split-days",
        "--resolution",
        "HIGH",
        "--group-by",
        "GEARTYPE",
        "--archive-only",
        "--out-dir",
        str(output),
    ]
    preview = subprocess.run(
        args + ["--dry-run"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=10,
        check=False,
    )
    assert preview.returncode == 0, preview.stderr
    assert preview.stdout.count("POST https://gateway.api.globalfishingwatch.org/") == 3
    assert '"date-range": "2024-08-07,2024-08-08"' in preview.stdout
    assert '"spatial-aggregation": "false"' in preview.stdout
    assert not output.exists()
    refused = subprocess.run(
        args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        timeout=10,
        check=False,
    )
    assert refused.returncode == 2
    assert "token" in refused.stderr
    assert not output.exists()


@pytest.mark.parametrize("incompatible", ["--skip-existing", "--rebuild-manifest"])
def test_archive_mode_cannot_use_display_files_as_original_response_evidence(
    tmp_path, incompatible
):
    result = subprocess.run(
        [
            sys.executable,
            str(CLI),
            "--archive-only",
            incompatible,
            "--dry-run",
            "--start",
            "2024-08-05",
            "--end",
            "2024-08-06",
            "--out-dir",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=10,
        check=False,
    )
    assert result.returncode == 2
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize("group", ["VESSEL_ID", "MMSI"])
def test_spatial_grid_request_rejects_vessel_groups_before_network(tmp_path, group):
    result = subprocess.run(
        [
            sys.executable,
            str(CLI),
            "--start",
            "2024-08-05",
            "--end",
            "2024-08-06",
            "--group-by",
            group,
            "--archive-only",
            "--dry-run",
            "--out-dir",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=10,
        check=False,
    )
    assert result.returncode == 2
    assert "spatial-aggregation" in result.stderr
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "version,archive",
    [
        ("latest", True),
        ("", True),
        ("vbad", True),
        ("v1?token", True),
        ("v20990101", False),
    ],
)
def test_version_selector_rejects_aliases_or_legacy_conversion(
    tmp_path, version, archive
):
    args = [
        sys.executable,
        str(CLI),
        "--start",
        "2024-08-05",
        "--end",
        "2024-08-06",
        "--dataset-version",
        version,
        "--dry-run",
        "--out-dir",
        str(tmp_path),
    ]
    if archive:
        args.append("--archive-only")
    result = subprocess.run(
        args, capture_output=True, text=True, encoding="utf-8", timeout=10, check=False
    )
    assert result.returncode == 2
    assert "--dataset-version" in result.stderr
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize("failure", ["disk", "parse"])
def test_successful_http_is_not_retried_after_local_failure(tmp_path, failure):
    output, calls = tmp_path / "output", tmp_path / "http-calls.txt"
    if failure == "disk":
        output.write_text("existing file", encoding="utf-8")
    harness = """
import pathlib, requests, runpy, sys
calls = pathlib.Path(sys.argv.pop(1))
def response(*args, **kwargs):
    with calls.open('a') as stream:
        stream.write('POST\\n')
    result = requests.Response()
    result.status_code = 200
    result._content = b'\\xff'
    return result
requests.post = response
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
"""
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            harness,
            str(calls),
            str(CLI),
            "--start",
            "2024-08-05",
            "--end",
            "2024-08-06",
            "--group-by",
            "GEARTYPE",
            "--out-dir",
            str(output),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
        check=False,
        env={**os.environ, "GFW_TOKEN": "synthetic-secret-never-log"},
    )
    assert result.returncode != 0
    assert calls.read_text().splitlines() == ["POST"]
    if failure == "disk":
        assert output.read_text() == "existing file"
    else:
        manifests = list(output.glob("archives/*/request.json"))
        assert len(manifests) == 1
        assert (manifests[0].parent / "response.bin").read_bytes() == b"\xff"
        assert not list(output.glob("effort-*.json"))
