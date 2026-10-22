"""Offline checks for code transfer; never invokes AWS or remote Python."""
import ast
import base64
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import stage_campus_release as stage


class CampusStagingTests(unittest.TestCase):
    def test_database_companion_accepts_only_reviewed_sources(self):
        # Execute the actual remote guard, without executing the AWS bootstrap.
        function = next(node for node in ast.parse(stage.REMOTE).body
                        if isinstance(node, ast.FunctionDef)
                        and node.name == 'verify_database_companion')
        namespace = {}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'guard', 'exec'), namespace)
        verify = namespace['verify_database_companion']
        canonical = (Path(__file__).parent / 'team43_database.py').read_text(encoding='utf-8')
        comments = ("        # The child reads the OS descriptor, not Python's read-ahead buffer.\n"
                    "        # Unbuffered seek resets the actual descriptor after checking the header.\n")
        self.assertEqual(canonical.count(comments), 1)
        installed = canonical.replace(comments, '')
        digest = lambda source: hashlib.sha256(source.encode('utf-8')).hexdigest()
        verify(digest(canonical), digest(canonical))
        verify(digest(installed), digest(canonical))
        changed = installed.replace("buffering=0", "buffering=-1")
        self.assertNotEqual(changed, installed)
        with self.assertRaises(AssertionError):
            verify(digest(changed), digest(canonical))
        with self.assertRaises(AssertionError):
            verify(digest(changed), digest(changed))
        with self.assertRaises(AssertionError):
            verify(digest(installed + '# unreviewed\n'), digest(canonical))

    def test_package_checksum_failure_cannot_extract(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            archive = directory / 'bad.zip'
            archive.write_bytes(b'not-approved')
            with self.assertRaises(stage.StageError):
                stage.unpack(archive, directory)
            self.assertEqual(list(directory.iterdir()), [archive])

    def test_approved_zip_members_are_verified_before_transfer(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            archive = directory / 'package.zip'
            files = {'backend.tar.gz': (hashlib.sha256(b'backend').hexdigest(), 'backend-key'),
                     'operations.tar.gz': (hashlib.sha256(b'operations').hexdigest(), 'ops-key')}
            with zipfile.ZipFile(archive, 'w') as package:
                package.writestr('backend.tar.gz', b'backend')
                package.writestr('operations.tar.gz', b'operations')
            with patch.object(stage, 'FILES', files), \
                    patch.object(stage, 'ZIP_SHA', hashlib.sha256(archive.read_bytes()).hexdigest()):
                stage.unpack(archive, directory)
                self.assertEqual((directory / 'backend.tar.gz').read_bytes(), b'backend')
            with zipfile.ZipFile(archive, 'a') as package:
                package.writestr('../outside', b'unsafe')
            with patch.object(stage, 'ZIP_SHA', hashlib.sha256(archive.read_bytes()).hexdigest()), \
                    self.assertRaises(stage.StageError):
                stage.unpack(archive, directory)

    def test_existing_object_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / 'backend.tar.gz').write_bytes(b'code')
            calls = []
            def aws(arguments, environment):
                calls.append(arguments)
                if arguments[1] == 'put-object':
                    raise stage.StageError('PreconditionFailed')
                return json.dumps({'Metadata': {'sha256': 'different'}})
            with patch.object(stage, 'aws', side_effect=aws), self.assertRaises(stage.StageError):
                stage.upload(directory, 'backend.tar.gz', {})
            self.assertIn('--if-none-match', calls[0])
            self.assertEqual(len(calls), 2)

    def test_wrong_account_cannot_upload_or_dispatch(self):
        with patch.object(stage.sys, 'argv', ['stage.py']), \
                patch.object(stage, 'aws', return_value=json.dumps({'Account': 'other'})) as aws, \
                contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(stage.main(), 1)
            self.assertEqual(aws.call_count, 1)
            self.assertEqual(aws.call_args.args[0], ['sts', 'get-caller-identity'])

    def test_remote_program_compiles_and_encoded_urls_are_not_logged(self):
        urls = {name: 'https://private.example/file?credential=private-value' for name in stage.FILES}
        command = stage.remote_command(urls)
        self.assertNotIn('private-value', command)
        encoded = command.split('b64decode("', 1)[1].split('"', 1)[0]
        source = base64.b64decode(encoded).decode()
        compile(source, 'remote preparation', 'exec')
        self.assertIn('campus.rehearse', source)
        self.assertNotIn('campus.activate', source)
        output = stage.safe_output('https://host/file?secret=value\n' + encoded)
        self.assertNotIn('secret=value', output)
        self.assertNotIn(encoded, output)

    def test_operations_checks_use_isolated_pinned_sdk(self):
        source = stage.REMOTE
        self.assertIn('operations_python, "-m", "pip", "install", "-r", "backup-requirements.txt"', source)
        self.assertIn('operations_python, "-B", "-m", "unittest"', source)
        self.assertNotIn('--system-site-packages', source)
        self.assertLess(source.index('"backup-requirements.txt"'), source.index('"-m", "unittest"'))


if __name__ == '__main__':
    unittest.main()
