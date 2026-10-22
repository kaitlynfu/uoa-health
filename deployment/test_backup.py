"""Portable backup tests using synthetic databases and mocked S3, not live data."""
from contextlib import closing, redirect_stderr
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import urllib.parse

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('team43_backup_database.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
BACKUP_ID = 'a' * 32
URL = f'https://{backup.BUCKET_HOST}/database/{BACKUP_ID}.sqlite3?' + urllib.parse.urlencode({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Signature': 'b' * 64,
    'X-Amz-SignedHeaders': backup.SIGNED_HEADERS, 'X-Amz-Expires': '900',
})


class Response:
    status = 200

    def __init__(self, payload):
        self.headers = {'ETag': '"' + hashlib.md5(payload, usedforsecurity=False).hexdigest() + '"',
                        'x-amz-server-side-encryption': 'AES256', 'x-amz-version-id': 'test-version'}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class BackupTests(unittest.TestCase):
    def make_db(self, path, count=9):
        with closing(sqlite3.connect(path)) as db:
            db.execute('CREATE TABLE programmes (id INTEGER PRIMARY KEY, name TEXT)')
            db.executemany('INSERT INTO programmes(name) VALUES (?)', [('synthetic',)] * count)
            db.commit()

    def test_valid_url(self):
        backup.validate_inputs(BACKUP_ID, URL)

    def test_invalid_url_or_id_rejected(self):
        urls = [URL.replace('https:', 'http:'), URL.replace(backup.BUCKET_HOST, 'example.org'),
                URL.replace(backup.BUCKET_HOST, backup.BUCKET_HOST + ':443'), URL + '#fragment',
                URL.replace(BACKUP_ID, 'c' * 32), URL.replace('/database/', '/other/'),
                URL.replace('900', '901'), URL.replace('900', '0'),
                URL.replace('AWS4-HMAC-SHA256', 'bad'), URL.replace('if-none-match', 'other'),
                URL + '&X-Amz-Expires=900', URL + ';evil']
        for url in urls:
            with self.subTest(url=url), self.assertRaises(backup.BackupError):
                backup.validate_inputs(BACKUP_ID, url)
        with self.assertRaises(backup.BackupError):
            backup.validate_inputs('../invalid', URL)

    def test_snapshot_and_restore_preserve_all_contents(self):
        with tempfile.TemporaryDirectory() as temp:
            source, snapshot, restored = [Path(temp) / name for name in ('source', 'snapshot', 'restored')]
            self.make_db(source)
            before = source.read_bytes()
            self.assertEqual(backup.snapshot(source, snapshot), 9)
            self.assertEqual(source.read_bytes(), before)
            with closing(sqlite3.connect(snapshot)) as saved, closing(sqlite3.connect(restored)) as target:
                saved.backup(target)
                self.assertEqual(list(saved.iterdump()), list(target.iterdump()))
                self.assertEqual(target.execute('PRAGMA integrity_check').fetchall(), [('ok',)])
            if os.name != 'nt':
                self.assertEqual(snapshot.stat().st_mode & 0o777, 0o600)

    def test_snapshot_includes_committed_wal_data(self):
        with tempfile.TemporaryDirectory() as temp:
            source, snapshot = Path(temp) / 'source', Path(temp) / 'snapshot'
            self.make_db(source)
            with closing(sqlite3.connect(source)) as writer:
                writer.execute('PRAGMA journal_mode=WAL')
                writer.execute("INSERT INTO programmes(name) VALUES ('wal record')")
                writer.commit()
                self.assertEqual(backup.snapshot(source, snapshot), 10)

    def test_missing_source_is_not_created(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'missing'
            with self.assertRaises(FileNotFoundError):
                backup.snapshot(source, Path(temp) / 'snapshot')
            self.assertFalse(source.exists())

    def test_existing_destination_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            source, destination = Path(temp) / 'source', Path(temp) / 'existing'
            self.make_db(source)
            destination.write_bytes(b'keep me')
            with self.assertRaises(FileExistsError):
                backup.snapshot(source, destination)
            self.assertEqual(destination.read_bytes(), b'keep me')

    def test_empty_programmes_and_oversized_database_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'source'
            self.make_db(source, count=0)
            with self.assertRaises(backup.BackupError):
                backup.snapshot(source, Path(temp) / 'empty')
            with patch.object(backup, 'MAX_BYTES', 1), self.assertRaises(backup.BackupError):
                backup.snapshot(source, Path(temp) / 'large')

    def test_upload_headers_and_confirmation(self):
        payload = b'synthetic database bytes'
        with tempfile.TemporaryDirectory() as temp, patch.object(backup.urllib.request, 'build_opener') as factory:
            path = Path(temp) / 'snapshot'
            path.write_bytes(payload)

            def accept(request, timeout):
                self.assertEqual(request.method, 'PUT')
                self.assertEqual(request.data.read(), payload)
                self.assertEqual(request.get_header('Content-length'), str(len(payload)))
                self.assertEqual(request.get_header('If-none-match'), '*')
                self.assertEqual(request.get_header('X-amz-server-side-encryption'), 'AES256')
                # Regression: S3 rejects unsigned Content-MD5 with AccessDenied.
                self.assertIsNone(request.get_header('Content-md5'))
                return Response(payload)

            factory.return_value.open.side_effect = accept
            result = backup.upload(path, URL)
            self.assertEqual(result['sha256'], hashlib.sha256(payload).hexdigest())
            self.assertEqual(result['version_id'], 'test-version')
            handlers = factory.call_args.args
            self.assertIsInstance(handlers[1], backup.NoRedirect)
            self.assertEqual(handlers[0].proxies, {})

    def test_incomplete_s3_confirmation_fails(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(backup.urllib.request, 'build_opener') as factory:
            path = Path(temp) / 'snapshot'
            path.write_bytes(b'data')
            for field in ('ETag', 'x-amz-version-id', 'x-amz-server-side-encryption'):
                response = Response(b'data')
                del response.headers[field]
                factory.return_value.open.return_value = response
                with self.subTest(field=field), self.assertRaises(backup.BackupError):
                    backup.upload(path, URL)

    def test_mismatched_s3_checksum_is_not_reported_as_success(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(backup.urllib.request, 'build_opener') as factory:
            path = Path(temp) / 'snapshot'
            path.write_bytes(b'original snapshot')
            factory.return_value.open.return_value = Response(b'different bytes')
            with self.assertRaisesRegex(backup.BackupError, 'checksum confirmation failed'):
                backup.upload(path, URL)

    def test_upload_errors_do_not_leak_url(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(backup.urllib.request, 'build_opener') as factory:
            path = Path(temp) / 'snapshot'
            path.write_bytes(b'data')
            for error in [RuntimeError(URL), urllib.error.HTTPError(URL, 403, URL, {}, None)]:
                factory.return_value.open.side_effect = error
                with self.assertRaises(backup.BackupError) as raised:
                    backup.upload(path, URL)
                self.assertNotIn('X-Amz', str(raised.exception))

    def test_main_redacts_unexpected_errors(self):
        output = io.StringIO()
        with patch.object(backup, 'run_backup', side_effect=RuntimeError(URL)), redirect_stderr(output):
            self.assertEqual(backup.main([BACKUP_ID]), 1)
        self.assertNotIn('X-Amz', output.getvalue())

    def test_s3_error_classification_without_response_leak(self):
        samples = [
            (b'<Error><Code>SignatureDoesNotMatch</Code><Message>SECRET</Message>'
             b'<CanonicalRequest>SECRET_URL</CanonicalRequest></Error>', 'SignatureDoesNotMatch'),
            (b'<Error><Code>AccessDenied</Code><Message>User SECRET: explicit deny in a service control policy</Message></Error>',
             'AccessDenied; category: organisation service-control policy'),
            (b'<Error><Code>ExpiredToken</Code><Message>SECRET_TOKEN</Message></Error>', 'ExpiredToken'),
            (b'<Error><Code>SECRET_CODE</Code></Error>', 'UnrecognizedS3Error'),
            (b'<Error><Code>AccessDenied</Code><Message>SECRET_VALUE</Message></Error>',
             'AccessDenied; category: unrecognized reason (message withheld)'),
        ]
        for body, expected in samples:
            with self.subTest(expected=expected):
                result = backup.safe_s3_error(io.BytesIO(body))
                self.assertEqual(result, expected)
                self.assertNotIn('SECRET', result)

    def test_unsigned_headers_report_only_allowlisted_names(self):
        cases = [
            ('content-md5', 'content-md5'),
            ('Content-MD5; x-amz-server-side-encryption,content-md5',
             'content-md5, x-amz-server-side-encryption'),
            ('content-md5;SECRET_URL', 'content-md5, other header (name withheld)'),
            ('SECRET_TOKEN', 'other header (name withheld)'),
            ('', ''),
        ]
        for names, expected in cases:
            with self.subTest(names=names):
                body = ('<Error><Code>AccessDenied</Code><Message>SECRET_MESSAGE</Message>'
                        f'<HeadersNotSigned>{names}</HeadersNotSigned>'
                        '<CanonicalRequest>SECRET_REQUEST</CanonicalRequest></Error>').encode()
                result = backup.safe_s3_error(io.BytesIO(body))
                suffix = ': ' + expected if expected else ''
                self.assertEqual(result, 'AccessDenied; category: unsigned headers' + suffix)
                self.assertNotIn('SECRET', result)

    def test_unsigned_header_message_variants_without_header_element(self):
        for message in (
            'There were headers present in the request which were not signed',
            'There were headers present in the request that were not signed',
            'Headers that were present in the request were not signed',
            'There were HEADERS present\n in the request which were not signed',
        ):
            with self.subTest(message=message):
                body = f'<Error><Code>AccessDenied</Code><Message>{message}</Message></Error>'.encode()
                self.assertEqual(backup.safe_s3_error(io.BytesIO(body)),
                                 'AccessDenied; category: unsigned headers')

    def test_generic_and_missing_denial_messages_are_distinguished(self):
        cases = [
            ('<Message>Access Denied</Message>', 'generic denial (S3 supplied no detailed reason)'),
            ('<Message> Access  Denied. </Message>', 'generic denial (S3 supplied no detailed reason)'),
            ('', 'no message supplied by S3'),
        ]
        for message, expected in cases:
            with self.subTest(message=message):
                body = f'<Error><Code>AccessDenied</Code>{message}</Error>'.encode()
                self.assertEqual(backup.safe_s3_error(io.BytesIO(body)),
                                 'AccessDenied; category: ' + expected)

    def test_denial_policy_categories_with_normalized_whitespace(self):
        for phrase, label in (
            ('service control policy', 'organisation service-control policy'),
            ('resource control policy', 'organisation resource-control policy'),
            ('permissions boundary', 'permissions boundary'),
            ('identity-based policy', 'identity policy'),
            ('resource-based policy', 'resource policy'),
            ('session policy', 'session policy'),
            ('VPC endpoint policy', 'VPC endpoint policy'),
            ('request has expired', 'expired request'),
        ):
            with self.subTest(phrase=phrase):
                message = 'SECRET ' + phrase.upper().replace(' ', '\n  ') + ' SECRET'
                body = f'<Error><Code>AccessDenied</Code><Message>{message}</Message></Error>'.encode()
                self.assertEqual(backup.safe_s3_error(io.BytesIO(body)),
                                 'AccessDenied; category: ' + label)

    def test_error_parser_rejects_oversized_malformed_and_entity_xml(self):
        for body in [b'x' * 32769, b'<broken', b'<!DOCTYPE Error><Error><Code>AccessDenied</Code></Error>',
                     b'<!ENTITY secret "SECRET"><Error><Code>AccessDenied</Code></Error>']:
            stream = io.BytesIO(body)
            self.assertEqual(backup.safe_s3_error(stream), 'UnrecognizedS3Error')
            self.assertLessEqual(stream.tell(), 32769)

    def test_upload_reports_only_safe_s3_code_and_closes_error(self):
        body = io.BytesIO(b'<Error><Code>SignatureDoesNotMatch</Code><Message>SECRET</Message></Error>')
        error = urllib.error.HTTPError(URL, 403, URL, {}, body)
        with tempfile.TemporaryDirectory() as temp, patch.object(backup.urllib.request, 'build_opener') as factory:
            path = Path(temp) / 'snapshot'
            path.write_bytes(b'synthetic')
            factory.return_value.open.side_effect = error
            with self.assertRaises(backup.BackupError) as raised:
                backup.upload(path, URL)
            self.assertIn('HTTP 403; SignatureDoesNotMatch', str(raised.exception))
            self.assertNotIn('SECRET', str(raised.exception))
            self.assertNotIn('X-Amz', str(raised.exception))
            self.assertTrue(body.closed)

    def test_ssm_contract(self):
        document = json.loads(Path(__file__).with_name('ssm-backup-document.json').read_text())
        for name, value in [('BackupId', BACKUP_ID), ('UploadUrl', URL)]:
            parameter = document['parameters'][name]
            self.assertEqual(parameter['interpolationType'], 'ENV_VAR')
            self.assertTrue(re.fullmatch(parameter['allowedPattern'], value))
        commands = document['mainSteps'][0]['inputs']['runCommand']
        self.assertFalse(any('{{' in command for command in commands))
        self.assertNotIn('$SSM_UploadUrl', '\n'.join(commands))
        self.assertIn('/usr/local/sbin/team43-backup-database', commands[-1])


if __name__ == '__main__':
    unittest.main()
