"""The actual freeze CLI and owner API keep the main and all sensitivity rows."""

import json
import subprocess
import sys
from pathlib import Path

import pytest
from test_monthly_distance_background import comparison_fixture
from test_monthly_distance_reference import AUTH, URL, case

CLI = Path(__file__).resolve().parents[2] / "tools" / "monthly_sensitivity_plan.py"


def freeze(tmp_path):
    reference = comparison_fixture(60, 4)
    draft = {
        "version": "ocean-month-sensitivity-plan/v1",
        "frozen_at": "2024-07-01T00:00:00+00:00",
        "prior_target_effect_seen": False,
        "rationale": "Independent geometric fixture; thresholds check behavior only.",
        "variants": [
            {
                "id": "radius20",
                "axis": "radius_km",
                "value": 20,
                "rationale": "larger declared circle",
            },
            {
                "id": "center",
                "axis": "allocation",
                "value": "cell_center",
                "rationale": "compare boundary allocation",
            },
            {
                "id": "bands",
                "axis": "distance_edges_km",
                "value": [0.5, 8],
                "rationale": "wider middle band",
            },
            {
                "id": "coverage",
                "axis": "minimum_circle_coverage",
                "value": 0.25,
                "rationale": "test insufficient coverage",
            },
            {
                "id": "large",
                "axis": "large_cell_hours_above",
                "value": 50,
                "rationale": "test leverage of legal large values",
            },
            {
                "id": "unavailable",
                "axis": "distance_edges_km",
                "value": [1],
                "rationale": "exercise a band layout without the registered background index",
            },
        ],
    }
    source, protocol, out = [
        tmp_path / name for name in ("unfrozen.json", "draft.json", "frozen.json")
    ]
    source.write_text(json.dumps(reference), encoding="utf-8")
    protocol.write_text(json.dumps(draft), encoding="utf-8")
    result = subprocess.run(
        [
            sys.executable,
            str(CLI),
            "--input",
            str(source),
            "--plan",
            str(protocol),
            "--out",
            str(out),
        ],
        capture_output=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(out.read_bytes())


def test_frozen_plan_executes_all_declared_axes_without_losing_failed_variants(
    tmp_path,
):
    registered = freeze(tmp_path)
    client, _, request = case(tmp_path, registered)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    record = run.json()
    assert record["state"] == "completed", record
    result = record["result"]
    matrix = result["sensitivity"]
    assert matrix["plan_id"] == registered["sensitivity_plan"]["plan_id"]
    assert matrix["scope"] == "synthetic_exploratory"
    assert matrix["primary"]["target"]["hours"] == 60
    assert result["month"]["common"]["hours"] == pytest.approx(1064)
    variants = {row["id"]: row for row in matrix["variants"]}
    assert list(variants) == ["radius20", "center", "bands", "coverage", "large", "unavailable"]
    assert variants["radius20"]["conditions"]["radius_km"] == 20
    assert variants["center"]["support_comparison"] == "same_selected_support"
    assert variants["bands"]["status"] == "descriptive_distance_only"
    assert variants["coverage"]["excluded_reason_counts"]["insufficient_circle_coverage"] == 1
    assert variants["large"]["removed_input_hours"] == 1060
    assert variants["large"]["status"] == "descriptive_distance_only"
    assert variants["unavailable"]["status"] == "variant_unavailable"
    assert variants["unavailable"]["reason"] == "invalid_same_circle_comparison_policy"
    assert client.get(f"{URL}/{record['id']}", headers=AUTH).json()["result"] == result


def test_frozen_plan_cannot_be_reused_after_a_primary_input_change(tmp_path):
    registered = freeze(tmp_path)
    registered["distance_comparison"]["minimum_area_ratio"] = 0.3
    client, _, request = case(tmp_path, registered)
    run = client.post(URL, headers=AUTH, json=request)
    assert run.status_code == 200, run.text
    assert run.json()["state"] == "failed" and run.json()["result"] is None
