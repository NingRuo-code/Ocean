"""Read-only, public-safe LOCAL inventory; never implies production access."""
import argparse
import hashlib
import json
import os
import platform
import shutil
import time
from pathlib import Path


def excluded_link(path):
    # Python 3.11 also exposes Windows reparse attributes (junctions included).
    return path.is_symlink() or bool(getattr(path.lstat(), "st_file_attributes", 0) & 0x400)


def measure(root, relative):
    target = root / relative
    try:
        if not target.exists():
            return {"status": "missing", "bytes": None, "files": None}
        if excluded_link(target):
            return {"status": "partial", "bytes": None, "files": None}
    except OSError:
        return {"status": "unavailable", "bytes": None, "files": None}
    size = count = 0
    partial = False
    def denied(_error):
        nonlocal partial
        partial = True

    for folder, dirs, files in os.walk(target, followlinks=False, onerror=denied):
        accepted = []
        for name in dirs:
            try:
                if not excluded_link(Path(folder) / name):
                    accepted.append(name)
            except OSError:
                partial = True
        if len(accepted) != len(dirs):
            partial = True
        dirs[:] = accepted
        for name in files:
            path = Path(folder) / name
            try:
                if excluded_link(path):
                    partial = True
                    continue
                size += path.stat().st_size
                count += 1
            except OSError:
                partial = True
    return {"status": "partial" if partial else "measured", "bytes": size, "files": count}


def inventory(root, snapshot):
    disk = shutil.disk_usage(root)
    layers = {name: measure(root, path) for name, path in {
        "raw": "data/raw", "hot_display": "frontend/prototype/data",
        "derived_unclassified": "data/processed", "indexes": "data/indexes",
        "staging": "data/staging", "cache": "data/cache",
        "results": "data/outputs", "backup": "data/backups",
    }.items()}
    routes = {}
    for name in ["deploy/nginx/ocean.conf", "deploy/systemd/ocean-api.service", "frontend/prototype/prototype-data.js"]:
        path = root / name
        routes[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    return {"schema": "ocean-runtime-inventory/v1", "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scope": "local checkout only; production unverified", "source_snapshot_id": snapshot["snapshot_id"],
            "local": {"os": platform.system(), "cpu_count": os.cpu_count(),
                      "disk_total_bytes": disk.total, "disk_free_bytes": disk.free,
                      "ram_bytes": None, "io_rate": None, "bandwidth": None, "workers": None, "load": None},
            "layers": layers, "route_config_sha256": routes,
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
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    if snapshot.get("schema") != "ocean-source-audit/v1":
        parser.error("Expected source audit snapshot")
    args.out.write_text(json.dumps(inventory(args.root.resolve(), snapshot), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
