import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest
from test_migration_installer import installer, original


def test_additive_home_migration_retries_and_preserves_rows(tmp_path):
    path=tmp_path/'routes.db'
    original(path)
    installer.migrate_social(path)
    with sqlite3.connect(path) as db:
        db.execute("INSERT INTO groups VALUES(1,'Preserved','2026-09-14')")
    installer.migrate_home_routes(path)
    installer.migrate_home_routes(path)
    with sqlite3.connect(path) as db:
        assert installer.schema_digest(db)==installer.HOME_SCHEMA
        assert db.execute('SELECT name FROM groups').fetchall()==[('Preserved',)]


def test_home_migration_rolls_back_partial_failure(tmp_path):
    path=tmp_path/'routes.db'
    original(path)
    installer.migrate_social(path)
    with patch.object(installer,'HOME_SQL',installer.HOME_SQL.split(';')[0]+';INVALID SQL;'):
        with pytest.raises(sqlite3.OperationalError): installer.migrate_home_routes(path)
    with sqlite3.connect(path) as db: assert installer.schema_digest(db)==installer.NEW_SCHEMA


def test_unexpected_schema_is_refused(tmp_path):
    path=tmp_path/'routes.db'
    original(path)
    with pytest.raises(installer.DeploymentError): installer.migrate_home_routes(path)


def test_new_models_are_not_approved_for_legacy_automatic_migration(tmp_path):
    import hashlib
    path=Path(__file__).resolve().parents[1]/'app/models.py'
    assert hashlib.sha256(path.read_text().encode()).hexdigest() != installer.HOME_MODELS
    old, new = tmp_path / 'old', tmp_path / 'new'
    for root in (old, new):
        (root / 'app').mkdir(parents=True)
        (root / 'app/database.py').write_text('same database configuration')
    (old / 'app/models.py').write_text('previous schema')
    (new / 'app/models.py').write_text(path.read_text())
    with pytest.raises(installer.DeploymentError, match='migration manually'):
        installer.reviewed_transition(old, new)
