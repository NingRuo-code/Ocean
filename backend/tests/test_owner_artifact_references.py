"""Persistence and fail-closed behavior for the future cleanup guard."""

import sqlite3

import pytest

from app.owner_artifact_references import (
    change_reference,
    matches_unprotected_revision,
    protection_status,
    register_artifact,
)
from app.synthetic_run_store import RunStoreError

ARTIFACT = "sha256:" + "a" * 64
LEGACY = "sha256:" + "b" * 64


def test_independent_shared_references_survive_release_and_reopen(tmp_path):
    path = tmp_path / "references.sqlite3"
    with sqlite3.connect(path) as db:
        register_artifact(db, ARTIFACT)
        initial = protection_status(db, ARTIFACT)
        assert initial["state"] == "unprotected"
        change_reference(db, ARTIFACT, "shared_task", "first-task", True)
        change_reference(db, ARTIFACT, "saved_report", "controlled-report", True)
        change_reference(db, ARTIFACT, "shared_task", "first-task", False)
        assert protection_status(db, ARTIFACT)["active_references"] == 1
        assert not matches_unprotected_revision(db, ARTIFACT, initial["deletion_guard"])
    with sqlite3.connect(path) as db:
        assert protection_status(db, ARTIFACT)["state"] == "protected"
        change_reference(db, ARTIFACT, "saved_report", "controlled-report", False)
        current = protection_status(db, ARTIFACT)
        assert current["state"] == "unprotected"
        assert not matches_unprotected_revision(db, ARTIFACT, initial["deletion_guard"])
        assert matches_unprotected_revision(db, ARTIFACT, current["deletion_guard"])


def test_unknown_legacy_or_damaged_reference_cannot_authorize_cleanup(tmp_path):
    with sqlite3.connect(tmp_path / "references.sqlite3") as db:
        assert protection_status(db, LEGACY)["state"] == "unknown"
        change_reference(db, LEGACY, "owner_pin", "owner", True)
        assert protection_status(db, LEGACY)["state"] == "protected"
        change_reference(db, LEGACY, "owner_pin", "owner", False)
        assert protection_status(db, LEGACY)["state"] == "unknown"
        assert not matches_unprotected_revision(db, LEGACY, None)
        change_reference(db, LEGACY, "owner_pin", "owner", True)
        db.execute("UPDATE preparation_references SET identity='corrupt'")
        with pytest.raises(RunStoreError, match="unavailable"):
            protection_status(db, LEGACY)
        with pytest.raises(RunStoreError, match="unavailable"):
            matches_unprotected_revision(db, LEGACY, None)



def test_deleted_reference_row_is_not_treated_as_unprotected(tmp_path):
    with sqlite3.connect(tmp_path / "references.sqlite3") as db:
        register_artifact(db, ARTIFACT)
        change_reference(db, ARTIFACT, "saved_report", "protected-report", True)
        db.execute("DELETE FROM preparation_references WHERE artifact=?", (ARTIFACT,))
        with pytest.raises(RunStoreError, match="unavailable"):
            protection_status(db, ARTIFACT)
