#!/usr/bin/python3
"""Back up the configured Team 43 SQLite/PostgreSQL database to private S3.

Run as root via Team43-BackupDatabase. The signed PUT URL is read from
SSM_UploadUrl, never from a command-line argument. No credentials are stored.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

# Helpers and this support module are installed together in a root-owned folder.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from team43_database import database_mode, confirm_active_database, postgres_snapshot, DatabaseError

DATABASE = Path('/var/lib/team43/health_app_v2.db')
STATE = Path('/var/lib/team43-deployment')
BUCKET = 'team43-backups-467506935568-ap-southeast-2'
BUCKET_HOST = f'{BUCKET}.s3.ap-southeast-2.amazonaws.com'
MAX_BYTES = 100 * 1024 * 1024
SIGNED_HEADERS = 'content-type;host;if-none-match;x-amz-server-side-encryption'


class BackupError(Exception):
    pass


def validate_inputs(backup_id, url, extension='sqlite3'):
    if extension not in ('sqlite3', 'dump'):
        raise BackupError('Unsupported backup format.')
    if not re.fullmatch(r'[a-f0-9]{32}', backup_id):
        raise BackupError('Invalid backup ID.')
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.netloc != BUCKET_HOST
            or parsed.path != f'/database/{backup_id}.{extension}' or parsed.fragment
            or not re.fullmatch(r'[A-Za-z0-9%&=_.~-]+', parsed.query)):
        raise BackupError('Upload URL is not the expected private backup object.')
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    if any(len(values) != 1 for values in query.values()):
        raise BackupError('Duplicate signed URL parameters are not allowed.')
    if (query.get('X-Amz-Algorithm') != ['AWS4-HMAC-SHA256']
            or not re.fullmatch(r'[a-f0-9]{64}', query.get('X-Amz-Signature', [''])[0])
            or query.get('X-Amz-SignedHeaders') != [SIGNED_HEADERS]):
        raise BackupError('Expected a SigV4 PUT URL with the fixed upload headers.')
    expiry = query.get('X-Amz-Expires', [''])[0]
    if not expiry.isdecimal() or not 1 <= int(expiry) <= 900:
        raise BackupError('Upload URL expiry must be between 1 and 900 seconds.')


def snapshot(source_path, destination):
    """Online SQLite backup: read-only source, new private destination, bounded work."""
    source_path = source_path.resolve(strict=True)
    if source_path.stat().st_size > MAX_BYTES:
        raise BackupError('Database exceeds the 100 MiB limit; review capacity.')
    deadline = time.monotonic() + 90

    def progress(status, remaining, total):
        if time.monotonic() > deadline:
            raise BackupError('Snapshot timed out; live database unchanged.')
        if destination.stat().st_size > MAX_BYTES:
            raise BackupError('Snapshot exceeds the 100 MiB limit.')

    # Exclusive creation avoids replacing an existing backup or following a link.
    fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    with closing(sqlite3.connect(source_path.as_uri() + '?mode=ro', uri=True)) as source:
        with closing(sqlite3.connect(destination)) as target:
            source.backup(target, pages=256, progress=progress, sleep=0.1)
            if destination.stat().st_size > MAX_BYTES:
                raise BackupError('Snapshot exceeds the 100 MiB limit.')
            # Integrity checking is also bounded and never logs database rows.
            target.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
            if target.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise BackupError('Snapshot failed its integrity check.')
            count = target.execute('SELECT COUNT(*) FROM programmes').fetchone()[0]
            if count < 1:
                raise BackupError('Snapshot contains no programmes; investigate before accepting.')
    return count


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def safe_s3_error(error):
    """Classify bounded S3 XML without logging messages, URLs or canonical requests."""
    known_codes = {
        'AccessDenied', 'SignatureDoesNotMatch', 'ExpiredToken', 'InvalidToken',
        'InvalidAccessKeyId', 'RequestTimeTooSkewed', 'RequestExpired',
        'AuthorizationQueryParametersError', 'AuthorizationHeaderMalformed',
        'InvalidRequest', 'BadDigest', 'PreconditionFailed',
        'ConditionalRequestConflict', 'NoSuchBucket', 'InternalError', 'SlowDown',
    }
    try:
        body = error.read(32769)
        if len(body) > 32768 or b'<!DOCTYPE' in body.upper() or b'<!ENTITY' in body.upper():
            return 'UnrecognizedS3Error'
        root = ET.fromstring(body)
        code = root.findtext('Code')
        if code not in known_codes:
            return 'UnrecognizedS3Error'
        # Only fixed labels are emitted, never arbitrary server-supplied text.
        message = ' '.join((root.findtext('Message') or '').lower().split())
        if code == 'AccessDenied':
            # S3 can report unsigned headers as AccessDenied, not a signature
            # error. Never echo arbitrary header names or values from the XML.
            unsigned = root.findtext('HeadersNotSigned')
            if unsigned is not None or any(phrase in message for phrase in (
                'headers that were present in the request were not signed',
                'headers present in the request which were not signed',
                'headers present in the request that were not signed',
            )):
                allowed_headers = {
                    'content-md5', 'content-type', 'content-length', 'host',
                    'if-none-match', 'x-amz-server-side-encryption',
                    'x-amz-content-sha256', 'x-amz-security-token',
                    'x-amz-checksum-sha256', 'x-amz-checksum-crc32',
                }
                names = set(re.split(r'[;,\s]+', (unsigned or '').lower())) - {''}
                safe_names = sorted(names & allowed_headers)
                if names - allowed_headers:
                    safe_names.append('other header (name withheld)')
                details = ': ' + ', '.join(safe_names) if safe_names else ''
                return f'{code}; category: unsigned headers{details}'
            for phrase, label in (
                ('service control policy', 'organisation service-control policy'),
                ('resource control policy', 'organisation resource-control policy'),
                ('permissions boundary', 'permissions boundary'),
                ('identity-based policy', 'identity policy'),
                ('resource-based policy', 'resource policy'),
                ('session policy', 'session policy'),
                ('vpc endpoint policy', 'VPC endpoint policy'),
                ('request has expired', 'expired request'),
            ):
                if phrase in message:
                    return f'{code}; category: {label}'
            if message in ('access denied', 'access denied.'):
                return f'{code}; category: generic denial (S3 supplied no detailed reason)'
            if not message:
                return f'{code}; category: no message supplied by S3'
            return f'{code}; category: unrecognized reason (message withheld)'
        return code
    except Exception:
        return 'UnrecognizedS3Error'


def upload(path, url):
    size = path.stat().st_size
    if not 0 < size <= MAX_BYTES:
        raise BackupError('Invalid upload size.')
    sha256 = hashlib.sha256()
    md5 = hashlib.md5(usedforsecurity=False)  # S3 transport integrity, not authentication.
    with path.open('rb') as data:
        while chunk := data.read(1024 * 1024):
            sha256.update(chunk)
            md5.update(chunk)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with path.open('rb') as data:
            request = urllib.request.Request(url, data=data, method='PUT', headers={
                'Content-Type': 'application/octet-stream',
                'Content-Length': str(size),
                'If-None-Match': '*',
                'x-amz-server-side-encryption': 'AES256',
            })
            with opener.open(request, timeout=60) as response:
                if response.status != 200:
                    raise BackupError('S3 did not confirm the upload.')
                if response.headers.get('x-amz-server-side-encryption') != 'AES256':
                    raise BackupError('S3 did not confirm SSE-S3 encryption.')
                version = response.headers.get('x-amz-version-id')
                if not version or version == 'null':
                    raise BackupError('S3 did not confirm a versioned backup; check bucket versioning.')
                # Content-MD5 cannot be sent unsigned: the presigner does not
                # know the snapshot's digest. Verify the single-part SSE-S3
                # ETag against our local MD5 before reporting success instead.
                if response.headers.get('ETag', '').strip('"') != md5.hexdigest():
                    raise BackupError('S3 upload checksum confirmation failed.')
    except BackupError:
        raise
    except urllib.error.HTTPError as error:
        code = error.code
        try:
            detail = safe_s3_error(error)
        finally:
            # Close the response so finalizer warnings cannot expose the signed URL.
            error.close()
        raise BackupError(f'S3 upload failed (HTTP {code}; {detail}); no automatic retry.') from None
    except Exception:
        raise BackupError('Upload outcome uncertain; inspect S3 before starting a new backup.') from None
    return {'bytes': size, 'sha256': sha256.hexdigest(), 'version_id': version}


def run_backup(backup_id, url):
    mode = database_mode()
    extension = 'dump' if mode == 'postgresql' else 'sqlite3'
    validate_inputs(backup_id, url, extension)
    if os.geteuid() != 0:
        raise BackupError('Run this installed helper as root through Systems Manager.')
    import fcntl

    os.umask(0o077)
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Same host lock as the deployment installer: no deploy/backup overlap.
    with (STATE / 'deployment.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise BackupError('A deployment or backup is running; try again after it finishes.') from None
        confirm_active_database(mode)
        if shutil.disk_usage(STATE).free < 3 * MAX_BYTES:
            raise BackupError('Less than 300 MiB free; review disk usage before backing up.')
        # A private staging copy only. Existing deployment and manual backups are untouched.
        with tempfile.TemporaryDirectory(prefix='backup-staging-', dir=STATE) as staging:
            path = Path(staging) / f'snapshot.{extension}'
            count = postgres_snapshot(path) if mode == 'postgresql' else snapshot(DATABASE, path)
            result = upload(path, url)
    result.update({'status': 'uploaded', 'backup_id': backup_id,
                   'key': f'database/{backup_id}.{extension}', 'bucket': BUCKET,
                   'programmes': count, 'completed_at': datetime.now(timezone.utc).isoformat()})
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup_id', help='Unique 32-character lowercase hex ID')
    args = parser.parse_args(argv)
    try:
        result = run_backup(args.backup_id, os.environ.get('SSM_UploadUrl', ''))
        print(json.dumps(result), flush=True)
        return 0
    except Exception as error:
        # HTTP/library errors may contain the signed URL; never print their contents.
        message = str(error) if isinstance(error, (BackupError, DatabaseError)) else type(error).__name__
        print(f'Backup failed: {message}', file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
