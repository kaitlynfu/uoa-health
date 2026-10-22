import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import dispatch_backend as dispatcher


class DispatcherTests(unittest.TestCase):
    def test_only_main_actions_can_deploy(self):
        valid = {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': dispatcher.REPOSITORY,
                 'GITHUB_REF': 'refs/heads/main', 'GITHUB_SHA': 'a' * 40,
                 'GITHUB_EVENT_NAME': 'workflow_dispatch'}
        self.assertEqual(dispatcher.github_commit(valid), 'a' * 40)
        for field, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_REPOSITORY', 'other/repo'),
                             ('GITHUB_REF', 'refs/heads/feature'), ('GITHUB_SHA', 'main'),
                             ('GITHUB_EVENT_NAME', 'pull_request')]:
            with self.subTest(field=field), self.assertRaises(dispatcher.DispatchError):
                dispatcher.github_commit(dict(valid, **{field: value}))

    def test_poll_handles_eventual_consistency(self):
        replies = [dispatcher.DispatchError('InvocationDoesNotExist'),
                   json.dumps({'Status': 'Pending'}), json.dumps({'Status': 'InProgress'}),
                   json.dumps({'Status': 'Success', 'ResponseCode': 0})]
        with patch.object(dispatcher, 'aws', side_effect=replies), patch.object(dispatcher.time, 'sleep'):
            self.assertEqual(dispatcher.poll('command', {}, delay=0)['Status'], 'Success')

    def test_terminal_failure_is_not_success(self):
        for status in ['Failed', 'TimedOut', 'Cancelled']:
            with self.subTest(status=status), patch.object(dispatcher, 'aws', return_value=json.dumps({'Status': status})):
                with self.assertRaises(dispatcher.DispatchError):
                    dispatcher.poll('command', {}, delay=0)

    def test_poll_timeout(self):
        with self.assertRaises(dispatcher.DispatchError):
            dispatcher.poll('command', {}, timeout=0)

    def test_nonzero_response_code(self):
        with patch.object(dispatcher, 'aws', return_value=json.dumps({'Status': 'Success', 'ResponseCode': 1})):
            with self.assertRaises(dispatcher.DispatchError):
                dispatcher.poll('command', {})

    def test_no_signed_url_in_aws_error(self):
        result = subprocess.CompletedProcess([], 1, '', 'An error occurred (AccessDenied) SECRET_DOWNLOAD_URL')
        with patch.object(dispatcher.subprocess, 'run', return_value=result):
            with self.assertRaises(dispatcher.DispatchError) as error:
                dispatcher.command(['aws', 'something', 'SECRET_DOWNLOAD_URL'])
        self.assertEqual(str(error.exception), 'AccessDenied')

    def test_mask_escapes_workflow_command(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            dispatcher.mask('https://example.test/?x=a%2Fb')
        self.assertEqual(output.getvalue(), '::add-mask::https://example.test/?x=a%252Fb\n')

    def test_stale_commit_never_calls_aws(self):
        with patch.object(dispatcher, 'github_commit', return_value='a' * 40), \
                patch.object(dispatcher, 'command', return_value='a' * 40), \
                patch.object(dispatcher, 'check_current_main', return_value=False), \
                patch.object(dispatcher, 'aws') as aws:
            self.assertEqual(dispatcher.main(), 0)
            aws.assert_not_called()

    def test_dispatches_exact_commit_only_after_validation(self):
        commit = 'a' * 40
        url = (f'https://{dispatcher.BUCKET}.s3.{dispatcher.REGION}.amazonaws.com/'
               f'backend/releases/{commit}/backend.tar.gz?'
               'X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc')

        def local_command(args, environment=None):
            if args[:2] == ['git', 'archive']:
                Path(next(arg.split('=', 1)[1] for arg in args if arg.startswith('--output='))).write_bytes(b'archive')
                return ''
            return commit

        with patch.object(dispatcher, 'github_commit', return_value=commit), \
                patch.object(dispatcher, 'command', side_effect=local_command), \
                patch.object(dispatcher, 'check_current_main', return_value=True), \
                patch.object(dispatcher, 'extract'), \
                patch.object(dispatcher, 'mask'), \
                patch.object(dispatcher, 'aws', side_effect=['{}', url, '{"Command":{"CommandId":"test-id"}}']) as aws, \
                patch.object(dispatcher, 'poll') as poll, \
                patch.object(dispatcher, 'public_health', return_value={'programmes': 9}) as health, \
                patch.dict(os.environ, {'GITHUB_STEP_SUMMARY': ''}):
            self.assertEqual(dispatcher.main(), 0)
            args = aws.call_args_list[-1].args[0]
            parameters = json.loads(args[args.index('--parameters') + 1])
            self.assertEqual(parameters['CommitId'], [commit])
            self.assertEqual(parameters['DownloadUrl'], [url])
            self.assertEqual(args[args.index('--instance-ids') + 1], dispatcher.INSTANCE)
            self.assertEqual(args[args.index('--document-version') + 1], '1')
            poll.assert_called_once()
            health.assert_called_once()


if __name__ == '__main__':
    unittest.main()
