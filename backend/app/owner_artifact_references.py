"""Protected owner artifact references inside the preparation transaction."""

import re

from .analysis_support import content_id
from .synthetic_run_store import RunStoreError

ARTIFACT_ID = re.compile(r"sha256:[0-9a-f]{64}")
REFERENCE_ID = re.compile(r"[a-z0-9_.:-]{1,96}")
KINDS = frozenset({"owner_pin", "task_input", "shared_task", "saved_case", "saved_report"})
MAX_REFERENCES = 512


def ensure_reference_table(db):
    db.execute(
        "CREATE TABLE IF NOT EXISTS preparation_reference_registry("
        "artifact TEXT PRIMARY KEY, authoritative INTEGER NOT NULL, revision INTEGER NOT NULL,"
        "reference_digest TEXT NOT NULL)"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS preparation_references("
        "artifact TEXT NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL, identity TEXT NOT NULL,"
        "PRIMARY KEY(artifact,kind,reference))"
    )


def reference_identity(artifact, kind, reference):
    if not ARTIFACT_ID.fullmatch(artifact) or kind not in KINDS or not REFERENCE_ID.fullmatch(reference):
        raise RunStoreError("unavailable")
    return content_id({"artifact": artifact, "kind": kind, "reference": reference})


def register_artifact(db, artifact):
    """Record that a new ordinary artifact started with known reference coverage."""
    if not ARTIFACT_ID.fullmatch(artifact):
        raise RunStoreError("unavailable")
    ensure_reference_table(db)
    db.execute("INSERT OR IGNORE INTO preparation_reference_registry VALUES(?,1,0,?)", (artifact, content_id([])))


def reference_rows(db, artifact):
    return db.execute(
        "SELECT kind,reference,identity FROM preparation_references "
        "WHERE artifact=? ORDER BY kind,reference LIMIT ?", (artifact, MAX_REFERENCES + 1),
    ).fetchall()


def protection_status(db, artifact):
    """Read a consistent protection state before deciding storage operations."""
    if not ARTIFACT_ID.fullmatch(artifact):
        raise RunStoreError("unavailable")
    if db is None or not db.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='preparation_references'"
    ).fetchone():
        return {"state": "unknown", "pinned": None, "active_references": None, "deletion_guard": None}
    registry = db.execute("SELECT authoritative,revision,reference_digest FROM preparation_reference_registry "
                          "WHERE artifact=?", (artifact,)).fetchone()
    if registry is not None and (registry[0] not in (0, 1) or not isinstance(registry[1], int) or registry[1] < 0):
        raise RunStoreError("unavailable")
    rows = reference_rows(db, artifact)
    if len(rows) > MAX_REFERENCES or (registry is not None and registry[2] != content_id(rows)):
        raise RunStoreError("unavailable")
    for kind, reference, identity in rows:
        if reference_identity(artifact, kind, reference) != identity:
            raise RunStoreError("unavailable")
    if registry is None and rows:
        raise RunStoreError("unavailable")
    authority = registry is not None and registry[0] == 1
    count = sum(kind != "owner_pin" for kind, _, _ in rows)
    return {
        "state": "protected" if rows else "unprotected" if authority else "unknown",
        "pinned": any(kind == "owner_pin" for kind, _, _ in rows),
        "active_references": count if authority or count else None,
        "deletion_guard": content_id({"artifact": artifact, "revision": registry[1], "reference_rows": rows})
        if authority else None,
    }


def change_reference(db, artifact, kind, reference, present):
    """Register one known owner dependency without releasing other users."""
    identity = reference_identity(artifact, kind, reference)
    ensure_reference_table(db)
    db.execute("INSERT OR IGNORE INTO preparation_reference_registry VALUES(?,0,0,?)", (artifact, content_id([])))
    protection = protection_status(db, artifact)
    if present:
        if ((protection["active_references"] or 0) + int(protection["pinned"]) >= MAX_REFERENCES
                and not db.execute("SELECT 1 FROM preparation_references WHERE artifact=? AND kind=? AND reference=?",
                                   (artifact, kind, reference)).fetchone()):
            raise RunStoreError("capacity")
        changed = db.execute("INSERT OR IGNORE INTO preparation_references VALUES(?,?,?,?)",
                             (artifact, kind, reference, identity))
    else:
        changed = db.execute("DELETE FROM preparation_references WHERE artifact=? AND kind=? AND reference=?",
                             (artifact, kind, reference))
    if changed.rowcount:
        digest = content_id(reference_rows(db, artifact))
        db.execute("UPDATE preparation_reference_registry SET revision=revision+1,reference_digest=? "
                   "WHERE artifact=?", (digest, artifact))


def matches_unprotected_revision(db, artifact, expected_guard):
    """Compare state only. Use PreparationStore.guard_artifact_cleanup to lock a write."""
    current = protection_status(db, artifact)
    return current["state"] == "unprotected" and current["deletion_guard"] == expected_guard
