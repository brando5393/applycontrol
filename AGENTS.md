# AGENTS.md

## Project Summary
ApplyControl is a browser-extension-first job application tracker.
- MV3 extension captures job data from job boards.
- The dashboard (extension options page) lists and manages applications. There is no separate static/hosted dashboard — a prior static `dashboard/` copy was retired because it had drifted onto a different (Firebase SDK) auth path and was missing features the extension dashboard had gained.
- Firebase Auth (Email/Password, plus optional Google Sign-In) + Firestore REST provide cross-device sync.

## Repository Layout
- `extension/` MV3 extension (popup, content scripts, dashboard options page).
- `scripts/` Local setup scripts to generate config files.
- `README.md` Setup steps and Firestore rules.
- `PRIVACY_POLICY.md` Privacy policy copy used in UI.

## Configuration
- Config files are not committed.
- Copy the template and fill in Firebase project details:
  - `extension/config.js` from `extension/config.example.js`
- Quick setup scripts:
  - Windows: `scripts/setup.ps1`
  - macOS/Linux: `scripts/setup.sh`

## Key Runtime Details
- Firebase REST endpoints are used (no Firebase SDK bundling).
- Auth: Email/Password, plus optional Google Sign-In (additive, not a replacement) via `chrome.identity` + Firebase's `signInWithIdp`. Requires a real Google Cloud OAuth client ID in `extension/manifest.json`'s `oauth2.client_id` — see README.md's "Google Sign-In Setup".
- Feedback is stored in Firestore `feedback` collection.
- Applications are stored in Firestore `applications` collection.

## Common Commands
- Load extension:
  - Chrome/Edge: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`
  - Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `extension/manifest.json`
- Run tests: `npm install && npm test` (see `RELEASING.md` for the version-bump process)

## Code Conventions
- Keep user data sanitization in the capture path before saving to Firestore.
- `sanitizeText()` (in `extension/lib/shared.js`, loaded before `popup.js`/`content.js`/`dashboard.js`) only normalizes whitespace/control characters — it is not HTML-safe. Any job data rendered into the dashboard DOM must go through `escapeHtml()` (and `safeHref()` for URLs) in `extension/dashboard.js`; never assign scraped fields into `innerHTML` unescaped.
- Pure logic with no DOM/`chrome.*` dependency belongs in `extension/lib/shared.js`, not duplicated across `popup.js`/`content.js`/`dashboard.js` — it's the only part of the extension covered by `npm test`.
- Session/auth logic (`loadAuth`/`saveAuth`/`clearAuth`/`getValidAuth`/`signUp`/`signIn`/`sendPasswordReset`/`signInWithGoogle`/etc.) belongs in `extension/lib/auth.js`, loaded before `popup.js`/`dashboard.js`, not duplicated between them — this used to be copy-pasted in both files and was a real source of the two surfaces drifting out of sync.
- `test/page-load.test.js` loads `popup.html`/`dashboard.html` with their actual `<script>` tag order in jsdom; if you add a new script file or reorder existing ones, run `npm test` and check that test specifically, since a load-order mistake here is otherwise silent until the extension is opened in a real browser.
- Preserve accessibility attributes in UI updates (modal roles, focus handling, aria-live where used).
- Avoid committing secrets or runtime-generated files (verify `.gitignore`).

## Notes
- Firestore security rules are documented in `README.md`.
