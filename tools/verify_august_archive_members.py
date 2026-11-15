"""Check local August 2024 originals against the fixed ZIP member catalog."""

import argparse
import hashlib
import json
import sys
import zlib
from os import fstat
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs/data/august-2024-archive-members.json"


def member_path(source: str, day: int) -> Path:
    if source == "front":
        return Path(f"front/2024/front_location202408{day:02d}.nc")
    return Path(f"fishing-source/v3-zenodo-14982712/fleet-daily-csvs-100-v3-2024-08-{day:02d}.csv")


def check_member(
    root: Path, relative: Path, expected_bytes: int, expected_crc32: str
) -> tuple[str, str | None]:
    try:
        path = (root / relative).resolve(strict=True)
        if not path.is_relative_to(root) or not path.is_file():
            return "unreadable", None
        with path.open("rb") as stream:
            if fstat(stream.fileno()).st_size != expected_bytes:
                return "size_mismatch", None
            sha = hashlib.sha256()
            crc, remaining = 0, expected_bytes + 1
            while remaining and (block := stream.read(min(remaining, 1024 * 1024))):
                sha.update(block)
                crc = zlib.crc32(block, crc)
                remaining -= len(block)
    except FileNotFoundError:
        return "missing", None
    except (OSError, RuntimeError):
        return "unreadable", None
    if remaining != 1:
        return "size_mismatch", None
    if f"{crc:08x}" != expected_crc32:
        return "crc_mismatch", None
    return "matched", sha.hexdigest()


def load_catalog() -> dict:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    if catalog["month"] != "2024-08" or set(catalog["sources"]) != {"front", "gfw"}:
        raise ValueError("unexpected archive catalog")
    for archive in catalog["sources"].values():
        if [entry["day"] for entry in archive["members"]] != list(range(1, 32)):
            raise ValueError("incomplete archive catalog")
    return catalog


def verify(raw_root: Path) -> dict:
    catalog = load_catalog()
    sources = {}
    for source, archive in catalog["sources"].items():
        members = []
        counts = {"matched": 0, "missing": 0, "invalid": 0}
        missing_compressed = 0
        for expected in archive["members"]:
            day = expected["day"]
            relative = member_path(source, day)
            status, sha = check_member(raw_root, relative, expected["raw_bytes"], expected["crc32"])
            if status == "missing":
                missing_compressed += expected["compressed_bytes"]
            counts[status if status in ("matched", "missing") else "invalid"] += 1
            members.append(
                {
                    "date": f"{catalog['month']}-{day:02d}",
                    "name": relative.name,
                    "status": status,
                    "sha256": sha,
                }
            )
        sources[source] = {
            "record": archive["record"],
            "counts": counts,
            "missing_compressed_bytes": missing_compressed,
            "members": members,
        }
    canonical_catalog = json.dumps(catalog, sort_keys=True, separators=(",", ":"))
    return {
        "schema": "ocean-august-archive-member-check/v1",
        "month": catalog["month"],
        "catalog_sha256": hashlib.sha256(canonical_catalog.encode("utf-8")).hexdigest(),
        "sources": sources,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, default=ROOT / "data/raw")
    parser.add_argument(
        "--require-complete", action="store_true", help="also fail if any archive member is missing"
    )
    args = parser.parse_args()
    try:
        raw_root = args.raw_root.resolve(strict=True)
        if not raw_root.is_dir():
            raise ValueError
    except (ValueError, OSError, RuntimeError):
        print("raw root must be an existing directory", file=sys.stderr)
        return 2
    try:
        report = verify(raw_root)
    except (KeyError, OSError, TypeError, ValueError):
        print("fixed August member catalog could not be read", file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2))
    for source in report["sources"].values():
        counts = source["counts"]
        if counts["invalid"] or (args.require_complete and counts["missing"]):
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
