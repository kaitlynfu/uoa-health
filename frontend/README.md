# UoA Health frontend

The supported application is built with React Native, Expo and TypeScript. It runs in a browser and as Android/iPhone builds. The custom Swift module in `modules/wayfinder-ar/` supplies indoor AR on compatible iPhones.

Start with the [project README](../README.md) for the deployed application, platform coverage, dependency versions and submission links.

## Browser development

Use Node.js 24, matching CI. From the repository root:

```sh
cd frontend
npm ci
```

Create `.env` in this directory. Choose the deployed API for shared project data:

```dotenv
EXPO_PUBLIC_API_URL=https://team43-api.3-27-96-180.sslip.io
```

Or use `http://127.0.0.1:8000` after completing the [local backend setup](../backend/README.md#setup). This address is the API root; do not append `/app/` or `/docs`.

```sh
npm run web -- --port 8081
```

Open [localhost:8081](http://localhost:8081). Restart Expo after changing the API setting. Add `--clear` if a previous bundle retains its old configuration. Keep the development terminal running. The shared [hosted app](https://team43-api.3-27-96-180.sslip.io/app/) runs independently of it.

## Physical devices

Use the [standalone Android APK](../docs/ANDROID_TESTING.md) for external Android testing. No Expo Go or development server is needed for that build.

For native iPhone development, use a Mac with Xcode and signing configured. From a clean, up-to-date checkout:

```sh
cd frontend
npm ci
npx expo prebuild --platform ios
node scripts/private-ios-release.mjs --build
```

The release script embeds the hosted API address and JavaScript bundle. Connect and unlock the iPhone and choose it when prompted. Installing a new native version is required when native modules or permissions change. Expo Go cannot provide the custom AR module. The [campus guide](../docs/CAMPUS_WAYFINDING_SURVEY.md) explains editor access, route recording, publication and recognition.

To connect a development phone to a local backend, put both devices on a reachable network, start Uvicorn with `--host 0.0.0.0`, and set `EXPO_PUBLIC_API_URL` to the computer's LAN address, for example `http://192.168.1.20:8000`. `127.0.0.1` on the phone refers to the phone itself. Use a local development build for native features; see the [Android guide](../docs/ANDROID_TESTING.md) for standalone builds.

## Source layout

- `navigation/AppNavigator.tsx`: registered screens and navigation.
- `screens/`: account, catalogue, quiz, study journey, social and wayfinding screens.
- `components/`: reusable interface components, maps and route editor.
- `services/`: API clients, quiz scoring, navigation geometry and session helpers.
- `context/`: shared authentication and saved-item state.
- `modules/wayfinder-ar/`: Expo module configuration and Swift AR implementation.
- `assets/`: current branding and design source assets.
- `tests/`: Node-based regression checks.

Backend requests belong in the existing service modules (`api.ts`, `studentApi.ts`, `sharedRoutes.ts` and `campusRoutes.ts`). Reuse their authentication and error handling when connecting a screen. The current indoor flow uses environment recognition and published recordings. Earlier QR/camera walkthroughs are historical and are not the current navigation instructions.

## Checks

From `frontend`:

```sh
npx tsc --noEmit
npm run test:dependencies
npm run test:screens
npm run test:student
npm run test:wayfinding
```

The separate live API tests require a deliberately configured local test server. Do not point destructive integration scenarios at production accounts. The [backend guide](../backend/README.md#setup) creates isolated local fixtures.

## Release configuration

`app.json` defines native app/runtime version 1.3.0. `package-lock.json` locks the installed dependencies. Generated `ios/` and `android/` projects are recreated by Expo prebuild and are not committed. Preserve the existing Android signing key when rebuilding so installed testers can upgrade.

The preview builds subscribe to EAS Update. Compatible JavaScript/assets can update after publication and app restart; native changes require a new build and matching runtime. See [iPhone updates](../docs/IPHONE_UPDATES.md) and [Android testing](../docs/ANDROID_TESTING.md).

For the hosted browser export, set `EXPO_PUBLIC_API_URL` to the hosted HTTPS API and run `node scripts/export-web.mjs`. It writes ignored `dist-web/` assets; [the deployment workflow](../.github/workflows/backend-deploy.yml) packages them with the matching backend. See [web testing](../docs/WEB_TESTING.md) for cache behaviour and deployment details.
