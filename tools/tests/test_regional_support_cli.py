"""Regional-support contract through the existing audit CLI; all cells are synthetic."""

import json
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "tools/audit-research-baseline.mjs"


def layer(kind, cells, **options):
    return {
        "id": "effort-original" if kind == "activity" else kind + "-original",
        "kind": kind,
        "role": "analysis_source",
        "unit": "fishing_hours" if kind == "activity" else "classification_code",
        "time_verified": True,
        "bounds_verified": True,
        "support_verified": True,
        "duration_days": 1,
        "cells": cells,
        **options,
    }


def cell(bounds, hours=None, support="valid", side="unknown"):
    return {"bounds": bounds, "hours": hours, "support": support, "side": side}


def request(geometry, **options):
    return {
        "schema": "ocean-regional-request/v1",
        "purpose": "front_effort",
        "start": "2024-08-05",
        "end": "2024-08-05",
        "allocation": "overlap_uniform",
        "geometries": [geometry],
        **options,
    }


def run_cli(tmp_path, conditions, days, *, extra=None):
    (tmp_path / "request.json").write_text(json.dumps(conditions), encoding="utf-8")
    (tmp_path / "cells.json").write_text(
        json.dumps(
            {
                "schema": "ocean-regional-cells/v1",
                "evidence_kind": "synthetic",
                "days": days,
            }
        ),
        encoding="utf-8",
    )
    return subprocess.run(
        [
            "node",
            str(CLI),
            "--regional-request",
            str(tmp_path / "request.json"),
            "--regional-input",
            str(tmp_path / "cells.json"),
            "--out",
            str(tmp_path / "report.json"),
            *(extra or []),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )


def report(tmp_path, conditions, days):
    result = run_cli(tmp_path, conditions, days)
    assert result.returncode == 0, result.stderr
    return json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))


def test_same_support_half_cell_uses_km2_and_conserves_uniformly_allocated_hours(
    tmp_path,
):
    bounds = [0, 0, 0.01, 0.01]
    data = report(
        tmp_path,
        request({"id": "half", "type": "bbox", "bounds": [0, 0, 0.005, 0.01]}),
        [
            {
                "date": "2024-08-05",
                "layers": [
                    layer("front", [cell(bounds)]),
                    layer("activity", [cell(bounds, 40)]),
                ],
            },
        ],
    )
    day = data["regions"][0]["days"][0]
    assert day["hours"] == pytest.approx(20, rel=2e-6)
    # Independent closed-form WGS84 ellipsoid surface integral for this rectangle.
    assert day["effective_area_km2"] == pytest.approx(0.6154536009237818, rel=2e-6)
    assert day["area_time_km2_days"] == pytest.approx(0.6154536009237818, rel=2e-6)
    assert day["unknown_request_area_km2"] == pytest.approx(0, abs=1e-6)
    assert data["research_ready"] is False
    assert data["evidence_kind"] == "synthetic"
    assert str(tmp_path) not in json.dumps(data)


def test_kilometre_circles_keep_nested_radii_separate_from_bounding_boxes(tmp_path):
    geometries = [
        {
            "id": f"radius{radius}",
            "type": "circle",
            "center": [0.5, 0.5],
            "radius_km": radius,
        }
        for radius in [10, 20, 30]
    ]
    data = report(
        tmp_path,
        request(geometries[0], geometries=geometries),
        [
            {
                "date": "2024-08-05",
                "layers": [
                    layer("front", [cell([0, 0, 1, 1])]),
                    layer("activity", [cell([0, 0, 1, 1], 40)]),
                ],
            }
        ],
    )
    areas = [region["days"][0]["effective_area_km2"] for region in data["regions"]]
    # Small WGS84 geodesic circles differ from pi*r^2 only by bounded curvature/polygon error.
    assert areas == pytest.approx([314.1592654, 1256.6370614, 2827.4333882], rel=2e-4)
    assert all(region["geometry"]["center"] == [0.5, 0.5] for region in data["regions"])
    assert "total_hours" not in data
    assert (
        data["regions"][0]["days"][0]["hours"] < data["regions"][1]["days"][0]["hours"]
    )


def test_overlapping_front_buffers_are_a_union_without_double_counting(tmp_path):
    line = [[0.4, 0.5], [0.6, 0.5]]
    geometries = [
        {"id": "one", "type": "front_buffer", "lines": [line], "radius_km": 10},
        {
            "id": "overlap",
            "type": "front_buffer",
            "lines": [line, line],
            "radius_km": 10,
        },
    ]
    data = report(
        tmp_path,
        request(geometries[0], geometries=geometries),
        [
            {
                "date": "2024-08-05",
                "layers": [
                    layer("front", [cell([0, 0, 1, 1])]),
                    layer("activity", [cell([0, 0, 1, 1], 40)]),
                ],
            }
        ],
    )
    one, overlap = [region["days"][0] for region in data["regions"]]
    assert overlap["hours"] == pytest.approx(one["hours"], rel=1e-10)
    assert overlap["effective_area_km2"] == pytest.approx(
        one["effective_area_km2"], rel=1e-10
    )
    assert 0 < one["hours"] < 40


def test_cell_center_boundary_is_explicit_and_compared_with_overlap_uniformity(
    tmp_path,
):
    data = report(
        tmp_path,
        request(
            {"id": "half", "type": "bbox", "bounds": [0, 0, 0.005, 0.01]},
            allocation="cell_center",
        ),
        [
            {
                "date": "2024-08-05",
                "layers": [
                    layer("front", [cell([0, 0, 0.01, 0.01])]),
                    layer("activity", [cell([0, 0, 0.01, 0.01], 40)]),
                ],
            }
        ],
    )
    day = data["regions"][0]["days"][0]
    assert day["hours"] == pytest.approx(40, rel=2e-6)
    assert day["effective_area_km2"] == pytest.approx(1.2309072018475635, rel=2e-6)
    assert day["outside_request_selected_area_km2"] == pytest.approx(
        0.6154536009237818, rel=2e-6
    )
    assert day["boundary_sensitivity"]["overlap_uniform_hours"] == pytest.approx(
        20, rel=2e-6
    )
    assert day["boundary_sensitivity"]["cell_center_hours"] == pytest.approx(
        40, rel=2e-6
    )


@pytest.mark.parametrize(
    "latitude,expected",
    [(0, 1.2309072018475635), (30, 1.0695211732694125), (60, 0.6215872434455071)],
)
def test_latitude_dependent_areas_match_independent_ellipsoid_integrals(
    tmp_path, latitude, expected
):
    b = [0, latitude, 0.01, latitude + 0.01]
    data = report(
        tmp_path,
        request({"id": "cell", "type": "bbox", "bounds": b}),
        [
            {
                "date": "2024-08-05",
                "layers": [layer("front", [cell(b)]), layer("activity", [cell(b, 0)])],
            }
        ],
    )
    row = data["regions"][0]["days"][0]
    assert row["effective_area_km2"] == pytest.approx(expected, rel=2e-6)
    assert row["hours"] == 0
    assert row["density_hours_per_km2_day"] == 0


def test_coastline_excludes_land_and_keeps_unknown_side_without_requiring_optional_sst(
    tmp_path,
):
    b = [0, 0, 0.02, 0.01]
    layers = [
        layer(
            "front",
            [cell([0, 0, 0.01, 0.01]), cell([0.01, 0, 0.02, 0.01], support="land")],
        ),
        layer("activity", [cell(b, 40)]),
    ]
    data = report(
        tmp_path,
        request({"id": "coast", "type": "bbox", "bounds": b}),
        [{"date": "2024-08-05", "layers": layers}],
    )
    row = data["regions"][0]["days"][0]
    assert row["hours"] == pytest.approx(20, rel=2e-6)
    assert row["effective_area_km2"] == pytest.approx(1.2309072018475635, rel=2e-6)
    assert row["side_hours"]["unknown"] == pytest.approx(20, rel=2e-6)
    assert row["side_hours"]["cold"] == 0 and row["side_hours"]["warm"] == 0
    assert row["unknown_request_area_km2"] == pytest.approx(0, abs=1e-6)
    data = report(
        tmp_path,
        request(
            {"id": "coast", "type": "bbox", "bounds": b}, purpose="front_effort_sst"
        ),
        [{"date": "2024-08-05", "layers": layers}],
    )
    assert data["regions"][0]["days"][0]["hours"] is None
    assert "missing_required_sst_layer" in data["regions"][0]["days"][0]["reasons"]


@pytest.mark.parametrize(
    "change", ["unknown", "missing_hours", "unverified_time", "display"]
)
def test_unknown_support_or_value_never_becomes_a_zero_or_valid_denominator(
    tmp_path, change
):
    b = [0, 0, 0.01, 0.01]
    activity = layer(
        "activity",
        [
            cell(
                b,
                None if change == "missing_hours" else 40,
                support="unknown" if change == "unknown" else "valid",
            )
        ],
    )
    if change == "unverified_time":
        activity["time_verified"] = False
    if change == "display":
        activity["role"] = "display"
    data = report(
        tmp_path,
        request({"id": "cell", "type": "bbox", "bounds": b}),
        [{"date": "2024-08-05", "layers": [layer("front", [cell(b)]), activity]}],
    )
    row = data["regions"][0]["days"][0]
    assert row["hours"] is None and row["density_hours_per_km2_day"] is None
    assert row["effective_area_km2"] in (None, 0)
    assert row["unknown_request_area_km2"] > 1.23


def test_no_common_support_retains_zero_denominator_and_undefined_density(tmp_path):
    b = [0, 0, 0.01, 0.01]
    data = report(
        tmp_path,
        request({"id": "land", "type": "bbox", "bounds": b}),
        [
            {
                "date": "2024-08-05",
                "layers": [
                    layer("front", [cell(b, support="land")]),
                    layer("activity", [cell(b, 40)]),
                ],
            }
        ],
    )
    row = data["regions"][0]["days"][0]
    assert row["effective_area_km2"] == 0
    assert row["hours"] is None and row["density_hours_per_km2_day"] is None
    assert row["known_excluded_area_km2"] > 1.23


def test_real_daily_snapshot_propagates_unknowns_without_reopening_raw_sources(
    tmp_path,
):
    conditions = request(
        {"id": "ecs20", "type": "circle", "center": [124, 30], "radius_km": 20}
    )
    (tmp_path / "request.json").write_text(json.dumps(conditions), encoding="utf-8")
    snapshot = ROOT / "docs/reports/ocean-real-source-adapter-audit-2026-11-05.json"
    result = subprocess.run(
        [
            "node",
            str(CLI),
            "--regional-request",
            str(tmp_path / "request.json"),
            "--daily-snapshot",
            str(snapshot),
            "--out",
            str(tmp_path / "report.json"),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    data = json.loads((tmp_path / "report.json").read_text(encoding="utf-8"))
    row = data["regions"][0]["days"][0]
    assert data["evidence_kind"] == "real_source_audit"
    assert data["input_daily_snapshot_id"].startswith("sha256:")
    assert row["hours"] is None and row["effective_area_km2"] is None
    assert row["unknown_request_area_km2"] == pytest.approx(1256.6370614, rel=2e-4)
    assert data["research_ready"] is False


def test_frozen_regional_read_survives_input_removal_and_rejects_tampering(tmp_path):
    b = [0, 0, 0.01, 0.01]
    data = report(
        tmp_path,
        request({"id": "cell", "type": "bbox", "bounds": b}),
        [
            {
                "date": "2024-08-05",
                "layers": [layer("front", [cell(b)]), layer("activity", [cell(b, 10)])],
            }
        ],
    )
    (tmp_path / "request.json").unlink()
    (tmp_path / "cells.json").unlink()
    command = [
        "node",
        str(CLI),
        "--read-regional-snapshot",
        str(tmp_path / "report.json"),
    ]
    replay = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert replay.returncode == 0, replay.stderr
    assert json.loads(replay.stdout) == data
    data["regions"][0]["days"][0]["hours"] = 999
    (tmp_path / "report.json").write_text(json.dumps(data), encoding="utf-8")
    rejected = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert rejected.returncode != 0
    assert "invalid_regional_snapshot_identity" in rejected.stderr


@pytest.mark.parametrize(
    "change",
    ["extra_condition", "wrong_method", "negative_hours", "overlap", "wrong_source"],
)
def test_regional_request_and_cells_are_not_silently_reinterpreted(tmp_path, change):
    b = [0, 0, 0.01, 0.01]
    conditions = request({"id": "cell", "type": "bbox", "bounds": b})
    source = layer("activity", [cell(b, 10)])
    if change == "extra_condition":
        conditions["hidden_radius_override"] = 100
    if change == "wrong_method":
        conditions["method_version"] = "unknown/v9"
    if change == "negative_hours":
        source["cells"][0]["hours"] = -1
    if change == "overlap":
        source["cells"].append(cell(b, 20))
    if change == "wrong_source":
        conditions["source_ids"] = {
            "front": "front-original",
            "activity": "another-source",
        }
    result = run_cli(
        tmp_path,
        conditions,
        [{"date": "2024-08-05", "layers": [layer("front", [cell(b)]), source]}],
    )
    if change == "wrong_source":
        assert result.returncode == 0, result.stderr
        row = json.loads((tmp_path / "report.json").read_text())["regions"][0]["days"][
            0
        ]
        assert (
            row["hours"] is None
            and "activity_source_identity_mismatch" in row["reasons"]
        )
    else:
        assert result.returncode != 0
        assert not (tmp_path / "report.json").exists()


@pytest.mark.parametrize("baseline", [0, 20])
def test_period_hours_daily_mean_and_area_time_have_distinct_denominators(
    tmp_path, baseline
):
    b = [0, 0, 0.01, 0.01]
    req = request(
        {"id": "cell", "type": "bbox", "bounds": b},
        end="2024-08-06",
        baseline_hours=baseline,
    )
    days = [
        {
            "date": day,
            "layers": [layer("front", [cell(b)]), layer("activity", [cell(b, hours)])],
        }
        for day, hours in [("2024-08-05", 10), ("2024-08-06", 30)]
    ]
    result = report(tmp_path, req, days)
    summary = result["regions"][0]["summary"]
    assert summary["total_hours"] == pytest.approx(40)
    assert summary["mean_hours_per_supported_day"] == pytest.approx(20)
    assert summary["supported_days"] == 2 and summary["requested_days"] == 2
    assert summary["area_time_km2_days"] == pytest.approx(
        2 * 1.2309072018475635, rel=2e-6
    )
    assert summary["density_hours_per_km2_day"] == pytest.approx(
        40 / (2 * 1.2309072018475635), rel=2e-6
    )
    assert summary["baseline_comparison"]["absolute_hours_change"] == pytest.approx(
        40 - baseline
    )
    if baseline == 0:
        assert summary["baseline_comparison"]["relative_change"] is None
    else:
        assert summary["baseline_comparison"]["relative_change"] == pytest.approx(1)


def test_missing_day_exposes_observed_subset_without_claiming_a_period_total(tmp_path):
    b = [0, 0, 0.01, 0.01]
    result = report(
        tmp_path,
        request({"id": "cell", "type": "bbox", "bounds": b}, end="2024-08-06"),
        [
            {
                "date": "2024-08-05",
                "layers": [layer("front", [cell(b)]), layer("activity", [cell(b, 10)])],
            }
        ],
    )
    summary = result["regions"][0]["summary"]
    assert summary["total_hours"] is None and summary["area_time_km2_days"] is None
    assert summary["supported_subset"]["hours"] == pytest.approx(10)
    assert summary["supported_days"] == 1 and summary["excluded_days"] == 1


def test_regional_outputs_cannot_replace_inputs_and_far_cells_are_rejected(tmp_path):
    b = [0, 0, 0.01, 0.01]
    req = request({"id": "cell", "type": "bbox", "bounds": b})
    days = [
        {
            "date": "2024-08-05",
            "layers": [layer("front", [cell(b)]), layer("activity", [cell(b, 10)])],
        }
    ]
    failed = run_cli(
        tmp_path, req, days, extra=["--report-out", str(tmp_path / "cells.json")]
    )
    assert failed.returncode != 0 and "output_overlaps_input_or_output" in failed.stderr
    assert json.loads((tmp_path / "cells.json").read_text())["days"] == days
    assert not (tmp_path / "report.json").exists()
    days[0]["layers"][1]["cells"][0]["bounds"] = [150, 0, 150.01, 0.01]
    failed = run_cli(tmp_path, req, days)
    assert (
        failed.returncode != 0
        and "source_outside_local_projection_domain" in failed.stderr
    )


def test_equal_fractional_durations_do_not_prove_same_temporal_support(tmp_path):
    b = [0, 0, 0.01, 0.01]
    data = report(
        tmp_path,
        request({"id": "day", "type": "bbox", "bounds": b}),
        [
            {
                "date": "2024-08-05",
                "layers": [
                    layer("front", [cell(b)], duration_days=0.5),
                    layer("activity", [cell(b, 10)], duration_days=0.5),
                ],
            }
        ],
    )
    row = data["regions"][0]["days"][0]
    assert row["hours"] is None and row["area_time_km2_days"] is None
    assert "activity_full_day_support_required" in row["reasons"]


def test_changing_daily_support_cannot_claim_a_fixed_support_daily_mean(tmp_path):
    b = [0, 0, 0.02, 0.01]
    data = report(
        tmp_path,
        request({"id": "area", "type": "bbox", "bounds": b}, end="2024-08-06"),
        [
            {
                "date": "2024-08-05",
                "layers": [layer("front", [cell(b)]), layer("activity", [cell(b, 20)])],
            },
            {
                "date": "2024-08-06",
                "layers": [
                    layer("front", [cell([0, 0, 0.01, 0.01])]),
                    layer("activity", [cell(b, 20)]),
                ],
            },
        ],
    )
    summary = data["regions"][0]["summary"]
    assert summary["mean_hours_per_supported_day"] is None
    assert summary["mean_hours_per_requested_day"] is None
    assert summary["daily_mean_reason"] == "daily_spatial_support_changes"
    assert summary["supported_subset"][
        "arithmetic_mean_hours_over_varying_support"
    ] == pytest.approx(15)
    assert summary["total_hours"] == pytest.approx(30)
