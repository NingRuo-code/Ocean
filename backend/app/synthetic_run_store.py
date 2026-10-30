"""Atomic terminal records for bounded synthetic submissions, never a job queue."""

import json
import os
import sqlite3
import stat
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .analysis_support import content_id, decode_controlled_json
from .monthly_models import MonthlyRequest

APPLICATION_ID = 0x4F52554E


class RunStoreError(Exception):
    pass


class RunStore:
    def __init__(self, path):
        self.path = Path(os.path.abspath(path)) if path is not None else None

    @contextmanager
    def connection(self, write=False):
        if self.path is None:
            raise RunStoreError("unavailable")
        try:
            for p in [*reversed(self.path.parents), self.path]:
                if not p.exists() and not p.is_symlink():
                    continue
                info = p.lstat()
                if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
                    raise RunStoreError("unavailable")
            if self.path.exists() and self.path.stat().st_size > 64 * 1024 * 1024:
                raise RunStoreError("unavailable")
            if write:
                self.path.parent.mkdir(parents=True, exist_ok=True)
            elif not self.path.exists():
                yield None
                return
            target = str(self.path) if write else self.path.as_uri() + "?mode=ro"
            with closing(sqlite3.connect(target, uri=not write, timeout=1, isolation_level=None)) as db:
                if write:
                    db.execute("BEGIN IMMEDIATE")
                app_id = db.execute("PRAGMA application_id").fetchone()[0]
                version = db.execute("PRAGMA user_version").fetchone()[0]
                if write and app_id == version == 0 and not db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
                    db.execute(f"PRAGMA application_id={APPLICATION_ID}")
                    db.execute("PRAGMA user_version=1")
                    db.execute("CREATE TABLE runs(id TEXT PRIMARY KEY, intent TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL)")
                    db.commit()
                    db.execute("BEGIN IMMEDIATE")
                elif app_id != APPLICATION_ID or version != 1:
                    raise RunStoreError("unavailable")
                if write:
                    page_size = db.execute("PRAGMA page_size").fetchone()[0]
                    db.execute(f"PRAGMA max_page_count={64 * 1024 * 1024 // page_size}")
                try:
                    yield db
                    if write:
                        db.commit()
                except BaseException:
                    if write:
                        db.rollback()
                    raise
        except (OSError, sqlite3.Error, ValueError, TypeError, KeyError, AttributeError, UnicodeError, RecursionError):
            raise RunStoreError("unavailable") from None

    def check_available(self):
        with self.connection() as db:
            if db is not None and db.execute("SELECT count(*) FROM runs").fetchone()[0] > 64:
                raise RunStoreError("unavailable")

    def checked(self, row):
        if row is None:
            raise RunStoreError("not_found")
        value = decode_controlled_json(row[3])
        identity = value.pop("record_id")
        if (identity != content_id(value) or value["id"] != row[0] or value["intent_id"] != row[1]
                or value["submission_id"] != row[2] or value["state"] not in {"completed", "failed"}):
            raise RunStoreError("unavailable")
        request = MonthlyRequest.model_validate(value["request"]).model_dump()
        if (value["schema_version"] != "ocean-owner-synthetic-run/v1"
                or content_id({"intent_id": value["intent_id"], "input_sha256": value["input_sha256"], "request": request}) != row[2]
                or value["state_history"] != ["accepted", value["state"]]
                or value["owner_scope"] != "single_configured_owner"):
            raise RunStoreError("unavailable")
        result = value["result"]
        if value["state"] == "completed":
            if (value["error"] is not None or result["parameters"] != request
                    or result["source"]["input_sha256"] != value["input_sha256"]
                    or result["evidence_kind"] != "synthetic_example" or result["research_ready"] is not False
                    or not result["source"]["license"].startswith("CC0-1.0")
                    or result["result_id"] != content_id({k: v for k, v in result.items() if k != "result_id"})):
                raise RunStoreError("unavailable")
        elif result is not None or value["error"] != {"code": "calculation_failed"}:
            raise RunStoreError("unavailable")
        value["record_id"] = identity
        return value

    def replay(self, db, intent, fingerprint):
        row = db.execute("SELECT id,intent,fingerprint,payload FROM runs WHERE intent=?", (intent,)).fetchone() if db else None
        if row is None:
            return None
        value = self.checked(row)
        if row[2] != fingerprint:
            raise RunStoreError("intent_conflict")
        return value

    def find(self, intent, fingerprint):
        with self.connection() as db:
            return self.replay(db, intent, fingerprint)

    def submit(self, submission, work):
        intent, fingerprint = submission["intent_id"], content_id(submission)
        with self.connection(write=True) as db:
            previous = self.replay(db, intent, fingerprint)
            if previous:
                return previous
            if db.execute("SELECT count(*) FROM runs").fetchone()[0] >= 64:
                raise RunStoreError("capacity")
            started = datetime.now(UTC).isoformat()
            result, error = work()
            value = {
                "schema_version": "ocean-owner-synthetic-run/v1", "id": uuid4().hex,
                "intent_id": intent, "submission_id": fingerprint, "request": submission["request"],
                "input_sha256": submission["input_sha256"], "state": "failed" if error else "completed",
                "state_history": ["accepted", "failed" if error else "completed"],
                "submitted_at": started, "finished_at": datetime.now(UTC).isoformat(),
                "result": result, "error": error, "owner_scope": "single_configured_owner",
                "execution": "synchronous_atomic_terminal_record; no_queue_or_resume",
                "source_state": "frozen_synthetic_input; current_source_not_rechecked_on_read",
            }
            value["record_id"] = content_id(value)
            raw = json.dumps(value, allow_nan=False)
            if len(raw.encode("utf-8")) > 1_048_576:
                raise RunStoreError("unavailable")
            db.execute("INSERT INTO runs VALUES(?,?,?,?)", (value["id"], intent, fingerprint, raw))
            return value

    def read(self, identity):
        with self.connection() as db:
            row = db.execute("SELECT id,intent,fingerprint,payload FROM runs WHERE id=?", (identity,)).fetchone() if db else None
            return self.checked(row)
