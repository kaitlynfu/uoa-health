# Readiness fixes — release 1.3.0

These changes were merged into main at `3eb24a5` on 2 October 2026.
The [manual backend deployment](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36997360932)
and [mobile publication](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36997261031)
succeeded. On 9 October, live health and the readiness capability probes passed.
The coordinated push deployment was skipped; the later manual job actually ran.
The revision 0005 cutover below is historical, not an instruction to rerun it.
The earlier audit is a dated baseline, not an up-to-date list of implemented screens.

## Implemented

- Real authenticated password changes, rotating all other sessions and revoking
  earlier email codes so a stale recovery code cannot undo the change.
- Secure phone session persistence, restoration, UTC expiry and revoked-session
  handling. Web tokens remain in memory. Storage failures are reported honestly.
- Configurable TLS SMTP reset/verification flows, hashed 30-minute one-use codes,
  session revocation on reset, and generic reset-request responses.
- Persistent cross-worker abuse limits for registration, login, recovery,
  password changes, reports, messages and photos. Expired limit rows are removed.
- Bounded chat pages/cursors and message-query indexes; named conversations,
  named senders, readable dates, focused/foreground polling and offline catch-up.
  Older history can be loaded without forcing the user back to the bottom.
- Blocking stops direct sends and friend requests in both directions, removes
  the friendship, hides blocked senders' group messages and hides their inbox.
  Shared groups remain public-join; blocking does not remove other members.
- Private reports/support submissions, immutable-ID moderator grants, report
  review/resolution and explicit confirmation before removing a reported message.
- Group editing, owner-only deletion, ownership transfer to an existing member.
- In-app activity inbox/preferences derived from unread chats and incoming
  requests. No pretend push delivery or invented career opportunity alerts.
- Both-sided opt-in shared-interest suggestions. These are explainable keyword
  overlap, not a validated compatibility or mutual-friend algorithm.
- A short exploratory career interest picker, preserving existing preferences.
  It is not a suitability/admissions assessment.
- Account export and password-confirmed erasure. Authored messages/private
  records are removed; groups transfer to the oldest remaining member or are
  deleted when empty. De-identified actor references remain for shared history.
  Other people's received messages and shared campus recordings are not erased.
  Historical backups are subject to the team's retention policy, still to agree.
- Optional private profile photos; bounded JPEG/PNG decoding, normalization to
  512 pixels and removal of EXIF/GPS metadata. No public photo directory.
- Corrected Groups/course discovery descriptions and integrated-main checkout
  instructions. Removed the unreachable mock ETA screen and empty prerequisite
  graph UI; real milestone details and official links remain.
- PR-time frontend checks and a publication gate requiring deployed matching
  backend capabilities. New native modules use runtime **1.3.0**, so they cannot
  be shipped to incompatible 1.2.0 installs.

## Dependency status

Updated compatible transitive packages (including brace-expansion and uuid),
pytest to 9.0.3 and urllib3 to 2.8.0. CommonJS uuid consumers have a compatibility
test. No Expo downgrade or `npm audit fix --force` was used.

The 9 October review-fix branch updates `shell-quote` to 1.12.0 and
`http-cache-semantics` to 4.3.0 through compatible transitive overrides, removing
the critical shell-quote and affected cache-package audit entries. A regression
test covers the shell quoting exploit input. No SDK/runtime downgrade is used.

The remaining audit reports **17 high package entries**, propagated from two
upstream-unpatched roots: [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
and [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Published latest
versions remain affected. These are dependency findings, not proof of deployed
app exploitability. Keep build inputs trusted; do not expose Metro to untrusted
networks or accept user-provided glob patterns into build tooling. Recheck for
maintainer fixes before public release. No claim of a clean audit or absence of
exploitation is made; do not implement ad-hoc cryptography or force an Expo downgrade.

The 10 October follow-up adds reproducible install-time mitigations for those
two roots: the pinned, still-unmerged upstream node-forge validation backport,
and bounded braces parsing/AST traversal. PR checks and mobile publication verify
the patches and run exploit/compatibility tests. The original versions and audit
findings remain visible. See [security backport details](DEPENDENCY_SECURITY_BACKPORTS.md)
for provenance, limitations and removal instructions when official fixes arrive.

The review-fix branch also moves the 60-per-minute message limit to actual sends
(shared across direct/group targets), and excludes deleted peers from inbox and
notification queries before pagination. Anonymous history references remain
stored, but deleted accounts cannot be opened, messaged or friended.
These follow-up fixes are not deployed merely by editing this document.

## Historical revision 0005 release gate — do not rerun the completed cutover

Revision **0005** only adds tables and indexes. Old migration files and the
installed automatic migration guard are unchanged. A schema-changing release
still needs an operator-controlled backup/rehearsal/cutover. The original 0005
procedure is retained below for audit/recovery context; the messaging and
dependency follow-up fixes add no schema revision:

1. Run PR frontend/backend/PostgreSQL checks against this exact commit.
2. Restore a fresh production dump into **team43_readiness_rehearsal**, owned by
   ubuntu; keep its permissions private. Never use the live database for tests.
3. On EC2, use the candidate backend's Python to run
   `scripts/rehearse_readiness_postgres.py` with
   `DATABASE_URL=postgresql+psycopg://ubuntu@/team43_readiness_rehearsal?host=/var/run/postgresql`.
   It refuses production/remote targets, requires source 0004, upgrades to 0005,
   checks model/schema equivalence and verifies every original table/row.
4. Pause automatic deployment for the coordinated cutover, record the exact
   tested release, create/verify a fresh private backup and keep the prior code.
   Upgrade live only under the reviewed activation procedure, then verify health,
   capabilities and authenticated smoke flows. Never disable the schema guard.
5. Verify main and the active release match, then resume automation and publish
   the matching frontend. The publication gate cannot perform the migration.
6. Build/install **1.3.0** on phones; an OTA update cannot install SecureStore or
   ImagePicker into 1.2.0. Keep native signing and existing local editor drafts.

## Required configuration and hands-on work

- Email: configure `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_FROM`, optionally
  `SMTP_USER` and `SMTP_PASSWORD` in the server's protected environment, **not
  GitHub/source code**. The configured service must support STARTTLS. Configure a
  real verified sender (for example SES SMTP); otherwise email endpoints return
  a truthful unavailable error. Delivery/bounce handling needs a provider check.
- Moderation: choose real immutable account IDs and set
  `TEAM43_MODERATOR_USER_IDS` in the protected environment. Missing/malformed
  configuration denies everyone. Assign a team owner and response expectations.
- Native device acceptance: two accounts, sign-in/cold restart/expiry, password
  change, recover/verify, account switching, export/delete on disposable accounts,
  photo choose/remove, block/unblock/report, notifications and ownership changes.
  Include keyboard, offline/reconnect, scrolling and update delivery.
- Push: APNs/FCM credentials and delivery setup remain external work. Free Apple
  provisioning is not evidence of production push capability. In-app activity
  works independently; no hidden self-hosted runner was installed.
- Campus: survey/publish/test physical routes with a second iPhone. Android
  indoor AR requires a separate ARCore implementation; iPhone ARKit maps cannot
  be made Android-compatible by a backend change. Outdoor directions remain.
- Verified prerequisite data and broader programme/building coverage require
  actual sources and client scope. No catalogue or navigation rows were invented
  or inserted in production. Google sign-in remains deferred as requested.
- AWS: read-only host/SSL/OS/disk/memory/alarms review and independent backup
  freshness alert delivery still require operator access. Existing recovery
  backups were retained. Agree retention/privacy contact before public launch.
- Original dirty checkout remains untouched. The shared node_modules junction
  was preserved under this worktree's ignored `.expo` directory; dependencies
  here are now isolated. Do not reset or blindly commit the original checkout.

## Verification record

10 October dependency follow-up: clean installation applied both mitigations;
11 dependency security/compatibility tests, the 79 existing frontend checks,
TypeScript, disposable two-account social integration and all three frontend
exports passed. The npm audit warnings remain visible (17 high, zero critical).
No native build, merge, publication or production deployment was performed.

9 October follow-up (`codex/main-review-fixes`): 244 backend/deployment tests
passed, two skipped (local SQLite), including the send-limit boundary/reset and
deleted-peer pagination/notification regressions. With a clean `npm ci`,
TypeScript, 79 frontend checks, disposable two-account social integration and
iOS/Android/web JavaScript exports passed. `npm audit` reports zero critical
and 17 high entries from the two unpatched roots described above. No new schema
migration, phone installation or production deployment was performed.

Original 1.3.0 candidate verification:

Local isolated backend: 150 passed, 2 skipped including moderation, limit
retention, stale-code revocation and safe email-failure logging. Deployment tools:
86 tests, one platform skip. Frontend: TypeScript, 14 screen checks, 17 student
checks and 47 wayfinding checks passed. iOS/Android/web JavaScript exports passed.
These are not a native compile, physical phone test, or production 0005 rehearsal.
