"""Independent checks through the original controlled monthly-analysis POST/GET."""

import hashlib
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.monthly_analysis import create_monthly_router

URL = "/api/query/monthly-analysis"
AUTH = {"Authorization": "Bearer reference-test"}


def layer(kind, bounds, hours=None):
    return {
        "id": "front-original" if kind == "front" else "effort-original",
        "kind": kind,
        "role": "analysis_source",
        "unit": "classification_code" if kind == "front" else "fishing_hours",
        "time_verified": True,
        "bounds_verified": True,
        "support_verified": True,
        "duration_days": 1,
        "cells": [{"bounds": bounds, "hours": hours, "support": "valid"}],
    }


def reference_fixture():
    effort = [0.077, -0.001, 0.079, 0.001]
    wide_front = [-0.4, -0.4, 0.4, 0.4]
    return {
        "schema": "ocean-month-distance-input/v1",
        "conditions": {
            "schema": "ocean-support-request/v1",
            "purpose": "A_month",
            "month": "2024-08",
            "layer_use": "front_effort",
            "method_version": "wgs84-laea-uniform/v1",
            "quality_rule": "complete-common-support/v1",
            "allocation": "overlap_uniform",
            "geometries": [{"id": "circle", "type": "circle", "center": [0, 0], "radius_km": 10}],
        },
        "distance_edges_km": [5, 20],
        "front_position_error_km": 0.01,
        "regional_cells": {
            "schema": "ocean-regional-cells/v1",
            "evidence_kind": "synthetic",
            "days": [
                {
                    "date": "2024-08-01",
                    "layers": [layer("front", wide_front), layer("activity", effort, 42)],
                },
                {
                    "date": "2024-08-02",
                    "layers": [layer("front", wide_front), layer("activity", effort, 0)],
                },
                {
                    "date": "2024-08-03",
                    "layers": [
                        layer("front", [0.07, -0.01, 0.085, 0.01]),
                        layer("activity", effort, 8),
                    ],
                },
                {"date": "2024-08-04", "layers": [layer("activity", effort, 7)]},
            ],
        },
        "front_days": [
            {
                "date": "2024-08-01",
                "source_id": "front-original",
                "lines": [[[0.1, -0.04], [0.1, 0.04]]],
            },
            {"date": "2024-08-02", "source_id": "front-original", "lines": []},
            {"date": "2024-08-03", "source_id": "front-original", "lines": []},
        ],
    }


def case(tmp_path, data=None):
    path = tmp_path / "reference.json"
    if data is None:
        data = reference_fixture()
    raw = json.dumps(data).encode()
    path.write_bytes(raw)
    app = FastAPI()
    app.include_router(
        create_monthly_router(
            settings.model_copy(
                update={
                    "monthly_execution_token": SecretStr("reference-test"),
                    "monthly_distance_input_path": path,
                }
            )
        )
    )
    request = {
        "purpose": "monthly_distance_reference",
        "longitude": data["conditions"]["geometries"][0]["center"][0],
        "latitude": data["conditions"]["geometries"][0]["center"][1],
        "radius_km": 10,
        "month": "2024-08",
        "input_version": "sha256:" + hashlib.sha256(raw).hexdigest(),
        "method_version": "wgs84-distance-bands/v1",
        "parameter_version": "half-open-bands/v1",
    }
    return TestClient(app), path, request


def test_outside_circle_front_is_paired_by_day_and_uses_same_support_exposure(tmp_path):
    client, path, request = case(tmp_path)
    assert client.post(URL, json=request).status_code == 401
    response = client.post(URL, headers=AUTH, json=request)
    assert response.status_code == 200, response.text
    run = response.json()
    assert run["state"] == "completed", run
    result = run["result"]
    assert result["research_ready"] is False and result["evidence_kind"] == "synthetic"
    assert len(result["days"]) == 31
    first, second, third, missing = result["days"][:4]
    # At the equator this 0.002° square is entirely in the circle; independent WGS84
    # metres per degree at the equator are 111319.49 E/W and 110574.28 N/S.
    area = (111319.49 * 0.002) * (110574.28 * 0.002) / 1e6
    near, far, unknown = first["bands"][0], second["bands"][2], third["bands"][3]
    assert near["hours"] == pytest.approx(42) and near["area_time_km2_days"] == pytest.approx(
        area, rel=0.0001
    )
    assert far["hours"] == 0 and far["area_time_km2_days"] == pytest.approx(area, rel=0.0001)
    assert unknown["hours"] == pytest.approx(8) and unknown["area_time_km2_days"] == pytest.approx(
        area, rel=0.0001
    )
    assert missing["common"]["hours"] is None
    assert result["month"]["bands"][0]["density_hours_per_km2_day"] == pytest.approx(
        42 / area, rel=0.0001
    )
    assert sum(row["hours"] or 0 for row in result["month"]["bands"]) == pytest.approx(50)
    assert result["month"]["common"]["area_time_km2_days"] == pytest.approx(3 * area, rel=0.0001)
    path.unlink()
    saved_url = URL + "/" + run["id"]
    assert client.get(saved_url).status_code == 401
    saved = client.get(saved_url, headers=AUTH)
    assert saved.json()["result"] == result and saved.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(("latitude", "expected_band"), [(0, 1), (60, 0)])
def test_latitude_changes_geographic_distance_and_overlapping_lines_do_not_duplicate_hours(
    tmp_path, latitude, expected_band
):
    data = reference_fixture()
    data["conditions"]["geometries"][0]["center"] = [0, latitude]
    data["distance_edges_km"] = [6, 20]
    cells = data["regional_cells"]
    cells["days"] = [
        {
            "date": "2024-08-01",
            "layers": [
                layer("front", [-0.5, latitude - 0.4, 0.5, latitude + 0.4]),
                layer("activity", [-0.001, latitude - 0.001, 0.001, latitude + 0.001], 40),
            ],
        }
    ]
    line = [[0.09, latitude - 0.03], [0.09, latitude + 0.03]]
    data["front_days"] = [
        {"date": "2024-08-01", "source_id": "front-original", "lines": [line, line]}
    ]
    client, _, request = case(tmp_path, data)
    run = client.post(URL, headers=AUTH, json=request).json()
    assert run["state"] == "completed", run
    row = run["result"]["days"][0]
    assert row["bands"][expected_band]["hours"] == pytest.approx(40)
    assert sum(band["hours"] or 0 for band in row["bands"]) == pytest.approx(40)
    # Longitude gap 0.09° is about 10.02 km at the equator, about 5.02 km at 60°N.
    expected = 10.02 if latitude == 0 else 5.02
    assert row["minimum_proven_lower_km"] < expected < row["maximum_known_upper_km"]


def test_band_edge_uncertainty_and_known_zero_exposure_stay_distinct_from_missing(tmp_path):
    data = reference_fixture()
    data["distance_edges_km"] = [2.449, 20]
    no_ocean = layer("activity", [-0.4, -0.4, 0.4, 0.4])
    no_ocean["cells"][0]["support"] = "land"
    data["regional_cells"]["days"].append(
        {
            "date": "2024-08-05",
            "layers": [
                layer("front", [-0.4, -0.4, 0.4, 0.4]),
                no_ocean,
            ],
        }
    )
    client, _, request = case(tmp_path, data)
    run = client.post(URL, headers=AUTH, json=request).json()
    assert run["state"] == "completed", run
    rows = run["result"]["days"]
    assert rows[0]["distance_states"] == {"distance_interval_crosses_band": 1}
    assert rows[0]["bands"][-1]["hours"] == pytest.approx(42)
    assert rows[4]["common"]["area_time_km2_days"] == 0
    assert rows[4]["common"]["density_hours_per_km2_day"] is None
    assert rows[5]["common"]["area_time_km2_days"] is None


def test_partial_coastal_cell_conserves_hours_on_the_retained_half(tmp_path):
    data = reference_fixture()
    front = layer("front", [0.078, -0.01, 0.09, 0.01])
    front["cells"].append({"bounds": [0.07, -0.01, 0.078, 0.01], "support": "land"})
    data["regional_cells"]["days"][0]["layers"][0] = front
    data["front_days"][0]["lines"] = []
    client, _, request = case(tmp_path, data)
    run = client.post(URL, headers=AUTH, json=request).json()
    assert run["state"] == "completed", run
    first = run["result"]["days"][0]
    assert first["bands"][-1]["hours"] == pytest.approx(21, rel=0.0001)
    assert first["common"]["area_time_km2_days"] == pytest.approx(0.024618, rel=0.0001)
    assert first["distance_states"] == {"insufficient_search_support": 1}


def test_mismatched_versions_geometry_and_real_sources_cannot_run_reference(tmp_path):
    data = reference_fixture()
    client, path, request = case(tmp_path, data)
    for change in [{"longitude": 1}, {"input_version": "sha256:" + "1" * 64}]:
        rejected = client.post(URL, headers=AUTH, json={**request, **change}).json()
        assert rejected["state"] == "failed" and rejected["result"] is None
    data["regional_cells"]["evidence_kind"] = "audited_cells"
    raw = json.dumps(data).encode()
    path.write_bytes(raw)
    real = client.post(
        URL,
        headers=AUTH,
        json={**request, "input_version": "sha256:" + hashlib.sha256(raw).hexdigest()},
    ).json()
    assert real["state"] == "failed" and real["result"] is None
