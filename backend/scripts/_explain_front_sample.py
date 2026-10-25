"""Compare coastal-zone fronts vs open-shelf fronts on real data.

Loads real front_location20240805.nc over the East China Sea (120-130E, 25-35N),
computes distance-to-land for every cell via KDTree, then compares:
  coastal zone : <=10 cells from land (about <=50 km offshore)
  open shelf   : > 30 cells from land (about >150 km offshore)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import xarray as xr

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
FRONT_PATH = RAW / "front" / "2024" / "front_location20240805.nc"

LINE_CODES = (-10, 10, 30)


def describe(fv: np.ndarray, dist: np.ndarray, name: str, lo: int, hi: int | None) -> None:
    mask = (dist >= lo) if hi is None else (dist >= lo) & (dist <= hi)
    total = int(mask.sum())
    if total == 0:
        print(f"\n{name}: no cells (lo={lo} hi={hi})")
        return
    line = np.isin(fv, LINE_CODES) & mask
    cold = (fv == -20) & mask
    warm = (fv == 20) & mask
    plain = (fv == 0) & mask
    n_line = int(line.sum())
    print(f"\n== {name} (cells={total}) ==")
    print(f"  front-line: {n_line} ({n_line / total * 1000:.1f} per 1000 cells)")
    print(f"  cold side : {int(cold.sum())} ({cold.sum() / total * 100:.2f}%)")
    print(f"  warm side : {int(warm.sum())} ({warm.sum() / total * 100:.2f}%)")
    print(f"  plain     : {int(plain.sum())} ({plain.sum() / total * 100:.2f}%)")
    vals = fv[line]
    if vals.size:
        codes, counts = np.unique(vals, return_counts=True)
        comp = ", ".join(f"{int(c)}:{100 * count / vals.size:.0f}%" for c, count in zip(codes, counts))
        print(f"  line-code mix: {comp}")


def main() -> None:
    with xr.open_dataset(FRONT_PATH, decode_times=False) as ds:
        front = ds["front"].isel(time=0).sel(lon=slice(120.0, 130.0), lat=slice(25.0, 35.0)).load()
    fv = np.asarray(front.values).astype(np.int16)  # be explicit about dtype
    print(f"East China Sea 120-130E/25-35N shape={fv.shape}, land cells={int((fv == -128).sum())}")

    from scipy.spatial import cKDTree

    land_pts = np.argwhere(fv == -128)
    tree = cKDTree(land_pts)
    # for every cell, distance to nearest land (in cells)
    ys, xs = np.indices(fv.shape)
    pts = np.stack([ys.ravel(), xs.ravel()], axis=1)
    d, _ = tree.query(pts)
    dist = d.reshape(fv.shape)

    describe(fv, dist, "coastal zone (<=10 cells ~50km offshore)", 1, 10)
    describe(fv, dist, "open shelf (>30 cells ~150km offshore)", 31, None)


if __name__ == "__main__":
    main()
