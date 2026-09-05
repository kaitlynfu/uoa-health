# Home route demo

## Status

Implementation prepared on `codex/home-wayfinding-demo`. The user has walked the
initial demo and reported an inaccessible desk-side start and misplaced arrows.
The corrected clear-aisle start and handedness fix need a new physical walk.
Automated geometry checks do not establish real-world clearance or alignment.

The demo starts at the revised red X in the clear aisle in Bedroom 1 and offers six destinations:
Living room, Bedroom 2, Office, Other 2 (passage), Other 1 (right-hand room), Closet.
Each selection runs Dijkstra over a shared graph. No backend or internet is needed
for route calculation. Metro is still needed for a development session.

## Map provenance and limits

- Source: the user-supplied top-floor plan and `5_09_2026.glb`.
- GLB inspected locally with `backend/scripts/inspect_wayfinding_glb.py`:
  19,274,984 bytes; 8 meshes; 190,658 vertices; Y is the vertical axis.
- World bounds: X -7.4764 to 7.4099 m, Y -2.2415 to 1.2162 m,
  Z -5.3136 to 5.5328 m.
- A top-down scan projection confirmed the room arrangement. The scan is rotated
  relative to the annotated plan. No automatic map registration or navmesh is claimed.
- The graph is manually traced in plan pixels using the visible 1 m / ~86 px scale.
  The revised red X is pixel (175,235), represented as map (0,0). Map X points right
  and map Y points down the plan. When facing down the plan, image-right is the
  user's physical left. All displayed route distances are estimates.
- The old desk start and desk-clear waypoint are removed. The first two waypoints
  are (175,330) and (175,545), straight down the clear aisle, before the route turns
  left physically toward the doorway (rightward on the image).
- Paths go around the bed in Bedroom 1 and through visible door openings. Door widths,
  furniture clearance, scale and start placement still need physical verification.
- The user confirmed the left side of the bed is clear and the right-hand room and
  closet may be entered. No route goes downstairs or outside the mapped top floor.
- The original house scan/image are not copied into the repository. The demo DOES
  contain derived room outlines and route coordinates; review those before sharing.

## How the live guidance works

`frontend/modules/wayfinder-ar` is a small local Expo module using ARKit/SceneKit.
Expo discovers it from the `modules` directory. It is independent of the existing
ExpoAr cube test. Only the active screen owns a camera session.

ARKit emits the camera's world transform at 10 Hz. At the start the user explicitly
confirms their location and facing direction. The captured position and horizontal
camera heading align the plan to the AR session. A blue 3D arrow is fixed at the next
waypoint, approximately 0.9 m below the initial phone height. It points along the
current segment toward that waypoint, not prematurely along the following segment.
The text describes the upcoming turn. This is a floating arrow, not a floor ribbon
or a floor-detection test.

The horizontal camera-to-waypoint distance changes as the phone moves. Remaining
route distance includes the uncompleted segments, rather than a straight line through
walls to the destination. Coming within 0.45 m for 0.3 seconds advances one waypoint.
A manual confirmation is enabled only within 0.8 m. Arrival happens at the final node.

Guidance hides when tracking is lost, stale, interrupted, or jumps unexpectedly.
After loss/interruption, return to X and align again. More than 0.9 m off the current
segment shows a pause/map prompt. This does not detect actual walls or obstacles.

Initial alignment is manual for this demo. Scanning a QR identifier alone cannot
establish camera heading or accurately register the scan. Known marker pose/size or
additional calibration would be needed for automatic QR alignment later.

## Mac build (after this branch is available on the remote)

First preserve any existing Mac edits. Then, in the repository:

```bash
cd ~/Developer/team-43-project
git status
git fetch origin
git switch codex/home-wayfinding-demo
git pull --ff-only
cd frontend
npm ci
npx expo prebuild --platform ios
npx expo run:ios --device
```

Choose the physical iPhone. Use the existing Personal Team and bundle identifier.
The new native module requires a rebuild, even if the old cube-test app is installed.
Keep `buildReactNativeFromSource: true`, which fixed signing on this Mac previously.
Do not use `prebuild --clean` or erase existing iOS signing changes as a routine step.

## First walk

1. Open Wayfinder → **Open home routes**. Start with **Living room**.
2. Review the blue schematic path. Clear movable furniture and open the doors.
3. Stand at the red X, holding the phone upright at a normal viewing height.
4. Open the camera. Look around slowly until tracking is Ready, staying at X.
5. Face down the floor plan along the aisle: bed on your physical left, outer wall
   on your physical right. Use the NEW X in the open space, not the old desk X.
6. Tap **I'm at the new X, facing down the aisle**. The first waypoint should be
   about 1.1 m directly ahead. The second continues along the aisle past the bed.
7. Walk toward it. Verify the arrow stays in place and distance decreases. Walk back
   slightly and verify distance increases. Approach the waypoint and check it advances.
8. Check the path stays around the bed and through the Bedroom 1 doorway. Stop if
   it points through furniture/a wall; report which waypoint and approximate offset.
9. Check arrival in the living room, then return to X before choosing another room.
10. Repeat Bedroom 2, Office, passage, right-hand room and closet. Do not treat their
    geometry as verified merely because the shorter living-room route worked.

If the route is rotated: repeat the start alignment facing exactly down the plan.
If distance/doorway placement is consistently wrong: measure one known segment and
adjust the map scale/coordinates, rather than compensating by skipping waypoints.

## Verification

```bash
cd frontend
npm run test:wayfinding
npx tsc --noEmit
npx expo-modules-autolinking resolve --platform apple
npx expo export --platform ios
```

Automated checks cover graph connectivity, shortest paths, map/AR transforms at
multiple headings, remaining distances around turns, left/right instructions, and
arrival dwell timing (including loss of tracking/proximity). Regression checks also
cover the new straight-ahead start for every destination, non-mirrored image-to-world
coordinates and arrow orientation along the active segment.
Native compilation, real camera permission/lifecycle, alignment and walking accuracy
remain physical-device acceptance checks. Building 303 integration follows those checks.

Implementation references: [Expo local modules](https://docs.expo.dev/modules/get-started/)
and [Apple ARSessionDelegate](https://developer.apple.com/documentation/arkit/arsessiondelegate).
