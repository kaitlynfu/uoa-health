"""Run on the AWS host via stdin; only writes private backup/rehearsal copies.

Replace HELPER_BASE64 with the reviewed installer source before invocation.
Does not install a helper, restart a service, or mutate the live database.
"""
import base64
import hashlib
from pathlib import Path
import sqlite3
import tempfile

HELPER_BASE64 = '__HELPER_BASE64__'
namespace = {'__name__': 'reviewed_installer'}
exec(compile(base64.b64decode(HELPER_BASE64), '<reviewed installer>', 'exec'), namespace)
source_path = Path('/var/lib/team43/health_app_v2.db')
root = Path('/var/lib/team43-deployment')
with sqlite3.connect(source_path.as_uri()+'?mode=ro', uri=True) as source:
    assert namespace['schema_digest'](source) == namespace['NEW_SCHEMA'], 'Unexpected live schema'
    directory = Path(tempfile.mkdtemp(prefix='home-routes-rehearsal-', dir=root))
    backup = directory/'backup.sqlite3'
    with sqlite3.connect(backup) as target: source.backup(target)
backup.chmod(0o600)
rehearsal = directory/'rehearsal.sqlite3'
with sqlite3.connect(backup.as_uri()+'?mode=ro', uri=True) as source:
    with sqlite3.connect(rehearsal) as target: source.backup(target)
rehearsal.chmod(0o600)

def snapshot(path):
    with sqlite3.connect(path.as_uri()+'?mode=ro', uri=True) as db:
        result = {}
        for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
            quoted = '"'+name.replace('"','""')+'"'
            rows = sorted(repr(row) for row in db.execute('SELECT * FROM '+quoted))
            result[name] = (len(rows), hashlib.sha256('\n'.join(rows).encode()).hexdigest())
        return result

before = snapshot(rehearsal)
namespace['migrate_home_routes'](rehearsal)
namespace['migrate_home_routes'](rehearsal)
after = snapshot(rehearsal)
assert all(after[name] == value for name, value in before.items())
assert set(after)-set(before) == {'published_home_routes'}
print('REHEARSAL PASSED; original tables and row digests preserved:', len(before))
print('Private backup:', backup)
print('Private rehearsal:', rehearsal)
print('Live database and service unchanged.')
