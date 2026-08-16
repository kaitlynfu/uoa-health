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