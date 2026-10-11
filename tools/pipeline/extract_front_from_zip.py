"""从本地整包 front_location.zip 解压所需日期的锋面 .nc（配合 download-front-zip.ps1 使用）。

为什么走"整包 + 本地解压"：range 逐日取（remotezip）在服务器上必失败、本地也开始掉连接；
整包用 curl `-C -` 续传一次拿到 1982–2024 全部逐日文件，之后解压是纯本地操作，稳稳的。

用法：
  python tools/pipeline/extract_front_from_zip.py --zip F:\\ocean-cache\\front_location.zip
  python tools/pipeline/extract_front_from_zip.py --zip ... --years 2022 2021 --dry-run
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else REPO / "data" / "raw"
FRONT_ROOT = RAW_ROOT / "front"
MEMBER_PREFIX = "front_location/front_location"
DEFAULT_LOG = Path(r"C:\temp\front-extract.log")


def log_line(path: Path, message: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {message}"
    print(line, flush=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def target_year(name: str) -> int | None:
    """front_location/front_locationYYYYMMDD.nc → 年份。"""
    base = name.rsplit("/", 1)[-1]
    if not base.startswith("front_location") or not base.endswith(".nc"):
        return None
    stamp = base[len("front_location"):-3]
    if len(stamp) != 8 or not stamp.isdigit():
        return None
    return int(stamp[:4])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, required=True, dest="zip_path")
    parser.add_argument("--years", type=int, nargs="*", default=None, help="只解这些年份（默认全部 ≤2022）")
    parser.add_argument("--min-free-gb", type=float, default=25.0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    if not args.zip_path.is_file():
        log_line(args.log, f"找不到 {args.zip_path}")
        return 2

    free = shutil.disk_usage(FRONT_ROOT if FRONT_ROOT.exists() else REPO).free / (1024 ** 3)
    if free < args.min_free_gb:
        log_line(args.log, f"磁盘可用 {free:.1f} GB 低于 {args.min_free_gb} GB，退出")
        return 1

    wanted_years = set(args.years) if args.years else None
    log_line(args.log, f"打开 {args.zip_path}（{args.zip_path.stat().st_size / 2**30:.2f} GB）")
    written = skipped = 0
    with zipfile.ZipFile(args.zip_path) as archive:
        members = [item for item in archive.infolist() if item.filename.startswith(MEMBER_PREFIX)]
        log_line(args.log, f"归档内锋面文件 {len(members)} 个")
        for item in members:
            year = target_year(item.filename)
            if year is None:
                continue
            if wanted_years is not None and year not in wanted_years:
                continue
            if wanted_years is None and year > 2022:
                continue
            destination = FRONT_ROOT / str(year) / item.filename.rsplit("/", 1)[-1]
            if destination.is_file() and destination.stat().st_size == item.file_size:
                skipped += 1
                continue
            if args.dry_run:
                written += 1
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(item) as source:
                destination.write_bytes(source.read())
            written += 1
            if written % 200 == 0:
                log_line(args.log, f"已解压 {written} 个（跳过 {skipped}）")

    log_line(args.log, f"结束：新解压 {written} 个 · 已存在跳过 {skipped} 个 → {FRONT_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
