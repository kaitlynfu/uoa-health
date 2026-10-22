# Android tester build

## Install the current build

The 16 October tester release is **UoA Health 1.3.0**, Android version code **3**:

- [Download the APK](https://expo.dev/artifacts/eas/jKyFQ0WMHliepyPcHXXawllg-FDSma3iI4K0JxyT6Dg.apk)
- [EAS build record](https://expo.dev/accounts/avinashrajarams-team/projects/frontend/builds/72817ccf-94cf-4961-89e8-a49ed28015d6)
- SHA-256: `6375cf79342e52e0975cbd8b8111ee7181dc0af95690085263e2bfe112b83d7c`

Open the APK link on an Android phone, download it and allow installation from that browser when prompted. Expo Go, an Expo account, a Google Play account and a development computer are not required. The app uses the deployed AWS API and requires internet for server features.

The initial APK bundles source commit `91ef86f`; compatible preview updates can replace its JavaScript/assets after installation. Check the app's update details when recording test results. Initial friend feedback has been positive, but broad device coverage and update delivery still need recorded testing.

EAS artifact retention is separate from the installed app's validity. The build record's artifact expiry is 29 October 2026 UTC. Do not rely on this download link for long-term marking access: use the [hosted browser app](https://team43-api.3-27-96-180.sslip.io/app/), or have the team renew distribution of the retained APK before that date. An already installed APK does not expire on the artifact-retention date.

## Suggested checks

1. Open the app with the development computer disconnected.
2. Explore as a guest, complete the career quiz and open a suggested career and programme.
3. Register/sign in, save an item, restart and reopen it.
4. Use two accounts to join a study group and exchange messages; check the inbox and conversation refresh behaviour.
5. Edit profile information and check that the app reflects the change.
6. Choose an outdoor destination and open Maps.

The inbox refreshes while visible/foregrounded and also offers manual refresh. Chat and in-app activity have their own refresh behaviour. Lock-screen push notifications are unavailable. Indoor AR is native-iPhone-only; Android supports the other application features and outdoor Maps directions.

## Rebuild from source

Use Node.js 24 and an Expo account with access to the existing project. From a current checkout of `main`:

```sh
cd frontend
npm ci
npx eas-cli@24.6.0 build --platform android --profile android-preview
```

Use the existing Expo project `@avinashrajarams-team/frontend` and Android signing key. The `android-preview` profile creates a standalone release APK, embeds the AWS API URL, disables local dotenv overrides and subscribes to the `preview` channel. Retain the APK and build receipt for distribution.

## Updates

After relevant frontend changes reach `main`, `frontend-update.yml` tests and exports Android/iOS bundles, checks backend compatibility, then publishes to preview using the configured `EXPO_TOKEN` secret. Downloads normally apply on a later restart, not instantly within an open screen.

The app uses the `appVersion` runtime policy. Native dependency, native module or permission changes require an appropriate app-version/runtime change and a new build. A successful export or publication alone does not prove that a tester's phone installed the update.

Record the installed update, fully close/reopen online, allow the download and reopen again to verify delivery. Unmerged branches and uncommitted work are not included automatically. Remote tester builds must use the hosted API, not localhost or a developer's LAN address.
