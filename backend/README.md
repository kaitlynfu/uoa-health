# UoA Health backend

FastAPI provides programme/career discovery, accounts, study journeys, social
features and campus route publication. The hosted application uses PostgreSQL;
SQLite is available for local development. See the [deployment guide](../deployment/README.md)
and [PostgreSQL runbook](../deployment/POSTGRESQL.md) for production operations.

## Setup

Use Python 3.12. From the repository root, create a virtual environment and install
the pinned dependencies. Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cd backend
```

macOS/Linux:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd backend
```

### Populate an isolated local database

The integration seed creates a **new local SQLite database** with nine synthetic
programmes, linked careers, study journeys, a demonstration route graph and social
fixtures. It needs no AWS access or live website scraping. These records are for
software testing, not academic guidance. Published native AR recordings are not
included.

Windows PowerShell, from `backend`:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
python -m scripts.seed_integration
$env:DATABASE_URL = 'sqlite:///./.integration-local/integration.db'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

macOS/Linux, from `backend`:

```sh
unset DATABASE_URL
python -m scripts.seed_integration
export DATABASE_URL=sqlite:///./.integration-local/integration.db
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The seed refuses an existing database and refuses any supplied `DATABASE_URL`.
On later runs, skip seeding, set the same URL and start the server; existing data
is preserved. Keep this test server local.

Local fixture accounts: `alice@example.test`, `bob@example.test` and
`outsider@example.test`. Their shared **local-only** password is
`Team43-Local-Only-2026!`. These are not accounts for the deployed website and must
never be seeded into a public database.

- API: <http://127.0.0.1:8000>
- Interactive documentation: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

In another terminal, follow the [frontend setup](../frontend/README.md) with
`EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` and port 8081.

### Configuration

Configuration is read from the process environment. Copying [.env.example](.env.example)
does not load it automatically. With no `DATABASE_URL`, the default SQLite file
is `backend/health_app_v2.db`; starting a new unseeded database does not populate
the catalogue. Custom relative SQLite URLs resolve against the working directory,
so run the commands above from `backend`.

`CORS_ORIGINS` accepts comma-separated frontend origins. Localhost/127.0.0.1 on
port 8081 are allowed by default. A local PostgreSQL database must be separately
created and migrated using `alembic upgrade head`; production migrations require
the reviewed deployment procedure. Do not point local seed scripts at production.

## Data maintenance scripts

For a new developer checkout, prefer `seed_integration` above. The individual
maintenance scripts serve different purposes and are not a generic setup sequence:

| Script (`python -m scripts.<name>`) | Purpose / constraint |
| --- | --- |
| `seed` | Small initial programme seed; not a complete catalogue |
| `scrape_programmes` | Fetch official programme pages; requires internet and depends on their structure |
| `sync_careers` | Convert structured career entries into linked searchable records |
| `seed_journey` | Synchronise supported study plans; requires programme records and can remove obsolete milestones/progress |
| `seed_wayfinding` | Create demonstration campus/building/route data |
| `seed_campus_buildings` | Add approximate building coordinates for local testing |
| `seed_building_303` | Load the review graph; unverified links remain restricted |
| `check_programme_data` | Check programme data completeness |

Review the target database and each script before use; back up persistent data
before maintenance. Do not run these automatically during deployment. The scraper
and seeds are not substitutes for verifying content and routes with the client.
See [the Building 303 walkthrough](../docs/wayfinding/BUILDING_303_WALKTHROUGH.md).

## Programme and career API

Existing clients can continue calling `GET /programmes` without parameters and
will receive the original list response. Optional filters and pagination are:

```text
GET /programmes?faculty=Science
GET /programmes?duration=Full-time%3A%203%20years
GET /programmes?career=researcher
GET /programmes?offset=0&limit=20
```

Additional discovery endpoints:

```text
GET /programmes/options
GET /programmes/{programme_id}
GET /careers?q=researcher
GET /careers/{career_id}
GET /careers/{career_id}/programmes
```

Programme details include a structured `careers` list in addition to the
original `career_pathways` text. `/programmes/options` provides the available
faculty, duration and career values for frontend filters.

## Accounts and student journey

The MVP includes local email/password accounts so progress belongs to a student.
Passwords are stored using salted PBKDF2 hashes and API access uses expiring,
opaque bearer tokens. This identity layer is intentionally separate from UoA
SSO and can be replaced if the University provides an approved integration.

```text
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/logout
```

Authenticated journey endpoints expect the access token in this header:

```text
Authorization: Bearer <access_token>
```

Journey endpoints:

```text
GET   /journey/programmes/{programme_id}/plans?catalogue_year=2027
GET   /journey/programmes/{programme_id}/milestones?catalogue_year=2027&plan_code=COMH_CLINICAL
PUT   /journey/me/programme
GET   /journey/me
PATCH /journey/me/milestones/{milestone_id}
```

The 2027 Bachelor of Health Sciences journey supports Community Health and
Health Systems & Data Analytics majors. Each major has a clinical-selection
first-year pathway and a standard pathway, where the three clinical science
courses are replaced by Stage I electives. Plans are independently identified
by `plan_code` and versioned by catalogue year so courses and progress cannot
be mixed between pathways or cohorts. Each plan tracks semester-level courses
and choices across all three stages, totalling 360 points plus Academic
Integrity. The official catalogue remains authoritative; students should use
Student Hubs for personalised degree-planning advice.

The 2027 Bachelor of Nursing journey is also supported. Its single fixed plan
tracks Part I foundation courses and competencies, the two 60-point Part II
courses, and the two 60-point Part III clinical nursing courses. The local
API exposes supported programmes and plans for clients to discover dynamically.

The 2027 Bachelor of Pharmacy journey covers all 480 points across Parts I–IV.
It includes the Part I entry courses and electives, the required Waipapa
Taumata Rau course, PHARMACY 199 competency, pharmaceutical practice courses,
and the final-year research inquiry and medicine optimisation courses.

The catalogue also includes complete point-tracking plans for Optometry (600),
Medicine and Surgery (720), the Certificate in Health Sciences (120),
Biomedical Science (360), and Sport, Health and Physical Education (360).
Bachelor of Science students can select one of six separate 360-point health
major plans: Cell and Molecular Bioscience, Exercise Sciences, Medicinal
Chemistry, Nutrition, Pharmacology, or Physiology. Fixed programmes display
their named courses; flexible programmes retain clearly labelled choice and
elective slots so the tracker does not invent a compulsory course selection.

The account service includes password changes, recovery/verification endpoints and
request throttling. Email delivery is not configured in the assessment deployment,
so email-based recovery and verification are not available to testers. University
SSO, broader operational monitoring and an approved privacy/security review remain
future work before an institutional rollout.

Student personalisation is available through an authenticated profile API.
Profiles store structured courses, interests, hobbies, career interests and
study preferences for future peer matching. Matching is disabled unless the
student explicitly opts in. Saved programmes and careers are private to the
signed-in account.

```text
GET    /profile/me
PATCH  /profile/me
POST   /profile/me/saved-programmes/{programme_id}
DELETE /profile/me/saved-programmes/{programme_id}
POST   /profile/me/saved-careers/{career_id}
DELETE /profile/me/saved-careers/{career_id}
```

Use the React Native/Expo frontend in `frontend/` to access the app. Retired
browser prototypes are kept in `archive/legacy-demos/` for reference and are
no longer served by the API.

## Campus and indoor wayfinding

The current iPhone flow uses authenticated `/navigation/campus/catalog`,
`/navigation/campus/routes/{key}/{revision}`, and editor-only
`/navigation/campus/template` / `POST /navigation/campus/publish`.
Publication includes matching edited geometry and ARKit environment recordings,
not just waypoint JSON. Alembic revision 0003 adds the publication table.
See [deployment gates and on-site instructions](../docs/CAMPUS_WAYFINDING_SURVEY.md).
The graph APIs below remain for compatibility; they do not publish AR recordings.

The wayfinding MVP supports campus and building browsing, floor switching,
room/lecture-theatre/lab/facility search, and shortest-path directions. The
same route graph can join outdoor building entrances to indoor corridors,
stairs and elevators. Accessible routing excludes inaccessible locations and
connections.

```text
GET  /navigation/buildings?q=
GET  /navigation/building-route?from={building_id}&to={building_id}&accessible_only=
GET  /campuses
GET  /campuses/{campus_id}
GET  /campuses/{campus_id}/buildings
GET  /buildings/{building_id}
GET  /buildings/{building_id}/floors
GET  /buildings/{building_id}/locations
GET  /navigation/destinations?building=303&q=lab
GET  /navigation/route?start=303-G-ENTRANCE&destination=303-153/1
GET  /wayfinding/search?q=303-201
POST /wayfinding/routes
```

The `/navigation/*` contract separates user-visible destinations from graph
nodes. A destination may therefore map to multiple door nodes, and routing
selects the closest reachable door. Add `accessible_only=true` to exclude
stairs and other inaccessible nodes or connections. The older
`/wayfinding/*` routes remain available for existing clients.

Use the phone app for wayfinding testing. The included
Building 303 floor coordinates and route graph are explicitly demonstration
data, not an official accessibility or emergency map. Replace them with an
authorised UoA indoor dataset before production use.

## Tests

From `backend`, with the virtual environment active:

```powershell
$env:DATABASE_URL = 'sqlite://'
python -m pytest -q
```

On macOS/Linux:

```sh
DATABASE_URL=sqlite:// python -m pytest -q
```

Test fixtures use isolated databases. Restore your local `DATABASE_URL` before
starting the app again. GitHub Actions additionally checks PostgreSQL 16 and the
Alembic migration path. Never run tests against the deployed database.
