# Compass home

Home opens with a tappable compass. The needle rotates, the compass ring expands and four directions spring outward: Discover (Career Alignment, programmes and careers), Connect (Study Groups, friends and messages), My Journey (Progression) and Navigate (Wayfinder). The centre closes the menu; navigating away resets it. Android Back closes an open compass before leaving Home.

The previous Home remains as the Dashboard, with all its shortcuts retained and explicit Profile and Settings shortcuts added. Home has a labelled Dashboard button and a dashboard card; the sidebar also links Dashboard and For you. The bottom navigation now uses Home, Discover, Journey, Connect and Navigate consistently.

The layout uses safe areas, scrolls on smaller screens, respects Reduce Motion and provides additional text choices at larger system font sizes. Direction labels face outward: Discover above its icon, Connect to its left, My Journey to its right and Navigate below. The ring, icons and centre adapt on narrow phones to reserve label space. No new native dependency or backend change is required.

This branch starts from `codex/social-design-integration` (PR #30). Its social features retain the backend availability described in `TEAMMATE_SCREEN_AUDIT.md`.

Verification: TypeScript and existing screen/student/wayfinding tests; web/iOS/Android exports; browser checks at 393×852 and 320×568 for compass open/close, all four destinations, Dashboard, For you, saves, profile and settings. Native animation performance and actual device safe areas still require phone verification.

Local review uses an isolated test database. An exported local preview is not a published phone update.
