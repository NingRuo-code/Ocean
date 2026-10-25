"""服务器端排队抓「全球粗格海温」（默认 1°，stride=20），落在 raw/sst_global/。

为什么要它：raw/sst/ 里那批是当初按东海窗口（120–128E / 27–34N）裁着下的，
所以海温层以前只在东海有。全球 0.05° 单日 ~26MB（15,706 天 ≈ 400GB，不可能），
但 **粗格** 足够做"别处也有海温"：stride=20 → 1°（360×180），单日约 0.3MB，
2002–2024 全量约 2.5GB —— 在 12GB 余量内，可以慢慢补。

与东海明细的关系：后端 `/api/frontend/day` 会**同时**给 `sst`（东海 0.05°，若有）
和 `sst_coarse`（本脚本产物，1°）；前端粗格垫底、东海明细压在上面，二者并存。

用法（服务器上，后台常驻；单日 ERDDAP 现裁 1~3 分钟，务必 nohup）：
  cd /opt/ocean && OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw \
  setsid nohup /opt/ocean/venv/bin/python tools/pipeline/sst_global_pipeline.py \
    --stride 20 --years 2024 > /var/log/ocean-sst-global.log 2>&1 &

只跑指定日期（先小批量验证）：
  ... sst_global_pipeline.py --stride 20 --dates 2024-07-01 2024-08-31
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
SST_ROOT = RAW_ROOT / "sst_global"
DEFAULT_LOG = Path("/var/log/ocean-sst-global.log")
if not DEFAULT_LOG.parent.is_dir():
    DEFAULT_LOG = REPO / "data" / "cache" / "sst-global.log"


def res_label(stride: int) -> str:
    """按 stride 给分辨率一个稳定目录名：20 → 1deg、4 → 0p25、2 → 0p1、1 → 0p05。"""
    res = 0.05 * stride
    text = f"{res:.2f}".rstrip("0").rstrip(".")
    return text.replace(".", "p") + "deg"


def dates_between(start: str, end: str) -> list[str]:
    cursor = date.fromisoformat(start)
    last = date.fromisoformat(end)
    out: list[str] = []
    while cursor <= last:
        out.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return out


def dates_of(year: int) -> list[str]:
    return dates_between(f"{year}-01-01", f"{year}-12-31")


def log_line(path: Path, message: str) -> None:
    line = f"[{time.strftime('%m-%d %H:%M:%S')}] {message}"
    print(line, flush=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stride", type=int, default=20, help="原始格点步长：20 → 1°（默认）、10 → 0.5°")
    parser.add_argument("--years", type=int, nargs="*", default=[])
    parser.add_argument("--dates", type=str, nargs="*", default=[], help="起止两天：--dates 2024-07-01 2024-08-31")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--retries", type=int, default=6)
    parser.add_argument("--min-free-gb", type=float, default=4.0)
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    days: list[str] = []
    if len(args.dates) == 2:
        days = dates_between(args.dates[0], args.dates[1])
    for year in args.years:
        days.extend(dates_of(year))
    if not days:
        log_line(args.log, "没给日期：用 --years 2024 或 --dates 起 止")
        return 2
    days = sorted(set(days))

    res = round(0.05 * args.stride, 2)
    label = res_label(args.stride)
    out_root = SST_ROOT / label                     # 按分辨率分目录：1deg / 0p25 …（同名日期不互相顶掉）
    log_line(args.log, f"全球海温：{len(days)} 天（{days[0]} ~ {days[-1]}）· {res}° · 输出 {out_root} · 并发 {args.workers}")
    free = shutil.disk_usage(RAW_ROOT).free / (1024 ** 3)
    if free < args.min_free_gb:
        log_line(args.log, f"磁盘可用 {free:.1f} GB 低于 {args.min_free_gb} GB，停止")
        return 1

    per_worker = [days[i::args.workers] for i in range(args.workers)]
    per_worker = [chunk for chunk in per_worker if chunk]
    handles = [open(f"/tmp/sst-global-w{i}.log", "ab", buffering=0) for i in range(len(per_worker))]
    processes = [
        subprocess.Popen(
            [str(PYTHON), str(FETCHER), "--output-root", str(out_root), "--continue-on-error",
             "--bbox=-180,-90,180,90", "--stride", str(args.stride),
             # 粗格层只需要 analysed_sst：mask 不参与出数（后端按有限值 + −5~45°C 过滤），少要一半字节
             "--variables", "analysed_sst",
             "--retries", str(args.retries), *chunk],
            stdout=handle, stderr=subprocess.STDOUT,
        )
        for chunk, handle in zip(per_worker, handles)
    ]
    for index, process in enumerate(processes):
        log_line(args.log, f"   worker {index} 启动（{len(per_worker[index])} 天）")
    for index, process in enumerate(processes):
        log_line(args.log, f"   worker {index} exit={process.wait()}")
    for handle in handles:
        handle.close()
    done = len(list(out_root.glob("*/*.nc")))
    log_line(args.log, f"结束：{out_root} 已落盘 {done} 天")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
