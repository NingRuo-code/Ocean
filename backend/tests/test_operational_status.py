import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.operational_status import create_status_router


def client_for(tmp_path, **kwargs):
    data = tmp_path / "data"
    data.mkdir()
    (data / "days.js").write_text(
        "window.OF_DATA_INDEX = "
        + json.dumps(
            {
                "days": ["2024-02-28", "2024-02-29", "2024-03-01"],
                "sst": ["2024-02-29"],
                "generated_at": "2024-03-05",
            }
        )
        + ";",
        encoding="utf-8",
    )
    clock = [datetime(2026, 10, 27, 8, 0, tzinfo=UTC)]
    app = FastAPI()
    app.include_router(
        create_status_router(
            Settings(prototype_data_dir=data, raw_data_dir=tmp_path / "raw", _env_file=None),
            now=lambda: clock[0],
            **kwargs,
        )
    )
    return TestClient(app), data, clock


def test_original_status_distinguishes_historic_registration_from_research_readiness(tmp_path):
    client, data, _ = client_for(tmp_path)
    response = client.get("/api/status")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    value = response.json()
    assert value["schema"] == "ocean-operational-status/v1"
    assert value["layers"]["process"]["state"] == "responding"
    front = value["layers"]["map_index"]["front"]
    assert front == {"registered_days": 3, "start": "2024-02-28", "end": "2024-03-01"}
    assert value["layers"]["map_index"]["freshness"] == "historical_archive"
    assert value["layers"]["map_index"]["update_cadence"] == "unknown"
    assert value["layers"]["map_index"]["generated_at"] == "2024-03-05"
    for name in ("fishing_effort", "p0_qualification", "tasks", "backups", "proxy"):
        assert value["layers"][name]["state"] == "not_connected"
    assert value["layers"]["analysis_execution"]["state"] == "not_probed"
    assert value["release"] is None
    assert value["overall"] == "partial"
    assert str(data) not in response.text
    assert len(response.content) < 16384


def test_failed_resample_retains_last_success_and_never_publishes_old_index_as_ready(tmp_path):
    client, data, clock = client_for(tmp_path)
    first = client.get("/api/status").json()
    (data / "days.js").write_text("PRIVATE_INTERNAL_ERROR", encoding="utf-8")
    clock[0] += timedelta(seconds=29)
    cached = client.get("/api/status").json()
    assert cached["sample_state"] == "cached" and cached["sample_age_seconds"] == 29
    assert cached["sampled_at"] == first["sampled_at"]
    clock[0] += timedelta(seconds=1)
    broken = client.get("/api/status").json()
    layer = broken["layers"]["map_index"]
    assert layer["state"] == "read_failed"
    assert layer["last_success_at"] == first["sampled_at"]
    assert "front" not in layer and "PRIVATE" not in json.dumps(broken)
    (data / "days.js").unlink()
    clock[0] += timedelta(seconds=31)
    assert client.get("/api/status").json()["layers"]["map_index"]["state"] == "not_connected"


def test_invalid_calendar_and_oversized_metadata_fail_closed(tmp_path):
    client, data, clock = client_for(tmp_path)
    for text in (
        'window.OF_DATA_INDEX={"days":["2023-02-29"],"sst":[]};',
        'window.OF_DATA_INDEX={"days":[],"sst":[],"generated_at":"bad"};',
        'window.OF_DATA_INDEX={"days":[],"sst":[]};' + " " * 65536,
    ):
        (data / "days.js").write_text(text, encoding="utf-8")
        clock[0] += timedelta(seconds=31)
        result = client.get("/api/status").json()
        assert result["layers"]["map_index"]["state"] == "read_failed"
        assert result["layers"]["map_index"]["last_success_at"] is None


def test_index_with_no_registered_dates_is_not_reported_ready(tmp_path):
    client, data, _ = client_for(tmp_path)
    (data / "days.js").write_text(
        'window.OF_DATA_INDEX={"days":[],"sst":[]};',
        encoding="utf-8",
    )
    layer = client.get("/api/status").json()["layers"]["map_index"]
    assert layer["state"] == "empty_registry"
    assert layer["front"]["registered_days"] == 0
    assert layer["last_success_at"] is None


def test_published_read_verifies_actual_frozen_sample_and_does_not_infer_execution(tmp_path):
    path = tmp_path / "published.json"
    path.write_bytes(
        (Path(__file__).parents[1] / "app/examples/regional-known-snapshots.json").read_bytes()
    )
    client, _, clock = client_for(tmp_path, published_path=path)
    first = client.get("/api/status").json()
    assert first["layers"]["published_read"] == {
        "state": "readable_example",
        "count": 2,
        "evidence": "synthetic_only",
        "research_ready": False,
        "last_success_at": first["sampled_at"],
    }
    value = json.loads(path.read_text(encoding="utf-8"))
    value["snapshots"][0]["result"]["metrics"]["total_hours"] = 999
    path.write_text(json.dumps(value), encoding="utf-8")
    clock[0] += timedelta(seconds=31)
    bad = client.get("/api/status").json()
    assert bad["layers"]["published_read"]["state"] == "read_failed"
    assert bad["layers"]["published_read"]["last_success_at"] == first["sampled_at"]
    assert "count" not in bad["layers"]["published_read"]
    assert bad["layers"]["map_index"]["state"] == "registered"


def test_missing_sample_is_unknown_and_release_uses_only_installed_identity(tmp_path):
    client, _, _ = client_for(tmp_path, published_path=tmp_path / "absent.json")
    client.app.state.release_identity = {
        "release_id": "sha256:" + "a" * 64,
        "source_commit": "b" * 40,
        "profile": "isolated-read-only/v1",
        "PRIVATE_FIELD": "NOT_PUBLIC",
    }
    value = client.get("/api/status").json()
    assert value["layers"]["published_read"]["state"] == "not_connected"
    assert value["layers"]["models"]["state"] == "disabled_by_profile"
    assert value["layers"]["analysis_execution"]["state"] == "disabled_by_profile"
    assert value["release"]["source_commit"] == "b" * 40
    assert "PRIVATE" not in json.dumps(value)


def test_unreadable_and_nonregular_metadata_is_safe_failure(tmp_path, monkeypatch):
    import os

    client, data, clock = client_for(tmp_path)
    original = os.open

    def denied(path, *args, **kwargs):
        if Path(path) == data / "days.js":
            raise PermissionError("PRIVATE_HOST_AND_PATH")
        return original(path, *args, **kwargs)

    with monkeypatch.context() as scoped:
        scoped.setattr(os, "open", denied)
        result = client.get("/api/status")
        assert result.json()["layers"]["map_index"]["state"] == "read_failed"
        assert "PRIVATE" not in result.text
    (data / "days.js").unlink()
    (data / "days.js").mkdir()
    clock[0] += timedelta(seconds=31)
    assert client.get("/api/status").json()["layers"]["map_index"]["state"] == "read_failed"


def test_existing_effort_manifest_is_registration_not_validated_files_or_research(tmp_path):
    client, _, _ = client_for(tmp_path)
    folder = tmp_path / "raw" / "fishing"
    folder.mkdir(parents=True)
    (folder / "manifest.json").write_text(
        json.dumps(
            {
                "days": [{"date": "2024-02-29", "total_hours": 0, "PRIVATE_GRID": "SECRET"}],
                "private_host": "SECRET",
            }
        ),
        encoding="utf-8",
    )
    response = client.get("/api/status")
    layer = response.json()["layers"]["fishing_effort"]
    assert layer["state"] == "registered"
    assert layer["dates"] == {"registered_days": 1, "start": "2024-02-29", "end": "2024-02-29"}
    assert layer["payload_integrity"] == "not_probed"
    assert layer["research_ready"] is False
    assert "SECRET" not in response.text and "total_hours" not in response.text
