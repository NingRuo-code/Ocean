import copy
import json
from pathlib import Path

import pytest

from app.analysis_support import content_id
from app.fixed_region_example import run_fixed_region_example
from app.regional_comparison import compare_known_snapshots


def sample_snapshot(longitude, hours, area, days):
    result = {
        "kind": "monthly_spatial_example",
        "status": "partial",
        "parameters": {
            "purpose": "monthly_spatial_example",
            "longitude": longitude,
            "latitude": 30.2,
            "radius_km": 20,
            "month": "2024-02",
            "input_version": "synthetic-month/v1",
            "method_version": "monthly-known-support/v1",
            "parameter_version": "known-unit-membership/v1",
        },
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "source": {
            "id": "authored-facts",
            "version": "synthetic-month/v1",
            "input_sha256": "sha256:" + "a" * 64,
            "license": "CC0-1.0; authored synthetic facts",
            "support_evidence": "known synthetic circle, not GIS or P0",
        },
        "metrics": {
            "total_hours": hours,
            "area_time_km2_days": area,
            "supported_days": days,
            "calendar_days": 29,
            "mean_hours_per_supported_day": 20 if hours == 40 else hours,
            "density_hours_per_km2_day": 40 / 7 if hours == 40 else hours,
        },
        "units": {
            "total_hours": "fishing_hours",
            "area_time_km2_days": "km2*d",
            "mean_hours_per_supported_day": "fishing_hours/d",
            "density_hours_per_km2_day": "fishing_hours/(km2*d)",
        },
        "coverage": {"support_scope": "known_synthetic_units_for_declared_circle"},
        "caveats": ["Authored synthetic facts; original support is not aligned."],
    }
    result["result_id"] = content_id(result)
    return {
        "access": "public_aggregate",
        "public_aggregate_allowed": True,
        "result": result,
        "snapshot_sha256": content_id(result),
    }


def example():
    snapshots = [sample_snapshot(124.5, 40, 7, 2), sample_snapshot(125.5, 0, 4, 1)]
    request = {
        "purpose": "regional_comparison_example",
        "analysis_kind": "monthly_spatial_example",
        "radius_km": 20,
        "month": "2024-02",
        "evidence_use": "descriptive_side_by_side",
        "support_policy": "read_existing_support",
        "method_version": "known-snapshots/v1",
        "candidates": [
            {
                "id": identity,
                "name": name,
                "longitude": result["parameters"]["longitude"],
                "latitude": 30.2,
                "result_id": result["result_id"],
                "snapshot_sha256": content_id(result),
                "source": copy.deepcopy(result["source"]),
            }
            for identity, name, result in [
                ("east", "East circle", snapshots[0]["result"]),
                ("west", "West circle", snapshots[1]["result"]),
            ]
        ],
    }
    return request, {"schema": "ocean-controlled-comparison-snapshots/v1", "snapshots": snapshots}


def test_two_distinct_regions_read_original_values_units_and_support_in_submission_order():
    request, pack = example()
    result = compare_known_snapshots(request, pack)
    assert result["kind"] == "regional_comparison_example"
    assert result["analysis_kind"] == "monthly_spatial_example"
    assert result["research_ready"] is False
    assert result["status"] == "limited_side_by_side"
    east, west = result["rows"]
    assert [row["candidate"]["id"] for row in result["rows"]] == ["east", "west"]
    assert east["metrics"]["total_hours"] == 40
    assert east["metrics"]["area_time_km2_days"] == 7
    assert east["metrics"]["density_hours_per_km2_day"] == 40 / 7
    assert west["metrics"]["total_hours"] == 0
    assert west["metrics"]["supported_days"] == 1
    assert west["units"]["total_hours"] == "fishing_hours"
    assert east["source"] == pack["snapshots"][0]["result"]["source"]
    assert result["parameters"] == request
    assert "differences" not in result and "ranking" not in result


@pytest.mark.parametrize(
    "change", ["renamed_duplicate", "duplicate_id", "single", "polar_duplicate"]
)
def test_invalid_or_renamed_duplicate_regions_do_not_manufacture_second_candidates(change):
    request, pack = example()
    if change == "renamed_duplicate":
        request["candidates"][1]["longitude"] = 124.5
    elif change == "duplicate_id":
        request["candidates"][1]["id"] = "east"
    elif change == "polar_duplicate":
        for candidate in request["candidates"]:
            candidate["latitude"] = 90.0
    else:
        request["candidates"].pop()
    with pytest.raises(ValueError):
        compare_known_snapshots(request, pack)


@pytest.mark.parametrize("field,value", [("month", "2024-03"), ("radius_km", 10)])
def test_changed_common_conditions_keep_missing_conditions_explicit(field, value):
    request, pack = example()
    old = compare_known_snapshots(request, pack)
    request[field] = value
    changed = compare_known_snapshots(request, pack)
    assert changed["result_id"] != old["result_id"]
    assert changed["status"] == "not_ready"
    assert changed["rows"][0]["reason"] == "source_condition_mismatch"
    assert changed["rows"][0]["conflicts"] == [field]
    assert "metrics" not in changed["rows"][0]
    assert old["parameters"][field] != value


def test_missing_result_preserves_candidate_and_returns_existing_result_prerequisite():
    request, pack = example()
    pack["snapshots"].pop()
    result = compare_known_snapshots(request, pack)
    assert [row["candidate"]["id"] for row in result["rows"]] == ["east", "west"]
    assert result["rows"][0]["metrics"]["total_hours"] == 40
    assert result["rows"][1]["reason"] == "source_result_missing"
    assert result["rows"][1]["required"] == "existing_A_result"
    assert "metrics" not in result["rows"][1]


@pytest.mark.parametrize(
    "change,reason",
    [
        ("owner", "source_not_public"),
        ("unknown_access", "source_not_public"),
        ("license", "source_identity_or_contract_invalid"),
        ("tamper", "source_identity_or_contract_invalid"),
        ("real", "source_not_controlled_example"),
    ],
)
def test_each_source_requires_its_own_access_identity_and_synthetic_contract(change, reason):
    request, pack = example()
    entry = pack["snapshots"][1]
    if change == "owner":
        entry["access"] = "owner_only"
    elif change == "unknown_access":
        entry["public_aggregate_allowed"] = False
    elif change == "license":
        entry["result"]["source"]["license"] = "unverified license"
    elif change == "real":
        entry["result"]["evidence_kind"] = "real"
    else:
        entry["result"]["metrics"]["total_hours"] = 999
    entry["result"]["private_details"] = "DO_NOT_EXPOSE"
    result = compare_known_snapshots(request, pack)
    assert result["rows"][1]["reason"] == reason
    assert "metrics" not in result["rows"][1]
    assert "DO_NOT_EXPOSE" not in str(result)


def test_reordering_or_renaming_changes_comparison_identity_without_changing_source_values():
    request, pack = example()
    first = compare_known_snapshots(request, pack)
    request["candidates"].reverse()
    second = compare_known_snapshots(request, pack)
    request["candidates"][0]["name"] = "Friendly label"
    third = compare_known_snapshots(request, pack)
    assert len({r["result_id"] for r in [first, second, third]}) == 3
    assert [row["candidate"]["id"] for row in second["rows"]] == ["west", "east"]
    assert third["rows"][0]["metrics"]["total_hours"] == 0
    assert first["rows"][0]["metrics"]["total_hours"] == 40


def test_different_source_content_is_not_mistaken_for_a_condition_conflict():
    request, pack = example()
    second = pack["snapshots"][1]
    second["result"]["source"]["input_sha256"] = "sha256:" + "b" * 64
    second["snapshot_sha256"] = content_id(second["result"])
    request["candidates"][1].update(
        source=copy.deepcopy(second["result"]["source"]), snapshot_sha256=second["snapshot_sha256"]
    )
    result = compare_known_snapshots(request, pack)
    assert result["rows"][1]["status"] == "limited_side_by_side"
    assert (
        result["rows"][1]["source"]["input_sha256"] != result["rows"][0]["source"]["input_sha256"]
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("support_policy", "silently_align"),
        ("method_version", "unregistered/v2"),
        ("radius_km", 50),
    ],
)
def test_unsupported_requested_policies_and_ranges_are_rejected(field, value):
    request, pack = example()
    request[field] = value
    with pytest.raises(ValueError):
        compare_known_snapshots(request, pack)


def test_unknown_source_metrics_stay_unknown_instead_of_becoming_zero():
    request, pack = example()
    row = pack["snapshots"][1]["result"]
    row["status"] = "unavailable"
    row["metrics"].update(
        total_hours=None,
        area_time_km2_days=None,
        supported_days=0,
        mean_hours_per_supported_day=None,
        density_hours_per_km2_day=None,
    )
    row["result_id"] = content_id({k: v for k, v in row.items() if k != "result_id"})
    request["candidates"][1]["result_id"] = row["result_id"]
    pack["snapshots"][1]["snapshot_sha256"] = content_id(row)
    request["candidates"][1]["snapshot_sha256"] = content_id(row)
    result = compare_known_snapshots(request, pack)
    assert result["rows"][1]["metrics"]["total_hours"] is None
    assert result["rows"][1]["source_status"] == "unavailable"


@pytest.mark.parametrize("change", ["unknown_with_zero", "wrong_units", "unsupported_scope"])
def test_rebound_but_invalid_source_semantics_are_not_accepted_as_known_metrics(change):
    request, pack = example()
    result = pack["snapshots"][1]["result"]
    if change == "unknown_with_zero":
        result["metrics"]["supported_days"] = 0
    elif change == "wrong_units":
        result["units"]["total_hours"] = "minutes"
    else:
        result["coverage"]["support_scope"] = "unverified_geometry"
    result["result_id"] = content_id({k: v for k, v in result.items() if k != "result_id"})
    request["candidates"][1]["result_id"] = result["result_id"]
    pack["snapshots"][1]["snapshot_sha256"] = content_id(result)
    request["candidates"][1]["snapshot_sha256"] = content_id(result)
    read = compare_known_snapshots(request, pack)
    assert read["rows"][1]["reason"] == "source_identity_or_contract_invalid"
    assert "metrics" not in read["rows"][1]


def test_monthly_and_event_search_conditions_cannot_be_mixed():
    request, pack = example()
    request["search_start"] = "2024-08-05"
    with pytest.raises(ValueError):
        compare_known_snapshots(request, pack)


def test_existing_fixed_region_windows_are_read_separately_without_new_event_calculation():
    source = json.loads(
        (Path(__file__).parents[1] / "app/examples/fixed-region-event.json").read_text(
            encoding="utf-8"
        )
    )
    second = copy.deepcopy(source["conditions"][0])
    second.update(id="second-same-period", longitude=125.5)
    for day in second["days"]:
        for unit in day["units"]:
            unit["hours"] = 0
    source["conditions"] = [source["conditions"][0], second]
    snapshots = []
    for longitude in [124.5, 125.5]:
        result = run_fixed_region_example(
            {
                "purpose": "fixed_region_event_example",
                "longitude": longitude,
                "latitude": 30.2,
                "radius_km": 20,
                "search_start": "2024-08-05",
                "search_end": "2024-08-08",
                "input_version": source["version"],
                "method_version": "observed-entry-example/v1",
                "parameter_version": "fixed-support-windows/v1",
            },
            source,
        )
        snapshots.append(
            {
                "access": "public_aggregate",
                "public_aggregate_allowed": True,
                "result": result,
                "snapshot_sha256": content_id(result),
            }
        )
    request, _ = example()
    request.update(
        analysis_kind="fixed_region_event_example",
        search_start="2024-08-05",
        search_end="2024-08-08",
    )
    del request["month"]
    for candidate, entry in zip(request["candidates"], snapshots, strict=True):
        candidate.update(
            result_id=entry["result"]["result_id"],
            source=entry["result"]["source"],
            snapshot_sha256=content_id(entry["result"]),
        )
    result = compare_known_snapshots(
        request, {"schema": "ocean-controlled-comparison-snapshots/v1", "snapshots": snapshots}
    )
    assert result["analysis_kind"] == "fixed_region_event_example"
    east, west = result["rows"]
    assert east["windows"]["post1_3"]["total_hours"] == 36
    assert east["windows"]["post1_3"]["area_time_km2_days"] == 12
    assert east["windows"]["post1_7"]["total_hours"] == 56
    assert west["windows"]["post1_3"]["total_hours"] == 0
    assert east["event"]["anchor_date"] == "2024-08-05"
    assert "metrics" not in east


@pytest.mark.parametrize("change", ["oversized_state", "false_exclusion_count"])
def test_invalid_exclusion_metadata_cannot_publish_an_unreadable_or_inconsistent_snapshot(change):
    pack = json.loads(
        (Path(__file__).parents[1] / "app/examples/regional-known-snapshots.json").read_text(
            encoding="utf-8"
        )
    )
    pack["snapshots"] = pack["snapshots"][2:]
    request = json.loads(
        (Path(__file__).parents[2] / "docs/data/regional-comparison-event.example.json").read_text(
            encoding="utf-8"
        )
    )
    for entry in pack["snapshots"]:
        for key in ["daily", "selection", "readiness"]:
            entry["result"].pop(key, None)
    first = pack["snapshots"][0]
    first["result"]["windows"]["pre7"]["excluded_day_states"] = {
        "x" * 1_030_000 if change == "oversized_state" else "missing": 1,
    }
    for candidate, entry in zip(request["candidates"], pack["snapshots"], strict=True):
        entry["snapshot_sha256"] = content_id(entry["result"])
        candidate["snapshot_sha256"] = entry["snapshot_sha256"]
    assert len(json.dumps(pack, separators=(",", ":")).encode()) < 1_048_576
    result = compare_known_snapshots(request, pack)
    assert result["rows"][0]["reason"] == "source_identity_or_contract_invalid"
    assert "windows" not in result["rows"][0]
    assert len(json.dumps(result, indent=2).encode()) < 1_048_576
