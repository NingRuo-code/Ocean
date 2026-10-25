"""定向补漏：算出 1982–2022 里本地缺哪几天，只抓这些日期，然后同步到服务器。

为什么不用"把整条队列再跑一遍"：那样每年每批都要重新打开 18.3 GB 归档的中央目录
（实测每次 15–30 秒），只为抓几天缺口，代价太高。这里先本地算差集，再只请求缺的日期。

用法：
  python tools/pipeline/front_gap_fill.py --dry-run          # 只看缺哪些天
  python tools/pipeline/front_gap_fill.py                    # 补齐并同步
  python tools/pipeline/front_gap_fill.py --years 2020 2021  # 只看/只补指定年份
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PYTHON = REPO / "backend" / ".venv" / "Scripts" / "python.exe"
if not PYTHON.is_file():
    PYTHON = Path(sys.executable)
FETCHER = REPO / "backend" / "scripts" / "fetch_zenodo_front_samples.py"
SYNC_PS1 = Path(__file__).resolve().parent / "sync-front-to-server.ps1"
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else REPO / "data" / "raw"
FRONT_ROOT = RAW_ROOT / "front"
DEFAULT_LOG = Path(r"C:\temp\front-gap-fill.log")
DEFAULT_YEARS = list(range(1982, 2023))          # 归档覆盖 1982–2024，2023/2024 已完整
EXPECTED_FIRST_DAY = date(1982, 1, 1)


def log_line(path: Path, message: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {message}"
    print(line, flush=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def expected_dates(year: int) -> list[str]:
    days: list[str] = []
    cursor = max(date(year, 1, 1), EXPECTED_FIRST_DAY)
    while cursor.year == year:
        days.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return days


def missing_dates(year: int) -> list[str]:
    directory = FRONT_ROOT / str(year)
    return [day for day in expected_dates(year)
            if not (directory / f"front_location{day.replace('-', '')}.nc").is_file()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, nargs="*", default=DEFAULT_YEARS)
    parser.add_argument("--batch-size", type=int, default=30)
    parser.add_argument("--retries", type=int, default=6)
    parser.add_argument("--min-free-gb", type=float, default=8.0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-sync", action="store_true")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    gaps: dict[int, list[str]] = {year: missing_dates(year) for year in args.years}
    total = sum(len(days) for days in gaps.values())
    for year, days in gaps.items():
        if days:
            log_line(args.log, f"{year}: 缺 {len(days)} 天（{days[0]} ~ {days[-1]}）")
    log_line(args.log, f"合计缺 {total} 天" + ("（--dry-run，未下载）" if args.dry_run else ""))
    if args.dry_run or total == 0:
        return 0

    if shutil.disk_usage(FRONT_ROOT if FRONT_ROOT.exists() else REPO).free / (1024 ** 3) < args.min_free_gb:
        log_line(args.log, f"本地磁盘不足 {args.min_free_gb} GB，退出")
        return 1

    for year, days in gaps.items():
        if not days:
            continue
        for start in range(0, len(days), args.batch_size):
            chunk = days[start:start + args.batch_size]
            with args.log.open("a", encoding="utf-8") as handle:
                handle.write(f"--- {year} 补漏 {chunk[0]} ~ {chunk[-1]}（{len(chunk)} 天）\n")
                result = subprocess.run(
                    [str(PYTHON), str(FETCHER), "--output-root", str(FRONT_ROOT),
                     "--continue-on-error", "--retries", str(args.retries), *chunk],
                    stdout=handle, stderr=subprocess.STDOUT, cwd=str(REPO),
                )
            log_line(args.log, f"   {year} 补漏批 exit={result.returncode}（{len(chunk)} 天）")

    if not args.no_sync:
        sync = subprocess.run(
            ["powershell", "-ExecutionPolicy", "Bypass", "-NoProfile", "-File", str(SYNC_PS1)],
            capture_output=True, text=True, cwd=str(REPO),
        )
        tail = (sync.stdout or "").strip().splitlines()
        log_line(args.log, "sync: " + (tail[-1] if tail else f"exit={sync.returncode}"))

    left = sum(len(missing_dates(year)) for year in args.years)
    log_line(args.log, f"补漏结束：仍缺 {left} 天")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
