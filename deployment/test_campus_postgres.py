"""Migration guards and preservation tests; no cloud or live database access."""
import copy
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

import team43_campus_postgres as campus


def manifest(version='0002'):
    table = {'columns': [['id', 'integer', True, '', '', None]],
             'constraints': [], 'indexes': [], 'count': 2, 'sha256': 'preserved'}
    return {'versions': [version], 'tables': {'users': copy.deepcopy(table),
            'alembic_version': dict(copy.deepcopy(table), count=1, sha256=version)},
            'sequences': [['users_id_seq', 1, 1, 2**31-1, 1, False, 1, 2]],
            'enums': [], 'views': [], 'triggers': [], 'invalid_constraints': 0}


def migrated(before):
    after = copy.deepcopy(before)
    after['versions'] = ['0003']
    after['tables']['alembic_version']['sha256'] = '0003'
    after['tables'][campus.TABLE] = {'columns': [], 'constraints': [], 'indexes': [],
                                   'count': 0, 'sha256': 'empty'}
    after['sequences'].append(['published_campus_routes_id_seq', 1, 1, 2**31-1,
                               1, False, 1, None])
    return after


class CampusPostgresTests(unittest.TestCase):
    def test_only_reviewed_files_and_one_revision_qualify(self):
        with tempfile.TemporaryDirectory() as folder:
            old, new = Path(folder) / 'old', Path(folder) / 'new'
            checksums = {}
            for root, model in ((old, campus.OLD_MODELS), (new, campus.NEW_MODELS)):
                for name, checksum in dict(campus.BASE_PINS, **{'app/models.py': model}).items():
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text('synthetic')
                    checksums[path] = checksum
            (new / campus.MIGRATION).write_text('synthetic')
            checksums[new / campus.MIGRATION] = campus.MIGRATION_SHA
            with patch.object(campus, 'digest', side_effect=lambda path: checksums[path]):
                self.assertTrue(campus.reviewed_transition(old, new))
                checksums[new / 'migrations/env.py'] = 'changed'
                with self.assertRaises(campus.CampusMigrationError):
                    campus.reviewed_transition(old, new)
                checksums[new / 'migrations/env.py'] = campus.BASE_PINS['migrations/env.py']
                (new / 'migrations/versions/unreviewed.py').write_text('extra')
                with self.assertRaises(campus.CampusMigrationError):
                    campus.reviewed_transition(old, new)
                checksums[new / 'app/models.py'] = 'other'
                self.assertFalse(campus.reviewed_transition(old, new))

    def test_data_schema_sequence_and_constraint_changes_are_refused(self):
        before, after = manifest(), migrated(manifest())
        campus.compare(before, after)
        variants = []
        for field in ('sha256', 'count', 'columns', 'constraints', 'indexes'):
            broken = copy.deepcopy(after)
            broken['tables']['users'][field] = 'changed'
            variants.append(broken)
        for field in ('enums', 'views', 'triggers', 'invalid_constraints', 'versions'):
            broken = copy.deepcopy(after)
            broken[field] = 'changed'
            variants.append(broken)
        broken = copy.deepcopy(after)
        broken['sequences'][0][-1] = 999
        variants.append(broken)
        broken = copy.deepcopy(after)
        broken['tables'][campus.TABLE]['count'] = 1
        variants.append(broken)
        broken = copy.deepcopy(after)
        del broken['tables']['users']
        variants.append(broken)
        for broken in variants:
            with self.subTest(broken=broken), self.assertRaises(campus.CampusMigrationError):
                campus.compare(before, broken)

    def test_retry_preserves_publications_after_code_rollback(self):
        before = migrated(manifest())
        before['tables'][campus.TABLE].update(count=4, sha256='published-recordings')
        campus.compare(before, copy.deepcopy(before))
        after = copy.deepcopy(before)
        after['tables'][campus.TABLE]['sha256'] = 'lost'
        with self.assertRaises(campus.CampusMigrationError):
            campus.compare(before, after)

    def test_tests_and_restores_cannot_target_production(self):
        campus.require_database('team43')
        for name in ('team43', 'team43_rehearsal', 'postgres', 'team43_test;DROP'):
            with self.subTest(name=name), self.assertRaises(campus.CampusMigrationError):
                campus.require_database(name, temporary=True)
        database = 'team43_campus_abcdef123456_test'
        command = campus.python_command(Path('/candidate'), database, ['-m', 'pytest'], tests=True)
        self.assertIn('TEST_DATABASE_URL=' + campus.database_url(database), command)
        self.assertIn('ubuntu', command)
        with self.assertRaises(campus.CampusMigrationError):
            campus.python_command(Path('/candidate'), 'team43_campus_abcdef123456_restore', [], tests=True)

    def test_restore_streams_private_file_and_never_uses_clean(self):
        with tempfile.TemporaryDirectory() as folder:
            backup = Path(folder) / 'backup.dump'
            backup.write_bytes(b'PGDMPsynthetic')
            calls = []
            def execute(command, **kwargs):
                calls.append(command)
                if any('pg_restore' in part for part in command):
                    import os
                    self.assertEqual(os.read(kwargs['stdin'].fileno(), 100), b'PGDMPsynthetic')
                return SimpleNamespace()
            with patch.object(campus, 'execute', side_effect=execute):
                campus.restore(backup, 'team43_campus_abcdef123456_restore')
            self.assertTrue(any('createdb' in part for part in calls[0]))
            self.assertIn('--single-transaction', calls[1])
            self.assertNotIn('--clean', calls[1])

    def test_live_upgrade_waits_for_exact_final_restore_comparison(self):
        with patch.object(campus, 'verify_restore', return_value=manifest()), \
                patch.object(campus, 'audit', return_value=manifest()) as audit, \
                patch.object(campus, 'upgrade') as upgrade, \
                patch.object(campus, 'compare'):
            campus.activate(Path('/old'), Path('/new'), Path('/backup'), Path('/state'))
            upgrade.assert_called_once_with(Path('/new'), 'team43')
            upgrade.reset_mock()
            changed = manifest()
            changed['tables']['users']['sha256'] = 'new-writes'
            audit.return_value = changed
            with self.assertRaises(campus.CampusMigrationError):
                campus.activate(Path('/old'), Path('/new'), Path('/backup'), Path('/state'))
            upgrade.assert_not_called()

    def test_command_failures_do_not_print_private_records(self):
        with patch.object(campus.subprocess, 'run', side_effect=RuntimeError('private-email')):
            with self.assertRaises(campus.CampusMigrationError) as error:
                campus.execute(['synthetic'])
            self.assertNotIn('private-email', str(error.exception))


if __name__ == '__main__':
    unittest.main()
