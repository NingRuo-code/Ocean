from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.data_index import build_sqlite_data_index, summarize_sqlite_data_index

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build or inspect the local SQLite data index.")
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--processed-dir", type=Path, default=PROJECT_ROOT / "data" / "processed")
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="read the current SQLite index without rebuilding it",
    )
    args = parser.parse_args()

    if args.summary_only:
        index = summarize_sqlite_data_index(args.raw_data_dir, args.processed_dir)
    else:
        index = build_sqlite_data_index(args.raw_data_dir, args.processed_dir)

    print("离线 SQLite 数据索引")
    print(f"- 索引路径：{index.index_path}")
    print(f"- schema：{index.schema_version}")
    print(f"- 文件总数：{index.total_file_count} 个")
    print(f"- 日期总数：{index.indexed_date_count} 个")
    print(f"- 配对日期：{index.paired_date_count} 个")
    print(f"- 缺 SST 日期：{len(index.missing_sst_dates)} 个")
    print(f"- 缺 front 日期：{len(index.missing_front_dates)} 个")
    print(f"- SQLite 文件大小：{index.sqlite_size_bytes} bytes")
    print("数据集：")
    for dataset in index.datasets:
        print(
            f"- {dataset.dataset_type}: "
            f"{dataset.file_count} 文件 / {dataset.date_count} 日期 / "
            f"{dataset.available_date_start or '--'} 至 {dataset.available_date_end or '--'}"
        )
        if dataset.duplicate_date_count:
            print(f"  重复日期：{dataset.duplicate_date_count} 个")
    if index.integrity_warnings:
        print("完整性提示：")
        for warning in index.integrity_warnings:
            print(f"- {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
