# CS399 Backend

FastAPI and SQLite backend for programme discovery and recommendations.

## Setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd backend
```

The SQLite database location is resolved from the `backend` directory. Starting
the API from another working directory therefore cannot accidentally create a
second database.

`DATABASE_URL` can select another database. `CORS_ORIGINS` is an optional,
comma-separated list of permitted frontend origins. See `.env.example`.

## Run

```powershell
python -m uvicorn app.main:app --reload
```

- API: <http://127.0.0.1:8000>
- Interactive documentation: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

## Data scripts

The seed and scraper update existing records instead of blindly duplicating
them, so they are safe to run repeatedly.

```powershell
python -m scripts.seed
python -m scripts.scrape_programmes
python -m scripts.sync_careers
python -m scripts.seed_journey
python -m scripts.seed_wayfinding
python -m scripts.seed_building_303
python -m scripts.check_programme_data
```

`seed_building_303` loads the GLB-matched Building 303 review graph. It remains
marked unverified and intentionally withholds two Ground-floor connections
where the source scan has no mesh. Complete the focused checks in
`docs/wayfinding/BUILDING_303_WALKTHROUGH.md` before enabling those links.

The scraper requires internet access and depends on the current University of
Auckland page structure.

`sync_careers` converts list-style career pathway data into searchable career
records and links them to programmes. Narrative paragraphs remain available in
the original `career_pathways` field but are not turned into fake job titles.

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
journey demo discovers supported programmes and plans from the API, so newly
seeded programmes appear without adding programme-specific demo controls.

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

The local account system is suitable for MVP development, but a public
production deployment would also need email verification, password reset,
rate-limiting, audit logging and an approved privacy/security review.

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

Open `/demo/profile` for the isolated live profile client.

## Campus and indoor wayfinding

The wayfinding MVP supports campus and building browsing, floor switching,
room/lecture-theatre/lab/facility search, and shortest-path directions. The
same route graph can join outdoor building entrances to indoor corridors,
stairs and elevators. Accessible routing excludes inaccessible locations and
connections.

```text
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

Open `/demo/wayfinding` for the isolated live test client. The included
Building 303 floor coordinates and route graph are explicitly demonstration
data, not an official accessibility or emergency map. Replace them with an
authorised UoA indoor dataset before production use.

## Tests

```powershell
python -m pytest
```
