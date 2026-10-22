# Source code submission and assessor access

## Submission text

**Project:** UoA Health, COMPSCI 399 Team 43.

**Website:** https://team43-api.3-27-96-180.sslip.io/app/

**Source code:** https://github.com/uoa-compsci399-s2-2026-jun/team-43-project — submit the final reviewed version on `main` in this class repository.

**Project coordination:** https://discord.gg/pnvHMGvEs — team communication and coordination used Discord rather than a separate task board.

**Testing access:** choose Continue as guest for public catalogue, quiz and outdoor directions. Create a project account for saved items, study progress and social features. Registration requires a password of at least 10 characters. Use two accounts for messaging. No shared administrator or AWS credentials are required. Email recovery delivery is not configured.

**Android:** see [APK access and installation](ANDROID_TESTING.md). The browser app provides the durable assessment entry point; renew the APK's distribution link if native Android installation is required after its retention date.

**Indoor wayfinding:** compatible native iPhone app only. The browser and Android versions cannot run indoor AR. [The demonstration video](https://drive.google.com/file/d/1cmfV8xS4h9tOTot66qLkYZo1_7HbUvzq/view) shows the Building 303 Entrance B to Room 104 route. Contact the team if native testing access or video permission is needed.

**Group report:** [Working report — draft, not yet final](https://docs.google.com/document/d/1XAlQhWAdhPyq0UBgaFUu8WeM6jmUAar-/edit). This document is still being prepared for 30 October.

## Suggested assessor walkthrough

| Task | What to check |
| --- | --- |
| Guest exploration | Enter as a guest; browse a programme and its courses, and open a career's linked programmes |
| Quiz | Complete the six questions, inspect explanations and open a real suggested career/programme |
| Saved items | Register/sign in, save a programme or career, reopen Saved and confirm the item remains after signing in again |
| Study journey | Choose a supported plan, open a milestone and update personal progress |
| Social | Use two accounts to join the same group and exchange messages; also exercise friend requests and direct messaging |
| Outdoor directions | Choose a building and travel mode, then open the external Maps directions |
| Indoor demonstration | Watch the route video, or use an authorised native iPhone setup in the recorded building area |

Record the device/browser, app update or web commit, attempted task, result and any assistance needed. Successful browser tests do not validate native AR tracking. A single campus walkthrough does not establish whole-building or cross-device coverage.

## Final submission checks

- Merge the final reviewed code and documentation to `main` and check its required GitHub Actions results.
- Confirm the class assessors can access the private repository, the website and the video.
- Keep AWS hosting, the database, TLS and backups operating until final marks are released. Confirm arrangements before stopping or transferring the service.
- The Discord invite expires on 16 November 2026; renew it if marking access is needed afterwards.
- Finalise the linked working report for 30 October, confirm assessors can access it, and update its draft label only when the report is complete. Do not present the working draft as the submitted final report.
- If a specific native Android build must remain downloadable, retain the APK and provide a replacement distribution link before its EAS artifact expires.

No live database, personal account export, `.env` file, signing key or AWS credential is part of the source-code submission. Local-only fixture credentials are documented in the [backend guide](../backend/README.md) and apply only to an isolated development database.
