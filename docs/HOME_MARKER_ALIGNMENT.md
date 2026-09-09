# Home route demo — Marker v1

For developer-only waypoint adjustments, see [Home route editor](HOME_ROUTE_EDITOR.md).

## Status

The user successfully walked the previous manually aligned route. This version
replaces the “I'm at X” button with a measured image reference. Mac compilation,
ARKit reference validation/detection and physical repeatability remain unverified
on Windows and must pass the iPhone checks below.

- No arrows until a known floor marker is detected steadily.
- Origin and heading come from the image anchor, not the user's starting pose.
- Camera tracking and map localisation have separate UI states.
- No manual alignment fallback. Tracking loss, interruption, stale poses or a
  position jump invalidates alignment and requires scanning again.
- Old native builds are detected and cannot open Marker v1 navigation.
- `expo-dev-client` is now included in the repository as well as the Mac setup.

## Print and place the marker

Open **[home-start-marker.html](home-start-marker.html)** in a desktop browser.
Print A4 portrait at **100% / actual size**, 5 mm margins, headers/footers off.
Measure the outer square: **20 × 20 cm**. Do not use “fit to page”. The surrounding
instructions are not part of the reference image.

1. Tape the sheet flat on the floor, its square centre at the **new red X** in the
   clear aisle of Bedroom 1: plan pixel (175,235), map (0,0).
2. Point the small black arrow at image-top **down the floor-plan image**, along the
   clear aisle. Facing that way, the bed is physically left and outer wall right.
3. Secure edges without covering the pattern or creating a trip hazard. Use matte
   paper and good lighting. Do not scan from a hand-held phone or moving laptop.
4. Leave it fixed. Do not place copies in other rooms. This recognises the image,
   not the room itself: it cannot tell if someone moved or copied the marker.

This is an AR image target, not a QR payload. Wrong printed size or installation
still causes misalignment. It cannot repair inaccurate plan scale or furniture data.
The exact PNG bytes bundled with ARKit are embedded in the print page. Regenerate:

```bash
cd frontend
node scripts/generate-home-marker.mjs
```

## Mac update and mandatory rebuild

Stop Metro and connect/unlock the iPhone. The previous troubleshooting installation
may have modified package.json/package-lock.json on the Mac. Preserve those files
in a named stash before pulling; the new commit already includes expo-dev-client.
Do not automatically pop that dependency backup over the incoming files. If other
files are modified, preserve/review those separately before continuing.

Run one command at a time; stop on any error:

```bash
cd ~/Developer/team-43-project
git status --short
git stash push -m "Mac dev-client dependency backup" -- frontend/package.json frontend/package-lock.json
git switch codex/home-wayfinding-demo
git pull --ff-only
cd frontend
npm ci
npx expo prebuild --platform ios
npx expo run:ios --device
```

Choose the physical iPhone and retain the existing signing team and bundle ID.
Keep `buildReactNativeFromSource: true`. Do not use `prebuild --clean`, delete signing
changes, or uninstall the app as a routine step. This changes Swift and bundles a
reference image: reloading JavaScript alone cannot install the feature.

## Acceptance walk

1. Open Home routes. Confirm **Marker v1** in the title and select Living room.
2. Without showing the marker, check **Map: Not located** and no arrow, even when
   camera tracking is Ready. Test this in another room too.
3. Show the entire fixed floor marker from nearby. No exact stance or facing
   direction is required. Wait for steady recognition, then **Map: Marker aligned**.
4. Move beside the marker if requested to join the route; do not stand on the paper.
   The first aisle waypoint is about 1.1 m from its centre. Check the path is clear.
5. Walk to the destination; check decreasing distance and waypoint progression.
6. End and repeat from three nearby positions and different viewing angles, e.g.
   30–50 cm apart. Compare waypoint placement against fixed marks on the floor.
   Record the offsets. Suggested initial target: within 20 cm across repetitions,
   no arrows through walls/furniture. This is a test target, not promised accuracy.
7. Background/resume the app: arrows must remain hidden until another scan.
8. Repeat the longer routes and measure doorway offsets. Stop if guidance is unsafe.

If validation fails or detection never locks, report the message, print measurements
and lighting. Runtime ARKit validation runs before the camera session. Automated
geometry tests do not establish the generated image's detection quality.

## Implementation and limits

World tracking uses one reference image, width 0.20 m, image tracking enabled and
automatic image-scale estimation disabled. Only tracked image anchors from normal
camera frames are emitted. JS requires the known ID, rigid transform, upward
near-horizontal normal, fresh camera frame and consistent observations within 4 cm
and 3 degrees over at least 0.8 s (at least 6 samples). A gap over 0.3 s restarts
acquisition. The camera must be within 2.5 m horizontally to begin.

For the horizontal image anchor, +Y is its face normal and -Z points at image-top.
The centre defines map origin; projected -Z defines map +Y. Map +X maps to physical
left of that direction to preserve plan handedness. Arrow height is marker Y + 0.15 m,
independent of phone height. There is no live floor-level or obstacle detection.

After acquisition the alignment is frozen. Leaving the marker's view is allowed
while camera tracking remains normal. Drift remains possible; recovery requires
ending/scanning again. We do not relocate the route continuously with a moving paper.

The six destination routes still use the manually traced graph (1 m ≈ 86 pixels),
not a GLB navmesh or automatic room recognition. Dimensions/clearance need physical
verification. Personal house photos and GLB are not bundled or published; derived
room outlines/coordinates remain included under the user's prior permission.

## Checks

```bash
cd frontend
npm run test:wayfinding
npx tsc --noEmit
npx expo-modules-autolinking resolve --platform apple
npx expo export --platform ios
```

Tests cover route connectivity, handedness, progress, arrow direction, marker-derived
transforms, invalid/unknown/tilted markers, temporal stability and byte-identical
print/native resources. Native and physical checks above are still required.

References: [Apple image detection](https://developer.apple.com/documentation/arkit/detecting-images-in-an-ar-experience),
[reference validation](https://developer.apple.com/documentation/arkit/arreferenceimage/validate(completionhandler:)),
[physical size](https://developer.apple.com/documentation/arkit/arreferenceimage/physicalsize).
