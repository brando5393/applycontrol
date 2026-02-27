const config = window.APPLYCONTROL_CONFIG || {};

const el = {
  authSection: document.getElementById("auth-section"),
  appSection: document.getElementById("app-section"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  signIn: document.getElementById("sign-in"),
  signUp: document.getElementById("sign-up"),
  signOut: document.getElementById("sign-out"),
  authStatus: document.getElementById("auth-status"),
  list: document.getElementById("list"),
  search: document.getElementById("search"),
  userLabel: document.getElementById("user-label"),
  count: document.getElementById("count"),
  statusFilters: document.getElementById("status-filters")
};

function setAuthStatus(message, isError = false) {
  el.authStatus.textContent = message || "";
  el.authStatus.style.color = isError ? "#b00020" : "#2b7a2b";
}

function requireConfig() {
  if (!config.firebaseConfig || !config.firebaseConfig.apiKey) {
    setAuthStatus("Missing config.js values.", true);
    return false;
  }
  return true;
}

if (!requireConfig()) {
  throw new Error("Missing config.");
}

firebase.initializeApp(config.firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let cachedApps = [];
let activeStatus = "all";

const STATUS_OPTIONS = [
  "all",
  "applied",
  "callback",
  "interview",
  "offer",
  "rejected"
];

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

function renderList() {
  const query = el.search.value.trim().toLowerCase();
  el.list.innerHTML = "";
  const apps = cachedApps
    .filter((app) => {
      if (!query) return true;
      return (
        app.title.toLowerCase().includes(query) ||
        (app.source || "").toLowerCase().includes(query)
      );
    })
    .filter((app) => {
      if (activeStatus === "all") return true;
      return (app.status || "applied") === activeStatus;
    })
    .sort((a, b) => {
      const aTime = a.captured_at ? a.captured_at.toMillis() : 0;
      const bTime = b.captured_at ? b.captured_at.toMillis() : 0;
      return bTime - aTime;
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
        ${
          app.location
            ? `<div class="badge">${app.location}</div>`
            : ""
        }
      </div>
      <div class="meta">${app.source || "unknown"}</div>
      <div class="meta">${
        app.captured_at ? app.captured_at.toDate().toLocaleString() : "n/a"
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
      await db.collection("applications").doc(app.id).update({
        status: e.target.value
      });
    });
    el.list.appendChild(row);
  }
}

el.search.addEventListener("input", renderList);

el.signUp.addEventListener("click", async () => {
  setAuthStatus("");
  try {
    await auth.createUserWithEmailAndPassword(
      el.email.value,
      el.password.value
    );
    setAuthStatus("Signed up.");
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

el.signIn.addEventListener("click", async () => {
  setAuthStatus("");
  try {
    await auth.signInWithEmailAndPassword(el.email.value, el.password.value);
    setAuthStatus("Signed in.");
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

el.signOut.addEventListener("click", async () => {
  await auth.signOut();
});

auth.onAuthStateChanged((user) => {
  const signedIn = !!user;
  el.authSection.classList.toggle("hidden", signedIn);
  el.appSection.classList.toggle("hidden", !signedIn);
  el.signOut.classList.toggle("hidden", !signedIn);
  el.userLabel.textContent = signedIn ? user.email : "";

  if (!signedIn) {
    cachedApps = [];
    renderStatusFilters();
    renderList();
    return;
  }

  db.collection("applications")
    .where("user_id", "==", user.uid)
    .onSnapshot((snap) => {
      cachedApps = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      renderStatusFilters();
      renderList();
    });
});

renderStatusFilters();
