"""按需产出「前端离线数据格式」（逐行 RLE）的单日 payload —— 支持任意窗口（bbox）与降采样（step）。

背景：前端渲染读的是 ``frontend/prototype/data/day/<date>.js`` 的 RLE 结构，
而 ``/api/analysis`` 返回的是 GeoJSON（为服务端渲染与矢量展示设计）—— 两套契约不同。
本模块复用 ``backend/scripts/export_prototype_data.py`` 的构建函数，让服务端按需产出与
离线文件**完全一致**的结构；前端把它注入 ``OFData`` 的缓存后可直接渲染。

为什么要 bbox + step（2026-09-23 起）：
- 原始锋面数据本身是**全球** 0.05°（7200×3600，约 1.27 MB/天），但全球 0.05° 单日 payload
  实测 15.7 MB / 25s —— 不可行；
- 所以按「当前视野」取数，并按窗口大小自动选一档**降采样步长**（1=0.05°、4=0.2°、10=0.5°、20=1°、40=2°），
  让球面/大洲尺度也能看到真实数据（概览），放大后自动换回 0.05° 明细。

降采样是**显示层聚合**，有明确口径（见 ``coarsen``）：
- 概览窗口**不做对象识别**（``objects``/``front_line`` 为空），避免把 1° 的块当成真实锋面对象；
- 返回里带 ``front.overview = {step, resolution_deg, ...}``，前端据此把它标成「概览」，卡片统计仍走 0.05° 窗口。

边界：
- 只读 raw NetCDF，不做任何插值或补值；
- 锋面文件缺失时抛 ``FrontendPayloadUnavailable``，由上层转 404，绝不返回空图；
- 海温缺失（或与请求窗口无交集）不算错误（``sst=None``）。
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np

from .config import settings

# scripts/ 里的导出脚本按「独立脚本」组织而不是包，这里显式加入 import 路径以复用其函数；
# 重新实现一份 RLE / 连通域 / 抽稀逻辑会让服务端与离线数据产生漂移。
_SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

import export_prototype_data as exporter  # noqa: E402

# 默认窗口 = 「作业海域」：比离线兜底（东海 120-128E/27-34N）更大，让前端首屏就能看到整片海域。
BBOX = (105.0, 3.0, 150.0, 45.0)
GLOBAL_BBOX = (-180.0, -90.0, 180.0, 90.0)
TOLERANCE_KM = 6.0
MIN_LENGTH_KM = 20.0

# 降采样档位（格数）：1 ⇒ 原始 0.05°
STEPS: tuple[int, ...] = (1, 2, 4, 10, 20, 40)
# 单次响应的像元上限（0.05° 下默认窗口 900×840=75.6 万；再大就自动降一档）
MAX_CELLS = 1_800_000
# 缓存文件名前缀：改出口径时把它 +1，避免旧缓存被继续命中
CACHE_VERSION = "v3"   # v3（2026-09-25）：全球粗格新增 0p25deg（NCEI 直连）档 → 同一天可能换成更细的档，旧缓存必须作废
CACHE_SUBDIR = "frontend_payload"
# 缓存文件上限（超出按最后修改时间删最旧的），防止长期乱拖视野把盘吃掉
CACHE_MAX_FILES = 150


class FrontendPayloadUnavailable(RuntimeError):
    """当日锋面原始 NetCDF 不存在。"""


class WindowError(ValueError):
    """bbox / step 参数不合法。"""


def parse_bbox(raw: str | None) -> tuple[float, float, float, float] | None:
    """解析 ``minLon,minLat,maxLon,maxLat``；None/空串表示用默认窗口。"""
    if raw is None or not str(raw).strip():
        return None
    parts = [piece.strip() for piece in str(raw).split(",")]
    if len(parts) != 4:
        raise WindowError("bbox 需要 4 个数字：minLon,minLat,maxLon,maxLat")
    try:
        values = [float(piece) for piece in parts]
    except ValueError as exc:
        raise WindowError("bbox 里有不是数字的值：" + raw) from exc
    min_lon, min_lat, max_lon, max_lat = values
    if not (-180.0 <= min_lon < max_lon <= 180.0):
        raise WindowError("经度必须满足 -180 ≤ minLon < maxLon ≤ 180")
    if not (-90.0 <= min_lat < max_lat <= 90.0):
        raise WindowError("纬度必须满足 -90 ≤ minLat < maxLat ≤ 90")
    return (min_lon, min_lat, max_lon, max_lat)


def snap_bbox(bbox: tuple[float, float, float, float], resolution: float = 0.05) -> tuple[float, float, float, float]:
    """把窗口对齐到数据网格，避免「差 0.003°」生成两份缓存。"""
    min_lon, min_lat, max_lon, max_lat = bbox
    snap = lambda value: round(round(value / resolution) * resolution, 3)
    return (snap(min_lon), snap(min_lat), snap(max_lon), snap(max_lat))


# 注：STEPS 是后端允许的降采样档位（与前端 stepForWindow 的取值集合一致），
# MAX_CELLS 只作显式 step 的兜底参考（见 pick_step 的说明）。


def pick_step(bbox: tuple[float, float, float, float], step: int | None, cell_deg: float = 0.05) -> int:
    """选降采样步长。

    - 显式给了 step：校验后直接用（前端会按自己的阈值显式传）；
    - 没给：按**窗口宽度**选档，口径与前端 ``stepForWindow`` 完全一致
      （≤25° → 1、≤60° → 4、≤120° → 20、更大 → 40），再兜一层像元上限。
      为什么不用"像元数最小可行档"：游程数跟**锋面总长度**走，全球 0.2° 只有 162 万像元，
      但会产出 7.6 万条游程（≈4 MB）；1° 只有 1.3 万条、2° 只有 3.6 千条 —— 按像元数选会挑错。
    """
    if step is not None:
        if step not in STEPS:
            raise WindowError("step 只能是 " + "/".join(str(item) for item in STEPS))
        return int(step)
    width = bbox[2] - bbox[0]
    for limit, candidate in ((25.0, 1), (60.0, 4), (120.0, 20)):
        if width <= limit:
            return candidate
    return 40


def coarsen(
    values: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    step: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """把 0.05° 网格按 step×step 归并成一格（**显示层概览**，不做对象识别）。

    归并口径（优先级从高到低）：锋面线 > 冷/暖侧 > 整块都是缺测才记缺测 > 无锋面。
    「块内有线就是线」保证细锋面不会被相邻的无锋面格抹掉；块内没有任何命中记 0（数据里 0 = 无锋面）。
    """
    if step <= 1:
        return values, lons, lats
    height, width = values.shape
    ny, nx = height // step, width // step
    if ny == 0 or nx == 0:
        return values, lons, lats

    blocked = values[: ny * step, : nx * step].reshape(ny, step, nx, step)
    line = np.isin(blocked, list(exporter.LINE_CODES))
    cold = blocked == exporter.COLD_CODE
    warm = blocked == exporter.WARM_CODE
    nodata = blocked == exporter.NODATA_CODE
    line_count = line.sum(axis=(1, 3))
    cold_count = cold.sum(axis=(1, 3))
    warm_count = warm.sum(axis=(1, 3))
    nodata_count = nodata.sum(axis=(1, 3))
    sides = cold_count + warm_count

    out = np.zeros((ny, nx), dtype=np.int16)
    out[sides > 0] = exporter.COLD_CODE
    out[(sides > 0) & (warm_count > cold_count)] = exporter.WARM_CODE
    out[(nodata_count == step * step) & (line_count == 0)] = exporter.NODATA_CODE
    if line_count.max() > 0:
        # 块内出现次数最多的线编码；并列取码值最小的，保证可复现
        best_code = np.full((ny, nx), int(sorted(exporter.LINE_CODES)[0]), dtype=np.int16)
        best_count = np.zeros((ny, nx), dtype=np.int32)
        for code in sorted(exporter.LINE_CODES):
            count = (blocked == int(code)).sum(axis=(1, 3))
            take = count > best_count
            best_code[take] = int(code)
            best_count[take] = count[take]
        out[line_count > 0] = best_code[line_count > 0]

    return out, lons[::step][:nx], lats[::step][:ny]


# 粗格海温的显示上限（像元数）：超过就隔格取样。
# 为什么必须有：sst_global 升到 0.25° 后，球面档请求的是**整球窗口**（1440×720 ≈ 104 万格），
# 原样出 payload 会有几十万条游程（几 MB）——和锋面 LOD 一个道理，显示层该粗就粗。
# 取值 20 万格：0.25° 整球 → 隔 3 格（0.75°，约 11.6 万格）；东海 0.05°（161×141=2.3 万格）不受影响。
SST_MAX_CELLS = 200_000


def _resolution_of(name: str) -> float:
    """从目录名解析分辨率：0p25deg → 0.25、1deg → 1.0、0p05deg → 0.05（解析不出按 99 排最后）。"""
    text = name.lower().replace("deg", "").replace("p", ".")
    try:
        return float(text)
    except ValueError:
        return 99.0


def _coarse_roots(raw_root: Path) -> list[Path]:
    """全球海温的候选目录，**从细到粗**（0p25deg 先于 1deg）。

    - 新布局：`raw/sst_global/<res>deg/<年>/<日期>.nc`（每个分辨率一个子目录，同名日期不互相顶掉）
    - 旧布局：`raw/sst_global/<年>/<日期>.nc`（子目录名不是 *deg 就按旧布局处理）
    """
    root = raw_root / "sst_global"
    if not root.is_dir():
        return []
    dirs = [child for child in root.iterdir() if child.is_dir() and child.name.lower().endswith("deg")]
    if not dirs:
        return [root]
    return sorted(dirs, key=lambda child: (_resolution_of(child.name), child.name))



def _thin_window(
    values: np.ndarray,
    lons: np.ndarray,
    lats: np.ndarray,
    max_cells: int | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """隔格取样到像元上限以内（保持起点与步长整齐 → 前端按自己的 grid 画，不会错位）。

    max_cells 不给就取模块常量 SST_MAX_CELLS（**运行时读**，方便测试里 monkeypatch）。
    """
    limit = SST_MAX_CELLS if max_cells is None else max_cells
    height, width = values.shape
    factor = 1
    while (height // factor) * (width // factor) > limit:
        factor += 1
    if factor == 1:
        return values, lons, lats
    return values[::factor, ::factor], lons[::factor], lats[::factor]


def _sst_window(
    path: Path,
    bbox: tuple[float, float, float, float],
) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """读海温并裁到「窗口 ∩ 该文件实际范围」；无交集返回 None；过密则隔格取样。

    原因：海温是按需下载的**子集**（东海 0.05° 明细 + 全球粗格两套），不能因为用户把视野拖到别处
    就假装那里有海温；同时上游 ``load_sst_window`` 在空选择上会抛 IndexError，
    所以这里先用文件自身的坐标算交集，再交给它读。
    """
    import xarray as xr

    with exporter.readable_path(path) as src, xr.open_dataset(src) as ds:
        # 变量名：CW 的 blended 产品叫 analysed_sst；NCEI 的 OISST v2.1 叫 sst（且 sst/anom/err/ice 里排第一）
        # —— 显式识别，别依赖字典顺序。
        if "analysed_sst" in ds:
            name = "analysed_sst"
        elif "sst" in ds:
            name = "sst"
        else:
            name = next(iter(ds.data_vars))
        da = ds[name]
        lat_name = "latitude" if "latitude" in da.coords else "lat"
        lon_name = "longitude" if "longitude" in da.coords else "lon"
        lat_vals = np.asarray(ds[lat_name].values, dtype=np.float64)
        lon_vals = np.asarray(ds[lon_name].values, dtype=np.float64)

    file_lon = (float(lon_vals.min()), float(lon_vals.max()))
    file_lat = (float(lat_vals.min()), float(lat_vals.max()))
    min_lon = max(bbox[0], file_lon[0])
    max_lon = min(bbox[2], file_lon[1])
    min_lat = max(bbox[1], file_lat[0])
    max_lat = min(bbox[3], file_lat[1])
    if min_lon > max_lon or min_lat > max_lat:
        return None
    values, lons, lats = exporter.load_sst_window(path, (min_lon, min_lat, max_lon, max_lat))
    if values.size == 0 or lons.size < 2 or lats.size < 2:
        return None
    return _thin_window(values, lons, lats)


def _cache_path(day: str, bbox: tuple[float, float, float, float], step: int) -> Path:
    coords = "_".join(f"{value:g}" for value in bbox)
    return Path(settings.cache_dir) / CACHE_SUBDIR / f"{CACHE_VERSION}_{day}_{coords}_{step}.json"


def _read_cache(path: Path) -> dict[str, object] | None:
    try:
        if not path.is_file():
            return None
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else None
    except (OSError, ValueError):
        return None


def _write_cache(path: Path, payload: dict[str, object]) -> None:
    """写缓存；任何失败都只影响速度，不影响出数。"""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, path)
        _prune_cache(path.parent)
    except OSError:
        pass


def _prune_cache(directory: Path) -> None:
    try:
        files = sorted(directory.glob(f"{CACHE_VERSION}_*.json"), key=lambda item: item.stat().st_mtime)
        for stale in files[: max(0, len(files) - CACHE_MAX_FILES)]:
            stale.unlink(missing_ok=True)
    except OSError:
        pass


def build_frontend_payload(
    day: str,
    bbox: tuple[float, float, float, float] | None = None,
    step: int | None = None,
) -> dict[str, object]:
    """构建单日前端 payload（可指定窗口与降采样档）。

    返回 ``{"date", "front", "sst", "window", "cached"}``：
    ``front`` 与 ``data/day/<date>.js`` 的结构一致（概览窗口额外带 ``front.overview``），
    ``sst`` 与 ``data/sst/<date>.js`` 一致（没有海温文件、或与窗口无交集时为 None）。
    """
    raw_root = Path(settings.raw_data_dir)
    window = snap_bbox(bbox or BBOX)
    if step is not None:
        chosen = pick_step(window, step)
    elif bbox is not None:
        chosen = pick_step(window, None)     # 显式要了窗口：按窗口宽度自动选档（大窗口给概览）
    else:
        chosen = 1                           # 默认作业窗口永远 0.05° 明细（45°×42° ≈ 76 万格，实测 ~1s）
    cache_path = _cache_path(day, window, chosen)
    cached = _read_cache(cache_path)
    if cached is not None:
        cached["cached"] = True
        return cached

    try:
        front_path = exporter.find_file(raw_root / "front", day)
    except FileNotFoundError as exc:
        raise FrontendPayloadUnavailable(str(exc)) from exc

    try:
        values, lons, lats = exporter.load_window(front_path, window)
    except IndexError:
        # 锋面原始文件是全球的，正常不会空；但万一某天换成区域文件，
        # load_window 会在空选择上抛 IndexError —— 统一成「无交集」的可读错误（404），别 500。
        values, lons, lats = np.empty((0, 0), dtype=np.int16), np.empty(0), np.empty(0)
    if values.size == 0 or lons.size < 2 or lats.size < 2:
        raise FrontendPayloadUnavailable(f"{day} 的锋面文件与窗口 {window} 无交集")

    coarse_values, coarse_lons, coarse_lats = coarsen(values, lats, lons, chosen)
    front = exporter.build_day_payload(
        day,
        coarse_values,
        coarse_lons,
        coarse_lats,
        source_file=front_path.name,
        tolerance_km=TOLERANCE_KM,
        min_length_km=MIN_LENGTH_KM,
    )
    if chosen > 1:
        # 概览：不做对象识别、不给对象清单（1° 的块不是锋面对象），并显式标注口径
        front.update({"objects": [], "front_line": [], "object_line_count": 0, "short_line_count": 0})
        front["overview"] = {
            "step": chosen,
            "resolution_deg": round(0.05 * chosen, 3),
            "source_resolution_deg": 0.05,
            "method": "block priority：锋面线 > 冷暖侧 > 整块缺测 > 无锋面",
            "note": "显示层概览：聚合格不能当锋面对象，统计与对象清单仍用 0.05° 窗口",
        }

    sst: dict[str, object] | None = None
    sst_path = exporter.find_sst_file(raw_root / "sst", day)
    if sst_path is not None:
        window_sst = _sst_window(sst_path, window)
        if window_sst is not None:
            sst = exporter.build_sst_payload(
                day,
                window_sst[0],
                window_sst[1],
                window_sst[2],
                source_file=sst_path.name,
            )
            front["has_sst"] = True

    # 全球海温（可选）：按分辨率分目录（sst_global/0p25、sst_global/1deg…），取**最细的可用档**。
    # 与东海 0.05° 明细**并存**：前端粗格垫底、明细压在上面，于是"作业海域很细、别处也有海温"。
    sst_coarse: dict[str, object] | None = None
    for coarse_root in _coarse_roots(raw_root):
        coarse_path = exporter.find_sst_file(coarse_root, day)
        if coarse_path is None:
            continue
        window_coarse = _sst_window(coarse_path, window)
        if window_coarse is None:
            continue
        sst_coarse = exporter.build_sst_payload(
            day,
            window_coarse[0],
            window_coarse[1],
            window_coarse[2],
            source_file=coarse_path.name,
        )
        if sst is None:
            front["has_sst"] = True
        break

    payload: dict[str, object] = {
        "date": day,
        "front": front,
        "sst": sst,
        "sst_coarse": sst_coarse,
        "window": {
            "bbox": [round(value, 3) for value in window],
            "step": chosen,
            "resolution_deg": round(0.05 * chosen, 3),
            "mode": "overview" if chosen > 1 else "detail",
            "default": window == snap_bbox(BBOX),
        },
        "cached": False,
    }
    _write_cache(cache_path, payload)
    return payload
