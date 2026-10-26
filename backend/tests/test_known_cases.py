import json
import shutil
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analysis_support import content_id
from app.known_cases import create_known_case_router
from app.main import app

QUERY = {"reference_date": "2024-08-05", "longitude": 124.5, "latitude": 30.2, "radius_km": 20}


def test_actual_case_search_returns_only_allowed_historical_A_references_and_reads_original():
    client = TestClient(app)
    r = client.get("/api/query/known-cases", params=QUERY)
    assert r.status_code == 200
    data = r.json()
    assert data["library_id"] == "authored-exploration/v1"
    assert data["total"] == 4
    assert [c["case_id"] for c in data["candidates"]] == [
        "case-2024-06",
        "case-2024-02",
        "case-2023-08",
    ]
    assert data["next_offset"] == 3
    assert data["request"] == {
        **QUERY,
        "library_id": "authored-exploration/v1",
        "case_type": "monthly_background",
    }
    assert data["search_id"].startswith("sha256:") and data["library_version"].startswith("sha256:")
    assert r.headers["cache-control"] == "no-store"
    detail = client.get(
        "/api/query/known-cases/case-2024-06",
        params={**QUERY, "library_version": data["library_version"]},
    )
    assert detail.status_code == 200
    value = detail.json()
    assert value["search_id"] == data["search_id"]
    assert value["original"]["metrics"]["total_hours"] == 10
    assert value["original"]["metrics"]["area_time_km2_days"] == 2
    assert value["original"]["metrics"]["density_hours_per_km2_day"] == 5
    assert value["original"]["result_id"] == data["candidates"][0]["source_result_id"]
    assert value["case"]["response_status"] == "not_event_response"
    assert value["research_ready"] is False
    assert client.post("/api/query/known-cases", json=QUERY).status_code == 405


def controlled(tmp_path):
    original = Path(__file__).parents[1] / "app/examples"
    catalog = tmp_path / "catalog.json"
    source = tmp_path / "snapshots.json"
    shutil.copyfile(original / "known-case-catalog.json", catalog)
    shutil.copyfile(original / "g3-known-snapshots.json", source)
    isolated = FastAPI()
    isolated.include_router(create_known_case_router(catalog_path=catalog, snapshots_path=source))
    return TestClient(isolated), catalog, source


def test_pagination_keeps_query_version_and_never_repeats_or_exposes_protected_cases():
    client = TestClient(app)
    first = client.get("/api/query/known-cases", params=QUERY).json()
    second = client.get(
        "/api/query/known-cases",
        params={**QUERY, "offset": 3, "library_version": first["library_version"]},
    ).json()
    assert second["search_id"] == first["search_id"]
    assert [c["case_id"] for c in second["candidates"]] == ["case-2023-02"]
    assert second["next_offset"] is None and second["total"] == 4
    assert client.get("/api/query/known-cases", params={**QUERY, "offset": 3}).status_code == 422
    later = {**QUERY, "reference_date": "2025-01-01"}
    data = client.get("/api/query/known-cases", params=later).json()
    assert data["total"] == 5
    for case_id in ["case-2024-07", "case-2024-08", "unregistered"]:
        r = client.get(
            "/api/query/known-cases/" + case_id,
            params={**later, "library_version": data["library_version"]},
        )
        assert r.status_code == 404 and r.headers["cache-control"] == "no-store"
        assert case_id not in r.text


def test_valid_zero_and_unknown_A_are_not_zero_event_responses():
    client = TestClient(app)
    q = {**QUERY, "reference_date": "2025-01-01"}
    version = client.get("/api/query/known-cases", params=q).json()["library_version"]
    zero = client.get(
        "/api/query/known-cases/case-2023-08", params={**q, "library_version": version}
    ).json()
    missing = client.get(
        "/api/query/known-cases/case-2024-12", params={**q, "library_version": version}
    ).json()
    assert zero["original"]["metrics"]["total_hours"] == 0
    assert missing["original"]["metrics"]["total_hours"] is None
    assert missing["original"]["metrics"]["area_time_km2_days"] is None
    assert (
        zero["case"]["response_status"]
        == missing["case"]["response_status"]
        == "not_event_response"
    )
    assert missing["original"]["daily"][0]["state"] == "missing"


def test_changed_library_refuses_old_page_and_detail_instead_of_mixing_versions(tmp_path):
    client, catalog, source = controlled(tmp_path)
    first = client.get("/api/query/known-cases", params=QUERY).json()
    pack = json.loads(source.read_text(encoding="utf-8"))
    index = json.loads(catalog.read_text(encoding="utf-8"))
    entry = next(e for e in pack["snapshots"] if e["result"]["parameters"]["month"] == "2024-06")
    entry["result"]["daily"][0]["hours"] = 20
    entry["result"]["metrics"].update(
        total_hours=20, mean_hours_per_supported_day=20, density_hours_per_km2_day=10
    )
    entry["snapshot_sha256"] = content_id(entry["result"])
    next(e for e in index["entries"] if e["case_id"] == "case-2024-06")["snapshot_sha256"] = entry[
        "snapshot_sha256"
    ]
    source.write_text(json.dumps(pack), encoding="utf-8")
    catalog.write_text(json.dumps(index), encoding="utf-8")
    assert (
        client.get(
            "/api/query/known-cases",
            params={**QUERY, "offset": 3, "library_version": first["library_version"]},
        ).status_code
        == 409
    )
    assert (
        client.get(
            "/api/query/known-cases/case-2024-06",
            params={**QUERY, "library_version": first["library_version"]},
        ).status_code
        == 409
    )
    new = client.get("/api/query/known-cases", params=QUERY).json()
    assert new["library_version"] != first["library_version"]
    assert [c["case_id"] for c in new["candidates"]] == [c["case_id"] for c in first["candidates"]]


@pytest.mark.parametrize(
    "field,value",
    [
        ("access", "owner_only"),
        ("collection", "validation_holdout"),
        ("evidence_kind", "real"),
        ("public_aggregate_allowed", False),
    ],
)
def test_catalog_access_gate_controls_search_count_and_direct_reads(tmp_path, field, value):
    client, catalog, _ = controlled(tmp_path)
    data = json.loads(catalog.read_text(encoding="utf-8"))
    for entry in data["entries"]:
        entry[field] = value
    catalog.write_text(json.dumps(data), encoding="utf-8")
    search = client.get("/api/query/known-cases", params=QUERY).json()
    assert (
        search["total"] == search["scope"]["public_case_count"] == 0 and search["candidates"] == []
    )
    assert (
        client.get(
            "/api/query/known-cases/case-2024-06",
            params={**QUERY, "library_version": search["library_version"]},
        ).status_code
        == 404
    )


def test_source_private_flags_and_payloads_never_leak_in_counts_or_detail(tmp_path):
    client, _, source = controlled(tmp_path)
    data = json.loads(source.read_text(encoding="utf-8"))
    for entry in data["snapshots"]:
        entry["access"] = "owner_only"
        entry["result"]["source"]["id"] = "PRIVATE_MARKER"
        entry["result"]["private_payload"] = "PRIVATE_MARKER"
    source.write_text(json.dumps(data), encoding="utf-8")
    search = client.get("/api/query/known-cases", params=QUERY)
    assert search.json()["total"] == search.json()["scope"]["public_case_count"] == 0
    detail = client.get(
        "/api/query/known-cases/case-2024-06",
        params={**QUERY, "library_version": search.json()["library_version"]},
    )
    assert detail.status_code == 404
    assert "PRIVATE_MARKER" not in search.text + detail.text


def test_unsupported_exact_circle_empty_history_and_corrupt_registry_are_distinct(tmp_path):
    client, _, source = controlled(tmp_path)
    unsupported = client.get("/api/query/known-cases", params={**QUERY, "longitude": 124.6}).json()
    empty = client.get(
        "/api/query/known-cases", params={**QUERY, "reference_date": "2020-01-01"}
    ).json()
    assert unsupported["status"] == "unsupported_condition" and empty["status"] == "empty"
    # A full June background is excluded on its final day, without inventing an event anchor.
    data = client.get(
        "/api/query/known-cases", params={**QUERY, "reference_date": "2024-06-30"}
    ).json()
    assert "case-2024-06" not in [c["case_id"] for c in data["candidates"]]
    source.write_text("{bad json", encoding="utf-8")
    response = client.get("/api/query/known-cases", params=QUERY)
    assert response.status_code == 503 and str(source) not in response.text


@pytest.mark.parametrize(
    "override",
    [
        {"reference_date": "2024-02-30"},
        {"longitude": 181},
        {"radius_km": 15},
        {"library_id": "private"},
        {"case_type": "fixed_region_event"},
        {"path": "private.json"},
    ],
)
def test_unknown_library_types_paths_and_invalid_conditions_cannot_select_other_sources(override):
    assert (
        TestClient(app).get("/api/query/known-cases", params={**QUERY, **override}).status_code
        == 422
    )
