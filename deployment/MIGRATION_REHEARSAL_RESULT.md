# Approved backup and isolated migration rehearsal

## Local installer preparation (subsequent to the rehearsal)

The integration checkout now contains a hash-pinned migration-aware helper.
It accepts only the inspected old models/database code and reviewed new models
code, validates full schema DDL plus columns/indexes/foreign keys, rehearses on
a separate backup copy after the existing service-stop/backup phase, then applies
the same transaction. Unknown transitions still fail. Retry after code rollback
accepts only the exact migrated schema and preserves existing social records.
It does not replace the installed AWS helper automatically.

Six targeted migration/installer tests passed. Existing deployment/backup suite:
47 tests run, one skipped, no failures. Native systemd rollback/end-to-end
installation remains untested for this helper version. A read-only fingerprint
check against AWS confirmed production matches OLD_SCHEMA and the approved
rehearsal copy matches NEW_SCHEMA. No helper installation or deployment occurred.

Production schema: `3cafa4f41b0f147d064c6be193d965662474392eccb3504e6a73d28870c24b2b`

Rehearsed schema: `1412ad252a72bd006e4cfe8ba948774ddc83914687f0a7845c8371459e686a7b`

## Original rehearsal evidence

Subsequent local lifecycle tests: seven additional scenarios cover success,
candidate-preparation failure, rehearsal rejection, live-migration rejection,
activation failure, failed health check and failed rollback service start.
They use real temporary SQLite backups/migrations and mocked network/systemd/
Linux account calls. New writes after activation survive code rollback, backups
precede migration, and rehearsal rejection prevents live migration. Rollback
failure now reports explicit operator-recovery guidance rather than a generic
exception. These are not an actual EC2 service restart/rollback rehearsal.

Completed 2026-09-13 at 06:59:30 UTC. User approved backup creation and isolated
testing, not production migration or deployment.

- Live SQLite opened mode=ro, query_only enabled, backed up using SQLite backup API.
- Backup: `/var/lib/team43-deployment/integration-rehearsal-6q9kxyrh/production-backup.sqlite3`
- SHA256: `d13157f593cbf8c3fe8dfc42a5ba9c86cd6a9079a316078c3063691243aa5182`
- Separate restored test copy: `/var/lib/team43-deployment/integration-rehearsal-6q9kxyrh/migration-rehearsal.sqlite3`
- Candidate migration SHA256: `1283e73a07ac6e213bd40adba2de94b0ebb553dea44d2f25734cd06d032e0134`
- All 21 existing table schemas, counts and row digests preserved on the copy.
- Exactly four social tables added to the copy in a transaction.
- Full SQLite integrity check passed; zero foreign-key violations.
- Migration persisted and old-table preservation was rechecked after reopening.
- A separate in-memory partial-migration rollback preserved the original snapshot.
- Original backup rechecked unchanged; service PID/start timestamp unchanged.

This is a same-instance backup and database rehearsal, not a new off-instance
disaster recovery backup, API smoke test, or systemd/application rollback test.
Neither the production database nor live code was modified. Files retained for
review. Keep the schema guard intact until a migration-aware installer has been
implemented/tested and separately approved. A fresh backup is needed at actual
deployment time if production has changed since this rehearsal.
