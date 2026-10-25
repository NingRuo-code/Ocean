"""数据目录（catalog）发现与缓存。

`/api/catalog` 每次请求都要扫一遍 `data/raw` 下的 NetCDF。数据量到"几千个文件、
且抓取脚本每天还在往里写"这个规模后，全量 rglob + 逐文件 stat 会在并发下明显排队
（实测 4500+ 文件时单次 0.38 s、20 并发下最慢 9 s）。这里加一层"目录指纹 + 短 TTL"缓存：

- 指纹只遍历目录、不 stat 文件，几千个文件也只有毫秒级开销；
- 任一目录 mtime 变化（新增/删除/改名文件）即视为数据更新，抓取脚本持续写入时
  请求自然回落到真实扫描，不会看到过期数据；
- 数据稳定后（演示、答辩、日常浏览）瞬时命中，并把 `cached=true` 回给调用方。
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from .data_access import IGNORED_DATA_DIRECTORIES, DatasetFile, discover_netcdf_files

__all__ = [
    "CATALOG_CACHE_TTL_SECONDS",
    "DatasetFile",
    "cached_netcdf_files",
    "catalog_cache_stats",
    "directory_signature",
    "discover_netcdf_files",
    "invalidate_catalog_cache",
]

# 目录指纹没变时最多复用多久（秒）。指纹能抓住"增删文件"，这个 TTL 只兜住
# "文件被原地覆盖但目录 mtime 没变"的极端情况，所以给得很短。
CATALOG_CACHE_TTL_SECONDS = 15.0

DirectorySignature = tuple[tuple[str, int], ...]


@dataclass
class _CacheEntry:
    signature: DirectorySignature
    files: list[DatasetFile] = field(default_factory=list)
    stored_at: float = 0.0


_lock = threading.Lock()
# 扫描串行化：20 个请求同时 miss 时，只让一个真正去 rglob，其余等它扫完直接复用结果
_scan_lock = threading.Lock()
_entries: dict[str, _CacheEntry] = {}
_hits = 0
_misses = 0


def directory_signature(root: Path) -> DirectorySignature:
    """目录级指纹：只读目录项、不 stat 文件，几千个文件也只有毫秒级开销。"""
    if not root.is_dir():
        return ()
    signature: list[tuple[str, int]] = []
    for current_dir, dir_names, _file_names in os.walk(root):
        dir_names[:] = [name for name in dir_names if name not in IGNORED_DATA_DIRECTORIES]
        try:
            mtime_ns = os.stat(current_dir).st_mtime_ns
        except OSError:  # 目录在遍历过程中被删掉：跳过，交给下一次调用重算
            continue
        signature.append((os.path.relpath(current_dir, root), mtime_ns))
    signature.sort()
    return tuple(signature)


def _lookup(key: str, signature: DirectorySignature, ttl_seconds: float) -> list[DatasetFile] | None:
    """命中就返回共享的文件清单并记一次 hit，否则返回 None。"""
    global _hits

    now = time.monotonic()
    with _lock:
        entry = _entries.get(key)
        if entry is not None and entry.signature == signature and now - entry.stored_at < ttl_seconds:
            _hits += 1
            return entry.files
    return None


def cached_netcdf_files(
    root: Path,
    *,
    ttl_seconds: float = CATALOG_CACHE_TTL_SECONDS,
) -> tuple[list[DatasetFile], bool]:
    """返回 (文件清单, 是否命中缓存)。清单是共享的只读结果，调用方不要就地改写。"""
    global _misses

    key = str(root)
    signature = directory_signature(root)
    cached = _lookup(key, signature, ttl_seconds)
    if cached is not None:
        return cached, True

    with _scan_lock:
        cached = _lookup(key, signature, ttl_seconds)  # 双检：可能刚被别的请求扫好了
        if cached is not None:
            return cached, True
        files = discover_netcdf_files(root)
        with _lock:
            _entries[key] = _CacheEntry(
                signature=signature, files=files, stored_at=time.monotonic()
            )
            _misses += 1
        return files, False


def invalidate_catalog_cache(root: Path | None = None) -> None:
    """清缓存：传 root 只清该根目录，不传则全清（重建索引、手工改数据后调用）。"""
    with _lock:
        if root is None:
            _entries.clear()
        else:
            _entries.pop(str(root), None)


def catalog_cache_stats() -> dict[str, int]:
    with _lock:
        return {"hits": _hits, "misses": _misses, "entries": len(_entries)}
