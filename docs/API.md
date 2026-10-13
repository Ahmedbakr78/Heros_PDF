# API Reference — Heros PDF internals

For contributors and integrators. Everything below runs locally; nothing here
needs a network. No emojis in this file.

## 1. `window.NevaiOps` — edit engine

Pure functions on PDF bytes. All are async and return `Uint8Array` (or throw).
Defined in `pdf-studio-extension/nevaipdf-ops.js`.

| Function | Signature | Notes |
|---|---|---|
| `parseRange` | `(spec: string, pageCount: number) => number[]` | `"1-3,5,8-10"` → zero-based indices; invalid tokens ignored |
| `loadPdfBytes` | `(bytes, options?) => Promise<PDFDocument>` | `ignoreEncryption` by default; qpdf pre-repair when available |
| `mergePdfs` | `(list: Uint8Array[]) => Promise<Uint8Array>` | `copyPages` of all indices, order preserved |
| `splitPdf` | `(bytes, indices: number[]) => Promise<Uint8Array>` | Extract a slice |
| `splitRanges` | `(bytes, ranges: string) => Promise<Uint8Array[]>` | Multiple outputs, one per range |
| `rotatePdfUniform` | `(bytes, angle: number) => Promise<Uint8Array>` | 90-degree steps use `setRotation`, else `drawPage` |
| `rotatePdfPages` | `(bytes, map: Record<number, number>) => Promise<Uint8Array>` | Per-page degrees |
| `deletePdfPages` | `(bytes, indices: number[]) => Promise<Uint8Array>` | Keeps the complement |
| `duplicatePages` | `(bytes, indices: number[]) => Promise<Uint8Array>` | Copies appended after the original |
| `reorderPdfPages` | `(bytes, order: number[]) => Promise<Uint8Array>` | Any permutation |
| `reversePdfPages` | `(bytes) => Promise<Uint8Array>` | Whole-document reverse |
| `addWatermark` | `(bytes, text, opts?) => Promise<Uint8Array>` | `opacity`, `angle`, `fontSize`, `color` |
| `addPageNumbers` | `(bytes, opts?) => Promise<Uint8Array>` | 9 positions, margins, font size |
| `addHeaderFooter` | `(bytes, top, bottom, opts?) => Promise<Uint8Array>` | Burn-in text lines |
| `fixPageSize` | `(bytes, size) => Promise<Uint8Array>` | Normalize to A4, Letter, ... |
| `addBlankPage` | `(bytes, opts?) => Promise<Uint8Array>` | Insert blank |
| `removeBlankPages` | `(bytes) => Promise<Uint8Array>` | Heuristic blank detection |
| `flattenPdf` | `(bytes) => Promise<Uint8Array>` | Bake form fields |
| `encryptPdf` | `(bytes, userPw, ownerPw?) => Promise<Uint8Array>` | Local encryption |
| `decryptPdf` | `(bytes) => Promise<Uint8Array>` | Strip encryption |
| `fixPageSize`, `optimizePdf` | see above / `(bytes) => Promise<Uint8Array>` | Re-save smaller |
| `embeddablePages` | `(bytes) => Promise<Uint8Array[]>` | For image/PDF creation helpers |
| `imagesToPdf` | `(files: File[]) => Promise<Uint8Array>` | One page per image |
| `textToPdf` | `(text: string) => Promise<Uint8Array>` | Simple text document |
| `removeAnnotations` | `(bytes) => Promise<Uint8Array>` | Strip embedded annotations |
| `getPageCount` | `(bytes) => Promise<number>` | Cheap count without rendering |
| `getPageSizes` | `(bytes) => Promise<{width: number, height: number}[]>` | Base sizes in points |
| `downloadFile` | `(bytes, name, mime?) => void` | Blob download + cleanup |
| `escapeHtml` | `(s: string) => string` | Namespaced helper |

Example:

```js
const bytes = new Uint8Array(await file.arrayBuffer());
const rotated = await NevaiOps.rotatePdfUniform(bytes, 90);
NevaiOps.downloadFile(rotated, 'rotated.pdf');
```

## 2. Productivity studio (Tools tab)

State and functions are exported on `window` for testing:

| Symbol | Type | Purpose |
|---|---|---|
| `Tools` | object | `{sw, counters, tracker, todos, ui}` — the whole studio state |
| `TOOLS_KEY` | string | `pdfstudio-tools-v1` localStorage key |
| `loadTools()` / `saveTools()` | function | Read/write state (debounced caller: `saveToolsSoon`) |
| `swNow()` | function | Live elapsed milliseconds including the running delta |
| `renderToolsAll()` | function | Repaints stopwatch, counters, tracker, todos |

Persistence shape:

```json
{
  "sw":  { "elapsed": 272000, "running": true, "startedAt": 1730000000000, "laps": [] },
  "counters": [ { "id": "c-1", "name": "Pages reviewed", "value": 42, "step": 1 } ],
  "tracker": { "perDoc": { "docId": 540 }, "days": { "2026-10-13": 540 }, "goal": 30 },
  "todos": { "global": [], "byDoc": { "docId": { "name": "file.pdf", "tasks": [] } } }
}
```

## 3. Viewer engine (`app.js`)

| Symbol | Purpose |
|---|---|
| `S` | Global state object (doc, epoch, prefs, annots, search, tools) |
| `CFG` | Tunables: zoom range, DPR cap, preload margin, search caps |
| `openDocument(url, name, size)` | Load pipeline entry (returns a promise of success) |
| `goToPage(n, smooth)` | Scroll to a page, single or continuous mode |
| `setZoom(mode, value)` | `fit-width`, `fit-page`, or `custom` |
| `switchPane(name)` | Activate a sidebar pane by id suffix (`pane-<name>`) |
| `openToolsPane()` | Tools tab opener (also bound to T) |
| `Theme.set/toggle/currentResolved` | Theme control, persisted |
| `openModal(opts)` | Modal factory: `title`, `icon`, `html`, `footer`, `onMount`, `onClose` |
| `toast(msg, type, ms)` | Notification, `type` is `ok`, `err` or undefined |
| `openMenu(anchor, items)` | Dropdown menu factory with checks + shortcuts |

## 4. Storage keys

| Key | Store | Contents |
|---|---|---|
| `pdfstudio-recent-v1` | IndexedDB `pdfstudio` | Recent files with name, size, time, last page |
| `pdfstudio-annots` | IndexedDB `pdfstudio-annots` | Stroke JSON per `docId`, pruned to 60 documents |
| `pdfstudio-prefs-v2` | localStorage | Page mode, HQ, resume, auto-open, speed, spread, gap |
| `pdfstudio-profile-v1` | localStorage | Display name and accent color |
| `pdfstudio-stats-v1` | localStorage | Documents opened, pages read |
| `pdfstudio-bookmarks-v1` | localStorage | `docId -> [page numbers]` |
| `pdfstudio-tools-v1` | localStorage | Stopwatch, counters, tracker, todos |
| `pdfstudio-tts-v1` | localStorage | Legacy read-aloud rate (kept for backup import) |
| `pdfstudio-theme` | localStorage | UI theme mode |
| `pdfstudio-accent-v1`, `pdfstudio-sidew-v1` | localStorage | Custom accent and sidebar width |

## 5. Backup format (v4)

```json
{
  "exportedAt": 1730000000000,
  "version": 4,
  "profile": { "name": "My Studio", "color": "#4c8dff" },
  "prefs": {},
  "bookmarks": {},
  "stats": { "docs": 0, "pagesRead": 0 },
  "ttsRate": 1,
  "accent": { "color": "#4c8dff" },
  "sideW": { "w": 308 },
  "tools": {},
  "marks": { "current": { "docId": "", "pages": {} } }
}
```

Restore is tolerant: unknown fields are ignored, missing sections are skipped,
and annotations are only applied when the backup's `docId` matches the open file.
