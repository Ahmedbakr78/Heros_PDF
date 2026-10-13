# Support — Get Help

## Fastest path (2 min)

1. **Read the FAQ** in `README.md` → “FAQ — 20 Questions” (most answers are there).
2. **Search existing issues**: https://github.com/Ahmedbakr78/Heros_PDF/issues
3. Still stuck? Open the right thing:

| I need… | Where |
|---|---|
| Bug (crash, wrong render, broken button) | [Bug report](https://github.com/Ahmedbakr78/Heros_PDF/issues/new/choose) + attach screenshot + console log |
| Feature idea | [Feature request](https://github.com/Ahmedbakr78/Heros_PDF/issues/new/choose) |
| How-do-I question | [Discussions → Q&A](https://github.com/Ahmedbakr78/Heros_PDF/discussions) |
| Security issue | **Private** — see `SECURITY.md`, never a public issue |
| Maintainer | Ahmed ABOBAKR — [GitHub](https://github.com/Ahmedbakr78) · [LinkedIn](https://www.linkedin.com/in/ahmed-abo-bakr-1b2466288/) |

## Bug reports that get fixed fastest include

- Extension version (`chrome://extensions` → Heros PDF) + browser + OS
- File size + page count (e.g. “4.2 MB, 248 pages, encrypted? no”)
- Steps 1-2-3 + expected vs actual
- Screenshot/GIF + DevTools console text (`Ctrl+Shift+J`)

## Common fixes (try first)

| Symptom | Fix |
|---|---|
| `file://` PDFs won't auto-open | `chrome://extensions` → Details → enable **Allow access to file URLs** |
| URL open says CORS/network | Host blocks cross-origin fetch → download file → drag and drop |
| Blank pages after zoom | Reload extension (`chrome://extensions` → reload). If persists, report with file info. |
| Annotations gone | Same browser profile? IndexedDB is per-profile. Export burns them into PDF for portability. |
| Popup toggles reset | Check `chrome.storage.local` not cleared by cleaner extensions |

Response time: best-effort, usually within a few days. Stars and clear reports get faster fixes.
