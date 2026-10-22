# Complete social integration (backend live; phone checks pending)

All five requested social features are implemented: user search and friend
requests, group discovery and membership lists, inbox, additional creation fields
and saved groups, and per-user unread tracking. Frontend screens use the real
endpoints with authentication, paging, refresh and visible errors. Existing social
screen layouts are preserved. New read endpoints live in `social_directory.py`
and inbox/bookmark/read-state endpoints in `social_inbox.py`.
Register inbox routes before directory routes, then the existing social router,
so static paths such as `/groups/saved` cannot be captured by `/groups/{id}`.

## Frontend contract

All endpoints require the existing Bearer token. Never send a caller user ID.

- `GET /social/users?q=alex&limit=50&offset=0`: search display names (at least
  two non-space characters), excluding yourself. Returns `id`, `display_name`
  and `connection`: `none`, `incoming`, `outgoing`, or `friend`. Emails are not
  searchable or returned. `%` and `_` are treated as literal characters.
- `GET /social/friends`: caller's accepted connections, each with friendship
  `id`, `created_at` and nested `user` name/ID/connection.
- `GET /social/friends/requests?direction=incoming` (or `outgoing`): caller's
  pending requests. Both lists accept `limit` and `offset`.
- Existing `POST /social/friends/request` takes `{"friend_id":123}`;
  `POST /social/friends/{friend_id}/accept` accepts incoming only;
  `DELETE /social/friends/{friend_id}` removes a friendship, rejects an incoming
  request, or cancels an outgoing request. Here `friend_id` means the other
  user's ID, NOT the friendship row ID.
- `GET /social/groups`: authenticated public-group directory. Optional filters
  `q` (name/description/course), `course`, `study_format` and `limit`/`offset`.
  Entries include metadata plus `member_count`, caller's `joined`, `saved` and
  `role` (`admin`, `member` or null).
- `GET /social/groups/joined`: caller's current memberships, same summary shape.
- `GET /social/groups/{id}`: group summary and caller's flags.
- `GET /social/groups/{id}/members`: current members only; paginated user
  names/IDs, roles and join dates. Returns 403 to non-members.
- Existing `POST /social/groups/{id}/join` and
  `DELETE /social/groups/{id}/leave` are wired. Creators are admins and cannot
  leave without ownership-transfer support (not added).
- `POST /social/groups`: existing `name` (max 100), plus optional `course` (100),
  `description` (2000), `location` (200), `group_type`, `study_format`, and
  `preferred_days`. Responses include all fields. Types and allowed values are
  in `GroupCreate`/OpenAPI, matching the frontend design chips. Days are unique
  Mon–Sun strings. Unknown fields are rejected rather than silently discarded.
  Groups remain public-join. No private invitation or scheduling semantics added.
- `GET /social/groups/saved?limit=50&offset=0`: caller's bookmarked group details.
- `GET /social/groups/{id}/metadata`: authenticated public-join group metadata;
  retained as a compatibility endpoint; does not grant message access.
- `PUT /social/groups/{id}/saved` and `DELETE` at the same path: idempotent 204.
  A bookmark is not membership and grants no message access.
- `GET /social/messages/inbox?limit=50&offset=0`: conversations with messages,
  ordered by latest message ID descending; max limit 100. Each entry includes
  `kind` (direct/group), `target_id`, `name`, `last_message` (existing message
  shape), and `unread_count`. No emails or unrelated conversations are returned.
  Group conversations require current membership. Empty groups are not inbox entries.
- `POST /social/messages/{kind}/{target_id}/read`, body
  `{"through_message_id":123}`: acknowledge messages through an actual loaded
  message in that conversation. Returns 204, repeat-safe. Call only after the
  messages have been displayed while the conversation is focused. A later message
  remains unread. Loading messages does not itself mark them read.

Counts exclude your own messages. Group reads are per member; leaving hides the
conversation and blocks reads. Joining retains the existing full-history policy,
so previously unseen historical messages start unread. This is inbox read state,
not sender-visible read receipts, push notifications or real-time delivery.
Frontend includes Friends/Incoming/Outgoing/Search tabs, group filters and joined
groups, member lists, join/leave/save actions, editable creation fields, inbox and
visible-message read acknowledgements while the app is active. Lists refresh on
focus and can be refreshed manually. Errors are not treated as empty lists.
ID entry remains as an optional fallback, not the required social workflow.
Recommendations, files, live activity, push notifications, moderation and private
group invitations are outside this change; unsupported UI is labelled clearly.

## Local verification

Backend tests cover caller isolation, names-only search, friend request direction,
group membership and filters, bookmarks and unread boundaries. The additive
revision is tested on populated legacy SQLite tables. Frontend checks include
TypeScript, existing screen/navigation/session tests and social request contracts.
An opt-in integration test starts an isolated local backend and exercises the
frontend service calls end-to-end with two accounts, never production:

```powershell
# From frontend; point these at your disposable backend test environment.
$env:SOCIAL_TEST_BACKEND = 'C:\path\to\repo\backend'
$env:SOCIAL_TEST_PYTHON = 'C:\path\to\repo\backend\.venv\Scripts\python.exe'
node --experimental-strip-types --test tests/social.integration.test.mjs
```

These checks do not substitute for the PostgreSQL release rehearsal or testing
the actual phone UI. No local PostgreSQL server was available during implementation.
On 2026-10-02, fresh GitHub PostgreSQL checks, backend tests and backup tooling
passed for the corrected combined candidate and activation tooling at `7c3d115`.
The production-copy rehearsal and guarded production activation also passed.
Actual on-phone social testing remains pending.

The operator then confirmed the live campus-prep release `bdafd6a` already uses
campus migration 0003. This branch now includes that exact release and keeps its
campus model/router/frontend. The SOCIAL migration is 0004, after campus 0003;
older social-only 0003 artifacts must NOT be used. The corrected candidate was
rehearsed from the current production copy, not an old 0002 dump. See
`deployment/SOCIAL_RELEASE.md` for retained backup/restore evidence and the
successful production activation receipt for backend commit `3d25ecb`.

## Production-copy rehearsal

Restore a fresh consistent production dump into a NEW database named
`team43_social_rehearsal`, owned by ubuntu. Keep the dump private and never use
`--clean` against production. Check that the restored Alembic revision is campus 0003.
Install the exact candidate backend in its own virtual environment. As ubuntu,
from that candidate's backend folder, run:

```sh
DATABASE_URL='postgresql+psycopg://ubuntu@/team43_social_rehearsal?host=/var/run/postgresql' \
  .venv/bin/python -m scripts.rehearse_social_postgres
```

The script refuses production, remote connections and unexpected revisions.
It upgrades only the restored copy, runs `alembic check`, and compares every
original row across every original column, including groups and messages.
It verifies empty new tables and reviewed defaults for existing groups. It never
creates/drops databases, restores a dump, seeds data or connects to `team43`.
It reports counts, not personal data. Do not run the destructive pytest suite
against this preservation copy; use a different disposable `_test` database.

## Migration and release safety

Revision 0004 adds defaulted group columns, `saved_groups`, and `message_reads`.
Existing data is retained. Existing messages begin unread. Downgrade removes
new group metadata, bookmarks and read state: never run it casually on production.
SQLite create_all does not update existing tables; use a reviewed Alembic upgrade
for a revision-tracked local database, or a new disposable local database.

Do not merge with auto-deploy enabled expecting schema deployment to work: the
installed PostgreSQL schema guard intentionally rejects this change. Coordinate
with the teammate's revisions to avoid conflicting migration heads. Before release:

1. Restore current production backup to a disposable PostgreSQL database.
2. Test upgrade from campus 0003 to social 0004, `alembic check`, backend tests and two-account app flows.
3. Resolve GitHub Actions billing or arrange an authorised equivalent verification.
4. Pause auto-deploy, back up production and use the reviewed schema-change release
   process with the exact tested code. Do not disable the schema guard or seed data.
5. Verify health, messaging, group details/bookmarks and read isolation before
   resuming deployment automation. Keep the previous release and backup.

The backend is now live at social revision 0004. All existing data was preserved.
PR 33 is merged into main (`a73c53c`) and the matching backend and frontend
releases succeeded in runs `36937877672` and `36938240456`. Automatic backend
deployment and frontend publication are enabled. The fresh private S3 backup
completed successfully in run `36930636639`. Hands-on two-account phone testing
still remains. New readiness changes require the separate 0005 procedure in
`APP_READINESS_FIXES.md`; do not treat this historical 0004 release as approval
to migrate 0005 automatically.
