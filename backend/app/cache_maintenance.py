from __future__ import annotations

import shutil
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from .schemas import ViewportRequest
from .viewport import (
    VIEWPORT_CACHE_SUBDIR,
    VIEWPORT_CACHE_VERSION,
    _cache_path,
    build_cached_viewport,
)


@dataclass(frozen=True)
class ViewportCacheStatus:
    root: Path
    active_version: str
    version_count: int
    file_count: int
    bytes_total: int
    files_by_version: dict[str, int]


def viewport_cache_root(cache_dir: Path) -> Path:
    return Path(cache_dir) / VIEWPORT_CACHE_SUBDIR


def collect_viewport_cache_status(cache_dir: Path) -> ViewportCacheStatus:
    root = viewport_cache_root(cache_dir)
    files_by_version: Counter[str] = Counter()
    bytes_total = 0
    if root.exists():
        for path in root.glob("*/*.json"):
            if not path.is_file():
                continue
            files_by_version[path.parent.name] += 1
            try:
                bytes_total += path.stat().st_size
            except OSError:
                pass
    return ViewportCacheStatus(
        root=root,
        active_version=VIEWPORT_CACHE_VERSION,
        version_count=len(files_by_version),
        file_count=sum(files_by_version.values()),
        bytes_total=bytes_total,
        files_by_version=dict(sorted(files_by_version.items())),
    )


def viewport_cache_status_payload(status: ViewportCacheStatus) -> dict[str, object]:
    return {
        "cache_root": str(status.root),
        "active_version": status.active_version,
        "version_count": status.version_count,
        "file_count": status.file_count,
        "bytes_total": status.bytes_total,
        "files_by_version": status.files_by_version,
    }


def warm_viewport_cache(
    requests: list[ViewportRequest],
    *,
    cache_dir: Path,
    prototype_data_dir: Path,
) -> dict[str, object]:
    statuses: Counter[str] = Counter()
    hits = 0
    for request in requests:
        response = build_cached_viewport(request, cache_dir, prototype_data_dir)
        statuses[response.meta.status] += 1
        if response.meta.cache.hit:
            hits += 1
    status = collect_viewport_cache_status(cache_dir)
    return {
        "schema_version": "viewport-cache-maintenance/v1",
        "action": "warm",
        "cache_version": VIEWPORT_CACHE_VERSION,
        "request_count": len(requests),
        "cache_hits": hits,
        "cache_misses": len(requests) - hits,
        "statuses": dict(sorted(statuses.items())),
        "cache_root": str(status.root),
        "file_count": status.file_count,
        "files_by_version": status.files_by_version,
    }


def _assert_inside(parent: Path, child: Path) -> None:
    resolved_parent = parent.resolve()
    resolved_child = child.resolve()
    if resolved_child != resolved_parent and resolved_parent not in resolved_child.parents:
        raise ValueError(f"Refusing to prune outside cache root: {child}")


def prune_viewport_cache(
    cache_dir: Path,
    *,
    active_version: str = VIEWPORT_CACHE_VERSION,
    delete_old_versions: bool = True,
    max_files_per_version: int | None = None,
    dry_run: bool = False,
) -> dict[str, object]:
    root = viewport_cache_root(cache_dir)
    removed_versions: list[str] = []
    removed_files: list[str] = []
    if not root.exists():
        return {
            "schema_version": "viewport-cache-maintenance/v1",
            "action": "prune",
            "cache_version": active_version,
            "dry_run": dry_run,
            "removed_versions": removed_versions,
            "removed_files": removed_files,
            "remaining": viewport_cache_status_payload(collect_viewport_cache_status(cache_dir)),
        }

    for version_dir in sorted(path for path in root.iterdir() if path.is_dir()):
        _assert_inside(root, version_dir)
        if delete_old_versions and version_dir.name != active_version:
            removed_versions.append(version_dir.name)
            if not dry_run:
                shutil.rmtree(version_dir)
            continue
        if max_files_per_version is None:
            continue
        files = sorted(
            (path for path in version_dir.glob("*.json") if path.is_file()),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        for stale_file in files[max_files_per_version:]:
            _assert_inside(root, stale_file)
            removed_files.append(stale_file.relative_to(root).as_posix())
            if not dry_run:
                stale_file.unlink()

    return {
        "schema_version": "viewport-cache-maintenance/v1",
        "action": "prune",
        "cache_version": active_version,
        "dry_run": dry_run,
        "removed_versions": removed_versions,
        "removed_files": removed_files,
        "remaining": viewport_cache_status_payload(collect_viewport_cache_status(cache_dir)),
    }


def rebuild_viewport_cache(
    requests: list[ViewportRequest],
    *,
    cache_dir: Path,
    prototype_data_dir: Path,
    dry_run: bool = False,
) -> dict[str, object]:
    root = viewport_cache_root(cache_dir)
    removed_files: list[str] = []
    for request in requests:
        path = _cache_path(cache_dir, request)
        _assert_inside(root, path)
        if not path.exists():
            continue
        removed_files.append(path.relative_to(root).as_posix())
        if not dry_run:
            path.unlink()
    if dry_run:
        status = collect_viewport_cache_status(cache_dir)
        return {
            "schema_version": "viewport-cache-maintenance/v1",
            "action": "rebuild",
            "cache_version": VIEWPORT_CACHE_VERSION,
            "dry_run": True,
            "request_count": len(requests),
            "removed_files": removed_files,
            "remaining": viewport_cache_status_payload(status),
        }
    warmed = warm_viewport_cache(requests, cache_dir=cache_dir, prototype_data_dir=prototype_data_dir)
    return {
        **warmed,
        "action": "rebuild",
        "dry_run": False,
        "removed_files": removed_files,
    }
