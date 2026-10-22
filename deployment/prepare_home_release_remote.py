"""Explicitly approved host preparation; does not migrate or restart the app.

Caller substitutes the tested installer bytes for HELPER_BASE64. Run as root.
"""
import base64
import fcntl
import hashlib
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile

helper = Path('/usr/local/sbin/team43-deploy-backend')
dropin = Path('/etc/systemd/system/team43-api.service.d/60-team43-route-editors.conf')
state = Path('/var/lib/team43-deployment')
code = base64.b64decode('__HELPER_BASE64__')
compile(code, str(helper), 'exec')
with (state/'deployment.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    assert not helper.is_symlink() and helper.is_file(), 'Unexpected helper target'
    assert hashlib.sha256(helper.read_bytes()).hexdigest() == '9ef2bd3c3649bccd8ae1654eafb3fd4ed4a46f66a61981c69f66f0e44d0db861', 'Installed helper changed'
    assert not dropin.exists() and not dropin.is_symlink(), 'Editor configuration already exists; inspect before retry'
    with sqlite3.connect('file:/var/lib/team43/health_app_v2.db?mode=ro', uri=True) as db:
        assert db.execute('SELECT id FROM users WHERE email=?', ('test@example.test',)).fetchall() == [(1,)], 'Account identity changed'
    recovery = Path(tempfile.mkdtemp(prefix='home-release-helper-', dir=state))
    shutil.copy2(helper, recovery/'previous-helper')
    staged = recovery/'new-helper'
    staged.write_bytes(code)
    staged.chmod(0o755)
    # Prepare both files before activating either. Existing backend ignores this new permission.
    configuration = recovery/'editor-config'
    configuration.write_text('[Service]\nEnvironment="TEAM43_ROUTE_EDITOR_USER_IDS=1"\n')
    configuration.chmod(0o644)
    dropin.parent.mkdir(parents=True, exist_ok=True)
    os.replace(staged, helper)
    os.replace(configuration, dropin)
    print('Installed helper SHA256:', hashlib.sha256(helper.read_bytes()).hexdigest())
    print('Previous helper preserved:', recovery/'previous-helper')
    print('Editor configuration prepared for account ID 1 only; applies on the next deployment restart.')
    print('No live database migration, daemon reload or service restart performed.')
