"""NCEI 直连抓「OISST v2.1 全球 0.25° 逐日 SST」——绕开出故障的 NOAA CoastWatch ERDDAP。

为什么单独写一个：2026-09-24/25 期间 CoastWatch ERDDAP（含 pifsc/aoml 镜像）对
`noaacwBLENDED*` 这类数据集体表现为「索引里有、取数 404/500、status 超时」，
属于上游服务侧故障，等不来也修不了；而 NCEI 的**直连文件**是另一条链路，实测可达。

数据：NOAA Optimum Interpolation SST (OISST) v2.1，0.25°×0.25° 全球、逐日、1981-09 至今。
URL 形如（注意是**年月目录**，不是年目录）：
  https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/{YYYYMM}/oisst-avhrr-v02r01.{YYYYMMDD}.nc
变量：`sst`（度 C；另有 anom/err/ice，都不需要）。单日实测约 1.5MB、~65s（国内链路）。

落盘位置与命名**沿用后端已认识的布局**：`<root>/0p25deg/<年>/sst_<yyyymmdd>.nc`
（后端 `frontend_payload._coarse_roots()` 会自动把它当"最细可用档"之一，与 1deg/0p2deg 并存）。

用法（服务器上，可中断续跑；跳过已存在）：
  OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw /opt/ocean/venv/bin/python \
    tools/pipeline/fetch_oisst_ncei.py --years 2024 2023 --workers 3
  ... --dates 2024-07-01 2024-08-31     # 只跑一段
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else REPO / "data" / "raw"
BASE = "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr"
NETCDF_MAGIC = (b"CDF\x01", b"CDF\x02", b"\x89HDF\r\n\x1a\n")


def dates_of(year: int) -> list[str]:
    out: list[str] = []
    cursor = date(year, 1, 1)
    while cursor.year == year:
        out.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return out


def dates_between(start: str, end: str) -> list[str]:
    out: list[str] = []
    cursor = date.fromisoformat(start)
    last = date.fromisoformat(end)
    while cursor <= last:
        out.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return out


def oisst_url(day: str) -> str:
    compact = day.replace("-", "")
    return f"{BASE}/{compact[:6]}/oisst-avhrr-v02r01.{compact}.nc"


def session() -> requests.Session:
    retry = Retry(total=4, connect=4, read=4, status=4, backoff_factor=1.5,
                  status_forcelist=(429, 500, 502, 503, 504), allowed_methods=frozenset({"GET"}))
    s = requests.Session()
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({"User-Agent": "OceanFrontResearchPrototype/0.1"})
    return s


def is_done(root: Path, day: str) -> bool:
    path = root / day[:4] / f"sst_{day.replace('-', '')}.nc"
    return path.exists() and path.stat().st_size > 0


def grab(day: str, root: Path, timeout: tuple[float, float]) -> tuple[str, str]:
    """下一个日期：返回 (day, "ok"/"skip"/错误描述)。"""
    destination = root / day[:4] / f"sst_{day.replace('-', '')}.nc"
    if destination.exists() and destination.stat().st_size > 0:
        return day, "skip"
    try:
        t0 = time.time()
        with session() as http:                       # 每个请求自建会话（线程安全）
            response = http.get(oisst_url(day), timeout=timeout)
        if response.status_code != 200:
            raise RuntimeError(f"HTTP {response.status_code}")
        payload = response.content
        if not payload.startswith(NETCDF_MAGIC):
            raise RuntimeError("响应不是 NetCDF（可能拿到错误页）")
        destination.parent.mkdir(parents=True, exist_ok=True)
        partial = destination.with_name(f"{destination.name}.{os.getpid()}.part")
        partial.write_bytes(payload)
        partial.replace(destination)
        return day, f"ok {len(payload) / 1e6:.2f}MB {time.time() - t0:.0f}s"
    except Exception as exc:                          # noqa: BLE001 —— 逐日兜住，别拖垮整片
        return day, f"FAILED {type(exc).__name__}: {str(exc)[:100]}"


def fetch(days: list[str], root: Path, *, timeout: tuple[float, float], sleep_between: float, workers: int) -> int:
    root.mkdir(parents=True, exist_ok=True)
    todo = [day for day in days if not is_done(root, day)]
    skipped = len(days) - len(todo)
    if not todo:
        print(f"完成：新增 0 · 跳过 {skipped} · 失败 0（共 {len(days)} 天）", flush=True)
        return 0
    ok = failed = 0
    total = len(todo)
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(grab, day, root, timeout): day for day in todo}
        for index, future in enumerate(as_completed(futures), start=1):
            day, status = future.result()
            if status == "ok" or status.startswith("ok "):
                ok += 1
            else:
                failed += 1
            print(f"[{index}/{total}] {day} {status}", flush=True)
            if sleep_between:
                time.sleep(sleep_between)
    print(f"完成：新增 {ok} · 跳过 {skipped} · 失败 {failed}（共 {len(days)} 天）", flush=True)
    return 0 if ok or skipped else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="NCEI OISST v2.1 0.25° 全球逐日 SST 直连下载")
    parser.add_argument("--years", type=int, nargs="*", default=[])
    parser.add_argument("--dates", type=str, nargs="*", default=[], help="起止两天：--dates 2024-07-01 2024-08-31")
    parser.add_argument("--output-root", type=Path, default=RAW_ROOT / "sst_global" / "0p25deg")
    parser.add_argument("--workers", type=int, default=3, help="并发下载线程数（国内链路单流 ~65s/天，实测 3 路有加速）")
    parser.add_argument("--connect-timeout", type=float, default=15.0)
    parser.add_argument("--read-timeout", type=float, default=600.0, help="单日文件国内链路实测 ~65s，留足余量")
    parser.add_argument("--sleep", type=float, default=0.2)
    args = parser.parse_args()

    days: list[str] = []
    if len(args.dates) == 2:
        days = dates_between(args.dates[0], args.dates[1])
    for year in args.years:
        days.extend(dates_of(year))
    if not days:
        print("没给日期：用 --years 2024 2023 或 --dates 起 止", flush=True)
        return 2
    days = sorted(set(days))
    print(f"OISST v2.1 0.25°：{len(days)} 天（{days[0]} ~ {days[-1]}）· 并发 {args.workers} → {args.output_root}", flush=True)
    return fetch(days, args.output_root,
                 timeout=(args.connect_timeout, args.read_timeout), sleep_between=args.sleep,
                 workers=args.workers)


if __name__ == "__main__":
    raise SystemExit(main())
