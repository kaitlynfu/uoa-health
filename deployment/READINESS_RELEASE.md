# One-time readiness activation — 0004 to 0005

This is an operator-controlled, additive release, not an automatic schema-guard
exception. Do not reuse the older social activation script for this migration.
The normal installer and every existing migration remain unchanged.

## Exact candidate and preflight

- Backend/frontend candidate: `5968a9a50947d1346a66acc279a962cd93fd503a`.
- Backend archive SHA256:
  `5c5dfd3398fe33b063e513903e058beb737d26ec0d1e3571ca6b8ac7c4281b7a`.
- Current server baseline:
  `/opt/team43/releases/a73c53ccc63b657a5d3b3c288589767856cc0ff0-zpi78kuh/backend`.
- Original database: `team43`, revision `0004`, local ubuntu peer authentication.
- Separate `team43_readiness_rehearsal` upgrade passed on the server: every
  original row preserved and Alembic schema/model equivalence verified at 0005.
  The source had 3 users, 38 sessions, 3 groups, 3 messages, 9 programmes and
  one home route. No campus recordings were invented or published.
- Original private dump is retained in
  `/home/ubuntu/team43-readiness.7HScKa/production-before-readiness.dump`.

The script additionally checks the exact active baseline, installed root-owned
helper hashes, immutable migration history, service override and PostgreSQL
identity. It refuses changed inputs rather than expanding allowed targets.

## Controlled execution

1. Confirm exact PR checks are successful and no backend deployment is running.
   Temporarily pause `TEAM43_AUTO_DEPLOY` for this coordinated cutover. Do not
   disable backup scheduling, alter IAM or add a self-hosted runner.
2. Transfer `activate_readiness_release.py` privately; verify its exact SHA256
   before installing it into a new protected root-owned directory (not /tmp).
   Execute only that root-owned, non-writable copy, using `--activate`.
3. The script prepares a new release directory and dependencies before stopping
   the service. It locks the ordinary deployment lock throughout preparation.
4. During downtime it creates a fresh private custom-format PostgreSQL dump,
   restores it to a uniquely named `team43_readiness_<id>_final` database, and
   verifies all original rows before/after migrating that copy to 0005. Only
   then does it migrate live, verify original rows again, and switch app code.
5. It checks health/programme count, active code path, live PostgreSQL identity,
   authentication requirements and the advertised frontend capabilities. Success
   creates `activated.json` in the protected recovery directory.
6. Retain the fresh backup, verified restore database and previous service
   override. On failure the script restores the prior **application code**, not
   the database. This migration is additive; do not automatically downgrade or
   overwrite live from a backup. Inspect recovery evidence before retrying.
7. Reconcile/merge the reviewed PR into main, verify ordinary deployment of that
   exact main commit, then restore auto-deployment and publish the frontend.
   Schema guards remain enabled. Never describe a skipped deploy as success.

Keep `activated.json` paths/checksums private. Do not print environment files,
message content, passwords, recovery codes or bearer URLs to chat or logs.

## Still separate from deployment

The native runtime is 1.3.0: a native rebuild is required, not just OTA delivery.
SMTP sender/provider and moderator account IDs need real configuration. No
operational credentials have been invented. Native/device, campus survey,
independent backup alert delivery and retention-policy checks remain as listed
in `docs/APP_READINESS_FIXES.md`.
