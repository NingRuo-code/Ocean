"""Publish a SQLite store only after its schema has committed."""

import os
import sqlite3
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory


def initialize_sqlite_store(path, *, application_id, schema_version, statements, prefix):
    path.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=path.parent, prefix=prefix) as temporary:
        staged = Path(temporary) / path.name
        staged.touch(mode=0o600, exist_ok=False)
        with closing(sqlite3.connect(staged, isolation_level=None)) as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute(f"PRAGMA application_id={application_id}")
            db.execute(f"PRAGMA user_version={schema_version}")
            for statement in statements:
                db.execute(statement)
            db.commit()
        # The live name appears with a committed schema. An existing file wins.
        try:
            os.link(staged, path)
        except FileExistsError:
            pass
