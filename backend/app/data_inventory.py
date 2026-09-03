from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

from .data_access import (
    FrontFileRecord,
    FrontIntensityFileRecord,
    SstFileRecord,
    scan_front_intensity_records,
    scan_front_records,
    scan_sst_records,
)
from .schemas import DataManifestDataset, DataManifestResponse


def build_data_manifest(
    raw_data_dir: Path,
    processed_dir: Path,
) -> DataManifestResponse:
    front_records = scan_front_records(raw_data_dir)
    sst_records = scan_sst_records(raw_data_dir)
    intensity_records = scan_front_intensity_records(raw_data_dir)

    front_dates = {record.observation_date for record in front_records}
    sst_dates = {item for record in sst_records for item in record.observation_dates}
    paired_dates = sorted(front_dates & sst_dates)

    datasets = [
        _front_dataset(raw_data_dir, front_records),
        _sst_dataset(raw_data_dir, sst_records),
        _intensity_dataset(raw_data_dir, intensity_records),
    ]
    total_file_count = sum(item.file_count for item in datasets)
    total_size_bytes = sum(item.size_bytes for item in datasets)
    manifest_path = processed_dir / "data_manifest.json"
    return DataManifestResponse(
        generated_at=datetime.now(UTC).isoformat(),
        raw_data_dir=str(raw_data_dir),
        manifest_path=str(manifest_path),
        total_file_count=total_file_count,
        total_size_bytes=total_size_bytes,
        paired_date_count=len(paired_dates),
        paired_dates=paired_dates,
        missing_sst_dates=sorted(front_dates - sst_dates),
        missing_front_dates=sorted(sst_dates - front_dates),
        datasets=datasets,
    )


def write_data_manifest(manifest: DataManifestResponse, output_path: Path | None = None) -> Path:
    target = output_path or Path(manifest.manifest_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(manifest.model_dump(mode="json"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return target


def _front_dataset(root: Path, records: list[FrontFileRecord]) -> DataManifestDataset:
    dates = sorted({record.observation_date for record in records})
    return DataManifestDataset(
        dataset_type="front_location",
        root=str(root / "front"),
        file_count=len(records),
        date_count=len(dates),
        size_bytes=sum(record.size_bytes for record in records),
        available_date_start=dates[0] if dates else None,
        available_date_end=dates[-1] if dates else None,
        available_dates=dates,
        available_years=_years(dates),
        available_months=_months(dates),
        variables=["front"],
        message=None if records else "未发现 front_location NetCDF 文件",
    )


def _sst_dataset(root: Path, records: list[SstFileRecord]) -> DataManifestDataset:
    dates = sorted({item for record in records for item in record.observation_dates})
    return DataManifestDataset(
        dataset_type="sst",
        root=str(root / "sst"),
        file_count=len(records),
        date_count=len(dates),
        size_bytes=sum(record.size_bytes for record in records),
        available_date_start=dates[0] if dates else None,
        available_date_end=dates[-1] if dates else None,
        available_dates=dates,
        available_years=_years(dates),
        available_months=_months(dates),
        variables=["analysed_sst"],
        message=None if records else "未发现 SST NetCDF 文件",
    )


def _intensity_dataset(
    root: Path,
    records: list[FrontIntensityFileRecord],
) -> DataManifestDataset:
    dates = sorted({item for record in records for item in record.observation_dates})
    variables = sorted({record.variable_name for record in records if record.variable_name})
    return DataManifestDataset(
        dataset_type="front_intensity",
        root=f"{root / 'intensity'} | {root / 'front_intensity'}",
        file_count=len(records),
        date_count=len(dates),
        size_bytes=sum(record.size_bytes for record in records),
        available_date_start=dates[0] if dates else None,
        available_date_end=dates[-1] if dates else None,
        available_dates=dates,
        available_years=_years(dates),
        available_months=_months(dates),
        variables=variables or ["front_intensity"],
        message=None if records else "未发现锋面强度 NetCDF 文件，当前阶段可选",
    )


def _years(dates: list[date]) -> list[int]:
    return sorted({item.year for item in dates})


def _months(dates: list[date]) -> list[str]:
    return sorted({f"{item.year}-{item.month:02d}" for item in dates})
