# Campus backend deployment: reviewed PostgreSQL revision 0003

Prepared 2026-10-01. Deployment was authorised by the operator. This document
records preparation and the completed 2026-10-02 production activation.

## Observed production and first backup

The operator verified the live process against the root-owned database contract:
PostgreSQL database `team43`, Alembic revision `0002`, active service release
`bb79f0b6467b46ed500ba54b6faeabf4885e1961-0cil3a3x`. Public HTTPS health returned
healthy/connected with nine programmes.

The operator created a fresh private custom-format dump, while holding the host
deployment lock, using the installed snapshot helper:

- `/var/lib/team43-deployment/campus-backup-z58h5wy8/before-campus.dump`
- SHA256 `6c2de3c1c8d924e683b57dd6ecf5eb4214f5297202a0d752cd55f22e274bfa2b`
- 202,723 bytes; observed programme count: 9.

The operator subsequently verified that checksum and completed a transactional
`pg_restore` into the separate database `team43_campus_6c2de3c1c8d9_restore`.
It reports revision 0002 and nine programmes. Full migration/preservation and API
checks completed during the successful preparation below. The dump contains private account data: retain it outside
Git and do not paste its contents into chat.

## Operator CloudShell transfer

The code-only package `team43-campus-bdafd6a.zip` pins backend/operations artifacts
from commit `bdafd6afc71fd230e168baeb2ebdf44e5e20357b`. Its ZIP SHA256 is
`d5f165e9d3489fa393c911cefcea30ad8b24bb6395d0d9ccb254028b218962cb`.
The operator uploaded it to CloudShell and confirmed the checksum.

Upload `deployment/stage_campus_release.py` to the same CloudShell directory and
run `python3 stage_campus_release.py`. It uses the existing AWS session, verifies
the fixed account/package, uploads immutable code artifacts to the existing
private deployment bucket, and sends preparation commands only to the existing
EC2 instance. No URLs are printed. If existing IAM permissions deny the upload or
SSM call, it stops; it does not change IAM permissions or public access.

Preparation stages a separate release, runs deployment tests as ubuntu, verifies
the installed database companion/baseline pins, installs candidate dependencies
in a separate virtualenv, runs SQLite tests and the real PostgreSQL restore,
migration-preservation and API tests. Its final report identifies the prepared
paths and current installed helper hash. It does not install the new helper,
modify nginx, upgrade production or restart the service. Operator activation
follows only after the server's preparation succeeds.

The first SSM preparation (`9076a892-311b-48ed-8ddf-f7720cf419bc`) stopped in the
portable operations suite. Ubuntu's system botocore did not support the pinned
test's `request_checksum_calculation` option. No candidate/backend migration or
API activation was reached. The staging runner now creates a separate operations
virtualenv and installs `backup-requirements.txt` there before those tests; it
does not upgrade Ubuntu's SDK or install it into the application environment.

## Exact supported transition

The deployment helper imports companion `team43_campus_postgres.py`. Install both
as reviewed root-owned files together, preserving the previous versions. Updating
Git alone does not update `/usr/local/sbin/` on the server. The existing companion
`team43_database.py` and PostgreSQL environment configuration remain required.

## Successful preparation and activation runner

SSM command `e84c3313-1828-4ba8-9903-e4cf769b7006` succeeded. It fully restored and
rehearsed revision 0003 in `team43_campus_876d107001c0_restore`, preserving all 27
pre-existing tables. Candidate SQLite tests reported 85 passed/7 skipped; the
PostgreSQL API suite reported 86 passed/6 skipped in the separate disposable
database `team43_campus_49a82277a2f5_test`. Those results are backend verification;
native phone testing remains necessary. The live database stayed at revision 0002.

Prepared release: `/opt/team43/releases/bdafd6afc71fd230e168baeb2ebdf44e5e20357b-campus-prep-9g06lg_u`.
Installed deployment helper hash observed in that successful report:
`cd8006fc3f2da5709732c439ec54cb5f246e9ca8c8088305bdd8d8f9cfbd97b5`.

The operator inspected Nginx: `/etc/nginx/sites-enabled/team43-api` serves
`team43-api.3-27-96-180.sslip.io` with `location /` proxying to `127.0.0.1:8000`;
no explicit body/response limits were present. `activate_campus_release.py` is a
self-contained CloudShell runner pinned to that successful preparation. Upload
it and run `python3 activate_campus_release.py`. It verifies the protected report,
archive checksums, extracted source files, live release/revision and installed
helpers under the shared deployment lock. Unexpected configuration stops the run.

The runner preserves private recovery copies of the helper, service override and
actual Nginx file, inserts 50m/180s upload settings only in the observed simple API
proxy location, validates Nginx before reload, and installs both reviewed deployment
helpers for future deployments. It then stops the API, takes another fresh dump,
and uses the same rehearsed migration/preservation functions on a full restore of
that final dump before upgrading production and switching to the prepared backend.
Health, revision 0003, unchanged editor allowlist and unauthenticated endpoint
denial must pass. Failure attempts to restore the application/helper/proxy,
retaining the database, dumps and recovery files; failed recovery is reported.
An interrupted/failed run must be inspected before retrying.

The new transition accepts only the pinned existing model, unchanged database/
Alembic configuration and revisions 0001/0002, the pinned new model, and the pinned
single additive revision 0003. All other schema changes retain the existing guard.
No separate table creation, revision stamp, seeding or downgrade occurs.

Before interruption, it creates and retains a fresh private backup, fully restores
into a uniquely named database owned by ubuntu, checks the baseline, rehearses the
upgrade, and compares all pre-existing tables' columns, constraints, indexes,
counts and complete-row hashes. Existing sequence values, enums, views and triggers
must also remain unchanged. Candidate Alembic check must pass. The complete API
suite runs against a separate newly created database ending `_test`; it never
runs against production or the restored private data.

During activation, the service is stopped, another fresh dump is restored and
rehearsed, and the restored contents must exactly match stopped production before
applying 0003 to production. The same preservation checks run after migration,
then code is activated and health checked. On failure, the old service configuration
is restored and the database retained. The additive table is compatible with old
code; a later retry also preserves any campus publications already written.

Restore/test databases, dumps and private audit manifests are retained for review.
There is no automatic database deletion. An administrator must inventory exact
temporary names before separately approved cleanup. On-instance retention is not
an off-instance backup: retain the existing private S3 backup workflow and verify
a new backup after deployment.

## Additional activation checks

- Inspect the actual reverse proxy before changing it. Campus publish requests
  require a 50 MB body limit and sufficient upload/response timeout. Back up the
  exact edited configuration, validate it with `nginx -t`, then reload only after
  validation. Do not replace unrelated virtual hosts or disable authentication.
- Preserve the existing editor allowlist; debug installation does not grant access.
- Verify unauthenticated campus calls require authentication and a signed-in editor
  can load a template. Do not create fixture accounts in production.
- Build iPhone version 1.2.0 on the Mac. Native capture/import and campus survey
  testing remain necessary; a green backend deployment cannot verify AR behaviour.

## Verified live activation (2026-10-02)

SSM command `3578244e-4e06-49fb-98aa-d444310d3aa5` completed successfully with
`CAMPUS ACTIVATION PASSED`. The running backend is the prepared release above;
production now reports Alembic revision 0003. Final backup restore rehearsal
`team43_campus_50a5229b7a21_restore` preserved all 27 existing tables. The live
migration preservation audit, health, unchanged editor allowlist and campus
authentication checks passed. Nginx upload settings and future deployment helpers
were installed with recovery copies retained.

- Recovery directory: `/var/lib/team43-deployment/campus-activation-2viwhenc`
- Final pre-migration dump: `before-campus.dump` in that directory.
- Dump SHA256: `cf561e252264a2f6de49755c39ccec5224b3fa5ce93a55064825c8826f19d145`.
- Public HTTPS `/health` independently returned HTTP 200,
  healthy/connected with nine programmes.
- Public HTTPS `/navigation/campus/catalog` independently returned HTTP 401
  without credentials, as required.

The retained dump is on-instance; an additional off-instance backup has not been
confirmed in this activation record. Signed-in editor and ordinary-account phone
checks, native iPhone build, physical surveys and cross-device recognition remain
to be performed. No campus environments/routes have been surveyed by deployment.

The 2026-10-02 staging inspection confirmed that the installed database companion
differs from the pinned package only by two explanatory comments above the
unbuffered dump-header check. The staging runner accepts only the canonical
normalized-text hash or that exact reviewed live hash; it does not replace the
installed companion or accept other differences. Regression tests reject both
unreviewed comment changes and operational changes, including matching modified
installed/packaged sources.

Portable deployment tests pass locally (80 tests with the pinned SDK, no skips).
Production activation is verified; native phone checks remain pending. Follow
`docs/CAMPUS_WAYFINDING_SURVEY.md` after activation.
