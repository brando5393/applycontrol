const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeText,
  makeFingerprint,
  isDuplicate,
  hasDuplicate,
  isListPageUrl,
  normalizeUrl,
  getUrlJobId,
  applicationsToCsv,
  appendStatusHistory,
  encodeStatusHistoryField,
  parseStatusHistoryField
} = require("../extension/lib/shared.js");

describe("sanitizeText", () => {
  test("returns empty string for null/undefined", () => {
    assert.equal(sanitizeText(null), "");
    assert.equal(sanitizeText(undefined), "");
  });

  test("strips NUL bytes", () => {
    const withNul = "hello" + String.fromCharCode(0) + "world";
    assert.equal(sanitizeText(withNul), "helloworld");
  });

  test("strips zero-width space/joiner/non-joiner and BOM", () => {
    const codes = [8203, 8204, 8205, 65279];
    for (const code of codes) {
      const s = "a" + String.fromCharCode(code) + "b";
      assert.equal(sanitizeText(s), "ab", `code ${code} should be stripped`);
    }
  });

  test("normalizes CRLF to LF", () => {
    assert.equal(sanitizeText("line1\r\nline2"), "line1\nline2");
  });

  test("collapses 3+ consecutive newlines to a double newline", () => {
    assert.equal(sanitizeText("a\n\n\n\n\nb"), "a\n\nb");
  });

  test("trims leading/trailing whitespace", () => {
    assert.equal(sanitizeText("   padded text   "), "padded text");
  });

  test("preserveLineBreaks defaults to true", () => {
    assert.equal(sanitizeText("line1\nline2"), "line1\nline2");
  });

  test("preserveLineBreaks:false collapses all whitespace runs to a single space", () => {
    assert.equal(
      sanitizeText("line1\n\nline2\t\ttabbed", { preserveLineBreaks: false }),
      "line1 line2 tabbed"
    );
  });
});

describe("makeFingerprint", () => {
  test("joins fields lowercased and pipe-separated", () => {
    const fp = makeFingerprint({
      title: "Software Engineer",
      company: "Acme Corp",
      location: "Remote",
      source: "www.indeed.com",
      description: "Build things."
    });
    assert.equal(fp, "software engineer|acme corp|remote|www.indeed.com|build things.");
  });

  test("truncates description to the first 200 characters", () => {
    const longDesc = "x".repeat(500);
    const fp = makeFingerprint({
      title: "T",
      company: "C",
      location: "L",
      source: "S",
      description: longDesc
    });
    const descPart = fp.split("|")[4];
    assert.equal(descPart.length, 200);
  });

  test("tolerates missing fields", () => {
    const fp = makeFingerprint({});
    assert.equal(fp, "||||");
  });

  test("collapses internal whitespace runs to single spaces", () => {
    const fp = makeFingerprint({ title: "Multi   Word    Title" });
    assert.ok(!fp.includes("  "), "should not contain double spaces");
  });
});

describe("isDuplicate / hasDuplicate", () => {
  test("matches on identical job_id alone", () => {
    const existing = { job_id: "abc123", url: "https://a.com/1", title: "A" };
    const candidate = { job_id: "abc123", url: "https://a.com/2", title: "B" };
    assert.equal(isDuplicate(existing, candidate), true);
  });

  test("matches on identical fingerprint alone", () => {
    const existing = { fingerprint: "fp-1" };
    const candidate = { fingerprint: "fp-1" };
    assert.equal(isDuplicate(existing, candidate), true);
  });

  test("matches on url+title+company combination", () => {
    const existing = { url: "https://a.com/job", title: "Engineer", company: "Acme" };
    const candidate = { url: "https://a.com/job", title: "Engineer", company: "Acme" };
    assert.equal(isDuplicate(existing, candidate), true);
  });

  test("does not match distinct jobs with no overlapping identifiers", () => {
    const existing = { job_id: "abc", url: "https://a.com/1", title: "A", company: "X" };
    const candidate = { job_id: "def", url: "https://a.com/2", title: "B", company: "Y" };
    assert.equal(isDuplicate(existing, candidate), false);
  });

  test("does not false-positive on same title/company but different url", () => {
    const existing = { url: "https://a.com/1", title: "Engineer", company: "Acme" };
    const candidate = { url: "https://a.com/2", title: "Engineer", company: "Acme" };
    assert.equal(isDuplicate(existing, candidate), false);
  });

  test("returns false for falsy existing or candidate", () => {
    assert.equal(isDuplicate(null, { job_id: "x" }), false);
    assert.equal(isDuplicate({ job_id: "x" }, null), false);
  });

  test("empty job_id on both sides does not count as a match", () => {
    const existing = { job_id: "", url: "https://a.com/1", title: "A" };
    const candidate = { job_id: "", url: "https://a.com/2", title: "B" };
    assert.equal(isDuplicate(existing, candidate), false);
  });

  test("hasDuplicate finds a match anywhere in the list", () => {
    const list = [
      { job_id: "one" },
      { job_id: "two" },
      { job_id: "three" }
    ];
    assert.equal(hasDuplicate(list, { job_id: "two" }), true);
    assert.equal(hasDuplicate(list, { job_id: "four" }), false);
  });

  test("hasDuplicate on an empty list is always false", () => {
    assert.equal(hasDuplicate([], { job_id: "anything" }), false);
  });
});

describe("isListPageUrl", () => {
  test("recognizes Indeed's bare /jobs path", () => {
    assert.equal(isListPageUrl("https://www.indeed.com/jobs"), true);
    assert.equal(isListPageUrl("https://www.indeed.com/jobs/"), true);
  });

  test("recognizes /jobs/q- and /jobs/search patterns", () => {
    assert.equal(isListPageUrl("https://www.indeed.com/jobs/q-engineer.html"), true);
    assert.equal(isListPageUrl("https://www.linkedin.com/jobs/search/?keywords=x"), true);
  });

  test("recognizes /jobs/collections", () => {
    assert.equal(isListPageUrl("https://www.linkedin.com/jobs/collections/recommended"), true);
  });

  test("recognizes generic /jobs/ with q= or keywords= query params", () => {
    assert.equal(isListPageUrl("https://example.com/jobs/?q=engineer"), true);
    assert.equal(isListPageUrl("https://example.com/jobs/?keywords=engineer"), true);
  });

  test("does not flag a single job detail page", () => {
    assert.equal(isListPageUrl("https://www.indeed.com/viewjob?jk=abc123"), false);
    assert.equal(isListPageUrl("https://www.monster.com/job-openings/foo--uuid"), false);
  });

  test("returns false for an unparseable URL instead of throwing", () => {
    assert.equal(isListPageUrl("not a url"), false);
  });
});

describe("normalizeUrl", () => {
  test("strips the hash fragment", () => {
    assert.equal(
      normalizeUrl("https://example.com/path?x=1#section"),
      "https://example.com/path?x=1"
    );
  });

  test("leaves a URL with no hash unchanged", () => {
    assert.equal(
      normalizeUrl("https://example.com/path?x=1"),
      "https://example.com/path?x=1"
    );
  });

  test("returns the raw input unchanged for an unparseable URL", () => {
    assert.equal(normalizeUrl("not a url"), "not a url");
  });
});

describe("getUrlJobId", () => {
  test("extracts Indeed's jk= query param", () => {
    assert.equal(
      getUrlJobId("https://www.indeed.com/viewjob?jk=abc123def"),
      "abc123def"
    );
  });

  test("extracts jobId=, jobid=, and jobKey= variants", () => {
    assert.equal(getUrlJobId("https://x.com/job?jobId=111"), "111");
    assert.equal(getUrlJobId("https://x.com/job?jobid=222"), "222");
    assert.equal(getUrlJobId("https://x.com/job?jobKey=333"), "333");
  });

  test("extracts Monster's trailing UUID from the path", () => {
    const url =
      "https://www.monster.com/job-openings/sr-software-engineer-cincinnati-oh--91dffcd9-54e6-4323-885c-cb75265978a8";
    assert.equal(getUrlJobId(url), "91dffcd9-54e6-4323-885c-cb75265978a8");
  });

  test("returns empty string when no recognizable id is present", () => {
    assert.equal(getUrlJobId("https://example.com/jobs/search?q=engineer"), "");
  });

  test("returns empty string for empty or unparseable input", () => {
    assert.equal(getUrlJobId(""), "");
    assert.equal(getUrlJobId("not a url"), "");
  });
});

describe("applicationsToCsv", () => {
  test("writes a header row followed by one row per application", () => {
    const csv = applicationsToCsv([
      { title: "Engineer", company: "Acme", location: "Remote", source: "indeed.com", status: "applied", url: "https://a.com/1" }
    ]);
    const lines = csv.split("\r\n");
    assert.equal(lines[0], "title,company,location,source,status,url,captured_at");
    assert.equal(lines[1], "Engineer,Acme,Remote,indeed.com,applied,https://a.com/1,");
  });

  test("quotes and escapes fields containing commas or quotes", () => {
    const csv = applicationsToCsv([
      { title: 'Senior Engineer, "AI"', company: "Acme", location: "", source: "", status: "applied", url: "" }
    ]);
    const firstField = csv.split("\r\n")[1];
    assert.equal(firstField.startsWith('"Senior Engineer, ""AI"""'), true);
  });

  test("serializes a Date captured_at as ISO", () => {
    const csv = applicationsToCsv([
      { title: "T", company: "C", location: "L", source: "S", status: "applied", url: "U", captured_at: new Date("2026-03-01T12:00:00.000Z") }
    ]);
    assert.match(csv.split("\r\n")[1], /2026-03-01T12:00:00\.000Z$/);
  });

  test("produces just the header row for an empty list", () => {
    const csv = applicationsToCsv([]);
    assert.equal(csv, "title,company,location,source,status,url,captured_at");
  });
});

describe("appendStatusHistory", () => {
  test("appends to an existing history without mutating the original array", () => {
    const original = [{ status: "applied", changed_at: "t0" }];
    const result = appendStatusHistory(original, "interview", "t1");
    assert.deepEqual(result, [
      { status: "applied", changed_at: "t0" },
      { status: "interview", changed_at: "t1" }
    ]);
    assert.equal(original.length, 1, "must not mutate the original array");
  });

  test("starts a fresh history when given null/undefined", () => {
    assert.deepEqual(appendStatusHistory(null, "applied", "t0"), [
      { status: "applied", changed_at: "t0" }
    ]);
    assert.deepEqual(appendStatusHistory(undefined, "applied", "t0"), [
      { status: "applied", changed_at: "t0" }
    ]);
  });
});

describe("encodeStatusHistoryField / parseStatusHistoryField round-trip", () => {
  test("decoding an encoded history returns the original entries", () => {
    const history = [
      { status: "applied", changed_at: "2026-01-01T00:00:00.000Z" },
      { status: "interview", changed_at: "2026-02-01T00:00:00.000Z" }
    ];
    const encoded = encodeStatusHistoryField(history);
    const decoded = parseStatusHistoryField(encoded);
    assert.deepEqual(decoded, history);
  });

  test("parseStatusHistoryField tolerates a missing/empty field", () => {
    assert.deepEqual(parseStatusHistoryField(undefined), []);
    assert.deepEqual(parseStatusHistoryField(null), []);
    assert.deepEqual(parseStatusHistoryField({}), []);
  });

  test("encodeStatusHistoryField produces Firestore's arrayValue/mapValue shape", () => {
    const encoded = encodeStatusHistoryField([{ status: "applied", changed_at: "t0" }]);
    assert.equal(
      encoded.arrayValue.values[0].mapValue.fields.status.stringValue,
      "applied"
    );
    assert.equal(
      encoded.arrayValue.values[0].mapValue.fields.changed_at.timestampValue,
      "t0"
    );
  });
});
