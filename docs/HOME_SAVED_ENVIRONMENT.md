# Home room recognition — runtime 1.1.0, native testing required

## What this change does

After one local room recording, **Recognise room — no scan** loads ARKit's saved
world map. Guidance waits for normal tracking and the saved route-origin anchor.
It does not use the current camera position as the route origin. Failed recognition
shows no arrows and times out after 45 seconds of camera frames.

This is recognition within a previously mapped home, not arbitrary indoor positioning.
Each phone needs its own recording. Building 303, multi-floor relocalisation and
sharing private spatial maps between devices are not included.

## First recording (authorised editor)

1. Install the new native build and sign into the authorised editor account.
2. Choose a destination and Initial setup / marker alignment.
3. Either scan HOME START once, or use developer manual alignment directly above
   the known start, facing down the plan, with measured floor-to-camera height.
4. Walk the route slowly, looking at stable visual features from different angles.
   Do not rely on blank floors, movable objects or the printed paper alone.
5. When recording is ready, select **Save room recording** and wait for success.
   This saves spatial alignment only; route drafts still require Save/Publish.
6. End, close and reopen the app. Cover the paper. Choose a destination and
   **Recognise room — no scan**, from a location you actually recorded.

Successful recognition joins a nearby unambiguous route segment. It never creates
a straight-line shortcut through walls. Starting away from the route asks you to
return to its configured start. Tracking interruptions hide arrows; a position
jump requires ending and restarting recognition.

## Shared routes versus private room data

The world map and coordinate-frame snapshot are stored atomically in app-local
Application Support, excluded from cloud backup. They are not sent to AWS/Expo.
The latest published route is fetched separately before navigation. The old route
snapshot in a recording cannot replace a newer published route.
All recordings use the same fixed `home-start-v1` coordinate frame. Moving that
start or changing its heading requires a new recording and a reviewed route-frame
migration; do not publish incompatible coordinates into the existing frame.

Room recordings are device-local and may disappear if the app is deleted. No cloud
map sharing is implemented. Replacing a recording requires confirmation. Interrupted
saves may finish in the background; the UI does not claim a known result when its
callback is lost. Failed writes preserve the previous recording.

## Native/OTA compatibility

`expo.version` is increased to **1.1.0** under the existing appVersion policy.
Do not publish these native changes with runtime 1.0.0. Existing 1.0.0 phones will
not receive this runtime; they keep their compatible update. This preserves the
current OTA setup without attempting a fingerprint-policy migration.

After this branch is reviewed/merged, update the **integrated main** checkout on
the Mac (not the old home-demo branch). Preserve any local changes and signing.
From its frontend directory, run `npm ci`, then `npx expo prebuild --platform ios`
(without `--clean`), then `node scripts/private-ios-release.mjs --build`.
The release script bundles the AWS URL. Windows cannot compile the Swift module.

## Physical acceptance gate — not yet performed

- Build in Xcode; confirm Swift serialization/restoration works in Release.
- Record and restart with paper covered, from several recorded positions/headings.
- Measure arrow locations against fixed floor marks while moving/turning.
- Try an unrecorded/different room: no guessed arrows, timeout and retry work.
- Test poor light, changed furniture, interruptions, camera drift and failed saves.
- Publish a route change, reopen recognition, confirm the new geometry is used.
- Test editor and ordinary accounts; only editor accounts see recording controls.
- Confirm same-session destination changes retain the origin and safe joining.

Passing JavaScript tests/export is not proof of native compilation or physical
recognition. Saved maps may drift or fail in changed/repetitive surroundings.

Apple references: [initialWorldMap](https://developer.apple.com/documentation/arkit/arworldtrackingconfiguration/initialworldmap),
[ARWorldMap](https://developer.apple.com/documentation/arkit/arworldmap).
