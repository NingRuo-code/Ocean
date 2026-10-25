from __future__ import annotations

import struct
import zlib
from itertools import pairwise

import numpy as np

from .data_access import FRONT_COLD_CODE, FRONT_LINE_CODES, FRONT_WARM_CODE

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_SST_STOPS = (
    (0.0, (34, 94, 168)),
    (0.33, (65, 182, 196)),
    (0.66, (255, 255, 191)),
    (0.83, (253, 174, 97)),
    (1.0, (215, 25, 28)),
)
_SST_MIN_SPAN = 4.0   # 色标至少要 4 ℃ 跨度，否则平稳海域会被拉成噪声


def sst_scale(values_celsius: np.ndarray) -> tuple[float, float]:
    """按当前窗口的真实取值算色标上下限（模型里固定 22–33 ℃ 的夏季色标在冬季会整幅一个色）。

    用 2% / 98% 分位抗离群，并保证至少 4 ℃ 跨度；实际用的上下限会随响应头一起给前端，
    这样图例能标出真实数值，而不是猜一个固定色标。
    """
    values = np.asarray(values_celsius, dtype=float)
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return (0.0, _SST_MIN_SPAN)
    low = float(np.percentile(finite, 2))
    high = float(np.percentile(finite, 98))
    span = high - low
    if span < _SST_MIN_SPAN:
        center = (low + high) / 2
        low = center - _SST_MIN_SPAN / 2
        high = center + _SST_MIN_SPAN / 2
    return (round(low, 2), round(high, 2))


def render_sst_png(values_celsius: np.ndarray, scale: tuple[float, float] | None = None) -> bytes:
    rgba = _sst_rgba(values_celsius, scale)
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


def render_combined_png(
    sst_celsius: np.ndarray,
    front_values: np.ndarray,
    scale: tuple[float, float] | None = None,
) -> bytes:
    base = _sst_rgba(sst_celsius, scale)
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


def _sst_rgba(values_celsius: np.ndarray, scale: tuple[float, float] | None = None) -> np.ndarray:
    values = np.asarray(values_celsius, dtype=float)
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    valid = np.isfinite(values)
    if not valid.any():
        return rgba
    low, high = scale if scale else sst_scale(values)
    if high - low < 1e-6:
        high = low + 1e-6
    # 归一化到 0~1，再按固定色带取色：色带本身不随日期变，只有映射区间随窗口变
    norm = np.clip((values - low) / (high - low), 0.0, 1.0)
    red = np.zeros_like(norm)
    green = np.zeros_like(norm)
    blue = np.zeros_like(norm)
    for left, right in pairwise(_SST_STOPS):
        left_pos, left_color = left
        right_pos, right_color = right
        segment = (norm >= left_pos) & (norm <= right_pos)
        span = right_pos - left_pos
        ratio = np.zeros_like(norm) if span <= 0 else (norm - left_pos) / span
        red[segment] = left_color[0] + (right_color[0] - left_color[0]) * ratio[segment]
        green[segment] = left_color[1] + (right_color[1] - left_color[1]) * ratio[segment]
        blue[segment] = left_color[2] + (right_color[2] - left_color[2]) * ratio[segment]
    rgba[..., 0] = np.where(valid, red, 0).astype(np.uint8)
    rgba[..., 1] = np.where(valid, green, 0).astype(np.uint8)
    rgba[..., 2] = np.where(valid, blue, 0).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 220, 0).astype(np.uint8)
    return rgba


_FISHING_STOPS = (
    (0.5, (255, 247, 188), 70),
    (5.0, (254, 227, 145), 110),
    (20.0, (254, 196, 79), 150),
    (60.0, (244, 109, 67), 195),
    (150.0, (178, 24, 43), 230),
)


def render_fishing_png(hours: np.ndarray, max_hours: float | None = None) -> bytes:
    """把 GFW 捕捞努力量（小时）画成半透明热力格：没有作业记录的格子完全透明。

    `max_hours` 只影响色标上限（默认 150 小时，约等于一天半的持续作业），
    不改变任何数值——数值本身在 JSON 接口里原样给出。
    """
    values = np.asarray(hours, dtype=float)
    upper = float(max_hours) if max_hours and max_hours > 0 else _FISHING_STOPS[-1][0]
    lower = _FISHING_STOPS[0][0]
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    active = np.isfinite(values) & (values >= lower)
    if not active.any():
        return encode_rgba_png(_north_up(rgba))

    clipped = np.clip(values, lower, upper)
    red = np.zeros_like(clipped)
    green = np.zeros_like(clipped)
    blue = np.zeros_like(clipped)
    alpha = np.zeros_like(clipped)
    stops = list(_FISHING_STOPS)
    if upper > stops[-1][0]:
        stops.append((upper, stops[-1][1], stops[-1][2]))
    for left, right in pairwise(stops):
        left_value, left_color, left_alpha = left
        right_value, right_color, right_alpha = right
        segment = active & (clipped >= left_value) & (clipped <= right_value)
        span = right_value - left_value
        ratio = np.zeros_like(clipped) if span <= 0 else (clipped - left_value) / span
        red[segment] = left_color[0] + (right_color[0] - left_color[0]) * ratio[segment]
        green[segment] = left_color[1] + (right_color[1] - left_color[1]) * ratio[segment]
        blue[segment] = left_color[2] + (right_color[2] - left_color[2]) * ratio[segment]
        alpha[segment] = left_alpha + (right_alpha - left_alpha) * ratio[segment]

    rgba[..., 0] = np.where(active, red, 0).astype(np.uint8)
    rgba[..., 1] = np.where(active, green, 0).astype(np.uint8)
    rgba[..., 2] = np.where(active, blue, 0).astype(np.uint8)
    rgba[..., 3] = np.where(active, alpha, 0).astype(np.uint8)
    return encode_rgba_png(_north_up(rgba))


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
