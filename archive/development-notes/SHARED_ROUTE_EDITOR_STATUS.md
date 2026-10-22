> Historical record. This document describes an earlier project state; use the [current project README](../../README.md) and [documentation index](../../docs/README.md) for supported setup and release instructions.

# Shared route editor — local implementation, not deployed

Branch: `codex/shared-route-editor`. Home-only release: PR checks and merge are pending; Building 303 AR is not included as a finished feature.

## Implemented

- Home-marker routes: public latest-version reads, editor-only publication and history.
- Append-only revisions; stale publication returns 409 without replacing the current version.
- Server validates marker, fixed start, destination identity, unique point IDs, finite bounded coordinates and minimum separation.
- Account-ID allowlist (`TEAM43_ROUTE_EDITOR_USER_IDS`) defaults to denying everyone. Registration/profile input cannot grant access.
- Home screen fetches a route before opening its camera. Active navigation uses a snapshot, not live geometry updates.
- Separate local Save & test and confirmed Publish actions. Existing phone drafts are preserved and loaded explicitly.
- Delete intermediate arrow, Undo, load local draft and load previous publication as a draft. Recovery is a new publication, not history deletion.
- Release native module permits local persistence; server authorisation protects publication. Requires a new native iOS build.

## Not done / release blockers

- Home session reuse is now connected: Change destination keeps the native AR view and existing alignment. Route geometry is not recentered on the camera. Switching pauses arrows/progression while fetching, joins only a nearby existing segment, and requires realignment if tracking was lost. TypeScript and 17 focused geometry/marker/session tests passed. Physical testing remains outstanding.
- Building 303 has a tested coordinate adapter, but it is not a connected AR camera/editor yet. Its floor-transition UI is not implemented. Home developer manual alignment is implemented using a measured camera height; it still requires standing at the known start with the agreed heading.

- Building 303 editor is NOT connected. Its existing routing/QR/camera implementation is unchanged. Home coordinates cannot be published into that system.
- `002_shared_home_routes.sql` and the hash-pinned installer transition are locally tested. After explicit user approval, the AWS backup/copy rehearsal passed: all 25 existing tables and row digests were preserved, and the new table was added on the rehearsal copy only. The migration was also retried successfully. The user then approved live rollout and account-specific editor access.
- Private AWS backup: `/var/lib/team43-deployment/home-routes-rehearsal-ryviqwiq/backup.sqlite3`. Rehearsal: `/var/lib/team43-deployment/home-routes-rehearsal-ryviqwiq/rehearsal.sqlite3`. These are on-host private copies, not a tested off-host restore.
- The tested AWS helper is installed: SHA256 `0682c65e920116214f1c2f67e2fa95121c9ce74adb9c5ee7b00755ec47b152ae`. Previous helper preserved at `/var/lib/team43-deployment/home-release-helper-tywrx1vg/previous-helper`.
- Prepared `/etc/systemd/system/team43-api.service.d/60-team43-route-editors.conf` for account ID 1 only. It applies on the next deployment restart. No live database migration, daemon reload or service restart was performed during preparation.
- Read-only AWS inspection confirmed `test@example.test` is account ID 1, the service is active, and the deployed model matches the reviewed social baseline. Account identity was checked again before preparing the permission configuration. Do not create a replacement account.
- Native Swift compilation, on-device controls, tracking, physical clearance and two-device publication tests remain necessary. JavaScript export does not validate native compilation.
- Internet/API availability is required to start a shared session. A failed read stops session startup rather than silently navigating an old route.
- Publishing records persist in the backend database. Local drafts are device-local and not cloud-synced.

## Tests in this change

- Backend: 90 passed, one opt-in live harness skipped in the general run. The live harness was run separately and passed both Node integration flows against a fresh loopback-only seeded database.
- Frontend: 45 passed, two opt-in live tests skipped in the general run (both passed through the separate live harness). TypeScript and the updated iOS JavaScript export passed.
- Deployment tooling: 47 run, one skipped, no failures. This does not substitute for native compilation or physical iPhone tests.
- Historical social migration tests exclude the later home-route table when reconstructing the original schema; production schema fingerprints were not weakened.

## Device acceptance checklist after approved deployment/build

1. Ordinary and guest users must not see editor controls. Authorised account sees them after marker alignment.
2. Add/move/delete an intermediate arrow, Undo, save on phone and re-scan. Another device must remain unchanged before publication.
3. Publish, then start a fresh session on another device. Confirm the revision geometry loads; an already-running session must not change.
4. Two editors load the same revision; after one publishes, the other's publication must conflict and retain its draft.
5. Load an earlier publication, inspect it, publish recovery, and confirm history remains.
6. Denied permission, network failure and tracking loss must not claim success or erase drafts.
7. Check the HOME START marker, printed scale and walkable segments physically. Home checks do not validate Building 303.
