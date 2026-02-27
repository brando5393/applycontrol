const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.createFeedbackIssue = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      const authHeader = req.headers.authorization || "";
      const match = authHeader.match(/^Bearer (.+)$/);
      if (!match) {
        res.status(401).json({ error: "Missing auth token." });
        return;
      }

      const idToken = match[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!decoded || !decoded.uid) {
        res.status(401).json({ error: "Invalid auth token." });
        return;
      }

      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        res.status(500).json({ error: "Server not configured." });
        return;
      }

      const { title, message, version, pageUrl, userAgent } = req.body || {};
      if (!title || !message) {
        res.status(400).json({ error: "Missing title or message." });
        return;
      }

      const body = [
        message,
        "",
        "---",
        `User: ${decoded.email || decoded.uid}`,
        `Version: ${version || "unknown"}`,
        `Page: ${pageUrl || "n/a"}`,
        `User Agent: ${userAgent || "n/a"}`
      ].join("\n");

      const issueRes = await fetch(
        "https://api.github.com/repos/brando5393/applycontrol/issues",
        {
          method: "POST",
          headers: {
            Authorization: `token ${githubToken}`,
            "Content-Type": "application/json",
            "User-Agent": "ApplyControl-Feedback"
          },
          body: JSON.stringify({ title, body })
        }
      );

      if (!issueRes.ok) {
        const text = await issueRes.text();
        res.status(502).json({ error: text || "GitHub issue failed." });
        return;
      }

      const issue = await issueRes.json();
      res.status(200).json({ ok: true, url: issue.html_url });
    } catch (err) {
      res.status(500).json({ error: err.message || "Server error." });
    }
  });
