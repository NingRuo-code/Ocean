"""服务器端排队抓 GFW 渔场（捕捞努力量），默认 2024/2023 全年 → 2022…2017 逐年。

顺序说明：2023/2024 已经与锋面、海温的完整年对齐，价值最高，排最前；
再往前的年份按最新到最旧补齐（GFW 4Wings 自 2017-01-01 起才有数据）。

并发：单日一次请求（不分组返回的是「每船·每格·每天」明细，实测单日 19488 行），
接口偶发 429 / 读超时，脚本自带退避重试；并发 3–4 路配合 `--skip-existing` 可稳定续跑。

用法（服务器上，token 在 /etc/ocean/gfw.env）：
  set -a; . /etc/ocean/gfw.env; set +a
  OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw /opt/ocean/venv/bin/python tools/pipeline/gfw_pipeline.py
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
FETCHER = REPO / "tools" / "pipeline" / "fetch_gfw_effort.py"
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else REPO / "data" / "raw"
FISHING_ROOT = RAW_ROOT / "fishing"
DEFAULT_LOG = Path("/var/log/ocean-gfw-pipeline.log")
if not DEFAULT_LOG.parent.is_dir():
    DEFAULT_LOG = REPO / "data" / "cache" / "gfw-pipeline.log"

DEFAULT_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017]
EARLIEST = date(2017, 1, 1)


def dates_of(year: int) -> list[str]:
    days: list[str] = []
    cursor = max(date(year, 1, 1), EARLIEST)
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
    """每年跑完重建一次后端数据索引（渔场走 manifest，但 catalog 的日期清单同样受索引影响）。"""
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
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--chunk-days", type=int, default=40, help="每个进程一次传多少天")
    parser.add_argument("--timeout", type=float, default=240.0)
    parser.add_argument("--retries", type=int, default=5)
    parser.add_argument("--min-free-gb", type=float, default=6.0)
    parser.add_argument("--passes", type=int, default=2, help="整轮跑几遍：第二遍专门补失败/限流漏掉的日期（跳过已存在的几乎零成本）")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    if not os.environ.get("GFW_TOKEN") and not Path("/etc/ocean/gfw.env").is_file():
        log_line(args.log, "找不到 GFW token（环境变量 GFW_TOKEN 或 /etc/ocean/gfw.env），退出")
        return 2

    log_line(args.log, f"渔场队列：{len(args.years)} 年 {args.years[0]} → {args.years[-1]} · 并发 {args.workers} · 共 {args.passes} 轮")
    # 年份列表按 passes 重复：每年紧跟一轮复查，把该年超时/429 漏掉的日期当场补掉
    schedule = [year for year in args.years for _ in range(max(1, args.passes))]
    for _single in range(1):
        for year in schedule:
            root = FISHING_ROOT if FISHING_ROOT.exists() else RAW_ROOT
            free = shutil.disk_usage(root).free / (1024 ** 3)
            if free < args.min_free_gb:
                log_line(args.log, f"磁盘可用 {free:.1f} GB 低于 {args.min_free_gb} GB，停止队列")
                return 1

            days = dates_of(year)
            if not days:
                continue
            chunks = [days[i:i + args.chunk_days] for i in range(0, len(days), args.chunk_days)]
            log_line(args.log, f"== {year}：{len(days)} 天 / {len(chunks)} 批（{args.workers} 路）==")
            pending = list(enumerate(chunks, start=1))
            running: list[tuple[int, subprocess.Popen]] = []
            handles = []

            def launch(item: tuple[int, list[str]], year: int = year, handles=handles, running=running) -> None:
                index, chunk = item
                handle = open(f"/tmp/gfw-{year}-{index}.log", "ab", buffering=0)
                handles.append(handle)
                running.append((index, subprocess.Popen(
                    [str(PYTHON), str(FETCHER), "--out-dir", str(FISHING_ROOT),
                     "--dates", *chunk, "--split-days", "--skip-existing",
                     "--timeout", str(args.timeout), "--retries", str(args.retries)],
                    stdout=handle, stderr=subprocess.STDOUT, cwd=str(REPO),
                )))

            while pending or running:
                while pending and len(running) < args.workers:
                    launch(pending.pop(0))
                index, process = running.pop(0)
                code = process.wait()
                log_line(args.log, f"   {year} 批 {index}/{len(chunks)} exit={code}")

            for handle in handles:
                handle.close()
            done = len(list(FISHING_ROOT.glob(f"effort-{year}*.json")))
            log_line(args.log, f"   {year} 结束：已落盘 {done} 天")
            rebuild_index(args.log)

    log_line(args.log, "队列跑完")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
