"""Exercise PostgreSQL deployment orchestration without operating a real service."""
from pathlib import Path
from types import SimpleNamespace
import sys

import pytest

from test_migration_installer import installer


@pytest.mark.parametrize('failure', ['none', 'schema', 'dump', 'health'])
def test_postgres_deploy_keeps_database_and_rolls_back_code(tmp_path, monkeypatch, failure):
    old = tmp_path / 'old'
    old.mkdir()
    root = tmp_path / 'releases'
    state = tmp_path / 'state'
    dropin = tmp_path / 'release.conf'
    previous = installer.override_content(old).encode()
    dropin.write_bytes(previous)
    for name, value in [('ROOT', root), ('STATE', state), ('BASELINE', old), ('DROPIN', dropin),
                        ('DATABASE', tmp_path / 'absent-sqlite.db')]:
        monkeypatch.setattr(installer, name, value)
    monkeypatch.setattr(installer.os, 'geteuid', lambda: 0, raising=False)
    monkeypatch.setattr(installer.os, 'chown', lambda *args: None, raising=False)
    monkeypatch.setattr(installer.os, 'umask', lambda *args: 0)
    monkeypatch.setitem(sys.modules, 'fcntl', SimpleNamespace(flock=lambda *args: None, LOCK_EX=1, LOCK_NB=2))
    monkeypatch.setitem(sys.modules, 'pwd', SimpleNamespace(getpwnam=lambda _: SimpleNamespace(pw_uid=1000, pw_gid=1000)))
    monkeypatch.setattr(installer.shutil, 'disk_usage', lambda _: SimpleNamespace(free=3 * 1024**3))
    monkeypatch.setattr(installer, 'database_mode', lambda: 'postgresql')
    monkeypatch.setattr(installer, 'confirm_active_database', lambda mode: None)
    monkeypatch.setattr(installer, 'validate_inputs', lambda *args: None)
    monkeypatch.setattr(installer, 'download', lambda *args: None)
    monkeypatch.setattr(installer, 'extract', lambda archive, release: (release / 'backend').mkdir())
    monkeypatch.setattr(installer, 'require_same_postgres_schema', lambda *args: None)
    # This fixture exercises an ordinary code-only release, not the separately
    # hash-pinned campus migration (covered by deployment/test_campus_postgres.py).
    monkeypatch.setattr(installer.campus_postgres, 'reviewed_transition', lambda *args: False)
    monkeypatch.setattr(installer, 'health', lambda: {'programmes': 9})
    events = []

    def run(command, **kwargs):
        events.append(tuple(command))
        return SimpleNamespace(stdout=str(old) if command[1] == 'show' else '')
    monkeypatch.setattr(installer, 'run', run)

    def prepare(backend, args, **kwargs):
        if 'alembic' in args:
            assert args[-1] == 'check'
            assert kwargs['database_url'] == installer.POSTGRES_URL
            if failure == 'schema':
                raise RuntimeError('schema mismatch')
    monkeypatch.setattr(installer, 'as_ubuntu', prepare)

    def dump(path):
        assert ('systemctl', 'stop', installer.SERVICE) in events
        if failure == 'dump':
            raise RuntimeError('dump failed')
        path.write_bytes(b'PGDMPsynthetic')
        return 9
    monkeypatch.setattr(installer, 'postgres_snapshot', dump)
    health_calls = []
    def healthy(count):
        health_calls.append(count)
        if failure == 'health' and len(health_calls) == 1:
            raise RuntimeError('candidate unhealthy')
        return {'programmes': count}
    monkeypatch.setattr(installer, 'wait_healthy', healthy)

    if failure == 'none':
        installer.deploy('a' * 40, 'b' * 64, 'unused')
        assert dropin.read_bytes() != previous
    else:
        with pytest.raises(Exception):
            installer.deploy('a' * 40, 'b' * 64, 'unused')
        assert dropin.read_bytes() == previous
    assert not installer.DATABASE.exists()
    assert (('systemctl', 'stop', installer.SERVICE) in events) == (failure != 'schema')
    if failure in ('none', 'health'):
        assert list(state.glob('database-*.dump'))
