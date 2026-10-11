from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

from .data_access import (
    FrontFileRecord,
    SstFileRecord,
    infer_date,
    scan_front_records,
    scan_sst_records,
)
from .schemas import (
    DataIndexDatasetSummary,
    DataIndexDateFile,
    DataIndexDateResponse,
    DataIndexResponse,
)

DATA_INDEX_SCHEMA_VERSION = "data-index-v1"
DATASET_FRONT = "front_location"
DATASET_SST = "sst"
DATASET_INTENSITY = "front_intensity"
INDEX_FILENAME = "data_index.sqlite"


@dataclass(frozen=True)
class IndexedFileRecord:
    dataset_type: str
    path: Path
    observation_dates: tuple[date, ...]
    size_bytes: int
    mtime_ns: int


def data_index_path(processed_dir: Path) -> Path:
    return processed_dir / INDEX_FILENAME


def build_sqlite_data_index(raw_data_dir: Path, processed_dir: Path) -> DataIndexResponse:
    """Rebuild a portable SQLite metadata index for local NetCDF assets."""

    index_path = data_index_path(processed_dir)
    processed_dir.mkdir(parents=True, exist_ok=True)
    # 临时文件名带上 pid：两个重建撞在一起时（例如抓数管线按年触发 + 人手动 POST）会互相
    # 抢同一个 .tmp，先完成的把文件 rename 走，后一个就 FileNotFoundError → 500。
    # （2026-09-24 线上真撞到过一次。）os.replace 仍是原子的，读者不会看到半成品。
    temp_path = index_path.with_name(f"{index_path.name}.{os.getpid()}.tmp")
    if temp_path.exists():
        temp_path.unlink()

    records = _collect_index_records(raw_data_dir)
    connection = sqlite3.connect(temp_path)
    try:
        _create_schema(connection)
        generated_at = datetime.now(UTC).isoformat(timespec="seconds")
        _write_meta(connection, "schema_version", DATA_INDEX_SCHEMA_VERSION)
        _write_meta(connection, "generated_at", generated_at)
        _write_meta(connection, "raw_data_dir", str(raw_data_dir))
        for record in records:
            _insert_record(connection, raw_data_dir, record)
        connection.commit()
    finally:
        connection.close()

    temp_path.replace(index_path)
    return summarize_sqlite_data_index(raw_data_dir, processed_dir)


def get_or_build_sqlite_data_index(raw_data_dir: Path, processed_dir: Path) -> DataIndexResponse:
    index_path = data_index_path(processed_dir)
    if not index_path.is_file():
        return build_sqlite_data_index(raw_data_dir, processed_dir)
    return summarize_sqlite_data_index(raw_data_dir, processed_dir)


def lookup_indexed_date(
    raw_data_dir: Path,
    processed_dir: Path,
    observation_date: date,
) -> DataIndexDateResponse:
    index_path = data_index_path(processed_dir)
    if not index_path.is_file():
        build_sqlite_data_index(raw_data_dir, processed_dir)

    files: list[DataIndexDateFile] = []
    try:
        connection = sqlite3.connect(index_path)
        connection.row_factory = sqlite3.Row
        try:
            rows = connection.execute(
                """
                select
                    files.dataset_type,
                    files.relative_path,
                    files.size_bytes,
                    files.date_count,
                    files.date_start,
                    files.date_end
                from file_dates
                join files on files.id = file_dates.file_id
                where file_dates.observation_date = ?
                order by files.dataset_type, files.relative_path
                """,
                (observation_date.isoformat(),),
            ).fetchall()
        finally:
            connection.close()
    except sqlite3.Error as exc:
        return DataIndexDateResponse(
            observation_date=observation_date,
            complete=False,
            front_file_count=0,
            sst_file_count=0,
            intensity_file_count=0,
            files=[],
            index_path=str(index_path),
            notes=[f"SQLite 数据索引读取失败：{exc}"],
        )

    canonical_paths = _canonical_paths_by_dataset(rows)
    for row in rows:
        dataset_type = str(row["dataset_type"])
        relative_path = str(row["relative_path"])
        files.append(
            DataIndexDateFile(
                dataset_type=dataset_type,
                relative_path=relative_path,
                size_bytes=int(row["size_bytes"]),
                date_count=int(row["date_count"]),
                date_start=_coerce_iso_date(row["date_start"]),
                date_end=_coerce_iso_date(row["date_end"]),
                canonical=canonical_paths.get(dataset_type) == relative_path,
            )
        )
    front_file_count = sum(1 for item in files if item.dataset_type == DATASET_FRONT)
    sst_file_count = sum(1 for item in files if item.dataset_type == DATASET_SST)
    intensity_file_count = sum(1 for item in files if item.dataset_type == DATASET_INTENSITY)
    notes = _date_lookup_notes(front_file_count, sst_file_count, intensity_file_count)
    return DataIndexDateResponse(
        observation_date=observation_date,
        complete=front_file_count > 0 and sst_file_count > 0,
        front_file_count=front_file_count,
        sst_file_count=sst_file_count,
        intensity_file_count=intensity_file_count,
        files=files,
        index_path=str(index_path),
        notes=notes,
    )


def load_records_from_sqlite_data_index(
    raw_data_dir: Path,
    processed_dir: Path,
) -> tuple[list[FrontFileRecord], list[SstFileRecord]] | None:
    index_path = data_index_path(processed_dir)
    if not index_path.is_file():
        return None
    try:
        connection = sqlite3.connect(index_path)
        connection.row_factory = sqlite3.Row
        try:
            front_rows = connection.execute(
                """
                select relative_path, size_bytes, mtime_ns, date_start
                from files
                where dataset_type = ?
                order by date_start, relative_path
                """,
                (DATASET_FRONT,),
            ).fetchall()
            sst_rows = connection.execute(
                """
                select id, relative_path, size_bytes, mtime_ns
                from files
                where dataset_type = ?
                order by date_start, relative_path
                """,
                (DATASET_SST,),
            ).fetchall()
            sst_date_rows = connection.execute(
                """
                select file_id, observation_date
                from file_dates
                where dataset_type = ?
                order by file_id, observation_date
                """,
                (DATASET_SST,),
            ).fetchall()
        finally:
            connection.close()
    except sqlite3.Error:
        return None

    sst_dates_by_file: dict[int, list[date]] = {}
    for row in sst_date_rows:
        coerced = _coerce_iso_date(row["observation_date"])
        if coerced is None:
            continue
        sst_dates_by_file.setdefault(int(row["file_id"]), []).append(coerced)

    front_records = [
        FrontFileRecord(
            path=raw_data_dir / str(row["relative_path"]),
            observation_date=observation_date,
            size_bytes=int(row["size_bytes"]),
            mtime_ns=int(row["mtime_ns"]),
        )
        for row in front_rows
        if (observation_date := _coerce_iso_date(row["date_start"])) is not None
    ]
    sst_records = [
        SstFileRecord(
            path=raw_data_dir / str(row["relative_path"]),
            observation_dates=tuple(sst_dates_by_file.get(int(row["id"]), [])),
            size_bytes=int(row["size_bytes"]),
            mtime_ns=int(row["mtime_ns"]),
        )
        for row in sst_rows
        if sst_dates_by_file.get(int(row["id"]))
    ]
    return front_records, sst_records


def summarize_sqlite_data_index(raw_data_dir: Path, processed_dir: Path) -> DataIndexResponse:
    index_path = data_index_path(processed_dir)
    if not index_path.is_file():
        return _empty_response(raw_data_dir, index_path, "SQLite 数据索引尚未生成。")

    try:
        connection = sqlite3.connect(index_path)
        connection.row_factory = sqlite3.Row
        try:
            schema_version = _read_meta(connection, "schema_version") or "unknown"
            generated_at = _read_meta(connection, "generated_at") or ""
            datasets = [
                _dataset_summary(connection, dataset_type)
                for dataset_type in (DATASET_FRONT, DATASET_SST, DATASET_INTENSITY)
            ]
            total_file_count = _single_int(connection, "select count(*) from files")
            total_size_bytes = _single_int(connection, "select coalesce(sum(size_bytes), 0) from files")
            indexed_date_count = _single_int(
                connection,
                """
                select count(distinct observation_date)
                from file_dates
                where dataset_type in ('front_location', 'sst')
                """,
            )
            paired_dates = _date_list(
                connection,
                """
                select observation_date from file_dates where dataset_type = 'front_location'
                intersect
                select observation_date from file_dates where dataset_type = 'sst'
                order by observation_date
                """,
            )
            missing_sst_dates = _date_list(
                connection,
                """
                select observation_date from file_dates where dataset_type = 'front_location'
                except
                select observation_date from file_dates where dataset_type = 'sst'
                order by observation_date
                """,
            )
            missing_front_dates = _date_list(
                connection,
                """
                select observation_date from file_dates where dataset_type = 'sst'
                except
                select observation_date from file_dates where dataset_type = 'front_location'
                order by observation_date
                """,
            )
        finally:
            connection.close()
    except sqlite3.Error as exc:
        return _empty_response(raw_data_dir, index_path, f"SQLite 数据索引读取失败：{exc}")

    integrity_warnings = _integrity_warnings(
        datasets=datasets,
        missing_sst_dates=missing_sst_dates,
        missing_front_dates=missing_front_dates,
        schema_version=schema_version,
    )
    return DataIndexResponse(
        ready=bool(total_file_count),
        generated_at=generated_at,
        raw_data_dir=str(raw_data_dir),
        index_path=str(index_path),
        schema_version=schema_version,
        sqlite_size_bytes=index_path.stat().st_size,
        total_file_count=total_file_count,
        total_size_bytes=total_size_bytes,
        indexed_date_count=indexed_date_count,
        paired_date_count=len(paired_dates),
        missing_sst_dates=missing_sst_dates,
        missing_front_dates=missing_front_dates,
        datasets=datasets,
        integrity_warnings=integrity_warnings,
        query_examples=_query_examples(),
    )


def _collect_index_records(raw_data_dir: Path) -> list[IndexedFileRecord]:
    records: list[IndexedFileRecord] = []
    for record in scan_front_records(raw_data_dir):
        records.append(_from_front_record(record))
    for record in scan_sst_records(raw_data_dir):
        records.append(_from_sst_record(record))
    records.extend(_scan_intensity_records(raw_data_dir))
    return records


def _from_front_record(record: FrontFileRecord) -> IndexedFileRecord:
    return IndexedFileRecord(
        dataset_type=DATASET_FRONT,
        path=record.path,
        observation_dates=(record.observation_date,),
        size_bytes=record.size_bytes,
        mtime_ns=record.mtime_ns,
    )


def _from_sst_record(record: SstFileRecord) -> IndexedFileRecord:
    return IndexedFileRecord(
        dataset_type=DATASET_SST,
        path=record.path,
        observation_dates=record.observation_dates,
        size_bytes=record.size_bytes,
        mtime_ns=record.mtime_ns,
    )


def _scan_intensity_records(raw_data_dir: Path) -> list[IndexedFileRecord]:
    records: list[IndexedFileRecord] = []
    for directory_name in ("intensity", "front_intensity"):
        root = raw_data_dir / directory_name
        if not root.exists():
            continue
        for path in sorted({*root.rglob("*.nc"), *root.rglob("*.nc4")}):
            observation_date = infer_date(path)
            if observation_date is None:
                continue
            stat = path.stat()
            records.append(
                IndexedFileRecord(
                    dataset_type=DATASET_INTENSITY,
                    path=path,
                    observation_dates=(observation_date,),
                    size_bytes=stat.st_size,
                    mtime_ns=stat.st_mtime_ns,
                )
            )
    return records


def _create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        create table meta (
            key text primary key,
            value text not null
        );

        create table files (
            id integer primary key autoincrement,
            dataset_type text not null,
            relative_path text not null unique,
            size_bytes integer not null,
            mtime_ns integer not null,
            date_start text,
            date_end text,
            date_count integer not null
        );

        create table file_dates (
            file_id integer not null references files(id) on delete cascade,
            dataset_type text not null,
            observation_date text not null,
            primary key (file_id, observation_date)
        );

        create index idx_file_dates_dataset_date on file_dates(dataset_type, observation_date);
        create index idx_file_dates_date on file_dates(observation_date);
        """
    )


def _write_meta(connection: sqlite3.Connection, key: str, value: str) -> None:
    connection.execute(
        "insert or replace into meta(key, value) values (?, ?)",
        (key, value),
    )


def _read_meta(connection: sqlite3.Connection, key: str) -> str | None:
    row = connection.execute("select value from meta where key = ?", (key,)).fetchone()
    return str(row["value"]) if row is not None else None


def _insert_record(connection: sqlite3.Connection, raw_data_dir: Path, record: IndexedFileRecord) -> None:
    dates = sorted(set(record.observation_dates))
    cursor = connection.execute(
        """
        insert into files(
            dataset_type,
            relative_path,
            size_bytes,
            mtime_ns,
            date_start,
            date_end,
            date_count
        )
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.dataset_type,
            _relative_path(record.path, raw_data_dir),
            record.size_bytes,
            record.mtime_ns,
            dates[0].isoformat() if dates else None,
            dates[-1].isoformat() if dates else None,
            len(dates),
        ),
    )
    file_id = int(cursor.lastrowid)
    connection.executemany(
        """
        insert into file_dates(file_id, dataset_type, observation_date)
        values (?, ?, ?)
        """,
        [(file_id, record.dataset_type, value.isoformat()) for value in dates],
    )


def _relative_path(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def _dataset_summary(connection: sqlite3.Connection, dataset_type: str) -> DataIndexDatasetSummary:
    row = connection.execute(
        """
        select
            count(*) as file_count,
            coalesce(sum(size_bytes), 0) as size_bytes,
            min(date_start) as date_start,
            max(date_end) as date_end
        from files
        where dataset_type = ?
        """,
        (dataset_type,),
    ).fetchone()
    dates = _date_list(
        connection,
        "select distinct observation_date from file_dates where dataset_type = ? order by observation_date",
        (dataset_type,),
    )
    duplicate_date_count = _single_int(
        connection,
        """
        select count(*) from (
            select observation_date, count(distinct file_id) as file_count
            from file_dates
            where dataset_type = ?
            group by observation_date
            having file_count > 1
        )
        """,
        (dataset_type,),
    )
    example_paths = [
        str(item["relative_path"])
        for item in connection.execute(
            """
            select relative_path
            from files
            where dataset_type = ?
            order by date_start, relative_path
            limit 5
            """,
            (dataset_type,),
        ).fetchall()
    ]
    return DataIndexDatasetSummary(
        dataset_type=dataset_type,
        file_count=int(row["file_count"]),
        date_count=len(dates),
        size_bytes=int(row["size_bytes"]),
        available_date_start=dates[0] if dates else None,
        available_date_end=dates[-1] if dates else None,
        available_years=sorted({value.year for value in dates}),
        available_months=sorted({f"{value.year:04d}-{value.month:02d}" for value in dates}),
        duplicate_date_count=duplicate_date_count,
        example_paths=example_paths,
    )


def _single_int(
    connection: sqlite3.Connection,
    query: str,
    parameters: tuple[object, ...] = (),
) -> int:
    row = connection.execute(query, parameters).fetchone()
    if row is None:
        return 0
    return int(row[0] or 0)


def _date_list(
    connection: sqlite3.Connection,
    query: str,
    parameters: tuple[object, ...] = (),
) -> list[date]:
    values: list[date] = []
    for row in connection.execute(query, parameters).fetchall():
        try:
            values.append(date.fromisoformat(str(row[0])))
        except ValueError:
            continue
    return values


def _coerce_iso_date(value: object) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _canonical_paths_by_dataset(rows: list[sqlite3.Row]) -> dict[str, str]:
    canonical: dict[str, str] = {}
    candidates: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        candidates.setdefault(str(row["dataset_type"]), []).append(row)
    for dataset_type, items in candidates.items():
        selected = max(
            items,
            key=lambda row: (
                int(row["date_count"]),
                int(row["size_bytes"]),
                str(row["relative_path"]),
            ),
        )
        canonical[dataset_type] = str(selected["relative_path"])
    return canonical


def _date_lookup_notes(
    front_file_count: int,
    sst_file_count: int,
    intensity_file_count: int,
) -> list[str]:
    notes: list[str] = []
    if front_file_count == 0:
        notes.append("该日期缺少 front_location 文件。")
    if sst_file_count == 0:
        notes.append("该日期缺少 SST 文件。")
    if front_file_count and sst_file_count:
        notes.append("该日期 front/SST 已配对，可执行单日分析、历史统计和报告生成。")
    if intensity_file_count == 0:
        notes.append("未发现该日期的 front_intensity 文件；当前阶段可不使用。")
    return notes


def _integrity_warnings(
    *,
    datasets: list[DataIndexDatasetSummary],
    missing_sst_dates: list[date],
    missing_front_dates: list[date],
    schema_version: str,
) -> list[str]:
    warnings: list[str] = []
    dataset_by_type = {dataset.dataset_type: dataset for dataset in datasets}
    if schema_version != DATA_INDEX_SCHEMA_VERSION:
        warnings.append("索引 schema 版本与当前代码不一致，建议重新构建 SQLite 数据索引。")
    if dataset_by_type.get(DATASET_FRONT, _empty_dataset(DATASET_FRONT)).file_count == 0:
        warnings.append("未索引到 front_location 文件，当前无法执行锋面检测和历史概率。")
    if dataset_by_type.get(DATASET_SST, _empty_dataset(DATASET_SST)).file_count == 0:
        warnings.append("未索引到 SST 文件，当前无法计算海温统计和温度梯度。")
    if missing_sst_dates:
        warnings.append(f"有 {len(missing_sst_dates)} 个 front 日期缺少 SST 配对。")
    if missing_front_dates:
        warnings.append(f"有 {len(missing_front_dates)} 个 SST 日期缺少 front 配对。")
    for dataset in datasets:
        if dataset.duplicate_date_count:
            warnings.append(f"{dataset.dataset_type} 有 {dataset.duplicate_date_count} 个日期存在重复文件。")
    return warnings


def _empty_dataset(dataset_type: str) -> DataIndexDatasetSummary:
    return DataIndexDatasetSummary(
        dataset_type=dataset_type,
        file_count=0,
        date_count=0,
        size_bytes=0,
        available_date_start=None,
        available_date_end=None,
        available_years=[],
        available_months=[],
        duplicate_date_count=0,
        example_paths=[],
    )


def _query_examples() -> list[str]:
    return [
        "select relative_path from files where dataset_type = 'front_location' and date_start = '2024-08-05';",
        "select observation_date from file_dates where dataset_type = 'front_location' intersect select observation_date from file_dates where dataset_type = 'sst';",
        "select observation_date from file_dates where dataset_type = 'front_location' except select observation_date from file_dates where dataset_type = 'sst';",
    ]


def _empty_response(raw_data_dir: Path, index_path: Path, warning: str) -> DataIndexResponse:
    return DataIndexResponse(
        ready=False,
        generated_at="",
        raw_data_dir=str(raw_data_dir),
        index_path=str(index_path),
        schema_version=DATA_INDEX_SCHEMA_VERSION,
        sqlite_size_bytes=0,
        total_file_count=0,
        total_size_bytes=0,
        indexed_date_count=0,
        paired_date_count=0,
        missing_sst_dates=[],
        missing_front_dates=[],
        datasets=[
            _empty_dataset(DATASET_FRONT),
            _empty_dataset(DATASET_SST),
            _empty_dataset(DATASET_INTENSITY),
        ],
        integrity_warnings=[warning],
        query_examples=_query_examples(),
    )
