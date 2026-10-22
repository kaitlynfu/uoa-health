# PostgreSQL production migration record

## Completed cutover — 2026-09-22

The operator's handover confirms production now uses PostgreSQL 16 database
`team43`, owned by the restricted `ubuntu` role through the local Unix socket.
Do not rerun the migration or import the rehearsal snapshot into production.

- Cutover release: `ecc08c09b959e8ac21f007bbddde0156ebf5e653`, under
  `/opt/team43/releases/ecc08c09b959e8ac21f007bbddde0156ebf5e653-cutover/backend`.
- Strict import verified all application tables and committed successfully.
- Health reported healthy, database connected, and 9 programmes; operator
  smoke tests covered login, profile, explorer, journey, saved items and wayfinding.
- S3 backup `database/346fe3c1c7ba48fd9f26eea2ffb0e696.dump` was downloaded,
  restored into `team43_postcutover_restore`, and every public table matched
  production by count and sorted-row SHA256 at verification time.
- Installed root-owned helpers include the unbuffered archive-read fix.
- SSM `Team43-BackupDatabase` v1 remains default; v2 is explicitly selected for
  PostgreSQL backups. Do not change the default merely because v2 exists.
- Reported Actions variables: `TEAM43_DATABASE_ENGINE=postgresql`,
  `TEAM43_BACKUPS_ENABLED=true`. Auto-deploy was subsequently paused (`false`)
  for the configuration follow-up below. Recheck actual values
  and subsequent scheduled runs before relying on automation.

These are operator-reported cutover results, not a fresh server audit.

### Retention and rollback

Keep `/var/lib/team43-deployment/final-sqlite-cutover.sqlite3` (SHA256
`723d68295ca1a4d13ebf95c5e7b0554477dba0b1250fe3237e9f97278ff239cb`),
the active release, production database, correct release artifact and S3 backups.
PostgreSQL is now the source of truth. Switching back to frozen SQLite would
lose post-cutover writes; stop writers and plan data reconciliation first.

### Deployment configuration repaired — 2026-09-22

The operator backed up both overrides to `/var/backups/team43-systemd.xLjWtc/`.
`50-team43-release.conf` now exclusively manages WorkingDirectory and ExecStart
for the active cutover release. `70-team43-postgres-cutover.conf` contains only
`[Service]` and `EnvironmentFile=/etc/team43/database.env`. A daemon-reload (no
restart) completed; the service remained running, PostgreSQL identity and health
passed, and the installed installer's exact override comparison passed. The
operator verified no other drop-in pins the release paths.

One real manual deployment from main remains to be verified. Keep auto-deploy
paused until that succeeds; workflow_dispatch still allows a manual deployment.
It restarts the service. After success, verify the app and re-enable the gate.
Subsequent scheduled backup execution and alert delivery also need confirmation;
a successful manual backup does not prove those.

Temporary restore databases and downloaded files have NOT been confirmed removed.
Inventory exact targets and obtain operator approval before deletion. Do not drop
`team43`, remove the retained SQLite snapshot, or use broad cleanup globs.

## Historical preparation notes — not current instructions

The remainder records the pre-cutover plan. Statements about SQLite being live
or cutover being pending describe that historical stage, not current production.

Status: repository preparation and user-run EC2 rehearsal. The live service
still uses SQLite. PostgreSQL 16 is installed on EC2 and the `ubuntu` role
can connect to `team43_rehearsal` through the Unix socket.

The original rehearsal package was based on an older checkout and its strict
import check correctly refused the five newer tables in the SQLite snapshot.
No rows were imported. Use the corrected package based on `3f697ec`; migration
`0002` adds the social tables and published home routes on top of the existing
`0001` baseline. Run `alembic upgrade head` and `alembic check` before retrying
the import. Preserve the snapshot: it contains one published route as reported
by the user. Do not discard extra tables or regenerate the baseline migration.
Do not merge this database change expecting the existing automatic deployment
to complete: its schema guard intentionally rejects `app/database.py` changes.
The installed deployment helper and scheduled S3 backup helper are still
SQLite-specific. The updated repository helpers support both databases; they
must be installed and verified before cutover. Do not disable the schema guard.

User-reported EC2 rehearsal results (2026-09-21): all 26 tables imported and
verified, PostgreSQL-backed `/health` returned 9 programmes, 74 backend tests
passed with 5 skipped, and a custom-format dump restored into `team43_restore_test`
with 2 users, 9 programmes and 1 published route. The live API remains on SQLite.
Full restored-table comparison and an off-instance PostgreSQL restore have not
yet been demonstrated. The stopped test server used port 8001.

## Updated operations package

The support module `team43_database.py` must be installed beside both updated
helpers in `/usr/local/sbin/`, root-owned and not writable by the API user.
Use root-owned `/etc/team43/database.env` containing exactly:

```text
DATABASE_URL=postgresql+psycopg://ubuntu@/team43?host=/var/run/postgresql
```

This file is also the systemd `EnvironmentFile` for the PostgreSQL release.
Do not create/activate it until the final cutover. When absent, helpers expect
the existing SQLite URL. Before backup or deployment, they compare this setting
with the running API process's DATABASE_URL and refuse a mismatch. They never
print the process environment. The existing SQLite path is retained for rollback.

PostgreSQL snapshots use `pg_dump -Fc` as ubuntu through the local Unix socket.
The destination is created exclusively with mode 0600; timeout and file-size
limits bound the work. `pg_restore --list` checks archive readability but is
not a substitute for a full restore. Programme count metadata is observed
before the dump and can differ if programmes change concurrently.

S3 objects use `database/<id>.dump`. Update the existing `Team43-BackupDatabase`
SSM document to version 2 using `ssm-backup-document.json` (keep version 1).
It accepts both .sqlite3 and .dump; the host refuses the wrong format for its
active database. The dispatcher continues using version 1 and .sqlite3 until
GitHub Actions variable `TEAM43_DATABASE_ENGINE` is set to `postgresql`, then
uses version 2 and .dump. Confirm version 2 is the reviewed document before
setting that variable. No IAM or public-access changes are required by this
code: the bucket/prefix, command name, instance and role stay the same.

For subsequent PostgreSQL deployments, model/database/migration files must
match the active release. Candidate dependencies and tests run as ubuntu,
then a read-only `alembic check` must pass. The stopped-service phase takes a
PostgreSQL dump and switches only code. Failure restores the previous code
configuration and never overwrites the PostgreSQL data. A first manual
cutover is required; this helper intentionally does not switch database engines.

The reusable PostgreSQL CI job is now a required dependency of deployment.
Cloud resources and installed helper files have not been changed by these edits.

## Prepared in this repository

- Psycopg driver and PostgreSQL URL support.
- Alembic baseline with the current tables and constraints.
- A read-only-source SQLite import into an empty PostgreSQL database. Every
  field is compared after copying, IDs are retained, sequences are reset, and
  row inserts roll back on failure. Stop writers and use a consistent snapshot.
- A PostgreSQL 16 CI job that checks migrations, API behavior and data transfer.
- SQLite remains the default so existing environments keep working.

## Rehearse before the live cutover

1. Check instance capacity, service user, Ubuntu/PostgreSQL versions and disk
   space. Install PostgreSQL on EC2 using the distribution package manager.
   Keep port 5432 closed in the EC2 security group and PostgreSQL listening
   locally. Use the local Unix socket and peer authentication.
2. The deployment scripts currently run the API as `ubuntu`; verify the actual
   systemd `User` before creating a matching PostgreSQL role. Create a login
   role with no superuser, role-creation or database-creation permissions, and
   a dedicated `team43` database owned by that role. Create a separate rehearsal
   database first. The database owner applies migrations; never run the API as
   PostgreSQL's administrative account.
3. Install this candidate backend's requirements in a separate virtualenv.
   Set the rehearsal `DATABASE_URL` in its environment, for example:

   ```sh
   export DATABASE_URL='postgresql+psycopg://ubuntu@/team43_rehearsal?host=/var/run/postgresql'
   python -m alembic upgrade head
   python -m alembic check
   python -m scripts.migrate_sqlite_to_postgres --source /path/to/sqlite-backup.db
   ```

   Run commands as the role-matching OS user from `backend/`. Do not point the
   import at an actively changing database. The existing SQLite backup utility
   can produce a consistent snapshot. Do not run seed scripts over migrated data.
4. Start the candidate on a separate loopback port and test login, profile,
   journey progress, saved items and wayfinding using the copied database.
   Check all table counts from the importer, not only `/health`.
5. Use `pg_dump --format=custom` for PostgreSQL backups. Restore the dump using
   `pg_restore --no-owner --no-acl --exit-on-error` into a new empty rehearsal
   database, then verify data and the app. Store backups off the instance.
   The current scheduled S3 job copies SQLite and will NOT back up PostgreSQL.

## Live cutover prerequisites still to complete

- Replace and test the installed deployment helper's SQLite backup/presence
  checks and its database handling. Preserve its lock, code rollback, health
  checks and explicit migration review. Do not auto-run schema downgrades.
- Replace the scheduled backup/restore flow with PostgreSQL dump/restore,
  including the S3 dispatcher, object extension, fixed SSM document validation,
  and root-owned helper. Prove an off-instance restore before switching traffic.
- Pause automatic deployment during the maintenance window. Stop the API to
  stop writes, take a final SQLite snapshot, migrate to the empty live database,
  verify data, update the service environment and activate the tested release.
- Re-enable traffic only after smoke tests. Retain SQLite and its backups.
  Before new writes, rollback can restore the old service/database settings.
  After PostgreSQL accepts new writes, reverting to the old SQLite file loses
  those writes; stop and reconcile/export them before any such rollback.

## Development

SQLite development continues to work. To test with PostgreSQL, set
`DATABASE_URL`, install requirements and run `python -m alembic upgrade head`
before starting Uvicorn. `.env.example` is documentation, not an automatic loader.
The test suite accepts `TEST_DATABASE_URL` only for non-SQLite databases whose
name ends in `_test`; tests erase their application tables. Never use production.

New model changes need reviewed Alembic revisions. Do not run the baseline
upgrade on an existing SQLite database with tables already created. A baseline
stamp is appropriate only after verifying that its schema matches the revision.

References: [Alembic migrations](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
and [PostgreSQL backup/restore](https://www.postgresql.org/docs/16/backup-dump.html).
