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

## Pending / Next
- [ ] Fix Monster list-page duplicate detection: ensure per-card URL/title/company extraction; avoid treating list URL as unique.
- [ ] Validate Indeed list-page capture (per-card selection, proper title/URL).
- [ ] Confirm dashboard shows records reliably across sign-in state changes.
- [ ] Add “success” toast after delete-account and clear-all actions (auto-close).
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
- Keep Firebase config out of repo; templates live in `extension/config.example.js` and `dashboard/config.example.js`.
- Firestore rules are documented in `README.md`.
