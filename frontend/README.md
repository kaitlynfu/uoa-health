# CS399 Frontend

React Native frontend for the CS399 project, built with Expo and TypeScript.

The frontend communicates with the FastAPI backend through the API service in `services/api.ts`.

## Project Structure

```text
frontend/
├── assets/                 # Images and other static assets
├── components/             # Reusable UI components
│   └── ProgrammeCard.tsx
├── screens/                # Application screens
│   └── ProgrammesScreen.tsx
├── services/               # Backend API communication
│   └── api.ts
├── types/                  # TypeScript data types
│   └── programme.ts
├── .env.example            # Example environment configuration
├── App.tsx                 # Root React component
└── package.json
```

## Initial Setup

Install Node.js before running the frontend.

From the `frontend` directory:

```bash
npm install
```

Create a `.env` file inside `frontend` using `.env.example` as the template:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

Do not commit your `.env` file.

## Running the Backend

From the project root:

```bash
cd backend
```

Activate your Python virtual environment and start FastAPI:

```bash
python -m uvicorn app.main:app --reload
```

The API should be available at:

```text
http://127.0.0.1:8000
```

## Running the Frontend

Open another terminal:

```bash
cd frontend
npm run web
```

The web version will normally be available at:

```text
http://localhost:8081
```

## API Service

Frontend components should use the functions exported from:

```text
services/api.ts
```

rather than calling the backend directly with `fetch()`.

Available functions currently include:

```text
getProgrammes()
getProgramme(id)
searchProgrammes(query)
getProgrammeStats()
recommendProgrammes(query, limit)
getPersonalisedRecommendations(request)
```

## Wayfinding QR proof of concept

The first wayfinding milestone uses `expo-camera`, which is compatible with the
project's Expo SDK 57 setup and can be tested in Expo Go.

1. Start the app on a physical phone with `npm start`.
2. Open **Wayfinder** and tap **Scan QR checkpoint**.
3. Allow camera access when prompted.
4. Scan a QR code whose contents are `TEST_START`.
5. Confirm the app shows **Checkpoint found**, then tap **Use this checkpoint**.
6. Confirm the live-camera guidance preview opens at step 1.
7. Tap **Next instruction** through the straight, right-turn, and destination
   prompts, then confirm the **You've arrived** screen appears.

The guidance preview is deliberately manual: it overlays route instructions on
the live camera, but does not claim to track the phone's position or orientation.
This validates the full QR-to-guidance user flow before route data and movement
tracking are added.

Production-style labels should contain a URI such as:

```text
wayfinder://location/303-G-ENTRANCE
```

Bare codes are accepted for testing. Underscore codes such as
`303_G_ENTRANCE` are normalised to the hyphenated format used by the backend.
The scanner locks after the first result to prevent duplicate navigation and
provides explicit permission-denied, invalid-code, and scan-again states.

Camera scanning should be tested on the phone intended for the final demo. Web
and simulator builds are useful for layout checks but are not proof that QR
recognition works under real corridor lighting.

Example:

```ts
import { getProgrammes } from "../services/api";

const programmes = await getProgrammes();
```

## Programme Types

Backend programme data is represented by TypeScript interfaces in:

```text
types/programme.ts
```

Use these types when creating components or screens that work with programme data.

Example:

```ts
import { Programme } from "../types/programme";
```

## Frontend Development

UI development should primarily happen inside:

```text
components/
screens/
```

Reusable interface elements should go in `components/`.

Full application screens should go in `screens/`.

Avoid putting backend requests directly inside UI components. Add backend communication to `services/api.ts` so API access remains centralised.

## Physical Device Testing

`127.0.0.1` works when the frontend and backend are running on the same computer.

When using Expo Go on a physical phone, `127.0.0.1` refers to the phone itself. Change `EXPO_PUBLIC_API_URL` in your local `.env` to the computer's local network IP address, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

The phone and computer must be able to communicate over the same network.
