# Career interest quiz

Career Alignment → Take Quiz now opens an introduction, six questions and a results page. Each question accepts one or two choices. Previous answers stay selected when going back; reviewing answers recalculates results and retaking clears the quiz answers.

The five interest areas are Clinical, Research, Public Health, Mental Health and Tech, matching the existing career explorer categories. Every question contributes one point, split equally between two choices. Positive areas are shown in descending order, equal scores share a place, and results cite the selected answers. This is an interest exploration tool, not an aptitude, admissions or suitability assessment.

Results load actual careers from `/careers`, use existing category grouping for examples, and link to career details and their server-linked programmes. Programme suggestions use the existing public `/programmes/recommend/personalised` endpoint with quiz keywords. No career IDs, programme links or admission claims are invented. API failures retain the quiz summary with retry; empty lists provide browse actions.

Completing the quiz does not write the profile. “Add results to For you” explicitly merges interests and career area keywords with the latest server profile, preserving existing terms and unrelated profile fields. Case-insensitive duplicate terms are removed; exceeding the server's 30-term limit produces an explanation without discarding data. Guests can apply preferences to the current session. The navigation's existing session wrapper resets quiz state on account changes, and asynchronous response updates are cancelled on unmount.

Question controls have checkbox semantics, progress is announced, selected counts explain the limit, and the layout uses the app's safe areas, teal cards and bottom bar.
