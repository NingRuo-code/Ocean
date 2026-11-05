"""Calendar and purpose qualification at the approved public audit CLI."""

import json
import subprocess
from datetime import date, timedelta

import pytest
from test_regional_support_cli import CLI, cell, layer


def conditions(**options):
    return {
        "schema": "ocean-support-request/v1",
        "purpose": "A_month",
        "month": "2024-08",
        "layer_use": "front_effort",
        "method_version": "wgs84-laea-uniform/v1",
        "quality_rule": "complete-common-support/v1",
        "allocation": "overlap_uniform",
        "geometries": [{"id": "cell", "type": "bbox", "bounds": [0, 0, 0.01, 0.01]}],
        **options,
    }


def known_days(start="2024-08-01", end="2024-08-31"):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    return [
        {
            "date": (first + timedelta(days=i)).isoformat(),
            "layers": [
                layer("front", [cell([0, 0, 0.01, 0.01])]),
                layer("activity", [cell([0, 0, 0.01, 0.01], 10)]),
            ],
        }
        for i in range((last - first).days + 1)
    ]


def run_support(tmp_path, request, days, *, evidence=None, extra=None):
    (tmp_path / "conditions.json").write_text(json.dumps(request), encoding="utf-8")
    (tmp_path / "cells.json").write_text(
        json.dumps(
            {
                "schema": "ocean-regional-cells/v1",
                "evidence_kind": "synthetic",
                "days": days,
                "qualification_evidence": evidence,
            }
        ),
        encoding="utf-8",
    )
    return subprocess.run(
        [
            "node",
            str(CLI),
            "--support-request",
            str(tmp_path / "conditions.json"),
            "--regional-input",
            str(tmp_path / "cells.json"),
            "--out",
            str(tmp_path / "support.json"),
            *(extra or []),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )


def support(tmp_path, request, days, **options):
    run = run_support(tmp_path, request, days, **options)
    assert run.returncode == 0, run.stderr
    return json.loads((tmp_path / "support.json").read_text(encoding="utf-8"))


def test_full_calendar_arithmetic_does_not_replace_license_or_granularity_evidence(
    tmp_path,
):
    data = support(tmp_path, conditions(), known_days())
    month = data["regions"][0]["month"]
    assert len(data["regions"][0]["days"]) == 31
    assert month["computational_support"] == "supported"
    assert month["support_level"] == "unverified"
    assert month["included_days"] == 31 and month["excluded_days"] == 0
    assert month["summary"]["total_hours"] == pytest.approx(310)
    assert month["summary"]["mean_hours_per_supported_day"] == pytest.approx(10)
    assert month["summary"]["area_time_km2_days"] == pytest.approx(
        31 * 1.2309072018475635, rel=2e-6
    )
    assert "license_evidence_unverified" in month["missing_prerequisites"]
    assert "granularity_evidence_unverified" in month["missing_prerequisites"]
    assert data["research_ready"] is False


def test_fixed_event_windows_cross_month_and_post3_cannot_stand_for_post7(tmp_path):
    data = support(
        tmp_path,
        conditions(
            purpose="B_event",
            event_date="2024-08-31",
            event_day_rule="exclude_event_day/v1",
        ),
        known_days("2024-08-24", "2024-09-03"),
    )
    region = data["regions"][0]
    windows = region["windows"]
    assert windows["pre7"]["dates"] == [
        "2024-08-24",
        "2024-08-25",
        "2024-08-26",
        "2024-08-27",
        "2024-08-28",
        "2024-08-29",
        "2024-08-30",
    ]
    assert windows["post3"]["dates"] == ["2024-09-01", "2024-09-02", "2024-09-03"]
    assert windows["post7"]["dates"][-1] == "2024-09-07"
    assert windows["pre7"]["summary"]["total_hours"] == pytest.approx(70)
    assert windows["post3"]["summary"]["total_hours"] == pytest.approx(30)
    assert windows["post3"]["computational_support"] == "supported"
    assert (
        windows["post7"]["included_days"] == 3
        and windows["post7"]["excluded_days"] == 4
    )
    assert windows["post7"]["summary"]["total_hours"] is None
    assert windows["post7"]["computational_support"] == "limited"
    assert "2024-08-31" not in [
        day for window in windows.values() for day in window["dates"]
    ]
    assert data["resolved_conditions"]["geometries"] == data["conditions"]["geometries"]


def verified_evidence():
    proof = {"state": "verified", "evidence_id": "sha256:" + "1" * 64}
    return {
        "schema": "ocean-support-evidence/v1",
        "source_versions": {
            "front-original": "sha256:" + "2" * 64,
            "effort-original": "sha256:" + "3" * 64,
        },
        "processing_version": "sha256:" + "4" * 64,
        "license": proof,
        "quality_rule": {**proof, "id": "complete-common-support/v1"},
        "geometry": {
            "cell": {**proof, "request_geometry": conditions()["geometries"][0]}
        },
    }


def test_declared_verified_evidence_is_versioned_and_synthetic_cannot_qualify_research(
    tmp_path,
):
    evidence = verified_evidence()
    data = support(tmp_path, conditions(), known_days(), evidence=evidence)
    month = data["regions"][0]["month"]
    assert month["support_level"] == "supported"
    assert month["missing_prerequisites"] == []
    assert month["formal_research_permitted"] is False
    assert data["qualification_evidence"] == evidence
    assert (
        data["evidence_scope"]
        == "provided_verification_claims_not_independently_dereferenced"
    )
    evidence["geometry"]["cell"]["request_geometry"]["bounds"] = [0, 0, 0.02, 0.01]
    mismatched = support(tmp_path, conditions(), known_days(), evidence=evidence)
    assert mismatched["regions"][0]["month"]["support_level"] == "unverified"
    assert (
        "granularity_geometry_mismatch"
        in mismatched["regions"][0]["month"]["missing_prerequisites"]
    )


def test_internal_gap_reports_individual_layers_and_common_support(tmp_path):
    days = known_days()
    days[16]["layers"][1]["cells"] = [
        cell([0, 0, 0.005, 0.01], 5),
        cell([0.005, 0, 0.01, 0.01], support="unknown"),
    ]
    data = support(tmp_path, conditions(), days, evidence=verified_evidence())
    region = data["regions"][0]
    row = region["days"][16]
    assert (
        row["included"] is False
        and "unknown_spatial_support" in row["exclusion_reasons"]
    )
    assert row["layer_support"]["front"]["effective_area_km2"] == pytest.approx(
        1.2309072018475635, rel=2e-6
    )
    assert row["layer_support"]["activity"]["effective_area_km2"] == pytest.approx(
        0.6154536009237818, rel=2e-6
    )
    assert row["effective_area_km2"] == pytest.approx(0.6154536009237818, rel=2e-6)
    assert region["month"]["support_level"] == "limited"
    assert region["month"]["summary"]["total_hours"] is None
    assert region["month"]["included_days"] == 30


def test_frozen_support_snapshot_replays_without_inputs_and_detects_tampering(tmp_path):
    data = support(tmp_path, conditions(), known_days())
    (tmp_path / "conditions.json").unlink()
    (tmp_path / "cells.json").unlink()
    command = [
        "node",
        str(CLI),
        "--read-support-snapshot",
        str(tmp_path / "support.json"),
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
    data["regions"][0]["month"]["included_days"] = 32
    (tmp_path / "support.json").write_text(json.dumps(data), encoding="utf-8")
    changed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert (
        changed.returncode != 0
        and "invalid_support_snapshot_identity" in changed.stderr
    )


def test_missing_day_is_retained_and_optional_sst_only_blocks_its_own_use(tmp_path):
    days = known_days()
    days.pop(16)
    data = support(tmp_path, conditions(), days, evidence=verified_evidence())
    region = data["regions"][0]
    assert len(region["days"]) == 31 and region["days"][16]["date"] == "2024-08-17"
    assert (
        region["month"]["included_days"] == 30
        and region["month"]["support_level"] == "limited"
    )
    assert region["month"]["summary"]["total_hours"] is None
    assert region["month"]["summary"]["supported_subset"]["hours"] == pytest.approx(300)
    assert region["month"]["layer_material_states"]["front"] == {
        "declared_cells": 30,
        "unprepared": 1,
    }
    complete = support(tmp_path, conditions(), known_days())
    assert complete["regions"][0]["month"]["included_days"] == 31
    sst = support(tmp_path, conditions(layer_use="front_effort_sst"), known_days())
    assert sst["regions"][0]["month"]["included_days"] == 0
    assert "sst" in sst["required_layers"]
    assert (
        "missing_required_sst_layer"
        in sst["regions"][0]["days"][0]["exclusion_reasons"]
    )


def test_month_support_does_not_imply_event_pre7_and_blocked_license_wins(tmp_path):
    data = support(
        tmp_path,
        conditions(
            purpose="B_event",
            event_date="2024-08-01",
            event_day_rule="exclude_event_day/v1",
        ),
        known_days(),
        evidence=verified_evidence(),
    )
    region = data["regions"][0]
    assert region["month"]["support_level"] == "supported"
    assert region["windows"]["pre7"]["included_days"] == 0
    assert region["windows"]["pre7"]["support_level"] == "unverified"
    assert region["windows"]["post3"]["support_level"] == "supported"
    assert region["windows"]["pre7"]["dates"][0] == "2024-07-25"
    evidence = verified_evidence()
    evidence["license"]["state"] = "blocked"
    blocked = support(tmp_path, conditions(), known_days(), evidence=evidence)
    assert blocked["regions"][0]["month"]["computational_support"] == "supported"
    assert blocked["regions"][0]["month"]["support_level"] == "unsupported"
    assert blocked["regions"][0]["month"]["formal_research_permitted"] is False


@pytest.mark.parametrize(
    "change",
    ["month", "radius", "quality", "method", "hidden", "moving_B", "event_month"],
)
def test_illegal_conditions_are_rejected_without_substitution_or_output(
    tmp_path, change
):
    req = conditions()
    if change == "month":
        req["month"] = "2024-13"
    if change == "radius":
        req["geometries"] = [
            {"id": "cell", "type": "circle", "center": [0, 0], "radius_km": 15}
        ]
    if change == "quality":
        req["quality_rule"] = "lenient/v9"
    if change == "method":
        req["method_version"] = "unknown/v9"
    if change == "hidden":
        req["fallback_month"] = "2024-07"
    if change in {"moving_B", "event_month"}:
        req.update(
            purpose="B_event",
            event_date="2024-08-01" if change == "moving_B" else "2024-09-01",
            event_day_rule="exclude_event_day/v1",
        )
        if change == "moving_B":
            req["geometries"] = [
                {
                    "id": "line",
                    "type": "front_buffer",
                    "lines": [[[0, 0], [0.01, 0.01]]],
                    "radius_km": 20,
                }
            ]
    run = run_support(tmp_path, req, known_days())
    assert run.returncode != 0 and not (tmp_path / "support.json").exists()
    assert "Traceback" not in run.stderr


def test_real_daily_source_evidence_remains_unverified_for_actual_august(tmp_path):
    from test_regional_support_cli import ROOT

    (tmp_path / "conditions.json").write_text(
        json.dumps(conditions()), encoding="utf-8"
    )
    run = subprocess.run(
        [
            "node",
            str(CLI),
            "--support-request",
            str(tmp_path / "conditions.json"),
            "--daily-snapshot",
            str(ROOT / "docs/reports/ocean-real-source-adapter-audit-2026-11-05.json"),
            "--out",
            str(tmp_path / "support.json"),
            "--report-out",
            str(tmp_path / "support.md"),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert run.returncode == 0, run.stderr
    data = json.loads((tmp_path / "support.json").read_text(encoding="utf-8"))
    region = data["regions"][0]
    assert len(region["days"]) == 31
    assert (
        region["month"]["included_days"] == 0
        and region["month"]["support_level"] == "unverified"
    )
    assert region["month"]["summary"]["area_time_km2_days"] is None
    assert data["input_daily_snapshot_id"].startswith("sha256:")
    assert data["research_ready"] is False and data["qualification_evidence"] is None
    assert "unverified" in (tmp_path / "support.md").read_text(encoding="utf-8")


def test_descriptive_use_can_be_limited_when_research_granularity_is_blocked(tmp_path):
    evidence = verified_evidence()
    evidence["geometry"]["cell"]["state"] = "blocked"
    research = support(tmp_path, conditions(), known_days(), evidence=evidence)
    assert research["regions"][0]["month"]["support_level"] == "unsupported"
    descriptive = support(
        tmp_path, conditions(purpose="description"), known_days(), evidence=evidence
    )
    period = descriptive["regions"][0]["month"]
    assert period["support_level"] == "limited"
    assert period["available_uses"] == ["local_description"]
    assert period["formal_research_permitted"] is False


def test_readable_display_allows_only_material_inspection_not_research(tmp_path):
    days = known_days()
    for day in days:
        for source in day["layers"]:
            source.update(
                role="display",
                source_day_state="parsed",
                bounds_verified=False,
                cells=[],
            )
    data = support(
        tmp_path, conditions(purpose="map"), days, evidence=verified_evidence()
    )
    period = data["regions"][0]["month"]
    assert period["support_level"] == "limited"
    assert period["available_uses"] == ["local_material_inspection"]
    assert period["summary"]["total_hours"] is None
    assert period["formal_research_permitted"] is False


def test_leap_month_event_windows_keep_different_time_denominators(tmp_path):
    monthly = support(
        tmp_path, conditions(month="2024-02"), known_days("2024-02-01", "2024-02-29")
    )
    assert monthly["regions"][0]["month"]["expected_days"] == 29
    assert monthly["regions"][0]["month"]["summary"]["total_hours"] == pytest.approx(
        290
    )
    event = support(
        tmp_path,
        conditions(
            month="2024-02",
            purpose="B_event",
            event_date="2024-02-29",
            event_day_rule="exclude_event_day/v1",
        ),
        known_days("2024-02-22", "2024-03-07"),
        evidence=verified_evidence(),
    )
    region = event["regions"][0]
    assert region["month"]["included_days"] == 8
    assert region["windows"]["pre7"]["summary"]["total_hours"] == pytest.approx(70)
    assert region["windows"]["post3"]["summary"]["total_hours"] == pytest.approx(30)
    assert region["windows"]["post7"]["summary"]["total_hours"] == pytest.approx(70)
    assert region["windows"]["pre7"]["summary"][
        "mean_hours_per_supported_day"
    ] == pytest.approx(10)
    assert region["windows"]["post3"]["summary"][
        "mean_hours_per_supported_day"
    ] == pytest.approx(10)
    event_day = next(row for row in region["days"] if row["date"] == "2024-02-29")
    assert event_day["periods"] == ["month"]
    assert region["month"]["scope"] == "month_calendar_only_not_event_eligibility"


@pytest.mark.parametrize("state", ["conflict", "missing", "unverified"])
def test_source_day_failures_cannot_be_overridden_by_verified_value_flags(
    tmp_path, state
):
    days = known_days()
    days[16]["layers"][1]["source_day_state"] = state
    data = support(tmp_path, conditions(), days, evidence=verified_evidence())
    region = data["regions"][0]
    row = region["days"][16]
    assert row["hours"] is None and row["effective_area_km2"] is None
    assert f"activity_source_day_{state}" in row["exclusion_reasons"]
    assert region["month"]["included_days"] == 30
    assert region["month"]["support_level"] == "limited"
    assert region["month"]["data_gate_passed"] is False
