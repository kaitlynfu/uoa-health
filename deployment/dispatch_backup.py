"""GitHub-only backup dispatcher. Database bytes stay between EC2 and private S3."""
from datetime import datetime
import json
import os
import re
import sys
import time
import uuid

from dispatch_backend import REPOSITORY, REGION, INSTANCE, aws, command, mask, DispatchError
from team43_backup_database import BUCKET, MAX_BYTES, validate_inputs

DOCUMENT = 'Team43-BackupDatabase'


def check_context(environment):
    if (environment.get('GITHUB_ACTIONS') != 'true'
            or environment.get('GITHUB_REPOSITORY') != REPOSITORY
            or environment.get('GITHUB_REF') != 'refs/heads/main'
            or environment.get('GITHUB_EVENT_NAME') not in ('workflow_dispatch', 'schedule')
            or not re.fullmatch('[a-f0-9]{40}', environment.get('GITHUB_SHA', ''))):
        raise DispatchError('Backup must run in this repository on main, manually or by schedule.')
    if (environment['GITHUB_EVENT_NAME'] == 'schedule'
            and environment.get('TEAM43_BACKUPS_ENABLED') != 'true'):
        raise DispatchError('Scheduled backups are not enabled.')


def s3_client(session=None):
    # Lazy imports allow the portable safety tests to run without the SDK.
    import boto3
    from botocore.config import Config
    session = session or boto3.Session()
    return session.client('s3', region_name=REGION,
                          endpoint_url=f'https://s3.{REGION}.amazonaws.com',
                          config=Config(signature_version='s3v4',
                                        s3={'addressing_style': 'virtual'},
                                        request_checksum_calculation='when_required'))


def presign(client, backup_id, extension='sqlite3'):
    if extension not in ('sqlite3', 'dump'):
        raise DispatchError('Unsupported backup format.')
    return client.generate_presigned_url('put_object', Params={
        'Bucket': BUCKET, 'Key': f'database/{backup_id}.{extension}',
        'ContentType': 'application/octet-stream',
        'ServerSideEncryption': 'AES256', 'IfNoneMatch': '*',
    }, ExpiresIn=900, HttpMethod='PUT')


def poll(command_id, environment, *, timeout=600, delay=5):
    deadline = time.monotonic() + timeout
    last_status = None
    while time.monotonic() < deadline:
        try:
            response = json.loads(aws(['ssm', 'get-command-invocation', '--command-id', command_id,
                                      '--instance-id', INSTANCE, '--output', 'json'], environment))
        except DispatchError as error:
            if str(error) != 'InvocationDoesNotExist':
                raise
            time.sleep(delay)
            continue
        status = response['Status']
        if status not in ('Pending', 'InProgress', 'Delayed', 'Cancelling', 'Success',
                          'Failed', 'Cancelled', 'TimedOut'):
            raise DispatchError('Unexpected SSM status; inspect the command in AWS.')
        if status != last_status:
            print(f'Backup status: {status}', flush=True)
            last_status = status
        if status == 'Success':
            if response.get('ResponseCode') != 0:
                raise DispatchError('SSM Success did not have exit code 0.')
            return response
        if status in ('Failed', 'Cancelled', 'TimedOut'):
            # Never echo SSM stderr: it can contain signed command parameters.
            raise DispatchError(f'Backup command {status}; inspect its output in AWS before retrying.')
        time.sleep(delay)
    raise DispatchError('Backup result timed out. The command may still be running; inspect SSM and S3.')


def validate_result(response, backup_id, extension='sqlite3'):
    try:
        result = json.loads(response['StandardOutputContent'].strip())
        if (result['status'] != 'uploaded' or result['backup_id'] != backup_id
                or result['bucket'] != BUCKET or result['key'] != f'database/{backup_id}.{extension}'
                or type(result['bytes']) is not int or not 0 < result['bytes'] <= MAX_BYTES
                or type(result['programmes']) is not int or result['programmes'] < 1
                or not re.fullmatch('[a-f0-9]{64}', result['sha256'])
                or result['version_id'] == 'null'
                or not re.fullmatch(r'[A-Za-z0-9._~+/=-]{1,1024}', result['version_id'])
                or datetime.fromisoformat(result['completed_at']).tzinfo is None):
            raise ValueError('Invalid backup metadata')
    except (KeyError, TypeError, ValueError, AttributeError):
        raise DispatchError('Missing or invalid backup confirmation; inspect SSM and S3.') from None
    # Only return the verified fields; never echo arbitrary command output.
    return {key: result[key] for key in ('backup_id', 'bucket', 'key', 'bytes', 'sha256',
                                       'version_id', 'programmes')}


def main():
    try:
        check_context(os.environ)
        if command(['git', 'rev-parse', 'HEAD']) != os.environ['GITHUB_SHA']:
            raise DispatchError('Checkout does not match this workflow run.')
        backup_id = uuid.uuid4().hex
        mode = os.environ.get('TEAM43_DATABASE_ENGINE') or 'sqlite'
        if mode not in ('sqlite', 'postgresql'):
            raise DispatchError('TEAM43_DATABASE_ENGINE must be sqlite or postgresql.')
        extension = 'dump' if mode == 'postgresql' else 'sqlite3'
        document_version = '2' if mode == 'postgresql' else '1'
        url = presign(s3_client(), backup_id, extension)
        mask(url)
        if mode == 'postgresql':
            validate_inputs(backup_id, url, extension)
        else:
            validate_inputs(backup_id, url)
        parameters = {'BackupId': [backup_id], 'UploadUrl': [url]}
        response = json.loads(aws(['ssm', 'send-command', '--instance-ids', INSTANCE,
                                  '--document-name', DOCUMENT, '--document-version', document_version,
                                  '--parameters', json.dumps(parameters), '--timeout-seconds', '120',
                                  '--comment', f'Team43 database backup {backup_id}',
                                  '--output', 'json'], dict(os.environ)))
        command_id = response['Command']['CommandId']
        if not re.fullmatch('[a-f0-9-]{36}', command_id):
            raise DispatchError('Unexpected SSM command ID; inspect AWS before retrying.')
        print(f'SSM command ID: {command_id}', flush=True)
        result = validate_result(poll(command_id, dict(os.environ)), backup_id, extension)
        print(f'Backup uploaded and confirmed: {result["key"]}', flush=True)
        summary = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary, 'a', encoding='utf-8') as report:
                report.write('### Database backup uploaded\n\n'
                             f'Bucket: `{BUCKET}`\n\nObject: `{result["key"]}`\n\n'
                             f'Version: `{result["version_id"]}`\n\n'
                             f'SHA256: `{result["sha256"]}`\n\n'
                             f'Bytes: {result["bytes"]}; programmes: {result["programmes"]}.\n\n'
                             f'SSM command: `{command_id}`\n\n'
                             'Upload was confirmed by S3. This is not a download/restore test.\n')
        return 0
    except Exception as error:
        message = str(error) if isinstance(error, DispatchError) else type(error).__name__
        print(f'Backup failed: {message}', file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
