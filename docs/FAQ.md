# FAQ — Heros PDF (30 questions)

The complete FAQ. The README keeps the top 25; this page is the long-form,
maintained copy. No emojis anywhere.

## Product

**1. Is it really free?**
Yes. MIT-licensed, unlimited pages, merges and annotations, no watermark, no account, no daily quota. No premium tier exists.

**2. Do my PDFs upload anywhere?**
No. Files stay on your device as `blob:` URLs. There is no server, no analytics and no telemetry code in the project.

**3. Which browsers are supported?**
Any current Chromium browser: Chrome, Edge, Brave, Opera, Arc, Vivaldi. Firefox is a roadmap item (v3.0).

**4. Where is the website?**
`https://ahmedbakr78.github.io/Heros_PDF/`, served from the `docs/` folder by GitHub Pages.

**5. Where are releases?**
GitHub Releases, starting with `v2.3.2`, each with an attached `heros-pdf-vX.Y.Z.zip`.

**6. What are the repo topics?**
20 topics covering the product, the stack and the values — the exact list is in `.github/GITHUB_META.md`.

**7. Are the docs emoji-free?**
Yes, by policy, and CI fails a PR if an emoji appears in any Markdown, HTML or YAML file.

**8. Is there a read-aloud feature?**
It was removed in the current build (speaker button, menu entry and Hub card). The dormant engine code remains with no UI entry, so old backups still import cleanly.

## Installation and setup

**9. How do I install it?**
Clone or download, `chrome://extensions`, enable Developer mode, Load unpacked, pick `pdf-studio-extension/`. Full guide: `docs/INSTALLATION.md`.

**10. Why does `file://` auto-open not work?**
Enable "Allow access to file URLs" in the extension details, then turn on the popup toggle. Chrome never reveals `file://` navigations to extensions without that permission.

**11. URL open fails with a CORS or network error?**
The host blocks cross-origin fetch. Download the file, then drag and drop it into the viewer.

**12. Do I need a build step or internet to run it?**
No. Vanilla HTML/CSS/JS, zero frameworks, all engines vendored. After install it works fully offline.

**13. How do I update?**
`git pull`, then reload the extension. Recents, annotations, bookmarks, prefs and tools data persist.

## Viewing

**14. Password-protected PDFs?**
Supported. You get an unlock modal; a wrong password re-prompts with a hint.

**15. What is the maximum file size?**
Tested to 500+ MB and 2000+ pages. Lazy rendering and DPR caps keep memory bounded; 1,000-page documents open instantly.

**16. Can I jump to a page directly?**
Yes — type the number in the `12 / 248` box and press Enter. Also Home, End, arrows, thumbnails and the outline.

**17. What is spread mode?**
Two pages side by side with an adjustable gap, tracking the most-visible page for the current-page indicator.

**18. Do internal and external links work?**
Yes. Internal destinations jump inside the document; external links open a new tab with `noopener`.

**19. Is there a resume feature?**
Yes — reopen a document and it returns to the last page. Toggle in Settings.

## Annotating and editing

**20. Are annotations saved?**
Yes, per-document in IndexedDB, with undo/redo, and an export that burns them into the PDF for other readers.

**21. What edit operations exist?**
Merge, split by range, delete, reorder/duplicate, rotate (uniform or per-page), watermark, page numbers, header/footer, metadata, page-size fix, optimize, blank page, remove blanks, flatten, encrypt/decrypt, image watermark, images/text to PDF.

**22. Can I use the edit engine in my own project?**
Yes — MIT-licensed. `window.NevaiOps` exposes pure `Uint8Array` functions; see the handbook in the README.

**23. Which engines power the app?**
PDF.js for rendering and text extraction, pdf-lib plus qpdf.wasm for editing and repair. The edit layer is a vanilla-JS port of NevaiPDF's `pdf-operations`.

**24. Can I print?**
Yes, with the current rotation applied. For annotation-burned output, export first, then print the exported file.

## Mobile and accessibility

**25. Is every feature available on a phone?**
Yes — mobile-full since the current build. Nothing is hidden under 640px; controls compact into rows and the quick actions become a scrollable row.

**26. Does touch drawing work?**
Yes. The annotation overlay disables browser gestures only while a draw tool is active, so pinch-zoom still works outside pages.

**27. Are there eye-comfort modes?**
Dark and light UI (system-aware) plus Night (inverted pages), Sepia and Dim page modes.

**28. Is it keyboard navigable?**
Yes — the full map is in the README and in-app (More → Keyboard shortcuts). `prefers-reduced-motion` collapses animations.

## Contributing and security

**29. How do I help?**
Star the repo, report bugs, pick a `good first issue`, or send a small focused PR. Rules are in `CONTRIBUTING.md`.

**30. How do I report a security issue?**
Privately: Security → Advisories → Report a vulnerability, or message the maintainer. Never as a public issue. Details in `SECURITY.md`.
