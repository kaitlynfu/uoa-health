import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).parent))
import dispatch_backend as dispatcher


class BrowserReleaseTests(unittest.TestCase):
    def make_export(self, root, commit):
        public = root / 'web'
        public.mkdir()
        (public / 'index.html').write_text('<html>app</html>')
        (public / 'build-info.json').write_text(json.dumps({'commit': commit, 'api': dispatcher.HEALTH_URL.removesuffix('/health')}))
        archive = root / 'backend.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            entry = tarfile.TarInfo('backend/app/main.py')
            content = b'# original backend'
            entry.size = len(content)
            tar.addfile(entry, io.BytesIO(content))
        return public, archive

    def test_bundles_the_exact_public_export_with_original_backend(self):
        with tempfile.TemporaryDirectory() as temporary:
            public, archive = self.make_export(Path(temporary), 'a'*40)
            dispatcher.include_web_export(archive, public, 'a'*40)
            with tarfile.open(archive) as tar:
                assert tar.extractfile('backend/app/main.py').read() == b'# original backend'
                assert tar.extractfile('backend/app/static/web/index.html').read() == b'<html>app</html>'

    def test_rejects_stale_export_or_private_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            public, archive = self.make_export(Path(temporary), 'a'*40)
            before = archive.read_bytes()
            with self.assertRaises(dispatcher.DispatchError):
                dispatcher.include_web_export(archive, public, 'b'*40)
            (public / '.env').write_text('private')
            with self.assertRaises(dispatcher.DispatchError):
                dispatcher.include_web_export(archive, public, 'a'*40)
            assert archive.read_bytes() == before

    def test_rejects_a_link_outside_the_public_export(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            public, archive = self.make_export(root, 'a'*40)
            secret = root / 'secret.txt'
            secret.write_text('private')
            try:
                (public / 'linked.txt').symlink_to(secret)
            except OSError:
                self.skipTest('Symlinks require permission on this platform.')
            with self.assertRaises(dispatcher.DispatchError):
                dispatcher.include_web_export(archive, public, 'a'*40)
