import importlib.util
from pathlib import Path
import sqlite3
import sys
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from app.models import Base

INSTALLER = Path(__file__).resolve().parents[2] / 'deployment/team43_deploy_backend.py'
if not INSTALLER.is_file():
    pytest.skip('Deployment assets are tested in full-checkout CI, not the backend-only archive.', allow_module_level=True)
spec = importlib.util.spec_from_file_location('migration_installer', INSTALLER)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
SOCIAL = {'friendships', 'groups', 'group_members', 'messages'}
LATER_TABLES = {'published_home_routes', 'published_campus_routes', 'saved_groups', 'message_reads',
    'blocked_users','safety_reports','account_email_tokens','verified_emails',
    'notification_preferences','request_limits','deleted_accounts','profile_photos'}


def original(path):
    engine = create_engine('sqlite:///' + path.as_posix())
    # Reproduce the pre-social schema, not tables introduced by later features.
    Base.metadata.create_all(engine, tables=[t for t in Base.metadata.sorted_tables if t.name not in SOCIAL | LATER_TABLES])
    engine.dispose()


def test_known_migration_and_retry_preserve_rows(tmp_path):
    path = tmp_path / 'test.db'
    original(path)
    installer.migrate_social(path)
    with sqlite3.connect(path) as db:
        assert installer.schema_digest(db) == installer.NEW_SCHEMA
        db.execute("INSERT INTO groups VALUES(1,'Preserve on retry','2026-09-13')")
    installer.migrate_social(path)
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT name FROM groups').fetchall() == [('Preserve on retry',)]


def test_unknown_schema_refused(tmp_path):
    path = tmp_path / 'test.db'
    original(path)
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE unexpected(id INTEGER)')
    with pytest.raises(installer.DeploymentError, match='Unrecognised'):
        installer.migrate_social(path)
    with sqlite3.connect(path) as db:
        assert not db.execute("SELECT 1 FROM sqlite_master WHERE name='groups'").fetchall()


def test_mid_migration_failure_rolls_back(tmp_path):
    path = tmp_path / 'test.db'
    original(path)
    with patch.object(installer, 'SOCIAL_SQL', installer.SOCIAL_SQL.split(';')[0] + '; INVALID SQL;'):
        with pytest.raises(sqlite3.OperationalError):
            installer.migrate_social(path)
    with sqlite3.connect(path) as db:
        assert installer.schema_digest(db) == installer.OLD_SCHEMA


def test_transition_rejects_unreviewed_change(tmp_path):
    for name in ('old', 'new'):
        (tmp_path / name / 'app').mkdir(parents=True)
        for relative in ('models.py', 'database.py'):
            (tmp_path / name / 'app' / relative).write_text('same')
    assert not installer.reviewed_transition(tmp_path / 'old', tmp_path / 'new')
    (tmp_path / 'new/app/models.py').write_text('unknown change')
    with pytest.raises(installer.DeploymentError):
        installer.reviewed_transition(tmp_path / 'old', tmp_path / 'new')


@pytest.mark.parametrize('failure', ['none', 'prepare', 'rehearsal', 'live_migration', 'activation', 'health', 'restore'])
def test_deployment_service_lifecycle(tmp_path, monkeypatch, failure):
    """Real temporary SQLite migration/backups; no actual network/systemd calls."""
    root = tmp_path / 'releases'
    state = tmp_path / 'state'
    old = tmp_path / 'baseline'
    dropin = tmp_path / 'service' / 'override.conf'
    database = tmp_path / 'production.db'
    old.mkdir()
    dropin.parent.mkdir()
    dropin.write_text(installer.override_content(old))
    previous = dropin.read_bytes()
    original(database)
    for key, value in [('ROOT', root), ('STATE', state), ('BASELINE', old), ('DROPIN', dropin), ('DATABASE', database)]:
        monkeypatch.setattr(installer, key, value)
    monkeypatch.setattr(installer.os, 'geteuid', lambda: 0, raising=False)
    monkeypatch.setattr(installer.os, 'chown', lambda *args: None, raising=False)
    monkeypatch.setattr(installer.os, 'umask', lambda *args: 0)
    monkeypatch.setitem(sys.modules, 'fcntl', SimpleNamespace(flock=lambda *args: None, LOCK_EX=1, LOCK_NB=2))
    monkeypatch.setitem(sys.modules, 'pwd', SimpleNamespace(getpwnam=lambda name: SimpleNamespace(pw_uid=1000, pw_gid=1000)))
    monkeypatch.setattr(installer.shutil, 'disk_usage', lambda path: SimpleNamespace(free=3*1024**3))
    monkeypatch.setattr(installer, 'validate_inputs', lambda *args: None)
    monkeypatch.setattr(installer, 'database_mode', lambda: 'sqlite')
    monkeypatch.setattr(installer, 'confirm_active_database', lambda mode: None)
    monkeypatch.setattr(installer, 'download', lambda *args: None)
    monkeypatch.setattr(installer, 'extract', lambda archive, release: (release / 'backend').mkdir())
    monkeypatch.setattr(installer, 'reviewed_transition', lambda *args: True)
    monkeypatch.setattr(installer, 'health', lambda: {'programmes': 0})
    events = []
    starts = 0
    def run(command, **kwargs):
        nonlocal starts
        events.append(tuple(command))
        if command[1] == 'show':
            return SimpleNamespace(stdout=str(old))
        if command[1] == 'start':
            starts += 1
            if failure == 'activation' and starts == 1:
                raise RuntimeError('simulated service start failure')
            if failure == 'restore' and starts == 2:
                raise RuntimeError('simulated rollback start failure')
        return SimpleNamespace(stdout='')
    monkeypatch.setattr(installer, 'run', run)
    def prepare(*args, **kwargs):
        if failure == 'prepare':
            raise RuntimeError('candidate tests failed')
    monkeypatch.setattr(installer, 'as_ubuntu', prepare)
    migrate = installer.migrate_social
    def migration(path):
        events.append(('migrate', path.name))
        assert ('systemctl', 'stop', installer.SERVICE) in events
        assert list(state.glob('database-*.sqlite3')), 'backup must precede migration'
        if failure == 'rehearsal' and path != database:
            raise RuntimeError('rehearsal failed')
        if failure == 'live_migration' and path == database:
            raise RuntimeError('live migration refused')
        migrate(path)
    monkeypatch.setattr(installer, 'migrate_social', migration)
    checks = 0
    def healthy(count):
        nonlocal checks
        checks += 1
        if failure in ('health', 'restore') and checks == 1:
            # Simulate data arriving after activation: rollback must not restore
            # the pre-migration backup over this write.
            with sqlite3.connect(database) as db:
                db.execute("INSERT INTO groups VALUES(1,'New write','2026-09-13')")
            raise RuntimeError('new release health failure')
        return {'programmes': count}
    monkeypatch.setattr(installer, 'wait_healthy', healthy)
    if failure == 'none':
        installer.deploy('a'*40, 'b'*64, 'unused')
        assert dropin.read_bytes() != previous
    else:
        with pytest.raises(Exception) as caught:
            installer.deploy('a'*40, 'b'*64, 'unused')
        if failure == 'restore':
            assert isinstance(caught.value, installer.DeploymentError)
            assert 'operator recovery required' in str(caught.value)
        assert dropin.read_bytes() == previous
    stopped = ('systemctl', 'stop', installer.SERVICE) in events
    assert stopped == (failure != 'prepare')
    with sqlite3.connect(database) as db:
        assert installer.schema_digest(db) == (installer.OLD_SCHEMA if failure in ('prepare','rehearsal','live_migration') else installer.NEW_SCHEMA)
        if failure in ('health', 'restore'):
            assert db.execute('SELECT name FROM groups').fetchall() == [('New write',)]
    if failure != 'prepare':
        with sqlite3.connect(next(state.glob('database-*.sqlite3'))) as db:
            assert installer.schema_digest(db) == installer.OLD_SCHEMA
    if failure == 'rehearsal':
        assert ('migrate', database.name) not in events
