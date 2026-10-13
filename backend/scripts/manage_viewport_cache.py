from __future__ import annotations

import argparse
import json
import sys
from datetime import date as DateType
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path = [path for path in sys.path if path != str(BACKEND_ROOT)]
sys.path.insert(0, str(BACKEND_ROOT))

from app.cache_maintenance import (
    collect_viewport_cache_status,
    prune_viewport_cache,
    rebuild_viewport_cache,
    viewport_cache_status_payload,
    warm_viewport_cache,
)
from app.config import settings
from app.frontend_payload import WindowError, parse_bbox
from app.schemas import ViewportRequest


def _request_from_args(args: argparse.Namespace) -> ViewportRequest:
    try:
        bbox = parse_bbox(args.bbox)
    except WindowError as error:
        raise SystemExit(str(error)) from error
    if bbox is None:
        raise SystemExit("--bbox is required for warm/rebuild")
    return ViewportRequest(
        date=DateType.fromisoformat(args.date),
        bbox=[float(value) for value in bbox],
        step=args.step,
    )


def _status_payload(cache_dir: Path) -> dict[str, object]:
    return {
        "schema_version": "viewport-cache-maintenance/v1",
        "action": "status",
        **viewport_cache_status_payload(collect_viewport_cache_status(cache_dir)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Warm, rebuild, or prune Ocean viewport JSON caches.")
    parser.add_argument("action", choices=["status", "warm", "rebuild", "prune"])
    parser.add_argument("--cache-dir", type=Path, default=settings.cache_dir)
    parser.add_argument("--prototype-data-dir", type=Path, default=settings.prototype_data_dir)
    parser.add_argument("--date", default="2024-08-05")
    parser.add_argument("--bbox", default="122,27,124.2,29.6")
    parser.add_argument("--step", type=int, default=4)
    parser.add_argument("--max-files-per-version", type=int, default=None)
    parser.add_argument("--keep-old-versions", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.action == "status":
        payload = _status_payload(args.cache_dir)
    elif args.action == "prune":
        payload = prune_viewport_cache(
            args.cache_dir,
            delete_old_versions=not args.keep_old_versions,
            max_files_per_version=args.max_files_per_version,
            dry_run=args.dry_run,
        )
    else:
        if args.action == "rebuild":
            payload = rebuild_viewport_cache(
                [_request_from_args(args)],
                cache_dir=args.cache_dir,
                prototype_data_dir=args.prototype_data_dir,
                dry_run=args.dry_run,
            )
        else:
            payload = warm_viewport_cache(
                [_request_from_args(args)],
                cache_dir=args.cache_dir,
                prototype_data_dir=args.prototype_data_dir,
            )

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
