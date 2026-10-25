"""渔场层（GFW AIS 表观捕捞努力量）读取与查询。

数据由 `tools/pipeline/fetch_gfw_effort.py` 生成，落在 `<raw_data_dir>/fishing/`：
  manifest.json            逐日汇总（日期 / 格点数 / 总小时数 / 船舶数）+ 数据源信息
  effort-YYYYMMDD.json     单日格点：cells[{lon, lat, hours, vessel_count, top_gears}]

口径提醒（写进接口，避免被读成"鱼获量"）：
  * hours 是 **AIS 表观捕捞努力量（小时）**，不是产量、不是渔获；
  * 分辨率 0.1°，覆盖 120–128°E / 27–34°N；
  * GFW API 条款：仅限非商业用途，使用时须署名 Global Fishing Watch。
"""

from __future__ import annotations

import json
import math
from datetime import date as DateType
from pathlib import Path

from .config import settings

FISHING_SUBDIR = "fishing"
DAY_FILE_PREFIX = "effort-"

SOURCE = {
    "name": "Global Fishing Watch · AIS apparent fishing effort",
    "api": "4Wings report v3",
    "dataset": "public-global-fishing-effort:latest",
    "citation": "Kroodsma et al. 2018, Science, doi:10.1126/science.aao5646",
    "url": "https://globalfishingwatch.org/",
    "license": "CC BY-SA 4.0",
    "terms": "GFW API 数据仅限非商业用途；使用时须署名 Global Fishing Watch",
    "unit": "hours",
    "meaning": "AIS 表观捕捞努力量（小时），不是渔获量",
}


class FishingDataUnavailable(RuntimeError):
    """渔场数据尚未准备好（脚本没跑过 / 目录为空）。"""


def fishing_dir() -> Path:
    return settings.raw_data_dir / FISHING_SUBDIR


def _manifest_path() -> Path:
    return fishing_dir() / "manifest.json"


def _day_path(observation_date: DateType) -> Path:
    return fishing_dir() / f"{DAY_FILE_PREFIX}{observation_date.strftime('%Y%m%d')}.json"


def read_manifest() -> dict[str, object] | None:
    path = _manifest_path()
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def available_days() -> list[tuple[DateType, dict[str, object] | None]]:
    """返回 [(日期, 汇总或 None)]，按日期升序。

    优先用 manifest.json 的逐日汇总（省去逐文件解析）；manifest 缺失或与文件不一致时
    直接扫文件名兜底，保证"有文件就一定列得出来"。
    """
    summaries: dict[DateType, dict[str, object] | None] = {}
    directory = fishing_dir()
    if directory.is_dir():
        for path in directory.glob(f"{DAY_FILE_PREFIX}*.json"):
            stem = path.stem[len(DAY_FILE_PREFIX):]
            if len(stem) != 8 or not stem.isdigit():
                continue
            try:
                parsed = DateType(int(stem[0:4]), int(stem[4:6]), int(stem[6:8]))
            except ValueError:
                continue
            summaries[parsed] = None
    manifest = read_manifest()
    days = manifest.get("days") if isinstance(manifest, dict) else None
    for item in days if isinstance(days, list) else []:
        if not isinstance(item, dict) or not item.get("date"):
            continue
        try:
            parsed = DateType.fromisoformat(str(item["date"]))
        except ValueError:
            continue
        summaries[parsed] = item
    return sorted(summaries.items(), key=lambda pair: pair[0])


def load_day(observation_date: DateType) -> dict[str, object]:
    path = _day_path(observation_date)
    if not path.is_file():
        raise FishingDataUnavailable(
            f"{observation_date.isoformat()} 没有渔场数据文件（{path.name}）；"
            "先在服务器上跑 tools/pipeline/fetch_gfw_effort.py"
        )
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FishingDataUnavailable(f"渔场数据文件无法解析：{path.name}（{error}）") from error
    if not isinstance(payload, dict):
        raise FishingDataUnavailable(f"渔场数据文件结构异常：{path.name}")
    return payload


def cells_of(day: dict[str, object]) -> list[dict[str, object]]:
    cells = day.get("cells")
    return [cell for cell in cells if isinstance(cell, dict)] if isinstance(cells, list) else []


def cell_size_deg(day: dict[str, object]) -> float:
    try:
        value = float(day.get("spatial_resolution_deg") or 0.0)
    except (TypeError, ValueError):
        value = 0.0
    return value if value > 0 else 0.1


def bounds_of(day: dict[str, object]) -> list[float]:
    """格点覆盖范围（格点中心 → 格边），用于前端把 PNG 摆到正确的经纬度上。"""
    bbox = day.get("bbox")
    if not isinstance(bbox, list) or len(bbox) != 4:
        bbox = [120.0, 27.0, 128.0, 34.0]
    cell = cell_size_deg(day)
    return [
        round(float(bbox[0]) - cell / 2, 4),
        round(float(bbox[1]) - cell / 2, 4),
        round(float(bbox[2]) + cell / 2, 4),
        round(float(bbox[3]) + cell / 2, 4),
    ]


def point_lookup(day: dict[str, object], longitude: float, latitude: float) -> dict[str, object] | None:
    """按 0.1° 格点就近匹配（落盘坐标都是 0.1 的整数倍，实测如 123.6 / 30.2）。

    先试四舍五入到一位小数的格点，再试相邻 8 格；命中不了返回 None——
    不插值、不拿邻格的值冒充本格，界面据此显示"这一格没有作业记录"。
    """
    step = cell_size_deg(day)
    decimals = max(0, int(round(-math.log10(step)))) if step < 1 else 0
    index: dict[tuple[float, float], dict[str, object]] = {}
    for cell in cells_of(day):
        try:
            index[(round(float(cell["lon"]), decimals), round(float(cell["lat"]), decimals))] = cell
        except (KeyError, TypeError, ValueError):
            continue
    base_lon = round(longitude, decimals)
    base_lat = round(latitude, decimals)
    offsets = [(0, 0), (-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for d_lon, d_lat in offsets:
        key = (round(base_lon + d_lon * step, decimals), round(base_lat + d_lat * step, decimals))
        hit = index.get(key)
        if hit is not None:
            return {
                "cell_lon": key[0],
                "cell_lat": key[1],
                "hours": float(hit.get("hours") or 0.0),
                "vessel_count": int(hit.get("vessel_count") or 0),
                "top_gears": [str(gear) for gear in (hit.get("top_gears") or [])],
                "matched": d_lon == 0 and d_lat == 0,
            }
    return None


def cell_grid(day: dict[str, object]) -> tuple[object, object, list[float]]:
    """把 cells 铺成二维数组：返回 (hours, vessel_count, bounds)，行序为南→北。"""
    import numpy as np  # 局部导入：只有要出 PNG 时才需要

    bounds = bounds_of(day)
    lon_min, lat_min, lon_max, lat_max = bounds
    cell = cell_size_deg(day)
    nx = max(1, int(round((lon_max - lon_min) / cell)))
    ny = max(1, int(round((lat_max - lat_min) / cell)))
    hours = np.zeros((ny, nx), dtype=float)
    vessels = np.zeros((ny, nx), dtype=float)
    for item in cells_of(day):
        try:
            lon = float(item["lon"])
            lat = float(item["lat"])
        except (KeyError, TypeError, ValueError):
            continue
        col = int(math.floor((lon - lon_min) / cell + 1e-6))
        row = int(math.floor((lat - lat_min) / cell + 1e-6))
        if 0 <= row < ny and 0 <= col < nx:
            hours[row, col] = max(hours[row, col], float(item.get("hours") or 0.0))
            vessels[row, col] = max(vessels[row, col], float(item.get("vessel_count") or 0.0))
    return hours, vessels, bounds

