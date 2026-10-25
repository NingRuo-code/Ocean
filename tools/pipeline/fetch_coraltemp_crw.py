"""CRW CoralTemp v3.1（5km ≈ 0.05° 全球逐日 SST）直连抓取 —— 东海明细的**独立备用源**。

为什么需要它：东海 0.05° 明细过去只用 CoastWatch ERDDAP 的 `noaacwBLENDEDCsstDaily`，
2026-09-24/26 那几天该站整站 503（status 页与取数全挂），东海队列只能干等。查下来
**STAR 的 THREDDS 目录是空壳**（`Blended and Coastwatch Cogridded (Level-4)` 下 4 个数据集
没有 urlPath，取不到数据），但 **STAR 的文件服务上有 CRW CoralTemp v3.1 的逐日 .nc**
（1985–至今），是完全独立的另一条链路，且同为 0.05° GHRSST L4 产品。

URL：
  https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/sst/{YYYY}/coraltemp_v3.1_{YYYYMMDD}.nc

代价与做法：整球单日 **11.5MB**，国内链路实测单流 ~20KB/s（一天约 10 分钟），所以：
  · 只在 ERDDAP 不可用时用（ERDDAP 一天只要 0.1MB）；
  · 下载到临时文件 → 裁到目标窗口（默认东海 120,27,128,34，落盘约 120KB）→ 删掉整球文件；
  · 断点续传（STAR 返回 `Accept-Ranges: bytes`）：中断后重跑会带着 Range 从断点接着下。

输出与 ERDDAP 版**同目录同命名**（`<root>/sst/<年>/sst_<yyyymmdd>.nc`，变量 `analysed_sst`），
所以后端与前端无需任何改动。注意：这是**另一个产品**（CoralTemp v3.1 ≠ Geo-Polar Blended Night），
同屏混用时页面要标明来源；东海明细的产品标签仍按 ERDDAP 版标注，换源期间要在台账里写明。

窗口对齐：CRW 的格点在 27.025 / 34.025 / 120.025 / 128.025 上，所以想切出与 ERDDAP 版**逐格一致**的
141×161，bbox 要给 `119.9,26.9,128.1,34.1`（默认值仍是 `120,27,128,34`，切出来是 140×160：少最东与最北各一格）。

用法（服务器上，可中断续跑；跳过已存在）：
  OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw /opt/ocean/venv/bin/python \
    tools/pipeline/fetch_coraltemp_crw.py --dates 2005-01-01 2005-01-31 --workers 2
  ... --years 2005 2004            # 或按年
  ... --bbox 120,27,128,34 --stride 1 --min-free-gb 4
"""

from __future__ import annotations

import argparse
import os
import shutil
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
BASE = "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/sst"
NETCDF_MAGIC = (b"CDF\x01", b"CDF\x02", b"\x89HDF\r\n\x1a\n")
CHUNK = 1 << 16


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


def crw_url(day: str) -> str:
    compact = day.replace("-", "")
    return f"{BASE}/{compact[:4]}/coraltemp_v3.1_{compact}.nc"


def destination(root: Path, day: str) -> Path:
    return root / day[:4] / f"sst_{day.replace('-', '')}.nc"


def session() -> requests.Session:
    retry = Retry(total=4, connect=4, read=4, status=4, backoff_factor=2.0,
                  status_forcelist=(429, 500, 502, 503, 504), allowed_methods=frozenset({"GET"}))
    client = requests.Session()
    client.mount("https://", HTTPAdapter(max_retries=retry))
    client.headers.update({"User-Agent": "OceanFrontResearchPrototype/0.1"})
    return client


def download(day: str, temp: Path, timeout: tuple[float, float], attempts: int = 20) -> str:
    """整球文件下载到临时路径：**每次重试都带 Range 从断点续传**；返回错误描述（空串 = 成功）。

    为什么必须自愈：这条链路实测会下到一半断流（`ChunkedEncodingError: IncompleteRead`，
    11.5MB 只拿到 3.3MB / 0.66MB），平均每 1MB 就断一次 —— 所以「断点续传 + 运行内重试」是主路径，
    不是兜底；重试次数给到 20 次就是为了让**一次调用**能撑完 11.5MB（退避上限 30s，不会空烧）。
    """
    url = crw_url(day)
    last = "FAILED 未知"
    for attempt in range(1, attempts + 1):
        done = temp.stat().st_size if temp.exists() else 0
        try:
            headers = {"Range": f"bytes={done}-"} if done else {}
            with session() as client, client.get(url, headers=headers, stream=True, timeout=timeout) as response:
                if response.status_code == 404:
                    return "MISSING 上游没有这一天"
                if response.status_code == 416:
                    # Range 起点越界 = 本地长度已 ≥ 服务器文件长度，说明**其实已经下完**。
                    # （实测 2001-06-15 就是这么"假失败"的：本地 10,242,720B = 服务器全长，
                    #   再发 Range 请求必然 416；不认这一条会把下好的文件白白重来。）
                    with temp.open("rb") as handle:
                        if handle.read(8).startswith(NETCDF_MAGIC):   # 必须读满 8 字节：HDF5 魔数就是 8 字节
                            return ""
                    temp.unlink(missing_ok=True)              # 越界又不是 NetCDF：清掉重下
                    last = "FAILED HTTP 416（本地残留无效，已清空重来）"
                elif response.status_code not in (200, 206):
                    last = f"FAILED HTTP {response.status_code}"
                else:
                    if response.status_code == 200 and done:
                        done = 0                              # 服务器忽略 Range：只能从头写
                    total = (response.headers.get("Content-Range", "").split("/")[-1]
                             or response.headers.get("Content-Length", ""))
                    temp.parent.mkdir(parents=True, exist_ok=True)
                    with temp.open("ab" if done else "wb") as handle:
                        for block in response.iter_content(CHUNK):
                            handle.write(block)
                    size = temp.stat().st_size
                    if total.isdigit() and size == int(total):
                        with temp.open("rb") as handle:
                            if handle.read(8).startswith(NETCDF_MAGIC):
                                return ""
                        last = "FAILED 不是 NetCDF"
                    else:
                        last = f"INCOMPLETE {size}/{total or '?'}"
        except Exception as exc:                              # noqa: BLE001 —— 断流/超时都靠续传重试吃掉
            last = f"{type(exc).__name__}: {str(exc)[:60]}"
        got = temp.stat().st_size if temp.exists() else 0
        print(f"    {day} 第 {attempt}/{attempts} 次未完成（已下 {got / 1e6:.2f}MB · {last}），续传重试", flush=True)
        time.sleep(min(30.0, 3.0 * attempt))
    return last


def crop(source: Path, target: Path, bbox: tuple[float, float, float, float], stride: int) -> str:
    """裁到 bbox（可隔格），变量统一写 analysed_sst；返回错误描述（空串 = 成功）。"""
    import xarray as xr

    min_lon, min_lat, max_lon, max_lat = bbox
    with xr.open_dataset(source) as ds:
        name = "analysed_sst" if "analysed_sst" in ds else ("sst" if "sst" in ds else next(iter(ds.data_vars)))
        lat_name = "latitude" if "latitude" in ds.coords else "lat"
        lon_name = "longitude" if "longitude" in ds.coords else "lon"
        lats = ds[lat_name].values
        lat_slice = slice(min_lat, max_lat) if lats[0] <= lats[-1] else slice(max_lat, min_lat)
        window = ds[name].sel({lat_name: lat_slice, lon_name: slice(min_lon, max_lon)})
        if stride > 1:
            window = window.isel({lat_name: slice(None, None, stride), lon_name: slice(None, None, stride)})
        if window.sizes.get(lat_name, 0) == 0 or window.sizes.get(lon_name, 0) == 0:
            return "EMPTY 窗口与该文件无交集"
        out = window.to_dataset(name="analysed_sst")
        out.attrs.update({
            "title": "CRW CoralTemp v3.1 5km daily SST（备用源，由整球文件裁出）",
            "source": BASE,
            "source_file": source.name,
            "note": "与 ERDDAP 版 noaacwBLENDEDCsstDaily 不同源；换源期间页面需标注产品",
        })
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(f"{target.name}.part")
        out.to_netcdf(partial)
        partial.replace(target)
    return ""


def grab(day: str, root: Path, temp_dir: Path, bbox, stride: int, timeout, keep_global: bool) -> tuple[str, str]:
    target = destination(root, day)
    if target.exists() and target.stat().st_size > 0:
        return day, "skip"
    temp = temp_dir / f"coraltemp_v3.1_{day.replace('-', '')}.nc"
    started = time.time()
    try:
        error = download(day, temp, timeout) or crop(temp, target, bbox, stride)
        if error:
            return day, error
        return day, f"ok {target.stat().st_size / 1024:.0f}KB {time.time() - started:.0f}s"
    except Exception as exc:                                  # noqa: BLE001 —— 逐日兜住，别拖垮整片
        return day, f"FAILED {type(exc).__name__}: {str(exc)[:100]}"
    finally:
        # 只有"当天确实产出成功"才删整球临时文件；失败/中断时**留着**，下次带 Range 从断点续传
        if temp.exists() and not keep_global and target.exists() and target.stat().st_size > 0:
            temp.unlink(missing_ok=True)


def fetch(days: list[str], root: Path, *, temp_dir: Path, bbox, stride: int, timeout,
          workers: int, min_free_gb: float, keep_global: bool) -> int:
    root.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    todo = [day for day in days if not (destination(root, day).exists() and destination(root, day).stat().st_size > 0)]
    skipped = len(days) - len(todo)
    if not todo:
        print(f"完成：新增 0 · 跳过 {skipped} · 失败 0（共 {len(days)} 天）", flush=True)
        return 0
    free = shutil.disk_usage(root).free / (1024 ** 3)
    if free < min_free_gb:
        print(f"磁盘可用 {free:.1f} GB 低于 {min_free_gb} GB，暂不开始", flush=True)
        return 1

    ok = failed = 0
    total = len(todo)
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(grab, day, root, temp_dir, bbox, stride, timeout, keep_global): day for day in todo}
        for index, future in enumerate(as_completed(futures), start=1):
            day, status = future.result()
            if status == "ok" or status.startswith("ok "):
                ok += 1
            else:
                failed += 1
            print(f"[{index}/{total}] {day} {status}", flush=True)
    print(f"完成：新增 {ok} · 跳过 {skipped} · 失败 {failed}（共 {len(days)} 天）", flush=True)
    return 0 if ok or skipped else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="CRW CoralTemp v3.1 5km 逐日 SST（东海明细备用源）")
    parser.add_argument("--years", type=int, nargs="*", default=[])
    parser.add_argument("--dates", type=str, nargs="*", default=[], help="起止两天：--dates 2005-01-01 2005-01-31")
    parser.add_argument("--output-root", type=Path, default=RAW_ROOT / "sst")
    parser.add_argument("--tmp-dir", type=Path, default=Path("/tmp/coraltemp"))
    parser.add_argument("--bbox", type=str, default="120,27,128,34", help="minLon,minLat,maxLon,maxLat（默认东海窗口）")
    parser.add_argument("--stride", type=int, default=1, help="经纬度隔格（1 = 原始 0.05°）")
    parser.add_argument("--workers", type=int, default=2, help="并发线程数（整球单日 11.5MB，别开太大）")
    parser.add_argument("--connect-timeout", type=float, default=15.0)
    parser.add_argument("--read-timeout", type=float, default=900.0, help="整球单日国内实测约 10 分钟，留足余量")
    parser.add_argument("--min-free-gb", type=float, default=4.0)
    parser.add_argument("--keep-global", action="store_true", help="保留整球临时文件（默认裁完即删）")
    args = parser.parse_args()

    days: list[str] = []
    if len(args.dates) == 2:
        days = dates_between(args.dates[0], args.dates[1])
    for year in args.years:
        days.extend(dates_of(year))
    if not days:
        print("没给日期：用 --years 2005 或 --dates 起 止", flush=True)
        return 2
    days = sorted(set(days))
    bbox = tuple(float(piece) for piece in args.bbox.split(","))
    if len(bbox) != 4:
        print("bbox 要四个数：minLon,minLat,maxLon,maxLat", flush=True)
        return 2

    print(f"CRW CoralTemp v3.1：{len(days)} 天（{days[0]} ~ {days[-1]}）· 并发 {args.workers} · "
          f"窗口 {args.bbox} · 输出 {args.output_root}", flush=True)
    return fetch(days, args.output_root, temp_dir=args.tmp_dir, bbox=bbox, stride=args.stride,
                 timeout=(args.connect_timeout, args.read_timeout), workers=args.workers,
                 min_free_gb=args.min_free_gb, keep_global=args.keep_global)


if __name__ == "__main__":
    raise SystemExit(main())

