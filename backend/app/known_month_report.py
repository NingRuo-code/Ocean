"""A report representation of an already approved public synthetic month projection."""

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
