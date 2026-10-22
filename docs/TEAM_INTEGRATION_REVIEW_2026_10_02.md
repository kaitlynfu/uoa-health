# Team integration review — 2 October 2026

Reviewed all six open PRs and checked older teammate branches against the current
authenticated app. They are integrated through PR 33, preserving original merge
ancestry rather than overwriting current work with older fixture-based screens.
This records review/preparation; merge confirmation is a separate GitHub result.

| PR | Reviewed work | Integration decision |
| --- | --- | --- |
| 29 — Jay | Sidebar/menu, navigation, session logout, safe-area handling | Original commit retained alongside its previous cherry-pick. Keep the newer Friends/For you entries and campus Wayfinder wrapper. |
| 30 | Adapted Kaitlyn study groups and MJ chat/friends/messages designs | Already an ancestor of 33; designs preserved and now wired to authenticated directory/inbox APIs. Old red checks were billing-related. |
| 31 | Android APK profile, package ID, mobile OTA configuration, non-iOS home AR guard | Integrated with app runtime 1.2.0 and campus native capabilities. Previously built 1.1.x APKs need a new build; native/OTA delivery is not phone-verified. |
| 32 | Animated compass, accessibility/reduced motion, Android Back, retained dashboard | Integrated with current navigation; campus directions retained in Dashboard and sidebar. Retarget to main before the coordinated merge. |
| 33 | Social APIs/UI, campus integration, migration 0004, reviewed deployment | PostgreSQL copy/production upgrade already passed with every original row preserved. Keep one migration head; no new schema revision is added by this integration. |
| 34 — Jay | Building directory/routes, estimate labels, Apple/Google Maps handoff, additive data seed | Integrated after the preservation/accessibility fixes below. Approximate building data remains labelled, not an on-site verified map. |

## Findings corrected in the integration

- The building-only seed called the general campus upsert, overwriting curated
  campus names/addresses and reactivating inactive campuses. It now creates only
  a missing City Campus and otherwise preserves existing campus records. A
  regression test checks curated and inactive records. PostgreSQL seeds no longer
  call `create_all`; schema changes remain Alembic-owned.
- Step-free requests with no outdoor graph endpoint fell through to a straight
  line estimate. They now return no step-free route rather than present an
  unverified estimate. Mapped accessible paths still work; tests cover both.
- A cancelled directions request could leave its spinner visible after switching
  to current location. The effect now clears the loading state before returning.
- Campus-directions footer/sheet now include phone bottom safe-area padding.
- Sidebar/compass conflicts could remove current Friends/For you/Dashboard links,
  revert to removed QR screens, or lose the campus-directions dashboard link.
  The integration retains the current campus flow and all of those entry points,
  and adds a combined-navigation regression test.

## Other teammate branches

The earlier `docs/TEAMMATE_SCREEN_AUDIT.md` records the adaptation of Kaitlyn and
MJ's screen layouts. Their old `frontend/career-alignment`, `frontend/chat`,
`frontend/milestone` and `wayfinder-redesign` branches are not suitable for a blind
merge: they contain old fixtures, pre-integration navigation or removals of current
backend models/schemas. `Social` is also not merged wholesale: its old service
does not retain the current group-membership protections and includes IDE files.
`kaitlynfu-patch-1` contains an old PageHeader implementation now superseded by
the current shared header. Retain these branches; do not delete team work.

The completed `codex/campus-route-editor` release records, staging/activation
helpers and their tests are also retained. They are pinned historical operators,
not commands to rerun against the current social revision 0004 database.

## Verification and release boundaries

- Combined backend: 138 passed, two skipped locally (SQLite).
- Deployment/backup tooling: 85 passed, one optional test skipped locally.
- Combined frontend: TypeScript and all portable frontend tests passed.
- Isolated two-account social frontend/backend integration passed.
- Fresh GitHub checks must pass on the final combined commit before merging.
- No production data is seeded by a merge. Existing four building records can
  serve directions; adding the eight approximate City Campus entries is a
  separate backed-up operator action, not an automatic startup operation.
- Real-phone social, compass, Maps handoff and AR behavior still need testing.
  Web/JS exports and backend tests do not certify native device behavior.
- Hold frontend publication until the matching combined backend is deployed;
  new building endpoints are not present in the currently active social release.
