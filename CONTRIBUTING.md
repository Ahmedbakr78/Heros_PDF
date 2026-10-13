# Contributing to Heros PDF

Thanks for helping! Heros PDF is vanilla HTML/CSS/JS — no build step, no framework. If you can edit a file and reload an extension, you can contribute.

## 1. Ground rules (30 seconds)

- Be kind (see `CODE_OF_CONDUCT.md`).
- Small, focused PRs are better than giant rewrites. One feature/fix per PR.
- No new network calls, tracking, or analytics. **100% local is sacred.**
- No minified mystery blobs (except existing `vendor/`). All app code stays readable.
- Keep it fast: lazy-render, cap work, never block scroll.

## 2. Setup (2 minutes)

```bash
git clone https://github.com/Ahmedbakr78/Heros_PDF.git
cd Heros_PDF
# No npm install. No build. Seriously.
```

Load the extension:

1. `chrome://extensions` → Developer mode ON → **Load unpacked** → pick `pdf-studio-extension/`
2. Open `viewer.html` from the extension (or serve: `python3 -m http.server 8000` inside `pdf-studio-extension/`)
3. Open DevTools console — app errors surface as toasts AND console logs.

## 3. Where things live

| File | What to change |
|---|---|
| `pdf-studio-extension/viewer.html` | All CSS + HTML shell + icon sprite. Design changes go here. |
| `pdf-studio-extension/app.js` | Viewer engine (~5274 lines). Render/search/annot/edit/profile. |
| `pdf-studio-extension/nevaipdf-ops.js` | Edit ops (merge/split/rotate/watermark). Pure functions on `Uint8Array`. |
| `pdf-studio-extension/background.js` | Service worker (auto-open, context menu). Keep minimal. |
| `pdf-studio-extension/popup.html` / `popup.js` | Toolbar popup. Must stay tiny (under 300px). |
| `pdf-studio-extension/manifest.json` | Bump `version` on every release. Justify new permissions in PR. |
| `docs/` | Website (GitHub Pages). Update screenshots + features alongside code. |

## 4. Workflow

```bash
git checkout -b feat/my-thing
# ... edit ...
git add -A && git commit -m "feat: my thing" && git push -u origin feat/my-thing
# → open a Pull Request against main
```

Commit style: `feat:`, `fix:`, `docs:`, `style:`, `perf:`, `chore:`.

Never commit: `todo.txt`, `todo.md`, personal PDFs, `.env`, `*.zip` (see `.gitignore`).

## 5. Testing checklist (paste into your PR)

- [ ] Loads unpacked with zero console errors
- [ ] Opens 1-page + 50+ page PDFs
- [ ] Dark + Light + Night / Sepia page modes
- [ ] Desktop 1440px + mobile 360px widths
- [ ] Feature works after reload (persistence where expected)
- [ ] `manifest.json` valid JSON, version bumped if release-relevant

## 6. Good first issues

Look for labels: `good first issue` · `help wanted` · `design` · `docs`.
Ideas that always get merged: more keyboard shortcuts, translations, extra stamps,
better empty-states, docs/screenshots, FAQ entries.

## 7. What NOT to do

- Don't add frameworks, bundlers, or CDNs for core paths (offline-first!).
- Don't add permissions without discussion in an issue first.
- Don't commit PDFs with personal data as test files (use public-domain samples).
- Don't paste secrets/keys — there are none, keep it that way.

Questions? Open a [Discussion](https://github.com/Ahmedbakr78/Heros_PDF/discussions) — we answer fast.
