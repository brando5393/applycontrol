# TODO.md

## Purpose
This file tracks completed work and remaining tasks for ApplyControl.
Format is optimized for AI agents.

## Status Legend
- [x] Done
- [ ] Pending
- [~] In Progress
- [!] Blocked / Needs Decision

## Done
- [x] MV3 extension popup for capture, sign-in, sign-up, remember-me.
- [x] Firebase Auth via REST (Email/Password only).
- [x] Firestore REST integration for `applications` and `feedback`.
- [x] Dashboard (extension options page) with list, status filter, delete single, delete all, account dropdown.
- [x] Feedback modal that writes to Firestore.
- [x] About modal + privacy policy link.
- [x] Delete account flow with password reauth and data cleanup.
- [x] Accessibility updates (modal roles, aria-live, focus behavior).
- [x] Foundation CSS integrated + Material Symbols icons.
- [x] Fonts: Story Script (h1/h2), IBM Plex Serif (body).
- [x] UI styling updates (blue gradient headers, accessible colors).
- [x] Sanitization before saving to Firestore (trim, collapse blank lines).
- [x] Site detection + extraction for multiple boards; list-view fallback for Monster/Indeed.
- [x] Prevent duplicates (fingerprint + URL/title/company checks).
- [x] Fix Monster/Indeed list-page duplicate detection: per-card `job_id`/URL extraction (`content.js`), duplicate check now matches on `job_id` first; `isListPageUrl()` extended to cover Indeed's bare `/jobs` path, LinkedIn's `/jobs/search` and `/jobs/collections`, and generic `?keywords=` search pages.
- [x] Escape all scraped job fields before rendering (`escapeHtml()`/`safeHref()` in `extension/dashboard.js`) — closes a stored-XSS gap where a crafted page could inject markup into the options-page DOM via a saved application's title/company/location/url.
- [x] Retired the static `dashboard/` site: it had drifted onto the old Firebase-SDK auth path and was missing account deletion, feedback, per-item delete, and clear-all. The extension's options page (`extension/dashboard.js`) is now the only dashboard.
- [x] Live-tested Indeed list-page capture with the unpacked extension: confirmed correct, distinct per-card title/company/URL for a single job view (user-verified). A second, deeper bug that only shows up after selecting a second job in the same list session was found and fixed separately below.
- [x] Fixed Monster list-page capture, which was still returning identical data for every card despite the previous pass: `findActiveCard()`'s card selectors were lowercase/class-based and never matched Monster's real markup (`article[data-testid="JobCard"]`, case-sensitive), so `extractFromListView()` silently returned `{}` on every click and every capture fell back to page-global selectors (grabbing the page `<h1>` and a placeholder company element). Fixed by adding Monster's real per-card `data-testid` selectors, normalizing whatever "active" marker is found up to its enclosing card via `.closest()`, prioritizing class-based selection markers over generic ARIA attributes (an unrelated save button on Monster carries a stale `aria-selected="true"` that otherwise wins by DOM order), pulling `job_id` from the trailing UUID in Monster's job URL, and correcting `extractPayload()`'s title/company/location merge logic so a confirmed card's data isn't discarded. Verified live against real monster.com search results across multiple distinct cards.
- [x] Fixed Indeed capture breaking after the first job selected in a list session (reported as "saving jobs after 2 have been saved"): Indeed's split list+detail view marks the currently-viewed card with class `.vjs-highlight`, which `findActiveCard()` didn't recognize, and `document.activeElement` isn't useful either since clicking a card moves focus to the newly-rendered detail pane, not a card descendant — so it always fell back to the first card in the DOM. Separately, `extractIndeed()`'s title selector (`h1.jobsearch-JobInfoHeader-title`) no longer matches because Indeed renders the split-view title as an `<h2>` with the same class, so the generic `h1` fallback grabbed the search-results page heading instead. Net effect: title/company looked plausible (masking the bug), but `url`/`job_id` — taken unconditionally from the stale card — kept pointing at the first job, so `isDuplicate()`'s `job_id` check flagged every later, genuinely different job as "Already saved." Fixed by adding `.vjs-highlight` to `findActiveCard()` and adding Indeed's current `data-testid` selectors for title/company/location ahead of the stale ones. Verified live: clicked through 3 distinct real Indeed job cards in one session and confirmed title/company/location/job_id are now correct and mutually consistent for each.
- [x] Hardened Indeed card resolution further after real-world testing found the `.vjs-highlight` fix alone wasn't enough on Indeed's homepage (multiple independent "recommended for you" carousels): over a browsing session with several jobs clicked across different carousels/pages without a reload, Indeed's own client leaves `.vjs-highlight` on more than one card at once (confirmed live: 7 simultaneous matches), and `findActiveCard()`'s `document.querySelector()` always grabbed the first one — silently locking onto whichever carousel loads first, exactly matching the report that only jobs under one section ("Related to your work experience") saved correctly. Indeed's own URL is more trustworthy than any class it applies: the `vjk` query param reliably names the job actually open. `findActiveCard()` now matches a candidate card's own id against `vjk` first (Indeed's homepage cards only expose their id via a `job_<hex>` class token, not a link query param, so `getCardId()` now checks for that too), falling back to the selection-class/focus heuristics only when no `vjk` is present. Verified live by reproducing the exact 7-highlight polluted state and confirming title/company/job_id still resolve correctly and consistently. User-confirmed working after reloading the unpacked extension.

## Pending / Next
- [ ] Extend list-page URL detection to Glassdoor and ZipRecruiter once their real search-results URL shape is confirmed (their URLs don't follow the `/jobs/` convention the other boards use, so they were left out of `isListPageUrl()` rather than guessed at).
- [ ] Confirm dashboard shows records reliably across sign-in state changes.
- [ ] Add �success� toast after delete-account and clear-all actions (auto-close).
- [ ] Ensure logout/login state is synced between popup and dashboard consistently.
- [ ] Add export (CSV/JSON) from dashboard.
- [ ] Add onboarding / first-run guide in popup.
- [ ] Add job status timeline/history per application.
- [ ] Add optional company research enrichments (reviews, history) via external sources (requires API plan).
- [ ] Decide on Google Sign-In (disabled for now) and implement if chosen.

## Decisions Needed
- [!] Are we storing job card URL (list view) separately from page URL to reduce duplicates?
- [!] Should we prompt user to select a card when on list pages?

## Notes
- Keep Firebase config out of repo; template lives in `extension/config.example.js`.
- Firestore rules are documented in `README.md`.
- No automated tests, CI, or npm project exist yet (`package-lock.json` is an empty stub with no `package.json`). Not addressed in this pass — flagged for a later hygiene pass.
