"""Verify social revision 0004 on an already-restored, isolated PostgreSQL copy.

Never creates, drops, restores or migrates the live database. Prints counts, not
account/message data. Run as ubuntu after restoring a current production dump.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.engine import make_url

TARGET = 'team43_social_rehearsal'
BACKEND = Path(__file__).resolve().parents[1]
NEW_TABLES = {'saved_groups', 'message_reads'}
GROUP_DEFAULTS = {'course': '', 'description': '', 'location': '',
                  'group_type': 'Other', 'study_format': 'Hybrid', 'preferred_days': []}


def checked_url(value):
    url = make_url(value)
    if url.drivername != 'postgresql+psycopg' or url.database != TARGET:
        raise ValueError('Only the isolated team43_social_rehearsal database is allowed.')
    if url.username != 'ubuntu' or url.host is not None or url.password is not None:
        raise ValueError('Use the ubuntu role with local peer authentication, not a remote server.')
    if dict(url.query) != {'host': '/var/run/postgresql'} or url.port is not None:
        raise ValueError('Only the local PostgreSQL Unix socket is allowed.')
    return url


def row_digest(rows):
    # Canonical row sorting does not depend on unspecified database row order.
    encoded = sorted(json.dumps(list(row), default=str, sort_keys=True,
                                separators=(',', ':')) for row in rows)
    return len(encoded), hashlib.sha256('\n'.join(encoded).encode()).hexdigest()


def snapshot(connection, columns=None):
    result = {}
    tables = set(inspect(connection).get_table_names()) - {'alembic_version'}
    if columns is not None and not set(columns).issubset(tables):
        raise ValueError('Migration removed an original table.')
    for name in sorted(columns if columns is not None else tables):
        table = Table(name, MetaData(), autoload_with=connection)
        names = columns[name] if columns is not None else [column.name for column in table.columns]
        count, digest = row_digest(connection.execute(select(*(table.c[name] for name in names))).all())
        result[name] = {'columns': names, 'count': count, 'digest': digest}
    return result


def check_preserved(before, after):
    if before != after:
        changed = sorted(name for name in before if before[name] != after.get(name))
        raise ValueError('Original rows or columns changed: ' + ', '.join(changed))


def run_alembic(url, *arguments):
    environment = {**os.environ, 'DATABASE_URL': url.render_as_string(hide_password=False)}
    # A fresh process ensures Alembic cannot reuse a different already-imported engine.
    result = subprocess.run([sys.executable, '-m', 'alembic', '-c', str(BACKEND / 'alembic.ini'),
                             *arguments], cwd=BACKEND, env=environment,
                            capture_output=True, text=True, timeout=120)
    if result.returncode:
        # Logs may contain user details or connection strings; don't echo them.
        raise RuntimeError('Alembic failed on the rehearsal copy; live database was not targeted.')


def rehearse(value):
    url = checked_url(value)  # Validate before opening any connection.
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            if connection.scalar(text('SELECT current_database()')) != TARGET:
                raise ValueError('Connected database identity does not match the rehearsal target.')
            revisions = connection.execute(text('SELECT version_num FROM alembic_version')).scalars().all()
            if revisions != ['0003']:
                raise ValueError('Expected a freshly restored campus revision 0003 copy; no migration performed.')
            before = snapshot(connection)
            if NEW_TABLES.intersection(before):
                raise ValueError('Rehearsal already contains new social tables; start with a fresh restore.')
            if not {'users', 'groups', 'messages', 'programmes', 'published_campus_routes'}.issubset(before):
                raise ValueError('Restored database is missing expected application tables.')
            if before['programmes']['count'] < 1:
                raise ValueError('Expected programmes in the restored production copy.')
        run_alembic(url, 'upgrade', '0004')
        run_alembic(url, 'check')
        with engine.connect() as connection:
            after = snapshot(connection, {name: row['columns'] for name, row in before.items()})
            check_preserved(before, after)
            if set(inspect(connection).get_table_names()) != set(before) | NEW_TABLES | {'alembic_version'}:
                raise ValueError('Unexpected tables after migration.')
            for name in sorted(NEW_TABLES):
                if connection.scalar(text(f'SELECT COUNT(*) FROM {name}')) != 0:
                    raise ValueError('Expected new social tables to be empty.')
            groups = Table('groups', MetaData(), autoload_with=connection)
            for group in connection.execute(select(*(groups.c[name] for name in GROUP_DEFAULTS))).mappings():
                if dict(group) != GROUP_DEFAULTS:
                    raise ValueError('Existing group did not receive the reviewed metadata defaults.')
            if connection.execute(text('SELECT version_num FROM alembic_version')).scalars().all() != ['0004']:
                raise ValueError('Expected revision 0004 after upgrade.')
        for name, row in before.items():
            print(f"{name}: {row['count']} original rows preserved")
        print('PASS: revision 0004, schema check and every original row verified on the rehearsal copy.')
    finally:
        engine.dispose()


if __name__ == '__main__':
    try:
        rehearse(os.environ.get('DATABASE_URL', ''))
    except Exception as error:
        print(f'Rehearsal stopped ({type(error).__name__}): {str(error) if isinstance(error, ValueError) else "inspect the rehearsal environment"}',
              file=sys.stderr)
        raise SystemExit(1) from None
