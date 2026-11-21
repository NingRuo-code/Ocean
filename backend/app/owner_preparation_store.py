"""Persistent states for small, private owner archive preparation."""

import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from .analysis_support import content_id, decode_controlled_json
from .synthetic_run_store import RunStore, RunStoreError

SCHEMA = "ocean-owner-preparation-task/v1"
STAGES = ("accepted", "processing", "validating", "registering", "ready")
LEASE_SECONDS = 60
RECORD_LIMIT = 1_048_576
ERRORS = {"processing_failed", "evidence_changed", "worker_interrupted"}


def checked_artifact(artifact, expected):
    value = dict(artifact)
    digest = value.pop("artifact_id")
    if (content_id(value) != digest or value["schema_version"] != "ocean-owner-front-display-artifact/v1"
            or value["scope"] != "private_map_display" or value["research_ready"] is not False
            or value["product"] != "zenodo-20356239" or value["license"] != "CC BY 4.0"
            or value["raw_sha256"] != expected["raw_sha256"] or value["date"] != expected["date"]
            or value["layer"] != "front" or value["bbox"] != expected["bbox"]
            or value["registration"] != expected["registration"]):
        raise ValueError("Prepared artifact failed its registration identity")
    return digest


class PreparationStore(RunStore):
    """Use the same owner intent and atomic SQLite receipt contract as the analysis runs."""

    def __init__(self, path):
        super().__init__(path)
        self.application_id = 0x4F505250
        self.schema = SCHEMA

    def checked(self, row):
        if row is None:
            raise RunStoreError("not_found")
        value = decode_controlled_json(row[3], RECORD_LIMIT)
        identity = value.pop("record_id")
        if (identity != content_id(value) or value["schema_version"] != SCHEMA
                or (value["id"], value["submission"]["intent_id"], content_id(value["submission"])) != row[:3]
                or value["owner_scope"] != "single_configured_owner"):
            raise RunStoreError("unavailable")
        state, stages = value["state"], value["state_history"]
        if state == "failed":
            if (len(stages) not in range(2, len(STAGES) + 1) or stages[:-1] != list(STAGES[:len(stages) - 1])
                    or stages[-1] != state or value["error"] not in ERRORS):
                raise RunStoreError("unavailable")
        elif (state not in STAGES or stages != list(STAGES[:STAGES.index(state) + 1])
              or value["error"] is not None):
            raise RunStoreError("unavailable")
        artifact = value["artifact"]
        if state == "ready":
            checked_artifact(artifact, value["expected"])
        elif artifact is not None:
            raise RunStoreError("unavailable")
        value["record_id"] = identity
        return value

    def accept(self, submission, expected):
        fingerprint = content_id(submission)
        with self.connection(write=True) as db:
            old = self.replay(db, submission["intent_id"], fingerprint)
            if old is not None:
                return old, False
            if db.execute("SELECT count(*) FROM runs").fetchone()[0] >= 64:
                raise RunStoreError("capacity")
            now = datetime.now(UTC)
            active_until = db.execute(
                "SELECT count(*) FROM runs WHERE json_extract(payload,'$.state') NOT IN ('ready', 'failed') "
                "AND json_extract(payload,'$.expires_at') > ?", (now.isoformat(),)
            ).fetchone()[0]
            if active_until:
                raise RunStoreError("busy")
            record = {
                "schema_version": SCHEMA, "id": uuid4().hex, "submission": submission, "expected": expected,
                "state": "accepted", "state_history": ["accepted"], "submitted_at": now.isoformat(),
                "expires_at": (now + timedelta(seconds=LEASE_SECONDS)).isoformat(),
                "owner_scope": "single_configured_owner", "artifact": None, "error": None,
            }
            raw = self.encode(record)
            db.execute("INSERT INTO runs VALUES(?,?,?,?)",
                       (record["id"], submission["intent_id"], fingerprint, raw))
            return record, True

    def transition(self, identity, next_state, *, artifact=None, error=None):
        with self.connection(write=True) as db:
            row = db.execute("SELECT id,intent,fingerprint,payload FROM runs WHERE id=?", (identity,)).fetchone()
            record = self.checked(row)
            state = record["state"]
            if state in {"ready", "failed"}:
                return False
            now = datetime.now(UTC).isoformat()
            if now >= record["expires_at"]:
                next_state, artifact, error = "failed", None, "worker_interrupted"
            if next_state != "failed" and next_state != STAGES[STAGES.index(state) + 1]:
                raise RunStoreError("unavailable")
            record.update(state=next_state, artifact=artifact, error=error)
            record["state_history"].append(next_state)
            raw = self.encode(record)
            self.checked((*row[:3], raw))
            db.execute("UPDATE runs SET payload=? WHERE id=?", (raw, identity))
            return next_state != "failed"

    @staticmethod
    def encode(record):
        record.pop("record_id", None)
        record["record_id"] = content_id(record)
        raw = json.dumps(record, allow_nan=False, separators=(",", ":"))
        if len(raw.encode("utf-8")) > RECORD_LIMIT:
            raise RunStoreError("unavailable")
        return raw


def task_status(record):
    state, stages, error = record["state"], record["state_history"], record["error"]
    if state not in {"ready", "failed"} and datetime.now(UTC).isoformat() >= record["expires_at"]:
        state, stages, error = "failed", [*stages, "failed"], "worker_interrupted"
    artifact = record["artifact"]
    return {
        "schema_version": SCHEMA, "id": record["id"], "intent_id": record["submission"]["intent_id"],
        "plan_id": record["submission"]["plan_id"], "request": record["submission"]["request"],
        "state": state, "state_history": stages, "error": error, "submitted_at": record["submitted_at"],
        "artifact": {key: artifact[key] for key in ("artifact_id", "date", "layer", "bbox", "support", "date_basis",
                                                    "cell_bounds_verified", "scope", "research_ready")}
        if artifact is not None else None,
    }
