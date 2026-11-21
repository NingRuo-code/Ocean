"""Render and identify the existing frozen chart as a real PNG."""

import base64
import json
import os
import signal
import struct
import subprocess
import zlib
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory, TemporaryFile

from .analysis_support import content_id
from .case_chart import CHART_VERSION, render_case_chart
from .config import PROJECT_ROOT

FORMAT = "owner-case-chart-png/v1"
DRAWING_VERSION = "case-daily-chart/v1"
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
    depth, color, compression, row_filter, interlace = struct.unpack_from(">BBBBB", png, 24)
    if depth != 8 or color not in {2, 6} or (compression, row_filter, interlace) != (0, 0, 0):
        raise ValueError("Unsupported frozen PNG encoding")
    stride = width * (3 if color == 2 else 4) + 1
    offset = 8
    compressed_pixels = bytearray()
    while offset < len(png):
        if offset + 12 > len(png):
            raise ValueError("PNG is truncated")
        length, = struct.unpack_from(">I", png, offset)
        boundary = offset + 8 + length
        if boundary + 4 > len(png) or zlib.crc32(png[offset + 4:boundary]) != struct.unpack_from(">I", png, boundary)[0]:
            raise ValueError("Invalid PNG chunk")
        kind = png[offset + 4:offset + 8]
        if kind == b"IDAT":
            compressed_pixels.extend(png[offset + 8:boundary])
        offset = boundary + 4
        if kind == b"IEND":
            if not compressed_pixels or length or offset != len(png):
                raise ValueError("PNG has no complete pixel data")
            decoder = zlib.decompressobj()
            try:
                raw = decoder.decompress(compressed_pixels, stride * height + 1)
            except zlib.error:
                raise ValueError("PNG pixel data is invalid") from None
            if (len(raw) != stride * height or not decoder.eof or decoder.unused_data
                    or any(filter_value > 4 for filter_value in raw[::stride])):
                raise ValueError("PNG pixel data does not match its dimensions")
            return width, height
    raise ValueError("PNG terminator is missing")


def chart_png_manifest(case, png):
    width, height = png_dimensions(png)
    parameters = case["report"]["result"]["parameters"]
    value = {
        "schema_version": "ocean-case-chart-png-receipt/v1",
        "case_id": case["case_id"], "version": case["version"], "version_id": case["version_id"],
        "report_id": case["report"]["report_id"], "format_version": FORMAT,
        "chart_basis": case["protected_dependencies"]["chart_basis"], "drawing_version": DRAWING_VERSION,
        "renderer_version": "ocean-case-browser-raster/v1", "month": parameters["month"],
        "width": width, "height": height, "sha256": "sha256:" + sha256(png).hexdigest(),
        "byte_length": len(png), "protection": "saved_case",
    }
    return {**value, "artifact_id": content_id(value)}


def stop_chart_worker(child):
    try:
        if os.name == "nt":
            windows = Path(os.environ.get("SystemRoot", "C:/Windows"))
            subprocess.run([str(windows / "System32/taskkill.exe"), "/PID", str(child.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5,
                           creationflags=subprocess.CREATE_NO_WINDOW, check=False)
        else:
            os.killpg(child.pid, signal.SIGKILL)
    except (OSError, subprocess.TimeoutExpired):
        pass
    finally:
        if child.poll() is None:
            child.kill()


def run_chart_worker(command, payload, output, timeout=35):
    with TemporaryDirectory(prefix="ocean-frozen-chart-") as profile_root:
        env = {**os.environ, "TEMP": profile_root, "TMP": profile_root, "TMPDIR": profile_root}
        windows = os.name == "nt"
        flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP if windows else 0
        with subprocess.Popen(command, cwd=PROJECT_ROOT, stdin=subprocess.PIPE, stdout=output, stderr=subprocess.DEVNULL,
                              env=env, creationflags=flags, start_new_session=not windows) as child:
            try:
                child.communicate(payload, timeout=timeout)
            except subprocess.TimeoutExpired:
                stop_chart_worker(child)
                child.communicate()
                raise
            if child.returncode:
                raise subprocess.CalledProcessError(child.returncode, command)


def render_chart_png(settings, case):
    if CHART_VERSION != DRAWING_VERSION:
        raise ValueError("Frozen chart format needs a matching renderer")
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
        run_chart_worker(command, payload, output)
        output.seek(0)
        png = output.read(LIMIT + 1)
    png_dimensions(png)
    return png
