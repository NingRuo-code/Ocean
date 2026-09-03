from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from math import ceil, sqrt
from pathlib import Path

import numpy as np
import xarray as xr

DATE_PATTERN = re.compile(
    r"(?P<year>19\d{2}|20\d{2})[-_]?((?P<month>0[1-9]|1[0-2])[-_]?(?P<day>0[1-9]|[12]\d|3[01]))"
)
FRONT_LINE_CODES = (-10, 10, 30)
FRONT_COLD_CODE = -20
FRONT_WARM_CODE = 20
FRONT_LAND_CODE = -128
SST_VARIABLE_NAME = "analysed_sst"
IGNORED_DATA_DIRECTORIES = {"_duplicates_backup"}
FRONT_INTENSITY_VARIABLE_CANDIDATES = (
    "front_intensity",
    "frontal_intensity",
    "intensity",
    "frontIntensity",
)


@dataclass(frozen=True)
class DatasetFile:
    path: Path
    observation_date: date | None


@dataclass(frozen=True)
class FrontFileRecord:
    path: Path
    observation_date: date
    size_bytes: int
    mtime_ns: int


@dataclass(frozen=True)
class SstFileRecord:
    path: Path
    observation_dates: tuple[date, ...]
    size_bytes: int
    mtime_ns: int


@dataclass(frozen=True)
class FrontIntensityFileRecord:
    path: Path
    observation_dates: tuple[date, ...]
    variable_name: str | None
    size_bytes: int
    mtime_ns: int


def infer_date(path: Path) -> date | None:
    match = DATE_PATTERN.search(path.stem)
    if not match:
        return None
    try:
        return date(
            int(match.group("year")),
            int(match.group("month")),
            int(match.group("day")),
        )
    except ValueError:
        return None


def discover_netcdf_files(root: Path) -> list[DatasetFile]:
    if not root.exists():
        return []
    paths = _netcdf_paths(root)
    return [DatasetFile(path=path, observation_date=infer_date(path)) for path in paths]


def _netcdf_paths(root: Path) -> list[Path]:
    return sorted(
        path
        for path in {*root.rglob("*.nc"), *root.rglob("*.nc4")}
        if not _is_ignored_data_path(path)
    )


def _is_ignored_data_path(path: Path) -> bool:
    return any(part in IGNORED_DATA_DIRECTORIES for part in path.parts)


def scan_front_records(root: Path) -> list[FrontFileRecord]:
    front_root = root / "front"
    if not front_root.exists():
        return []
    records: list[FrontFileRecord] = []
    for path in _netcdf_paths(front_root):
        observation_date = infer_date(path)
        if observation_date is None:
            continue
        stat = path.stat()
        records.append(
            FrontFileRecord(
                path=path,
                observation_date=observation_date,
                size_bytes=stat.st_size,
                mtime_ns=stat.st_mtime_ns,
            )
        )
    return records


def _coerce_date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, np.datetime64):
        return date.fromisoformat(str(value.astype("datetime64[D]")))
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        try:
            return date(int(value.year), int(value.month), int(value.day))
        except ValueError:
            return None
    return None


def _extract_dates_from_time_coord(dataset: xr.Dataset) -> tuple[date, ...]:
    if "time" not in dataset.coords and "time" not in dataset.variables:
        return ()
    raw_values = np.asarray(dataset["time"].values)
    if raw_values.size == 0:
        return ()
    dates: list[date] = []
    seen: set[date] = set()
    for value in raw_values.ravel():
        coerced = _coerce_date(value)
        if coerced is None or coerced in seen:
            continue
        seen.add(coerced)
        dates.append(coerced)
    return tuple(sorted(dates))


def scan_sst_records(root: Path) -> list[SstFileRecord]:
    sst_root = root / "sst"
    if not sst_root.exists():
        return []
    records: list[SstFileRecord] = []
    for path in _netcdf_paths(sst_root):
        stat = path.stat()
        try:
            with xr.open_dataset(path) as dataset:
                observation_dates = _extract_dates_from_time_coord(dataset)
        except (OSError, ValueError, TypeError, KeyError):
            fallback_date = infer_date(path)
            observation_dates = (fallback_date,) if fallback_date is not None else ()
        if not observation_dates:
            continue
        records.append(
            SstFileRecord(
                path=path,
                observation_dates=observation_dates,
                size_bytes=stat.st_size,
                mtime_ns=stat.st_mtime_ns,
            )
        )
    return records


def scan_front_intensity_records(root: Path) -> list[FrontIntensityFileRecord]:
    records: list[FrontIntensityFileRecord] = []
    for directory_name in ("intensity", "front_intensity"):
        intensity_root = root / directory_name
        if not intensity_root.exists():
            continue
        for path in _netcdf_paths(intensity_root):
            stat = path.stat()
            variable_name = None
            observation_dates: tuple[date, ...] = ()
            try:
                with xr.open_dataset(path) as dataset:
                    variable_name = front_intensity_variable_name(dataset)
                    observation_dates = _extract_dates_from_time_coord(dataset)
            except (OSError, ValueError, TypeError, KeyError):
                observation_dates = ()
            if not observation_dates:
                fallback_date = infer_date(path)
                observation_dates = (fallback_date,) if fallback_date is not None else ()
            if not observation_dates:
                continue
            records.append(
                FrontIntensityFileRecord(
                    path=path,
                    observation_dates=observation_dates,
                    variable_name=variable_name,
                    size_bytes=stat.st_size,
                    mtime_ns=stat.st_mtime_ns,
                )
            )
    return records


def match_front_record(records: list[FrontFileRecord], observation_date: date) -> FrontFileRecord | None:
    return next((record for record in records if record.observation_date == observation_date), None)


def match_sst_record(records: list[SstFileRecord], observation_date: date) -> SstFileRecord | None:
    return next((record for record in records if observation_date in record.observation_dates), None)


def match_front_intensity_record(
    records: list[FrontIntensityFileRecord],
    observation_date: date,
) -> FrontIntensityFileRecord | None:
    return next((record for record in records if observation_date in record.observation_dates), None)


def load_front_subset(front_path: Path, longitude: float, latitude: float, radius_deg: float) -> xr.DataArray:
    with xr.open_dataset(front_path, decode_times=False) as dataset:
        subset = dataset["front"].isel(time=0).sel(
            lon=slice(longitude - radius_deg, longitude + radius_deg),
            lat=slice(latitude - radius_deg, latitude + radius_deg),
        )
        return subset.load()


def load_sst_subset(
    sst_path: Path,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
) -> xr.DataArray | None:
    requested_time = np.datetime64(observation_date)
    with xr.open_dataset(sst_path) as dataset:
        if "time" not in dataset:
            return None
        try:
            subset = dataset[SST_VARIABLE_NAME].sel(time=requested_time).sel(
                longitude=slice(longitude - radius_deg, longitude + radius_deg),
                latitude=slice(latitude - radius_deg, latitude + radius_deg),
            )
        except (KeyError, IndexError, OSError, ValueError, TypeError):
            return None
        return subset.load()


def front_intensity_variable_name(dataset: xr.Dataset) -> str | None:
    for candidate in FRONT_INTENSITY_VARIABLE_CANDIDATES:
        if candidate in dataset.data_vars:
            return candidate
    coordinate_names = set(dataset.coords)
    for name, variable in dataset.data_vars.items():
        if name in coordinate_names:
            continue
        if not np.issubdtype(variable.dtype, np.number):
            continue
        return str(name)
    return None


def load_front_intensity_subset(
    intensity_path: Path,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
) -> xr.DataArray | None:
    requested_time = np.datetime64(observation_date)
    with xr.open_dataset(intensity_path) as dataset:
        variable_name = front_intensity_variable_name(dataset)
        if variable_name is None:
            return None
        variable = dataset[variable_name]
        lon_name = _coord_name(dataset, variable, ("lon", "longitude", "x"))
        lat_name = _coord_name(dataset, variable, ("lat", "latitude", "y"))
        if lon_name is None or lat_name is None:
            return None
        if "time" in variable.dims:
            try:
                variable = variable.sel(time=requested_time)
            except (KeyError, IndexError, OSError, ValueError, TypeError):
                variable = variable.isel(time=0)
        try:
            subset = variable.sel(
                {
                    lon_name: slice(longitude - radius_deg, longitude + radius_deg),
                    lat_name: slice(latitude - radius_deg, latitude + radius_deg),
                }
            )
            if lat_name in subset.dims and lon_name in subset.dims:
                subset = subset.transpose(lat_name, lon_name, ...)
            return subset.load()
        except (KeyError, IndexError, OSError, ValueError, TypeError):
            return None


def _coord_name(dataset: xr.Dataset, variable: xr.DataArray, candidates: tuple[str, ...]) -> str | None:
    for candidate in candidates:
        if candidate in variable.coords or candidate in dataset.coords or candidate in variable.dims:
            return candidate
    return None


def finite_stats(values: np.ndarray) -> dict[str, float | int | None]:
    valid = values[np.isfinite(values)]
    if valid.size == 0:
        return {"count": 0, "min": None, "max": None, "mean": None, "range_celsius": None}
    min_value = float(valid.min())
    max_value = float(valid.max())
    return {
        "count": int(valid.size),
        "min": round(min_value, 3),
        "max": round(max_value, 3),
        "mean": round(float(valid.mean()), 3),
        "range_celsius": round(max_value - min_value, 3),
    }


def summarize_front_window(values: np.ndarray) -> dict[str, float | int | str]:
    total = int(values.size)
    valid = values[values != FRONT_LAND_CODE]
    line_count = int(np.isin(valid, FRONT_LINE_CODES).sum())
    cold_count = int((valid == FRONT_COLD_CODE).sum())
    warm_count = int((valid == FRONT_WARM_CODE).sum())
    valid_count = int(valid.size)
    return {
        "line_pixels": line_count,
        "cold_side_pixels": cold_count,
        "warm_side_pixels": warm_count,
        "valid_pixels": valid_count,
        "status": "有锋面" if line_count else "范围内未检测到锋面线",
        "front_valid_percent": round(float(valid_count / total * 100), 2) if total else 0.0,
        "front_line_density_per_1000_pixels": round(float(line_count / total * 1000), 2) if total else 0.0,
    }


def _median_spacing(values: np.ndarray) -> float | None:
    if values.size < 2:
        return None
    diffs = np.diff(np.sort(np.asarray(values, dtype=float).ravel()))
    diffs = np.abs(diffs[np.isfinite(diffs) & (np.abs(diffs) > 0)])
    if diffs.size == 0:
        return None
    return float(np.median(diffs))


def estimate_temperature_gradient(
    values_celsius: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    reference_latitude: float | None = None,
) -> dict[str, float | None]:
    if values_celsius.ndim != 2 or values_celsius.size == 0:
        return {"gradient_c_per_km": None, "max_gradient_c_per_km": None}
    lon_spacing = _median_spacing(lons)
    lat_spacing = _median_spacing(lats)
    if lon_spacing is None and lat_spacing is None:
        return {"gradient_c_per_km": None, "max_gradient_c_per_km": None}

    reference = reference_latitude
    if reference is None and np.asarray(lats).size:
        reference = float(np.nanmean(np.asarray(lats, dtype=float)))
    reference = reference if reference is not None and np.isfinite(reference) else 0.0
    dx_km = lon_spacing * 111.195 * max(float(np.cos(np.deg2rad(reference))), 0.01) if lon_spacing else None
    dy_km = lat_spacing * 111.195 if lat_spacing else None

    gradients: list[np.ndarray] = []
    if dx_km and values_celsius.shape[1] > 1:
        left = values_celsius[:, :-1]
        right = values_celsius[:, 1:]
        valid = np.isfinite(left) & np.isfinite(right)
        if valid.any():
            gradients.append(np.abs(right[valid] - left[valid]) / dx_km)
    if dy_km and values_celsius.shape[0] > 1:
        lower = values_celsius[:-1, :]
        upper = values_celsius[1:, :]
        valid = np.isfinite(lower) & np.isfinite(upper)
        if valid.any():
            gradients.append(np.abs(upper[valid] - lower[valid]) / dy_km)
    if not gradients:
        return {"gradient_c_per_km": None, "max_gradient_c_per_km": None}
    all_gradients = np.concatenate(gradients)
    return {
        "gradient_c_per_km": round(float(np.mean(all_gradients)), 5),
        "max_gradient_c_per_km": round(float(np.max(all_gradients)), 5),
    }


def summarize_sst_window(
    values_celsius: np.ndarray,
    center_celsius: float | None = None,
    lons: np.ndarray | None = None,
    lats: np.ndarray | None = None,
    reference_latitude: float | None = None,
) -> dict[str, float | int | None]:
    stats = finite_stats(values_celsius)
    stats["center_celsius"] = center_celsius
    if lons is not None and lats is not None:
        stats.update(estimate_temperature_gradient(values_celsius, lons, lats, reference_latitude))
    else:
        stats["gradient_c_per_km"] = None
        stats["max_gradient_c_per_km"] = None
    return stats


def summarize_intensity_window(values: np.ndarray | None) -> dict[str, float | int | str | None]:
    if values is None or values.size == 0:
        return {
            "available": "否",
            "count": 0,
            "min": None,
            "max": None,
            "mean": None,
            "p95": None,
            "active_pixel_count": 0,
            "active_pixel_percent": None,
        }
    numeric = np.asarray(values, dtype=float)
    valid = numeric[np.isfinite(numeric)]
    if valid.size == 0:
        return {
            "available": "是",
            "count": 0,
            "min": None,
            "max": None,
            "mean": None,
            "p95": None,
            "active_pixel_count": 0,
            "active_pixel_percent": None,
        }
    positive = valid[valid > 0]
    return {
        "available": "是",
        "count": int(valid.size),
        "min": round(float(valid.min()), 5),
        "max": round(float(valid.max()), 5),
        "mean": round(float(valid.mean()), 5),
        "p95": round(float(np.percentile(valid, 95)), 5),
        "active_pixel_count": int(positive.size),
        "active_pixel_percent": round(float(positive.size / valid.size * 100), 2),
    }


def build_point_features(
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    *,
    step: int = 4,
    predicate: Callable[[float], bool] | None = None,
) -> list[dict[str, object]]:
    features: list[dict[str, object]] = []
    for iy in range(0, len(lats), step):
        for ix in range(0, len(lons), step):
            value = values[iy, ix]
            if not np.isfinite(value) or (predicate is not None and not predicate(float(value))):
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [float(lons[ix]), float(lats[iy])]},
                    "properties": {"value": float(value)},
                }
            )
    return features


def _cell_edges(coords: np.ndarray) -> np.ndarray:
    values = np.asarray(coords, dtype=float).ravel()
    if values.size == 0:
        return values
    if values.size == 1:
        center = float(values[0])
        return np.asarray([center - 0.025, center + 0.025])
    midpoints = (values[:-1] + values[1:]) / 2
    first = values[0] - (midpoints[0] - values[0])
    last = values[-1] + (values[-1] - midpoints[-1])
    return np.concatenate([[first], midpoints, [last]])


def build_cell_features(
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    *,
    step: int = 1,
    predicate: Callable[[float], bool] | None = None,
) -> list[dict[str, object]]:
    features: list[dict[str, object]] = []
    lon_edges = _cell_edges(lons)
    lat_edges = _cell_edges(lats)
    if lon_edges.size < 2 or lat_edges.size < 2:
        return features
    for iy in range(0, len(lats), step):
        for ix in range(0, len(lons), step):
            value = values[iy, ix]
            if not np.isfinite(value) or (predicate is not None and not predicate(float(value))):
                continue
            west = float(lon_edges[ix])
            east = float(lon_edges[min(ix + step, len(lons))])
            south = float(lat_edges[iy])
            north = float(lat_edges[min(iy + step, len(lats))])
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [west, south],
                            [east, south],
                            [east, north],
                            [west, north],
                            [west, south],
                        ]],
                    },
                    "properties": {"value": float(value)},
                }
            )
    return features


def feature_step_for_shape(shape: tuple[int, ...], *, max_features: int = 12_000) -> int:
    if len(shape) < 2 or max_features <= 0:
        return 1
    height = int(shape[0])
    width = int(shape[1])
    cell_count = max(0, height) * max(0, width)
    if cell_count <= max_features:
        return 1
    return max(1, ceil(sqrt(cell_count / max_features)))


def build_line_features(values: np.ndarray, lons: np.ndarray, lats: np.ndarray) -> list[dict[str, object]]:
    mask = np.isin(values, FRONT_LINE_CODES)
    features: list[dict[str, object]] = []
    for iy, ix in zip(*np.where(mask)):
        if ix + 1 < len(lons) and mask[iy, ix + 1]:
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [float(lons[ix]), float(lats[iy])],
                            [float(lons[ix + 1]), float(lats[iy])],
                        ],
                    },
                    "properties": {"value": int(values[iy, ix])},
                }
            )
        if iy + 1 < len(lats) and mask[iy + 1, ix]:
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [float(lons[ix]), float(lats[iy])],
                            [float(lons[ix]), float(lats[iy + 1])],
                        ],
                    },
                    "properties": {"value": int(values[iy, ix])},
                }
            )
    return features


def extract_front_objects(
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    *,
    observation_date: date,
    query_longitude: float | None = None,
    query_latitude: float | None = None,
    sst_celsius: np.ndarray | None = None,
    intensity_values: np.ndarray | None = None,
) -> list[dict[str, object]]:
    mask = np.isin(values, FRONT_LINE_CODES)
    if mask.size == 0 or not mask.any():
        return []
    visited = np.zeros(mask.shape, dtype=bool)
    lon_edges = _cell_edges(lons)
    lat_edges = _cell_edges(lats)
    objects: list[dict[str, object]] = []
    component_index = 0
    for iy, ix in zip(*np.where(mask)):
        if visited[iy, ix]:
            continue
        component_index += 1
        pixels = _collect_component(mask, visited, int(iy), int(ix))
        rows = np.asarray([pixel[0] for pixel in pixels], dtype=int)
        cols = np.asarray([pixel[1] for pixel in pixels], dtype=int)
        pixel_lons = np.asarray(lons, dtype=float)[cols]
        pixel_lats = np.asarray(lats, dtype=float)[rows]
        centroid_lon = round(float(pixel_lons.mean()), 6)
        centroid_lat = round(float(pixel_lats.mean()), 6)
        west = float(lon_edges[cols.min()])
        east = float(lon_edges[cols.max() + 1])
        south = float(lat_edges[rows.min()])
        north = float(lat_edges[rows.max() + 1])
        nearest_distance = None
        if query_longitude is not None and query_latitude is not None:
            distances = (
                np.sqrt(
                    ((pixel_lons - query_longitude) * np.cos(np.deg2rad(query_latitude))) ** 2
                    + (pixel_lats - query_latitude) ** 2
                )
                * 111.195
            )
            nearest_distance = round(float(distances.min()), 3) if distances.size else None
        sst_mean = None
        sst_range = None
        if sst_celsius is not None and sst_celsius.shape == values.shape:
            sst_values = sst_celsius[rows, cols]
            valid_sst = sst_values[np.isfinite(sst_values)]
            if valid_sst.size:
                sst_mean = round(float(valid_sst.mean()), 3)
                sst_range = round(float(valid_sst.max() - valid_sst.min()), 3)
        mean_intensity = None
        max_intensity = None
        intensity_pixel_count = 0
        if intensity_values is not None and intensity_values.shape == values.shape:
            object_intensity = np.asarray(intensity_values, dtype=float)[rows, cols]
            valid_intensity = object_intensity[np.isfinite(object_intensity)]
            if valid_intensity.size:
                positive_intensity = valid_intensity[valid_intensity > 0]
                intensity_pixel_count = int(positive_intensity.size)
                mean_intensity = round(float(valid_intensity.mean()), 5)
                max_intensity = round(float(valid_intensity.max()), 5)
        objects.append(
            {
                "front_id": f"{observation_date:%Y%m%d}-F{component_index:03d}",
                "pixel_count": len(pixels),
                "centroid_longitude": centroid_lon,
                "centroid_latitude": centroid_lat,
                "bbox": [round(west, 6), round(south, 6), round(east, 6), round(north, 6)],
                "length_km": _estimate_object_length_km(len(pixels), pixel_lats, lons, lats),
                "codes": sorted({int(values[row, col]) for row, col in pixels}),
                "mean_sst_celsius": sst_mean,
                "temperature_range_celsius": sst_range,
                "mean_intensity": mean_intensity,
                "max_intensity": max_intensity,
                "intensity_pixel_count": intensity_pixel_count,
                "nearest_to_query_km": nearest_distance,
            }
        )
    return sorted(
        objects,
        key=lambda item: item["nearest_to_query_km"]
        if item["nearest_to_query_km"] is not None
        else float("inf"),
    )


def build_front_object_layers(objects: list[dict[str, object]]) -> dict[str, object]:
    center_features = []
    bbox_features = []
    for item in objects:
        center_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [item["centroid_longitude"], item["centroid_latitude"]],
                },
                "properties": {
                    "front_id": item["front_id"],
                    "pixel_count": item["pixel_count"],
                    "length_km": item["length_km"],
                    "nearest_to_query_km": item["nearest_to_query_km"] or -1,
                    "mean_intensity": item.get("mean_intensity") or -1,
                    "max_intensity": item.get("max_intensity") or -1,
                },
            }
        )
        west, south, east, north = item["bbox"]
        bbox_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [west, south],
                        [east, south],
                        [east, north],
                        [west, north],
                        [west, south],
                    ]],
                },
                "properties": {
                    "front_id": item["front_id"],
                    "pixel_count": item["pixel_count"],
                    "length_km": item["length_km"],
                    "mean_intensity": item.get("mean_intensity") or -1,
                    "max_intensity": item.get("max_intensity") or -1,
                },
            }
        )
    return {
        "centroids": {"type": "FeatureCollection", "features": center_features},
        "bboxes": {"type": "FeatureCollection", "features": bbox_features},
    }


def _collect_component(
    mask: np.ndarray,
    visited: np.ndarray,
    start_y: int,
    start_x: int,
) -> list[tuple[int, int]]:
    stack = [(start_y, start_x)]
    visited[start_y, start_x] = True
    pixels: list[tuple[int, int]] = []
    height, width = mask.shape
    while stack:
        y, x = stack.pop()
        pixels.append((y, x))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                ny = y + dy
                nx = x + dx
                if ny < 0 or nx < 0 or ny >= height or nx >= width:
                    continue
                if mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    stack.append((ny, nx))
    return pixels


def _estimate_object_length_km(
    pixel_count: int,
    pixel_lats: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
) -> float:
    lon_spacing = _median_spacing(lons) or 0.05
    lat_spacing = _median_spacing(lats) or 0.05
    reference_lat = float(np.nanmean(pixel_lats)) if pixel_lats.size else 0.0
    dx_km = lon_spacing * 111.195 * max(float(np.cos(np.deg2rad(reference_lat))), 0.01)
    dy_km = lat_spacing * 111.195
    return round(float(pixel_count * (dx_km + dy_km) / 2), 3)
