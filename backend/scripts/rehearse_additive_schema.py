"""Read-only local rehearsal. All schema changes happen in memory, never AWS.

This does not approve or bypass the deployment schema guard.
"""
import hashlib
import os
import sqlite3
from pathlib import Path


def main():
    backend = Path(__file__).resolve().parents[1]
    if backend.parent.name != '.integration-worktree' or os.getenv('DATABASE_URL'):
        raise SystemExit('Run in the integration worktree with DATABASE_URL unset.')
    source = backend.parent.parent / 'backend/health_app_v2.db'
    os.environ['DATABASE_URL'] = 'sqlite://'
    from sqlalchemy import create_engine
    from app.database import Base
    import app.models  # register the integrated metadata
    engine = create_engine('sqlite://')
    with engine.connect() as connection:
        raw = connection.connection.driver_connection
        with sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True) as original:
            original.backup(raw)
        tables = [r[0] for r in raw.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        def snapshot(name):
            quoted = '"' + name.replace('"', '""') + '"'
            schema = raw.execute('SELECT type,name,sql FROM sqlite_master WHERE tbl_name=? ORDER BY type,name', (name,)).fetchall()
            rows = sorted(repr(row) for row in raw.execute('SELECT * FROM ' + quoted))
            return schema, hashlib.sha256('\n'.join(rows).encode()).hexdigest()
        before = {name: snapshot(name) for name in tables}
        Base.metadata.create_all(connection)
        after_tables = {r[0] for r in raw.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert after_tables - set(tables) == {'friendships','groups','group_members','messages'}
        assert all(snapshot(name) == before[name] for name in tables), 'Existing schema or rows changed'
        assert raw.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
        assert not raw.execute('PRAGMA foreign_key_check').fetchall()
        print('PASS: four additive tables; all existing table schemas and row digests unchanged.')
        print('PASS: integrity and foreign-key checks. Only an in-memory copy was modified.')
    engine.dispose()


if __name__ == '__main__':
    main()
