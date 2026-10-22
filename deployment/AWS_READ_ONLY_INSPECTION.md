# AWS read-only inspection — 13 September 2026

User authorised inspection only. No service restart, deployment, migration,
catalogue sync, seed, account creation, backup creation or production write was
performed. SQL used mode=ro plus query_only; no account records were returned.

- Service active/running; HTTPS health healthy/connected, 9 programmes.
- Working directory identifies commit `85f5e01b3fe6d59e6c9259a4a3b535ed11761649`.
- Running process DATABASE_URL matches `/var/lib/team43/health_app_v2.db`.
- 9 programmes with substantive descriptions and official UoA page URLs.
- 43 careers; 39 distinct linked careers and 39 programme-career links.
- Four unlinked career entries: Medicine, Physiotherapy, Public Health, Research.
  Their provenance is not established. Preserve them; no cleanup was authorised.
- 390 programme milestones, catalogue year 2027, across all nine programmes.
- 7 wayfinding destinations, 8 door links, 70 locations, 71 edges.
- Users, auth sessions and user-specific profile/save/progression tables each
  contained zero rows at inspection time. Counts can change after this snapshot.
- friendships, groups, group_members and messages are absent.
- SQLite quick_check: ok; foreign_key_check: zero violations.

Installed code hashes (raw bytes):

| File | SHA256 |
| --- | --- |
| app/models.py | 4eccaff369bd708c61a3e740a158ebf9fa96cdbb123dc7541762e4a89b3e62da |
| app/database.py | 6f38172bc9879131b293d8db4c3089e6d32dcc2fa239b97f63f2f781a8d9197e |
| installed deployment helper | b26e1e7d27261ef3fbd4d95f9147961041a253581f8a080477733fa18e635758 |

This confirms the hosted catalogue/journey data exists; it does not validate its
academic freshness or the integration against a production snapshot. No reason
to replace the hosted database with the synthetic or local catalogue preview.
Next approval boundary: obtain a verified backup for an isolated rehearsal,
then finish/test the migration-aware installer before any deployment. Current
schema guard still blocks the integration. No merge/deploy approval is implied.
