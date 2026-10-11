from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.reporting import compute_report_response

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def _safe_stem(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z_.-]+", "-", value).strip("-")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export a static demo report for teacher review.")
    parser.add_argument("--date", default="2024-08-05")
    parser.add_argument("--longitude", type=float, default=124.5)
    parser.add_argument("--latitude", type=float, default=30.2)
    parser.add_argument("--radius", type=float, default=1.0)
    parser.add_argument("--days", type=int, default=3)
    parser.add_argument("--raw-data-dir", type=Path, default=settings.raw_data_dir)
    parser.add_argument("--cache-dir", type=Path, default=settings.cache_dir)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "data" / "processed" / "reports",
    )
    args = parser.parse_args()

    observation_date = date.fromisoformat(args.date)
    response = compute_report_response(
        observation_date=observation_date,
        longitude=args.longitude,
        latitude=args.latitude,
        radius_deg=args.radius,
        days=args.days,
        raw_data_dir=args.raw_data_dir,
        cache_dir=args.cache_dir,
    )

    stem = _safe_stem(f"ocean-front-report-{args.date}-{args.longitude:.3f}-{args.latitude:.3f}-r{args.radius:g}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    html_path = args.output_dir / f"{stem}.html"
    markdown_path = args.output_dir / f"{stem}.md"
    summary_path = args.output_dir / f"{stem}.summary.json"

    html_path.write_text(response.html, encoding="utf-8")
    markdown_path.write_text(response.markdown, encoding="utf-8")
    summary_path.write_text(
        json.dumps(
            {
                "title": response.title,
                "generated_at": response.generated_at,
                "query": response.query,
                "highlight_count": len(response.highlights),
                "source_file_count": len(response.source_files),
                "html_path": str(html_path),
                "markdown_path": str(markdown_path),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("演示报告导出完成")
    print(f"- HTML：{html_path}")
    print(f"- Markdown：{markdown_path}")
    print(f"- 摘要 JSON：{summary_path}")
    print(f"- 关键结论：{len(response.highlights)} 条")
    print(f"- 源文件：{len(response.source_files)} 个")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
