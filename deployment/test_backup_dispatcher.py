"""Dispatcher tests: no live AWS requests or private database access."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).parent))
import dispatch_backup as dispatcher
from team43_backup_database import validate_inputs

BACKUP_ID = 'a' * 32
COMMAND_ID = '12345678-1234-1234-1234-123456789abc'


def metadata():
    return {'status': 'uploaded', 'backup_id': BACKUP_ID, 'bucket': dispatcher.BUCKET,
            'key': f'database/{BACKUP_ID}.sqlite3', 'bytes': 475136, 'programmes': 9,
            'sha256': 'b' * 64, 'version_id': 'example-version',
            'completed_at': '2026-09-10T10:00:00+00:00'}


class BackupDispatcherTests(unittest.TestCase):
    def context(self):
        return {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': dispatcher.REPOSITORY,
                'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'workflow_dispatch',
                'GITHUB_SHA': 'c' * 40}

    def test_main_only_context(self):
        dispatcher.check_context(self.context())
        for key, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_REPOSITORY', 'other/repo'),
                           ('GITHUB_REF', 'refs/heads/feature'), ('GITHUB_EVENT_NAME', 'pull_request'),
                           ('GITHUB_SHA', 'main')]:
            with self.subTest(key=key), self.assertRaises(dispatcher.DispatchError):
                dispatcher.check_context(dict(self.context(), **{key: value}))

    def test_schedule_requires_explicit_enable(self):
        context = dict(self.context(), GITHUB_EVENT_NAME='schedule')
        with self.assertRaises(dispatcher.DispatchError):
            dispatcher.check_context(context)
        dispatcher.check_context(dict(context, TEAM43_BACKUPS_ENABLED='true'))

    def test_result_validation(self):
        result = dispatcher.validate_result({'StandardOutputContent': json.dumps(metadata())}, BACKUP_ID)
        self.assertEqual(result['programmes'], 9)
        self.assertNotIn('completed_at', result)
        for key, value in [('status', 'accepted'), ('backup_id', 'wrong'), ('bucket', 'other'),
                           ('key', 'other/key'), ('bytes', 0), ('programmes', True),
                           ('programmes', 0), ('sha256', 'bad'), ('version_id', 'null'),
                           ('version_id', 'bad\nsummary'), ('completed_at', '2026-09-10T10:00:00')]:
            with self.subTest(key=key), self.assertRaises(dispatcher.DispatchError):
                dispatcher.validate_result({'StandardOutputContent': json.dumps(dict(metadata(), **{key: value}))}, BACKUP_ID)

    def test_missing_or_malformed_confirmation_rejected(self):
        for response in [{}, {'StandardOutputContent': ''}, {'StandardOutputContent': '{}'},
                         {'StandardOutputContent': 'null'}, {'StandardOutputContent': 'not-json'}]:
            with self.subTest(response=response), self.assertRaises(dispatcher.DispatchError):
                dispatcher.validate_result(response, BACKUP_ID)

    def test_eventual_consistency(self):
        replies = [dispatcher.DispatchError('InvocationDoesNotExist'),
                   json.dumps({'Status': 'InProgress'}),
                   json.dumps({'Status': 'Success', 'ResponseCode': 0})]
        with patch.object(dispatcher, 'aws', side_effect=replies), patch.object(dispatcher.time, 'sleep'):
            self.assertEqual(dispatcher.poll(COMMAND_ID, {}, delay=0)['Status'], 'Success')

    def test_failure_and_timeout(self):
        for response in [{'Status': 'Failed'}, {'Status': 'TimedOut'}, {'Status': 'Cancelled'},
                         {'Status': 'Success', 'ResponseCode': 1}, {'Status': 'unknown'}]:
            with patch.object(dispatcher, 'aws', return_value=json.dumps(response)), self.assertRaises(dispatcher.DispatchError):
                dispatcher.poll(COMMAND_ID, {}, delay=0)
        with self.assertRaises(dispatcher.DispatchError):
            dispatcher.poll(COMMAND_ID, {}, timeout=0)

    def test_presign_contract(self):
        client = Mock()
        dispatcher.presign(client, BACKUP_ID)
        args = client.generate_presigned_url.call_args
        self.assertEqual(args.args, ('put_object',))
        self.assertEqual(args.kwargs['HttpMethod'], 'PUT')
        self.assertEqual(args.kwargs['ExpiresIn'], 900)
        self.assertEqual(args.kwargs['Params'], {
            'Bucket': dispatcher.BUCKET, 'Key': f'database/{BACKUP_ID}.sqlite3',
            'ContentType': 'application/octet-stream', 'ServerSideEncryption': 'AES256',
            'IfNoneMatch': '*',
        })

    @unittest.skipUnless(importlib.util.find_spec('boto3'), 'Install backup-requirements.txt for offline SDK signing test')
    def test_real_sdk_signature_with_fake_credentials(self):
        import boto3
        session = boto3.Session(aws_access_key_id='TESTONLY', aws_secret_access_key='not-a-real-key',
                                aws_session_token='test-token')
        url = dispatcher.presign(dispatcher.s3_client(session), BACKUP_ID)
        validate_inputs(BACKUP_ID, url)

    def test_main_sends_only_fixed_command_and_validates_result(self):
        with patch.dict(os.environ, dict(self.context(), GITHUB_STEP_SUMMARY='')), \
                patch.object(dispatcher, 'command', return_value='c' * 40), \
                patch.object(dispatcher.uuid, 'uuid4', return_value=Mock(hex=BACKUP_ID)), \
                patch.object(dispatcher, 's3_client'), \
                patch.object(dispatcher, 'presign', return_value='signed-url'), \
                patch.object(dispatcher, 'mask') as mask, \
                patch.object(dispatcher, 'validate_inputs') as validate, \
                patch.object(dispatcher, 'aws', return_value=json.dumps({'Command': {'CommandId': COMMAND_ID}})) as aws, \
                patch.object(dispatcher, 'poll', return_value={'StandardOutputContent': json.dumps(metadata())}):
            self.assertEqual(dispatcher.main(), 0)
            mask.assert_called_once_with('signed-url')
            validate.assert_called_once_with(BACKUP_ID, 'signed-url')
            args = aws.call_args.args[0]
            self.assertEqual(args[args.index('--document-name') + 1], dispatcher.DOCUMENT)
            self.assertEqual(args[args.index('--instance-ids') + 1], dispatcher.INSTANCE)
            self.assertEqual(args[args.index('--document-version') + 1], '1')
            self.assertEqual(json.loads(args[args.index('--parameters') + 1]),
                             {'BackupId': [BACKUP_ID], 'UploadUrl': ['signed-url']})
            aws.assert_called_once()  # No GetObject, HeadObject or upload through this runner.


if __name__ == '__main__':
    unittest.main()
