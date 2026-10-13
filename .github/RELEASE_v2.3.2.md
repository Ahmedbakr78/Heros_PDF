# Heros PDF v2.3.2 — Ultra-Round Studio

> **Free - Unlimited - 100% Local - Dark + Light - Mobile-ready**

This is the biggest design and power update yet: a full ultra-rounded design system,
silent instant boot, a real 2-up spread engine, a selection mini-toolbar, and a
power-packed sidebar (Edit / Bookmarks / Notes / Profile / Settings).

**Install in 30 seconds:** download `heros-pdf-v2.3.2.zip` below → open `chrome://extensions` →
enable Developer mode → *Load unpacked* → select `pdf-studio-extension/` → Pin Heros PDF → done.
Full guide and FAQ: https://ahmedbakr78.github.io/Heros_PDF/

---

## What is new

### Ultra-rounded design system
- Floating rounded topbar, floating sidebar card, pill tab bar, pill pagebox and search
- Every card, thumbnail, button, menu, modal and toast at maximum roundness
- Hidden app-wide scrollbars (still scrollable) + ultra-round range sliders

### Silent instant boot
- `body.booting` disables boot animations — no distracting motion on load
- Per-page skeletons + top progress bar keep perceived speed instant

### Spread (2-up) + gap control
- Real two-pages-side-by-side with exact flex-gap math (no wrap slip)
- Adjustable page gap slider, most-visible-page tracking while in spread

### Selection mini-toolbar
- Select any text → floating bar: **Highlight / Underline / Copy** in one tap

### Power-pack sidebar
- **Edit**: merge / split (`1-3,5,8-10`) / delete / rotate / watermark / page numbers / fix size
- **Bookmarks**: star pages per document · **Notes**: every annotation listed · **Profile**: avatar + stats
- **Settings**: HQ render, resume reading, auto-open toggles, page mode, spread, gap

### Eye comfort
- UI Dark/Light (system-aware, persisted) + page modes: Night (invert) / Sepia / Dim

### Speed
- Epoch-guarded renders, DPR-capped canvases, 700px preload margin, chunked size pass,
  capped search index (800), `content-visibility: auto`

### Private
- 100% local. No account, no tracking, no upload. IndexedDB only.

---

## What is inside

```text
heros-pdf-v2.3.2.zip
└── pdf-studio-extension/
    ├── manifest.json (MV3, v2.3.2)
    ├── viewer.html, app.js, nevaipdf-ops.js
    ├── background.js, popup.html, popup.js
    ├── icons/ and vendor/ (pdf.js, pdf-lib, qpdf.wasm, cmaps)
```

---

## Tested

- [x] 1-page, 50-page, 300-page PDFs, mixed page sizes
- [x] Encrypted PDF unlock modal
- [x] Dark / Light / Night / Sepia
- [x] Desktop 1440px down to phone 360px
- [x] Merge 5 files, split `1-3,5`, watermark, page numbers
- [x] Draw + undo/redo + reload persistence

## Thanks

Star the repo if this saves you time — it keeps Heros free forever.
Report bugs via Issues, ideas via Discussions, security via SECURITY.md (private).
