# Kaitlyn frontend integration review — 10 October 2026

Reviewed and merged `origin/frontend/updates` at `f66f508d6e4babdbf8183f6a510dc3e2ec32a3f7` into the local integration branch `codex/main-review-fixes`.

## Included

- Refreshed shared title cards and career/programme layouts, saved-items header and milestones presentation.
- Expandable entry requirements, preserving source wording and keeping selection caveats visible when collapsed.
- Guest bookmark sign-in prompt on programme/career lists and detail screens.
- Existing real catalogue, saved items, interest quiz, social APIs and route navigation remain connected.

## Review corrections

- After the user's clarification, adopted Kaitlyn's large spinning compass home: welcome heading, compass dial/panel, four coloured choices, selected feature card and Explore More section. Bottom tabs now read Home / Career / Milestones / Groups / Wayfinder. Dashboard still exposes For you, saved items, Profile and Settings.
- Reused existing Ionicons/Feather for the three lucide icons, avoiding lucide-react-native/react-native-svg additions; retained the existing lockfile and dependency security backports. No native dependency or runtime-version change is introduced.
- Added accessible compass/feature/card buttons and safe-area bottom padding. Milestones opens the actual Progression screen rather than skipping directly to ChoosePathway. Native dragging follows the finger around the dial with current callbacks; web pointer capture handles browser dragging and prevents a drag-release from also triggering a random spin.
- Sign-in prompt now opens Login, not Profile, with accessible cancel/back handling and minimum 44-pixel buttons.
- Screen wrappers own safe-area insets. Added missing safe-area wrappers to Career Explorer and Saves after removing their duplicate native headers; shared headers do not add the inset twice.
- Restored career descriptions and programme career-pathway summaries. Related programmes are not labelled as personalised recommendations.
- Kept requirement counts, responsive text, readable source blocks and an expanded-state accessibility announcement. Quiz copy does not claim an admissions/suitability assessment.

## Verification

- TypeScript check passed.
- 17 screen/layout tests, 18 student tests, 47 wayfinding tests and 11 dependency-security tests passed (93 total).
- Disposable local two-account social integration test passed (1 additional test).
- Expo iOS, Android and web bundle exports passed. These are bundle checks, not native device builds.
- Browser checked at 390 × 844: collapsed/expanded compass labels, Dashboard access, refreshed career/programme screens, all requirement blocks, programme-to-career navigation and guest bookmark → Login → back.
- Corrected homepage checked at 390 × 844 and 320 × 740: Kaitlyn's closed dial and four-choice layout, spin animation, westward drag selecting Wayfinder, explicit feature selection, Career Alignment/Milestones card navigation and full Dashboard access. Preview was restarted to remove the stale previous-home bundle.
- iPhone Dynamic Island/keyboard/native AR checks still require a physical-device test.

## Release state

This integration is local until pushed and merged into main. No production deployment or phone update was performed as part of this review.

## Approved navigation refinement

The subsequent user-approved refinement keeps Kaitlyn's dial, pastel panel, four coloured feature buttons and rounded cards while simplifying their behaviour:

- The compass plays a short 650 ms reveal, without randomly choosing a feature. Tapping any feature opens its screen directly after a brief needle animation; no second result-card tap is needed. Dragging only previews a direction and never unexpectedly navigates.
- The heading remains “Find your direction”. Consistent system typography, larger option labels and tighter spacing replace repeated selected-feature headings/descriptions.
- “Your next step” links to real saved programmes/careers when available, otherwise For you for signed-in accounts or the public programme catalogue for guests. It does not fabricate progress or fetch private data for guests.
- Home's top-right Menu button opens the existing drawer. The old Dashboard has no Home/drawer/bottom-bar entry; its route remains registered for compatibility. All previous useful destinations are retained in the drawer, including For you, Profile, Settings, saved items and the four core features.
- The global bottom bar is now Home / Saved / Messages / Profile, distinct from the four compass features, with route-aware highlighting and accessible selected-tab states.
- Animation callbacks ignore cancelled animations, focus cleanup cancels pending navigation, reduced-motion preferences are honoured, and Android Back collapses the expanded compass.

Validation for this refinement: TypeScript, 19 screen/layout/navigation tests, 18 student tests, 47 wayfinding tests and 11 dependency-security tests (95 total); local platform bundle export and responsive browser checks. Physical iPhone keyboard/Dynamic Island/AR validation still requires a device.

### Compass spacing and backdrop follow-up

- Replaced the rounded rectangular panel with a subtle circular pastel halo, retaining Kaitlyn's dial, feature colours and icon arrangement.
- Career Alignment is labelled above its icon. The stage height now reserves the actual icon, scaled label and dial-glow clearance rather than relying on fixed heights, preventing top/bottom overlap at wider or shorter window sizes.
- The reveal animates each icon in place; the feature layer no longer scales labels inward across the compass. Text scaling is accounted for up to the feature labels' 2× accessibility limit.
- Added a geometry regression across narrow/wide widths, short/tall heights and font scales. The screen/layout/navigation suite now has 20 tests (96 frontend tests total). Browser checks cover 320 × 740, 390 × 844, 460 × 740 and the normal wider viewport. These changes are local, not a production or phone deployment.
