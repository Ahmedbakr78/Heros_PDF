# User Guide — Heros PDF v2.3.2

> The full manual. Shortcuts, studios, edit ops, range syntax, themes, mobile, TTS, print.

## 1. Opening files

- **Open button / Ctrl+O**: file picker, PDF filter.
- **Drag and drop**: drop a `.pdf` anywhere on the window (overlay confirms).
- **From URL**: empty-state *From URL* button or `viewer.html?pdf=ENCODED_URL` (needs CORS permission from the host).
- **Recent**: sidebar Recent pane → click any entry (name, size, time-ago).
- **Context menu**: right-click a PDF link → Open with Heros PDF.
- **Demo**: empty-state demo button loads a sample without any file.

## 2. Navigation

- Page box: type `12` in `12 / 248` + Enter. Arrows step, Home/End jump.
- Continuous mode: scroll freely; current page tracks the topmost visible page (spread mode tracks most-visible).
- Single-page mode: More menu → Single page; arrows swap the one visible page.
- Outline: click any bookmark → jumps via destination (internal) or URL (external).
- Thumbnails: click any thumb → smooth-scrolls to that page; active page has the accent ring.
- Links in pages: internal dest links jump; external links open a new tab with `noopener`.

## 3. Zoom, rotate, layout

- Zoom: minus/plus buttons, `+`/`-`/`0` keys, or label button for fit presets. Range 10–800%.
- Fit-width (default): page width matches viewer. Fit-page: whole page fits. Custom: any manual zoom.
- Rotate: `R` or button rotates view 90 degrees clockwise (layout + re-render, scroll anchored).
- Spread (2-up): statusbar spread toggle → two pages per row with adjustable gap slider (Settings). Layout math reserves exactly one gap so rows never wrap accidentally.
- Focus mode: hides sidebar for pure reading. Fullscreen/presentation: black backdrop, chrome hidden, Esc exits.

## 4. Search

1. Ctrl+F or search icon → sidebar Search pane focuses.
2. Type (1+ chars) → index builds once (progress bar, chunked) → results list with `Page N` badge + snippet (45 before, 65 after, match emphasized).
3. Enter = next match, Shift+Enter = previous. Prev/next buttons do the same.
4. Toggles: case-sensitive (`Aa`), whole-word (`W`, word-boundary regex with fallback).
5. Caps: 800 hits indexed, first 300 listed, count shows `800+` when capped.
6. Clear (X) resets highlights and restores the placeholder.

## 5. Annotate Studio

1. Click Annotate (pencil) → floating toolbar appears top-center.
2. Pick a tool: Select, Highlight, Underline, Strike, Pen, Arrow, Line, Rect, Ellipse, Text, Eraser.
3. Pick color (swatches or custom picker), size slider, opacity slider.
4. Draw directly on the page overlay (pointer events enabled only in draw mode; text selection disabled while drawing to avoid conflicts).
5. Text tool: click → modal with textarea + size → places a text box.
6. Stamps: one click places APPROVED / DRAFT / CONFIDENTIAL / SIGN HERE.
7. Eraser: click a stroke to delete it (hit-tested in viewport pixels).
8. Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z) across the whole document session.
9. Selection mini-bar: with the Select tool, drag-select rendered text → floating bar offers Highlight / Underline / Copy.
10. Everything auto-saves to IndexedDB per document ID. Sidebar Notes lists every annotation (click to jump, X to delete). Export (Download with annotations) burns strokes into the PDF via pdf-lib so other readers see them.

## 6. Edit Studio (merge / split / delete / watermark / numbers)

Open Sidebar → Edit. All ops are pure `Uint8Array → Uint8Array` via `window.NevaiOps`, then downloaded.

- **Merge**: drop 2+ PDFs → order them → Merge and Download → one file, pages concatenated in order.
- **Split / extract**: enter ranges like `1-3,5,8-10` (1-based, inclusive) → Extract → new PDF with just those pages. Invalid tokens ignored; empty = no-op with a toast.
- **Delete**: visual grid, multi-select pages → Delete → new PDF without them.
- **Rotate**: uniform 90/180/270 applied to all pages, or per-page map (page 2 → 90, page 5 → 270).
- **Watermark**: custom text, diagonal, opacity slider → applied to every page.
- **Page numbers**: 9 positions (corners/edges/center-bottom), margin + font size.
- **Fix size**: normalize mixed pages to A4 or Letter.
- **Quality**: export slider trades size for image fidelity on re-save.

## 7. Bookmarks, notes, profile, settings

- **Bookmarks**: star button in topbar bookmarks the current page for this document ID. Sidebar lists them (jump + remove).
- **Notes**: every annotation stroke listed with page + tool + preview; click jumps, X deletes.
- **Profile**: name + color + avatar; stats count documents opened and pages read (local only).
- **Settings**: HQ render (DPR 2 vs 1, perf trade), resume reading (restore last page), auto-open file/web toggles (mirror popup), page mode (off/night/sepia/dim), spread + gap, autoscroll speed.

## 8. Reading comfort

- UI theme: moon/sun button, instant, persisted, follows system when set to system.
- Page modes: Night (invert + hue-rotate, dark pages), Sepia (warm), Dim (reduced brightness). Independent of UI theme.
- Read aloud (TTS): More → Read aloud → page text spoken with system voices, rate slider, stop on page change.
- Autoscroll: statusbar play → viewer scrolls at set speed; any manual scroll pauses; click again stops.
- Reduced motion: `prefers-reduced-motion` collapses animations to near-zero.

## 9. Mobile

- Under 900px the sidebar becomes an overlay drawer with backdrop (tap outside to close).
- Under 640px the topbar goes icon-only (labels hidden, filetag hidden), pagebox becomes a pill, toasts go full-width bottom.
- Under 400px the `/ total` hides to save space.
- Touch drawing works with `touch-action: none` on the overlay; pinch-zoom of the browser still works outside pages.

## 10. Print and download

- Download button: original bytes, or edited bytes if Edit/Annotate export produced them (filename suffixed accordingly).
- Print: Ctrl+P or More → Print → native dialog with current rotation applied. Note: browsers print the rendered view; for annotation-burned print, export first then print the exported file.

## 11. Keyboard map (complete)

Open, Search, Arrows, Home/End, +/-/0, Ctrl+B (sidebar), Ctrl+Z / Ctrl+Shift+Z (annot undo/redo),
Delete (edit selection), F (fit width), R (rotate), Space / Shift+Space (scroll), F11 (fullscreen),
Ctrl+P (print), Esc (close modal/menu, exit presentation).
