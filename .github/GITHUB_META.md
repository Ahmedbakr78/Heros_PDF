# Heros_PDF — GitHub Meta Pack (copy-paste everything, no emojis)

> This file is the **single source of truth** for your repo's About box, description,
> website, topics, social preview and releases. Open it, copy, paste into GitHub.
> Repo: `https://github.com/Ahmedbakr78/Heros_PDF`

---

## 1. Repository name

```text
Heros_PDF
```

Keep `Heros_PDF` (matches your folder). If you ever rename, prefer `heros-pdf` (kebab is friendlier in URLs).

---

## 2. About description (short — paste exactly, no emojis)

```text
Heros PDF — fast, private, beautiful PDF viewer and editor. Read, annotate, merge, split, search. Dark + Light, mobile-ready, 100% local, free and unlimited.
```

Character count is about 165. If GitHub truncates, use this shorter fallback:

```text
Heros PDF — fast private PDF viewer and editor. Annotate, merge, split, search. Dark+Light, 100% local, free and unlimited.
```

---

## 3. About long description (README header, social, Web Store listing)

```text
Heros PDF (PDF Studio) is a fast, private, beautiful PDF viewer and editor
for your browser. Open any PDF instantly — continuous scroll, thumbnails, bookmarks,
full-text search, night/sepia eye-comfort modes — then annotate with 11 tools
(highlight, pen, shapes, text, stamps, eraser), edit with merge / split / rotate /
watermark / page-numbers, plus a stopwatch, counters, a reading tracker and todos.
Dark + Light, fully mobile-ready,
silent instant boot with no distracting animations. 100% local and offline, no account,
no tracking, no watermarks, no limits. Free forever, open source (MIT), powered by
PDF.js + pdf-lib + qpdf.
```

Extended version (for the Web Store long description field):

```text
Heros PDF replaces the basic built-in PDF viewer with a complete studio.
VIEW: continuous or single-page reading, fit-width / fit-page / 10-800% zoom,
2-up spread, auto-scroll presentation, resume-last-page, encrypted-PDF unlock.
ORGANIZE: page thumbnails, nested outline bookmarks, full-text search with snippets,
recent files, per-document page bookmarks. ANNOTATE: select, highlight, underline,
strike, pen, arrow, line, rectangle, ellipse, text boxes, stamps and eraser with
undo/redo and per-document auto-save. EDIT: merge, split with 1-3,5,8-10 ranges,
delete, reorder, rotate, watermark, page numbers, fix page size. COMFORT: dark and
light UI, night / sepia / dim page modes, focus mode, copy-and-share page text. Everything
runs locally and offline. No account. No upload. No watermark. No daily quota.
MIT licensed. Chrome, Edge, Brave and any Chromium browser.
```

---

## 4. About website (paste into About settings, then enable Pages)

```text
https://ahmedbakr78.github.io/Heros_PDF/
```

Setup: **Settings → Pages → Deploy from a branch → Branch: `main` + folder `/docs` → Save.**
Wait about 1 minute, then check **“Use your GitHub Pages website”** so it shows in About.

Local preview of the site: open `docs/index.html` in a browser, or:

```bash
cd docs && python3 -m http.server 8000
```

---

## 5. About topics (paste all 20 — the maximum allowed)

GitHub path: **About → gear icon → Topics → paste → Save.**

```text
pdf, pdf-viewer, pdf-editor, pdf-annotator, chrome-extension, edge-extension, brave, manifest-v3, pdfjs, pdf-lib, qpdf, merge-pdf, split-pdf, annotate-pdf, dark-mode, ebook-reader, offline-first, privacy, open-source, javascript
```

Why these 20: they cover what users search (`pdf viewer`, `merge pdf`, `chrome extension`),
the stack (`pdfjs`, `pdf-lib`, `manifest-v3`), and values (`offline-first`, `privacy`, `open-source`)
for maximum discoverability without stuffing.

Optional swaps: `productivity`, `todo`, `watermark-pdf`, `ebook`, `study-tools`.

---

## 6. Social preview (banner on link shares)

1. Go to **Settings → General → Social preview → Edit → Upload image**.
2. Upload a 1280x640 PNG. Generate it from `assets/banner.svg`:
   - Open `assets/banner.svg` in Chrome → export at 1280x640, **or**
   - Use any SVG to PNG tool, then upload.
3. Fallback Open-Graph tags are already in `docs/index.html`.

---

## 7. Repo settings checklist (do once — 3 minutes)

- [ ] **About** filled: description (section 2) + website (section 4) + topics (section 5) + “Use your GitHub Pages website” checked
- [ ] **Pages**: `main` + `/docs` → visit `https://ahmedbakr78.github.io/Heros_PDF/` to verify
- [ ] **Features**: Issues ON · Discussions ON · Wiki OFF (docs/ folder is enough)
- [ ] **Social preview** uploaded (section 6)
- [ ] **Sponsor button**: edit `.github/FUNDING.yml` with your links (or delete the file to hide it)
- [ ] **Default branch**: `main`
- [ ] **Releases**: create `v2.3.2` from `.github/RELEASE_v2.3.2.md` (see section 8)
- [ ] **Pin** this repo on your profile `github.com/Ahmedbakr78` (Customize pins → Heros_PDF)
- [ ] **Profile README**: add `Heros PDF → [Heros_PDF](https://github.com/Ahmedbakr78/Heros_PDF)` to `Ahmedbakr78/Ahmedbakr78`
- [ ] **Private files check**: `todo.txt` / `todo.md` are git-ignored and never committed (see `.gitignore`)

---

## 8. Releases — how to publish v2.3.2 (and every future version)

1. Make sure `CHANGELOG.md` top entry matches the version.
2. Go to **Releases → Draft a new release**.
3. **Tag**: `v2.3.2` (create on publish), **Target**: `main`, **Title**: `v2.3.2 — Ultra-Round Studio`
4. **Notes**: copy-paste the entire file `.github/RELEASE_v2.3.2.md`.
5. Attach binary: download `heros-pdf-v2.3.2.zip` from the **CI → release.yml** run (or zip `pdf-studio-extension/` yourself) and attach it.
6. Check *Set as the latest release* → **Publish release**.
7. Future versions: duplicate `RELEASE_v2.3.2.md` → rename → update `CHANGELOG.md` → tag `vX.Y.Z`.

Version rules: `major.minor.patch` — patch = fixes, minor = features, major = breaking/manifest changes.

---

## 9. Badges (README + website already include them)

```markdown
[![Version](https://img.shields.io/badge/version-2.3.2-blue)](./pdf-studio-extension/manifest.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/)
[![100% Local](https://img.shields.io/badge/privacy-100%25%20local-success)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)
```

---

## 10. Profile and discoverability boosts (optional but powerful)

- [ ] Star your own repo (counts for momentum) + ask 3 friends to star
- [ ] Add repo link to your profile bio: `Building Heros PDF — free private PDF studio`
- [ ] Post the `docs/` website URL on LinkedIn / X / Reddit r/chrome_extensions with 2 screenshots
- [ ] Enable **Discussions → Categories**: Ideas · Q and A · Show and tell
- [ ] Add shields for stars/forks (already in README footer)

---

## 11. Maintainer and contact

Maintainer: **Ahmed ABOBAKR** ([Ahmedbakr78](https://github.com/Ahmedbakr78))

- LinkedIn: `https://www.linkedin.com/in/ahmed-abo-bakr-1b2466288/`
- GitHub: `https://github.com/Ahmedbakr78`
- Repo: `https://github.com/Ahmedbakr78/Heros_PDF`
- Website: `https://ahmedbakr78.github.io/Heros_PDF/`

These appear in: README author block + credits, LICENSE copyright line,
SUPPORT.md contact table, CODE_OF_CONDUCT.md reporting instructions, and the
website footer.
