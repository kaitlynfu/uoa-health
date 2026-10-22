# App readiness audit — 2 October 2026

The combined release is deployed and ready for structured device testing. That
does not mean every screen or planned feature is finished. This audit separates
release completion, confirmed gaps, and checks requiring a device or AWS access.

Reviewed main: `a73c53ccc63b657a5d3b3c288589767856cc0ff0`. The reviewed worktree
at `e5de089` has the same tracked file contents as this main commit. This report
is local documentation; no application code, production data, or settings were
changed during the audit.

## Confirmed complete

- GitHub currently has no open PRs or issues. PRs 29–34 are merged; original team
  commits were preserved by the preceding integration.
- The combined backend deployed successfully, including backend/PostgreSQL checks:
  [release run](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36937877672).
- The matching iOS/Android JavaScript update was published successfully:
  [frontend run](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36938240456).
- Automatic backend deployment and frontend publication are enabled. PostgreSQL
  backup selection and daily backups are enabled. Public HTTPS health currently
  reports healthy, database connected, and nine programmes.
- The most recent scheduled backup workflow succeeded on 2 October NZ time:
  [scheduled run](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36877704257).
  A later [manual backup](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project/actions/runs/36930636639)
  has an explicitly successful S3 backup job, not merely successful tooling tests.
- All five requested social capabilities have implementations and frontend
  connections: user/friend/request lists, group discovery/memberships, named inbox,
  creation fields/bookmarks, and per-user unread tracking. Automated verification
  already passed; actual phone behaviour remains unverified.
- Registration/login, profile editing, saves, catalogue browsing, keyword
  recommendations, journey selection/change, and progress tracking are implemented.
- PostgreSQL migration 0004 is complete. No further migration is identified for
  this release. Building-list and building-route public smoke checks passed after
  deployment. Four existing buildings are available; additional seed data was not
  inserted during release.

## Fix before calling the demo polished

| Priority | Finding | Concrete follow-up |
| --- | --- | --- |
| High | Dependency advisories affect pinned packages. | Prepare compatible dependency updates and test them before another release. Details below; no automatic fixes were applied. |
| Medium | Groups landing screen still says group discovery is unavailable and directs users to IDs, despite the functioning search/directory screens. | Update `frontend/screens/study-groups/StudyGroupScreen.tsx:8` and its group/friend tile descriptions. Popularity/activity ranking is still absent, but ordinary group discovery exists. |
| Medium | Chat still displays `User #id` / `Group #id`, numeric sender labels, and raw timestamps. Inbox names are implemented. | Resolve/display conversation and sender names and format dates in `frontend/screens/study-groups/ChatScreen.tsx:54`. |
| Medium | Current setup instructions can send someone back to an older branch. | Update `docs/CAMPUS_WAYFINDING_SURVEY.md:30` to use the integrated main; update historical release/status documents that still describe PR 33 as unmerged and deployment as paused. |
| Medium | Original Windows checkout remains on old `codex/verify-auto-deploy`, with 26 modified/deleted tracked files and untracked files/worktrees. | Preserve and compare those edits before consolidating local work. Do not reset, delete, or blindly commit them. This is distinct from the clean deployed integration. |

## Required device and campus work

1. Build/install native app version 1.2.0 on the iPhone and prepare an Android
   tester APK if Android is part of the demo. The published update is JavaScript;
   it cannot add new native AR methods to an older installation.
2. Test two different accounts through search, friend request/accept/reject,
   group create/search/join/leave/save, direct/group messages, and unread counts.
   Include sign-out/account switching, refresh, keyboard visibility, and network
   failure. Check profile/saves/journey progress persist after signing in again.
3. Confirm an installed 1.2.0 app receives the published update and works away
   from the development computer. Check compass navigation and external Maps
   handoff on both supported platforms.
4. Survey short Building 303 routes in person, record each floor, publish the
   verified route, and test recognition as an ordinary account on a second iPhone.
   Deployment does not create those recordings. The last migration snapshot had
   zero published campus routes; the current private catalogue was not queried
   with an account during this audit.
5. Test tracking loss, failed recognition, floor transitions and failed uploads.
   The route editor and backend exist, but a native compile and physical route
   validation are not established by JavaScript exports or API tests.

`docs/CAMPUS_WAYFINDING_SURVEY.md` contains the detailed acceptance checklist,
but its checkout/release-status instructions need the correction above. Campus
AR currently supports iPhone only; Android recognition is additional development,
not a switch to enable. Outdoor building directions use the phone's Maps app.

## Confirmed feature gaps — scope decisions, not all demo blockers

| Area | Current limitation | Work needed if included in the product |
| --- | --- | --- |
| Password management | Change Password fields are disabled; no reset, change-password, or email verification endpoints. | Implement authenticated password change and a verified recovery flow. Source: `frontend/screens/settings/ChangePasswordScreen.tsx:36`, `backend/app/routers/auth.py`. |
| Session convenience | Auth lives only in React state; a cold start requires sign-in again. | Add secure session persistence/restoration and expiry handling if staying signed in is desired. Source: `frontend/context/SessionContext.tsx:8`. |
| Notifications | Bell and notification settings are reachable but explicitly unimplemented. | Add an actual notification inbox/delivery/preferences, or remove unfinished entry points from the demo scope. Sources: `frontend/screens/notifications/NotificationsScreen.tsx`, `frontend/screens/settings/NotificationSettingsScreen.tsx:35`. |
| Live chat | Messages refresh on focus, after sending, or manually. No polling/subscription or push delivery. | Add live refresh if real-time chat is expected. Source: `frontend/screens/study-groups/ChatScreen.tsx:57`. |
| Chat history at scale | Conversation endpoints load all messages in one query/response. Inbox and directory pagination already exist. | Add bounded message pagination and appropriate message-query indexes before larger usage. Source: `backend/app/services/social_service.py`, `backend/app/models.py`. |
| Social controls | No blocking/reporting/moderation; a direct message only requires an existing recipient. Groups are public-join, owners cannot leave, and there is no ownership transfer/group editing/deletion flow. | Define messaging permissions and implement the needed controls before opening social features to a broad audience. Source: `backend/app/services/social_service.py`, `backend/app/routers/social.py`. |
| Peer matching | No shared-interest/mutual-friend suggestions or matching algorithm. | Implement if it is part of the agreed peer-to-peer scope; basic search and chat are already available. Source: `frontend/screens/study-groups/MessagesScreen.tsx:19`. |
| Career quiz | Reachable placeholder with no questions or scoring. Keyword-based recommendations already work separately. | Build the agreed quiz or omit its unfinished entry point. Source: `frontend/screens/career-alignment/QuizScreen.tsx:5`. |
| Course map | Shows a real milestone but no prerequisites/unlock graph. Progress is self-reported, not verified enrolment. | Add verified prerequisite data and eligibility rules only if that feature is promised. Source: `frontend/screens/MapCourseScreen.tsx:59` and `:93`. |
| Catalogue/maps coverage | Nine programmes and four live buildings; indoor graph/extra building seed includes demonstration or approximate data. | Agree demo coverage, validate catalogue/pathway data and map locations; add buildings only through the reviewed data-update process. |
| Profile/support | No profile photo upload or in-app support submission. Privacy text is generic; no account deletion/export flow. | Decide what the client needs before wider release and align the user-facing privacy/support information with actual behaviour. |
| Google sign-in | Not implemented. | Previously deferred by the user; it does not block testing email/password accounts. |

The old Trip ETA screen is a labelled mock and remains registered, but no current
screen navigation call to it was found. It is cleanup work, not evidence that the
new Campus directions flow uses mock ETAs.

## Dependency findings

- `npm audit --omit=dev` reports **14 affected package entries: one high and 13
  moderate**. These are not 14 independent exploitable issues; transitive entries
  can share an underlying advisory.
- The high entry is `brace-expansion` 5.0.9, present in the lockfile and reached
  through `minimatch` / Expo build tooling. An untrusted expansion pattern can
  exhaust the stack. This audit did not establish an exposed in-app input path.
  [Maintainer advisory](https://github.com/advisories/GHSA-qhr7-859c-m2p7).
- Some npm suggestions propose a major Expo downgrade. Do not apply
  `npm audit fix --force`; resolve compatible packages and validate the build.
- PyPI vulnerability metadata was checked for all 26 pinned backend requirements.
  Two packages have published advisories: `urllib3==2.7.0` and `pytest==8.4.2`.
  Metadata lists fixes in urllib3 2.8.0 and pytest 9.0.3. Pytest is test tooling;
  it currently shares the backend requirements file. Compatibility still needs
  checking before updates.
- urllib3 advisories cover [HTTPS proxy TLS configuration](https://github.com/advisories/GHSA-8988-9cw3-xx77),
  [chunked deflate streaming](https://github.com/advisories/GHSA-gh4c-6fx4-qh6g), and
  [unbounded chunk-size buffering](https://github.com/advisories/GHSA-vxq7-64xx-v4gw).
  The [pytest advisory](https://github.com/advisories/GHSA-6w46-j5rx-g56g) concerns
  temporary-directory handling. Finding a dependency advisory does not establish
  that the deployed app is exploitable under its current inputs/configuration.
- This checks repository pins/lockfile and public advisory metadata, not every
  resolved server dependency or OS package. It is not a penetration test.

## Operations and release follow-up

- The code has no application-level login/request throttling. Host-level limits
  were not inspected in this audit. Add/verify abuse controls for wider usage.
- Repository backup documentation explicitly leaves independent missed-backup
  monitoring and notification delivery unverified. Establish a team owner and
  confirm alert delivery; a successful backup alone does not test alerts.
- EC2 disk/memory, OS updates, restart recovery, certificate renewal automation,
  CloudWatch alarms and current AWS permissions were not directly re-inspected.
  Current HTTPS health is verified; those host settings are unknown, not claimed
  broken. A short read-only AWS review can cover them separately.
- Frontend checks run in the publication workflow after a push to main. Add a
  PR-time frontend check, and coordinate backend/frontend rollout ordering for
  future changes that require new APIs. Current matching releases succeeded.
- The classic branch-protection API returned 404; this does not establish whether
  organization rulesets protect main. No branch-protection settings were changed.
- Keep retained migration backups/recovery databases until an exact inventory and
  retention decision. They are not unfinished schema migration work.

## Recommended sequence

1. Fix misleading Groups text, chat identity/date presentation, stale setup docs,
   and compatible dependency advisories in a focused maintenance change.
2. Build matching phones and complete the two-account/device checklist.
3. Survey and publish the small campus route needed for the demonstration.
4. Prioritize account recovery, social controls, notifications/live refresh and
   the remaining promised features with the client. Google login can remain deferred.

No new failing runtime test was observed in this audit. Previous passing suites
were not rerun without code changes. The audit covers code, navigation, current
GitHub/API state and dependency metadata; hands-on phone behaviour and private
AWS configuration remain explicit limits.
