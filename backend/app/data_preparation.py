from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from .data_access import (
    FrontFileRecord,
    SstFileRecord,
    scan_front_intensity_records,
    scan_front_records,
    scan_sst_records,
)
from .data_inventory import build_data_manifest
from .schemas import (
    DataPreparationGroup,
    DataPreparationPlanResponse,
    DataPreparationPriority,
    HistoricalCoverageBatch,
)

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
    intensity_records = scan_front_intensity_records(raw_data_dir)
    front_dates = {record.observation_date for record in front_records}
    sst_dates = {item for record in sst_records for item in record.observation_dates}
    intensity_dates = {item for record in intensity_records for item in record.observation_dates}
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
    historical_missing_intensity_dates = sorted(set(historical_target_dates) - intensity_dates)
    historical_paired_dates = sorted(set(historical_target_dates) & front_dates & sst_dates)
    historical_covered_years, historical_missing_years = _historical_year_coverage(
        historical_reference_date,
        historical_year_start,
        historical_year_end,
        front_dates,
        sst_dates,
    )
    historical_coverage_ratio = (
        round(len(historical_covered_years) / (len(historical_covered_years) + len(historical_missing_years)), 4)
        if historical_covered_years or historical_missing_years
        else None
    )
    next_historical_batches = _next_historical_batches(
        reference_date=historical_reference_date,
        missing_years=historical_missing_years,
        historical_window_days=historical_window_days,
        front_dates=front_dates,
        sst_dates=sst_dates,
        intensity_dates=intensity_dates,
    )
    duplicate_front_groups = _front_duplicates(raw_data_dir, front_records)
    duplicate_sst_groups = _sst_duplicates(raw_data_dir, sst_records)
    required_front_sst_file_count = len(set(historical_missing_front_dates) | set(target_missing_front_dates)) + len(
        set(historical_missing_sst_dates) | set(target_missing_sst_dates)
    )
    optional_intensity_file_count = len(historical_missing_intensity_dates)
    readiness_score = _readiness_score(
        paired_date_count=manifest.paired_date_count,
        duplicate_front_group_count=len(duplicate_front_groups),
        duplicate_sst_group_count=len(duplicate_sst_groups),
        target_missing_front_count=len(target_missing_front_dates),
        target_missing_sst_count=len(target_missing_sst_dates),
        historical_coverage_ratio=historical_coverage_ratio,
        intensity_file_count=len(intensity_records),
    )
    readiness_level = _readiness_level(readiness_score)
    recommended_steps = _recommended_steps(
        missing_front_dates=manifest.missing_front_dates,
        missing_sst_dates=manifest.missing_sst_dates,
        target_missing_front_dates=target_missing_front_dates,
        target_missing_sst_dates=target_missing_sst_dates,
        historical_target_dates=historical_target_dates,
        historical_paired_date_count=len(historical_paired_dates),
        historical_coverage_ratio=historical_coverage_ratio,
        historical_missing_years=historical_missing_years,
        historical_missing_intensity_dates=historical_missing_intensity_dates,
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
    priority_actions = _priority_actions(
        duplicate_front_groups=duplicate_front_groups,
        duplicate_sst_groups=duplicate_sst_groups,
        target_missing_front_dates=target_missing_front_dates,
        target_missing_sst_dates=target_missing_sst_dates,
        historical_missing_years=historical_missing_years,
        historical_missing_intensity_dates=historical_missing_intensity_dates,
        next_historical_batches=next_historical_batches,
        download_commands=download_commands,
        historical_download_commands=historical_download_commands,
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
        front_intensity_file_count=next(
            (item.file_count for item in manifest.datasets if item.dataset_type == "front_intensity"),
            0,
        ),
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
        historical_coverage_ratio=historical_coverage_ratio,
        historical_covered_years=historical_covered_years,
        historical_missing_years=historical_missing_years,
        historical_missing_front_dates=historical_missing_front_dates,
        historical_missing_sst_dates=historical_missing_sst_dates,
        historical_missing_intensity_dates=historical_missing_intensity_dates,
        next_historical_batches=next_historical_batches,
        readiness_score=readiness_score,
        readiness_level=readiness_level,
        next_action=priority_actions[0].name if priority_actions else "运行总体验收 smoke，准备向老师演示。",
        required_front_sst_file_count=required_front_sst_file_count,
        optional_intensity_file_count=optional_intensity_file_count,
        priority_actions=priority_actions,
        acceptance_commands=_acceptance_commands(),
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


def _historical_year_coverage(
    reference_date: date | None,
    year_start: int,
    year_end: int,
    front_dates: set[date],
    sst_dates: set[date],
) -> tuple[list[int], list[int]]:
    if reference_date is None:
        return [], []
    start_year = min(year_start, year_end)
    end_year = max(year_start, year_end)
    covered: list[int] = []
    missing: list[int] = []
    for year in range(start_year, end_year + 1):
        try:
            target = date(year, reference_date.month, reference_date.day)
        except ValueError:
            continue
        if target in front_dates and target in sst_dates:
            covered.append(year)
        else:
            missing.append(year)
    return covered, missing


def _next_historical_batches(
    *,
    reference_date: date | None,
    missing_years: list[int],
    historical_window_days: int,
    front_dates: set[date],
    sst_dates: set[date],
    intensity_dates: set[date],
    batch_years: int = 3,
) -> list[HistoricalCoverageBatch]:
    if reference_date is None or not missing_years:
        return []
    batches: list[HistoricalCoverageBatch] = []
    bounded_window_days = max(1, min(31, historical_window_days))
    for start in range(0, min(len(missing_years), batch_years * 4), batch_years):
        years = missing_years[start:start + batch_years]
        dates: list[date] = []
        for year in years:
            try:
                base = date(year, reference_date.month, reference_date.day)
            except ValueError:
                continue
            dates.extend(base + timedelta(days=offset) for offset in range(bounded_window_days))
        if not dates:
            continue
        front_missing = [item for item in dates if item not in front_dates]
        sst_missing = [item for item in dates if item not in sst_dates]
        intensity_missing = [item for item in dates if item not in intensity_dates]
        priority = "P0" if start == 0 else "P1"
        command = (
            "python backend/scripts/prepare_historical_samples.py "
            f"--reference-date {reference_date.isoformat()} "
            f"--year-start {years[0]} --year-end {years[-1]} "
            f"--window-days {bounded_window_days} --limit-dates {min(len(dates), 9)}"
        )
        batches.append(
            HistoricalCoverageBatch(
                label=f"{years[0]}—{years[-1]} 同期窗口",
                date_start=min(dates),
                date_end=max(dates),
                date_count=len(dates),
                missing_front_count=len(front_missing),
                missing_sst_count=len(sst_missing),
                missing_intensity_count=len(intensity_missing),
                priority=priority,
                command_preview=command,
            )
        )
    return batches


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
    historical_coverage_ratio: float | None,
    historical_missing_years: list[int],
    historical_missing_intensity_dates: list[date],
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
    if historical_coverage_ratio is not None and historical_coverage_ratio < 1:
        preview_years = "、".join(str(year) for year in historical_missing_years[:8])
        suffix = " 等" if len(historical_missing_years) > 8 else ""
        steps.append(
            f"同月同日 43 年覆盖尚未完整，优先补缺失年份：{preview_years}{suffix}。"
        )
    if historical_missing_intensity_dates:
        steps.append("front_intensity 是后续增强数据：优先保证 front/SST 配对完整，再按同一日期补强度文件。")
    steps.append("每次新增或整理数据后运行 build_data_manifest.py，并重新执行 phase1_12_smoke.py。")
    return steps


def _readiness_score(
    *,
    paired_date_count: int,
    duplicate_front_group_count: int,
    duplicate_sst_group_count: int,
    target_missing_front_count: int,
    target_missing_sst_count: int,
    historical_coverage_ratio: float | None,
    intensity_file_count: int,
) -> float:
    continuous_score = min(paired_date_count / 14, 1.0) * 0.25
    historical_score = (historical_coverage_ratio or 0.0) * 0.35
    integrity_penalty = min(
        (duplicate_front_group_count + duplicate_sst_group_count) * 0.05
        + (target_missing_front_count + target_missing_sst_count) * 0.02,
        0.25,
    )
    intensity_bonus = 0.08 if intensity_file_count else 0.0
    smoke_ready_bonus = 0.32 if paired_date_count >= 3 else 0.12 if paired_date_count else 0.0
    return round(max(0.0, min(1.0, continuous_score + historical_score + intensity_bonus + smoke_ready_bonus - integrity_penalty)), 4)


def _readiness_level(score: float) -> str:
    if score >= 0.85:
        return "接近完整演示"
    if score >= 0.7:
        return "可稳定阶段演示"
    if score >= 0.45:
        return "演示级"
    if score > 0:
        return "需要补样"
    return "等待数据"


def _priority_actions(
    *,
    duplicate_front_groups: list[DataPreparationGroup],
    duplicate_sst_groups: list[DataPreparationGroup],
    target_missing_front_dates: list[date],
    target_missing_sst_dates: list[date],
    historical_missing_years: list[int],
    historical_missing_intensity_dates: list[date],
    next_historical_batches: list[HistoricalCoverageBatch],
    download_commands: list[str],
    historical_download_commands: list[str],
) -> list[DataPreparationPriority]:
    actions: list[DataPreparationPriority] = []
    if duplicate_front_groups or duplicate_sst_groups:
        actions.append(
            DataPreparationPriority(
                name="整理重复数据文件",
                level="P0",
                status="需要处理",
                reason="重复文件会影响索引 canonical 选择和历史统计源文件追溯。",
                command_preview="python backend/scripts/deduplicate_data_files.py --dry-run",
            )
        )
    if target_missing_front_dates or target_missing_sst_dates:
        command = next((item for item in download_commands if "fetch_zenodo" in item or "copernicusmarine" in item), None)
        actions.append(
            DataPreparationPriority(
                name="补齐连续演示窗口",
                level="P0",
                status="需要处理",
                reason="连续 7—14 天样本会直接影响趋势图、对象追踪和演示流畅度。",
                command_preview=command,
            )
        )
    if historical_missing_years:
        command = (
            next_historical_batches[0].command_preview
            if next_historical_batches
            else (historical_download_commands[0] if historical_download_commands else None)
        )
        preview = "、".join(str(year) for year in historical_missing_years[:6])
        suffix = " 等" if len(historical_missing_years) > 6 else ""
        actions.append(
            DataPreparationPriority(
                name="补齐跨年份同期样本",
                level="P1",
                status="建议推进",
                reason=f"缺失年份包括 {preview}{suffix}，会影响历史概率可信度。",
                command_preview=command,
            )
        )
    if historical_missing_intensity_dates:
        actions.append(
            DataPreparationPriority(
                name="接入 front_intensity 强度数据",
                level="P2",
                status="可选增强",
                reason="强度数据可增强锋面热区、对象强度和概率口径，但不阻塞当前 front/SST 主链路。",
                command_preview="将 front_intensityYYYYMMDD.nc 放入 data/raw/front_intensity/YYYY/ 后重建索引。",
            )
        )
    if not actions:
        actions.append(
            DataPreparationPriority(
                name="运行验收并准备演示",
                level="P0",
                status="可执行",
                reason="当前数据准备链路已满足阶段演示，建议固化 smoke 输出和报告。",
                command_preview="python backend/scripts/phase1_12_smoke.py",
            )
        )
    return actions[:4]


def _acceptance_commands() -> list[str]:
    return [
        "python backend/scripts/build_data_index.py",
        "python backend/scripts/phase1_12_smoke.py",
        "python backend/scripts/export_demo_report.py --date 2024-08-05 --longitude 124.5 --latitude 30.2 --radius 1 --days 3",
    ]


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
