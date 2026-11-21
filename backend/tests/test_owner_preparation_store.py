"""The bounded preparation slot and ownership contract do not require an archive file."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app import owner_preparation_store
from app.owner_preparation import run_front_day
from app.owner_preparation_store import LEASE_SECONDS, PreparationStore, task_status
from app.synthetic_run_store import RunStoreError


def test_concurrent_identical_preparation_intents_share_one_record(tmp_path):
    store = PreparationStore(tmp_path / "preparation.sqlite3")
    submission = {"intent_id": "a" * 32}
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(store.accept, submission, {})
        second = pool.submit(store.accept, submission, {})
        receipts = [first.result(), second.result()]
    assert sorted(created for _, created in receipts) == [False, True]
    assert receipts[0][0]["id"] == receipts[1][0]["id"]
    with pytest.raises(RunStoreError, match="busy"):
        store.accept({"intent_id": "b" * 32}, {})


def test_expired_preparation_cannot_publish_or_block_a_new_intent(tmp_path, monkeypatch):
    class Clock(datetime):
        current = datetime(2026, 1, 1, tzinfo=UTC)

        @classmethod
        def now(cls, tz=None):
            return cls.current

    monkeypatch.setattr(owner_preparation_store, "datetime", Clock)
    store = PreparationStore(tmp_path / "preparation.sqlite3")
    request = {"intent_id": "a" * 32, "plan_id": "old", "request": {}}
    first, started = store.accept(request, {})
    assert started and store.transition(first["id"], "processing")
    Clock.current += timedelta(seconds=LEASE_SECONDS)
    _, second_started = store.accept({"intent_id": "b" * 32}, {})
    assert second_started
    expired = task_status(store.read(first["id"]))
    assert expired["error"] == "worker_interrupted"
    assert not store.transition(first["id"], "validating")
    assert task_status(store.read(first["id"])) == expired


def test_worker_timeout_is_capped_by_remaining_acceptance_lease(tmp_path, monkeypatch):
    import subprocess

    seen = []

    def observe(command, **options):
        seen.append(options["timeout"])
        raise subprocess.TimeoutExpired(command, options["timeout"])

    monkeypatch.setattr(subprocess, "run", observe)
    registered = {"date": "2024-08-05", "raw_sha256": "0" * 64, "bbox": [120, 27, 128, 34],
                  "registration": {"processor_id": "sha256:" + "1" * 64}}
    settings = SimpleNamespace(raw_data_dir=tmp_path)
    close = (datetime.now(UTC) + timedelta(seconds=8)).isoformat()
    with pytest.raises(subprocess.TimeoutExpired):
        run_front_day(settings, registered, close)
    assert 0 < seen[0] <= 6
    expired = (datetime.now(UTC) - timedelta(seconds=2)).isoformat()
    with pytest.raises(subprocess.TimeoutExpired):
        run_front_day(settings, registered, expired)
    assert len(seen) == 1
