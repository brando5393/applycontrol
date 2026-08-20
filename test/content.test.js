// DOM-level regression tests for extension/content.js, built directly from
// real markup captured while diagnosing this session's Monster and Indeed
// capture bugs (see TODO.md). These lock the fixes in so a future selector
// change can't silently regress the exact failure modes that were already
// found and fixed.
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const shared = require("../extension/lib/shared.js");

// content.js's functions reference `document`/`window` as free variables
// resolved against the Node global object at call time (not at require
// time), so swapping global.document/global.window between tests is enough
// to point the same required module at a different page.
global.getUrlJobId = shared.getUrlJobId;
const content = require("../extension/content.js");

let currentDom = null;

function setPage(html, url) {
  if (currentDom) currentDom.window.close();
  currentDom = new JSDOM(html, { url });
  global.window = currentDom.window;
  global.document = currentDom.window.document;
  return currentDom;
}

afterEach(() => {
  if (currentDom) {
    currentDom.window.close();
    currentDom = null;
  }
});

describe("Monster card extraction", () => {
  // Real markup shape: article[data-testid="JobCard"] with jobTitle/company/
  // jobDetailLocation testids and a job_<hex>-style link is NOT how Monster
  // encodes id -- Monster's job id is the trailing UUID in the card's own
  // link, matched via getUrlJobId's UUID pattern.
  const html = `<html><body><div id="list">
    <article data-testid="JobCard" class="indexmodern__JobCardComponent card-not-selected">
      <a data-testid="jobTitle" href="https://www.monster.com/job-openings/first-job-title--91dffcd9-54e6-4323-885c-cb75265978a8">First Job Title</a>
      <span data-testid="company">First Company</span>
      <span data-testid="jobDetailLocation">Cincinnati, OH</span>
    </article>
    <article data-testid="JobCard" class="indexmodern__JobCardComponent card-selected">
      <a data-testid="jobTitle" href="https://www.monster.com/job-openings/second-job-title--25146bff-7b0a-4c85-830f-a5cb9a084e1e">Second Job Title</a>
      <span data-testid="company">Second Company</span>
      <span data-testid="jobDetailLocation">CA</span>
    </article>
  </div></body></html>`;

  beforeEach(() => {
    setPage(html, "https://www.monster.com/jobs/search");
  });

  test("findActiveCard resolves the card carrying .card-selected, not the first one", () => {
    const card = content.findActiveCard();
    const extracted = content.extractFromCard(card);
    assert.equal(extracted.title, "Second Job Title");
    assert.equal(extracted.company, "Second Company");
  });

  test("extractFromCard pulls job_id from the trailing UUID in the card's own link", () => {
    const card = content.findActiveCard();
    const extracted = content.extractFromCard(card);
    assert.equal(extracted.job_id, "25146bff-7b0a-4c85-830f-a5cb9a084e1e");
  });

  test("distinct cards produce distinct, non-colliding job_id/title/company", () => {
    const cards = document.querySelectorAll("article[data-testid='JobCard']");
    const results = [...cards].map((c) => content.extractFromCard(c));
    assert.notEqual(results[0].job_id, results[1].job_id);
    assert.notEqual(results[0].title, results[1].title);
    assert.notEqual(results[0].company, results[1].company);
  });

  test("an unrelated aria-selected=true control does not hijack card resolution", () => {
    // Regression case: Monster's save/quick-apply button on the FIRST
    // (non-selected) card carries a stale aria-selected="true" that used to
    // win by DOM order before class-based markers were checked first.
    const dom = setPage(
      html.replace(
        '<article data-testid="JobCard" class="indexmodern__JobCardComponent card-not-selected">',
        '<article data-testid="JobCard" class="indexmodern__JobCardComponent card-not-selected"><button aria-selected="true">Save</button>'
      ),
      "https://www.monster.com/jobs/search"
    );
    const card = content.findActiveCard();
    const extracted = content.extractFromCard(card);
    assert.equal(extracted.title, "Second Job Title", "must still resolve to the truly selected card");
  });
});

describe("Indeed card extraction", () => {
  test("findActiveCard resolves via the vjk URL param even when a stale .vjs-highlight exists elsewhere", () => {
    // Regression case: over a real browsing session Indeed leaves
    // .vjs-highlight on more than one card at once (confirmed live: up to
    // 7 simultaneously). The first-DOM-match class lookup used to silently
    // lock onto whichever one loaded first; vjk is the ground truth.
    const html = `<html><body><div id="list">
      <article class="cardOutline tapItem job_aaa111 vjs-highlight">
        <a data-testid="jobTitle" href="/rc/clk?jk=aaa111">Stale Highlighted Job</a>
        <span data-testid="company">Stale Co</span>
      </article>
      <article class="cardOutline tapItem job_bbb222 vjs-highlight">
        <a data-testid="jobTitle" href="/rc/clk?jk=bbb222">Actually Open Job</a>
        <span data-testid="company">Actually Open Co</span>
      </article>
    </div></body></html>`;
    setPage(html, "https://www.indeed.com/?vjk=bbb222");
    const card = content.findActiveCard();
    const extracted = content.extractFromCard(card);
    assert.equal(extracted.title, "Actually Open Job");
    assert.equal(extracted.job_id, "bbb222");
  });

  test("getCardId falls back to the job_<hex> class token when the link has no jk= param", () => {
    // Regression case: Indeed's homepage/recommendation cards don't put the
    // job id in the link href at all, unlike search-results cards.
    const html = `<html><body>
      <article class="tapItem result job_c0ffee123">
        <a href="https://www.indeed.com/some/opaque/path">No query-string id here</a>
      </article>
    </body></html>`;
    setPage(html, "https://www.indeed.com/");
    const card = document.querySelector(".tapItem");
    assert.equal(content.getCardId(card), "c0ffee123");
  });

  test("extractIndeed finds the split-view title via data-testid even though it's an <h2>, not <h1>", () => {
    // Regression case: extractIndeed() used to only match
    // h1.jobsearch-JobInfoHeader-title / a generic h1 fallback, which grabs
    // the *search-results page* heading once Indeed switched the split-view
    // job title to an <h2> with the same class.
    const html = `<html><body>
      <h1>software engineer jobs in Remote</h1>
      <div id="pane">
        <h2 data-testid="jobsearch-JobInfoHeader-title" class="jobsearch-JobInfoHeader-title">Backend Engineer - job post</h2>
        <div data-testid="inlineHeader-companyName">Real Company</div>
        <div data-testid="inlineHeader-companyLocation">Austin, TX</div>
      </div>
    </body></html>`;
    setPage(html, "https://www.indeed.com/?vjk=xyz");
    const extracted = content.extractIndeed();
    assert.equal(extracted.title, "Backend Engineer - job post");
    assert.equal(extracted.company, "Real Company");
    assert.notEqual(extracted.title, "software engineer jobs in Remote");
  });
});

describe("extractPayload merge behavior", () => {
  test("Monster: a confirmed active card overrides the page-global (often wrong) company/location", () => {
    // Regression case: extractMonster()'s page-global selectors can match a
    // placeholder/unrelated element on a list page; once a real card is
    // found, its data must win rather than only filling in blanks.
    const html = `<html><body>
      <h1>IT Jobs in the United States</h1>
      <div data-testid="company">Placeholder Corp</div>
      <article data-testid="JobCard" class="card-selected">
        <a data-testid="jobTitle" href="https://www.monster.com/job-openings/real-job--91dffcd9-54e6-4323-885c-cb75265978a8">Real Job Title</a>
        <span data-testid="company">Real Company</span>
        <span data-testid="jobDetailLocation">Remote</span>
      </article>
    </body></html>`;
    setPage(html, "https://www.monster.com/jobs/search");
    const payload = content.extractPayload();
    assert.equal(payload.title, "Real Job Title");
    assert.equal(payload.company, "Real Company");
    assert.equal(payload.location, "Remote");
    assert.equal(payload.job_id, "91dffcd9-54e6-4323-885c-cb75265978a8");
  });

  test("Indeed: title/company/job_id are mutually consistent for the actually-open job", () => {
    const html = `<html><body>
      <h1>software engineer jobs in Remote</h1>
      <div id="pane">
        <h2 data-testid="jobsearch-JobInfoHeader-title">Platform Engineer - job post</h2>
        <div data-testid="inlineHeader-companyName">Vector Security</div>
      </div>
      <article class="tapItem job_bbb222 vjs-highlight">
        <a data-testid="jobTitle" href="/rc/clk?jk=bbb222">Platform Engineer</a>
        <span data-testid="company">Vector Security</span>
      </article>
    </body></html>`;
    setPage(html, "https://www.indeed.com/?vjk=bbb222");
    const payload = content.extractPayload();
    assert.equal(payload.job_id, "bbb222");
    assert.equal(payload.title, "Platform Engineer - job post");
    assert.equal(payload.company, "Vector Security");
  });
});
