"""服务器端排队抓 SST（默认 2022 → 2002 逐年），每年内部按并发数并行，可中断续跑。

为什么只到 2002：NOAA CoastWatch 的 `noaacwBLendedCsstDaily` 从 2002 年起，
1982–2001 只有锋面、没有对应海温，所以不排进这个队列。

为什么并发：单进程实测约 24 s/天（ERDDAP 每次请求都要建连 + 服务端裁剪子集），
4 路并发实测约 2.6 s/天，731 天 0 失败跑完。脚本会跳过已存在的 .nc，重启即续跑。

用法（服务器上，数据目录由环境变量指定）：
  OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw /opt/ocean/venv/bin/python tools/pipeline/sst_pipeline.py
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
PYTHON = Path("/opt/ocean/venv/bin/python")
if not PYTHON.is_file():
    PYTHON = Path(sys.executable)
FETCHER = REPO / "backend" / "scripts" / "fetch_sst_samples.py"
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else REPO / "data" / "raw"
SST_ROOT = RAW_ROOT / "sst"
DEFAULT_LOG = Path("/var/log/ocean-sst-pipeline.log")
if not DEFAULT_LOG.parent.is_dir():  # 本地试跑时退回仓内
    DEFAULT_LOG = REPO / "data" / "cache" / "sst-pipeline.log"

DEFAULT_YEARS = list(range(2022, 2001, -1))   # 2022 .. 2002


def dates_of(year: int) -> list[str]:
    days: list[str] = []
    cursor = date(year, 1, 1)
    while cursor.year == year:
        days.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return days


def log_line(path: Path, message: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {message}"
    print(line, flush=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def rebuild_index(log_path: Path) -> None:
    """每年跑完重建一次后端数据索引：新日期要能被 /api/analysis、/api/point 查到。

    不在每批之后重建——文件多起来以后每次重建都要重扫目录，按年做足够，也不打扰服务。
    """
    import urllib.error
    import urllib.request

    try:
        request = urllib.request.Request("http://127.0.0.1:8000/api/data/index/rebuild", method="POST")
        with urllib.request.urlopen(request, timeout=300) as response:
            log_line(log_path, f"   索引重建 HTTP {response.status}")
    except (urllib.error.URLError, OSError) as error:
        log_line(log_path, f"   索引重建失败（服务没起？）：{error}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, nargs="*", default=DEFAULT_YEARS)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--retries", type=int, default=8, help="每个日期的重试次数（ERDDAP 在并发压力下会瞬时返回 404，实测重试即成功）")
    parser.add_argument("--retry-wait", type=float, default=5.0, help="重试基础间隔（秒，按次数递增）")
    parser.add_argument("--min-free-gb", type=float, default=6.0)
    parser.add_argument("--passes", type=int, default=2, help="整轮跑几遍：第二遍专门补失败日（跳过已存在的几乎零成本）")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    log_line(args.log, f"SST 队列：{len(args.years)} 年 {args.years[0]} → {args.years[-1]} · 并发 {args.workers} · 共 {args.passes} 轮")
    # 年份列表按 passes 重复：每年紧跟一轮复查，把该年失败/限流的日期当场补掉，而不是等整条队列跑完
    schedule = [year for year in args.years for _ in range(max(1, args.passes))]
    for _single in range(1):
        for year in schedule:
            free = shutil.disk_usage(SST_ROOT if SST_ROOT.exists() else RAW_ROOT).free / (1024 ** 3)
            if free < args.min_free_gb:
                log_line(args.log, f"磁盘可用 {free:.1f} GB 低于 {args.min_free_gb} GB，停止队列")
                return 1

            days = dates_of(year)
            per_worker = [days[i::args.workers] for i in range(args.workers)]
            log_line(args.log, f"== {year}：{len(days)} 天 / {args.workers} 路 ==")
            handles = [open(f"/tmp/sst-{year}-w{i}.log", "ab", buffering=0) for i in range(args.workers)]
            processes = [
                subprocess.Popen(
                    [str(PYTHON), str(FETCHER), "--output-root", str(SST_ROOT), "--continue-on-error",
                     "--retries", str(args.retries), "--retry-wait", str(args.retry_wait), *subset],
                    stdout=handle, stderr=subprocess.STDOUT,
                )
                for subset, handle in zip(per_worker, handles)
            ]
            for index, process in enumerate(processes):
                log_line(args.log, f"   {year} worker {index} exit={process.wait()}")
            for handle in handles:
                handle.close()
            done = len(list(SST_ROOT.glob(f"{year}/*.nc")))
            log_line(args.log, f"   {year} 结束：已落盘 {done} 天")
            rebuild_index(args.log)

    log_line(args.log, "队列跑完")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
