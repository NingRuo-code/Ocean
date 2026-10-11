from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.data_preparation import build_data_preparation_plan

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Dry-run or move duplicated front/SST data files into a backup folder."
    )
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--processed-dir", type=Path, default=PROJECT_ROOT / "data" / "processed")
    parser.add_argument("--backup-dir-name", default="_duplicates_backup")
    parser.add_argument("--apply", action="store_true", help="move duplicate files; default is dry-run")
    args = parser.parse_args()

    raw_data_dir = args.raw_data_dir.resolve()
    backup_root = (raw_data_dir / args.backup_dir_name).resolve()
    plan = build_data_preparation_plan(raw_data_dir, args.processed_dir)
    groups = [*plan.duplicate_front_groups, *plan.duplicate_sst_groups]
    if not groups:
        print("未发现重复 front/SST 文件。")
        return 0

    print("重复数据文件处理计划")
    print(f"- 原始数据目录：{raw_data_dir}")
    print(f"- 备份目录：{backup_root}")
    print(f"- 模式：{'apply' if args.apply else 'dry-run'}")

    moved_count = 0
    for group_index, group in enumerate(groups, start=1):
        canonical_path = Path(group.canonical_path) if group.canonical_path else None
        print(f"组 {group_index}: {', '.join(item.isoformat() for item in group.observation_dates)}")
        print(f"  保留：{canonical_path or '--'}")
        for relative_path_text in group.paths:
            relative_path = Path(relative_path_text)
            if canonical_path is not None and relative_path == canonical_path:
                continue
            source = (raw_data_dir / relative_path).resolve()
            destination = (backup_root / relative_path).resolve()
            print(f"  移动：{relative_path} -> {destination.relative_to(raw_data_dir)}")
            if args.apply:
                _move_file(source, destination, raw_data_dir)
                moved_count += 1

    if args.apply:
        print(f"已移动 {moved_count} 个重复文件。请重新运行 build_data_manifest.py。")
    else:
        print("dry-run 完成；如确认无误，可追加 --apply 执行移动。")
    return 0


def _move_file(source: Path, destination: Path, raw_data_dir: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(source)
    if not source.is_relative_to(raw_data_dir):
        raise ValueError(f"source is outside raw data directory: {source}")
    if not destination.is_relative_to(raw_data_dir):
        raise ValueError(f"destination is outside raw data directory: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise FileExistsError(destination)
    shutil.move(str(source), str(destination))


if __name__ == "__main__":
    raise SystemExit(main())
