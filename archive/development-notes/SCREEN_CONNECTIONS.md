> Historical record. This document describes an earlier project state; use the [current project README](../../README.md) and [documentation index](../../docs/README.md) for supported setup and release instructions.

# Teammate screen integration

Working branch: `codex/connect-teammate-screens`, based on main `bb79f0b`, combined with scan-free recognition in `31b53e7`.

## Connected entry points

- Profile opens Settings, Edit Interests and Edit Career Interests. The separate editors persist only the edited field through the existing profile API; guests retain session preferences.
- Settings opens Edit Profile, Change Password, Notification Settings, Privacy, About and Help.
- Header menu opens the teammate sidebar, with working destinations including Friends and Messages. The bell opens Notifications.
- Groups opens the group hub, group-by-ID lookup, study-plan courses, group creation, membership guidance, Friends and Messages. Existing social tools remain accessible.
- Group creation opens its details; joining/leaving and group chat use existing social endpoints. Friend requests, acceptance, removal and direct chat use existing endpoints. Destructive membership actions ask for confirmation.
- Courses displays actual journey milestones and links to Map Course. It does not claim these are enrolled courses.
- Quiz opens a clearly labelled unavailable screen with links to the existing preferences and recommendations flow.

## Deliberate limits

The teammate branch contained sample conversations, people and groups. These are not presented as real data. The existing backend has no group/friend directory, incoming-request inbox, unread counts, push preferences, password-change endpoint or quiz scoring. Those unsupported features are explained or disabled. Messages refresh manually. No backend/social business rules were changed.

Settings, profile-editor and sidebar presentation was adapted from `origin/frontend/milestone`. New social adapters use the established teal styling and existing APIs rather than mock data. Current main's working home, programme, progression, authentication and wayfinding screens were retained.

## Verification

- TypeScript check passed.
- Screen/navigation/API contract tests: 8 passed.
- Student API/checkpoint tests: 9 passed.
- Existing main wayfinding tests: 34 passed.
- Backend social/profile/onboarding tests: 10 passed.
- Local API integration scenario passed.
- Web and iOS JavaScript exports passed; no native iPhone build was performed on Windows.
- Browser checked against an isolated synthetic local database: sign-in, group creation, group message send, profile interest save, settings/password availability, sidebar and friend request.
- Latest inline leave/remove confirmations were type-checked; physical-device touch/layout testing remains necessary.

## Release boundary

The combined branch was pushed and built on a Mac. The user confirmed screens and scan-free recognition work on a physical iPhone (22 September). No AWS or production database changes were made for this integration. The original checkout remains untouched.

The scan-free branch at `ca0b5d2` is included, with runtime 1.1.0. The combined baseline passed 59 frontend tests and TypeScript; the reported full backend result was 95 passed and 2 skipped. Recognition worked after re-recording the environment; persistence across installs remains an optional investigation.

24 September phone fixes: keyboard avoidance on login, safe-area protection for custom headers (including progression/settings/preference editors), larger header touch targets, flexible home-card text, and spaced entry requirements retaining source wording. These latest fixes still require physical iPhone verification. Four additional layout/source-preservation regression tests were added.

Main merges affecting the frontend trigger the configured preview Expo publication. Only compatible runtime 1.1.0 apps can receive this update; older native builds need rebuilding. Local test exports used localhost and are not release artifacts. CI exports afresh with the deployed API address before publishing.

Dependency installation reported 14 moderate advisories; dependency upgrades were outside this integration's scope.
