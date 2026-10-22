"""Fixed local database contract for root-owned deployment/backup helpers.

Install beside the helpers as root-owned /usr/local/sbin/team43_database.py.
PostgreSQL uses the ubuntu OS/database role, Unix socket, and database team43.
No remote host, password, database name, SQL or shell command is caller supplied.
"""
import os
from pathlib import Path
import stat
import subprocess

CONFIG = Path('/etc/team43/database.env')
POSTGRES_URL = 'postgresql+psycopg://ubuntu@/team43?host=/var/run/postgresql'
SQLITE_URL = 'sqlite:////var/lib/team43/health_app_v2.db'
MAX_BYTES = 100 * 1024 * 1024


class DatabaseError(Exception):
    pass


def database_mode():
    try:
        info = CONFIG.lstat()
    except FileNotFoundError:
        return 'sqlite'
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise DatabaseError('Database configuration must be a root-owned, non-writable regular file.')
    setting = CONFIG.read_text().strip()
    if setting == 'DATABASE_URL=' + POSTGRES_URL:
        return 'postgresql'
    if setting == 'DATABASE_URL=' + SQLITE_URL:
        return 'sqlite'
    raise DatabaseError('Unexpected database configuration; inspect the installed database.env.')


def confirm_active_database(mode):
    """Read only DATABASE_URL from the live process; never print its environment."""
    try:
        process = subprocess.run(
            ['/usr/bin/systemctl', 'show', 'team43-api.service', '-p', 'MainPID', '--value'],
            check=True, capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        if not process.isdecimal() or int(process) < 1:
            raise DatabaseError('Backend is not running; inspect the service before backing up/deploying.')
        entries = (Path('/proc') / process / 'environ').read_bytes().split(b'\0')
        urls = [entry.split(b'=', 1)[1].decode() for entry in entries
                if entry.startswith(b'DATABASE_URL=')]
        expected = POSTGRES_URL if mode == 'postgresql' else SQLITE_URL
        if urls != [expected]:
            raise DatabaseError('Running backend database differs from the helper configuration. No backup/deploy performed.')
    except DatabaseError:
        raise
    except Exception:
        raise DatabaseError('Could not verify the running backend database; inspect service state.') from None


def pg_command(program, *arguments, database_name='team43'):
    if program not in ('pg_dump', 'pg_restore', 'psql'):
        raise DatabaseError('Unsupported PostgreSQL command.')
    if database_name not in ('team43', 'team43_rehearsal'):
        raise DatabaseError('Unsupported PostgreSQL database.')
    return ['/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/env', '-i',
            'PATH=/usr/bin:/bin', 'HOME=/home/ubuntu', 'PGHOST=/var/run/postgresql',
            'PGPORT=5432', 'PGUSER=ubuntu', 'PGDATABASE=' + database_name,
            'PGCONNECT_TIMEOUT=5', 'PGPASSFILE=/dev/null',
            '/usr/bin/' + program, '--no-password', *arguments]


def pg_scalar(sql, database_name='team43'):
    try:
        return subprocess.run(pg_command('psql', '--no-psqlrc', '-At', '-v',
                              'ON_ERROR_STOP=1', '-c', sql, database_name=database_name), check=True,
                              capture_output=True, text=True, timeout=15).stdout.strip()
    except Exception:
        raise DatabaseError('PostgreSQL query failed; inspect local database access.') from None


def _bound_dump_size():
    # Linux child only; also bounds growth while other clients write to the DB.
    import resource
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES, MAX_BYTES))


def postgres_snapshot(destination, database_name='team43'):
    """Consistent custom-format dump, exclusive private file, bounded size/time.

    The programme count is observed before the dump; concurrent changes may
    make it differ from the dump snapshot. Only a restore verifies its contents.
    """
    try:
        if database_name not in ('team43', 'team43_rehearsal'):
            raise DatabaseError('Unsupported PostgreSQL database.')
        count = int(pg_scalar('SELECT COUNT(*) FROM programmes', database_name))
        if count < 1:
            raise DatabaseError('PostgreSQL contains no programmes; backup refused.')
        if int(pg_scalar('SELECT pg_database_size(current_database())', database_name)) > MAX_BYTES:
            raise DatabaseError('Database exceeds the 100 MiB backup limit; review capacity.')
        fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'wb') as output:
            # GNU timeout terminates the process group, including runuser's child.
            subprocess.run(['/usr/bin/timeout', '--kill-after=5', '90',
                            *pg_command('pg_dump', '--format=custom', '--no-owner', '--no-acl',
                                        '--lock-wait-timeout=10000', database_name=database_name)],
                           check=True, stdout=output, stderr=subprocess.PIPE, timeout=100,
                           preexec_fn=_bound_dump_size)
        if not 0 < destination.stat().st_size <= MAX_BYTES:
            raise DatabaseError('PostgreSQL dump size is invalid.')
        # The child reads the OS descriptor, not Python's read-ahead buffer.
        # Unbuffered seek resets the actual descriptor after checking the header.
        with destination.open('rb', buffering=0) as dump:
            if dump.read(5) != b'PGDMP':
                raise DatabaseError('Expected a PostgreSQL custom-format dump.')
            dump.seek(0)
            # Stream on stdin: the ubuntu process cannot traverse root's staging folder.
            subprocess.run(pg_command('pg_restore', '--list'), stdin=dump, check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=30)
        return count
    except (DatabaseError, FileExistsError):
        raise
    except Exception:
        raise DatabaseError('PostgreSQL snapshot failed; no backup success reported.') from None
