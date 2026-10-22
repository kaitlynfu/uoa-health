> Historical record. This document describes an earlier project state; use the [current project README](../../README.md) and [documentation index](../../docs/README.md) for supported setup and release instructions.

# Integration merge readiness — 12 September 2026

Status: local automated checks pass; release gates below remain open. Do not merge with automatic production deployment enabled until the migration path is approved.

## Fresh verification

- Backend: 51 pytest tests passed.
- Frontend: TypeScript passed; 35 unit/regression tests passed, plus the separately enabled live loopback API integration test passed (36 total).
- Deployment/backup tools: 47 tests passed without AWS calls.
- Web, iOS and Android JavaScript/Hermes exports passed. These are not native Xcode/Android builds or physical-device tests. Export artifacts contain local preview configuration and must not be distributed as production builds.
- The live integration test covered new synthetic accounts, profile/preferences, saved items, journeys, milestone completion, social membership/privacy, 21 indoor routes, accessible routing, rejected disconnected routes and logout revocation.
- Local schema rehearsal passed using an in-memory copy of the original local database opened read-only: exactly four new tables, existing schemas and row digests unchanged, integrity and foreign-key checks passed.

## Database release gate

New tables: friendships, groups, group_members, messages. Existing model declarations are unchanged apart from additional imports and these definitions. The deployed installer compares models.py/database.py text and intentionally rejects the changed model file before release activation.

Do not evade that guard by moving model definitions or simply removing the comparison. The rehearsal only establishes compatibility with the local snapshot, not current AWS state.

Before deployment, an authorised operator must:

1. Confirm the current deployed commit and database schema, and obtain a fresh verified backup and restore rehearsal.
2. Review an explicit additive migration against a staging copy of the current production schema, including concurrent-access and rollback handling.
3. Approve and install a migration-aware deployment path that recognises this exact reviewed schema transition and still rejects unknown/destructive changes. Updating the repository installer alone does not update the already installed AWS helper.
4. Deploy during an approved window, verify old data counts/integrity, authenticate, read programme/career data, and smoke-test the new tables.
5. On failure, roll back application code. Do not casually restore an old database over new user writes; retain additive tables unless an explicitly reviewed recovery requires otherwise.

Alternative for an earlier code-only merge: explicitly pause automatic backend deployment first, merge only after review/device checks, then schedule the approved migration separately. This requires user approval and a repository setting change; neither has been performed.

## Device/review gate

- Install this integration branch on the physical iPhone, not the existing main build.
- Verify login/new-account/guest flows, keyboard access to submit/skip, saved preferences, programme tabs, recommendations and stage selection on a small screen.
- Verify camera permission denial/recovery, QR scan, Building 303 start/destination and AR alignment/arrival. Native capabilities cannot be certified by bundle export.
- Teammate review of integrated screens and social scope; study-group functionality is intentionally not expanded.
- Review the complete uncommitted diff and ensure local databases, recovery files, credentials, node_modules and exports are not included in the eventual commit.

## Known non-blocking MVP limitations to accept explicitly

Session-only sign-in and guest preferences; keyword-based suggestions; manually refreshed basic social messaging; between-campus/quiz/notification placeholders. The social visual refactor remains partial and is not described as complete. No secure session persistence or new social features were added in this pass.

No merge, deployment, AWS access or original-worktree modification was performed. The integration branch remains uncommitted for review.
