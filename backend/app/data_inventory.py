from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

from .data_access import (
    FrontFileRecord,
    SstFileRecord,
    infer_date,
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
    intensity_records = _scan_dated_files(raw_data_dir, ("intensity", "front_intensity"))

    front_dates = {record.observation_date for record in front_records}
    sst_dates = {item for record in sst_records for item in record.observation_dates}
    paired_dates = sorted(front_dates & sst_dates)

    datasets = [
        _front_dataset(raw_data_dir, front_records),
        _sst_dataset(raw_data_dir, sst_records),
        _dated_file_dataset(raw_data_dir, "front_intensity", intensity_records, ["frontal_intensity"]),
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


def _scan_dated_files(raw_data_dir: Path, directory_names: tuple[str, ...]) -> list[tuple[Path, date]]:
    records: list[tuple[Path, date]] = []
    for directory_name in directory_names:
        root = raw_data_dir / directory_name
        if not root.exists():
            continue
        for path in sorted({*root.rglob("*.nc"), *root.rglob("*.nc4")}):
            observation_date = infer_date(path)
            if observation_date is not None:
                records.append((path, observation_date))
    return records


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


def _dated_file_dataset(
    root: Path,
    dataset_type: str,
    records: list[tuple[Path, date]],
    variables: list[str],
) -> DataManifestDataset:
    dates = sorted({observation_date for _, observation_date in records})
    return DataManifestDataset(
        dataset_type=dataset_type,
        root=f"{root / 'intensity'} | {root / 'front_intensity'}",
        file_count=len(records),
        date_count=len(dates),
        size_bytes=sum(path.stat().st_size for path, _ in records),
        available_date_start=dates[0] if dates else None,
        available_date_end=dates[-1] if dates else None,
        available_dates=dates,
        available_years=_years(dates),
        available_months=_months(dates),
        variables=variables,
        message=None if records else "未发现锋面强度 NetCDF 文件，当前阶段可选",
    )


def _years(dates: list[date]) -> list[int]:
    return sorted({item.year for item in dates})


def _months(dates: list[date]) -> list[str]:
    return sorted({f"{item.year}-{item.month:02d}" for item in dates})
