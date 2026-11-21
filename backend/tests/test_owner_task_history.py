"""The task history reads the existing owner stores with bounded filters."""

from datetime import UTC, datetime

from test_monthly_distance_reference import AUTH, URL
from test_monthly_execution_qualification import configured_client, fixture

from app import synthetic_run_store
from app.monthly_models import MonthlyDistanceRequest
from app.synthetic_run_store import RunStore

RUNS = URL + "/owner-runs"
HISTORY = RUNS + "/history"


def test_existing_owner_records_are_sorted_filtered_and_paged(tmp_path, monkeypatch):
    _, reference, distance_request, _ = fixture(tmp_path)
    distance_path = tmp_path / "distance.sqlite3"
    legacy_path = tmp_path / "legacy.sqlite3"
    client = configured_client(tmp_path / "support.json", reference, run_store=distance_path, legacy_store=legacy_path)
    today = datetime(2026, 10, 3, tzinfo=UTC)

    class HistoryClock:
        @staticmethod
        def now(_zone):
            return today

    monkeypatch.setattr(synthetic_run_store, "datetime", HistoryClock)
    options = client.get(RUNS + "/options", headers=AUTH).json()
    known = {key: options["conditions"][0][key] for key in ("month", "longitude", "latitude", "radius_km")}
    legacy = client.post(RUNS, headers=AUTH, json={
        "intent_id": "a" * 32,
        "input_sha256": options["input_sha256"],
        "request": {**known, "purpose": "monthly_spatial_example",
                    **{key: options[key] for key in ("input_version", "method_version", "parameter_version")}},
    })
    assert legacy.status_code == 200
    legacy_id = legacy.json()["id"]
    projected = MonthlyDistanceRequest.model_validate(distance_request).model_dump()
    qualification = {"snapshot_id": projected["support_snapshot_id"], "scope": "frozen_synthetic_validation"}
    store = RunStore(distance_path, qualified_distance=True)
    seeded = []
    for day, code in [(1, "execution_timed_out"), (2, "execution_cancelled"), (4, "calculation_failed")]:
        today = datetime(2026, 10, day, tzinfo=UTC)
        parent = store.submit(
            {"intent_id": str(day) * 32, "input_sha256": projected["input_version"], "request": projected},
            lambda code=code: (None, {"code": code}), qualification=qualification,
        )
        seeded.append(parent)

    assert client.get(HISTORY).status_code == 401
    first = client.get(HISTORY, headers=AUTH, params={"limit": 2})
    assert first.status_code == 200, first.text
    assert first.headers["cache-control"] == "no-store"
    page = first.json()
    assert page["schema_version"] == "ocean-owner-task-history/v1"
    assert page["total"] == 4
    assert page["next_offset"] == 2
    assert [run["id"] for run in page["runs"]] == [seeded[2]["id"], legacy_id]
    assert all("result" not in run for run in page["runs"])
    next_query = {"limit": 2, "offset": page["next_offset"], "history_id": page["history_id"]}
    second = client.get(HISTORY, headers=AUTH, params=next_query).json()
    assert [run["id"] for run in second["runs"]] == [seeded[1]["id"], seeded[0]["id"]]
    assert second["next_offset"] is None

    query = {"purpose": "monthly_distance_reference", "status": "cancelled",
             "start_date": "2026-10-02", "end_date": "2026-10-02"}
    filtered = client.get(HISTORY, headers=AUTH, params=query).json()
    assert filtered["total"] == 1
    assert filtered["runs"][0]["id"] == seeded[1]["id"]
    assert filtered["runs"][0]["status"] == "cancelled"
    interrupted = client.get(HISTORY, headers=AUTH, params={"status": "interrupted"}).json()
    assert [run["id"] for run in interrupted["runs"]] == [seeded[0]["id"]]
    assert client.get(HISTORY, headers=AUTH, params={"limit": 200}).status_code == 422
    assert client.get(HISTORY, headers=AUTH, params={"start_date": "2026-10-04", "end_date": "2026-10-02"}).status_code == 422
    assert len(client.get(RUNS, params={"purpose": "monthly_distance_reference"}, headers=AUTH).json()["runs"]) == 3
    today = datetime(2026, 10, 5, tzinfo=UTC)
    store.submit(
        {"intent_id": "5" * 32, "input_sha256": projected["input_version"], "request": projected},
        lambda: (None, {"code": "calculation_failed"}), qualification=qualification,
    )
    assert client.get(HISTORY, headers=AUTH, params=next_query).status_code == 409
    refreshed = client.get(HISTORY, headers=AUTH, params={"limit": 2}).json()
    assert refreshed["total"] == 5
    assert refreshed["history_id"] != page["history_id"]
