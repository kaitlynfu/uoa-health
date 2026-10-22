# Private database backups

## Production status — 2026-09-22

The operator confirmed PostgreSQL `.dump` backup upload, download, full restore,
and matching contents of all public tables. See [POSTGRESQL.md](POSTGRESQL.md)
for the exact backup object and retention cautions. The installed helper supports
PostgreSQL; the dispatcher explicitly selects SSM document v2 with
`TEAM43_DATABASE_ENGINE=postgresql`. Scheduled backups were reported enabled;
verify subsequent scheduled runs and notification delivery separately.

## Historical SQLite setup record

The setup instructions and pending-status statements below predate the completed
PostgreSQL cutover. Do not change production back to SQLite or disable its
PostgreSQL backup selection to follow this historical procedure.

PostgreSQL support is prepared in the repository but not installed on EC2 yet.
See [POSTGRESQL.md](POSTGRESQL.md): the updated helper requires the companion
`team43_database.py`, SSM document version 2 for `.dump` URLs, and the repository
variable `TEAM43_DATABASE_ENGINE=postgresql` after the coordinated cutover.
The existing SQLite backup flow remains the default until then.

## Current status

- The first GitHub backend deployment succeeded and HTTPS reported 9 programmes.
  The user also verified the phone app after deployment.
- One SQLite snapshot was downloaded to the user's Windows backup directory
  outside Git. Its SHA256 matched, and an isolated restore test matched all SQL
  contents and reported 9 programmes. This is not a full server recovery test.
- Private versioned SSE-S3 bucket:
  `team43-backups-467506935568-ap-southeast-2`.
- Enabled retention rule `team43-database-retention` filters `database/`:
  current objects expire at 30 days; noncurrent versions are permanently deleted
  7 days after becoming noncurrent. Overwrites become noncurrent immediately,
  so this is not a blanket 37-day retention guarantee. No storage transitions.
- GitHub OIDC role: `arn:aws:iam::467506935568:role/team43-github-backup`.
  It permits only S3 PutObject under this bucket's `database/`, SendCommand for
  `Team43-BackupDatabase` on `i-0c9d31782bc7dfada`, and GetCommandInvocation in
  Sydney. It has no backup download/delete grant or deployment-command grant.
- Trust subject (immutable IDs required):
  `repo:uoa-compsci399-s2-2026-jun@310467840/team-43-project@1319884689:ref:refs/heads/main`.
  Audience: `sts.amazonaws.com`. Do not add a GitHub environment without updating
  the trust policy. Do not attach this GitHub role to EC2 or edit its existing
  university-managed instance role.
- The helper is installed on EC2; all 12 helper tests passed there. SSM command
  `Team43-BackupDatabase` version 1 is active in AWS.
- The `Database backup` workflow and dispatcher are prepared locally. No cloud
  backup run has been verified yet. Daily backups remain disabled until the
  repository variable `TEAM43_BACKUPS_ENABLED` is set to the exact value `true`.

## First GitHub run and enabling daily backups

1. Review and merge the backup files and `.github/workflows/database-backup.yml`
   into main. Keep `TEAM43_BACKUPS_ENABLED` unset. PRs run safety tests only,
   including a real SDK signature test using fake credentials and no AWS calls.
2. In **Actions > Database backup > Run workflow**, choose main and run manually.
   The job uses the dedicated backup role, not the backend deployment role.
3. A successful summary must show an S3 key, version ID, SHA256, bytes, programme
   count and SSM command ID. Do not interpret the green job as a restore test.
4. Using your normal authorised AWS console session, download that exact S3
   version into a private directory outside Git. Compare SHA256 and restore into
   a temporary database. Keep the live database untouched. This download cannot
   use the upload-only GitHub backup role.
5. Before enabling daily runs, configure GitHub Actions failure notifications
   for a team-owned recipient and arrange independent backup-freshness checks.
   Neither alert delivery nor a missed-run monitor has been set up by these files.
6. Set repository Actions variable `TEAM43_BACKUPS_ENABLED=true` only after
   the cloud download/restore test and monitoring setup pass. The schedule is
   daily at 14:23 UTC (02:23 NZST / 03:23 NZDT the next day), with possible delays.
   Delete the variable or set it false to disable future scheduled backups;
   manual backups remain available. Confirm the first scheduled run actually
   occurs and its object appears in S3 before considering setup complete.

No cloud mutation occurs merely by committing these files. Manual runs do
create a new private snapshot object and incur S3/Actions usage. The schedule
never deploys code, and `TEAM43_AUTO_DEPLOY` remains a separate disabled gate.

## Install and test first

Upload `team43_backup_database.py`, `test_backup.py`, and
`ssm-backup-document.json` to `/home/ubuntu/`. Run:

```sh
python3 /home/ubuntu/test_backup.py
sudo install -o root -g root -m 755 /home/ubuntu/team43_backup_database.py /usr/local/sbin/team43-backup-database
sudo /usr/local/sbin/team43-backup-database --help
```

Tests use synthetic temporary databases and mocked uploads; they require no
AWS credentials and do not touch the application database or service. A fresh
manual cloud backup and download/restore test must still pass before scheduling.

Create a Systems Manager **Command** document named `Team43-BackupDatabase`,
target `/AWS::EC2::Instance`, in `ap-southeast-2` using the JSON file. It invokes
only this fixed helper, not arbitrary caller-supplied shell commands. Parameter
interpolation uses environment variables; the upload credential never appears
in the helper's command-line arguments. Never enable shell tracing or print the
signed URL. SSM/CloudTrail administrators may still see command parameters.

## Dispatcher contract

- Generate a unique lowercase UUID hex string (32 characters) for `BackupId`.
- Generate a **PUT**, not GET, presigned URL using SigV4, virtual S3 addressing,
  this exact Sydney bucket, and key `database/<BackupId>.sqlite3`.
- Limit expiry to 900 seconds. Presign PutObject with `ContentType` equal to
  `application/octet-stream`, `ServerSideEncryption` equal to `AES256`, and
  `IfNoneMatch` equal to `*`. Do not add ACLs, tags or a default SDK checksum
  header whose value depends on the body before the snapshot is created.
- Expected signed headers (alphabetical):
  `content-type;host;if-none-match;x-amz-server-side-encryption`.
- Mask the URL before any logging. Pass `BackupId` and `UploadUrl` to version 1
  of the SSM document. Send only to the fixed instance. Use the same Actions
  concurrency group `team43-backend-production`, with cancellation disabled.
- Poll completion, including InvocationDoesNotExist handling. Parse the helper's
  JSON only after SSM Success and exit code 0. Validate the ID, bucket, key,
  checksum, version ID and programme count. Do not call GetObject/HeadObject
  with this upload-only role or download the database into the Actions runner.
- Record non-secret backup metadata in the job summary, not the upload URL.
- Add a manual trigger first, test an S3 download/restore, then enable the daily
  schedule. Add actionable failure notifications and a freshness check that can
  detect missed runs, not only failed runs. Scheduled jobs are not guaranteed
  to execute at an exact minute. Automatic backend deployment stays off.

## Helper safeguards and limitations

The helper validates the bucket, object key, expiry and signed headers before
opening the database. It opens the fixed database read-only and uses SQLite's
online backup API. It checks integrity and requires at least one programme.
No seeds, application imports, systemctl calls or database restoration occur.
It shares the deployment installer's host lock to prevent deployment overlap.
Snapshots and integrity checks are bounded to 90 seconds; size is bounded to
100 MiB, with 300 MiB free space required. Review these limits as data grows.

Uploads stream from a mode-0600 snapshot in a private staging directory. HTTPS
certificate validation is enabled; proxy use and redirects are disabled. The
PUT includes signed SSE-S3 and If-None-Match headers to reject replacement of an
existing current object. It must not add an unsigned Content-MD5 header: the
presigner does not yet know the snapshot digest, and S3 rejects that header.
The helper instead checks the returned ETag against its local MD5 after upload.
Success requires HTTP 200,
SSE-S3 acknowledgement, a non-null version ID and matching single-part MD5 ETag.
SHA256 is recorded for subsequent download verification.

The helper deletes only its own temporary staging directory on ordinary exit,
including failure. It never deletes existing deployment/manual backups. Forced
termination may leave a root-only staging directory; inspect before cleanup.
An interrupted upload may have succeeded: check S3 before retrying, use a fresh
ID, and never report success from SSM command acceptance alone.

Backup data may contain account information. Keep it out of Git, public buckets,
chat, Actions artifacts and deployment archives. Versioning/retention is not
Object Lock and does not protect against an account administrator deleting the
bucket. Maintain an independently controlled copy if stronger protection is
required. The SQL snapshot does not contain server configuration, certificates,
or app code. Full disaster recovery and deployment rollback need separate tests.

References:
- https://docs.python.org/3.12/library/sqlite3.html#sqlite3.Connection.backup
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
