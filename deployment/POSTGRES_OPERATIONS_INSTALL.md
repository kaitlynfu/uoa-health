# Operations package: validate before installation

> Historical initial-install procedure. The operator confirmed installation and
> production PostgreSQL cutover on 2026-09-22. Do not repeat the SQLite setup below
> on production. Current expected mode is `postgresql`; preserve database.env.
> See [POSTGRESQL.md](POSTGRESQL.md) for verified results and the outstanding
> systemd drop-in/deployment check. Never reinstall the original unpatched v1
> archive: it contains the buffered-descriptor validation bug.

This package contains code only. Uploading or extracting it does not install it
or change the running API. Keep the existing helpers until these checks pass.

1. Download through a private S3 presigned GET URL and verify the supplied
   SHA256. Extract into a new ubuntu-owned directory. Never extract directly
   over `/usr/local/sbin` or the running release.
2. From that directory run `python3 -m unittest discover -s deployment -p
   'test_*.py' -v`. These are synthetic tests without live database or AWS access.
3. As root, with the extracted deployment folder as PYTHONPATH, call
   `team43_database.database_mode()` and `confirm_active_database(mode)`.
   Expected current mode: sqlite. This prints no environment or credentials.
   A mismatch means inspect the current service before installing anything.
4. Use `postgres_snapshot(new_private_path, 'team43_rehearsal')` as root to
   exercise the real pg_dump/pg_restore commands. Restore that resulting dump
   into a new test database and compare all tables before accepting it.
5. Only after successful rehearsal, back up the existing installed helpers
   into a new root-only directory. Install the companion `team43_database.py`
   as root:root 0644, then the updated `team43-backup-database` and
   `team43-deploy-backend` as root:root 0755, all in `/usr/local/sbin/`.
   The database.env file must still be absent (or select SQLite); no database
   switch occurs just by replacing the helpers.
6. Upload `ssm-backup-document.json` as version 2 of the existing
   Team43-BackupDatabase document. Confirm its version and test a SQLite backup
   through the installed tools. The old version 1 remains valid for SQLite.
7. Commit/review the repository workflow/dispatcher changes and ensure the
   installed helpers and GitHub main agree. Pause automatic deployment during
   the eventual migration window. Do not switch live database settings yet.

The cutover separately requires a final snapshot while writes are stopped,
import into an empty `team43` database, a tested release under
`/opt/team43/releases/`, and root-owned `/etc/team43/database.env` selected by
systemd. Backups require `TEAM43_DATABASE_ENGINE=postgresql` after the switch.
Verify a new S3 .dump backup and restore before considering the transition done.
See POSTGRESQL.md for the fixed URLs, rollback constraints and schema guards.
