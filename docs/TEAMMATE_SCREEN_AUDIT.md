# Teammate screen audit — 26 September 2026

Base: main `4308e9d`. Integration branch: `codex/social-design-integration`.

## Branch coverage

| Source | Result |
| --- | --- |
| `frontend/sidebar` / `f8c31c5` (Jay) | Cherry-picked as `db9c82d`; restored the Friends link alongside Messages. |
| `frontend/career-alignment` / `140253d` (Kaitlyn) | Existing career routes were connected. Adapted study-group hierarchy, pastel tiles, create-group fields, detail sections and Joined/Saved tabs into the authenticated screens. |
| `frontend/chat` / `b309500`, `frontend/milestone` / `8618bd1` (MJ) | Existing profile/settings/milestone routes retained. Adapted friends/messages sections and chat bubble/composer layout while retaining real API reads/writes. |
| `frontend/EXPLORER` / `f9f340f` | Already included in main. |
| `wayfinder-redesign` / `69a9b1d` | FindRoute/TripETA already connected; scan-free AR implementation retained. |
| `Social` / `762aed5` | Not merged wholesale: latest change is a gitignore typo; older code would remove current group-membership checks. |

Teammates do not need to recommit these screens on a single branch. The branch code is available. Old fixture-based screens were not copied wholesale over working authenticated implementations.

## Connected versus fully functional

Groups, All Groups, Create Group, Group Details, My Groups, Friends, Messages and Chat are reachable. Existing create/join/leave, friend request/accept/remove, and direct/group messaging operations retain their backend contracts.

The current backend does **not** provide group discovery, membership directories, saved groups, group metadata, member/activity lists, friend/request directories, conversation directories, unread counts or suggestions. These parts are explicitly unavailable, not fake populated lists or misleading empty inboxes. Only the supported group-name field is submitted; unsupported metadata fields are disabled. Backend expansion remains separate teammate work.

## Verification

- TypeScript check and screen/student/wayfinding tests passed.
- Web and iOS JavaScript exports succeeded (local test API configuration; not a release).
- Browser smoke check: sign in with isolated local account → Groups → Messages → group conversation; existing persisted message loaded and a new test message saved and rendered.
- Physical iPhone safe-area/keyboard behaviour still requires device testing after delivery.
- No production data, backend deployment, or Expo publication changed in this integration.
