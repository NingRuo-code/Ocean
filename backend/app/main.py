import hashlib
from datetime import date as date_type
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from .ai_agent import (
    analyze_request,
    capabilities_response,
    knowledge_response,
)
from .ai_agent import health_response as ai_health_response
from .config import settings
from .data_access import (
    load_front_subset,
    load_sst_subset,
    match_front_record,
    match_sst_record,
    summarize_sst_window,
)
from .data_index import build_sqlite_data_index, get_or_build_sqlite_data_index, lookup_indexed_date
from .data_inventory import build_data_manifest
from .data_preparation import build_data_preparation_plan
from .front_objects import compute_front_object_response, compute_front_tracking_response
from .history import (
    compute_history_local_response,
    compute_history_monthly_response,
    compute_history_probability_response,
    compute_history_response,
    describe_history_index,
    get_history_index,
)
from .main_analysis import compute_analysis_response
from .raster_render import render_combined_png, render_front_png, render_sst_png
from .reporting import compute_report_response
from .schemas import (
    AiAnalysisRequest,
    AiAnalysisResponse,
    AiCapabilitiesResponse,
    AiHealthResponse,
    AiKnowledgeResponse,
    AnalysisResponse,
    CatalogFile,
    CatalogResponse,
    DataIndexDateResponse,
    DataIndexResponse,
    DataManifestResponse,
    DataPreparationPlanResponse,
    FrontObjectResponse,
    FrontTrackingResponse,
    HealthResponse,
    HistoryIndexResponse,
    HistoryLocalResponse,
    HistoryMonthlyResponse,
    HistoryProbabilityResponse,
    HistoryResponse,
    PointQueryResponse,
    ReportResponse,
    SeriesPoint,
    SeriesResponse,
)

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _query_bounds(longitude: float, latitude: float, radius_deg: float) -> list[float]:
    return [
        round(longitude - radius_deg, 6),
        round(latitude - radius_deg, 6),
        round(longitude + radius_deg, 6),
        round(latitude + radius_deg, 6),
    ]


def _raster_cache_path(
    cache_dir: Path,
    *,
    fingerprint: str,
    observation_date: date_type,
    longitude: float,
    latitude: float,
    radius_deg: float,
    kind: str,
) -> Path:
    digest = hashlib.sha1()
    digest.update(fingerprint.encode("utf-8"))
    digest.update(observation_date.isoformat().encode("utf-8"))
    digest.update(f"{longitude:.6f}".encode())
    digest.update(f"{latitude:.6f}".encode())
    digest.update(f"{radius_deg:.6f}".encode())
    digest.update(kind.encode("utf-8"))
    return cache_dir / "rasters" / f"{digest.hexdigest()}.png"


@app.get(f"{settings.api_prefix}/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service=settings.app_name, offline=True)


@app.get(f"{settings.api_prefix}/ai/capabilities", response_model=AiCapabilitiesResponse)
def ai_capabilities() -> AiCapabilitiesResponse:
    return capabilities_response()


@app.get(f"{settings.api_prefix}/ai/health", response_model=AiHealthResponse)
def ai_health() -> AiHealthResponse:
    return ai_health_response()


@app.get(f"{settings.api_prefix}/ai/knowledge", response_model=AiKnowledgeResponse)
def ai_knowledge() -> AiKnowledgeResponse:
    return knowledge_response()


@app.post(f"{settings.api_prefix}/ai/analyze", response_model=AiAnalysisResponse)
def ai_analyze(request: AiAnalysisRequest) -> AiAnalysisResponse:
    return analyze_request(
        request,
        raw_data_dir=settings.raw_data_dir,
        cache_dir=settings.cache_dir,
    )


@app.get(f"{settings.api_prefix}/data/manifest", response_model=DataManifestResponse)
def data_manifest() -> DataManifestResponse:
    return build_data_manifest(
        raw_data_dir=settings.raw_data_dir,
        processed_dir=settings.raw_data_dir.parent / "processed",
    )


@app.get(f"{settings.api_prefix}/data/index", response_model=DataIndexResponse)
def data_index() -> DataIndexResponse:
    return get_or_build_sqlite_data_index(
        raw_data_dir=settings.raw_data_dir,
        processed_dir=settings.raw_data_dir.parent / "processed",
    )


@app.post(f"{settings.api_prefix}/data/index/rebuild", response_model=DataIndexResponse)
def rebuild_data_index() -> DataIndexResponse:
    return build_sqlite_data_index(
        raw_data_dir=settings.raw_data_dir,
        processed_dir=settings.raw_data_dir.parent / "processed",
    )


@app.get(f"{settings.api_prefix}/data/index/{{observation_date}}", response_model=DataIndexDateResponse)
def data_index_date(observation_date: date_type) -> DataIndexDateResponse:
    return lookup_indexed_date(
        raw_data_dir=settings.raw_data_dir,
        processed_dir=settings.raw_data_dir.parent / "processed",
        observation_date=observation_date,
    )


@app.get(f"{settings.api_prefix}/data/plan", response_model=DataPreparationPlanResponse)
def data_preparation_plan(
    reference_date: date_type | None = None,
    target_days: int = Query(14, ge=1, le=60),
    historical_year_start: int = Query(1982, ge=1900, le=2100),
    historical_year_end: int = Query(2024, ge=1900, le=2100),
    historical_window_days: int = Query(3, ge=1, le=31),
) -> DataPreparationPlanResponse:
    return build_data_preparation_plan(
        raw_data_dir=settings.raw_data_dir,
        processed_dir=settings.raw_data_dir.parent / "processed",
        reference_date=reference_date,
        target_days=target_days,
        historical_year_start=historical_year_start,
        historical_year_end=historical_year_end,
        historical_window_days=historical_window_days,
    )


@app.get(f"{settings.api_prefix}/catalog", response_model=CatalogResponse)
def catalog() -> CatalogResponse:
    from .catalog import discover_netcdf_files

    discovered = discover_netcdf_files(settings.raw_data_dir)
    dates = sorted({item.observation_date for item in discovered if item.observation_date})
    ready = bool(discovered)
    return CatalogResponse(
        dataset=settings.dataset_id,
        version=settings.dataset_version,
        ready=ready,
        file_count=len(discovered),
        available_dates=dates,
        files=[
            CatalogFile(
                name=item.path.relative_to(settings.raw_data_dir).as_posix(),
                date=item.observation_date,
                size_bytes=item.path.stat().st_size,
            )
            for item in discovered
        ],
        message=None if ready else "请将真实逐日 NetCDF 样例放入 data/raw 目录。",
    )


@app.get(f"{settings.api_prefix}/analysis/{{observation_date}}", response_model=AnalysisResponse)
def analysis(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> AnalysisResponse:
    try:
        return compute_analysis_response(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            raw_data_dir=settings.raw_data_dir,
            cache_dir=settings.cache_dir,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (KeyError, ValueError, OSError) as exc:
        raise HTTPException(status_code=422, detail=f"数据读取失败: {exc}") from exc


@app.get(f"{settings.api_prefix}/analysis/{{observation_date}}/raster")
def analysis_raster(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
    kind: str = Query("combined", pattern="^(sst|front|combined)$"),
) -> Response:
    index = get_history_index(settings.raw_data_dir, settings.cache_dir)
    cache_path = _raster_cache_path(
        settings.cache_dir,
        fingerprint=index.fingerprint,
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        kind=kind,
    )
    if cache_path.is_file():
        return Response(
            content=cache_path.read_bytes(),
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-Raster-Bounds": ",".join(str(value) for value in _query_bounds(longitude, latitude, radius_deg)),
                "X-Raster-Cache": "hit",
                "X-Raster-Kind": kind,
            },
        )
    front_record = match_front_record(list(index.front_records), observation_date)
    sst_record = match_sst_record(list(index.sst_records), observation_date)
    if front_record is None:
        raise HTTPException(status_code=404, detail=f"未找到 {observation_date} 的锋面文件")
    if sst_record is None:
        raise HTTPException(status_code=404, detail="未找到 SST 文件")
    try:
        front_var = load_front_subset(front_record.path, longitude, latitude, radius_deg)
        front = np.asarray(front_var.values)
        sst_var = load_sst_subset(sst_record.path, observation_date, longitude, latitude, radius_deg)
        if sst_var is None:
            raise HTTPException(status_code=404, detail=f"SST 文件不包含 {observation_date} 的数据")
        sst_celsius = np.asarray(sst_var.values) - 273.15
    except (KeyError, ValueError, OSError) as exc:
        raise HTTPException(status_code=422, detail=f"栅格图像生成失败: {exc}") from exc

    if kind == "sst":
        content = render_sst_png(sst_celsius)
    elif kind == "front":
        content = render_front_png(front)
    else:
        content = render_combined_png(sst_celsius, front)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(content)
    bounds = _query_bounds(longitude, latitude, radius_deg)
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Raster-Bounds": ",".join(str(value) for value in bounds),
            "X-Raster-Cache": "miss",
            "X-Raster-Kind": kind,
        },
    )


@app.get(f"{settings.api_prefix}/front-objects/{{observation_date}}", response_model=FrontObjectResponse)
def front_objects(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> FrontObjectResponse:
    try:
        return compute_front_object_response(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            raw_data_dir=settings.raw_data_dir,
            cache_dir=settings.cache_dir,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (KeyError, ValueError, OSError) as exc:
        raise HTTPException(status_code=422, detail=f"锋面对象识别失败: {exc}") from exc


@app.get(f"{settings.api_prefix}/front-tracking/{{observation_date}}", response_model=FrontTrackingResponse)
def front_tracking(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
    days: int = Query(3, ge=1, le=31),
    match_distance_km: float = Query(80.0, ge=1, le=500),
) -> FrontTrackingResponse:
    try:
        return compute_front_tracking_response(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            days=days,
            match_distance_km=match_distance_km,
            raw_data_dir=settings.raw_data_dir,
            cache_dir=settings.cache_dir,
        )
    except (KeyError, ValueError, OSError) as exc:
        raise HTTPException(status_code=422, detail=f"锋面追踪失败: {exc}") from exc


@app.get(f"{settings.api_prefix}/report/{{observation_date}}", response_model=ReportResponse)
def report(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
    days: int = Query(3, ge=1, le=31),
) -> ReportResponse:
    try:
        return compute_report_response(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            days=days,
            raw_data_dir=settings.raw_data_dir,
            cache_dir=settings.cache_dir,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (KeyError, ValueError, OSError) as exc:
        raise HTTPException(status_code=422, detail=f"报告生成失败: {exc}") from exc


@app.get(f"{settings.api_prefix}/series", response_model=SeriesResponse)
def series(
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> SeriesResponse:
    index = get_history_index(settings.raw_data_dir, settings.cache_dir)
    points: list[SeriesPoint] = []
    for front_record in index.front_records:
        sst_record = match_sst_record(list(index.sst_records), front_record.observation_date)
        if sst_record is None:
            continue
        try:
            front_var = load_front_subset(front_record.path, longitude, latitude, radius_deg)
            front = np.asarray(front_var.values)
            sst_var = load_sst_subset(sst_record.path, front_record.observation_date, longitude, latitude, radius_deg)
            if sst_var is None:
                continue
            sst = np.asarray(sst_var.values) - 273.15
        except (KeyError, ValueError, OSError):
            continue
        valid = sst[np.isfinite(sst)]
        valid_front = front[front != -128]
        points.append(
            SeriesPoint(
                date=front_record.observation_date,
                sst_mean=round(float(valid.mean()), 3) if valid.size else None,
                front_line_pixels=int(np.isin(valid_front, [-10, 10, 30]).sum()),
            )
        )
    return SeriesResponse(longitude=longitude, latitude=latitude, radius_deg=radius_deg, points=points)


@app.get(f"{settings.api_prefix}/point/{{observation_date}}", response_model=PointQueryResponse)
def point_query(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
) -> PointQueryResponse:
    index = get_history_index(settings.raw_data_dir, settings.cache_dir)
    front_record = match_front_record(list(index.front_records), observation_date)
    sst_record = match_sst_record(list(index.sst_records), observation_date)
    if front_record is None or sst_record is None:
        raise HTTPException(status_code=404, detail="指定日期缺少锋面或 SST 文件")
    front_var = load_front_subset(front_record.path, longitude, latitude, 2)
    front_code = int(front_var.sel(lon=longitude, lat=latitude, method="nearest").item())
    line = front_var.where(front_var.isin([-10, 10, 30]), drop=True)
    if line.size:
        line_lats, line_lons = np.meshgrid(line.lat.values, line.lon.values, indexing="ij")
        valid = np.isfinite(line.values)
        distance = np.sqrt(((line_lons[valid] - longitude) * np.cos(np.deg2rad(latitude))) ** 2 + (line_lats[valid] - latitude) ** 2) * 111.195
        nearest_distance = round(float(distance.min()), 3) if distance.size else None
    else:
        nearest_distance = None
    sst_var = load_sst_subset(sst_record.path, observation_date, longitude, latitude, 0.5)
    if sst_var is None:
        raise HTTPException(status_code=404, detail=f"SST 文件不包含 {observation_date} 的数据")
    sst_values = np.asarray(sst_var.values) - 273.15
    sst_stats = summarize_sst_window(
        sst_values,
        None,
        sst_var.longitude.values,
        sst_var.latitude.values,
        latitude,
    )
    sst_value = float(sst_var.sel(longitude=longitude, latitude=latitude, method="nearest").item() - 273.15)
    classes = {-128: "无效或陆地", -20: "冷侧", 20: "暖侧", -10: "锋面线", 10: "锋面线", 30: "锋面线", 0: "非锋面"}
    return PointQueryResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        sst_celsius=round(sst_value, 3) if np.isfinite(sst_value) else None,
        front_code=front_code,
        front_class=classes.get(front_code, "未知编码"),
        nearest_front_distance_km=nearest_distance,
        temperature_range_celsius=sst_stats["range_celsius"],
        temperature_gradient_c_per_km=sst_stats["gradient_c_per_km"],
        source_files=[
            str(front_record.path.relative_to(settings.raw_data_dir)),
            str(sst_record.path.relative_to(settings.raw_data_dir)),
        ],
    )


@app.get(f"{settings.api_prefix}/history/index", response_model=HistoryIndexResponse)
def history_index(
    longitude: float | None = Query(None, ge=-180, le=180),
    latitude: float | None = Query(None, ge=-90, le=90),
    radius_deg: float | None = Query(None, gt=0, le=10),
) -> HistoryIndexResponse:
    return describe_history_index(
        raw_data_dir=settings.raw_data_dir,
        cache_dir=settings.cache_dir,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
    )


@app.get(f"{settings.api_prefix}/history/{{observation_date}}", response_model=HistoryResponse)
def history(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> HistoryResponse:
    return compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=settings.raw_data_dir,
        cache_dir=settings.cache_dir,
    )


@app.get(
    f"{settings.api_prefix}/history/{{observation_date}}/probability",
    response_model=HistoryProbabilityResponse,
)
def history_probability(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> HistoryProbabilityResponse:
    return compute_history_probability_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=settings.raw_data_dir,
        cache_dir=settings.cache_dir,
    )


@app.get(
    f"{settings.api_prefix}/history/{{observation_date}}/monthly",
    response_model=HistoryMonthlyResponse,
)
def history_monthly(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> HistoryMonthlyResponse:
    return compute_history_monthly_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=settings.raw_data_dir,
        cache_dir=settings.cache_dir,
    )


@app.get(
    f"{settings.api_prefix}/history/{{observation_date}}/local-records",
    response_model=HistoryLocalResponse,
)
def history_local_records(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
    radius_deg: float = Query(1.0, gt=0, le=10),
) -> HistoryLocalResponse:
    return compute_history_local_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=settings.raw_data_dir,
        cache_dir=settings.cache_dir,
    )
