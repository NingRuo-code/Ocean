"""抓取 Global Fishing Watch 的 AIS「表观捕捞努力量」（渔场数据）到本仓 data/raw/fishing/。

数据出处（Kroodsma et al., Science 2018, doi:10.1126/science.aao5646 发布的数据产品）
- 接口：GFW API v3 · 4Wings report（POST https://gateway.api.globalfishingwatch.org/v3/4wings/report）
- 数据集：public-global-fishing-effort:latest（表观捕捞努力量，小时）
          public-global-presence:latest（全部船舶存在时长，--dataset presence）
- 覆盖：2017 年至今（约 5 天前）；分辨率 LOW=0.1° / HIGH=0.01°；粒度 HOURLY/DAILY/MONTHLY/YEARLY
- 许可：GFW 公开数据 CC BY-SA 4.0；**API 使用条款限定非商业用途**（课程/科研可用，页面必须标注来源）

契约要点（照抄官方 R 客户端 gfwr 源码，避免猜错）
- 认证：`Authorization: Bearer <token>`；`Content-Type: application/json`
- 查询参数：`datasets[0]`、`spatial-resolution`、`temporal-resolution`、`date-range`(start,end；end 不含，跨度 ≤366 天)、`format=CSV`
- 请求体：`{"geojson": <多边形>}`（自定区域必须包在 geojson 键下）
- 返回：zip 压缩包，内含 CSV

用法
    # 只打印将发出的请求，不调用 API（无需 token）
    python tools/pipeline/fetch_gfw_effort.py --start 2024-07-01 --end 2024-09-01 --dry-run
    # 真取数（token 放环境变量 GFW_TOKEN）
    python tools/pipeline/fetch_gfw_effort.py --start 2024-07-01 --end 2024-09-01
    # 按锋面数据的实际覆盖日期取（自动合并连续区间）
    python tools/pipeline/fetch_gfw_effort.py --from-front-data

申请 token：https://globalfishingwatch.org/our-apis/tokens （免费账号；服务器上建议存 /etc/ocean/gfw.env）
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import zipfile
from datetime import date, timedelta
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
# 服务器上数据在 /srv/ocean/data/raw（由 systemd 的 OCEAN_RAW_DATA_DIR 指定），本地则是 <仓根>/data/raw；
# 这里与后端保持同一套约定：有环境变量就用它，否则退回仓内路径。
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else REPO_ROOT / "data" / "raw"
DEFAULT_OUT_DIR = RAW_ROOT / "fishing"
DEFAULT_FRONT_DIR = RAW_ROOT / "front"
# 与 meta.js / 后端一致的东海窗口
DEFAULT_BBOX = (120.0, 27.0, 128.0, 34.0)

API_URL = "https://gateway.api.globalfishingwatch.org/v3/4wings/report"
DATASETS = {
    "effort": "public-global-fishing-effort:latest",
    "presence": "public-global-presence:latest",
}
EARLIEST_DATE = date(2017, 1, 1)   # GFW 4Wings 自 2017 年起有数据
MAX_RANGE_DAYS = 366               # GFW 单次 date-range 限制
RESOLUTION_DEG = {"LOW": 0.1, "HIGH": 0.01}


def clean_token(value: str) -> str:
    """规范化 token：去掉 CR/LF/首尾空白与仓库常见的包裹引号。

    ⚠️ 实测坑：在 Windows 上生成的 env 文件是 CRLF，scp 到 Linux 后 token 尾部会带 \\r，
    请求头变成 `Bearer <token>\\r`，GFW 直接拒绝：
    `Invalid leading whitespace, reserved character(s), or return character(s) in header value`。
    """
    return value.replace("\r", "").replace("\n", "").strip().strip('"').strip("'")

def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"日期格式应为 YYYY-MM-DD，收到 {value!r}") from exc


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    parts = [item.strip() for item in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox 需要 4 个数：minLon,minLat,maxLon,maxLat")
    lon0, lat0, lon1, lat1 = (float(item) for item in parts)
    return lon0, lat0, lon1, lat1


def bbox_polygon(bbox: tuple[float, float, float, float]) -> dict[str, object]:
    lon0, lat0, lon1, lat1 = bbox
    ring = [[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]
    return {"type": "Polygon", "coordinates": [ring]}


def dates_from_front_data(front_dir: Path) -> list[date]:
    """锋面数据实际覆盖的日期（文件名形如 front_location20240805.nc）。"""
    pattern = re.compile(r"(\d{8})")
    found: set[date] = set()
    for path in sorted(front_dir.rglob("*.nc")):
        match = pattern.search(path.stem)
        if not match:
            continue
        try:
            found.add(date(int(match.group(1)[:4]), int(match.group(1)[4:6]), int(match.group(1)[6:8])))
        except ValueError:
            continue
    return sorted(found)


def to_ranges(dates: list[date]) -> list[tuple[date, date]]:
    """把日期列表合并成连续区间（GFW 的 date-range 是闭开区间）。"""
    ranges: list[tuple[date, date]] = []
    for item in sorted(dates):
        if ranges and item == ranges[-1][1]:
            start, _ = ranges[-1]
            ranges[-1] = (start, item + timedelta(days=1))
        else:
            ranges.append((item, item + timedelta(days=1)))
    return ranges


def split_long_ranges(ranges: list[tuple[date, date]]) -> list[tuple[date, date]]:
    """GFW 限制单次请求跨度 ≤ 366 天，超出就切开。"""
    out: list[tuple[date, date]] = []
    for start, end in ranges:
        cursor = start
        while (end - cursor).days > MAX_RANGE_DAYS:
            out.append((cursor, cursor + timedelta(days=MAX_RANGE_DAYS)))
            cursor = cursor + timedelta(days=MAX_RANGE_DAYS)
        out.append((cursor, end))
    return out


def build_request(
    *,
    bbox: tuple[float, float, float, float],
    start: date,
    end: date,
    dataset: str,
    resolution: str,
    temporal: str,
    group_by: str | None = None,
) -> tuple[str, dict[str, str], dict[str, object]]:
    params = {
        "datasets[0]": DATASETS[dataset],
        "spatial-resolution": resolution,
        "temporal-resolution": temporal,
        "date-range": f"{start.isoformat()},{end.isoformat()}",
        "format": "CSV",
    }
    if group_by:
        # 不分组时返回的是「每船·每格·每天」明细（实测 1 天 19488 行），
        # 多天区间会让响应大到服务端超时（实测 3 天区间 read timeout）。
        # 我们只按格点汇总，用 group-by 让服务端先聚合，行数可降一个数量级。
        params["group-by"] = group_by
    body = {"geojson": bbox_polygon(bbox)}
    return API_URL, params, body


def explode_to_days(ranges: list[tuple[date, date]]) -> list[tuple[date, date]]:
    """把区间拆成单日（单日请求实测 ~18s，最稳）。"""
    out: list[tuple[date, date]] = []
    for start, end in ranges:
        cursor = start
        while cursor < end:
            out.append((cursor, cursor + timedelta(days=1)))
            cursor += timedelta(days=1)
    return out

def fetch_range(
    *,
    bbox: tuple[float, float, float, float],
    start: date,
    end: date,
    dataset: str,
    resolution: str,
    temporal: str,
    token: str,
    timeout: float,
    retries: int,
    group_by: str | None = None,
) -> list[dict[str, float | str]]:
    url, params, body = build_request(
        bbox=bbox, start=start, end=end, dataset=dataset, resolution=resolution,
        temporal=temporal, group_by=group_by,
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "ocean-front-prototype/0.1 (course prototype; non-commercial)",
    }
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(url, params=params, json=body, headers=headers, timeout=timeout)
            if response.status_code == 401:
                raise SystemExit(
                    "401 未授权：token 无效或已过期，请到 "
                    "https://globalfishingwatch.org/our-apis/tokens 重新申请"
                )
            if response.status_code == 429:
                wait = 20 * attempt
                # 必须记下来：否则 5 次全是 429 时 last_error 仍是 None，
                # 最终报错会变成没头没尾的「取数失败：None」
                last_error = RuntimeError(f"HTTP 429 速率受限（{attempt}/{retries} 次尝试均被限流）")
                print(f"  429 速率受限，{wait}s 后重试（{attempt}/{retries}）", file=sys.stderr)
                time.sleep(wait)
                continue
            response.raise_for_status()
            return parse_response(response.content, dataset)
        except SystemExit:
            raise
        except Exception as exc:  # noqa: BLE001 - 网络/解析异常统一转重试
            last_error = exc
            wait = 5 * attempt
            print(f"  第 {attempt} 次请求失败（{exc}），{wait}s 后重试", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"{start}~{end} 取数失败：{last_error}")


def parse_response(payload: bytes, dataset: str) -> list[dict[str, float | str]]:
    """GFW 返回的是 zip（内含 CSV）。列名做兼容处理，不同版本字段名略有差异。"""
    if payload[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
            if not names:
                raise ValueError(f"返回的 zip 里没有 CSV：{archive.namelist()}")
            text = archive.read(names[0]).decode("utf-8-sig")
    else:
        text = payload.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []
    if not fieldnames:
        return []

    def pick(*candidates: str) -> str | None:
        for name in fieldnames:
            lowered = name.strip().lower()
            if lowered in candidates or any(candidate in lowered for candidate in candidates):
                return name
        return None

    lat_key = pick("cell_ll_lat", "lat")
    lon_key = pick("cell_ll_lon", "lon")
    hours_key = pick("hours", "fishing_hours", "effort")
    date_key = pick("date", "time range", "time_range", "day")
    gear_key = pick("gear type", "geartype", "gear")
    flag_key = pick("flag")
    vessel_key = pick("vessel id", "vessel_id", "mmsi")
    rows: list[dict[str, float | str]] = []
    for row in reader:
        try:
            record: dict[str, float | str] = {
                "lat": round(float(str(row[lat_key]).strip()), 4) if lat_key else None,
                "lon": round(float(str(row[lon_key]).strip()), 4) if lon_key else None,
                "hours": round(float(str(row[hours_key]).strip()), 4) if hours_key else None,
            }
        except (TypeError, ValueError):
            continue
        record["date"] = str(row.get(date_key, "")).strip()[:10] if date_key else ""
        record["gear"] = str(row.get(gear_key, "")).strip() if gear_key else ""
        record["flag"] = str(row.get(flag_key, "")).strip() if flag_key else ""
        record["vessel_id"] = str(row.get(vessel_key, "")).strip() if vessel_key else ""
        record["dataset"] = dataset
        rows.append(record)
    return rows


def group_by_date(rows: list[dict[str, float | str]]) -> dict[str, list[dict[str, float | str]]]:
    grouped: dict[str, list[dict[str, float | str]]] = {}
    for row in rows:
        iso = str(row.get("date") or "")[:10]
        if iso:
            grouped.setdefault(iso, []).append(row)
    return grouped


def aggregate_cells(rows: list[dict[str, float | str]]) -> list[dict[str, object]]:
    """按 (lon, lat) 汇总。GFW 的 CSV 是「每船·每格·每天」明细（实测 1 天 19488 行），
    直接落盘会比格点数大两个数量级；这里每格保留：总捕捞小时数、参与船舶数、前 3 类作业方式（按小时）。"""
    buckets: dict[tuple[float, float], dict[str, object]] = {}
    vessels: dict[tuple[float, float], set[str]] = {}
    for row in rows:
        lon, lat, hours = row.get("lon"), row.get("lat"), row.get("hours")
        if lon is None or lat is None or hours is None:
            continue
        key = (float(lon), float(lat))
        bucket = buckets.setdefault(key, {"hours": 0.0, "gears": {}})
        bucket["hours"] = float(bucket["hours"]) + float(hours)
        gears: dict[str, float] = bucket["gears"]  # type: ignore[assignment]
        gear = str(row.get("gear") or "").strip().lower() or "未知"
        gears[gear] = gears.get(gear, 0.0) + float(hours)
        vessel = str(row.get("vessel_id") or "").strip()
        if vessel:
            vessels.setdefault(key, set()).add(vessel)

    cells: list[dict[str, object]] = []
    for (lon, lat), bucket in buckets.items():
        gears: dict[str, float] = bucket["gears"]  # type: ignore[assignment]
        top = sorted(gears.items(), key=lambda item: -item[1])[:3]
        cells.append(
            {
                "lon": round(lon, 4),
                "lat": round(lat, 4),
                "hours": round(float(bucket["hours"]), 4),
                "vessel_count": len(vessels.get((lon, lat), ())),
                "top_gears": [name for name, _ in top],
            }
        )
    cells.sort(key=lambda cell: (-float(cell["hours"]), float(cell["lat"]), float(cell["lon"])))
    return cells


def build_manifest(
    *,
    existing: dict[str, object] | None,
    summaries: list[dict[str, object]],
    skipped: list[str],
    dataset: str,
    resolution: str,
    temporal: str,
    group_by: str | None,
    bbox: tuple[float, float, float, float],
) -> dict[str, object]:
    return {
        "dataset": DATASETS[dataset],
        "spatial_resolution": resolution,
        "spatial_resolution_deg": RESOLUTION_DEG.get(resolution, 0.1),
        "temporal_resolution": temporal,
        "group_by": group_by,
        "bbox": list(bbox),
        "days": merge_manifest_days(existing, summaries),
        "skipped_days": sorted(
            set(skipped) | set(existing.get("skipped_days") or [] if isinstance(existing, dict) else [])
        ),
        "generated_at": date.today().isoformat(),
    }


def write_manifest(out_dir: Path, manifest: dict[str, object]) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def read_existing_manifest(out_dir: Path) -> dict[str, object] | None:
    path = out_dir / "manifest.json"
    if not path.is_file():
        return None
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return loaded if isinstance(loaded, dict) else None


def summarize_day_file(path: Path) -> dict[str, object] | None:
    """从已落盘的单日文件重新算出汇总（用于 --rebuild-manifest）。"""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or not payload.get("date"):
        return None
    return {
        "date": str(payload["date"]),
        "cell_count": int(payload.get("cell_count") or len(payload.get("cells") or [])),
        "total_hours": float(payload.get("total_hours") or 0.0),
        "vessel_count": int(payload.get("vessel_count") or 0),
        "file": path.name,
    }
    # 说明：这里刻意不重算 hours 总和——文件里的 total_hours 就是写盘时算好的值，
    # 重算只会引入四舍五入差异，反而让"接口值 ≠ 文件值"。


def rebuild_summaries(out_dir: Path) -> list[dict[str, object]]:
    """扫目录重建逐日汇总（天数多了以后，manifest 与文件可能不同步）。"""
    summaries: list[dict[str, object]] = []
    if not out_dir.is_dir():
        return summaries
    for path in sorted(out_dir.glob("effort-*.json")):
        summary = summarize_day_file(path)
        if summary is not None:
            summaries.append(summary)
    summaries.sort(key=lambda item: str(item["date"]))
    return summaries


def merge_manifest_days(existing: dict[str, object] | None, summaries: list[dict[str, object]]) -> list[dict[str, object]]:
    """把新汇总合并进旧 manifest：同一天以新值为准，其余日期保留。

    这样"分批补历史日期"不会把上次抓的日期从索引里抹掉（实测踩过：先抓 2024，
    再抓 2017，manifest 只剩最后一次的日期，接口里老日期汇总全变 0）。
    """
    merged: dict[str, dict[str, object]] = {}
    old_days = existing.get("days") if isinstance(existing, dict) else None
    for item in old_days if isinstance(old_days, list) else []:
        if isinstance(item, dict) and item.get("date"):
            merged[str(item["date"])] = item
    for item in summaries:
        merged[str(item["date"])] = item
    return [merged[key] for key in sorted(merged)]


def write_day(
    *,
    out_dir: Path,
    iso: str,
    rows: list[dict[str, float | str]],
    dataset: str,
    resolution: str,
    bbox: tuple[float, float, float, float],
) -> dict[str, object]:
    cells = aggregate_cells(rows)
    total = round(sum(float(cell["hours"]) for cell in cells), 3)
    vessel_ids = {str(row.get("vessel_id")).strip() for row in rows if str(row.get("vessel_id") or "").strip()}
    flags = sorted({str(row.get("flag")).strip() for row in rows if str(row.get("flag") or "").strip()})
    resolution_deg = RESOLUTION_DEG.get(resolution, 0.1)
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "date": iso,
        "source": {
            "name": "Global Fishing Watch · AIS apparent fishing effort",
            "api": "4Wings report v3",
            "dataset": DATASETS[dataset],
            "citation": "Kroodsma et al. 2018, Science, doi:10.1126/science.aao5646",
            "license": "CC BY-SA 4.0（API 条款：仅限非商业用途）",
            "retrieved_at": date.today().isoformat(),
        },
        "spatial_resolution": resolution,
        "spatial_resolution_deg": resolution_deg,
        "bbox": list(bbox),
        "cell_count": len(cells),
        "total_hours": total,
        "vessel_count": len(vessel_ids),
        "flag_count": len(flags),
        "cells": cells,
    }
    target = out_dir / f"effort-{iso.replace('-', '')}.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    return {
        "date": iso,
        "cell_count": len(cells),
        "total_hours": total,
        "vessel_count": len(vessel_ids),
        "file": target.name,
    }

def main() -> int:
    parser = argparse.ArgumentParser(description="抓取 GFW AIS 表观捕捞努力量（渔场数据）到 data/raw/fishing/")
    parser.add_argument("--start", type=parse_date, help="起始日期（含）")
    parser.add_argument("--end", type=parse_date, help="结束日期（不含）")
    parser.add_argument("--dates", type=parse_date, nargs="*", help="只取这些日期（与 --start/--end 二选一）")
    parser.add_argument("--from-front-data", action="store_true", help="按 data/raw/front 实际覆盖日期取（自动合并连续区间）")
    parser.add_argument("--front-dir", type=Path, default=DEFAULT_FRONT_DIR, help="锋面数据目录（配合 --from-front-data）")
    parser.add_argument("--bbox", type=parse_bbox, default=DEFAULT_BBOX, help="minLon,minLat,maxLon,maxLat")
    parser.add_argument("--dataset", choices=sorted(DATASETS), default="effort", help="effort=捕捞努力量；presence=船舶存在时长")
    parser.add_argument("--resolution", choices=("LOW", "HIGH"), default="LOW", help="LOW=0.1°；HIGH=0.01°")
    parser.add_argument("--temporal", choices=("HOURLY", "DAILY", "MONTHLY", "YEARLY"), default="DAILY")
    parser.add_argument(
        "--group-by",
        choices=("VESSEL_ID", "FLAG", "GEARTYPE", "FLAGANDGEARTYPE", "MMSI"),
        default=None,
        help="让服务端先分组（推荐 GEARTYPE：不分组时返回每船明细，多天区间会 read timeout）",
    )
    parser.add_argument(
        "--split-days",
        action="store_true",
        help="把区间拆成单日请求（最稳，实测单日约 18s；配合大窗口时建议开启）",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="单日文件已存在则跳过（配合 --split-days 可断点续跑，GFW 接口偶发超时很有用）",
    )
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--token", default=None, help="GFW API token（默认读环境变量 GFW_TOKEN）")
    parser.add_argument("--token-file", type=Path, default=None, help="从文件首行读 token")
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true", help="只打印将发出的请求，不调用 API（无需 token）")
    parser.add_argument(
        "--rebuild-manifest",
        action="store_true",
        help="按已落盘的 effort-*.json 重建 manifest.json（不联网、不需要 token）",
    )
    args = parser.parse_args()

    manifest_path = args.out_dir / "manifest.json"
    existing: dict[str, object] | None = read_existing_manifest(args.out_dir)
    if args.rebuild_manifest:
        summaries = rebuild_summaries(args.out_dir)
        manifest = build_manifest(
            existing=existing, summaries=summaries, skipped=[],
            dataset=args.dataset, resolution=args.resolution, temporal=args.temporal,
            group_by=args.group_by, bbox=args.bbox,
        )
        path = write_manifest(args.out_dir, manifest)
        total_hours = round(sum(float(item.get("total_hours") or 0.0) for item in manifest["days"]), 3)
        print(f"重建索引完成：{len(manifest['days'])} 天 · 合计 {total_hours} 小时 · {path}")
        return 0

    # ---- 组装日期区间 ----
    if args.from_front_data:
        front_dates = dates_from_front_data(args.front_dir)
        if not front_dates:
            print(f"没有在 {args.front_dir} 找到锋面文件，无法推断日期", file=sys.stderr)
            return 2
        skipped = [item for item in front_dates if item < EARLIEST_DATE]
        if skipped:
            print(
                f"注意：GFW 数据自 {EARLIEST_DATE} 起才有，锋面数据里 {len(skipped)} 天"
                f"（最早 {skipped[0]}）会被跳过",
                file=sys.stderr,
            )
        ranges = to_ranges([item for item in front_dates if item >= EARLIEST_DATE])
    elif args.dates:
        ranges = to_ranges(args.dates)
    elif args.start and args.end:
        if args.end <= args.start:
            parser.error("--end 必须晚于 --start（GFW 的 end 是不含的）")
        ranges = [(args.start, args.end)]
    else:
        parser.error("请给出 --start/--end、--dates 或 --from-front-data 之一")

    ranges = split_long_ranges(ranges)
    if args.split_days:
        ranges = explode_to_days(ranges)
    if not ranges:
        print("没有落在 GFW 覆盖范围内的日期（2017-01-01 起）", file=sys.stderr)
        return 2

    # ---- token ----
    token = clean_token(args.token or os.environ.get("GFW_TOKEN", ""))
    if not token and args.token_file and args.token_file.is_file():
        raw = args.token_file.read_text(encoding="utf-8").strip()
        token = clean_token(raw.split("=", 1)[1] if raw.startswith("GFW_TOKEN=") else raw)
    if not token and not args.dry_run:
        print(
            "缺少 GFW API token：请到 https://globalfishingwatch.org/our-apis/tokens 申请"
            "（免费，限非商业用途），然后设置环境变量 GFW_TOKEN，或用 --token-file 指定文件；\n"
            "也可以先加 --dry-run 只查看将要发出的请求。",
            file=sys.stderr,
        )
        return 2

    print(f"数据集 {DATASETS[args.dataset]} · 分辨率 {args.resolution} · 粒度 {args.temporal}")
    print(f"窗口 bbox={args.bbox} · 需要 {len(ranges)} 次请求")

    summaries: list[dict[str, object]] = []
    skipped: list[str] = []
    for index, (start, end) in enumerate(ranges, start=1):
        if args.skip_existing and (end - start).days == 1:
            day_file = args.out_dir / f"effort-{start.strftime('%Y%m%d')}.json"
            if day_file.is_file():
                skipped.append(start.isoformat())
                print(f"[{index}/{len(ranges)}] {start} 已存在，跳过")
                continue
        url, params, body = build_request(
            bbox=args.bbox, start=start, end=end, dataset=args.dataset,
            resolution=args.resolution, temporal=args.temporal, group_by=args.group_by,
        )
        print(f"[{index}/{len(ranges)}] {start} ~ {end}")
        if args.dry_run:
            print(f"  POST {url}")
            print(f"  params={json.dumps(params, ensure_ascii=False)}")
            print(f"  body={json.dumps(body, ensure_ascii=False)[:200]}")
            continue
        rows = fetch_range(
            bbox=args.bbox, start=start, end=end, dataset=args.dataset,
            resolution=args.resolution, temporal=args.temporal,
            token=token, timeout=args.timeout, retries=args.retries, group_by=args.group_by,
        )
        grouped = group_by_date(rows)
        if not grouped:
            print("  该区间没有返回任何格点（可能这几天海域内无 AIS 捕捞活动）")
        for iso in sorted(grouped):
            summary = write_day(
                out_dir=args.out_dir, iso=iso, rows=grouped[iso],
                dataset=args.dataset, resolution=args.resolution, bbox=args.bbox,
            )
            summaries.append(summary)
            # 每落盘一天就刷新索引：中途被杀 / 分批补历史时，索引不会落后于文件
            write_manifest(
                args.out_dir,
                build_manifest(
                    existing=existing, summaries=summaries, skipped=skipped,
                    dataset=args.dataset, resolution=args.resolution, temporal=args.temporal,
                    group_by=args.group_by, bbox=args.bbox,
                ),
            )
            print(
                f"  {iso}: {summary['cell_count']} 个格点 · {summary['total_hours']} 小时 · "
                f"{summary['vessel_count']} 艘船"
            )

    if args.dry_run:
        print("\n--dry-run 结束：未调用 API、未写文件。")
        return 0

    manifest = build_manifest(
        existing=existing, summaries=summaries, skipped=skipped,
        dataset=args.dataset, resolution=args.resolution, temporal=args.temporal,
        group_by=args.group_by, bbox=args.bbox,
    )
    write_manifest(args.out_dir, manifest)
    merged_days = manifest["days"]
    total_hours = round(sum(float(item.get("total_hours") or 0.0) for item in merged_days), 3)
    print(
        f"\n完成：本次写盘 {len(summaries)} 天 · 索引共 {len(merged_days)} 天 · "
        f"合计 {total_hours} 小时 · 输出目录 {args.out_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())



