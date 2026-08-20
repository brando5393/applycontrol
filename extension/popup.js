// config, STORAGE_KEY, REMEMBER_KEY, and all auth/session helpers
// (loadAuth/saveAuth/clearAuth/loadRemember/signUp/signIn/refreshToken/
// getValidAuth/sendPasswordReset/signInWithGoogle) live in lib/auth.js,
// loaded before this file -- see manifest.json / popup.html.

const el = {
  authSection: document.getElementById("auth-section"),
  appSection: document.getElementById("app-section"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  rememberMe: document.getElementById("remember-me"),
  signIn: document.getElementById("sign-in"),
  signUp: document.getElementById("sign-up"),
  signOut: document.getElementById("sign-out"),
  forgotPassword: document.getElementById("forgot-password"),
  googleSignIn: document.getElementById("google-sign-in"),
  openDashboard: document.getElementById("open-dashboard"),
  capture: document.getElementById("capture"),
  verifySection: document.getElementById("verify-section"),
  resendVerify: document.getElementById("resend-verify"),
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

const ONBOARDED_KEY = "applycontrol_onboarded";

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

async function saveApplication(auth, payload) {
  const url = `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId}/databases/(default)/documents/applications`;
  const capturedAt = new Date().toISOString();
  const fields = {
    user_id: { stringValue: auth.localId },
    url: { stringValue: payload.url },
    title: { stringValue: payload.title },
    captured_at: { timestampValue: capturedAt },
    status: { stringValue: "applied" },
    status_history: encodeStatusHistoryField(
      appendStatusHistory([], "applied", capturedAt)
    ),
    source: { stringValue: payload.source }
  };
  if (payload.company) fields.company = { stringValue: payload.company };
  if (payload.location) fields.location = { stringValue: payload.location };
  if (payload.description)
    fields.description = { stringValue: payload.description };
  if (payload.fingerprint)
    fields.fingerprint = { stringValue: payload.fingerprint };
  if (payload.job_id) fields.job_id = { stringValue: payload.job_id };

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

async function getExistingApplications(auth) {
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
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  for (const row of data) {
    const doc = row.document;
    if (!doc || !doc.fields) continue;
    out.push({
      url: doc.fields.url ? doc.fields.url.stringValue || "" : "",
      title: doc.fields.title ? doc.fields.title.stringValue || "" : "",
      fingerprint: doc.fields.fingerprint ? doc.fields.fingerprint.stringValue || "" : "",
      company: doc.fields.company ? doc.fields.company.stringValue || "" : "",
      job_id: doc.fields.job_id ? doc.fields.job_id.stringValue || "" : ""
    });
  }
  return out;
}

// isDuplicate, hasDuplicate, isListPageUrl, normalizeUrl, makeFingerprint,
// and sanitizeText live in lib/shared.js (loaded before this file) so they
// can be unit-tested without any DOM/chrome stubbing.

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0]);
    });
  });
}

function updateUI(auth) {
  const signedIn = !!auth && !auth.stale;
  el.authSection.classList.toggle("hidden", signedIn);
  el.appSection.classList.toggle("hidden", !signedIn);
  el.openDashboard.classList.toggle("hidden", !signedIn);
  el.userLabel.textContent = signedIn ? `Signed in: ${auth.email}` : "";
  if (auth && auth.stale) {
    setStatus("Session expired. Please sign in again.", true);
  }
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

async function checkEmailVerification(auth) {
  if (!el.verifySection || !auth || auth.stale) return;
  try {
    const info = await fetchAccountInfo(auth.idToken);
    const verified = !!(info && info.emailVerified);
    el.verifySection.classList.toggle("hidden", verified);
  } catch {
    // Non-critical -- a failed lookup shouldn't block using the popup.
  }
}

async function init() {
  if (!requireConfig()) return;
  el.rememberMe.checked = await loadRemember();
  const auth = await getValidAuth().catch(() => null);
  updateUI(auth);
  if (auth && !auth.stale) await checkEmailVerification(auth);
  if (el.version && chrome.runtime && chrome.runtime.getManifest) {
    el.version.textContent = chrome.runtime.getManifest().version || "n/a";
  }
  await maybeShowOnboarding();
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
  setStatus("Signing up...");
  try {
    const data = await signUp(el.email.value, el.password.value);
    const auth = buildAuthFromAuthResponse(data);
    await saveAuth(auth, el.rememberMe.checked);
    updateUI(auth);
    setStatus("Signed up.");
    try {
      await sendEmailVerification(auth.idToken);
    } catch {
      // Best-effort -- a new account is still usable if this fails.
    }
    await checkEmailVerification(auth);
  } catch (err) {
    setStatus(err.message, true);
  }
});

el.signIn.addEventListener("click", async () => {
  if (!requireConfig()) return;
  setStatus("Signing in...");
  try {
    const data = await signIn(el.email.value, el.password.value);
    const auth = buildAuthFromAuthResponse(data);
    await saveAuth(auth, el.rememberMe.checked);
    updateUI(auth);
    setStatus("Signed in.");
    await checkEmailVerification(auth);
  } catch (err) {
    setStatus(err.message, true);
  }
});

el.signOut.addEventListener("click", async () => {
  await clearAuth();
  updateUI(null);
  setStatus("Signed out.");
});

if (el.forgotPassword) {
  el.forgotPassword.addEventListener("click", async () => {
    if (!requireConfig()) return;
    const email = el.email.value.trim();
    if (!email) {
      setStatus("Enter your email above first, then click \"Forgot password?\"", true);
      return;
    }
    setStatus("Sending password reset email...");
    try {
      await sendPasswordReset(email);
      setStatus("Password reset email sent. Check your inbox.");
    } catch (err) {
      setStatus(err.message, true);
    }
  });
}

if (el.googleSignIn) {
  el.googleSignIn.addEventListener("click", async () => {
    if (!requireConfig()) return;
    setStatus("Signing in with Google...");
    try {
      const data = await signInWithGoogle();
      const auth = buildAuthFromAuthResponse(data);
      await saveAuth(auth, el.rememberMe.checked);
      updateUI(auth);
      setStatus("Signed in.");
      await checkEmailVerification(auth);
    } catch (err) {
      setStatus(err.message, true);
    }
  });
}

el.openDashboard.addEventListener("click", () => {
  if (chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  }
});

if (el.resendVerify) {
  el.resendVerify.addEventListener("click", async () => {
    const auth = await getValidAuth().catch(() => null);
    if (!auth || auth.stale) {
      setStatus("Please sign in again.", true);
      return;
    }
    setStatus("Sending verification email...");
    try {
      await sendEmailVerification(auth.idToken);
      setStatus("Verification email sent. Check your inbox.");
    } catch (err) {
      setStatus(err.message, true);
    }
  });
}

function isOnboarded() {
  return new Promise((resolve) => {
    chrome.storage.local.get([ONBOARDED_KEY], (result) => {
      resolve(!!result[ONBOARDED_KEY]);
    });
  });
}

function markOnboarded() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [ONBOARDED_KEY]: true }, resolve);
  });
}

async function maybeShowOnboarding() {
  if (!el.helpToggle || !el.helpPanel) return;
  const onboarded = await isOnboarded();
  if (onboarded) return;
  el.helpPanel.classList.remove("hidden");
  el.helpToggle.setAttribute("aria-expanded", "true");
  await markOnboarded();
}

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
  if (!auth || auth.stale) {
    setFeedbackStatus(
      auth && auth.stale
        ? "Session expired. Please sign in again."
        : "Please sign in first.",
      true
    );
    if (auth && auth.stale) updateUI(auth);
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
    if (auth.stale) {
      updateUI(auth);
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
    const candidateUrlRaw = extracted.url || tab.url;
    const normalizedUrl = normalizeUrl(candidateUrlRaw);
    let sourceHost = url.hostname;
    try {
      sourceHost = new URL(candidateUrlRaw).hostname || sourceHost;
    } catch {
      sourceHost = url.hostname;
    }
    const candidateTitle = sanitizeText(extracted.title || tab.title || tab.url, { preserveLineBreaks: false });
    const candidateCompany = sanitizeText(extracted.company || "", { preserveLineBreaks: false });
    const candidateLocation = sanitizeText(extracted.location || "", { preserveLineBreaks: false });
    const candidateDescription = sanitizeText(extracted.description || "", { preserveLineBreaks: true });
    const candidateJobId = sanitizeText(extracted.job_id || "", { preserveLineBreaks: false });
    const fromList = !!extracted.from_list;
    const fingerprint = makeFingerprint({
      title: candidateTitle,
      company: candidateCompany,
      location: candidateLocation,
      source: sourceHost,
      description: candidateDescription
    });
    const useFingerprint =
      !!candidateDescription &&
      candidateDescription.length >= 40 &&
      (!fromList || candidateDescription.length <= 500);
    const usableFingerprint = useFingerprint ? fingerprint : "";
    const existing = await getExistingApplications(auth);
    const ignoreUrl = isListPageUrl(normalizedUrl) && !extracted.url;
    if (hasDuplicate(existing, {
      url: ignoreUrl ? "" : normalizedUrl,
      title: candidateTitle,
      fingerprint: usableFingerprint,
      company: candidateCompany,
      job_id: candidateJobId
    })) {
      setStatus("Already saved.", true);
      return;
    }

    await saveApplication(auth, {
      url: normalizedUrl,
      title: candidateTitle,
      company: candidateCompany,
      location: candidateLocation,
      description: candidateDescription,
      source: sourceHost,
      fingerprint: usableFingerprint,
      job_id: candidateJobId
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
