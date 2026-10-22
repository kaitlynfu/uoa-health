# UoA Health deployment and operations

## Current assessment deployment

Status checked on **17 October 2026**: the API and browser app are hosted on AWS
EC2 with PostgreSQL. GitHub's `TEAM43_AUTO_DEPLOY` variable is `true`; the latest
backend deployment, mobile update and scheduled backup workflows succeeded.
These are point-in-time checks, not a guarantee of future availability.

- [Browser app](https://team43-api.3-27-96-180.sslip.io/app/)
- [API health](https://team43-api.3-27-96-180.sslip.io/health)
- [Running browser version/commit](https://team43-api.3-27-96-180.sslip.io/app/build-info.json)
- [Source and Actions](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project)

The team must retain the server, database, HTTPS endpoint and required access
until final marks are released. Assessors use the website and ordinary project
accounts; they do not need cloud credentials or direct database access.

## Release flow

1. Open a pull request against `main`. Backend tests, PostgreSQL checks and the
   applicable frontend checks validate the proposed source.
2. After review and passing checks, merge to `main`. Matching backend, frontend,
   deployment and workflow changes trigger [backend-deploy.yml](../.github/workflows/backend-deploy.yml).
3. The workflow checks both databases, builds the browser export using the hosted
   API URL, and deploys the tested source commit through AWS Systems Manager.
   GitHub OIDC supplies short-lived AWS access; no long-lived AWS key is committed.
4. Check the workflow result, `/health`, `/app/build-info.json`, then try a browser
   journey. A successful build alone does not prove the deployed application works.

The browser export and backend are packaged together. JavaScript/assets for
compatible installed mobile builds are separately published by
[frontend-update.yml](../.github/workflows/frontend-update.yml). A native dependency,
permission or runtime change requires a new compatible native build. See
[web testing](../docs/WEB_TESTING.md) and [Android testing](../docs/ANDROID_TESTING.md).

Deployments are serialised. Disabling `TEAM43_AUTO_DEPLOY` stops future automatic
dispatches; it does not cancel a deployment already running on the server. If a
workflow times out, inspect the SSM operation and service before retrying.

## Database changes, backups and recovery

Use [POSTGRESQL.md](POSTGRESQL.md) for database configuration and migration
procedures, and [BACKUPS.md](BACKUPS.md) for scheduled off-instance backups and
restore checks. Current application migrations extend through revision `0005`.
Migration files and the installer guards must agree before a schema release.
Do not reseed, scrape, overwrite or reset the production database as part of a
documentation update or ordinary release.

The server runs a reviewed, root-owned deployment helper. Editing
[team43_deploy_backend.py](team43_deploy_backend.py) in Git does **not** automatically
replace that installed helper. Changes to its contract require an operator to
review, test and install it using the existing runbooks. Retain previous releases
and database backups before a migration or rollback. Restoring a backup in
isolation and rolling back an application release are separate checks.

Relevant operational references:

- [Campus publication rollout](CAMPUS_RELEASE.md)
- [Application readiness rollout](READINESS_RELEASE.md)
- [Database backup tools and dependencies](backup-requirements.txt)
- [Web export/deployment details](../docs/WEB_TESTING.md)

Keep live environment files, signing material, database dumps and credentials out
of Git. The [September deployment guide](../archive/development-notes/DEPLOYMENT_2026_09_22.md)
is preserved as a historical record; its paused-deployment and pending-SQLite
transition statements do not describe the current release.
