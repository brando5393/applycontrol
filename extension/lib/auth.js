// Shared Firebase Auth REST helpers + local session storage. Loaded before
// popup.js and dashboard.js (after config.js and lib/shared.js) so both
// surfaces read/write sessions through the exact same code path -- the two
// used to carry independent copies of all of this, which is how a fix or a
// new sign-in method could land in one and silently not the other.

const config = window.APPLYCONTROL_CONFIG || {};

const STORAGE_KEY = "applycontrol_auth";
const REMEMBER_KEY = "applycontrol_remember";

function loadAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveAuth(data, remember) {
  // One combined write, not two sequential ones: storage.onChanged fires
  // per set() call, so writing REMEMBER_KEY and STORAGE_KEY separately let
  // listeners in the other surface (popup vs. dashboard) observe a
  // momentary state where one had updated and the other hadn't yet.
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        [REMEMBER_KEY]: remember,
        [STORAGE_KEY]: { ...data, sessionOnly: !remember }
      },
      resolve
    );
  });
}

function clearAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY, REMEMBER_KEY], resolve);
  });
}

function loadRemember() {
  return new Promise((resolve) => {
    chrome.storage.local.get([REMEMBER_KEY], (result) => {
      if (typeof result[REMEMBER_KEY] === "boolean") {
        resolve(result[REMEMBER_KEY]);
      } else {
        resolve(true);
      }
    });
  });
}

async function signUp(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Sign up failed.";
    throw new Error(msg);
  }
  return data;
}

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Sign in failed.";
    throw new Error(msg);
  }
  return data;
}

async function refreshToken(refreshTokenValue) {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(
        refreshTokenValue
      )}`
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Token refresh failed.";
    throw new Error(msg);
  }
  return data;
}

async function getValidAuth() {
  const auth = await loadAuth();
  if (!auth) return null;
  const now = Date.now();
  if (auth.expiresAt && auth.expiresAt - now > 60 * 1000) return auth;
  try {
    const refreshed = await refreshToken(auth.refreshToken);
    const expiresAt = Date.now() + Number(refreshed.expires_in) * 1000;
    const updated = {
      ...auth,
      idToken: refreshed.id_token,
      refreshToken: refreshed.refresh_token,
      expiresAt,
      stale: false
    };
    const remember = await loadRemember();
    await saveAuth(updated, remember);
    return updated;
  } catch {
    // Refresh token itself expired/revoked (e.g. password changed
    // elsewhere, or the session simply aged out) -- distinct from "not
    // signed in at all" so the UI can say why capture/sync just stopped
    // working.
    return { ...auth, stale: true };
  }
}

// Builds the local session shape from any Identity Toolkit response that
// returns { idToken, refreshToken, expiresIn, email, localId } -- signUp,
// signIn, and signInWithGoogle all share this response shape.
function buildAuthFromAuthResponse(data) {
  return {
    email: data.email,
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000
  };
}

async function sendPasswordReset(email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Failed to send password reset email.";
    throw new Error(msg);
  }
  return data;
}

async function sendEmailVerification(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Failed to send verification email.";
    throw new Error(msg);
  }
  return data;
}

async function fetchAccountInfo(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Failed to fetch account info.";
    throw new Error(msg);
  }
  return (data.users && data.users[0]) || null;
}

// chrome.identity.getAuthToken() returns a Google OAuth access token for
// whichever Google account is signed into the browser profile, scoped by
// manifest.json's "oauth2" key. Requires a real Google Cloud OAuth client
// ID registered for this extension's ID -- see README.md's Google Sign-In
// setup section. Until that's configured, this rejects with a clear error
// instead of silently failing.
function getGoogleAccessToken() {
  return new Promise((resolve, reject) => {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      reject(new Error("Google sign-in isn't available in this browser."));
      return;
    }
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        const message = chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : "Google sign-in was cancelled.";
        reject(new Error(message));
        return;
      }
      resolve(token);
    });
  });
}

async function signInWithGoogle() {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${accessToken}&providerId=google.com`,
        requestUri: chrome.identity.getRedirectURL(),
        returnSecureToken: true
      })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message
      ? data.error.message
      : "Google sign-in failed.";
    throw new Error(msg);
  }
  return data;
}
