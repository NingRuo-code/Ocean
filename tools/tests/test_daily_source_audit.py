"""CLI contract tests; tiny literals are synthetic, never real research coverage."""

import json
import subprocess
from pathlib import Path

import numpy as np
import pytest
import xarray as xr

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "tools/audit-research-baseline.mjs"


@pytest.mark.parametrize(
    "field,value",
    [
        ("source", None),
        ("coverage", None),
        ("matching", None),
        ("source", []),
        ("coverage", "bad"),
        ("matching", 3),
    ],
)
def test_optional_metadata_is_controlled_without_aborting_other_sources(
    tmp_path, field, value
):
    bad = tmp_path / "effort20240805.json"
    bad.write_text(
        json.dumps(
            {"date": "2024-08-05", "unit": "fishing_hours", "cells": [], field: value}
        ),
        encoding="utf-8",
    )
    good = tmp_path / "front20240805.nc"
    front_file(good)
    prepare(
        tmp_path,
        [
            ("effort", "activity", bad, {"format": "activity-json"}),
            ("front", "front", good, {"format": "netcdf", "variable": "front"}),
        ],
    )
    sources = audit(tmp_path)["sources"]
    assert sources[1]["days"][0]["valid_samples"] == 3
    if value is None:
        assert sources[0]["days"][0]["record_counts"]["total"] == 0
    else:
        assert sources[0]["errors"][0]["reason"] == "invalid_metadata_object"


def test_content_day_is_checked_even_when_filename_is_outside_window(tmp_path):
    source = tmp_path / "effort20240804.json"
    source.write_text(
        json.dumps(
            {
                "date": "2024-08-05",
                "unit": "fishing_hours",
                "cells": [{"lon": 122, "lat": 30, "hours": 0}],
            }
        ),
        encoding="utf-8",
    )
    prepare(tmp_path, [("effort", "activity", source, {"format": "activity-json"})])
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert "filename_content_date_mismatch" in row["reasons"]
    assert row["record_counts"]["zero"] == 1


def test_unsigned_packing_is_explicitly_rejected_until_supported(tmp_path):
    source = tmp_path / "sst20240805.nc"
    ds = xr.Dataset(
        {"sst": (("time", "lat", "lon"), np.array([[[-32000]]], dtype=np.int16))},
        coords={"time": [0], "lat": [30], "lon": [122]},
    )
    ds.time.attrs.update(units="hours since 2024-08-05", calendar="standard")
    ds.sst.attrs.update(units="K", scale_factor=0.009, _Unsigned="true")
    ds.to_netcdf(source, engine="h5netcdf")
    prepare(tmp_path, [("sst", "sst", source, {"format": "netcdf", "variable": "sst"})])
    result = audit(tmp_path)["sources"][0]
    assert result["errors"][0]["reason"] == "unsupported_unsigned_encoding"
    assert result["days"][0]["state"] == "missing"


def test_mixed_csv_units_cannot_be_verified_by_registry_fallback(tmp_path):
    source = tmp_path / "effort20240805.csv"
    source.write_text(
        "date,lon,lat,hours,unit\n2024-08-05,122,30,1,fishing_hours\n2024-08-05,123,30,2,minutes\n",
        encoding="utf-8",
    )
    prepare(
        tmp_path,
        [
            (
                "effort",
                "activity",
                source,
                {"format": "activity-csv", "unit": "fishing_hours"},
            )
        ],
    )
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert row["unit_status"] == "conflict"
    assert "activity_unit_conflict" in row["reasons"]
    assert row["reported_valid_hours_sum"] is None
    assert row["unique_cell_hours_sum"] is None
    assert row["legacy_max_diagnostic_hours"] is None
    assert row["state"] == "conflict"


@pytest.mark.parametrize(
    "content",
    [
        '{"date":"2024-08-05","unit":"minutes","unit":"fishing_hours",'
        '"cells":[{"lon":122,"lat":30,"hours":0}]}',
        '{"date":"2024-08-05","unit":"fishing_hours",'
        '"cells":[{"lon":122,"lat":30,"hours":12,"hours":0}]}',
        '{"date":"2024-08-05","unit":"fishing_hours",'
        '"cells":[{"lon":122,"lat":30,"hours":12,"\\u0068ours":0}]}',
    ],
)
def test_duplicate_activity_json_fields_never_choose_a_value_or_drop_other_sources(
    tmp_path, content
):
    bad = tmp_path / "effort20240805.json"
    bad.write_text(content, encoding="utf-8")
    good = tmp_path / "front20240805.nc"
    front_file(good)
    prepare(
        tmp_path,
        [
            ("activity", "activity", bad, {"format": "activity-json"}),
            ("front", "front", good, {"format": "netcdf", "variable": "front"}),
        ],
    )
    value = audit(tmp_path)
    bad_source, good_source = value["sources"]
    assert bad_source["errors"][0]["reason"] == "duplicate_json_key"
    assert bad_source["days"][0]["state"] == "missing"
    assert good_source["days"][0]["valid_samples"] == 3
    assert value["research_ready"] is False


@pytest.mark.parametrize(
    "content",
    [
        "date,lon,lat,hours,hours,unit\n2024-08-05,122,30,12,0,fishing_hours\n",
        "date,lon,lat,hours,unit,unit\n2024-08-05,122,30,0,minutes,fishing_hours\n",
    ],
)
def test_duplicate_csv_columns_cannot_overwrite_hours_or_units(tmp_path, content):
    bad = tmp_path / "effort20240805.csv"
    bad.write_text(content, encoding="utf-8")
    prepare(tmp_path, [("activity", "activity", bad, {"format": "activity-csv"})])
    value = audit(tmp_path)["sources"][0]
    assert value["errors"][0]["reason"] == "duplicate_csv_column"
    assert value["days"][0]["state"] == "missing"


@pytest.mark.parametrize(
    "prefix",
    [
        "window.OF_DATA_SST['2024-08-05'] = {};\n",
        'window.PRIVATE_SENTINEL = "unrelated program";\n',
        '// comment\u2028window.PRIVATE_SENTINEL = "unrelated program";\n',
    ],
)
def test_display_audit_rejects_hidden_prefix_program_instead_of_selecting_later_assignment(
    tmp_path, prefix
):
    source = tmp_path / "sst20240805.js"
    payload = {
        "date": "2024-08-05",
        "grid": {"lon0": 122, "lat0": 30, "dlon": 0.05, "dlat": 0.05, "nx": 1, "ny": 1},
        "product": {"unit": "degree_C"},
        "bin_c": 0.5,
        "runs": [[0, 0, 1, 60]],
    }
    source.write_text(
        prefix + 'window.OF_DATA_SST["2024-08-05"] = ' + json.dumps(payload) + ";",
        encoding="utf-8",
    )
    prepare(tmp_path, [("sst", "sst", source, {"format": "sst-display", "role": "display"})])
    row = audit(tmp_path)["sources"][0]
    assert row["errors"][0]["reason"] == "invalid_display_program"
    assert row["days"][0]["state"] == "missing"


@pytest.mark.parametrize("ending", ["", "\n", "\r\n", "\u2028", "\u2029", "block"])
def test_commented_export_is_not_an_observation_and_other_source_still_audits(tmp_path, ending):
    source = tmp_path / "sst20240805.js"
    payload = {
        "date": "2024-08-05",
        "grid": {"lon0": 122, "lat0": 30, "dlon": 0.05, "dlat": 0.05, "nx": 1, "ny": 1},
        "product": {"unit": "degree_C"}, "bin_c": 0.5, "runs": [[0, 0, 1, 60]],
    }
    assignment = 'window.OF_DATA_SST["2024-08-05"] = ' + json.dumps(payload) + ";"
    text = "/* " + assignment + " */" if ending == "block" else "// " + assignment + ending
    source.write_text(text, encoding="utf-8")
    good = tmp_path / "front20240805.nc"
    front_file(good)
    prepare(tmp_path, [
        ("sst", "sst", source, {"format": "sst-display", "role": "display"}),
        ("front", "front", good, {"format": "netcdf", "variable": "front"}),
    ])
    sources = audit(tmp_path)["sources"]
    assert sources[0]["errors"][0]["reason"] == "invalid_display_assignment"
    assert sources[0]["days"][0]["state"] == "missing"
    assert sources[1]["days"][0]["valid_samples"] == 3


def prepare(tmp_path, sources):
    registry = {
        "schema": "ocean-source-registry/v1",
        "processing_version": "fixture-v1",
        "sources": [],
    }
    daily = {
        "schema": "ocean-daily-audit-registry/v1",
        "evidence_kind": "synthetic",
        "sources": [],
    }
    for source_id, kind, file, options in sources:
        registry["sources"].append(
            {
                "id": source_id,
                "kind": kind,
                "role": options.get("role", "analysis_source"),
                "locations": [str(file.relative_to(tmp_path))],
                "product": {
                    "id": source_id,
                    "channel": "synthetic",
                    "version": "v1",
                    "unit": "declared",
                },
            }
        )
        daily["sources"].append({"id": source_id, "day_boundary": "UTC", **options})
    (tmp_path / "registry.json").write_text(json.dumps(registry), encoding="utf-8")
    (tmp_path / "daily.json").write_text(json.dumps(daily), encoding="utf-8")
    first = subprocess.run(
        [
            "node",
            str(CLI),
            "--source-registry",
            str(tmp_path / "registry.json"),
            "--source-root",
            str(tmp_path),
            "--out",
            str(tmp_path / "snapshot.json"),
            "--private-out",
            str(tmp_path / "private.json"),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert first.returncode == 0, first.stderr


def run_daily_cli(tmp_path, start="2024-08-05", end="2024-08-05"):
    return subprocess.run(
        [
            "node",
            str(CLI),
            "--daily-registry",
            str(tmp_path / "daily.json"),
            "--source-snapshot",
            str(tmp_path / "snapshot.json"),
            "--private-locators",
            str(tmp_path / "private.json"),
            "--start",
            start,
            "--end",
            end,
            "--out",
            str(tmp_path / "report.json"),
            "--support-out",
            str(tmp_path / "support"),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )


def audit(tmp_path, start="2024-08-05", end="2024-08-05"):
    result = run_daily_cli(tmp_path, start, end)
    assert result.returncode == 0, result.stderr
    return json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))


def front_file(path, values=None, times=None, units="hours since 2024-08-05 00:00:00"):
    values = np.array(
        [[[0, -128], [10, -20]]] if values is None else values, dtype=np.int16
    )
    ds = xr.Dataset(
        {"front": (("time", "lat", "lon"), values)},
        coords={
            "time": [0] if times is None else times,
            "lat": [31.0, 30.0],
            "lon": [122.0, 123.0],
        },
    )
    ds.time.attrs.update(units=units, calendar="standard")
    ds.front.attrs.update(
        units="classification_code",
        _FillValue=np.int16(-128),
        flag_values=np.array([-128, -20, -10, 0, 10, 20, 30], dtype=np.int16),
        flag_meanings="missing cold_side cold_line background warm_line warm_side front_line",
    )
    ds.to_netcdf(path, engine="h5netcdf")


def test_front_cli_separates_nondetection_from_fill_and_exports_actual_support(
    tmp_path,
):
    source = tmp_path / "front20240805.nc"
    front_file(source)
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                source,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    report = audit(tmp_path)
    row = report["sources"][0]["days"][0]
    assert row["date"] == "2024-08-05"
    assert row["state"] == "parsed"
    assert row["valid_samples"] == 3
    assert row["missing_samples"] == 1
    assert row["front_detected_samples"] == 1
    assert row["cold_samples"] == 1
    assert row["grid"]["lat"]["step"] == -1
    assert row["grid"]["lon"]["first"] == 122
    support = np.load(tmp_path / "support" / row["support_artifact"])
    assert support["valid"].tolist() == [[True, False], [True, True]]
    assert support["lat"].tolist() == [31, 30]
    assert report["research_ready"] is False
    assert str(tmp_path) not in json.dumps(report)


def test_sst_packed_kelvin_is_decoded_with_fill_and_raw_valid_range(tmp_path):
    source = tmp_path / "sst20240805.nc"
    ds = xr.Dataset(
        {
            "sst": (
                ("time", "lat", "lon"),
                np.array([[[27315, 30000], [-9999, -1]]], dtype=np.int32),
            )
        },
        coords={"time": [0], "lat": [30.0, 31.0], "lon": [122.0, 123.0]},
    )
    ds.time.attrs["units"] = "hours since 2024-08-05"
    ds.sst.attrs.update(
        units="K",
        scale_factor=0.01,
        add_offset=0.0,
        _FillValue=np.int32(-9999),
        valid_range=np.array([0, 40000], dtype=np.int32),
    )
    ds.to_netcdf(source, engine="h5netcdf")
    prepare(
        tmp_path,
        [("sst-original", "sst", source, {"format": "netcdf", "variable": "sst"})],
    )
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert row["valid_samples"] == 2
    assert row["missing_samples"] == 2
    assert row["temperature_c"]["min"] == 0
    assert row["temperature_c"]["max"] == 26.85
    assert row["decoding"]["scale_factor"] == 0.01
    assert row["decoding"]["unit_basis"] == "file_attribute"


def test_multiday_and_duplicate_files_are_not_silently_selected_or_summed(tmp_path):
    folder = tmp_path / "raw"
    folder.mkdir()
    values = [[[0, -128], [10, -20]], [[0, 0], [0, 0]]]
    front_file(folder / "front20240805.nc", values, [0, 24])
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                folder,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    report = audit(tmp_path, end="2024-08-06")
    assert [r["date"] for r in report["sources"][0]["days"]] == [
        "2024-08-05",
        "2024-08-06",
    ]
    assert report["sources"][0]["days"][1]["front_detected_samples"] == 0
    assert report["sources"][0]["days"][1]["valid_samples"] == 4
    (folder / "copy20240805.nc").write_bytes((folder / "front20240805.nc").read_bytes())
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                folder,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    rows = audit(tmp_path, end="2024-08-06")["sources"][0]["days"]
    assert len(rows) == 4
    assert all(
        r["state"] == "conflict" and "duplicate_day_support" in r["reasons"]
        for r in rows
    )


def test_wrong_filename_date_and_invalid_cf_time_remain_traceable(tmp_path):
    source = tmp_path / "front20240805.nc"
    front_file(source, units="hours since 2024-08-06")
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                source,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    result = audit(tmp_path)["sources"][0]
    assert result["days"][0]["state"] == "missing"
    assert result["file_evidence"][0]["content_dates"] == ["2024-08-06"]
    assert "filename_content_date_mismatch" in result["file_evidence"][0]["reasons"]
    front_file(source, units="days since 0000-00-00")
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                source,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert row["state"] == "unverified"
    assert row["time_verified"] is False
    assert any("filename_date_inferred" in reason for reason in row["reasons"])


def test_activity_distinguishes_reported_zero_missing_anomalies_and_duplicate_hours(
    tmp_path,
):
    source = tmp_path / "activity20240805.json"
    payload = {
        "date": "2024-08-05",
        "unit": "fishing_hours",
        "spatial_resolution_deg": 0.1,
        "cells": [
            {"lon": 122, "lat": 30, "hours": 5},
            {"lon": 122.1, "lat": 30, "hours": 0},
            {"lon": 122.2, "lat": 30},
            {"lon": 122.3, "lat": 30, "hours": None},
            {"lon": 122.4, "lat": 30, "hours": float("nan")},
            {"lon": 122.5, "lat": 30, "hours": -2},
            {"lon": 122.6, "lat": 30, "hours": 30},
            {"lon": 122, "lat": 30, "hours": 6},
        ],
    }
    source.write_text(json.dumps(payload), encoding="utf-8")
    prepare(
        tmp_path, [("effort-original", "activity", source, {"format": "activity-json"})]
    )
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert row["record_counts"] == {
        "total": 8,
        "valid": 4,
        "zero": 1,
        "missing": 2,
        "nonfinite": 1,
        "negative": 1,
        "invalid_coordinate": 0,
        "invalid_type": 0,
        "above_24": 1,
    }
    assert row["reported_valid_hours_sum"] == 41
    assert row["duplicate_cell_groups"] == 1
    assert row["legacy_max_diagnostic_hours"] == 36
    assert row["unique_cell_hours_sum"] is None
    assert row["coverage_status"] == "unknown"
    assert row["unlisted_cell_value"] == "unknown"
    assert row["resolution_check"] == "coarser_than_0.01_degree_target"
    assert row["state"] == "conflict"


def test_display_scripts_are_audited_as_quantized_exports_not_original_observations(
    tmp_path,
):
    front = tmp_path / "front20240805.js"
    sst = tmp_path / "sst20240805.js"
    grid = {"lon0": 122, "lat0": 30, "dlon": 0.05, "dlat": 0.05, "nx": 2, "ny": 2}
    front_payload = {
        "date": "2024-08-05",
        "grid": grid,
        "front_band_rle": [],
        "nodata_rle": [[1, 1, 1]],
        "cold_side_rle": [],
        "warm_side_rle": [],
        "quality": {"valid_cells": 3},
    }
    sst_payload = {
        "date": "2024-08-05",
        "grid": grid,
        "product": {"unit": "degree_C"},
        "bin_c": 0.5,
        "runs": [[0, 0, 2, 60]],
        "stats": {"valid_cells": 2},
    }
    front.write_text(
        'window.OF_DATA_DAYS["2024-08-05"]=' + json.dumps(front_payload) + ";",
        encoding="utf-8",
    )
    sst.write_text(
        'window.OF_DATA_SST["2024-08-05"]=' + json.dumps(sst_payload) + ";",
        encoding="utf-8",
    )
    prepare(
        tmp_path,
        [
            (
                "front-display",
                "front",
                front,
                {"format": "front-display", "role": "display"},
            ),
            ("sst-display", "sst", sst, {"format": "sst-display", "role": "display"}),
        ],
    )
    report = audit(tmp_path)
    f, t = [source["days"][0] for source in report["sources"]]
    assert (f["valid_samples"], f["missing_samples"], f["front_detected_samples"]) == (
        3,
        1,
        0,
    )
    assert t["valid_samples"] == 2 and t["temperature_c"] == {"min": 30.0, "max": 30.0}
    assert f["support_scope"] == t["support_scope"] == "display_mask_only"
    assert t["decoding"]["quantization_step_c"] == 0.5
    assert report["research_ready"] is False


def test_daily_snapshot_replays_without_reopening_sources_and_detects_drift(tmp_path):
    source = tmp_path / "front20240805.nc"
    front_file(source)
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                source,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    frozen = audit(tmp_path)
    source.write_bytes(b"changed source bytes")
    changed = audit(tmp_path)
    assert changed["sources"][0]["errors"][0]["reason"] == "snapshot_content_changed"
    (tmp_path / "report.json").write_text(json.dumps(frozen), encoding="utf-8")
    for name in [
        "front20240805.nc",
        "registry.json",
        "daily.json",
        "snapshot.json",
        "private.json",
    ]:
        (tmp_path / name).unlink()
    replay = subprocess.run(
        ["node", str(CLI), "--read-daily-snapshot", str(tmp_path / "report.json")],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert replay.returncode == 0, replay.stderr
    assert json.loads(replay.stdout) == frozen


@pytest.mark.parametrize("name", ["daily.json", "snapshot.json", "private.json"])
def test_daily_control_files_with_duplicate_schema_fail_without_publishing(tmp_path, name):
    source = tmp_path / "front20240805.nc"
    front_file(source)
    prepare(tmp_path, [("front", "front", source, {"format": "netcdf", "variable": "front"})])
    path = tmp_path / name
    original = path.read_text(encoding="utf-8")
    path.write_text(
        original.replace('"schema":', '"schema":"PRIVATE_SENTINEL", "schema":', 1),
        encoding="utf-8",
    )
    result = run_daily_cli(tmp_path)
    assert result.returncode == 1
    assert not (tmp_path / "report.json").exists()
    assert "PRIVATE_SENTINEL" not in result.stdout + result.stderr


def test_daily_frozen_replay_rejects_duplicate_alias_even_with_unchanged_final_identity(tmp_path):
    source = tmp_path / "front20240805.nc"
    front_file(source)
    prepare(tmp_path, [("front", "front", source, {"format": "netcdf", "variable": "front"})])
    audit(tmp_path)
    path = tmp_path / "report.json"
    path.write_text(
        path.read_text(encoding="utf-8").replace(
            '"research_ready": false',
            '"research_rea\\u0064y": true, "research_ready": false',
        ),
        encoding="utf-8",
    )
    result = subprocess.run(
        ["node", str(CLI), "--read-daily-snapshot", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert result.returncode == 1
    assert result.stdout == ""


def test_paired_hours_conservation_is_scoped_and_empty_records_are_not_zero(tmp_path):
    original = tmp_path / "original20240805.json"
    display = tmp_path / "display20240805.json"
    original.write_text(
        json.dumps(
            {
                "date": "2024-08-05",
                "unit": "fishing_hours",
                "spatial_resolution_deg": 0.01,
                "cells": [
                    {"lon": 122, "lat": 30, "hours": 5},
                    {"lon": 122.01, "lat": 30, "hours": 3},
                ],
            }
        ),
        encoding="utf-8",
    )
    display.write_text(
        json.dumps(
            {
                "date": "2024-08-05",
                "unit": "fishing_hours",
                "spatial_resolution_deg": 0.1,
                "cells": [{"lon": 122, "lat": 30, "hours": 7}],
            }
        ),
        encoding="utf-8",
    )
    sources = [
        (
            "effort-original",
            "activity",
            original,
            {"format": "activity-json", "scope_id": "sample-v1"},
        ),
        (
            "effort-display",
            "activity",
            display,
            {
                "format": "activity-json",
                "role": "display",
                "scope_id": "sample-v1",
                "compare_to": "effort-original",
            },
        ),
    ]
    prepare(tmp_path, sources)
    comparison = audit(tmp_path)["lineage_checks"][0]
    assert comparison["state"] == "mismatch"
    assert comparison["difference_hours"] == -1
    display.write_text(
        json.dumps({"date": "2024-08-05", "cells": []}), encoding="utf-8"
    )
    prepare(tmp_path, sources)
    empty = audit(tmp_path)
    row = empty["sources"][1]["days"][0]
    assert row["reported_valid_hours_sum"] is None
    assert row["unique_cell_hours_sum"] is None
    assert row["coverage_status"] == "unknown"
    assert empty["lineage_checks"][0]["state"] == "not_verified"


def test_csv_records_use_explicit_units_and_no_default_resolution(tmp_path):
    source = tmp_path / "activity20240805.csv"
    source.write_text(
        "date,lon,lat,hours,unit\n2024-08-05,122,30,0,fishing_hours\n2024-08-05,122.01,30,2.5,fishing_hours\n2024-08-05,122.02,30,,fishing_hours\n2024-08-05,122.03,30,garbage,fishing_hours\n2024-08-05,122.04,,4,fishing_hours\n",
        encoding="utf-8",
    )
    prepare(
        tmp_path, [("effort-original", "activity", source, {"format": "activity-csv"})]
    )
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert row["record_counts"]["valid"] == 2
    assert row["record_counts"]["zero"] == 1
    assert (
        row["record_counts"]["invalid_type"]
        == row["record_counts"]["missing"]
        == row["record_counts"]["invalid_coordinate"]
        == 1
    )
    assert row["reported_valid_hours_sum"] == 2.5
    assert row["resolution_deg_declared"] is None
    assert row["resolution_check"] == "unknown"


def test_missing_code_meanings_and_unknown_sst_units_do_not_get_inferred(tmp_path):
    front = tmp_path / "front20240805.nc"
    sst = tmp_path / "sst20240805.nc"
    front_file(front)
    with xr.open_dataset(front, decode_cf=False) as dataset:
        copied = dataset.load()
    del copied.front.attrs["flag_meanings"]
    copied.to_netcdf(front, engine="h5netcdf", mode="w")
    copied.front.attrs["units"] = "unspecified_temperature"
    copied = copied.rename({"front": "sst"})
    copied.to_netcdf(sst, engine="h5netcdf")
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                front,
                {"format": "netcdf", "variable": "front"},
            ),
            ("sst-original", "sst", sst, {"format": "netcdf", "variable": "sst"}),
        ],
    )
    f, t = [source["days"][0] for source in audit(tmp_path)["sources"]]
    assert f["cold_samples"] is None and f["warm_samples"] is None
    assert f["code_basis"] == "unverified"
    assert t["temperature_c"] is None
    assert t["decoding"]["unit_basis"] == "unverified"


def test_auxiliary_sst_mask_is_explicit_and_does_not_fill_invalid_cells(tmp_path):
    source = tmp_path / "sst20240805.nc"
    dataset = xr.Dataset(
        {
            "sst": (("time", "lat", "lon"), [[[20.0, 21.0], [22.0, 23.0]]]),
            "mask": (("time", "lat", "lon"), [[[1, 0], [1, 2]]]),
        },
        coords={"time": [0], "lat": [30.0, 31.0], "lon": [122.0, 123.0]},
    )
    dataset.time.attrs["units"] = "hours since 2024-08-05"
    dataset.sst.attrs["units"] = "degree_C"
    dataset.to_netcdf(source, engine="h5netcdf")
    prepare(
        tmp_path,
        [
            (
                "sst-original",
                "sst",
                source,
                {
                    "format": "netcdf",
                    "variable": "sst",
                    "mask_variable": "mask",
                    "valid_mask_values": [1],
                },
            )
        ],
    )
    row = audit(tmp_path)["sources"][0]["days"][0]
    assert row["valid_samples"] == 2
    assert row["temperature_c"] == {"min": 20.0, "max": 22.0}
    assert (
        row["auxiliary_mask"]["basis"]
        == "registry_declared_values; product_verification_pending"
    )


def test_cli_rejects_output_overlap_without_replacing_source_evidence(tmp_path):
    source = tmp_path / "front20240805.nc"
    front_file(source)
    prepare(
        tmp_path,
        [
            (
                "front-original",
                "front",
                source,
                {"format": "netcdf", "variable": "front"},
            )
        ],
    )
    before = source.read_bytes()
    result = subprocess.run(
        [
            "node",
            str(CLI),
            "--daily-registry",
            str(tmp_path / "daily.json"),
            "--source-snapshot",
            str(tmp_path / "snapshot.json"),
            "--private-locators",
            str(tmp_path / "private.json"),
            "--start",
            "2024-08-05",
            "--end",
            "2024-08-05",
            "--out",
            str(source),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert result.returncode != 0
    assert source.read_bytes() == before
    assert str(tmp_path) not in result.stderr
