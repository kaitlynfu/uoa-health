"""Run in the operator's AWS CloudShell: prepare the approved campus release.

Only stages code, backups, restore rehearsals and isolated tests on EC2. Does not
install the deployment helper, migrate production, modify nginx or restart API.
The ZIP is code only. Presigned URLs stay within AWS command parameters.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import zipfile

COMMIT = 'bdafd6afc71fd230e168baeb2ebdf44e5e20357b'
REGION = 'ap-southeast-2'
ACCOUNT = '467506935568'
BUCKET = 'team43-deploy-467506935568-ap-southeast-2'
INSTANCE = 'i-0c9d31782bc7dfada'
ZIP_SHA = 'd5f165e9d3489fa393c911cefcea30ad8b24bb6395d0d9ccb254028b218962cb'
FILES = {
    'backend.tar.gz': ('73b95c1900a9c6377aaec5d20c0180e4842c1dc11a61970bf2b155bf24dc5315',
                       f'backend/releases/{COMMIT}/backend.tar.gz'),
    'operations.tar.gz': ('307213cbd8484c84eecbe7a9c87a161bd34090bf74c69c5a1f3e71be8fdbf251',
                          'operations/campus-bdafd6a/operations.tar.gz'),
}


class StageError(Exception):
    pass


def aws(arguments, environment=None):
    response = subprocess.run(['aws', *arguments, '--region', REGION, '--no-cli-pager'],
                              capture_output=True, text=True, timeout=120, env=environment)
    if response.returncode:
        match = re.search(r'An error occurred \(([^)]+)\)', response.stderr)
        raise StageError(match.group(1) if match else 'AWS command failed')
    return response.stdout.strip()


def unpack(archive, destination):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != ZIP_SHA:
        raise StageError('ZIP checksum does not match the approved package.')
    with zipfile.ZipFile(archive) as package:
        if sorted(package.namelist()) != sorted(FILES):
            raise StageError('Unexpected files in ZIP.')
        for name, (checksum, _) in FILES.items():
            payload = package.read(name)
            if len(payload) > 20 * 1024 * 1024 or hashlib.sha256(payload).hexdigest() != checksum:
                raise StageError('Archive member checksum or size is invalid.')
            (destination / name).write_bytes(payload)


def upload(directory, name, environment):
    checksum, key = FILES[name]
    try:
        aws(['s3api', 'put-object', '--bucket', BUCKET, '--key', key,
             '--body', str(directory / name), '--server-side-encryption', 'AES256',
             '--if-none-match', '*', '--metadata', json.dumps({'sha256': checksum})], environment)
    except StageError as error:
        if str(error) != 'PreconditionFailed':
            raise
        previous = json.loads(aws(['s3api', 'head-object', '--bucket', BUCKET, '--key', key], environment))
        if (previous.get('Metadata', {}).get('sha256') != checksum
                or previous.get('ContentLength') != (directory / name).stat().st_size
                or previous.get('ServerSideEncryption') != 'AES256'):
            raise StageError('Existing release object differs; it was not overwritten.') from None
    url = aws(['s3', 'presign', f's3://{BUCKET}/{key}', '--expires-in', '900',
               '--endpoint-url', f'https://s3.{REGION}.amazonaws.com'], environment)
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.netloc != f'{BUCKET}.s3.{REGION}.amazonaws.com'
            or parsed.path != '/' + key or not parsed.query):
        raise StageError('Unexpected private release URL; no server command issued.')
    return url


REMOTE = r'''
import fcntl, hashlib, importlib, json, os, pwd, shutil, subprocess, sys, tarfile, tempfile
from pathlib import Path, PurePosixPath
import urllib.request

def verify_database_companion(installed, packaged):
    # Exact normalized-text hashes: packaged code and the reviewed live variant
    # whose only difference is two missing explanatory comments (2026-10-02).
    canonical = "07186a579a9222f9161ff9a0630957312a446a68e09262126c44b25d641e4b70"
    reviewed_live = "1b02b81788b4e20d615c67b93f3c7e86af46223ab0ceefe55e61310dba43a357"
    assert packaged == canonical, "Packaged database companion differs"
    assert installed in (canonical, reviewed_live), "Installed database companion differs; inspect before proceeding"

config = __CONFIG__
assert os.geteuid() == 0, "Root required"
os.umask(0o022)
sys.path.insert(0, "/usr/local/sbin")
import team43_database as database
assert database.database_mode() == "postgresql", "Expected PostgreSQL"
database.confirm_active_database("postgresql")
state = Path("/var/lib/team43-deployment")
lock = (state / "deployment.lock").open("a")
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
old = Path(subprocess.check_output(["systemctl", "show", "team43-api.service", "-p", "WorkingDirectory", "--value"], text=True).strip())
root = Path("/opt/team43/releases")
assert old.is_relative_to(root) and old.name == "backend", "Unexpected running release"
assert database.pg_scalar("SELECT version_num FROM alembic_version") in ("0002", "0003"), "Unexpected live revision"
assert shutil.disk_usage(root).free >= 1536 * 1024 * 1024, "Insufficient free space"
release = Path(tempfile.mkdtemp(prefix=config["commit"] + "-campus-prep-", dir=root))
release.chmod(0o755)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
for name, specification in config["archives"].items():
    target = release / name
    digest = hashlib.sha256()
    total = 0
    with opener.open(specification["url"], timeout=30) as source, target.open("xb") as output:
        while chunk := source.read(1024 * 1024):
            total += len(chunk)
            assert total <= 20 * 1024 * 1024, "Archive too large"
            digest.update(chunk)
            output.write(chunk)
    assert digest.hexdigest() == specification["sha256"], "Archive checksum mismatch"

operations = release / "operations"
operations.mkdir(mode=0o755)
total = 0
seen = set()
with tarfile.open(release / "operations.tar.gz", "r:gz") as package:
    for number, member in enumerate(package):
        path = PurePosixPath(member.name)
        assert number < 5000 and not path.is_absolute() and ".." not in path.parts
        assert path.parts and path.parts[0] == "deployment" and "\\" not in member.name
        assert member.isfile() or member.isdir(), "Unsupported archive entry"
        assert path not in seen, "Duplicate archive member"
        seen.add(path)
        total += member.size
        assert total < 100 * 1024 * 1024
        target = operations.joinpath(*path.parts)
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(member) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output)
            target.chmod(0o644)

helpers = operations / "deployment"
sys.path.insert(0, str(helpers))
installer = importlib.import_module("team43_deploy_backend")
campus = importlib.import_module("team43_campus_postgres")
verify_database_companion(campus.digest(Path("/usr/local/sbin/team43_database.py")), campus.digest(helpers / "team43_database.py"))
account = pwd.getpwnam("ubuntu")
operations_venv = release / "operations-venv"
operations_venv.mkdir(mode=0o755)
os.chown(operations_venv, account.pw_uid, account.pw_gid)
installer.as_ubuntu(helpers, ["/usr/bin/python3", "-m", "venv", operations_venv], timeout=90)
operations_python = operations_venv / "bin/python"
installer.as_ubuntu(helpers, [operations_python, "-m", "pip", "install", "-r", "backup-requirements.txt"])
installer.as_ubuntu(helpers, [operations_python, "-B", "-m", "unittest", "discover", "-s", str(helpers), "-p", "test_*.py"], timeout=120)
installer.extract(release / "backend.tar.gz", release)
backend = release / "backend"
assert campus.reviewed_transition(old, backend), "Running/candidate schema is not the reviewed transition"
venv = backend / ".venv"
venv.mkdir(mode=0o755)
os.chown(venv, account.pw_uid, account.pw_gid)
installer.as_ubuntu(backend, ["/usr/bin/python3", "-m", "venv", venv], timeout=90)
python = venv / "bin/python"
installer.as_ubuntu(backend, [python, "-m", "pip", "install", "-r", "requirements.txt"])
installer.as_ubuntu(backend, [python, "-m", "pytest", "-q", "-p", "no:cacheprovider"], timeout=180)
campus.rehearse(old, backend, state, database.postgres_snapshot)
database.confirm_active_database("postgresql")
assert Path(subprocess.check_output(["systemctl", "show", "team43-api.service", "-p", "WorkingDirectory", "--value"], text=True).strip()) == old
installed = Path("/usr/local/sbin/team43-deploy-backend")
assert installed.is_file() and not installed.is_symlink()
report = {"commit": config["commit"], "candidate_backend": str(backend), "operations": str(helpers), "previous_backend": str(old), "installed_helper_sha256": hashlib.sha256(installed.read_bytes()).hexdigest(), "backend_archive_sha256": config["archives"]["backend.tar.gz"]["sha256"], "live_version": database.pg_scalar("SELECT version_num FROM alembic_version")}
report_path = state / ("campus-prepared-" + release.name + ".json")
with report_path.open("x") as output:
    json.dump(report, output, sort_keys=True)
report_path.chmod(0o600)
print("PREPARATION PASSED", flush=True)
print("Prepared release:", release, flush=True)
print("Private preparation report:", report_path, flush=True)
print("Installed helper SHA256:", report["installed_helper_sha256"], flush=True)
print("Live migration version:", report["live_version"], flush=True)
print("Live API has not been restarted; deployment helper has not been replaced.", flush=True)
'''


def remote_command(urls):
    configuration = {'commit': COMMIT, 'archives': {
        name: {'url': urls[name], 'sha256': checksum}
        for name, (checksum, _) in FILES.items()}}
    source = REMOTE.replace('__CONFIG__', repr(configuration))
    compile(source, 'campus preparation', 'exec')
    # Base64 is shell-safe; no URL is printed or interpolated as shell code.
    program = 'import base64; exec(compile(base64.b64decode("' + base64.b64encode(source.encode()).decode() + '"), "campus preparation", "exec"))'
    return 'python3 -B -c ' + "'" + program + "'"


def safe_output(value):
    value = re.sub(r'https://\S+\?\S+', '[private URL omitted]', value)
    return re.sub(r'[A-Za-z0-9+/]{200,}={0,2}', '[encoded command omitted]', value)


def wait(command_id, environment):
    deadline = time.monotonic() + 1900
    previous = None
    while time.monotonic() < deadline:
        try:
            result = json.loads(aws(['ssm', 'get-command-invocation', '--command-id', command_id,
                                    '--instance-id', INSTANCE], environment))
        except StageError as error:
            if str(error) != 'InvocationDoesNotExist':
                raise
            time.sleep(5)
            continue
        status = result['Status']
        if status != previous:
            print('Preparation status:', status, flush=True)
            previous = status
        if status == 'Success' and result.get('ResponseCode') == 0:
            print(safe_output(result.get('StandardOutputContent', '')), flush=True)
            return
        if status not in ('Pending', 'InProgress', 'Delayed', 'Cancelling'):
            # Error output contains only tested code, package diagnostics and
            # isolated fixtures. Do not print the submitted command/URLs.
            print(safe_output(result.get('StandardOutputContent', ''))[-8000:], flush=True)
            print(safe_output(result.get('StandardErrorContent', ''))[-4000:], flush=True)
            raise StageError('Preparation failed; inspect the identified SSM command before retrying.')
        time.sleep(10)
    raise StageError('Preparation wait timed out; server command may still be running. Inspect its ID before retrying.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', default='team43-campus-bdafd6a.zip')
    args = parser.parse_args()
    try:
        identity = json.loads(aws(['sts', 'get-caller-identity']))
        if identity.get('Account') != ACCOUNT:
            raise StageError('AWS session is not the approved project account.')
        with tempfile.TemporaryDirectory(prefix='team43-campus-stage-') as folder:
            directory = Path(folder)
            unpack(Path(args.archive), directory)
            environment = dict(os.environ, AWS_CONFIG_FILE=str(directory / 'aws-config'),
                               AWS_PAGER='')
            aws(['configure', 'set', 'default.s3.addressing_style', 'virtual'], environment)
            urls = {name: upload(directory, name, environment) for name in FILES}
            result = json.loads(aws(['ssm', 'send-command', '--instance-ids', INSTANCE,
                                    '--document-name', 'AWS-RunShellScript', '--timeout-seconds', '600',
                                    '--parameters', json.dumps({'commands': [remote_command(urls)],
                                                                 'executionTimeout': ['1800']}),
                                    '--comment', 'Team43 campus preparation only, no production activation'], environment))
            command_id = result['Command']['CommandId']
            print('SSM preparation command:', command_id, flush=True)
            print('Preparing code and running restore/API tests; this can take several minutes.', flush=True)
            wait(command_id, environment)
        return 0
    except Exception as error:
        print('Preparation failed:', str(error) if isinstance(error, StageError) else type(error).__name__,
              file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
