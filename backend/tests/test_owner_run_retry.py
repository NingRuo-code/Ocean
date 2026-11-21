"""The explicit retry entry point preserves the original owned attempt."""

import json

from test_monthly_distance_reference import AUTH, URL
from test_monthly_execution_qualification import configured_client, encoded, fixture

from app import monthly_distance_reference, synthetic_runs
from app.synthetic_run_store import RunStore

RUNS = URL + "/owner-runs"
PURPOSE = {"purpose": "monthly_distance_reference"}


def failed_owner_attempt(tmp_path, monkeypatch):
    _, reference, request, _ = fixture(tmp_path)
    client = configured_client(tmp_path / "support.json", reference, run_store=tmp_path / "runs.sqlite3")
    first_body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    with monkeypatch.context() as shortened:
        shortened.setattr(monthly_distance_reference, "DISTANCE_EXECUTION_TIMEOUT_SECONDS", 0.01)
        response = client.post(RUNS, headers=AUTH, json=first_body)
    assert response.status_code == 200, response.text
    original = response.json()
    assert original["state"] == "failed"
    assert original["failure_reason"] == "execution_timed_out"
    return client, reference, original


def retry_body(parent, intent, request, mode, environment_id=None):
    return {
        "intent_id": intent,
        "input_sha256": request["input_version"],
        "request": request,
        "parent_record_id": parent["record_id"],
        "mode": mode,
        "execution_environment_id": environment_id or parent["execution_environment_id"],
    }


def test_retry_is_explicit_bound_to_the_original_failure_and_idempotent(tmp_path, monkeypatch):
    client, _, original = failed_owner_attempt(tmp_path, monkeypatch)
    parent = RUNS + "/" + original["id"]
    assert client.get(parent + "/retry-options").status_code == 401
    prepared = client.get(parent + "/retry-options", headers=AUTH)
    assert prepared.status_code == 200, prepared.text
    options = prepared.json()
    assert options["request"] == original["request"]
    assert options["input_sha256"] == original["input_sha256"]
    assert options["parent_record_id"] == original["record_id"]
    before = client.get(RUNS, params=PURPOSE, headers=AUTH).json()["runs"]
    assert [run["id"] for run in before] == [original["id"]]

    request_body = retry_body(original, "b" * 32, options["request"], "same_conditions")
    assert client.post(parent + "/retry", json=request_body).status_code == 401
    first = client.post(parent + "/retry", headers=AUTH, json=request_body)
    assert first.status_code == 200, first.text
    attempt = first.json()
    assert attempt["id"] != original["id"]
    assert attempt["state"] == "completed"
    assert attempt["retry"] == {
        "parent_run_id": original["id"],
        "parent_record_id": original["record_id"],
        "mode": "same_conditions",
    }
    assert client.post(parent + "/retry", headers=AUTH, json=request_body).json() == attempt
    plain = {key: request_body[key] for key in ("intent_id", "input_sha256", "request")}
    assert client.post(RUNS, headers=AUTH, json=plain).status_code == 409
    assert client.get(RUNS + "/" + attempt["id"] + "/retry-options", headers=AUTH).status_code == 409
    assert client.get(parent, params=PURPOSE, headers=AUTH).json() == original
    assert {run["id"] for run in client.get(RUNS, params=PURPOSE, headers=AUTH).json()["runs"]} == {
        original["id"], attempt["id"],
    }
    with monkeypatch.context() as shortened:
        shortened.setattr(monthly_distance_reference, "DISTANCE_EXECUTION_TIMEOUT_SECONDS", 0.01)
        later = client.post(parent + "/retry", headers=AUTH, json={**request_body, "intent_id": "c" * 32})
    assert later.status_code == 200
    assert later.json()["failure_reason"] == "execution_timed_out"
    assert later.json()["retry"]["parent_run_id"] == original["id"]
    assert client.get(RUNS + "/" + attempt["id"], params=PURPOSE, headers=AUTH).json() == attempt


def test_original_retry_does_not_replace_evidence_with_the_current_registered_version(tmp_path, monkeypatch):
    client, reference, original = failed_owner_attempt(tmp_path, monkeypatch)
    parent = RUNS + "/" + original["id"]
    changed = json.loads(reference.read_bytes())
    changed["front_position_error_km"] = 0.27
    reference.write_bytes(encoded(changed))

    previous = retry_body(original, "c" * 32, original["request"], "same_conditions")
    assert client.get(parent + "/retry-options", headers=AUTH).status_code == 409
    assert client.post(parent + "/retry", headers=AUTH, json=previous).status_code == 409
    relabelled = {**previous, "mode": "current_conditions"}
    assert client.post(parent + "/retry", headers=AUTH, json=relabelled).status_code == 409
    assert client.get(RUNS + "/intents/" + previous["intent_id"], headers=AUTH, params=PURPOSE).status_code == 404

    conditions = {key: original["request"][key] for key in ("month", "longitude", "latitude", "radius_km", "layer_use")}
    response = client.get(RUNS + "/distance-options", headers=AUTH, params=conditions)
    assert response.status_code == 200, response.text
    current = response.json()["request"]
    environment_id = response.json()["execution_environment_id"]
    assert current["input_version"] != original["request"]["input_version"]
    changed_body = retry_body(original, "d" * 32, current, "current_conditions", environment_id)
    wrong_parent = {**changed_body, "parent_record_id": "sha256:" + "f" * 64}
    assert client.post(parent + "/retry", headers=AUTH, json=wrong_parent).status_code == 409
    accepted = client.post(parent + "/retry", headers=AUTH, json=changed_body)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["state"] == "completed"
    assert accepted.json()["retry"]["mode"] == "current_conditions"
    assert accepted.json()["input_sha256"] == current["input_version"]
    assert client.get(parent, headers=AUTH, params=PURPOSE).json() == original


def test_runtime_change_requires_a_separate_prepared_attempt(tmp_path, monkeypatch):
    client, _, original = failed_owner_attempt(tmp_path, monkeypatch)
    parent = RUNS + "/" + original["id"]
    original_environment = original["execution_environment_id"]
    original_sources = synthetic_runs.distance_execution_sources

    def changed_engine_sources():
        sources = original_sources()
        sources["compute_monthly_distance.py"] += b"\n# different registered engine build\n"
        return sources

    monkeypatch.setattr(synthetic_runs, "distance_execution_sources", changed_engine_sources)
    assert client.get(parent + "/retry-options", headers=AUTH).status_code == 409
    conditions = {key: original["request"][key] for key in ("month", "longitude", "latitude", "radius_km", "layer_use")}
    current = client.get(RUNS + "/distance-options", headers=AUTH, params=conditions).json()
    assert current["request"] == original["request"]
    assert current["execution_environment_id"] != original_environment

    wrong = retry_body(original, "d" * 32, current["request"], "current_conditions", original_environment)
    assert client.post(parent + "/retry", headers=AUTH, json=wrong).status_code == 409
    updated = {**wrong, "execution_environment_id": current["execution_environment_id"]}
    accepted = client.post(parent + "/retry", headers=AUTH, json=updated)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["execution_environment_id"] == current["execution_environment_id"]
    assert client.get(parent, headers=AUTH, params=PURPOSE).json() == original


def test_older_failure_keeps_a_current_conditions_path_when_original_runtime_is_unknown(tmp_path, monkeypatch):
    client, _, original = failed_owner_attempt(tmp_path, monkeypatch)
    store = RunStore(tmp_path / "runs.sqlite3", qualified_distance=True)
    record = store.submit(
        {"intent_id": "b" * 32, "input_sha256": original["input_sha256"], "request": original["request"]},
        lambda: (None, {"code": "execution_timed_out"}),
        qualification=original["qualification"],
    )
    parent = RUNS + "/" + record["id"]
    assert "execution_environment_id" not in record
    assert client.get(parent + "/retry-options", headers=AUTH).status_code == 409
    current = retry_body(record, "c" * 32, record["request"], "current_conditions",
                         original["execution_environment_id"])
    forbidden = client.post(parent + "/retry", headers=AUTH, json={**current, "mode": "same_conditions"})
    assert forbidden.status_code == 409
    accepted = client.post(parent + "/retry", headers=AUTH, json=current)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["retry"]["mode"] == "current_conditions"
    assert client.get(parent, headers=AUTH, params=PURPOSE).json() == record
