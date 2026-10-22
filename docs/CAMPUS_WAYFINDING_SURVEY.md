# Building 303: editor survey and shared iPhone navigation

This replaces QR checkpoint navigation and the standalone cube test. Home testing
remains available to editor accounts. The normal wayfinding screen uses published
campus routes only. No campus route or environment is published merely by installing
this update.

## Before leaving for university

1. The campus backend and additive publication table were deployed and verified on
   2026-10-02 (see `deployment/CAMPUS_RELEASE.md`). The integrated release now includes
   readiness revision 0005. Use the current deployment guide and
   `deployment/READINESS_RELEASE.md` for its rollout record.
   Updating a phone still requires the matching native app below.
2. Confirm your existing account ID is in server setting
   `TEAM43_ROUTE_EDITOR_USER_IDS`. The app checks `/navigation/editor-access`;
   merely running a debug build does not grant publish permission.
3. Build native iPhone version **1.3.0** on the Mac. Expo Go / JS reload / an OTA
   update cannot add the new native import/export methods. Keep existing signing
   settings. Connect/unlock your iPhone. Run the first two commands and stop if Git
   reports local changes; preserve those changes before continuing:

   ```bash
   cd ~/Developer/team-43-project
   git status --short
   ```

   If the status is empty, run the remaining commands individually:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   cd frontend
   npm ci
   npx expo prebuild --platform ios
   node scripts/private-ios-release.mjs --build
   ```

   Select your iPhone when prompted. This established local Release build embeds
   the hosted HTTPS API URL and JavaScript, so Metro and your laptop are not needed
   while testing at university. Existing Xcode signing remains required.
   No `--clean`, reset or app uninstall is needed. Keep this app installed to retain
   account-specific editor drafts.
4. Open Wayfinder while online. Confirm “Editor survey” appears and a prebuilt
   route loads. Bring the printed **20 × 20 cm image marker**, tape, a tape measure,
   charger and your floor plans. This is an image target, not a QR code.
5. Start small: **Entrance B → 303-104 via Stairs B**; then
   **Entrance C → 303-104 with Step-free enabled** (elevator). Do not start by trying
   to map the entire building in one uninterrupted session.

## Survey each floor leg

Select a start, destination and standard/step-free route. Prepare the template.
Ground and Floor 1 use independent coordinate systems. Each floor leg has its own
recording and calibration; AR arrows never span stair flights or an elevator ride.

1. Select the first leg. Read its **start label** and **heading label**.
2. Put the image centre on that starting location on a safe flat floor/landing.
   Point the small top arrow towards the named next location. The schematic's 0
   is the marker and 1 is that heading. If a leg consists only of a connector,
   choose a stable reference direction; it has no outgoing floor arrows.
3. Tap **Editor: align using floor image**, scan, and check the first arrows before
   walking. If ALL arrows are rotated/offset, correct marker placement first.
4. Use **Edit floor arrows**: select, Move here, Add after, 10 cm nudges, Delete or
   Undo. The start stays fixed. Endpoints keep their room/connector identity but
   can be moved onto the actual safe landing or door approach.
5. Look around textured stable surroundings as you walk. Do not record only the
   floor/paper. Check the whole route is walkable, not just its endpoints.
6. Save your phone draft. When tracking is ready and mapping says Ready to record,
   tap **Save floor recording + edited arrows**. Further geometry edits invalidate
   that leg's recording until it is saved again.
7. End the camera, cover the paper and use **Recognise this floor — no marker**.
   Try several starting positions/headings within the recorded area. Check actual
   arrow placement against doorways/floor marks. Mapping status is not proof of
   coverage or accuracy.
8. Select the next floor leg and repeat on its landing. Put the phone away while
   using stairs. Check that the connector really links those two floors.

Known scan gaps block some routes, including Entrance A/2A and the step-free path
from B. **Include survey gaps** makes them visible in an EDITOR template only.
The warnings identify the missing areas. Walk/measure them and correct the arrows
before publishing. If a connection is blocked, restricted or nonexistent, do not
publish that variant. This is not an evacuation system or an accessibility certification.

Editor drafts are account-specific on this phone. They are not cloud backups.
Keep this app installed. Recalibrating with the paper creates a new coordinate
frame and requires a fresh recording; it does not overwrite a prior publication.

## Publish and test as an ordinary account

Once ALL legs are recorded and verified, tap **Publish verified route + all floor
recordings**. The confirmation grants sharing of campus spatial recordings with
signed-in app users. Only publish areas you are permitted to map/share.

- The backend stores an immutable revision containing edited geometry AND matching
  iOS recordings, atomically. Partial legs, wrong floors/frames, mismatched geometry,
  unauthorised publishers and stale revision writes are rejected.
- Other accounts refresh/open Wayfinder, select the publication, and download all
  its floor recordings. They do not need to create their own map or scan paper.
- They select the recorded floor and look around until recognised. No recognition
  means no arrows; after timeout, end/retry in a recorded area. There is no guessed
  phone-as-origin fallback.
- A navigation session stays on the downloaded revision even if another edit is
  published. Refresh/reselect to get a newer revision; arrows don't jump mid-walk.
- At stairs/elevator, guidance ends at the landing. After travelling, choose the
  next floor and recognise it before proceeding. Continuous 3D stair arrows are
  deliberately not supplied by flat floor recordings.
- Test sign-out/editor → ordinary-account on this iPhone, then a SECOND compatible
  iPhone. Same-phone success alone does not prove cross-device recognition.

Initial downloads and publishing require network access. During an open, downloaded
route session, the AR floor recordings are local. Offline route discovery across
app restarts is not promised in this version. Maximum 12 MB per floor archive,
50 MB per publish request. Oversized captures fail with the draft retained.

Edits are per start/destination/standard-or-step-free variant. They do not silently
move the same corridor's arrows in other published variants.

## Backend deployment gate

The original campus publication rollout introduced `published_campus_routes`
in revision 0003. That rollout is complete; the current integrated application
includes revision 0005. See [the deployment guide](../deployment/README.md),
[campus rollout record](../deployment/CAMPUS_RELEASE.md) and
[readiness rollout record](../deployment/READINESS_RELEASE.md).

For a future schema change, review the model diff and installed deployment
helper, verify a backup and rehearse the migration against the actual database
engine before activation. Do not rerun the original 0003 activation on the
current server, create tables separately or stamp a revision without applying it.
A downgrade can delete campus publication history.

The following helper is ONLY for a legacy SQLite database not managed by Alembic:

```bash
# On an isolated restored database first; DATABASE_URL must identify that copy.
python backend/scripts/create_campus_publications.py
python backend/scripts/create_campus_publications.py --apply
```

Do not run those commands against production without the review/backup. The script
does not seed data, change accounts or publish routes. Also configure the reverse
proxy for a 50 MB request body and at least a 90-second upload timeout; its default
upload limit may be too small. Authenticate downloads; do not expose recordings as
public static files. Database backups now include published campus spatial data.

## Limits and acceptance

Only iPhone/ARKit is implemented here. Android needs a separate recognition/anchor
implementation and device testing; an ARKit map is not an Android map. The API keeps
route geometry separate enough to support that work later.

No perfect accuracy claim: lighting, blank/repetitive corridors, crowds, changed
surroundings and long walks can cause failure/drift. Publish short tested routes
first. If the layout is wrong, fix geometry; recognition does not fix a bad survey.

Before calling this ready: native Mac compile; successful floor capture/import;
paper-covered recognition on each floor; unchanged arrows from different headings;
tracking-loss/timeout recovery; stair/elevator transitions; ordinary-account and
second-iPhone downloads; failed network save preserves draft; stale publication
conflict; large upload through the real HTTPS proxy; Android shows unsupported
rather than fake AR.

No campus environment bytes, personal home model or camera photos are committed
with the source code. Captured home recordings are never uploaded by this flow.
