"""Fixed evidence figure from an already frozen synthetic report, with no map reads."""

from html import escape
from textwrap import wrap

from .case_export import checked_case_report

CHART_VERSION = "case-daily-chart/v1"


def render_case_chart(case):
    report = checked_case_report(case)
    result = report["result"]
    p, m, days = result["parameters"], result["metrics"], result["daily"]
    known = [d["hours"] for d in days if d["hours"] is not None]
    maximum = max(known, default=0)
    footer = [
        "图示版本：" + CHART_VERSION + "；数值显示至6位有效数，完整原值见同版本CSV。",
        "案例：" + case["case_id"] + "；版本：" + str(case["version"]),
        "案例版本身份：" + case["version_id"], "报告身份：" + report["report_id"],
        "成果身份：" + result["result_id"], "保存时间：" + case["created_at"],
        "人工标题、标签及笔记未包含；未保存草稿与当前地图未参与制图。",
        "仅证明保存时核验的合成快照；当前源未重查，仍可用/原样复算未知。",
        *["来源 " + str(k) + "：" + str(v) for k, v in result["source"].items()],
        *["条件 " + str(k) + "：" + str(v) for k, v in p.items()],
        *report["interpretation"].values(), *result["caveats"],
    ]
    lines = [part for line in footer for part in wrap(line, width=62, break_on_hyphens=False)]
    height = max(1100, 840 + len(lines) * 28)
    if height > 10000:
        raise ValueError("Figure budget exceeded")
    pieces = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{height}" viewBox="0 0 1600 {height}" data-chart-version="{CHART_VERSION}" data-case-id="{case["case_id"]}" data-case-version="{case["version"]}" data-case-version-id="{case["version_id"]}" data-report-id="{report["report_id"]}" data-axis="{"hours" if known else "unknown-only"}" font-family="sans-serif" fill="#182b3a">', f'<rect x="0" y="0" width="1600" height="{height}" fill="#f6f9fc"/>']

    def text(x, y, value, size=22, anchor="start"):
        pieces.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}">{escape(str(value))}</text>')

    def number(value):
        return "未知" if value is None else format(value, ".6g")

    text(80, 65, "Ocean · 逐日表观捕捞活动小时（合成样例）", 32)
    text(80, 115, f'{p["month"]} · {abs(p["longitude"])}°{"E" if p["longitude"] >= 0 else "W"}, {abs(p["latitude"])}°{"N" if p["latitude"] >= 0 else "S"} · {p["radius_km"]} km · 案例版本 {case["version"]}')
    text(80, 160, f'H = {number(m["total_hours"])} h；E = {number(m["area_time_km2_days"])} km²·d；有效/日历日 {m["supported_days"]}/{m["calendar_days"]}')
    text(80, 205, "真实研究资格未通过；活动小时不代表渔获、产量或收益。")
    if known:
        for step in range(5 if maximum else 1):
            y = 660 - 100 * step
            pieces.append(f'<line x1="120" y1="{y}" x2="1480" y2="{y}" stroke="#c9d2d9" stroke-width="1"/>')
            text(105, y + 6, number(maximum * (step / 4)) if maximum else "0", 18, "end")
        text(120, 240, "小时 (h)", 20)
    else:
        text(120, 400, "全部日期支持未知；未绘制小时刻度，未知未补零。", 26)
    width = 1360 / len(days)
    for index, day in enumerate(days):
        x = 120 + (index + 0.5) * width
        hours = day["hours"]
        state = "unknown" if hours is None else "zero" if hours == 0 else "positive"
        value = "" if hours is None else f' data-hours="{hours}"'
        pieces.append(f'<g data-date="{day["date"]}" data-state="{state}"{value}>')
        if state == "positive":
            bar = 400 * (hours / maximum)
            pieces.append(f'<rect x="{x - width * .28:.3f}" y="{660 - bar:.3f}" width="{width * .56:.3f}" height="{bar:.3f}" fill="#2675a8"/>')
        elif state == "zero":
            pieces.append(f'<circle cx="{x:.3f}" cy="660" r="6" fill="#f6f9fc" stroke="#1b5e20" stroke-width="3"/>')
        else:
            pieces.append(f'<path d="M {x-5:.3f} 655 L {x+5:.3f} 665 M {x-5:.3f} 665 L {x+5:.3f} 655" stroke="#7a8791" stroke-width="2"/>')
        text(f"{x:.3f}", 698, day["date"][-2:], 16, "middle")
        pieces.append("</g>")
    text(120, 742, "横轴：所标年月的日期；蓝条=有效正值，绿圆=有效零，灰叉=支持未知。", 20)
    for index, line in enumerate(lines):
        text(80, 810 + index * 28, line, 20)
    pieces.append("</svg>")
    return "\n".join(pieces).encode("utf-8")
