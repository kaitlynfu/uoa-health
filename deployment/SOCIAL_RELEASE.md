# Social release: reviewed PostgreSQL revision 0004

Activated 2026-10-02. The operator supplied the successful activation receipt;
public HTTPS health was independently verified. Phone testing and the ordinary
main-branch deployment remain pending.

## Candidate and observed baseline

- Exact backend candidate: `3d25ecb9a9038fab961af87e34039238bcf0f4bf`.
- Backend-only archive SHA256:
  `1215120cff8a74d2e1b24e9685da23b1da9055eede00d524274c5390d771b571`.
- Live PostgreSQL database: `team43`, local ubuntu peer authentication, revision
  `0003` (campus). Service active at
  `/opt/team43/releases/bdafd6afc71fd230e168baeb2ebdf44e5e20357b-campus-prep-9g06lg_u/backend`.
- Existing migration 0003, campus models/routes and frontend are preserved in
  this candidate. The additive social migration follows campus as revision 0004.

## Completed production-copy rehearsal

The operator downloaded and checked the archive, installed its requirements in
`/home/ubuntu/team43-social-rehearsal.1bPouu/backend/.venv`, and created the private
custom-format snapshot `production-before-social.dump` in that rehearsal folder.
It was restored into the separate database `team43_social_rehearsal`.

The guarded rehearsal reported PASS: revision 0004, Alembic schema check and
every original row verified. Original counts included three users, 36 sessions,
three groups, three memberships, three messages, one friendship, nine programmes,
one published home route and zero published campus routes. Every other original
table was also preserved. No production migration was performed by this step.

Candidate PostgreSQL/backend checks passed on GitHub. Local backend tests passed
(128 passed, two skipped); frontend TypeScript, screen/API, wayfinding and the
isolated two-account integration tests also passed. The activation tooling has
portable tests for archive validation, preservation checks, ordering and code
rollback at failure points; these do not access AWS or a live database.

## One-time activation contract

`activate_social_release.py` is an explicit, pinned, operator-run activation,
not a relaxation of the ordinary deployment schema guard. Transfer a verified
copy into a new root-owned private folder and invoke it only with `--activate`.
Pause automatic backend deployment before activation; do not merge main yet.
Manual deployment workflows must not be started concurrently.

The helper checks installed root-owned helper hashes, running release, baseline
configuration/migrations, database identity and revision before stopping the API.
It stages a new release and installs dependencies while the existing API runs.
It holds the same host deployment lock used by normal deployments/backups.

During a brief API interruption it takes a fresh private dump, restores it into
a unique new database, verifies the stopped-production contents, rehearses 0004
and checks every original row. Only then does it apply 0004 to production,
verify preservation and switch the service. Health, the actual running release,
PostgreSQL identity and unauthenticated social/campus denial are checked.

On failure after stopping the API, previous app code is restored and checked.
The additive schema remains compatible with previous code; the database is never
automatically restored, downgraded, cleared or seeded. A migration may already
have committed: inspect revision and retained recovery evidence before retrying.
If code rollback fails, stop and use the printed recovery folder with an operator.

Success prints `SOCIAL ACTIVATION PASSED` and records the candidate, backup hash,
new release, health and retained restore database in a private `activated.json`
under `/var/lib/team43-deployment/social-activation-*`. Keep all backups and
restored databases until a separately authorized, exact-target cleanup.

## Remaining release checks

- On-phone two-account social checks, plus existing campus functionality.
- Review/merge PR 33, verify the ordinary deployment of main at schema 0004,
  then restore the previous automatic-deployment setting.

Do not run destructive pytest against production or a private preservation copy.
No accounts, messages, dump contents or credentials belong in Git or PR output.

## Production activation receipt

The helper printed `SOCIAL ACTIVATION PASSED`, revision `0004`, healthy/connected
with nine programmes. The fresh backup restore and every original row were
verified before and after the production migration. The running service and
unauthenticated denial on social/campus endpoints were checked by the helper.

- Active backend:
  `/opt/team43/releases/3d25ecb9a9038fab961af87e34039238bcf0f4bf-social-8lbqa_96/backend`.
- Retained recovery folder:
  `/var/lib/team43-deployment/social-activation-p3vqm534`.
- Fresh pre-upgrade dump: `before-social.dump` in that folder.
- Dump SHA256:
  `7307d3aed20b214f0360d9f7cc65a9415c4cb4e8797c295386f34f7d10993588`.
- Retained verified restore database: `team43_social_d751f7252ac7_final`.
- Root-owned activation copy:
  `/var/lib/team43-deployment/social-activate.fI9Hr1/activate_social_release.py`.
- Activation file SHA256:
  `bd9343daff663037485748dc06d66b67a896ee12a7d801eed718d0d234bc9f62`.

Public `https://team43-api.3-27-96-180.sslip.io/health` subsequently returned the
same healthy/connected/nine-programme result. Automatic backend deployment is
temporarily paused (`TEAM43_AUTO_DEPLOY=false`, previously true). Backups remain
enabled and configured for PostgreSQL. The fresh manual main-branch S3 backup
completed successfully: run `36930636639`, including its "Create and upload a
validated snapshot" step and the backup job (not skipped). Evidence:
https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36930636639.
PR 33 is still draft and not merged.
