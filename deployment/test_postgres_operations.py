"""Portable tests; no real service, PostgreSQL database or AWS access."""
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import team43_database as database
import team43_backup_database as backup
import team43_deploy_backend as installer
import dispatch_backup as dispatcher
from test_backup import BACKUP_ID, URL
from test_backup_dispatcher import metadata


class PostgresOperationsTests(unittest.TestCase):
    def test_config_is_explicit_and_root_owned(self):
        fake = Mock()
        with patch.object(database, 'CONFIG', fake):
            fake.lstat.side_effect = FileNotFoundError
            self.assertEqual(database.database_mode(), 'sqlite')
            fake.lstat.side_effect = None
            fake.lstat.return_value = SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0)
            fake.read_text.return_value = 'DATABASE_URL=' + database.POSTGRES_URL + '\n'
            self.assertEqual(database.database_mode(), 'postgresql')
            for mode, owner in ((stat.S_IFREG | 0o666, 0), (stat.S_IFLNK | 0o600, 0),
                                (stat.S_IFREG | 0o600, 1000)):
                fake.lstat.return_value = SimpleNamespace(st_mode=mode, st_uid=owner)
                with self.assertRaises(database.DatabaseError):
                    database.database_mode()

    def test_running_database_must_match_no_credentials_logged(self):
        with patch.object(database.subprocess, 'run', return_value=SimpleNamespace(stdout='123\n')), \
                patch.object(Path, 'read_bytes') as read:
            read.return_value = ('OTHER=private\0DATABASE_URL=' + database.POSTGRES_URL + '\0').encode()
            database.confirm_active_database('postgresql')
            with self.assertRaises(database.DatabaseError):
                database.confirm_active_database('sqlite')
            read.return_value = b'DATABASE_URL=postgresql://secret-password@other/private\0'
            with self.assertRaises(database.DatabaseError) as error:
                database.confirm_active_database('postgresql')
            self.assertNotIn('secret-password', str(error.exception))

    def test_pg_command_uses_fixed_non_root_local_identity(self):
        command = database.pg_command('pg_dump', '--format=custom')
        self.assertEqual(command[:5], ['/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/env'])
        for item in ('-i', 'PGHOST=/var/run/postgresql', 'PGDATABASE=team43',
                     'PGUSER=ubuntu', 'PGPASSFILE=/dev/null', '--no-password'):
            self.assertIn(item, command)
        with self.assertRaises(database.DatabaseError):
            database.pg_command('sh')

    def test_dump_is_private_exclusive_and_validated(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'backup.dump'
            def execute(command, **kwargs):
                if '/usr/bin/pg_dump' in command:
                    kwargs['stdout'].write(b'PGDMPsynthetic')
                    self.assertEqual(kwargs['timeout'], 100)
                    self.assertEqual(command[:3], ['/usr/bin/timeout', '--kill-after=5', '90'])
                    self.assertEqual(kwargs['preexec_fn'], database._bound_dump_size)
                else:
                    self.assertIn('--list', command)
                    # Like pg_restore, read the OS descriptor, bypassing Python buffers.
                    self.assertEqual(os.read(kwargs['stdin'].fileno(), 100), b'PGDMPsynthetic')
                return SimpleNamespace()
            with patch.object(database, 'pg_scalar', side_effect=['9', '8000000'] * 2), \
                    patch.object(database.subprocess, 'run', side_effect=execute):
                self.assertEqual(database.postgres_snapshot(path), 9)
                with self.assertRaises(FileExistsError):
                    database.postgres_snapshot(path)
            self.assertEqual(path.read_bytes(), b'PGDMPsynthetic')

    def test_dump_failure_is_not_success_and_details_are_redacted(self):
        with tempfile.TemporaryDirectory() as folder, \
                patch.object(database, 'pg_scalar', side_effect=['9', '8000000']), \
                patch.object(database.subprocess, 'run', side_effect=RuntimeError('private-details')):
            with self.assertRaises(database.DatabaseError) as error:
                database.postgres_snapshot(Path(folder) / 'backup.dump')
            self.assertNotIn('private-details', str(error.exception))

    def test_backup_url_cannot_mix_sqlite_and_postgres(self):
        pg_url = URL.replace('.sqlite3?', '.dump?')
        backup.validate_inputs(BACKUP_ID, pg_url, 'dump')
        with self.assertRaises(backup.BackupError):
            backup.validate_inputs(BACKUP_ID, pg_url)
        with self.assertRaises(backup.BackupError):
            backup.validate_inputs(BACKUP_ID, URL, 'dump')
        doc = json.loads(Path(__file__).with_name('ssm-backup-document.json').read_text())
        self.assertRegex(pg_url, doc['parameters']['UploadUrl']['allowedPattern'])

    def test_dispatcher_presigns_and_validates_postgres_key(self):
        client = Mock()
        dispatcher.presign(client, BACKUP_ID, 'dump')
        self.assertEqual(client.generate_presigned_url.call_args.kwargs['Params']['Key'],
                         f'database/{BACKUP_ID}.dump')
        result = metadata()
        result['key'] = f'database/{BACKUP_ID}.dump'
        response = {'StandardOutputContent': json.dumps(result)}
        dispatcher.validate_result(response, BACKUP_ID, 'dump')
        with self.assertRaises(dispatcher.DispatchError):
            dispatcher.validate_result(response, BACKUP_ID)

    def test_backup_uses_postgres_and_refuses_active_database_mismatch(self):
        lock_module = SimpleNamespace(flock=lambda *args: None, LOCK_EX=1, LOCK_NB=2)
        with tempfile.TemporaryDirectory() as folder, \
                patch.dict(sys.modules, {'fcntl': lock_module}), \
                patch.object(backup, 'STATE', Path(folder)), \
                patch.object(backup.os, 'geteuid', return_value=0, create=True), \
                patch.object(backup.os, 'umask'), \
                patch.object(backup, 'database_mode', return_value='postgresql'), \
                patch.object(backup, 'confirm_active_database') as confirm, \
                patch.object(backup.shutil, 'disk_usage', return_value=SimpleNamespace(free=10**9)), \
                patch.object(backup, 'postgres_snapshot', return_value=9) as pg_dump, \
                patch.object(backup, 'snapshot') as sqlite, \
                patch.object(backup, 'upload', return_value={'bytes': 20}) as upload:
            result = backup.run_backup(BACKUP_ID, URL.replace('.sqlite3?', '.dump?'))
            self.assertEqual(result['key'], f'database/{BACKUP_ID}.dump')
            self.assertEqual(result['programmes'], 9)
            confirm.assert_called_once_with('postgresql')
            pg_dump.assert_called_once()
            sqlite.assert_not_called()
            upload.assert_called_once()
            pg_dump.reset_mock()
            upload.reset_mock()
            confirm.side_effect = database.DatabaseError('mode mismatch')
            with self.assertRaises(database.DatabaseError):
                backup.run_backup(BACKUP_ID, URL.replace('.sqlite3?', '.dump?'))
            pg_dump.assert_not_called()
            upload.assert_not_called()

    def test_postgres_release_refuses_changed_migrations(self):
        with tempfile.TemporaryDirectory() as folder:
            old, new = Path(folder) / 'old', Path(folder) / 'new'
            for root in (old, new):
                (root / 'app').mkdir(parents=True)
                (root / 'migrations/versions').mkdir(parents=True)
                for name in ('app/database.py', 'app/models.py', 'alembic.ini',
                             'migrations/env.py', 'migrations/script.py.mako',
                             'migrations/versions/0001.py'):
                    (root / name).write_text('same\n')
            installer.require_same_postgres_schema(old, new)
            (new / 'migrations/versions/0002.py').write_text('new schema')
            with self.assertRaises(installer.DeploymentError):
                installer.require_same_postgres_schema(old, new)


if __name__ == '__main__':
    unittest.main()
