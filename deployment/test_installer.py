"""Portable safety tests; does not contact AWS or run systemctl."""
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('team43_deploy_backend.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
COMMIT = 'a' * 40
CHECKSUM = 'b' * 64
URL = f'https://{installer.BUCKET_HOST}/backend/releases/{COMMIT}/backend.tar.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc'


class InstallerTests(unittest.TestCase):
    def test_valid_input(self):
        installer.validate_inputs(COMMIT, CHECKSUM, URL)

    def test_input_rejections(self):
        cases = [('../oops', CHECKSUM, URL), (COMMIT, 'bad', URL)]
        for url in [URL.replace('https:', 'http:'), URL.replace(installer.BUCKET_HOST, 'example.com'),
                    URL.replace('/' + COMMIT + '/', '/' + 'c' * 40 + '/'), URL + '#fragment',
                    URL + ';echo', URL.replace('X-Amz-Signature', 'other'),
                    URL.replace(installer.BUCKET_HOST, installer.BUCKET_HOST + ':443'),
                    URL.replace('/backend/releases/', '/backend/releases/../')]:
            cases.append((COMMIT, CHECKSUM, url))
        for values in cases:
            with self.subTest(values=values), self.assertRaises(installer.DeploymentError):
                installer.validate_inputs(*values)

    def make_archive(self, folder, extra=None):
        archive = folder / 'input.tar.gz'
        with tarfile.open(archive, 'w:gz') as bundle:
            for name in ['requirements.txt', 'app/main.py', 'app/models.py', 'app/database.py', 'tests/conftest.py']:
                item = tarfile.TarInfo('backend/' + name)
                item.size = 4
                bundle.addfile(item, io.BytesIO(b'test'))
            if extra:
                bundle.addfile(extra, io.BytesIO(b''))
        return archive

    def test_extract_regular_archive(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            installer.extract(self.make_archive(folder), folder / 'out')
            self.assertEqual((folder / 'out/backend/app/main.py').read_text(), 'test')

    def test_extract_rejects_unsafe_entries(self):
        cases = ['../outside', '/absolute', 'other/file', 'backend/../outside',
                 'backend/.env', 'backend/.env.local', 'backend/private.pem', 'backend/data.db',
                 'backend/.venv/bin/python', 'backend/app/main.py', 'backend/dir\\file']
        for name in cases:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                folder = Path(temp)
                archive = self.make_archive(folder, tarfile.TarInfo(name))
                with self.assertRaises(installer.DeploymentError):
                    installer.extract(archive, folder / 'out')

    def test_extract_rejects_links_and_devices(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.FIFOTYPE):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temp:
                item = tarfile.TarInfo('backend/link')
                item.type = kind
                item.linkname = '/etc/passwd'
                folder = Path(temp)
                with self.assertRaises(installer.DeploymentError):
                    installer.extract(self.make_archive(folder, item), folder / 'out')

    def test_schema_guard(self):
        with tempfile.TemporaryDirectory() as temp:
            old, new = Path(temp) / 'old', Path(temp) / 'new'
            for root in (old, new):
                (root / 'app').mkdir(parents=True)
                for name in installer.SCHEMA_FILES:
                    (root / name).write_text('unchanged\n')
            installer.require_same_schema_files(old, new)
            (new / 'app/models.py').write_text('changed')
            with self.assertRaises(installer.DeploymentError):
                installer.require_same_schema_files(old, new)

    def test_download_checksum_and_error_redaction(self):
        payload = b'archive bytes'
        with tempfile.TemporaryDirectory() as temp, patch.object(installer.urllib.request, 'build_opener') as factory:
            factory.return_value.open.return_value = io.BytesIO(payload)
            installer.download(URL, Path(temp) / 'ok', hashlib.sha256(payload).hexdigest())
            factory.return_value.open.return_value = io.BytesIO(payload)
            with self.assertRaises(installer.DeploymentError):
                installer.download(URL, Path(temp) / 'bad', CHECKSUM)
            factory.return_value.open.side_effect = RuntimeError(URL)
            with self.assertRaises(installer.DeploymentError) as raised:
                installer.download(URL, Path(temp) / 'failed', CHECKSUM)
            self.assertNotIn('Signature', str(raised.exception))

    def test_override_and_restore(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(installer, 'run') as run:
            dropin = Path(temp) / 'service.d/50-team43-release.conf'
            with patch.object(installer, 'DROPIN', dropin):
                installer.switch_service(Path('/opt/team43/releases/example/backend'))
                self.assertIn('ExecStart=\nExecStart=', dropin.read_text())
                installer.restore_service(None)
                self.assertFalse(dropin.exists())
                dropin.write_bytes(b'previous config')
                installer.switch_service(Path('/opt/team43/releases/example2/backend'))
                installer.restore_service(b'previous config')
                self.assertEqual(dropin.read_bytes(), b'previous config')
                self.assertGreater(run.call_count, 4)

    def test_non_root_package_install(self):
        with patch.object(installer, 'run') as run:
            installer.as_ubuntu(Path('/tmp/backend'), ['python', '-m', 'pip'])
            command = run.call_args.args[0]
            self.assertEqual(command[:5], ['/usr/sbin/runuser', '-u', 'ubuntu', '--', '/usr/bin/env'])
            self.assertIn('DATABASE_URL=sqlite://', command)


if __name__ == '__main__':
    unittest.main()
