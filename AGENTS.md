# AGENTS.md

## Project Summary
ApplyControl is a browser-extension-first job application tracker.
- MV3 extension captures job data from job boards.
- A static dashboard (extension options page + optional static web) lists and manages applications.
- Firebase Auth (Email/Password) + Firestore REST provide cross-device sync.

## Repository Layout
- `extension/` MV3 extension (popup, content scripts, dashboard options page).
- `dashboard/` Static web dashboard (mirrors extension dashboard UI).
- `scripts/` Local setup scripts to generate config files.
- `README.md` Setup steps and Firestore rules.
- `PRIVACY_POLICY.md` Privacy policy copy used in UI.

## Configuration
- Config files are not committed.
- Copy templates and fill in Firebase project details:
  - `extension/config.js` from `extension/config.example.js`
  - `dashboard/config.js` from `dashboard/config.example.js`
- Quick setup scripts:
  - Windows: `scripts/setup.ps1`
  - macOS/Linux: `scripts/setup.sh`

## Key Runtime Details
- Firebase REST endpoints are used (no Firebase SDK bundling).
- Auth: Email/Password only (Google sign-in currently disabled).
- Feedback is stored in Firestore `feedback` collection.
- Applications are stored in Firestore `applications` collection.

## Common Commands
- Load extension:
  - Chrome/Edge: `chrome://extensions` ? Developer mode ? Load unpacked ? select `extension/`
  - Firefox: `about:debugging#/runtime/this-firefox` ? Load Temporary Add-on ? select `extension/manifest.json`
- Serve dashboard (optional): any static file server pointing at `dashboard/`.

## Code Conventions
- Keep user data sanitization in the capture path before saving to Firestore.
- Preserve accessibility attributes in UI updates (modal roles, focus handling, aria-live where used).
- Avoid committing secrets or runtime-generated files (verify `.gitignore`).

## Notes
- Firestore security rules are documented in `README.md`.
- Extension UI and dashboard should stay visually consistent (shared styles, fonts, colors).
