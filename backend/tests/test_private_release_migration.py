from pathlib import Path
import sqlite3
import pytest

from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, DateTime
from app.models import Base


TABLES = {'friendships', 'groups', 'group_members', 'messages'}
SQL_PATH = Path(__file__).resolve().parents[2] / 'deployment/migrations/001_social.sql'
if not SQL_PATH.is_file():
    pytest.skip('Deployment assets are tested in full-checkout CI, not the backend-only archive.', allow_module_level=True)
SQL = SQL_PATH.read_text()


def shape(db, name):
    return (
        db.execute(f'PRAGMA table_info("{name}")').fetchall(),
        sorted(row[2:] for row in db.execute(f'PRAGMA foreign_key_list("{name}")')),
        sorted(tuple(db.execute(f'PRAGMA index_info("{row[1]}")').fetchall())
               for row in db.execute(f'PRAGMA index_list("{name}")') if row[2]),
    )


def test_candidate_matches_models_and_preserves_existing_tables():
    expected = create_engine('sqlite://')
    candidate = create_engine('sqlite://')
    # The archived SQL implements the old group schema, not the latest feature schema.
    legacy = MetaData()
    for table in Base.metadata.sorted_tables:
        if table.name not in {'groups', 'saved_groups', 'message_reads'}:
            table.to_metadata(legacy)
    Table('groups', legacy, Column('id', Integer, primary_key=True),
          Column('name', String(100), nullable=False), Column('created_at', DateTime, nullable=False))
    legacy.create_all(expected)
    Base.metadata.create_all(candidate, tables=[t for t in Base.metadata.sorted_tables if t.name not in TABLES])
    with expected.connect() as a, candidate.connect() as b:
        wanted = a.connection.driver_connection
        actual = b.connection.driver_connection
        actual.execute('CREATE TABLE preservation_probe(value TEXT)')
        actual.execute("INSERT INTO preservation_probe VALUES('keep this row')")
        actual.commit()
        old = actual.execute("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").fetchall()
        actual.executescript('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;\n' + SQL + '\nCOMMIT;')
        for table in TABLES:
            assert shape(actual, table) == shape(wanted, table)
        assert actual.execute('SELECT * FROM preservation_probe').fetchall() == [('keep this row',)]
        now = actual.execute("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").fetchall()
        assert all(row in now for row in old)
        assert actual.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
        assert actual.execute('PRAGMA foreign_key_check').fetchall() == []
    candidate.dispose()
    expected.dispose()


def test_existing_target_fails_and_transaction_can_roll_back():
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE groups(existing TEXT)')
        try:
            db.executescript('BEGIN IMMEDIATE;\n' + SQL + '\nCOMMIT;')
        except sqlite3.OperationalError:
            db.rollback()
        else:
            raise AssertionError('Existing target table must not be silently accepted')
        assert db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall() == [('groups',)]
