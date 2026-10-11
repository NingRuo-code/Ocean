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
from . import fishing_effort
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
from .frontend_payload import (
    FrontendPayloadUnavailable,
    WindowError,
    build_frontend_payload,
    parse_bbox,
)
from .history import (
    compute_history_local_response,
    compute_history_monthly_response,
    compute_history_probability_response,
    compute_history_response,
    describe_history_index,
    get_history_index,
)
from .main_analysis import compute_analysis_response
from .raster_render import (
    render_combined_png,
    render_fishing_png,
    render_front_png,
    render_sst_png,
    sst_scale,
)
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
    FishingAvailabilityResponse,
    FishingCell,
    FishingDayResponse,
    FishingDaySummary,
    FishingPointResponse,
    FishingSource,
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
    from .catalog import invalidate_catalog_cache

    index = build_sqlite_data_index(
        raw_data_dir=settings.raw_data_dir,
        processed_dir=settings.raw_data_dir.parent / "processed",
    )
    # 索引重建意味着"数据刚变过"，顺手把 catalog 缓存清掉，下一次访问直接拿新日期清单
    invalidate_catalog_cache(settings.raw_data_dir)
    return index


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
def catalog(
    response: Response,
    include_files: bool = Query(
        False,
        alias="files",
        description="是否返回逐文件清单；数据到几千个文件时默认关闭（available_dates 不受影响）",
    ),
    refresh: bool = Query(False, description="忽略缓存，强制重新扫描数据目录"),
) -> CatalogResponse:
    from .catalog import cached_netcdf_files, invalidate_catalog_cache

    if refresh:
        invalidate_catalog_cache(settings.raw_data_dir)
    discovered, cached = cached_netcdf_files(settings.raw_data_dir)
    dates = sorted({item.observation_date for item in discovered if item.observation_date})
    ready = bool(discovered)
    response.headers["X-Catalog-Cache"] = "hit" if cached else "miss"
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
        ]
        if include_files
        else [],
        files_included=include_files,
        cached=cached,
        message=None if ready else "请将真实逐日 NetCDF 样例放入 data/raw 目录。",
    )


@app.get(f"{settings.api_prefix}/fishing/availability", response_model=FishingAvailabilityResponse)
def fishing_availability() -> FishingAvailabilityResponse:
    """渔场层可用日期汇总（GFW AIS 表观捕捞努力量，0.1°）。"""
    pairs = fishing_effort.available_days()
    manifest = fishing_effort.read_manifest() or {}
    summaries: list[FishingDaySummary] = []
    for day, summary in pairs:
        info = summary or {}
        summaries.append(
            FishingDaySummary(
                date=day,
                cell_count=int(info.get("cell_count") or 0),
                total_hours=float(info.get("total_hours") or 0.0),
                vessel_count=int(info.get("vessel_count") or 0),
                file=str(info.get("file") or f"{fishing_effort.DAY_FILE_PREFIX}{day.strftime('%Y%m%d')}.json"),
            )
        )
    resolution = manifest.get("spatial_resolution_deg")
    bbox = manifest.get("bbox")
    return FishingAvailabilityResponse(
        ready=bool(summaries),
        day_count=len(summaries),
        first_date=summaries[0].date if summaries else None,
        last_date=summaries[-1].date if summaries else None,
        days=summaries,
        spatial_resolution_deg=float(resolution) if isinstance(resolution, (int, float)) else 0.1,
        bbox=[float(v) for v in bbox] if isinstance(bbox, list) and len(bbox) == 4 else [120.0, 27.0, 128.0, 34.0],
        source=FishingSource(**fishing_effort.SOURCE),
        message=None
        if summaries
        else "还没有渔场数据：在服务器上跑 tools/pipeline/fetch_gfw_effort.py（GFW 覆盖自 2017-01-01 起）",
    )


@app.get(f"{settings.api_prefix}/fishing/{{observation_date}}", response_model=FishingDayResponse)
def fishing_day(observation_date: date_type) -> FishingDayResponse:
    """单日渔场格点（0.1°）。hours 是 AIS 表观捕捞努力量，不是渔获量。"""
    try:
        day = fishing_effort.load_day(observation_date)
    except fishing_effort.FishingDataUnavailable as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    cells = [
        FishingCell(
            lon=float(cell["lon"]),
            lat=float(cell["lat"]),
            hours=float(cell.get("hours") or 0.0),
            vessel_count=int(cell.get("vessel_count") or 0),
            top_gears=[str(gear) for gear in (cell.get("top_gears") or [])],
        )
        for cell in fishing_effort.cells_of(day)
        if "lon" in cell and "lat" in cell
    ]
    bounds = fishing_effort.bounds_of(day)
    return FishingDayResponse(
        date=observation_date,
        cell_count=int(day.get("cell_count") or len(cells)),
        total_hours=float(day.get("total_hours") or 0.0),
        vessel_count=int(day.get("vessel_count") or 0),
        flag_count=int(day["flag_count"]) if isinstance(day.get("flag_count"), int) else None,
        spatial_resolution_deg=fishing_effort.cell_size_deg(day),
        bbox=[float(value) for value in (day.get("bbox") or [120.0, 27.0, 128.0, 34.0])],
        cells=cells,
        raster_url=f"{settings.api_prefix}/fishing/{observation_date.isoformat()}/raster",
        raster_bounds=bounds,
        source=FishingSource(**fishing_effort.SOURCE),
    )


@app.get(f"{settings.api_prefix}/frontend/day/{{observation_date}}")
def frontend_day(
    observation_date: date_type,
    response: Response,
    bbox: str | None = Query(
        None,
        description="minLon,minLat,maxLon,maxLat；省略=默认作业窗口 105–150°E / 3–45°N",
        examples=["105,3,150,45"],
    ),
    step: int | None = Query(
        None,
        ge=1,
        le=40,
        description="降采样步长（0.05°×step）；省略=按窗口自动升档（大窗口给概览）",
    ),
) -> dict[str, object]:
    """单日的「前端离线格式」数据（逐行 RLE），可按窗口取数。

    前端「服务器增强模式」按需调用它，把结果注入 OFData 缓存后沿用现有渲染路径绘制，
    因此返回结构必须与 ``frontend/prototype/data/day|sst/<date>.js`` 保持一致。

    - 省略 bbox/step：默认作业窗口（105–150°E / 3–45°N）的 0.05° 明细；
    - 带 bbox：返回**该窗口**的数据（原始锋面文件本身是全球 0.05°，所以任意海域都有真实数据）；
      窗口很大时按窗口像元数自动降采样成概览，返回里带 ``front.overview`` 标明口径，
      概览**不做对象识别**（避免把 1° 的块当成锋面对象）；
    - 锋面原始文件缺失 → 404（前端据此回退本地数据，不给空图）；bbox/step 不合法 → 422。
    """
    try:
        window = parse_bbox(bbox)
    except WindowError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    try:
        payload = build_frontend_payload(observation_date.isoformat(), bbox=window, step=step)
    except WindowError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except FrontendPayloadUnavailable as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    response.headers["X-Payload-Cache"] = "hit" if payload.get("cached") else "miss"
    return payload


@app.get(f"{settings.api_prefix}/fishing/{{observation_date}}/point", response_model=FishingPointResponse)
def fishing_point(
    observation_date: date_type,
    longitude: float = Query(..., ge=-180, le=180),
    latitude: float = Query(..., ge=-90, le=90),
) -> FishingPointResponse:
    """某一格的当日作业情况（就近匹配 0.1° 格点，命中不了就明说没有记录）。"""
    try:
        day = fishing_effort.load_day(observation_date)
    except fishing_effort.FishingDataUnavailable as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    hit = fishing_effort.point_lookup(day, longitude, latitude)
    return FishingPointResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        matched=hit is not None,
        cell_lon=hit["cell_lon"] if hit else None,
        cell_lat=hit["cell_lat"] if hit else None,
        hours=hit["hours"] if hit else None,
        vessel_count=hit["vessel_count"] if hit else None,
        top_gears=hit["top_gears"] if hit else [],
        source=FishingSource(**fishing_effort.SOURCE),
        message=None
        if hit
        else "这一格当天没有 AIS 作业记录（0.1° 格点；只有被 AIS 覆盖的渔船才计入，未覆盖渔船不出现）",
    )


@app.get(f"{settings.api_prefix}/fishing/{{observation_date}}/raster")
def fishing_raster(
    observation_date: date_type,
    max_hours: float | None = Query(None, gt=0, le=10000),
) -> Response:
    """渔场热力 PNG（半透明格，无作业记录的格子完全透明；坐标范围走 X-Raster-Bounds）。"""
    try:
        day = fishing_effort.load_day(observation_date)
    except fishing_effort.FishingDataUnavailable as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    hours, _vessels, bounds = fishing_effort.cell_grid(day)
    suffix = f"-{max_hours:g}" if max_hours else ""
    cache_path = settings.cache_dir / "rasters" / f"fishing-{observation_date.strftime('%Y%m%d')}{suffix}.png"
    cache_hit = cache_path.is_file()
    if cache_hit:
        content = cache_path.read_bytes()
    else:
        content = render_fishing_png(hours, max_hours)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(content)
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Raster-Bounds": ",".join(str(value) for value in bounds),
            "X-Raster-Cache": "hit" if cache_hit else "miss",
            "X-Raster-Kind": "fishing",
        },
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


def _align_combined_grids(
    sst_var,
    front_var,
    fallback_bounds: list[float],
) -> tuple[np.ndarray, np.ndarray, list[float]]:
    """把 SST 与锋面裁到共同经纬交集，使 combined 能逐像元合成。

    - front 是全局 0.05° 网格；SST 只覆盖数据集裁剪过的窗口（本仓为 120.025–128.025 / 27.025–34.025）。
      大半径查询时两者形状不同 → `render_combined_png` 里布尔索引会 IndexError（曾表现为 500）。
    - 两者同分辨率且同相位（起始都落在 .025 网格上），所以按经纬取交集后逐像元一一对应。
    - 返回 (sst_celsius, front, bounds)：bounds 是**实际覆盖范围**，可能小于请求窗口，
      调用方据此回写 X-Raster-Bounds，避免前端按请求窗口贴图导致错位。
    """
    lon_lo = max(float(np.min(sst_var.longitude.values)), float(np.min(front_var.lon.values)))
    lon_hi = min(float(np.max(sst_var.longitude.values)), float(np.max(front_var.lon.values)))
    lat_lo = max(float(np.min(sst_var.latitude.values)), float(np.min(front_var.lat.values)))
    lat_hi = min(float(np.max(sst_var.latitude.values)), float(np.max(front_var.lat.values)))
    if lon_lo >= lon_hi or lat_lo >= lat_hi:
        raise HTTPException(
            status_code=422,
            detail="该窗口内 SST 与锋面数据没有重叠区域，无法合成 combined 图；请分别请求 kind=sst 与 kind=front",
        )

    sst_cut = np.asarray(
        sst_var.sel(longitude=slice(lon_lo, lon_hi), latitude=slice(lat_lo, lat_hi)).values,
        dtype="float64",
    ) - 273.15
    front_cut = np.asarray(
        front_var.sel(lon=slice(lon_lo, lon_hi), lat=slice(lat_lo, lat_hi)).values
    )
    rows = min(sst_cut.shape[0], front_cut.shape[0])
    cols = min(sst_cut.shape[1], front_cut.shape[1])
    if rows <= 0 or cols <= 0:
        raise HTTPException(status_code=422, detail=f"合成窗口过小（{rows}×{cols}），无法生成 combined 图")
    if rows == sst_cut.shape[0] and cols == sst_cut.shape[1]:
        bounds = [lon_lo, lat_lo, lon_hi, lat_hi]
    else:
        # 网格相位不一致的兜底：至少保证形状一致，并按请求窗口标注
        bounds = list(fallback_bounds)
    return sst_cut[:rows, :cols], front_cut[:rows, :cols], bounds


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
        headers = {
            "Cache-Control": "public, max-age=3600",
            "X-Raster-Bounds": ",".join(str(value) for value in _query_bounds(longitude, latitude, radius_deg)),
            "X-Raster-Cache": "hit",
            "X-Raster-Kind": kind,
        }
        scale_path = cache_path.with_suffix(".scale")
        if scale_path.is_file():
            headers["X-Raster-Scale"] = scale_path.read_text(encoding="utf-8").strip()
        return Response(content=cache_path.read_bytes(), media_type="image/png", headers=headers)
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
        scale = sst_scale(sst_celsius)
        content = render_sst_png(sst_celsius, scale)
    elif kind == "front":
        scale = None
        content = render_front_png(front)
    else:
        # combined 需要两张图逐像元对应：front 是全局 0.05° 网格，而 SST 只覆盖数据集裁剪过的窗口，
        # 大半径查询时两者形状不同（实测 radius=4 → front 160×160 而 SST 141×160，直接 IndexError → 500）。
        # 两者同分辨率、同相位（起始都落在 .025），所以按经纬取交集即可精确对齐。
        sst_celsius, front, bounds = _align_combined_grids(
            sst_var, front_var, _query_bounds(longitude, latitude, radius_deg)
        )
        scale = sst_scale(sst_celsius)
        content = render_combined_png(sst_celsius, front, scale)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(content)
    # 色标随图一起缓存：缓存命中时也要能把 X-Raster-Scale 还给前端（图例要用真实数值）
    if scale:
        cache_path.with_suffix(".scale").write_text(f"{scale[0]},{scale[1]}", encoding="utf-8")
    if kind != "combined":
        bounds = _query_bounds(longitude, latitude, radius_deg)
    return Response(
        content=content,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Raster-Bounds": ",".join(str(value) for value in bounds),
            "X-Raster-Cache": "miss",
            "X-Raster-Kind": kind,
            **({"X-Raster-Scale": f"{scale[0]},{scale[1]}"} if scale else {}),
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
