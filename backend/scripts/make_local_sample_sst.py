"""Create a minimal local SST sample for demo purposes.

This script generates a small synthetic `analysed_sst` NetCDF covering the
East China Sea demo region (123-126E, 29-32N) at 0.05 degree resolution for
the 2024-08-05 / 2024-08-06 dates. It is meant to let the offline pipeline run
end-to-end WITHOUT a Copernicus Marine account. The generated file is placed
under data/raw/sst/2024 which is ignored by git.

Replace it with real Copernicus C3S-GLO-SST-L4-REP-OBS-SST files once they are
available.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import numpy as np
import xarray as xr

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "sst" / "2024"
OUTPUT_PATH = OUTPUT_DIR / "sst_20240805_20240806.nc"

LON_START, LON_STOP = 123.0, 126.0
LAT_START, LAT_STOP = 29.0, 32.0
STEP = 0.05
DATES = [date(2024, 8, 5), date(2024, 8, 6)]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    lon = np.arange(LON_START, LON_STOP + STEP / 2, STEP, dtype=np.float32)
    lat = np.arange(LAT_START, LAT_STOP + STEP / 2, STEP, dtype=np.float32)
    yy, xx = np.meshgrid(lat, lon, indexing="ij", sparse=False)

    # Simple synthetic front: temperature increases north-east, with a
    # diagonal warm/cold separation so the pipeline can detect a front line.
    base = 300.0 - (lat[:, None] - 30.0) * 1.2 + (lon[None, :] - 124.5) * 0.3
    band = 2.0 / (1.0 + np.exp(-(yy - 30.2 - (xx - 124.5) * 0.4) * 40.0))
    sst_05 = base + band
    sst_06 = base + band + 0.2

    values = np.stack([sst_05, sst_06], axis=0).astype(np.float32)
    dataset = xr.Dataset(
        data_vars={
            "analysed_sst": (("time", "latitude", "longitude"), values),
        },
        coords={
            "time": np.array(DATES, dtype="datetime64[ns]"),
            "latitude": lat,
            "longitude": lon,
        },
    )
    dataset.to_netcdf(OUTPUT_PATH, engine="h5netcdf")
    print(f"wrote synthetic SST sample: {OUTPUT_PATH}")
    print(f"  lon={lon.size}, lat={lat.size}, dates={[d.isoformat() for d in DATES]}")


if __name__ == "__main__":
    main()
