# Privacy Policy

**Last updated:** 2026-08-20

ApplyControl ("the extension," "we," "us") is a browser extension for tracking job applications. This policy explains what information the extension collects, how it is used, who it is shared with, and the choices available to you. It applies to the browser extension and its dashboard (the extension's options page); it does not apply to third-party job sites you visit while using the extension.

ApplyControl is developed and operated by an independent developer, not a company. If you need to contact us about privacy, use the feedback form described in "Contact" below.

## Information We Collect

We collect only what is needed to provide the service:

- **Account information**: your email address and a unique user ID, created when you sign up via Firebase Authentication. If you sign in with a password, Firebase stores a securely hashed credential — we never see or store your plaintext password. If you use **Sign in with Google** (where available), we receive your Google account's email address and a stable Google account identifier from Google to authenticate you; we do not receive your Google password.
- **Application data**: information about jobs you choose to save — the posting URL, title, company, location, description, status, status history, and the timestamp you captured it. This data is extracted from the job posting page you were viewing when you clicked "Save."
- **Feedback data**: the title and message you submit through the in-extension feedback form, plus basic technical metadata sent with it (browser user agent, operating system/platform, and the extension's version number) so we can reproduce and fix reported issues.

We do **not** collect your general browsing history, your activity on sites where you don't explicitly save a job, or any data from tabs the extension isn't actively used on.

## How We Use Information

- To operate core features: authenticating you, saving and syncing your applications across your signed-in devices, and displaying your dashboard.
- To respond to support requests and diagnose bugs reported through feedback.
- To detect, prevent, and respond to fraud, abuse, or security issues (for example, Firestore's access rules, described under "Security" below).

We do not use your data for advertising, and we do not build behavioral or advertising profiles from it.

## Legal Basis for Processing (EEA/UK users)

If you are located in the European Economic Area or the United Kingdom, our basis for processing your information is: performance of a contract (providing the service you signed up for), and, for feedback metadata, our legitimate interest in maintaining and improving the extension. You may withdraw consent or object to processing at any time by deleting your account (see "Your Rights and Choices").

## How We Share Information

We share information only with the infrastructure providers necessary to run the service — we do not sell it, rent it, or share it with advertisers or data brokers:

- **Google Firebase** (Authentication, Firestore database, and, if you use Google Sign-In, Google's identity service) — our hosting and infrastructure provider. Firebase acts as our data processor/sub-processor and is bound by [Google's Cloud Data Processing terms](https://cloud.google.com/terms/data-processing-addendum).

We may also disclose information if required to by law, subpoena, or other legal process, or where we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.

## International Data Transfers

Firebase infrastructure may store and process data on servers located outside your country of residence, including in the United States. Where required, such transfers rely on the safeguards Google provides under its Cloud Data Processing terms (e.g., Standard Contractual Clauses for EEA/UK data).

## Data Retention

We retain your application and feedback data for as long as your account remains open. You can delete individual application entries at any time from the dashboard. Deleting your account (see below) permanently removes your applications, feedback submissions, and account record — this is typically processed immediately and is not reversible.

## Security

Data is transmitted over HTTPS/TLS in transit. Firestore security rules restrict all reads and writes to the authenticated owner of the data — no other user (and no unauthenticated request) can access your applications or feedback. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.

## Your Rights and Choices

Regardless of where you live, you have the following controls, available directly in the extension:

- **Access and export**: view all your saved applications in the dashboard, or export them as CSV/JSON at any time.
- **Correction**: edit an application's status directly; other fields can be corrected by deleting and re-saving the entry.
- **Deletion**: delete individual application entries, clear all applications at once, or delete your entire account and all associated data (applications and feedback) from the dashboard's account menu.
- **Portability**: the CSV/JSON export above is provided in a structured, machine-readable format.
- **Opt out of feedback**: submitting feedback is entirely optional.

If you are a California resident, the rights above satisfy the access, deletion, and portability rights described in the CCPA/CPRA. We do not sell or share personal information for cross-context behavioral advertising, so there is no "opt-out of sale" action needed.

If you believe we have not adequately addressed a request, EEA/UK residents also have the right to lodge a complaint with their local data protection authority.

## Children's Privacy

ApplyControl is not directed at, and is not intended for use by, children under 13 (or the minimum age required by your local law). We do not knowingly collect information from children. If you believe a child has provided us with personal information, contact us using the feedback form so we can delete it.

## Cookies and Tracking

The extension itself does not use cookies, tracking pixels, or third-party analytics/advertising SDKs. Firebase Authentication may use its own session mechanisms necessary to keep you signed in; these are not used for tracking across other sites.

## Changes to This Policy

If we make material changes to this policy, we will update the "Last updated" date above and, where practical, note the change in the extension. Continued use of the extension after an update constitutes acceptance of the revised policy.

## Google API Limited Use Disclosure

ApplyControl's use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/), including the Limited Use requirements: any data accessed via Google APIs is used only to provide or improve ApplyControl's user-facing features described in this policy, is never used for advertising, and is never sold or transferred to third parties except as described above.

## Contact

For privacy questions, data access/deletion requests, or complaints, open a feedback ticket from within the extension (popup or dashboard → Feedback). Include enough detail for us to identify your account (e.g., the email you signed up with).

---

*This policy is written and maintained by ApplyControl's independent developer, in good faith, to accurately describe current data practices. It has not been reviewed by an attorney and is not a substitute for legal advice. If ApplyControl is distributed at scale, submitted to the Chrome Web Store for public listing, or begins processing data in ways not described here, consult a qualified privacy attorney before relying on this document as your sole compliance measure — particularly for GDPR/UK GDPR, CCPA/CPRA, or other jurisdiction-specific obligations that may apply to your user base.*
