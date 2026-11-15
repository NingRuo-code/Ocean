"""Plan or fetch selected August 2024 members from the two pinned Zenodo ZIPs."""

import argparse
import hashlib
import json
import os
import struct
import sys
import time
import zlib
from http.client import HTTPException, IncompleteRead
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from verify_august_archive_members import ROOT, check_member, load_catalog, member_path

HEADER = struct.Struct("<4s5H3I2H")
RANGE_BYTES = {"front": 128 * 1024, "gfw": 1024 * 1024}


class ArchiveError(ValueError):
    """A fixed archive response disagreed with the requested member."""


def read_range(url: str, total: int, start: int, stop: int) -> bytes:
    if not 0 <= start < stop <= total:
        raise ArchiveError("invalid_range")
    wanted = stop - start
    request = Request(
        url, headers={"Range": f"bytes={start}-{stop - 1}", "Accept-Encoding": "identity"}
    )
    expected = f"bytes {start}-{stop - 1}/{total}"
    for attempt in range(3):
        try:
            with urlopen(request, timeout=25) as response:
                if (
                    response.status != 206
                    or response.headers.get("Content-Range") != expected
                    or response.headers.get("Content-Encoding", "identity") != "identity"
                ):
                    raise ArchiveError("range_mismatch")
                payload = response.read(wanted + 1)
                if len(payload) == wanted:
                    return payload
                if len(payload) > wanted:
                    raise ArchiveError("oversized_range")
        except HTTPError as error:
            error.close()
            if error.code not in {429, 500, 502, 503, 504}:
                raise ArchiveError("http_request_failed") from error
        except (OSError, IncompleteRead):
            pass
        except HTTPException as error:
            raise ArchiveError("invalid_http_response") from error
        if attempt < 2:
            time.sleep(attempt + 1)
    raise ArchiveError("range_retries_exhausted")


def member_bytes(source: str, archive: dict, item: dict, name: str) -> bytes:
    total = archive["archive_bytes"]
    url = f"https://zenodo.org/records/{archive['record']}/files/{archive['archive']}?download=1"
    offset = item["header_offset"]
    name_bytes = (f"front_location/{name}" if source == "front" else name).encode("ascii")
    header_stop = offset + HEADER.size + len(name_bytes)
    if not 0 <= offset < header_stop <= archive["central_directory_offset"] < total:
        raise ArchiveError("invalid_member_offset")
    header = read_range(url, total, offset, header_stop)
    signature, _, flags, method, *_, name_size, extra_size = HEADER.unpack_from(header)
    if (
        signature != b"PK\x03\x04"
        or flags != 0
        or method != 8
        or name_size != len(name_bytes)
        or header[HEADER.size :] != name_bytes
    ):
        raise ArchiveError("local_header_mismatch")
    start = header_stop + extra_size
    stop = start + item["compressed_bytes"]
    if not start < stop <= archive["central_directory_offset"]:
        raise ArchiveError("invalid_member_extent")
    chunk = RANGE_BYTES[source]
    compressed = b"".join(
        read_range(url, total, cursor, min(cursor + chunk, stop))
        for cursor in range(start, stop, chunk)
    )
    decoder = zlib.decompressobj(-zlib.MAX_WBITS)
    try:
        payload = decoder.decompress(compressed, item["raw_bytes"] + 1)
    except zlib.error as error:
        raise ArchiveError("invalid_member_data") from error
    if (
        not decoder.eof
        or decoder.unused_data
        or len(payload) != item["raw_bytes"]
        or f"{zlib.crc32(payload):08x}" != item["crc32"]
    ):
        raise ArchiveError("member_integrity_mismatch")
    return payload


def publish(target: Path, payload: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = None
    try:
        with NamedTemporaryFile(dir=target.parent, suffix=".part", delete=False) as stream:
            partial = Path(stream.name)
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.link(partial, target)
    finally:
        if partial is not None:
            partial.unlink(missing_ok=True)


def run(source: str, days: list[int], root: Path, *, fetch: bool) -> tuple[dict, int]:
    catalog = load_catalog()
    archive = catalog["sources"][source]
    selected = [archive["members"][day - 1] for day in sorted(set(days))]
    rows = []
    for item in selected:
        path = member_path(source, item["day"])
        status, sha = check_member(root, path, item["raw_bytes"], item["crc32"])
        rows.append(
            {
                "date": f"{catalog['month']}-{item['day']:02d}",
                "name": path.name,
                "status": status,
                "sha256": sha,
            }
        )
    plan = {
        "record": archive["record"],
        "archive": archive["archive"],
        "selected_missing_compressed_bytes": sum(
            item["compressed_bytes"]
            for item, row in zip(selected, rows, strict=True)
            if row["status"] == "missing"
        ),
        "members": rows,
    }
    if any(row["status"] not in {"matched", "missing"} for row in rows):
        return plan, 2
    if fetch:
        for item, row in zip(selected, rows, strict=True):
            if row["status"] == "matched":
                continue
            relative = member_path(source, item["day"])
            try:
                parent = (root / relative.parent).resolve()
                if not parent.is_relative_to(root):
                    raise ArchiveError("destination_outside_raw_root")
                payload = member_bytes(source, archive, item, relative.name)
                publish(parent / relative.name, payload)
            except ArchiveError as error:
                row.update(status="failed", reason=str(error))
                return plan, 2
            except (OSError, RuntimeError):
                row.update(status="failed", reason="read_or_write_failed")
                return plan, 2
            row.update(status="downloaded", sha256=hashlib.sha256(payload).hexdigest())
    return plan, 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=("front", "gfw"))
    parser.add_argument("days", type=int, choices=range(1, 32), nargs="+", metavar="DAY")
    parser.add_argument("--raw-root", type=Path, default=ROOT / "data/raw")
    parser.add_argument(
        "--fetch", action="store_true", help="fetch missing members and keep originals locally"
    )
    args = parser.parse_args(argv)
    try:
        root = args.raw_root.resolve(strict=True)
        if not root.is_dir():
            raise ValueError
        plan, result = run(args.source, args.days, root, fetch=args.fetch)
    except (KeyError, OSError, RuntimeError, TypeError, ValueError):
        print("could not read the raw root or fixed archive catalog", file=sys.stderr)
        return 2
    print(json.dumps(plan, indent=2))
    return result


if __name__ == "__main__":
    raise SystemExit(main())
