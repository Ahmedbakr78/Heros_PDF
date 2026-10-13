# Release Template — Heros PDF vX.Y.Z

Copy this file to `.github/RELEASE_vX.Y.Z.md`, replace the placeholders, fill the
sections that apply, and paste the result into the GitHub Release body. No emojis.

# Heros PDF vX.Y.Z — THEME NAME

> **Free - Unlimited - 100% Local - Dark + Light - Mobile-ready**

One paragraph: what this release is really about, in user terms.

**Install in 30 seconds:** download `heros-pdf-vX.Y.Z.zip` below → open `chrome://extensions`
→ enable Developer mode → Load unpacked → select `pdf-studio-extension/` → Pin it → done.
Full guide and FAQ: https://ahmedbakr78.github.io/Heros_PDF/

---

## What is new

### CATEGORY (for example: Viewing, Annotate, Edit, Comfort, Mobile, Speed, Privacy)
- Bullet 1: user-visible change, not implementation detail
- Bullet 2: ...
- Bullet 3: ...

## Improvements
- ...

## Fixes
- ...

## Breaking changes (remove this section if none)
- What changed and how users migrate

---

## What is inside

```text
heros-pdf-vX.Y.Z.zip
└── pdf-studio-extension/
    ├── manifest.json (MV3, vX.Y.Z)
    ├── viewer.html, app.js, nevaipdf-ops.js
    ├── background.js, popup.html, popup.js
    └── icons/ and vendor/
```

---

## Tested

- [ ] 1-page, 50-page, 300-page PDFs, mixed page sizes
- [ ] Encrypted PDF unlock modal
- [ ] Dark / Light / Night / Sepia
- [ ] Desktop 1440px down to phone 360px
- [ ] The specific features this release touched
- [ ] Reload persistence for the touched data

## Upgrade notes

- If upgrading from vPREV, users who ... should ...
- CI attached `heros-pdf-vX.Y.Z.zip` automatically on tag `vX.Y.Z`

## Thanks

Report bugs via Issues, ideas via Discussions, security via SECURITY.md.
