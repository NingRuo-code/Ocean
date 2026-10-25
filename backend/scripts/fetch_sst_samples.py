"""Fetch daily SST subsets for the prototype window from NOAA CoastWatch ERDDAP.

Product: noaacwBLENDEDCsstDaily
  Sea-Surface Temperature, NOAA Geo-polar Blended Analysis Night Only, GHRSST,
  Near Real-Time, Global 5km, 2002-present, Daily (degree C)
  Variables: analysed_sst (degree_C), analysis_error, mask (sea/land/ice bit mask)
  License: GHRSST protocol describes data use as free and open.

Why this product: no account/registration needed (unlike Copernicus C3S), 0.05 deg
grid (same as the front dataset window), and a small per-day subset for
120-128E / 27-34N. NOTE: it is NOT the same SST product the front dataset was
derived from (ESA CCI / C3S), so the prototype must label the source explicitly.

Usage:
  python scripts/fetch_sst_samples.py 2024-08-05 2024-08-06
  python scripts/fetch_sst_samples.py --bbox 120,27,128,34 2024-07-01 2024-07-02
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# 与后端同一套约定：服务器上用 OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw，本地退回仓内 data/raw
_REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else _REPO_ROOT / "data" / "raw"

DEFAULT_BASE_URL = "https://coastwatch.noaa.gov/erddap"
DEFAULT_DATASET = "noaacwBLENDEDCsstDaily"
DEFAULT_BBOX = (120.0, 27.0, 128.0, 34.0)  # 与锋面导出窗口一致
DEFAULT_VARIABLES = ("analysed_sst", "mask")
NETCDF_MAGIC = (b"CDF\x01", b"CDF\x02", b"\x89HDF\r\n\x1a\n")


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from error


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    parts = [float(piece) for piece in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be minLon,minLat,maxLon,maxLat")
    return (parts[0], parts[1], parts[2], parts[3])


def subset_url(base_url: str, dataset: str, day: date, bbox, variables, stride: tuple[int, int] = (1, 1)) -> str:
    """构造 ERDDAP griddap 的 NetCDF 子集 URL。

    stride = (lon步长, lat步长)（单位 = 原始格点，0.05°）：
    全球粗格概览用 stride=(20,20) → 1°（360×180），单日约 0.3MB；
    (10,10) → 0.5°（720×360），约 1.3MB。默认 (1,1) = 原始分辨率。
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    lon_step, lat_step = stride
    stamp = day.isoformat()
    selectors = []
    for name in variables:
        selectors.append(
            f"{name}[({stamp}T00:00:00Z):1:({stamp}T23:59:59Z)]"
            f"[({min_lat}):{lat_step}:({max_lat})][({min_lon}):{lon_step}:({max_lon})]"
        )
    query = quote(",".join(selectors), safe="[],():TZ-.,")
    return f"{base_url.rstrip('/')}/griddap/{dataset}.nc?{query}"


def retrying_session() -> requests.Session:
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers.update({"User-Agent": "OceanFrontResearchPrototype/0.1"})
    return session


def fetch_sst(
    dates: list[date],
    output_root: Path,
    *,
    base_url: str,
    dataset: str,
    bbox: tuple[float, float, float, float],
    variables: tuple[str, ...],
    force: bool = False,
    continue_on_error: bool = False,
    timeout: tuple[float, float] = (10, 120),
    retries: int = 4,
    retry_wait: float = 3.0,
    sleep_between: float = 0.5,
    stride: tuple[int, int] = (1, 1),
) -> list[str]:
    session = retrying_session()
    failures: list[str] = []
    total = len(dates)
    for index, day in enumerate(dates, start=1):
        destination = output_root / str(day.year) / f"sst_{day:%Y%m%d}.nc"
        if destination.exists() and not force and destination.stat().st_size > 0:
            print(
                f"[{index}/{total}] skipped {day}: {destination} exists "
                f"({destination.stat().st_size} bytes)",
                flush=True,
            )
            continue
        url = subset_url(base_url, dataset, day, bbox, variables, stride)
        for attempt in range(1, retries + 1):
            try:
                destination.parent.mkdir(parents=True, exist_ok=True)
                print(f"[{index}/{total}] downloading {day} -> {destination}", flush=True)
                response = session.get(url, timeout=timeout)
                if response.status_code != 200:
                    raise RuntimeError(f"HTTP {response.status_code}: {response.text[:200]}")
                payload = response.content
                if not payload.startswith(NETCDF_MAGIC):
                    raise RuntimeError(
                        "response is not NetCDF: " + payload[:160].decode("utf-8", "replace")
                    )
                # .part 名字带 PID：万一同一目录被两个进程同时抓同一天（例如旧进程成了孤儿），
                # 也不会互相覆盖对方写到一半的临时文件
                partial = destination.with_name(f"{destination.name}.{os.getpid()}.part")
                partial.write_bytes(payload)
                partial.replace(destination)
                print(
                    f"[{index}/{total}] downloaded {day}: {destination} ({len(payload)} bytes)",
                    flush=True,
                )
                if sleep_between:
                    time.sleep(sleep_between)
                break
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                if attempt < retries:
                    print(
                        f"[{index}/{total}] retry {attempt}/{retries - 1} {day} after {last_error}",
                        flush=True,
                    )
                    time.sleep(retry_wait * attempt)
                    continue
                if not continue_on_error:
                    session.close()
                    raise
                failures.append(f"{day}: {last_error}")
                print(f"failed {day}: {last_error}", flush=True)
    session.close()
    if failures:
        print("completed with failures:", flush=True)
        for failure in failures:
            print(f"- {failure}", flush=True)
    return failures



def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch daily SST subsets (degree_C) via NOAA CoastWatch ERDDAP."
    )
    parser.add_argument("dates", nargs="+", type=parse_date, help="one or more dates (YYYY-MM-DD)")
    parser.add_argument(
        "--output-root",
        type=Path,
        default=RAW_ROOT / "sst",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--bbox", type=parse_bbox, default=DEFAULT_BBOX)
    parser.add_argument("--variables", default=",".join(DEFAULT_VARIABLES))
    parser.add_argument(
        "--stride",
        type=int,
        default=1,
        help="经纬度步长（原始格点，0.05°）：20 → 1° 全球概览（≈0.3MB/天）、10 → 0.5°；1 = 原始分辨率",
    )
    parser.add_argument("--force", action="store_true", help="overwrite files that already exist")
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="keep going when one date fails",
    )
    parser.add_argument("--connect-timeout", type=float, default=10.0)
    parser.add_argument("--read-timeout", type=float, default=120.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--retry-wait", type=float, default=3.0)
    parser.add_argument("--sleep", type=float, default=0.5, help="pause between dates (be polite)")
    args = parser.parse_args()

    variables = tuple(piece.strip() for piece in args.variables.split(",") if piece.strip())
    print(f"dataset: {args.dataset} @ {args.base_url}", flush=True)
    print(f"window: lon {args.bbox[0]}~{args.bbox[2]}, lat {args.bbox[1]}~{args.bbox[3]}", flush=True)
    print(f"variables: {', '.join(variables)}", flush=True)
    if args.stride > 1:
        print(f"stride: {args.stride}（分辨率 ≈ {0.05 * args.stride:.2f}°）", flush=True)
    failures = fetch_sst(
        args.dates,
        args.output_root,
        base_url=args.base_url,
        dataset=args.dataset,
        bbox=args.bbox,
        variables=variables,
        force=args.force,
        continue_on_error=args.continue_on_error,
        timeout=(args.connect_timeout, args.read_timeout),
        retries=args.retries,
        retry_wait=args.retry_wait,
        sleep_between=args.sleep,
        stride=(args.stride, args.stride),
    )
    if failures and not args.continue_on_error:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
