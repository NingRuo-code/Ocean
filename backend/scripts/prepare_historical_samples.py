from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fetch_zenodo_front_samples import fetch as fetch_front_samples

from app.config import PROJECT_ROOT, settings
from app.data_index import build_sqlite_data_index
from app.data_preparation import (
    COPERNICUS_SST_DATASET_ID,
    build_data_preparation_plan,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from error


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prepare cross-year same-period samples for historical probability demos."
    )
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--processed-dir", type=Path, default=PROJECT_ROOT / "data" / "processed")
    parser.add_argument("--reference-date", type=parse_date, default=date(2024, 8, 5))
    parser.add_argument("--year-start", type=int, default=1982)
    parser.add_argument("--year-end", type=int, default=2024)
    parser.add_argument("--window-days", type=int, default=3)
    parser.add_argument("--longitude", type=float, default=124.5)
    parser.add_argument("--latitude", type=float, default=30.2)
    parser.add_argument("--radius-deg", type=float, default=1.0)
    parser.add_argument("--front-batch-size", type=int, default=14)
    parser.add_argument("--sst-max-days-per-request", type=int, default=14)
    parser.add_argument("--limit-dates", type=int, help="limit planned missing dates for a small trial run")
    parser.add_argument("--execute-front", action="store_true", help="download missing front files from Zenodo")
    parser.add_argument("--execute-sst", action="store_true", help="run copernicusmarine subset for missing SST")
    parser.add_argument("--rebuild-index", action="store_true", help="rebuild SQLite data index after execution")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--copernicusmarine-bin", default="copernicusmarine")
    args = parser.parse_args()

    plan = build_data_preparation_plan(
        args.raw_data_dir,
        args.processed_dir,
        reference_date=args.reference_date,
        historical_year_start=args.year_start,
        historical_year_end=args.year_end,
        historical_window_days=args.window_days,
    )
    missing_front_dates = plan.historical_missing_front_dates
    missing_sst_dates = plan.historical_missing_sst_dates
    if args.limit_dates is not None:
        limit = max(0, args.limit_dates)
        missing_front_dates = missing_front_dates[:limit]
        missing_sst_dates = missing_sst_dates[:limit]

    west = args.longitude - args.radius_deg
    east = args.longitude + args.radius_deg
    south = args.latitude - args.radius_deg
    north = args.latitude + args.radius_deg

    print("跨年份同期样本准备")
    print(f"- 参考日期：{args.reference_date.isoformat()}")
    print(f"- 年份范围：{min(args.year_start, args.year_end)}—{max(args.year_start, args.year_end)}")
    print(f"- 每年窗口：{args.window_days} 天")
    print(f"- 已配对样本：{plan.historical_paired_date_count}/{plan.historical_target_date_count}")
    print(f"- 本次计划补 front：{len(missing_front_dates)} 个日期")
    print(f"- 本次计划补 SST：{len(missing_sst_dates)} 个日期")
    print(f"- SST 空间范围：lon {west:.4f} 至 {east:.4f}，lat {south:.4f} 至 {north:.4f}")

    front_batches = list(_batches(missing_front_dates, max(1, args.front_batch_size)))
    sst_runs = _consecutive_runs(missing_sst_dates, max(1, args.sst_max_days_per_request))

    if not args.execute_front and not args.execute_sst:
        print("当前为 dry-run 计划模式；加入 --execute-front / --execute-sst 后才会下载。")
    _print_front_plan(front_batches)
    _print_sst_plan(args, sst_runs, west, east, south, north)

    if args.execute_front:
        _execute_front_batches(args, front_batches)
    if args.execute_sst:
        result = _execute_sst_runs(args, sst_runs, west, east, south, north)
        if result != 0:
            return result

    if args.rebuild_index:
        index = build_sqlite_data_index(args.raw_data_dir, args.processed_dir)
        print(f"已重建 SQLite 索引：{index.index_path}")
        print(f"- 配对日期：{index.paired_date_count}")
        print(f"- 缺 SST：{len(index.missing_sst_dates)}")
        print(f"- 缺 front：{len(index.missing_front_dates)}")

    return 0


def _batches(values: list[date], size: int) -> list[list[date]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def _consecutive_runs(values: list[date], max_days: int) -> list[list[date]]:
    if not values:
        return []
    sorted_dates = sorted(values)
    runs: list[list[date]] = [[sorted_dates[0]]]
    for value in sorted_dates[1:]:
        current = runs[-1]
        if value == current[-1] + timedelta(days=1) and value.year == current[-1].year and len(current) < max_days:
            current.append(value)
        else:
            runs.append([value])
    return runs


def _print_front_plan(front_batches: list[list[date]]) -> None:
    print("front 批次：")
    if not front_batches:
        print("- 无需补充 front。")
        return
    for batch in front_batches[:5]:
        dates = " ".join(value.isoformat() for value in batch)
        print(f"- python backend/scripts/fetch_zenodo_front_samples.py {dates} --continue-on-error")
    if len(front_batches) > 5:
        print(f"- 其余 {len(front_batches) - 5} 个 front 批次省略，可通过 --limit-dates 控制试跑规模。")


def _print_sst_plan(
    args: argparse.Namespace,
    sst_runs: list[list[date]],
    west: float,
    east: float,
    south: float,
    north: float,
) -> None:
    print("SST 批次：")
    if not sst_runs:
        print("- 无需补充 SST。")
        return
    for run in sst_runs[:5]:
        print(f"- {_format_command(_sst_command(args, run, west, east, south, north))}")
    if len(sst_runs) > 5:
        print(f"- 其余 {len(sst_runs) - 5} 个 SST 批次省略，可通过 --limit-dates 控制试跑规模。")


def _execute_front_batches(args: argparse.Namespace, front_batches: list[list[date]]) -> None:
    for batch_index, batch in enumerate(front_batches, start=1):
        print(f"执行 front 批次 {batch_index}/{len(front_batches)}：{batch[0]} 至 {batch[-1]}")
        fetch_front_samples(
            batch,
            args.raw_data_dir / "front",
            continue_on_error=args.continue_on_error,
        )


def _execute_sst_runs(
    args: argparse.Namespace,
    sst_runs: list[list[date]],
    west: float,
    east: float,
    south: float,
    north: float,
) -> int:
    executable = shutil.which(args.copernicusmarine_bin)
    if executable is None:
        print(
            f"未找到 {args.copernicusmarine_bin}，请先安装或传入 --copernicusmarine-bin。",
            file=sys.stderr,
        )
        return 2

    for run_index, run in enumerate(sst_runs, start=1):
        command = _sst_command(args, run, west, east, south, north)
        command[0] = executable
        print(f"执行 SST 批次 {run_index}/{len(sst_runs)}：{run[0]} 至 {run[-1]}")
        try:
            subprocess.run(command, check=True)
        except subprocess.CalledProcessError:
            if not args.continue_on_error:
                return 1
            print(f"SST 批次失败但继续：{run[0]} 至 {run[-1]}", file=sys.stderr)
    return 0


def _sst_command(
    args: argparse.Namespace,
    run: list[date],
    west: float,
    east: float,
    south: float,
    north: float,
) -> list[str]:
    first = run[0]
    last = run[-1]
    output_directory = args.raw_data_dir / "sst" / str(first.year)
    return [
        args.copernicusmarine_bin,
        "subset",
        "--dataset-id",
        COPERNICUS_SST_DATASET_ID,
        "--variable",
        "analysed_sst",
        "--start-datetime",
        f"{first.isoformat()}T00:00:00",
        "--end-datetime",
        f"{last.isoformat()}T00:00:00",
        "--minimum-longitude",
        f"{west:.6f}",
        "--maximum-longitude",
        f"{east:.6f}",
        "--minimum-latitude",
        f"{south:.6f}",
        "--maximum-latitude",
        f"{north:.6f}",
        "--output-directory",
        str(output_directory),
        "--output-filename",
        f"sst_{first:%Y%m%d}_{last:%Y%m%d}.nc",
        "--coordinates-selection-method",
        "outside",
        "--log-level",
        "INFO",
    ]


def _format_command(command: list[str]) -> str:
    return " ".join(_quote(value) for value in command)


def _quote(value: str) -> str:
    if not value or any(character.isspace() for character in value):
        return f"'{value}'"
    return value


if __name__ == "__main__":
    raise SystemExit(main())
