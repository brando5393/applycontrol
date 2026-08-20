// Smoke tests that popup.html and dashboard.html actually load cleanly with
// their real <script> tag order (config.js -> lib/shared.js -> lib/auth.js
// -> popup.js/dashboard.js). This catches the class of bug a plain
// node --check per-file can't: a script that references a global only
// defined in a file loaded after it, a duplicate top-level `const`, or an
// HTML file whose <script> tags fell out of sync with what the JS actually
// needs. Uses real injected <script> elements (not window.eval per file),
// since that's what actually shares top-level let/const across scripts the
// way real <script src> tags do in a browser.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const path = require("node:path");

const EXT_DIR = path.join(__dirname, "..", "extension");

function makeChromeStub() {
  const listeners = [];
  return {
    storage: {
      local: {
        get: (_keys, cb) => cb({}),
        set: (_obj, cb) => cb && cb(),
        remove: (_keys, cb) => cb && cb()
      },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    },
    runtime: {
      getManifest: () => ({ version: "0.0.0-test" }),
      lastError: null,
      onMessage: { addListener: () => {} }
    },
    tabs: { query: (_opts, cb) => cb([]) },
    identity: undefined
  };
}

function loadPage(htmlFile, jsFiles) {
  const html = fs.readFileSync(path.join(EXT_DIR, htmlFile), "utf8");
  const dom = new JSDOM(html, { url: "https://example.com/", runScripts: "dangerously" });
  const window = dom.window;
  const document = window.document;
  window.chrome = makeChromeStub();
  window.APPLYCONTROL_CONFIG = { firebaseApiKey: "test-key", firebaseProjectId: "test-project" };
  for (const file of jsFiles) {
    const code = fs.readFileSync(path.join(EXT_DIR, file), "utf8");
    const scriptEl = document.createElement("script");
    scriptEl.textContent = code;
    document.body.appendChild(scriptEl);
  }
  return window;
}

describe("popup.html script load order", () => {
  test("loads without throwing and defines the expected globals", () => {
    const win = loadPage("popup.html", ["lib/shared.js", "lib/auth.js", "popup.js"]);
    assert.equal(typeof win.getValidAuth, "function");
    assert.equal(typeof win.buildAuthFromAuthResponse, "function");
    assert.equal(typeof win.sendPasswordReset, "function");
    assert.equal(typeof win.signInWithGoogle, "function");
    assert.equal(typeof win.isDuplicate, "function", "shared.js globals must be visible too");
  });
});

describe("dashboard.html script load order", () => {
  test("loads without throwing and defines the expected globals", () => {
    const win = loadPage("dashboard.html", ["lib/shared.js", "lib/auth.js", "dashboard.js"]);
    assert.equal(typeof win.getValidAuth, "function");
    assert.equal(typeof win.ensurePolling, "function");
    assert.equal(typeof win.applicationsToCsv, "function", "shared.js globals must be visible too");
  });
});
