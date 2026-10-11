"""本地排队抓 Zenodo 锋面 + 增量同步到服务器（一个进程把整条队列跑完）。

为什么在本地抓：服务器直连 Zenodo 读 `front_location.zip`（18.3 GB）的中央目录会反复
`IncompleteRead`，`remotezip` 开不了归档；本地（走代理）实测正常。见 deploy/RUNBOOK.md。

为什么分批：一次把几千个日期当命令行参数会让外部命令直接启动失败（实测 exit 为空、无输出）；
分批还天然可续跑——`fetch_zenodo_front_samples.py` 会跳过已存在的 .nc，sync 只传服务器缺的。

队列顺序（默认，可用 --years 覆盖）：
  ① 2022 → 2002：SST 产品（noaacwBLendedCsstDaily）从 2002 起，这些年份能与海温配对，优先抓
  ② 2001 → 1982：只有锋面、没有对应海温，放最后
每批抓完立刻同步一次，所以服务器上的覆盖是一段一段长出来的。

用法：
  python tools/pipeline/fetch_front_local.py                     # 全量排队（默认 4 路并发）
  python tools/pipeline/fetch_front_local.py --years 2022 2021   # 只跑指定年份
  python tools/pipeline/fetch_front_local.py --no-sync           # 只抓不传
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PYTHON = REPO / "backend" / ".venv" / "Scripts" / "python.exe"
if not PYTHON.is_file():  # 非 Windows 或没建 venv 时退回当前解释器
    PYTHON = Path(sys.executable)
FETCHER = REPO / "backend" / "scripts" / "fetch_zenodo_front_samples.py"
SYNC_PS1 = Path(__file__).resolve().parent / "sync-front-to-server.ps1"
OUT_ROOT = REPO / "data" / "raw" / "front"
DEFAULT_LOG = Path(r"C:\temp\front-pipeline.log")

# 优先抓能与海温配对的年份（2002 起），1982–2001 只有锋面、放最后
PRIORITY_GROUPS: tuple[tuple[int, int], ...] = ((2022, 2002), (2001, 1982))


def years_from_groups() -> list[int]:
    years: list[int] = []
    for high, low in PRIORITY_GROUPS:
        years.extend(range(high, low - 1, -1))
    return years


def dates_of(year: int) -> list[str]:
    days: list[str] = []
    cursor = date(year, 1, 1)
    while cursor.year == year:
        days.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return days


class Log:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def __call__(self, message: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {message}"
        print(line, flush=True)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")


def free_gb(path: Path) -> float:
    return shutil.disk_usage(path).free / (1024 ** 3)


def server_free_gb(server: str, key_path: str) -> float | None:
    """服务器 /srv 可用空间（GB）。查不到就返回 None，由调用方决定继续还是保守停下。"""
    try:
        result = subprocess.run(
            ["ssh", "-n", "-i", key_path, "-o", "StrictHostKeyChecking=accept-new", server,
             "df -k /srv | tail -1 | awk '{print $4}'"],
            capture_output=True, text=True, timeout=60,
        )
    except (subprocess.SubprocessError, OSError):
        return None
    text = (result.stdout or "").strip().splitlines()
    if not text or not text[-1].strip().isdigit():
        return None
    return int(text[-1].strip()) / (1024 ** 2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, nargs="*", default=None, help="只跑这些年份（默认按优先级全量）")
    parser.add_argument("--workers", type=int, default=4, help="并发进程数")
    parser.add_argument("--batch-size", type=int, default=40, help="每次调用传多少个日期")
    parser.add_argument("--retries", type=int, default=6)
    parser.add_argument("--min-free-gb", type=float, default=8.0, help="本地磁盘低于此值就停")
    parser.add_argument("--limit-days", type=int, default=0, help="只抓前 N 天（冒烟测试用，0=不限）")
    parser.add_argument("--no-sync", action="store_true", help="只抓不传服务器")
    parser.add_argument("--server", default="root@116.62.54.140", help="同步目标（与 sync-front-to-server.ps1 一致）")
    parser.add_argument("--key", default=str(Path.home() / ".ssh" / "id_ed25519_ocean"))
    parser.add_argument("--server-min-free-gb", type=float, default=5.0,
                        help="服务器 /srv 可用空间低于此值就停止上传（别把服务盘塞满）")
    parser.add_argument("--passes", type=int, default=2,
                        help="整条年份队列跑几遍：第二遍专门补失败/断流的日期（已存在的会跳过，几乎零成本）")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    log = Log(args.log)
    base_years = args.years or years_from_groups()
    # 每年排 passes 遍：第二遍紧跟在同一年后面，把该年失败/断流的日期补齐（已存在的会跳过，几乎零成本）
    passes = max(1, args.passes)
    years = [year for year in base_years for _ in range(passes)]
    log(f"队列：{len(base_years)} 年 × {passes} 轮 · {base_years[0]} → {base_years[-1]} · 并发 {args.workers}"
        f" · 每批 {args.batch_size} 天 · 同步={'关闭' if args.no_sync else '开启'}")

    # 上传（scp 到服务器）比下载慢得多，所以同步放后台、不阻塞下载：
    # 上一次同步还在跑就跳过这次，它落地时会把期间新下的文件一起带上。
    sync_process: subprocess.Popen | None = None
    sync_handles: list = []

    def sync_command(*, rebuild_index: bool) -> list[str]:
        command = ["powershell", "-ExecutionPolicy", "Bypass", "-NoProfile", "-File", str(SYNC_PS1)]
        if not rebuild_index:
            command.append("-SkipIndexRebuild")
        return command

    def kick_sync(*, rebuild_index: bool) -> None:
        nonlocal sync_process

        if args.no_sync:
            return
        if sync_process is not None:
            code = sync_process.poll()
            if code is None:
                log("   sync: 上一轮同步还在跑，跳过本次（不阻塞下载）")
                return
            log(f"   sync: 上一轮同步结束 exit={code}")
        sync_log = args.log.with_name("front-sync.log")
        sync_log.parent.mkdir(parents=True, exist_ok=True)
        handle = sync_log.open("a", encoding="utf-8")
        sync_handles.append(handle)
        handle.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} 开始同步 =====\n")
        handle.flush()
        sync_process = subprocess.Popen(
            sync_command(rebuild_index=rebuild_index),
            stdout=handle, stderr=subprocess.STDOUT, cwd=str(REPO),
        )
        log(f"   sync: 已启动后台同步，日志 {sync_log}")

    for year in years:
        if free_gb(REPO) < args.min_free_gb:
            log(f"本地磁盘可用不足 {args.min_free_gb} GB，停止队列（已下的文件都在，重启本脚本会续跑）")
            return 1
        if not args.no_sync:
            remote_free = server_free_gb(args.server, args.key)
            if remote_free is not None and remote_free < args.server_min_free_gb:
                log(f"服务器 /srv 可用 {remote_free:.1f} GB 低于 {args.server_min_free_gb} GB，停止上传以免影响服务")
                return 1

        days = dates_of(year)
        if args.limit_days:
            days = days[: args.limit_days]
        chunks = [days[i:i + args.batch_size] for i in range(0, len(days), args.batch_size)]
        log(f"== {year}：{len(days)} 天 / {len(chunks)} 批 ==")

        def run_chunk(item: tuple[int, list[str]]) -> tuple[int, int, int, float]:
            index, chunk = item
            started = time.time()
            with args.log.open("a", encoding="utf-8") as handle:
                handle.write(f"--- {year} 批 {index}: {chunk[0]} ~ {chunk[-1]}\n")
                result = subprocess.run(
                    [str(PYTHON), str(FETCHER), "--output-root", str(OUT_ROOT),
                     "--continue-on-error", "--retries", str(args.retries), *chunk],
                    stdout=handle, stderr=subprocess.STDOUT, cwd=str(REPO),
                )
            fetched = len(list(OUT_ROOT.glob(f"{year}/*.nc")))
            return index, result.returncode, fetched, time.time() - started

        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            for index, code, fetched, seconds in pool.map(run_chunk, list(enumerate(chunks, start=1))):
                log(f"   {year} 批 {index}/{len(chunks)} exit={code} 已落盘 {fetched} 天 用时 {seconds:.0f}s")
                kick_sync(rebuild_index=index == len(chunks))

    if not args.no_sync:
        if sync_process is not None and sync_process.poll() is None:
            log("   等待最后一轮后台同步结束…")
            sync_process.wait()
        log("   最后再同步一次：补齐期间新下的文件并重建索引")
        final = subprocess.run(sync_command(rebuild_index=True), capture_output=True, text=True, cwd=str(REPO))
        tail = (final.stdout or "").strip().splitlines()
        log("   sync: " + (tail[-1] if tail else f"exit={final.returncode}"))
        for handle in sync_handles:
            handle.close()

    log("队列跑完")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
