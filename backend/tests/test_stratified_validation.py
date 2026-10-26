import json
from pathlib import Path

import pytest

from app.analysis_support import content_id
from app.stratified_validation import validate_known_months

ROOT = Path(__file__).resolve().parents[2]


def inputs():
    return (
        json.loads(
            (ROOT / "docs/data/g3-known-validation.example.json").read_text(encoding="utf-8")
        ),
        json.loads(
            (ROOT / "backend/app/examples/g3-known-snapshots.json").read_text(encoding="utf-8")
        ),
    )


def rebind(request, entry):
    entry["snapshot_sha256"] = content_id(entry["result"])
    for candidate in request["candidates"]:
        if candidate["result_id"] == entry["result"]["result_id"]:
            candidate["snapshot_sha256"] = entry["snapshot_sha256"]


def test_known_strata_keep_original_A_identity_daily_support_and_weighted_ratio():
    request, pack = inputs()
    result = validate_known_months(request, pack)
    assert result["parameters"] == request
    assert result["evidence_kind"] == "synthetic_example"
    assert result["source"]["input_sha256"] == content_id(pack)
    by = {(s["year"], s["season"]): s for s in result["strata"]}
    assert by[2024, "summer"]["metrics"]["total_hours"] == 40
    assert by[2024, "summer"]["metrics"]["area_time_km2_days"] == 5
    assert by[2024, "summer"]["metrics"]["density_hours_per_km2_day"] == 8
    assert by[2024, "summer"]["planned_calendar_days"] == 92
    assert by[2024, "summer"]["metrics"]["calendar_days"] == 61
    assert by[2023, "summer"]["metrics"]["total_hours"] == 0
    assert by[2023, "winter"]["metrics"]["total_hours"] == 40
    assert by[2023, "winter"]["metrics"]["area_time_km2_days"] == 7
    assert by[2023, "winter"]["planned_calendar_days"] == 59
    winter = by[2024, "winter"]
    assert winter["metrics"]["total_hours"] == 20
    assert winter["metrics"]["area_time_km2_days"] == 2
    assert winter["metrics"]["supported_days"] == 1
    assert winter["metrics"]["calendar_days"] == 60  # leap Feb plus December, same calendar year.
    first = result["rows"][0]
    assert first["source_result_id"] == pack["snapshots"][0]["result"]["result_id"]
    assert first["snapshot_sha256"] == pack["snapshots"][0]["snapshot_sha256"]
    assert first["daily"][1]["hours"] == 0
    assert first["daily"][2]["hours"] is None
    assert first["units"]["density_hours_per_km2_day"] == "fishing_hours/(km2*d)"
    assert result["protocol_status"] == result["partition_status"] == "reference_only"
    assert result["confirmatory"] is result["research_ready"] is False
    assert result["independence"] == "not_assessed"
    assert result["random_seed"] is result["intervals"] is None
    assert "p_value" not in result
    assert request == inputs()[0] and pack == inputs()[1]


@pytest.mark.parametrize(
    "mode",
    [
        "duplicate_id",
        "duplicate_month",
        "duplicate_result",
        "overlapping_seasons",
        "wrong_season",
        "B_request",
        "confirmatory",
        "unknown_method",
        "unbounded_reference",
        "unknown_season_year",
    ],
)
def test_invalid_or_unfrozen_requests_fail_before_publishing_any_strata(mode):
    request, pack = inputs()
    if mode.startswith("duplicate_"):
        key = {"duplicate_id": "id", "duplicate_month": "month", "duplicate_result": "result_id"}[
            mode
        ]
        request["candidates"][1][key] = request["candidates"][0][key]
    elif mode == "overlapping_seasons":
        request["seasons"]["summer"].append(2)
    elif mode == "wrong_season":
        request["candidates"][0]["season"] = "summer"
    elif mode == "B_request":
        request["analysis_kind"] = "fixed_region_event_example"
    elif mode == "confirmatory":
        request["confirmatory"] = True
    elif mode == "unknown_method":
        request["method_version"] = "pretend-real/v1"
    elif mode == "unbounded_reference":
        request["protocol_ref"] = "file:///private/protocol"
    else:
        request["season_year_rule"] = "implicit"
    with pytest.raises(ValueError):
        validate_known_months(request, pack)


@pytest.mark.parametrize(
    "mode",
    [
        "wrong_sha",
        "wrong_unit",
        "wrong_hours",
        "wrong_method",
        "wrong_radius",
        "wrong_kind",
        "wrong_calendar",
        "wrong_year",
    ],
)
def test_one_bad_source_stays_a_visible_exclusion_without_poisoning_other_years(mode):
    request, pack = inputs()
    entry = pack["snapshots"][0]
    if mode == "wrong_sha":
        request["candidates"][0]["snapshot_sha256"] = "sha256:" + "f" * 64
    elif mode == "wrong_unit":
        entry["result"]["units"]["total_hours"] = "vessel_count"
    elif mode == "wrong_hours":
        entry["result"]["daily"][0]["hours"] = 999
    elif mode == "wrong_method":
        entry["result"]["parameters"]["method_version"] = "unsupported/v1"
    elif mode == "wrong_radius":
        entry["result"]["parameters"]["radius_km"] = 30
    elif mode == "wrong_kind":
        entry["result"]["kind"] = "fixed_region_event_example"
    elif mode == "wrong_calendar":
        entry["result"]["daily"].pop()
    else:
        request["candidates"][0]["month"] = "2025-02"
    if mode not in {"wrong_sha", "wrong_year"}:
        rebind(request, entry)
    result = validate_known_months(request, pack)
    assert len(result["rows"]) == 8
    row = result["rows"][0]
    assert row["status"] == "not_ready"
    assert "metrics" not in row and "daily" not in row
    assert (
        next(s for s in result["strata"] if s["year"] == 2023 and s["season"] == "summer")[
            "metrics"
        ]["total_hours"]
        == 0
    )
    summer = next(s for s in result["strata"] if s["year"] == 2024 and s["season"] == "summer")
    assert summer["metrics"]["density_hours_per_km2_day"] == 8
    if mode == "wrong_kind":
        assert row["reason"] == "source_analysis_kind_mismatch"


def test_unknown_and_no_candidates_are_not_zero_observations():
    request, pack = inputs()
    request["candidates"] = [next(c for c in request["candidates"] if c["month"] == "2024-12")]
    result = validate_known_months(request, pack)
    winter = next(s for s in result["strata"] if s["season"] == "winter")
    summer = next(s for s in result["strata"] if s["season"] == "summer")
    assert result["status"] == "not_ready"
    assert winter["metrics"]["total_hours"] is winter["metrics"]["area_time_km2_days"] is None
    assert winter["planned_calendar_days"] == winter["metrics"]["calendar_days"] == 31
    assert summer["status"] == "no_candidates"
    assert summer["metrics"]["density_hours_per_km2_day"] is None
    assert summer["planned_calendar_days"] == 0


def test_private_or_unknown_sources_are_checked_before_projection_and_never_leak_values():
    request, pack = inputs()
    for entry in pack["snapshots"]:
        entry["access"] = "owner_only"
        entry["result"]["source"]["id"] = "PRIVATE_MARKER"
        entry["result"]["private_payload"] = "PRIVATE_MARKER"
    result = validate_known_months(request, pack)
    assert result["status"] == "not_ready"
    assert len(result["rows"]) == 8
    assert all("metrics" not in row and "source" not in row for row in result["rows"])
    assert "PRIVATE_MARKER" not in json.dumps(result)


def test_different_source_support_is_retained_but_not_pooled_into_a_stratum():
    request, pack = inputs()
    entry = next(e for e in pack["snapshots"] if e["result"]["parameters"]["month"] == "2024-08")
    entry["result"]["source"]["support_evidence"] = "different-unverified-support/v1"
    rebind(request, entry)
    result = validate_known_months(request, pack)
    summer = next(s for s in result["strata"] if s["year"] == 2024 and s["season"] == "summer")
    assert summer["metrics"]["total_hours"] == 10
    assert summer["metrics"]["area_time_km2_days"] == 2
    assert summer["metrics"]["density_hours_per_km2_day"] == 5
    row = next(r for r in result["rows"] if r["candidate"]["month"] == "2024-08")
    assert row["reason"] == "source_support_mismatch"
    assert "metrics" not in row
    assert len(result["rows"]) == 8
