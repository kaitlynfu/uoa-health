"""Reviewed PostgreSQL 0002 -> 0003 transition, with retained restore rehearsals.

Imported by the root-owned installer. No cloud access, seeds, database drops,
schema stamping or automatic downgrades. All candidate Python runs as ubuntu.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import uuid

OLD_MODELS = '700650b0eda19340094f50f2026c7fdfecdf5dc2d99dafd89edac3df215f73fa'
NEW_MODELS = 'f36a16d6872480344030051c6b41f794fca63a8e71bb4f2c8d2de70125219183'
MIGRATION = 'migrations/versions/0003_published_campus_routes.py'
MIGRATION_SHA = '0b1106ddf4e1f910546b6acc7f404b49209f9f7c89e97e1460b54f0958021318'
BASE_PINS = {
    'app/database.py': '7093de15e64bcd2311e00a787245f4e3e30375f36442ada6c94e942cd3f2376f',
    'alembic.ini': '4be35c86b24192bde1327811488c4fcbc1f446b8c1e688fbbcba8f27640a252b',
    'migrations/env.py': '4809f638ea95225447d6c809f9c612476dbb9d821e9bdece241c2c0ce2658513',
    'migrations/script.py.mako': 'bebf1e4b7644243b9651d99b0c085ee1297a3d089c400fd8d8cc87b6f920e3f3',
    'migrations/versions/0001_initial_application_schema.py': 'a7d48c47c45f3712b6f90b8c2a43124a79b8fe495b797c85af129b4517878f82',
    'migrations/versions/0002_preserve_social_and_published_home_.py': 'df20d1aadee91571ef8ecfa223757cc622ddab3eb5aff6dcbf05e43a11b3a572',
}
TABLE = 'published_campus_routes'


class CampusMigrationError(Exception):
    pass


def digest(path):
    return hashlib.sha256(Path(path).read_text(encoding='utf-8').encode()).hexdigest()


def reviewed_transition(old, new):
    """Return False for ordinary deployments; refuse changes to this pinned DDL."""
    if digest(new / 'app/models.py') != NEW_MODELS or digest(old / 'app/models.py') != OLD_MODELS:
        return False
    for relative, checksum in BASE_PINS.items():
        if digest(old / relative) != checksum or digest(new / relative) != checksum:
            raise CampusMigrationError('Campus transition has changed baseline schema files.')
    old_revisions = set(p.name for p in (old / 'migrations/versions').glob('*.py'))
    new_revisions = set(p.name for p in (new / 'migrations/versions').glob('*.py'))
    baseline = {Path(p).name for p in BASE_PINS if p.startswith('migrations/versions/')}
    if old_revisions != baseline or new_revisions != baseline | {Path(MIGRATION).name}:
        raise CampusMigrationError('Campus transition contains unexpected migration revisions.')
    if digest(new / MIGRATION) != MIGRATION_SHA:
        raise CampusMigrationError('Campus migration differs from the reviewed revision.')
    return True


def require_database(name, *, temporary=False):
    if name == 'team43' and not temporary:
        return
    if not re.fullmatch(r'team43_campus_[a-f0-9]{12}_(restore|test)', name):
        raise CampusMigrationError('Unexpected PostgreSQL database target.')


def database_url(name):
    require_database(name)
    return f'postgresql+psycopg://ubuntu@/{name}?host=/var/run/postgresql'


def execute(command, **kwargs):
    try:
        return subprocess.run(command, check=True, timeout=kwargs.pop('timeout', 120),
                              **kwargs)
    except Exception:
        # SQL errors may contain private row values; retain them on the host only
        # when the operator explicitly inspects PostgreSQL logs.
        raise CampusMigrationError('PostgreSQL rehearsal command failed; live activation refused.') from None


def python_command(backend, database, arguments, *, tests=False):
    require_database(database, temporary=tests)
    environment = ['PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/home/ubuntu',
                   'PYTHONDONTWRITEBYTECODE=1', 'PGPASSFILE=/dev/null',
                   'PGCONNECT_TIMEOUT=5', 'PGOPTIONS=-c lock_timeout=5000 -c statement_timeout=30000',
                   'DATABASE_URL=' + database_url(database)]
    if tests:
        if not database.endswith('_test'):
            raise CampusMigrationError('Tests require a disposable _test database.')
        environment.append('TEST_DATABASE_URL=' + database_url(database))
    return ['/usr/bin/timeout', '--kill-after=5', '300' if tests else '90',
            '/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/env', '-i',
            *environment, str(backend / '.venv/bin/python'), *arguments]


def create_database(name):
    require_database(name, temporary=True)
    execute(['/usr/sbin/runuser', '-u', 'postgres', '--', '/usr/bin/env', '-i',
             'PATH=/usr/bin:/bin', 'PGPASSFILE=/dev/null', 'PGCONNECT_TIMEOUT=5',
             '/usr/bin/createdb', '--no-password', '--host=/var/run/postgresql',
             '--maintenance-db=postgres', '--template=template0', '--owner=ubuntu', name],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def restore(backup, database):
    """Create a unique database; never restore over an existing database."""
    create_database(database)
    with backup.open('rb', buffering=0) as source:
        if source.read(5) != b'PGDMP':
            raise CampusMigrationError('Backup is not a PostgreSQL custom archive.')
        source.seek(0)
        execute(['/usr/bin/timeout', '--kill-after=5', '90', '/usr/sbin/runuser',
                 '-u', 'ubuntu', '--', '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin',
                 'PGPASSFILE=/dev/null', 'PGCONNECT_TIMEOUT=5',
                 '/usr/bin/pg_restore', '--no-password', '--host=/var/run/postgresql',
                 '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction',
                 '--dbname=' + database], stdin=source, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE)


# This fixed read-only program returns counts/hashes and schema definitions, never
# rows or credentials. PostgreSQL hashes complete rows, including binary archives.
AUDIT = r'''
import hashlib, json, sys
import psycopg
from psycopg import sql
with psycopg.connect(dbname=sys.argv[1], user="ubuntu", host="/var/run/postgresql", connect_timeout=5) as db:
    with db.transaction():
        db.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        db.execute("SET LOCAL statement_timeout = '30s'")
        names = [r[0] for r in db.execute("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname")]
        result = {"tables": {}}
        for name in names:
            columns = db.execute("SELECT a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull, a.attidentity, a.attgenerated, pg_get_expr(d.adbin,d.adrelid) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=%s AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum", (name,)).fetchall()
            constraints = db.execute("SELECT x.conname, x.contype, pg_get_constraintdef(x.oid), x.convalidated FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=%s ORDER BY x.conname", (name,)).fetchall()
            indexes = db.execute("SELECT i.relname, pg_get_indexdef(x.indexrelid), x.indisvalid, x.indisready FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=%s ORDER BY i.relname", (name,)).fetchall()
            digest = hashlib.sha256()
            count = 0
            with db.cursor(name="campus_audit_rows") as cursor:
                cursor.execute(sql.SQL("SELECT encode(sha256(convert_to(to_jsonb(t)::text, 'UTF8')), 'hex') AS row_hash FROM {}.{} t ORDER BY row_hash").format(sql.Identifier("public"), sql.Identifier(name)))
                for (row_hash,) in cursor:
                    digest.update(bytes.fromhex(row_hash))
                    count += 1
            result["tables"][name] = {"columns": columns, "constraints": constraints, "indexes": indexes, "count": count, "sha256": digest.hexdigest()}
        result["versions"] = [r[0] for r in db.execute("SELECT version_num FROM public.alembic_version ORDER BY version_num")]
        result["sequences"] = db.execute("SELECT sequencename, start_value, min_value, max_value, increment_by, cycle, cache_size, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename").fetchall()
        result["enums"] = db.execute("SELECT t.typname, e.enumlabel, e.enumsortorder::text FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder").fetchall()
        result["views"] = db.execute("SELECT viewname, definition FROM pg_views WHERE schemaname='public' ORDER BY viewname").fetchall()
        result["triggers"] = db.execute("SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid), t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname").fetchall()
        result["invalid_constraints"] = db.execute("SELECT count(*) FROM pg_constraint x JOIN pg_namespace n ON n.oid=x.connamespace WHERE n.nspname='public' AND NOT x.convalidated").fetchone()[0]
        print(json.dumps(result, sort_keys=True))
'''


def audit(backend, database):
    output = execute(python_command(backend, database, ['-c', AUDIT, database]),
                     cwd=backend, capture_output=True, text=True).stdout
    try:
        result = json.loads(output)
        if result['invalid_constraints'] != 0 or result['versions'] not in (['0002'], ['0003']):
            raise ValueError
        return result
    except (ValueError, KeyError, TypeError):
        raise CampusMigrationError('Unexpected restored schema/version or invalid constraints.') from None


def compare(before, after):
    """Permit exactly one empty new table/sequence and Alembic version advance."""
    if before['versions'] not in (['0002'], ['0003']) or after['versions'] != ['0003']:
        raise CampusMigrationError('Unexpected migration version transition.')
    expected_additions = {TABLE} if before['versions'] == ['0002'] else set()
    if (set(after['tables']) - set(before['tables']) != expected_additions
            or set(before['tables']) - set(after['tables'])):
        raise CampusMigrationError('Migration added or removed an unexpected table.')
    if before['versions'] == ['0002'] and TABLE in before['tables']:
        raise CampusMigrationError('Campus table exists without the matching migration version.')
    for name, old_table in before['tables'].items():
        new_table = after['tables'][name]
        if name == 'alembic_version':
            old_table, new_table = dict(old_table), dict(new_table)
            for value in ('sha256',):
                old_table.pop(value)
                new_table.pop(value)
        if old_table != new_table:
            raise CampusMigrationError(f'Migration changed existing table {name}; activation refused.')
    if expected_additions and after['tables'][TABLE]['count'] != 0:
        raise CampusMigrationError('Migration unexpectedly created publication data.')
    old_sequences = {r[0]: r for r in before['sequences']}
    new_sequences = {r[0]: r for r in after['sequences']}
    added_sequences = {'published_campus_routes_id_seq'} if expected_additions else set()
    if set(new_sequences) - set(old_sequences) != added_sequences or any(
            new_sequences.get(name) != value for name, value in old_sequences.items()):
        raise CampusMigrationError('Migration changed existing sequence values/definitions.')
    for name in ('enums', 'views', 'triggers', 'invalid_constraints'):
        if before[name] != after[name] or after['invalid_constraints']:
            raise CampusMigrationError('Migration changed another existing schema object.')


def upgrade(backend, database):
    execute(python_command(backend, database, ['-m', 'alembic', 'upgrade', '0003']),
            cwd=backend, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    execute(python_command(backend, database, ['-m', 'alembic', 'check']),
            cwd=backend, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def verify_restore(old, new, backup, state):
    database = 'team43_campus_' + uuid.uuid4().hex[:12] + '_restore'
    restore(backup, database)
    before = audit(old, database)
    if before['versions'] == ['0002']:
        execute(python_command(old, database, ['-m', 'alembic', 'check']),
                cwd=old, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    upgrade(new, database)
    after = audit(new, database)
    compare(before, after)
    # Retain evidence privately; no row contents are written into these manifests.
    report = {'backup': str(backup), 'sha256': hashlib.sha256(backup.read_bytes()).hexdigest(),
              'restore_database': database, 'before': before, 'after': after}
    with (state / (database + '.json')).open('x', encoding='utf-8') as output:
        json.dump(report, output, sort_keys=True)
    (state / (database + '.json')).chmod(0o600)
    print(f'Restore/migration rehearsal passed: {database}; preserved {len(before["tables"])} tables.', flush=True)
    return before


def rehearse(old, new, state, postgres_snapshot):
    backup = state / ('campus-rehearsal-' + uuid.uuid4().hex + '.dump')
    postgres_snapshot(backup)
    verify_restore(old, new, backup, state)
    database = 'team43_campus_' + uuid.uuid4().hex[:12] + '_test'
    create_database(database)
    execute(python_command(new, database, ['-m', 'alembic', 'upgrade', '0003']),
            cwd=new, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    execute(python_command(new, database, ['-m', 'alembic', 'check']),
            cwd=new, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    execute(python_command(new, database, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider'], tests=True),
            cwd=new, timeout=310)
    print(f'PostgreSQL API tests passed on disposable database: {database}', flush=True)


def activate(old, new, backup, state):
    """Caller holds deployment lock and has stopped service/final dump completed."""
    restored = verify_restore(old, new, backup, state)
    before = audit(old, 'team43')
    if before != restored:
        raise CampusMigrationError('Final restored backup differs from stopped production; activation refused.')
    upgrade(new, 'team43')
    compare(before, audit(new, 'team43'))
    print('Live campus migration verified; existing tables and data preserved.', flush=True)
