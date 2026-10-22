# Building 303 source analysis

This note records the first-pass audit of the two Polycam GLBs and the latest
annotated plans supplied for the Building 303 wayfinding graph. The GLBs are the
metric geometry source; the annotated plans are used only for semantic labels.

## Repository and runtime baseline

- Work started from clean commit `a820860` on `main` and continues on
  `codex/wayfinding-303-graph`.
- Frontend: Expo SDK 57 (`expo ~57.0.13`), React Native `0.86.2`, React
  `19.2.3`, and TypeScript `~6.0.3`.
- The public Expo config resolves to SDK `57.0.0`; no `newArchEnabled` override
  is present. React Native 0.86 runs on the New Architecture, so any future AR
  bridge must support it.
- The existing backend already has campus/building/floor/location/edge tables,
  Dijkstra routing, accessibility filtering, and demonstration seed data.
- The merged frontend destination and route screens still use duplicated demo
  data. They are not yet connected to the wayfinding API.

## Reproducible source identity

| Source | SHA-256 |
| --- | --- |
| `Ground Floor - 303.glb` | `A41EAF47AE0BA850AA50EF5DC74ABC3A6C7FEF6F9D44CCC34080B5F01FCF5F17` |
| `Floor 1 - 303.glb` | `11200DA565B9DFEABEB6B310F5BF0D021927D33403CD111C89706FC1C4758B6C` |
| `303 Ground Floor Layout.png` | `6305C6E03D0D71ACAB5FED87DD116ED2F0DA00831D2EBE21290444E1D18F1F60` |
| `303 Floor 1 Layout.png` | `D527E4C8940F968D31E822C843E42A9A50359C5A369A5A84A953BEFA5FF1613C` |

The large source GLBs are intentionally not copied into the application or
repository. The generated projections in this directory are lightweight
inspection artefacts, not floorplans and not navigation graphs.

## Metric GLB findings

| Floor | Meshes | Vertices | X span | Y span | Z span | Plan axes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Ground | 16 | 275,589 | 103.2843 m | 7.3523 m | 66.9719 m | X/Z |
| Floor 1 | 12 | 124,603 | 33.9739 m | 5.5972 m | 49.5652 m | X/Z |

Y is the inferred vertical axis in both models. The two scans retain separate
origins and must not be stacked by equating their local coordinates.

Both GLBs contain `ACCESSOR_TOTAL_OFFSET_ALIGNMENT` validation errors in some
float accessors. The geometry remains readable, and the inspection tool handles
the unaligned data safely. If the GLBs are later loaded by a strict native or AR
tool, create normalised working copies rather than altering the source files.

The Ground Floor scan has a large vertical span for a nominally single-floor
model and visibly separated scan regions. This may include stairs, tilt/drift,
or missing scan connections. Route edges must therefore be checked against the
model and a physical walkthrough; raw Y values and gaps must not be interpreted
automatically.

## Semantic findings

The corrected Floor 1 plan identifies these destinations:

- `303-103` — Chemistry Lab 1
- `303-104` — Chemistry Lab 2
- `303-148/1`
- `303-153/1`
- `303-153/2`
- `303-155/1`
- `303-155/2`

The newer correction changes the right-side `303-153/2` annotation to
`303-153/1`. Together with the other `303-153/1` annotation, this appears to
identify two door candidates for that destination. The supplied sources do not
unambiguously identify a second door for every other tutorial-room destination,
so those coordinates must remain unset until confirmed.

The corrected Ground Floor plan identifies:

- Entrance A at the west end of the upper scan region
- Entrance 2A on the rough west-side connector below Entrance A
- Entrance B beside Ground Stairs B
- Entrance C at the south end of the east scan region, beside Ground Stairs A
- Entrance D at the west end of the lower scan region
- Ground Stairs B in the central transition area
- Ground Stairs A in the south-east transition area
- the Ground elevator in the east scan region

The corrected Floor 1 plan identifies Stairs B at the north-east, Stairs A at
the south-west, and the elevator along the south edge. This resolves the named
vertical-connection mapping. The hand-drawn Entrance 2A connector remains
semantic-only and must not supply its shape, length, or waypoint coordinates;
those must be matched to the Ground GLB.

## Module boundaries for implementation

- `backend/app/data/wayfinding/building_303.json`: reviewed lightweight nodes,
  edges, destinations, door mappings, and source metadata. No GLB mesh data.
- `backend/app/models.py`: persistent destination and destination-door models;
  existing locations remain graph nodes.
- `backend/app/services/wayfinding_service.py`: Dijkstra over graph nodes and
  multi-door destination selection.
- `backend/app/routers/wayfinding.py`: destination-list and code-based route
  endpoints while preserving the current endpoints.
- `backend/scripts/seed_building_303.py`: validation and idempotent import of
  the reviewed graph.
- `backend/tests/test_building_303_graph.py`: route matrix, multi-door choice,
  vertical transition, accessibility, and missing-route tests.
- `frontend/services/api.ts`: API access after the backend dataset and contracts
  are stable.

## Current graph coverage

The lightweight review dataset now lives at
`backend/app/data/wayfinding/building_303.json`. Its coordinates are expressed
directly in the independent X/Z metre systems of the two source GLBs and remain
marked unverified.

- All seven Floor 1 destinations have at least one mapped door.
- `303-153/1` has two mapped doors and multi-target Dijkstra chooses the nearer
  reachable one.
- Entrance B has standard routes through Stairs B to every destination.
- Entrances C and D have standard routes through Stairs A and accessible routes
  through the elevator to every destination.
- Entrance A and Entrance 2A are deliberately not connected across an 11.4 m
  Ground scan gap.
- The Entrance B region is deliberately not connected to the elevator across a
  separate 10.4 m Ground scan gap.

The two withheld connections are recorded in the dataset rather than active
route edges. `BUILDING_303_WALKTHROUGH.md` defines the small physical survey
needed to enable them without inventing a path through unscanned space.

## Staged implementation gates

1. **Source audit:** complete. Both GLBs are readable and repeatable projections
   can be generated with `backend/scripts/inspect_wayfinding_glb.py`.
2. **Graph contract:** complete. Destinations and their door nodes are separate,
   the route endpoint runs multi-target Dijkstra, and synthetic tests cover
   alias search, closest-door choice, accessible elevator routing, and missing
   door data without claiming Building 303 coordinates.
3. **Floor 1 graph:** complete as an unverified GLB-projection review graph.
4. **Ground graph:** GLB-visible regions are mapped. Two connections remain
   withheld pending the focused physical checks documented separately.
5. **Vertical graph:** complete for Stairs A, Stairs B, and the elevator using
   explicit non-zero transition weights.
6. **Acceptance matrix:** automated for the currently connected entrances.
   Entrance A/2A and accessible Entrance B cases remain intentionally blocked
   until the two missing Ground links are measured.

## Using the GLB inspection tool

```powershell
python backend/scripts/inspect_wayfinding_glb.py `
  "C:\path\to\Ground Floor - 303.glb" `
  --output docs/wayfinding/source-analysis/ground-floor-topdown.png
```

The tool reports metric bounds and produces an X/Z vertex-density projection.
Use `--height-min` and `--height-max` to review a world-height band while
preserving the full model's metric projection bounds. The tool deliberately
does not infer walkability or generate nodes and edges.
