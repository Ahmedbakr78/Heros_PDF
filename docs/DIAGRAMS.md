# Diagrams Gallery — Heros PDF

Every diagram in the project, in one printable page. Copy any block into a
GitHub Markdown file, a Mermaid live editor, or `docs/architecture.md` to re-render.
No emojis anywhere in this file.

## 1. System overview (process model)

```mermaid
flowchart TB
    subgraph Browser["Browser: Chrome / Edge / Brave"]
        Popup["popup.html + popup.js"]
        BG["background.js service worker"]
        Viewer["viewer.html + app.js"]
        Vendor["vendor/ pdf.js, pdf-lib, qpdf, cmaps"]
        Ops["nevaipdf-ops.js"]
        IDB[("IndexedDB recents + annots")]
        Store[("chrome.storage.local prefs")]
    end
    Popup -->|message| BG
    BG -->|redirect?pdf=| Viewer
    Viewer --> Vendor
    Viewer --> Ops
    Ops --> Vendor
    Viewer <--> IDB
    Popup <--> Store
    Viewer <--> Store
```

## 2. Extension lifecycle (install to reading)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant BG as background.js
    participant V as viewer + app.js
    participant P as pdf.js worker
    participant DB as IndexedDB
    U->>BG: install
    BG->>BG: contextMenu create
    U->>V: drop / picker / ?pdf=URL
    V->>V: docIdFor(name+size+hash)
    V->>P: getDocument(cMaps, XFA)
    P-->>V: PDFDocumentProxy
    V->>V: buildPages + IntersectionObserver
    V->>DB: loadAnnots + saveRecent
    loop lazy render
        V->>P: getPage, render canvas, textLayer, linkLayer
    end
    V-->>U: loaded N pages
```

## 3. Render pipeline (epoch-guarded)

```mermaid
flowchart TB
    Open["Open file/drop/URL/recent"] --> ID["docIdFor"]
    ID --> Load["getDocument + password"]
    Load --> Sizes["baseSizes, page 1 fast + chunks of 12"]
    Sizes --> DOM["buildPages + observer"]
    DOM --> Obs{"visible?"}
    Obs -->|yes| RC["renderPage<br/>canvas + textLayer + linkLayer"]
    RC --> HL["highlight + annot overlay"]
    Obs -->|no| Wait["wait"]
```

## 4. Annotation engine

```mermaid
flowchart LR
    T["11 tools + stamps"] --> OV["annot-layer canvas"]
    OV --> U["undo / redo"]
    U --> DB[("IndexedDB per doc")]
    DB --> EX["export burns into PDF via pdf-lib"]
```

## 5. Search engine

```mermaid
flowchart TB
    Q["query"] --> IDX{"index built?"}
    IDX -->|no| BUILD["ensureSearchIndex, chunked + progress"]
    IDX -->|yes| SCAN["scan, case/whole-word, cap 800"]
    BUILD --> SCAN
    SCAN --> LIST["snippets, first 300"]
    LIST --> JUMP["jump + highlight current match"]
```

## 6. Edit engine

```mermaid
flowchart LR
    IN["Uint8Array"] --> LIB["pdf-lib load"]
    LIB --> OP{"op"}
    OP --> M["merge"] & S["split"] & R["rotate"] & W["watermark"] & P["page numbers"] & F["fix size"]
    M & S & R & W & P & F --> OUT["save + download"]
```

## 7. Privacy: nothing leaves the device

```mermaid
flowchart TB
    F["Your PDF"] --> L["blob URL, device only"]
    L --> R["canvas + textLayer in page"]
    R --> D[("IndexedDB local")]
    F -.->|never| N["Internet"]
```

## 8. Storage schema

```mermaid
flowchart LR
    LS["localStorage<br/>prefs v2, profile v1, stats v1,<br/>bookmarks v1, tools v1, tts v1, theme"]
    IDB1["IndexedDB pdfstudio<br/>recents"]
    IDB2["IndexedDB pdfstudio-annots<br/>stroke JSON, pruned to 60 docs"]
    FF["full backup JSON v4<br/>profile + prefs + bookmarks<br/>+ stats + tools + marks"]
    LS --> FF
    IDB1 --> FF
    IDB2 --> FF
```

## 9. Responsive breakpoints (mobile-full)

```mermaid
flowchart TB
    W["width"] --> A{"<=900?"}
    A -->|no| D["desktop, floating sidebar"]
    A -->|yes| B{"<=640?"}
    B -->|no| T["tablet, drawer sidebar"]
    B -->|yes| M["phone: nothing hidden,<br/>compact rows + quick-action row"]
```

## 10. Security boundary

```mermaid
flowchart TB
    E["extension page (self)"] --> CSP["script-src self + wasm-unsafe-eval"]
    E --> PERM["contextMenus, webNavigation, storage,<br/>all_urls only for .pdf detection"]
    E --> NO["no remote code, no analytics,<br/>no third-party fetches"]
```
