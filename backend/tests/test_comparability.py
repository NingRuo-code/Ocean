import copy
import json
from pathlib import Path

import pytest

from app.analysis_support import content_id
from app.regional_comparison import compare_known_snapshots


def bind(entry, candidate, *, preserve_native_id=False):
    result = entry["result"]
    if not preserve_native_id:
        result["result_id"] = content_id({k: v for k, v in result.items() if k != "result_id"})
    entry["snapshot_sha256"] = content_id(result)
    candidate.update(
        result_id=result["result_id"],
        snapshot_sha256=entry["snapshot_sha256"],
        source=copy.deepcopy(result["source"]),
    )
    entry["comparison_facts"].update(
        result_id=result["result_id"], snapshot_sha256=entry["snapshot_sha256"]
    )


def facts():
    return {
        "schema": "ocean-known-comparison-facts/v1",
        "result_id": "sha256:" + "0" * 64,
        "snapshot_sha256": "sha256:" + "0" * 64,
        "source_state": "completed",
        "freshness": "verified_frozen",
        "product": "authored-apparent-effort/v1",
        "processing": "known-support-sum/v1",
        "quality": "explicit-valid-units/v1",
        "day_boundary": "UTC-day/v1",
        "geometry": "declared-km-circle/v1",
        "grain": "declared-unit-areas/v1",
        "boundary_rule": "declared-membership/v1",
        "sea_area_km2": 10,
        "support_policy": "observed-known-units/v1",
        "control_ids": [],
        "definitions": {
            "total_hours": {
                "quantity": "apparent_fishing_effort",
                "estimand": "same-support-H/v1",
                "weighting": "additive-hours/v1",
                "groups": [],
            },
            "area_time_km2_days": {
                "quantity": "support_exposure",
                "estimand": "same-support-E/v1",
                "weighting": "additive-area-time/v1",
                "groups": [],
            },
            "mean_hours_per_supported_day": {
                "quantity": "apparent_fishing_effort",
                "estimand": "H-over-D/v1",
                "weighting": "supported-days/v1",
                "groups": [],
            },
            "density_hours_per_km2_day": {
                "quantity": "apparent_fishing_effort",
                "estimand": "H-over-E/v1",
                "weighting": "area-time/v1",
                "groups": [],
            },
        },
    }


def three_regions():
    root = Path(__file__).parents[1]
    original = json.loads(
        (root / "app/examples/regional-known-snapshots.json").read_text(encoding="utf-8")
    )
    first = copy.deepcopy(original["snapshots"][0])
    second = copy.deepcopy(first)
    first["comparison_facts"] = facts()
    second["comparison_facts"] = facts()
    result = second["result"]
    result["parameters"].update(longitude=125.5, input_version="authored-month/v2")
    result["source"].update(
        id="authored-other-region", version="authored-month/v2", input_sha256="sha256:" + "b" * 64
    )
    for day in result["daily"]:
        if day["hours"] is not None:
            day["hours"] = 0
    result["metrics"].update(
        total_hours=0, mean_hours_per_supported_day=0, density_hours_per_km2_day=0
    )
    candidates = []
    for identity, longitude, entry in [("a", 124.5, first), ("b", 125.5, second)]:
        candidate = {
            "id": identity,
            "name": identity.upper(),
            "longitude": longitude,
            "latitude": 30.2,
        }
        bind(entry, candidate, preserve_native_id=identity == "a")
        candidates.append(candidate)
    missing = copy.deepcopy(candidates[1])
    missing.update(id="c", name="C missing", longitude=126.5, result_id="sha256:" + "c" * 64)
    candidates.append(missing)
    request = {
        "purpose": "regional_comparison_example",
        "analysis_kind": "monthly_spatial_example",
        "radius_km": 20,
        "month": "2024-02",
        "evidence_use": "descriptive_side_by_side",
        "support_policy": "verify_existing_support",
        "method_version": "known-snapshots/v2",
        "candidates": candidates,
    }
    return request, {
        "schema": "ocean-controlled-comparison-snapshots/v1",
        "snapshots": [first, second],
    }


def test_three_region_matrix_keeps_the_qualified_pair_despite_a_missing_region():
    request, pack = three_regions()
    result = compare_known_snapshots(request, pack)
    assert result["status"] == "partial"
    a, b, c = result["rows"]
    assert a["metric_assessments"]["total_hours"]["status"] == "comparable"
    assert a["metric_assessments"]["total_hours"]["value"] == 40
    assert b["metric_assessments"]["total_hours"]["value"] == 0
    assert c["metric_assessments"]["total_hours"]["status"] == "not_ready"
    ab, ac, bc = result["pairs"]
    assert ab["candidates"] == ["a", "b"]
    assert ab["metrics"]["total_hours"]["status"] == "comparable"
    assert ac["metrics"]["total_hours"]["status"] == "not_ready"
    assert bc["metrics"]["total_hours"]["status"] == "not_ready"
    assert result["research_ready"] is False
    assert "ranking" not in result and "differences" not in result


def event_regions():
    root = Path(__file__).parents[1]
    pack = json.loads(
        (root / "app/examples/regional-known-snapshots.json").read_text(encoding="utf-8")
    )
    pack["snapshots"] = pack["snapshots"][2:]
    request = json.loads(
        (root.parent / "docs/data/regional-comparison-event.example.json").read_text(
            encoding="utf-8"
        )
    )
    request.update(method_version="known-snapshots/v2", support_policy="verify_existing_support")
    for entry, candidate in zip(pack["snapshots"], request["candidates"], strict=True):
        entry["comparison_facts"] = facts()
        bind(entry, candidate, preserve_native_id=True)
    return request, pack


def test_missing_post7_does_not_invalidate_the_existing_post3_or_invent_zero():
    request, pack = event_regions()
    del pack["snapshots"][1]["result"]["windows"]["post1_7"]
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    metrics = result["pairs"][0]["metrics"]
    assert metrics["post1_3.total_hours"]["status"] == "comparable"
    assert metrics["post1_7.total_hours"]["status"] == "not_ready"
    assert result["rows"][0]["metric_assessments"]["post1_3.total_hours"]["value"] == 36
    assert result["rows"][1]["metric_assessments"]["post1_7.total_hours"]["value"] is None


@pytest.mark.parametrize("state", ["failed", "running", "unprepared"])
def test_source_lifecycle_preserves_its_column_without_publishing_completed_values(state):
    request, pack = three_regions()
    pack["snapshots"][1]["comparison_facts"]["source_state"] = state
    result = compare_known_snapshots(request, pack)
    row = result["rows"][1]
    assert row["reason"] == "source_" + state
    assert "metrics" not in row
    assert row["metric_assessments"]["total_hours"]["value"] is None


def test_nominal_overlap_and_shared_dates_or_controls_are_warnings_not_independent_counts():
    request, pack = three_regions()
    request["candidates"][1]["longitude"] = 124.6
    pack["snapshots"][1]["result"]["parameters"]["longitude"] = 124.6
    bind(pack["snapshots"][1], request["candidates"][1])
    for entry in pack["snapshots"]:
        entry["comparison_facts"]["control_ids"] = ["authored-shared-control"]
    result = compare_known_snapshots(request, pack)
    pair = result["pairs"][0]
    codes = {warning["code"] for warning in pair["warnings"]}
    assert {
        "nominal_circles_overlap",
        "shared_dates",
        "shared_controls",
        "not_independent_samples",
    } <= codes
    assert "combined_hours" not in pair and "sample_count" not in pair


def test_registered_native_label_alias_and_processing_alias_keep_the_same_metric_semantics():
    request, pack = three_regions()
    second = pack["snapshots"][1]
    second["result"]["parameters"]["method_version"] = "monthly-known-support/v1.0-label"
    second["comparison_facts"]["processing"] = "known-support-sum/v1.0-label"
    bind(second, request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["density_hours_per_km2_day"]["status"] == "comparable"
    assert result["rows"][1]["method_equivalence"]["evidence"]


def test_registered_minute_conversion_retains_original_value_unit_and_inverse():
    request, pack = three_regions()
    first = pack["snapshots"][0]
    first["result"]["metrics"]["total_hours"] = 2400
    first["result"]["units"]["total_hours"] = "fishing_minutes"
    bind(first, request["candidates"][0])
    result = compare_known_snapshots(request, pack)
    cell = result["rows"][0]["metric_assessments"]["total_hours"]
    assert (cell["original_value"], cell["original_unit"]) == (2400, "fishing_minutes")
    assert (cell["value"], cell["unit"]) == (40, "fishing_hours")
    assert cell["conversion"]["inverse"] == "multiply_by_60"
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "comparable"


@pytest.mark.parametrize(
    "field,value",
    [("quantity", "catch"), ("weighting", "event_equal/v1"), ("estimand", "front_frequency")],
)
def test_same_field_name_does_not_qualify_a_different_quantity_or_estimator(field, value):
    request, pack = three_regions()
    pack["snapshots"][1]["comparison_facts"]["definitions"]["total_hours"][field] = value
    result = compare_known_snapshots(request, pack)
    pair = result["pairs"][0]["metrics"]
    assert pair["total_hours"]["status"] == "incomparable"
    assert pair["density_hours_per_km2_day"]["status"] == "comparable"


@pytest.mark.parametrize(
    "field,value,expected",
    [
        ("day_boundary", "local-day/v1", "incomparable"),
        ("grain", "grid-0.05-degree/v1", "incomparable"),
        ("boundary_rule", "cell-centre-membership/v1", "incomparable"),
        ("geometry", "degree-bbox/v1", "not_ready"),
        ("quality", "unverified", "not_ready"),
        ("product", "same_name_unverified", "not_ready"),
        ("processing", "changed_algorithm", "not_ready"),
    ],
)
def test_semantic_dimensions_need_evidence_and_are_not_fixed_by_same_version_names(
    field, value, expected
):
    request, pack = three_regions()
    pack["snapshots"][1]["comparison_facts"][field] = value
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == expected


def test_unregistered_unit_does_not_poison_other_metrics_or_trigger_conversion():
    request, pack = three_regions()
    pack["snapshots"][1]["result"]["units"]["total_hours"] = "vessel_count"
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "incomparable"
    assert result["pairs"][0]["metrics"]["density_hours_per_km2_day"]["status"] == "comparable"
    assert result["rows"][1]["metric_assessments"]["total_hours"]["conversion"] is None


@pytest.mark.parametrize("freshness", ["unknown", "stale"])
def test_old_or_unknown_freshness_keeps_original_values_but_limits_comparison(freshness):
    request, pack = three_regions()
    pack["snapshots"][1]["comparison_facts"]["freshness"] = freshness
    result = compare_known_snapshots(request, pack)
    cell = result["rows"][1]["metric_assessments"]["total_hours"]
    assert cell["original_value"] == 0 and cell["status"] == "limited_side_by_side"
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "limited_side_by_side"
    assert result["status"] == "no_comparable_pairs"


def test_known_different_dates_are_not_silently_intersected_or_labelled_same_support():
    request, pack = three_regions()
    days = pack["snapshots"][1]["result"]["daily"]
    days[1]["date"], days[6]["date"] = days[6]["date"], days[1]["date"]
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    cell = result["pairs"][0]["metrics"]["density_hours_per_km2_day"]
    assert cell["status"] == "limited_side_by_side"
    assert any(r["code"] == "effective_dates_differ" for r in cell["reasons"])
    assert result["rows"][1]["effective_support"]["dates"] == ["2024-02-01", "2024-02-07"]
    assert result["rows"][1]["metrics"]["supported_days"] == 2


def test_different_effective_area_limits_totals_but_keeps_density_qualified_on_existing_dates():
    request, pack = three_regions()
    second = pack["snapshots"][1]
    second["result"]["metrics"]["area_time_km2_days"] = 14
    for day in second["result"]["daily"]:
        if day["hours"] is not None:
            day["area_time_km2_days"] *= 2
            day["effective_area_km2"] *= 2
    bind(second, request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    pair = result["pairs"][0]["metrics"]
    assert pair["total_hours"]["status"] == "limited_side_by_side"
    assert pair["density_hours_per_km2_day"]["status"] == "comparable"
    assert result["rows"][1]["effective_support"]["reported"]["area_time_km2_days"] == 14


def test_group_definitions_use_identity_bounds_unit_and_side_not_list_position():
    request, pack = three_regions()
    groups = [
        {"id": "near", "lower": 0, "upper": 10, "unit": "km", "side": "cold"},
        {"id": "far", "lower": 10, "upper": 20, "unit": "km", "side": "unknown"},
    ]
    for entry in pack["snapshots"]:
        entry["comparison_facts"]["definitions"]["total_hours"]["groups"] = copy.deepcopy(groups)
    pack["snapshots"][1]["comparison_facts"]["definitions"]["total_hours"]["groups"].reverse()
    assert (
        compare_known_snapshots(request, pack)["pairs"][0]["metrics"]["total_hours"]["status"]
        == "comparable"
    )
    pack["snapshots"][1]["comparison_facts"]["definitions"]["total_hours"]["groups"][0]["side"] = (
        "warm"
    )
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "incomparable"
    assert result["pairs"][0]["metrics"]["density_hours_per_km2_day"]["status"] == "comparable"


@pytest.mark.parametrize(
    "change",
    ["missing_facts", "wrong_identity", "unknown_water_area", "no_daily_support", "private"],
)
def test_incomplete_or_inaccessible_evidence_is_not_promoted_to_qualified_comparison(change):
    request, pack = three_regions()
    entry = pack["snapshots"][1]
    if change == "missing_facts":
        entry.pop("comparison_facts")
    elif change == "wrong_identity":
        entry["comparison_facts"]["snapshot_sha256"] = "sha256:" + "f" * 64
    elif change == "unknown_water_area":
        entry["comparison_facts"]["sea_area_km2"] = None
    elif change == "private":
        entry["access"] = "owner_only"
    else:
        entry["result"].pop("daily")
        bind(entry, request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] != "comparable"
    assert len(result["rows"]) == 3


def test_version1_existing_published_comparison_keeps_its_identity():
    root = Path(__file__).parents[2]
    pack = json.loads(
        (root / "backend/app/examples/regional-known-snapshots.json").read_text(encoding="utf-8")
    )
    request = json.loads(
        (root / "docs/data/regional-comparison-month.example.json").read_text(encoding="utf-8")
    )
    result = compare_known_snapshots(request, pack)
    assert (
        result["result_id"]
        == "sha256:ad186603a839ab2fcd52cd5620980ecfbe750361ea83ff0af2d432eda28a4b52"
    )


def test_malformed_facts_of_one_source_do_not_abort_other_region_columns():
    request, pack = three_regions()
    pack["snapshots"][1]["comparison_facts"] = ["invalid-source-metadata"]
    result = compare_known_snapshots(request, pack)
    assert result["rows"][0]["metric_assessments"]["total_hours"]["status"] == "comparable"
    assert result["rows"][1]["metric_assessments"]["total_hours"]["status"] == "not_ready"
    assert len(result["pairs"]) == 3


def test_a_changed_post7_anchor_contract_does_not_invalidate_a_valid_post3():
    request, pack = event_regions()
    pack["snapshots"][1]["result"]["windows"]["post1_7"]["relative_days"] = [2, 8]
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["post1_7.total_hours"]["status"] == "not_ready"
    assert result["pairs"][0]["metrics"]["post1_3.total_hours"]["status"] == "comparable"


def test_unprepared_daily_zero_cannot_certify_observed_support():
    request, pack = three_regions()
    pack["snapshots"][1]["result"]["daily"][0]["state"] = "unprepared"
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "limited_side_by_side"


def test_condition_conflicts_explain_actual_expected_values_and_no_implicit_alternative():
    request, pack = three_regions()
    request["month"] = "2024-03"
    result = compare_known_snapshots(request, pack)
    row = result["rows"][0]
    assert row["differences"] == [{"field": "month", "actual": "2024-02", "expected": "2024-03"}]
    assert row["metric_assessments"]["total_hours"]["value"] is None
    assert result["status"] == "no_comparable_pairs"


def test_third_failed_source_keeps_the_other_two_region_pair_qualified():
    request, pack = three_regions()
    third = copy.deepcopy(pack["snapshots"][1])
    third["result"]["parameters"]["longitude"] = 126.5
    third["comparison_facts"]["source_state"] = "failed"
    bind(third, request["candidates"][2])
    pack["snapshots"].append(third)
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "comparable"
    assert result["rows"][2]["reason"] == "source_failed"
    assert "metrics" not in result["rows"][2]
    assert result["status"] == "partial"


def test_read_existing_policy_alone_never_certifies_strict_support_alignment():
    request, pack = three_regions()
    request["support_policy"] = "read_existing_support"
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "limited_side_by_side"
    assert result["status"] == "no_comparable_pairs"


def test_daily_hour_disagreement_restricts_effort_metrics_but_keeps_area_exposure():
    request, pack = three_regions()
    pack["snapshots"][1]["result"]["daily"][0]["hours"] = 999
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    pair = result["pairs"][0]["metrics"]
    for key in ["total_hours", "mean_hours_per_supported_day", "density_hours_per_km2_day"]:
        assert pair[key]["status"] == "limited_side_by_side"
    assert pair["area_time_km2_days"]["status"] == "comparable"
    assert result["rows"][1]["metrics"]["total_hours"] == 0


def test_null_unit_is_local_and_does_not_discard_independently_verifiable_density():
    request, pack = three_regions()
    pack["snapshots"][1]["result"]["units"]["total_hours"] = None
    bind(pack["snapshots"][1], request["candidates"][1])
    result = compare_known_snapshots(request, pack)
    pair = result["pairs"][0]["metrics"]
    assert pair["total_hours"]["status"] == "not_ready"
    assert pair["density_hours_per_km2_day"]["status"] == "comparable"
    assert pair["area_time_km2_days"]["status"] == "comparable"


def test_bad_group_structure_is_local_to_its_metric_definition():
    request, pack = three_regions()
    pack["snapshots"][1]["comparison_facts"]["definitions"]["total_hours"]["groups"] = [
        {"id": "invalid", "lower": 10, "upper": 10, "unit": "km", "side": "cold"}
    ]
    result = compare_known_snapshots(request, pack)
    assert result["pairs"][0]["metrics"]["total_hours"]["status"] == "not_ready"
    assert result["pairs"][0]["metrics"]["density_hours_per_km2_day"]["status"] == "comparable"


def test_changed_reported_numerator_limits_its_ratios_without_replacing_any_source_value():
    request, pack = three_regions()
    pack["snapshots"][0]["result"]["metrics"]["total_hours"] = 999
    bind(pack["snapshots"][0], request["candidates"][0])
    result = compare_known_snapshots(request, pack)
    pair = result["pairs"][0]["metrics"]
    assert pair["total_hours"]["status"] == "limited_side_by_side"
    assert pair["density_hours_per_km2_day"]["status"] == "limited_side_by_side"
    assert pair["area_time_km2_days"]["status"] == "comparable"
    assert result["rows"][0]["metrics"]["total_hours"] == 999
