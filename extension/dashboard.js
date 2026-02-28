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
  feedbackToggle: document.getElementById("feedback-toggle"),
  accountMenu: document.getElementById("account-menu"),
  accountToggle: document.getElementById("account-toggle"),
  accountPanel: document.getElementById("account-panel"),
  aboutToggle: document.getElementById("about-toggle"),
  aboutModal: document.getElementById("about-modal"),
  aboutClose: document.getElementById("about-close"),
  aboutVersion: document.getElementById("about-version"),
  privacyLink: document.getElementById("privacy-link"),
  deleteAccount: document.getElementById("delete-account"),
  deleteModal: document.getElementById("delete-modal"),
  deleteCancel: document.getElementById("delete-cancel"),
  deleteConfirm: document.getElementById("delete-confirm"),
  deletePassword: document.getElementById("delete-password"),
  deleteStatus: document.getElementById("delete-status"),
  deleteSuccessModal: document.getElementById("delete-success-modal"),
  deleteSuccessClose: document.getElementById("delete-success-close"),
  descriptionModal: document.getElementById("description-modal"),
  descriptionContent: document.getElementById("description-content"),
  descriptionClose: document.getElementById("description-close"),
  modal: document.getElementById("modal"),
  modalCancel: document.getElementById("modal-cancel"),
  modalConfirm: document.getElementById("modal-confirm"),
  feedbackModal: document.getElementById("feedback-modal"),
  feedbackTitle: document.getElementById("feedback-title-input"),
  feedbackMessage: document.getElementById("feedback-message-input"),
  feedbackCancel: document.getElementById("feedback-cancel"),
  feedbackSubmit: document.getElementById("feedback-submit"),
  feedbackStatus: document.getElementById("feedback-status")
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
let lastFocused = null;

function setAuthStatus(message, isError = false) {
  el.authStatus.textContent = message || "";
  el.authStatus.style.color = isError ? "#b00020" : "#2b7a2b";
}

function setDeleteStatus(message, isError = false) {
  if (!el.deleteStatus) return;
  el.deleteStatus.textContent = message || "";
  el.deleteStatus.style.color = isError ? "#b00020" : "#2b7a2b";
}

function setFeedbackStatus(message, isError = false) {
  if (!el.feedbackStatus) return;
  el.feedbackStatus.textContent = message || "";
  el.feedbackStatus.style.color = isError ? "#b00020" : "#2b7a2b";
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
  el.userLabel.textContent = signedIn ? auth.email : "";
  if (el.accountMenu) el.accountMenu.classList.toggle("hidden", !signedIn);
  if (auth && auth.stale && el.syncStatus) {
    el.syncStatus.textContent = "Session expired. Please sign in again.";
  }
  if (!signedIn) {
    closeModal();
    if (el.email) el.email.value = "";
    if (el.password) el.password.value = "";
  }
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
    description: fields.description ? fields.description.stringValue || "" : "",
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
        <button class="button secondary tiny" data-desc="${app.id}">
          <span class="material-symbols-outlined icon">subject</span>
          View
        </button>
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

  const descButtons = el.list.querySelectorAll("[data-desc]");
  descButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-desc");
      const app = cachedApps.find((a) => a.id === id);
      const text = app && app.description ? app.description : "No description saved.";
      openDescriptionModal(text);
    });
  });

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

function sanitizeText(value, { preserveLineBreaks = true } = {}) {
  if (value == null) return "";
  let text = String(value);
  text = text.replace(/\u0000/g, "");
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  text = text.trim();
  if (!preserveLineBreaks) {
    text = text.replace(/\s+/g, " ");
  }
  return text;
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
  if (el.modal) {
    lastFocused = document.activeElement;
    el.modal.classList.remove("hidden");
    if (el.modalConfirm) el.modalConfirm.focus();
  }
}

function closeModal() {
  if (el.modal) el.modal.classList.add("hidden");
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function openAboutModal() {
  if (!el.aboutModal) return;
  lastFocused = document.activeElement;
  el.aboutModal.classList.remove("hidden");
  if (el.aboutClose) el.aboutClose.focus();
  if (el.aboutVersion && chrome.runtime && chrome.runtime.getManifest) {
    el.aboutVersion.textContent = chrome.runtime.getManifest().version || "n/a";
  }
}

function closeAboutModal() {
  if (!el.aboutModal) return;
  el.aboutModal.classList.add("hidden");
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function openDeleteModal() {
  if (!el.deleteModal) return;
  lastFocused = document.activeElement;
  el.deleteModal.classList.remove("hidden");
  if (el.deletePassword) el.deletePassword.focus();
  setDeleteStatus("");
}

function closeDeleteModal() {
  if (!el.deleteModal) return;
  el.deleteModal.classList.add("hidden");
  if (el.deletePassword) el.deletePassword.value = "";
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function openDeleteSuccessModal() {
  if (!el.deleteSuccessModal) return;
  lastFocused = document.activeElement;
  el.deleteSuccessModal.classList.remove("hidden");
  if (el.deleteSuccessClose) el.deleteSuccessClose.focus();
}

function closeDeleteSuccessModal() {
  if (!el.deleteSuccessModal) return;
  el.deleteSuccessModal.classList.add("hidden");
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function toggleAccountMenu(forceOpen) {
  if (!el.accountPanel || !el.accountToggle) return;
  const isOpen = !el.accountPanel.classList.contains("hidden");
  const next = typeof forceOpen === "boolean" ? forceOpen : !isOpen;
  el.accountPanel.classList.toggle("hidden", !next);
  el.accountToggle.setAttribute("aria-expanded", next ? "true" : "false");
}

async function deleteAccountAndData(password) {
  const auth = await getValidAuth().catch(() => null);
  if (!auth || !auth.email) throw new Error("Not signed in.");
  const signInRes = await signIn(auth.email, password);
  if (!signInRes || !signInRes.idToken) throw new Error("Password incorrect.");

  const idToken = signInRes.idToken;
  const userId = signInRes.localId;

  const deleteAllFromCollection = async (collectionId) => {
    const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents:runQuery`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: "user_id" },
              op: "EQUAL",
              value: { stringValue: userId }
            }
          }
        }
      })
    });
    if (!res.ok) throw new Error("Fetch failed.");
    const data = await res.json();
    const docNames = data.map((row) => row.document && row.document.name).filter(Boolean);
    for (const name of docNames) {
      const deleteUrl = `https://firestore.googleapis.com/v1/${name}`;
      await fetch(deleteUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` }
      });
    }
  };

  await deleteAllFromCollection("applications");
  await deleteAllFromCollection("feedback");

  const deleteUserRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  if (!deleteUserRes.ok) {
    const text = await deleteUserRes.text();
    throw new Error(text || "Account delete failed.");
  }
}
function openFeedbackModal() {
  if (!el.feedbackModal) return;
  lastFocused = document.activeElement;
  el.feedbackModal.classList.remove("hidden");
  if (el.feedbackTitle) el.feedbackTitle.focus();
}

function openDescriptionModal(text) {
  if (!el.descriptionModal || !el.descriptionContent) return;
  lastFocused = document.activeElement;
  el.descriptionContent.textContent = text || "";
  el.descriptionModal.classList.remove("hidden");
  if (el.descriptionClose) el.descriptionClose.focus();
}

function closeDescriptionModal() {
  if (!el.descriptionModal) return;
  el.descriptionModal.classList.add("hidden");
  if (el.descriptionContent) el.descriptionContent.textContent = "";
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function closeFeedbackModal() {
  if (!el.feedbackModal) return;
  el.feedbackModal.classList.add("hidden");
  if (el.feedbackTitle) el.feedbackTitle.value = "";
  if (el.feedbackMessage) el.feedbackMessage.value = "";
  setFeedbackStatus("");
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

async function submitFeedback() {
  const auth = await getValidAuth().catch(() => null);
  if (!auth) {
    setFeedbackStatus("Please sign in first.", true);
    return;
  }
  const title = sanitizeText(el.feedbackTitle && el.feedbackTitle.value || "", { preserveLineBreaks: false });
  const message = sanitizeText(el.feedbackMessage && el.feedbackMessage.value || "", { preserveLineBreaks: true });
  if (!title || !message) {
    setFeedbackStatus("Please add a title and details.", true);
    return;
  }
  setFeedbackStatus("Sending...");
  const version = chrome.runtime && chrome.runtime.getManifest
    ? chrome.runtime.getManifest().version
    : "n/a";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const appVersion = navigator.appVersion || "";
  const userAgentData = navigator.userAgentData
    ? {
        platform: navigator.userAgentData.platform || "",
        mobile: !!navigator.userAgentData.mobile,
        brands: navigator.userAgentData.brands || []
      }
    : null;
  const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents/feedback`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`
    },
    body: JSON.stringify({
      fields: {
        user_id: { stringValue: auth.localId },
        email: { stringValue: auth.email || "" },
        title: { stringValue: title },
        message: { stringValue: message },
        version: { stringValue: version },
        page_url: { stringValue: location.href },
        user_agent: { stringValue: ua },
        platform: { stringValue: platform },
        app_version: { stringValue: appVersion },
        user_agent_data: userAgentData
          ? { stringValue: JSON.stringify(userAgentData) }
          : { stringValue: "" },
        created_at: { timestampValue: new Date().toISOString() }
      }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    setFeedbackStatus(text || "Feedback failed.", true);
    return;
  }
  setFeedbackStatus("Thanks! Feedback sent.");
  setTimeout(() => {
    closeFeedbackModal();
  }, 1200);
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
  setAuthStatus("Signing up...");
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
  setAuthStatus("Signing in...");
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

if (el.feedbackToggle) el.feedbackToggle.addEventListener("click", openFeedbackModal);
if (el.feedbackCancel) el.feedbackCancel.addEventListener("click", closeFeedbackModal);
if (el.feedbackSubmit) el.feedbackSubmit.addEventListener("click", submitFeedback);

if (el.accountToggle) el.accountToggle.addEventListener("click", () => toggleAccountMenu());
document.addEventListener("click", (e) => {
  if (!el.accountMenu || !el.accountPanel) return;
  if (!el.accountMenu.contains(e.target)) {
    toggleAccountMenu(false);
  }
});
if (el.aboutToggle) el.aboutToggle.addEventListener("click", () => {
  toggleAccountMenu(false);
  openAboutModal();
});
if (el.aboutClose) el.aboutClose.addEventListener("click", closeAboutModal);
if (el.privacyLink) {
  el.privacyLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("privacy.html") });
  });
}

if (el.deleteAccount) el.deleteAccount.addEventListener("click", () => {
  toggleAccountMenu(false);
  openDeleteModal();
});
if (el.deleteCancel) el.deleteCancel.addEventListener("click", closeDeleteModal);
if (el.deleteConfirm) el.deleteConfirm.addEventListener("click", async () => {
  try {
    const password = el.deletePassword ? el.deletePassword.value : "";
    if (!password) {
      setDeleteStatus("Please enter your password.", true);
      return;
    }
    setDeleteStatus("Deleting account...");
    await deleteAccountAndData(password);
    await clearAuth();
    closeDeleteModal();
    updateUI(null);
    setAuthStatus("Account deleted.");
    openDeleteSuccessModal();
  } catch (err) {
    setDeleteStatus(err.message || "Delete failed.", true);
  }
});

if (el.deleteSuccessClose) el.deleteSuccessClose.addEventListener("click", closeDeleteSuccessModal);
if (el.descriptionClose) el.descriptionClose.addEventListener("click", closeDescriptionModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (el.modal && !el.modal.classList.contains("hidden")) closeModal();
    if (el.feedbackModal && !el.feedbackModal.classList.contains("hidden")) closeFeedbackModal();
    if (el.aboutModal && !el.aboutModal.classList.contains("hidden")) closeAboutModal();
    if (el.deleteModal && !el.deleteModal.classList.contains("hidden")) closeDeleteModal();
    if (el.deleteSuccessModal && !el.deleteSuccessModal.classList.contains("hidden")) closeDeleteSuccessModal();
    if (el.descriptionModal && !el.descriptionModal.classList.contains("hidden")) closeDescriptionModal();
  }
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
