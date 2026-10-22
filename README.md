# UoA Health

UoA Health is Team 43's COMPSCI 399 project at the University of Auckland. It helps prospective and current students explore health-related careers and programmes, track a study pathway, find study groups and navigate campus. One React Native/Expo application supports the browser, Android and iPhone; a Python API stores shared account and application data.

## Project and submission links

| Resource | Link or status |
| --- | --- |
| Deployed application | [Open UoA Health](https://team43-api.3-27-96-180.sslip.io/app/) |
| Class GitHub repository | [Team 43 source code](https://github.com/uoa-compsci399-s2-2026-jun/team-43-project), default branch `main` |
| Project coordination | [Team Discord] — used for team communication and coordination; we did not use a separate project-management board |
| Indoor walkthrough video | [Building 303 Entrance B to Room 104](https://drive.google.com/file/d/1cmfV8xS4h9tOTot66qLkYZo1_7HbUvzq/view) |
| Android installation | [Tester build and installation instructions](docs/ANDROID_TESTING.md) |
| Final group report | [Working report — draft, not yet final] — being prepared for the 30 October submission |
| Running web build | [Version and source commit](https://team43-api.3-27-96-180.sslip.io/app/build-info.json) |

The repository is private within the class organisation. Assessors need access through that organisation. The team must keep the deployed website and its backend available until final marks are released. The current Discord invitation expires on 16 November 2026; renew it if access is needed after that date.

## Try the application

Open the website in Safari, Chrome, Edge or another modern browser. No Expo installation, developer account or running development computer is required.

- Select **Continue as guest** to explore programmes, careers, the career quiz and outdoor directions. Guest preferences are temporary.
- Create an account to save items, retain preferences and use social features. Registration requires a display name, email address and a password of at least 10 characters. These are project accounts, not University SSO accounts.
- Use two separate accounts to test friend requests or messaging. A second browser profile or a second device keeps the sessions separate.
- On iPhone, Safari's **Share → Add to Home Screen** adds a shortcut to the browser app.

No shared administrator credentials are required for ordinary testing. Route publication and report moderation are restricted functions; contact the team for an assisted demonstration. Email delivery is not configured, so do not depend on email password recovery for a test account. Internet access is required for server-backed features.

### Platform coverage

| Capability | Browser, including iPhone Safari | Android APK | Native iPhone app |
| --- | --- | --- | --- |
| Programmes, careers, quiz and saved items | Yes | Yes | Yes |
| Study pathway and progress | Yes | Yes | Yes |
| Groups, friends and messages | Yes | Yes | Yes |
| Outdoor directions | Opens Google Maps | Opens Google Maps | Opens Apple Maps |
| Indoor AR on published routes | Unavailable | Unavailable | Compatible ARKit device required |
| AR route recording and publication | Unavailable | Unavailable | Authorised editor account required |

Outdoor directions and indoor AR are separate flows; the app does not switch between them automatically. A recorded route from Building 303 Entrance B to Room 104, a chemistry lab, was demonstrated to the client. This does not imply complete building coverage or successful recognition on every device. Follow the available published route catalogue and the [campus survey and testing guide](docs/CAMPUS_WAYFINDING_SURVEY.md).

## Features and example journeys

1. **Explore careers and programmes:** browse or search a career, open its linked programme pathways and inspect entry information and courses. Save a career or programme and reopen it from Saved. Saving a career bookmarks it; it does not unlock additional pathways.
2. **Career interest quiz:** answer six questions, review the suggested interest areas and their explanations, then explore related careers and programmes. Saving interests is optional. This is an exploration aid, not an aptitude test or an admissions decision.
3. **Study journey:** choose a supported programme and plan, view its stages and milestones, and update personal progress. Select **Edit course** beside a milestone to enter the actual elective/course name and an optional course code. Personal labels are saved to your account across devices; **Restore original label** resets them. Labels do not change points, completion or the shared programme requirements. Official University requirements remain authoritative.
4. **Study groups and messaging:** find or create a group, join it with another account and exchange messages. Test friend requests, direct conversations and unread indicators. Groups currently use public joining rather than private invitation-only membership.
5. **Outdoor navigation:** choose a campus building and travel mode, then open Maps for directions. Building coverage is limited to the available catalogue.
6. **Indoor navigation:** use the native iPhone app, sign in, choose a published route and recognise a recorded floor before following the arrows. Floor transitions require recognition on the next recorded floor. A fresh local database does not contain the live AR recordings.

Account settings also include profile editing, password change, data export/deletion and reporting/blocking. In-app activity is supported; lock-screen push notifications are not implemented.

## Architecture and technologies

```text
Browser / Android / iPhone
          |
          | HTTPS API requests
          v
FastAPI application on AWS EC2 ---- PostgreSQL
          |
          +-- public browser export at /app/

Native iPhone only: local Swift module -> ARKit / SceneKit
Outdoor directions: external Apple Maps or Google Maps
```

The frontend uses TypeScript and JavaScript; the backend and data scripts use Python and SQL; the native indoor module uses Swift. GitHub Actions checks changes, deploys the API and web export, and publishes compatible mobile updates. Production uses PostgreSQL; local development can use SQLite.

| Component | Version used in this repository |
| --- | --- |
| Python | 3.12 in CI |
| Node.js | 24 in CI |
| Expo | 57.0.26 in `package-lock.json` |
| React / React DOM | 19.2.3 |
| React Native / React Native Web | 0.86.3 / 0.21.2 |
| TypeScript | 6.0.3 |
| React Navigation native / native stack | 7.3.16 / 7.18.8 |
| Expo AR integration | `@stewmore/expo-ar` 0.2.2 |
| Native indoor module | Swift 5.9 language setting; Apple ARKit and SceneKit |
| FastAPI / Uvicorn | 0.141.1 / 0.52.1 |
| SQLAlchemy / Alembic | 2.0.51 / 1.20.0 |
| PostgreSQL driver | Psycopg 3.3.5 |
| PostgreSQL | 16 tested in CI |
| Requests / Beautiful Soup | 2.34.2 / 4.15.0 |
| EAS CLI | 24.6.0 in the release workflow |

The complete frontend dependencies and exact resolved versions are in [package.json](frontend/package.json) and [package-lock.json](frontend/package-lock.json). All backend package pins are in [requirements.txt](backend/requirements.txt); backup-tool dependencies are in [backup-requirements.txt](deployment/backup-requirements.txt). The app's native release/runtime version is **1.3.0**, specified in [app.json](frontend/app.json); the private npm package version is separate.

## Installation and setup

### Prerequisites

- Git and access to the class repository.
- Node.js 24 with npm for the frontend.
- Python 3.12 with `venv` and pip for a local backend.
- A current browser for web development. Native iPhone builds additionally require a Mac, Xcode, signing and a compatible physical iPhone. Expo Go cannot load this project's custom native indoor module.

Clone the repository and install the locked frontend dependencies:

```sh
git clone https://github.com/uoa-compsci399-s2-2026-jun/team-43-project.git
cd team-43-project/frontend
npm ci
```

Create `frontend/.env` with **one** API address. To use the deployed project backend:

```dotenv
EXPO_PUBLIC_API_URL=https://team43-api.3-27-96-180.sslip.io
```

Start the browser app from `frontend`:

```sh
npm run web -- --port 8081
```

Open [localhost:8081](http://localhost:8081). Keep this terminal running while using the local development app. The shared deployed website does not require this terminal. Changes to `.env` require restarting Expo; use `npm run web -- --port 8081 --clear` if it retains an old address.

### Run the full stack locally

Follow the [backend setup](backend/README.md#setup) to create a Python environment and an isolated, populated SQLite database. The local fixtures include three test accounts and synthetic catalogue data; they are not production credentials or academic guidance. The database is created only when absent, preserving existing work.

Then set `frontend/.env` to:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

Run the backend on port 8000 and the frontend on port 8081 in separate terminals. API documentation is available at [localhost:8000/docs](http://localhost:8000/docs). When testing a physical phone against a local server, use the computer's reachable LAN address instead of `127.0.0.1`; see the [frontend guide](frontend/README.md).

The backend reads configuration from the process environment; copying `backend/.env.example` alone does not load it. No AWS account, AWS keys or production database access is required for local testing. PostgreSQL deployment and migration procedures are documented in [deployment/README.md](deployment/README.md).

### Native builds and updates

- Android: follow [Android testing](docs/ANDROID_TESTING.md) for the standalone APK or an EAS rebuild.
- iPhone: follow [the campus guide](docs/CAMPUS_WAYFINDING_SURVEY.md) and the existing local Release build script. Signing validity is separate from app updates.
- Compatible JavaScript/assets can reach installed preview builds through EAS Update after the main-branch workflow succeeds. Native module or permission changes require a compatible new native build. Updates are not instant on an already open screen.
- The website is rebuilt by the backend deployment workflow for relevant changes on `main`. Refresh the browser to load a new deployment. See [web deployment details](docs/WEB_TESTING.md).

## Verification

From `frontend`:

```sh
npx tsc --noEmit
npm run test:dependencies
npm run test:screens
npm run test:student
npm run test:wayfinding
```

With the Python virtual environment active, run the backend tests from `backend`. Set `DATABASE_URL` to `sqlite://` for the test process to avoid initialising a development database; the fixtures use their own isolated database. See the platform-specific commands in the [backend guide](backend/README.md#tests).

From the repository root, run the deployment-tool tests:

```sh
python -m unittest discover -s deployment -p 'test_*.py' -v
```

GitHub Actions also rehearses migrations and runs the API suite against PostgreSQL 16. Automated checks do not establish physical AR accuracy or usability on every phone. Initial Android friend feedback and the client demonstration were positive; broader task-based, cross-device and repeat-route validation remains work in progress. Use the [assessor walkthrough](docs/SUBMISSION.md) for a short functional check.

## Repository guide

| Path | Purpose |
| --- | --- |
| `frontend/` | Supported application, native indoor module and frontend tests |
| `backend/` | API, database models, migrations, data scripts and backend tests |
| `deployment/` | Reviewed AWS deployment, backup and migration tooling |
| `docs/` | [Current guides and feature documentation](docs/README.md) |
| `.github/workflows/` | Automated checks, deployment, backups and mobile updates |
| `archive/` | Retired prototypes and dated development records; not the supported application |

Generated native projects, dependencies, database files, local environment files and build exports are excluded from Git. Historical records are retained for traceability; their dated setup and release status should not be used as current instructions.

## Future work

- Repeat the demonstrated indoor route under different starting positions and conditions, including recognition on another compatible iPhone; record failures and recovery before expanding coverage.
- Add reviewed routes and building coordinates, and evaluate step-free journeys independently before describing them as verified.
- Broaden Android and browser testing with recorded tasks, assistance needed and repeat checks after fixes.
- Validate career-to-programme relationships with subject specialists and maintain catalogue years and official source links.
- Explore Android indoor AR, email verification/recovery delivery and device push notifications after the current core flows are accepted.
- Agree longer-term hosting, support, report handling and data-retention responsibilities with the client. University SSO would require an approved integration.

## Team and acknowledgements

| Team member | Main contributions |
| --- | --- |
| Avinash Rajaram | Backend and database, integration and deployment, indoor wayfinding, UI refinement and client demonstrations |
| Kaitlyn Fu | Figma prototypes and frontend screen design/implementation |
| Mary Joyce Fasitaue | Frontend implementation/support and team deadline coordination |
| Anton Mischler | Social functionality, client questions and requirements discussion |
| Jay Patel | Outdoor/between-building navigation, frontend support and testing |

We thank **Murray**, our client, for his time and feedback; **Jun** for helping resolve technical problems and supporting the project; and the medical and biomedical science students who tried the Android build and shared feedback.

Programme and career information draws on University of Auckland study and catalogue pages and the official sources linked in the app. Source URLs are retained with programme records and in [career_content.json](backend/app/data/career_content.json); see the [career content notes](docs/APP_COMPLETION_2026_10_15.md#career-content-and-qualifications). These links support exploration and do not replace official admissions or professional-registration advice.

The project uses Expo, React Native, React Navigation, FastAPI, SQLAlchemy, Alembic, Psycopg, Requests, Beautiful Soup and Apple ARKit/SceneKit. The Expo starter licence is retained in [frontend/LICENSE](frontend/LICENSE), and dependency licences remain with their packages. AI assistance was used during development and documentation; the team remains responsible for reviewing and verifying the submitted work.
