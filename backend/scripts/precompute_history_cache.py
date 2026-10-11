from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.history import compute_history_response, get_history_index

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def _parse_dates(values: list[str], days: int) -> list[date]:
    if not values:
        values = ["2024-08-05"]
    parsed = [date.fromisoformat(value) for value in values]
    if days <= 1:
        return parsed
    expanded: list[date] = []
    for item in parsed:
        expanded.extend(item + timedelta(days=offset) for offset in range(days))
    return sorted(set(expanded))


def main() -> int:
    parser = argparse.ArgumentParser(description="Precompute local history query cache for demo/reporting.")
    parser.add_argument("--date", action="append", default=[], help="查询日期，可重复传入；默认 2024-08-05")
    parser.add_argument("--days", type=int, default=1, help="从每个 --date 起向后预热的连续天数")
    parser.add_argument("--longitude", type=float, default=124.5)
    parser.add_argument("--latitude", type=float, default=30.2)
    parser.add_argument("--radius", type=float, default=1.0, help="查询半径，单位为经纬度度数")
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--cache-dir", type=Path, default=settings.cache_dir)
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "data" / "processed" / "history_cache_precompute_report.json",
    )
    args = parser.parse_args()

    query_dates = _parse_dates(args.date, max(1, min(31, args.days)))
    index = get_history_index(args.raw_data_dir, args.cache_dir)
    results: list[dict[str, object]] = []
    for observation_date in query_dates:
        response = compute_history_response(
            observation_date=observation_date,
            longitude=args.longitude,
            latitude=args.latitude,
            radius_deg=args.radius,
            raw_data_dir=args.raw_data_dir,
            cache_dir=args.cache_dir,
        )
        results.append(
            {
                "date": observation_date.isoformat(),
                "cache_hit": response.cache.hit,
                "cache_key": response.cache.key,
                "cache_path": response.cache.path,
                "duration_ms": response.cache.duration_ms,
                "metadata_source": response.cache.metadata_source,
                "records_evaluated": response.cache.records_evaluated,
                "timeline_record_count": response.cache.timeline_record_count,
                "same_period_sample_count": response.summary.same_period_sample_count,
                "same_period_probability": response.summary.same_period_probability,
                "sample_reliability_label": response.summary.sample_reliability_label,
            }
        )

    payload = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "raw_data_dir": str(args.raw_data_dir),
        "cache_dir": str(args.cache_dir),
        "index_fingerprint": index.fingerprint,
        "query": {
            "longitude": args.longitude,
            "latitude": args.latitude,
            "radius_deg": args.radius,
            "date_count": len(query_dates),
        },
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    warmed = sum(1 for item in results if not item["cache_hit"])
    already_hit = len(results) - warmed
    print("历史统计缓存预热完成")
    print(f"- 查询日期：{len(results)} 个")
    print(f"- 新生成缓存：{warmed} 个")
    print(f"- 已命中缓存：{already_hit} 个")
    print(f"- 索引来源：{results[0]['metadata_source'] if results else 'unknown'}")
    print(f"- 报告路径：{args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
