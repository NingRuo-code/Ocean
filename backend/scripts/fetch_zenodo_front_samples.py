import argparse
import os
import shutil
import sys
import time
from datetime import date
from pathlib import Path

import requests
from remotezip import RemoteZip
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ARCHIVE_URL = (
    "https://zenodo.org/records/20356239/files/front_location.zip?download=1"
)
# 实测（2026-09）：同一份归档，`/api/records/<id>/files/<name>/content` 只有 17–29 KB/s
# 且 range 请求频繁超时（remotezip 读中央目录直接 IncompleteRead 失败）；
# 换成 `?download=1` 这条链接实测 198 KB/s、2 MB range 10 秒拿完。
# 两条链接内容相同，只是 Zenodo 的分发路径不同，所以默认走后者，并留 --archive-url 可覆盖。

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# 与后端同一套约定：服务器上用 OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw，本地退回仓内 data/raw
_REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = Path(os.environ["OCEAN_RAW_DATA_DIR"]) if os.environ.get("OCEAN_RAW_DATA_DIR") else _REPO_ROOT / "data" / "raw"


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from error


def member_name(observation_date: date) -> str:
    return f"front_location/front_location{observation_date:%Y%m%d}.nc"


def retrying_session() -> requests.Session:
    retry = Retry(
        total=8,
        connect=8,
        read=8,
        status=8,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "HEAD"}),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers.update(
        {
            "User-Agent": "OceanFrontResearchPrototype/0.1",
            "Connection": "close",
        }
    )
    return session


def fetch(
    dates: list[date],
    output_root: Path,
    *,
    force: bool = False,
    continue_on_error: bool = False,
    timeout: tuple[float, float] = (10, 60),
    retries: int = 4,
    retry_wait: float = 2.0,
    archive_url: str = ARCHIVE_URL,
) -> None:
    session = retrying_session()
    failures: list[str] = []
    for open_attempt in range(1, retries + 1):
        try:
            print(f"opening remote archive: {archive_url}", flush=True)
            with RemoteZip(
                archive_url,
                session=session,
                timeout=timeout,
                initial_buffer_size=1024 * 1024,
            ) as archive:
                available = {item.filename: item for item in archive.infolist()}
                print(f"archive entries discovered: {len(available)}", flush=True)
                failures = _fetch_dates(
                    archive,
                    available,
                    dates,
                    output_root,
                    force=force,
                    continue_on_error=continue_on_error,
                    retries=retries,
                    retry_wait=retry_wait,
                )
            break
        except Exception as exc:
            # 打开 zip 中央目录这一步也会被断流（ProtocolError / IncompleteRead），
            # 所以整批重开一次；已下载的文件会被跳过，重开是幂等的。
            if open_attempt >= retries:
                session.close()
                raise
            print(
                f"reopen archive {open_attempt}/{retries - 1} after "
                f"{type(exc).__name__}: {exc}",
                flush=True,
            )
            time.sleep(retry_wait * open_attempt)
    session.close()
    if failures:
        print("completed with failures:", flush=True)
        for failure in failures:
            print(f"- {failure}", flush=True)


def _fetch_dates(
    archive: RemoteZip,
    available: dict[str, object],
    dates: list[date],
    output_root: Path,
    *,
    force: bool,
    continue_on_error: bool,
    retries: int,
    retry_wait: float,
) -> list[str]:
    failures: list[str] = []
    for index, observation_date in enumerate(dates, start=1):
        for attempt in range(1, retries + 1):
            try:
                _fetch_one(
                    archive,
                    available,
                    observation_date,
                    output_root,
                    force=force,
                    index=index,
                    total=len(dates),
                )
                break
            except Exception as exc:  # 网络断流是 ProtocolError，不属于 OSError
                last_error = f"{type(exc).__name__}: {exc}"
                if attempt < retries:
                    print(
                        f"[{index}/{len(dates)}] retry {attempt}/{retries - 1} "
                        f"{observation_date} after {last_error}",
                        flush=True,
                    )
                    time.sleep(retry_wait * attempt)
                    continue
                if not continue_on_error:
                    raise
                failures.append(f"{observation_date}: {last_error}")
                print(f"failed {observation_date}: {last_error}", flush=True)
    return failures


def _fetch_one(
    archive: RemoteZip,
    available: dict[str, object],
    observation_date: date,
    output_root: Path,
    *,
    force: bool,
    index: int,
    total: int,
) -> None:
    member = member_name(observation_date)
    if member not in available:
        raise FileNotFoundError(f"date is not present in archive: {observation_date}")

    destination = (
        output_root
        / str(observation_date.year)
        / f"front_location{observation_date:%Y%m%d}.nc"
    )
    if destination.exists() and not force:
        print(
            f"[{index}/{total}] skipped {observation_date}: {destination} exists "
            f"({destination.stat().st_size} bytes)",
            flush=True,
        )
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"[{index}/{total}] downloading {observation_date} -> {destination}", flush=True)
    # 先写 .part 再改名：断流时不会留下半截 .nc 被当成「已下载」跳过
    partial = destination.with_name(destination.name + ".part")
    try:
        with archive.open(member) as source, partial.open("wb") as target:
            shutil.copyfileobj(source, target)
        partial.replace(destination)
    except Exception:
        partial.unlink(missing_ok=True)
        raise
    print(
        f"[{index}/{total}] downloaded {observation_date}: {destination} "
        f"({destination.stat().st_size} bytes)",
        flush=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch selected daily front-location NetCDF files via HTTP Range."
    )
    parser.add_argument(
        "dates",
        nargs="+",
        type=parse_date,
        help="one or more dates using YYYY-MM-DD",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=RAW_ROOT / "front",
    )
    parser.add_argument("--force", action="store_true", help="overwrite files that already exist")
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="continue downloading other dates if one date fails",
    )
    parser.add_argument("--connect-timeout", type=float, default=10.0)
    parser.add_argument("--read-timeout", type=float, default=60.0)
    parser.add_argument(
        "--retries",
        type=int,
        default=4,
        help="per-date retry attempts (Zenodo sometimes drops the range connection)",
    )
    parser.add_argument("--retry-wait", type=float, default=2.0, help="seconds between retries")
    parser.add_argument("--archive-url", default=ARCHIVE_URL, help="归档直链（默认走 ?download=1，实测快 7 倍）")
    args = parser.parse_args()
    fetch(
        args.dates,
        args.output_root,
        force=args.force,
        continue_on_error=args.continue_on_error,
        timeout=(args.connect_timeout, args.read_timeout),
        retries=args.retries,
        retry_wait=args.retry_wait,
        archive_url=args.archive_url,
    )


if __name__ == "__main__":
    main()
