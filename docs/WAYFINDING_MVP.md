# Wayfinding MVP: 2–3 week delivery plan

## Shipping target

Ship one dependable, demonstrable route in Building 303. A user selects one of
5–10 destinations, scans a known QR checkpoint, receives a shortest path, and
follows simple segment-by-segment guidance across at most two floors. The demo
must still work in a 2D guidance mode if the AR spike fails.

The repository already has a FastAPI graph, Dijkstra routing, accessibility
filtering, and demonstration Building 303 data. Do not rebuild those pieces.
Replace demo geometry with measured, authorised data only after the camera gate
passes.

## Non-negotiable scope

- One building and at most two floors for the assessed route.
- 15–30 measured nodes, 5–10 destinations, and 3–5 QR checkpoints.
- One polished end-to-end route plus one alternate start checkpoint.
- Stairs transition via a checkpoint at each end; no continuous stair tracking.
- Clearly label demo/unverified geometry until it is physically validated.
- No outdoor routing, second building, photogrammetry, or campus-wide data in MVP.

## Week 1: retire device risk

### Days 1–2 — QR gate

- Run the scanner in Expo Go on the actual demonstration phone.
- Scan `TEST_START`, a raw `303_G_ENTRANCE` code, and
  `wayfinder://location/303-G-ENTRANCE`.
- Verify permission denial/retry, duplicate-scan prevention, and scan-again.
- Test in the real corridor lighting and at the intended printed QR size.

Exit gate: ten consecutive valid scans from 0.5–2 m on the target device with no
duplicate navigation. If this fails, fix it before proceeding.

### Days 3–4 — AR spike, strictly time-boxed

- Treat `@stewmore/expo-ar` as unverified for this app: as of 30 August 2026
  its own requirements specify Expo SDK 56, while this repository uses SDK 57.
  Do not downgrade the working app or merge the package before a clean native
  spike compiles on the chosen platform.
- Confirm the exact target phone and whether ARKit or ARCore is available.
- Use a development build and place one object about 2 m ahead.
- Walk a short L-shaped route and measure visible drift/recovery.
- Do not connect the backend or build reusable AR abstractions yet.

Exit gate: the object remains usable over the real demo corridor. If it cannot
be made reliable by the end of Day 4, select the 2D/2.5D floor-plan guidance
fallback and stop AR investigation.

### Day 5 — lock the demo design

- Freeze the start checkpoint, destination, floor transition, and fallback UX.
- Assign one owner each for mapping/data, frontend flow, and device testing.
- Record the chosen AR/fallback decision in the pull request.

## Week 2: complete the vertical slice

- Measure the chosen corridor and enter the small graph; mark every node verified.
- Add destination search using the existing `/wayfinding/search` endpoint.
- Resolve the scanned checkpoint to a location and call the existing
  `POST /wayfinding/routes` endpoint.
- Render one instruction at a time. At stairs, pause, instruct the floor change,
  and require the next checkpoint scan.
- Add arrival, route-not-found, offline/backend-error, and rescan states.
- Keep a hard-coded offline demo route only if it is visibly labelled as such.

Exit gate: a new tester can complete the route without verbal help.

## Week 3: validation and polish

- Walk the route at least five times in both directions on the demo device.
- Correct measurements, instructions, QR placement, text size, and contrast.
- Test a wrong QR, denied camera access, loss of backend, and route recalibration.
- Rehearse both the primary demo and the 2D fallback.
- Freeze features two days before presentation; use the remaining time only for
  defects that affect the demo.

## Definition of done

- QR scan identifies the correct checkpoint on a physical phone.
- Destination and route come from the FastAPI API, not duplicated frontend data.
- Every displayed route step matches the verified corridor.
- Floor transitions resume from a known checkpoint.
- Arrival is explicit and navigation can be restarted.
- Automated backend tests and TypeScript checks pass.
- A second team member can set up and run the demo from the README.

## QR payload contract

Production labels should use:

```text
wayfinder://location/303-G-ENTRANCE
```

The scanner also accepts bare codes and converts the proposal's underscore
format (`303_G_ENTRANCE`) to the backend format (`303-G-ENTRANCE`). `TEST_START`
is reserved for the camera proof of concept and must not be printed as a real
location label.
