"""Independent checks through the original controlled monthly-analysis POST/GET."""

import csv
import hashlib
import io
import json
import os
import subprocess
from xml.etree import ElementTree
from zipfile import ZipFile

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app import monthly_analysis, monthly_distance_reference
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
    assert missing["common"]["activity_accounting"]["observed_not_assigned_hours"] == pytest.approx(
        7
    )
    assert result["month"]["bands"][0]["density_hours_per_km2_day"] == pytest.approx(
        42 / area, rel=0.0001
    )
    assert sum(row["hours"] or 0 for row in result["month"]["bands"]) == pytest.approx(50)
    assert result["month"]["common"]["area_time_km2_days"] == pytest.approx(3 * area, rel=0.0001)
    assert result["month"]["activity_accounting"]["observed_hours"] == pytest.approx(57)
    assert result["month"]["activity_accounting"]["observed_not_assigned_hours"] == pytest.approx(7)
    path.unlink()
    saved_url = URL + "/" + run["id"]
    assert client.get(saved_url).status_code == 401
    saved = client.get(saved_url, headers=AUTH)
    assert saved.json()["result"] == result and saved.headers["cache-control"] == "no-store"


def test_completed_distance_evidence_keeps_zero_and_unknown_after_source_removal(tmp_path):
    client, source, request = case(tmp_path)
    run = client.post(URL, json=request, headers=AUTH).json()
    assert run["state"] == "completed", run
    source.unlink()
    url = f"{URL}/{run['id']}/evidence"
    assert client.get(url).status_code == 401
    page = client.get(url, headers=AUTH)
    assert page.status_code == 200
    assert page.headers["cache-control"] == "no-store"
    assert run["result"]["result_id"] in page.text
    assert "距离带" in page.text and "未知" in page.text and "合成" in page.text
    assert "<td>已观测但未纳入共同支持</td><td>7.0</td>" in page.text
    response = client.get(url, headers=AUTH, params={"format": "zip"})
    assert response.status_code == 200
    assert client.get(url, headers=AUTH, params={"format": "zip"}).content == response.content
    with ZipFile(io.BytesIO(response.content)) as bundle:
        assert bundle.read("evidence.html") == page.content
        manifest = json.loads(bundle.read("manifest.json"))
        assert manifest["result_id"] == run["result"]["result_id"]
        assert manifest["files"]["evidence.html"]["sha256"] == hashlib.sha256(page.content).hexdigest()
        svg = ElementTree.fromstring(bundle.read("distance.svg"))
        svg_text = " ".join(svg.itertext())
        assert manifest["result_id"] in svg_text and "有效支持" in svg_text
        assert "区间未估计" in svg_text and "未知" in svg_text
        svg_bands = {g.attrib["data-band"]: g[0] for g in svg.iter() if "data-band" in g.attrib}
        assert float(svg_bands["0"].get("width")) > 0
        assert float(svg_bands["2"].get("width")) == 0
        assert "1" not in svg_bands
        rows = list(csv.DictReader(io.StringIO(bundle.read("daily.csv").decode("utf-8-sig"))))
        assert len(rows) == 31
        assert rows[0]["fishing_hours"] == "42.0"
        assert rows[1]["fishing_hours"] == "0.0"
        assert rows[3]["fishing_hours"] == ""
        assert all(row["result_id"] == manifest["result_id"] for row in rows)
        aggregates = list(csv.DictReader(io.StringIO(bundle.read("monthly.csv").decode("utf-8-sig"))))
        assert aggregates[1]["group"] == "[0, 5)" and aggregates[1]["fishing_hours"] == "42.0"
        assert aggregates[2]["fishing_hours"] == ""


def test_repeat_submit_reuses_the_same_completed_run_with_identical_live_input(tmp_path):
    client, _, request = case(tmp_path)
    first = client.post(URL, json=request, headers=AUTH).json()
    repeated = client.post(URL, json={**request, "longitude": -0.0}, headers=AUTH).json()
    assert first["state"] == "completed", first
    assert repeated == first
    assert client.get(f"{URL}/{first['id']}", headers=AUTH).json() == first

    direct_path = tmp_path / "independent"
    direct_path.mkdir()
    direct_client, _, direct_request = case(direct_path)
    direct = direct_client.post(URL, json=direct_request, headers=AUTH).json()
    assert direct["state"] == "completed", direct
    assert direct["id"] != first["id"]
    assert direct["execution_id"] == first["execution_id"]
    assert direct["result"] == repeated["result"]


def test_same_path_replacement_never_reuses_old_result_or_indexes_failed_request(tmp_path):
    client, source, request = case(tmp_path)
    first = client.post(URL, json=request, headers=AUTH).json()
    assert first["state"] == "completed", first
    original_stat = source.stat()
    replacement = source.read_bytes().replace(b'"hours": 42', b'"hours": 47')
    assert len(replacement) == original_stat.st_size
    source.write_bytes(replacement)
    os.utime(source, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))

    stale = client.post(URL, json=request, headers=AUTH).json()
    assert stale["state"] == "failed" and stale["result"] is None
    newest = {**request, "input_version": "sha256:" + hashlib.sha256(replacement).hexdigest()}
    failed_method = client.post(URL, json={**newest, "method_version": "changed"}, headers=AUTH).json()
    assert failed_method["state"] == "failed"
    second = client.post(URL, json=newest, headers=AUTH).json()
    assert second["state"] == "completed", second
    assert second["execution_id"] != first["execution_id"]
    assert second["result"]["result_id"] != first["result"]["result_id"]
    assert second["result"]["days"][0]["common"]["hours"] == pytest.approx(47)

    source.unlink()
    old = client.get(f"{URL}/{first['id']}", headers=AUTH).json()
    assert old == first and old["source_freshness"] == "unknown"
    assert old["result"]["days"][0]["common"]["hours"] == pytest.approx(42)


def test_runtime_version_change_updates_frozen_result_and_evidence(tmp_path, monkeypatch):
    client, _, request = case(tmp_path)
    first = client.post(URL, json=request, headers=AUTH).json()
    updated = monthly_analysis.distance_execution_environment(monthly_analysis.distance_execution_sources())
    updated["packages"]["shapely"] += ".1"
    monkeypatch.setattr(monthly_analysis, "distance_execution_environment", lambda sources: updated)
    second = client.post(URL, json=request, headers=AUTH).json()

    assert first["state"] == second["state"] == "completed"
    assert second["execution_id"] != first["execution_id"]
    assert second["result"]["month"] == first["result"]["month"]
    for run in (first, second):
        assert run["result"]["versions"]["execution_id"] == run["execution_id"]
        assert run["result"]["result_id"].encode() in client.get(
            f"{URL}/{run['id']}/evidence", headers=AUTH
        ).content
    assert second["result"]["result_id"] != first["result"]["result_id"]


def test_timed_out_calculation_never_becomes_a_reusable_result(tmp_path, monkeypatch):
    client, _, request = case(tmp_path)

    def timeout(*args):
        raise subprocess.TimeoutExpired("controlled calculation", 25)

    with monkeypatch.context() as patch:
        patch.setattr(monthly_analysis, "calculate_distance_reference", timeout)
        failed = client.post(URL, json=request, headers=AUTH).json()
    assert failed["state"] == "failed" and failed["result"] is None
    retry = client.post(URL, json=request, headers=AUTH).json()
    assert retry["state"] == "completed" and retry["id"] != failed["id"]
    assert client.post(URL, json=request, headers=AUTH).json() == retry
    assert client.get(f"{URL}/{failed['id']}", headers=AUTH).json() == failed


def test_incomplete_child_output_is_a_failed_run_and_can_be_retried(tmp_path, monkeypatch):
    client, _, request = case(tmp_path)
    output = json.dumps({
        "evidence_kind": "synthetic", "research_ready": False, "kind": request["purpose"],
        "parameters": request, "result_id": "sha256:" + "0" * 64, "versions": {},
    }).encode()

    def incomplete(command, **kwargs):
        return subprocess.CompletedProcess(command, 0, stdout=output)

    with monkeypatch.context() as patch:
        patch.setattr(monthly_distance_reference.subprocess, "run", incomplete)
        failed = client.post(URL, json=request, headers=AUTH).json()
    assert failed["state"] == "failed" and failed["result"] is None
    assert client.get(f"{URL}/{failed['id']}/evidence", headers=AUTH).status_code == 409
    retry = client.post(URL, json=request, headers=AUTH).json()
    assert retry["state"] == "completed" and retry["id"] != failed["id"]


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
    accounting = first["common"]["activity_accounting"]
    assert accounting["observed_hours"] == pytest.approx(42)
    assert accounting["observed_not_assigned_hours"] == pytest.approx(21, rel=0.0001)
    assert accounting["observed_not_assigned_area_time_km2_days"] == pytest.approx(
        0.024618, rel=0.0001
    )
    assert accounting["reason"] == "observed_portion_not_on_common_support"


def test_unsupported_outer_search_does_not_discard_verified_inner_bound(tmp_path):
    data = reference_fixture()
    data["conditions"]["geometries"][0]["center"] = [179.8, 0]
    data["distance_edges_km"] = [5, 100]
    data["regional_cells"]["days"] = [
        {
            "date": "2024-08-01",
            "layers": [
                layer("front", [179.71, -0.08, 179.89, 0.08]),
                layer("activity", [179.799, -0.001, 179.801, 0.001], 42),
            ],
        }
    ]
    data["front_days"] = [{"date": "2024-08-01", "source_id": "front-original", "lines": []}]
    client, _, request = case(tmp_path, data)
    run = client.post(URL, headers=AUTH, json=request).json()
    assert run["state"] == "completed", run
    row = run["result"]["days"][0]
    assert row["minimum_proven_lower_km"] == 5 and row["maximum_known_upper_km"] is None
    assert row["bands"][-1]["hours"] == pytest.approx(42)


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
    path.unlink()
    path.mkdir()
    invalid = client.post(URL, headers=AUTH, json=request).json()
    assert invalid["state"] == "failed" and invalid["result"] is None
