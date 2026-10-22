# Installed iPhone updates

`.github/workflows/frontend-update.yml` tests and publishes iOS frontend updates
when frontend changes reach `main`. The installed release app uses the `preview`
channel in the team's Expo project. GitHub requires the `EXPO_TOKEN` repository
secret, with access to that Expo project. Manual runs must also select `main`.

The workflow exports the bundle with
`EXPO_PUBLIC_API_URL=https://team43-api.3-27-96-180.sslip.io`, then uploads that
bundle without rebuilding it. This preserves the AWS API URL even when the EAS
environment has different variables. No backend deployment occurs in this job.

## Before merging

The current runtime policy is `appVersion`. For native changes (Expo or React
Native upgrades, native modules, native AR code, permissions or native plugins),
increase `expo.version` in `frontend/app.json` BEFORE publishing and rebuild the
iPhone app. Updates with the new version will not load on old builds. Do not
publish incompatible native changes under the existing version.

JavaScript, styles and supported assets can update without a new native build.
Backend changes must remain compatible with installed clients; the backend and
frontend workflows are independent and their completion order is not guaranteed.

## Testing delivery

1. Merge the Expo configuration, dependency lockfile and workflow into `main`.
2. Check GitHub Actions for a successful `Publish mobile frontend updates` run.
3. Open the installed release app with internet access and allow it to download.
4. Fully close and reopen it to apply the update; a second launch may be needed.
5. Verify login and the changed screen. An unchanged screen alone does not prove
   delivery; check the published update in Expo as well.

For a local installation, run `node scripts/private-ios-release.mjs --build`
from `frontend`. Run iOS prebuild first when native configuration changes.
Free Apple signing expires independently of EAS updates and requires periodic
reinstallation from Xcode. Metro is not needed for this release app.
