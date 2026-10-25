from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from .data_access import FrontFileRecord, SstFileRecord, scan_front_records, scan_sst_records
from .data_inventory import build_data_manifest
from .schemas import DataPreparationGroup, DataPreparationPlanResponse

ZENODO_FRONT_LOCATION_URL = "https://zenodo.org/records/20356239"
FRONT_LOCATION_ARCHIVE_KEY = "front_location.zip"
FRONT_INTENSITY_ARCHIVE_PATTERN = "front_intensity_YYYY.zip"
COPERNICUS_SST_DATASET_ID = "C3S-GLO-SST-L4-REP-OBS-SST"


def build_data_preparation_plan(
    raw_data_dir: Path,
    processed_dir: Path,
    *,
    reference_date: date | None = None,
    target_days: int = 14,
    historical_year_start: int = 1982,
    historical_year_end: int = 2024,
    historical_window_days: int = 3,
) -> DataPreparationPlanResponse:
    manifest = build_data_manifest(raw_data_dir, processed_dir)
    front_records = scan_front_records(raw_data_dir)
    sst_records = scan_sst_records(raw_data_dir)
    front_dates = {record.observation_date for record in front_records}
    sst_dates = {item for record in sst_records for item in record.observation_dates}
    local_dates = sorted(front_dates | sst_dates)
    target_dates = _default_target_dates(local_dates, reference_date, target_days)
    target_missing_front_dates = sorted(set(target_dates) - front_dates)
    target_missing_sst_dates = sorted(set(target_dates) - sst_dates)
    historical_reference_date = reference_date or (local_dates[0] if local_dates else None)
    historical_target_dates = _historical_target_dates(
        historical_reference_date,
        historical_year_start,
        historical_year_end,
        historical_window_days,
    )
    historical_missing_front_dates = sorted(set(historical_target_dates) - front_dates)
    historical_missing_sst_dates = sorted(set(historical_target_dates) - sst_dates)
    historical_paired_dates = sorted(set(historical_target_dates) & front_dates & sst_dates)
    duplicate_front_groups = _front_duplicates(raw_data_dir, front_records)
    duplicate_sst_groups = _sst_duplicates(raw_data_dir, sst_records)
    recommended_steps = _recommended_steps(
        missing_front_dates=manifest.missing_front_dates,
        missing_sst_dates=manifest.missing_sst_dates,
        target_missing_front_dates=target_missing_front_dates,
        target_missing_sst_dates=target_missing_sst_dates,
        historical_target_dates=historical_target_dates,
        historical_paired_date_count=len(historical_paired_dates),
        duplicate_front_groups=duplicate_front_groups,
        duplicate_sst_groups=duplicate_sst_groups,
        paired_date_count=manifest.paired_date_count,
    )
    download_commands = _download_commands(target_missing_front_dates, target_missing_sst_dates)
    historical_download_commands = _download_commands(
        historical_missing_front_dates,
        historical_missing_sst_dates,
        include_validation=False,
    )
    return DataPreparationPlanResponse(
        generated_at=datetime.now(UTC).isoformat(),
        raw_data_dir=str(raw_data_dir),
        manifest_path=manifest.manifest_path,
        target_date_start=target_dates[0] if target_dates else None,
        target_date_end=target_dates[-1] if target_dates else None,
        target_dates=target_dates,
        front_file_count=next(
            (item.file_count for item in manifest.datasets if item.dataset_type == "front_location"),
            0,
        ),
        sst_file_count=next((item.file_count for item in manifest.datasets if item.dataset_type == "sst"), 0),
        paired_date_count=manifest.paired_date_count,
        paired_dates=manifest.paired_dates,
        missing_front_dates=manifest.missing_front_dates,
        missing_sst_dates=manifest.missing_sst_dates,
        target_missing_front_dates=target_missing_front_dates,
        target_missing_sst_dates=target_missing_sst_dates,
        historical_reference_date=historical_reference_date,
        historical_year_start=historical_year_start,
        historical_year_end=historical_year_end,
        historical_window_days=historical_window_days,
        historical_target_date_count=len(historical_target_dates),
        historical_paired_date_count=len(historical_paired_dates),
        historical_missing_front_dates=historical_missing_front_dates,
        historical_missing_sst_dates=historical_missing_sst_dates,
        duplicate_front_groups=duplicate_front_groups,
        duplicate_sst_groups=duplicate_sst_groups,
        recommended_steps=recommended_steps,
        download_commands=download_commands,
        historical_download_commands=historical_download_commands,
        source_notes=[
            f"Zenodo 20356239 提供 {FRONT_LOCATION_ARCHIVE_KEY}，约 18.3 GiB，适合按日期 Range 抽取 front_location 日文件。",
            f"Zenodo 20356239 还提供 {FRONT_INTENSITY_ARCHIVE_PATTERN}，每年约 2 GiB，当前第一阶段不是必需数据。",
            f"SST 使用 Copernicus {COPERNICUS_SST_DATASET_ID}，需要按目标日期和经纬度范围下载到 data/raw/sst/YYYY。",
            "历史概率的可信度取决于本地 front 与 SST 已配对日期数量；样本少时只能作为流程演示。",
        ],
    )


def _default_target_dates(
    local_dates: list[date],
    reference_date: date | None,
    target_days: int,
) -> list[date]:
    start = reference_date or (local_dates[0] if local_dates else None)
    if start is None:
        return []
    bounded_days = max(1, min(60, target_days))
    return [start + timedelta(days=offset) for offset in range(bounded_days)]


def _historical_target_dates(
    reference_date: date | None,
    year_start: int,
    year_end: int,
    window_days: int,
) -> list[date]:
    if reference_date is None:
        return []
    start_year = min(year_start, year_end)
    end_year = max(year_start, year_end)
    bounded_days = max(1, min(31, window_days))
    dates: list[date] = []
    seen: set[date] = set()
    for year in range(start_year, end_year + 1):
        try:
            base_date = date(year, reference_date.month, reference_date.day)
        except ValueError:
            continue
        for offset in range(bounded_days):
            item = base_date + timedelta(days=offset)
            if item in seen:
                continue
            seen.add(item)
            dates.append(item)
    return dates


def _front_duplicates(raw_data_dir: Path, records: list[FrontFileRecord]) -> list[DataPreparationGroup]:
    grouped: dict[date, list[FrontFileRecord]] = {}
    for record in records:
        grouped.setdefault(record.observation_date, []).append(record)
    duplicates: list[DataPreparationGroup] = []
    for observation_date, items in sorted(grouped.items()):
        if len(items) <= 1:
            continue
        sorted_items = sorted(items, key=lambda item: (item.size_bytes, str(item.path)), reverse=True)
        duplicates.append(
            DataPreparationGroup(
                observation_dates=[observation_date],
                file_count=len(sorted_items),
                size_bytes=sum(item.size_bytes for item in sorted_items),
                paths=[item.path.relative_to(raw_data_dir).as_posix() for item in sorted_items],
                canonical_path=sorted_items[0].path.relative_to(raw_data_dir).as_posix(),
                note="同一 front 日期存在多个文件，建议保留 canonical_path，其余移入备份目录后重建 manifest。",
            )
        )
    return duplicates


def _sst_duplicates(raw_data_dir: Path, records: list[SstFileRecord]) -> list[DataPreparationGroup]:
    grouped = _overlapping_sst_groups(records)
    duplicates: list[DataPreparationGroup] = []
    for observation_dates, items in sorted(grouped, key=lambda pair: pair[0]):
        if len(items) <= 1:
            continue
        sorted_items = sorted(
            items,
            key=lambda item: (len(item.observation_dates), item.size_bytes, str(item.path)),
            reverse=True,
        )
        duplicates.append(
            DataPreparationGroup(
                observation_dates=list(observation_dates),
                file_count=len(sorted_items),
                size_bytes=sum(item.size_bytes for item in sorted_items),
                paths=[item.path.relative_to(raw_data_dir).as_posix() for item in sorted_items],
                canonical_path=sorted_items[0].path.relative_to(raw_data_dir).as_posix(),
                note="这些 SST 文件存在日期覆盖重叠，建议保留覆盖日期更多且体积更完整的 canonical_path。",
            )
        )
    return duplicates


def _overlapping_sst_groups(records: list[SstFileRecord]) -> list[tuple[tuple[date, ...], list[SstFileRecord]]]:
    groups: list[tuple[set[date], list[SstFileRecord]]] = []
    for record in sorted(records, key=lambda item: (item.observation_dates, str(item.path))):
        record_dates = set(record.observation_dates)
        if not record_dates:
            continue
        matched_indexes = [
            index
            for index, (group_dates, _) in enumerate(groups)
            if group_dates & record_dates
        ]
        if not matched_indexes:
            groups.append((set(record_dates), [record]))
            continue
        first_index = matched_indexes[0]
        groups[first_index][0].update(record_dates)
        groups[first_index][1].append(record)
        for index in reversed(matched_indexes[1:]):
            dates, items = groups.pop(index)
            groups[first_index][0].update(dates)
            groups[first_index][1].extend(items)
    return [(tuple(sorted(dates)), items) for dates, items in groups]


def _recommended_steps(
    *,
    missing_front_dates: list[date],
    missing_sst_dates: list[date],
    target_missing_front_dates: list[date],
    target_missing_sst_dates: list[date],
    historical_target_dates: list[date],
    historical_paired_date_count: int,
    duplicate_front_groups: list[DataPreparationGroup],
    duplicate_sst_groups: list[DataPreparationGroup],
    paired_date_count: int,
) -> list[str]:
    steps: list[str] = []
    if duplicate_sst_groups or duplicate_front_groups:
        steps.append("先处理重复文件：保留 canonical_path，将其余重复文件移入 data/raw/_duplicates_backup，再重建 manifest。")
    if missing_front_dates:
        steps.append("补齐缺失 front_location 日期，优先用 fetch_zenodo_front_samples.py 从 Zenodo 大 zip 中按日期抽取。")
    if missing_sst_dates:
        steps.append("补齐缺失 SST 日期，使用 Copernicus subset 按目标区域和日期生成本地 NetCDF。")
    if target_missing_front_dates or target_missing_sst_dates:
        steps.append("第一阶段建议先扩到 14 天连续样本，当前目标窗口仍有 front/SST 日期需要补齐。")
    if paired_date_count < 5:
        steps.append("当前配对样本少于 5 天，建议先扩展到至少 7—14 个连续日期，便于演示趋势和追踪。")
    if historical_target_dates and historical_paired_date_count < min(30, len(historical_target_dates)):
        steps.append("若要向老师展示历史概率可信度，建议再补同月跨年份样本，例如每年 8 月 5 日附近窗口。")
    steps.append("每次新增或整理数据后运行 build_data_manifest.py，并重新执行 phase1_12_smoke.py。")
    return steps


def _download_commands(
    missing_front_dates: list[date],
    missing_sst_dates: list[date],
    *,
    include_validation: bool = True,
) -> list[str]:
    commands: list[str] = []
    if missing_front_dates:
        date_args = " ".join(item.isoformat() for item in missing_front_dates[:14])
        commands.append(
            "python backend/scripts/fetch_zenodo_front_samples.py "
            f"{date_args}"
        )
    if missing_sst_dates:
        sst_run = _first_consecutive_run(missing_sst_dates, limit=14)
        first = sst_run[0]
        last = sst_run[-1]
        commands.append(
            "copernicusmarine subset --dataset-id "
            f"{COPERNICUS_SST_DATASET_ID} --variable analysed_sst "
            f"--start-datetime {first.isoformat()}T00:00:00 "
            f"--end-datetime {last.isoformat()}T00:00:00 "
            "--minimum-longitude <west> --maximum-longitude <east> "
            "--minimum-latitude <south> --maximum-latitude <north> "
            "--output-directory data/raw/sst/<year> "
            f"--output-filename sst_{first:%Y%m%d}_{last:%Y%m%d}.nc"
        )
    if include_validation:
        commands.append("python backend/scripts/build_data_manifest.py")
        commands.append("python backend/scripts/phase1_12_smoke.py")
    return commands


def _first_consecutive_run(dates: list[date], *, limit: int) -> list[date]:
    if not dates:
        return []
    sorted_dates = sorted(dates)
    run = [sorted_dates[0]]
    for item in sorted_dates[1:]:
        if len(run) >= limit:
            break
        if item == run[-1] + timedelta(days=1):
            run.append(item)
        elif len(run) == 1:
            run = [item]
        else:
            break
    return run
