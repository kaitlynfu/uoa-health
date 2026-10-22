> Historical record. This document describes an earlier project state; use the [current project README](../../README.md) and [documentation index](../../docs/README.md) for supported setup and release instructions.

# Team 43 backend deployment

## Production status — 2026-09-22

PostgreSQL cutover, app smoke tests, and an off-instance PostgreSQL backup restore
were confirmed by the operator. See [POSTGRESQL.md](../../deployment/POSTGRESQL.md) for the record.
The systemd override conflict was repaired and verified without restarting the
app: `50-team43-release.conf` manages the release, and `70-team43-postgres-cutover.conf`
supplies only the PostgreSQL EnvironmentFile. Auto-deploy is temporarily paused.
After merging these records, run one manual deployment from main, verify the app,
then re-enable auto-deploy. Preserve production data and retained snapshots.

## Historical deployment setup

The SQLite/pending-transition descriptions below are retained as historical
context, not the current production state. Use the status above for the current
auto-deploy gate rather than historical instructions below.

PostgreSQL transition: see [POSTGRESQL.md](../../deployment/POSTGRESQL.md) for the current
rehearsal results, dual-database helper installation contract, and pending
cutover. The legacy SQLite procedures below describe the existing live setup.

The first manual GitHub Actions deployment succeeded. The workflow reported
HTTPS health with 9 programmes, and the user verified the phone app afterward.
As of 2026-09-11, `TEAM43_AUTO_DEPLOY=true` is configured; the first
push-triggered deployment still needs verification. The first scheduled S3
backup succeeded, and a downloaded backup passed checksum and isolated restore
checks. Deployment rollback still needs an isolated test; restoring a database
copy does not test application rollback. See [BACKUPS.md](../../deployment/BACKUPS.md) for the
backup procedure.

To verify the automatic trigger, merge this documentation-only change into
`main`: `deployment/**` is included in the workflow's path filters. Confirm a
push-triggered run passes both tests and deployment, reports HTTPS health, and
the phone app still works. This changes no application code, but the workflow
will redeploy the backend and restart its service.

## First run (manual, after merging)

1. Review and merge `.github/workflows/backend-deploy.yml` and `deployment/`
   into `main`. Keep unrelated frontend work out of this deployment change.
2. Leave the repository variable `TEAM43_AUTO_DEPLOY` unset. Pull requests and
   matching pushes run tests, but pushes do not deploy while it is unset.
3. In GitHub **Actions → Backend checks and deployment → Run workflow**, choose
   `main`. The workflow must be on the default branch for this button to appear.
4. Wait for both jobs to succeed. Check the recorded SSM command ID if deployment
   fails. A timed-out/cancelled Actions run does not prove the server command
   stopped: inspect SSM and the service before retrying.
5. Check the phone and `/health` (currently nine programmes). Confirm the service
   working directory moved to `/opt/team43/releases/` and the backup exists.
   Do not rerun seeds or scrapers as part of deployment.
6. Before enabling unattended deployment, validate recovery on a test copy and
   establish release retention and off-instance database backups. Then add the
   repository Actions variable `TEAM43_AUTO_DEPLOY` with the exact value `true`.
   Delete the variable or set it to `false` to disable push-triggered deployment;
   this does not cancel an already running deployment.

The workflow tests the backend against SQLite in memory, then uses GitHub OIDC
to assume `arn:aws:iam::467506935568:role/team43-github-deploy`. No AWS access-key
secret or SSH private key is required. It packages the exact tested commit,
uploads to the private release bucket, and invokes version 1 of the fixed SSM
document on `i-0c9d31782bc7dfada` in `ap-southeast-2`. It waits for completion
and checks external HTTPS health at
`https://team43-api.3-27-96-180.sslip.io/health`.

Deployments are serialized without cancelling an in-progress deployment. Stale
commits are skipped before dispatch. Do not add a GitHub environment without
changing the IAM OIDC trust policy: that changes the token subject. The hosted
Ubuntu runner must provide AWS CLI v2; Python and action versions are explicitly
selected in the workflow.

Changing the installer in Git does **not** replace the root-owned EC2 copy.
Review, test and reinstall it manually when its implementation changes.

## Fixed installer contract

Install `team43_deploy_backend.py` as root-owned mode 0755 at
`/usr/local/sbin/team43-deploy-backend` on the Ubuntu EC2 instance.
The SSM Command document `Team43-DeployBackend` invokes it with three arguments:

1. `CommitId`: 40-character lowercase Git commit SHA.
2. `ArtifactSha256`: 64-character lowercase SHA256 of the compressed archive.
3. `DownloadUrl`: short-lived SigV4 HTTPS URL to this exact object:
   `https://team43-deploy-467506935568-ap-southeast-2.s3.ap-southeast-2.amazonaws.com/backend/releases/<CommitId>/backend.tar.gz`.

The archive must contain a `backend/` tree (as produced by `git archive`). No
database, private key, local environment, link or special file may be included.
Treat the signed URL as a temporary read credential. Never paste it into chat,
print it in Actions logs, or use shell tracing. SSM/CloudTrail administrators
can potentially see command parameters. Keep download URL lifetime bounded.
The EC2 university-managed role is not changed to grant S3 access.

## Installer behavior

- Validates input, refuses redirects, verifies checksum, bounds archive sizes,
  and extracts only ordinary files/directories under `backend/`.
- Prepares a separate `/opt/team43/releases/<commit>-<unique>/backend` directory.
  Existing code remains available for rollback. Requirements and tests run as
  `ubuntu`, **not root**. The code from main must still be reviewed and trusted.
- Refuses changes to `app/models.py` and `app/database.py`. This conservative
  guard is not a complete migration framework; all schema-affecting changes
  require review, including migrations introduced in other files.
- Runs tests using an in-memory test database before stopping the old service.
- Stops the service briefly, creates a SQLite backup in root-only
  `/var/lib/team43-deployment`, and changes only its dedicated systemd override.
- Preserves `/var/lib/team43/health_app_v2.db` and all original service security
  settings. Does not seed, scrape, or automatically migrate.
- Restores previous code configuration if activation/health validation fails.
  It does **not** auto-restore a database backup, to avoid losing new user writes.
  Code rollback cannot undo changes already made by application code.
- Refuses concurrent deployments and requires at least 1.5 GiB free space.
  Old and failed releases/backups are retained, not deleted automatically.
  Review retention before continued use; on-instance backups do not protect
  against instance/volume loss. Establish separate off-instance backups.

## Validation

Run portable tests locally or on Ubuntu (no AWS access required):

```
python -m unittest discover -s deployment -p 'test_*.py' -v
```

Portable tests validate inputs, archive handling, checksum checking, secret
redaction, schema guard, non-root command construction and override restoration.
Dispatcher tests also cover main-only execution, status polling and redaction.
They do not prove actual systemd/SSM deployment or rollback on EC2. Those checks
must be completed before enabling push-triggered deployment. The installer is
installed and the first manual deployment passed; rollback remains unproven.

## Remaining setup

- Prove failure/rollback behavior on an isolated test copy.
- Add retention and off-instance backups, then activate deployment on main.
- Configure Expo updates separately; current app has no update integration.
  Native changes require a fresh build; free Apple signing still expires.
