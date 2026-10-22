from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect
from app.models import Base

SQL_PATH = Path(__file__).resolve().parents[2] / 'deployment/migrations/002_shared_home_routes.sql'
if not SQL_PATH.is_file():
    pytest.skip('Migration assets require full checkout', allow_module_level=True)


def test_route_migration_matches_models_and_preserves_existing_schema():
    expected, actual = create_engine('sqlite://'), create_engine('sqlite://')
    try:
        Base.metadata.create_all(expected)
        Base.metadata.create_all(actual, tables=[t for t in Base.metadata.sorted_tables if t.name != 'published_home_routes'])
        with actual.connect() as connection:
            db = connection.connection.driver_connection
            before = db.execute('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').fetchall()
            db.executescript('BEGIN IMMEDIATE;\n' + SQL_PATH.read_text() + '\nCOMMIT;')
            after = db.execute('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').fetchall()
            assert all(row in after for row in before)
            assert db.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
            assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        for method in ('get_columns', 'get_indexes', 'get_unique_constraints', 'get_foreign_keys'):
            a = getattr(inspect(actual), method)('published_home_routes')
            b = getattr(inspect(expected), method)('published_home_routes')
            # SQLAlchemy TypeEngine objects compare by identity; compare their text.
            assert str(a) == str(b)
    finally:
        expected.dispose()
        actual.dispose()
