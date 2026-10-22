# UoA Health branding and Wayfinder entry

## Branding

The app's display name is UoA Health. Home, Login, the drawer and About share the app-config name and the heart/compass asset. Privacy/account export and native permission text are updated too. The Expo slug, project ID, update URL, package/bundle identifiers and runtime/version policy are unchanged, preserving the existing app's identity.

`frontend/assets/uoa-health-icon-source.png` is the supplied screenshot. `frontend/assets/uoa-health-icon.png` is its high-resolution square launcher-ready rendition, prepared with the built-in image-generation tool. The black heart/diagonal needle, white centre and intentional open lower-left stroke are retained. The launcher, Android adaptive foreground and web favicon share this asset. The stock Android background and monochrome icons are no longer configured.

Prompt used: “Use case: precise-object-edit. Asset type: UoA Health mobile launcher icon. Image 1 is the edit target: preserve the black heart-outline and diagonal filled compass needle with small white centre exactly as supplied, including the intentional open lower-left heart stroke. Prepare a clean high-resolution square PNG with the same near-white background, crisp flat black edges, centred mark and generous safe margin (mark occupies approximately 62% of the square width) for both iOS and Android app icon masks. Only improve raster sharpness and add square canvas/padding; do not redesign the mark, do not close the gap, change its shape, add text, gradients, shadows, other colours or other objects. Output a flat square icon, not a phone/mockup.”

Changing the installed launcher icon, display name or permission text requires generating and installing a fresh native build. JavaScript-only updates can change the in-app branding and navigation but cannot replace the installed phone icon/name. No build was installed, update published, or production deployment performed in this task.

## In-app branding and navigation polish (11 October 2026)

Home, Login, the drawer and About now share a transparent teal heart-compass mark and a heavier two-tone UoA Health wordmark. Removed the surrounding image backgrounds so the mark blends into white and tinted pages. The installed launcher icon is unchanged.

Asset: `frontend/assets/uoa-health-mark-transparent.png`. Prepared using the imagegen skill and built-in image-generation edit mode with `transparent_background: true`, referencing the existing `uoa-health-icon.png`. Alpha was checked at the canvas corner and central hole; the mark was visually checked on white Home and the tinted drawer.

Prompt: “Use case: background-extraction. Asset type: transparent in-app UoA Health logo. Image 1 is the edit target. Remove all near-white background from this existing black heart-outline and diagonal compass needle, including the inside of the heart and the small central circular hole. Output a genuine alpha-transparent PNG with crisp edges and no white halo, solid black mark only. Preserve the exact heart outline, intentional open lower-left stroke, compass angle, proportions and stroke thickness. Keep the existing square canvas and mark placement. Do not redesign, add text, shadows, gradients, new shapes or a background. It will be tinted teal in code.”

The bottom bar now includes Wayfinder between Saved and Messages, opening the existing indoor/outdoor chooser. The closed compass hint reads “Tap to open compass”; the hint itself opens/closes the compass and respects animation guards.

Verification: TypeScript, 23 screen checks and web/iOS/Android bundle exports passed. Browser checks cover phone-width branding, compass hint toggling and Wayfinder navigation. Physical iPhone rendering remains untested. No deployment or update publication was performed.

## Compass closing behaviour

Closing uses a 320 ms reverse needle turn with icon shrink and fade, retaining the expanded geometry until completion. Options cannot be tapped during closing; duplicate taps are guarded. Reduced-motion settings make it immediate. Cancelled animations do not collapse or navigate after leaving the screen, and Android Back uses the same close action.

## One Wayfinder entry

- Home's compass and the drawer open `Wayfinder`, now a safe-area-aware Indoor/Outdoor chooser. It does not mount the AR screen or request camera access.
- Indoor opens `IndoorWayfinder`, which wraps the existing `CampusWayfinderScreen`. Published routes, developer tools, recordings, authentication, recognition checks and unsaved-edit guards remain unchanged. Indoor AR is still an iPhone pilot, not a newly supported Android/web feature.
- Outdoor opens the existing `FindRoute` screen, now titled Outdoor wayfinder. Campus building selection, route preview and live directions through Apple Maps/Google Maps are preserved.
- The separate Campus directions drawer/dashboard entry is removed. Existing `FindRoute` route identity is retained for compatibility, and the drawer highlights Wayfinder while in either sub-flow.
- There is no automatic GPS-to-AR handoff or continuous combined route: finish outdoor directions, return to Wayfinder, and explicitly choose Indoor.

## Verification

Regression tests cover registered destinations, a single top-level Wayfinder entry, no early AR/camera mounting, retained native app identity, square launcher asset, safe spacing and cancellable/reduced-motion closing. Physical iPhone launcher, camera/AR and permission-text checks still require a fresh device build.

TypeScript and all 99 frontend tests passed, and local web/iOS/Android bundle exports succeeded. Expo's resolved public config confirms the new display name/icon and unchanged update/project identity. Browser verification covers opening → closing → reopening the compass, the Indoor/Outdoor chooser, outdoor building selection and enabled Maps action, the unchanged Indoor route catalogue/editor entry, and the single branded Wayfinder drawer entry. No camera session, route publication, account changes or external Maps session were started during these checks.
