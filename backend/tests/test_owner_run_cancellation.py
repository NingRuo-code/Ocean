"""Authoritative cancellation through the owner API and actual distance worker."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic, sleep

from test_monthly_distance_reference import AUTH, URL
from test_monthly_execution_qualification import configured_client, fixture

from app import monthly_distance_process, synthetic_runs

RUNS = URL + "/owner-runs"
PURPOSE = {"purpose": "monthly_distance_reference"}


def qualified_owner(tmp_path):
    _, reference, request, _ = fixture(tmp_path)
    client = configured_client(tmp_path / "support.json", reference, run_store=tmp_path / "runs.sqlite3")
    body = {"intent_id": "a" * 32, "input_sha256": request["input_version"], "request": request}
    path = RUNS + "/intents/" + body["intent_id"]
    return client, body, path


def test_cancel_requires_owner_and_does_not_change_an_already_completed_run(tmp_path):
    client, body, path = qualified_owner(tmp_path)
    frozen = client.post(RUNS, headers=AUTH, json=body)
    assert frozen.status_code == 200, frozen.text
    frozen = frozen.json()
    assert frozen["state"] == "completed"
    assert client.post(path + "/cancel").status_code == 401
    assert client.post(RUNS + "/intents/" + "f" * 32 + "/cancel", headers=AUTH).status_code == 404
    for _ in range(2):
        response = client.post(path + "/cancel", headers=AUTH)
        assert response.status_code == 200, response.text
        assert response.json() == {
            "schema_version": "ocean-owner-distance-cancel/v1",
            "intent_id": body["intent_id"],
            "run_id": frozen["id"],
            "state": "completed",
        }
    assert client.get(path, params=PURPOSE, headers=AUTH).json() == frozen


def test_cancel_a_live_calculation_confirms_process_exit_before_terminal_record(tmp_path, monkeypatch):
    client, body, path = qualified_owner(tmp_path)
    started = Event()
    children = []
    spawn = monthly_distance_process.Popen

    def track(*args, **kwargs):
        child = spawn(*args, **kwargs)
        children.append(child)
        started.set()
        return child

    monkeypatch.setattr(monthly_distance_process, "Popen", track)
    with client, ThreadPoolExecutor(max_workers=1) as pool:
        submission = pool.submit(client.post, RUNS, headers=AUTH, json=body)
        assert started.wait(12), "The controlled distance engine did not start"
        assert client.post(path + "/cancel").status_code == 401
        answer = client.post(path + "/cancel", headers=AUTH).json()
        assert answer["state"] == "cancelling"
        assert answer["run_id"] is None
        finished = submission.result(timeout=20)
        assert finished.status_code == 200, finished.text
        frozen = finished.json()
        assert len(children) == 1 and children[0].poll() is not None
        assert frozen["state"] == "failed"
        assert frozen["cancelled"] is True
        assert "failure_reason" not in frozen
        assert frozen["result"] is None
        cancelled = client.post(path + "/cancel", headers=AUTH).json()
        assert cancelled["state"] == "cancelled"
        assert cancelled["run_id"] == frozen["id"]
        assert client.get(path, params=PURPOSE, headers=AUTH).json() == frozen
        assert client.post(RUNS, headers=AUTH, json=body).json() == frozen
        assert len(children) == 1



def test_cancel_while_waiting_for_store_prevents_a_second_calculation(tmp_path, monkeypatch):
    client, body, _ = qualified_owner(tmp_path)
    queued = {**body, "intent_id": "b" * 32}
    queued_path = RUNS + "/intents/" + queued["intent_id"]
    ready, release = Event(), Event()
    invocations = []
    calculate = synthetic_runs.calculate_distance_reference

    def pause_first_result(*args):
        invocations.append(True)
        result = calculate(*args)
        ready.set()
        assert release.wait(10)
        return result

    monkeypatch.setattr(synthetic_runs, "calculate_distance_reference", pause_first_result)
    with client, ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(client.post, RUNS, headers=AUTH, json=body)
        try:
            assert ready.wait(12), "the first real calculation did not reach the commit pause"
            second = pool.submit(client.post, RUNS, headers=AUTH, json=queued)
            deadline = monotonic() + 5
            cancel = client.post(queued_path + "/cancel", headers=AUTH)
            while cancel.status_code == 404 and monotonic() < deadline:
                sleep(0.03)
                cancel = client.post(queued_path + "/cancel", headers=AUTH)
            assert cancel.status_code == 200, cancel.text
            assert cancel.json()["state"] == "cancelling"
        finally:
            release.set()
        assert first.result(15).json()["state"] == "completed"
        cancelled = second.result(15).json()
        assert cancelled["cancelled"] is True
        assert cancelled["result"] is None
        assert len(invocations) == 1


def test_cancellation_after_publication_decision_cannot_discard_a_complete_result(tmp_path, monkeypatch):
    client, body, path = qualified_owner(tmp_path)
    publishing, release = Event(), Event()
    begin = monthly_distance_process.DistanceRunControl.begin_publication

    def pause_publication(control):
        should_publish = begin(control)
        publishing.set()
        assert release.wait(10)
        return should_publish

    monkeypatch.setattr(monthly_distance_process.DistanceRunControl, "begin_publication", pause_publication)
    with client, ThreadPoolExecutor(max_workers=1) as pool:
        submission = pool.submit(client.post, RUNS, headers=AUTH, json=body)
        try:
            assert publishing.wait(12), "the real calculation did not reach publication"
            cancel = client.post(path + "/cancel", headers=AUTH)
            assert cancel.status_code == 200
            assert cancel.json()["state"] == "finishing"
            assert cancel.json()["run_id"] is None
        finally:
            release.set()
        completed = submission.result(15).json()
        assert completed["state"] == "completed"
        assert completed["result"] is not None
        assert client.post(path + "/cancel", headers=AUTH).json()["state"] == "completed"
        assert client.get(path, headers=AUTH, params=PURPOSE).json() == completed
