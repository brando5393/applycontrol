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
  authStatus: document.getElementById("auth-status"),
  list: document.getElementById("list"),
  search: document.getElementById("search"),
  userLabel: document.getElementById("user-label"),
  count: document.getElementById("count"),
  statusFilters: document.getElementById("status-filters")
};

const STORAGE_KEY = "applycontrol_auth";
const REMEMBER_KEY = "applycontrol_remember";
const STATUS_OPTIONS = [
  "all",
  "applied",
  "callback",
  "interview",
  "offer",
  "rejected"
];

let cachedApps = [];
let activeStatus = "all";
let pollTimer = null;
let isFetching = false;

function setAuthStatus(message, isError = false) {
  el.authStatus.textContent = message || "";
  el.authStatus.style.color = isError ? "#b00020" : "#2b7a2b";
}

function requireConfig() {
  if (!config.firebaseApiKey || !config.firebaseProjectId) {
    setAuthStatus("Missing config.js values.", true);
    return false;
  }
  return true;
}

function storageArea(name) {
  return chrome.storage && chrome.storage[name] ? chrome.storage[name] : null;
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

function updateUI(auth) {
  const signedIn = !!auth;
  el.authSection.classList.toggle("hidden", signedIn);
  el.appSection.classList.toggle("hidden", !signedIn);
  el.signOut.classList.toggle("hidden", !signedIn);
  el.userLabel.textContent = signedIn ? auth.email : "";
}

function renderStatusFilters() {
  el.statusFilters.innerHTML = "";
  for (const status of STATUS_OPTIONS) {
    const btn = document.createElement("button");
    btn.className = `pill ${activeStatus === status ? "active" : ""}`;
    btn.textContent = status;
    btn.addEventListener("click", () => {
      activeStatus = status;
      renderStatusFilters();
      renderList();
    });
    el.statusFilters.appendChild(btn);
  }
}

function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};
  return {
    id: doc.name.split("/").pop(),
    title: fields.title ? fields.title.stringValue || "" : "",
    url: fields.url ? fields.url.stringValue || "" : "",
    company: fields.company ? fields.company.stringValue || "" : "",
    location: fields.location ? fields.location.stringValue || "" : "",
    source: fields.source ? fields.source.stringValue || "" : "",
    status: fields.status ? fields.status.stringValue || "applied" : "applied",
    captured_at: fields.captured_at
      ? new Date(fields.captured_at.timestampValue)
      : null
  };
}

function renderList() {
  const query = el.search.value.trim().toLowerCase();
  el.list.innerHTML = "";
  const apps = cachedApps
    .filter((app) => {
      if (!query) return true;
      return (
        app.title.toLowerCase().includes(query) ||
        (app.company || "").toLowerCase().includes(query) ||
        (app.source || "").toLowerCase().includes(query)
      );
    })
    .filter((app) => {
      if (activeStatus === "all") return true;
      return (app.status || "applied") === activeStatus;
    });

  if (!apps.length) {
    el.list.innerHTML = "<p class='meta'>No applications yet.</p>";
    el.count.textContent = "0 applications";
    return;
  }

  el.count.textContent = `${apps.length} application${
    apps.length === 1 ? "" : "s"
  }`;

  for (const app of apps) {
    const row = document.createElement("div");
    row.className = "row-item";
    row.innerHTML = `
      <div class="role">
        <div class="role-title">${app.title}</div>
        <div class="meta">${app.company || "Unknown company"}</div>
        ${app.location ? `<div class="badge">${app.location}</div>` : ""}
      </div>
      <div class="meta">${app.source || "unknown"}</div>
      <div class="meta">${
        app.captured_at ? app.captured_at.toLocaleString() : "n/a"
      }</div>
      <div>
        <select data-id="${app.id}">
          <option value="applied">applied</option>
          <option value="callback">callback</option>
          <option value="interview">interview</option>
          <option value="offer">offer</option>
          <option value="rejected">rejected</option>
        </select>
      </div>
      <div>
        <a href="${app.url}" target="_blank" rel="noreferrer">Open</a>
      </div>
    `;
    const select = row.querySelector("select");
    select.value = app.status || "applied";
    select.addEventListener("change", async (e) => {
      await updateStatus(app.id, e.target.value);
    });
    el.list.appendChild(row);
  }
}

async function fetchApplications(auth) {
  if (isFetching) return;
  isFetching = true;
  const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "applications" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "user_id" },
            op: "EQUAL",
            value: { stringValue: auth.localId }
          }
        },
        orderBy: [{ field: { fieldPath: "captured_at" }, direction: "DESCENDING" }]
      }
    })
  });
  if (!res.ok) throw new Error("Fetch failed.");
  const data = await res.json();
  const docs = data
    .map((row) => row.document)
    .filter(Boolean)
    .map(parseFirestoreDoc);
  cachedApps = docs;
  renderList();
  isFetching = false;
}

async function updateStatus(docId, status) {
  const auth = await getValidAuth();
  if (!auth) return;
  const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents/applications/${docId}?updateMask.fieldPaths=status`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: status }
      }
    })
  });
}

el.search.addEventListener("input", renderList);

el.signUp.addEventListener("click", async () => {
  setAuthStatus("");
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
    setAuthStatus("Signed up.");
    await fetchApplications(auth);
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

el.signIn.addEventListener("click", async () => {
  setAuthStatus("");
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
    setAuthStatus("Signed in.");
    await fetchApplications(auth);
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

el.googleSignIn.addEventListener("click", async () => {
  setAuthStatus("");
  try {
    const auth = await googleAuthFlow();
    await saveAuth(auth, el.rememberMe.checked);
    updateUI(auth);
    setAuthStatus("Signed in with Google.");
    await fetchApplications(auth);
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

el.signOut.addEventListener("click", async () => {
  await clearAuth();
  updateUI(null);
  setAuthStatus("Signed out.");
  cachedApps = [];
  renderList();
});

async function init() {
  if (!requireConfig()) return;
  renderStatusFilters();
  el.rememberMe.checked = await loadRemember();
  const auth = await getValidAuth().catch(() => null);
  updateUI(auth);
  if (auth) {
    await fetchApplications(auth);
    if (!pollTimer) {
      pollTimer = setInterval(async () => {
        const freshAuth = await getValidAuth().catch(() => null);
        if (freshAuth) {
          await fetchApplications(freshAuth);
        }
      }, 30000);
    }
  }
}

init();

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  const auth = await getValidAuth().catch(() => null);
  if (auth) await fetchApplications(auth);
});
