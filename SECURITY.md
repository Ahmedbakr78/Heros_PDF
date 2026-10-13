# Security Policy

Heros PDF is **100% local** — your files never leave your device. That makes most
web-app vulnerability classes (server RCE, data leaks) inapplicable. What matters
here: malicious PDFs, XSS via rendered content, and over-broad permissions.

## Supported versions

| Version | Supported |
|---|---|
| 2.3.x (latest) | Yes — report here |
| 2.3.0 – 2.3.1 | Only if reproducible on 2.3.2 |
| < 2.3.0 | Please upgrade first |

## How to report (private!)

**Do NOT open a public issue for security reports.**

1. Go to **Security → Advisories → Report a vulnerability** on GitHub
   (or message `@Ahmedbakr78` privately), including:
   - Extension version + browser + OS
   - Steps to reproduce + sample file (redact personal data!)
   - Impact (what can an attacker do? what can't they?)
   - Optional: suggested fix / patch
2. You'll get an acknowledgment within **72 hours**.
3. We fix, credit you in `CHANGELOG.md` (unless you prefer anonymity), and publish
   a patched release + advisory.

## Scope and rules

- In scope: `viewer.html`, `app.js`, `nevaipdf-ops.js`, `background.js`,
  `popup.*`, `manifest.json` permissions, `vendor/` integrity.
- Out of scope: upstream PDF.js/pdf-lib/qpdf bugs (report upstream, link us —
  we'll vendor the fix), social engineering, physical access.
- Please: no automated mass-scanning, no spamming `?pdf=` URLs at other users,
  no exfiltrating anyone else's files. Test with your own PDFs.

## Guarantees

- Minimal permissions (`contextMenus`, `webNavigation`, `storage` + `<all_urls>`
  only for `*.pdf` navigation detection). Any new permission gets justified in
  the PR + CHANGELOG.
- CSP: `script-src 'self' 'wasm-unsafe-eval'` (wasm needed for qpdf repair).
- No remote code, no analytics, no fetching PDFs to third parties.
