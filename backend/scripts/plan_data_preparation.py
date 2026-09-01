from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.data_preparation import build_data_preparation_plan

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from error


def main() -> int:
    parser = argparse.ArgumentParser(description="Plan next offline data preparation steps.")
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--processed-dir", type=Path, default=PROJECT_ROOT / "data" / "processed")
    parser.add_argument("--reference-date", type=parse_date)
    parser.add_argument("--target-days", type=int, default=14)
    parser.add_argument("--historical-year-start", type=int, default=1982)
    parser.add_argument("--historical-year-end", type=int, default=2024)
    parser.add_argument("--historical-window-days", type=int, default=3)
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    args = parser.parse_args()

    plan = build_data_preparation_plan(
        args.raw_data_dir,
        args.processed_dir,
        reference_date=args.reference_date,
        target_days=args.target_days,
        historical_year_start=args.historical_year_start,
        historical_year_end=args.historical_year_end,
        historical_window_days=args.historical_window_days,
    )
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(plan.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"已写出 JSON 数据准备计划：{args.output}")
    print("离线数据准备计划")
    print(f"- 原始数据目录：{plan.raw_data_dir}")
    print(f"- manifest：{plan.manifest_path}")
    print(f"- front 文件：{plan.front_file_count} 个")
    print(f"- SST 文件：{plan.sst_file_count} 个")
    print(f"- 配对日期：{plan.paired_date_count} 个")
    print(f"- 缺 front：{len(plan.missing_front_dates)} 个")
    print(f"- 缺 SST：{len(plan.missing_sst_dates)} 个")
    print(
        "- 跨年同期目标："
        f"{plan.historical_paired_date_count}/{plan.historical_target_date_count} 个已配对"
    )
    print(f"- 跨年同期缺 front：{len(plan.historical_missing_front_dates)} 个")
    print(f"- 跨年同期缺 SST：{len(plan.historical_missing_sst_dates)} 个")
    print(f"- 重复 front 组：{len(plan.duplicate_front_groups)} 组")
    print(f"- 重复 SST 组：{len(plan.duplicate_sst_groups)} 组")
    print("推荐步骤：")
    for index, step in enumerate(plan.recommended_steps, start=1):
        print(f"{index}. {step}")
    print("参考命令：")
    for command in plan.download_commands:
        print(f"- {command}")
    if plan.historical_download_commands:
        print("跨年样本参考命令：")
        for command in plan.historical_download_commands[:3]:
            print(f"- {command}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
