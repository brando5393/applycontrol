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
  openDashboard: document.getElementById("open-dashboard"),
  capture: document.getElementById("capture"),
  helpToggle: document.getElementById("help-toggle"),
  helpPanel: document.getElementById("help-panel"),
  version: document.getElementById("version"),
  feedbackToggle: document.getElementById("feedback-toggle"),
  feedbackModal: document.getElementById("feedback-modal"),
  feedbackTitle: document.getElementById("feedback-title-input"),
  feedbackMessage: document.getElementById("feedback-message-input"),
  feedbackCancel: document.getElementById("feedback-cancel"),
  feedbackSubmit: document.getElementById("feedback-submit"),
  feedbackStatus: document.getElementById("feedback-status"),
  status: document.getElementById("status"),
  userLabel: document.getElementById("user-label")
};

const STORAGE_KEY = "applycontrol_auth";
const REMEMBER_KEY = "applycontrol_remember";

function setStatus(message, isError = false) {
  el.status.textContent = message || "";
  el.status.style.color = isError ? "#b00020" : "#2b7a2b";
}

function setFeedbackStatus(message, isError = false) {
  if (!el.feedbackStatus) return;
  el.feedbackStatus.textContent = message || "";
  el.feedbackStatus.style.color = isError ? "#b00020" : "#2b7a2b";
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

async function hasExistingApplication(auth, urlToCheck) {
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
  if (!res.ok) return false;
  const data = await res.json();
  for (const row of data) {
    const doc = row.document;
    if (!doc || !doc.fields || !doc.fields.url) continue;
    const existingUrl = doc.fields.url.stringValue || "";
    if (existingUrl === urlToCheck) return true;
  }
  return false;
}

function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
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
  el.openDashboard.classList.toggle("hidden", !signedIn);
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
  if (el.version && chrome.runtime && chrome.runtime.getManifest) {
    el.version.textContent = chrome.runtime.getManifest().version || "n/a";
  }
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

async function handleAuthChange() {
  const auth = await getValidAuth().catch(() => null);
  updateUI(auth);
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

if (el.helpToggle && el.helpPanel) {
  el.helpToggle.addEventListener("click", () => {
    el.helpPanel.classList.toggle("hidden");
    const expanded = !el.helpPanel.classList.contains("hidden");
    el.helpToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
}

function openFeedbackModal() {
  if (!el.feedbackModal) return;
  el.feedbackModal.classList.remove("hidden");
  if (el.feedbackTitle) el.feedbackTitle.focus();
}

function closeFeedbackModal() {
  if (!el.feedbackModal) return;
  el.feedbackModal.classList.add("hidden");
  if (el.feedbackTitle) el.feedbackTitle.value = "";
  if (el.feedbackMessage) el.feedbackMessage.value = "";
  setFeedbackStatus("");
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
        page_url: { stringValue: "" },
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

if (el.feedbackToggle) el.feedbackToggle.addEventListener("click", openFeedbackModal);
if (el.feedbackCancel) el.feedbackCancel.addEventListener("click", closeFeedbackModal);
if (el.feedbackSubmit) el.feedbackSubmit.addEventListener("click", submitFeedback);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.feedbackModal && !el.feedbackModal.classList.contains("hidden")) {
    closeFeedbackModal();
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
    const normalizedUrl = normalizeUrl(tab.url);
    const exists = await hasExistingApplication(auth, normalizedUrl);
    if (exists) {
      setStatus("Already saved.", true);
      return;
    }
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
      url: normalizedUrl,
      title: sanitizeText(extracted.title || tab.title || tab.url, { preserveLineBreaks: false }),
      company: sanitizeText(extracted.company || "", { preserveLineBreaks: false }),
      location: sanitizeText(extracted.location || "", { preserveLineBreaks: false }),
      description: sanitizeText(extracted.description || "", { preserveLineBreaks: true }),
      source: url.hostname
    });
    setStatus("Saved.");
  } catch (err) {
    setStatus(err.message, true);
  }
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

init();
