"""Process behavior shared by the real distance engine and owner cancellation."""

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic, sleep

import pytest

from app.monthly_distance_process import (
    DistanceExecutionCancelled,
    DistanceRunControl,
    run_cancellable_distance,
)


def command(script, *args):
    return [sys.executable, "-B", "-c", script, *map(str, args)]


def test_cancellable_process_reads_the_unmodified_engine_input():
    raw = b'a' * (2 * 1024 * 1024) + b'\r\n\x00'
    child = run_cancellable_distance(
        command("import sys;sys.stdout.buffer.write(sys.stdin.buffer.read())"),
        raw, 5, Event(),
    )
    assert child.stdout == raw
    assert child.stderr == b""


def test_process_error_keeps_the_engine_diagnostic():
    with pytest.raises(subprocess.CalledProcessError) as error:
        run_cancellable_distance(
            command("import sys;sys.stderr.buffer.write(b'qualification_mismatch');sys.exit(7)"),
            b"", 5, Event(),
        )
    assert error.value.returncode == 7
    assert error.value.stderr == b"qualification_mismatch"


def test_cancellation_interrupts_the_started_child_and_withholds_its_output(tmp_path):
    started = tmp_path / "started"
    output = tmp_path / "output"
    cancel = Event()
    script = (
        "import pathlib,sys,time;"
        "pathlib.Path(sys.argv[1]).touch();time.sleep(6);"
        "pathlib.Path(sys.argv[2]).write_text('late result',encoding='utf-8')"
    )
    with ThreadPoolExecutor(max_workers=1) as pool:
        running = pool.submit(run_cancellable_distance, command(script, started, output), b"", 8, cancel)
        deadline = monotonic() + 5
        while not started.exists() and monotonic() < deadline:
            sleep(0.02)
        assert started.exists(), "real process did not start"
        cancel.set()
        with pytest.raises(DistanceExecutionCancelled):
            running.result(timeout=3)
    assert not output.exists()


def test_already_cancelled_work_never_starts(tmp_path):
    started = tmp_path / "started"
    cancel = Event()
    cancel.set()
    with pytest.raises(DistanceExecutionCancelled):
        run_cancellable_distance(
            command("import pathlib,sys;pathlib.Path(sys.argv[1]).touch()", started), b"", 5, cancel,
        )
    assert not started.exists()


def test_running_child_retains_the_existing_time_limit():
    with pytest.raises(subprocess.TimeoutExpired):
        run_cancellable_distance(command("import time;time.sleep(6)"), b"", 0.15, Event())



def test_cancellation_wins_before_publication_and_remains_idempotent():
    run = DistanceRunControl()
    assert run.request_cancel() is True
    assert run.begin_publication() is False
    assert run.request_cancel() is True


def test_publication_prevents_a_late_cancellation_from_changing_the_outcome():
    run = DistanceRunControl()
    assert run.begin_publication() is True
    assert run.request_cancel() is False
    assert not run.cancelled.is_set()
