"""Render and identify the existing frozen chart as a real PNG."""

import base64
import json
import struct
import subprocess
import zlib
from hashlib import sha256
from tempfile import TemporaryFile

from .analysis_support import content_id
from .case_chart import CHART_VERSION, render_case_chart
from .config import PROJECT_ROOT

FORMAT = "owner-case-chart-png/v1"
LIMIT = 8 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_dimensions(png):
    if not isinstance(png, bytes) or not png.startswith(PNG_SIGNATURE) or not 45 <= len(png) <= LIMIT:
        raise ValueError("Frozen PNG is unavailable")
    if png[12:16] != b"IHDR" or png[8:12] != b"\x00\x00\x00\x0d":
        raise ValueError("Invalid PNG header")
    width, height = struct.unpack_from(">II", png, 16)
    if width != 1600 or not 1100 <= height <= 10000 or not png.endswith(b"IEND\xaeB\x60\x82"):
        raise ValueError("PNG lies outside the case figure budget")
    offset, seen_pixels = 8, False
    while offset < len(png):
        if offset + 12 > len(png):
            raise ValueError("PNG is truncated")
        length, = struct.unpack_from(">I", png, offset)
        boundary = offset + 8 + length
        if boundary + 4 > len(png) or zlib.crc32(png[offset + 4:boundary]) != struct.unpack_from(">I", png, boundary)[0]:
            raise ValueError("Invalid PNG chunk")
        kind = png[offset + 4:offset + 8]
        seen_pixels |= kind == b"IDAT" and length > 0
        offset = boundary + 4
        if kind == b"IEND":
            if not seen_pixels or length or offset != len(png):
                raise ValueError("PNG has no complete pixel data")
            return width, height
    raise ValueError("PNG terminator is missing")


def chart_png_manifest(case, png):
    width, height = png_dimensions(png)
    parameters = case["report"]["result"]["parameters"]
    value = {
        "schema_version": "ocean-case-chart-png-receipt/v1",
        "case_id": case["case_id"], "version": case["version"], "version_id": case["version_id"],
        "report_id": case["report"]["report_id"], "format_version": FORMAT,
        "chart_basis": case["protected_dependencies"]["chart_basis"], "drawing_version": CHART_VERSION,
        "renderer_version": "ocean-case-browser-raster/v1", "month": parameters["month"],
        "width": width, "height": height, "sha256": "sha256:" + sha256(png).hexdigest(),
        "byte_length": len(png), "protection": "saved_case",
    }
    return {**value, "artifact_id": content_id(value)}


def render_chart_png(settings, case):
    source = render_case_chart(case)
    if len(source) > 1_048_576:
        raise ValueError("Frozen figure exceeds budget")
    expected = {key: case[key] for key in ("case_id", "version", "version_id")}
    expected["report"] = {"report_id": case["report"]["report_id"]}
    payload = json.dumps({"svg": base64.b64encode(source).decode("ascii"), "expected": expected}).encode("utf-8")
    command = [
        str(settings.case_chart_png_node.resolve(strict=True)),
        str(PROJECT_ROOT / "tools/rasterize-case-chart.mjs"),
        str(settings.case_chart_png_browser.resolve(strict=True)),
    ]
    with TemporaryFile() as output:
        subprocess.run(command, cwd=PROJECT_ROOT, input=payload, stdout=output, stderr=subprocess.DEVNULL,
                       check=True, timeout=35)
        output.seek(0)
        png = output.read(LIMIT + 1)
    png_dimensions(png)
    return png
