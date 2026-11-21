"""Configured chart PNG support preserves the original SVG reader and validates output."""

import struct
from zlib import compress, crc32

import pytest
from test_synthetic_cases import AUTH, BASE, case_client, save_request

from app.case_chart_png import PNG_SIGNATURE, png_dimensions


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
