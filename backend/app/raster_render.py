from __future__ import annotations

import struct
import zlib
from itertools import pairwise

import numpy as np

from .data_access import FRONT_COLD_CODE, FRONT_LINE_CODES, FRONT_WARM_CODE

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_SST_STOPS = (
    (22.0, (34, 94, 168)),
    (25.0, (65, 182, 196)),
    (28.0, (255, 255, 191)),
    (30.0, (253, 174, 97)),
    (33.0, (215, 25, 28)),
)


def render_sst_png(values_celsius: np.ndarray) -> bytes:
    rgba = _sst_rgba(values_celsius)
    return encode_rgba_png(_north_up(rgba))


def render_front_png(front_values: np.ndarray) -> bytes:
    rgba = np.zeros((*front_values.shape, 4), dtype=np.uint8)
    cold = front_values == FRONT_COLD_CODE
    warm = front_values == FRONT_WARM_CODE
    line = np.isin(front_values, FRONT_LINE_CODES)
    rgba[cold] = (22, 79, 147, 82)
    rgba[warm] = (216, 91, 63, 78)
    rgba[line] = (20, 18, 17, 210)
    return encode_rgba_png(_north_up(rgba))


def render_combined_png(sst_celsius: np.ndarray, front_values: np.ndarray) -> bytes:
    base = _sst_rgba(sst_celsius)
    overlay = np.zeros_like(base)
    cold = front_values == FRONT_COLD_CODE
    warm = front_values == FRONT_WARM_CODE
    line = np.isin(front_values, FRONT_LINE_CODES)
    overlay[cold] = (22, 79, 147, 82)
    overlay[warm] = (216, 91, 63, 78)
    overlay[line] = (18, 16, 15, 230)
    combined = _alpha_composite(base, overlay)
    return encode_rgba_png(_north_up(combined))


def encode_rgba_png(rgba: np.ndarray) -> bytes:
    if rgba.ndim != 3 or rgba.shape[2] != 4:
        raise ValueError("RGBA image must have shape (height, width, 4)")
    height, width, _ = rgba.shape
    if height <= 0 or width <= 0:
        rgba = np.zeros((1, 1, 4), dtype=np.uint8)
        height, width = 1, 1
    raw_rows = b"".join(b"\x00" + rgba[row].tobytes() for row in range(height))
    return b"".join(
        [
            _PNG_SIGNATURE,
            _png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
            _png_chunk(b"IDAT", zlib.compress(raw_rows, level=6)),
            _png_chunk(b"IEND", b""),
        ]
    )


def _sst_rgba(values_celsius: np.ndarray) -> np.ndarray:
    values = np.asarray(values_celsius, dtype=float)
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    valid = np.isfinite(values)
    if not valid.any():
        return rgba
    clipped = np.clip(values, _SST_STOPS[0][0], _SST_STOPS[-1][0])
    red = np.zeros_like(clipped, dtype=float)
    green = np.zeros_like(clipped, dtype=float)
    blue = np.zeros_like(clipped, dtype=float)
    for left, right in pairwise(_SST_STOPS):
        left_value, left_color = left
        right_value, right_color = right
        segment = (clipped >= left_value) & (clipped <= right_value)
        ratio = (clipped[segment] - left_value) / (right_value - left_value)
        red[segment] = left_color[0] + (right_color[0] - left_color[0]) * ratio
        green[segment] = left_color[1] + (right_color[1] - left_color[1]) * ratio
        blue[segment] = left_color[2] + (right_color[2] - left_color[2]) * ratio
    below = clipped <= _SST_STOPS[0][0]
    above = clipped >= _SST_STOPS[-1][0]
    red[below], green[below], blue[below] = _SST_STOPS[0][1]
    red[above], green[above], blue[above] = _SST_STOPS[-1][1]
    rgba[..., 0] = np.where(valid, red, 0).astype(np.uint8)
    rgba[..., 1] = np.where(valid, green, 0).astype(np.uint8)
    rgba[..., 2] = np.where(valid, blue, 0).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 220, 0).astype(np.uint8)
    return rgba


def _alpha_composite(base: np.ndarray, overlay: np.ndarray) -> np.ndarray:
    base_float = base.astype(float) / 255
    overlay_float = overlay.astype(float) / 255
    base_alpha = base_float[..., 3:4]
    overlay_alpha = overlay_float[..., 3:4]
    output_alpha = overlay_alpha + base_alpha * (1 - overlay_alpha)
    safe_alpha = np.where(output_alpha == 0, 1, output_alpha)
    output_rgb = (
        overlay_float[..., :3] * overlay_alpha
        + base_float[..., :3] * base_alpha * (1 - overlay_alpha)
    ) / safe_alpha
    output = np.zeros_like(base, dtype=np.uint8)
    output[..., :3] = np.clip(output_rgb * 255, 0, 255).astype(np.uint8)
    output[..., 3] = np.clip(output_alpha[..., 0] * 255, 0, 255).astype(np.uint8)
    return output


def _north_up(rgba: np.ndarray) -> np.ndarray:
    return np.flipud(rgba)


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type)
    checksum = zlib.crc32(data, checksum)
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", checksum & 0xFFFFFFFF)
