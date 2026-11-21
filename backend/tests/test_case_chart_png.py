"""Configured chart PNG support preserves the original SVG reader and validates output."""

import struct
import subprocess
import sys
from tempfile import TemporaryFile
from time import sleep
from zlib import compress, crc32

import pytest
from test_synthetic_cases import AUTH, BASE, case_client, save_request

from app.case_chart_png import PNG_SIGNATURE, png_dimensions, run_chart_worker


def png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc32(kind + payload))


def test_png_validation_requires_complete_crc_checked_pixels():
    width, height = 1600, 1100
    header = png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    data = png_chunk(b"IDAT", compress((b"\x00" * (width * 3 + 1)) * height))
    end = png_chunk(b"IEND", b"")
    binary = PNG_SIGNATURE + header + data + end
    assert png_dimensions(binary) == (width, height)
    altered = bytearray(binary)
    altered[len(PNG_SIGNATURE) + len(header) + 16] ^= 1
    with pytest.raises(ValueError, match="Invalid PNG chunk"):
        png_dimensions(bytes(altered))
    with pytest.raises(ValueError, match="no complete pixel"):
        png_dimensions(PNG_SIGNATURE + header + end)
    with pytest.raises(ValueError, match="does not match its dimensions"):
        png_dimensions(PNG_SIGNATURE + header + png_chunk(b"IDAT", compress(b"short")) + end)
    with pytest.raises(ValueError, match="pixel data is invalid"):
        png_dimensions(PNG_SIGNATURE + header + png_chunk(b"IDAT", b"invalid stream") + end)


def test_without_configured_renderer_a_legacy_chart_still_reads(tmp_path):
    client, _ = case_client(tmp_path)
    saved = client.post(BASE + "/cases", headers=AUTH, json=save_request(client)).json()
    case = BASE + "/cases/" + saved["case_id"]
    params = {"version_id": saved["version_id"], "report_id": saved["report"]["report_id"]}
    route = case + "/versions/1/exports/"
    details = client.get(case, headers=AUTH, params={"include_source_status": True}).json()
    assert details.get("chart_png_available", False) is False
    assert client.post(route + "chart-png", headers=AUTH, params=params).status_code == 503
    assert client.get(route + "chart-png", headers=AUTH, params=params).status_code == 404
    assert client.get(route + "chart", headers=AUTH, params=params).text.startswith("<svg")




def test_forced_render_timeout_reaps_the_worker_tree(tmp_path):
    started, orphan = tmp_path / "started", tmp_path / "orphan"
    child = "from pathlib import Path;import sys,time;Path(sys.argv[1]).touch();time.sleep(2);Path(sys.argv[2]).touch()"
    parent = "import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',sys.argv[1],*sys.argv[2:]]);time.sleep(30)"
    command = [sys.executable, "-c", parent, child, str(started), str(orphan)]
    with TemporaryFile() as output, pytest.raises(subprocess.TimeoutExpired):
        run_chart_worker(command, b"", output, timeout=1.4)
    assert started.is_file()
    sleep(1.1)
    assert not orphan.exists()
