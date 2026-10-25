"""Explicit daily audit behind the existing CLI; no download, regridding or qualification."""

import argparse
import csv
import hashlib
import json
import math
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import xarray as xr

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

SCHEMA = "ocean-daily-source-audit/v1"
MAX_SAMPLES = 2_000_000


def digest(value):
    return hashlib.sha256(
        json.dumps(
            value, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ).encode()
    ).hexdigest()


def file_digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def file_date(path):
    match = re.search(r"(20\d{2})-?(\d{2})-?(\d{2})", path.name)
    try:
        return date(*map(int, match.groups())).isoformat() if match else None
    except ValueError:
        return None


def axis(values):
    values = np.asarray(values, dtype=float)
    if values.ndim != 1 or not len(values) or not np.isfinite(values).all():
        raise ValueError("invalid_coordinate")
    differences = np.diff(values)
    regular = bool(
        len(values) == 1
        or (np.all(differences > 0) or np.all(differences < 0))
        and np.allclose(differences, differences[0], atol=1e-8, rtol=1e-6)
    )
    return {
        "first": float(values[0]),
        "last": float(values[-1]),
        "count": len(values),
        "step": float(differences[0]) if len(differences) and regular else None,
        "regular": regular,
        "min": float(values.min()),
        "max": float(values.max()),
    }


def support_file(directory, identity, values, lon, lat):
    if directory is None:
        return None
    checksum = hashlib.sha256(identity.encode())
    for array in [values, lon, lat]:
        checksum.update(str(array.dtype).encode())
        checksum.update(str(array.shape).encode())
        checksum.update(array.tobytes())
    name = checksum.hexdigest() + ".npz"
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / (name + ".tmp")).open("wb") as stream:
        np.savez_compressed(stream, valid=values, lon=lon, lat=lat)
    (directory / (name + ".tmp")).replace(directory / name)
    return name


def metadata_value(value):
    if isinstance(value, np.ndarray):
        return [metadata_value(item) for item in value]
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return "NaN" if np.isnan(value) else "Infinity"
    return value


def decode_sst(raw, valid, attrs):
    if str(attrs.get("_Unsigned", "false")).lower() != "false":
        raise ValueError("unsupported_unsigned_encoding")
    if "valid_range" in attrs:
        low, high = attrs["valid_range"]
        valid &= (raw >= low) & (raw <= high)
    if "valid_min" in attrs:
        valid &= raw >= attrs["valid_min"]
    if "valid_max" in attrs:
        valid &= raw <= attrs["valid_max"]
    scale, offset = (
        float(attrs.get("scale_factor", 1)),
        float(attrs.get("add_offset", 0)),
    )
    if not np.isfinite(scale) or not np.isfinite(offset):
        raise ValueError("invalid_scale_offset")
    unit = str(attrs.get("units", "unknown")).strip().lower()
    kelvin = unit in ["k", "kelvin", "kelvins"]
    celsius = unit in [
        "degree_c",
        "degrees_c",
        "degc",
        "celsius",
        "degree_celsius",
        "degrees_celsius",
    ]
    decoding = {
        "source_unit": attrs.get("units"),
        "unit_basis": "file_attribute" if kelvin or celsius else "unverified",
        "scale_factor": scale,
        "add_offset": offset,
        "valid_range_domain": "packed",
        "mask_attributes": {
            key: metadata_value(attrs[key])
            for key in [
                "_FillValue",
                "missing_value",
                "valid_range",
                "valid_min",
                "valid_max",
            ]
            if key in attrs
        },
    }
    if not kelvin and not celsius:
        return valid, decoding, None
    with np.errstate(over="ignore", invalid="ignore"):
        values = raw.astype(float) * scale + offset - (273.15 if kelvin else 0)
    valid &= np.isfinite(values)
    stats = {
        "min": round(float(values[valid].min()), 8) if valid.any() else None,
        "max": round(float(values[valid].max()), 8) if valid.any() else None,
    }
    return valid, decoding, stats


def number(value, csv_input=False):
    if isinstance(value, bool) or value is None or value == "":
        return None
    if csv_input and isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return float(value) if isinstance(value, (int, float)) else None


def object_field(payload, key):
    value = payload.get(key)
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise TypeError("invalid_metadata_object")
    return value


def activity_rows(path, entry, file, source, support):
    csv_input = (
        entry["format"] == "activity-csv"
        or entry["format"] == "activity-files"
        and path.suffix.lower() == ".csv"
    )
    if csv_input:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            cells = list(csv.DictReader(stream))
        payload = {}
    else:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise TypeError("invalid_activity_payload")
        cells = payload[entry.get("records_field", "cells")]
    source_metadata = object_field(payload, "source")
    coverage = object_field(payload, "coverage")
    matching = object_field(payload, "matching")
    if not isinstance(cells, list) or len(cells) > MAX_SAMPLES:
        raise ValueError("invalid_record_budget")
    by_day = {}
    declared_day = payload.get("date")
    for cell in cells:
        if not isinstance(cell, dict):
            raise TypeError("invalid_activity_record")
        day = cell.get(entry.get("date_field", "date"), declared_day or file_date(path))
        if not isinstance(day, str):
            raise TypeError("activity_date_unknown")
        date.fromisoformat(day)
        by_day.setdefault(day, []).append(cell)
    if not cells:
        day = declared_day or file_date(path)
        if day:
            by_day[date.fromisoformat(day).isoformat()] = []
    rows = []
    for day, records in sorted(by_day.items()):
        counts = dict.fromkeys(
            [
                "total",
                "valid",
                "zero",
                "missing",
                "nonfinite",
                "negative",
                "invalid_coordinate",
                "invalid_type",
                "above_24",
            ],
            0,
        )
        counts["total"] = len(records)
        observed, values, maxima, lons, lats, valid_mask = {}, [], {}, [], [], []
        for record in records:
            lon = number(record.get(entry.get("lon_field", "lon")), csv_input)
            lat = number(record.get(entry.get("lat_field", "lat")), csv_input)
            lons.append(lon if lon is not None else np.nan)
            lats.append(lat if lat is not None else np.nan)
            valid_mask.append(False)
            if (
                lon is None
                or lat is None
                or not np.isfinite([lon, lat]).all()
                or not (-180 <= lon <= 180 and -90 <= lat <= 90)
            ):
                counts["invalid_coordinate"] += 1
                continue
            key = (lon, lat)
            observed[key] = observed.get(key, 0) + 1
            raw_hours = record.get(entry.get("hours_field", "hours"))
            if raw_hours is None or raw_hours == "":
                counts["missing"] += 1
                continue
            hours = number(raw_hours, csv_input)
            if hours is None:
                counts["invalid_type"] += 1
            elif not np.isfinite(hours):
                counts["nonfinite"] += 1
            elif hours < 0:
                counts["negative"] += 1
            else:
                valid_mask[-1] = True
                counts["valid"] += 1
                counts["zero"] += int(hours == 0)
                counts["above_24"] += int(hours > 24)
                values.append(hours)
                maxima[key] = max(maxima.get(key, hours), hours)
        duplicates = sum(count > 1 for count in observed.values())
        units = (
            [record.get("unit") for record in records]
            if csv_input
            else [payload.get("unit"), source_metadata.get("unit")]
        )
        units = [value for value in units if value is not None and value != ""]
        if any(not isinstance(value, str) for value in units):
            raise TypeError("invalid_activity_unit")
        normalized_units = {
            "fishing_hours" if value == "fishing hours" else value for value in units
        }
        unit_conflict = len(normalized_units) > 1
        unit = (
            next(iter(normalized_units))
            if len(normalized_units) == 1
            else entry.get("unit")
        )
        unit_verified = normalized_units == {"fishing_hours"} and (
            not csv_input or len(units) == len(records)
        )
        resolution = number(
            payload.get("spatial_resolution_deg", entry.get("resolution_deg"))
        )
        resolution_check = (
            "unknown"
            if resolution is None or not np.isfinite(resolution) or resolution <= 0
            else "coarser_than_0.01_degree_target"
            if resolution > 0.01 + 1e-10
            else "declared_at_or_finer_than_target; not_accuracy_proof"
        )
        reasons = ["duplicate_grid_day_records"] if duplicates else []
        if file_date(path) and day != file_date(path) and len(by_day) == 1:
            reasons.append("filename_content_date_mismatch")
        if not unit_verified:
            reasons.append("activity_unit_unverified")
        if unit_conflict:
            reasons.append("activity_unit_conflict")
        if resolution_check != "declared_at_or_finer_than_target; not_accuracy_proof":
            reasons.append("analysis_resolution_not_verified")
        bounds = coverage.get("bbox")
        domain_valid = (
            isinstance(bounds, list)
            and len(bounds) == 4
            and all(number(v) is not None and np.isfinite(number(v)) for v in bounds)
            and bounds[0] < bounds[2]
            and -90 <= bounds[1] < bounds[3] <= 90
        )
        sparse_zero = (
            coverage.get("sparse_unlisted_zero") is True
            and coverage.get("status") == "complete"
            and domain_valid
            and bool(coverage.get("evidence"))
        )
        time_verified = entry.get("day_boundary") == "UTC" and bool(
            declared_day
            or records
            and all(entry.get("date_field", "date") in r for r in records)
        )
        if not time_verified:
            reasons.append("day_boundary_or_content_date_unverified")
        strategy = matching.get("strategy")
        offset = number(matching.get("offset_km"))
        spatial_match = {
            "strategy": strategy
            if strategy in ["nearest", "exact", "aggregated"]
            else "not_reported",
            "direct_target_observation": False
            if strategy == "nearest"
            else "unverified",
            "offset_km_declared": offset
            if offset is not None and np.isfinite(offset) and offset >= 0
            else None,
            "position_evidence": "original_file; not_publicly_projected"
            if matching.get("position")
            else "not_reported",
        }
        row = {
            "date": day,
            "file_id": file["id"],
            "file_sha256": file["sha256"],
            "state": "conflict"
            if duplicates or unit_conflict
            else "parsed"
            if unit_verified
            else "unverified",
            "reasons": reasons,
            "unit": unit,
            "unit_status": "conflict"
            if unit_conflict
            else "file_attribute"
            if unit_verified
            else "unverified_declaration",
            "record_counts": counts,
            "reported_valid_hours_sum": math.fsum(values)
            if values and unit_verified
            else None,
            "unique_cell_hours_sum": None
            if duplicates or not values or not unit_verified
            else math.fsum(values),
            "legacy_max_diagnostic_hours": math.fsum(maxima.values())
            if maxima and unit_verified
            else None,
            "duplicate_cell_groups": duplicates,
            "coverage_status": "source_declared_complete_not_verified"
            if sparse_zero
            else "unknown",
            "unlisted_cell_value": "source_declared_zero_not_materialized"
            if sparse_zero
            else "unknown",
            "resolution_deg_declared": resolution
            if resolution is not None and np.isfinite(resolution)
            else None,
            "resolution_check": resolution_check,
            "target_analysis_resolution_deg": 0.01,
            "record_extent_status": "observed_records_only; no_area_estimate",
            "time_verified": time_verified,
            "spatial_match": spatial_match,
            "support_artifact": support_file(
                support,
                file["sha256"] + day,
                np.array(valid_mask, dtype=bool),
                np.array(lons),
                np.array(lats),
            ),
            "lineage_comparison": "not_performed",
        }
        rows.append(row)
    return rows


def compare_lineage(results, entries):
    checks = []
    indexed = {source["id"]: source for source in results}
    configs = {entry["id"]: entry for entry in entries}
    for entry in entries:
        if not entry.get("compare_to"):
            continue
        parent = entry["compare_to"]
        child_rows = indexed[entry["id"]]["days"]
        for day in sorted({row["date"] for row in child_rows}):
            pair = [
                source["days"]
                for key in [parent, entry["id"]]
                if (source := indexed.get(key))
            ]
            rows = [[row for row in group if row["date"] == day] for group in pair]
            compatible = len(rows) == 2 and all(
                len(group) == 1
                and group[0].get("unique_cell_hours_sum") is not None
                and group[0].get("unit_status") == "file_attribute"
                and group[0]["state"] == "parsed"
                and group[0].get("time_verified")
                and group[0]["record_counts"]["total"]
                == group[0]["record_counts"]["valid"]
                and "filename_content_date_mismatch" not in group[0]["reasons"]
                for group in rows
            )
            same_scope = bool(entry.get("scope_id")) and entry.get(
                "scope_id"
            ) == configs.get(parent, {}).get("scope_id")
            check = {
                "source": parent,
                "derived": entry["id"],
                "date": day,
                "state": "not_verified",
                "difference_hours": None,
                "scope": "declared_same_input_scope; observed_record_totals_only; not_coverage_proof",
            }
            if compatible and same_scope:
                before, after = [group[0]["unique_cell_hours_sum"] for group in rows]
                check.update(
                    state="conserved"
                    if math.isclose(before, after, rel_tol=1e-10, abs_tol=1e-8)
                    else "mismatch",
                    difference_hours=after - before,
                )
            checks.append(check)
    return checks


def display_rows(path, entry, file, source, support):
    text = path.read_text(encoding="utf-8")
    module = "OF_DATA_DAYS" if entry["format"] == "front-display" else "OF_DATA_SST"
    matches = list(
        re.finditer(r"window\." + module + r'\["(\d{4}-\d{2}-\d{2})"\]\s*=\s*', text)
    )
    if len(matches) != 1:
        raise ValueError("invalid_display_assignment")
    match = matches[0]
    payload, end = json.JSONDecoder().raw_decode(text[match.end() :])
    if text[match.end() + end :].strip() != ";":
        raise ValueError("trailing_display_program")
    if not isinstance(payload, dict):
        raise TypeError("invalid_display_payload")
    day = date.fromisoformat(payload["date"]).isoformat()
    grid = object_field(payload, "grid")
    quality = object_field(payload, "quality")
    product = object_field(payload, "product")
    stats = object_field(payload, "stats")
    nx, ny = grid["nx"], grid["ny"]
    if (
        not isinstance(nx, int)
        or not isinstance(ny, int)
        or isinstance(nx, bool)
        or isinstance(ny, bool)
        or min(nx, ny) <= 0
        or nx * ny > MAX_SAMPLES
    ):
        raise ValueError("invalid_grid_budget")
    lon = float(grid["lon0"]) + np.arange(nx) * float(grid["dlon"])
    lat = float(grid["lat0"]) + np.arange(ny) * float(grid["dlat"])
    actual_grid = {
        "lon": axis(lon),
        "lat": axis(lat),
        "convention": "display_sample_positions; cell bounds unverified",
    }

    def runs_mask(runs, with_values=False):
        mask = np.zeros((ny, nx), dtype=bool)
        values = np.zeros((ny, nx), dtype=float)
        for run in runs:
            if len(run) != (4 if with_values else 3) or any(
                not isinstance(v, int) or isinstance(v, bool) for v in run[:3]
            ):
                raise ValueError("invalid_run")
            row, start, count = run[:3]
            if (
                not (0 <= row < ny and 0 <= start < nx and 0 < count <= nx - start)
                or mask[row, start : start + count].any()
            ):
                raise ValueError("invalid_or_overlapping_run")
            mask[row, start : start + count] = True
            if with_values:
                value = number(run[3])
                if value is None or not np.isfinite(value):
                    raise ValueError("invalid_run_value")
                values[row, start : start + count] = value
        return mask, values

    reasons = []
    if day != match[1] or file_date(path) and day != file_date(path):
        reasons.append("filename_content_date_mismatch")
    temperature, decoding, cold, warm, detected = None, None, None, None, None
    if source["kind"] == "front":
        missing, _ = runs_mask(payload["nodata_rle"])
        front, codes = runs_mask(payload["front_band_rle"], True)
        if (missing & front).any() or not np.isin(codes[front], [-10, 10, 30]).all():
            raise ValueError("invalid_front_mask")
        valid = ~missing
        detected = int(front.sum())
        if "cold_side_rle" in payload and "warm_side_rle" in payload:
            cold_mask, _ = runs_mask(payload["cold_side_rle"])
            warm_mask, _ = runs_mask(payload["warm_side_rle"])
            if (cold_mask & warm_mask).any() or (
                (cold_mask | warm_mask) & missing
            ).any():
                raise ValueError("invalid_side_mask")
            cold, warm = int(cold_mask.sum()), int(warm_mask.sum())
        else:
            reasons.append("side_masks_unavailable")
        declared = quality.get("valid_cells")
        unit = "classification_code; display_contract"
    else:
        valid, bins = runs_mask(payload["runs"], True)
        quantum = number(payload["bin_c"])
        if quantum is None or not np.isfinite(quantum) or quantum <= 0:
            raise ValueError("invalid_temperature_quantization")
        unit = product.get("unit")
        valid, decoding, temperature = decode_sst(
            bins * quantum, valid, {"units": unit}
        )
        decoding["quantization_step_c"] = quantum
        if temperature is None:
            reasons.append("sst_unit_unverified; no_heuristic_conversion")
        declared = stats.get("valid_cells")
    if declared is not None and declared != int(valid.sum()):
        reasons.append("declared_valid_count_mismatch")
    return [
        {
            "date": day,
            "file_id": file["id"],
            "file_sha256": file["sha256"],
            "filename_date": file_date(path),
            "time_verified": False,
            "time_basis": "display_declared_date; original_time_coordinate_unverified",
            "state": "conflict" if reasons else "parsed",
            "reasons": reasons,
            "grid": actual_grid,
            "unit": unit,
            "valid_samples": int(valid.sum()),
            "missing_samples": int((~valid).sum()),
            "front_detected_samples": detected,
            "cold_samples": cold,
            "warm_samples": warm,
            "temperature_c": temperature,
            "decoding": decoding,
            "support_scope": "display_mask_only",
            "support_artifact": support_file(
                support, file["sha256"] + "display", valid, lon, lat
            ),
        }
    ]


def netcdf_rows(path, entry, file, source, support, requested_range):
    rows = []
    variable = entry["variable"]
    with xr.open_dataset(
        path, decode_cf=False, mask_and_scale=False, decode_times=False
    ) as dataset:
        field = dataset[variable]
        lon_name, lat_name, time_name = (
            entry.get(name, default)
            for name, default in [("lon", "lon"), ("lat", "lat"), ("time", "time")]
        )
        if "bbox" in entry:
            west, south, east, north = entry["bbox"]
            field = field.sel(
                {
                    lon_name: field[lon_name][
                        (field[lon_name] >= west) & (field[lon_name] <= east)
                    ],
                    lat_name: field[lat_name][
                        (field[lat_name] >= south) & (field[lat_name] <= north)
                    ],
                }
            )
        lon, lat = field[lon_name].values, field[lat_name].values
        grid = {
            "lon": axis(lon),
            "lat": axis(lat),
            "convention": "coordinate_samples; cell bounds unverified",
        }
        grid["coordinate_units"] = {
            "lon": field[lon_name].attrs.get("units"),
            "lat": field[lat_name].attrs.get("units"),
        }
        time_values = dataset[time_name]
        try:
            calendar = time_values.attrs.get("calendar", "standard")
            if (
                calendar not in ["standard", "gregorian", "proleptic_gregorian"]
                or entry.get("day_boundary") != "UTC"
            ):
                raise ValueError("unsupported_day_boundary")
            decoded = xr.coding.times.decode_cf_datetime(
                time_values.values,
                time_values.attrs["units"],
                calendar=calendar,
                use_cftime=False,
            )
            dates = [str(value)[:10] for value in decoded]
            for value in dates:
                date.fromisoformat(value)
            time_verified = True
        except (ValueError, KeyError, OverflowError):
            dates = [file_date(path)] * len(time_values)
            time_verified = False
        selected_count = sum(
            day is not None and requested_range[0] <= day <= requested_range[1]
            for day in dates
        )
        if len(lon) * len(lat) * selected_count > MAX_SAMPLES:
            raise ValueError("slice_budget_exceeded")
        for index, day in enumerate(dates):
            if day is None:
                raise ValueError("date_unknown")
            reasons = (
                []
                if time_verified
                else ["time_coordinate_unverified; filename_date_inferred"]
            )
            if len(dates) == 1 and file_date(path) and day != file_date(path):
                reasons.append("filename_content_date_mismatch")
            if not requested_range[0] <= day <= requested_range[1]:
                rows.append({"date": day, "file_id": file["id"], "reasons": reasons})
                continue
            raw = np.asarray(
                field.isel({time_name: index}).transpose(lat_name, lon_name).values
            )
            valid = np.isfinite(raw)
            attrs = field.attrs
            for key in ["_FillValue", "missing_value"]:
                if key in attrs:
                    for fill in np.atleast_1d(attrs[key]):
                        valid &= raw != fill
            raw_missing_samples = int((~valid).sum())
            auxiliary_mask = {"basis": "not_configured; no_extra_quality_mask_inferred"}
            if entry.get("mask_variable"):
                allowed = entry["valid_mask_values"]
                if (
                    not isinstance(allowed, list)
                    or not allowed
                    or any(
                        number(value) is None or not np.isfinite(number(value))
                        for value in allowed
                    )
                ):
                    raise ValueError("invalid_mask_declaration")
                mask = dataset[entry["mask_variable"]]
                if time_name in mask.dims:
                    mask = mask.isel({time_name: index})
                mask = mask.sel(
                    {lon_name: field[lon_name], lat_name: field[lat_name]}
                ).transpose(lat_name, lon_name)
                valid &= np.isin(mask.values, allowed)
                auxiliary_mask = {
                    "basis": "registry_declared_values; product_verification_pending",
                    "variable": entry["mask_variable"],
                    "allowed_values": allowed,
                }
            front = source["kind"] == "front"
            decoding, temperature = None, None
            code_basis, front_count, cold_count, warm_count = None, None, None, None
            if front:
                meanings = str(attrs.get("flag_meanings", "")).split()
                codes = np.atleast_1d(attrs.get("flag_values", []))
                mapping = (
                    dict(zip(meanings, codes, strict=True))
                    if len(meanings) == len(codes)
                    else {}
                )
                if {
                    "background",
                    "cold_side",
                    "warm_side",
                    "front_line",
                    "cold_line",
                    "warm_line",
                }.issubset(mapping):
                    known = np.isin(
                        raw,
                        [
                            mapping[key]
                            for key in [
                                "background",
                                "cold_side",
                                "warm_side",
                                "front_line",
                                "cold_line",
                                "warm_line",
                            ]
                        ],
                    )
                    if np.any(valid & ~known):
                        reasons.append("unrecognized_front_codes")
                    valid &= known
                    front_count = int(
                        (
                            valid
                            & np.isin(
                                raw,
                                [
                                    mapping[key]
                                    for key in ["front_line", "cold_line", "warm_line"]
                                ],
                            )
                        ).sum()
                    )
                    cold_count, warm_count = (
                        int((valid & (raw == mapping["cold_side"])).sum()),
                        int((valid & (raw == mapping["warm_side"])).sum()),
                    )
                    code_basis = "file_flag_meanings"
                else:
                    reasons.append("front_code_meanings_unverified; side_unknown")
                    code_basis = "unverified"
            else:
                valid, decoding, temperature = decode_sst(raw, valid, attrs)
                if decoding["unit_basis"] == "unverified":
                    reasons.append("sst_unit_unverified; no_heuristic_conversion")
            row = {
                "date": day,
                "file_id": file["id"],
                "file_sha256": file["sha256"],
                "time_index": index,
                "time_verified": time_verified,
                "filename_date": file_date(path),
                "time_metadata": {
                    "units": time_values.attrs.get("units"),
                    "calendar": time_values.attrs.get("calendar", "standard"),
                    "day_boundary": entry.get("day_boundary"),
                },
                "state": "parsed" if not reasons else "unverified",
                "reasons": reasons,
                "grid": grid,
                "unit": str(attrs.get("units", "unknown")),
                "decoding": decoding,
                "temperature_c": temperature,
                "auxiliary_mask": auxiliary_mask,
                "valid_samples": int(valid.sum()),
                "missing_samples": int((~valid).sum()),
                "raw_missing_samples": raw_missing_samples,
                "excluded_by_mask_range_or_code_samples": int((~valid).sum())
                - raw_missing_samples,
                "front_detected_samples": front_count,
                "cold_samples": cold_count,
                "warm_samples": warm_count,
                "code_basis": code_basis,
                "support_scope": "display_mask_only"
                if source["role"] == "display"
                else "source_mask; qualification_pending",
                "support_artifact": support_file(
                    support, file["sha256"] + str(index), valid, lon, lat
                ),
            }
            rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--read-daily-snapshot", type=Path)
    parser.add_argument("--daily-registry", type=Path)
    parser.add_argument("--source-snapshot", type=Path)
    parser.add_argument("--private-locators", type=Path)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--report-out", type=Path)
    parser.add_argument("--support-out", type=Path)
    args = parser.parse_args()
    if args.read_daily_snapshot:
        frozen = json.loads(args.read_daily_snapshot.read_text(encoding="utf-8"))
        identity = {
            key: value for key, value in frozen.items() if key != "daily_snapshot_id"
        }
        if (
            frozen.get("schema") != SCHEMA
            or frozen.get("daily_snapshot_id") != "sha256:" + digest(identity)
            or frozen.get("research_ready") is not False
            or frozen.get("public_release_approved") is not False
        ):
            raise ValueError("invalid_daily_snapshot")
        print(json.dumps(frozen, ensure_ascii=False, indent=2, allow_nan=False))
        return
    if not all(
        [
            args.daily_registry,
            args.source_snapshot,
            args.private_locators,
            args.start,
            args.end,
            args.out,
        ]
    ):
        parser.error(
            "daily audit requires registry, source snapshot, private locators, date range and output"
        )
    if args.end < args.start or (args.end - args.start).days > 366:
        raise ValueError("invalid_date_budget")
    registry = json.loads(args.daily_registry.read_text(encoding="utf-8"))
    snapshot = json.loads(args.source_snapshot.read_text(encoding="utf-8"))
    private = json.loads(args.private_locators.read_text(encoding="utf-8"))
    if (
        registry.get("schema") != "ocean-daily-audit-registry/v1"
        or snapshot.get("schema") != "ocean-source-audit/v1"
        or private.get("schema") != "ocean-source-locators/private-v1"
        or private.get("snapshot_id") != snapshot.get("snapshot_id")
    ):
        raise ValueError("incompatible_audit_inputs")
    if snapshot["snapshot_id"] != "sha256:" + digest(
        {key: snapshot[key] for key in ["contract", "processing_version", "sources"]}
    ):
        raise ValueError("invalid_source_snapshot_identity")
    ids = [entry["id"] for entry in registry["sources"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate_source_declaration")
    registered = {source["id"]: source for source in snapshot["sources"]}
    for entry in registry["sources"]:
        if entry["id"] not in registered or entry["format"] not in [
            "netcdf",
            "front-display",
            "sst-display",
            "activity-json",
            "activity-csv",
            "activity-files",
        ]:
            raise ValueError("unsupported_source_reader")
        kind = registered[entry["id"]]["kind"]
        if (
            entry["format"] == "netcdf"
            and kind not in ["front", "sst"]
            or entry["format"].startswith("activity")
            and kind != "activity"
            or entry["format"] == "front-display"
            and kind != "front"
            or entry["format"] == "sst-display"
            and kind != "sst"
        ):
            raise ValueError("reader_kind_mismatch")
        if (
            entry["format"] in ["front-display", "sst-display"]
            and registered[entry["id"]]["role"] != "display"
        ):
            raise ValueError("display_reader_requires_display_role")
    file_locations = [item for item in private["locations"] if "id" in item]
    locations = {item["id"]: Path(item["path"]) for item in file_locations}
    if len(locations) != len(file_locations):
        raise ValueError("conflicting_private_locators")
    inputs = [
        args.daily_registry,
        args.source_snapshot,
        args.private_locators,
        *locations.values(),
    ]
    outputs = [
        path.resolve() for path in [args.out, args.report_out, args.support_out] if path
    ]
    if any(
        left == right or left in right.parents or right in left.parents
        for index, left in enumerate(outputs)
        for right in outputs[index + 1 :]
    ):
        raise ValueError("overlapping_audit_outputs")
    for target in [args.out, args.report_out, args.support_out]:
        if target and any(
            target.resolve() == path.resolve()
            or target.resolve() in path.resolve().parents
            for path in inputs
        ):
            raise ValueError("output_overlaps_input")
    results = []
    for entry in registry["sources"]:
        source = next(s for s in snapshot["sources"] if s["id"] == entry["id"])
        days, errors, evidence = [], [], []
        for file in source["files"]:
            path = locations[file["id"]]
            if entry.get("file_pattern") and not re.fullmatch(
                entry["file_pattern"], path.name
            ):
                continue
            named_day = file_date(path)
            try:
                if path.stat().st_size != file["bytes"]:
                    raise ValueError("snapshot_content_changed")
                if entry["format"] != "netcdf" and file["bytes"] > 16 * 1024 * 1024:
                    raise ValueError("text_budget_exceeded")
                if file_digest(path) != file["sha256"]:
                    raise ValueError("snapshot_content_changed")
                if entry["format"] in [
                    "activity-json",
                    "activity-csv",
                    "activity-files",
                ]:
                    parsed = activity_rows(path, entry, file, source, args.support_out)
                elif entry["format"] in ["front-display", "sst-display"]:
                    parsed = display_rows(path, entry, file, source, args.support_out)
                else:
                    parsed = netcdf_rows(
                        path,
                        entry,
                        file,
                        source,
                        args.support_out,
                        [args.start.isoformat(), args.end.isoformat()],
                    )
                evidence.append(
                    {
                        "file_id": file["id"],
                        "filename_date": named_day,
                        "content_dates": sorted({row["date"] for row in parsed}),
                        "reasons": sorted(
                            {reason for row in parsed for reason in row["reasons"]}
                        ),
                    }
                )
                days.extend(parsed)
            except (
                ValueError,
                TypeError,
                KeyError,
                IndexError,
                OSError,
                OverflowError,
            ) as error:
                message = str(error)
                errors.append(
                    {
                        "file_id": file["id"],
                        "reason": message
                        if isinstance(error, (ValueError, TypeError))
                        and re.fullmatch("[a-z_]+", message)
                        else type(error).__name__,
                    }
                )
        days = [
            row
            for row in days
            if args.start.isoformat() <= row["date"] <= args.end.isoformat()
        ]
        for row in days:
            same_day = [other for other in days if other["date"] == row["date"]]
            if len({other["file_id"] for other in same_day}) > 1:
                row["state"] = "conflict"
                row["reasons"].append("duplicate_day_support")
            elif len(same_day) > 1:
                row["state"] = "unverified"
                row["reasons"].append("multiple_time_slices_not_aggregated")
        for offset in range((args.end - args.start).days + 1):
            day = (args.start + timedelta(days=offset)).isoformat()
            if not any(row["date"] == day for row in days):
                days.append(
                    {
                        "date": day,
                        "state": "missing",
                        "reasons": ["no_parsed_daily_input"],
                        "valid_samples": None,
                    }
                )
        results.append(
            {
                "id": source["id"],
                "kind": source["kind"],
                "role": source["role"],
                "source_access": source["inspection"]["access"],
                "source_gaps": source["gaps"],
                "days": days,
                "errors": errors,
                "file_evidence": evidence,
            }
        )
    report = {
        "schema": SCHEMA,
        "source_snapshot_id": snapshot["snapshot_id"],
        "registry_sha256": file_digest(args.daily_registry),
        "auditor_sha256": file_digest(Path(__file__)),
        "range": [args.start.isoformat(), args.end.isoformat()],
        "evidence_kind": registry.get("evidence_kind", "unknown"),
        "sources": results,
        "research_ready": False,
        "public_release_approved": False,
    }
    report["lineage_checks"] = compare_lineage(results, registry["sources"])
    report["daily_snapshot_id"] = "sha256:" + digest(report)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    if args.report_out:
        lines = [
            "# Ocean 逐日资料审计",
            "",
            f"快照：`{report['daily_snapshot_id']}`",
            "",
            "解析成功不等于研究合格。展示掩码、来源观测和合成测试分别记证；不以文件存在、非空范围或空记录证明完整覆盖。",
            "",
            "| 来源 / 角色 | 日期 | 状态 | 有效样本或记录 | 缺测 / 未知 | 显式零记录 | 单位 |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
        for source in results:
            for row in source["days"]:
                counts = row.get("record_counts", {})
                label = (
                    str(row.get("unit", "unknown"))
                    .replace("|", "\\|")
                    .replace("\n", " ")
                )
                lines.append(
                    f"| {source['id']} / {source['role']} | {row['date']} | {row['state']} | {counts.get('valid', row.get('valid_samples'))} | {row.get('missing_samples', 'unknown')} | {counts.get('zero', 'n/a')} | {label} |"
                )
            for error in source["errors"]:
                lines.append(
                    f"\n- {source['id']} / {error['file_id']}：{error['reason']}"
                )
        lines.extend(
            [
                "",
                "小时守恒仅比较声明同源范围内的有效记录总量；原档/单位/范围不足时保持not_verified。许可、几何与完整月资格另行验收。",
                "",
            ]
        )
        args.report_out.parent.mkdir(parents=True, exist_ok=True)
        args.report_out.write_text("\n".join(lines), encoding="utf-8")
    print("Daily audit complete; research qualification remains unverified.")


if __name__ == "__main__":
    try:
        main()
    except (
        ValueError,
        OSError,
        KeyError,
        TypeError,
        IndexError,
        StopIteration,
        RuntimeError,
    ) as error:
        print("Daily audit failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
