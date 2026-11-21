"""Build one private display artifact from the checked Zenodo front member."""

import argparse
import json
from datetime import date
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from app.analysis_support import content_id, read_regular_bytes
from app.frontend_payload import MIN_LENGTH_KM, TOLERANCE_KM, exporter

from tools.audit_daily_sources import netcdf_rows
from tools.verify_august_archive_members import check_member, load_catalog, member_path

MAX_RAW_BYTES = 8 * 1024 * 1024
MAX_CELLS = 200_000
MAX_DETAIL_DEGREES = 22
PRODUCT = "zenodo-20356239"


def prepare_front_day(raw_root, day, bbox, expected_sha256):
    catalog = load_catalog()
    if f"{day:%Y-%m}" != catalog["month"]:
        raise ValueError("Observation day outside the registered archive")
    west, south, east, north = bbox
    if (not -180 <= west < east <= 180 or not -90 <= south < north <= 90
            or east - west > MAX_DETAIL_DEGREES or north - south > MAX_DETAIL_DEGREES
            or ((east - west) * 20 + 2) * ((north - south) * 20 + 2) > MAX_CELLS):
        raise ValueError("Display window exceeds the small preparation budget")
    expected = catalog["sources"]["front"]["members"][day.day - 1]
    if not 0 < expected["raw_bytes"] <= MAX_RAW_BYTES:
        raise ValueError("Archive member exceeds the preparation budget")
    root = raw_root.resolve(strict=True)
    relative = member_path("front", day.day)
    original = root / relative
    if original.resolve(strict=True) != original:
        raise ValueError("Unexpected original path")
    raw = read_regular_bytes(original, expected["raw_bytes"])
    if sha256(raw).hexdigest() != expected_sha256:
        raise ValueError("Archive member no longer matches the prepared evidence")

    # Both validators and the exporter consume the same isolated byte snapshot.
    with TemporaryDirectory(prefix="ocean-front-display-") as directory:
        staging = Path(directory).resolve()
        staged = staging / relative.name
        staged.write_bytes(raw)
        status, digest = check_member(staging, Path(staged.name), expected["raw_bytes"], expected["crc32"])
        if status != "matched" or digest != expected_sha256:
            raise ValueError("Archive member failed its catalog integrity check")
        iso_day = day.isoformat()
        audited = netcdf_rows(
            staged, {"variable": "front", "front_encoding": "zenodo-20356239/v1",
                     "day_boundary": "UTC", "bbox": bbox},
            {"id": "zenodo-front-member", "sha256": digest},
            {"role": "raw", "kind": "front", "product": {"id": PRODUCT}}, None, (iso_day, iso_day),
        )
        if len(audited) != 1:
            raise ValueError("Archive member must contain exactly one daily field")
        row = audited[0]
        axes = tuple(row["grid"][axis] for axis in ("lat", "lon"))
        if (row["date"] != iso_day or row["filename_date"] != iso_day
                or set(row["reasons"]) - {"time_coordinate_unverified; filename_date_inferred"}
                or row["unit"] != "none" or row["valid_samples"] <= 0
                or row["grid"]["coordinate_units"] != {"lon": "degrees_east", "lat": "degrees_north"}
                or any(axis["count"] < 2 for axis in axes)):
            raise ValueError("Archive member did not meet the registered front display grid or metadata")
        values, lon, lat = exporter.load_window(staged, bbox)
        # The original axes are float32 and adjacent differences are quantized.
        if any(not np.allclose(np.diff(axis), 0.05, rtol=0, atol=2.5e-5) for axis in (lon, lat)):
            raise ValueError("Archive member coordinates do not match the registered resolution")
        display = exporter.build_day_payload(
            iso_day, values, lon, lat, source_file=staged.name,
            tolerance_km=TOLERANCE_KM, min_length_km=MIN_LENGTH_KM,
        )
    quality = display["quality"]
    if (values.shape != tuple(axis["count"] for axis in axes)
            or quality["valid_cells"] != row["valid_samples"]
            or quality["nodata_cells"] != row["missing_samples"]
            or quality["front_line_cells"] != row["front_detected_samples"]):
        raise ValueError("Display counts disagree with the daily source audit")
    artifact = {
        "schema_version": "ocean-owner-front-display-artifact/v1",
        "product": PRODUCT,
        "license": "CC BY 4.0",
        "date": iso_day,
        "layer": "front",
        "bbox": list(bbox),
        "raw_sha256": digest,
        "support": {"valid": row["valid_samples"], "missing": row["missing_samples"],
                    "front": row["front_detected_samples"], "resolution_deg": 0.05},
        "date_basis": "verified_time_coordinate" if row["time_verified"] else "archive_member_name",
        "cell_bounds_verified": False,
        "scope": "private_map_display",
        "research_ready": False,
        "display": display,
    }
    return {**artifact, "artifact_id": content_id(artifact)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw_root", type=Path)
    parser.add_argument("day", type=date.fromisoformat)
    parser.add_argument("sha256")
    parser.add_argument("bbox", nargs=4, type=float)
    args = parser.parse_args()
    try:
        artifact = prepare_front_day(args.raw_root, args.day, tuple(args.bbox), args.sha256)
    except (ValueError, KeyError, IndexError, OSError, RuntimeError):
        parser.exit(1, "Registered front sample could not be validated or processed.\n")
    print(json.dumps(artifact, allow_nan=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
