import os
import pytest
from scripts import seed_integration


def test_seed_refuses_external_database_url(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///must-not-be-used.db')
    class ForbiddenDirectory:
        def mkdir(self, **kwargs):
            raise AssertionError('Must refuse before touching the filesystem')
    monkeypatch.setattr(seed_integration, 'LOCAL_DIR', ForbiddenDirectory())
    with pytest.raises(SystemExit, match='Unset DATABASE_URL'):
        seed_integration.main()


def test_seed_preserves_existing_database_and_windows_inheritance(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)
    class ExistingDatabase:
        def exists(self):
            return True
        def open(self, *args):
            raise AssertionError('Must not open an existing database for writing')
    target = ExistingDatabase()
    calls = []
    class Directory:
        def mkdir(self, **kwargs):
            calls.append(kwargs)
    monkeypatch.setattr(seed_integration, 'LOCAL_DIR', Directory())
    monkeypatch.setattr(seed_integration, 'LOCAL_DB', target)
    with pytest.raises(SystemExit, match='preserved'):
        seed_integration.main()
    assert calls == [{'mode': 0o777 if os.name == 'nt' else 0o700, 'exist_ok': True}]
