# Changelog — Heros PDF

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) + [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Productivity Studio (Tools sidebar tab): stopwatch with laps, unlimited counters,
  automatic reading tracker with streaks and daily goal, file-scoped and global todos
- Everything in Tools auto-saves locally; one-file backup/restore/reset included in full backup v4
- Tools menu entry + T shortcut; tracker and file todos refresh on document open

## [2.3.2] — 2026-10-13 — Ultra-Round Studio

### Added
- 2-up Spread mode with adjustable page gap + most-visible-page tracking
- Selection mini-toolbar (Highlight / Underline / Copy on text select)
- Sidebar power-pack: Edit (merge/split/delete/rotate/watermark/page-numbers/fix-size),
  Bookmarks, Notes list, Profile card with stats, Settings panel
- Page modes: Night (invert) / Sepia / Dim + Focus mode + Autoscroll bar
- Text-to-Speech read-aloud with rate control
- Stamps (APPROVED / DRAFT / CONFIDENTIAL / SIGN HERE), text-box annotations
- Global error surfacing (runtime errors become toasts, never silent dead buttons)

### Changed
- Full ultra-rounded design system: floating topbar/sidebar, pill tab bar/pagebox/search
- Silent instant boot (`body.booting` disables boot animations)
- Hidden app-wide scrollbars, ultra-round range sliders, icon-everywhere UI
- Epoch-guarded rendering + scale snapshots (text never drifts on fast zoom)
- Stable `docIdFor()` (name+size+hash, no `lastModified`) so bookmarks/annots persist

### Fixed
- Spread row overflow (gap math + 4px safety haircut)
- Text-layer drift after zoom/rotate (sync `pv.viewport` + redraw overlay)
- Stuck stale-zoom pages (`retryRender` re-queue)
- `file://` open reliability + clear “Allow access to file URLs” guidance
- Popup toggles persisting via `chrome.storage.local`

## [2.3.1] — 2026-09-20

### Added
- Annotation undo/redo stacks, eraser tool, opacity slider
- Recent files with time-ago + clear-all

### Fixed
- Password modal retry loop, thumbnail DPR blur

## [2.3.0] — 2026-09-02

### Added
- Edit Studio v1: merge / split / rotate via `nevaipdf-ops.js` (NevaiPDF port)
- Outline tree, full-text search pane (800-result cap)

## [2.0.0] — 2026-08-01

### Added
- Manifest V3 rewrite, service-worker auto-open, context menu, popup
- Dark + Light themes, continuous/single modes, fit-width/fit-page zoom

[2.3.2]: https://github.com/Ahmedbakr78/Heros_PDF/releases/tag/v2.3.2
[2.3.1]: https://github.com/Ahmedbakr78/Heros_PDF/releases/tag/v2.3.1
[2.3.0]: https://github.com/Ahmedbakr78/Heros_PDF/releases/tag/v2.3.0
[2.0.0]: https://github.com/Ahmedbakr78/Heros_PDF/releases/tag/v2.0.0
