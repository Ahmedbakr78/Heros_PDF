# Architecture Deep-Dive — Heros PDF

> Companion to the README diagrams. Read this if you want to hack on `app.js` (5274 lines) with confidence.

## 1. Process model (Manifest V3)

```mermaid
flowchart TB
    SW["background.js<br/>service worker<br/>(ephemeral!)"] -->|tabs.update(viewer.html?pdf=...)| TAB["viewer.html tab<br/>full app lives here"]
    POP["popup.html/js"] -->|runtime.sendMessage| SW
    TAB --- IDB[("IndexedDB")]
    TAB --- ST[("chrome.storage.local")]
```

- The service worker is **ephemeral** — it only redirects + opens. Never store state there.
- All viewer state lives in `viewer.html`'s `S` object + IndexedDB. That's why reload persistence works even when the worker sleeps.

## 2. Viewer state (`S` in app.js)

| Key | Meaning |
|---|---|
| `doc`, `numPages`, `pageNum` | PDF.js document + current page |
| `scale`, `scaleMode`, `rotation`, `continuous`, `spreadOn`, `pageGap` | Layout inputs |
| `pageViews[]`, `baseSizes[]`, `visiblePages` | Per-page DOM + sizes + viewport set |
| `epoch` | Bumps on every `layout()`; stale renders abort |
| `annots{}`, `tool`, `annotColor/Size/Opacity`, `undoStack/redoStack` | Annotation studio |
| `searchIndex`, `searchQuery/Results/Cursor` | Search studio |
| `bookmarks{}`, `profile`, `prefs`, `stats` | Personalization |

## 3. Render pipeline (epoch-guarded)

```mermaid
sequenceDiagram
    participant L as layout()
    participant O as IntersectionObserver
    participant R as renderPage(pv)
    participant P as pdf.js

    L->>L: S.epoch++ ; mark all rendered=false ; sync pv.viewport
    O->>R: page visible → renderPage(pv)
    R->>P: getPage(n) → snapshot {scale, rotation, epoch}
    P-->>R: page
    R->>R: canvas paint (DPR≤2)
    R->>R: buildTextLayer(snapshot) — never S.scale here!
    R->>R: buildLinkLayer + highlightInPage + drawAnnots
    R->>R: if epoch stale → retryRender() once
```

Rules for contributors:

1. Never read `S.scale` after an `await` inside `renderPage` — use the snapshot.
2. `layout(true)` preserves scroll via anchor `{num, ratio}`.
3. `drawAnnots(pv)` must run after every render + every layout (viewport changed).

## 4. Coordinate spaces

- **PDF points** (72dpi) → **viewport px** (`page.getViewport({scale, rotation})`) → **device px** (`× DPR`).
- Annotation strokes are stored in **viewport px** at draw time + redrawn after `pv.viewport` recompute. That's why zoom never drifts strokes.

## 5. Edit ops (`nevaipdf-ops.js` → `window.NevaiOps`)

Pure functions: `Uint8Array in → Uint8Array out` via `pdf-lib`. No DOM. Testable in Node with a pdf-lib shim.

| Op | Function | Notes |
|---|---|---|
| Merge | `mergePdfs([bytes…])` | `copyPages` all indices |
| Split | `splitPdf(bytes, indices)` | Range parser: `1-3,5,8-10` → 0-based |
| Rotate uniform | `rotatePdfUniform(bytes, angle)` | 90° steps = `setRotation`, else `drawPage` |
| Rotate per-page | `rotatePdfPages(bytes, map)` | `map[i]` degrees |
| Watermark | `addWatermark(bytes, text, opts)` | Diagonal, opacity |
| Page numbers | `addPageNumbers(bytes, opts)` | 9 positions |
| Fix size | `fixPageSize(bytes, size)` | A4/Letter normalize |

## 6. Storage schema

```text
IndexedDB "pdfstudio" v1, store "pdfstudio-recent-v1" (keyPath: id)
  { id: docId, name, size, openedAt, lastPage }

IndexedDB "pdfstudio-annots" v1, store "annots" (keyPath: id)
  { id: docId, strokes: {page: [...]}, updatedAt }   // pruned to newest 60 docs

chrome.storage.local
  { autoFile, autoWeb, theme, hq, resume, pageMode, spread, gap, ...prefs }
```

`docId = name|size|hash(head+tail 16KB, FNV-1a)` — stable across URL re-fetches (never `lastModified`).

## 7. Performance budget

- Open ≤ 1s for 50-page PDF on mid laptop; first paint = skeleton + progress bar.
- Scroll jank = 0: only visible + 700px-margin pages render; canvases `content-visibility:auto`.
- Search "e" in 2000 pages: capped at 800 hits, list renders first 300, rest counted.
- Memory: DPR≤2, one canvas per rendered page, thumbs ≈150px wide.
