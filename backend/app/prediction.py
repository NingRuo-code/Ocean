from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np

from .config import settings
from .history import DEFAULT_PROBABILITY_RULE, compute_history_response
from .schemas import (
    FrontPredictionEvaluationPoint,
    FrontPredictionEvaluationResponse,
    FrontPredictionPoint,
    FrontPredictionResponse,
    HistoryResponse,
    PredictionDriver,
)


def compute_front_prediction_response(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    horizon_days: int = 7,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
    probability_rule: str = DEFAULT_PROBABILITY_RULE,
    min_line_density_per_1000: float = 1.0,
    max_front_distance_km: float = 50.0,
) -> FrontPredictionResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    bounded_horizon = max(1, min(14, horizon_days))
    history = compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
        probability_rule=probability_rule,
        min_line_density_per_1000=min_line_density_per_1000,
        max_front_distance_km=max_front_distance_km,
    )
    timeline = sorted(history.timeline, key=lambda item: item.date)
    predictions, source_files = _build_prediction_points(
        history=history,
        observation_date=observation_date,
        horizon_days=bounded_horizon,
    )

    return FrontPredictionResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        horizon_days=bounded_horizon,
        generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
        training_sample_count=len(timeline),
        sample_reliability_label=history.summary.sample_reliability_label,
        forecast_count=len(predictions),
        predictions=predictions,
        explanation=[
            "这是透明 baseline：用历史同月同日、当月 climatology、最近几日状态和局地 SST 梯度做加权估计。",
            "它适合做阶段演示和未来模型对照，不应被表述为论文级预测模型。",
            "如果目标日期已有本地观测，observed_* 字段会给出回测参考；否则只输出预测概率。",
            "后续可把该接口替换或扩展为机器学习模型，同时保留当前 baseline 作为可解释对照组。",
        ],
        source_files=sorted(source_files),
    )


def compute_front_prediction_evaluation_response(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    horizon_days: int = 7,
    max_anchor_dates: int = 30,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
    probability_rule: str = DEFAULT_PROBABILITY_RULE,
    min_line_density_per_1000: float = 1.0,
    max_front_distance_km: float = 50.0,
) -> FrontPredictionEvaluationResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    bounded_horizon = max(1, min(14, horizon_days))
    bounded_anchor_count = max(1, min(120, max_anchor_dates))
    history = compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
        probability_rule=probability_rule,
        min_line_density_per_1000=min_line_density_per_1000,
        max_front_distance_km=max_front_distance_km,
    )
    timeline = sorted(history.timeline, key=lambda item: item.date)
    observed_dates = {item.date for item in timeline}
    candidate_anchors = [
        item.date
        for item in timeline
        if item.date <= observation_date
        and any(item.date + timedelta(days=offset) in observed_dates for offset in range(1, bounded_horizon + 1))
    ]
    candidate_anchors = candidate_anchors[-bounded_anchor_count:]
    points: list[FrontPredictionEvaluationPoint] = []
    source_files: set[str] = set(history.source_files)
    for anchor_date in candidate_anchors:
        predictions, prediction_sources = _build_prediction_points(
            history=history,
            observation_date=anchor_date,
            horizon_days=bounded_horizon,
        )
        source_files.update(prediction_sources)
        for predicted in predictions:
            if predicted.probability is None or predicted.observed_front_present is None:
                continue
            observed_value = 1.0 if predicted.observed_front_present else 0.0
            error = round(float(predicted.probability - observed_value), 4)
            points.append(
                FrontPredictionEvaluationPoint(
                    anchor_date=anchor_date,
                    target_date=predicted.target_date,
                    horizon_day=predicted.horizon_day,
                    probability=predicted.probability,
                    predicted_present=predicted.probability >= 0.5,
                    observed_front_present=predicted.observed_front_present,
                    observed_front_line_pixels=predicted.observed_front_line_pixels or 0,
                    error=error,
                    squared_error=round(float(error * error), 6),
                    confidence_label=predicted.confidence_label,
                )
            )

    evaluated_count = len(points)
    correct_count = sum(1 for item in points if item.predicted_present == item.observed_front_present)
    absolute_errors = [abs(item.error) for item in points]
    squared_errors = [item.squared_error for item in points]
    positive_count = sum(1 for item in points if item.observed_front_present)
    negative_count = evaluated_count - positive_count
    return FrontPredictionEvaluationResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        horizon_days=bounded_horizon,
        generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
        evaluated_count=evaluated_count,
        candidate_anchor_count=len(candidate_anchors),
        accuracy=round(correct_count / evaluated_count, 4) if evaluated_count else None,
        brier_score=round(float(np.mean(squared_errors)), 6) if squared_errors else None,
        mean_absolute_error=round(float(np.mean(absolute_errors)), 4) if absolute_errors else None,
        positive_count=positive_count,
        negative_count=negative_count,
        notes=[
            "这是本地样本内回测，用于检查 baseline 方向性和评估链路，不代表严格留出集评估。",
            "predicted_present 使用 probability >= 0.5 作为默认分类阈值。",
            "Brier Score 越低越好；它衡量概率预测与实际 0/1 观测之间的均方误差。",
            "后续若补齐更多年份，可按年份留出或滚动窗口改造成更严格的评估。",
        ],
        points=points,
        source_files=sorted(source_files),
    )


def _build_prediction_points(
    *,
    history: HistoryResponse,
    observation_date: date,
    horizon_days: int,
) -> tuple[list[FrontPredictionPoint], set[str]]:
    timeline = sorted(history.timeline, key=lambda item: item.date)
    predictions: list[FrontPredictionPoint] = []
    source_files: set[str] = set(history.source_files)
    recent_signal = _recent_front_signal(timeline, observation_date)
    gradient_adjustment = _gradient_adjustment(timeline, observation_date)

    for horizon_day in range(1, horizon_days + 1):
        target_date = observation_date + timedelta(days=horizon_day)
        same_period_points = [
            item
            for item in timeline
            if item.date.month == target_date.month and item.date.day == target_date.day
        ]
        same_period_sample_count = len(same_period_points)
        same_period_hit_count = sum(1 for item in same_period_points if item.front_present)
        same_period_probability = (
            round(same_period_hit_count / same_period_sample_count, 4)
            if same_period_sample_count
            else None
        )
        monthly_point = next((item for item in history.monthly if item.month == target_date.month), None)
        monthly_probability = monthly_point.probability if monthly_point is not None else None
        probability, drivers = _combine_prediction_drivers(
            same_period_probability=same_period_probability,
            same_period_sample_count=same_period_sample_count,
            monthly_probability=monthly_probability,
            recent_signal=recent_signal,
            gradient_adjustment=gradient_adjustment,
        )
        observed = next((item for item in timeline if item.date == target_date), None)
        if observed is not None:
            source_files.update(observed.source_files)
        predictions.append(
            FrontPredictionPoint(
                target_date=target_date,
                horizon_day=horizon_day,
                probability=probability,
                predicted_status=_predicted_status(probability),
                confidence_label=_prediction_confidence(
                    same_period_sample_count,
                    monthly_point.sample_count if monthly_point is not None else 0,
                    recent_signal,
                ),
                same_period_sample_count=same_period_sample_count,
                same_period_probability=same_period_probability,
                monthly_probability=monthly_probability,
                recent_signal=recent_signal,
                gradient_adjustment=gradient_adjustment,
                observed_front_present=observed.front_present if observed is not None else None,
                observed_front_line_pixels=observed.front_line_pixels if observed is not None else None,
                drivers=drivers,
                explanation=_prediction_explanation(
                    probability,
                    same_period_sample_count,
                    same_period_probability,
                    monthly_probability,
                    recent_signal,
                    gradient_adjustment,
                    observed.front_present if observed is not None else None,
                ),
            )
        )
    return predictions, source_files


def _combine_prediction_drivers(
    *,
    same_period_probability: float | None,
    same_period_sample_count: int,
    monthly_probability: float | None,
    recent_signal: float | None,
    gradient_adjustment: float,
) -> tuple[float | None, list[PredictionDriver]]:
    drivers: list[PredictionDriver] = []
    weighted_values: list[tuple[float, float]] = []

    if same_period_probability is not None:
        same_weight = 0.6 if same_period_sample_count >= 15 else 0.5 if same_period_sample_count >= 5 else 0.4
        weighted_values.append((same_period_probability, same_weight))
        drivers.append(
            PredictionDriver(
                name="历史同期概率",
                value=f"{same_period_probability * 100:.1f}%",
                weight=same_weight,
                note=f"来自 {same_period_sample_count} 个同月同日样本。",
            )
        )
    if monthly_probability is not None:
        monthly_weight = 0.25 if same_period_probability is not None else 0.65
        weighted_values.append((monthly_probability, monthly_weight))
        drivers.append(
            PredictionDriver(
                name="当月历史概率",
                value=f"{monthly_probability * 100:.1f}%",
                weight=monthly_weight,
                note="当同日样本不足时提供月份级 climatology。",
            )
        )
    if recent_signal is not None:
        recent_weight = 0.15 if same_period_probability is not None else 0.35
        weighted_values.append((recent_signal, recent_weight))
        drivers.append(
            PredictionDriver(
                name="近期锋面状态",
                value=f"{recent_signal * 100:.1f}%",
                weight=recent_weight,
                note="由查询日前最近可用日期的锋面出现状态估计。",
            )
        )
    if not weighted_values:
        return None, drivers

    total_weight = sum(weight for _, weight in weighted_values)
    probability = sum(value * weight for value, weight in weighted_values) / total_weight
    probability = min(1.0, max(0.0, probability + gradient_adjustment))
    drivers.append(
        PredictionDriver(
            name="局地梯度修正",
            value=f"{gradient_adjustment:+.2f}",
            weight=0.0,
            note="若当前梯度高于历史均值，小幅提高概率；低于历史均值则轻微下调。",
        )
    )
    return round(float(probability), 4), drivers


def _recent_front_signal(timeline: list[object], observation_date: date) -> float | None:
    recent = [
        item
        for item in timeline
        if item.date <= observation_date
        and item.date >= observation_date - timedelta(days=5)
    ]
    if not recent:
        current = next((item for item in timeline if item.date == observation_date), None)
        if current is None:
            return None
        return 1.0 if current.front_present else 0.0
    return round(float(np.mean([1.0 if item.front_present else 0.0 for item in recent])), 4)


def _gradient_adjustment(timeline: list[object], observation_date: date) -> float:
    current = next((item for item in timeline if item.date == observation_date), None)
    if current is None:
        return 0.0
    current_gradient = current.sst_gradient_c_per_km
    if current_gradient is None:
        return 0.0
    gradients = [
        item.sst_gradient_c_per_km
        for item in timeline
        if item.sst_gradient_c_per_km is not None
    ]
    if len(gradients) < 3:
        return 0.0
    mean_gradient = float(np.mean(gradients))
    if mean_gradient <= 0:
        return 0.0
    ratio = float(current_gradient) / mean_gradient
    if ratio >= 1.25:
        return 0.05
    if ratio <= 0.75:
        return -0.03
    return 0.0


def _predicted_status(probability: float | None) -> str:
    if probability is None:
        return "样本不足，暂不预测"
    if probability >= 0.65:
        return "较可能出现锋面"
    if probability >= 0.35:
        return "中等概率，需要结合实况复核"
    return "较可能无锋面"


def _prediction_confidence(
    same_period_sample_count: int,
    monthly_sample_count: int,
    recent_signal: float | None,
) -> str:
    if same_period_sample_count >= 30:
        return "较高"
    if same_period_sample_count >= 15:
        return "中等"
    if same_period_sample_count >= 5:
        return "演示级"
    if monthly_sample_count >= 20 or recent_signal is not None:
        return "低"
    return "样本不足"


def _prediction_explanation(
    probability: float | None,
    same_period_sample_count: int,
    same_period_probability: float | None,
    monthly_probability: float | None,
    recent_signal: float | None,
    gradient_adjustment: float,
    observed_front_present: bool | None,
) -> str:
    if probability is None:
        return "缺少同日、月度和近期信号，暂不生成预测概率。"
    parts = [
        f"预测概率 {probability * 100:.1f}%。",
        f"同期样本 {same_period_sample_count} 个。",
    ]
    if same_period_probability is not None:
        parts.append(f"同期概率 {same_period_probability * 100:.1f}%。")
    if monthly_probability is not None:
        parts.append(f"月度概率 {monthly_probability * 100:.1f}%。")
    if recent_signal is not None:
        parts.append(f"近期信号 {recent_signal * 100:.1f}%。")
    if gradient_adjustment:
        parts.append(f"梯度修正 {gradient_adjustment:+.2f}。")
    if observed_front_present is not None:
        parts.append(f"本地已有观测：{'命中锋面' if observed_front_present else '未命中锋面'}。")
    return "".join(parts)
