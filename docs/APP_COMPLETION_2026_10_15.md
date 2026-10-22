# App completion fixes — 15 October 2026

This change addresses the October 15 audit on main `5c5901d`. Release confirmation is recorded separately; implementation here does not prove a phone update has installed.

## User-facing changes

- Saved items have Retry/Refresh and refresh on foreground/focus. A temporary failure no longer requires signing out. Request generations prevent an old load overwriting a later account or bookmark update.
- Career lists refresh on focus and have retry controls. Public catalogue/Maps requests use the same bounded request/error handling as student requests.
- Incoming-request notifications open Requests/Received. Find a friend opens Find people.
- Editing a name refreshes the shared session user and encrypted saved session, so the greeting and sidebar update.
- The Messages inbox refreshes while visible/foregrounded as well as manually. Chat history and in-app activity retain their separate refresh behaviour.
- The six-question career quiz now includes an introduction, back/review/retake, explainable interest areas, actual career/programme suggestions and explicit opt-in saving that merges existing interests. It does not claim to assess aptitude or admission.
- Programme Courses shows actual public plans and milestones for the selected programme/year, even for guests. A preview does not expose another user's progress or change the current journey. Choosing a journey carries the programme forward.
- Groups can be shared through the phone share sheet with their name and instructions for finding/joining them. They remain public-join; this is not a private invitation link.
- Users can see their own submitted support/safety report status. Other users cannot read it; moderator report review remains separately authorized.
- The inactive push switch is removed. Settings exposes working in-app activity preferences and explains that lock-screen alerts are unavailable.
- Email recovery/verification checks server availability before presenting a code form. Delivery is the user's last priority and is not provisioned by this release.
- Profile no longer claims every user is affiliated with the University. About scrolls for large text; password-change content clears the bottom navigation.
- Removed unused Placeholder, Dashboard and original ID-based SocialTools screens/routes. The source remains recoverable in Git history. Current compass, drawer, named social features and authorized AR editor are retained.

## Career content and qualifications

`backend/app/data/career_content.json` supplies short editorial summaries and official source links for the 43 existing career names. Sources were checked on October 15. Existing non-empty database descriptions/URLs take precedence; missing fields are supplemented at serialization. This avoids rewriting user saves, original scraped data or career IDs. No startup seed or schema migration is needed, and requests do not commit these supplements to the database.

The additional reference connections are deliberately narrow: Medicine → MBChB; Public Health → BHSc; Research → BBiomedSc/BSc. Both programme and career endpoints expose the same connections. These are study-area links, not eligibility or professional-registration decisions.

Physiotherapy links to [AUT's accredited programme information](https://www.aut.ac.nz/study/study-options/health-sciences/courses/bachelor-of-health-science-in-physiotherapy). No unsupported UoA qualification link is invented. The [Certificate in Health Sciences](https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/certificate-in-health-sciences-certhsc.html) remains a preparation pathway rather than a stand-alone occupational qualification.

Other sources: [Biomedical Science](https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/bachelor-of-biomedical-science.html), [Health Sciences](https://www.auckland.ac.nz/en/study/study-options/find-a-study-option/bachelor-of-health-sciences-bhsc.html.html), [Nursing](https://www.auckland.ac.nz/en/fmhs/study-with-us/career-options/nursing.html), [Pharmacy](https://www.auckland.ac.nz/en/fmhs/study-with-us/career-options/pharmacy.html), [Optometry](https://www.auckland.ac.nz/en/fmhs/study-with-us/career-options/optometry.html), [Medicine](https://www.auckland.ac.nz/en/fmhs/study-with-us/career-options/medicine.html), [Sport/health/PE](https://www.auckland.ac.nz/en/arts/study-with-us/career-options/education-social-work/sport-health-and-physical-education.html), and [BSc health majors](https://www.auckland.ac.nz/en/science/study-with-us/study-options/ug-study-options/health-majors-science.html).

The descriptions are brief explanatory summaries of career areas, not employment, registration or salary guarantees. Programme dates/requirements must still be checked in the official source. The app now has an actual source button on career details.

## Release and moderator configuration

Backend/frontend share `app_completion: 1`; frontend publication waits for the matching backend. Runtime remains 1.3.0 because this release adds no native dependency or native implementation. Existing compatible installs can receive the JavaScript update. A phone must still confirm its running update ID; an old signed native app may need renewal independently.

The user selected `test@example.test` for report moderation. `backend/scripts/grant_report_moderator.py` resolves that existing active account once against the live database and grants its immutable ID, preserving existing moderator IDs. It previews by default. `--apply` uses the deployment lock, writes a separate systemd override, retains a recovery copy, restarts/verifies service health and restores the old configuration if verification fails. It never creates an account or grants access by a future reusable email match. It ships inside the backend release; run it on EC2 as root from the active backend's scripts directory after deployment. The moderator should sign in and open Settings → Safety & support → Review project reports.

## Remaining external work

- Run the moderator helper on the actual server and confirm the chosen account can review a disposable report.
- Complete the two-account phone checklist: cold restart/account switching, saved-item reconnect recovery, name/photo, programme preview, quiz results/save, friend notifications, group sharing and ownership, direct/group chat/read counts, block/report and account export/deletion with disposable data.
- Confirm the latest runtime/update details on the phone; this environment cannot install or operate the user's iPhone.
- Survey, record, publish and walk an actual indoor route, then recognise it on a second iPhone. Backend deployment cannot create a physical recording. Check camera denial, tracking loss/recovery, floor changes and arrival.
- Confirm intended outdoor building coverage. Four reviewed production building records do not constitute a complete campus map; new coordinates need a reliable source and on-site validation.
- Finish the team's retention/privacy-contact and report-response decisions. Export/deletion behaviour is implemented; do not invent a policy on the client's behalf.
- Keep device push, Google sign-in and Android indoor AR as explicit additional scope. No APNs/FCM service, paid email service or Android AR implementation is provisioned here.
- Email provider setup and real reset-email delivery are deferred until the higher-priority work is accepted, as requested.
- Existing dependency mitigation checks remain enforced; replacing the temporary backports with compatible maintainer fixes remains maintenance work.
