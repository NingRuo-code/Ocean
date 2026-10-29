"""Represent an immutable owner synthetic case; never access original data."""

from .known_month_report import build_known_month_report, render_report_file

EXPORT_VERSION = "synthetic-case-export/v1"


def render_case_file(case, representation):
    report = case["report"]
    result = report["result"]
    if (report != build_known_month_report(result)
            or result.get("schema_version") != "ocean-published-month/v1"
            or result.get("evidence_kind") != "synthetic_example"
            or result.get("research_ready") is not False
            or result.get("public_aggregate_allowed") is not True
            or not result.get("source", {}).get("license", "").startswith("CC0-1.0")):
        raise ValueError("Unsupported saved report")
    metadata = case["metadata"]
    prefix = [
        ("export_version", EXPORT_VERSION), ("case_id", case["case_id"]),
        ("case_version", case["version"]), ("case_version_id", case["version_id"]),
        ("case_saved_at", case["created_at"]), ("case_source_state", case["source_state"]),
        ("human_title", metadata["title"]), ("human_tags", "\n".join(metadata["tags"])),
        ("human_note", metadata["note"]),
        ("export_scope", "本人所读已保存版本；人工笔记不是科学解释；未保存草稿未导出；不自动公开。"),
    ]
    return render_report_file(report, representation, metadata_prefix=prefix).encode("utf-8")


def case_filename(case, extension):
    return f"Ocean-case-{case['case_id']}-v{case['version']}-{case['version_id'][7:19]}.{extension}"
