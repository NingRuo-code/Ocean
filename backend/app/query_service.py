from __future__ import annotations

from datetime import date as DateType
from math import isfinite
from pathlib import Path
from statistics import mean

from .history import compute_history_probability_response
from .schemas import (
    BasicQueryCoverage,
    BasicQueryEvidence,
    BasicQueryResponse,
    ViewportRequest,
    ViewportResponse,
)
from .viewport import build_cached_viewport

QUERY_SERVICE_VERSION = "basic-query-v2"


def _round(value: float | None, digits: int = 4) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _viewport_parameters(request: ViewportRequest) -> dict[str, object]:
    return {
        "date": request.date.isoformat(),
        "bbox": [float(value) for value in request.bbox],
        "step": request.step,
    }


def _viewport_source(viewport: ViewportResponse) -> dict[str, object]:
    return {
        "service": "viewport",
        "query_service_version": QUERY_SERVICE_VERSION,
        "viewport_source": viewport.meta.source,
        "viewport_cache": viewport.meta.cache.model_dump(mode="json"),
    }


def _coverage_from_viewport(viewport: ViewportResponse, status: str | None = None) -> BasicQueryCoverage:
    return BasicQueryCoverage(
        status=status or viewport.coverage.status,
        request_bbox=viewport.coverage.request_bbox,
        covered_bbox=viewport.coverage.covered_bbox,
        layers=viewport.coverage.layers.model_dump(mode="json", by_alias=True),
    )


def _source_files_from_viewport(viewport: ViewportResponse) -> list[str]:
    files: set[str] = set()
    fronts_source = viewport.layers.fronts.get("source")
    if isinstance(fronts_source, dict) and fronts_source.get("file"):
        files.add(str(fronts_source["file"]))
    sst_source = viewport.layers.sst.get("source")
    if isinstance(sst_source, dict) and sst_source.get("file"):
        files.add(str(sst_source["file"]))
    effort_source = viewport.layers.fishing_effort.get("source")
    if isinstance(effort_source, dict):
        for key in ("file", "artifact", "url"):
            if effort_source.get(key):
                files.add(str(effort_source[key]))
    return sorted(files)


def _fishing_cells(viewport: ViewportResponse) -> list[dict[str, object]]:
    cells = viewport.layers.fishing_effort.get("cells")
    return [cell for cell in cells if isinstance(cell, dict)] if isinstance(cells, list) else []


def _front_features(viewport: ViewportResponse) -> list[dict[str, object]]:
    features = viewport.layers.fronts.get("features")
    return [feature for feature in features if isinstance(feature, dict)] if isinstance(features, list) else []


def _sst_cells(viewport: ViewportResponse) -> list[dict[str, object]]:
    cells = viewport.layers.sst.get("cells")
    return [cell for cell in cells if isinstance(cell, dict)] if isinstance(cells, list) else []


def _layer_has_data(status: str) -> bool:
    return status in {"available", "partial"}


def _metric_count(items: list[object], status: str) -> int | None:
    return len(items) if _layer_has_data(status) else None


def _complete_values(cells: list[dict[str, object]], key: str) -> list[float] | None:
    values = [cell.get(key) for cell in cells]
    if not values or any(
        isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value)
        for value in values
    ):
        return None
    return [float(value) for value in values]


def _complete_total(cells: list[dict[str, object]], key: str) -> float | None:
    values = _complete_values(cells, key)
    total = sum(values) if values is not None else None
    return total if total is not None and isfinite(total) else None


def _enhanced_count(cells: list[dict[str, object]]) -> int | None:
    flags = [cell.get("enhanced") for cell in cells]
    return (
        sum(flag is True for flag in flags)
        if flags and all(isinstance(flag, bool) for flag in flags)
        else None
    )


def _format_hours(value: float | None) -> str:
    return "unavailable" if value is None else f"{value:.2f} fishing hours"


def build_current_state_query(
    request: ViewportRequest,
    cache_dir: Path,
    prototype_data_dir: Path,
) -> BasicQueryResponse:
    viewport = build_cached_viewport(request, cache_dir, prototype_data_dir)
    fronts = _front_features(viewport)
    sst_cells = _sst_cells(viewport)
    fishing_cells = _fishing_cells(viewport)
    layer_statuses = viewport.coverage.layers
    front_count = _metric_count(fronts, layer_statuses.fronts)
    sst_count = _metric_count(sst_cells, layer_statuses.sst)
    fishing_count = _metric_count(fishing_cells, layer_statuses.fishing_effort)
    total_hours = (
        _complete_total(fishing_cells, "hours")
        if _layer_has_data(layer_statuses.fishing_effort)
        else None
    )
    enhanced_count = (
        _enhanced_count(fishing_cells) if _layer_has_data(layer_statuses.fishing_effort) else None
    )
    source_files = _source_files_from_viewport(viewport)
    evidence = [
        BasicQueryEvidence(
            id="front-feature-count",
            label="front features",
            value="unavailable" if front_count is None else str(front_count),
            detail=(
                "Count of front features intersecting the requested viewport."
                if front_count is not None
                else "Front layer is empty or unavailable for this request; this is not a zero-front measurement."
            ),
            source_files=source_files,
        ),
        BasicQueryEvidence(
            id="sst-sample-count",
            label="SST samples",
            value="unavailable" if sst_count is None else str(sst_count),
            detail=(
                "Number of sampled SST cells returned in Celsius."
                if sst_count is not None
                else "SST layer is empty or unavailable for this request; this is not a zero-temperature measurement."
            ),
            source_files=source_files,
        ),
        BasicQueryEvidence(
            id="apparent-fishing-effort",
            label="apparent fishing effort",
            value=_format_hours(_round(total_hours, 2)),
            detail=(
                "Sum of returned apparent fishing-effort cells; this is not catch, yield, biomass, or revenue."
                if total_hours is not None
                else "Fishing-effort layer is empty or unavailable; missing coverage is not interpreted as 0 fishing hours."
            ),
            source_files=source_files,
        ),
    ]
    return BasicQueryResponse(
        kind="current_state",
        status=viewport.meta.status if viewport.meta.status != "invalid" else "unavailable",
        source=_viewport_source(viewport),
        parameters=_viewport_parameters(request),
        metrics={
            "front_feature_count": front_count,
            "sst_cell_count": sst_count,
            "fishing_effort_cell_count": fishing_count,
            "total_apparent_fishing_hours": _round(total_hours, 2),
            "enhanced_response_count": enhanced_count,
        },
        evidence=evidence,
        coverage=_coverage_from_viewport(viewport),
        caveats=[
            *viewport.caveats,
            "This endpoint summarizes deterministic viewport output for product queries; it does not call an AI model.",
        ],
    )


def _front_response_status(viewport: ViewportResponse) -> str:
    fishing_status = viewport.coverage.layers.fishing_effort
    if fishing_status == "available":
        return "partial" if viewport.meta.status == "partial" else "ok"
    if fishing_status == "partial":
        return "partial"
    return fishing_status


def build_front_response_query(
    request: ViewportRequest,
    cache_dir: Path,
    prototype_data_dir: Path,
) -> BasicQueryResponse:
    viewport = build_cached_viewport(request, cache_dir, prototype_data_dir)
    cells = _fishing_cells(viewport)
    status = _front_response_status(viewport)
    has_effort_data = _layer_has_data(viewport.coverage.layers.fishing_effort)
    total_post_hours = _complete_total(cells, "hours") if has_effort_data else None
    total_pre7_hours = _complete_total(cells, "pre7Hours") if has_effort_data else None
    total_control_hours = _complete_total(cells, "controlHours") if has_effort_data else None
    lifts = _complete_values(cells, "liftPercent") if has_effort_data else []
    buffer_km = (
        sorted(
            {
                float(cell["bufferKm"])
                for cell in cells
                if cell.get("bufferKm") is not None and float(cell["bufferKm"]) > 0
            }
        )
        if has_effort_data
        else []
    )
    response_record_count = len(cells) if has_effort_data else None
    enhanced_count = _enhanced_count(cells) if has_effort_data else None
    source_files = _source_files_from_viewport(viewport)
    evidence = [
        BasicQueryEvidence(
            id="front-response-records",
            label="response records",
            value="unavailable" if response_record_count is None else str(response_record_count),
            detail=(
                "Returned response records linked to front objects in the requested viewport."
                if response_record_count is not None
                else "Front-response records are empty or unavailable for this request; this is not a zero-response measurement."
            ),
            source_files=source_files,
        ),
        BasicQueryEvidence(
            id="post-window-effort",
            label="post-window apparent fishing effort",
            value=_format_hours(_round(total_post_hours, 2)),
            detail=(
                "Apparent fishing-effort hours after front events, not catch or guaranteed fishing success."
                if total_post_hours is not None
                else "Post-window apparent fishing effort is unavailable; missing coverage is not interpreted as 0 fishing hours."
            ),
            source_files=source_files,
        ),
        BasicQueryEvidence(
            id="control-effort",
            label="non-front control effort",
            value=_format_hours(_round(total_control_hours, 2)),
            detail=(
                "Control-region effort carried from the deterministic front-response artifact."
                if total_control_hours is not None
                else "Control-region effort is unavailable; missing coverage is not interpreted as 0 fishing hours."
            ),
            source_files=source_files,
        ),
    ]
    return BasicQueryResponse(
        kind="front_response",
        status=status,
        source=_viewport_source(viewport),
        parameters=_viewport_parameters(request),
        metrics={
            "response_record_count": response_record_count,
            "buffer_km": buffer_km,
            "post_window_apparent_fishing_hours": _round(total_post_hours, 2),
            "pre7_apparent_fishing_hours": _round(total_pre7_hours, 2),
            "non_front_control_hours": _round(total_control_hours, 2),
            "enhanced_response_count": enhanced_count,
            "mean_lift_percent": _round(mean(lifts), 2) if lifts else None,
        },
        evidence=evidence,
        coverage=_coverage_from_viewport(viewport, status=status),
        caveats=[
            *viewport.caveats,
            "Front-response output describes apparent fishing-effort response only; it must not be read as catch, yield, revenue, biomass, or guaranteed fishing success.",
            "This endpoint summarizes committed deterministic response artifacts and does not call an AI model.",
        ],
    )


def _history_status(sample_count: int, monthly_count: int, reliability_level: str) -> str:
    if sample_count == 0 and monthly_count == 0:
        return "unavailable"
    if reliability_level in {"none", "low", "demo"}:
        return "partial"
    return "ok"


def build_historical_comparison_query(
    *,
    observation_date: DateType,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path,
    cache_dir: Path,
) -> BasicQueryResponse:
    history = compute_history_probability_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    summary = history.summary
    status = _history_status(
        summary.same_period_sample_count,
        summary.monthly_sample_count,
        summary.sample_reliability_level,
    )
    source_files = sorted(
        {
            source
            for record in [*history.same_period_records, *history.monthly_records]
            for source in record.source_files
        }
    )
    probability = summary.same_period_probability
    monthly_probability = summary.monthly_probability
    evidence = [
        BasicQueryEvidence(
            id="same-period-probability",
            label="same-period front probability",
            value="unavailable" if probability is None else f"{probability * 100:.1f}%",
            detail=(
                f"{summary.same_period_front_hit_count}/"
                f"{summary.same_period_sample_count} same-period samples had front-line pixels."
            ),
            source_files=source_files,
        ),
        BasicQueryEvidence(
            id="monthly-probability",
            label="monthly front probability",
            value="unavailable" if monthly_probability is None else f"{monthly_probability * 100:.1f}%",
            detail=(
                f"{summary.monthly_front_hit_count}/"
                f"{summary.monthly_sample_count} monthly samples had front-line pixels."
            ),
            source_files=source_files,
        ),
        BasicQueryEvidence(
            id="sample-coverage",
            label="sample coverage",
            value=summary.sample_reliability_label,
            detail=summary.sample_coverage_note,
            source_files=source_files,
        ),
    ]
    return BasicQueryResponse(
        kind="historical_comparison",
        status=status,
        source={
            "service": "history.probability",
            "query_service_version": QUERY_SERVICE_VERSION,
            "cache": history.cache.model_dump(mode="json"),
        },
        parameters={
            "date": observation_date.isoformat(),
            "longitude": longitude,
            "latitude": latitude,
            "radius_deg": radius_deg,
        },
        metrics={
            "same_period_probability": probability,
            "same_period_sample_count": summary.same_period_sample_count,
            "same_period_expected_sample_count": summary.same_period_expected_sample_count,
            "same_period_coverage_ratio": summary.same_period_coverage_ratio,
            "monthly_probability": monthly_probability,
            "monthly_sample_count": summary.monthly_sample_count,
            "monthly_expected_sample_count": summary.monthly_expected_sample_count,
            "monthly_coverage_ratio": summary.monthly_coverage_ratio,
            "sample_reliability_level": summary.sample_reliability_level,
            "sample_reliability_label": summary.sample_reliability_label,
        },
        evidence=evidence,
        coverage=BasicQueryCoverage(
            status=status,
            sample_count=summary.same_period_sample_count,
            expected_sample_count=summary.same_period_expected_sample_count,
            coverage_ratio=summary.same_period_coverage_ratio,
        ),
        caveats=[
            *history.explanation,
            "Historical comparison is a deterministic sample statistic, not a forecast and not a confidence interval.",
            "This endpoint does not call an AI model.",
        ],
    )
