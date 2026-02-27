# ApplyControl MVP

Stupid-simple job application tracker MVP:
- Browser extension (Chrome/Edge/Firefox) for one-click capture
- Firebase Auth + Firestore for cross-device sync
- Web dashboard for viewing/editing status

## Structure
- `extension/` - MV3 browser extension
- `dashboard/` - Static web dashboard

## Firebase Setup
1. Create a Firebase project.
2. Enable **Authentication → Email/Password**.
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
Copy and fill in config files:
- `extension/config.js` from `extension/config.example.js`
- `dashboard/config.js` from `dashboard/config.example.js`

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

## Run Dashboard (static)
Serve `dashboard/` with any static server.

## Load Extension
1. Chrome/Edge: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`
2. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `extension/manifest.json`
