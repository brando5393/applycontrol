# Releasing

ApplyControl isn't published to the Chrome Web Store yet, so "release" here
just means: cut a version that's safe to load as the unpacked extension and
worth tagging in git.

## Version number

`extension/manifest.json`'s `version` field is the source of truth (it's
what Chrome shows the user and what `chrome.runtime.getManifest().version`
returns in the popup). `package.json`'s `version` is kept in sync with it --
package.json isn't published anywhere, but a mismatch between the two is a
sign a bump was only done in one place.

Use plain [semver](https://semver.org/) (`MAJOR.MINOR.PATCH`):
- **PATCH** -- bug fixes only (e.g. this session's Monster/Indeed capture
  fixes would have been `0.1.0` -> `0.1.1`).
- **MINOR** -- new user-facing features (export, onboarding, status
  history, ...).
- **MAJOR** -- reserved; not expected before a Chrome Web Store submission.

## Cutting a release

1. Make sure `main` is green: `npm test` passes and CI (`.github/workflows/test.yml`)
   is passing on the latest commit.
2. Bump the version in **both** `extension/manifest.json` and `package.json`
   to the same value, in the same commit.
3. Update `TODO.md`'s Done/Pending sections to reflect what shipped.
4. Commit: `git commit -m "Release vX.Y.Z"`.
5. Tag it: `git tag vX.Y.Z` and `git push origin vX.Y.Z` (in addition to
   pushing the commit itself).

## Before a Chrome Web Store submission (not yet applicable)

When this actually gets submitted, add: a changelog entry per release, a
`zip` packaging step (excluding `test/`, `node_modules/`, `.github/`,
`extension/config.js`), and store-listing screenshots. None of that exists
yet -- this file will grow when it's needed, not before.
