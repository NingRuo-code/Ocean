"""Cancellation for the isolated monthly distance calculation process."""

from subprocess import PIPE, CompletedProcess, Popen, TimeoutExpired
from tempfile import TemporaryFile
from threading import Event, Lock
from time import monotonic


class DistanceExecutionCancelled(RuntimeError):
    """Raised only after the subprocess has ended, or before it starts."""


class DistanceRunControl:
    """Serialize the decision between a cancellation and publication."""

    def __init__(self):
        self.cancelled = Event()
        self._lock = Lock()
        self._publishing = False
        self._qualified = False

    def enable_cancellation(self):
        with self._lock:
            self._qualified = True

    def request_cancel(self):
        with self._lock:
            if not self._qualified:
                return "checking"
            if self._publishing and not self.cancelled.is_set():
                return "finishing"
            self.cancelled.set()
            return "cancelling"

    def begin_publication(self):
        with self._lock:
            self._publishing = True
            return not self.cancelled.is_set()


def run_cancellable_distance(command, raw, timeout, cancelled):
    if cancelled.is_set():
        raise DistanceExecutionCancelled

    # A temporary input file avoids blocking on a pipe write while checking for cancellation.
    with TemporaryFile() as source:
        source.write(raw)
        source.seek(0)
        if cancelled.is_set():
            raise DistanceExecutionCancelled
        with Popen(command, stdin=source, stdout=PIPE, stderr=PIPE) as child:
            deadline = monotonic() + timeout
            while True:
                if cancelled.is_set():
                    child.kill()
                    child.communicate()
                    raise DistanceExecutionCancelled
                remaining = deadline - monotonic()
                if remaining <= 0:
                    child.kill()
                    stdout, stderr = child.communicate()
                    raise TimeoutExpired(command, timeout, output=stdout, stderr=stderr)
                try:
                    stdout, stderr = child.communicate(timeout=min(remaining, 0.1))
                except TimeoutExpired:
                    continue
                if cancelled.is_set():
                    raise DistanceExecutionCancelled
                result = CompletedProcess(command, child.returncode, stdout, stderr)
                result.check_returncode()
                return result
