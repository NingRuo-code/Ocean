"""导出「渔场向导」原型用的真实锋面数据快照。

数据源：Zenodo 20356239《A global daily mesoscale front dataset from satellite
observations》(CC BY 4.0)，本地样例位于 data/raw/front/<年>/front_location<YYYYMMDD>.nc。

本脚本做三件事：

1. 按 bbox 裁剪真实锋面栅格（0.05°），把 -10/10/30 锋面线像元聚成「锋面对象」，
   用连通域直径路径抽出一条中心线，再按公里做 Douglas-Peucker 抽稀；
2. 冷暖侧（-20 / 20）与锋面带（-10/10/30）保存为逐行 RLE，体积小、可精确还原；
3. 落成原型可直接 <script> 引入的 window.OF_DATA 模块（无需 fetch、无 CORS 限制）。

用法（在 Ocean/backend 下，用项目 venv）：

    .\\.venv\\Scripts\\python.exe scripts\\export_prototype_data.py `
        --dates 2024-08-05 2024-08-06 2024-08-07

注意：锋面文件的时间坐标单位错误（days since 0000-00-00），日期一律以文件名解析。
"""

from __future__ import annotations

import argparse
import contextlib
import json
import math
import re
import shutil
import sys
import tempfile
from collections import deque
from datetime import date
from pathlib import Path

import numpy as np
import xarray as xr

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(__file__).resolve().parents[1]      # <产品仓>/backend
REPO_DIR = BACKEND_DIR.parent                          # <产品仓>
DEFAULT_RAW_DIR = REPO_DIR / "data" / "raw" / "front"
# 前端与它的离线数据是一体的：<产品仓>/frontend/prototype/data（页面用相对路径引 data/**）
DEFAULT_OUT_DIR = REPO_DIR / "frontend" / "prototype" / "data"
DEFAULT_BBOX = (120.0, 27.0, 128.0, 34.0)  # 东海窗口，覆盖原型定位中心 124.5E/30.2N
DEFAULT_SAMPLE_NOTE = "数据集是逐日的，本演示每年只取 8 月 5—7 日 3 天做同期对比，页面上会写明这个抽样口径"
DEFAULT_SST_RAW_DIR = REPO_DIR / "data" / "raw" / "sst"
SST_BIN_C = 0.5
SST_PRODUCT = {
    "id": "noaacwBLENDEDCsstDaily",
    "name": "Sea-Surface Temperature, NOAA Geo-polar Blended Analysis Night Only (GHRSST L4)",
    "name_zh": "NOAA 地球同步+极轨融合海表温度（夜间，GHRSST L4）",
    "version": "v1.0",
    "url": "https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDCsstDaily",
    "license": "GHRSST 数据使用协议 free and open（免账号，可离线留存子集）",
    "citation": "NOAA NESDIS CoastWatch · GHRSST Geo_Polar_Blended_Night-OSPO-L4-GLOB-v1.0",
    "resolution_deg": 0.05,
    "variables": ["analysed_sst"],
    "unit": "degree_C",
    "bin_c": SST_BIN_C,
    "note": "与锋面数据集用的 ESA CCI / C3S SST 不是同一产品（不同源），同屏出现时属于两个来源的观测，页面必须标明",
}

LINE_CODES = (-10, 10, 30)
COLD_CODE = -20
WARM_CODE = 20
NODATA_CODE = -128

KM_PER_DEG = 111.195
DATE_IN_NAME = re.compile(r"(?P<y>19\d{2}|20\d{2})(?P<m>0[1-9]|1[0-2])(?P<d>0[1-9]|[12]\d|3[01])")

PRODUCT = {
    "id": "zenodo-20356239",
    "name": "A global daily mesoscale front dataset from satellite observations",
    "name_zh": "全球逐日中尺度锋面数据集",
    "version": "V1.0",
    "doi": "10.5281/zenodo.20356239",
    "url": "https://zenodo.org/records/20356239",
    "license": "CC BY 4.0",
    "citation": "Xing et al. (Shanghai Ocean University), 0.05 deg daily global mesoscale front dataset",
    "resolution_deg": 0.05,
    "variables": ["front"],
    "code_semantics": {
        "line": list(LINE_CODES),
        "cold_side": COLD_CODE,
        "warm_side": WARM_CODE,
        "nodata": NODATA_CODE,
        "note": "-128 同时表示陆地、湖泊、云与缺测，无法区分“没有锋面”与“没有观测”",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导出原型用的真实锋面数据快照")
    parser.add_argument("--mode", choices=("days", "clim"), default="days", help="days=单日地图图层；clim=往年同期统计")
    parser.add_argument("--dates", nargs="*", default=None, help="要导出的日期，缺省则扫描 raw 目录")
    parser.add_argument("--clim-dates", nargs="*", default=None, help="往年同期取样日期（clim 模式必填）")
    parser.add_argument("--bbox", default=",".join(str(v) for v in DEFAULT_BBOX), help="minLon,minLat,maxLon,maxLat")
    parser.add_argument("--anchor", default="124.5,30.2", help="往年同期的定位锚点 lon,lat（与原型①一致）")
    parser.add_argument("--ranges", default="10,20,30", help="往年同期对比的找鱼范围（公里，逗号分隔）")
    parser.add_argument("--clim-radii", default="10,20,30,50,100", help="clim 统计的半径列表（含参照用的大半径）")
    parser.add_argument("--sample-note", default=DEFAULT_SAMPLE_NOTE, help="往年同期的抽样口径说明")
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR), help="锋面 NetCDF 根目录")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="原型 data/ 目录")
    parser.add_argument("--tolerance-km", type=float, default=6.0, help="中心线抽稀容差（公里）")
    parser.add_argument("--min-length-km", type=float, default=20.0, help="小于该长度的对象不进入对象列表")
    parser.add_argument("--sst-raw-dir", default=str(DEFAULT_SST_RAW_DIR), help="海温 NetCDF 根目录")
    parser.add_argument("--no-sst", action="store_true", help="跳过海温导出（只出锋面）")
    return parser.parse_args()


# ==================== 栅格读取 ====================

def discover_dates(raw_dir: Path) -> list[str]:
    found: set[str] = set()
    for path in sorted(raw_dir.rglob("*.nc")):
        match = DATE_IN_NAME.search(path.name)
        if match:
            found.add(f"{match.group('y')}-{match.group('m')}-{match.group('d')}")
    return sorted(found)


def find_file(raw_dir: Path, day: str) -> Path:
    stamp = day.replace("-", "")
    matches = sorted(raw_dir.rglob(f"*{stamp}.nc"))
    if not matches:
        raise FileNotFoundError(f"未找到 {day} 的锋面文件（{stamp}）")
    return matches[0]


def load_window(path: Path, bbox: tuple[float, float, float, float]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """读取单日锋面栅格并裁到 bbox，返回 (int16 数组[lat,lon], lons, lats)。"""
    min_lon, min_lat, max_lon, max_lat = bbox
    with readable_path(path) as src, xr.open_dataset(src, decode_times=False) as ds:
        sub = ds["front"].isel(time=0).sel(
            lon=slice(min_lon, max_lon), lat=slice(min_lat, max_lat)
        ).load()
        values = np.asarray(sub.values).astype(np.int16)
        lons = np.asarray(sub["lon"].values, dtype=np.float64)
        lats = np.asarray(sub["lat"].values, dtype=np.float64)
    if lats[0] > lats[-1]:  # 统一成南->北、西->东，方便按行列索引
        values = values[::-1, :]
        lats = lats[::-1]
    if lons[0] > lons[-1]:
        values = values[:, ::-1]
        lons = lons[::-1]
    return values, lons, lats


def round3(value: float) -> float:
    return round(float(value), 3)


# ==================== 几何：公里度量 / 抽稀 / 连通域 ====================

def to_km(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = []
    for lon, lat in points:
        out.append((lon * KM_PER_DEG * math.cos(math.radians(lat)), lat * KM_PER_DEG))
    return out


def polyline_length_km(points: list[tuple[float, float]]) -> float:
    if len(points) < 2:
        return 0.0
    km = to_km(points)
    total = 0.0
    for (x0, y0), (x1, y1) in zip(km, km[1:]):
        total += math.hypot(x1 - x0, y1 - y0)
    return total


def _rd_distance(pt, a, b) -> float:
    """点到线段的垂直距离（公里尺度坐标）。"""
    px, py = pt
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    if denom == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify_km(points: list[tuple[float, float]], tolerance_km: float) -> list[tuple[float, float]]:
    """Douglas-Peucker 抽稀；先在公里坐标下判距离，再回到经纬度取点。"""
    if len(points) <= 2:
        return list(points)
    km = to_km(points)
    keep = [0, len(points) - 1]
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        if end <= start + 1:
            continue
        worst, worst_i = 0.0, -1
        for i in range(start + 1, end):
            dist = _rd_distance(km[i], km[start], km[end])
            if dist > worst:
                worst, worst_i = dist, i
        if worst > tolerance_km and worst_i > 0:
            keep.append(worst_i)
            stack.append((start, worst_i))
            stack.append((worst_i, end))
    keep.sort()
    return [points[i] for i in keep]


def components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """8 邻域连通域；按行列顺序扫描，编号稳定可复现。"""
    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    result: list[list[tuple[int, int]]] = []
    for row in range(height):
        for col in range(width):
            if not mask[row, col] or seen[row, col]:
                continue
            queue = deque([(row, col)])
            seen[row, col] = True
            cells: list[tuple[int, int]] = []
            while queue:
                r, c = queue.popleft()
                cells.append((r, c))
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if dr == 0 and dc == 0:
                            continue
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < height and 0 <= nc < width and mask[nr, nc] and not seen[nr, nc]:
                            seen[nr, nc] = True
                            queue.append((nr, nc))
            result.append(cells)
    return result


def longest_path(cells: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """连通域的直径路径（两遍 BFS），用作锋面对象的中心线。"""
    if len(cells) <= 2:
        return list(cells)
    index = {cell: i for i, cell in enumerate(cells)}
    neighbours: list[list[int]] = [[] for _ in cells]
    for cell, i in index.items():
        r, c = cell
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                j = index.get((r + dr, c + dc))
                if j is not None:
                    neighbours[i].append(j)

    def bfs(start: int) -> tuple[int, list[int]]:
        dist = [-1] * len(cells)
        parent = [-1] * len(cells)
        dist[start] = 0
        queue = deque([start])
        farthest = start
        while queue:
            node = queue.popleft()
            if dist[node] > dist[farthest]:
                farthest = node
            for nxt in neighbours[node]:
                if dist[nxt] == -1:
                    dist[nxt] = dist[node] + 1
                    parent[nxt] = node
                    queue.append(nxt)
        return farthest, parent

    end_a, _ = bfs(0)
    end_b, parent = bfs(end_a)
    path: list[int] = []
    node = end_b
    while node != -1:
        path.append(node)
        node = parent[node]
    path.reverse()
    return [cells[i] for i in path]


# ==================== 栅格 -> 紧凑 RLE ====================

def rle_rows(mask: np.ndarray) -> list[list[int]]:
    """逐行游程编码：[row, start, count]；只保留命中像元，体积与边界复杂度成正比。"""
    runs: list[list[int]] = []
    height, width = mask.shape
    for row in range(height):
        col = 0
        while col < width:
            if mask[row, col]:
                start = col
                while col < width and mask[row, col]:
                    col += 1
                runs.append([row, start, col - start])
            else:
                col += 1
    return runs


def rle_rows_with_value(values: np.ndarray, mask: np.ndarray) -> list[list[int]]:
    """带原始编码的游程：[row, start, count, code]，编码变化就断行。"""
    runs: list[list[int]] = []
    height, width = mask.shape
    for row in range(height):
        col = 0
        while col < width:
            if not mask[row, col]:
                col += 1
                continue
            code = int(values[row, col])
            start = col
            while col < width and mask[row, col] and int(values[row, col]) == code:
                col += 1
            runs.append([row, start, col - start, code])
    return runs


# ==================== 海表温度（NOAA GHRSST，度 C，按 bin 游程） ====================

def find_sst_file(raw_dir: Path, day: str) -> Path | None:
    stamp = day.replace("-", "")
    exact = sorted(raw_dir.rglob(f"sst_{stamp}.nc"))
    if exact:
        return exact[0]
    matches = sorted(raw_dir.rglob(f"*{stamp}.nc"))
    return matches[0] if matches else None


@contextlib.contextmanager
def readable_path(path: Path):
    """Windows 上 netCDF-C 打不开含非 ASCII 的路径（会报 FileNotFoundError）：
    这类路径先复制到临时 ASCII 目录再读，读完删掉临时目录。"""
    try:
        str(path.resolve()).encode("ascii")
        yield path
        return
    except UnicodeEncodeError:
        pass
    tmp_dir = Path(tempfile.mkdtemp(prefix="ocean-sst-"))
    tmp = tmp_dir / path.name
    try:
        shutil.copy2(path, tmp)
        yield tmp
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def load_sst_window(path: Path, bbox: tuple[float, float, float, float]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """读取单日 analysed_sst（度 C）并裁到 bbox，返回 (float 数组[lat,lon], lons, lats)。"""
    min_lon, min_lat, max_lon, max_lat = bbox
    with readable_path(path) as src, xr.open_dataset(src) as ds:
        name = "analysed_sst" if "analysed_sst" in ds else ("sst" if "sst" in ds else next(iter(ds.data_vars)))
        da = ds[name]
        if "time" in da.dims:
            da = da.isel(time=0)
        lat_name = "latitude" if "latitude" in da.coords else "lat"
        lon_name = "longitude" if "longitude" in da.coords else "lon"
        lat_vals = np.asarray(ds[lat_name].values, dtype=np.float64)
        lon_vals = np.asarray(ds[lon_name].values, dtype=np.float64)
        # 坐标可能是降序（ERDDAP 子集不一定），按实际顺序给 slice，否则会选到空
        lat_slice = slice(min_lat, max_lat) if lat_vals[0] <= lat_vals[-1] else slice(max_lat, min_lat)
        lon_slice = slice(min_lon, max_lon) if lon_vals[0] <= lon_vals[-1] else slice(max_lon, min_lon)
        sub = da.sel({lon_name: lon_slice, lat_name: lat_slice}).load()
        values = np.asarray(sub.values, dtype=np.float64)
        lons = np.asarray(sub[lon_name].values, dtype=np.float64)
        lats = np.asarray(sub[lat_name].values, dtype=np.float64)
    if lats[0] > lats[-1]:
        values = values[::-1, :]
        lats = lats[::-1]
    if lons[0] > lons[-1]:
        values = values[:, ::-1]
        lons = lons[::-1]
    return values, lons, lats


def build_sst_payload(
    day: str,
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    *,
    source_file: str,
    bin_c: float = SST_BIN_C,
) -> dict:
    """把海温场按 bin_c 分箱后落成逐行 RLE：[row, start, count, bin]（bin=round(T/0.5)）。"""
    finite = np.isfinite(values)
    valid = finite & (values > -5.0) & (values < 45.0)
    bins = np.where(valid, np.rint(np.where(valid, values, 0.0) / bin_c), 0).astype(np.int32)
    runs = rle_rows_with_value(bins, valid)
    stats = {
        "vmin_c": round(float(values[valid].min()), 2) if valid.any() else None,
        "vmax_c": round(float(values[valid].max()), 2) if valid.any() else None,
        "mean_c": round(float(values[valid].mean()), 2) if valid.any() else None,
        "valid_cells": int(valid.sum()),
        "missing_cells": int((~valid).sum()),
    }
    ny, nx = values.shape
    return {
        "date": day,
        "source_file": source_file,
        "product": SST_PRODUCT,
        "grid": {
            "lon0": round3(lons[0]),
            "lat0": round3(lats[0]),
            "dlon": round3(float(lons[1] - lons[0])) if nx > 1 else bin_c,
            "dlat": round3(float(lats[1] - lats[0])) if ny > 1 else bin_c,
            "nx": int(nx),
            "ny": int(ny),
        },
        "bin_c": bin_c,
        "runs": runs,
        "stats": stats,
    }


# ==================== 单日导出 ====================

def build_day_payload(
    day: str,
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    *,
    source_file: str,
    tolerance_km: float,
    min_length_km: float,
) -> dict:
    line_mask = np.isin(values, LINE_CODES)
    cold_mask = values == COLD_CODE
    warm_mask = values == WARM_CODE
    nodata_mask = values == NODATA_CODE

    heights, widths = line_mask.shape
    total_cells = int(values.size)
    nodata_cells = int(nodata_mask.sum())
    valid_cells = total_cells - nodata_cells

    objects = []
    lines_all = []
    for cells in components(line_mask):
        path = longest_path(cells)
        points = [(round3(lons[c]), round3(lats[r])) for r, c in path]
        line = simplify_km(points, tolerance_km)
        if len(line) < 2:
            line = points
        length_km = round(polyline_length_km(line), 1)
        codes = sorted({int(values[r, c]) for r, c in cells})
        lon_values = [lons[c] for _, c in cells]
        lat_values = [lats[r] for r, _ in cells]
        objects.append(
            {
                "front_id": None,  # 稍后按长度排序编号，保证编号稳定
                "pixel_count": len(cells),
                "codes": codes,
                "length_km": length_km,
                "bbox": [round3(min(lon_values)), round3(min(lat_values)),
                         round3(max(lon_values)), round3(max(lat_values))],
                "centroid": [round3(sum(lon_values) / len(lon_values)),
                             round3(sum(lat_values) / len(lat_values))],
                "line": [[p[0], p[1]] for p in line],
                "line_points_raw": len(points),
            }
        )

    objects.sort(key=lambda item: (-item["length_km"], item["centroid"][0], item["centroid"][1]))
    short_objects = [obj for obj in objects if obj["length_km"] < min_length_km]
    objects = [obj for obj in objects if obj["length_km"] >= min_length_km]
    for number, obj in enumerate(objects, start=1):
        obj["front_id"] = f"F{number:03d}"
    # 未进入对象列表的短锋面线仍要画出来（它们确实是数据），但不能冒充对象
    lines_all = [obj["line"] for obj in objects]
    lines_all.extend([obj["line"] for obj in short_objects])

    line_cells = int(line_mask.sum())
    quality = {
        "valid_cells": valid_cells,
        "nodata_cells": nodata_cells,
        "nodata_percent": round(nodata_cells / total_cells * 100, 2) if total_cells else 0,
        "front_line_cells": line_cells,
        "front_line_density_per_1000_pixels": round(line_cells / valid_cells * 1000, 2) if valid_cells else 0,
        "cold_side_cells": int(cold_mask.sum()),
        "warm_side_cells": int(warm_mask.sum()),
        "line_code_mix": {str(code): int((values == code).sum()) for code in LINE_CODES},
        "short_object_count": len(short_objects),
        "object_min_length_km": min_length_km,
        "line_tolerance_km": tolerance_km,
    }

    return {
        "date": day,
        "source_file": source_file,
        "grid": {
            "lon0": round3(lons[0]),
            "lat0": round3(lats[0]),
            "dlon": round3(lons[1] - lons[0]) if lons.size > 1 else 0.05,
            "dlat": round3(lats[1] - lats[0]) if lats.size > 1 else 0.05,
            "nx": int(widths),
            "ny": int(heights),
        },
        "objects": objects,
        "front_line": lines_all,
        "object_line_count": len(objects),
        "short_line_count": len(short_objects),
        "front_band_rle": rle_rows_with_value(values, line_mask),
        "cold_side_rle": rle_rows(cold_mask),
        "warm_side_rle": rle_rows(warm_mask),
        "nodata_rle": rle_rows(nodata_mask),
        "quality": quality,
        "has_sst": False,
        "has_intensity": False,
    }


def write_js(path: Path, body: str, source: str | None = None) -> int:
    payload = (
        "/* 本文件由 backend/scripts/export_prototype_data.py 生成，请勿手工修改。\n"
        f"   数据源：{source or 'Zenodo 20356239 全球逐日中尺度锋面数据集（CC BY 4.0）'}。*/\n"
        + body
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload, encoding="utf-8")
    return len(payload.encode("utf-8"))


# ==================== 往年同期（§5.2 唯一口径） ====================

def distance_km(lon: float, lat: float, anchor_lon: float, anchor_lat: float) -> float:
    dx = (lon - anchor_lon) * KM_PER_DEG * math.cos(math.radians(anchor_lat))
    dy = (lat - anchor_lat) * KM_PER_DEG
    return math.hypot(dx, dy)


def build_clim_row(
    day: str,
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    *,
    anchor: tuple[float, float],
    ranges: tuple[int, ...],
    source_file: str,
) -> dict:
    """单日统计：不同半径内的锋面线像元数 / 有效像元数，口径见需求 §5.2。"""
    line_mask = np.isin(values, LINE_CODES)
    valid_mask = values != NODATA_CODE
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    dist = np.hypot((lon_grid - anchor[0]) * KM_PER_DEG * math.cos(math.radians(anchor[1])),
                    (lat_grid - anchor[1]) * KM_PER_DEG)
    row: dict = {"date": day, "source_file": source_file, "by_range": {}}
    for radius in ranges:
        inside = dist <= radius
        valid_cells = int((valid_mask & inside).sum())
        line_cells = int((line_mask & inside).sum())
        has_data = valid_cells > 0
        row["by_range"][str(radius)] = {
            "line_cells": line_cells,
            "valid_cells": valid_cells,
            "front_present": bool(has_data and line_cells > 0),
            "status": "ok" if has_data else "no_observation",
        }
    return row


def build_clim_payload(rows: list[dict], ranges: tuple[int, ...], sample_note: str) -> dict:
    by_year: dict[str, dict] = {}
    by_day: dict[str, dict] = {}
    for row in rows:
        year = row["date"][:4]
        month_day = row["date"][5:]
        bucket = by_year.setdefault(year, {"days": 0, "valid_days": 0, "by_range": {}})
        bucket["days"] += 1
        if any(item["status"] == "ok" for item in row["by_range"].values()):
            bucket["valid_days"] += 1
        for radius in ranges:
            key = str(radius)
            entry = bucket["by_range"].setdefault(key, {"days": 0, "present_days": 0, "line_cells": 0})
            item = row["by_range"][key]
            if item["status"] != "ok":
                continue
            entry["days"] += 1
            entry["line_cells"] += item["line_cells"]
            if item["front_present"]:
                entry["present_days"] += 1
        day_entry = by_day.setdefault(month_day, {"years": {}, "by_range": {}})
        day_entry["years"][year] = {key: value for key, value in row["by_range"].items()}
        for radius in ranges:
            key = str(radius)
            entry = day_entry["by_range"].setdefault(key, {"days": 0, "present_days": 0})
            item = row["by_range"][key]
            if item["status"] != "ok":
                continue
            entry["days"] += 1
            if item["front_present"]:
                entry["present_days"] += 1
    for bucket in by_year.values():
        for entry in bucket["by_range"].values():
            entry["probability"] = round(entry["present_days"] / entry["days"], 3) if entry["days"] else None
    for day_entry in by_day.values():
        for entry in day_entry["by_range"].values():
            entry["probability"] = round(entry["present_days"] / entry["days"], 3) if entry["days"] else None
    return {
        "method": "front_present = 半径内锋面线像元数 > 0；probability = 有锋面天数 / 有效天数",
        "sample_note": sample_note,
        "rows": rows,
        "by_year": by_year,
        "by_day": by_day,
    }


# ==================== meta.js（原型据此判断"有没有数据"） ====================

KNOWN_ISSUES = [
    "锋面文件不含 SST；海温另用 NOAA GHRSST（0.05° 逐日），与锋面不是同一产品",
    "-128 同时是陆地、云与缺测，区分不了“没有锋面”和“没有观测”",
    "-10/10/30 的物理含义数据说明里有歧义，页面只当“锋面线”画",
    "文件时间坐标单位有误（days since 0000-00-00），日期以文件名为准",
    "对象编号是本地临时编号，不是数据集自带的轨迹编号",
    "海况、强度、预报、渔场都没接真实数据",
]


def build_meta(
    out_dir: Path,
    bbox: tuple[float, float, float, float],
    anchor: tuple[float, float],
    ranges: tuple[int, ...],
    grid: dict | None,
    days: list[str],
    sst_days: list[str],
    clim_dates: list[str],
    sample_note: str,
    generated_at: str,
) -> dict:
    basemap_ready = (out_dir / "base" / "basemap.js").is_file()
    clim_ready = (out_dir / "clim" / "same-period.js").is_file()
    clim_years = sorted({day[:4] for day in clim_dates})
    sst_ready = bool(sst_days)
    return {
        "product": PRODUCT,
        "region": {
            "name": "东海",
            "bbox": list(bbox),
            "anchor": list(anchor),
            "ranges_km": list(ranges),
        },
        "grid": grid or {"resolution_deg": PRODUCT["resolution_deg"]},
        "availability": {
            "days": days,
            "sst": {
                "ready": sst_ready,
                "days": sst_days,
                "product": SST_PRODUCT,
                "bin_c": SST_BIN_C,
                "note": "海温按 " + str(SST_BIN_C) + " °C 分箱后落成逐行游程，页面按箱号还原成色带（不插值）",
            },
            "clim": {
                "ready": clim_ready,
                "years": clim_years,
                "dates": clim_dates,
                "sample_note": sample_note,
            },
            "basemap": {
                "ready": basemap_ready,
                "source": "Natural Earth 1:10m（公有领域）",
            },
        },
        "status": {
            "front_line": "real",
            "cold_side": "real",
            "warm_side": "real",
            "front_objects": "real",
            "sst": "real" if sst_ready else "not_available",
            "intensity": "not_available",
            "forecast": "not_available",
            "sea_state": "not_available",
            "fishing_grounds": "not_available",
        },
        "generated_at": generated_at,
        "generator": "backend/scripts/export_prototype_data.py",
        "known_issues": KNOWN_ISSUES,
    }


def scan_days(out_dir: Path) -> list[str]:
    day_dir = out_dir / "day"
    if not day_dir.is_dir():
        return []
    return sorted(path.stem for path in day_dir.glob("*.js"))


def scan_sst_days(out_dir: Path) -> list[str]:
    sst_dir = out_dir / "sst"
    if not sst_dir.is_dir():
        return []
    return sorted(path.stem for path in sst_dir.glob("*.js"))


def read_clim_dates(out_dir: Path) -> list[str]:
    """从已生成的 clim 文件里取回抽样日期，避免只跑 days 模式时 meta 丢信息。"""
    path = out_dir / "clim" / "same-period.js"
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    return sorted(set(re.findall(r'"date":"(\d{4}-\d{2}-\d{2})"', text)))


def read_clim_note(out_dir: Path) -> str | None:
    path = out_dir / "clim" / "same-period.js"
    if not path.is_file():
        return None
    match = re.search(r'"sample_note":"([^"]*)"', path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def main() -> None:
    args = parse_args()
    bbox = tuple(float(part) for part in args.bbox.split(","))  # type: ignore[assignment]
    if len(bbox) != 4:
        raise SystemExit("--bbox 需要 4 个数字：minLon,minLat,maxLon,maxLat")
    anchor = tuple(float(part) for part in args.anchor.split(","))  # type: ignore[assignment]
    ranges = tuple(int(part) for part in args.ranges.split(","))
    clim_radii = tuple(int(part) for part in args.clim_radii.split(","))
    raw_dir = Path(args.raw_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    print(f"raw  : {raw_dir}")
    print(f"out  : {out_dir}")

    days = args.dates or discover_dates(raw_dir)
    clim_dates = args.clim_dates or []
    grid_info: dict | None = None
    generated_at = date.today().isoformat()

    if args.mode == "days":
        if not days:
            raise SystemExit("没有可导出的日期")
        for day in days:
            path = find_file(raw_dir, day)
            values, lons, lats = load_window(path, bbox)
            payload = build_day_payload(
                day,
                values,
                lons,
                lats,
                source_file=path.name,
                tolerance_km=args.tolerance_km,
                min_length_km=args.min_length_km,
            )
            size = write_js(out_dir / "day" / f"{day}.js", "window.OF_DATA_DAYS = window.OF_DATA_DAYS || {};\n"
                           f"window.OF_DATA_DAYS[{json.dumps(day)}] = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
            quality = payload["quality"]
            print(f"  {day}  objects={len(payload['objects']):3d}  线像元={quality['front_line_cells']:5d}"
                  f"  冷侧={quality['cold_side_cells']:5d}  暖侧={quality['warm_side_cells']:5d}"
                  f"  缺测={quality['nodata_percent']:5.1f}%  输出={size/1024:.1f} KB")
            grid_info = payload["grid"]

    sst_days: list[str] = []
    if args.mode == "days" and not args.no_sst:
        sst_raw_dir = Path(args.sst_raw_dir).resolve()
        for day in days:
            path = find_sst_file(sst_raw_dir, day)
            if path is None:
                continue
            try:
                values, lons, lats = load_sst_window(path, bbox)
            except Exception as exc:  # 海温缺失不该拖垮锋面导出
                print(f"  {day}  海温读取失败（跳过）：{type(exc).__name__}: {exc}")
                continue
            payload = build_sst_payload(day, values, lons, lats, source_file=path.name)
            size = write_js(out_dir / "sst" / f"{day}.js",
                            "window.OF_DATA_SST = window.OF_DATA_SST || {};\n"
                            f"window.OF_DATA_SST[{json.dumps(day)}] = "
                            + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
                            source="NOAA CoastWatch ERDDAP / GHRSST "
                                   + SST_PRODUCT["id"] + "（free and open；与锋面数据集不同源）")
            stats = payload["stats"]
            sst_days.append(day)
            print(f"  {day}  海温 {stats['vmin_c']}~{stats['vmax_c']} °C（均 {stats['mean_c']}）"
                  f"  有效像元={stats['valid_cells']:5d}  游程={len(payload['runs']):4d}  输出={size/1024:.1f} KB")

    if args.mode == "clim":
        if not clim_dates:
            clim_dates = discover_dates(raw_dir)
        if not clim_dates:
            raise SystemExit("没有可统计的日期（--clim-dates 或 data/raw 下都没有）")
        rows = []
        probe_radius = 20 if 20 in clim_radii else clim_radii[0]
        for day in clim_dates:
            path = find_file(raw_dir, day)
            values, lons, lats = load_window(path, bbox)
            rows.append(build_clim_row(day, values, lons, lats, anchor=anchor, ranges=clim_radii, source_file=path.name))
            present = rows[-1]["by_range"][str(probe_radius)]["front_present"]
            print(f"  {day}  {probe_radius} km 内锋面={'有' if present else '无'}"
                  f"  线像元={rows[-1]['by_range'][str(probe_radius)]['line_cells']}")
        years = sorted({row["date"][:4] for row in rows})
        args.sample_note = f"{args.sample_note}；本次实际取样 {len(rows)} 天，覆盖 {'、'.join(years)} 年"
        payload = build_clim_payload(rows, clim_radii, args.sample_note)
        size = write_js(out_dir / "clim" / "same-period.js",
                        "window.OF_DATA_CLIM = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
        print(f"  clim 年份={years}  样本天数={len(rows)}  输出={size/1024:.1f} KB")

    day_files = scan_days(out_dir)
    sst_files = scan_sst_days(out_dir)
    manifest = {
        "days": day_files,
        "sst": sst_files,
        "clim": (out_dir / "clim" / "same-period.js").is_file(),
        "basemap": (out_dir / "base" / "basemap.js").is_file(),
        "generated_at": generated_at,
    }
    write_js(out_dir / "days.js",
             "window.OF_DATA_INDEX = " + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"  index 锋面={len(day_files)} 天  海温={len(sst_files)} 天")

    meta = build_meta(
        out_dir,
        bbox,
        anchor,
        ranges,
        grid_info,
        day_files,
        sst_files,
        clim_dates or read_clim_dates(out_dir),
        read_clim_note(out_dir) or args.sample_note,
        generated_at,
    )
    size = write_js(out_dir / "meta.js", "window.OF_DATA_META = " + json.dumps(meta, ensure_ascii=False, indent=2) + ";\n")
    print(f"  meta  可用日期={len(day_files)} 天  海温={'就绪' if meta['availability']['sst']['ready'] else '未导出'}"
          f"  clim={'就绪' if meta['availability']['clim']['ready'] else '未导出'}"
          f"  basemap={'就绪' if meta['availability']['basemap']['ready'] else '未导出'}  输出={size/1024:.1f} KB")


if __name__ == "__main__":
    main()
