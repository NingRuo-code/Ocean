from __future__ import annotations

import json
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import numpy as np

from .config import settings
from .data_access import (
    FRONT_LINE_CODES,
    load_front_subset,
    load_sst_subset,
    match_front_record,
    match_sst_record,
    summarize_front_window,
    summarize_sst_window,
)
from .front_objects import compute_front_object_response, compute_front_tracking_response
from .history import (
    compute_history_monthly_response,
    compute_history_probability_response,
    compute_history_response,
    get_history_index,
)
from .knowledge_base import KnowledgeEntry, load_knowledge_entries, source_files
from .schemas import (
    AiAnalysisRequest,
    AiAnalysisResponse,
    AiCapabilitiesResponse,
    AiConclusion,
    AiEvidence,
    AiHealthResponse,
    AiKnowledgeEntry,
    AiKnowledgeResponse,
    AiRecommendation,
    AiStructuredTask,
    AiTaskParameters,
    AiToolCallRecord,
)

SUPPORTED_TASKS = [
    "show_current_front",
    "calculate_historical_probability",
    "query_monthly_activity",
    "change_spatial_range",
    "show_multi_day_change",
    "explain_statistics",
]
SUPPORTED_TOOLS = [
    "analysis.current_front",
    "front.objects",
    "front.tracking",
    "history.probability",
    "history.monthly",
    "history.timeline",
    "knowledge.lookup",
]

_ISO_DATE_PATTERN = re.compile(r"(?P<year>20\d{2}|19\d{2})[-/.](?P<month>\d{1,2})[-/.](?P<day>\d{1,2})")
_CN_DATE_PATTERN = re.compile(r"(?:(?P<year>20\d{2}|19\d{2})年)?(?P<month>\d{1,2})月(?P<day>\d{1,2})[日号]?")
_LON_PATTERNS = (
    (re.compile(r"(?:东经|经度|lon|longitude)\s*[:：]?\s*(?P<value>-?\d+(?:\.\d+)?)", re.IGNORECASE), 1),
    (re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*°?\s*[eE]"), 1),
    (re.compile(r"(?:西经)\s*[:：]?\s*(?P<value>\d+(?:\.\d+)?)"), -1),
    (re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*°?\s*[wW]"), -1),
)
_LAT_PATTERNS = (
    (re.compile(r"(?:北纬|纬度|lat|latitude)\s*[:：]?\s*(?P<value>-?\d+(?:\.\d+)?)", re.IGNORECASE), 1),
    (re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*°?\s*[nN]"), 1),
    (re.compile(r"(?:南纬)\s*[:：]?\s*(?P<value>\d+(?:\.\d+)?)"), -1),
    (re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*°?\s*[sS]"), -1),
)
_RADIUS_KM_PATTERN = re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*(?:km|KM|公里|千米)")
_RADIUS_DEG_PATTERN = re.compile(r"(?P<value>\d+(?:\.\d+)?)\s*(?:°|度)")
_DAYS_PATTERNS = (
    re.compile(r"(?:连续|前后|近|最近)\s*(?P<value>\d+)\s*(?:日|天)"),
    re.compile(r"(?P<value>\d+)\s*(?:日|天)(?:变化|趋势|追踪|跟踪)"),
)
_MONTH_PATTERN = re.compile(r"(?P<month>1[0-2]|0?[1-9])\s*月")


def capabilities_response() -> AiCapabilitiesResponse:
    model_available, model_status = _local_model_status()
    return AiCapabilitiesResponse(
        provider=settings.ai_provider,
        model=_model_name(),
        local_llm_endpoint=settings.local_llm_endpoint,
        offline=True,
        local_model_available=model_available,
        local_model_status=model_status,
        supported_tasks=SUPPORTED_TASKS,
        supported_tools=SUPPORTED_TOOLS,
        guarantees=[
            "语言层只生成任务和解释，不直接生成科学统计数值。",
            "概率、温度、距离和像元数量必须来自后端工具响应。",
            "每条结论都携带 evidence_ids，可回溯到工具结果或本地知识库。",
            "默认 rules 模式无需联网和模型权重；可通过 OCEAN_AI_PROVIDER 接入本地小模型。",
        ],
    )


def health_response() -> AiHealthResponse:
    model_available, model_status = _local_model_status()
    return AiHealthResponse(
        provider=settings.ai_provider,
        model=_model_name(),
        local_llm_endpoint=settings.local_llm_endpoint,
        offline=True,
        local_model_available=model_available,
        local_model_status=model_status,
        checked_at=datetime.now(UTC).isoformat(),
    )


def knowledge_response() -> AiKnowledgeResponse:
    entries = load_knowledge_entries()
    return AiKnowledgeResponse(
        entries=[
            AiKnowledgeEntry(id=item.id, title=item.title, content=item.content)
            for item in entries
        ],
        source_files=source_files(),
    )


def analyze_request(
    request: AiAnalysisRequest,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> AiAnalysisResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    structured = parse_natural_language(request, raw_data_dir, cache_dir)
    evidence: list[AiEvidence] = []
    tool_calls: list[AiToolCallRecord] = []
    conclusions: list[AiConclusion] = []
    warnings: list[str] = []

    evidence.extend(_knowledge_evidence(load_knowledge_entries()))
    evidence.append(_structured_task_evidence(structured))

    params = structured.parameters
    if params.date is None:
        warnings.append("未能确定日期，已生成结构化任务但未执行数据工具。")
    if params.longitude is None or params.latitude is None:
        warnings.append("未能确定经纬度，已生成结构化任务但未执行局地分析工具。")
    if params.radius_deg is None:
        warnings.append("未能确定空间范围，已生成结构化任务但未执行局地分析工具。")

    can_run = (
        params.date is not None
        and params.longitude is not None
        and params.latitude is not None
        and params.radius_deg is not None
    )
    history = None
    if can_run:
        history = compute_history_response(
            observation_date=params.date,
            longitude=params.longitude,
            latitude=params.latitude,
            radius_deg=params.radius_deg,
            raw_data_dir=raw_data_dir,
            cache_dir=cache_dir,
        )

    if can_run and history is not None and "show_current_front" in structured.tasks:
        current_evidence = _current_front_evidence(
            params.date,
            params.longitude,
            params.latitude,
            params.radius_deg,
            raw_data_dir,
            cache_dir,
        )
        evidence.extend(current_evidence)
        tool_calls.append(
            _tool_call(
                name="analysis.current_front",
                endpoint=f"{settings.api_prefix}/analysis/{params.date}",
                reason="回答某日某位置锋面、冷暖侧和当前海温问题。",
                parameters=params,
                evidence_ids=[item.id for item in current_evidence],
            )
        )
        object_evidence = _front_object_evidence(
            params.date,
            params.longitude,
            params.latitude,
            params.radius_deg,
            raw_data_dir,
            cache_dir,
        )
        evidence.extend(object_evidence)
        tool_calls.append(
            _tool_call(
                name="front.objects",
                endpoint=f"{settings.api_prefix}/front-objects/{params.date}",
                reason="把锋面线像元聚类为对象，输出 front_id、质心、长度和最近距离。",
                parameters=params,
                evidence_ids=[item.id for item in object_evidence],
            )
        )

    if can_run and "calculate_historical_probability" in structured.tasks:
        probability = compute_history_probability_response(
            observation_date=params.date,
            longitude=params.longitude,
            latitude=params.latitude,
            radius_deg=params.radius_deg,
            raw_data_dir=raw_data_dir,
            cache_dir=cache_dir,
        )
        probability_evidence = [
            AiEvidence(
                id="history-same-period-probability",
                source="tool:history.probability",
                label="历史同期概率",
                value=_format_probability(probability.summary.same_period_probability),
                detail=(
                    f"{probability.summary.same_period_front_hit_count}/"
                    f"{probability.summary.same_period_sample_count} 个同月同日样本命中锋面"
                ),
                source_files=sorted(
                    {
                        source
                        for point in probability.same_period_records
                        for source in point.source_files
                    }
                ),
            ),
            AiEvidence(
                id="history-monthly-probability",
                source="tool:history.probability",
                label="月度概率",
                value=_format_probability(probability.summary.monthly_probability),
                detail=(
                    f"{probability.summary.monthly_front_hit_count}/"
                    f"{probability.summary.monthly_sample_count} 个同月样本命中锋面"
                ),
                source_files=sorted(
                    {
                        source
                        for point in probability.monthly_records
                        for source in point.source_files
                    }
                ),
            ),
            AiEvidence(
                id="history-sample-coverage",
                source="tool:history.probability",
                label="样本覆盖可信度",
                value=probability.summary.sample_reliability_label,
                detail=probability.summary.sample_coverage_note,
                source_files=[],
            ),
        ]
        evidence.extend(probability_evidence)
        tool_calls.append(
            _tool_call(
                name="history.probability",
                endpoint=f"{settings.api_prefix}/history/{params.date}/probability",
                reason="计算历史同期发生概率和查询月份发生概率。",
                parameters=params,
                evidence_ids=[item.id for item in probability_evidence],
            )
        )

    if can_run and "query_monthly_activity" in structured.tasks:
        monthly = compute_history_monthly_response(
            observation_date=params.date,
            longitude=params.longitude,
            latitude=params.latitude,
            radius_deg=params.radius_deg,
            raw_data_dir=raw_data_dir,
            cache_dir=cache_dir,
        )
        selected = monthly.selected
        monthly_evidence = [
            AiEvidence(
                id="history-selected-month",
                source="tool:history.monthly",
                label=f"{monthly.selected_month} 月锋面活动",
                value=_format_probability(selected.probability if selected else None),
                detail=(
                    f"样本数 {selected.sample_count}，命中 {selected.front_hit_count}，"
                    f"SST 均值 {_format_temperature(selected.sst_mean_celsius)}"
                    if selected
                    else "本地历史档案中没有该月份样本"
                ),
            )
        ]
        evidence.extend(monthly_evidence)
        tool_calls.append(
            _tool_call(
                name="history.monthly",
                endpoint=f"{settings.api_prefix}/history/{params.date}/monthly",
                reason="回答某月份锋面活动和月度统计问题。",
                parameters=params,
                evidence_ids=[item.id for item in monthly_evidence],
            )
        )

    if can_run and history is not None and "show_multi_day_change" in structured.tasks:
        days = params.days or 3
        window_points = _multi_day_points(history.timeline, params.date, days)
        timeline_evidence = [
            AiEvidence(
                id="history-multi-day-change",
                source="tool:history.timeline",
                label="连续多日变化",
                value=f"{len(window_points)} 个日期",
                detail="；".join(
                    f"{point.date}: 锋面线 {point.front_line_pixels} 像元，"
                    f"SST {_format_temperature(point.sst_mean_celsius)}"
                    for point in window_points
                )
                or "本地历史档案中没有可展示的连续日期",
                source_files=sorted(
                    {source for point in window_points for source in point.source_files}
                ),
            )
        ]
        evidence.extend(timeline_evidence)
        tool_calls.append(
            _tool_call(
                name="history.timeline",
                endpoint=f"{settings.api_prefix}/history/{params.date}",
                reason="提取连续多日的锋面线像元和 SST 均值变化。",
                parameters=params,
                evidence_ids=[item.id for item in timeline_evidence],
            )
        )
        tracking_evidence = _front_tracking_evidence(
            params.date,
            params.longitude,
            params.latitude,
            params.radius_deg,
            days,
            raw_data_dir,
            cache_dir,
        )
        evidence.extend(tracking_evidence)
        tool_calls.append(
            _tool_call(
                name="front.tracking",
                endpoint=f"{settings.api_prefix}/front-tracking/{params.date}",
                reason="在连续日期窗口内追踪离查询点最近的锋面对象。",
                parameters=params,
                evidence_ids=[item.id for item in tracking_evidence],
            )
        )

    conclusions.extend(_build_conclusions(structured, evidence, history))
    recommendations = _build_recommendations(structured, history)
    answer = _compose_answer(structured, conclusions, recommendations, warnings)

    return AiAnalysisResponse(
        provider=settings.ai_provider,
        model=_model_name(),
        answer=answer,
        structured_task=structured,
        tool_calls=tool_calls,
        evidence=evidence,
        conclusions=conclusions,
        recommendations=recommendations,
        warnings=warnings,
    )


def parse_natural_language(
    request: AiAnalysisRequest,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> AiStructuredTask:
    if settings.ai_provider != "rules":
        local_task = _parse_with_local_model(request)
        if local_task is not None:
            return local_task
        rule_task = _parse_with_rules(request, raw_data_dir, cache_dir)
        rule_task.assumptions.append("本地模型不可用或返回无效 JSON，已回退到本地规则解析器。")
        return rule_task
    return _parse_with_rules(request, raw_data_dir, cache_dir)


def _parse_with_rules(
    request: AiAnalysisRequest,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> AiStructuredTask:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    text = request.message.strip()
    index = get_history_index(raw_data_dir, cache_dir)
    fallback_date = request.default_date
    if fallback_date is None and index.front_records:
        fallback_date = min(record.observation_date for record in index.front_records)

    parsed_date, date_assumption = _extract_date(text, fallback_date)
    longitude, lon_assumption = _extract_axis(text, _LON_PATTERNS, request.default_longitude, "经度")
    latitude, lat_assumption = _extract_axis(text, _LAT_PATTERNS, request.default_latitude, "纬度")
    radius_deg, radius_assumption = _extract_radius(text, request.default_radius_deg)
    month = _extract_month(text) or (parsed_date.month if parsed_date else None)
    days = _extract_days(text)
    tasks = _detect_tasks(text)
    missing = []
    if parsed_date is None:
        missing.append("date")
    if longitude is None:
        missing.append("longitude")
    if latitude is None:
        missing.append("latitude")
    if radius_deg is None:
        missing.append("radius_deg")
    assumptions = [
        item
        for item in [date_assumption, lon_assumption, lat_assumption, radius_assumption]
        if item
    ]
    return AiStructuredTask(
        intent=";".join(tasks),
        tasks=tasks,
        parameters=AiTaskParameters(
            date=parsed_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            month=month,
            days=days,
        ),
        assumptions=assumptions,
        missing_parameters=missing,
    )


def _parse_with_local_model(request: AiAnalysisRequest) -> AiStructuredTask | None:
    if not _supported_local_provider():
        return None
    prompt = _local_model_prompt(request)
    payload = _local_model_payload(prompt, max_tokens=512)
    http_request = Request(
        settings.local_llm_endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(http_request, timeout=settings.ai_timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, TimeoutError, ValueError, TypeError):
        return None
    raw_text = _extract_local_model_text(response_payload)
    if not raw_text:
        return None
    parsed = _extract_json_object(raw_text)
    if parsed is None:
        return None
    return _structured_task_from_model_payload(parsed, request)


def _local_model_payload(prompt: str, *, max_tokens: int) -> bytes:
    provider = settings.ai_provider.lower()
    if provider == "openai-compatible":
        payload = {
            "model": settings.local_llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": "你只输出 JSON，不输出 Markdown 或解释。",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
            "max_tokens": max_tokens,
        }
    elif provider in {"llamacpp", "llama.cpp"}:
        payload = {
            "prompt": prompt,
            "temperature": 0,
            "n_predict": max_tokens,
            "stream": False,
        }
    else:
        payload = {
            "model": settings.local_llm_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0, "num_predict": max_tokens},
        }
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _extract_local_model_text(response_payload: dict[str, object]) -> str | None:
    response_text = response_payload.get("response")
    if isinstance(response_text, str):
        return response_text
    content = response_payload.get("content")
    if isinstance(content, str):
        return content
    choices = response_payload.get("choices")
    if isinstance(choices, list) and choices:
        first_choice = choices[0]
        if isinstance(first_choice, dict):
            message = first_choice.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]
            if isinstance(first_choice.get("text"), str):
                return first_choice["text"]
    return None


def _local_model_health_payload() -> bytes:
    provider = settings.ai_provider.lower()
    if provider == "openai-compatible":
        payload = {
            "model": settings.local_llm_model,
            "messages": [{"role": "user", "content": "ping"}],
            "temperature": 0,
            "max_tokens": 1,
        }
    elif provider in {"llamacpp", "llama.cpp"}:
        payload = {"prompt": "ping", "temperature": 0, "n_predict": 1, "stream": False}
    else:
        payload = {
            "model": settings.local_llm_model,
            "prompt": "ping",
            "stream": False,
            "options": {"num_predict": 1},
        }
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _supported_local_provider() -> bool:
    return settings.ai_provider.lower() in {
        "ollama",
        "llamacpp",
        "llama.cpp",
        "openai-compatible",
    }


def _provider_hint() -> str:
    provider = settings.ai_provider.lower()
    if provider == "openai-compatible":
        return "OpenAI-compatible /v1/chat/completions"
    if provider in {"llamacpp", "llama.cpp"}:
        return "llama.cpp server /completion"
    return "Ollama /api/generate"


def _local_model_prompt(request: AiAnalysisRequest) -> str:
    defaults = {
        "date": request.default_date.isoformat() if request.default_date else None,
        "longitude": request.default_longitude,
        "latitude": request.default_latitude,
        "radius_deg": request.default_radius_deg,
    }
    return (
        "你是一个离线海洋锋面分析系统的任务解析器。"
        "只输出 JSON，不输出解释。"
        "允许的 tasks 为："
        + ", ".join(SUPPORTED_TASKS)
        + "。JSON 格式："
        '{"intent":"...","tasks":["..."],"parameters":{"date":"YYYY-MM-DD",'
        '"longitude":124.5,"latitude":30.2,"radius_deg":1,"month":8,"days":3},'
        '"assumptions":[],"missing_parameters":[]}'
        f"。默认上下文：{json.dumps(defaults, ensure_ascii=False)}。"
        f"用户输入：{request.message}"
    )


def _extract_json_object(text: str) -> dict[str, object] | None:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        stripped = stripped.replace("json", "", 1).strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        payload = json.loads(stripped[start : end + 1])
    except (ValueError, TypeError):
        return None
    return payload if isinstance(payload, dict) else None


def _structured_task_from_model_payload(
    payload: dict[str, object],
    request: AiAnalysisRequest,
) -> AiStructuredTask | None:
    raw_tasks = payload.get("tasks")
    tasks = [task for task in raw_tasks if task in SUPPORTED_TASKS] if isinstance(raw_tasks, list) else []
    if not tasks:
        tasks = _detect_tasks(request.message)
    parameters = payload.get("parameters") if isinstance(payload.get("parameters"), dict) else {}
    parameters = dict(parameters)
    if parameters.get("date") in (None, "") and request.default_date is not None:
        parameters["date"] = request.default_date.isoformat()
    if parameters.get("longitude") in (None, "") and request.default_longitude is not None:
        parameters["longitude"] = request.default_longitude
    if parameters.get("latitude") in (None, "") and request.default_latitude is not None:
        parameters["latitude"] = request.default_latitude
    if parameters.get("radius_deg") in (None, "") and request.default_radius_deg is not None:
        parameters["radius_deg"] = request.default_radius_deg
    if parameters.get("month") in (None, "") and parameters.get("date"):
        try:
            parameters["month"] = date.fromisoformat(str(parameters["date"])).month
        except ValueError:
            pass
    missing = [
        field
        for field in ("date", "longitude", "latitude", "radius_deg")
        if parameters.get(field) in (None, "")
    ]
    assumptions = payload.get("assumptions") if isinstance(payload.get("assumptions"), list) else []
    assumptions = [str(item) for item in assumptions]
    assumptions.append("结构化任务由本地小模型生成，并由后端进行字段校验。")
    try:
        return AiStructuredTask(
            intent=str(payload.get("intent") or ";".join(tasks)),
            tasks=tasks,
            parameters=AiTaskParameters.model_validate(parameters),
            assumptions=assumptions,
            missing_parameters=missing,
        )
    except (ValueError, TypeError):
        return None


def _model_name() -> str:
    if settings.ai_provider == "rules":
        return "deterministic-offline-parser"
    return settings.local_llm_model


def _local_model_status() -> tuple[bool, str]:
    if settings.ai_provider == "rules":
        return True, "rules 模式无需外部模型服务。"
    if not _supported_local_provider():
        return False, f"暂不支持 provider={settings.ai_provider}；支持 ollama、llamacpp、openai-compatible。"
    payload = _local_model_health_payload()
    request = Request(
        settings.local_llm_endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.ai_timeout_seconds) as response:
            if 200 <= response.status < 300:
                return True, f"本地模型服务可用（{_provider_hint()}）。"
            return False, f"本地模型服务返回 HTTP {response.status}。"
    except (OSError, URLError, TimeoutError) as exc:
        return False, f"本地模型服务不可用：{exc}"


def _extract_date(text: str, fallback: date | None) -> tuple[date | None, str | None]:
    match = _ISO_DATE_PATTERN.search(text)
    if match:
        return _safe_date(match.group("year"), match.group("month"), match.group("day")), None
    match = _CN_DATE_PATTERN.search(text)
    if match:
        year = match.group("year")
        assumption = None
        if year is None:
            if fallback is None:
                return None, None
            year = str(fallback.year)
            assumption = f"自然语言只给出月日，年份沿用 {fallback.year}。"
        return _safe_date(year, match.group("month"), match.group("day")), assumption
    if fallback is None:
        return None, None
    return fallback, f"未在自然语言中识别出日期，沿用界面默认日期 {fallback.isoformat()}。"


def _safe_date(year: str, month: str, day: str) -> date | None:
    try:
        return date(int(year), int(month), int(day))
    except ValueError:
        return None


def _extract_axis(
    text: str,
    patterns: tuple[tuple[re.Pattern[str], int], ...],
    fallback: float | None,
    axis_name: str,
) -> tuple[float | None, str | None]:
    for pattern, sign in patterns:
        match = pattern.search(text)
        if match:
            value = sign * abs(float(match.group("value")))
            return round(value, 6), None
    if fallback is None:
        return None, None
    return fallback, f"未在自然语言中识别出{axis_name}，沿用界面当前{axis_name} {fallback}。"


def _extract_radius(text: str, fallback: float | None) -> tuple[float | None, str | None]:
    match = _RADIUS_KM_PATTERN.search(text)
    if match:
        return round(float(match.group("value")) / 111.195, 6), "空间范围由公里近似换算为纬度度数。"
    matches = list(_RADIUS_DEG_PATTERN.finditer(text))
    if matches:
        return round(float(matches[-1].group("value")), 6), None
    if fallback is None:
        return None, None
    return fallback, f"未在自然语言中识别出空间范围，沿用界面当前范围 {fallback}°。"


def _extract_days(text: str) -> int | None:
    for pattern in _DAYS_PATTERNS:
        match = pattern.search(text)
        if match:
            return max(1, min(31, int(match.group("value"))))
    return None


def _extract_month(text: str) -> int | None:
    match = _MONTH_PATTERN.search(text)
    if match:
        return int(match.group("month"))
    return None


def _detect_tasks(text: str) -> list[str]:
    tasks: list[str] = []
    if any(keyword in text for keyword in ("当前", "某日", "锋面", "冷暖", "海温", "水温", "距离")):
        tasks.append("show_current_front")
    if any(keyword in text for keyword in ("历史", "概率", "同期", "发生")):
        tasks.append("calculate_historical_probability")
    if any(keyword in text for keyword in ("月份", "月度", "每月", "活动")) or _MONTH_PATTERN.search(text):
        tasks.append("query_monthly_activity")
    if any(keyword in text for keyword in ("修改范围", "扩大范围", "缩小范围", "空间范围")):
        tasks.append("change_spatial_range")
    if any(keyword in text for keyword in ("连续", "多日", "变化", "趋势", "前后", "追踪", "跟踪")):
        tasks.append("show_multi_day_change")
    if any(keyword in text for keyword in ("解释", "说明", "总结", "为什么")):
        tasks.append("explain_statistics")
    if not tasks:
        tasks = [
            "show_current_front",
            "calculate_historical_probability",
            "explain_statistics",
        ]
    ordered = [task for task in SUPPORTED_TASKS if task in tasks]
    return ordered


def _knowledge_evidence(entries: list[KnowledgeEntry]) -> list[AiEvidence]:
    selected_ids = {"front-code-semantics", "probability-rule", "evidence-boundary"}
    evidence: list[AiEvidence] = []
    for entry in entries:
        if entry.id not in selected_ids:
            continue
        evidence.append(
            AiEvidence(
                id=f"knowledge-{entry.id}",
                source="local-knowledge-base",
                label=entry.title,
                value=entry.id,
                detail=entry.content,
                source_files=[str(entry.source_file)],
            )
        )
    return evidence


def _structured_task_evidence(structured: AiStructuredTask) -> AiEvidence:
    params = structured.parameters
    query_parts = [
        f"date={params.date.isoformat() if params.date else '--'}",
        f"longitude={params.longitude if params.longitude is not None else '--'}",
        f"latitude={params.latitude if params.latitude is not None else '--'}",
        f"radius_deg={params.radius_deg if params.radius_deg is not None else '--'}",
        f"month={params.month if params.month is not None else '--'}",
        f"days={params.days if params.days is not None else '--'}",
    ]
    assumptions = "；".join(structured.assumptions) if structured.assumptions else "无显式假设"
    missing = "、".join(structured.missing_parameters) if structured.missing_parameters else "无缺失参数"
    return AiEvidence(
        id="structured-task-parameters",
        source="ai:task-parser",
        label="结构化任务参数",
        value="; ".join(query_parts),
        detail=f"任务：{', '.join(structured.tasks)}；假设：{assumptions}；缺失：{missing}",
    )


def _current_front_evidence(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path,
    cache_dir: Path,
) -> list[AiEvidence]:
    index = get_history_index(raw_data_dir, cache_dir)
    front_record = match_front_record(list(index.front_records), observation_date)
    sst_record = match_sst_record(list(index.sst_records), observation_date)
    if front_record is None:
        return [
            AiEvidence(
                id="current-front-missing",
                source="tool:analysis.current_front",
                label="当前锋面",
                value="缺少 front 文件",
                detail=f"本地数据中未找到 {observation_date} 的锋面文件。",
            )
        ]
    source_files = [front_record.path.relative_to(raw_data_dir).as_posix()]
    front_var = load_front_subset(front_record.path, longitude, latitude, radius_deg)
    front_values = np.asarray(front_var.values)
    front_summary = summarize_front_window(front_values)
    point_class = "--"
    nearest_distance = None
    try:
        front_code = int(front_var.sel(lon=longitude, lat=latitude, method="nearest").item())
        point_class = _front_class(front_code)
        line_mask = np.isin(front_values, FRONT_LINE_CODES)
        if line_mask.any():
            line_lats, line_lons = np.meshgrid(front_var.lat.values, front_var.lon.values, indexing="ij")
            distances = (
                np.sqrt(
                    ((line_lons[line_mask] - longitude) * np.cos(np.deg2rad(latitude))) ** 2
                    + (line_lats[line_mask] - latitude) ** 2
                )
                * 111.195
            )
            nearest_distance = round(float(distances.min()), 3) if distances.size else None
    except (KeyError, IndexError, OSError, ValueError, TypeError):
        point_class = "--"

    sst_mean = None
    sst_center = None
    sst_range = None
    sst_gradient = None
    if sst_record is not None:
        source_files.append(sst_record.path.relative_to(raw_data_dir).as_posix())
        sst_var = load_sst_subset(sst_record.path, observation_date, longitude, latitude, radius_deg)
        if sst_var is not None:
            values = np.asarray(sst_var.values) - 273.15
            try:
                center_value = float(
                    sst_var.sel(longitude=longitude, latitude=latitude, method="nearest").item()
                    - 273.15
                )
                sst_center = round(center_value, 3) if np.isfinite(center_value) else None
            except (KeyError, IndexError, OSError, ValueError, TypeError):
                sst_center = None
            sst_summary = summarize_sst_window(
                values,
                sst_center,
                sst_var.longitude.values,
                sst_var.latitude.values,
                latitude,
            )
            sst_mean = sst_summary["mean"]
            sst_range = sst_summary["range_celsius"]
            sst_gradient = sst_summary["gradient_c_per_km"]

    return [
        AiEvidence(
            id="current-front-summary",
            source="tool:analysis.current_front",
            label="当前锋面像元",
            value=f"{front_summary['line_pixels']} 个锋面线像元",
            detail=(
                f"冷侧 {front_summary['cold_side_pixels']}，暖侧 {front_summary['warm_side_pixels']}，"
                f"状态：{front_summary['status']}"
            ),
            source_files=source_files,
        ),
        AiEvidence(
            id="current-temperature-structure",
            source="tool:analysis.current_front",
            label="局地温度结构",
            value=f"温差 {_format_temperature(sst_range)}",
            detail=(
                f"平均梯度 {_format_gradient(sst_gradient)}，局地 SST 均值 "
                f"{_format_temperature(sst_mean)}"
            ),
            source_files=source_files,
        ),
        AiEvidence(
            id="current-point-state",
            source="tool:analysis.current_front",
            label="查询点状态",
            value=point_class,
            detail=(
                f"中心点 SST {_format_temperature(sst_center)}，局地 SST 均值 "
                f"{_format_temperature(sst_mean)}，距最近锋面 "
                f"{_format_distance(nearest_distance)}"
            ),
            source_files=source_files,
        ),
    ]


def _front_object_evidence(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path,
    cache_dir: Path,
) -> list[AiEvidence]:
    try:
        response = compute_front_object_response(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            raw_data_dir=raw_data_dir,
            cache_dir=cache_dir,
        )
    except (FileNotFoundError, KeyError, ValueError, OSError) as exc:
        return [
            AiEvidence(
                id="front-object-summary",
                source="tool:front.objects",
                label="锋面对象识别",
                value="不可用",
                detail=f"对象识别失败：{exc}",
            )
        ]
    nearest = response.objects[0] if response.objects else None
    if nearest is None:
        detail = "当前查询窗口内没有可聚类的锋面线像元。"
    else:
        detail = (
            f"最近对象 {nearest.front_id}，质心 "
            f"{nearest.centroid_longitude:.3f}°E/{nearest.centroid_latitude:.3f}°N，"
            f"长度约 {nearest.length_km:.2f} km，距查询点 "
            f"{_format_distance(nearest.nearest_to_query_km)}。"
        )
    return [
        AiEvidence(
            id="front-object-summary",
            source="tool:front.objects",
            label="锋面对象识别",
            value=f"{response.object_count} 个对象",
            detail=detail,
            source_files=response.source_files,
        )
    ]


def _front_tracking_evidence(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    days: int,
    raw_data_dir: Path,
    cache_dir: Path,
) -> list[AiEvidence]:
    try:
        response = compute_front_tracking_response(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            days=days,
            raw_data_dir=raw_data_dir,
            cache_dir=cache_dir,
        )
    except (KeyError, ValueError, OSError) as exc:
        return [
            AiEvidence(
                id="front-tracking-summary",
                source="tool:front.tracking",
                label="锋面对象追踪",
                value="不可用",
                detail=f"追踪失败：{exc}",
            )
        ]
    details = []
    for step in response.steps:
        if step.front_id is None:
            details.append(f"{step.date}: {step.status}")
        else:
            details.append(
                f"{step.date}: {step.front_id}，长度 {_format_distance(step.length_km)}，"
                f"位移 {_format_distance(step.distance_from_previous_km)}，"
                f"匹配分数 {_format_probability(step.match_score)}，"
                f"方式 {step.matched_by}"
            )
    return [
        AiEvidence(
            id="front-tracking-summary",
            source="tool:front.tracking",
            label="连续锋面对象追踪",
            value=(
                f"{response.tracked_step_count}/{response.days} 日可追踪"
                if response.tracked_step_count
                else "无可追踪对象"
            ),
            detail="；".join(details) or response.status,
            source_files=response.source_files,
        )
    ]


def _front_class(front_code: int) -> str:
    classes = {
        -128: "无效或陆地",
        -20: "冷侧",
        20: "暖侧",
        -10: "锋面线",
        10: "锋面线",
        30: "锋面线",
        0: "非锋面",
    }
    return classes.get(front_code, f"未知编码 {front_code}")


def _tool_call(
    name: str,
    endpoint: str,
    reason: str,
    parameters: AiTaskParameters,
    evidence_ids: list[str],
    status: str = "ok",
) -> AiToolCallRecord:
    return AiToolCallRecord(
        name=name,
        endpoint=endpoint,
        status=status,
        reason=reason,
        parameters=parameters.model_dump(mode="json", exclude_none=True),
        evidence_ids=evidence_ids,
    )


def _multi_day_points(timeline: list[object], start_date: date, days: int) -> list[object]:
    end_date = start_date + timedelta(days=days - 1)
    points = [point for point in timeline if start_date <= point.date <= end_date]
    if points:
        return points
    return sorted(timeline, key=lambda item: item.date)[:days]


def _build_conclusions(
    structured: AiStructuredTask,
    evidence: list[AiEvidence],
    history: object | None,
) -> list[AiConclusion]:
    evidence_map = {item.id: item for item in evidence}
    conclusions: list[AiConclusion] = []
    current = evidence_map.get("current-front-summary")
    point = evidence_map.get("current-point-state")
    temperature = evidence_map.get("current-temperature-structure")
    if current and point:
        conclusions.append(
            AiConclusion(
                text=f"当前查询窗口内 {current.value}；查询点判定为{point.value}。",
                evidence_ids=[
                    current.id,
                    point.id,
                    "knowledge-front-code-semantics",
                ],
            )
        )
    if temperature:
        conclusions.append(
            AiConclusion(
                text=f"局地温度结构显示：{temperature.value}，{temperature.detail}。",
                evidence_ids=[temperature.id],
            )
        )
    front_object = evidence_map.get("front-object-summary")
    if front_object:
        conclusions.append(
            AiConclusion(
                text=f"锋面对象识别结果为 {front_object.value}；{front_object.detail}",
                evidence_ids=[front_object.id],
            )
        )
    same_period = evidence_map.get("history-same-period-probability")
    monthly = evidence_map.get("history-monthly-probability")
    sample_coverage = evidence_map.get("history-sample-coverage")
    if same_period:
        conclusions.append(
            AiConclusion(
                text=f"历史同期锋面发生概率为 {same_period.value}，计算依据是 {same_period.detail}。",
                evidence_ids=[same_period.id, "knowledge-probability-rule"],
            )
        )
    if sample_coverage:
        conclusions.append(
            AiConclusion(
                text=f"该历史概率当前属于{sample_coverage.value}：{sample_coverage.detail}",
                evidence_ids=[sample_coverage.id],
            )
        )
    if monthly:
        conclusions.append(
            AiConclusion(
                text=f"查询月份的锋面发生概率为 {monthly.value}，计算依据是 {monthly.detail}。",
                evidence_ids=[monthly.id, "knowledge-probability-rule"],
            )
        )
    selected_month = evidence_map.get("history-selected-month")
    if selected_month and selected_month.id not in {monthly.id if monthly else ""}:
        conclusions.append(
            AiConclusion(
                text=f"{selected_month.label}统计结果为 {selected_month.value}；{selected_month.detail}。",
                evidence_ids=[selected_month.id],
            )
        )
    multi_day = evidence_map.get("history-multi-day-change")
    if multi_day:
        conclusions.append(
            AiConclusion(
                text=f"连续多日视图已提取 {multi_day.value}：{multi_day.detail}",
                evidence_ids=[multi_day.id],
            )
        )
    tracking = evidence_map.get("front-tracking-summary")
    if tracking:
        conclusions.append(
            AiConclusion(
                text=f"对象追踪结果为 {tracking.value}；{tracking.detail}",
                evidence_ids=[tracking.id],
            )
        )
    if "change_spatial_range" in structured.tasks and structured.parameters.radius_deg is not None:
        conclusions.append(
            AiConclusion(
                text=f"空间范围已在结构化任务中设置为 {structured.parameters.radius_deg}°，后续工具调用按该范围裁剪。",
                evidence_ids=["structured-task-parameters"],
            )
        )
    if not conclusions and history is not None:
        conclusions.append(
            AiConclusion(
                text="已完成结构化任务解析，但当前本地样本不足以形成进一步统计结论。",
                evidence_ids=["knowledge-evidence-boundary"],
            )
        )
    return conclusions


def _build_recommendations(
    structured: AiStructuredTask,
    history: object | None,
) -> list[AiRecommendation]:
    params = structured.parameters
    recommendations: list[AiRecommendation] = []
    if history is not None and history.summary.sample_reliability_level in {"none", "low", "demo"}:
        recommendations.append(
            AiRecommendation(
                text=(
                    "当前历史概率仍属于"
                    f"{history.summary.sample_reliability_label}，建议继续补充跨年份同月同日样本后"
                    "再汇报完整历史概率。"
                ),
                action="expand_historical_samples",
                parameters=params,
            )
        )
    if "show_multi_day_change" not in structured.tasks:
        recommendations.append(
            AiRecommendation(
                text="建议查看连续多日变化，判断该锋面是否只是单日事件。",
                action="show_multi_day_change",
                parameters=AiTaskParameters(
                    date=params.date,
                    longitude=params.longitude,
                    latitude=params.latitude,
                    radius_deg=params.radius_deg,
                    days=3,
                ),
            )
        )
    if params.radius_deg is not None and params.radius_deg < 1:
        recommendations.append(
            AiRecommendation(
                text="可以扩大到 1° 范围复查，观察局地窗口变化对锋面概率的影响。",
                action="change_spatial_range",
                parameters=AiTaskParameters(
                    date=params.date,
                    longitude=params.longitude,
                    latitude=params.latitude,
                    radius_deg=1,
                    month=params.month,
                    days=params.days,
                ),
            )
        )
    return recommendations[:3]


def _compose_answer(
    structured: AiStructuredTask,
    conclusions: list[AiConclusion],
    recommendations: list[AiRecommendation],
    warnings: list[str],
) -> str:
    params = structured.parameters
    query = (
        f"{params.date}，经度 {params.longitude}，纬度 {params.latitude}，"
        f"范围 {params.radius_deg}°"
    )
    lines = [f"已将自然语言解析为结构化任务：{query}。"]
    lines.extend(conclusion.text for conclusion in conclusions)
    if recommendations:
        lines.append(f"下一步建议：{recommendations[0].text}")
    if warnings:
        lines.append(f"注意：{'；'.join(warnings)}")
    return "\n".join(lines)


def _format_probability(value: float | None) -> str:
    return "--" if value is None else f"{value * 100:.1f}%"


def _format_temperature(value: float | None) -> str:
    return "--" if value is None else f"{value:.2f} °C"


def _format_distance(value: float | None) -> str:
    return "--" if value is None else f"{value:.2f} km"


def _format_gradient(value: float | None) -> str:
    return "--" if value is None else f"{float(value):.5f} °C/km"
