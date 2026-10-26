import json
from pathlib import Path

import pytest

from app.fixed_region_example import run_fixed_region_example

SOURCE = Path(__file__).parents[1] / "app/examples/fixed-region-event.json"
REQUEST = {
    "purpose": "fixed_region_event_example",
    "longitude": 124.5,
    "latitude": 30.2,
    "radius_km": 20,
    "search_start": "2024-08-05",
    "search_end": "2024-08-08",
    "input_version": "synthetic-event/v1",
    "method_version": "observed-entry-example/v1",
    "parameter_version": "fixed-support-windows/v1",
}


@pytest.mark.parametrize("state", ["missing", "unprepared", "read_failed"])
def test_a_missing_activity_day_keeps_its_reason_and_cannot_be_a_complete_window(state):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    day = next(d for d in source["conditions"][0]["days"] if d["date"] == "2024-08-06")
    day.update(state=state, units=[])
    result = run_fixed_region_example(REQUEST, source)
    row = next(d for d in result["daily"] if d["date"] == "2024-08-06")
    assert row["state"] == state
    assert row["hours"] is None
    assert result["windows"]["post1_3"]["total_hours"] == 28
    assert result["windows"]["post1_3"]["supported_days"] == 2
    assert result["windows"]["post1_3"]["status"] == "incomplete"
    assert result["changes"]["post1_3"]["relative_density_change_percent"] is None


def test_zero_baseline_keeps_absolute_density_change_without_an_infinite_ratio():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    for day in source["conditions"][0]["days"]:
        if day["date"] < "2024-08-05":
            day["units"][0]["hours"] = 0
    result = run_fixed_region_example(REQUEST, source)
    assert result["windows"]["pre7"]["total_hours"] == 0
    assert result["windows"]["pre7"]["supported_days"] == 7
    assert result["windows"]["pre7"]["area_time_km2_days"] == 28
    assert result["changes"]["post1_3"] == {
        "absolute_density_change": 3,
        "relative_density_change_percent": None,
        "reason": "zero_baseline",
    }
    assert result["windows"]["event_day"]["total_hours"] == 40


def test_a_second_circle_and_cross_month_dates_have_their_own_observed_anchor():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    result = run_fixed_region_example(
        {
            **REQUEST,
            "longitude": 125.5,
            "latitude": 31.2,
            "radius_km": 10,
            "search_start": "2024-09-02",
            "search_end": "2024-09-05",
        },
        source,
    )
    assert result["event"]["anchor_date"] == "2024-09-02"
    assert result["windows"]["pre7"]["start_date"] == "2024-08-26"
    assert result["windows"]["pre7"]["end_date"] == "2024-09-01"
    assert result["windows"]["post1_7"]["end_date"] == "2024-09-09"
    assert result["windows"]["pre7"]["total_hours"] == 14
    assert result["windows"]["pre7"]["area_time_km2_days"] == 35
    assert result["windows"]["post1_3"]["total_hours"] == 0
    assert result["changes"]["post1_3"]["relative_density_change_percent"] == -100


def test_changing_activity_peaks_does_not_choose_a_different_event_or_extrapolate_day_seven():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    days = source["conditions"][0]["days"]
    next(d for d in days if d["date"] == "2024-08-05")["units"][0]["hours"] = 10000
    next(d for d in days if d["date"] == "2024-08-12")["units"][0]["hours"] = 800
    result = run_fixed_region_example(REQUEST, source)
    assert result["event"]["anchor_date"] == "2024-08-05"
    assert result["windows"]["pre7"]["total_hours"] == 28
    assert result["windows"]["post1_3"]["total_hours"] == 36
    assert result["windows"]["post1_7"]["total_hours"] == 848
    assert result["windows"]["event_day"]["total_hours"] == 10000


@pytest.mark.parametrize(
    "damage,expected",
    [
        ("empty", "no_records"),
        ("unknown", "unknown_support"),
        ("front_unknown", "front_observation_unknown"),
        ("area_changed", "fixed_support_unverified_or_changed"),
    ],
)
def test_incomplete_or_changed_fixed_support_is_not_compared_as_the_whole_window(damage, expected):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    day = next(d for d in source["conditions"][0]["days"] if d["date"] == "2024-08-06")
    if damage == "empty":
        day["units"] = []
    elif damage == "unknown":
        day["units"][0]["hours"] = None
    elif damage == "front_unknown":
        day["front_present"] = None
    else:
        day["units"][0]["area_km2"] = 8
    result = run_fixed_region_example(REQUEST, source)
    assert next(d for d in result["daily"] if d["date"] == "2024-08-06")["state"] == expected
    assert result["windows"]["post1_3"]["supported_days"] == 2
    assert result["changes"]["post1_3"]["absolute_density_change"] is None


def test_zero_area_never_supplies_density_or_changes():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    source["conditions"][0]["fixed_support"][0]["area_km2"] = 0
    result = run_fixed_region_example(REQUEST, source)
    assert result["event"]["anchor_date"] == "2024-08-05"
    assert result["windows"]["pre7"]["total_hours"] is None
    assert result["windows"]["pre7"]["area_time_km2_days"] is None
    assert result["windows"]["pre7"]["density_hours_per_km2_day"] is None
    assert result["changes"]["post1_3"]["relative_density_change_percent"] is None


@pytest.mark.parametrize(
    "case,status",
    [
        ("unknown", "unknown"),
        ("existing", "no_observed_entry"),
        ("multiple", "multiple_candidates"),
        ("absent", "no_observed_entry"),
    ],
)
def test_unknown_existing_multiple_and_absent_observations_do_not_fabricate_one_entry(case, status):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    request = REQUEST.copy()
    if case == "existing":
        request["search_start"] = "2024-08-06"
    elif case == "unknown":
        next(d for d in source["conditions"][0]["days"] if d["date"] == "2024-08-04")[
            "front_present"
        ] = None
    elif case == "multiple":
        request["search_end"] = "2024-08-10"
        next(d for d in source["conditions"][0]["days"] if d["date"] == "2024-08-09")[
            "front_present"
        ] = True
    else:
        for day in source["conditions"][0]["days"]:
            day["front_present"] = False
    result = run_fixed_region_example(request, source)
    assert result["status"] == status
    assert result["event"] is None
    assert result["windows"] == {}


@pytest.mark.parametrize(
    "case", ["real", "unit", "permission", "duplicate", "wrong-version", "wrong-point"]
)
def test_unqualified_inputs_and_conditions_cannot_be_silently_used(case):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    request = REQUEST.copy()
    if case == "real":
        source["evidence_kind"] = "real"
    elif case == "unit":
        source["unit"] = "minutes"
    elif case == "permission":
        source["public_aggregate_allowed"] = False
    elif case == "duplicate":
        source["conditions"][0]["days"].append(source["conditions"][0]["days"][0])
    elif case == "wrong-version":
        request["input_version"] = "another-version"
    else:
        request["longitude"] = 120
    with pytest.raises(ValueError):
        run_fixed_region_example(request, source)
