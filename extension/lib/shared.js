// Pure logic shared across the extension's popup, content script, and
// dashboard. Nothing in this file touches the DOM, chrome.*, or window --
// that's what makes it safely require()-able from the test suite without
// any browser/extension stubbing.

function sanitizeText(value, opts) {
  var preserveLineBreaks = opts && "preserveLineBreaks" in opts ? opts.preserveLineBreaks : true;
  if (value == null) return "";
  var text = String(value);
  // Stripped by character code (not literal escapes), so this file never
  // embeds actual control/zero-width characters in its own source:
  // 0 = NUL, 8203-8205 = zero-width space/non-joiner/joiner,
  // 65279 = BOM / zero-width no-break space.
  var stripCodes = [0, 8203, 8204, 8205, 65279];
  for (var i = 0; i < stripCodes.length; i++) {
    text = text.split(String.fromCharCode(stripCodes[i])).join("");
  }
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  if (!preserveLineBreaks) {
    text = text.replace(/\s+/g, " ");
  }
  return text;
}

function makeFingerprint(fields) {
  var title = fields.title, company = fields.company, location = fields.location,
    source = fields.source, description = fields.description;
  var descSnippet = (description || "").toLowerCase().trim().slice(0, 200);
  var parts = [title, company, location, source, descSnippet].map(function (v) {
    return (v || "").toLowerCase().trim();
  });
  var base = parts.join("|");
  return base.replace(/\s+/g, " ");
}

function isDuplicate(existing, candidate) {
  if (!existing || !candidate) return false;
  var sameJobId =
    existing.job_id && candidate.job_id &&
    existing.job_id === candidate.job_id;
  var sameFingerprint =
    existing.fingerprint && candidate.fingerprint &&
    existing.fingerprint === candidate.fingerprint;
  var sameUrlTitleCompany =
    existing.url &&
    candidate.url &&
    existing.url === candidate.url &&
    existing.title &&
    candidate.title &&
    existing.title === candidate.title &&
    (existing.company || "") === (candidate.company || "");
  return sameJobId || sameFingerprint || sameUrlTitleCompany;
}

function hasDuplicate(existingList, candidate) {
  return existingList.some(function (e) { return isDuplicate(e, candidate); });
}

function isListPageUrl(urlValue) {
  try {
    var u = new URL(urlValue);
    var path = u.pathname.toLowerCase();
    var search = u.search.toLowerCase();
    if (path === "/jobs" || path === "/jobs/") return true;
    if (path.includes("/jobs/q-") || path.includes("/jobs/search")) return true;
    if (path.includes("/jobs/collections")) return true;
    if (path.includes("/jobs/") && (search.includes("q=") || search.includes("keywords="))) return true;
    return false;
  } catch (err) {
    return false;
  }
}

function normalizeUrl(raw) {
  try {
    var u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch (err) {
    return raw;
  }
}

function getUrlJobId(url) {
  if (!url) return "";
  try {
    var u = new URL(url);
    var monsterMatch = u.pathname.match(
      /--([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
    );
    if (monsterMatch) return monsterMatch[1];
    return (
      u.searchParams.get("jk") ||
      u.searchParams.get("jobId") ||
      u.searchParams.get("jobid") ||
      u.searchParams.get("jobKey") ||
      ""
    );
  } catch (err) {
    return "";
  }
}

function csvField(value) {
  var s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

var CSV_COLUMNS = ["title", "company", "location", "source", "status", "url", "captured_at"];

function applicationsToCsv(applications) {
  var rows = [CSV_COLUMNS.join(",")];
  for (var i = 0; i < applications.length; i++) {
    var app = applications[i];
    var row = CSV_COLUMNS.map(function (col) {
      var value = app[col];
      if (col === "captured_at" && value && typeof value.toISOString === "function") {
        value = value.toISOString();
      }
      return csvField(value);
    });
    rows.push(row.join(","));
  }
  return rows.join("\r\n");
}

function appendStatusHistory(existingHistory, status, changedAt) {
  var history = Array.isArray(existingHistory) ? existingHistory.slice() : [];
  history.push({ status: status, changed_at: changedAt });
  return history;
}

// Firestore REST API's field-value encoding for an array of {status,
// changed_at} maps. Shared so popup.js (seeding the initial entry at
// capture time) and dashboard.js (appending on every status change, and
// decoding for display) stay in sync on the wire format.
function encodeStatusHistoryField(history) {
  return {
    arrayValue: {
      values: history.map(function (h) {
        return {
          mapValue: {
            fields: {
              status: { stringValue: h.status },
              changed_at: { timestampValue: h.changed_at }
            }
          }
        };
      })
    }
  };
}

function parseStatusHistoryField(field) {
  if (!field || !field.arrayValue || !field.arrayValue.values) return [];
  return field.arrayValue.values.map(function (v) {
    var f = (v.mapValue && v.mapValue.fields) || {};
    return {
      status: f.status ? f.status.stringValue || "" : "",
      changed_at: f.changed_at ? f.changed_at.timestampValue || "" : ""
    };
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    sanitizeText: sanitizeText,
    makeFingerprint: makeFingerprint,
    isDuplicate: isDuplicate,
    hasDuplicate: hasDuplicate,
    isListPageUrl: isListPageUrl,
    normalizeUrl: normalizeUrl,
    applicationsToCsv: applicationsToCsv,
    appendStatusHistory: appendStatusHistory,
    encodeStatusHistoryField: encodeStatusHistoryField,
    parseStatusHistoryField: parseStatusHistoryField,
    getUrlJobId: getUrlJobId
  };
}
