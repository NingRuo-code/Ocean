"""Bounded public status projection. No scans, preparation, execution or model probes."""

import os
import re
import stat
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from threading import Event, Lock, Thread
from time import monotonic

from fastapi import APIRouter, Request, Response

from .analysis_support import decode_controlled_json
from .comparison_models import SnapshotPack
from .published_months import PUBLISHED_PATH, project_public_month

POLICY = "ocean-light-status/1"
INTERVAL = 30
MAX_AGE = 90
DEADLINE = 2


def _read(path, limit):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
        raise ValueError("non_regular_input")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    with os.fdopen(fd, "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError("non_regular_input")
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("input_budget")
    return raw


def _dates(values):
    if not isinstance(values, list) or len(values) > 3660:
        raise ValueError("date_budget")
    days = sorted({date.fromisoformat(item).isoformat() for item in values})
    return {
        "registered_days": len(days),
        "start": days[0] if days else None,
        "end": days[-1] if days else None,
    }


def _map_index(path):
    text = _read(path, 65536).decode("utf-8")
    match = re.fullmatch(
        r"\s*(?:/\*.*?\*/\s*)?window\.OF_DATA_INDEX\s*=\s*(\{.*\})\s*;\s*", text, flags=re.DOTALL
    )
    if not match:
        raise ValueError("invalid_index")
    index = decode_controlled_json(match[1])
    generated = index.get("generated_at")
    if generated is not None:
        generated = date.fromisoformat(generated).isoformat()
    front, sst = _dates(index["days"]), _dates(index["sst"])
    registered = front["registered_days"] + sst["registered_days"]
    return {
        "state": "registered" if registered else "empty_registry",
        "front": front,
        "sst": sst,
        "generated_at": generated,
        "freshness": "historical_archive",
        "update_cadence": "unknown",
        "payload_integrity": "not_probed",
    }


def _published_read(path):
    pack = SnapshotPack.model_validate(decode_controlled_json(_read(path, 1048576)))
    results = [
        project_public_month(entry)
        for entry in pack.snapshots
        if entry.access == "public_aggregate"
        and entry.public_aggregate_allowed is True
        and entry.result.get("kind") == "monthly_spatial_example"
    ]
    return {
        "state": "readable_example" if results else "not_connected",
        "count": len(results),
        "evidence": "synthetic_only",
        "research_ready": False,
    }


def _fishing_index(path):
    manifest = decode_controlled_json(_read(path, 262144))
    days = manifest["days"]
    if not isinstance(days, list) or len(days) > 3660:
        raise ValueError("date_budget")
    dates = _dates([item["date"] for item in days])
    return {
        "state": "registered" if dates["registered_days"] else "empty_registry",
        "dates": dates,
        "payload_integrity": "not_probed",
        "research_ready": False,
        "freshness": "unknown",
        "update_cadence": "unknown",
    }


@dataclass
class _Sample:
    started_at: datetime
    deadline: float
    done: Event = field(default_factory=Event)
    layers: dict = field(default_factory=dict)
    published: bool = False
    expired: bool = False


def create_status_router(settings, *, now=None, published_path=PUBLISHED_PATH):
    """At most one daemon sampler and one snapshot; response waits at most two seconds."""
    now = now or (lambda: datetime.now(UTC))
    router = APIRouter()
    lock = Lock()
    cached = None
    active = None
    successes = {}
    readers = {
        "map_index": lambda: _map_index(settings.prototype_data_dir / "days.js"),
        "published_read": lambda: _published_read(published_path),
        "fishing_effort": lambda: _fishing_index(settings.raw_data_dir / "fishing/manifest.json"),
    }

    def sample(job):
        try:
            for name, read in readers.items():
                with lock:
                    if job.expired or monotonic() >= job.deadline:
                        break
                try:
                    layer = read()
                except FileNotFoundError:
                    layer = {"state": "not_connected", "reason": "metadata_absent"}
                except (
                    OSError,
                    ValueError,
                    TypeError,
                    KeyError,
                    ArithmeticError,
                    AttributeError,
                    RecursionError,
                ):
                    layer = {"state": "read_failed", "reason": "metadata_unreadable_or_invalid"}
                with lock:
                    if not job.expired and monotonic() <= job.deadline:
                        job.layers[name] = layer
        finally:
            job.done.set()

    def publish(job, app):
        stamp = job.started_at.isoformat()
        layers = {
            name: {"state": "not_connected", "last_success_at": None}
            for name in ("proxy", "p0_qualification", "tasks", "backups")
        }
        layers["process"] = {"state": "responding", "last_success_at": stamp}
        for name in readers:
            layer = job.layers.get(name, {"state": "read_failed", "reason": "sampling_deadline"})
            if layer["state"] in {"registered", "readable_example"}:
                successes[name] = stamp
            layers[name] = {**layer, "last_success_at": successes.get(name)}
        job.expired = len(job.layers) != len(readers)
        job.published = True
        identity = getattr(app.state, "release_identity", None)
        release = (
            {key: identity[key] for key in ("release_id", "source_commit", "profile")}
            if identity
            else None
        )
        isolated = release is not None and release["profile"] == "isolated-read-only/v1"
        layers["analysis_execution"] = {
            "state": "disabled_by_profile" if isolated else "not_probed",
            "last_success_at": None,
        }
        layers["models"] = {
            "state": "disabled_by_profile"
            if isolated
            else "rules_only"
            if settings.ai_provider == "rules"
            else "not_probed",
            "last_success_at": None,
        }
        return {
            "schema": "ocean-operational-status/v1",
            "policy_version": POLICY,
            "sampled_at": stamp,
            "sample_age_seconds": 0,
            "sample_state": "timed_out" if job.expired else "fresh",
            "min_interval_seconds": INTERVAL,
            "max_age_seconds": MAX_AGE,
            "sampling_deadline_seconds": DEADLINE,
            "scope": "this_process",
            "release": release,
            "overall": "partial",
            "layers": layers,
        }

    def current():
        age = max(0, (now() - datetime.fromisoformat(cached["sampled_at"])).total_seconds())
        return {
            **cached,
            "sample_age_seconds": age,
            "sample_state": "timed_out" if cached["sample_state"] == "timed_out" else "cached",
        }

    @router.get(settings.api_prefix + "/status")
    def status(request: Request, response: Response):
        nonlocal cached, active
        response.headers["Cache-Control"] = "no-store"
        instant = now()
        with lock:
            if active is not None and active.done.is_set():
                if not active.published:
                    cached = publish(active, request.app)
                active = None
            age = (
                (instant - datetime.fromisoformat(cached["sampled_at"])).total_seconds()
                if cached
                else None
            )
            if cached is not None and age < INTERVAL:
                return current()
            if active is None:
                active = _Sample(instant, monotonic() + DEADLINE)
                Thread(
                    target=sample, args=(active,), daemon=True, name="ocean-light-status"
                ).start()
            job = active
            if job.published:
                return current()
        # Never hold the state lock while reading files or waiting for the sampler.
        job.done.wait(max(0, job.deadline - monotonic()))
        with lock:
            if not job.published:
                cached = publish(job, request.app)
            return current()

    return router
