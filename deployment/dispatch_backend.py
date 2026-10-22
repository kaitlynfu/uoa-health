"""GitHub-only deployment dispatcher. Uses AWS CLI; never prints signed URLs."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

from team43_deploy_backend import extract, validate_inputs

REPOSITORY = 'uoa-compsci399-s2-2026-jun/team-43-project'
REGION = 'ap-southeast-2'
BUCKET = 'team43-deploy-467506935568-ap-southeast-2'
INSTANCE = 'i-0c9d31782bc7dfada'
DOCUMENT = 'Team43-DeployBackend'
HEALTH_URL = 'https://team43-api.3-27-96-180.sslip.io/health'


class DispatchError(Exception):
    pass


def github_commit(environment):
    commit = environment.get('GITHUB_SHA', '')
    if (environment.get('GITHUB_ACTIONS') != 'true'
            or environment.get('GITHUB_REPOSITORY') != REPOSITORY
            or environment.get('GITHUB_REF') != 'refs/heads/main'
            or environment.get('GITHUB_EVENT_NAME') not in ('push', 'workflow_dispatch')
            or not re.fullmatch('[a-f0-9]{40}', commit)):
        raise DispatchError('Deployment must run in GitHub Actions on this repository main branch.')
    return commit


def check_current_main(commit):
    token = os.environ.get('GH_TOKEN')
    if not token:
        raise DispatchError('GitHub read token is missing.')
    request = urllib.request.Request(
        f'https://api.github.com/repos/{REPOSITORY}/git/ref/heads/main',
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                 'User-Agent': 'team43-backend-deployer'})
    with urllib.request.urlopen(request, timeout=20) as response:
        current = json.load(response)['object']['sha']
    return current == commit


def command(args, environment=None):
    result = subprocess.run(args, capture_output=True, text=True, timeout=120, env=environment)
    if result.returncode:
        # CalledProcessError can include signed parameters. Do not expose it.
        error_code = re.search(r'An error occurred \(([^)]+)\)', result.stderr)
        code = error_code.group(1) if error_code else 'CommandFailed'
        raise DispatchError(code)
    return result.stdout.strip()


def aws(args, environment):
    return command(['aws', *args, '--region', REGION, '--no-cli-pager'], environment)


def mask(value):
    escaped = value.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print(f'::add-mask::{escaped}', flush=True)


def poll(command_id, environment, *, timeout=1400, delay=10):
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
        if status != last_status:
            print(f'Deployment status: {status}', flush=True)
            last_status = status
        if status == 'Success':
            if response.get('ResponseCode') != 0:
                raise DispatchError('SSM reported Success with a nonzero exit code.')
            return response
        if status not in ('Pending', 'InProgress', 'Delayed', 'Cancelling'):
            raise DispatchError(f'SSM deployment ended with {status}; inspect this command in AWS.')
        time.sleep(delay)
    raise DispatchError('Timed out waiting for SSM. It may still be running; inspect it before retrying.')


def public_health():
    with urllib.request.urlopen(HEALTH_URL, timeout=20) as response:
        health = json.load(response)
    if (health.get('status') != 'healthy' or health.get('database') != 'connected'
            or not isinstance(health.get('programmes'), int) or health['programmes'] < 1):
        raise DispatchError('External HTTPS health verification failed.')
    print('External HTTPS health check passed.', flush=True)
    return health


def include_web_export(archive, source, commit):
    """Package only the built public app, requiring its exact source commit."""
    source = Path(source)
    if source.is_symlink() or not (source / 'index.html').is_file():
        raise DispatchError('Browser export is missing its index.')
    metadata = json.loads((source / 'build-info.json').read_text())
    if metadata.get('commit') != commit or metadata.get('api') != HEALTH_URL.removesuffix('/health'):
        raise DispatchError('Browser export does not match this release and hosted API.')
    files = []
    for file in sorted(source.rglob('*')):
        relative = file.relative_to(source)
        if file.is_symlink() or any(part.startswith('.') for part in relative.parts):
            raise DispatchError('Browser export contains an unexpected hidden file or link.')
        if file.is_file():
            if file.suffix.lower() not in {'.html', '.js', '.json', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.ttf', '.otf', '.woff', '.woff2', '.txt', '.webmanifest'}:
                raise DispatchError('Browser export contains an unsupported public asset.')
            files.append((file, 'backend/app/static/web/' + relative.as_posix()))
    rebuilt = archive.with_suffix('.web.tar.gz')
    with tarfile.open(archive, 'r:gz') as old, tarfile.open(rebuilt, 'w:gz') as combined:
        for entry in old:
            if entry.name.startswith('backend/app/static/web/'):
                raise DispatchError('Browser export must not replace tracked release files.')
            combined.addfile(entry, old.extractfile(entry) if entry.isfile() else None)
        for file, name in files:
            combined.add(file, arcname=name, recursive=False)
    rebuilt.replace(archive)


def main():
    try:
        commit = github_commit(os.environ)
        if command(['git', 'rev-parse', 'HEAD']) != commit:
            raise DispatchError('Checkout does not match the tested GitHub commit.')
        if not check_current_main(commit):
            print('A newer commit is already on main. Skipping this stale deployment.')
            return 0
        with tempfile.TemporaryDirectory(prefix='team43-dispatch-') as temporary:
            directory = Path(temporary)
            archive = directory / 'backend.tar.gz'
            command(['git', 'archive', '--format=tar.gz', f'--output={archive}', commit, 'backend'])
            if web_export := os.environ.get('TEAM43_WEB_EXPORT'):
                include_web_export(archive, web_export, commit)
            # Validate the archive before uploading or touching the server.
            extract(archive, directory / 'validation')
            checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
            environment = dict(os.environ, AWS_CONFIG_FILE=str(directory / 'aws-config'))
            command(['aws', 'configure', 'set', 'default.s3.addressing_style', 'virtual'], environment)
            key = f'backend/releases/{commit}/backend.tar.gz'
            # Single PutObject needs no ListBucket or broad s3:* grant.
            aws(['s3api', 'put-object', '--bucket', BUCKET, '--key', key, '--body', str(archive),
                 '--server-side-encryption', 'AES256', '--output', 'json'], environment)
            url = aws(['s3', 'presign', f's3://{BUCKET}/{key}', '--expires-in', '900',
                       '--endpoint-url', f'https://s3.{REGION}.amazonaws.com'], environment)
            mask(url)
            validate_inputs(commit, checksum, url)
            # Stop stale queued runs immediately before issuing the deployment.
            if not check_current_main(commit):
                print('Main advanced while packaging. Skipping this stale deployment.')
                return 0
            parameters = {'CommitId': [commit], 'ArtifactSha256': [checksum], 'DownloadUrl': [url]}
            result = json.loads(aws(['ssm', 'send-command', '--instance-ids', INSTANCE,
                                    '--document-name', DOCUMENT, '--document-version', '1',
                                    '--parameters', json.dumps(parameters), '--timeout-seconds', '600',
                                    '--comment', f'Team43 backend {commit}', '--output', 'json'], environment))
            command_id = result['Command']['CommandId']
            print(f'SSM command ID: {command_id}', flush=True)
            poll(command_id, environment)
            health = public_health()
            summary = os.environ.get('GITHUB_STEP_SUMMARY')
            if summary:
                with open(summary, 'a', encoding='utf-8') as report:
                    report.write(f'### Backend deployed\n\nCommit: `{commit}`\n\n'
                                 f'SSM command: `{command_id}`\n\n'
                                 f'HTTPS health: healthy; programmes: {health["programmes"]}.\n')
        return 0
    except Exception as error:
        message = str(error) if isinstance(error, DispatchError) else type(error).__name__
        print(f'Deployment failed: {message}', file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
