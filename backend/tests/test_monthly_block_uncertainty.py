"""Connected monthly uncertainty checks with independently known block outcomes."""

from copy import deepcopy

import pytest
from test_monthly_distance_background import comparison_fixture
from test_monthly_distance_reference import AUTH, URL, case


def fixture(
    *,
    constant=False,
    minimum_groups=2,
    assumption="between_blocks_supported",
    first_hours=8,
    last_hours=1,
):
    reference = comparison_fixture(first_hours, 4)
    reference["distance_uncertainty"] = {
        "version": "calendar-block-percentile/v1",
        "block_days": 2,
        "confidence_level": 0.9,
        "iterations": 400,
        "seed": 20261106,
        "minimum_groups": minimum_groups,
        "assumption": assumption,
        "rationale": "Fixture adjacent days share a shock; a missing calendar block separates the shocks.",
    }
    data = reference["regional_cells"]
    date_base, front_base = (
        deepcopy(data["days"][0]),
        deepcopy(reference["front_days"][0]),
    )
    data["days"][1]["date"] = "2024-08-03"
    reference["front_days"][1]["date"] = "2024-08-03"
    for day_number, hours in [(2, first_hours), (5, first_hours if constant else last_hours)]:
        day = deepcopy(date_base)
        day["date"] = f"2024-08-{day_number:02}"
        day["layers"][1]["cells"][0]["hours"] = hours
        data["days"].append(day)
        reference["front_days"].append({**front_base, "date": day["date"]})
    return reference


def test_fixed_calendar_blocks_keep_paired_area_and_have_known_outcomes(tmp_path):
    client, _, request = case(tmp_path, fixture())
    first = client.post(URL, headers=AUTH, json=request)
    second = client.post(URL, headers=AUTH, json=request)
    assert first.status_code == second.status_code == 200
    a, b = first.json()["result"], second.json()["result"]
    assert a["result_id"] == b["result_id"]
    interval = a["month"]["distance_comparison"]["uncertainty"]
    assert interval["status"] == "estimated_for_registered_assumptions"
    assert interval["supported_groups"] == 2 and interval["paired_days"] == 3
    assert interval["groups"][0]["paired_dates"] == ["2024-08-01", "2024-08-02"]
    assert interval["groups"][1]["paired_dates"] == ["2024-08-05"]
    assert interval["requested_iterations"] == interval["valid_iterations"] == 400
    area = 0.002**2 * 111.31949 * 110.57428
    # Draws of two whole blocks can produce only these two extremes and one interior value.
    assert interval["lower"] == pytest.approx(-1 / area, rel=2e-5)
    assert interval["upper"] == pytest.approx(6 / area, rel=2e-5)
    assert interval["estimate"] == pytest.approx((6 + 6 - 1) / (3 * area), rel=2e-5)
    assert interval["permutation"] == "not_performed"


@pytest.mark.parametrize(
    ("kwargs", "reason"),
    [
        ({"minimum_groups": 3}, "insufficient_registered_groups"),
        ({"assumption": "unverified"}, "between_group_assumptions_unverified"),
        ({"constant": True}, "degenerate_block_distribution"),
    ],
)
def test_block_inference_degrades_without_erasing_the_descriptive_effect(tmp_path, kwargs, reason):
    client, _, request = case(tmp_path, fixture(**kwargs))
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    comparison = run.json()["result"]["month"]["distance_comparison"]
    assert comparison["difference_hours_per_km2_day"] is not None
    interval = comparison["uncertainty"]
    assert interval["status"] == "not_reliably_estimable"
    assert interval["reason"] == reason
    assert interval["lower"] is None and interval["upper"] is None


@pytest.mark.parametrize("first,last,estimate", [(1, 0, -4 / 3), (3, 0, 0)])
def test_negative_or_zero_effect_does_not_block_uncertainty(tmp_path, first, last, estimate):
    client, _, request = case(tmp_path, fixture(first_hours=first, last_hours=last))
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    interval = run.json()["result"]["month"]["distance_comparison"]["uncertainty"]
    assert interval["status"] == "estimated_for_registered_assumptions"
    area = 0.002**2 * 111.31949 * 110.57428
    assert interval["estimate"] == pytest.approx(estimate / area, abs=2e-5)


def test_no_paired_area_never_runs_resampling(tmp_path):
    reference = fixture()
    reference["distance_comparison"]["minimum_area_ratio"] = 0.9
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    interval = result["month"]["distance_comparison"]["uncertainty"]
    assert interval["estimate"] is None and interval["reason"] == "no_paired_support"
    assert interval["supported_groups"] == interval["valid_iterations"] == 0
    assert result["month"]["common"]["hours"] > 0


def test_requested_confidence_cannot_exceed_percentile_resolution(tmp_path):
    reference = fixture()
    reference["distance_uncertainty"].update(confidence_level=0.999999, iterations=200)
    client, _, request = case(tmp_path, reference)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    result = run.json()["result"]
    interval = result["month"]["distance_comparison"]["uncertainty"]
    assert interval["estimate"] is not None
    assert interval["reason"] == "percentile_tail_below_sampling_resolution"
    assert interval["lower"] is None and interval["upper"] is None
