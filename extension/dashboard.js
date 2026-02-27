const config = window.APPLYCONTROL_CONFIG || {};

const el = {
  authSection: document.getElementById("auth-section"),
  appSection: document.getElementById("app-section"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  rememberMe: document.getElementById("remember-me"),
  signIn: document.getElementById("sign-in"),
  signUp: document.getElementById("sign-up"),
  signOut: document.getElementById("sign-out"),
  authStatus: document.getElementById("auth-status"),
  list: document.getElementById("list"),
  search: document.getElementById("search"),
  userLabel: document.getElementById("user-label"),
  count: document.getElementById("count"),
  statusFilters: document.getElementById("status-filters"),
  syncStatus: document.getElementById("sync-status"),
  refresh: document.getElementById("refresh"),
  clearAll: document.getElementById("clear-all"),
  modal: document.getElementById("modal"),
  modalCancel: document.getElementById("modal-cancel"),
  modalConfirm: document.getElementById("modal-confirm")
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

function loadAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveAuth(data, remember) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [REMEMBER_KEY]: remember }, () => {
      chrome.storage.local.set({ [STORAGE_KEY]: { ...data, sessionOnly: !remember } }, resolve);
    });
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
    return { ...auth, stale: true };
  }
}

function updateUI(auth) {
  const signedIn = !!auth;
  el.authSection.classList.toggle("hidden", signedIn);
  el.appSection.classList.toggle("hidden", !signedIn);
  el.signOut.classList.toggle("hidden", !signedIn);
  el.userLabel.textContent = signedIn ? auth.email : "";
  if (auth && auth.stale && el.syncStatus) {
    el.syncStatus.textContent = "Session expired. Please sign in again.";
  }
  if (!signedIn) closeModal();
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
      <div>
        <button
          class="button alert tiny"
          data-delete-id="${app.id}"
          title="Delete item. This action cannot be undone."
        >
          <span class="material-symbols-outlined icon">delete</span>
          Delete
        </button>
      </div>
    `;
    const select = row.querySelector("select");
    select.value = app.status || "applied";
    select.addEventListener("change", async (e) => {
      await updateStatus(app.id, e.target.value);
    });
    el.list.appendChild(row);
  }

  const deleteButtons = el.list.querySelectorAll("[data-delete-id]");
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-id");
      if (!id) return;
      try {
        await deleteOneApplication(id);
      } catch (err) {
        if (el.syncStatus) el.syncStatus.textContent = `Delete error: ${err.message}`;
      }
    });
  });
}

async function fetchApplications(auth) {
  if (isFetching) return;
  if (auth && auth.stale) {
    if (el.syncStatus) el.syncStatus.textContent = "Session expired. Please sign in again.";
    return;
  }
  isFetching = true;
  if (el.syncStatus) el.syncStatus.textContent = "Syncing...";
  const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents:runQuery`;
  try {
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
          orderBy: [
            { field: { fieldPath: "captured_at" }, direction: "DESCENDING" }
          ]
        }
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Fetch failed.");
    }
    const data = await res.json();
    const docs = data
      .map((row) => row.document)
      .filter(Boolean)
      .map(parseFirestoreDoc);
    cachedApps = docs;
    renderList();
    if (el.syncStatus) {
      const when = new Date().toLocaleTimeString();
      el.syncStatus.textContent = `Last sync: ${when}`;
    }
  } catch (err) {
    if (el.syncStatus) el.syncStatus.textContent = `Sync error: ${err.message}`;
  }
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

async function deleteOneApplication(docId) {
  const auth = await getValidAuth().catch(() => null);
  if (!auth) return;
  const deleteUrl = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents/applications/${docId}`;
  const res = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${auth.idToken}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Delete failed.");
  }
  cachedApps = cachedApps.filter((app) => app.id !== docId);
  renderList();
  if (el.syncStatus) el.syncStatus.textContent = "Application deleted.";
}

el.search.addEventListener("input", renderList);
el.refresh.addEventListener("click", async () => {
  const auth = await getValidAuth().catch(() => null);
  if (auth) await fetchApplications(auth);
});

function openModal() {
  if (el.modal) el.modal.classList.remove("hidden");
}

function closeModal() {
  if (el.modal) el.modal.classList.add("hidden");
}

async function clearAllApplications() {
  const auth = await getValidAuth().catch(() => null);
  if (!auth) return;
  if (el.syncStatus) el.syncStatus.textContent = "Deleting...";

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
        }
      }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Fetch failed.");
  }
  const data = await res.json();
  const docNames = data.map((row) => row.document && row.document.name).filter(Boolean);
  if (!docNames.length) {
    cachedApps = [];
    renderList();
    if (el.syncStatus) el.syncStatus.textContent = "No applications to delete.";
    return;
  }

  for (const name of docNames) {
    const deleteUrl = `https://firestore.googleapis.com/v1/${name}`;
    const delRes = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${auth.idToken}`
      }
    });
    if (!delRes.ok) {
      const text = await delRes.text();
      throw new Error(text || "Delete failed.");
    }
  }
  cachedApps = [];
  renderList();
  if (el.syncStatus) el.syncStatus.textContent = "All applications deleted.";
}

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

el.signOut.addEventListener("click", async () => {
  await clearAuth();
  updateUI(null);
  setAuthStatus("Signed out.");
  cachedApps = [];
  renderList();
});

if (el.clearAll) el.clearAll.addEventListener("click", openModal);
if (el.modalCancel) el.modalCancel.addEventListener("click", closeModal);
if (el.modalConfirm) {
  el.modalConfirm.addEventListener("click", async () => {
    closeModal();
    try {
      await clearAllApplications();
    } catch (err) {
      if (el.syncStatus) el.syncStatus.textContent = `Delete error: ${err.message}`;
    }
  });
}

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

async function handleAuthChange() {
  const auth = await getValidAuth().catch(() => null);
  updateUI(auth);
  if (auth) {
    await fetchApplications(auth);
  } else {
    cachedApps = [];
    renderList();
  }
}

init();

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  const auth = await getValidAuth().catch(() => null);
  if (auth) await fetchApplications(auth);
});

if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" && areaName !== "session") return;
    if (changes[STORAGE_KEY] || changes[REMEMBER_KEY]) {
      handleAuthChange();
    }
  });
}

window.addEventListener("beforeunload", async () => {
  const auth = await loadAuth().catch(() => null);
  if (auth && auth.sessionOnly) {
    await clearAuth();
  }
});
