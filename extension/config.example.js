// Copy to config.js and fill in values from Firebase project settings.
// Firebase Web API Key is required for Identity Toolkit REST API.
//
// Google Sign-In (optional) is NOT configured here -- it needs a Google
// OAuth client ID set directly in extension/manifest.json's "oauth2" key,
// since Chrome requires that value to be static in the manifest. See
// README.md's "Google Sign-In Setup" section.
window.APPLYCONTROL_CONFIG = {
  firebaseApiKey: "YOUR_FIREBASE_WEB_API_KEY",
  firebaseProjectId: "YOUR_FIREBASE_PROJECT_ID"
};
