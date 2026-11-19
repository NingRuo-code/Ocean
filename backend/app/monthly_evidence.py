"""Render an existing controlled monthly distance result without opening its sources."""

import csv
import hashlib
import json
from html import escape
from io import BytesIO, StringIO
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

VERSION = "ocean-month-distance-evidence/v1"
FIELDS = ("hours", "area_time_km2_days", "density_hours_per_km2_day")
UNITS = ("活动小时 (h)", "面积时间 (km²·d)", "活动密度 [h/(km²·d)]")
DAILY_COLUMNS = {
    "date": "日期",
    "state": "支持状态",
    "fishing_hours": "活动小时 (h)",
    "effective_area_km2": "有效面积 (km²)",
    "area_time_km2_days": "面积时间 (km²·d)",
    "unknown_request_area_km2": "未知面积 (km²)",
    "minimum_proven_lower_km": "可证距离下界 (km)",
    "maximum_known_upper_km": "已知距离上界 (km)",
    "paired_for_comparison": "纳入对照",
    "comparison_exclusion": "对照排除原因",
    "reasons": "资料限制",
}


def display(value):
    if value is None:
        return "未知"
    if isinstance(value, bool):
        return "是" if value else "否"
    return escape(str(value))


def table(columns, rows):
    head = "".join(f'<th scope="col">{display(value)}</th>' for value in columns)
    body = "".join(
        "<tr>" + "".join(f"<td>{display(value)}</td>" for value in row) + "</tr>" for row in rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def metrics(entry):
    return [entry[key] for key in FIELDS]


def distance_figure(bands, result_id, interval_caption):
    densities = [row[3] for row in bands if row[3] is not None]
    maximum = max(densities, default=0) or 1
    height = 98 + 31 * len(bands)
    lines = [
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 {height}" '
            'role="img" aria-labelledby="distance-title">'
        ),
        '<title id="distance-title">各距离带的表观捕捞活动密度</title>',
        f'<rect width="980" height="{height}" fill="#f1f5f6"/>',
        '<g font-family="sans-serif" font-size="14" fill="#17333e">',
        '<text x="14" y="24">距离带 (km)</text>',
        '<text x="190" y="24">表观捕捞活动密度 [h/(km²·d)]</text>',
        '<text x="725" y="24">有效支持 (km²·d)</text>',
    ]
    for index, (name, _, area_time, density) in enumerate(bands):
        y = 45 + 31 * index
        lines.append(f'<text x="14" y="{y + 14}">{display(name)}</text>')
        lines.append(f'<text x="725" y="{y + 14}">{display(area_time)}</text>')
        if density is None:
            lines.append(f'<text x="190" y="{y + 14}">未知</text>')
            continue
        width = 260 * (density / maximum)
        lines.append(
            f'<g data-band="{index}"><rect x="190" y="{y}" width="{width:.3f}" height="17" fill="#227a7b"/>'
        )
        lines.append(f'<text x="465" y="{y + 14}">{display(density)}</text></g>')
    lines.append(f'<text x="14" y="{height - 33}">{display(interval_caption)}</text>')
    lines.append(f'<text x="14" y="{height - 10}">结果 {display(result_id)}</text>')
    return "\n".join([*lines, "</g></svg>"])


def daily_rows(result):
    rows = []
    for day in result["days"]:
        common = day["common"]
        comparison = day.get("distance_comparison", {})
        rows.append(
            {
                "date": day["date"],
                "state": common["state"],
                "fishing_hours": common["hours"],
                "effective_area_km2": common["effective_area_km2"],
                "area_time_km2_days": common["area_time_km2_days"],
                "unknown_request_area_km2": common["unknown_request_area_km2"],
                "minimum_proven_lower_km": day["minimum_proven_lower_km"],
                "maximum_known_upper_km": day["maximum_known_upper_km"],
                "paired_for_comparison": comparison.get("included"),
                "comparison_exclusion": comparison.get("reason"),
                "reasons": ", ".join(common["reasons"]),
            }
        )
    return rows


def comparison_reading(comparison, names, days):
    if comparison is None:
        return "当前结果未登记同日对照。", "区间未估计。", "<p>无可供核对的配对记录。</p>", []
    paired = comparison["paired_dates"]
    difference = comparison["difference_hours_per_km2_day"]
    if difference is None:
        explanation = "无可比日期。"
    elif difference > 0:
        explanation = "在同日配对支持内，目标距离带的活动密度较高。"
    elif difference < 0:
        explanation = "在同日配对支持内，目标距离带的活动密度较低。"
    else:
        explanation = "在同日配对支持内，两个距离带的活动密度相同。"
    rows = [
        (f"{label} {names[comparison[key + '_band']['index']]}", *metrics(comparison[key]))
        for label, key in (("目标", "target"), ("参照", "reference"))
    ]
    interval = comparison.get("uncertainty")
    if interval is None:
        interval_text = "区间未估计。"
    elif interval["status"] != "estimated_for_registered_assumptions":
        interval_text = f"区间未估计。原因 {interval['reason']}。"
    else:
        confidence = interval["policy"]["confidence_level"]
        interval_text = (
            f"登记假设下的 {confidence:.1%} 区间 "
            f"[{display(interval['lower'])}, {display(interval['upper'])}] h/(km²·d)。"
            f"使用 {display(interval['supported_groups'])} 个相关日组。"
        )
    dates = display(", ".join(paired)) if paired else "无"
    details = table(("对照距离带 (km)", *UNITS), rows)
    facts = comparison["comparability"]
    rules = table(
        ("匹配条件与平衡检查", "值"),
        [
            *comparison["policy"].items(),
            ("匹配条件", ", ".join(facts["matched"])),
            ("权重规则", facts["weight"]),
            ("未控制因素", ", ".join(facts["uncontrolled"])),
            ("海温配对日期", ", ".join(facts["sst_paired_dates"]) or "无"),
            ("配对海温差 (°C)", facts["target_minus_reference_temperature_c"]),
            ("海温限制", facts["sst_reason"]),
        ],
    )
    weights = table(
        (
            "日期",
            "目标权重",
            "参照权重",
            "可比面积比例",
            "目标离圆心 (km)",
            "参照离圆心 (km)",
            "排除原因",
        ),
        (
            (
                row["date"],
                row["target_weight"],
                row["reference_weight"],
                row["smaller_to_larger_area_ratio"],
                row["covariates"]["target"]["mean_local_distance_to_circle_center_km"],
                row["covariates"]["reference"]["mean_local_distance_to_circle_center_km"],
                row["reason"],
            )
            for day in days
            if (row := day.get("distance_comparison")) is not None
        ),
    )
    preview = (
        f"<p>配对日期 {dates}。密度差 {display(difference)} h/(km²·d)。</p>"
        f"{details}{rules}{weights}"
    )
    return explanation, interval_text, preview, rows


def activity_reading(accounting):
    rows = [
        (label, accounting[hours], accounting[area_time])
        for label, hours, area_time in (
            ("已观测活动", "observed_hours", "observed_area_time_km2_days"),
            (
                "已观测但未纳入共同支持",
                "observed_not_assigned_hours",
                "observed_not_assigned_area_time_km2_days",
            ),
        )
    ]
    reasons = table(("活动归属", "日期数"), accounting["reasons_by_day_count"].items())
    return table(("月活动分布", *UNITS[:2]), rows) + reasons, rows


def side_reading(environment):
    if environment is None:
        return "<p>当前结果未登记冷暖侧和同日海温子集。</p>", []
    sides = environment["sides"]
    labels = (("冷侧", "cold"), ("暖侧", "warm"), ("侧别未知", "unknown"))
    rows = [(label, *metrics(sides[side])) for label, side in labels]
    days = table(
        ("侧别", "受支持日期数", "限制"),
        [(label, sides[side]["days"], sides[side]["reason"] or "有支持") for label, side in labels],
    )
    sst = environment["sst"]
    temperature = table(
        ("同日海温子集", "值"),
        [
            ("支持日期数", sst["days"]),
            ("面积时间加权海温 (°C)", sst["mean_temperature_c"]),
            ("面积时间 (km²·d)", sst["area_time_km2_days"]),
            ("限制", sst["reason"] or "仅覆盖该海温子集"),
        ],
    )
    return table(("侧别", *UNITS), rows) + days + temperature, rows


def render_monthly_evidence(result):
    edges = result["distance_edges_km"]
    names = [f"[{low}, {high})" for low, high in zip([0, *edges[:-1]], edges, strict=True)]
    names.extend([f"≥ {edges[-1]}", "距离未知"])
    month = result["month"]
    bands = [(name, *metrics(entry)) for name, entry in zip(names, month["bands"], strict=True)]
    days = daily_rows(result)
    totals = metrics(month["common"])
    supported = sum(day["fishing_hours"] is not None for day in days)
    review = "合成距离参照" if result["evidence_kind"] == "synthetic" else "已登记直接参照"
    params = result["parameters"]
    identifier = display(result["result_id"])
    versions = table(("版本来源", "身份"), result["versions"].items())
    p0 = result["p0_conditions"]
    conditions = table(
        ("参数", "值"),
        [
            *params.items(),
            *(
                (f"P0 {key}", p0[key])
                for key in ("layer_use", "method_version", "quality_rule", "allocation")
            ),
        ],
    )
    explanation, interval, comparison, pairs = comparison_reading(
        month.get("distance_comparison"), names, result["days"]
    )
    figure = distance_figure(bands, result["result_id"], "同日对照 · " + interval)
    activity, activity_rows = activity_reading(month["activity_accounting"])
    sides, side_rows = side_reading(month.get("side_environment"))
    support_note = (
        "缺测日期保留为未知。下列数值只覆盖已知共同支持。"
        if supported
        else "资料不足。没有可纳入的共同支持日期，活动小时保持未知。"
    )
    day_table = table(DAILY_COLUMNS.values(), ([row[key] for key in DAILY_COLUMNS] for row in days))
    page = f"""<!DOCTYPE html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>月度距离与活动证据</title><style>
body{{margin:2rem auto;max-width:72rem;padding:0 1rem;font:16px/1.55 system-ui;color:#17333e}}
svg{{display:block;width:100%;max-width:55rem}}table{{border-collapse:collapse;width:100%}}
th,td{{padding:.5rem;text-align:left;vertical-align:top;border-bottom:1px solid #c7d7dc}}
details{{margin:1rem 0;overflow:auto}}summary{{cursor:pointer}}code{{overflow-wrap:anywhere}}
</style><body><main>
<h1>月度距离与活动证据</h1><p>{review}。表观捕捞活动按小时计。正式研究资格未通过。</p>
<p>{display(params["month"])} · {display(params["longitude"])}°E，
{display(params["latitude"])}°N · 半径 {display(params["radius_km"])} km</p>
<p>结果 <code>{identifier}</code></p>
{table(("有效日 / 日历日", *UNITS), [(f"{supported} / {len(days)}", *totals)])}
<p>{support_note}</p>
<h2>距离带与活动密度</h2>{figure}
{table(("距离带 (km)", *UNITS), bands)}
<p>各距离带的密度是描述性聚合。距离下界和未知距离保留各自状态。</p>
<p>{explanation} {display(interval)}</p>
<details><summary>同日对照与可比性</summary>{comparison}</details>
<details><summary>活动分布、冷暖侧与环境</summary>{activity}{sides}</details>
<details><summary>逐日支持、纳入与排除</summary>{day_table}</details>
<details><summary>结果条件与方法版本</summary>{conditions}{versions}</details>
</main></body></html>"""
    monthly = [("common", "共同支持", *totals)]
    for section, rows in (
        ("distance", bands),
        ("side", side_rows),
        ("paired", pairs),
        ("activity", [(*row, None) for row in activity_rows]),
    ):
        monthly.extend((section, *row) for row in rows)
    return page.encode("utf-8"), figure.encode("utf-8"), days, monthly


def csv_bytes(columns, rows):
    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(columns)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8-sig")


def zip_monthly_evidence(result, page, figure, daily, monthly):
    files = {
        "evidence.html": page,
        "distance.svg": figure,
        "daily.csv": csv_bytes(
            ("result_id", *DAILY_COLUMNS),
            ((result["result_id"], *(row[key] for key in DAILY_COLUMNS)) for row in daily),
        ),
        "monthly.csv": csv_bytes(
            (
                "result_id",
                "section",
                "group",
                "fishing_hours",
                "area_time_km2_days",
                "density_hours_per_km2_day",
            ),
            ((result["result_id"], *row) for row in monthly),
        ),
    }
    manifest = {
        "schema_version": VERSION,
        "result_id": result["result_id"],
        "evidence_kind": result["evidence_kind"],
        "versions": result["versions"],
        "files": {
            name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            for name, data in files.items()
        },
    }
    files["manifest.json"] = json.dumps(manifest, sort_keys=True).encode("utf-8")
    output = BytesIO()
    with ZipFile(output, "w") as bundle:
        for name, data in files.items():
            bundle.writestr(ZipInfo(name), data, compress_type=ZIP_DEFLATED)
    return output.getvalue()
