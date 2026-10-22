# UoA Health usability refresh

- Home includes Explore programmes above the personalised saved-items shortcut. Guests still see only one programme shortcut.
- Shared headers, cards and secondary actions use consistent spacing, colours and touch targets. Plain header descriptions wrap without rounded-corner clipping.
- Onboarding and For you now use the shared UoA Health name too.
- Friends separates Friends, Requests and Find people, with Received/Sent request tabs. Existing friends have a chat shortcut and a separate management menu with removal confirmation.
- Messages prioritises recent conversations and entry points through Friends and My groups. The user-facing conversation-ID form is removed. Discovery preferences remain available.
- Study groups, search, joined/saved lists, creation and details share the same visual language. Search filters are expandable and can be cleared. Group details prioritise joining/chatting and saving. Management is expandable; transferring ownership now selects an existing member by name and requires confirmation.
- Indoor wayfinding introduces Choose a route → Look around → Follow the arrows. Available routes, device compatibility and the unpublished-route empty state are separate. Editor tools are restricted to existing editor access and collapsed initially. AR recognition, route geometry, publication, recording and unsaved-session guards retain their existing implementation.
- Career details prominently show What could I study? and the backend's linked programmes, with entry-requirement/course links, loading/retry states and a catalogue fallback when no relationships exist. No programme relationships are invented.

## Validation

TypeScript, the 23 screen/layout checks, 18 student/social checks and 47 wayfinding checks passed during implementation. Web, iOS and Android bundle exports succeeded. The initial native export was blocked by Windows sandbox temporary-file permissions; the local export succeeded with the required filesystem permission.

Browser checks at 390 px and 320 px cover messages, friend search and request tabs, joined groups, group details and management, the group edit form, Home → Programmes, Career → linked Programme, Indoor introduction and editor disclosure. Existing live account data was used for read-only navigation/search. No group, friendship, ownership, message or route publication was submitted during UI verification. Camera/AR operation and physical iPhone keyboard behaviour still need device testing.

The current backend returned no published Building 303 routes. The redesigned screen explains that state; it does not make unpublished routes available to users.

Changes are local until merged and an app update is published.
