# Browser tester app

The current Expo app is exported and packaged with the matching backend release. GitHub Actions builds it from the exact commit, includes only public build assets, validates the complete archive and uses the existing guarded deployment. Main pushes touching frontend files also refresh this website.

Tester URL after deployment: https://team43-api.3-27-96-180.sslip.io/app/

Open in Safari on iPhone or a modern desktop/mobile browser. No Expo Go, developer account, signing renewal or running laptop is required. The app uses the existing AWS API, accounts and saved data. Safari Share → Add to Home Screen creates a shortcut. The browser version supports the quiz, catalogue, groups/messages and outdoor Maps directions. Indoor AR still requires a compatible native iPhone app and is unavailable in the browser.

The API root, health checks and authenticated endpoints retain their existing routes. The app lives at /app/; generated Expo scripts/fonts/images use /_expo/ and /assets/. These mounts expose only the public export, never the repository or backend directory. No database migration, seed, AWS resource or separate CORS allowance is added.

The web manifest uses /app/ as its scope and starting URL. No service worker or offline API cache is introduced. Internet is required for server features. /app/build-info.json identifies the source commit and app version. HTML and build metadata require revalidation, so a normal reload obtains the current deployment. An already open page retains its loaded code until refreshed.

Local build: from frontend set EXPO_PUBLIC_API_URL to the hosted HTTPS API and run node scripts/export-web.mjs. The generated dist-web directory is ignored by Git. The deployment dispatcher accepts it only when build-info.json matches GITHUB_SHA and the reviewed API URL. Static checkout builds without a public export simply omit these web mounts.
