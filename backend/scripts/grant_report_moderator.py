"""Resolve an existing account once and grant its immutable ID report access.

Run from the deployed backend on EC2 as root. Default is preview; --apply writes one systemd drop-in.
Database credentials, sessions, messages and report contents are never printed.
"""
import argparse
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import time
import urllib.request

SERVICE = 'team43-api.service'
STATE = Path('/var/lib/team43-deployment')
DROPIN = Path('/etc/systemd/system/team43-api.service.d/80-team43-moderation.conf')


def run(*args, **kwargs):
    return subprocess.run(list(args), check=True, capture_output=True, text=True, timeout=30, **kwargs).stdout.strip()


def moderator_ids(value):
    if not value:
        return set()
    pieces = value.split(',')
    if any(not re.fullmatch(r'[1-9][0-9]*', part.strip()) for part in pieces):
        raise ValueError('Existing moderator configuration is malformed; inspect it before changing access.')
    return {int(part) for part in pieces}


def protected_directory(path):
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise RuntimeError('Expected a root-owned protected directory: '+str(path))


def resolve_account(email):
    working = Path(run('systemctl','show',SERVICE,'-p','WorkingDirectory','--value'))
    if working.parent.parent != Path('/opt/team43/releases') or working.name != 'backend':
        raise RuntimeError('Unexpected backend working directory.')
    python = working / '.venv/bin/python'
    script = """import sys, psycopg
with psycopg.connect('dbname=team43 user=ubuntu host=/var/run/postgresql') as db:
    db.read_only = True
    with db.cursor() as cursor:
        cursor.execute('SELECT u.id FROM users u LEFT JOIN deleted_accounts d ON d.user_id=u.id WHERE u.email=%s AND d.user_id IS NULL', (sys.argv[1],))
        rows=cursor.fetchall()
        if len(rows)!=1: raise SystemExit('Expected exactly one existing active account.')
        print(rows[0][0])
"""
    result = run('runuser','-u','ubuntu','--',str(python),'-c',script,email)
    if not re.fullmatch(r'[1-9][0-9]*',result):
        raise RuntimeError('Account lookup did not return one positive user ID.')
    return int(result)


def live_ids():
    pid = run('systemctl','show',SERVICE,'-p','MainPID','--value')
    if not pid.isdecimal() or int(pid)<1:
        raise RuntimeError('Backend is not running.')
    environment = (Path('/proc')/pid/'environ').read_bytes().split(b'\0')
    database = [entry for entry in environment if entry.startswith(b'DATABASE_URL=')]
    if database != [b'DATABASE_URL=postgresql+psycopg://ubuntu@/team43?host=/var/run/postgresql']:
        raise RuntimeError('Live backend is not using the expected production PostgreSQL database.')
    values = [entry.split(b'=',1)[1].decode() for entry in environment if entry.startswith(b'TEAM43_MODERATOR_USER_IDS=')]
    if len(values)>1:
        raise RuntimeError('Conflicting moderator settings.')
    return moderator_ids(values[0] if values else '')


def write_dropin(content):
    protected_directory(DROPIN.parent)
    if DROPIN.exists():
        info=DROPIN.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_mode & 0o022:
            raise RuntimeError('Unexpected moderation override permissions.')
    descriptor, name = tempfile.mkstemp(prefix='.moderation-',dir=DROPIN.parent)
    try:
        with os.fdopen(descriptor,'w') as stream:
            stream.write(content)
            stream.flush();os.fsync(stream.fileno())
        os.chmod(name,0o644)
        os.replace(name,DROPIN)
    finally:
        Path(name).unlink(missing_ok=True)


def install(user_id):
    current = live_ids()
    if user_id in current:
        print('Account already has moderator access. No changes made.');return
    previous = DROPIN.read_text() if DROPIN.exists() else None
    recovery = Path(tempfile.mkdtemp(prefix='moderation-before-',dir=STATE))
    os.chmod(recovery,0o700)
    if previous is not None:
        (recovery/'80-team43-moderation.conf').write_text(previous)
    ids = ','.join(str(item) for item in sorted(current|{user_id}))
    changed = False
    try:
        write_dropin('[Service]\nEnvironment=TEAM43_MODERATOR_USER_IDS='+ids+'\n');changed=True
        run('systemctl','daemon-reload');run('systemctl','restart',SERVICE)
        for attempt in range(15):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3) as response:
                    if response.status==200:break
            except Exception:
                if attempt==14:raise RuntimeError('Backend health did not recover.') from None
                time.sleep(1)
        if user_id not in live_ids():
            raise RuntimeError('New moderator ID was not loaded by the live process.')
    except Exception:
        if changed:
            if previous is None:DROPIN.unlink()
            else:write_dropin(previous)
            run('systemctl','daemon-reload');run('systemctl','restart',SERVICE)
        raise
    print('Moderator access enabled for user ID:',user_id)
    print('Recovery directory:',recovery)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email',required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    if os.name!='posix' or os.geteuid()!=0:raise SystemExit('Run this helper as root on the EC2 server.')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+',args.email):raise SystemExit('Provide an existing account email.')
    protected_directory(STATE)
    import fcntl
    with (STATE/'deployment.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        live_ids()  # Confirm the database before resolving an immutable account ID.
        user_id=resolve_account(args.email.strip().casefold())
        print('Resolved existing account to user ID:',user_id)
        if args.apply:install(user_id)
        else:print('Preview only. Add --apply to enable report moderation for this ID.')


if __name__=='__main__':main()
