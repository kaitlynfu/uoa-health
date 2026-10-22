"""Explicit one-time activation of the rehearsed 0004 -> 0005 readiness release.

Run the verified root-owned copy with --activate. No cloud access, helper/config
replacement, database reset/downgrade, seeding, or removal of recovery evidence.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
import uuid

COMMIT = '5968a9a50947d1346a66acc279a962cd93fd503a'
ARCHIVE_SHA = '5c5dfd3398fe33b063e513903e058beb737d26ec0d1e3571ca6b8ac7c4281b7a'
ARCHIVE = Path('/tmp/team43-readiness.MPtpo3.tar.gz')
OLD = Path('/opt/team43/releases/a73c53ccc63b657a5d3b3c288589767856cc0ff0-zpi78kuh/backend')
OLD_MODELS = 'ca29c7f0fd97c2735abc60374aab612602857190ccff75c1a48a126615103035'
NEW_MODELS = '7674473f438e2ab9b3add716fc6b1bb28e72679d894caa61e171955c9dd8de11'
PINS = {'team43-deploy-backend': {'ac1f8b68e600d4ef0052d7ec3c5b202e6e07d02a7a278dfd3063b1694a01220e'},
        'team43_campus_postgres.py': {'d87f5fbbd8ff6d1c4bc7c6eb8e72772c0b171dbea8049bbdecc5506c9590d536'},
        'team43_database.py': {'07186a579a9222f9161ff9a0630957312a446a68e09262126c44b25d641e4b70',
                              '1b02b81788b4e20d615c67b93f3c7e86af46223ab0ceefe55e61310dba43a357'}}
NEW_TABLES = {'blocked_users', 'safety_reports', 'account_email_tokens', 'verified_emails',
              'notification_preferences', 'request_limits', 'deleted_accounts', 'profile_photos'}
SOCKET_URL = 'postgresql+psycopg://ubuntu@/{}?host=/var/run/postgresql'


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def digest(path):
    return hashlib.sha256(Path(path).read_text(encoding='utf-8').encode()).hexdigest()


def root_file(path):
    info = Path(path).lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
            'Expected a non-writable root-owned regular file: ' + str(path))


def unpack(data, release):
    require(hashlib.sha256(data).hexdigest() == ARCHIVE_SHA, 'Backend archive checksum differs.')
    total, seen = 0, set()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for number, member in enumerate(archive):
            path = PurePosixPath(member.name)
            require(number < 5000 and not path.is_absolute() and '..' not in path.parts
                    and '\\' not in member.name and path.parts and path.parts[0] in ('backend', 'docs')
                    and path not in seen and (member.isdir() or member.isfile()), 'Unsafe archive entry.')
            seen.add(path)
            total += member.size
            require(total <= 100 * 1024**2, 'Archive is too large.')
            target = release.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, target.open('xb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o644)
    # Root's private umask must not make application directories unreadable to
    # the unprivileged service. Recovery folders remain private separately.
    for folder in release.rglob('*'):
        if folder.is_dir():
            folder.chmod(0o755)


AUDIT = r'''
import json, re, sys
from sqlalchemy import create_engine, text
from scripts.rehearse_social_postgres import snapshot
name = sys.argv[1]
assert name == 'team43' or re.fullmatch(r'team43_readiness_[a-f0-9]{12}_final', name)
engine = create_engine('postgresql+psycopg://ubuntu@/' + name + '?host=/var/run/postgresql')
with engine.connect() as db:
    db.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
    db.execute(text("SET LOCAL statement_timeout = '30s'"))
    assert db.scalar(text('SELECT current_database()')) == name
    columns = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
    print(json.dumps({'versions': db.execute(text('SELECT version_num FROM alembic_version')).scalars().all(),
                      'tables': snapshot(db, columns)}, sort_keys=True))
engine.dispose()
'''


def candidate(installer, backend, database, arguments, timeout=120):
    require(database == 'team43' or re.fullmatch(r'team43_readiness_[a-f0-9]{12}_final', database),
            'Unexpected database target.')
    environment = ['PATH=/usr/bin:/bin', 'HOME=/home/ubuntu', 'PYTHONDONTWRITEBYTECODE=1',
                   'PGPASSFILE=/dev/null', 'PGCONNECT_TIMEOUT=5',
                   'PGOPTIONS=-c lock_timeout=10000 -c statement_timeout=60000',
                   'DATABASE_URL=' + SOCKET_URL.format(database)]
    return installer.run(['/usr/bin/timeout', '--kill-after=5', str(timeout),
                          '/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/env', '-i',
                          *environment, str(backend / '.venv/bin/python'), *arguments],
                         cwd=backend, capture_output=True, text=True, timeout=timeout + 10).stdout


def audit(installer, backend, database, columns=None):
    args = ['-c', AUDIT, database]
    if columns is not None:
        args.append(json.dumps(columns))
    return json.loads(candidate(installer, backend, database, args))


def upgrade(installer, backend, database):
    candidate(installer, backend, database, ['-m', 'alembic', 'upgrade', '0005'])
    candidate(installer, backend, database, ['-m', 'alembic', 'check'])


def unchanged(before, after, version):
    require(after['versions'] == [version] and before['tables'] == after['tables'],
            'Original database rows or columns changed; activation stopped.')


def restore(installer, backup, name):
    require(re.fullmatch(r'team43_readiness_[a-f0-9]{12}_final', name), 'Unsafe restore target.')
    installer.run(['/usr/bin/timeout', '--kill-after=5', '20', '/usr/sbin/runuser',
                   '-u', 'postgres', '--', '/usr/bin/createdb', '--no-password',
                   '--host=/var/run/postgresql', '--template=template0', '--owner=ubuntu', name],
                  capture_output=True, timeout=30)
    with backup.open('rb', buffering=0) as source:
        require(source.read(5) == b'PGDMP', 'Invalid final backup.')
        source.seek(0)
        installer.run(['/usr/bin/timeout', '--kill-after=5', '110',
                       '/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/pg_restore',
                       '--host=/var/run/postgresql', '--no-password', '--no-owner', '--no-acl',
                       '--exit-on-error', '--single-transaction', '--dbname=' + name],
                      stdin=source, capture_output=True, timeout=120)


def authenticated_routes():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for path in ('/social/groups', '/social/messages/inbox', '/navigation/campus/catalog',
                 '/account/export', '/auth/email/status', '/notifications', '/social/reports', '/profile/me/photo'):
        try:
            with opener.open('http://127.0.0.1:8000' + path, timeout=5):
                pass
        except urllib.error.HTTPError as error:
            try:
                require(error.code == 401, 'New/campus endpoint authentication check failed.')
            finally:
                error.close()
        else:
            raise ReleaseError('Endpoint incorrectly allowed an unauthenticated request.')


def verify_capabilities():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open('http://127.0.0.1:8000/capabilities', timeout=5) as response:
        capabilities = json.load(response)
    require(all(type(capabilities.get(key)) is int and capabilities[key] >= 1
                for key in ('account_management', 'social_safety', 'notifications')),
            'Required frontend capabilities are missing.')


def activate_prepared(installer, database, backend, recovery, before_health):
    previous = installer.DROPIN.read_bytes()
    (recovery / 'previous-service.conf').write_bytes(previous)
    backup = recovery / 'before-readiness.dump'
    stopped = False
    try:
        stopped = True
        installer.run(['systemctl', 'stop', installer.SERVICE])
        count = database.postgres_snapshot(backup)
        require(count == before_health['programmes'], 'Programme count changed before activation.')
        before = audit(installer, backend, 'team43')
        require(before['versions'] == ['0004'], 'Live revision changed before activation.')
        require(not NEW_TABLES.intersection(before['tables']), 'Readiness tables already present; inspect before retrying.')
        columns = {name: value['columns'] for name, value in before['tables'].items()}
        name = 'team43_readiness_' + uuid.uuid4().hex[:12] + '_final'
        restore(installer, backup, name)
        unchanged(before, audit(installer, backend, name), '0004')
        upgrade(installer, backend, name)
        unchanged(before, audit(installer, backend, name, columns), '0005')
        full = audit(installer, backend, name)
        require(set(full['tables']) == set(before['tables']) | NEW_TABLES
                and all(full['tables'][table]['count'] == 0 for table in NEW_TABLES),
                'Unexpected schema/new data after the final restore rehearsal.')
        unchanged(before, audit(installer, backend, 'team43'), '0004')
        print('Final backup restore and original-row preservation verified.', flush=True)
        upgrade(installer, backend, 'team43')
        unchanged(before, audit(installer, backend, 'team43', columns), '0005')
        installer.switch_service(backend)
        health = installer.wait_healthy(count)
        actual = installer.run(['systemctl', 'show', installer.SERVICE, '-p', 'WorkingDirectory', '--value'],
                               capture_output=True, text=True).stdout.strip()
        require(Path(actual) == backend, 'Active service does not use the candidate release.')
        database.confirm_active_database('postgresql')
        authenticated_routes()
        verify_capabilities()
        result = {'commit': COMMIT, 'backend': str(backend), 'revision': '0005', 'health': health,
                  'backup': str(backup), 'backup_sha256': hashlib.sha256(backup.read_bytes()).hexdigest(),
                  'verified_restore_database': name, 'recovery': str(recovery)}
        (recovery / 'activated.json').write_text(json.dumps(result, sort_keys=True))
    except BaseException:
        if stopped:
            print('Activation stopped; restoring previous app code. Database/backup retained.', flush=True)
            try:
                installer.restore_service(previous)
                installer.wait_healthy(before_health['programmes'])
            except BaseException:
                raise ReleaseError('Code rollback needs operator recovery. Do not retry; inspect ' + str(recovery)) from None
        raise
    print('READINESS ACTIVATION PASSED', flush=True)
    print(json.dumps(result, sort_keys=True), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--activate', action='store_true', required=True)
    parser.parse_args()
    require(os.geteuid() == 0, 'Root required.')
    os.umask(0o077)
    root_file(__file__)
    for name, checksums in PINS.items():
        path = Path('/usr/local/sbin') / name
        root_file(path)
        require(digest(path) in checksums, 'Installed helper differs: ' + name)
    sys.path.insert(0, '/usr/local/sbin')
    import team43_database as database
    # The extensionless installed helper needs an explicit source loader.
    from importlib.machinery import SourceFileLoader
    spec = importlib.util.spec_from_loader('social_installer', SourceFileLoader('social_installer', '/usr/local/sbin/team43-deploy-backend'))
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    import fcntl
    for directory in (Path(__file__).parent, installer.STATE, installer.ROOT):
        info = directory.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
                'Expected a protected root-owned directory: ' + str(directory))
    lock = (installer.STATE / 'deployment.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    require(database.database_mode() == 'postgresql', 'Expected PostgreSQL.')
    database.confirm_active_database('postgresql')
    old = Path(installer.run(['systemctl', 'show', installer.SERVICE, '-p', 'WorkingDirectory', '--value'],
                             capture_output=True, text=True).stdout.strip())
    require(old == OLD and digest(old / 'app/models.py') == OLD_MODELS, 'Running baseline release changed.')
    root_file(installer.DROPIN)
    require(installer.DROPIN.read_text() == installer.override_content(old), 'Unexpected service override.')
    require(database.pg_scalar('SELECT version_num FROM alembic_version') == '0004', 'Expected baseline revision 0004.')
    before_health = installer.health()
    require(shutil.disk_usage(installer.ROOT).free >= 1536 * 1024**2, 'Insufficient free disk space.')
    # Read once before hash verification; never extract a subsequently swapped file.
    with ARCHIVE.open('rb') as source:
        data = source.read(20 * 1024**2 + 1)
    require(len(data) <= 20 * 1024**2, 'Backend archive too large.')
    release = Path(tempfile.mkdtemp(prefix=COMMIT + '-readiness-', dir=installer.ROOT))
    release.chmod(0o755)
    unpack(data, release)
    backend = release / 'backend'
    require(digest(backend / 'app/models.py') == NEW_MODELS, 'Unexpected readiness model.')
    # Keep every pre-existing migration and database configuration byte-equivalent.
    for relative in ('app/database.py', 'alembic.ini', 'migrations/env.py', 'migrations/script.py.mako'):
        require(digest(old / relative) == digest(backend / relative), 'Baseline configuration changed.')
    existing = {path.name for path in (old / 'migrations/versions').glob('*.py')}
    require(existing == {'0001_initial_application_schema.py', '0002_preserve_social_and_published_home_.py',
                         '0003_published_campus_routes.py', '0004_social_inbox_groups.py'}, 'Unexpected baseline migration history.')
    require({path.name for path in (backend / 'migrations/versions').glob('*.py')}
            == existing | {'0005_account_safety.py'}, 'Unexpected candidate revisions.')
    for name in existing:
        require(digest(old / 'migrations/versions' / name) == digest(backend / 'migrations/versions' / name),
                'Existing migration changed.')
    import pwd
    account = pwd.getpwnam('ubuntu')
    venv = backend / '.venv'
    venv.mkdir(mode=0o755)
    os.chown(venv, account.pw_uid, account.pw_gid)
    installer.as_ubuntu(backend, ['/usr/bin/python3', '-m', 'venv', venv], timeout=90)
    installer.as_ubuntu(backend, [venv / 'bin/python', '-m', 'pip', 'install', '-r', 'requirements.txt'])
    # Check the old production schema read-only while the app is still running.
    installer.as_ubuntu(old, [old / '.venv/bin/python', '-m', 'alembic', 'check'],
                        database_url=database.POSTGRES_URL)
    require(Path(installer.run(['systemctl', 'show', installer.SERVICE, '-p', 'WorkingDirectory', '--value'],
                               capture_output=True, text=True).stdout.strip()) == old,
            'Running release changed during preparation.')
    recovery = Path(tempfile.mkdtemp(prefix='readiness-activation-', dir=installer.STATE))
    (recovery / 'release.json').write_text(json.dumps({'previous_backend': str(old),
        'candidate_backend': str(backend), 'commit': COMMIT, 'backend_archive_sha256': ARCHIVE_SHA}))
    def interrupted(signum, frame):
        raise ReleaseError('Activation interrupted; inspect the recovery folder before retrying.')
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    print('Candidate prepared. Taking final backup before the reviewed migration.', flush=True)
    activate_prepared(installer, database, backend, recovery, before_health)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('READINESS ACTIVATION STOPPED: ' + (str(error) if isinstance(error, ReleaseError) else type(error).__name__),
              file=sys.stderr, flush=True)
        sys.exit(1)
