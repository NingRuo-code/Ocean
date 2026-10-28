"""A report representation of an already approved public synthetic month projection."""

import csv
import io
import string

from .analysis_support import content_id

REPORT_VERSION = "known-month-report/v1"


def build_known_month_report(result):
    """Only call with the existing verified public projection; no scientific computation."""
    report = {
        "schema_version": "ocean-known-month-report/v1",
        "report_version": REPORT_VERSION,
        "result": result,
        "interpretation": {
            "summary": "仅描述已知支持中的表观捕捞活动小时；未知日未补零。",
            "relationship": "距离、冷暖侧及对照证据尚未接入，不能据此判断锋面与活动的关系。",
            "intervals": "统计区间：此样例未估计。",
            "boundary": "CC0 合成样例；真实研究资格未通过。表观捕捞活动不代表渔获量、产量或收益。",
        },
    }
    report["report_id"] = content_id(report)
    return report


def report_metadata(report):
    result = report["result"]
    return [
        ("report_id", report["report_id"]),
        ("report_version", report["report_version"]),
        ("result_id", result["result_id"]),
        ("projection_id", result["projection_id"]),
        *result["parameters"].items(),
        ("evidence_kind", result["evidence_kind"]),
        ("research_ready", "false"),
        ("public_aggregate_allowed", "true"),
        ("status", result["status"]),
        *[("source_" + key, value) for key, value in result["source"].items()],
        *result["metrics"].items(),
        *[("unit_" + key, value) for key, value in result["units"].items()],
        *report["interpretation"].items(),
        ("caveats", " ".join(result["caveats"])),
    ]


def render_report_file(report, representation):
    """Render only the same whitelisted aggregate already used by the preview."""
    metadata = report_metadata(report)
    daily = report["result"]["daily"]
    header = ["date", "state", "fishing_hours", "effective_area_km2", "area_time_km2_days"]
    rows = [
        [d["date"], d["state"], d["hours"], d["effective_area_km2"], d["area_time_km2_days"]]
        for d in daily
    ]
    if representation == "csv":
        def safe_cell(value):
            if isinstance(value, str) and value and (value[0].isspace() or value[0] in "=+@-"):
                return "'" + value
            return value

        output = io.StringIO(newline="")
        output.write("\ufeff")
        writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)
        for row in [*metadata, [], header, *rows]:
            writer.writerow([safe_cell(value) for value in row])
        return output.getvalue()
    if representation != "markdown":
        raise ValueError("Unsupported report representation")

    escapes = str.maketrans({char: "\\" + char for char in string.punctuation})

    def plain(value):
        if value is None:
            return "未知"
        return str(value).replace("\r", " ").replace("\n", " ").translate(escapes)

    lines = [
        "# Ocean 月度活动报告", "", "合成样例；真实研究资格未通过。", "",
        "## 条件、指标与来源", "", "| 字段 | 值 |", "| --- | --- |",
        *[f"| {plain(key)} | {plain(value)} |" for key, value in metadata],
        "", "## 逐日聚合", "",
        "单位：活动小时 h；有效面积 km²；面积时间 km²·d。未知日未补零。", "",
        "| 日期 | 状态 | 小时 (h) | 有效面积 (km²) | 面积时间 (km²·d) |",
        "| --- | --- | ---: | ---: | ---: |",
        *["| " + " | ".join(plain(value) for value in row) + " |" for row in rows], "",
    ]
    return "\n".join(lines)
