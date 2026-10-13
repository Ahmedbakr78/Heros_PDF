# Installation Guide — Heros PDF v2.3.2

> From zero to reading in 30 seconds. No build, no account, no emojis in this guide.

## Requirements

- A Chromium browser: Chrome, Vivaldi, Yandex Browser, Edge, Brave, Opera, Arc
  (a version from the last 2 years works).
- The repo folder `Heros_PDF/` cloned or downloaded (about 15 MB with vendor files).
- 1 minute of your time.

## Extensions page by browser

| Browser | Type in the address bar | Where Developer mode lives |
|---|---|---|
| Google Chrome | `chrome://extensions` | Top-right toggle |
| Vivaldi | `vivaldi://extensions` | Top-right toggle (or Tools → Extensions) |
| Yandex Browser | `browser://extensions` | Top-right toggle |
| Microsoft Edge | `edge://extensions` | Left-side toggle |
| Brave | `brave://extensions` | Top-right toggle |
| Opera | `opera://extensions` | Top-right toggle |
| Arc | `arc://extensions` | Top-right toggle |

## Option A — Load unpacked (full extension, recommended)

1. **Get the code.**
   ```bash
   git clone https://github.com/Ahmedbakr78/Heros_PDF.git
   cd Heros_PDF
   ```
   Or: GitHub → Code → Download ZIP → unzip. Confirm `pdf-studio-extension/manifest.json` exists.

2. **Open the extensions page for your browser.** Navigate to `chrome://extensions`
   (Chrome), `vivaldi://extensions` (Vivaldi), `browser://extensions` (Yandex Browser),
   `edge://extensions` (Edge), `brave://extensions` (Brave), `opera://extensions` (Opera),
   `arc://extensions` (Arc). See the table above.

3. **Enable Developer mode.** Top-right toggle → ON.

4. **Load unpacked.** Click *Load unpacked* → select the folder `Heros_PDF/pdf-studio-extension/` (not the repo root). The Heros PDF card appears showing version 2.3.2.

5. **Pin it.** Click the puzzle icon in the toolbar → pin Heros PDF.

6. **Smoke test.** Click the Heros PDF icon → popup → *Open Heros PDF* → viewer opens → drag any PDF into it → pages render.

## Option B — Viewer only (no install)

No extensions page needed. Either:

- Double-click `pdf-studio-extension/viewer.html` to open it as a file, or
- Serve it locally (needed for URL fetching and cleanest behavior):
  ```bash
  cd pdf-studio-extension
  python3 -m http.server 8000
  # open http://localhost:8000/viewer.html
  ```

## Enabling local file auto-open (file:// PDFs)

Chromium hides `file://` navigations from extensions unless you opt in. Steps:

1. Open the extensions page for your browser (table above) → Heros PDF → **Details**.
2. Enable **Allow access to file URLs**.
3. Open the Heros PDF popup → turn ON **Auto-open local PDFs**.
4. Test: open any `file:///....pdf` in the browser → it should redirect into the Heros viewer.

Without step 2 this silently does nothing (Chromium rule, not a bug). The viewer shows a hint pointing here.

### Per-browser notes

- **Chrome**: straightforward; pin the icon after install so the popup is one click away.
- **Vivaldi**: identical flow to Chrome. If you use Vivaldi's own PDF viewer, disable it
  (Settings → Web Pages → Webpage Content) so Heros PDF handles links first.
- **Yandex Browser**: same flow. If Developer mode is greyed out, the browser is managed
  by policy — install the portable build, or use Option B and open `viewer.html` directly.
  In some builds the file-URLs toggle hides until you restart the browser once.
- **Edge / Brave / Opera / Arc**: same steps; Brave may bury the file-URLs toggle under
  Advanced on the Details page.

## Enabling web PDF auto-open (https:// PDFs)

1. Open the Heros PDF popup.
2. Turn ON **Auto-open web PDFs**.
3. Test: click any direct `https://...pdf` link → it opens in Heros PDF.

If a site serves PDFs with `Content-Disposition: attachment` or blocks cross-origin fetch (CORS), the browser may download instead. Fix: download the file, then drag and drop it into the viewer.

## Context menu

After install, right-click any link or page → **Open with Heros PDF**. If the link ends in `.pdf` it opens that URL; otherwise it opens a blank viewer ready for drag and drop.

## Updating

```bash
cd Heros_PDF
git pull
# then your extensions page → Heros PDF → reload button
```

Recents, annotations, bookmarks and prefs persist (IndexedDB + chrome.storage.local are untouched by reload).

## Uninstalling

Your extensions page → Heros PDF → Remove. To also wipe local data: clear the extension's IndexedDB (`pdfstudio`, `pdfstudio-annots`) and `chrome.storage.local` via DevTools → Application.

## Making Heros PDF the default PDF viewer

1. Keep **Auto-open local PDFs** and **Auto-open web PDFs** ON in the popup.
2. Right-click any PDF link → **Open with Heros PDF** for one-off cases.
3. Disable the browser's built-in PDF handling so Heros PDF gets the link first:
   - Chrome/Edge: site settings → PDF documents → disable "Open PDFs in the browser"
     (this affects inline preview; Heros PDF still opens explicit PDF links).
   - Vivaldi: Settings → Web Pages → Webpage Content → disable the built-in viewer.
   - Yandex Browser: parity behavior with Chrome; per-site overrides apply.
4. To undo: turn the popup toggles off or remove the extension.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Load unpacked" says manifest missing | You selected the repo root. Select `pdf-studio-extension/` instead. |
| Developer mode is disabled or greyed out | Managed browser (common on Yandex portable policies). Use a portable build, or Option B. |
| file:// PDFs open in the default viewer | Enable "Allow access to file URLs" (see above) + popup toggle. |
| Yandex: file URLs toggle missing | Restart the browser once, reopen Details; toggle appears. |
| URL open fails with network/CORS error | Host blocks fetch. Download + drag and drop. |
| Blank viewer, console error about worker | `vendor/pdf.worker.min.js` missing — re-clone, do not delete vendor/. |
| Popup toggles reset on restart | A cleaner extension wipes storage. Allowlist `chrome.storage.local`. |

Still stuck: open a bug report with browser + OS + version + steps (see SUPPORT.md).
