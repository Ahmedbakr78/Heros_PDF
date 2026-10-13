# Testing Guide — Heros PDF

CI validates structure; the app itself is tested by hand against this matrix.
Run the full block before tagging a release. No emojis in this file.

## 1. Build-free smoke test (2 minutes)

1. `chrome://extensions` → reload Heros PDF.
2. Open the viewer from the popup.
3. Confirm: no console errors, boot animation suppression, empty state visible.
4. Open a 1-page PDF, then a 50+ page PDF, then a 300+ page PDF.

## 2. Viewing matrix

| Case | Steps | Expected |
|---|---|---|
| Continuous scroll | Open 50-page, scroll fast | No stale zoom, no blank frames, current page tracks |
| Single page | More → Single page → arrows | One page, arrows swap, scroll resets |
| Fit width / fit page | Zoom label menu | Both presets clamp inside the viewport |
| Custom zoom | +/- keys to 10% and 800% | Epoch guard re-renders once, text stays crisp |
| Rotate | R repeatedly | Layout swaps sides, scroll anchored |
| Spread | G, drag gap slider | Two per row, most-visible page tracked |
| Auto-scroll | Statusbar play, wheel | Speed follows slider, manual scroll pauses |
| Encrypted PDF | Open locked file | Unlock modal, wrong password re-prompts |
| URL open | `?pdf=` public URL | Loads, or a clear CORS hint |
| Drag and drop | Drop PDF on window | Overlay appears, file loads |

## 3. Annotate matrix

| Case | Steps | Expected |
|---|---|---|
| Each of 11 tools | Draw on a page | Stroke appears in the correct layer |
| Undo / redo | Ctrl+Z, Ctrl+Shift+Z | Full history restored |
| Eraser | Erase tool, click a stroke | Only that stroke is removed |
| Text note | Text tool, type, place | Editable from the Notes list |
| Stamp chips | APPROVED etc. | Placed once per tap |
| Selection mini-bar | Select rendered text | Highlight / underline / copy offered |
| Persistence | Draw, reload page | Strokes return |
| Export | Annotate bar export | Downloaded PDF contains marks |

## 4. Edit matrix

| Case | Steps | Expected |
|---|---|---|
| Merge | 3 files, merge queue | One file, order preserved |
| Split range | `1-3,5,8-10` | Exactly those pages |
| Delete | Select grid, delete | Remaining pages intact |
| Rotate uniform / per-page | Both buttons | Result opens and renders rotated |
| Watermark | Text + opacity | Diagonal stamp on every page |
| Page numbers | Apply | Numbers in the chosen position |
| Header / footer | Apply | Lines present on all pages |
| Metadata | Edit title, save | New value shown in properties |
| Remove blanks | Run on mixed file | Only blanks dropped |
| Flatten | Run on a form | Fields no longer editable |
| Encrypt / decrypt | Lock, unlock | Password set and removed |
| Images to PDF / text to PDF | Both buttons | Output opens in the viewer |
| Page to PNG | Export current page | PNG downloaded at export quality |

## 5. Productivity matrix

| Case | Steps | Expected |
|---|---|---|
| Stopwatch start / lap / reset | All three buttons | Digits update, laps listed with split |
| Stopwatch survives reload | Start, reload | Resumes with correct elapsed |
| Counters | Add, step, rename, delete | Values and steps persist |
| Tracker | Open a file for 60s | Today and per-file values increase |
| Daily goal | Drag slider | Bar fills against today's total |
| Streak | Simulate two active days | Streak counts consecutive days |
| Todos | Add in file scope | Attached to the document |
| Global scope | Switch to Everything | Global + file tasks with badges |
| Clear done | With completed tasks | Only completed removed |
| TXT export | Export current view | File downloads |

## 6. Persistence and backup

1. Draw markers, add bookmarks, change prefs, add a todo.
2. Hub → Backup → confirm the file downloads and parses as JSON.
3. Clear site data (or Hub → Reset tools data for tools only).
4. Hub → Restore → everything returns, including the annotation state of the
   currently open file.

## 7. Theme, comfort, responsive

| Case | Steps | Expected |
|---|---|---|
| Theme toggle | Moon/sun | Instant, persisted after reload |
| Page modes | Night, Sepia, Dim | Canvas filters only |
| Focus mode | Toggle in Hub | Sidebar hides, reading continues |
| Mobile <=900px | Resize | Drawer sidebar opens with backdrop |
| Mobile <=640px | Resize | No hidden controls; action row scrolls |
| 360px width | DevTools device | Topbar wraps, all buttons reachable |

## 8. Repo and CI checks

```bash
node --check pdf-studio-extension/app.js        # JS syntax
python3 -c "import json; json.load(open('pdf-studio-extension/manifest.json'))"  # manifest
grep -q "[$(python3 -c "import json;print(json.load(open('pdf-studio-extension/manifest.json'))['version'])")]" CHANGELOG.md
```

Plus the manual emoji scan documented in `.github/workflows/ci.yml`.

## 9. Release gate

All of the above, plus: version bump in `manifest.json`, CHANGELOG entry,
`RELEASE_vX.Y.Z.md` written from the template, tag pushed, release zip attached.
