from __future__ import annotations

from datetime import UTC, date, datetime
from html import escape
from pathlib import Path

from .config import settings
from .front_objects import compute_front_object_response, compute_front_tracking_response
from .history import compute_history_response
from .main_analysis import compute_analysis_response
from .schemas import ReportResponse


def compute_report_response(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    days: int = 3,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> ReportResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    analysis = compute_analysis_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    history = compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    objects = compute_front_object_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    tracking = compute_front_tracking_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        days=days,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    highlights = [
        f"当前窗口锋面状态：{analysis.front.get('status', '--')}，锋面线像元 {analysis.front.get('line_pixels', '--')} 个。",
        f"SST 均值 {_temperature(analysis.sst.get('mean'))}，局地温差 {_temperature(analysis.sst.get('range_celsius'))}。",
        f"锋面对象 {objects.object_count} 个，最近对象 {objects.nearest_front_id or '--'}。",
        f"历史同期概率 {_probability(history.summary.same_period_probability)}，月度概率 {_probability(history.summary.monthly_probability)}。",
        f"历史样本覆盖可信度：{history.summary.sample_reliability_label}。",
        f"连续 {tracking.days} 日追踪：{tracking.status}。",
    ]
    source_files = sorted(
        {
            *analysis.files,
            *history.source_files,
            *objects.source_files,
            *tracking.source_files,
        }
    )
    title = f"海洋锋面离线分析报告 - {observation_date.isoformat()}"
    generated_at = datetime.now(UTC).isoformat(timespec="seconds")
    markdown = _build_markdown(
        title=title,
        generated_at=generated_at,
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        highlights=highlights,
        analysis=analysis,
        history=history,
        objects=objects,
        tracking=tracking,
        source_files=source_files,
    )
    return ReportResponse(
        title=title,
        generated_at=generated_at,
        query={
            "date": observation_date.isoformat(),
            "longitude": longitude,
            "latitude": latitude,
            "radius_deg": radius_deg,
            "days": days,
        },
        highlights=highlights,
        markdown=markdown,
        html=_markdown_to_report_html(title, markdown),
        source_files=source_files,
    )


def _build_markdown(
    *,
    title: str,
    generated_at: str,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    highlights: list[str],
    analysis: object,
    history: object,
    objects: object,
    tracking: object,
    source_files: list[str],
) -> str:
    nearest = objects.objects[0] if objects.objects else None
    tracking_lines = [
        (
            f"- {step.date}: {step.front_id or step.status}，"
            f"长度 {_distance(step.length_km)}，位移 {_distance(step.distance_from_previous_km)}，"
            f"匹配分数 {_probability(step.match_score)}，"
            f"形态相似度 {_probability(step.shape_similarity)}，"
            f"bbox 重叠 {_probability(step.bbox_overlap_ratio)}，"
            f"匹配：{step.status}"
        )
        for step in tracking.steps
    ]
    tracking_note_lines = [f"- {note}" for note in tracking.algorithm_notes]
    object_lines = [
        (
            f"- {item.front_id}: 质心 {item.centroid_longitude:.3f}°E/"
            f"{item.centroid_latitude:.3f}°N，长度 {_distance(item.length_km)}，"
            f"距查询点 {_distance(item.nearest_to_query_km)}，像元 {item.pixel_count}"
        )
        for item in objects.objects[:6]
    ]
    source_lines = [f"- {source}" for source in source_files]
    return "\n".join(
        [
            f"# {title}",
            "",
            f"- 生成时间：{generated_at}",
            f"- 查询日期：{observation_date.isoformat()}",
            f"- 查询位置：{longitude:.4f}°E, {latitude:.4f}°N",
            f"- 查询范围：±{radius_deg:.4f}°",
            "",
            "## 汇报摘要",
            "",
            *[f"- {item}" for item in highlights],
            "",
            "## 当前窗口",
            "",
            f"- 中心 SST：{_temperature(analysis.sst.get('center_celsius'))}",
            f"- SST 均值：{_temperature(analysis.sst.get('mean'))}",
            f"- 局地温差：{_temperature(analysis.sst.get('range_celsius'))}",
            f"- 温度梯度：{_gradient(analysis.sst.get('gradient_c_per_km'))}",
            f"- 冷 / 暖侧像元：{analysis.front.get('cold_side_pixels', '--')} / {analysis.front.get('warm_side_pixels', '--')}",
            "",
            "## 锋面对象",
            "",
            f"- 对象数量：{objects.object_count}",
            f"- 最近对象：{objects.nearest_front_id or '--'}",
            f"- 最近对象长度：{_distance(nearest.length_km if nearest else None)}",
            "",
            *(object_lines or ["- 当前窗口内未检测到锋面对象。"]),
            "",
            "## 连续追踪",
            "",
            f"- 状态：{tracking.status}",
            f"- 算法：{tracking.algorithm}",
            f"- 匹配阈值：{tracking.match_distance_km:.0f} km",
            f"- 累计位移：{_distance(tracking.cumulative_displacement_km)}",
            "",
            *(tracking_note_lines or ["- 未提供追踪算法说明。"]),
            "",
            *(tracking_lines or ["- 当前窗口无可追踪节点。"]),
            "",
            "## 历史统计",
            "",
            f"- 历史同期概率：{_probability(history.summary.same_period_probability)}",
            f"- 月度概率：{_probability(history.summary.monthly_probability)}",
            f"- 样本覆盖可信度：{history.summary.sample_reliability_label}",
            f"- 同期覆盖：{history.summary.same_period_sample_count}/{history.summary.same_period_expected_sample_count}",
            f"- 样本覆盖说明：{history.summary.sample_coverage_note}",
            f"- 历史样本数：{history.summary.annual_sample_count}",
            f"- SST 多年均值：{_temperature(history.summary.sst_mean_celsius)}",
            f"- 多年温度梯度均值：{_gradient(history.summary.sst_gradient_c_per_km_mean)}",
            "",
            "## 源文件",
            "",
            *(source_lines or ["- 无源文件记录"]),
        ]
    )


def _markdown_to_report_html(title: str, markdown: str) -> str:
    body_parts = []
    in_list = False
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            continue
        if line.startswith("# "):
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            body_parts.append(f"<h1>{escape(line[2:])}</h1>")
        elif line.startswith("## "):
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            body_parts.append(f"<h2>{escape(line[3:])}</h2>")
        elif line.startswith("- "):
            if not in_list:
                body_parts.append("<ul>")
                in_list = True
            body_parts.append(f"<li>{escape(line[2:])}</li>")
        else:
            if in_list:
                body_parts.append("</ul>")
                in_list = False
            body_parts.append(f"<p>{escape(line)}</p>")
    if in_list:
        body_parts.append("</ul>")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>{escape(title)}</title>
  <style>
    body {{ font-family: "Microsoft YaHei", "Segoe UI", sans-serif; margin: 36px; color: #1f2d32; line-height: 1.65; }}
    h1 {{ font-size: 24px; border-bottom: 3px solid #0b7483; padding-bottom: 10px; }}
    h2 {{ margin-top: 28px; font-size: 18px; color: #0b7483; }}
    ul {{ padding-left: 20px; }}
    li {{ margin: 6px 0; }}
  </style>
</head>
<body>
{''.join(body_parts)}
</body>
</html>"""


def _probability(value: float | None) -> str:
    return "--" if value is None else f"{value * 100:.1f}%"


def _temperature(value: object) -> str:
    return "--" if value is None else f"{float(value):.2f} °C"


def _gradient(value: object) -> str:
    return "--" if value is None else f"{float(value):.5f} °C/km"


def _distance(value: object) -> str:
    return "--" if value is None else f"{float(value):.2f} km"
