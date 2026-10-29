"""Represent an immutable owner synthetic case; never access original data."""

import hashlib
import io
import json
import zipfile

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


def render_case_bundle(case):
    files = {"report.md": render_case_file(case, "markdown"), "daily.csv": render_case_file(case, "csv")}
    manifest = {
        "schema_version": "ocean-synthetic-case-bundle/v1", "export_version": EXPORT_VERSION,
        "case_id": case["case_id"], "case_version": case["version"], "case_version_id": case["version_id"],
        "case_saved_at": case["created_at"], "report_id": case["report"]["report_id"],
        "result_id": case["report"]["result"]["result_id"], "source_state": case["source_state"],
        "purpose": "owner_local_download", "research_ready": False, "automatically_published": False,
        "integrity_scope": "content_consistency_only; not_a_source_signature",
        "omitted": ["pdf", "png", "database", "original_sources", "task_protection", "production_backup"],
        "files": [{"name": name, "bytes": len(data), "sha256": "sha256:" + hashlib.sha256(data).hexdigest()} for name, data in files.items()],
    }
    files["manifest.json"] = (json.dumps(manifest, sort_keys=True, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, data in files.items():
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return output.getvalue()
