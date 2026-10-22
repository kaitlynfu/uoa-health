#!/usr/bin/python3
"""Root-owned, fixed-entry-point installer for the Team 43 test backend.

Called by Team43-DeployBackend with commit, SHA256, and a short-lived S3 URL.
No seeds are run. Hash-pinned additive transitions require a fresh backup and
isolated rehearsal. PostgreSQL supports only the reviewed campus 0002 -> 0003
transition; other changed schemas remain blocked.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
from team43_database import (
    database_mode, confirm_active_database, postgres_snapshot, POSTGRES_URL, DatabaseError,
)
import team43_campus_postgres as campus_postgres


ROOT = Path('/opt/team43/releases')
STATE = Path('/var/lib/team43-deployment')
DATABASE = Path('/var/lib/team43/health_app_v2.db')
DROPIN = Path('/etc/systemd/system/team43-api.service.d/50-team43-release.conf')
BASELINE = Path('/home/ubuntu/team43-app/backend')
SERVICE = 'team43-api.service'
BUCKET_HOST = 'team43-deploy-467506935568-ap-southeast-2.s3.ap-southeast-2.amazonaws.com'
MAX_DOWNLOAD = 20 * 1024 * 1024
MAX_EXTRACTED = 100 * 1024 * 1024
SCHEMA_FILES = ('app/models.py', 'app/database.py')
OLD_MODELS = '4eccaff369bd708c61a3e740a158ebf9fa96cdbb123dc7541762e4a89b3e62da'
NEW_MODELS = '230f56e7c89aac6b89e51cbe9d29a8850c17744c4dc5c2867dd127da4b0b5f3a'
DATABASE_CODE = '6f38172bc9879131b293d8db4c3089e6d32dcc2fa239b97f63f2f781a8d9197e'
OLD_SCHEMA = '3cafa4f41b0f147d064c6be193d965662474392eccb3504e6a73d28870c24b2b'
NEW_SCHEMA = '1412ad252a72bd006e4cfe8ba948774ddc83914687f0a7845c8371459e686a7b'
HOME_MODELS = '700650b0eda19340094f50f2026c7fdfecdf5dc2d99dafd89edac3df215f73fa'
HOME_SCHEMA = 'ff7cdea77e16d6e8012640407dfd754670c653674347f5bb8d1fb9c8ce78e654'
HOME_SQL = '''
CREATE TABLE published_home_routes (
    id INTEGER NOT NULL PRIMARY KEY,
    destination VARCHAR(80) NOT NULL,
    revision INTEGER NOT NULL,
    points_json TEXT NOT NULL,
    editor_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL,
    UNIQUE (destination, revision)
);
CREATE INDEX ix_published_home_routes_destination ON published_home_routes(destination);
'''
SOCIAL_SQL = '''
-- DRAFT: review and rehearse against a verified production snapshot first.
-- No seeds, drops, updates or automatic execution. The deployment guard stays on.
CREATE TABLE friendships (
 id INTEGER NOT NULL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 friend_id INTEGER NOT NULL REFERENCES users(id),
 status VARCHAR(8) NOT NULL,
 created_at DATETIME NOT NULL,
 CONSTRAINT uq_user_friend UNIQUE(user_id, friend_id)
);
CREATE TABLE groups (
 id INTEGER NOT NULL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 created_at DATETIME NOT NULL
);
CREATE TABLE group_members (
 id INTEGER NOT NULL PRIMARY KEY,
 group_id INTEGER NOT NULL REFERENCES groups(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 role VARCHAR(6) NOT NULL,
 joined_at DATETIME NOT NULL,
 CONSTRAINT uq_group_user UNIQUE(group_id, user_id)
);
CREATE TABLE messages (
 id INTEGER NOT NULL PRIMARY KEY,
 sender_id INTEGER NOT NULL REFERENCES users(id),
 recipient_id INTEGER REFERENCES users(id),
 group_id INTEGER REFERENCES groups(id),
 content VARCHAR(2000) NOT NULL,
 created_at DATETIME NOT NULL
);
'''


class DeploymentError(Exception):
    pass


def validate_inputs(commit, checksum, url):
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise DeploymentError('Invalid commit ID.')
    if not re.fullmatch(r'[a-f0-9]{64}', checksum):
        raise DeploymentError('Invalid archive checksum.')
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.netloc != BUCKET_HOST
            or parsed.path != f'/backend/releases/{commit}/backend.tar.gz'
            or parsed.fragment or not parsed.query
            or not re.fullmatch(r'[A-Za-z0-9%&=_.~-]+', parsed.query)):
        raise DeploymentError('Download URL is not the expected private release object.')
    query = urllib.parse.parse_qs(parsed.query)
    if query.get('X-Amz-Algorithm') != ['AWS4-HMAC-SHA256'] or not query.get('X-Amz-Signature'):
        raise DeploymentError('A SigV4 signed download URL is required.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download(url, destination, checksum):
    # Never print this bearer URL, including in HTTP exception messages.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    digest = hashlib.sha256()
    total = 0
    try:
        with opener.open(url, timeout=30) as response, destination.open('xb') as output:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_DOWNLOAD:
                    raise DeploymentError('Archive exceeds the download size limit.')
                digest.update(chunk)
                output.write(chunk)
    except DeploymentError:
        raise
    except Exception:
        raise DeploymentError('Private archive download failed; generate a fresh signed URL.') from None
    if digest.hexdigest() != checksum:
        raise DeploymentError('Archive checksum does not match. Live service unchanged.')


def extract(archive, target):
    """Accept only ordinary backend files/directories, never archive links/devices."""
    total = 0
    seen = set()
    with tarfile.open(archive, 'r:gz') as bundle:
        for index, member in enumerate(bundle):
            path = PurePosixPath(member.name)
            if (index >= 5000 or path.is_absolute() or '..' in path.parts
                    or '\\' in member.name or not path.parts or path.parts[0] != 'backend'
                    or not (member.isdir() or member.isfile())):
                raise DeploymentError('Archive contains an unsupported entry.')
            if ('.venv' in path.parts or '.git' in path.parts
                    or any(part.startswith('.env') and part != '.env.example' for part in path.parts)
                    or path.suffix in ('.db', '.sqlite', '.sqlite3', '.pem', '.key')):
                raise DeploymentError('Archive must contain code, not secrets, databases or environments.')
            if path in seen:
                raise DeploymentError('Archive contains duplicate paths.')
            seen.add(path)
            total += member.size
            if total > MAX_EXTRACTED:
                raise DeploymentError('Archive exceeds the extracted size limit.')
            destination = target.joinpath(*path.parts)
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as source, destination.open('xb') as output:
                    shutil.copyfileobj(source, output)
                destination.chmod(0o644)
    for required in ('requirements.txt', 'app/main.py', 'app/models.py', 'app/database.py', 'tests/conftest.py'):
        if not (target / 'backend' / required).is_file():
            raise DeploymentError(f'Archive is missing backend/{required}.')


def require_same_schema_files(old, new):
    for relative in SCHEMA_FILES:
        # Treat line-ending-only differences as identical.
        if (old / relative).read_text().replace('\r\n', '\n') != (new / relative).read_text().replace('\r\n', '\n'):
            raise DeploymentError(f'{relative} changed. Review database migration manually before deploying.')


def require_same_postgres_schema(old, new):
    require_same_schema_files(old, new)
    def files(root):
        paths = {p.relative_to(root) for p in (root / 'migrations').rglob('*.py')}
        paths.update((Path('alembic.ini'), Path('migrations/script.py.mako')))
        if not any(str(p).replace('\\', '/').startswith('migrations/versions/') for p in paths):
            raise DeploymentError('PostgreSQL release is missing migration revisions.')
        return {str(p): (root / p).read_text() for p in paths}
    if files(old) != files(new):
        raise DeploymentError('PostgreSQL migration files changed; apply and review manually before deployment.')


def reviewed_transition(old, new):
    """Only this exact code transition can request the additive migration."""
    def digest(root, relative):
        return hashlib.sha256((root / relative).read_text().encode()).hexdigest()
    if (digest(old, 'app/models.py') == NEW_MODELS
            and digest(new, 'app/models.py') == HOME_MODELS
            and digest(old, 'app/database.py') == DATABASE_CODE
            and digest(new, 'app/database.py') == DATABASE_CODE):
        return 'home_routes'
    if (digest(old, 'app/models.py') == OLD_MODELS
            and digest(new, 'app/models.py') == NEW_MODELS
            and digest(old, 'app/database.py') == DATABASE_CODE
            and digest(new, 'app/database.py') == DATABASE_CODE):
        return True
    require_same_schema_files(old, new)
    return False


def schema_digest(db):
    # Reject hidden schema changes as well as columns/indexes/FKs.
    if db.execute("SELECT 1 FROM sqlite_master WHERE type IN ('trigger','view')").fetchone():
        raise DeploymentError('Unexpected database views or triggers.')
    names = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    def quote(name):
        return '"' + name.replace('"', '""') + '"'
    signature = {}
    for name in names:
        indexes = db.execute('PRAGMA index_list(' + quote(name) + ')').fetchall()
        if any(row[4] for row in indexes):
            raise DeploymentError('Unexpected partial index.')
        signature[name] = [db.execute('PRAGMA table_info(' + quote(name) + ')').fetchall(),
            sorted(row[2:] for row in db.execute('PRAGMA foreign_key_list(' + quote(name) + ')')),
            sorted((row[1], row[2], db.execute('PRAGMA index_info(' + quote(row[1]) + ')').fetchall()) for row in indexes)]
    # Include DDL so CHECK constraints, collations and other changes invisible
    # to table_info cannot masquerade as the reviewed schema.
    signature['__ddl__'] = [(kind, name, ' '.join(sql.split()) if sql else None)
        for kind, name, sql in db.execute('SELECT type,name,sql FROM sqlite_master ORDER BY type,name')]
    return hashlib.sha256(json.dumps(signature, sort_keys=True).encode()).hexdigest()


def migrate_social(database):
    """Caller must hold deployment lock, stop service and verify a fresh backup."""
    with sqlite3.connect(database.resolve().as_uri() + '?mode=rw', uri=True, timeout=10) as db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE')
        try:
            fingerprint = schema_digest(db)
            if fingerprint not in (OLD_SCHEMA, NEW_SCHEMA):
                raise DeploymentError('Unrecognised live schema; migration refused.')
            if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
                raise DeploymentError('Database integrity validation failed.')
            if fingerprint == OLD_SCHEMA:
                for statement in SOCIAL_SQL.split(';'):
                    if statement.strip():
                        db.execute(statement)
            # NEW_SCHEMA supports retry after application-code rollback, without
            # touching social rows written after a previous successful migration.
            if schema_digest(db) != NEW_SCHEMA or db.execute('PRAGMA foreign_key_check').fetchall():
                raise DeploymentError('Migrated schema validation failed.')
            db.commit()
        except BaseException:
            db.rollback()
            raise


def run(command, **kwargs):
    return subprocess.run(command, check=True, timeout=kwargs.pop('timeout', 90), **kwargs)


def migrate_home_routes(database):
    """Same locked, stopped-service, backup/rehearsal contract as social migration."""
    with sqlite3.connect(database.resolve().as_uri() + '?mode=rw', uri=True, timeout=10) as db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('BEGIN IMMEDIATE')
        try:
            fingerprint = schema_digest(db)
            if fingerprint not in (NEW_SCHEMA, HOME_SCHEMA):
                raise DeploymentError('Unrecognised live schema; home route migration refused.')
            if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
                raise DeploymentError('Database integrity validation failed.')
            if fingerprint == NEW_SCHEMA:
                for statement in HOME_SQL.split(';'):
                    if statement.strip(): db.execute(statement)
            if schema_digest(db) != HOME_SCHEMA or db.execute('PRAGMA foreign_key_check').fetchall():
                raise DeploymentError('Home route schema validation failed.')
            db.commit()
        except BaseException:
            db.rollback()
            raise


def as_ubuntu(backend, args, timeout=600, database_url='sqlite://'):
    environment = ['PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/home/ubuntu',
                   'PYTHONDONTWRITEBYTECODE=1', f'DATABASE_URL={database_url}',
                   'PIP_NO_CACHE_DIR=1', 'PIP_DISABLE_PIP_VERSION_CHECK=1']
    run(['/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/env', '-i',
         *environment, *map(str, args)], cwd=backend, timeout=timeout)


def health(expected_programmes=None):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open('http://127.0.0.1:8000/health', timeout=3) as response:
        result = json.load(response)
    if result.get('status') != 'healthy' or result.get('database') != 'connected':
        raise DeploymentError('Backend health check failed.')
    if expected_programmes is not None and result.get('programmes') != expected_programmes:
        raise DeploymentError('Programme count changed unexpectedly.')
    return result


def wait_healthy(count):
    for _ in range(20):
        try:
            return health(count)
        except Exception:
            time.sleep(2)
    raise DeploymentError('Backend failed its post-deployment health check.')


def override_content(backend):
    return (f'[Service]\nWorkingDirectory={backend}\nExecStart=\n'
            f'ExecStart={backend}/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000\n')


def switch_service(backend):
    DROPIN.parent.mkdir(parents=True, exist_ok=True)
    temporary = DROPIN.with_suffix('.tmp')
    temporary.write_text(override_content(backend))
    temporary.chmod(0o644)
    os.replace(temporary, DROPIN)
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'start', SERVICE])


def restore_service(previous):
    run(['systemctl', 'stop', SERVICE])
    if previous is None:
        DROPIN.unlink(missing_ok=True)
    else:
        DROPIN.write_bytes(previous)
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'start', SERVICE])


def deploy(commit, checksum, url):
    validate_inputs(commit, checksum, url)
    if os.geteuid() != 0:
        raise DeploymentError('Install and invoke this fixed helper as root via Systems Manager.')
    import fcntl
    import pwd

    os.umask(0o022)
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    ROOT.mkdir(mode=0o755, parents=True, exist_ok=True)
    lock = (STATE / 'deployment.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise DeploymentError('Another deployment is already running.') from None

    # Read actual systemd state rather than relying on a possibly stale marker file.
    old = Path(run(['systemctl', 'show', SERVICE, '-p', 'WorkingDirectory', '--value'],
                   capture_output=True, text=True).stdout.strip())
    if old != BASELINE and not old.is_relative_to(ROOT):
        raise DeploymentError('Unexpected service working directory; inspect configuration manually.')
    if DROPIN.exists() and DROPIN.read_text() != override_content(old):
        raise DeploymentError('Existing deployment override was edited; review it before deployment.')
    mode = database_mode()
    confirm_active_database(mode)
    if mode == 'sqlite' and not DATABASE.is_file():
        raise DeploymentError('Expected persistent database is missing.')
    before = health()
    if shutil.disk_usage(ROOT).free < 1536 * 1024 * 1024:
        raise DeploymentError('Less than 1.5 GiB free. Review old releases before retrying.')

    # Separate directory for each attempt; never overwrite a running/older release.
    release = Path(tempfile.mkdtemp(prefix=f'{commit}-', dir=ROOT))
    release.chmod(0o755)
    archive = release / 'backend.tar.gz'
    print(f'Preparing release {commit}', flush=True)
    download(url, archive, checksum)
    extract(archive, release)
    backend = release / 'backend'
    if mode == 'postgresql':
        campus_migration = campus_postgres.reviewed_transition(old, backend)
        if not campus_migration:
            require_same_postgres_schema(old, backend)
        needs_migration = False
    else:
        needs_migration = reviewed_transition(old, backend)
    account = pwd.getpwnam('ubuntu')
    venv = backend / '.venv'
    venv.mkdir(mode=0o755)
    os.chown(venv, account.pw_uid, account.pw_gid)
    as_ubuntu(backend, ['/usr/bin/python3', '-m', 'venv', venv], timeout=90)
    python = venv / 'bin/python'
    as_ubuntu(backend, [python, '-m', 'pip', 'install', '-r', 'requirements.txt'])
    as_ubuntu(backend, [python, '-m', 'pytest', '-q', '-p', 'no:cacheprovider'], timeout=180)
    if mode == 'postgresql':
        if campus_migration:
            campus_postgres.rehearse(old, backend, STATE, postgres_snapshot)
        else:
            as_ubuntu(backend, [python, '-m', 'alembic', 'check'], database_url=POSTGRES_URL)
    # Candidate now prepared; only this short phase interrupts service.
    previous = DROPIN.read_bytes() if DROPIN.exists() else None
    extension = 'dump' if mode == 'postgresql' else 'sqlite3'
    backup = STATE / f'database-{commit}-{time.time_ns()}.{extension}'
    try:
        run(['systemctl', 'stop', SERVICE])
        if mode == 'postgresql':
            count = postgres_snapshot(backup)
            if campus_migration:
                campus_postgres.activate(old, backend, backup, STATE)
        else:
            with sqlite3.connect(f'file:{DATABASE}?mode=ro', uri=True) as source:
                with sqlite3.connect(backup) as destination:
                    source.backup(destination)
                    if destination.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                        raise DeploymentError('Database backup integrity check failed.')
                    count = source.execute('SELECT COUNT(*) FROM programmes').fetchone()[0]
        backup.chmod(0o600)
        if needs_migration:
            # Rehearse on a separate restored file before live apply.
            rehearsal = STATE / f'rehearsal-{commit}-{time.time_ns()}.sqlite3'
            with sqlite3.connect(backup.resolve().as_uri() + '?mode=ro', uri=True) as source:
                with sqlite3.connect(rehearsal) as destination:
                    source.backup(destination)
            rehearsal.chmod(0o600)
            migration = migrate_home_routes if needs_migration == 'home_routes' else migrate_social
            migration(rehearsal)
            migration(DATABASE)
        switch_service(backend)
        result = wait_healthy(count)
    except Exception:
        print('Deployment failed. Restoring previous service configuration.', flush=True)
        try:
            restore_service(previous)
            wait_healthy(before['programmes'])
        except Exception:
            raise DeploymentError('Automatic service rollback failed. Database and backup retained; operator recovery required. Do not retry deployment until service state is inspected.') from None
        # Deliberately do not overwrite the database: it could contain new user writes.
        raise DeploymentError('Previous code restored. Database retained; inspect logs before retrying.') from None
    print(json.dumps({'release': commit, 'health': result, 'database_backup': str(backup)}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('commit')
    parser.add_argument('checksum')
    parser.add_argument('download_url')
    args = parser.parse_args()
    def interrupted(signum, frame):
        raise DeploymentError('Deployment interrupted; inspect service status before retrying.')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        deploy(args.commit, args.checksum, args.download_url)
    except Exception as error:
        # Avoid including potentially sensitive URLs from library exceptions.
        message = str(error) if isinstance(error, (DeploymentError, DatabaseError, campus_postgres.CampusMigrationError)) else type(error).__name__
        print(f'Deployment failed: {message}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
