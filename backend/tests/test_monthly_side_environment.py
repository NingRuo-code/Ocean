"""Monthly side and environment evidence through the existing owner endpoint."""

import math

import pytest
from test_monthly_distance_reference import AUTH, URL, case, layer, reference_fixture


def cell(bounds, **values):
    return {"bounds": bounds, "support": "valid", **values}


def side_fixture():
    reference = reference_fixture()
    reference["side_environment_version"] = "p0-side-and-sst/v1"
    cold = [-0.031, -0.001, -0.029, 0.001]
    warm = [0.029, -0.001, 0.031, 0.001]
    ambiguous = [-0.001, -0.001, 0.001, 0.001]
    front = layer("front", [-0.4, -0.4, 0.4, 0.4])
    front["cells"] = [
        cell([-0.4, -0.4, 0, 0.4], side="cold"),
        cell([0, -0.4, 0.4, 0.4], side="warm"),
    ]
    effort = layer("activity", cold, 8)
    effort["cells"] = [cell(cold, hours=8), cell(warm, hours=12), cell(ambiguous, hours=3)]
    sst = {
        **layer("activity", cold),
        "id": "sst-original",
        "kind": "sst",
        "unit": "degree_C",
        "cells": [cell(cold, temperature_c=12), cell(warm, temperature_c=18)],
    }
    reference["regional_cells"]["days"] = [
        {"date": "2024-08-01", "layers": [front, effort, sst]},
        {"date": "2024-08-02", "layers": [front, effort]},
    ]
    reference["front_days"] = [
        {"date": date, "source_id": "front-original", "lines": [[[0, -0.1], [0, 0.1]]]}
        for date in ("2024-08-01", "2024-08-02")
    ]
    return reference


def test_monthly_side_and_sst_keep_independent_supported_subsets(tmp_path):
    client, _, request = case(tmp_path, side_fixture())
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    result = record["result"]
    first, second, missing = result["days"][:3]
    for day in (first, second):
        assert day["common"]["hours"] == pytest.approx(23)
        sides = day["side_environment"]["sides"]
        assert {k: v["hours"] for k, v in sides.items()} == pytest.approx(
            {"cold": 8, "warm": 12, "unknown": 3}
        )
        assert math.fsum(v["area_time_km2_days"] for v in sides.values()) == pytest.approx(
            day["common"]["area_time_km2_days"]
        )
        # WGS84 small equatorial 0.002° square, using its two physical side lengths.
        assert sides["cold"]["area_time_km2_days"] == pytest.approx(
            0.002**2 * 111.31949 * 110.57428, rel=2e-5
        )
    assert first["side_environment"]["sst"]["hours"] == pytest.approx(20)
    assert first["side_environment"]["sst"]["mean_temperature_c"] == pytest.approx(15)
    assert second["side_environment"]["sst"]["reason"] == "missing_required_sst_layer"
    assert missing["side_environment"]["sides"]["unknown"]["hours"] is None
    month = result["month"]["side_environment"]
    assert month["sides"]["cold"]["hours"] == pytest.approx(16)
    assert month["sides"]["cold"]["days"] == 2
    assert month["sst"]["hours"] == pytest.approx(20)
    assert month["sst"]["days"] == 1
    assert month["sst"]["unit"] == "degree_C"
    assert result["month"]["common"]["hours"] == pytest.approx(46)
    assert client.get(f"{URL}/{record['id']}", headers=AUTH).json()["result"] == result


def test_unverified_sst_and_missing_line_material_are_local_to_their_subsets(tmp_path):
    reference = side_fixture()
    reference["front_days"].pop(0)
    reference["regional_cells"]["days"][0]["layers"][-1]["time_verified"] = False
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    result = record["result"]
    first = result["days"][0]
    assert first["common"]["hours"] == pytest.approx(23)
    side_environment = first["side_environment"]
    assert side_environment["sides"]["unknown"]["hours"] == pytest.approx(23)
    assert side_environment["sides"]["cold"]["area_time_km2_days"] == 0
    assert side_environment["sides"]["cold"]["reason"] == "no_supported_contribution"
    assert side_environment["side_reasons_by_unit_count"]["same_day_line_position_unverified"] == 3
    assert side_environment["sst"]["mean_temperature_c"] is None
    assert side_environment["sst"]["reason"] == "sst_time_verified_unknown"
    assert result["month"]["side_environment"]["sst"]["days"] == 0


def test_equally_near_distinct_fronts_do_not_force_a_side(tmp_path):
    reference = side_fixture()
    first = reference["front_days"][0]
    first["lines"] = [
        [[-0.04, -0.1], [-0.04, 0.1]],
        [[-0.02, -0.1], [-0.02, 0.1]],
        [[-0.02, 0.1], [-0.02, -0.1]],
    ]
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    first = result["days"][0]["side_environment"]
    assert "side_hours" not in result["days"][0]["common"]
    assert first["sides"]["cold"]["hours"] is None
    assert first["sides"]["warm"]["hours"] == pytest.approx(12)
    assert first["sides"]["unknown"]["hours"] == pytest.approx(11)
    assert first["side_reasons_by_unit_count"]["competing_nearest_fronts"] == 1


@pytest.mark.parametrize("bad_bounds", [None, [7, 0, 7.01, 0.01]])
def test_unusable_optional_sst_geometry_does_not_discard_the_distance_result(tmp_path, bad_bounds):
    reference = side_fixture()
    sst = reference["regional_cells"]["days"][0]["layers"][-1]
    sst["cells"].append(
        dict(sst["cells"][0]) if bad_bounds is None else cell(bad_bounds, temperature_c=12)
    )
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    first = record["result"]["days"][0]
    assert first["common"]["hours"] == pytest.approx(23)
    assert first["side_environment"]["sst"]["reason"] == "sst_geometry_unusable"
    assert first["side_environment"]["sst"]["hours"] is None


def test_side_requires_the_whole_contribution_to_clear_the_front(tmp_path):
    reference = side_fixture()
    reference["regional_cells"]["days"][0]["layers"][1]["cells"][0]["bounds"][2] = -0.002
    reference["front_days"][0]["lines"] = [[[-0.0309, -0.1], [-0.0309, 0.1]]]
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    first = run.json()["result"]["days"][0]
    assert first["common"]["hours"] == pytest.approx(23)
    assert first["side_environment"]["sides"]["cold"]["hours"] is None
    assert first["side_environment"]["sides"]["unknown"]["hours"] == pytest.approx(11)
    assert (
        first["side_environment"]["side_reasons_by_unit_count"]["within_line_position_uncertainty"]
        == 1
    )


def test_small_sst_overlap_is_excluded_instead_of_double_counted(tmp_path):
    reference = side_fixture()
    _, activity, sst = reference["regional_cells"]["days"][0]["layers"]
    west = -0.03
    activity["cells"] = [cell([west, 0, west + 14e-6, 14e-6], hours=8)]
    sst["cells"] = [
        cell([west, 0, west + 9e-6, 14e-6], temperature_c=12),
        cell([west + 5e-6, 0, west + 14e-6, 14e-6], temperature_c=18),
    ]
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    day = run.json()["result"]["days"][0]
    measurement = day["side_environment"]["sst"]
    assert day["common"]["hours"] == pytest.approx(8)
    assert measurement["hours"] == pytest.approx(8 * 10 / 14)
    assert measurement["mean_temperature_c"] == pytest.approx(15)
    assert measurement["ambiguous_area_time_km2_days"] == pytest.approx(
        day["common"]["area_time_km2_days"] * 4 / 14
    )
