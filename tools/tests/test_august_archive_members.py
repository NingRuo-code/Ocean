"""CLI checks for fixed-release August originals."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def check_members(raw_root, *args):
    return subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/verify_august_archive_members.py"),
            "--raw-root",
            str(raw_root),
            *args,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
        check=False,
    )


def test_same_size_replacement_is_rejected_and_missing_stays_distinct(tmp_path):
    replacement = tmp_path / "front/2024/front_location20240805.nc"
    replacement.parent.mkdir(parents=True)
    replacement.write_bytes(bytes(1_304_712))

    result = check_members(tmp_path)
    assert result.returncode == 2, result.stderr
    report = json.loads(result.stdout)
    front = report["sources"]["front"]
    assert front["counts"] == {"matched": 0, "missing": 30, "invalid": 1}
    assert front["members"][4]["status"] == "crc_mismatch"
    assert front["members"][4]["sha256"] is None
    assert front["members"][0]["status"] == "missing"
    assert str(tmp_path) not in result.stdout
    assert replacement.read_bytes() == bytes(1_304_712)


def test_complete_mode_requires_every_day_of_both_archives(tmp_path):
    normal = check_members(tmp_path)
    strict = check_members(tmp_path, "--require-complete")
    assert normal.returncode == 0 and strict.returncode == 2
    report = json.loads(strict.stdout)
    assert json.loads(normal.stdout) == report
    for source in report["sources"].values():
        assert source["counts"] == {"matched": 0, "missing": 31, "invalid": 0}
    assert report["sources"]["front"]["missing_compressed_bytes"] == 39_650_425
    assert report["sources"]["gfw"]["missing_compressed_bytes"] == 317_805_068
