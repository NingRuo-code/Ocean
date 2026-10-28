"""Read-only, public-safe LOCAL inventory; never implies production access."""
import argparse
import hashlib
import json
import math
import os
import platform
import shutil
import stat
import subprocess
import tempfile
import time
from pathlib import Path


def excluded_link(path):
    # Python 3.11 also exposes Windows reparse attributes (junctions included).
    return path.is_symlink() or bool(getattr(path.lstat(), "st_file_attributes", 0) & 0x400)


def checked_path(root, relative):
    target = root
    for part in Path(relative).parts:
        target = target / part
        if excluded_link(target):
            raise ValueError("excluded_link")
    return target


def scan_budget(max_entries=100_000, max_seconds=10):
    return {"max_entries": max_entries, "max_seconds": max_seconds,
            "entries": 0, "started": time.monotonic()}


def measure(root, relative, budget=None):
    if budget is None:
        budget = scan_budget()
    try:
        target = checked_path(root, relative)
        if not target.is_dir():
            return {"status": "unavailable", "reason": "not_directory", "bytes": None, "files": None}
    except FileNotFoundError:
        return {"status": "missing", "bytes": None, "files": None}
    except ValueError:
        return {"status": "partial", "reason": "excluded_link", "bytes": None, "files": None}
    except OSError:
        return {"status": "unavailable", "bytes": None, "files": None}
    size = count = 0
    reasons = set()

    def visit(folder, depth):
        nonlocal size, count
        if depth >= 64:
            reasons.add("depth_budget")
            return
        try:
            with os.scandir(folder) as entries:
                for entry in entries:
                    if budget["entries"] >= budget["max_entries"]:
                        reasons.add("entry_budget")
                        return
                    if time.monotonic() - budget["started"] >= budget["max_seconds"]:
                        reasons.add("time_budget")
                        return
                    budget["entries"] += 1
                    try:
                        info = entry.stat(follow_symlinks=False)
                        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                            reasons.add("excluded_link")
                        elif stat.S_ISDIR(info.st_mode):
                            visit(entry.path, depth + 1)
                        elif stat.S_ISREG(info.st_mode):
                            size += info.st_size
                            count += 1
                        else:
                            reasons.add("non_regular_entry")
                    except OSError:
                        reasons.add("unreadable_entry")
        except OSError:
            reasons.add("unreadable_directory")

    visit(target, 0)
    return {"status": "partial" if reasons else "measured",
            "bytes": None if reasons else size, "files": None if reasons else count,
            "observed_bytes": size, "observed_files": count, "reasons": sorted(reasons)}


def inventory(root, snapshot, max_entries=100_000, max_seconds=10):
    budget = scan_budget(max_entries, max_seconds)
    disk = shutil.disk_usage(root)
    layers = {name: measure(root, path, budget) for name, path in {
        "raw": "data/raw", "hot_display": "frontend/prototype/data",
        "derived_unclassified": "data/processed", "indexes": "data/indexes",
        "staging": "data/staging", "cache": "data/cache",
        "results": "data/outputs", "backup": "data/backups",
    }.items()}
    routes, route_status = {}, {}
    for name in ["deploy/nginx/ocean.conf", "deploy/systemd/ocean-api.service", "frontend/prototype/prototype-data.js"]:
        routes[name] = None
        try:
            path = checked_path(root, name)
            if not path.is_file():
                raise ValueError("not_regular_file")
            if path.stat().st_size > 32 * 1024 * 1024:
                raise ValueError("file_budget")
            digest = hashlib.sha256()
            length = 0
            with path.open("rb") as stream:
                while block := stream.read(65536):
                    length += len(block)
                    if length > 32 * 1024 * 1024:
                        raise ValueError("file_budget")
                    digest.update(block)
            routes[name] = digest.hexdigest()
            route_status[name] = "hashed"
        except FileNotFoundError:
            route_status[name] = "missing"
        except ValueError as error:
            reason = str(error)
            route_status[name] = reason if reason in {"excluded_link", "not_regular_file", "file_budget"} else "unavailable"
        except OSError:
            route_status[name] = "unavailable"
    return {"schema": "ocean-runtime-inventory/v1", "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scope": "local checkout only; production unverified", "source_snapshot_id": snapshot["snapshot_id"],
            "local": {"os": platform.system(), "cpu_count": os.cpu_count(),
                      "disk_total_bytes": disk.total, "disk_free_bytes": disk.free,
                      "ram_bytes": None, "io_rate": None, "bandwidth": None, "workers": None, "load": None},
            "layers": layers, "route_config_sha256": routes,
            "route_config_status": route_status,
            "scan": {"max_entries": max_entries, "max_seconds": max_seconds,
                     "entries_examined": budget["entries"],
                     "elapsed_ms": (time.monotonic() - budget["started"]) * 1000,
                     "max_depth": 64},
            "production": {"status": "unverified", "revision": None, "cpu": None, "ram": None,
                           "disk": None, "io": None, "bandwidth": None, "workers": None, "load": None},
            "capacity": {"current_demo": "local bytes only", "east_china_sea_multiyear": "unknown",
                         "global_archive": "unknown", "concurrency_budget": None, "cache_budget_bytes": None},
            "limitations": ["Logical file lengths, not allocated disk or decompressed working arrays.",
                            "One snapshot cannot measure growth or peak concurrent memory.",
                            "Use deploy/inventory-server.sh privately on the server; publish only reviewed summaries.",
                            "No downloads, load tests, cache clearing or procurement recommendation."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--max-entries", type=int, default=100_000)
    parser.add_argument("--max-seconds", type=float, default=10)
    args = parser.parse_args()
    if not 1 <= args.max_entries <= 1_000_000 or not math.isfinite(args.max_seconds) or not 0.01 <= args.max_seconds <= 120:
        parser.error("Invalid scan budget")
    try:
        root = args.root.resolve(strict=True)
        if not root.is_dir():
            parser.error("Expected a readable root directory")
    except (OSError, ValueError):
        parser.error("Expected a readable root directory")
    try:
        if args.out.exists() or args.out.is_symlink():
            parser.error("Output already exists")
    except OSError:
        parser.error("Inventory output unavailable")
    try:
        frozen = subprocess.run(["node", str(Path(__file__).resolve().parent / "audit-research-baseline.mjs"),
                                 "--read-snapshot", str(args.snapshot.resolve())],
                                capture_output=True, encoding="utf-8", timeout=30, check=True)
        snapshot = json.loads(frozen.stdout)
    except (OSError, ValueError, subprocess.SubprocessError):
        parser.error("Invalid source snapshot")
    temporary = None
    try:
        report = inventory(root, snapshot, args.max_entries, args.max_seconds)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=args.out.parent,
                                         prefix=".ocean-inventory-", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        # Same-directory hard link publishes complete bytes without replacing a racing writer.
        os.link(temporary, args.out)
    except (OSError, ValueError):
        parser.error("Inventory or output unavailable")
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
