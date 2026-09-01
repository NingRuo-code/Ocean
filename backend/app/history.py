from __future__ import annotations

import hashlib
import json
from calendar import monthrange
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from time import perf_counter

import numpy as np
import xarray as xr
from pydantic import ValidationError

from .config import settings
from .data_access import (
    SST_VARIABLE_NAME,
    FrontFileRecord,
    SstFileRecord,
    load_front_subset,
    load_sst_subset,
    match_sst_record,
    scan_front_records,
    scan_sst_records,
    summarize_front_window,
    summarize_sst_window,
)
from .data_index import data_index_path, load_records_from_sqlite_data_index
from .schemas import (
    HistoryCacheInfo,
    HistoryGridInfo,
    HistoryIndexResponse,
    HistoryLocalRecord,
    HistoryLocalResponse,
    HistoryMonthlyPoint,
    HistoryMonthlyResponse,
    HistoryProbabilityResponse,
    HistoryResponse,
    HistorySpatialIndex,
    HistorySummary,
    HistoryTimelinePoint,
)

_INDEX_CACHE: dict[str, HistoryIndex] = {}
_QUERY_CACHE_SCHEMA_VERSION = "history-response-v5"
HISTORICAL_TARGET_YEAR_START = 1982
HISTORICAL_TARGET_YEAR_END = 2024


@dataclass(frozen=True)
class HistoryIndex:
    fingerprint: str
    generated_at: str
    front_records: tuple[FrontFileRecord, ...]
    sst_records: tuple[SstFileRecord, ...]


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _history_root(cache_dir: Path) -> Path:
    return cache_dir / "history"


def _index_cache_path(cache_dir: Path) -> Path:
    return _history_root(cache_dir) / "history_index.json"


def _query_cache_path(cache_dir: Path, key: str) -> Path:
    return _history_root(cache_dir) / "queries" / f"{key}.json"


def _metadata_source(raw_data_dir: Path) -> str:
    return "sqlite-index" if data_index_path(raw_data_dir.parent / "processed").is_file() else "directory-scan"


def _relative_path(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _front_record_payload(record: FrontFileRecord, root: Path) -> dict[str, object]:
    return {
        "path": _relative_path(record.path, root),
        "observation_date": record.observation_date.isoformat(),
        "size_bytes": record.size_bytes,
        "mtime_ns": record.mtime_ns,
    }


def _sst_record_payload(record: SstFileRecord, root: Path) -> dict[str, object]:
    return {
        "path": _relative_path(record.path, root),
        "observation_dates": [value.isoformat() for value in record.observation_dates],
        "size_bytes": record.size_bytes,
        "mtime_ns": record.mtime_ns,
    }


def _front_record_from_payload(payload: dict[str, object], root: Path) -> FrontFileRecord:
    return FrontFileRecord(
        path=root / str(payload["path"]),
        observation_date=date.fromisoformat(str(payload["observation_date"])),
        size_bytes=int(payload["size_bytes"]),
        mtime_ns=int(payload["mtime_ns"]),
    )


def _sst_record_from_payload(payload: dict[str, object], root: Path) -> SstFileRecord:
    return SstFileRecord(
        path=root / str(payload["path"]),
        observation_dates=tuple(date.fromisoformat(value) for value in payload["observation_dates"]),
        size_bytes=int(payload["size_bytes"]),
        mtime_ns=int(payload["mtime_ns"]),
    )


def _index_to_payload(index: HistoryIndex, root: Path) -> dict[str, object]:
    return {
        "fingerprint": index.fingerprint,
        "generated_at": index.generated_at,
        "front_records": [_front_record_payload(record, root) for record in index.front_records],
        "sst_records": [_sst_record_payload(record, root) for record in index.sst_records],
    }


def _index_from_payload(payload: dict[str, object], root: Path) -> HistoryIndex:
    return HistoryIndex(
        fingerprint=str(payload["fingerprint"]),
        generated_at=str(payload["generated_at"]),
        front_records=tuple(
            _front_record_from_payload(record, root) for record in payload.get("front_records", [])
        ),
        sst_records=tuple(
            _sst_record_from_payload(record, root) for record in payload.get("sst_records", [])
        ),
    )


def _query_signature(observation_date: date, longitude: float, latitude: float, radius_deg: float) -> str:
    digest = hashlib.sha1()
    digest.update(observation_date.isoformat().encode())
    digest.update(f"{longitude:.6f}".encode())
    digest.update(f"{latitude:.6f}".encode())
    digest.update(f"{radius_deg:.6f}".encode())
    return digest.hexdigest()


def _coord_values(dataset: xr.Dataset, names: tuple[str, ...]) -> np.ndarray:
    for name in names:
        if name in dataset.coords or name in dataset.variables:
            values = np.asarray(dataset[name].values, dtype=float).ravel()
            return values[np.isfinite(values)]
    return np.array([], dtype=float)


def _resolution(values: np.ndarray) -> float | None:
    if values.size < 2:
        return None
    diffs = np.diff(np.sort(values))
    diffs = np.abs(diffs[np.isfinite(diffs) & (np.abs(diffs) > 0)])
    if diffs.size == 0:
        return None
    return round(float(np.median(diffs)), 6)


def _coord_min(values: np.ndarray) -> float | None:
    return round(float(np.min(values)), 6) if values.size else None


def _coord_max(values: np.ndarray) -> float | None:
    return round(float(np.max(values)), 6) if values.size else None


def _same_period_expected_sample_count(observation_date: date) -> int:
    count = 0
    for year in range(HISTORICAL_TARGET_YEAR_START, HISTORICAL_TARGET_YEAR_END + 1):
        try:
            date(year, observation_date.month, observation_date.day)
        except ValueError:
            continue
        count += 1
    return count


def _monthly_expected_sample_count(observation_date: date) -> int:
    return sum(
        monthrange(year, observation_date.month)[1]
        for year in range(HISTORICAL_TARGET_YEAR_START, HISTORICAL_TARGET_YEAR_END + 1)
    )


def _coverage_ratio(sample_count: int, expected_count: int) -> float | None:
    if expected_count <= 0:
        return None
    return round(sample_count / expected_count, 4)


def _reliability_level(same_period_sample_count: int) -> tuple[str, str]:
    if same_period_sample_count >= 30:
        return "high", "较高"
    if same_period_sample_count >= 15:
        return "medium", "中等"
    if same_period_sample_count >= 5:
        return "demo", "演示级"
    if same_period_sample_count > 0:
        return "low", "样本偏少"
    return "none", "无同期样本"


def _format_ratio_for_note(value: float | None) -> str:
    return "--" if value is None else f"{value * 100:.1f}%"


def _coverage_note(
    *,
    same_period_sample_count: int,
    same_period_expected_count: int,
    same_period_coverage_ratio: float | None,
    monthly_sample_count: int,
    monthly_expected_count: int,
    monthly_coverage_ratio: float | None,
) -> str:
    if same_period_sample_count == 0:
        return (
            f"当前没有同月同日历史样本；完整目标为 "
            f"{HISTORICAL_TARGET_YEAR_START}—{HISTORICAL_TARGET_YEAR_END} "
            f"共 {same_period_expected_count} 年。"
        )
    return (
        f"当前同期样本覆盖 {same_period_sample_count}/{same_period_expected_count} 年"
        f"（{_format_ratio_for_note(same_period_coverage_ratio)}），"
        f"月度样本覆盖 {monthly_sample_count}/{monthly_expected_count} 天"
        f"（{_format_ratio_for_note(monthly_coverage_ratio)}）。"
        "该指标用于说明样本覆盖程度，不等同于数学置信区间。"
    )


def _grid_info_from_file(
    path: Path | None,
    root: Path,
    dataset_type: str,
    variable_name: str,
    lon_names: tuple[str, ...],
    lat_names: tuple[str, ...],
) -> HistoryGridInfo | None:
    if path is None:
        return None
    try:
        with xr.open_dataset(path, decode_times=False) as dataset:
            variable = dataset[variable_name]
            lon_values = _coord_values(dataset, lon_names)
            lat_values = _coord_values(dataset, lat_names)
            return HistoryGridInfo(
                dataset_type=dataset_type,
                variable=variable_name,
                source_file=_relative_path(path, root),
                lon_min=_coord_min(lon_values),
                lon_max=_coord_max(lon_values),
                lat_min=_coord_min(lat_values),
                lat_max=_coord_max(lat_values),
                lon_count=int(lon_values.size),
                lat_count=int(lat_values.size),
                lon_resolution_deg=_resolution(lon_values),
                lat_resolution_deg=_resolution(lat_values),
                dimensions=[str(dim) for dim in variable.dims],
            )
    except (OSError, ValueError, TypeError, KeyError):
        return None


def _archive_fingerprint(raw_data_dir: Path) -> str:
    sqlite_fingerprint = _sqlite_index_fingerprint(raw_data_dir)
    if sqlite_fingerprint is not None:
        return sqlite_fingerprint

    digest = hashlib.sha1()
    for kind in ("front", "sst"):
        root = raw_data_dir / kind
        if not root.exists():
            continue
        for path in sorted({*root.rglob("*.nc"), *root.rglob("*.nc4")}):
            stat = path.stat()
            digest.update(kind.encode("utf-8"))
            digest.update(_relative_path(path, raw_data_dir).encode("utf-8"))
            digest.update(str(stat.st_size).encode("utf-8"))
            digest.update(str(stat.st_mtime_ns).encode("utf-8"))
    return digest.hexdigest()


def _sqlite_index_fingerprint(raw_data_dir: Path) -> str | None:
    index_path = data_index_path(raw_data_dir.parent / "processed")
    if not index_path.is_file():
        return None
    stat = index_path.stat()
    digest = hashlib.sha1()
    digest.update(b"sqlite-data-index")
    digest.update(str(index_path.resolve()).encode("utf-8"))
    digest.update(str(stat.st_size).encode("utf-8"))
    digest.update(str(stat.st_mtime_ns).encode("utf-8"))
    return digest.hexdigest()


def build_history_index(raw_data_dir: Path, fingerprint: str) -> HistoryIndex:
    indexed_records = load_records_from_sqlite_data_index(
        raw_data_dir,
        raw_data_dir.parent / "processed",
    )
    if indexed_records is not None:
        front_records, sst_records = indexed_records
        return HistoryIndex(
            fingerprint=fingerprint,
            generated_at=_now_iso(),
            front_records=tuple(front_records),
            sst_records=tuple(sst_records),
        )
    return HistoryIndex(
        fingerprint=fingerprint,
        generated_at=_now_iso(),
        front_records=tuple(scan_front_records(raw_data_dir)),
        sst_records=tuple(scan_sst_records(raw_data_dir)),
    )


def get_history_index(raw_data_dir: Path, cache_dir: Path | None = None) -> HistoryIndex:
    cache_dir = cache_dir or settings.cache_dir
    cache_root = _history_root(cache_dir)
    cache_key = f"{raw_data_dir.resolve()}::{cache_dir.resolve()}"
    fingerprint = _archive_fingerprint(raw_data_dir)

    cached = _INDEX_CACHE.get(cache_key)
    if cached and cached.fingerprint == fingerprint:
        return cached

    index_path = _index_cache_path(cache_dir)
    if index_path.is_file():
        try:
            payload = json.loads(index_path.read_text(encoding="utf-8"))
            if payload.get("fingerprint") == fingerprint:
                index = _index_from_payload(payload, raw_data_dir)
                _INDEX_CACHE[cache_key] = index
                return index
        except (OSError, ValueError, TypeError, KeyError):
            pass

    index = build_history_index(raw_data_dir, fingerprint)
    cache_root.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(_index_to_payload(index, raw_data_dir), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _INDEX_CACHE[cache_key] = index
    return index


def describe_history_index(
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
    longitude: float | None = None,
    latitude: float | None = None,
    radius_deg: float | None = None,
) -> HistoryIndexResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    index = get_history_index(raw_data_dir, cache_dir)
    front_dates = sorted(record.observation_date for record in index.front_records)
    front_years = sorted({item.year for item in front_dates})
    front_months = sorted({f"{item.year:04d}-{item.month:02d}" for item in front_dates})
    front_path = index.front_records[0].path if index.front_records else None
    sst_path = index.sst_records[0].path if index.sst_records else None
    query_bbox = None
    if longitude is not None and latitude is not None and radius_deg is not None:
        query_bbox = [
            round(longitude - radius_deg, 6),
            round(latitude - radius_deg, 6),
            round(longitude + radius_deg, 6),
            round(latitude + radius_deg, 6),
        ]
    return HistoryIndexResponse(
        dataset=settings.dataset_id,
        version=settings.dataset_version,
        ready=bool(index.front_records),
        generated_at=index.generated_at,
        fingerprint=index.fingerprint,
        metadata_source=_metadata_source(raw_data_dir),
        front_file_count=len(index.front_records),
        sst_file_count=len(index.sst_records),
        available_date_start=front_dates[0] if front_dates else None,
        available_date_end=front_dates[-1] if front_dates else None,
        available_dates=front_dates,
        available_years=front_years,
        available_months=front_months,
        spatial=HistorySpatialIndex(
            query_bbox=query_bbox,
            front_grid=_grid_info_from_file(
                front_path,
                raw_data_dir,
                "front",
                "front",
                ("lon", "longitude"),
                ("lat", "latitude"),
            ),
            sst_grid=_grid_info_from_file(
                sst_path,
                raw_data_dir,
                "sst",
                SST_VARIABLE_NAME,
                ("longitude", "lon"),
                ("latitude", "lat"),
            ),
        ),
        cache_path=str(_index_cache_path(cache_dir)),
        message=None
        if index.front_records
        else "未发现 front 历史文件；请先把逐日 NetCDF 放入 data/raw/front。",
    )


def _daily_source_files(front_path: Path, sst_path: Path | None, root: Path) -> list[str]:
    sources = [_relative_path(front_path, root)]
    if sst_path is not None:
        sources.append(_relative_path(sst_path, root))
    return sources


def _monthly_summary(points: list[HistoryTimelinePoint]) -> list[HistoryMonthlyPoint]:
    monthly_points: list[HistoryMonthlyPoint] = []
    for month in range(1, 13):
        month_points = [point for point in points if point.month == month]
        sample_count = len(month_points)
        front_hit_count = sum(1 for point in month_points if point.front_present)
        probability = round(front_hit_count / sample_count, 4) if sample_count else None
        sst_means = [point.sst_mean_celsius for point in month_points if point.sst_mean_celsius is not None]
        sst_mins = [point.sst_min_celsius for point in month_points if point.sst_min_celsius is not None]
        sst_maxs = [point.sst_max_celsius for point in month_points if point.sst_max_celsius is not None]
        monthly_points.append(
            HistoryMonthlyPoint(
                month=month,
                sample_count=sample_count,
                front_hit_count=front_hit_count,
                probability=probability,
                sst_mean_celsius=round(float(np.mean(sst_means)), 3) if sst_means else None,
                sst_min_celsius=round(float(np.min(sst_mins)), 3) if sst_mins else None,
                sst_max_celsius=round(float(np.max(sst_maxs)), 3) if sst_maxs else None,
            )
        )
    return monthly_points


def _build_response(
    index: HistoryIndex,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path,
    cache_dir: Path,
) -> HistoryResponse:
    front_records = list(index.front_records)
    sst_records = list(index.sst_records)
    if not front_records:
        same_period_expected_count = _same_period_expected_sample_count(observation_date)
        monthly_expected_count = _monthly_expected_sample_count(observation_date)
        reliability_level, reliability_label = _reliability_level(0)
        sample_coverage_note = _coverage_note(
            same_period_sample_count=0,
            same_period_expected_count=same_period_expected_count,
            same_period_coverage_ratio=_coverage_ratio(0, same_period_expected_count),
            monthly_sample_count=0,
            monthly_expected_count=monthly_expected_count,
            monthly_coverage_ratio=_coverage_ratio(0, monthly_expected_count),
        )
        summary = HistorySummary(
            available_date_start=None,
            available_date_end=None,
            available_years=[],
            valid_years=[],
            front_years=[],
            historical_target_year_start=HISTORICAL_TARGET_YEAR_START,
            historical_target_year_end=HISTORICAL_TARGET_YEAR_END,
            same_period_expected_sample_count=same_period_expected_count,
            same_period_sample_count=0,
            same_period_front_hit_count=0,
            same_period_probability=None,
            same_period_coverage_ratio=_coverage_ratio(0, same_period_expected_count),
            monthly_expected_sample_count=monthly_expected_count,
            monthly_sample_count=0,
            monthly_front_hit_count=0,
            monthly_probability=None,
            monthly_coverage_ratio=_coverage_ratio(0, monthly_expected_count),
            annual_sample_count=0,
            annual_front_hit_count=0,
            annual_probability=None,
            sample_reliability_level=reliability_level,
            sample_reliability_label=reliability_label,
            sample_coverage_note=sample_coverage_note,
            front_line_pixels_mean=None,
            front_line_pixels_min=None,
            front_line_pixels_max=None,
            sst_mean_celsius=None,
            sst_min_celsius=None,
            sst_max_celsius=None,
            sst_gradient_c_per_km_mean=None,
            sst_gradient_c_per_km_min=None,
            sst_gradient_c_per_km_max=None,
        )
        cache_path = _query_cache_path(cache_dir, _query_signature(observation_date, longitude, latitude, radius_deg))
        return HistoryResponse(
            date=observation_date,
            longitude=longitude,
            latitude=latitude,
            radius_deg=radius_deg,
            summary=summary,
            timeline=[],
            monthly=_monthly_summary([]),
            explanation=[
                "本地数据目录中未找到可用的锋面历史文件。",
                "请先把逐日 front NetCDF 放入 data/raw/front 后再查询历史统计。",
                sample_coverage_note,
            ],
            cache=HistoryCacheInfo(
                hit=False,
                key=cache_path.stem,
                index_fingerprint=index.fingerprint,
                path=str(cache_path),
                generated_at=_now_iso(),
            ),
            source_files=[],
            same_period_records=[],
            monthly_records=[],
        )

    timeline: list[HistoryTimelinePoint] = []
    for front_record in front_records:
        front_data = load_front_subset(front_record.path, longitude, latitude, radius_deg)
        front_values = np.asarray(front_data.values)
        front_summary = summarize_front_window(front_values)

        sst_record = match_sst_record(sst_records, front_record.observation_date)
        sst_path = sst_record.path if sst_record is not None else None
        sst_mean = sst_min = sst_max = None
        sst_gradient = None
        if sst_path is not None:
            sst_data = load_sst_subset(sst_path, front_record.observation_date, longitude, latitude, radius_deg)
            if sst_data is not None:
                sst_values = np.asarray(sst_data.values) - 273.15
                center_celsius = None
                try:
                    center_value = sst_data.sel(
                        longitude=longitude,
                        latitude=latitude,
                        method="nearest",
                    ).values
                    if np.isfinite(center_value):
                        center_celsius = round(float(center_value - 273.15), 3)
                except (KeyError, IndexError, OSError, ValueError, TypeError):
                    center_celsius = None
                sst_summary = summarize_sst_window(
                    sst_values,
                    center_celsius,
                    sst_data.longitude.values,
                    sst_data.latitude.values,
                    latitude,
                )
                sst_mean = sst_summary["mean"]
                sst_min = sst_summary["min"]
                sst_max = sst_summary["max"]
                sst_gradient = sst_summary["gradient_c_per_km"]

        timeline.append(
            HistoryTimelinePoint(
                date=front_record.observation_date,
                year=front_record.observation_date.year,
                month=front_record.observation_date.month,
                front_line_pixels=int(front_summary["line_pixels"]),
                cold_side_pixels=int(front_summary["cold_side_pixels"]),
                warm_side_pixels=int(front_summary["warm_side_pixels"]),
                front_present=int(front_summary["line_pixels"]) > 0,
                sst_mean_celsius=sst_mean,
                sst_min_celsius=sst_min,
                sst_max_celsius=sst_max,
                sst_gradient_c_per_km=sst_gradient,
                source_files=_daily_source_files(front_record.path, sst_path, raw_data_dir),
            )
        )

    timeline.sort(key=lambda item: item.date)
    available_years = sorted({item.year for item in timeline})
    valid_years = sorted(
        {
            item.year
            for item in timeline
            if item.front_line_pixels > 0 or item.cold_side_pixels > 0 or item.warm_side_pixels > 0
        }
    )
    front_years = sorted({item.year for item in timeline if item.front_present})

    same_period_points = [item for item in timeline if item.date.month == observation_date.month and item.date.day == observation_date.day]
    month_points = [item for item in timeline if item.month == observation_date.month]

    same_period_sample_count = len(same_period_points)
    same_period_front_hit_count = sum(1 for item in same_period_points if item.front_present)
    monthly_sample_count = len(month_points)
    monthly_front_hit_count = sum(1 for item in month_points if item.front_present)
    annual_sample_count = len(timeline)
    annual_front_hit_count = sum(1 for item in timeline if item.front_present)
    same_period_expected_count = _same_period_expected_sample_count(observation_date)
    monthly_expected_count = _monthly_expected_sample_count(observation_date)
    same_period_coverage_ratio = _coverage_ratio(same_period_sample_count, same_period_expected_count)
    monthly_coverage_ratio = _coverage_ratio(monthly_sample_count, monthly_expected_count)
    reliability_level, reliability_label = _reliability_level(same_period_sample_count)
    sample_coverage_note = _coverage_note(
        same_period_sample_count=same_period_sample_count,
        same_period_expected_count=same_period_expected_count,
        same_period_coverage_ratio=same_period_coverage_ratio,
        monthly_sample_count=monthly_sample_count,
        monthly_expected_count=monthly_expected_count,
        monthly_coverage_ratio=monthly_coverage_ratio,
    )

    available_dates = [item.date for item in timeline]
    front_line_pixels = [item.front_line_pixels for item in timeline]
    sst_means = [item.sst_mean_celsius for item in timeline if item.sst_mean_celsius is not None]
    sst_mins = [item.sst_min_celsius for item in timeline if item.sst_min_celsius is not None]
    sst_maxs = [item.sst_max_celsius for item in timeline if item.sst_max_celsius is not None]
    sst_gradients = [
        item.sst_gradient_c_per_km
        for item in timeline
        if item.sst_gradient_c_per_km is not None
    ]

    summary = HistorySummary(
        available_date_start=min(available_dates) if available_dates else None,
        available_date_end=max(available_dates) if available_dates else None,
        available_years=available_years,
        valid_years=valid_years,
        front_years=front_years,
        historical_target_year_start=HISTORICAL_TARGET_YEAR_START,
        historical_target_year_end=HISTORICAL_TARGET_YEAR_END,
        same_period_expected_sample_count=same_period_expected_count,
        same_period_sample_count=same_period_sample_count,
        same_period_front_hit_count=same_period_front_hit_count,
        same_period_probability=round(same_period_front_hit_count / same_period_sample_count, 4)
        if same_period_sample_count
        else None,
        same_period_coverage_ratio=same_period_coverage_ratio,
        monthly_expected_sample_count=monthly_expected_count,
        monthly_sample_count=monthly_sample_count,
        monthly_front_hit_count=monthly_front_hit_count,
        monthly_probability=round(monthly_front_hit_count / monthly_sample_count, 4)
        if monthly_sample_count
        else None,
        monthly_coverage_ratio=monthly_coverage_ratio,
        annual_sample_count=annual_sample_count,
        annual_front_hit_count=annual_front_hit_count,
        annual_probability=round(annual_front_hit_count / annual_sample_count, 4)
        if annual_sample_count
        else None,
        sample_reliability_level=reliability_level,
        sample_reliability_label=reliability_label,
        sample_coverage_note=sample_coverage_note,
        front_line_pixels_mean=round(float(np.mean(front_line_pixels)), 3) if front_line_pixels else None,
        front_line_pixels_min=round(float(np.min(front_line_pixels)), 3) if front_line_pixels else None,
        front_line_pixels_max=round(float(np.max(front_line_pixels)), 3) if front_line_pixels else None,
        sst_mean_celsius=round(float(np.mean(sst_means)), 3) if sst_means else None,
        sst_min_celsius=round(float(np.min(sst_mins)), 3) if sst_mins else None,
        sst_max_celsius=round(float(np.max(sst_maxs)), 3) if sst_maxs else None,
        sst_gradient_c_per_km_mean=round(float(np.mean(sst_gradients)), 5)
        if sst_gradients
        else None,
        sst_gradient_c_per_km_min=round(float(np.min(sst_gradients)), 5)
        if sst_gradients
        else None,
        sst_gradient_c_per_km_max=round(float(np.max(sst_gradients)), 5)
        if sst_gradients
        else None,
    )

    monthly = _monthly_summary(timeline)
    focus_points = same_period_points or month_points or timeline
    source_files = sorted({source for point in focus_points for source in point.source_files})
    explanation = [
        "历史统计基于本地 front 逐日归档，按查询经纬度和范围逐日裁剪。",
        "同期开阔样本按月日匹配；月度统计按月份分组；多年变化按全部可用日期排序展示。",
        "概率 = 命中样本数 / 有效样本数。命中样本定义为查询窗内检测到锋面线像元。",
        sample_coverage_note,
        "统计结果和所用文件清单会写入 data/cache/history，重复查询可直接命中缓存。",
    ]
    if same_period_sample_count == 0:
        explanation.append("当前本地历史档案中没有与查询日期同月同日的样本，因此同期开阔概率为空。")
    if monthly_sample_count == 0:
        explanation.append("当前本地历史档案中没有与查询月份对应的样本。")

    query_key = _query_signature(observation_date, longitude, latitude, radius_deg)
    cache_path = _query_cache_path(cache_dir, query_key)
    return HistoryResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        summary=summary,
        timeline=timeline,
        monthly=monthly,
        explanation=explanation,
        cache=HistoryCacheInfo(
            hit=False,
            key=query_key,
            index_fingerprint=index.fingerprint,
            path=str(cache_path),
            generated_at=_now_iso(),
        ),
        source_files=source_files,
        same_period_records=same_period_points,
        monthly_records=month_points,
    )


def _load_cached_response(cache_path: Path, fingerprint: str) -> HistoryResponse | None:
    if not cache_path.is_file():
        return None
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None
    if payload.get("index_fingerprint") != fingerprint:
        return None
    if payload.get("schema_version") != _QUERY_CACHE_SCHEMA_VERSION:
        return None
    response_payload = payload.get("response")
    if not isinstance(response_payload, dict):
        return None
    try:
        response = HistoryResponse.model_validate(response_payload)
    except ValidationError:
        return None
    response.cache.hit = True
    return response


def _write_cached_response(cache_path: Path, response: HistoryResponse) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": _QUERY_CACHE_SCHEMA_VERSION,
        "index_fingerprint": response.cache.index_fingerprint,
        "query_key": response.cache.key,
        "response": response.model_dump(mode="json"),
    }
    cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def compute_history_response(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> HistoryResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    index = get_history_index(raw_data_dir, cache_dir)
    cache_path = _query_cache_path(cache_dir, _query_signature(observation_date, longitude, latitude, radius_deg))
    started_at = perf_counter()
    cached = _load_cached_response(cache_path, index.fingerprint)
    if cached is not None:
        cached.cache.hit = True
        cached.cache.metadata_source = _metadata_source(raw_data_dir)
        cached.cache.records_evaluated = 0
        cached.cache.timeline_record_count = len(cached.timeline)
        cached.cache.duration_ms = round((perf_counter() - started_at) * 1000, 3)
        return cached
    started_at = perf_counter()
    response = _build_response(index, observation_date, longitude, latitude, radius_deg, raw_data_dir, cache_dir)
    response.cache.hit = False
    response.cache.metadata_source = _metadata_source(raw_data_dir)
    response.cache.records_evaluated = len(index.front_records)
    response.cache.timeline_record_count = len(response.timeline)
    response.cache.duration_ms = round((perf_counter() - started_at) * 1000, 3)
    _write_cached_response(cache_path, response)
    return response


def compute_history_probability_response(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> HistoryProbabilityResponse:
    response = compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    return HistoryProbabilityResponse(
        date=response.date,
        longitude=response.longitude,
        latitude=response.latitude,
        radius_deg=response.radius_deg,
        summary=response.summary,
        same_period_records=response.same_period_records,
        monthly_records=response.monthly_records,
        explanation=[
            "历史同期概率按同月同日记录计算。",
            "月度概率按查询日期所在月份的全部本地历史记录计算。",
            "每条参与记录均保留日期、命中状态、像元统计和源文件路径，便于复核。",
            *response.explanation,
        ],
        cache=response.cache,
    )


def compute_history_monthly_response(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> HistoryMonthlyResponse:
    response = compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    selected = next((item for item in response.monthly if item.month == observation_date.month), None)
    return HistoryMonthlyResponse(
        date=response.date,
        longitude=response.longitude,
        latitude=response.latitude,
        radius_deg=response.radius_deg,
        selected_month=observation_date.month,
        selected=selected,
        monthly=response.monthly,
        explanation=[
            "月度统计以月份为分组单位，样本来自当前本地 front 历史归档。",
            "selected 字段对应查询日期所在月份，可直接用于界面高亮或老师演示。",
            *response.explanation,
        ],
        cache=response.cache,
    )


def _to_local_record(point: HistoryTimelinePoint, matched_rule: str) -> HistoryLocalRecord:
    return HistoryLocalRecord(
        date=point.date,
        year=point.year,
        month=point.month,
        matched_rule=matched_rule,
        front_present=point.front_present,
        front_line_pixels=point.front_line_pixels,
        cold_side_pixels=point.cold_side_pixels,
        warm_side_pixels=point.warm_side_pixels,
        sst_mean_celsius=point.sst_mean_celsius,
        source_files=point.source_files,
    )


def compute_history_local_response(
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> HistoryLocalResponse:
    response = compute_history_response(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    same_period_records = [
        _to_local_record(point, "same-month-day") for point in response.same_period_records
    ]
    monthly_records = [_to_local_record(point, "same-month") for point in response.monthly_records]
    source_files = sorted(
        {
            source
            for record in [*same_period_records, *monthly_records]
            for source in record.source_files
        }
    )
    return HistoryLocalResponse(
        date=response.date,
        longitude=response.longitude,
        latitude=response.latitude,
        radius_deg=response.radius_deg,
        same_period_records=same_period_records,
        monthly_records=monthly_records,
        source_files=source_files,
        explanation=[
            "局地历史数据提取按查询中心点和半径裁剪每个历史 front 文件。",
            "same_period_records 用于解释同期概率；monthly_records 用于解释月度概率。",
            "source_files 是参与本次局地提取的本地文件路径集合，可直接追溯到原始 NetCDF。",
        ],
        cache=response.cache,
    )
