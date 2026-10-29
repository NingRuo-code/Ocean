"""Bounded self-contained synthetic case snapshots. No cleanup, raw data or job engine."""

import json
import os
import sqlite3
import stat
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .analysis_support import content_id, decode_controlled_json

APPLICATION_ID = 0x4F434153


class CaseStoreError(Exception):
    pass


class CaseStore:
    def __init__(self, path):
        self.path = Path(os.path.abspath(path)) if path is not None else None

    @contextmanager
    def connection(self, write=False):
        if self.path is None:
            raise CaseStoreError("unavailable")
        try:
            for p in [*reversed(self.path.parents), self.path]:
                if not p.exists() and not p.is_symlink():
                    continue
                info = p.lstat()
                if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
                    raise CaseStoreError("unavailable")
            if self.path.exists() and self.path.stat().st_size > 64 * 1024 * 1024:
                raise CaseStoreError("unavailable")
            if write:
                self.path.parent.mkdir(parents=True, exist_ok=True)
            elif not self.path.exists():
                yield None
                return
            target = str(self.path) if write else self.path.as_uri() + "?mode=ro"
            with closing(sqlite3.connect(target, uri=not write, timeout=2, isolation_level=None)) as db:
                db.execute("PRAGMA foreign_keys=ON")
                if write:
                    db.execute("BEGIN IMMEDIATE")
                application = db.execute("PRAGMA application_id").fetchone()[0]
                version = db.execute("PRAGMA user_version").fetchone()[0]
                if write and application == 0 and version == 0 and not db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
                    db.execute(f"PRAGMA application_id={APPLICATION_ID}")
                    db.execute("PRAGMA user_version=1")
                    db.execute("CREATE TABLE cases(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, head INTEGER NOT NULL)")
                    db.execute("CREATE TABLE versions(case_id TEXT REFERENCES cases(id), number INTEGER, payload TEXT NOT NULL, PRIMARY KEY(case_id,number))")
                    db.execute("CREATE TABLE intents(key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, case_id TEXT, version INTEGER, FOREIGN KEY(case_id,version) REFERENCES versions(case_id,number))")
                elif application != APPLICATION_ID or version != 1:
                    raise CaseStoreError("unavailable")
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
        except (OSError, sqlite3.Error, ValueError, TypeError, KeyError, UnicodeError, RecursionError):
            raise CaseStoreError("unavailable") from None

    def read_version(self, db, case_id, version=None):
        if db is None:
            raise CaseStoreError("not_found")
        head = db.execute("SELECT head FROM cases WHERE id=?", (case_id,)).fetchone()
        if not head:
            raise CaseStoreError("not_found")
        row = db.execute("SELECT payload FROM versions WHERE case_id=? AND number=?", (case_id, version or head[0])).fetchone()
        if not row:
            raise CaseStoreError("not_found")
        value = decode_controlled_json(row[0])
        expected = value.pop("version_id")
        if expected != content_id(value) or value["case_id"] != case_id or value["version"] != (version or head[0]):
            raise CaseStoreError("unavailable")
        value["version_id"] = expected
        return value

    def replay(self, db, key, fingerprint):
        row = db.execute("SELECT fingerprint,case_id,version FROM intents WHERE key=?", (key,)).fetchone() if db else None
        if row:
            if row[0] != fingerprint:
                raise CaseStoreError("intent_conflict")
            return self.read_version(db, row[1], row[2])
        return None

    def find_intent(self, key, fingerprint):
        with self.connection() as db:
            return self.replay(db, key, fingerprint)

    def new_version(self, identity, number, metadata, report):
        value = {"schema_version": "ocean-synthetic-case-version/v1", "case_id": identity, "version": number, "created_at": datetime.now(UTC).isoformat(), "metadata": metadata, "report": report, "source_state": "saved_CC0_synthetic_snapshot; current_source_not_rechecked"}
        value["version_id"] = content_id(value)
        return value

    def create(self, key, fingerprint, metadata, report):
        with self.connection(write=True) as db:
            previous = self.replay(db, key, fingerprint)
            if previous:
                return previous
            if db.execute("SELECT count(*) FROM cases").fetchone()[0] >= 64:
                raise CaseStoreError("capacity")
            identity, now = uuid4().hex, datetime.now(UTC).isoformat()
            value = self.new_version(identity, 1, metadata, report)
            db.execute("INSERT INTO cases VALUES(?,?,1)", (identity, now))
            db.execute("INSERT INTO versions VALUES(?,1,?)", (identity, json.dumps(value)))
            db.execute("INSERT INTO intents VALUES(?,?,?,1)", (key, fingerprint, identity))
            return value

    def update(self, identity, base_version, base_id, key, fingerprint, metadata):
        if self.path is not None and not self.path.exists():
            raise CaseStoreError("not_found")
        with self.connection(write=True) as db:
            previous = self.replay(db, key, fingerprint)
            if previous:
                return previous
            old = self.read_version(db, identity)
            if old["version"] != base_version or old["version_id"] != base_id:
                raise CaseStoreError("version_conflict")
            if old["metadata"] == metadata:
                raise CaseStoreError("no_changes")
            number = old["version"] + 1
            if number > 16:
                raise CaseStoreError("capacity")
            value = self.new_version(identity, number, metadata, old["report"])
            db.execute("INSERT INTO versions VALUES(?,?,?)", (identity, number, json.dumps(value)))
            db.execute("INSERT INTO intents VALUES(?,?,?,?)", (key, fingerprint, identity, number))
            db.execute("UPDATE cases SET head=? WHERE id=?", (number, identity))
            return value

    def read(self, identity, version=None):
        with self.connection() as db:
            return self.read_version(db, identity, version)

    def versions(self, identity):
        with self.connection() as db:
            self.read_version(db, identity)
            numbers = db.execute("SELECT number FROM versions WHERE case_id=? ORDER BY number DESC", (identity,)).fetchall()
            if len(numbers) > 16:
                raise CaseStoreError("unavailable")
            return [{k: v for k, v in self.read_version(db, identity, row[0]).items() if k in {"version", "version_id", "created_at", "metadata"}} for row in numbers]

    def catalog(self, query=""):
        with self.connection() as db:
            if db is None:
                return []
            rows = db.execute("SELECT id FROM cases ORDER BY created_at DESC,id").fetchall()
            if len(rows) > 64:
                raise CaseStoreError("unavailable")
            results = [{k: v for k, v in self.read_version(db, row[0]).items() if k in {"case_id", "version", "version_id", "created_at", "metadata"}} for row in rows]
            return [r for r in results if query.strip().casefold() in (r["metadata"]["title"] + " " + " ".join(r["metadata"]["tags"])).casefold()]
