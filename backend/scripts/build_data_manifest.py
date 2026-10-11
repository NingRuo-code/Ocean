from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.data_inventory import build_data_manifest, write_data_manifest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the local offline data manifest.")
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "data" / "processed" / "data_manifest.json")
    args = parser.parse_args()

    manifest = build_data_manifest(args.raw_data_dir, args.output.parent)
    written_path = write_data_manifest(manifest, args.output)
    print(f"已生成离线数据清单：{written_path}")
    print(f"- 数据文件：{manifest.total_file_count} 个")
    print(f"- 已配对日期：{manifest.paired_date_count} 个")
    print(f"- 缺少 SST 日期：{len(manifest.missing_sst_dates)} 个")
    print(f"- 缺少 front 日期：{len(manifest.missing_front_dates)} 个")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
