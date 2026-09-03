from __future__ import annotations

from datetime import date
from pathlib import Path

import numpy as np

from .config import settings
from .data_access import (
    build_cell_features,
    build_front_object_layers,
    build_line_features,
    extract_front_objects,
    feature_step_for_shape,
    load_front_intensity_subset,
    load_front_subset,
    load_sst_subset,
    match_front_intensity_record,
    match_front_record,
    match_sst_record,
    scan_front_intensity_records,
    summarize_front_window,
    summarize_intensity_window,
    summarize_sst_window,
)
from .history import get_history_index
from .schemas import AnalysisRasterLayer, AnalysisResponse


def query_bounds(longitude: float, latitude: float, radius_deg: float) -> list[float]:
    return [
        round(longitude - radius_deg, 6),
        round(latitude - radius_deg, 6),
        round(longitude + radius_deg, 6),
        round(latitude + radius_deg, 6),
    ]


def compute_analysis_response(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> AnalysisResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    index = get_history_index(raw_data_dir, cache_dir)
    front_record = match_front_record(list(index.front_records), observation_date)
    sst_record = match_sst_record(list(index.sst_records), observation_date)
    intensity_record = match_front_intensity_record(
        scan_front_intensity_records(raw_data_dir),
        observation_date,
    )
    if front_record is None:
        raise FileNotFoundError(f"未找到 {observation_date} 的锋面文件")
    if sst_record is None:
        raise FileNotFoundError("未找到 SST 文件")

    front_var = load_front_subset(front_record.path, longitude, latitude, radius_deg)
    front = np.asarray(front_var.values)
    sst_var = load_sst_subset(sst_record.path, observation_date, longitude, latitude, radius_deg)
    if sst_var is None:
        raise FileNotFoundError(f"SST 文件不包含 {observation_date} 的数据")
    sst_day = np.asarray(sst_var.values)

    front_stats = summarize_front_window(front)
    bounds = query_bounds(longitude, latitude, radius_deg)
    finite_sst = sst_day[np.isfinite(sst_day)]
    center_sst = None
    try:
        center_sst = round(
            float(
                sst_var.sel(longitude=longitude, latitude=latitude, method="nearest").values
                - 273.15
            ),
            3,
        )
    except (KeyError, IndexError, OSError, ValueError, TypeError):
        center_sst = None
    sst_celsius = sst_day - 273.15
    intensity_values = None
    intensity_lons = None
    intensity_lats = None
    if intensity_record is not None:
        intensity_var = load_front_intensity_subset(
            intensity_record.path,
            observation_date,
            longitude,
            latitude,
            radius_deg,
        )
        if intensity_var is not None:
            intensity_values = np.asarray(intensity_var.values, dtype=float)
            intensity_lons = _coord_values(intensity_var, ("lon", "longitude", "x"))
            intensity_lats = _coord_values(intensity_var, ("lat", "latitude", "y"))
    stats = summarize_sst_window(
        sst_celsius,
        center_sst,
        sst_var.longitude.values,
        sst_var.latitude.values,
        latitude,
    )
    sst_feature_step = feature_step_for_shape(sst_celsius.shape)
    front_feature_step = feature_step_for_shape(front.shape)
    quality = {
        "sst_valid_percent": round(float(finite_sst.size / sst_day.size * 100), 2)
        if sst_day.size
        else 0,
        "front_valid_percent": front_stats["front_valid_percent"],
        "front_line_density_per_1000_pixels": front_stats["front_line_density_per_1000_pixels"],
        "geojson_sst_sample_step": sst_feature_step,
        "geojson_front_sample_step": front_feature_step,
    }
    front_objects = extract_front_objects(
        front,
        front_var.lon.values,
        front_var.lat.values,
        observation_date=observation_date,
        query_longitude=longitude,
        query_latitude=latitude,
        sst_celsius=sst_celsius,
        intensity_values=intensity_values if intensity_values is not None and intensity_values.shape == front.shape else None,
    )
    front_object_layers = build_front_object_layers(front_objects)
    source_files = [
        str(front_record.path.relative_to(raw_data_dir)),
        str(sst_record.path.relative_to(raw_data_dir)),
    ]
    if intensity_record is not None:
        source_files.append(str(intensity_record.path.relative_to(raw_data_dir)))
    intensity_feature_step = feature_step_for_shape(intensity_values.shape) if intensity_values is not None else 1
    intensity_layer = {"type": "FeatureCollection", "features": []}
    if intensity_values is not None and intensity_lons is not None and intensity_lats is not None:
        intensity_layer = {
            "type": "FeatureCollection",
            "features": build_cell_features(
                intensity_values,
                intensity_lons,
                intensity_lats,
                step=intensity_feature_step,
                predicate=lambda value: np.isfinite(value) and value > 0,
            ),
        }
    return AnalysisResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        sst=stats,
        intensity=summarize_intensity_window(intensity_values),
        front={
            key: value
            for key, value in front_stats.items()
            if key in {"line_pixels", "cold_side_pixels", "warm_side_pixels", "status"}
        },
        quality=quality,
        files=source_files,
        rasters=_raster_layers(
            observation_date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            bounds=bounds,
            sst_shape=sst_celsius.shape,
            front_shape=front.shape,
        ),
        layers={
            "sst": {
                "type": "FeatureCollection",
                "features": build_cell_features(
                    sst_celsius,
                    sst_var.longitude.values,
                    sst_var.latitude.values,
                    step=sst_feature_step,
                ),
            },
            "front_line": {
                "type": "FeatureCollection",
                "features": build_line_features(front, front_var.lon.values, front_var.lat.values),
            },
            "front_band": {
                "type": "FeatureCollection",
                "features": build_cell_features(
                    front,
                    front_var.lon.values,
                    front_var.lat.values,
                    step=front_feature_step,
                    predicate=lambda value: value in {-10, 10, 30},
                ),
            },
            "cold_side": {
                "type": "FeatureCollection",
                "features": build_cell_features(
                    front,
                    front_var.lon.values,
                    front_var.lat.values,
                    step=front_feature_step,
                    predicate=lambda value: value == -20,
                ),
            },
            "warm_side": {
                "type": "FeatureCollection",
                "features": build_cell_features(
                    front,
                    front_var.lon.values,
                    front_var.lat.values,
                    step=front_feature_step,
                    predicate=lambda value: value == 20,
                ),
            },
            "front_object_centroids": front_object_layers["centroids"],
            "front_object_bboxes": front_object_layers["bboxes"],
            "front_intensity": intensity_layer,
        },
    )


def _coord_values(data_array, candidates: tuple[str, ...]) -> np.ndarray | None:  # type: ignore[no-untyped-def]
    for candidate in candidates:
        if candidate in data_array.coords:
            values = np.asarray(data_array[candidate].values, dtype=float).ravel()
            if values.size:
                return values
    return None


def _raster_layers(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    bounds: list[float],
    sst_shape: tuple[int, ...],
    front_shape: tuple[int, ...],
) -> dict[str, AnalysisRasterLayer]:
    query = f"longitude={longitude}&latitude={latitude}&radius_deg={radius_deg}"
    base_url = f"{settings.api_prefix}/analysis/{observation_date}/raster"
    sst_width = int(sst_shape[1]) if len(sst_shape) > 1 else 0
    sst_height = int(sst_shape[0]) if len(sst_shape) > 0 else 0
    front_width = int(front_shape[1]) if len(front_shape) > 1 else 0
    front_height = int(front_shape[0]) if len(front_shape) > 0 else 0
    layers = {}
    if sst_width > 0 and sst_height > 0 and front_width > 0 and front_height > 0:
        layers["combined"] = AnalysisRasterLayer(
            kind="combined",
            format="image/png",
            url=f"{base_url}?{query}&kind=combined",
            bounds=bounds,
            width=sst_width,
            height=sst_height,
            render_mode="sst-front-alpha-composite",
        )
    if sst_width > 0 and sst_height > 0:
        layers["sst"] = AnalysisRasterLayer(
            kind="sst",
            format="image/png",
            url=f"{base_url}?{query}&kind=sst",
            bounds=bounds,
            width=sst_width,
            height=sst_height,
            render_mode="sst-temperature-colormap",
        )
    if front_width > 0 and front_height > 0:
        layers["front"] = AnalysisRasterLayer(
            kind="front",
            format="image/png",
            url=f"{base_url}?{query}&kind=front",
            bounds=bounds,
            width=front_width,
            height=front_height,
            render_mode="front-code-alpha-overlay",
        )
    return layers
