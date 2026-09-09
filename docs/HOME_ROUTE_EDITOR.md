# Developer home route editor

## Scope

The developer can move existing waypoints and insert/delete intermediate points
while physically walking a marker-aligned route. The generated route remains an
immutable baseline. Edits update the route geometry used for arrow direction,
remaining distance, turn prompts, map preview and arrival; they are not visual-only.

This first version places a point at the **phone camera's horizontal position**,
projected onto the marker floor, or nudges it in 10 cm increments. It does not yet
support tapping distant floor points, dragging arrows or independently rotating
an arrow. Arrow direction follows the edited incoming segment automatically.

## Install on the Mac

Stop Metro, connect/unlock the iPhone and run one command at a time:

```bash
cd ~/Developer/team-43-project
git status --short
git switch codex/home-wayfinding-demo
git pull --ff-only
cd frontend
npm ci
npx expo prebuild --platform ios
npx expo run:ios --device
```

If local changes block the pull, preserve/review them first; do not reset or discard
Mac signing changes. Keep the existing signing team and build-from-source setting.
A native rebuild is required for the new storage functions and debug-only gate.
An older binary can still navigate Marker v1 but shows that editor rebuilding is needed.

## Editing workflow

1. Select a destination and scan the fixed marker as usual. Keep that marker unmoved.
2. Tap **Developer: edit this route**. Navigation and automatic waypoint progression
   pause. The selected waypoint is the only blue arrow shown in the camera.
3. Select a waypoint number in the horizontal strip. Zero is the locked marker start.
4. To relocate it, hold the phone above the desired clear floor spot and tap **Move
   here**. Do not assume it means your feet; it uses the camera's horizontal position.
5. To fine-tune, hold the phone facing horizontally and use the 10 cm controls.
   Left/right/forward/back are relative to your current phone direction, not the plan.
6. To insert, select the preceding waypoint, move the phone over the new spot, and
   tap **Add after**. If the final destination is selected, insertion is before it.
7. **Delete** removes an intermediate waypoint. The marker start and destination
   cannot be deleted; the destination's position may be adjusted without renaming it.
8. **Undo** retains up to 30 prior draft states. **Generated route** restores the
   original geometry into the draft (with confirmation); Undo can reverse it.
9. **Save & test** validates and saves the selected destination on this phone, then
   requests a fresh marker scan and restarts navigation from the beginning.
10. **Discard / exit** or navigation back asks before discarding the draft. Saved
    routes are unchanged. A force-quit may lose an unsaved draft; save intentionally.

Tracking loss disables geometry edits and save while keeping the in-memory draft.
Scan the marker again to continue. Do not adjust the map to compensate for tracking
drift: re-align first. The editor deliberately allows moving off the old route to
correct it, so its preview is NOT safe navigation guidance. Check the real walkway.

## Persistence and developer-only boundary

- Saved coordinates are in marker-relative metres, not the current AR session's
  coordinates. Reopening still requires marker localisation, not an exact stance.
- Overrides are per destination, not shared graph-node edits. Editing Living room
  does not silently alter the route to Office even where the original segments overlap.
- Local UserDefaults key `home-routes-marker-v1`, schema version 1, marker ID
  `home-start-v1`. Saves survive ordinary app restarts/updates with the same app ID.
- Routes are not uploaded, committed or synced to teammates' phones automatically.
  They may be lost if app data is removed. Export/publishing is a future step.
- Both JS `__DEV__` and native Swift `#if DEBUG` must permit editing. Release builds
  hide the controls and the native write function rejects calls, not merely UI taps.
  This is a debug-build boundary, not administrator authentication for distributed
  debug builds. Do not distribute developer builds as normal-user releases.
- Native reads remain available for navigation; on a fresh user installation there
  are no local overrides and the generated routes are used.
- Unknown schema/marker/destination or corrupt records do not get overwritten:
  show generated routes with an error and disable editing pending recovery.
- Validation enforces finite coordinates within 30 m of the marker, 2–100 points,
  unique IDs, fixed origin, destination identity, and at least 10 cm between adjacent
  points. These checks cannot certify wall/furniture clearance or correct room location.

## Checks and physical acceptance

```bash
cd frontend
npm run test:wayfinding
npx tsc --noEmit
npx expo export --platform ios
```

Automated checks cover non-mutating editing, insertion/deletion order, origin locks,
camera-relative nudges, changed distance calculations, per-destination persistence,
marker-relative coordinate restoration and invalid save rejection. Native compilation,
debug/release access, UI fit and on-device disk persistence require Mac/iPhone tests:

- Move a point 20 cm, insert a new intermediate point, save and rescan; verify arrow
  placement and progression follow the modified route.
- Close/reopen the app, reselect the destination and rescan; verify edits return.
- Select another destination; confirm its generated route is unchanged.
- Edit then cancel/back; confirm saved data is unchanged. Try Undo and generated reset.
- Interrupt tracking while editing; verify placement/save stops until rescanning.
- In a release build, verify there is no editor entry point and native writes fail.

Status: implemented and checked on Windows; the user must complete native/device QA.
