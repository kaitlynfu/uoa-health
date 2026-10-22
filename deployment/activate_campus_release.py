"""Run in AWS CloudShell to activate the already rehearsed campus release.

Uses the fixed successful preparation report. Retains configuration/helper copies
and a fresh restored database backup. The existing editor allowlist is preserved.
"""
import base64
import hashlib
import inspect
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

COMMIT = 'bdafd6afc71fd230e168baeb2ebdf44e5e20357b'
REGION = 'ap-southeast-2'
ACCOUNT = '467506935568'
INSTANCE = 'i-0c9d31782bc7dfada'
RELEASE = '/opt/team43/releases/' + COMMIT + '-campus-prep-9g06lg_u'
REPORT = '/var/lib/team43-deployment/campus-prepared-' + Path(RELEASE).name + '.json'
INSTALLED_HELPER_SHA = 'cd8006fc3f2da5709732c439ec54cb5f246e9ca8c8088305bdd8d8f9cfbd97b5'
ARCHIVES = {
    'backend.tar.gz': '73b95c1900a9c6377aaec5d20c0180e4842c1dc11a61970bf2b155bf24dc5315',
    'operations.tar.gz': '307213cbd8484c84eecbe7a9c87a161bd34090bf74c69c5a1f3e71be8fdbf251',
}
DATABASE_HASHES = {
    '07186a579a9222f9161ff9a0630957312a446a68e09262126c44b25d641e4b70',
    '1b02b81788b4e20d615c67b93f3c7e86af46223ab0ceefe55e61310dba43a357',
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def root_file(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
            'Expected a root-owned, protected regular file: ' + str(path))


def verify_tar_tree(archive, directory, prefix, checksum):
    require(hashlib.sha256(archive.read_bytes()).hexdigest() == checksum,
            'Prepared archive checksum changed')
    count, total, seen = 0, 0, set()
    with tarfile.open(archive, 'r:gz') as package:
        for member in package:
            count += 1
            total += member.size
            path = PurePosixPath(member.name)
            require(count <= 5000 and total <= 100 * 1024 * 1024
                    and not path.is_absolute() and '..' not in path.parts
                    and path.parts and path.parts[0] == prefix
                    and '\\' not in member.name and path not in seen
                    and (member.isdir() or member.isfile()), 'Unsupported prepared archive entry')
            seen.add(path)
            target = directory.joinpath(*path.parts)
            require(target.resolve().is_relative_to(directory.resolve()), 'Prepared path escapes release')
            if member.isfile():
                root_file(target)
                with package.extractfile(member) as source:
                    require(hashlib.sha256(source.read()).digest()
                            == hashlib.sha256(target.read_bytes()).digest(),
                            'Prepared source changed: ' + str(path))
    # Extra Python files could be imported despite all expected files matching.
    for source in (directory / prefix).rglob('*.py'):
        if '.venv' not in source.relative_to(directory).parts:
            require(PurePosixPath(source.relative_to(directory).as_posix()) in seen,
                    'Unexpected Python file in prepared source')


def nginx_upload_config(text):
    # Accept only the observed simple location block; preserve every other byte.
    active = '\n'.join(line.split('#', 1)[0] for line in text.splitlines())
    require(re.search(r'\bserver_name\s+team43-api\.3-27-96-180\.sslip\.io\s*;', active),
            'Unexpected API virtual host')
    blocks = list(re.finditer(r'(?m)^([ \t]*)location\s+/\s*\{\s*\n([^{}]*?)^\1\}', text))
    require(len(blocks) == 1, 'API location is not the reviewed simple proxy block')
    block = blocks[0]
    body = block.group(2)
    require(re.search(r'(?m)^\s*proxy_pass\s+http://127\.0\.0\.1:8000\s*;\s*(?:#.*)?$', body),
            'Unexpected API upstream')
    require(not re.search(r'(?m)^\s*(client_max_body_size|client_body_timeout|proxy_read_timeout|proxy_send_timeout)\b', active),
            'Upload settings already exist; inspect configuration before retrying')
    indentation = block.group(1) + '    '
    settings = ''.join(indentation + line + '\n' for line in (
        'client_max_body_size 50m;', 'client_body_timeout 180s;',
        'proxy_read_timeout 180s;', 'proxy_send_timeout 180s;'))
    position = block.start(2)
    return text[:position] + settings + text[position:]


def atomic_write(path, payload, mode):
    descriptor, temporary = tempfile.mkstemp(prefix='.team43-', dir=path.parent)
    with os.fdopen(descriptor, 'wb') as output:
        output.write(payload)
        output.flush()
        os.fsync(output.fileno())
        os.fchmod(output.fileno(), mode)
    os.replace(temporary, path)


def editor_setting(installer):
    pid = installer.run(['systemctl', 'show', installer.SERVICE, '-p', 'MainPID', '--value'],
                        capture_output=True, text=True).stdout.strip()
    require(pid.isdecimal() and int(pid) > 0, 'Backend is not running')
    entries = (Path('/proc') / pid / 'environ').read_bytes().split(b'\0')
    values = [entry.split(b'=', 1)[1].decode() for entry in entries
              if entry.startswith(b'TEAM43_ROUTE_EDITOR_USER_IDS=')]
    require(len(values) == 1, 'Existing editor allowlist is missing')
    parts = [part.strip() for part in values[0].split(',')]
    require(all(part.isascii() and part.isdecimal() and int(part) > 0 for part in parts),
            'Existing editor allowlist is malformed')
    return values[0]


def activate_prepared(installer, campus, database, old, backend, state, recovery,
                      nginx, updated_nginx, helpers):
    before = installer.health()
    editors = editor_setting(installer)
    previous = installer.DROPIN.read_bytes() if installer.DROPIN.exists() else None
    require(previous is None or previous.decode() == installer.override_content(old),
            'Release service configuration changed')
    helper = Path('/usr/local/sbin/team43-deploy-backend')
    companion = Path('/usr/local/sbin/team43_campus_postgres.py')
    old_helper = helper.read_bytes()
    original_nginx = nginx.read_bytes()
    nginx_mode = stat.S_IMODE(nginx.stat().st_mode)
    helper_mode = stat.S_IMODE(helper.stat().st_mode)
    require(not companion.exists() and not companion.is_symlink(),
            'Campus helper already exists; inspect before retrying')
    (recovery / 'previous-helper').write_bytes(old_helper)
    (recovery / 'previous-nginx.conf').write_bytes(original_nginx)
    if previous is not None:
        (recovery / 'previous-service.conf').write_bytes(previous)
    backup = recovery / 'before-campus.dump'
    # Record recovery details before the first mutation.
    (recovery / 'recovery.json').write_text(json.dumps({
        'previous_backend': str(old), 'candidate_backend': str(backend),
        'nginx_path': str(nginx), 'helper_path': str(helper),
        'helper_mode': helper_mode, 'nginx_mode': nginx_mode,
        'had_release_override': previous is not None,
    }, sort_keys=True))
    nginx_changed = helper_changed = service_stopped = False
    try:
        nginx_changed = True
        atomic_write(nginx, updated_nginx.encode(), nginx_mode)
        installer.run(['nginx', '-t'], capture_output=True, text=True)
        installer.run(['systemctl', 'reload', 'nginx'])
        atomic_write(companion, (helpers / 'team43_campus_postgres.py').read_bytes(), 0o644)
        helper_changed = True
        atomic_write(helper, (helpers / 'team43_deploy_backend.py').read_bytes(), 0o755)
        print('Upload configuration validated; recovery copies: ' + str(recovery), flush=True)
        service_stopped = True
        print('Taking final backup and rehearsing its restore before live migration.', flush=True)
        installer.run(['systemctl', 'stop', installer.SERVICE])
        count = database.postgres_snapshot(backup)
        campus.activate(old, backend, backup, state)
        installer.switch_service(backend)
        result = installer.wait_healthy(count)
        database.confirm_active_database('postgresql')
        require(database.pg_scalar('SELECT version_num FROM alembic_version') == '0003',
                'Unexpected live database revision after activation')
        require(editor_setting(installer) == editors, 'Editor allowlist changed after restart')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for path in ('/navigation/campus/catalog', '/navigation/campus/template?start=x&destination=x'):
            try:
                with opener.open('http://127.0.0.1:8000' + path, timeout=5):
                    pass
            except urllib.error.HTTPError as error:
                try:
                    require(error.code == 401, 'Campus endpoint authentication check failed')
                finally:
                    error.close()
            else:
                raise RuntimeError('Campus endpoint authentication check failed')
    except BaseException:
        print('Activation failed; restoring previous application and configuration.', flush=True)
        recovery_errors = []
        if service_stopped:
            try:
                installer.restore_service(previous)
                installer.wait_healthy(before['programmes'])
            except BaseException:
                recovery_errors.append('application')
        if helper_changed:
            try:
                atomic_write(helper, old_helper, helper_mode)
            except BaseException:
                recovery_errors.append('deployment helper')
        # Keep the additive companion installed for diagnosis; the restored old
        # helper does not import it. Do not delete potentially useful recovery data.
        if nginx_changed:
            try:
                atomic_write(nginx, original_nginx, nginx_mode)
                installer.run(['nginx', '-t'], capture_output=True, text=True)
                installer.run(['systemctl', 'reload', 'nginx'])
            except BaseException:
                recovery_errors.append('Nginx')
        if recovery_errors:
            raise RuntimeError('Recovery needs operator attention: ' + ', '.join(recovery_errors)
                               + '. Recovery files: ' + str(recovery)) from None
        print('Previous application restored. Database and recovery files retained: ' + str(recovery), flush=True)
        raise
    summary = {'release': COMMIT, 'backend': str(backend), 'health': result,
               'migration': '0003', 'backup': str(backup),
               'backup_sha256': hashlib.sha256(backup.read_bytes()).hexdigest(),
               'recovery': str(recovery), 'campus_authentication': 'verified'}
    (recovery / 'activated.json').write_text(json.dumps(summary, sort_keys=True))
    print('CAMPUS ACTIVATION PASSED', flush=True)
    print(json.dumps(summary, sort_keys=True), flush=True)


def remote_main():
    import fcntl
    import importlib
    require(os.geteuid() == 0, 'Root required')
    os.umask(0o077)
    state = Path('/var/lib/team43-deployment')
    lock = (state / 'deployment.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    report_path = Path(REPORT)
    root_file(report_path)
    report = json.loads(report_path.read_text())
    release = Path(RELEASE)
    backend = release / 'backend'
    helpers = release / 'operations/deployment'
    require(report.get('commit') == COMMIT and report.get('candidate_backend') == str(backend)
            and report.get('operations') == str(helpers)
            and report.get('installed_helper_sha256') == INSTALLED_HELPER_SHA
            and report.get('backend_archive_sha256') == ARCHIVES['backend.tar.gz']
            and report.get('live_version') == '0002', 'Unexpected preparation report')
    verify_tar_tree(release / 'backend.tar.gz', release, 'backend', ARCHIVES['backend.tar.gz'])
    verify_tar_tree(release / 'operations.tar.gz', release / 'operations', 'deployment', ARCHIVES['operations.tar.gz'])
    installed = Path('/usr/local/sbin/team43-deploy-backend')
    root_file(installed)
    require(hashlib.sha256(installed.read_bytes()).hexdigest() == INSTALLED_HELPER_SHA,
            'Installed helper changed since successful preparation')
    companion = Path('/usr/local/sbin/team43_database.py')
    root_file(companion)
    require(hashlib.sha256(companion.read_text().encode()).hexdigest() in DATABASE_HASHES,
            'Installed database companion changed')
    sys.path.insert(0, '/usr/local/sbin')
    database = importlib.import_module('team43_database')
    sys.path.insert(0, str(helpers))
    installer = importlib.import_module('team43_deploy_backend')
    campus = importlib.import_module('team43_campus_postgres')
    require(database.database_mode() == 'postgresql', 'Expected PostgreSQL')
    database.confirm_active_database('postgresql')
    require(database.pg_scalar('SELECT version_num FROM alembic_version') == '0002',
            'Live revision changed; inspect before retrying')
    old = Path(installer.run(['systemctl', 'show', installer.SERVICE, '-p', 'WorkingDirectory', '--value'],
                             capture_output=True, text=True).stdout.strip())
    require(str(old) == report.get('previous_backend') and campus.reviewed_transition(old, backend),
            'Running release changed since preparation')
    require(shutil.disk_usage(release).free >= 1536 * 1024 * 1024, 'Insufficient free space')
    enabled = Path('/etc/nginx/sites-enabled/team43-api')
    nginx = enabled.resolve(strict=True)
    require(nginx in (enabled, Path('/etc/nginx/sites-available/team43-api')),
            'Unexpected Nginx configuration target')
    root_file(nginx)
    updated_nginx = nginx_upload_config(nginx.read_text())
    recovery = Path(tempfile.mkdtemp(prefix='campus-activation-', dir=state))
    def interrupted(signum, frame):
        raise RuntimeError('Activation interrupted; inspect recovery report before retrying')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    activate_prepared(installer, campus, database, old, backend, state, recovery,
                      nginx, updated_nginx, helpers)


def remote_command():
    imports = ('import hashlib, json, os, re, shutil, signal, stat, subprocess, sys, tarfile, tempfile\n'
               'from pathlib import Path, PurePosixPath\nimport urllib.error, urllib.request\n')
    constants = ''.join(name + ' = ' + repr(globals()[name]) + '\n' for name in (
        'COMMIT', 'RELEASE', 'REPORT', 'INSTALLED_HELPER_SHA', 'ARCHIVES', 'DATABASE_HASHES'))
    functions = '\n'.join(inspect.getsource(function) for function in (
        require, root_file, verify_tar_tree, nginx_upload_config, atomic_write,
        editor_setting, activate_prepared, remote_main))
    source = imports + constants + functions + '''
try:
    remote_main()
except Exception as error:
    # Only our fixed checks have RuntimeError messages; do not echo arbitrary
    # subprocess/SQL exception details that could contain private values.
    print("ACTIVATION STOPPED: " + (str(error) if type(error) is RuntimeError else type(error).__name__), flush=True)
    sys.exit(1)
'''
    compile(source, 'campus activation', 'exec')
    encoded = base64.b64encode(source.encode()).decode()
    return 'python3 -B -c \'import base64; exec(compile(base64.b64decode("' + encoded + '"), "campus activation", "exec"))\''


def aws(arguments):
    response = subprocess.run(['aws', *arguments, '--region', REGION, '--no-cli-pager'],
                              capture_output=True, text=True, timeout=120)
    if response.returncode:
        match = re.search(r'An error occurred \(([^)]+)\)', response.stderr)
        raise RuntimeError(match.group(1) if match else 'AWS command failed')
    return response.stdout.strip()


def main():
    try:
        require(json.loads(aws(['sts', 'get-caller-identity'])).get('Account') == ACCOUNT,
                'AWS session is not the approved project account')
        command = json.loads(aws(['ssm', 'send-command', '--instance-ids', INSTANCE,
                                 '--document-name', 'AWS-RunShellScript', '--timeout-seconds', '600',
                                 '--parameters', json.dumps({'commands': [remote_command()],
                                                              'executionTimeout': ['900']}),
                                 '--comment', 'Activate reviewed campus release after successful rehearsal']))
        command_id = command['Command']['CommandId']
        print('SSM activation command:', command_id, flush=True)
        previous = None
        deadline = time.monotonic() + 1000
        while time.monotonic() < deadline:
            try:
                result = json.loads(aws(['ssm', 'get-command-invocation', '--command-id', command_id,
                                        '--instance-id', INSTANCE]))
            except RuntimeError as error:
                if str(error) != 'InvocationDoesNotExist':
                    raise
                time.sleep(5)
                continue
            status = result['Status']
            if status != previous:
                print('Activation status:', status, flush=True)
                previous = status
            if status not in ('Pending', 'InProgress', 'Delayed', 'Cancelling'):
                print(result.get('StandardOutputContent', '')[-12000:], flush=True)
                if status != 'Success' or result.get('ResponseCode') != 0:
                    # Suppress arbitrary process exception output/private data.
                    print('Activation failed. Inspect this SSM command and recovery files before retrying.', flush=True)
                    return 1
                return 0
            time.sleep(10)
        raise RuntimeError('Activation wait timed out; inspect the command ID before retrying')
    except Exception as error:
        print('Activation stopped:', str(error) if isinstance(error, RuntimeError) else type(error).__name__,
              file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
