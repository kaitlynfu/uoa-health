"""Offline activation/recovery tests. No AWS, systemd or live database access."""
import base64
import contextlib
import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error

import activate_campus_release as activation


NGINX = '''server {
    server_name team43-api.3-27-96-180.sslip.io;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/example/fullchain.pem;
}
server {
    if ($host = team43-api.3-27-96-180.sslip.io) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name team43-api.3-27-96-180.sslip.io;
    return 404;
}
'''


class CampusActivationTests(unittest.TestCase):
    def test_upload_config_preserves_tls_headers_and_redirects(self):
        result = activation.nginx_upload_config(NGINX)
        inserted = ''.join('        ' + value + '\n' for value in (
            'client_max_body_size 50m;', 'client_body_timeout 180s;',
            'proxy_read_timeout 180s;', 'proxy_send_timeout 180s;'))
        self.assertEqual(result.replace(inserted, ''), NGINX)
        self.assertLess(result.index(inserted), result.index('proxy_pass'))

    def test_unexpected_proxy_config_refuses_mutation(self):
        for source in (
            NGINX.replace(':8000', ':9000'),
            NGINX.replace('location / {', 'location /api {'),
            NGINX.replace('proxy_pass', 'location /nested { }\n        proxy_pass'),
            NGINX.replace('proxy_pass', 'client_max_body_size 1m;\n        proxy_pass'),
            NGINX.replace('server_name team43-api.3-27-96-180.sslip.io;', 'server_name other.example;'),
        ):
            with self.subTest(source=source), self.assertRaises(RuntimeError):
                activation.nginx_upload_config(source)

    def test_modified_prepared_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / 'code.tar.gz'
            path = root / 'backend/app/main.py'
            path.parent.mkdir(parents=True)
            path.write_bytes(b'approved source')
            with tarfile.open(archive, 'w:gz') as package:
                entry = tarfile.TarInfo('backend/app/main.py')
                entry.size = len(path.read_bytes())
                package.addfile(entry, io.BytesIO(path.read_bytes()))
            checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
            with patch.object(activation, 'root_file'):
                activation.verify_tar_tree(archive, root, 'backend', checksum)
                extra = path.parent / 'unreviewed.py'
                extra.write_bytes(b'extra source')
                with self.assertRaisesRegex(RuntimeError, 'Unexpected Python'):
                    activation.verify_tar_tree(archive, root, 'backend', checksum)
                extra.unlink()
                path.write_bytes(b'modified source')
                with self.assertRaisesRegex(RuntimeError, 'source changed'):
                    activation.verify_tar_tree(archive, root, 'backend', checksum)

    def test_archive_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / 'code.tar.gz'
            with tarfile.open(archive, 'w:gz') as package:
                entry = tarfile.TarInfo('backend/../../outside')
                entry.size = 4
                package.addfile(entry, io.BytesIO(b'code'))
            with self.assertRaisesRegex(RuntimeError, 'Unsupported'):
                activation.verify_tar_tree(archive, root, 'backend',
                                           hashlib.sha256(archive.read_bytes()).hexdigest())

    def fixture(self, root):
        installer, campus, database = Mock(), Mock(), Mock()
        installer.DROPIN = root / 'service.conf'
        installer.SERVICE = 'team43-api.service'
        installer.health.return_value = dict(programmes=9)
        installer.wait_healthy.return_value = dict(status='healthy', database='connected', programmes=9)
        database.pg_scalar.return_value = '0003'
        recovery = root / 'recovery'
        helpers = root / 'helpers'
        recovery.mkdir()
        helpers.mkdir()
        (helpers / 'team43_deploy_backend.py').write_bytes(b'new installer')
        (helpers / 'team43_campus_postgres.py').write_bytes(b'new companion')
        helper = root / 'installed-helper'
        helper.write_bytes(b'old installer')
        companion = root / 'installed-companion'
        nginx = root / 'nginx.conf'
        nginx.write_text(NGINX)
        def snapshot(path):
            path.write_bytes(b'PGDMP final backup')
            return 9
        database.postgres_snapshot.side_effect = snapshot
        def activate(old, backend, backup, state):
            self.assertEqual(backup.read_bytes(), b'PGDMP final backup')
            self.assertIn(unittest.mock.call(['systemctl', 'stop', installer.SERVICE]),
                          installer.run.call_args_list)
        campus.activate.side_effect = activate
        def map_path(value):
            return {'/usr/local/sbin/team43-deploy-backend': helper,
                    '/usr/local/sbin/team43_campus_postgres.py': companion}.get(value, Path(value))
        return installer, campus, database, recovery, helpers, helper, nginx, map_path

    def exercise(self, root, fail=None, recovery_fail=False):
        installer, campus, database, recovery, helpers, helper, nginx, map_path = self.fixture(root)
        if fail == 'migration':
            campus.activate.side_effect = RuntimeError('migration refused')
        if fail == 'nginx':
            checks = [0]
            def run(command, **kwargs):
                if command == ['nginx', '-t'] and checks[0] == 0:
                    checks[0] += 1
                    raise RuntimeError('invalid nginx')
            installer.run.side_effect = run
        if recovery_fail:
            installer.restore_service.side_effect = RuntimeError('service recovery failed')
        opener = Mock()
        def unauthorized(*args, **kwargs):
            raise urllib.error.HTTPError('local', 401, 'Authentication required', {}, io.BytesIO())
        opener.open.side_effect = unauthorized
        with patch.object(activation, 'Path', side_effect=map_path), \
                patch.object(activation, 'editor_setting', return_value='1'), \
                patch.object(activation, 'atomic_write', side_effect=lambda p, b, m: p.write_bytes(b)), \
                patch.object(activation.urllib.request, 'build_opener', return_value=opener), \
                contextlib.redirect_stdout(io.StringIO()):
            if fail:
                with self.assertRaises(RuntimeError):
                    activation.activate_prepared(installer, campus, database, Path('/old'), Path('/new'),
                                                 root, recovery, nginx, activation.nginx_upload_config(NGINX), helpers)
            else:
                activation.activate_prepared(installer, campus, database, Path('/old'), Path('/new'),
                                             root, recovery, nginx, activation.nginx_upload_config(NGINX), helpers)
        return installer, campus, database, recovery, helper, nginx

    def test_success_activates_after_final_backup_and_checks_authentication(self):
        with tempfile.TemporaryDirectory() as folder:
            installer, campus, database, recovery, helper, nginx = self.exercise(Path(folder))
            self.assertTrue((recovery / 'activated.json').is_file())
            self.assertEqual((recovery / 'before-campus.dump').read_bytes(), b'PGDMP final backup')
            database.postgres_snapshot.assert_called_once()
            campus.activate.assert_called_once()
            installer.switch_service.assert_called_once_with(Path('/new'))
            installer.restore_service.assert_not_called()
            self.assertEqual(helper.read_bytes(), b'new installer')
            self.assertIn('client_max_body_size 50m;', nginx.read_text())

    def test_failed_migration_restores_application_helper_and_proxy(self):
        with tempfile.TemporaryDirectory() as folder:
            installer, campus, database, recovery, helper, nginx = self.exercise(Path(folder), 'migration')
            installer.restore_service.assert_called_once_with(None)
            installer.switch_service.assert_not_called()
            self.assertEqual(helper.read_bytes(), b'old installer')
            self.assertEqual(nginx.read_text(), NGINX)
            self.assertTrue((recovery / 'before-campus.dump').exists())
            self.assertFalse((recovery / 'activated.json').exists())

    def test_recovery_attempts_other_configs_even_if_application_recovery_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            installer, campus, database, recovery, helper, nginx = self.exercise(Path(folder), 'migration', True)
            self.assertEqual(helper.read_bytes(), b'old installer')
            self.assertEqual(nginx.read_text(), NGINX)

    def test_invalid_nginx_restores_proxy_before_any_service_interruption(self):
        with tempfile.TemporaryDirectory() as folder:
            installer, campus, database, recovery, helper, nginx = self.exercise(Path(folder), 'nginx')
            installer.restore_service.assert_not_called()
            installer.switch_service.assert_not_called()
            database.postgres_snapshot.assert_not_called()
            campus.activate.assert_not_called()
            self.assertEqual(helper.read_bytes(), b'old installer')
            self.assertEqual(nginx.read_text(), NGINX)

    def test_embedded_remote_source_compiles(self):
        command = activation.remote_command()
        source = base64.b64decode(command.split('b64decode("', 1)[1].split('"', 1)[0]).decode()
        compile(source, 'activation', 'exec')

    def test_wrong_aws_account_cannot_dispatch(self):
        with patch.object(activation, 'aws', return_value='{"Account":"different"}') as aws, \
                contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(activation.main(), 1)
            aws.assert_called_once_with(['sts', 'get-caller-identity'])


if __name__ == '__main__':
    unittest.main()
