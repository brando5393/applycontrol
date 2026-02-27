function textFromMeta(name, attr = "name") {
  const el = document.querySelector(`meta[${attr}="${name}"]`);
  return el ? el.getAttribute("content") || "" : "";
}

function pickFirstText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent) {
      const text = el.textContent.trim();
      if (text) return text;
    }
  }
  return "";
}

function extractDescription() {
  const meta =
    textFromMeta("description") ||
    textFromMeta("og:description", "property") ||
    textFromMeta("twitter:description", "name");
  if (meta) return meta;

  const article = document.querySelector("article, main");
  if (article && article.textContent) {
    const text = article.textContent.trim();
    return text.slice(0, 2000);
  }
  return "";
}

function extractCompany() {
  const meta =
    textFromMeta("og:site_name", "property") || textFromMeta("twitter:site");
  if (meta) return meta.replace("@", "");

  return pickFirstText([
    "[data-company]",
    ".company",
    ".job-company",
    ".company-name",
    "[class*='company']",
    "[class*='employer']"
  ]);
}

function extractLocation() {
  return pickFirstText([
    "[data-location]",
    ".location",
    ".job-location",
    ".location-name",
    "[class*='location']"
  ]);
}

function extractTitle() {
  const h1 = pickFirstText(["h1", "[data-testid='job-title']", ".job-title", ".posting-headline h2"]);
  return (
    h1 ||
    textFromMeta("og:title", "property") ||
    textFromMeta("twitter:title", "name") ||
    document.title ||
    ""
  );
}

function getText(selector) {
  const el = document.querySelector(selector);
  if (!el || !el.textContent) return "";
  return el.textContent.trim();
}

function extractIndeed() {
  return {
    title:
      getText("h1.jobsearch-JobInfoHeader-title") ||
      getText("h1"),
    company:
      getText("[data-company-name]") ||
      getText(".jobsearch-InlineCompanyRating div:first-child") ||
      getText(".jobsearch-CompanyInfoWithoutHeaderImage div:first-child"),
    location:
      getText(".jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-subtitle-location") ||
      getText(".jobsearch-CompanyInfoWithoutHeaderImage div:nth-child(2)"),
    description:
      getText("#jobDescriptionText") ||
      getText(".jobsearch-jobDescriptionText")
  };
}

function extractMonster() {
  return {
    title:
      getText("h1") ||
      getText(".title") ||
      getText("[data-testid='job-title']"),
    company:
      getText("[data-testid='company']") ||
      getText(".company") ||
      getText(".company-name"),
    location:
      getText("[data-testid='job-location']") ||
      getText(".location") ||
      getText(".location-name"),
    description:
      getText("#JobDescription") ||
      getText(".job-description") ||
      getText("[data-testid='job-description']")
  };
}

function extractLinkedIn() {
  return {
    title:
      getText(".top-card-layout__title") ||
      getText("h1"),
    company:
      getText(".top-card-layout__company-name") ||
      getText(".topcard__org-name-link") ||
      getText(".topcard__flavor"),
    location:
      getText(".top-card-layout__first-subline .top-card-layout__bullet") ||
      getText(".topcard__flavor--bullet"),
    description:
      getText(".show-more-less-html__markup") ||
      getText(".description__text")
  };
}

function extractWorkday() {
  return {
    title:
      getText("h1") ||
      getText("[data-automation-id='jobPostingHeader']"),
    company:
      getText("[data-automation-id='company']") ||
      textFromMeta("og:site_name", "property"),
    location:
      getText("[data-automation-id='locations']") ||
      getText("[data-automation-id='location']"),
    description:
      getText("[data-automation-id='jobPostingDescription']") ||
      getText("[data-automation-id='jobDescription']")
  };
}

function extractAshby() {
  return {
    title:
      getText("[data-testid='job-title']") ||
      getText("h1"),
    company:
      getText("[data-testid='company-name']") ||
      textFromMeta("og:site_name", "property"),
    location: getText("[data-testid='job-location']"),
    description:
      getText("[data-testid='job-description']") ||
      getText("[data-testid='job-details']")
  };
}

function extractSmartRecruiters() {
  return {
    title:
      getText(".job-title") ||
      getText("[data-test='job-title']") ||
      getText("h1"),
    company:
      getText(".company") ||
      getText("[data-test='company-name']"),
    location:
      getText(".location") ||
      getText("[data-test='job-location']"),
    description:
      getText(".job-description") ||
      getText("[data-test='job-description']")
  };
}

function extractWellfound() {
  return {
    title:
      getText("[data-test='JobTitle']") ||
      getText("h1"),
    company:
      getText("[data-test='CompanyName']") ||
      getText(".company-name"),
    location:
      getText("[data-test='JobLocation']") ||
      getText(".location"),
    description:
      getText("[data-test='JobDescription']") ||
      getText(".job-description")
  };
}

function extractZipRecruiter() {
  return {
    title:
      getText("h1") ||
      getText("[data-testid='job_title']"),
    company:
      getText("[data-testid='job_company']") ||
      getText(".company_name"),
    location:
      getText("[data-testid='job_location']") ||
      getText(".location"),
    description:
      getText("[data-testid='job_description']") ||
      getText(".job_description")
  };
}

function extractGlassdoor() {
  return {
    title:
      getText("[data-test='job-title']") ||
      getText("h1"),
    company:
      getText("[data-test='employer-name']") ||
      getText(".employer-name"),
    location:
      getText("[data-test='job-location']") ||
      getText(".location"),
    description:
      getText("[data-test='job-description']") ||
      getText(".jobDescriptionContent")
  };
}

function extractGreenhouse() {
  return {
    title: getText("h1") || getText(".app-title"),
    company: getText(".company-name") || getText("[data-company]"),
    location: getText(".location") || getText(".location-name"),
    description:
      getText("#content") ||
      getText("#job_description") ||
      getText(".content")
  };
}

function extractLever() {
  return {
    title:
      getText(".posting-headline h2") ||
      getText(".posting-headline h1") ||
      getText("h1"),
    company: getText(".posting-headline .company") || getText("[data-company]"),
    location:
      getText(".posting-headline .location") ||
      getText(".posting-categories .location"),
    description:
      getText(".posting .section-wrapper") ||
      getText(".posting")
  };
}

function extractSiteSpecific() {
  const host = window.location.hostname;
  if (host.includes("indeed.")) return extractIndeed();
  if (host.includes("monster.")) return extractMonster();
  if (host.includes("linkedin.")) return extractLinkedIn();
  if (host.includes("workday.") || host.includes("myworkday.")) return extractWorkday();
  if (host.includes("ashbyhq.")) return extractAshby();
  if (host.includes("smartrecruiters.")) return extractSmartRecruiters();
  if (host.includes("wellfound.") || host.includes("angel.co")) return extractWellfound();
  if (host.includes("ziprecruiter.")) return extractZipRecruiter();
  if (host.includes("glassdoor.")) return extractGlassdoor();
  if (host.includes("greenhouse.")) return extractGreenhouse();
  if (host.includes("lever.")) return extractLever();
  return {};
}

function detectJobPage() {
  const host = window.location.hostname;
  const path = window.location.pathname.toLowerCase();
  if (
    host.includes("indeed.") ||
    host.includes("monster.") ||
    host.includes("linkedin.") ||
    host.includes("workday.") ||
    host.includes("myworkday.") ||
    host.includes("ashbyhq.") ||
    host.includes("smartrecruiters.") ||
    host.includes("wellfound.") ||
    host.includes("angel.co") ||
    host.includes("ziprecruiter.") ||
    host.includes("glassdoor.") ||
    host.includes("greenhouse.") ||
    host.includes("lever.")
  ) {
    const hasDescription = !!document.querySelector(
      "#jobDescriptionText, .jobsearch-jobDescriptionText, .show-more-less-html__markup, .description__text, .posting, .job-description, [data-testid='job-description'], [data-testid='jobDescription'], [data-automation-id='jobPostingDescription'], [data-automation-id='jobDescription']"
    );
    const hasApply = !!document.querySelector(
      "button, a[href*='apply'], [data-automation-id='applyNowButton'], [data-test='apply']"
    );
    return hasDescription || hasApply;
  }

  const text = document.body ? document.body.innerText.toLowerCase() : "";
  const signals = [
    "apply now",
    "job description",
    "responsibilities",
    "requirements",
    "qualifications"
  ];
  const signalHit = signals.some((s) => text.includes(s));
  const description = extractDescription();
  return signalHit && description.length > 120;
}

function extractPayload() {
  const specific = extractSiteSpecific();
  return {
    title: specific.title || extractTitle(),
    company: specific.company || extractCompany(),
    location: specific.location || extractLocation(),
    description: specific.description || extractDescription()
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "APPLYCONTROL_EXTRACT") {
    try {
      const payload = extractPayload();
      sendResponse({ ok: true, payload });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  }
  if (msg && msg.type === "APPLYCONTROL_IS_JOB_PAGE") {
    try {
      sendResponse({ ok: true, isJobPage: detectJobPage() });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  }
});

try {
  chrome.runtime.sendMessage({
    type: "APPLYCONTROL_JOB_PAGE_STATUS",
    isJobPage: detectJobPage()
  });
} catch {
  // Ignore on restricted pages.
}
