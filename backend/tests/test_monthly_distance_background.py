"""Near and background comparisons use only explicitly comparable paired days."""

import pytest
from test_monthly_distance_reference import AUTH, URL, case, layer, reference_fixture


def comparison_fixture(near_hours, far_hours, *, only_unpaired=False):
    reference = reference_fixture()
    reference["distance_edges_km"] = [2, 5]
    reference["distance_comparison"] = {
        "version": "same-day-distance-background/v1",
        "target_band": 0,
        "reference_band": 2,
        "minimum_area_ratio": 0.25,
    }
    front = layer("front", [-0.4, -0.4, 0.4, 0.4])
    near = {
        "bounds": [-0.009, -0.001, -0.007, 0.001],
        "support": "valid",
        "hours": near_hours,
    }
    far = {
        "bounds": [0.060, -0.001, 0.064, 0.001],
        "support": "valid",
        "hours": far_hours,
    }
    days = [
        [near, far] if not only_unpaired else [far],
        [{**near, "hours": 1000}],
    ]
    for index, cells in enumerate(days, start=1):
        date = f"2024-08-0{index}"
        effort = {**layer("activity", near["bounds"], 0), "cells": cells}
        reference["regional_cells"]["days"][index - 1] = {
            "date": date,
            "layers": [front, effort],
        }
        reference["front_days"][index - 1] = {
            "date": date,
            "source_id": "front-original",
            "lines": [[[0, -0.1], [0, 0.1]]],
        }
    del reference["regional_cells"]["days"][2:]
    del reference["front_days"][2:]
    return reference


@pytest.mark.parametrize(
    ("near", "far", "ratio", "numerator"),
    [(8, 4, 4, 6), (1, 4, 0.5, -1), (2, 4, 1, 0), (8, 0, None, 8)],
)
def test_distance_effect_recomputes_both_sides_on_only_paired_dates(
    tmp_path, near, far, ratio, numerator
):
    client, _, request = case(tmp_path, comparison_fixture(near, far))
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    result = record["result"]
    comparison = result["month"]["distance_comparison"]
    assert comparison["paired_dates"] == ["2024-08-01"]
    assert comparison["target"]["hours"] == near
    assert comparison["reference"]["hours"] == far
    assert comparison["reference"]["area_time_km2_days"] == pytest.approx(
        2 * comparison["target"]["area_time_km2_days"], rel=2e-5
    )
    area = 0.002**2 * 111.31949 * 110.57428
    assert comparison["difference_hours_per_km2_day"] == pytest.approx(numerator / area, abs=2e-5)
    if ratio is None:
        assert (
            comparison["density_ratio"] is None
            and comparison["relative_reason"] == "zero_reference_density"
        )
    else:
        assert comparison["density_ratio"] == pytest.approx(ratio, rel=2e-5)
    assert result["days"][1]["distance_comparison"]["reason"] == "no_reference_area"
    assert client.get(f"{URL}/{record['id']}", headers=AUTH).json()["result"] == result


def test_disjoint_date_support_remains_descriptive(tmp_path):
    client, _, request = case(tmp_path, comparison_fixture(8, 4, only_unpaired=True))
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    comparison = result["month"]["distance_comparison"]
    assert comparison["paired_dates"] == []
    assert comparison["difference_hours_per_km2_day"] is None
    assert comparison["reason"] == "no_comparable_dates"
    assert result["month"]["common"]["hours"] == pytest.approx(1004)


def test_area_imbalance_exclusion_is_independent_of_hours(tmp_path):
    reference = comparison_fixture(8, 0)
    reference["distance_comparison"]["minimum_area_ratio"] = 0.75
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    first = result["days"][0]["distance_comparison"]
    assert first["reason"] == "support_area_imbalance"
    assert first["smaller_to_larger_area_ratio"] == pytest.approx(0.5)
    assert first["reference"]["hours"] == 0
    assert result["month"]["distance_comparison"]["paired_dates"] == []


def test_comparison_checks_same_day_sst_and_position_without_adjusting_main_hours(tmp_path):
    reference = comparison_fixture(8, 4)
    layers = reference["regional_cells"]["days"][0]["layers"]
    near, far = layers[1]["cells"]
    sst = {
        **layer("activity", near["bounds"]),
        "id": "sst-original",
        "kind": "sst",
        "unit": "degree_C",
        "cells": [
            {"bounds": near["bounds"], "support": "valid", "temperature_c": 12},
            {"bounds": far["bounds"], "support": "valid", "temperature_c": 18},
        ],
    }
    layers.append(sst)
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    first = result["days"][0]["distance_comparison"]["covariates"]
    assert first["target"]["sst"]["mean_temperature_c"] == pytest.approx(12)
    assert first["reference"]["sst"]["mean_temperature_c"] == pytest.approx(18)
    assert first["target"]["mean_local_distance_to_circle_center_km"] < 1
    assert first["reference"]["mean_local_distance_to_circle_center_km"] > 6
    month = result["month"]["distance_comparison"]
    assert month["comparability"]["sst_paired_dates"] == ["2024-08-01"]
    assert month["comparability"]["target_minus_reference_temperature_c"] == pytest.approx(-6)
    assert month["target"]["hours"] == 8 and month["reference"]["hours"] == 4


def test_center_allocation_cannot_silently_expand_the_comparison_circle(tmp_path):
    reference = comparison_fixture(8, 4)
    reference["conditions"]["allocation"] = "cell_center"
    reference["distance_comparison"]["minimum_area_ratio"] = 0.1
    reference["regional_cells"]["days"][0]["layers"][1]["cells"][1]["bounds"] = [
        0.086,
        -0.002,
        0.092,
        0.002,
    ]
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    first = result["days"][0]["distance_comparison"]
    assert first["reference"]["hours"] == pytest.approx(4)
    assert first["reason"] == "selected_support_extends_requested_circle"
    assert result["month"]["distance_comparison"]["paired_dates"] == []


def test_unrepresentable_ratio_retains_the_finite_absolute_effect(tmp_path):
    client, _, request = case(tmp_path, comparison_fixture(8, 1e-310))
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    comparison = record["result"]["month"]["distance_comparison"]
    assert comparison["difference_hours_per_km2_day"] > 0
    assert comparison["density_ratio"] is None
    assert comparison["relative_reason"] == "relative_effect_outside_numeric_range"
