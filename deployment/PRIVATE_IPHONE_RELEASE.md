# Private one-tap iPhone release — preparation, not deployment approval

## Current decision

The user has deferred AR alignment/tracking and Building 303 walking validation
until after private standalone installation. These remain unverified; this is
not a release for public navigation use. QR/camera testing also remains open.
User reports catalogue, profile, saves, recommendations and progression working
on the development iPhone build, including the updated Edit Profile screen.

## Backend gate (do not run a production migration yet)

Reuse the existing EC2 service, HTTPS API and persistent SQLite database.
The integration adds friendships, groups, group_members and messages.
`migrations/001_social.sql` is the explicit candidate DDL, with no user/catalogue
seeding and no destructive changes. It is NOT wired into deployment or startup.
The existing schema-file comparison remains unchanged and rejects this release.

Before a production-facing step, obtain user approval for read-only inspection
of the current deployed commit, schema, catalogue counts and journey/plan data.
Do not assume the local September catalogue is newer than production. Do not
upload catalogue-preview.db, integration.db or their synthetic accounts.

Then obtain a fresh backup and verify recovery into an isolated staging copy.
Rehearse the exact DDL there and compare all old schema definitions, row counts,
row digests, foreign keys and integrity before/after. Check the full API against
that copy: additive social tables alone do not guarantee journey data exists.
If any target table already exists or differs, stop and review; do not use
IF NOT EXISTS to hide drift. All four tables must be applied in one transaction.

Only after approval: implement/test a migration-aware installer recognising the
exact reviewed old/new schema-file hashes and schema transition, while rejecting
unknown changes. Updating a repository helper does not update the installed
root-owned EC2 helper. Preserve deployment locking, backup, candidate tests,
service stop/start, health checks and code rollback. On failure retain the DB;
never replace it with an old backup over potentially new user writes.

Before merging, explicitly approve and pause TEAM43_AUTO_DEPLOY, or finish and
approve the migration-aware path first. No variable was changed here. Manual
workflow_dispatch still deploys even when the variable is false: do not run it.

## Private native release (only after compatible backend approval/deployment)

On the Mac, first transfer/review the exact final integration commit, preserving
Mac local files and native signing configuration. Do not blindly reset or clean
the existing worktree. Native dependencies and the custom AR module remain.
Do not run prebuild --clean over the current signed iOS project.

From that checkout's frontend folder:

```bash
node scripts/private-ios-release.mjs
# AFTER backend readiness and permission to install the private build:
node scripts/private-ios-release.mjs --build
```

The first command only describes the target. The second builds/installs on a
selected physical device, uses Release and no persistent Metro server, pins the
existing HTTPS endpoint and disables local dotenv loading to avoid embedding a
Mac LAN URL. No EAS upload, TestFlight upload or App Store submission is added.
Keep the existing bundle ID and Personal Team signing. The same bundle ID may
replace the development installation. Export/inspect any device-only route
drafts before installation; do not delete the old app to fix a build problem.

Xcode must still successfully sign and compile the native release. Check the
display name in the existing native target: app.json changes alone do not update
an already-generated native project. Use Student Compass as the desired label.
This Windows preparation has not compiled Swift or installed an iOS release.

## Acceptance on the phone

1. Confirm actual Release build, not the Expo development launcher.
2. Stop Metro and local uvicorn, disconnect USB, switch Mac off.
3. Turn Wi-Fi off on the phone and open over mobile data.
4. Check programme/career reads, login with an approved real account, save/reopen,
   recommendations, profile, progression and authorised social smoke checks.
   Do not use Alice/Bob fixture credentials against production.
5. Force quit/reopen. Memory-only authentication currently requires login again;
   one-tap launch does not promise persistent login or offline data.
6. Deny/re-enable camera permissions and check QR flow. Schedule deferred on-site
   AR/route validation. Prototype entry points are intentionally retained.

Personal Team signing still expires after seven days; a release bundle removes
the development-server requirement, not signing renewal. Choose a suitable
Apple distribution route later if recurring signing is unacceptable.

Sources: https://docs.expo.dev/more/expo-cli/
https://docs.expo.dev/guides/environment-variables/
https://developer.apple.com/help/account/basics/about-your-developer-account
