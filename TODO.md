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

## Pending / Next
- [ ] Live-test list-page capture on real Indeed and Monster search-results pages (load unpacked extension, confirm correct per-card title/company/URL and no duplicate saves) — the fix above is unverified against live markup.
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
