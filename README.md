# ApplyControl MVP

Stupid-simple job application tracker MVP:
- Browser extension (Chrome/Edge/Firefox) for one-click capture
- Firebase Auth + Firestore for cross-device sync
- Dashboard (extension options page) for viewing/editing status

## Supported Job Boards
`extension/content.js` has a site-specific extractor (title/company/location/description, plus per-card extraction on search-results/list pages where applicable) for:
- Indeed
- Monster
- LinkedIn
- Workday
- Ashby
- SmartRecruiters
- Wellfound (AngelList)
- ZipRecruiter
- Glassdoor
- Greenhouse
- Lever

Any other site falls back to generic extraction (page `<h1>`, Open Graph/Twitter meta tags, and common `company`/`location` class-name heuristics) — capture still works there, just less precisely.

## Structure
- `extension/` - MV3 browser extension, including the dashboard (options page)
- `extension/lib/shared.js` - pure logic (duplicate detection, URL/id parsing, text sanitization) shared by the popup, content script, and dashboard
- `test/` - unit and DOM regression tests (`npm test`)

## Tests
```
npm install
npm test
```
Runs on every push/PR to `main` via `.github/workflows/test.yml`. See `RELEASING.md` for how version bumps work.

## Firebase Setup
1. Create a Firebase project.
2. Enable **Authentication → Email/Password**. Also enable **Authentication → Google** if you want Google Sign-In (see "Google Sign-In Setup" below) — it's optional and additive to email/password, not a replacement.
3. Create **Firestore** in production or test mode.
4. In Firestore, add rules to restrict data by `user_id`.

Example Firestore rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /applications/{doc} {
      allow read, write: if request.auth != null
        && request.resource.data.user_id == request.auth.uid
        && resource.data.user_id == request.auth.uid;
    }
    match /feedback/{doc} {
      allow create: if request.auth != null
        && request.resource.data.user_id == request.auth.uid;
      allow read, update, delete: if false;
    }
  }
}
```

## Configure
Copy and fill in the config file:
- `extension/config.js` from `extension/config.example.js`

## Google Sign-In Setup
Email/password sign-in works out of the box once Firebase config is filled in. Google Sign-In is an **additional** option next to it (both are always shown), and needs one extra piece of setup Chrome requires to be static in `manifest.json` rather than loaded from `config.js`:

1. Load the extension unpacked once first (see "Load Extension" below) and note its ID from `chrome://extensions`.
2. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for the **same project as your Firebase project** (Firebase projects are Google Cloud projects), go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
3. Application type: **Chrome Extension**. Paste in the extension ID from step 1.
4. Create it — you'll get a Client ID (no client secret is needed or used for this flow).
5. Paste that ID into `extension/manifest.json`'s `"oauth2"."client_id"` field, replacing the placeholder.
6. Reload the unpacked extension (`chrome://extensions` → Reload) and try "Sign in with Google."

Note: an unpacked extension's ID normally changes if you remove and re-add it, which would break step 3's registration. If that happens, either update the OAuth client's registered ID to match, or pin a stable ID by adding a `"key"` field to `manifest.json` (see [Chrome's docs on extension IDs](https://developer.chrome.com/docs/extensions/reference/manifest/key)).

## Privacy Policy
See `PRIVACY_POLICY.md`.

## Feedback Storage (Firestore)
Feedback submissions are stored in Firestore in the `feedback` collection.
Each feedback item includes user id, email (if available), title, message, version, and metadata.

### Quick Setup Scripts
Generate local config files from templates:

PowerShell (Windows):
```
.\scripts\setup.ps1
```

macOS/Linux (bash):
```
./scripts/setup.sh
```

## Load Extension
1. Chrome/Edge: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`
2. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `extension/manifest.json`
