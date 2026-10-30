"""Owner-local text files from an immutable completed synthetic run, never a public projection."""

import calendar

from .comparison_models import KnownMetrics, SnapshotSource
from .known_month_report import render_aggregate_table
from .published_months import PublishedDay, UNITS

EXPORT_VERSION = "owner-synthetic-run-export/v1"


def render_run_file(run, representation):
    result = run["result"]
    if (run["state"] != "completed" or result["evidence_kind"] != "synthetic_example"
            or result["research_ready"] is not False or result["units"] != UNITS
            or result["parameters"] != run["request"] or result.get("intervals") is not None):
        raise ValueError("Unsupported synthetic run")
    source = SnapshotSource.model_validate(result["source"]).model_dump()
    if not source["license"].startswith("CC0-1.0") or source["input_sha256"] != run["input_sha256"]:
        raise ValueError("Unsupported synthetic source")
    metrics = KnownMetrics.model_validate(result["metrics"]).model_dump()
    daily = [PublishedDay.model_validate(day).model_dump() for day in result["daily"]]
    year, month = map(int, run["request"]["month"].split("-"))
    count = calendar.monthrange(year, month)[1]
    if [day["date"] for day in daily] != [f"{year:04d}-{month:02d}-{day:02d}" for day in range(1, count+1)]:
        raise ValueError("Incomplete frozen calendar")
    metadata = [
        ("export_version", EXPORT_VERSION), ("export_purpose", "owner_local_download"),
        ("automatically_published", "false"), ("research_ready", "false"),
        ("run_id", run["id"]), ("intent_id", run["intent_id"]),
        ("record_id", run["record_id"]), ("submission_id", run["submission_id"]),
        ("result_id", result["result_id"]), ("submitted_at", run["submitted_at"]),
        ("finished_at", run["finished_at"]), ("state", run["state"]),
        *run["request"].items(), *[("source_" + key, value) for key, value in source.items()],
        ("evidence_kind", "synthetic_example"), ("status", result["status"]),
        *metrics.items(), *[("unit_" + key, value) for key, value in UNITS.items()],
        ("support_scope", result["coverage"]["support_scope"]),
        ("intervals", "此合成小例未估计统计区间。"),
        ("boundary", "本人冻结任务文件；未自动公开或保存为案例；CC0合成软件验证，真实研究资格未通过。"),
        ("source_state", "原任务冻结输入；当前原源可用及原样复算未知，不读取当前源。"),
        ("relationship", "距离、冷暖侧与对照未接入，不能判断锋面与活动关系；表观捕捞活动不是渔获、产量或收益。"),
        ("caveats", " ".join(result["caveats"])),
    ]
    columns = ["date", "state", "fishing_hours", "effective_area_km2", "area_time_km2_days", "excluded_units"]
    rows = [[d[key] for key in ["date", "state", "hours", "effective_area_km2", "area_time_km2_days", "excluded_units"]] for d in daily]
    data = render_aggregate_table(metadata, columns, rows, representation, title="Ocean 本人合成任务冻结证据").encode("utf-8")
    if len(data) > 1_048_576:
        raise ValueError("File budget exceeded")
    return data
