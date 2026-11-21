"""UTF-8 export of the existing version's allowed aggregate values."""

import csv
import io
import re
from hashlib import sha256

from .analysis_support import content_id
from .case_export import checked_case_report

FORMAT = "owner-case-aggregate-csv/v1"
LIMIT = 128 * 1024
HEADER = (
    "schema_version", "case_id", "case_version", "version_id", "report_id", "result_id", "projection_id",
    "region_id", "center_longitude", "center_latitude", "radius_km", "start_utc_date", "end_utc_date", "scope", "metric", "metric_label", "unit", "value", "value_state",
    "support_state", "precision", "chart_significant_digits", "evidence_kind", "research_ready",
    "source_id", "source_version", "source_input_id", "source_license",
)
MONTH_METRICS = {
    "total_hours": "h",
    "area_time_km2_days": "km2*d",
    "density_hours_per_km2_day": "h/(km2*d)",
    "mean_hours_per_supported_day": "h/d",
    "supported_days": "d",
    "calendar_days": "d",
}
METRIC_LABELS = {
    "total_hours": "表观捕捞活动小时",
    "area_time_km2_days": "有效面积时间",
    "density_hours_per_km2_day": "单位面积时间活动小时",
    "mean_hours_per_supported_day": "日均活动小时",
    "supported_days": "有效支持天数",
    "calendar_days": "日历天数",
    "interval": "统计区间",
    "hours": "表观捕捞活动小时",
    "effective_area_km2": "当日有效面积",
}
PUBLIC_IDENTIFIER = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}")
PUBLIC_VERSION = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,71}(?:/v[0-9]{1,8})?")


def value_state(value):
    return "unknown" if value is None else "known_zero" if value == 0 else "known"


def render_case_aggregate_csv(case):
    report = checked_case_report(case)
    result = report["result"]
    parameters, days = result["parameters"], result["daily"]
    source = result["source"]
    if source["license"].partition(";")[0].strip() != "CC0-1.0":
        raise ValueError("Aggregate export authorization is unavailable")
    region = content_id({key: parameters[key] for key in ("longitude", "latitude", "radius_km")})
    prefix = (FORMAT, case["case_id"], case["version"], case["version_id"], report["report_id"],
              result["result_id"], result["projection_id"], region, parameters["longitude"],
              parameters["latitude"], parameters["radius_km"])
    # Only these registered provenance fields enter the file. Human metadata and free text are excluded.
    registered = ((source["id"], PUBLIC_IDENTIFIER), (source["version"], PUBLIC_VERSION),
                  (source["input_sha256"], PUBLIC_IDENTIFIER))
    origin = tuple(value if pattern.fullmatch(value) else "unknown" for value, pattern in registered) + ("CC0-1.0",)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(HEADER)

    def metric(start, end, scope, name, unit, value, state, support):
        writer.writerow((*prefix, start, end, scope, name, METRIC_LABELS[name], unit, value, state, support,
                         "frozen_aggregate", 6, "synthetic_example", "false", *origin))

    first, last = days[0]["date"], days[-1]["date"]
    summary = result["metrics"]
    for name, unit in MONTH_METRICS.items():
        value = summary[name]
        state = value_state(value)
        if name == "density_hours_per_km2_day" and value is None and summary["area_time_km2_days"] == 0:
            state = "not_applicable"
        metric(first, last, "month", name, unit, value, state, result["status"])
    metric(first, last, "month", "interval", "h", None, "not_estimated", result["status"])
    for day in days:
        date = day["date"]
        for name, unit in (("hours", "h"), ("effective_area_km2", "km2")):
            value = day[name]
            metric(date, date, "day", name, unit, value, value_state(value), day["state"])

    text = output.getvalue()
    raw = text.encode("utf-8")
    parsed = list(csv.reader(io.StringIO(text, newline="")))
    if (len(raw) > LIMIT or tuple(parsed[0]) != HEADER
            or len(parsed) != 2 + len(MONTH_METRICS) + len(days) * 2
            or any(len(row) != len(HEADER) for row in parsed)):
        raise ValueError("Aggregate export failed validation")
    return raw



def aggregate_manifest(case, body):
    if not isinstance(body, bytes) or not 0 < len(body) <= LIMIT:
        raise ValueError("Aggregate export is unavailable")
    value = {
        "schema_version": "ocean-case-aggregate-csv-receipt/v1",
        "case_id": case["case_id"], "version": case["version"], "version_id": case["version_id"],
        "report_id": case["report"]["report_id"], "format_version": FORMAT,
        "sha256": "sha256:" + sha256(body).hexdigest(), "byte_length": len(body),
        "protection": "saved_case",
    }
    return {**value, "artifact_id": content_id(value)}
