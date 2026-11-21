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
from .owner_artifact_references import change_reference, protection_status, reference_rows
from .sqlite_store_initialization import initialize_sqlite_store
from .synthetic_run_store import RunStoreError

APPLICATION_ID = 0x4F434153
MAX_DB_BYTES = 64 * 1024 * 1024
CASE_SECTIONS = ("summary", "daily", "limits")


class CaseStoreError(Exception):
    pass


def case_dependencies(report):
    result = report["result"]
    license_id = result["source"]["license"].partition(";")[0].strip()
    report_digest = content_id({key: value for key, value in report.items() if key != "report_id"})
    if (report["schema_version"] != "ocean-known-month-report/v1" or report_digest != report["report_id"]
            or result["schema_version"] != "ocean-published-month/v1" or result["evidence_kind"] != "synthetic_example"
            or result["research_ready"] is not False or result["public_aggregate_allowed"] is not True
            or license_id != "CC0-1.0"):
        raise CaseStoreError("protection_unavailable")
    return {
        "result": result["result_id"],
        "projection": result["projection_id"],
        "report": report["report_id"],
        "chart_basis": content_id({"report": report["report_id"], "daily": result["daily"], "units": result["units"]}),
        "map_basis": content_id({"projection": result["projection_id"], "parameters": result["parameters"],
                                 "source": result["source"]["input_sha256"]}),
    }


class CaseStore:
    def __init__(self, path):
        self.path = Path(os.path.abspath(path)) if path is not None else None

    def _checked_store_exists(self):
        for path in (*reversed(self.path.parents), self.path):
            try:
                info = path.lstat()
            except FileNotFoundError:
                continue
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
                raise CaseStoreError("unavailable")
            if path == self.path:
                if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_DB_BYTES:
                    raise CaseStoreError("unavailable")
                return True
        return False

    def _initialize_store(self):
        initialize_sqlite_store(
            self.path,
            application_id=APPLICATION_ID,
            schema_version=1,
            prefix=".ocean-case-",
            statements=(
                "CREATE TABLE cases(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, head INTEGER NOT NULL)",
                ("CREATE TABLE versions(case_id TEXT REFERENCES cases(id), number INTEGER, "
                 "payload TEXT NOT NULL, PRIMARY KEY(case_id,number))"),
                ("CREATE TABLE intents(key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, case_id TEXT, "
                 "version INTEGER, FOREIGN KEY(case_id,version) REFERENCES versions(case_id,number))"),
            ),
        )

    @contextmanager
    def connection(self, write=False):
        if self.path is None:
            raise CaseStoreError("unavailable")
        try:
            if not self._checked_store_exists():
                if not write:
                    yield None
                    return
                self._initialize_store()
                if not self._checked_store_exists():
                    raise CaseStoreError("unavailable")
            mode = "rw" if write else "ro"
            target = self.path.as_uri() + f"?mode={mode}"
            with closing(sqlite3.connect(target, uri=True, timeout=2, isolation_level=None)) as db:
                db.execute("PRAGMA foreign_keys=ON")
                db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
                application = db.execute("PRAGMA application_id").fetchone()[0]
                version = db.execute("PRAGMA user_version").fetchone()[0]
                if application != APPLICATION_ID or version != 1:
                    raise CaseStoreError("unavailable")
                if write:
                    page_size = db.execute("PRAGMA page_size").fetchone()[0]
                    db.execute(f"PRAGMA max_page_count={MAX_DB_BYTES // page_size}")
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

    def version_record(self, db, case_id, version=None):
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
        sections = value.get("sections", list(CASE_SECTIONS))
        if not sections or sections != [section for section in CASE_SECTIONS if section in sections]:
            raise CaseStoreError("unavailable")
        dependencies = value.get("protected_dependencies")
        verified_dependencies = case_dependencies(value["report"])
        if dependencies is not None and dependencies != verified_dependencies:
            raise CaseStoreError("protection_unavailable")
        value["version_id"] = expected
        return value

    @staticmethod
    def availability(db, value):
        dependencies = value.get("protected_dependencies")
        if dependencies is None:
            return "legacy_unverified"
        try:
            for artifact_id in set(dependencies.values()):
                status = protection_status(db, artifact_id)
                if status["state"] != "protected" or not any(
                    kind == "saved_case" and reference == value["case_id"]
                    for kind, reference, _ in reference_rows(db, artifact_id)
                ):
                    return "protection_unavailable"
        except (RunStoreError, sqlite3.Error):
            return "protection_unavailable"
        return "protected"

    def read_version(self, db, case_id, version=None):
        value = self.version_record(db, case_id, version)
        if self.availability(db, value) == "protection_unavailable":
            raise CaseStoreError("protection_unavailable")
        return value

    def version_summary(self, db, case_id, version=None):
        value = self.version_record(db, case_id, version)
        summary = {key: value[key] for key in ("case_id", "version", "version_id", "created_at", "metadata")}
        summary["availability"] = self.availability(db, value)
        summary["kind"] = value["report"]["result"]["kind"]
        return summary

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

    def new_version(self, identity, number, metadata, report, sections=None):
        value = {"schema_version": "ocean-synthetic-case-version/v1", "case_id": identity, "version": number, "created_at": datetime.now(UTC).isoformat(), "metadata": metadata, "report": report, "source_state": "saved_CC0_synthetic_snapshot; current_source_not_rechecked"}
        if sections is not None:
            value["sections"] = sections
        value["protected_dependencies"] = case_dependencies(report)
        value["version_id"] = content_id(value)
        return value

    @staticmethod
    def protect_version(db, value):
        try:
            for identity in sorted(set(value["protected_dependencies"].values())):
                change_reference(db, identity, "saved_case", value["case_id"], True)
        except RunStoreError:
            raise CaseStoreError("protection_unavailable") from None

    def create(self, key, fingerprint, metadata, report):
        with self.connection(write=True) as db:
            previous = self.replay(db, key, fingerprint)
            if previous:
                return previous
            if db.execute("SELECT count(*) FROM cases").fetchone()[0] >= 64:
                raise CaseStoreError("capacity")
            identity, now = uuid4().hex, datetime.now(UTC).isoformat()
            value = self.new_version(identity, 1, metadata, report)
            self.protect_version(db, value)
            db.execute("INSERT INTO cases VALUES(?,?,1)", (identity, now))
            db.execute("INSERT INTO versions VALUES(?,1,?)", (identity, json.dumps(value)))
            db.execute("INSERT INTO intents VALUES(?,?,?,1)", (key, fingerprint, identity))
            return value

    def update(self, identity, base_version, base_id, key, fingerprint, metadata, *, report=None, sections=None):
        if self.path is not None and not self.path.exists():
            raise CaseStoreError("not_found")
        with self.connection(write=True) as db:
            previous = self.replay(db, key, fingerprint)
            if previous:
                return previous
            old = self.read_version(db, identity)
            if old["version"] != base_version or old["version_id"] != base_id:
                raise CaseStoreError("version_conflict")
            previous_sections = old.get("sections", list(CASE_SECTIONS))
            selected_sections = sections if sections is not None else previous_sections
            selected_report = report if report is not None else old["report"]
            if (old["metadata"] == metadata and previous_sections == selected_sections
                    and selected_report["report_id"] == old["report"]["report_id"]):
                raise CaseStoreError("no_changes")
            number = old["version"] + 1
            if number > 16:
                raise CaseStoreError("capacity")
            value = self.new_version(identity, number, metadata, selected_report, selected_sections)
            self.protect_version(db, value)
            db.execute("INSERT INTO versions VALUES(?,?,?)", (identity, number, json.dumps(value)))
            db.execute("INSERT INTO intents VALUES(?,?,?,?)", (key, fingerprint, identity, number))
            db.execute("UPDATE cases SET head=? WHERE id=?", (number, identity))
            return value

    def read(self, identity, version=None):
        with self.connection() as db:
            return self.read_version(db, identity, version)

    def version_summaries(self, db, identity):
        if db is None:
            raise CaseStoreError("not_found")
        numbers = db.execute("SELECT number FROM versions WHERE case_id=? ORDER BY number DESC", (identity,)).fetchall()
        if not numbers:
            raise CaseStoreError("not_found")
        if len(numbers) > 16:
            raise CaseStoreError("unavailable")
        return [self.version_summary(db, identity, row[0]) for row in numbers]

    def versions(self, identity):
        with self.connection() as db:
            summaries = self.version_summaries(db, identity)
            return [{key: value for key, value in summary.items() if key != "case_id"} for summary in summaries]

    def catalog(self, q="", kind=None, start_date=None, end_date=None):
        with self.connection() as db:
            if db is None:
                return []
            rows = db.execute("SELECT id FROM cases ORDER BY created_at DESC,id").fetchall()
            if len(rows) > 64:
                raise CaseStoreError("unavailable")
            results = []
            term = q.strip().casefold()
            for (case_id,) in rows:
                item = self.version_summary(db, case_id)
                saved_day = item["created_at"][:10]
                if ((kind is not None and item["kind"] != kind)
                        or (start_date is not None and saved_day < start_date)
                        or (end_date is not None and saved_day > end_date)):
                    continue
                item["metadata"] = {key: item["metadata"][key] for key in ("title", "tags")}
                if term not in (item["metadata"]["title"] + " " + " ".join(item["metadata"]["tags"])).casefold():
                    continue
                if item["availability"] == "protection_unavailable":
                    item["readable_version"] = next((
                        value["version"] for value in self.version_summaries(db, case_id)
                        if value["availability"] != "protection_unavailable"
                    ), None)
                else:
                    item["readable_version"] = item["version"]
                results.append(item)
            return results
