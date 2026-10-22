> Historical record. This document describes an earlier project state; use the [current project README](../../README.md) and [documentation index](../../docs/README.md) for supported setup and release instructions.

# Team feature integration — local review handoff

Branch: `codex/team-feature-integration` in `.integration-worktree`, based on main commit `85f5e01`.
Implementation remains uncommitted for review. No merge, push, deployment, live database seed, or changes to the separate `codex/verify-auto-deploy` checkout were performed.

## Working in the tested local integration

- Programmes list links to populated programme details, with account-backed saving.
- Career alignment, career search/categories, career details and linked programmes use the existing backend's canonical career identities and many-to-many relationships.
- Registration, login, profile/interests editing, logout/session revocation and account-specific saved programmes/careers use real API requests.
- Journey selection uses backend programme plans and catalogue years. Milestones load from the database, completion persists, and milestone details display the selected course rather than a hardcoded course.
- Basic social integration supports friend requests/acceptance/removal, public-join groups, member leave, direct messages and group messages. Group read/write operations require membership; direct-message retrieval is scoped to the signed-in user. This is a basic ID-based test panel, not a polished messaging product.
- Existing Building 303 search, destination previews, QR permission gate, home route demo and AR capability fallback remain available. Automated tests exercised 21 supported start/destination combinations, an accessible elevator route, and rejection of disconnected starts.

## Main fixes

Integrated selected work from career alignment (`154bfcd`), milestone (`eecc211`), Social (`cbdc6e3`) and Jay's wayfinder redesign (`85df83e`). Kept the existing shared backend models/API and indoor navigation rather than replacing them with incompatible branch versions.

Fixed missing screen registration, social URL/auth/payload mismatches, membership authorization, hardcoded milestone content, non-persistent account/saved/journey UI, search parameter handoff, programme detail placeholder and programme list links. Fixed a live HTTP logout defect by returning an explicit empty 204 response. Fixed catalogue-year validation which prevented plan loading. Added visible form errors, loading/empty notices, checkbox accessibility and scrollable home/login content.

### Windows preview permission repair

Python's owner-only `mkdir(mode=0o700)` created a Windows ACL owned by `CodexSandboxOffline`; the normal Windows account could not access `.integration-local`. Granted **only** `AVINASHPC\Avinash Rajaram` Modify access to the existing test directory and database. No data was deleted or replaced. Changed the seed script to inherit normal workspace permissions on Windows, while retaining 0700 on Unix.

Verified under `avinashpc\avinash rajaram`: directory listing, ACL reading, SQLite integrity `ok`, database read and write-lock acquisition (transaction rolled back). Backend `/health` returned healthy/connected/9 programmes. Browser then loaded all 9 programmes and Nursing details from the repaired database.

## Test evidence

Previously completed and not redundantly rerun during the permission repair:

| Check | Result |
| --- | --- |
| Backend pytest suite | 47 passed |
| Frontend Node tests, including local live API integration | 34 passed |
| TypeScript `tsc --noEmit` | Passed |
| Deployment/backup tool unittest suite | 47 passed; no AWS calls |
| Expo production web export | Passed |
| Expo iOS JavaScript/Hermes export | Passed; not an Xcode native build |

Additional seed-safety tests after the Windows fix: **2 passed** (external DATABASE_URL refusal, existing database preservation and platform-specific directory mode). Their initial temp-fixture setup hit an unrelated sandbox temp-directory permission error; the tests were made filesystem-independent and passed. The previously passing 47-test backend suite was not rerun merely for this seed-only change.

Manual browser checks included career search handoff and detail/programme links; login failure/recovery; real profile edit/refresh; saved programme persistence after re-login; Nursing plan selection; milestone completion updating 0/13 to 1/13; correct NURSING 104 details; group message send/refresh and non-member denial; Building 303 destination search/preview; camera permission gate; AR-unavailable fallback; and home-demo destinations. Not every native device layout or timing/concurrency permutation has been manually tested.

## Start on this Windows PC

Use two **normal PowerShell windows**, not Ubuntu/SSH. Stop old local preview processes with Ctrl+C in their own windows before starting duplicates. No administrator shell should be needed now.

Window 1 — backend:

```powershell
Set-Location 'C:\Avinash\Coding\Projects\team-43-project\.integration-worktree\backend'
if (!(Test-Path '.\.integration-local\integration.db')) { throw 'Seeded integration database is missing. Do not start against an empty database.' }
$env:DATABASE_URL='sqlite:///C:/Avinash/Coding/Projects/team-43-project/.integration-worktree/backend/.integration-local/integration.db'
$env:CORS_ORIGINS='http://localhost:8087,http://127.0.0.1:8087'
& 'C:\Avinash\Coding\Projects\team-43-project\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8011
```

Window 2 — frontend:

```powershell
Set-Location 'C:\Avinash\Coding\Projects\team-43-project\.integration-worktree\frontend'
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:8011'
$env:EXPO_OFFLINE='1'
node .\node_modules\expo\bin\cli start --web --localhost --port 8087
```

Open `http://localhost:8087`. Health endpoint: `http://127.0.0.1:8011/health` (expect 9 programmes).
The current dependencies are already installed. These commands use the existing Python runtime without changing the original checkout's code. Restart Metro after changing the API URL: an already-running bundle will not necessarily adopt a new shell variable.

**Do not reseed the existing database.** It is populated and the seed script intentionally refuses to overwrite it. For a fresh checkout only, with no integration.db present, unset DATABASE_URL and run `python -m scripts.seed_integration` from that checkout's backend using the installed Python environment. Never run other seed scripts against AWS for this review.

### Synthetic credentials

All three fixture accounts use password `Team43-Local-Only-2026!`:

| Email | User ID | Purpose |
| --- | --- | --- |
| alice@example.test | 1 | Saved items, journey, group owner |
| bob@example.test | 2 | Friend/group member and direct-message recipient |
| outsider@example.test | 3 | Non-member privacy checks |

Group ID **1** contains Alice and Bob. The database has 9 synthetic programmes, 14 careers, 390 milestones across 17 plans, 7 Building 303 destinations, and saved items/messages. Browser/API testing added more synthetic accounts/messages; Alice's current journey is Nursing after the pathway test. These are test fixtures, not validated academic advice or real student data. Never expose this server publicly or upload this database to production.

## Incomplete or intentionally limited

- Jay's between-campus maps, routes and ETAs are labelled examples, not live navigation.
- Career quiz, notifications, password changes, profile photos and prerequisite/course-eligibility mapping are not implemented.
- Social UI is a basic panel using numeric IDs and manual refresh. No realtime delivery, friend/group discovery, ownership transfer, moderation, blocking or production-scale pagination. Groups are public-join, not private invitation-only groups. An owner cannot leave until ownership transfer exists.
- Login tokens are memory-only; re-login is required after closing/reloading the app. Server-side saved data persists. No automatic frontend OTA deployment was added.
- Career categories are UI keyword groupings, not authoritative academic classifications. Only available catalogue data can be selected.
- Metro may show a nonfatal React Native DevTools cache warning and use its fallback. Web style deprecation warnings and Node module-type warnings do not fail tests. No unrelated global cache/permission changes were made.

## Before merging / physical-device checks

1. Review the local changes and have teammates confirm the retained UI and intended social/MVP scope. Save a reviewed commit/PR later; nothing has been merged here.
2. Use Alice/Bob/Outsider to repeat saving, logout/login, profile editing, pathway switching and message privacy. Check invalid/empty catalogue years and unavailable plans. Review narrow-phone layout, keyboard, safe areas, larger text and back navigation on the real device.
3. Build the integration checkout on the Mac in the existing custom iOS development build. Expo Go cannot validate the custom native AR module. Test camera allow/deny, valid/invalid/repeated QR scans, checkpoint handoff, marker acquisition/loss, world anchors, arrival/reset behavior, route editor persistence and background/resume. Windows bundle export does not compile or validate Swift/ARKit.
4. The localhost URLs above are **PC-browser only**. On an iPhone, 127.0.0.1 points to the phone. A separately reviewed private-LAN test configuration and matching app API URL are needed; do not point this integration at the live database just to test it.
5. Building 303 geometry is explicitly unverified. Check physical clearance, stairs/elevator accessibility and all intended routes on site. Do not treat an API route response as proof that it is safe to walk.
6. **Deployment blocker:** social integration adds tables to `app/models.py`. The current deployment installer intentionally rejects changed schema files. Plan and test an explicit additive migration with backup/restore and rollback before merging a backend change that triggers auto-deploy. Do not disable the guard to force this through. The live database may also lack the journey data required by the new UI; validate and prepare real data separately.
7. Reconcile any later main changes and your separate uncommitted `codex/verify-auto-deploy`/AR work only after review. This worktree preserved the committed indoor/QR/AR implementation from its base; it did not copy or modify your separate uncommitted changes.

Status: local integration ready for review within these limits; **not a claim of physical-device or production readiness**. No merge/deployment authorization is implied by passing tests.
