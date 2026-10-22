"""Portable activation/rollback guards; no systemd, cloud or database access."""
import copy
import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import activate_social_release as release


def baseline(version='0003'):
    return {'versions': [version], 'tables': {
        'users': {'columns': ['id'], 'count': 3, 'digest': 'existing-users'},
        'groups': {'columns': ['id', 'name'], 'count': 3, 'digest': 'existing-groups'},
        'published_campus_routes': {'columns': ['id', 'binary'], 'count': 1, 'digest': 'campus'}}}


class ActivationTests(unittest.TestCase):
    def test_preservation_rejects_changed_rows_columns_and_revision(self):
        before = baseline()
        release.unchanged(before, baseline('0004'), '0004')
        for field in ('columns', 'count', 'digest'):
            after = baseline('0004')
            after['tables']['users'][field] = 'changed'
            with self.subTest(field=field), self.assertRaises(release.ReleaseError):
                release.unchanged(before, after, '0004')
        with self.assertRaises(release.ReleaseError):
            release.unchanged(before, before, '0004')

    def archive(self, entries):
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w:gz') as archive:
            for name, kind in entries:
                member = tarfile.TarInfo(name)
                member.type = kind
                member.linkname = '/outside'
                member.size = 0
                archive.addfile(member, io.BytesIO())
        return buffer.getvalue()

    def test_archive_paths_links_duplicates_and_checksum_are_refused(self):
        for entries in ([('../outside', tarfile.REGTYPE)],
                        [('/backend/app.py', tarfile.REGTYPE)],
                        [('backend/link', tarfile.SYMTYPE)],
                        [('backend/link', tarfile.LNKTYPE)],
                        [('backend/app.py', tarfile.REGTYPE)] * 2,
                        [('other/app.py', tarfile.REGTYPE)]):
            data = self.archive(entries)
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as folder, \
                    patch.object(release, 'ARCHIVE_SHA', hashlib.sha256(data).hexdigest()):
                with self.assertRaises(release.ReleaseError):
                    release.unpack(data, Path(folder))
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(release.ReleaseError):
            release.unpack(b'wrong bytes', Path(folder))

    def test_application_directories_are_readable(self):
        data = self.archive([('backend/app/main.py', tarfile.REGTYPE)])
        with tempfile.TemporaryDirectory() as folder, \
                patch.object(release, 'ARCHIVE_SHA', hashlib.sha256(data).hexdigest()):
            release.unpack(data, Path(folder))
            self.assertTrue((Path(folder) / 'backend/app/main.py').is_file())
            # Windows does not implement Unix directory permission bits.
            if __import__('os').name != 'nt':
                self.assertEqual((Path(folder) / 'backend/app').stat().st_mode & 0o777, 0o755)

    def exercise(self, failure=None):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            backend = root / 'candidate'
            recovery = root / 'recovery'
            recovery.mkdir()
            dropin = root / 'service.conf'
            dropin.write_bytes(b'old service')
            events, revisions = [], {'team43': '0003'}

            def event(name):
                events.append(name)
                if name == failure:
                    raise RuntimeError('simulated ' + name)

            def run(command, **kwargs):
                if command[1] == 'stop':
                    event('stop')
                return SimpleNamespace(stdout=str(backend) + '\n')

            def backup(path):
                event('backup')
                path.write_bytes(b'PGDMP-retained-backup')
                return 9

            def restore(installer, path, name):
                event('restore-copy')
                self.assertNotEqual(name, 'team43')
                self.assertTrue(path.read_bytes().startswith(b'PGDMP'))
                revisions[name] = '0003'

            def audit(installer, backend, name, columns=None):
                result = baseline(revisions[name])
                if name != 'team43' and revisions[name] == '0004' and columns is None:
                    for table in release.NEW_TABLES:
                        result['tables'][table] = {'count': 0, 'columns': [], 'digest': 'empty'}
                if failure == 'copy-drift' and name != 'team43':
                    result['tables']['users']['digest'] = 'changed'
                if failure == 'live-drift' and name == 'team43' and revisions[name] == '0004':
                    result['tables']['users']['digest'] = 'changed'
                return copy.deepcopy(result)

            def upgrade(installer, backend, name):
                event('live-upgrade' if name == 'team43' else 'copy-upgrade')
                if name == 'team43':
                    self.assertIn('copy-upgrade', events)
                revisions[name] = '0004'

            def switch(backend):
                event('switch-code')
                dropin.write_bytes(b'new service')

            def rollback(previous):
                events.append('rollback-code')
                dropin.write_bytes(previous)

            def healthy(count):
                self.assertEqual(count, 9)
                if 'rollback-code' not in events:
                    event('health')
                return {'status': 'healthy', 'database': 'connected', 'programmes': count}

            installer = SimpleNamespace(DROPIN=dropin, SERVICE='test.service', run=run,
                switch_service=switch, restore_service=rollback, wait_healthy=healthy)
            database = SimpleNamespace(postgres_snapshot=backup,
                confirm_active_database=lambda mode: event('database-confirm'))
            with patch.object(release, 'audit', side_effect=audit), \
                    patch.object(release, 'upgrade', side_effect=upgrade), \
                    patch.object(release, 'restore', side_effect=restore), \
                    patch.object(release, 'authenticated_routes', side_effect=lambda: event('authentication')), \
                    patch('builtins.print'):
                if failure:
                    with self.assertRaises(Exception):
                        release.activate_prepared(installer, database, backend, recovery, {'programmes': 9})
                    self.assertIn('rollback-code', events)
                    self.assertEqual(dropin.read_bytes(), b'old service')
                    self.assertFalse((recovery / 'activated.json').exists())
                    if failure not in ('stop', 'backup'):
                        self.assertTrue((recovery / 'before-social.dump').is_file())
                    if failure in ('stop', 'backup', 'restore-copy', 'copy-drift', 'copy-upgrade'):
                        self.assertNotIn('live-upgrade', events)
                else:
                    result = release.activate_prepared(installer, database, backend, recovery, {'programmes': 9})
                    self.assertEqual(result['revision'], '0004')
                    self.assertEqual(dropin.read_bytes(), b'new service')
                    self.assertTrue((recovery / 'activated.json').is_file())
                    self.assertNotIn('rollback-code', events)

    def test_success_requires_final_restore_before_live_upgrade(self):
        self.exercise()

    def test_failure_rolls_back_code_and_retains_database_and_backup(self):
        for failure in ('stop', 'backup', 'restore-copy', 'copy-drift', 'copy-upgrade',
                        'live-upgrade', 'live-drift', 'switch-code', 'health',
                        'database-confirm', 'authentication'):
            with self.subTest(failure=failure):
                self.exercise(failure)

    def test_restore_cannot_target_live_database(self):
        for name in ('team43', 'postgres', 'team43_social_rehearsal', 'team43_social_bad_final'):
            with self.subTest(name=name), self.assertRaises(release.ReleaseError):
                release.restore(SimpleNamespace(), Path('never-read.dump'), name)


if __name__ == '__main__':
    unittest.main()
