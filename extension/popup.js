const config = window.APPLYCONTROL_CONFIG || {};

const el = {
  authSection: document.getElementById("auth-section"),
  appSection: document.getElementById("app-section"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  rememberMe: document.getElementById("remember-me"),
  signIn: document.getElementById("sign-in"),
  signUp: document.getElementById("sign-up"),
  googleSignIn: document.getElementById("google-sign-in"),
  signOut: document.getElementById("sign-out"),
  openDashboard: document.getElementById("open-dashboard"),
  capture: document.getElementById("capture"),
  status: document.getElementById("status"),
  userLabel: document.getElementById("user-label")
};

const STORAGE_KEY = "applycontrol_auth";
const REMEMBER_KEY = "applycontrol_remember";

function storageArea(name) {
  return chrome.storage && chrome.storage[name] ? chrome.storage[name] : null;
}

function setStatus(message, isError = false) {
  el.status.textContent = message || "";
  el.status.style.color = isError ? "#b00020" : "#2b7a2b";
}

function requireConfig() {
  if (!config.firebaseApiKey || !config.firebaseProjectId) {
    setStatus("Missing config.js values.", true);
    return false;
  }
  return true;
}

function loadAuth() {
  return new Promise((resolve) => {
    const session = storageArea("session");
    if (session) {
      session.get([STORAGE_KEY], (result) => {
        if (result && result[STORAGE_KEY]) {
          resolve(result[STORAGE_KEY]);
        } else {
          chrome.storage.local.get([STORAGE_KEY], (localResult) => {
            resolve(localResult[STORAGE_KEY] || null);
          });
        }
      });
      return;
    }
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveAuth(data, remember) {
  return new Promise((resolve) => {
    const session = storageArea("session");
    chrome.storage.local.set({ [REMEMBER_KEY]: remember }, () => {
      if (remember) {
        chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
          if (session) session.remove([STORAGE_KEY], resolve);
          else resolve();
        });
        return;
      }
      chrome.storage.local.remove([STORAGE_KEY], () => {
        if (session) {
          session.set({ [STORAGE_KEY]: data }, resolve);
        } else {
          chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
        }
      });
    });
  });
}

function clearAuth() {
  return new Promise((resolve) => {
    const session = storageArea("session");
    const done = () => {
      chrome.storage.local.remove([STORAGE_KEY, REMEMBER_KEY], resolve);
    };
    if (session) session.remove([STORAGE_KEY], done);
    else done();
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
  if (!res.ok) throw new Error("Sign up failed.");
  return res.json();
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
  if (!res.ok) throw new Error("Sign in failed.");
  return res.json();
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
  if (!res.ok) throw new Error("Token refresh failed.");
  return res.json();
}

async function signInWithIdp(accessToken, requestUri) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${encodeURIComponent(
          accessToken
        )}&providerId=google.com`,
        requestUri,
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  if (!res.ok) throw new Error("Google sign-in failed.");
  return res.json();
}

function parseFragmentParams(fragment) {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const out = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

async function googleAuthFlow() {
  if (!config.googleClientId || config.googleClientId.startsWith("YOUR_")) {
    throw new Error("Missing Google OAuth client ID.");
  }
  if (!chrome.identity || !chrome.identity.launchWebAuthFlow) {
    throw new Error("Google sign-in not supported in this browser.");
  }
  const redirectUri = chrome.identity.getRedirectURL("oauth2");
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${encodeURIComponent(config.googleClientId)}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&prompt=select_account`;

  const redirectUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (resultUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!resultUrl) {
          reject(new Error("No redirect URL."));
          return;
        }
        resolve(resultUrl);
      }
    );
  });

  const fragment = redirectUrl.split("#")[1] || "";
  const params = parseFragmentParams(fragment);
  if (!params.access_token) throw new Error("Missing access token.");
  const data = await signInWithIdp(params.access_token, redirectUri);
  const expiresAt = Date.now() + Number(data.expiresIn) * 1000;
  return {
    email: data.email,
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt
  };
}

async function getValidAuth() {
  const auth = await loadAuth();
  if (!auth) return null;
  const now = Date.now();
  if (auth.expiresAt && auth.expiresAt - now > 60 * 1000) return auth;
  const refreshed = await refreshToken(auth.refreshToken);
  const expiresAt = Date.now() + Number(refreshed.expires_in) * 1000;
  const updated = {
    ...auth,
    idToken: refreshed.id_token,
    refreshToken: refreshed.refresh_token,
    expiresAt
  };
  const remember = await loadRemember();
  await saveAuth(updated, remember);
  return updated;
}

async function saveApplication(auth, payload) {
  const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents/applications`;
  const fields = {
    user_id: { stringValue: auth.localId },
    url: { stringValue: payload.url },
    title: { stringValue: payload.title },
    captured_at: { timestampValue: new Date().toISOString() },
    status: { stringValue: "applied" },
    source: { stringValue: payload.source }
  };
  if (payload.company) fields.company = { stringValue: payload.company };
  if (payload.location) fields.location = { stringValue: payload.location };
  if (payload.description)
    fields.description = { stringValue: payload.description };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`
    },
    body: JSON.stringify({
      fields
    })
  });
  if (!res.ok) throw new Error("Save failed.");
  return res.json();
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0]);
    });
  });
}

function updateUI(auth) {
  const signedIn = !!auth;
  el.authSection.classList.toggle("hidden", signedIn);
  el.appSection.classList.toggle("hidden", !signedIn);
  el.userLabel.textContent = signedIn ? `Signed in: ${auth.email}` : "";
}

async function isJobPage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "APPLYCONTROL_IS_JOB_PAGE" },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          resolve(false);
          return;
        }
        resolve(!!response.isJobPage);
      }
    );
  });
}

async function init() {
  if (!requireConfig()) return;
  el.rememberMe.checked = await loadRemember();
  const auth = await getValidAuth().catch(() => null);
  updateUI(auth);
  const tab = await getActiveTab();
  if (tab && tab.id) {
    const ok = await isJobPage(tab.id);
    if (!ok) {
      el.capture.disabled = true;
      setStatus("Open a job posting to save.", true);
    } else {
      el.capture.disabled = false;
    }
  }
}

el.signUp.addEventListener("click", async () => {
  if (!requireConfig()) return;
  setStatus("");
  try {
    const data = await signUp(el.email.value, el.password.value);
    const expiresAt = Date.now() + Number(data.expiresIn) * 1000;
    const auth = {
      email: data.email,
      localId: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt
    };
    await saveAuth(auth, el.rememberMe.checked);
    updateUI(auth);
    setStatus("Signed up.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

el.signIn.addEventListener("click", async () => {
  if (!requireConfig()) return;
  setStatus("");
  try {
    const data = await signIn(el.email.value, el.password.value);
    const expiresAt = Date.now() + Number(data.expiresIn) * 1000;
    const auth = {
      email: data.email,
      localId: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt
    };
    await saveAuth(auth, el.rememberMe.checked);
    updateUI(auth);
    setStatus("Signed in.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

el.googleSignIn.addEventListener("click", async () => {
  if (!requireConfig()) return;
  setStatus("");
  try {
    const auth = await googleAuthFlow();
    await saveAuth(auth, el.rememberMe.checked);
    updateUI(auth);
    setStatus("Signed in with Google.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

el.signOut.addEventListener("click", async () => {
  await clearAuth();
  updateUI(null);
  setStatus("Signed out.");
});

el.openDashboard.addEventListener("click", () => {
  if (chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  }
});

el.capture.addEventListener("click", async () => {
  setStatus("");
  try {
    const auth = await getValidAuth();
    if (!auth) {
      setStatus("Please sign in.", true);
      updateUI(null);
      return;
    }
    const tab = await getActiveTab();
    if (!tab || !tab.url) {
      setStatus("No active tab.", true);
      return;
    }
    const url = new URL(tab.url);
    let extracted = {};
    try {
      extracted = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "APPLYCONTROL_EXTRACT" },
          (response) => {
            if (chrome.runtime.lastError || !response || !response.ok) {
              resolve({});
              return;
            }
            resolve(response.payload || {});
          }
        );
      });
    } catch {
      extracted = {};
    }
    await saveApplication(auth, {
      url: tab.url,
      title: extracted.title || tab.title || tab.url,
      company: extracted.company || "",
      location: extracted.location || "",
      description: extracted.description || "",
      source: url.hostname
    });
    setStatus("Saved.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

init();
