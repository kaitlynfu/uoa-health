> Historical record. This document describes an earlier project state; use the [current project README](../../README.md) and [documentation index](../../docs/README.md) for supported setup and release instructions.

# Onboarding and home follow-up — 12 September 2026

- Home now uses Kaitlyn's existing `frontend/career-alignment` home design as its base, with real greeting, correct Building 303 wording, and direct programme, recommendation, saved-item and preference links.
- Registration and guest entry both open interest/career-interest onboarding. Skipping is supported. Account preferences use the existing authenticated profile API; guest preferences stay in memory and clear on reload. Logout clears in-memory preferences.
- Recommendations now call the existing personalised recommendation endpoint using profile preferences or guest preferences. Empty, loading and retry states are present. These are keyword-based suggestions, not eligibility decisions.
- Browser verified: guest entry -> interests -> home -> matching recommendations; new synthetic account -> onboarding -> save -> home -> reopen and refetch saved preferences. Home layout visually inspected on desktop browser. Physical iPhone/keyboard testing remains outstanding.
- TypeScript passed; 9 frontend API/QR tests passed; web export passed; 2 new backend onboarding/recommendation tests passed in an in-memory database.
- Local catalogue is no longer synthetic: programme/career tables were imported read-only from the original local scraped database via `backend/scripts/import_local_catalogue.py`. Nine programmes, 39 careers and 39 links. Test users, messages and progress remain synthetic. A recovery copy was saved before catalogue replacement; obsolete synthetic career saves were removed, while programme saves and journeys were retained.
- No AWS changes, original-worktree changes, merge or deployment.
