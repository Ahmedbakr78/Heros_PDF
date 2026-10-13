/* ==========================================================================
   HEROS PDF — application logic
   ========================================================================== */
(function () {
'use strict';

/* --------------------------------------------------------------------------
   0. Shorthands & tiny helpers
   -------------------------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const raf = fn => requestAnimationFrame(fn);

function debounce(fn, ms) {
  let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); };
}
function throttleRaf(fn) {
  let queued = false, lastArgs;
  return function () {
    lastArgs = arguments;
    if (queued) return;
    queued = true;
    raf(() => { queued = false; fn.apply(null, lastArgs); });
  };
}
function fmtBytes(b) {
  if (!b && b !== 0) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch (e) { return String(d); }
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

/* Global error surfacing: any runtime failure inside our own scripts
   becomes a visible toast (with the real message) instead of a silent
   dead button. Third-party/pdf.js noise is ignored. */
window.addEventListener('error', (e) => {
  try {
    const f = String(e.filename || '');
    if (f.indexOf('app.js') === -1 && f.indexOf('nevaipdf-ops.js') === -1) return;
    const msg = String((e.message || 'unknown error')).slice(0, 160);
    if (typeof toast === 'function') toast('Error: ' + msg, 'err', 6000);
    else console.warn('[HerosPDF]', msg);
  } catch (_) { /* never break the app from the trap itself */ }
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    const r = e.reason;
    const msg = String((r && r.message) || r || 'unknown error').slice(0, 160);
    if (/Loading chunk|ResizeObserver|AbortError/i.test(msg)) return;
    if (typeof toast === 'function') toast('Action failed: ' + msg, 'err', 6000);
    else console.warn('[HerosPDF] rejection:', msg);
  } catch (_) {}
});

/* --------------------------------------------------------------------------
   1. Config
   -------------------------------------------------------------------------- */
const CFG = {
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 8,
  ZOOM_STEP: 1.25,
  DPR_MAX: 2,
  PRELOAD_MARGIN: '700px',
  THUMB_WIDTH: 150,
  MAX_SEARCH_RESULTS: 800,
  STORE: 'pdfstudio-recent-v1'
};
const PDFJS_CMAP = 'vendor/cmaps/';

/* --------------------------------------------------------------------------
   2. DOM refs
   -------------------------------------------------------------------------- */
const D = {
  viewer:      $('#viewer'),
  pages:       $('#pages'),
  empty:       $('#empty'),
  sidebar:     $('#sidebar'),
  sideBackdrop:$('#sideBackdrop'),
  thumbs:      $('#thumbs'),
  thumbsEmpty: $('#thumbsEmpty'),
  outlineList: $('#outlineList'),
  outlineEmpty:$('#outlineEmpty'),
  searchBox:   $('#searchBox'),
  searchInput: $('#searchInput'),
  searchClear: $('#searchClear'),
  searchMeta:  $('#searchMeta'),
  searchCount: $('#searchCount'),
  searchResults:$('#searchResults'),
  searchEmpty: $('#searchEmpty'),
  searchPrev:  $('#searchPrev'),
  searchNext:  $('#searchNext'),
  recentList:  $('#recentList'),
  recentEmpty: $('#recentEmpty'),
  btnClearRecent: $('#btnClearRecent'),
  fileInput:   $('#fileInput'),
  menu:        $('#menu'),
  toasts:      $('#toasts'),
  modalBackdrop:$('#modalBackdrop'),
  modal:       $('#modal'),
  dropOverlay: $('#dropOverlay'),
  progress:    $('#progress'),
  progressBar: $('#progressBar'),
  statusDot:   $('#statusDot'),
  statusText:  $('#statusText'),
  sbPages:     $('#sbPages'),
  sbSize:      $('#sbSize'),
  sbMode:      $('#sbMode'),
  sbFile:      $('#sbFile'),
  sbZoom:      $('#sbZoom'),
  sbPage:      $('#sbPage'),
  pageInput:   $('#pageInput'),
  pageTotal:   $('#pageTotal'),
  btnFirst:    $('#btnFirst'),
  btnPrev:     $('#btnPrev'),
  btnNext:     $('#btnNext'),
  btnLast:     $('#btnLast'),
  btnZoomIn:   $('#btnZoomIn'),
  btnZoomOut:  $('#btnZoomOut'),
  btnZoomLabel:$('#btnZoomLabel'),
  btnFit:      $('#btnFit'),
  btnRotate:   $('#btnRotate'),
  btnSearch:   $('#btnSearch'),
  btnTheme:    $('#btnTheme'),
  themeIcon:   $('#themeIcon'),
  btnMenu:     $('#btnMenu'),
  btnSidebar:  $('#btnSidebar'),
  btnOpen:     $('#btnOpen'),
  btnAnnotate: $('#btnAnnotate'),
  annotBar:    $('#annotBar'),
  btnEdit:     $('#btnEdit'),
  btnBookmark: $('#btnBookmark'),
  btnNight:    $('#btnNight'),
  btnSpread:   $('#btnSpread'),
  mergeInput:  $('#mergeInput'),
  marksInput:  $('#marksInput'),
  editGrid:    $('#editGrid'),
  annotOpacity:$('#annotOpacity'),
  annotsList:  $('#annotsList'),
  annotsEmpty: $('#annotsEmpty'),
  bmList:      $('#bmList'),
  bmEmpty:     $('#bmEmpty'),
  bmPageLbl:   $('#bmPageLbl'),
  autoBar:     $('#autoBar'),
  selBar:      $('#selBar'),
  selHighlight:$('#selHighlight'),
  selUnderline:$('#selUnderline'),
  selCopy:     $('#selCopy'),
  selClose:    $('#selClose')
};

/* --------------------------------------------------------------------------
   3. Global state
   -------------------------------------------------------------------------- */
const S = {
  doc: null,
  blobUrl: null,
  file: null,
  numPages: 0,
  pageNum: 1,
  scale: 1,
  scaleMode: 'fit-width',   // 'fit-width' | 'fit-page' | 'custom'
  rotation: 0,
  continuous: true,
  pageViews: [],
  baseSizes: [],            // {w,h} at scale 1 / rotation 0
  sizesReady: false,
  epoch: 0,
  docId: null,
  outline: null,
  searchIndex: null,
  searchQuery: '',
  searchResults: [],
  searchCursor: -1,
  indexing: false,
  title: '',
  props: null,
  pageObserver: null,
  thumbObserver: null,
  visiblePages: new Set(),
  renderStart: 0,
  renderCount: 0,
  // --- annotation studio ---
  annots: {},              // pageNum -> [stroke]
  annotMode: false,
  tool: 'select',          // select|highlight|underline|strike|pen|arrow|line|rect|ellipse|text|eraser
  annotColor: '#ffd400',
  annotSize: 8,            // screen px at draw time
  annotOpacity: 1,
  undoStack: [],
  redoStack: [],
  speaking: false,
  ttsRate: 1,
  // --- edit studio ---
  editSel: new Set(),
  exportQ: 2.5,
  spreadOn: false,
  pageGap: 18,
  // --- bookmarks / profile / prefs ---
  bookmarks: {},           // docId -> [pageNums]
  profile: { name: 'My Studio', color: '#4c8dff' },
  prefs: { hq: true, resume: true, autoOpen: true, pageMode: 'off', autoSpeed: 30, spread: false, gap: 18 },
  stats: { docs: 0, pagesRead: 0 },
  autoTimer: null,
  renderQueue: [],
  activeRenders: 0
};

/* --------------------------------------------------------------------------
   4. Toast / status / progress
   -------------------------------------------------------------------------- */
function toast(msg, type, ms) {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  const iconName = type === 'err' ? 'i-alert' : type === 'ok' ? 'i-check' : 'i-info';
  el.innerHTML = '<svg class="ic"><use href="#' + iconName + '"/></svg><span>' + esc(msg) + '</span>';
  D.toasts.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, ms || 2600);
}
function setStatus(text, kind) {
  D.statusText.textContent = text;
  D.statusDot.className = 'dot' + (kind ? ' ' + kind : '');
}
let progressTimer = null;
function showProgress(pct) {
  D.progress.classList.remove('done');
  D.progressBar.style.width = clamp(pct, 0, 100) + '%';
  clearTimeout(progressTimer);
}
function hideProgress() {
  D.progressBar.style.width = '100%';
  D.progress.classList.add('done');
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => { D.progressBar.style.width = '0%'; }, 350);
}

/* --------------------------------------------------------------------------
   5. IndexedDB (recent files)
   -------------------------------------------------------------------------- */
const IDB = (function () {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no-idb'));
      const r = indexedDB.open('pdfstudio', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(CFG.STORE)) {
          const st = db.createObjectStore(CFG.STORE, { keyPath: 'id' });
          st.createIndex('openedAt', 'openedAt');
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(mode) {
    return open().then(db => db.transaction(CFG.STORE, mode).objectStore(CFG.STORE));
  }
  return {
    put(rec) { return tx('readwrite').then(st => new Promise((res, rej) => { const q = st.put(rec); q.onsuccess = res; q.onerror = () => rej(q.error); })); },
    all()   { return tx('readonly').then(st => new Promise((res, rej) => { const q = st.getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); })); },
    del(id) { return tx('readwrite').then(st => new Promise((res, rej) => { const q = st.delete(id); q.onsuccess = res; q.onerror = () => rej(q.error); })); },
    clear() { return tx('readwrite').then(st => new Promise((res, rej) => { const q = st.clear(); q.onsuccess = res; q.onerror = () => rej(q.error); })); }
  };
})();

/* --------------------------------------------------------------------------
   5b. IndexedDB (annotations — JSON strokes per document)
   -------------------------------------------------------------------------- */
const ANN = (function () {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no-idb'));
      const r = indexedDB.open('pdfstudio-annots', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('annots')) {
          db.createObjectStore('annots', { keyPath: 'id' });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function store(mode) {
    return open().then(db => db.transaction('annots', mode).objectStore('annots'));
  }
  return {
    get(id)  { return store('readonly').then(st => new Promise((res, rej) => { const q = st.get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); })); },
    put(rec) { return store('readwrite').then(st => new Promise((res, rej) => { const q = st.put(rec); q.onsuccess = res; q.onerror = () => rej(q.error); })); },
    async prune() {
      try {
        const all = await store('readonly').then(st => new Promise((res, rej) => { const q = st.getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }));
        if (all.length > 60) {
          all.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
          const st = await store('readwrite');
          for (let i = 0; i < all.length - 60; i++) st.delete(all[i].id);
        }
      } catch (e) {}
    }
  };
})();

/* --------------------------------------------------------------------------
   6. Theme
   -------------------------------------------------------------------------- */
const Theme = (function () {
  const KEY = 'pdfstudio-theme';
  let mode = 'system';
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  function apply() {
    const resolved = mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0e1014' : '#e9ecf1');
    D.themeIcon.innerHTML = '<use href="#' + (resolved === 'dark' ? 'i-sun' : 'i-moon') + '"/>';
    return resolved;
  }
  function set(m) { mode = m; try { localStorage.setItem(KEY, m); } catch (e) {} apply(); }
  function toggle() { set(currentResolved() === 'dark' ? 'light' : 'dark'); }
  function currentResolved() {
    return mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
  }
  try { const saved = localStorage.getItem(KEY); if (saved) mode = saved; } catch (e) {}
  mq.addEventListener && mq.addEventListener('change', () => { if (mode === 'system') apply(); });
  apply();
  return { apply, set, toggle, currentResolved, get mode() { return mode; } };
})();

/* --------------------------------------------------------------------------
   7. Modal system
   -------------------------------------------------------------------------- */
let modalCloseCb = null;
function openModal(opts) {
  const m = D.modal;
  m.innerHTML =
    '<div class="modal-head">' +
      '<svg class="ic ic-lg"><use href="#' + (opts.icon || 'i-info') + '"/></svg>' +
      '<h3>' + esc(opts.title || '') + '</h3>' +
      '<button class="ibtn" data-close="1" title="Close"><svg class="ic"><use href="#i-x"/></svg></button>' +
    '</div>' +
    '<div class="modal-body" id="modalBody">' + (opts.html || '') + '</div>' +
    (opts.footer === false ? '' :
      '<div class="modal-foot">' + (opts.footer || '<button class="btn" data-close="1">Close</button>') + '</div>');

  D.modalBackdrop.classList.add('show');
  modalCloseCb = opts.onClose || null;

  m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  if (opts.onMount) opts.onMount(m);
  const focusable = m.querySelector('input,button:not([data-close])');
  if (focusable) setTimeout(() => focusable.focus(), 30);
}
function closeModal() {
  D.modalBackdrop.classList.remove('show');
  D.modal.innerHTML = '';
  if (modalCloseCb) { const cb = modalCloseCb; modalCloseCb = null; cb(); }
}
D.modalBackdrop.addEventListener('mousedown', e => { if (e.target === D.modalBackdrop) closeModal(); });

/* --------------------------------------------------------------------------
   8. Dropdown menu
   -------------------------------------------------------------------------- */
let menuOpen = false;
function openMenu(anchor, items) {
  const m = D.menu;
  let html = '';
  items.forEach(it => {
    if (it.sep) { html += '<div class="menu-sep"></div>'; return; }
    if (it.label) { html += '<div class="menu-label">' + esc(it.label) + '</div>'; return; }
    const dis = it.disabled ? ' disabled' : '';
    html += '<button class="menu-item" data-idx="' + items.indexOf(it) + '"' + dis + '>' +
      '<svg class="ic"><use href="#' + (it.icon || 'i-info') + '"/></svg>' +
      '<span class="lbl">' + esc(it.text) + '</span>' +
      (it.checked ? '<svg class="ic tick"><use href="#i-check"/></svg>' : '') +
      (it.kbd ? '<span class="kbd">' + esc(it.kbd) + '</span>' : '') +
    '</button>';
  });
  m.innerHTML = html;
  m.classList.add('show');
  menuOpen = true;

  // position
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = r.right - mw;
  let top = r.bottom + 6;
  if (left < 8) left = 8;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px';
  m.style.top = top + 'px';

  m.querySelectorAll('.menu-item:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items[parseInt(btn.dataset.idx, 10)];
      closeMenu();
      if (item && item.action) item.action();
    });
  });
}
function closeMenu() {
  if (!menuOpen) return;
  D.menu.classList.remove('show');
  D.menu.innerHTML = '';
  menuOpen = false;
}
document.addEventListener('mousedown', e => {
  if (menuOpen && !D.menu.contains(e.target)) closeMenu();
}, true);
window.addEventListener('blur', closeMenu);

/* --------------------------------------------------------------------------
   9. PDF.js worker
   -------------------------------------------------------------------------- */
const pdfjsLib = window.pdfjsLib;
if (!pdfjsLib) {
  document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#c00">' +
    '<h2>Failed to load PDF.js</h2><p>Missing vendor/pdf.min.js — check the extension files.</p></div>';
  return;
}
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

/* --------------------------------------------------------------------------
   10. Document loading
   -------------------------------------------------------------------------- */
/* Stable document id: name + size + hash of head/tail bytes.
   (lastModified changes on every URL fetch, so it must not be used.) */
async function docIdFor(file) {
  const name = file.name || 'document.pdf';
  const size = file.size || 0;
  let hex = '0';
  try {
    if (size > 0) {
      const n = Math.min(size, 16384);
      const bufs = [new Uint8Array(await file.slice(0, n).arrayBuffer())];
      if (size > n) bufs.push(new Uint8Array(await file.slice(size - n, size).arrayBuffer()));
      let h = 0x811c9dc5;
      bufs.forEach(b => { for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); } });
      hex = (h >>> 0).toString(16);
    }
  } catch (e) {}
  return [name, size, hex].join('|');
}

async function loadFromFile(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) { toast('Please choose a PDF file', 'err'); return; }

  if (S.blobUrl) { URL.revokeObjectURL(S.blobUrl); S.blobUrl = null; }
  S.file = file;
  S.blobUrl = URL.createObjectURL(file);
  S.docId = await docIdFor(file);
  await openDocument(S.blobUrl, file.name, file.size);
}

/* file:// URLs need special handling from extension pages.
   Tries fetch() first, falls back to XHR (works when the extension has
   "Allow access to file URLs" enabled). */
async function fileFetch(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.blob();
  } catch (e) { /* try XHR below */ }
  return await new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = () => (xhr.status === 200 || xhr.status === 0)
      ? res(xhr.response)
      : rej(new Error('HTTP ' + xhr.status));
    xhr.onerror = () => rej(new Error('network'));
    xhr.send();
  });
}

async function loadFromUrl(url, name) {
  try {
    setStatus('Downloading…', 'busy');
    showProgress(15);
    let blob;
    if (/^file:/i.test(url)) {
      blob = await fileFetch(url);
    } else {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      blob = await res.blob();
    }
    showProgress(70);
    if (S.blobUrl) URL.revokeObjectURL(S.blobUrl);
    S.blobUrl = URL.createObjectURL(blob);
    const fname = name || url.split('/').pop().split('?')[0] || 'document.pdf';
    S.file = new File([blob], fname, { type: 'application/pdf' });
    S.docId = await docIdFor(S.file);
    await openDocument(S.blobUrl, fname, blob.size);
    hideProgress();
  } catch (err) {
    hideProgress();
    setStatus('Ready');
    if (/^file:/i.test(url)) {
      toast('Cannot read local file — enable "Allow access to file URLs" for Heros PDF in chrome://extensions', 'err', 6000);
    } else {
      toast('Could not fetch URL (CORS?)', 'err', 4000);
    }
  }
}

function openDocument(url, name, size) {
  return new Promise((resolve) => {
    setStatus('Loading…', 'busy');
    showProgress(25);

    const task = pdfjsLib.getDocument({
      url: url,
      cMapUrl: PDFJS_CMAP,
      cMapPacked: true,
      enableXfa: true
    });

    task.onProgress = (p) => {
      if (p && p.total) showProgress(25 + (p.loaded / p.total) * 55);
    };

    task.onPassword = (updatePassword, reason) => {
      showPasswordModal(reason === 2).then(pw => {
        if (pw === null) { task.destroy(); resolve(false); return; }
        updatePassword(pw);
      });
    };

    task.promise.then(async (doc) => {
      showProgress(85);
      await onDocumentReady(doc, name, size);
      hideProgress();
      resolve(true);
    }).catch(err => {
      hideProgress();
      console.error(err);
      const msg = (err && err.name === 'PasswordException') ? 'Password required' :
                  (err && err.name === 'InvalidPDFException') ? 'Invalid or corrupted PDF' :
                  'Could not open this PDF';
      toast(msg, 'err', 3800);
      setStatus('Ready');
      resolve(false);
    });
  });
}

function showPasswordModal(wrong) {
  return new Promise(resolve => {
    let settled = false;
    openModal({
      title: wrong ? 'Incorrect password' : 'Password protected',
      icon: 'i-lock',
      html:
        '<p style="margin:0 0 14px;font-size:13.5px;color:var(--muted);line-height:1.6">' +
          'This document is encrypted. Enter the password to unlock it.' +
        '</p>' +
        '<label class="field-label" for="pwField">Password</label>' +
        '<input class="pw-input" type="password" id="pwField" autocomplete="current-password" placeholder="••••••••">' +
        (wrong ? '<div class="err-text"><svg class="ic ic-sm"><use href="#i-alert"/></svg> That password was not correct.</div>' : ''),
      footer:
        '<button class="btn" data-close="1">Cancel</button>' +
        '<button class="btn accent" id="pwSubmit">Unlock</button>',
      onMount(m) {
        const inp = m.querySelector('#pwField');
        const submit = () => {
          settled = true;
          const v = inp.value;
          closeModal();
          resolve(v);
        };
        m.querySelector('#pwSubmit').addEventListener('click', submit);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      },
      onClose() { if (!settled) resolve(null); }
    });
  });
}

/* --------------------------------------------------------------------------
   11. Document ready — build everything
   -------------------------------------------------------------------------- */
async function onDocumentReady(doc, name, size) {
  cleanupDocument();

  S.doc = doc;
  S.numPages = doc.numPages;
  S.pageNum = 1;
  S.rotation = 0;
  S.scaleMode = 'fit-width';
  S.searchIndex = null;
  S.searchQuery = '';
  S.searchResults = [];
  S.searchCursor = -1;
  S.sizesReady = false;

  D.empty.hidden = true;
  D.pages.hidden = false;

  // metadata
  try {
    const meta = await doc.getMetadata();
    S.props = meta.info || {};
    S.title = (S.props.Title || name || '').trim();
  } catch (e) { S.props = {}; S.title = name || ''; }

  // annotations for this document (loaded before first render)
  await loadAnnots();

  // base sizes (page 1 first, quick)
  S.baseSizes = new Array(S.numPages);
  try {
    const p1 = await doc.getPage(1);
    const vp = p1.getViewport({ scale: 1, rotation: 0 });
    const base = { w: vp.width, h: vp.height };
    for (let i = 0; i < S.numPages; i++) S.baseSizes[i] = base;
  } catch (e) {
    for (let i = 0; i < S.numPages; i++) S.baseSizes[i] = { w: 612, h: 792 };
  }

  // build page DOM
  buildPages();

  // outline
  buildOutline();

  // UI state
  updateUI();
  D.sbPages.textContent = S.numPages;
  D.sbSize.textContent = fmtBytes(size);
  D.sbFile.textContent = name || 'document.pdf';
  document.title = (name ? name.replace(/\.pdf$/i, '') : 'Document') + ' — Heros PDF';

  // layout + first render
  layout(false);
  renderVisible(true);

  // background: exact page sizes
  computeAllSizes();

  // thumbnails
  buildThumbnails();

  // persist recent
  saveRecent(name, size);

  // restore last page
  restoreLastPage();

  setStatus('Ready', 'ok');
  toast('Loaded ' + S.numPages + ' page' + (S.numPages > 1 ? 's' : ''), 'ok', 1800);
}

function cleanupDocument() {
  if (S.pageObserver) { S.pageObserver.disconnect(); S.pageObserver = null; }
  if (S.thumbObserver) { S.thumbObserver.disconnect(); S.thumbObserver = null; }
  S.pageViews.forEach(pv => { if (pv.task) { try { pv.task.cancel(); } catch (e) {} } });
  S.pageViews = [];
  S.annots = {};
  S.undoStack = [];
  S.redoStack = [];
  updateAnnotUndoUI();
  try { hideSelBar(); } catch (e) {}
  try { window.getSelection().removeAllRanges(); } catch (e) {}
  S.visiblePages.clear();
  D.pages.innerHTML = '';
  D.thumbs.innerHTML = '';
  D.outlineList.innerHTML = '';
  D.searchResults.innerHTML = '';
  if (S.doc) { try { S.doc.destroy(); } catch (e) {} }
  S.doc = null;
}

/* --------------------------------------------------------------------------
   12. Page view construction
   -------------------------------------------------------------------------- */
function buildPages() {
  const frag = document.createDocumentFragment();
  S.pageViews = [];

  for (let i = 1; i <= S.numPages; i++) {
    const el = document.createElement('div');
    el.className = 'page';
    el.dataset.page = i;

    const sk = document.createElement('div');
    sk.className = 'page-skeleton';
    sk.innerHTML = '<div class="sp"></div>';
    el.appendChild(sk);

    const badge = document.createElement('div');
    badge.className = 'page-num-badge';
    badge.textContent = i;
    el.appendChild(badge);

    const pv = {
      num: i, el, canvas: null, textLayer: null, linkLayer: null,
      rendered: false, rendering: false, epoch: -1,
      task: null, scale: 0, rotation: -1, off: 0, h: 0
    };
    S.pageViews.push(pv);
    frag.appendChild(el);
  }

  D.pages.innerHTML = '';
  D.pages.appendChild(frag);

  // observer
  S.pageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const el = entry.target;
      const num = parseInt(el.dataset.page, 10);
      const pv = S.pageViews[num - 1];
      if (!pv) return;
      if (entry.isIntersecting) {
        S.visiblePages.add(num);
        renderPage(pv);
      } else {
        S.visiblePages.delete(num);
      }
    });
  }, {
    root: D.viewer,
    rootMargin: CFG.PRELOAD_MARGIN + ' 0px',
    threshold: 0
  });

  S.pageViews.forEach(pv => S.pageObserver.observe(pv.el));
}

/* --------------------------------------------------------------------------
   13. Layout / scaling
   -------------------------------------------------------------------------- */
function baseDimsFor(i) {
  const b = S.baseSizes[i] || { w: 612, h: 792 };
  const rot = ((S.rotation % 360) + 360) % 360;
  return (rot === 90 || rot === 270) ? { w: b.h, h: b.w } : { w: b.w, h: b.h };
}

function computeScale() {
  if (!S.doc) return 1;
  const b = baseDimsFor(0);
  const vw = D.viewer.clientWidth;
  const vh = D.viewer.clientHeight;
  const padX = parseFloat(getComputedStyle(D.pages).paddingLeft) || 0;
  const padY = parseFloat(getComputedStyle(D.pages).paddingTop) || 0;
  let availW = Math.max(80, vw - padX * 2 - 2);
  const availH = Math.max(80, vh - padY * 2 - 2);
  // spread (2-up): each page gets half the row so two fit side-by-side.
  // Row cost = 2*page + flex gap exactly (spread pages carry no margins).
  // A 4px safety haircut absorbs sub-pixel rounding so wrap never slips.
  if (S.spreadOn && S.continuous) availW = Math.max(80, (availW - (S.pageGap || 18)) / 2 - 2);

  if (S.scaleMode === 'fit-width') return clamp(availW / b.w, CFG.ZOOM_MIN, CFG.ZOOM_MAX);
  if (S.scaleMode === 'fit-page')  return clamp(Math.min(availW / b.w, availH / b.h), CFG.ZOOM_MIN, CFG.ZOOM_MAX);
  return clamp(S.scale, CFG.ZOOM_MIN, CFG.ZOOM_MAX);
}

function layout(keepPosition) {
  if (!S.doc) return;

  let anchor = null;
  if (keepPosition) anchor = getScrollAnchor();

  S.scale = computeScale();

  const gap = parseFloat(getComputedStyle(D.pages).gap) || 18;

  for (let i = 0; i < S.pageViews.length; i++) {
    const pv = S.pageViews[i];
    const d = baseDimsFor(i);
    const w = Math.round(d.w * S.scale);
    const h = Math.round(d.h * S.scale);
    pv.h = h;
    pv.el.style.width = w + 'px';
    pv.el.style.height = h + 'px';
    pv.el.style.setProperty('--scale-factor', S.scale);
    if (pv.canvas) {
      pv.canvas.style.width = w + 'px';
      pv.canvas.style.height = h + 'px';
    }
    if (pv.textLayer) {
      pv.textLayer.style.setProperty('--scale-factor', S.scale);
    }
    // Keep the annotation engine in sync: pv.viewport is the coordinate
    // space for marker + eraser. Recompute it synchronously from the
    // retained PDF page (cheap, no re-render) so strokes never drift
    // after zoom/rotate, then re-fit + redraw the overlay immediately.
    if (pv.page) {
      try {
        pv.viewport = pv.page.getViewport({ scale: S.scale, rotation: S.rotation });
      } catch (e) {}
    }
    if (pv.annot && pv.viewport) {
      const dpr = Math.min(window.devicePixelRatio || 1, CFG.DPR_MAX);
      const aw = Math.max(1, Math.floor(pv.viewport.width));
      const ah = Math.max(1, Math.floor(pv.viewport.height));
      if (pv.annot.width !== Math.floor(aw * dpr) || pv.annot.height !== Math.floor(ah * dpr)) {
        pv.annot.width = Math.floor(aw * dpr);
        pv.annot.height = Math.floor(ah * dpr);
      }
      pv.annot.style.width = aw + 'px';
      pv.annot.style.height = ah + 'px';
      drawAnnots(pv);
    }
  }

  // single page mode
  if (!S.continuous) {
    S.pageViews.forEach(pv => { pv.el.style.display = (pv.num === S.pageNum) ? '' : 'none'; });
  } else {
    S.pageViews.forEach(pv => { pv.el.style.display = ''; });
  }

  // cache offsets
  raf(() => {
    for (let i = 0; i < S.pageViews.length; i++) {
      S.pageViews[i].off = S.pageViews[i].el.offsetTop;
    }
    if (anchor) restoreScrollAnchor(anchor);
  });

  // invalidate rendered pages
  S.epoch++;
  for (let i = 0; i < S.pageViews.length; i++) {
    S.pageViews[i].rendered = false;
  }

  updateUI();
  updateStatusBar();
}

function getScrollAnchor() {
  const vr = D.viewer.getBoundingClientRect();
  const ref = vr.top + 8;
  for (let i = 0; i < S.pageViews.length; i++) {
    const r = S.pageViews[i].el.getBoundingClientRect();
    if (r.bottom > ref) {
      return { num: i + 1, ratio: (ref - r.top) / Math.max(1, r.height) };
    }
  }
  return { num: 1, ratio: 0 };
}
function restoreScrollAnchor(a) {
  const pv = S.pageViews[a.num - 1];
  if (!pv) return;
  const vr = D.viewer.getBoundingClientRect();
  const pr = pv.el.getBoundingClientRect();
  D.viewer.scrollTop += (pr.top - vr.top) - a.ratio * pr.height + 0;
}

/* --------------------------------------------------------------------------
   14. Page rendering
   -------------------------------------------------------------------------- */
async function renderPage(pv) {
  if (!S.doc || !pv) return;
  if (pv.rendered && pv.epoch === S.epoch) return;
  if (pv.rendering) return;

  pv.rendering = true;
  const myEpoch = S.epoch;

  try {
    const page = await S.doc.getPage(pv.num);
    if (myEpoch !== S.epoch || pv.rendering === false) { pv.rendering = false; retryRender(pv); return; }

    // snapshot scale/rotation: layout() may change S.* during our awaits —
    // the viewport, the CSS var and the epoch below must all agree.
    const scale = S.scale, rotation = S.rotation;
    const viewport = page.getViewport({ scale: scale, rotation: rotation });
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.DPR_MAX);
    pv.page = page;
    pv.viewport = viewport;

    // ---- canvas ----
    let canvas = pv.canvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'page-canvas';
      pv.el.insertBefore(canvas, pv.el.firstChild);
      pv.canvas = canvas;
    }
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (pv.task) { try { pv.task.cancel(); } catch (e) {} }
    const task = page.render({
      canvasContext: ctx,
      viewport: viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      intent: 'display'
    });
    pv.task = task;

    try { await task.promise; }
    catch (err) {
      if (!err || err.name !== 'RenderingCancelledException') console.warn(err);
      pv.rendering = false;
      retryRender(pv);
      return;
    }
    pv.task = null;

    if (myEpoch !== S.epoch) { pv.rendering = false; return; }

    // ---- text layer ----
    const textOk = await buildTextLayer(pv, page, viewport, myEpoch, scale);
    if (!textOk || myEpoch !== S.epoch) { pv.rendering = false; retryRender(pv); return; }

    // ---- link layer ----
    await buildLinkLayer(pv, page, viewport);

    pv.rendered = true;
    pv.epoch = myEpoch;
    pv.el.classList.add('rendered');

    // re-apply search highlight
    if (S.searchQuery) highlightInPage(pv, S.searchQuery);

    // (re)draw annotation overlay
    drawAnnots(pv);

    // update exact size if different
    const d = baseDimsFor(pv.num - 1);
    if (Math.abs(d.w * scale - viewport.width) > 2 || Math.abs(d.h * scale - viewport.height) > 2) {
      S.baseSizes[pv.num - 1] = { w: viewport.width / scale, h: viewport.height / scale };
    }

  } catch (err) {
    console.warn('render error page ' + pv.num, err);
  } finally {
    pv.rendering = false;
  }
}

/* A newer epoch means a newer render was requested (zoom/rotate/resize
   while this one was awaiting): re-queue once so the page never gets
   stuck showing a stale zoom level. Self-limiting — skips when current. */
function retryRender(pv) {
  if (!S.doc || !pv) return;
  setTimeout(() => {
    try {
      if (!S.doc || !pv || S.pageViews[pv.num - 1] !== pv) return;
      if (pv.rendered && pv.epoch === S.epoch) return;
      if (pv.rendering) return;
      renderPage(pv);
    } catch (e) {}
  }, 60);
}

async function buildTextLayer(pv, page, viewport, myEpoch, scale) {
  let container = pv.textLayer;
  if (!container) {
    container = document.createElement('div');
    container.className = 'textLayer';
    pv.el.appendChild(container);
    pv.textLayer = container;
  }
  container.innerHTML = '';
  container.style.width = viewport.width + 'px';
  container.style.height = viewport.height + 'px';

  try {
    const textContent = await page.getTextContent();
    // a layout() during the await above means a newer render owns this page now
    if (myEpoch !== undefined && myEpoch !== S.epoch) return false;
    // set the var from OUR snapshot right before pdf.js reads it — never S.scale here
    container.style.setProperty('--scale-factor', scale);
    const task = pdfjsLib.renderTextLayer({
      textContent: textContent,
      textContentSource: page.streamTextContent ? page.streamTextContent() : undefined,
      container: container,
      viewport: viewport,
      textDivs: [],
      enhanceTextSelection: false
    });
    if (task && task.promise) await task.promise;
    if (myEpoch !== undefined && myEpoch !== S.epoch) return false;
    return true;
  } catch (err) {
    // fallback: silent
    return myEpoch === undefined || myEpoch === S.epoch;
  }
}

async function buildLinkLayer(pv, page, viewport) {
  let layer = pv.linkLayer;
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'linkLayer';
    pv.el.appendChild(layer);
    pv.linkLayer = layer;
  }
  layer.innerHTML = '';
  layer.style.width = viewport.width + 'px';
  layer.style.height = viewport.height + 'px';

  try {
    const annots = await page.getAnnotations({ intent: 'display' });
    annots.forEach(a => {
      if (a.subtype !== 'Link') return;
      const rect = pdfjsLib.Util.normalizeRect(
        pdfjsLib.Util.transform(viewport.transform, a.rect)
      );
      const left = rect[0], top = rect[1];
      const w = rect[2] - rect[0], h = rect[3] - rect[1];
      if (w <= 0 || h <= 0) return;

      const link = document.createElement('a');
      link.style.left = left + 'px';
      link.style.top = top + 'px';
      link.style.width = w + 'px';
      link.style.height = h + 'px';

      if (a.url) {
        link.href = a.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = a.url;
      } else if (a.dest) {
        link.href = 'javascript:void(0)';
        link.title = 'Go to destination';
        link.addEventListener('click', e => {
          e.preventDefault();
          goToDestination(a.dest);
        });
      } else {
        return;
      }
      layer.appendChild(link);
    });
  } catch (e) { /* ignore */ }
}

function renderVisible(force) {
  if (!S.doc) return;
  S.visiblePages.forEach(n => {
    const pv = S.pageViews[n - 1];
    if (pv && (force || !pv.rendered || pv.epoch !== S.epoch)) renderPage(pv);
  });
}

/* --------------------------------------------------------------------------
   15. Page sizes (background pass)
   -------------------------------------------------------------------------- */
async function computeAllSizes() {
  if (S.sizesReady || !S.doc) return;
  const n = S.numPages;
  if (n > 800) { S.sizesReady = true; return; }

  const first = S.baseSizes[0];
  let chunkStart = 1;
  const CHUNK = 12;

  while (chunkStart <= n && S.doc) {
    const end = Math.min(n, chunkStart + CHUNK - 1);
    for (let i = chunkStart; i <= end; i++) {
      try {
        const p = await S.doc.getPage(i);
        const vp = p.getViewport({ scale: 1, rotation: 0 });
        const prev = S.baseSizes[i - 1];
        if (Math.abs(prev.w - vp.width) > 0.5 || Math.abs(prev.h - vp.height) > 0.5) {
          S.baseSizes[i - 1] = { w: vp.width, h: vp.height };
          const pv = S.pageViews[i - 1];
          if (pv && !pv.rendered) {
            const d = baseDimsFor(i - 1);
            pv.el.style.width = Math.round(d.w * S.scale) + 'px';
            pv.el.style.height = Math.round(d.h * S.scale) + 'px';
          }
        }
      } catch (e) { /* skip */ }
    }
    chunkStart = end + 1;
    await new Promise(r => setTimeout(r, 0));
  }
  S.sizesReady = true;
}

/* --------------------------------------------------------------------------
   16. Navigation
   -------------------------------------------------------------------------- */
function goToPage(n, smooth) {
  if (!S.doc) return;
  n = clamp(Math.round(n) || 1, 1, S.numPages);

  if (!S.continuous) {
    S.pageNum = n;
    S.pageViews.forEach(pv => { pv.el.style.display = (pv.num === n) ? '' : 'none'; });
    D.viewer.scrollTop = 0;
    const pv = S.pageViews[n - 1];
    if (pv) renderPage(pv);
  } else {
    const pv = S.pageViews[n - 1];
    if (pv) {
      const vr = D.viewer.getBoundingClientRect();
      const pr = pv.el.getBoundingClientRect();
      const top = D.viewer.scrollTop + (pr.top - vr.top) - 10;
      if (smooth) D.viewer.scrollTo({ top: top, behavior: 'smooth' });
      else D.viewer.scrollTop = top;
    }
    S.pageNum = n;
  }
  updateUI();
  updateStatusBar();
  updateThumbActive();
}

function nextPage() { if (S.doc && S.pageNum < S.numPages) goToPage(S.pageNum + 1); }
function prevPage() { if (S.doc && S.pageNum > 1) goToPage(S.pageNum - 1); }

async function goToDestination(dest) {
  if (!S.doc) return;
  try {
    let explicit = dest;
    if (typeof dest === 'string') explicit = await S.doc.getDestination(dest);
    if (!explicit) return;
    const idx = await S.doc.getPageIndex(explicit[0]);
    goToPage(idx + 1, true);
  } catch (e) { /* ignore */ }
}

/* --------------------------------------------------------------------------
   17. Scroll tracking
   -------------------------------------------------------------------------- */
const onScroll = throttleRaf(() => {
  if (!S.doc) return;
  const vr = D.viewer.getBoundingClientRect();
  const ref = vr.top + 60;

  let lo = 0, hi = S.pageViews.length - 1, found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const pv = S.pageViews[mid];
    const r = pv.el.getBoundingClientRect();
    if (r.top <= ref) { found = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  // spread (2-up): rows share tops and the last row can sit below the
  // scroll limit — track the row's most-visible page instead.
  if (S.spreadOn && S.continuous) {
    try {
      let bestH = -1;
      for (let i = 0; i < S.pageViews.length; i++) {
        const r = S.pageViews[i].el.getBoundingClientRect();
        const vis = Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top);
        if (vis > bestH) { bestH = vis; found = i; }
      }
    } catch (e) {}
  }
  const num = found + 1;
  if (num !== S.pageNum) {
    S.pageNum = num;
    updateUI();
    updateStatusBar();
    updateThumbActive();
  }
});
D.viewer.addEventListener('scroll', onScroll, { passive: true });

/* --------------------------------------------------------------------------
   18. UI sync
   -------------------------------------------------------------------------- */
function updateUI() {
  const has = !!S.doc;
  D.pageInput.disabled = !has;
  D.pageInput.value = has ? S.pageNum : 1;
  D.pageInput.max = S.numPages || 1;
  D.pageTotal.textContent = has ? S.numPages : '–';

  D.btnFirst.disabled = !has || S.pageNum <= 1;
  D.btnPrev.disabled  = !has || S.pageNum <= 1;
  D.btnNext.disabled  = !has || S.pageNum >= S.numPages;
  D.btnLast.disabled  = !has || S.pageNum >= S.numPages;

  D.btnZoomIn.disabled = !has;
  D.btnZoomOut.disabled = !has;
  D.btnZoomLabel.disabled = !has;
  D.btnFit.disabled = !has;
  D.btnRotate.disabled = !has;
  D.btnSearch.disabled = !has;
  D.btnAnnotate.disabled = !has;
  if (D.btnEdit) D.btnEdit.disabled = !has;
  if (D.btnBookmark) D.btnBookmark.disabled = !has;
  if (D.btnSpread) { D.btnSpread.disabled = !has; D.btnSpread.classList.toggle('on', !!S.spreadOn); }
  if (D.btnNight) D.btnNight.classList.toggle('on', (S.prefs.pageMode || 'off') !== 'off');

  const pct = Math.round(S.scale * 100) + '%';
  D.btnZoomLabel.textContent = has ? pct : '100%';
  D.sbZoom.textContent = has ? pct : '100%';
}

function updateStatusBar() {
  D.sbPage.textContent = S.doc ? (S.pageNum + ' / ' + S.numPages) : '–';
  D.sbMode.textContent = S.continuous ? 'Continuous' : 'Single page';
}

function updateThumbActive() {
  const nodes = D.thumbs.children;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].classList.toggle('active', (i + 1) === S.pageNum);
  }
}

/* --------------------------------------------------------------------------
   19. Zoom
   -------------------------------------------------------------------------- */
function setZoom(mode, value) {
  if (!S.doc) return;
  if (mode === 'custom') {
    S.scaleMode = 'custom';
    S.scale = clamp(value, CFG.ZOOM_MIN, CFG.ZOOM_MAX);
  } else {
    S.scaleMode = mode;
  }
  layout(true);
  renderVisible(true);
}
function zoomIn()  { setZoom('custom', S.scale * CFG.ZOOM_STEP); }
function zoomOut() { setZoom('custom', S.scale / CFG.ZOOM_STEP); }

/* --------------------------------------------------------------------------
   20. Rotation
   -------------------------------------------------------------------------- */
function rotate(dir) {
  if (!S.doc) return;
  S.rotation = ((S.rotation + dir * 90) % 360 + 360) % 360;
  layout(true);
  renderVisible(true);
  toast('Rotated ' + S.rotation + '°', null, 1200);
}

/* --------------------------------------------------------------------------
   21. Outline
   -------------------------------------------------------------------------- */
async function buildOutline() {
  D.outlineList.innerHTML = '';
  if (!S.doc) { D.outlineEmpty.hidden = false; return; }
  let outline = null;
  try { outline = await S.doc.getOutline(); } catch (e) {}
  S.outline = outline;

  if (!outline || !outline.length) {
    D.outlineEmpty.hidden = false;
    return;
  }
  D.outlineEmpty.hidden = true;
  D.outlineList.appendChild(buildOutlineItems(outline, 0));
}

function buildOutlineItems(items, depth) {
  const ul = document.createElement('ul');
  ul.className = 'outline-list' + (depth ? ' outline-children' : '');
  items.forEach(it => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'outline-item';
    row.innerHTML = '<svg class="ic"><use href="#i-chev-right"/></svg><span>' + esc(it.title || 'Untitled') + '</span>';
    row.addEventListener('click', () => {
      if (it.dest) goToDestination(it.dest);
      else if (it.url) window.open(it.url, '_blank', 'noopener');
    });
    li.appendChild(row);
    if (it.items && it.items.length) li.appendChild(buildOutlineItems(it.items, depth + 1));
    ul.appendChild(li);
  });
  return ul;
}

/* --------------------------------------------------------------------------
   22. Thumbnails
   -------------------------------------------------------------------------- */
function buildThumbnails() {
  D.thumbs.innerHTML = '';
  if (!S.doc) { D.thumbsEmpty.hidden = false; return; }
  D.thumbsEmpty.hidden = true;

  const frag = document.createDocumentFragment();
  for (let i = 1; i <= S.numPages; i++) {
    const t = document.createElement('div');
    t.className = 'thumb';
    t.dataset.page = i;
    t.innerHTML = '<div class="ph"></div><div class="num">' + i + '</div>';
    t.addEventListener('click', () => goToPage(i, true));
    frag.appendChild(t);
  }
  D.thumbs.appendChild(frag);

  if (S.thumbObserver) S.thumbObserver.disconnect();
  S.thumbObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        renderThumb(e.target);
        S.thumbObserver.unobserve(e.target);
      }
    });
  }, { root: D.thumbs.parentElement, rootMargin: '300px 0px' });

  $$('.thumb', D.thumbs).forEach(t => S.thumbObserver.observe(t));
  updateThumbActive();
}

async function renderThumb(el) {
  if (!S.doc || el.dataset.done) return;
  el.dataset.done = '1';
  const num = parseInt(el.dataset.page, 10);
  try {
    const page = await S.doc.getPage(num);
    const vp0 = page.getViewport({ scale: 1, rotation: S.rotation });
    const scale = CFG.THUMB_WIDTH / vp0.width;
    const vp = page.getViewport({ scale, rotation: S.rotation });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width * dpr);
    c.height = Math.floor(vp.height * dpr);
    c.style.width = '100%';
    c.style.height = 'auto';
    const ctx = c.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({
      canvasContext: ctx, viewport: vp,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
    }).promise;
    const ph = el.querySelector('.ph');
    if (ph) ph.replaceWith(c); else el.insertBefore(c, el.firstChild);
  } catch (e) { /* ignore */ }
}

/* --------------------------------------------------------------------------
   23. Search
   -------------------------------------------------------------------------- */
async function ensureSearchIndex() {
  if (S.searchIndex || S.indexing || !S.doc) return;
  S.indexing = true;
  setStatus('Building search index…', 'busy');
  const arr = new Array(S.numPages);
  for (let i = 1; i <= S.numPages; i++) {
    try {
      const p = await S.doc.getPage(i);
      const tc = await p.getTextContent();
      arr[i - 1] = tc.items.map(it => it.str).join(' ').replace(/\s+/g, ' ');
    } catch (e) { arr[i - 1] = ''; }
    if (i % 8 === 0) {
      showProgress((i / S.numPages) * 100);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  hideProgress();
  S.searchIndex = arr;
  S.indexing = false;
  setStatus('Ready', 'ok');
}

async function runSearch(q) {
  S.searchQuery = q;
  S.searchResults = [];
  S.searchCursor = -1;
  D.searchResults.innerHTML = '';

  if (!q || q.length < 1) {
    D.searchMeta.hidden = true;
    D.searchEmpty.hidden = false;
    D.searchEmpty.innerHTML = '<svg class="ic"><use href="#i-search"/></svg>Type to search across all pages';
    clearAllHighlights();
    return;
  }

  await ensureSearchIndex();
  if (!S.searchIndex) return;

  const results = [];
  const useWhole = !!S.searchWhole;
  const useCase = !!S.searchCase;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let i = 0; i < S.searchIndex.length && results.length < CFG.MAX_SEARCH_RESULTS; i++) {
    const text = S.searchIndex[i] || '';
    if (!useWhole) {
      const hay = useCase ? text : text.toLowerCase();
      const ndl = useCase ? q : q.toLowerCase();
      let idx = hay.indexOf(ndl);
      while (idx !== -1 && results.length < CFG.MAX_SEARCH_RESULTS) {
        results.push({ page: i + 1, index: idx, text: text });
        idx = hay.indexOf(ndl, idx + ndl.length);
      }
    } else {
      try {
        const re = new RegExp('\\b' + escRe(q) + '\\b', useCase ? 'g' : 'gi');
        let m;
        while ((m = re.exec(text)) && results.length < CFG.MAX_SEARCH_RESULTS) {
          results.push({ page: i + 1, index: m.index, text: text });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } catch (e) {
        const hay = useCase ? text : text.toLowerCase();
        const ndl = useCase ? q : q.toLowerCase();
        let idx = hay.indexOf(ndl);
        while (idx !== -1 && results.length < CFG.MAX_SEARCH_RESULTS) {
          results.push({ page: i + 1, index: idx, text: text });
          idx = hay.indexOf(ndl, idx + ndl.length);
        }
      }
    }
  }

  S.searchResults = results;
  D.searchEmpty.hidden = true;
  D.searchMeta.hidden = false;
  D.searchCount.textContent = results.length
    ? results.length + (results.length === CFG.MAX_SEARCH_RESULTS ? '+' : '') + ' result' + (results.length === 1 ? '' : 's')
    : 'No results';

  if (!results.length) {
    D.searchResults.innerHTML = '<div class="placeholder"><svg class="ic"><use href="#i-alert"/></svg>No matches found for “' + esc(q) + '”</div>';
    clearAllHighlights();
    return;
  }

  // build list
  const frag = document.createDocumentFragment();
  results.slice(0, 300).forEach((r, i) => {
    const start = Math.max(0, r.index - 45);
    const end = Math.min(r.text.length, r.index + q.length + 65);
    const before = r.text.slice(start, r.index);
    const match = r.text.slice(r.index, r.index + q.length);
    const after = r.text.slice(r.index + q.length, end);

    const div = document.createElement('div');
    div.className = 'result';
    div.dataset.idx = i;
    div.innerHTML =
      '<div class="r-top"><span class="badge">p. ' + r.page + '</span></div>' +
      '<div class="r-txt">' + (start > 0 ? '…' : '') + esc(before) +
      '<em>' + esc(match) + '</em>' + esc(after) + (end < r.text.length ? '…' : '') + '</div>';
    div.addEventListener('click', () => selectSearchResult(i));
    frag.appendChild(div);
  });
  D.searchResults.appendChild(frag);

  // highlight visible pages
  refreshHighlights();
}

function selectSearchResult(i) {
  const r = S.searchResults[i];
  if (!r) return;
  S.searchCursor = i;
  $$('.result', D.searchResults).forEach(el => el.classList.toggle('active', parseInt(el.dataset.idx, 10) === i));
  goToPage(r.page, true);
  setTimeout(() => {
    const pv = S.pageViews[r.page - 1];
    if (pv) { highlightInPage(pv, S.searchQuery, true); scrollToCurrentMark(pv); }
  }, 220);
}

function nextResult() {
  if (!S.searchResults.length) return;
  selectSearchResult((S.searchCursor + 1) % S.searchResults.length);
}
function prevResult() {
  if (!S.searchResults.length) return;
  selectSearchResult((S.searchCursor - 1 + S.searchResults.length) % S.searchResults.length);
}

function highlightInPage(pv, q, markCurrent) {
  if (!pv.textLayer || !q) return;
  const spans = pv.textLayer.querySelectorAll('span');
  const useCase = !!S.searchCase;
  const useWhole = !!S.searchWhole;
  const ndl = useCase ? q : q.toLowerCase();
  spans.forEach(sp => {
    if (sp.querySelector('mark')) sp.textContent = sp.textContent;
    const t = sp.textContent;
    if (!t) return;
    const hay = useCase ? t : t.toLowerCase();
    if (!useWhole) {
      let idx = hay.indexOf(ndl);
      if (idx === -1) return;
      let html = '', last = 0;
      while (idx !== -1) {
        html += esc(t.slice(last, idx));
        html += '<mark class="hl">' + esc(t.slice(idx, idx + ndl.length)) + '</mark>';
        last = idx + ndl.length;
        idx = hay.indexOf(ndl, last);
      }
      html += esc(t.slice(last));
      sp.innerHTML = html;
    } else {
      try {
        const re = new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', useCase ? 'g' : 'gi');
        if (!re.test(t)) return;
        re.lastIndex = 0;
        sp.innerHTML = esc(t).replace(re, m => '<mark class="hl">' + esc(m) + '</mark>');
      } catch (e) {
        let idx = hay.indexOf(ndl);
        if (idx === -1) return;
        let html = '', last = 0;
        while (idx !== -1) {
          html += esc(t.slice(last, idx));
          html += '<mark class="hl">' + esc(t.slice(idx, idx + ndl.length)) + '</mark>';
          last = idx + ndl.length;
          idx = hay.indexOf(ndl, last);
        }
        html += esc(t.slice(last));
        sp.innerHTML = html;
      }
    }
  });
}

function clearAllHighlights() {
  S.pageViews.forEach(pv => {
    if (!pv.textLayer) return;
    pv.textLayer.querySelectorAll('span').forEach(sp => {
      if (sp.querySelector('mark')) sp.textContent = sp.textContent;
    });
  });
}
function refreshHighlights() {
  if (!S.searchQuery) return;
  S.pageViews.forEach(pv => {
    if (pv.rendered && pv.textLayer) highlightInPage(pv, S.searchQuery);
  });
}
function scrollToCurrentMark(pv) {
  const mark = pv.textLayer && pv.textLayer.querySelector('mark.hl');
  if (!mark) return;
  const mr = mark.getBoundingClientRect();
  const vr = D.viewer.getBoundingClientRect();
  if (mr.top < vr.top + 60 || mr.bottom > vr.bottom - 60) {
    D.viewer.scrollTop += (mr.top - vr.top) - vr.height * 0.35;
  }
}

/* --------------------------------------------------------------------------
   24. Recent files
   -------------------------------------------------------------------------- */
async function saveRecent(name, size) {
  if (!S.file) return;
  try {
    const rec = {
      id: S.docId,
      name: name || S.file.name,
      size: size || S.file.size,
      pages: S.numPages,
      openedAt: Date.now(),
      blob: S.file,
      lastPage: S.pageNum
    };
    await IDB.put(rec);
    // prune to 20
    const all = await IDB.all();
    if (all.length > 20) {
      all.sort((a, b) => b.openedAt - a.openedAt);
      for (let i = 20; i < all.length; i++) await IDB.del(all[i].id);
    }
    renderRecent();
  } catch (e) { /* IDB unavailable — silently ignore */ }
}

async function updateRecentPage() {
  if (!S.docId) return;
  try {
    const all = await IDB.all();
    const rec = all.find(r => r.id === S.docId);
    if (rec) { rec.lastPage = S.pageNum; await IDB.put(rec); }
  } catch (e) {}
}

async function restoreLastPage() {
  if (!S.docId) return;
  try {
    const all = await IDB.all();
    const rec = all.find(r => r.id === S.docId);
    if (rec && rec.lastPage > 1 && rec.lastPage <= S.numPages) {
      setTimeout(() => {
        goToPage(rec.lastPage);
        toast('Resumed at page ' + rec.lastPage, null, 1800);
      }, 350);
    }
  } catch (e) {}
}

async function renderRecent() {
  let all = [];
  try { all = await IDB.all(); } catch (e) { all = []; }
  all.sort((a, b) => b.openedAt - a.openedAt);

  D.recentList.innerHTML = '';
  if (!all.length) { D.recentEmpty.hidden = false; return; }
  D.recentEmpty.hidden = true;

  const frag = document.createDocumentFragment();
  all.forEach(rec => {
    const row = document.createElement('div');
    row.className = 'recent-item';
    row.innerHTML =
      '<div class="ico"><svg class="ic"><use href="#i-file"/></svg></div>' +
      '<div class="meta">' +
        '<div class="nm">' + esc(rec.name) + '</div>' +
        '<div class="sub">' + rec.pages + ' pages · ' + fmtBytes(rec.size) + ' · ' + timeAgo(rec.openedAt) + '</div>' +
      '</div>' +
      '<button class="del" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';

    row.addEventListener('click', async (e) => {
      if (e.target.closest('.del')) return;
      const blob = rec.blob;
      if (!blob) { toast('File data missing', 'err'); return; }
      const f = new File([blob], rec.name, { type: 'application/pdf', lastModified: rec.openedAt });
      await loadFromFile(f);
    });
    row.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await IDB.del(rec.id);
      renderRecent();
    });
    frag.appendChild(row);
  });
  D.recentList.appendChild(frag);
}

/* --------------------------------------------------------------------------
   25. Open handlers
   -------------------------------------------------------------------------- */
function pickFile() { D.fileInput.click(); }

D.fileInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) loadFromFile(f);
  e.target.value = '';
});

D.btnOpen.addEventListener('click', pickFile);
$('#btnEmptyOpen').addEventListener('click', pickFile);

$('#btnEmptyUrl').addEventListener('click', () => {
  openModal({
    title: 'Open from URL',
    icon: 'i-globe',
    html:
      '<label class="field-label" for="urlField">PDF link</label>' +
      '<input class="pw-input" id="urlField" type="url" placeholder="https://example.com/file.pdf" spellcheck="false">' +
      '<p style="margin:12px 0 0;font-size:12px;color:var(--muted);line-height:1.5">' +
        'The server must allow cross-origin requests (CORS).</p>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="urlGo">Open</button>',
    onMount(m) {
      const inp = m.querySelector('#urlField');
      const go = () => {
        const v = inp.value.trim();
        if (!v) return;
        closeModal();
        loadFromUrl(v);
      };
      m.querySelector('#urlGo').addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  });
});

$('#btnEmptyDemo').addEventListener('click', () => {
  loadFromUrl('https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf', 'tracemonkey.pdf');
});

/* --------------------------------------------------------------------------
   26. Drag & drop
   -------------------------------------------------------------------------- */
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  e.preventDefault();
  dragDepth++;
  if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) {
    D.dropOverlay.classList.add('show');
  }
});
window.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', e => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) D.dropOverlay.classList.remove('show');
});
window.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  D.dropOverlay.classList.remove('show');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFromFile(f);
});

/* --------------------------------------------------------------------------
   27. Sidebar
   -------------------------------------------------------------------------- */
function toggleSidebar(force) {
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    const open = force !== undefined ? force : !D.sidebar.classList.contains('open');
    D.sidebar.classList.toggle('open', open);
    D.sideBackdrop.classList.toggle('show', open);
  } else {
    const collapsed = force !== undefined ? !force : !D.sidebar.classList.contains('collapsed');
    D.sidebar.classList.toggle('collapsed', collapsed);
    setTimeout(() => { layout(true); renderVisible(true); }, 240);
  }
}
D.btnSidebar.addEventListener('click', () => toggleSidebar());
D.sideBackdrop.addEventListener('click', () => toggleSidebar(false));

$$('.side-tab').forEach(tab => {
  tab.addEventListener('click', () => switchPane(tab.dataset.pane));
});
function switchPane(name) {
  $$('.side-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === name));
  $$('.side-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
  if (window.innerWidth <= 900) {
    D.sidebar.classList.add('open');
    D.sideBackdrop.classList.add('show');
  }
  if (name === 'search') setTimeout(() => D.searchInput.focus(), 60);
  if (name === 'recent') renderRecent();
}

/* --------------------------------------------------------------------------
   28. Search wiring
   -------------------------------------------------------------------------- */
const doSearch = debounce(() => runSearch(D.searchInput.value.trim()), 260);
D.searchInput.addEventListener('input', () => {
  const has = D.searchInput.value.length > 0;
  D.searchBox.classList.toggle('has', has);
  doSearch();
});
D.searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prevResult() : nextResult(); }
  if (e.key === 'Escape') { D.searchInput.value = ''; D.searchBox.classList.remove('has'); runSearch(''); }
});
D.searchClear.addEventListener('click', () => {
  D.searchInput.value = '';
  D.searchBox.classList.remove('has');
  runSearch('');
  D.searchInput.focus();
});
D.searchPrev.addEventListener('click', prevResult);
D.searchNext.addEventListener('click', nextResult);

/* --------------------------------------------------------------------------
   29. Recent wiring
   -------------------------------------------------------------------------- */
D.btnClearRecent.addEventListener('click', async () => {
  try { await IDB.clear(); } catch (e) {}
  renderRecent();
  toast('Recent list cleared', 'ok', 1600);
});

/* --------------------------------------------------------------------------
   30. Toolbar wiring
   -------------------------------------------------------------------------- */
D.btnFirst.addEventListener('click', () => goToPage(1, true));
D.btnPrev.addEventListener('click', prevPage);
D.btnNext.addEventListener('click', nextPage);
D.btnLast.addEventListener('click', () => goToPage(S.numPages, true));

D.pageInput.addEventListener('change', () => goToPage(parseInt(D.pageInput.value, 10)));
D.pageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); goToPage(parseInt(D.pageInput.value, 10)); D.pageInput.blur(); }
  if (e.key === 'Escape') { D.pageInput.value = S.pageNum; D.pageInput.blur(); }
});

D.btnZoomIn.addEventListener('click', zoomIn);
D.btnZoomOut.addEventListener('click', zoomOut);

D.btnZoomLabel.addEventListener('click', () => {
  const presets = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const items = presets.map(p => ({
    icon: 'i-actual',
    text: Math.round(p * 100) + '%',
    checked: S.scaleMode === 'custom' && Math.abs(S.scale - p) < 0.005,
    action: () => setZoom('custom', p)
  }));
  items.push({ sep: true });
  items.push({ icon: 'i-fit-w', text: 'Fit width', checked: S.scaleMode === 'fit-width', action: () => setZoom('fit-width') });
  items.push({ icon: 'i-fit-p', text: 'Fit page', checked: S.scaleMode === 'fit-page', action: () => setZoom('fit-page') });
  items.push({ icon: 'i-actual', text: 'Actual size (100%)', action: () => setZoom('custom', 1) });
  items.push({ sep: true });
  items.push({ icon: 'i-zoom-in', text: 'Zoom in', kbd: '+', action: zoomIn });
  items.push({ icon: 'i-zoom-out', text: 'Zoom out', kbd: '−', action: zoomOut });
  openMenu(D.btnZoomLabel, items);
});

D.btnFit.addEventListener('click', () => setZoom('fit-width'));
D.btnRotate.addEventListener('click', () => rotate(1));
D.btnAnnotate.addEventListener('click', () => toggleAnnotate());
D.btnTheme.addEventListener('click', () => Theme.toggle());

D.btnSearch.addEventListener('click', () => {
  switchPane('search');
  setTimeout(() => D.searchInput.focus(), 80);
});

/* --------------------------------------------------------------------------
   31. Main menu
   -------------------------------------------------------------------------- */
D.btnMenu.addEventListener('click', () => {
  const has = !!S.doc;
  const items = [
    { label: 'File' },
    { icon: 'i-folder', text: 'Open PDF…', kbd: 'Ctrl O', action: pickFile },
    { icon: 'i-globe', text: 'Open from URL…', action: () => $('#btnEmptyUrl').click() },
    { icon: 'i-download', text: 'Save a copy', kbd: 'Ctrl S', disabled: !has, action: downloadFile },
    { icon: 'i-save', text: 'Save with annotations', disabled: !has, action: exportAnnotated },
    { icon: 'i-printer', text: 'Print', kbd: 'Ctrl P', disabled: !has, action: printFile },
    { icon: 'i-copy', text: 'Copy file name', disabled: !has, action: copyName },
    { icon: 'i-x', text: 'Close document', disabled: !has, action: closeDocument },
    { sep: true },
    { label: 'View' },
    { icon: 'i-layout', text: 'Continuous scroll', checked: S.continuous, disabled: !has, action: () => setMode(true) },
    { icon: 'i-file', text: 'Single page', checked: !S.continuous, disabled: !has, action: () => setMode(false) },
    { icon: 'i-fit-w', text: 'Fit width', checked: S.scaleMode === 'fit-width', disabled: !has, action: () => setZoom('fit-width') },
    { icon: 'i-fit-p', text: 'Fit page', checked: S.scaleMode === 'fit-page', disabled: !has, action: () => setZoom('fit-page') },
    { icon: 'i-rotate-ccw', text: 'Rotate left', disabled: !has, action: () => rotate(-1) },
    { icon: 'i-rotate-cw', text: 'Rotate right', disabled: !has, action: () => rotate(1) },
    { icon: 'i-refresh', text: 'Reset rotation', disabled: !has, action: () => { S.rotation = 0; layout(true); renderVisible(true); } },
    { icon: 'i-columns', text: 'Two-page spread', kbd: 'G', checked: !!(typeof S !== 'undefined' && S.spreadOn), disabled: !has, action: () => { if (typeof toggleSpread === 'function') toggleSpread(); } },
    { sep: true },
    { label: 'Tools' },
    { icon: 'i-search', text: 'Search in document', kbd: 'Ctrl F', disabled: !has, action: () => D.btnSearch.click() },
    { icon: 'i-pen', text: 'Annotate: draw & mark', kbd: 'A', disabled: !has, action: () => toggleAnnotate() },
    { icon: 'i-highlighter', text: 'Marker tools (H / U / S)', disabled: !has, action: () => { toggleAnnotate(true); setAnnotTool('highlight'); } },
    { icon: 'i-textsel', text: 'Select text to highlight (H)', disabled: !has, action: () => { if (selHasTextInDoc()) convertSelectionToHighlight(true, 'highlight'); else { toggleAnnotate(true); setAnnotTool('textsel'); } } },
    { icon: 'i-eraser', text: 'Erase embedded annotations', disabled: !has, action: () => { if (typeof removeEmbeddedAnnots === 'function') removeEmbeddedAnnots(); } },
    { icon: 'i-layers', text: 'PDF Edit studio (merge, split…) ', kbd: 'E', disabled: !has, action: () => { if (typeof openEditPane === 'function') openEditPane(); } },
    { icon: 'i-copy', text: 'Duplicate pages', disabled: !has, action: () => { if (typeof duplicateSelected === 'function') duplicateSelected(); } },
    { icon: 'i-refresh', text: 'Reverse page order', disabled: !has, action: () => { if (typeof reversePages === 'function') reversePages(); } },
    { icon: 'i-first', text: 'Move selected to start/end', disabled: !has, action: () => { if (typeof openEditPane === 'function') openEditPane(); } },
    { icon: 'i-scissors', text: 'Keep only selected', disabled: !has, action: () => { if (typeof keepOnlySelected === 'function') keepOnlySelected(); } },
    { icon: 'i-split', text: 'Split by range…', disabled: !has, action: () => { if (typeof openEditPane === 'function') openEditPane(); } },
    { icon: 'i-split', text: 'Split each page', disabled: !has, action: () => { if (typeof splitEachPage === 'function') splitEachPage(); } },
    { icon: 'i-text', text: 'Add page numbers', disabled: !has, action: () => { if (typeof addPageNumbers === 'function') addPageNumbers(); } },
    { icon: 'i-text', text: 'Header / footer…', disabled: !has, action: () => { if (typeof openEditPane === 'function') openEditPane(); } },
    { icon: 'i-info', text: 'Edit metadata…', disabled: !has, action: () => { if (typeof openEditPane === 'function') openEditPane(); } },
    { icon: 'i-file', text: 'Export .TXT', disabled: !has, action: () => { if (typeof exportTXT === 'function') exportTXT(); } },
    { icon: 'i-chart', text: 'Word count', disabled: !has, action: () => { if (typeof wordCountStats === 'function') wordCountStats(false); } },
    { icon: 'i-search', text: 'Export search results', disabled: !has, action: () => { if (typeof exportSearchResults === 'function') exportSearchResults(); } },
    { icon: 'i-star', text: 'Bookmark this page', kbd: 'D', disabled: !has, action: () => { if (typeof toggleBookmark === 'function') toggleBookmark(); } },
    { icon: 'i-eye-dim', text: 'Night / sepia pages', kbd: 'N', action: () => { if (typeof cyclePageMode === 'function') cyclePageMode(); } },
    { icon: 'i-scroll', text: 'Auto-scroll', disabled: !has, action: () => { if (typeof toggleAuto === 'function') toggleAuto(); } },
    { icon: 'i-merge', text: 'Merge PDFs…', action: () => { if (typeof startMerge === 'function') startMerge(); } },
    { icon: 'i-image', text: 'Export page as PNG', disabled: !has, action: () => { if (typeof exportPagePNG === 'function') exportPagePNG(); } },
    { icon: 'i-share', text: 'Share file', disabled: !has, action: () => { if (typeof shareFile === 'function') shareFile(); } },
    { icon: 'i-volume', text: 'Read page aloud', disabled: !has, action: toggleSpeak },
    { icon: 'i-copy', text: 'Copy page text', kbd: 'C', disabled: !has, action: copyPageText },
    { icon: 'i-copy', text: 'Copy entire document text', disabled: !has, action: () => { if (typeof copyAllText === 'function') copyAllText(); } },
    { icon: 'i-maximize', text: 'Fullscreen', kbd: 'F11', action: toggleFullscreen },
    { icon: 'i-play', text: 'Presentation mode', disabled: !has, action: togglePresent },
    { icon: 'i-grid', text: 'Toggle sidebar', kbd: 'Ctrl B', action: () => toggleSidebar() },
    { sep: true },
    { label: 'Appearance' },
    { icon: 'i-palette', text: 'Light theme', checked: Theme.currentResolved() === 'light', action: () => Theme.set('light') },
    { icon: 'i-moon', text: 'Dark theme', checked: Theme.currentResolved() === 'dark', action: () => Theme.set('dark') },
    { icon: 'i-smartphone', text: 'Match system', checked: Theme.mode === 'system', action: () => Theme.set('system') },
    { sep: true },
    { label: 'Information' },
    { icon: 'i-info', text: 'Document properties', disabled: !has, action: showProperties },
    { icon: 'i-keyboard', text: 'Keyboard shortcuts', kbd: '?', action: showShortcuts },
    { icon: 'i-shield', text: 'About Heros PDF', action: showAbout }
  ];
  openMenu(D.btnMenu, items);
});

function setMode(continuous) {
  S.continuous = continuous;
  D.sbMode.textContent = continuous ? 'Continuous' : 'Single page';
  layout(false);
  if (!continuous) {
    S.pageViews.forEach(pv => { pv.el.style.display = (pv.num === S.pageNum) ? '' : 'none'; });
    D.viewer.scrollTop = 0;
    const pv = S.pageViews[S.pageNum - 1];
    if (pv) renderPage(pv);
  } else {
    D.viewer.scrollTop = 0;
    renderVisible(true);
  }
}

function downloadFile() {
  if (!S.file && !S.blobUrl) return;
  const url = S.blobUrl || URL.createObjectURL(S.file);
  const a = document.createElement('a');
  a.href = url;
  a.download = (S.file && S.file.name) || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Downloading…', 'ok', 1600);
}

function copyName() {
  const n = (S.file && S.file.name) || S.title;
  if (!n) return;
  navigator.clipboard && navigator.clipboard.writeText(n)
    .then(() => toast('File name copied', 'ok', 1500))
    .catch(() => toast('Could not copy', 'err', 1800));
}

function printFile() {
  if (!S.blobUrl) return;
  toast('Preparing print…', null, 1500);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  iframe.src = S.blobUrl;
  iframe.onload = function () {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      window.open(S.blobUrl, '_blank');
    }
    setTimeout(() => iframe.remove(), 90000);
  };
  document.body.appendChild(iframe);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    (document.documentElement.requestFullscreen || function () {}).call(document.documentElement)
      .catch(() => toast('Fullscreen unavailable', 'err', 1800));
  } else {
    document.exitFullscreen();
  }
}

function togglePresent() {
  document.body.classList.toggle('present');
  const on = document.body.classList.contains('present');
  if (on) {
    setMode(false);
    setZoom('fit-page');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    toast('Presentation mode — press Esc to exit', null, 2600);
  } else {
    setMode(true);
    if (document.fullscreenElement) document.exitFullscreen();
    setTimeout(() => { layout(true); renderVisible(true); }, 100);
  }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('present')) {
    document.body.classList.remove('present');
    setMode(true);
    setTimeout(() => { layout(true); renderVisible(true); }, 100);
  }
});

/* --------------------------------------------------------------------------
   32. Info dialogs
   -------------------------------------------------------------------------- */
function showProperties() {
  if (!S.doc) return;
  const p = S.props || {};
  const rows = [
    ['Title', p.Title || S.title || '—'],
    ['Author', p.Author || '—'],
    ['Subject', p.Subject || '—'],
    ['Keywords', p.Keywords || '—'],
    ['Creator', p.Creator || '—'],
    ['Producer', p.Producer || '—'],
    ['PDF version', p.PDFFormatVersion || '—'],
    ['Created', fmtDate(p.CreationDate)],
    ['Modified', fmtDate(p.ModDate)],
    ['Pages', String(S.numPages)],
    ['File size', fmtBytes(S.file ? S.file.size : 0)],
    ['File name', (S.file && S.file.name) || '—'],
    ['Encrypted', p.IsEncrypted ? 'Yes' : 'No'],
    ['Linearized', p.IsLinearized ? 'Yes' : 'No']
  ];
  openModal({
    title: 'Document properties',
    icon: 'i-info',
    html: '<div>' + rows.map(r =>
      '<div class="prop-row"><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div></div>'
    ).join('') + '</div>'
  });
}

function showShortcuts() {
  const groups = [
    ['Navigation', [
      ['Next page', ['→', 'PgDn']],
      ['Previous page', ['←', 'PgUp']],
      ['First page', ['Home']],
      ['Last page', ['End']],
      ['Jump to page', ['Ctrl', 'G']]
    ]],
    ['Zoom', [
      ['Zoom in', ['+']],
      ['Zoom out', ['−']],
      ['Reset zoom', ['Ctrl', '0']],
      ['Fit width', ['Ctrl', '1']],
      ['Fit page', ['Ctrl', '2']]
    ]],
    ['File', [
      ['Open PDF', ['Ctrl', 'O']],
      ['Save copy', ['Ctrl', 'S']],
      ['Print', ['Ctrl', 'P']]
    ]],
    ['Annotate', [
      ['Toggle annotate tools', ['A']],
      ['Select', ['V']],
      ['Highlighter', ['H']],
      ['Highlight selected text', ['H', 'with', 'selection']],
      ['Select text to highlight', ['toolbar']],
      ['Underline selection', ['U', 'with', 'selection']],
      ['Underline', ['U']],
      ['Strikethrough', ['S']],
      ['Pen', ['P']],
      ['Text note', ['T']],
      ['Eraser (strokes)', ['E']],
      ['Erase embedded annotations', ['Marks', 'Erase', 'embedded']],
      ['Undo stroke', ['Ctrl', 'Z']],
      ['Redo stroke', ['Ctrl', 'Shift', 'Z']],
      ['Copy page text', ['C']],
      ['Copy selected text', ['C', 'with', 'selection']]
    ]],
    ['Edit studio', [
      ['Open Edit studio', ['E']],
      ['Duplicate pages', ['Edit', 'Select', 'Duplicate']],
      ['Split by range', ['Edit', 'Range', 'Split']],
      ['Word count / .TXT', ['Edit', 'TXT']]
    ]],
    ['Organize', [
      ['Bookmark this page', ['D']],
      ['Night / sepia pages', ['N']],
      ['Two-page spread', ['G']],
      ['Search next (in box)', ['Enter']],
      ['Search prev (in box)', ['Shift', 'Enter']]
    ]],
    ['Interface', [
      ['Search', ['Ctrl', 'F']],
      ['Toggle sidebar', ['Ctrl', 'B']],
      ['Fullscreen', ['F11']],
      ['Close dialog', ['Esc']],
      ['This help', ['?']]
    ]]
  ];

  let html = '';
  groups.forEach(g => {
    html += '<div class="menu-label" style="padding-left:0">' + esc(g[0]) + '</div>';
    html += '<div class="kbd-grid" style="margin-bottom:16px">';
    g[1].forEach(row => {
      html += '<div class="k-label">' + esc(row[0]) + '</div><div class="kbd-row">' +
        row[1].map(k => '<kbd>' + esc(k) + '</kbd>').join('') + '</div>';
    });
    html += '</div>';
  });

  openModal({ title: 'Keyboard shortcuts', icon: 'i-keyboard', html: html });
}

function showAbout() {
  openModal({
    title: 'About Heros PDF',
    icon: 'i-shield',
    html:
      '<div style="text-align:center;padding:8px 0 18px">' +
        '<img src="icons/logo.png" alt="Heros PDF logo" style="width:64px;height:64px;margin:0 auto 14px;' +
        'border-radius:18px;display:block;box-shadow:0 12px 28px -10px var(--accent-ring)">' +
        '<h3 style="margin:0 0 4px;font-size:18px">Heros PDF</h3>' +
        '<p style="margin:0;color:var(--muted);font-size:13px">Version 2.3 · Built with PDF.js</p>' +
      '</div>' +
      '<div class="prop-row"><div class="k">Engine</div><div class="v">PDF.js 3.11.174</div></div>' +
      '<div class="prop-row"><div class="k">Editor engine</div><div class="v">pdf-lib (annotations export)</div></div>' +
      '<div class="prop-row"><div class="k">Storage</div><div class="v">IndexedDB (local only)</div></div>' +
      '<div class="prop-row"><div class="k">Privacy</div><div class="v">No uploads · no analytics · no tracking</div></div>' +
      '<div class="prop-row"><div class="k">Offline</div><div class="v">Fully offline — PDF.js is bundled locally</div></div>' +
      '<div class="prop-row"><div class="k">License</div><div class="v">Free to use and modify</div></div>'
  });
}

/* --------------------------------------------------------------------------
   33. Keyboard
   -------------------------------------------------------------------------- */
document.addEventListener('keydown', e => {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  const mod = e.ctrlKey || e.metaKey;

  // Global shortcuts (work even while typing if modifier)
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); pickFile(); return; }
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); if (S.doc) D.btnSearch.click(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (S.doc) downloadFile(); return; }
  if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); if (S.doc) printFile(); return; }
  if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); return; }
  if (mod && e.key.toLowerCase() === 'z' && !typing && S.doc) {
    e.preventDefault();
    if (e.shiftKey) annotRedo(); else annotUndo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y' && !typing && S.doc) { e.preventDefault(); annotRedo(); return; }

  if (e.key === 'Escape') {
    if (S.speaking) { stopSpeaking(); toast('Stopped reading', null, 1400); }
    if (D.selBar && !D.selBar.hidden) {
      try { window.getSelection().removeAllRanges(); } catch (err) {}
      hideSelBar(); return;
    }
    if (modalCloseCb || D.modalBackdrop.classList.contains('show')) { closeModal(); return; }
    if (menuOpen) { closeMenu(); return; }
    if (S.annotMode && S.tool !== 'select') { setAnnotTool('select'); return; }
    if (S.annotMode) { toggleAnnotate(false); return; }
    if (document.body.classList.contains('present')) { togglePresent(); return; }
    if (window.innerWidth <= 900 && D.sidebar.classList.contains('open')) { toggleSidebar(false); return; }
    return;
  }

  if (typing) return;

  if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }
  if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleAnnotate(); return; }
  if (!S.doc) return;

  if (e.key === 'v' || e.key === 'V') { setAnnotTool('select'); if (!S.annotMode) toggleAnnotate(true); return; }
  if (e.key === 'h' || e.key === 'H') {
    if (selHasTextInDoc()) { e.preventDefault(); convertSelectionToHighlight(true, 'highlight'); return; }
    if (!S.annotMode) toggleAnnotate(true); setAnnotTool('highlight'); return;
  }
  if (e.key === 'p' || e.key === 'P') { if (!S.annotMode) toggleAnnotate(true); setAnnotTool('pen'); return; }
  if (e.key === 't' || e.key === 'T') { if (!S.annotMode) toggleAnnotate(true); setAnnotTool('text'); return; }
  if ((e.key === 'e' || e.key === 'E') && S.annotMode) { setAnnotTool('eraser'); return; }
  if (e.key === 'c' || e.key === 'C') {
    if (selHasTextInDoc()) { e.preventDefault(); copySelectionText(); return; }
    copyPageText(); return;
  }

  if (mod && e.key === '0') { e.preventDefault(); setZoom('custom', 1); return; }
  if (mod && e.key === '1') { e.preventDefault(); setZoom('fit-width'); return; }
  if (mod && e.key === '2') { e.preventDefault(); setZoom('fit-page'); return; }
  if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); D.pageInput.focus(); D.pageInput.select(); return; }

  switch (e.key) {
    case 'ArrowRight': case 'PageDown': e.preventDefault(); nextPage(); break;
    case 'ArrowLeft':  case 'PageUp':   e.preventDefault(); prevPage(); break;
    case 'ArrowDown':  if (!S.continuous) { e.preventDefault(); nextPage(); } break;
    case 'ArrowUp':    if (!S.continuous) { e.preventDefault(); prevPage(); } break;
    case 'Home': e.preventDefault(); goToPage(1, true); break;
    case 'End':  e.preventDefault(); goToPage(S.numPages, true); break;
    case '+': case '=': e.preventDefault(); zoomIn(); break;
    case '-': case '_': e.preventDefault(); zoomOut(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'r': case 'R': rotate(e.shiftKey ? -1 : 1); break;
  }
});

/* --------------------------------------------------------------------------
   33b. Annotation studio — draw, highlight, mark & edit
   Strokes are stored in PDF user-space points (rotation/zoom independent)
   via viewport.convertToPdfPoint / convertToViewportPoint.
   -------------------------------------------------------------------------- */
let annotSaveTimer = null;

function pageStrokes(n) {
  if (!S.annots[n]) S.annots[n] = [];
  return S.annots[n];
}
function makeStrokeId() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
/* straight two-point tools (click-drag, not freehand) */
const SHAPE_TOOLS = ['line', 'rect', 'ellipse', 'underline', 'strike', 'arrow', 'redact'];
function widthForTool(tool, sizePx, scale) {
  if (tool === 'highlight') return Math.max(sizePx, 10) / scale;
  if (tool === 'underline') return Math.max(sizePx, 8) / scale;
  if (tool === 'strike') return Math.max(2.5, sizePx * 0.45) / scale;
  return sizePx / scale;
}
function effOp(st) {
  // per-stroke snapshot wins (textsel marks), else the live global slider
  if (st && typeof st.opacity === 'number' && st.opacity >= 0 && st.opacity <= 1) return st.opacity;
  return (typeof S.annotOpacity === 'number' && S.annotOpacity > 0) ? S.annotOpacity : 1;
}
function strokeAlpha(tool, st) {
  const op = effOp(st);
  if (tool === 'highlight' || tool === 'underline' || tool === 'texthl') return 0.45 * op;
  if (tool === 'strike') return 0.85 * op;
  return op;
}
function paintArrowHead(ctx, a, b, wPx) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const hl = Math.max(10, 8 + wPx * 1.4);
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - hl * Math.cos(ang - 0.5), b[1] - hl * Math.sin(ang - 0.5));
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - hl * Math.cos(ang + 0.5), b[1] - hl * Math.sin(ang + 0.5));
}

async function loadAnnots() {
  S.annots = {};
  S.undoStack = [];
  S.redoStack = [];
  if (!S.docId) return;
  try {
    const rec = await ANN.get(S.docId);
    if (rec && rec.pages) S.annots = rec.pages;
  } catch (e) {}
}
function saveAnnotsNow() {
  if (!S.docId) return;
  try {
    ANN.put({ id: S.docId, updatedAt: Date.now(), pages: S.annots });
    ANN.prune();
  } catch (e) {}
}
function saveAnnotsSoon() {
  clearTimeout(annotSaveTimer);
  annotSaveTimer = setTimeout(saveAnnotsNow, 800);
}

/* ---------- overlay layer ---------- */
function ensureAnnotLayer(pv) {
  if (!pv || !pv.viewport) return null;
  let c = pv.annot;
  if (!c) {
    c = document.createElement('canvas');
    c.className = 'annot-layer';
    pv.el.appendChild(c);
    pv.annot = c;
    attachAnnotHandlers(pv);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, CFG.DPR_MAX);
  const w = Math.max(1, Math.floor(pv.viewport.width));
  const h = Math.max(1, Math.floor(pv.viewport.height));
  if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
  }
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  return c;
}

function drawStrokes(ctx, viewport, strokes) {
  const dpr = Math.min(window.devicePixelRatio || 1, CFG.DPR_MAX);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  (strokes || []).forEach(st => {
    if (!st || !st.pts || !st.pts.length) return;
    const pts = st.pts.map(p => {
      try { return viewport.convertToViewportPoint(p[0], p[1]); }
      catch (e) { return [0, 0]; }
    });
    if (st.tool === 'text') {
      ctx.save();
      ctx.globalAlpha = strokeAlpha('pen', st);
      ctx.fillStyle = st.color || '#111418';
      const fs = Math.max(6, (st.sizePt || 16) * viewport.scale);
      ctx.font = '500 ' + fs + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.textBaseline = 'top';
      const lines = String(st.text || '').split('\n');
      lines.forEach((ln, i) => ctx.fillText(ln, pts[0][0], pts[0][1] + i * fs * 1.25));
      ctx.restore();
      return;
    }
    if (st.tool === 'texthl' && pts.length >= 4) {
      // text-selection highlight: filled quad (order: TL, TR, BR, BL)
      ctx.save();
      ctx.globalAlpha = strokeAlpha('texthl', st);
      ctx.fillStyle = st.color || '#ffd400';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let q = 1; q < 4; q++) ctx.lineTo(pts[q][0], pts[q][1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    const wPx = Math.max(1, (st.widthPdf || 3) * viewport.scale);
    ctx.save();
    ctx.globalAlpha = strokeAlpha(st.tool, st);
    ctx.strokeStyle = st.color || '#ffd400';
    ctx.fillStyle = st.color || '#ffd400';
    ctx.lineWidth = wPx;
    ctx.beginPath();
    if ((st.tool === 'line' || st.tool === 'underline' || st.tool === 'strike') && pts.length >= 2) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    } else if (st.tool === 'arrow' && pts.length >= 2) {
      paintArrowHead(ctx, pts[0], pts[pts.length - 1], wPx);
    } else if (st.tool === 'rect' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    } else if (st.tool === 'ellipse' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
        Math.max(1, Math.abs(b[0] - a[0]) / 2), Math.max(1, Math.abs(b[1] - a[1]) / 2), 0, 0, Math.PI * 2);
    } else if (st.tool === 'redact' && pts.length >= 2) {
      // opaque black-out box — always fully opaque so nothing shows through
      const a = pts[0], b = pts[pts.length - 1];
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111418';
      ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      ctx.restore();
      ctx.restore();
      return;
    } else {
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      if (pts.length === 1) {
        ctx.arc(pts[0][0], pts[0][1], wPx / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
    }
    ctx.stroke();
    // arrow head
    if (st.tool === 'arrow' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const hs = Math.max(8, wPx * 2.4);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - hs * Math.cos(ang - 0.42), b[1] - hs * Math.sin(ang - 0.42));
      ctx.lineTo(b[0] - hs * Math.cos(ang + 0.42), b[1] - hs * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawAnnots(pv, preview) {
  if (!pv) return;
  const strokes = pageStrokes(pv.num);
  const want = S.annotMode || strokes.length > 0 || !!preview;
  if (!want || !pv.viewport) {
    if (pv.annot && strokes.length === 0 && !S.annotMode && !preview) {
      const ctx = pv.annot.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, pv.annot.width, pv.annot.height);
    }
    return;
  }
  const c = ensureAnnotLayer(pv);
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const all = preview ? strokes.concat([preview]) : strokes;
  drawStrokes(ctx, pv.viewport, all);
}

function redrawAllAnnots() {
  S.pageViews.forEach(pv => {
    if (pv.rendered) drawAnnots(pv);
    else if (S.annotMode && pv.viewport) drawAnnots(pv);
  });
}

/* ---------- pointer drawing ---------- */
function annotPoint(pv, e) {
  const c = pv.annot;
  const r = c.getBoundingClientRect();
  const x = (e.clientX - r.left) * (pv.viewport.width / Math.max(1, r.width));
  const y = (e.clientY - r.top) * (pv.viewport.height / Math.max(1, r.height));
  return pv.viewport.convertToPdfPoint(x, y);
}

function attachAnnotHandlers(pv) {
  const c = pv.annot;
  let drawing = null;   // in-progress stroke
  let lastPt = null;

  c.addEventListener('pointerdown', e => {
    if (!S.annotMode || S.tool === 'select') return;
    // Mouse: left button only. Touch/pen: any primary contact (some
    // browsers report button -1 for touch or 5 for pen-barrel press).
    if (e.pointerType === 'mouse' ? e.button !== 0 : e.isPrimary === false) return;
    e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch (err) {}
    // eraser first: it needs no PDF point, so a missing layer/view can never block it
    if (S.tool === 'eraser') {
      try {
        eraseAt(pv, e);
      } catch (err) {
        console.warn('eraser', err);
        toast('Eraser hiccup — try again', 'err', 1500);
      }
      drawing = { erase: true };
      return;
    }
    let pt;
    try {
      pt = annotPoint(pv, e);
    } catch (err) {
      console.warn('stroke point', err);
      toast('Could not start stroke — try again', 'err', 1500);
      return;
    }

    if (S.tool === 'text') {
      drawing = null;
      askTextAnnot(pv, pt);
      return;
    }
    drawing = {
      id: makeStrokeId(),
      tool: S.tool,
      color: S.tool === 'redact' ? '#111418' : S.annotColor,
      widthPdf: widthForTool(S.tool, S.annotSize, S.scale),
      pts: [pt]
    };
    lastPt = pt;
    drawAnnots(pv, drawing);
  });

  c.addEventListener('pointermove', e => {
    if (!drawing) return;
    try {
      if (drawing.erase) { eraseAt(pv, e); return; }
      const pt = annotPoint(pv, e);
      if (drawing.tool === 'pen' || drawing.tool === 'highlight' || drawing.tool === 'underline' || drawing.tool === 'strike') {
        const dx = pt[0] - lastPt[0], dy = pt[1] - lastPt[1];
        if (Math.hypot(dx, dy) * S.scale < 1.5) return;  // thin out points
        drawing.pts.push(pt);
        lastPt = pt;
      } else {
        drawing.pts = [drawing.pts[0], pt];
      }
      drawAnnots(pv, drawing);
    } catch (err) {
      console.warn('draw move', err);
    }
  });

  function finish(e) {
    if (!drawing) return;
    const d = drawing;
    drawing = null;
    if (d.erase) return;
    if (!d.pts || d.pts.length < 1) { drawAnnots(pv); return; }
    const arr = pageStrokes(pv.num);
    // drop accidental dots for shapes
    if (SHAPE_TOOLS.indexOf(d.tool) !== -1 && d.pts.length < 2) {
      drawAnnots(pv);
      return;
    }
    arr.push(d);
    S.undoStack.push({ type: 'add', page: pv.num, stroke: d });
    S.redoStack.length = 0;
    updateAnnotUndoUI();
    saveAnnotsSoon();
    drawAnnots(pv);
  }
  c.addEventListener('pointerup', finish);
  c.addEventListener('pointercancel', () => { drawing = null; drawAnnots(pv); });
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function eraseAt(pv, e) {
  if (!pv || !pv.viewport || !pv.annot) return false;
  const arr = pageStrokes(pv.num);
  if (!arr.length) return false;
  const c = pv.annot;
  const r = c.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const sx = (e.clientX - r.left) * (pv.viewport.width / Math.max(1, r.width));
  const sy = (e.clientY - r.top) * (pv.viewport.height / Math.max(1, r.height));
  const tolPx = 14;
  let hit = -1;
  for (let i = arr.length - 1; i >= 0; i--) {
    const st = arr[i];
    const pts = st.pts.map(p => { try { return pv.viewport.convertToViewportPoint(p[0], p[1]); } catch (err) { return [0, 0]; } });
    let best = Infinity;
    if (st.tool === 'text') {
      best = Math.hypot(sx - pts[0][0], sy - pts[0][1]);
      if (best > 28) best = Infinity;
    } else if (st.tool === 'rect' || st.tool === 'redact' || st.tool === 'ellipse' || st.tool === 'line' || st.tool === 'arrow' ||
               st.tool === 'underline' || st.tool === 'strike' || st.tool === 'texthl') {
      const a = pts[0], b = pts[pts.length - 1];
      if (st.tool === 'texthl') {
        // filled text quad: bounding box over all 4 corners
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        pts.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
        const dx = Math.max(x0 - sx, 0, sx - x1), dy = Math.max(y0 - sy, 0, sy - y1);
        best = Math.hypot(dx, dy);
        if (sx > x0 && sx < x1 && sy > y0 && sy < y1) best = Math.min(sx - x0, x1 - sx, sy - y0, y1 - sy);
      } else if (st.tool === 'line' || st.tool === 'arrow' || st.tool === 'underline' || st.tool === 'strike') {
        best = distToSeg(sx, sy, a[0], a[1], b[0], b[1]);
      }
      else {
        const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
        const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        const dx = Math.max(x0 - sx, 0, sx - x1), dy = Math.max(y0 - sy, 0, sy - y1);
        best = Math.hypot(dx, dy);
        if (sx > x0 && sx < x1 && sy > y0 && sy < y1) best = Math.min(sx - x0, x1 - sx, sy - y0, y1 - sy);
      }
    } else {
      for (let j = 0; j < pts.length - 1; j++) {
        best = Math.min(best, distToSeg(sx, sy, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1]));
        if (best <= tolPx) break;
      }
      if (pts.length === 1) best = Math.hypot(sx - pts[0][0], sy - pts[0][1]);
    }
    const wPx = Math.max(0, ((st.widthPdf || 3) * pv.viewport.scale) / 2);
    if (best <= tolPx + wPx) { hit = i; break; }
  }
  if (hit >= 0) {
    const removed = arr.splice(hit, 1)[0];
    S.undoStack.push({ type: 'del', page: pv.num, stroke: removed, index: hit });
    S.redoStack.length = 0;
    updateAnnotUndoUI();
    saveAnnotsSoon();
    drawAnnots(pv);
    try { if (typeof renderAnnotsList === 'function') renderAnnotsList(); } catch (err) {}
    return true;
  }
  return false;
}

function askTextAnnot(pv, pt) {
  openModal({
    title: 'Add text note',
    icon: 'i-text',
    html:
      '<label class="field-label" for="annotTextField">Note text</label>' +
      '<textarea class="annot-text-input" id="annotTextField" placeholder="Type your note…" style="margin-top:6px"></textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="annotTextGo">Add note</button>',
    onMount(m) {
      const inp = m.querySelector('#annotTextField');
      const go = () => {
        const v = inp.value.trim();
        if (!v) { closeModal(); return; }
        const st = {
          id: makeStrokeId(), tool: 'text',
          color: S.annotColor === '#ffd400' ? '#111418' : S.annotColor,
          sizePt: (typeof noteFontSize !== 'undefined' ? noteFontSize : 15) || 15, pts: [[pt[0], pt[1]]], text: v.slice(0, 600)
        };
        pageStrokes(pv.num).push(st);
        S.undoStack.push({ type: 'add', page: pv.num, stroke: st });
        S.redoStack.length = 0;
        updateAnnotUndoUI();
        saveAnnotsSoon();
        closeModal();
        drawAnnots(pv);
      };
      m.querySelector('#annotTextGo').addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(); });
    }
  });
}

/* ---------- select text -> highlight (textsel mode, sel-bar, H/U keys) ----------
   Works two ways: auto-convert on mouseup while the textsel tool is active,
   or on demand (selection mini-toolbar / H / U keys) in ANY mode — pass
   manual=true to bypass the textsel-mode guard. */
function convertSelectionToHighlight(manual, kind) {
  if (!S.doc) return;
  if (!manual && (!S.annotMode || S.tool !== 'textsel')) return;
  const want = kind === 'underline' ? 'underline' : 'highlight';
  let sel;
  try { sel = window.getSelection(); } catch (e) { return; }
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

  // bucket selection rects by page (center-in-page test)
  const perPage = {};
  for (let ri = 0; ri < sel.rangeCount; ri++) {
    let rects;
    try { rects = sel.getRangeAt(ri).getClientRects(); } catch (e) { continue; }
    for (const r of rects) {
      if (!r || r.width < 1 || r.height < 1) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const pv = S.pageViews.find(p => {
        const pr = p.el.getBoundingClientRect();
        return cx >= pr.left && cx <= pr.right && cy >= pr.top && cy <= pr.bottom;
      });
      if (!pv || !pv.viewport || !pv.annot) continue;
      (perPage[pv.num] = perPage[pv.num] || []).push(r);
    }
  }
  const pages = Object.keys(perPage);
  if (!pages.length) return;

  let made = 0;
  const op = (S.annotOpacity != null ? S.annotOpacity : 1);
  pages.forEach(pn => {
    const pv = S.pageViews[Number(pn) - 1];
    if (!pv || !pv.viewport) return;
    const canvasRect = pv.annot.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;
    const kx = pv.viewport.width / canvasRect.width;
    const ky = pv.viewport.height / canvasRect.height;
    perPage[pn].forEach(r => {
      try {
        // 1px visual pad so the fill hugs the glyphs nicely
        const x1 = (r.left - canvasRect.left) * kx - 1;
        const y1 = (r.top - canvasRect.top) * ky - 1;
        const x2 = (r.right - canvasRect.left) * kx + 1;
        const y2 = (r.bottom - canvasRect.top) * ky + 1;
        if (!(x2 > x1 && y2 > y1)) return;
        let st;
        if (want === 'underline') {
          st = {
            id: makeStrokeId(),
            tool: 'underline',
            color: S.annotColor,
            opacity: op,
            widthPdf: widthForTool('underline', S.annotSize, S.scale),
            pts: [
              pv.viewport.convertToPdfPoint(x1, y2 - 1),
              pv.viewport.convertToPdfPoint(x2, y2 - 1),
            ],
          };
        } else {
          st = {
            id: makeStrokeId(),
            tool: 'texthl',
            color: S.annotColor,
            opacity: op,
            widthPdf: 0,
            pts: [
              pv.viewport.convertToPdfPoint(x1, y1),
              pv.viewport.convertToPdfPoint(x2, y1),
              pv.viewport.convertToPdfPoint(x2, y2),
              pv.viewport.convertToPdfPoint(x1, y2),
            ],
          };
        }
        pageStrokes(pv.num).push(st);
        S.undoStack.push({ type: 'add', page: pv.num, stroke: st });
        made++;
      } catch (e) { /* skip bad rect */ }
    });
    S.redoStack.length = 0;
    drawAnnots(pv);
  });

  if (made > 0) {
    try { sel.removeAllRanges(); } catch (e) {}
    updateAnnotUndoUI();
    saveAnnotsSoon();
    try { if (typeof renderAnnotsList === 'function') renderAnnotsList(); } catch (e) {}
    hideSelBar();
    toast((want === 'underline' ? 'Underlined ' : 'Highlighted ') + made + ' line' + (made === 1 ? '' : 's'), 'ok', 1600);
  }
  return made;
}

/* ---------- selection mini-toolbar (works in plain select mode) ---------- */
function selHasTextInDoc() {
  try {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
    const node = sel.anchorNode;
    if (!node) return false;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !el.closest) return false;
    if (!el.closest('.textLayer')) return false;
    if (!D.pages.contains(el)) return false;
    return sel.toString().trim().length > 0;
  } catch (e) { return false; }
}
function hideSelBar() {
  if (D.selBar) D.selBar.hidden = true;
}
let selBarTimer = null;
function onSelectionChange() {
  clearTimeout(selBarTimer);
  selBarTimer = setTimeout(() => {
    if (!S.doc || !D.selBar) return;
    // draw tools cover the text layer, so a selection can only exist
    // in select / textsel-friendly states — never fight drawing.
    if (S.annotMode && S.tool !== 'select' && S.tool !== 'textsel') { hideSelBar(); return; }
    if (!selHasTextInDoc()) { hideSelBar(); return; }
    try {
      const sel = window.getSelection();
      const rc = sel.getRangeAt(0).getBoundingClientRect();
      if (!rc || (rc.width < 2 && rc.height < 2)) { hideSelBar(); return; }
      const bar = D.selBar;
      bar.hidden = false;
      const bw = bar.offsetWidth || 180, bh = bar.offsetHeight || 42;
      const left = Math.min(Math.max(8, rc.left + rc.width / 2 - bw / 2), window.innerWidth - bw - 8);
      let top = rc.top - bh - 10;
      if (top < 8) top = Math.min(window.innerHeight - bh - 8, rc.bottom + 10);
      bar.style.left = left + 'px';
      bar.style.top = Math.max(8, top) + 'px';
    } catch (e) { hideSelBar(); }
  }, 120);
}
function copySelectionText() {
  try {
    const t = window.getSelection().toString();
    if (!t.trim()) { toast('Nothing selected', null, 1400); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(
        () => toast('Selected text copied', 'ok', 1400),
        () => toast('Could not copy', 'err', 1600));
    } else { toast('Copy unavailable here', 'err', 1600); }
  } catch (e) { toast('Could not copy', 'err', 1600); }
  hideSelBar();
}
function wireSelBar() {
  document.addEventListener('selectionchange', onSelectionChange);
  if (D.selHighlight) D.selHighlight.addEventListener('click', () => convertSelectionToHighlight(true, 'highlight'));
  if (D.selUnderline) D.selUnderline.addEventListener('click', () => convertSelectionToHighlight(true, 'underline'));
  if (D.selCopy) D.selCopy.addEventListener('click', copySelectionText);
  if (D.selClose) D.selClose.addEventListener('click', () => {
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    hideSelBar();
  });
  try { D.viewer.addEventListener('scroll', hideSelBar, { passive: true }); } catch (e) {}
}

/* ---------- undo / redo / clear ---------- */
function pushUndoRedo() { updateAnnotUndoUI(); }
function updateAnnotUndoUI() {
  const u = $('#annotUndo'), r = $('#annotRedo');
  if (u) u.disabled = S.undoStack.length === 0;
  if (r) r.disabled = S.redoStack.length === 0;
}
function annotUndo() {
  const a = S.undoStack.pop();
  if (!a) return;
  const arr = pageStrokes(a.page);
  if (a.type === 'add') {
    const i = arr.findIndex(s => s.id === a.stroke.id);
    if (i >= 0) arr.splice(i, 1);
    S.redoStack.push(a);
  } else if (a.type === 'del') {
    arr.splice(Math.min(a.index, arr.length), 0, a.stroke);
    S.redoStack.push(a);
  } else if (a.type === 'clear') {
    S.annots[a.page] = a.strokes.slice();
    S.redoStack.push(a);
  }
  saveAnnotsSoon();
  updateAnnotUndoUI();
  const pv = S.pageViews[a.page - 1];
  if (pv) drawAnnots(pv);
}
function annotRedo() {
  const a = S.redoStack.pop();
  if (!a) return;
  const arr = pageStrokes(a.page);
  if (a.type === 'add') {
    arr.push(a.stroke);
    S.undoStack.push(a);
  } else if (a.type === 'del') {
    const i = arr.findIndex(s => s.id === a.stroke.id);
    if (i >= 0) arr.splice(i, 1);
    S.undoStack.push(a);
  } else if (a.type === 'clear') {
    S.annots[a.page] = [];
    S.undoStack.push(a);
  }
  saveAnnotsSoon();
  updateAnnotUndoUI();
  const pv = S.pageViews[a.page - 1];
  if (pv) drawAnnots(pv);
}
function annotClearPage() {
  if (!S.doc) return;
  const arr = pageStrokes(S.pageNum);
  if (!arr.length) { toast('Nothing to clear on this page', null, 1500); return; }
  S.undoStack.push({ type: 'clear', page: S.pageNum, strokes: arr.slice() });
  S.redoStack.length = 0;
  S.annots[S.pageNum] = [];
  saveAnnotsSoon();
  updateAnnotUndoUI();
  const pv = S.pageViews[S.pageNum - 1];
  if (pv) drawAnnots(pv);
  toast('Page cleared', 'ok', 1400);
}

/* ---------- NevaiPDF eraser: remove EMBEDDED pdf annotations ----------
   The stroke eraser above only removes marks drawn in this app. Native
   annotations baked into the file (embedded highlights, comments, links,
   widgets) need the document-level strip below — full NevaiPDF logic
   (remove-annotations-page/node), copied into nevaipdf-ops.js and called
   here as NevaiOps.removeEmbeddedAnnotations(). */
async function removeEmbeddedAnnots() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!window.NevaiOps || !NevaiOps.removeEmbeddedAnnotations) {
    toast('Eraser engine missing (nevaipdf-ops.js)', 'err', 3000);
    return;
  }
  try {
    setStatus('Erasing embedded annotations…', 'busy');
    showProgress(25);
    const srcBytes = new Uint8Array(await S.file.arrayBuffer());
    const res = await NevaiOps.removeEmbeddedAnnotations(srcBytes);
    hideProgress();
    setStatus('Ready', 'ok');
    if (!res.stripped) {
      toast('No embedded annotations found — nothing to erase', null, 2200);
      return;
    }
    const name = (S.file.name || 'document.pdf').replace(/\.pdf$/i, '') + '-clean.pdf';
    await openResultBytes(res.bytes, name);
    toast('Erased annotations on ' + res.stripped + ' page' + (res.stripped === 1 ? '' : 's'), 'ok');
  } catch (err) {
    console.warn('embedded erase', err);
    hideProgress();
    setStatus('Ready');
    toast('Erase failed — try again', 'err', 2800);
  }
}

/* ---------- mode / tools ---------- */
function setAnnotTool(t) {
  S.tool = t;
  $$('.ab-btn[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const drawing = S.annotMode && t !== 'select' && t !== 'textsel';
  const textsel = S.annotMode && t === 'textsel';
  document.body.classList.toggle('draw', drawing);
  document.body.classList.toggle('annotating', S.annotMode);
  document.body.classList.toggle('erasing', S.annotMode && t === 'eraser');
  document.body.classList.toggle('textsel-mode', textsel);
  // marker-like tools need a thicker default stroke
  if ((t === 'highlight' || t === 'underline' || t === 'strike') && S.annotSize < 10) {
    S.annotSize = 14;
    const sz = $('#annotSize');
    if (sz) sz.value = 14;
  }
  if (t === 'textsel' && S.annotMode) {
    toast('Select any text — it becomes a highlight (Esc to exit)', null, 2400);
  }
  if (S.annotMode) redrawAllAnnots();
}
function toggleAnnotate(force) {
  if (!S.doc && force !== false) { toast('Open a PDF first', 'err', 1600); return; }
  const on = force !== undefined ? force : !S.annotMode;
  S.annotMode = on;
  D.annotBar.hidden = !on;
  D.btnAnnotate.classList.toggle('on', on);
  document.body.classList.toggle('annotating', on);
  if (on) {
    if (S.tool === 'select') setAnnotTool('highlight');
    else setAnnotTool(S.tool);
    markSwatches();
    redrawAllAnnots();
    // safety net: pages that finish rendering just after toggle get layers too
    setTimeout(() => { if (S.annotMode) redrawAllAnnots(); }, 900);
    toast('Marker on — draw on ANY page. Select (V) to scroll', null, 2600);
  } else {
    document.body.classList.remove('draw');
    document.body.classList.remove('annotating');
    document.body.classList.remove('erasing');
    document.body.classList.remove('textsel-mode');
    redrawAllAnnots();
  }
}
function markSwatches() {
  $$('#annotSwatches .swatch').forEach(s =>
    s.classList.toggle('on', s.dataset.color.toLowerCase() === String(S.annotColor).toLowerCase()));
  const cc = $('#annotColor');
  if (cc && !$$('#annotSwatches .swatch').some(s => s.dataset.color.toLowerCase() === String(S.annotColor).toLowerCase())) {
    cc.value = /^#[0-9a-f]{6}$/i.test(S.annotColor) ? S.annotColor : '#ff8a00';
  }
}

/* ---------- export: burn annotations into a new PDF ---------- */
function renderAnnotPng(pv, k) {
  return new Promise(async (resolve) => {
    try {
      const strokes = pageStrokes(pv.num);
      if (!strokes.length) { resolve(null); return; }
      let page = pv.page;
      if (!page) page = await S.doc.getPage(pv.num);
      const vp = page.getViewport({ scale: k, rotation: 0 });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext('2d');
      if (!ctx) { resolve(null); return; }
      // transparent background — only the marks
      drawStrokesExport(ctx, vp, strokes);
      c.toBlob(b => {
        if (!b) { resolve(null); return; }
        const fr = new FileReader();
        fr.onload = () => resolve(new Uint8Array(fr.result));
        fr.onerror = () => resolve(null);
        fr.readAsArrayBuffer(b);
      }, 'image/png');
    } catch (e) { resolve(null); }
  });
}
function drawStrokesExport(ctx, viewport, strokes) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  (strokes || []).forEach(st => {
    if (!st || !st.pts || !st.pts.length) return;
    const pts = st.pts.map(p => { try { return viewport.convertToViewportPoint(p[0], p[1]); } catch (e) { return [0, 0]; } });
    if (st.tool === 'text') {
      ctx.globalAlpha = strokeAlpha('pen', st);
      ctx.fillStyle = st.color || '#111418';
      const fs = Math.max(8, (st.sizePt || 15) * viewport.scale);
      ctx.font = '500 ' + fs + 'px sans-serif';
      ctx.textBaseline = 'top';
      String(st.text || '').split('\n').forEach((ln, i) => ctx.fillText(ln, pts[0][0], pts[0][1] + i * fs * 1.25));
      return;
    }
    if (st.tool === 'texthl' && pts.length >= 4) {
      // text-selection highlight (export): filled quad, same alpha as marker
      ctx.globalAlpha = strokeAlpha('texthl', st);
      ctx.fillStyle = st.color || '#ffd400';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let q = 1; q < 4; q++) ctx.lineTo(pts[q][0], pts[q][1]);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.globalAlpha = strokeAlpha(st.tool, st);
    ctx.strokeStyle = st.color || '#ffd400';
    ctx.fillStyle = st.color || '#ffd400';
    ctx.lineWidth = Math.max(1.5, (st.widthPdf || 3) * viewport.scale);
    ctx.beginPath();
    if ((st.tool === 'line' || st.tool === 'underline' || st.tool === 'strike') && pts.length >= 2) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    } else if (st.tool === 'arrow' && pts.length >= 2) {
      paintArrowHead(ctx, pts[0], pts[pts.length - 1], Math.max(1.5, (st.widthPdf || 3) * viewport.scale));
    } else if (st.tool === 'rect' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    } else if (st.tool === 'ellipse' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
        Math.max(1, Math.abs(b[0] - a[0]) / 2), Math.max(1, Math.abs(b[1] - a[1]) / 2), 0, 0, Math.PI * 2);
    } else if (st.tool === 'redact' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111418';
      ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      ctx.restore();
      return;
    } else {
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      if (pts.length === 1) { ctx.arc(pts[0][0], pts[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
    }
    ctx.stroke();
    if (st.tool === 'arrow' && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const hs = Math.max(10, ctx.lineWidth * 2.4);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - hs * Math.cos(ang - 0.42), b[1] - hs * Math.sin(ang - 0.42));
      ctx.lineTo(b[0] - hs * Math.cos(ang + 0.42), b[1] - hs * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.restore();
}

async function exportAnnotated() {
  if (!S.doc || !S.file) return;
  const pages = Object.keys(S.annots).filter(p => (S.annots[p] || []).length > 0).map(Number).sort((a, b) => a - b);
  if (!pages.length) { toast('No annotations yet — draw something first', null, 2200); return; }
  if (!window.PDFLib || !PDFLib.PDFDocument) { toast('Editor engine missing (vendor/pdf-lib.min.js)', 'err', 3000); return; }
  try {
    setStatus('Exporting…', 'busy');
    showProgress(15);
    const srcBytes = await S.file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(srcBytes, { ignoreEncryption: true });
    let done = 0;
    for (const p of pages) {
      const pv = S.pageViews[p - 1];
      const pngBytes = pv ? await renderAnnotPng(pv, S.exportQ || 2.5) : null;
      if (pngBytes) {
        const png = await pdf.embedPng(pngBytes);
        const pg = pdf.getPage(p - 1);
        const size = pg.getSize();
        pg.drawImage(png, { x: 0, y: 0, width: size.width, height: size.height });
      }
      done++;
      showProgress(15 + (done / pages.length) * 70);
    }
    const out = await pdf.save();
    hideProgress();
    setStatus('Ready', 'ok');
    const blob = new Blob([out], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.file.name || 'document.pdf').replace(/\.pdf$/i, '') + '-annotated.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast('Exported PDF with annotations', 'ok');
  } catch (err) {
    console.warn('export', err);
    hideProgress();
    setStatus('Ready');
    toast('Export failed — try again', 'err', 3000);
  }
}

/* ---------- annotation toolbar wiring ---------- */
function initAnnotBar() {
  $$('.ab-btn[data-tool]').forEach(b =>
    b.addEventListener('click', () => setAnnotTool(b.dataset.tool)));
  $$('#annotSwatches .swatch').forEach(s =>
    s.addEventListener('click', () => { S.annotColor = s.dataset.color; markSwatches(); }));
  const _cc = $('#annotColor');
  if (_cc) _cc.addEventListener('input', e => { S.annotColor = e.target.value; markSwatches(); });
  const _sz = $('#annotSize');
  if (_sz) {
    S.annotSize = parseInt(_sz.value, 10) || 8;
    _sz.addEventListener('input', e => { S.annotSize = parseInt(e.target.value, 10) || 8; });
  }
  const _op = $('#annotOpacity');
  if (_op) {
    const syncOp = (redraw) => {
      S.annotOpacity = (parseInt(_op.value, 10) || 100) / 100;
      _op.title = 'Opacity ' + _op.value + '%';
      if (redraw) redrawAllAnnots();
    };
    _op.addEventListener('input', () => syncOp(true));
    syncOp(false);
  }
  $('#annotUndo').addEventListener('click', annotUndo);
  $('#annotRedo').addEventListener('click', annotRedo);
  $('#annotClear').addEventListener('click', annotClearPage);
  $('#annotExport').addEventListener('click', exportAnnotated);
  $('#annotClose').addEventListener('click', () => toggleAnnotate(false));
  // select-text-to-highlight: convert after the selection settles
  if (D.viewer && !D.viewer.dataset.textselWired) {
    D.viewer.dataset.textselWired = '1';
    D.viewer.addEventListener('mouseup', () => { setTimeout(convertSelectionToHighlight, 40); });
    D.viewer.addEventListener('touchend', () => { setTimeout(convertSelectionToHighlight, 160); });
  }
  updateAnnotUndoUI();
  markSwatches();
}

/* --------------------------------------------------------------------------
   33c. Read aloud + copy page text
   -------------------------------------------------------------------------- */
async function getPageText(n) {
  if (S.searchIndex && S.searchIndex[n - 1] != null) return S.searchIndex[n - 1];
  try {
    const p = await S.doc.getPage(n);
    const tc = await p.getTextContent();
    return tc.items.map(it => it.str).join(' ');
  } catch (e) { return ''; }
}
function stopSpeaking() {
  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch (e) {}
  S.speaking = false;
}
async function toggleSpeak() {
  if (!S.doc) return;
  if (!('speechSynthesis' in window)) { toast('Speech not supported here', 'err', 2000); return; }
  if (S.speaking) { stopSpeaking(); toast('Stopped reading', null, 1400); return; }
  const text = (await getPageText(S.pageNum) || '').replace(/\s+/g, ' ').trim();
  if (!text) { toast('No readable text on this page', 'err', 2000); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 9000));
    u.onend = () => { S.speaking = false; };
    u.onerror = () => { S.speaking = false; };
    S.speaking = true;
    speechSynthesis.speak(u);
    toast('Reading page ' + S.pageNum + '… (Esc stops)', null, 2200);
  } catch (e) {
    S.speaking = false;
    toast('Could not start speech', 'err', 2000);
  }
}
async function copyPageText() {
  if (!S.doc) return;
  const text = (await getPageText(S.pageNum) || '').replace(/\s+/g, ' ').trim();
  if (!text) { toast('No text on this page', 'err', 1800); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast('Page ' + S.pageNum + ' text copied', 'ok', 1600);
  } catch (e) {
    toast('Could not copy', 'err', 1800);
  }
}
async function copyAllText() {
  if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
  const txt = (await getAllText(2000000) || '').trim();
  if (!txt) { toast('No extractable text in this PDF', 'err', 2200); return; }
  try {
    await navigator.clipboard.writeText(txt);
    toast(txt.split(/\s+/).filter(Boolean).length.toLocaleString() + ' words copied', 'ok', 1800);
  } catch (e) {
    toast('Could not copy', 'err', 1800);
  }
}
function closeDocument() {
  if (!S.doc) { toast('No document open', null, 1400); return; }
  try { stopSpeaking(); } catch (e) {}
  try { updateRecentPage(); } catch (e) {}
  saveAnnotsNow();
  cleanupDocument();
  if (S.blobUrl) { try { URL.revokeObjectURL(S.blobUrl); } catch (e) {} S.blobUrl = null; }
  S.file = null; S.docId = null;
  S.numPages = 0; S.pageNum = 1; S.title = ''; S.props = null;
  S.searchIndex = null; S.searchQuery = ''; S.searchResults = []; S.searchCursor = -1;
  S.editSel = new Set();
  D.empty.hidden = false;
  D.pages.hidden = true;
  D.sbPages.textContent = '0';
  D.sbSize.textContent = '—';
  D.sbFile.textContent = 'No document';
  document.title = 'Heros PDF — Modern PDF Viewer';
  updateUI();
  updateStatusBar();
  try { buildEditGrid(); } catch (e) {}
  try { renderAnnotsList(); } catch (e) {}
  try { renderBmList(); } catch (e) {}
  setStatus('Ready');
  toast('Document closed', 'ok', 1400);
}

/* --------------------------------------------------------------------------
   34. Touch gestures (pinch zoom, double-tap, swipe)
   -------------------------------------------------------------------------- */
(function touchGestures() {
  const v = D.viewer;
  let pinchStart = null;
  let lastTap = 0;
  let swipeStart = null;
  let previewScale = 1;

  function dist(a, b) {
    const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  v.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      pinchStart = {
        d: dist(e.touches[0], e.touches[1]),
        scale: S.scale
      };
      swipeStart = null;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        // double tap
        e.preventDefault();
        if (S.scale < 1.6) setZoom('custom', 2);
        else setZoom('fit-width');
        lastTap = 0;
        return;
      }
      lastTap = now;
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: now };
    }
  }, { passive: true });

  v.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const ratio = d / pinchStart.d;
      previewScale = clamp(ratio, 0.4, 3);
      D.pages.style.transform = 'scale(' + previewScale + ')';
      D.pages.style.transformOrigin = 'top center';
    } else if (e.touches.length === 1) {
      swipeStart = null;
    }
  }, { passive: false });

  v.addEventListener('touchend', e => {
    if (pinchStart && previewScale !== 1) {
      const target = pinchStart.scale * previewScale;
      D.pages.style.transform = '';
      previewScale = 1;
      pinchStart = null;
      setZoom('custom', target);
      return;
    }
    pinchStart = null;
    D.pages.style.transform = '';
    previewScale = 1;

    if (!S.continuous && swipeStart && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeStart.x;
      const dy = t.clientY - swipeStart.y;
      const dt = Date.now() - swipeStart.t;
      if (dt < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        if (dx < 0) nextPage(); else prevPage();
      }
    }
    swipeStart = null;
  }, { passive: true });
})();

/* --------------------------------------------------------------------------
   35. Resize
   -------------------------------------------------------------------------- */
const onResize = debounce(() => {
  if (!S.doc) return;
  if (S.scaleMode === 'fit-width' || S.scaleMode === 'fit-page') {
    layout(true);
    renderVisible(true);
  }
  if (window.innerWidth > 900) {
    D.sidebar.classList.remove('open');
    D.sideBackdrop.classList.remove('show');
  }
  closeMenu();
}, 140);
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));

/* --------------------------------------------------------------------------
   36. Persist page position periodically
   -------------------------------------------------------------------------- */
setInterval(() => { if (S.doc) updateRecentPage(); }, 5000);
window.addEventListener('beforeunload', () => { if (S.doc) { updateRecentPage(); saveAnnotsNow(); } });

/* --------------------------------------------------------------------------
   37. Extension launch — file handed off via the service worker
   The service worker stashed the File in the shared 'pdfstudio-launch' DB.
   -------------------------------------------------------------------------- */
async function loadPendingFile() {
  let db;
  try {
    db = await new Promise((res, rej) => {
      const r = indexedDB.open('pdfstudio-launch', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rec = await new Promise((res, rej) => {
      const q = db.transaction('pending', 'readonly').objectStore('pending').get('file');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    if (rec && rec.blob) {
      const blob = rec.blob;
      const f = new File([blob], rec.name || 'document.pdf', {
        type: 'application/pdf',
        lastModified: rec.at || Date.now()
      });
      await loadFromFile(f);
      await new Promise(res => {
        const tx = db.transaction('pending', 'readwrite');
        tx.objectStore('pending').delete('file');
        tx.oncomplete = res;
        tx.onerror = res;
      });
    }
  } catch (e) {
    console.warn('launch file', e);
  }
}

/* --------------------------------------------------------------------------
   38. POWER PACK — unlimited free features (edit, markers, hub, speed)
   -------------------------------------------------------------------------- */
function lsGet(k, fb) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fb;
  } catch (e) { return fb; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}
function needLib() {
  if (!window.PDFLib || !PDFLib.PDFDocument) {
    toast('Editor engine missing (vendor/pdf-lib.min.js)', 'err', 3000);
    return false;
  }
  return true;
}
function downloadBytes(bytes, filename, mime) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function openResultBytes(bytes, filename) {
  const f = new File([bytes], filename || 'edited.pdf', { type: 'application/pdf' });
  await loadFromFile(f);
}

/* ---------- prefs / profile / stats / bookmarks ---------- */
S.prefs = Object.assign({ hq: true, resume: true, autoOpen: true, pageMode: 'off', autoSpeed: 30 }, lsGet('pdfstudio-prefs-v2', {}));
S.profile = Object.assign({ name: 'My Studio', color: '#4c8dff' }, lsGet('pdfstudio-profile-v1', {}));
S.stats = Object.assign({ docs: 0, pagesRead: 0 }, lsGet('pdfstudio-stats-v1', {}));
S.bookmarks = lsGet('pdfstudio-bookmarks-v1', {});
S.ttsRate = parseFloat((lsGet('pdfstudio-tts-v1', { rate: 1 }) || {}).rate) || 1;
if (!(S.ttsRate >= 0.5 && S.ttsRate <= 2)) S.ttsRate = 1;

function savePrefs() { lsSet('pdfstudio-prefs-v2', S.prefs); }
function saveProfile() { lsSet('pdfstudio-profile-v1', S.profile); }
function saveStats() { lsSet('pdfstudio-stats-v1', S.stats); }
function saveBookmarks() { lsSet('pdfstudio-bookmarks-v1', S.bookmarks); }

function applyPrefs() {
  CFG.DPR_MAX = S.prefs.hq === false ? 1.25 : 2;
  document.body.classList.toggle('night-pages', S.prefs.pageMode === 'night');
  document.body.classList.toggle('sepia-pages', S.prefs.pageMode === 'sepia');
  document.body.classList.toggle('dim-pages', S.prefs.pageMode === 'dim');
  S.spreadOn = !!S.prefs.spread;
  document.body.classList.toggle('spread-on', S.spreadOn);
  S.pageGap = S.prefs.gap || 18;
  if (D.pages) D.pages.style.gap = S.pageGap + 'px';
  const seg = $('#pageModeSeg');
  if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.pm === (S.prefs.pageMode || 'off')));
  const swF = $('#swFocus'); if (swF) swF.checked = document.body.classList.contains('focus-mode');
  const swS = $('#swSpread'); if (swS) swS.checked = S.spreadOn;
  const swH = $('#swHQ'); if (swH) swH.checked = S.prefs.hq !== false;
  const swT = $('#swText'); if (swT) swT.checked = S.prefs.textLayer !== false;
  document.body.classList.toggle('no-text', S.prefs.textLayer === false);
  const swR = $('#swResume'); if (swR) swR.checked = S.prefs.resume !== false;
  const swA = $('#swAutoOpen'); if (swA) swA.checked = S.prefs.autoOpen !== false;
  const sp = $('#autoSpeed'); if (sp) sp.value = S.prefs.autoSpeed || 30;
  const spl = $('#autoSpeedLbl'); if (spl) spl.textContent = S.prefs.autoSpeed || 30;
  const ab = $('#autoBarSpeed'); if (ab) ab.value = S.prefs.autoSpeed || 30;
  const gp = $('#pageGap'); if (gp) gp.value = S.pageGap;
  const gpl = $('#pageGapLbl'); if (gpl) gpl.textContent = S.pageGap;
  const tr = $('#ttsRate'); if (tr) tr.value = Math.round(S.ttsRate * 10);
  const trl = $('#ttsRateLbl'); if (trl) trl.textContent = S.ttsRate.toFixed(1) + '×';
  const av = $('#profileAvatar');
  if (av) { av.textContent = (S.profile.name || 'P').trim().charAt(0).toUpperCase() || 'P'; av.style.background = 'linear-gradient(140deg,' + (S.profile.color || '#4c8dff') + ',' + (S.profile.color || '#4c8dff') + 'cc)'; }
  const nm = $('#profileName'); if (nm) nm.textContent = S.profile.name || 'My Studio';
}
function renderStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stDocs', S.stats.docs || 0);
  set('stPages', S.stats.pagesRead || 0);
  let marks = 0;
  try { Object.keys(S.annots || {}).forEach(k => { marks += (S.annots[k] || []).length; }); } catch (e) {}
  set('stMarks', marks);
  let saved = 0;
  try { Object.keys(S.bookmarks || {}).forEach(k => { saved += (S.bookmarks[k] || []).length; }); } catch (e) {}
  set('stSaved', saved);
}
function bmFor(docId) {
  if (!docId) return [];
  if (!S.bookmarks[docId]) S.bookmarks[docId] = [];
  return S.bookmarks[docId];
}
function isBookmarked(n) {
  if (!S.docId) return false;
  return bmFor(S.docId).indexOf(n) !== -1;
}
function toggleBookmark(n) {
  if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
  const page = n || S.pageNum;
  const arr = bmFor(S.docId);
  const i = arr.indexOf(page);
  if (i >= 0) { arr.splice(i, 1); toast('Removed bookmark — page ' + page, null, 1500); }
  else { arr.push(page); arr.sort((a, b) => a - b); toast('Bookmarked page ' + page, 'ok', 1500); }
  saveBookmarks();
  renderBmList();
  renderStats();
  paintBookmarkBtn();
}
function paintBookmarkBtn() {
  const b = D.btnBookmark;
  if (!b) return;
  const on = isBookmarked(S.pageNum);
  b.classList.toggle('on', on);
  b.innerHTML = '<svg class="ic"><use href="#' + (on ? 'i-bookmark' : 'i-star') + '"/></svg>';
  const lbl = D.bmPageLbl;
  if (lbl) lbl.textContent = '· p.' + S.pageNum;
}
function renderBmList() {
  const list = D.bmList, empty = D.bmEmpty;
  if (!list) return;
  list.innerHTML = '';
  const arr = S.docId ? bmFor(S.docId) : [];
  if (empty) empty.hidden = arr.length > 0;
  if (!arr.length) return;
  const frag = document.createDocumentFragment();
  arr.forEach(p => {
    const row = document.createElement('div');
    row.className = 'bm-item';
    row.innerHTML = '<div class="n">' + p + '</div>' +
      '<div class="meta"><div class="tt">Page ' + p + '</div>' +
      '<div class="ss">Saved page · click to jump</div></div>' +
      '<button class="x" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    row.addEventListener('click', () => goToPage(p, true));
    row.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); toggleBookmark(p); });
    frag.appendChild(row);
  });
  list.appendChild(frag);
}

/* ---------- markers list ---------- */
function toolLabel(t) {
  return { highlight: 'Marker', underline: 'Underline', strike: 'Strike', pen: 'Pen', arrow: 'Arrow', line: 'Line', rect: 'Rect', ellipse: 'Ellipse', text: 'Note', texthl: 'Text highlight', textsel: 'Text select', eraser: 'Eraser', redact: 'Redaction', select: 'Select' }[t] || t;
}
function renderAnnotsList() {
  const list = D.annotsList, empty = D.annotsEmpty;
  if (!list) return;
  list.innerHTML = '';
  const pages = Object.keys(S.annots || {}).map(Number).filter(p => (S.annots[p] || []).length > 0).sort((a, b) => a - b);
  let total = 0;
  pages.forEach(p => { total += (S.annots[p] || []).length; });
  if (empty) empty.hidden = total > 0;
  if (!total) { renderStats(); return; }
  const frag = document.createDocumentFragment();
  pages.forEach(p => {
    (S.annots[p] || []).forEach(st => {
      const row = document.createElement('div');
      row.className = 'note-item';
      const dot = (st.color || '#ffd400');
      const preview = st.tool === 'text' ? String(st.text || '').slice(0, 90) : (toolLabel(st.tool) + ' · ' + (st.color || ''));
      row.innerHTML = '<div class="n" style="background:' + dot + '22;color:' + dot + ';border:1px solid ' + dot + '55">' + p + '</div>' +
        '<div class="meta"><div class="tt">' + esc(toolLabel(st.tool)) + ' — page ' + p + '</div>' +
        '<div class="ss">' + esc(preview) + '</div></div>' +
        (st.tool === 'text' ? '<button class="x" data-edit="1" title="Edit note"><svg class="ic ic-sm"><use href="#i-edit"/></svg></button>' : '') +
        '<button class="x" title="Delete"><svg class="ic ic-sm"><use href="#i-trash"/></svg></button>';
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit]')) return;
        goToPage(p, true);
        if (!S.annotMode) toggleAnnotate(true);
      });
      const eb = row.querySelector('[data-edit]');
      if (eb) eb.addEventListener('click', (e) => { e.stopPropagation(); editTextNote(p, st.id); });
      row.querySelector('.x').addEventListener('click', (e) => {
        e.stopPropagation();
        const arr = pageStrokes(p);
        const i = arr.findIndex(s => s.id === st.id);
        if (i >= 0) {
          const removed = arr.splice(i, 1)[0];
          S.undoStack.push({ type: 'del', page: p, stroke: removed, index: i });
          S.redoStack.length = 0;
          try { updateAnnotUndoUI(); } catch (err) {}
          saveAnnotsSoon();
          const pv = S.pageViews[p - 1];
          if (pv) drawAnnots(pv);
          renderAnnotsList();
        }
      });
      frag.appendChild(row);
    });
  });
  list.appendChild(frag);
  renderStats();
}

/* ---------- edit studio ---------- */
function openEditPane() {
  try { switchPane('edit'); } catch (e) {}
  if (window.innerWidth <= 900) {
    try {
      D.sidebar.classList.add('open');
      D.sideBackdrop.classList.add('show');
    } catch (err) {}
  }
  buildEditGrid();
}
function buildEditGrid() {
  const g = D.editGrid;
  if (!g) return;
  g.innerHTML = '';
  if (!S.doc) {
    g.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:12px;padding:14px">Open a PDF to manage its pages</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= S.numPages; i++) {
    const d = document.createElement('div');
    d.className = 'edit-thumb' + (S.editSel.has(i) ? ' sel' : '');
    d.innerHTML = '<span>p.' + i + '</span><span class="ck"><svg class="ic"><use href="#i-check"/></svg></span>';
    d.addEventListener('click', () => {
      if (S.editSel.has(i)) S.editSel.delete(i); else S.editSel.add(i);
      d.classList.toggle('sel', S.editSel.has(i));
    });
    d.addEventListener('dblclick', () => goToPage(i, true));
    frag.appendChild(d);
  }
  g.appendChild(frag);
}
function selPages() {
  const a = Array.from(S.editSel).filter(n => n >= 1 && n <= S.numPages).sort((x, y) => x - y);
  return a.length ? a : [S.pageNum];
}
function startMerge() {
  if (D.mergeInput) D.mergeInput.click();
  else toast('Merge unavailable', 'err', 1800);
}
async function doMerge(files) {
  if (!files || !files.length) return;
  if (!needLib()) return;
  const list = Array.from(files).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  if (list.length < 2) { toast('Choose at least 2 PDFs to merge', 'err', 2200); return; }
  try {
    setStatus('Merging…', 'busy');
    showProgress(20);
    const out = await PDFLib.PDFDocument.create();
    let n = 0, okCount = 0;
    const bad = [];
    for (const f of list) {
      try {
        const src = await PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        const idx = src.getPageIndices();
        const copied = await out.copyPages(src, idx);
        copied.forEach(p => out.addPage(p));
        n += idx.length;
        okCount++;
      } catch (e) { bad.push(f.name); }
      showProgress(20 + (n / (n + 1)) * 10);
    }
    if (okCount < 2) {
      hideProgress();
      setStatus('Ready');
      toast('Need 2 readable PDFs' + (bad.length ? ' — failed: ' + bad.join(', ').slice(0, 120) : ''), 'err', 3600);
      return;
    }
    const bytes = await out.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'merged-' + n + '-pages.pdf');
    toast('Merged ' + okCount + ' files · ' + n + ' pages' + (bad.length ? ' · skipped: ' + bad.join(', ').slice(0, 80) : ''), 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Merge failed — files may be encrypted', 'err', 3200);
  }
}
async function mutatePdf(label, fn, outName) {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  try {
    setStatus(label + '…', 'busy');
    showProgress(25);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    await fn(src);
    const bytes = await src.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, outName || 'edited.pdf');
    toast(label + ' done', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast(label + ' failed', 'err', 2800);
  }
}
function deleteSelected() {
  const sel = selPages();
  if (sel.length >= S.numPages) { toast('Keep at least one page', 'err', 2200); return; }
  mutatePdf('Deleting ' + sel.length + ' page(s)', async (src) => {
    sel.slice().sort((a, b) => b - a).forEach(p => { try { src.removePage(p - 1); } catch (e) {} });
  }, 'deleted-pages.pdf');
}
function extractSelected() {
  const sel = selPages();
  mutatePdf('Extracting ' + sel.length + ' page(s)', async (src) => {
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(src, sel.map(p => p - 1));
    copied.forEach(p => out.addPage(p));
    const bytes = await out.save({ useObjectStreams: true });
    downloadBytes(bytes, 'extracted-p' + sel[0] + (sel.length > 1 ? '-plus' + (sel.length - 1) : '') + '.pdf');
    throw { __done: true };
  }, 'extracted.pdf').catch(() => {});
}
async function extractSelectedReal() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  const sel = selPages();
  try {
    setStatus('Extracting…', 'busy');
    showProgress(30);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(src, sel.map(p => p - 1));
    copied.forEach(p => out.addPage(p));
    const bytes = await out.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    downloadBytes(bytes, 'extracted-p' + sel[0] + (sel.length > 1 ? '-plus' + (sel.length - 1) : '') + '.pdf');
    toast('Extracted ' + sel.length + ' page(s)', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Extract failed', 'err', 2600);
  }
}
function rotateSelected(dir) {
  const step = dir === -1 ? -1 : 1;
  const sel = selPages();
  mutatePdf('Rotating ' + sel.length + ' page(s)', async (src) => {
    sel.forEach(p => {
      try {
        const pg = src.getPage(p - 1);
        const cur = pg.getRotation().angle || 0;
        pg.setRotation(PDFLib.degrees(((cur + step * 90) % 360 + 360) % 360));
      } catch (e) {}
    });
  }, 'rotated.pdf');
}
async function watermarkApply() {
  const inp = document.getElementById('wmText');
  const txt = inp && inp.value.trim() ? inp.value.trim().slice(0, 60) : 'CONFIDENTIAL';
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  try {
    setStatus('Watermarking…', 'busy');
    showProgress(30);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    // Nevai-grade stamp: canvas-measured text baked as a rotated image (any script renders perfectly)
    const dpr = 2, fontSize = 44;
    const canvas = document.createElement('canvas');
    const mctx = canvas.getContext('2d');
    if (!mctx) throw new Error('no canvas');
    mctx.font = 'bold ' + (fontSize * dpr) + 'px "Segoe UI", Arial, sans-serif';
    const metrics = mctx.measureText(txt);
    canvas.width = Math.ceil(metrics.width) + 8;
    canvas.height = Math.ceil(fontSize * dpr * 1.5);
    mctx.font = 'bold ' + (fontSize * dpr) + 'px "Segoe UI", Arial, sans-serif';
    mctx.fillStyle = 'rgb(77,115,255)';
    mctx.textBaseline = 'middle';
    mctx.fillText(txt, 4, canvas.height / 2);
    const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('raster failed')), 'image/png'));
    const image = await src.embedPng(new Uint8Array(await blob.arrayBuffer()));
    const imgW = image.width / dpr, imgH = image.height / dpr;
    const angle = 30, rad = angle * Math.PI / 180;
    src.getPages().forEach(pg => {
      const { width, height } = pg.getSize();
      const cx = width / 2, cy = height / 2;
      pg.drawImage(image, {
        x: cx - Math.cos(rad) * imgW / 2 + Math.sin(rad) * imgH / 2,
        y: cy - Math.sin(rad) * imgW / 2 - Math.cos(rad) * imgH / 2,
        width: imgW, height: imgH,
        opacity: 0.22,
        rotate: PDFLib.degrees(angle)
      });
    });
    const bytes = await src.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'watermarked.pdf');
    toast('Watermark applied', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Watermark failed', 'err', 2600);
  }
}
function exportPagePNG() {
  if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
  const pv = S.pageViews[S.pageNum - 1];
  if (!pv || !pv.canvas) { toast('Page not rendered yet — wait a second', null, 1800); return; }
  try {
    pv.canvas.toBlob(b => {
      if (!b) { toast('Export failed', 'err', 1800); return; }
      downloadBytes(b, 'page-' + S.pageNum + '.png', 'image/png');
      toast('Page ' + S.pageNum + ' saved as PNG', 'ok');
    }, 'image/png');
  } catch (e) { toast('Export failed', 'err', 1800); }
}
function shareFile() {
  if (!S.file) { toast('Nothing to share yet', 'err', 1600); return; }
  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [S.file] })) {
      navigator.share({ files: [S.file], title: S.file.name }).catch(() => {});
    } else if (navigator.share) {
      navigator.share({ title: S.file.name, text: 'PDF — ' + S.file.name }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(S.file.name).then(() => toast('File name copied', 'ok', 1500)).catch(() => toast('Share unavailable', 'err', 1800));
    } else {
      toast('Share unavailable here', 'err', 1800);
    }
  } catch (e) { toast('Share unavailable', 'err', 1800); }
}

/* ---------- reading comfort ---------- */
function setPageMode(m) {
  S.prefs.pageMode = m || 'off';
  savePrefs();
  applyPrefs();
}
function cyclePageMode() {
  const order = ['off', 'night', 'sepia', 'dim'];
  const i = order.indexOf(S.prefs.pageMode || 'off');
  setPageMode(order[(i + 1) % order.length]);
  toast('Page mode: ' + (S.prefs.pageMode === 'off' ? 'Normal' : S.prefs.pageMode), null, 1400);
}
function stopAuto() {
  if (S.autoTimer) { clearInterval(S.autoTimer); S.autoTimer = null; }
  const sw = document.getElementById('swAuto');
  if (sw) sw.checked = false;
  if (D.autoBar) D.autoBar.hidden = true;
}
function toggleAuto(force) {
  if (!S.doc && force !== false) { toast('Open a PDF first', 'err', 1600); return; }
  const on = force !== undefined ? force : !S.autoTimer;
  stopAuto();
  if (on) {
    const speed = S.prefs.autoSpeed || 30;
    S.autoTimer = setInterval(() => {
      try { D.viewer.scrollTop += (speed / 20); } catch (e) {}
    }, 50);
    const sw = document.getElementById('swAuto');
    if (sw) sw.checked = true;
    if (D.autoBar) D.autoBar.hidden = false;
    toast('Auto-scroll on — adjust speed anytime', null, 1800);
  }
}

/* ---------- speech with rate ---------- */
stopSpeakingOrigCheck: {
  // (label block keeps linters calm; real override below)
}
toggleSpeak = async function () {
  if (!S.doc) return;
  if (!('speechSynthesis' in window)) { toast('Speech not supported here', 'err', 2000); return; }
  if (S.speaking) {
    try { speechSynthesis.cancel(); } catch (e) {}
    S.speaking = false;
    toast('Stopped reading', null, 1400);
    return;
  }
  const text = ((await getPageText(S.pageNum)) || '').replace(/\s+/g, ' ').trim();
  if (!text) { toast('No readable text on this page', 'err', 2000); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 9000));
    u.rate = S.ttsRate || 1;
    u.onend = () => { S.speaking = false; };
    u.onerror = () => { S.speaking = false; };
    S.speaking = true;
    speechSynthesis.speak(u);
    toast('Reading page ' + S.pageNum + '… (Esc stops)', null, 2200);
  } catch (e) {
    S.speaking = false;
    toast('Could not start speech', 'err', 2000);
  }
};

/* (features page removed per user request — was: mega feature list modal) */

/* ---------- wrap core hooks for speed + sync ---------- */
const _updateUI_orig = updateUI;
updateUI = function () {
  _updateUI_orig();
  try {
    paintBookmarkBtn();
    const lbl = document.getElementById('bmPageLbl');
    if (lbl) lbl.textContent = '· p.' + S.pageNum;
    if (typeof syncSbBtns === 'function') syncSbBtns();
  } catch (e) {}
};
/* Bottom-bar quick actions: mirror active states (annotate/spread/saved/night/scroll) */
function syncSbBtns() {
  try {
    const set = (id, on) => { const b = document.getElementById(id); if (b) b.classList.toggle('on', !!on); };
    set('sbAnnotate', S.annotMode && S.tool !== 'textsel');
    set('sbTextsel', S.annotMode && S.tool === 'textsel');
    set('sbSpread', S.spreadOn);
    set('sbBookmark', typeof isBookmarked === 'function' ? isBookmarked(S.pageNum) : false);
    set('sbNight', !!(S.prefs && S.prefs.pageMode && S.prefs.pageMode !== 'off'));
    set('sbAuto', !!S.autoTimer);
  } catch (e) {}
}
const _goToPage_orig = goToPage;
goToPage = function (n, smooth) {
  const before = S.pageNum;
  const r = _goToPage_orig(n, smooth);
  try {
    if (S.doc && S.pageNum !== before) {
      S.stats.pagesRead = (S.stats.pagesRead || 0) + 1;
      saveStats();
      renderStats();
    }
    paintBookmarkBtn();
    if (typeof renderSession === 'function') renderSession();
  } catch (e) {}
  return r;
};
const _restoreLastPage_orig = restoreLastPage;
restoreLastPage = async function () {
  if (S.prefs.resume === false) return;
  return _restoreLastPage_orig();
};
const _renderPage_orig = renderPage;
let _activeRenders = 0;
const _renderWaiters = [];
renderPage = async function (pv) {
  if (!S.doc || !pv) return;
  if (pv.rendered && pv.epoch === S.epoch) return;
  if (pv.rendering) return;
  if (_activeRenders >= 3) {
    if (_renderWaiters.indexOf(pv) === -1 && _renderWaiters.length < 40) _renderWaiters.push(pv);
    setTimeout(() => {
      const i = _renderWaiters.indexOf(pv);
      if (i >= 0) _renderWaiters.splice(i, 1);
      renderPage(pv);
    }, 120);
    return;
  }
  _activeRenders++;
  try {
    await _renderPage_orig(pv);
  } finally {
    _activeRenders--;
    const nxt = _renderWaiters.shift();
    if (nxt) setTimeout(() => renderPage(nxt), 0);
  }
};
const _onDocReady_orig = onDocumentReady;
onDocumentReady = async function (doc, name, size) {
  S.editSel = new Set();
  const r = await _onDocReady_orig(doc, name, size);
  try {
    S.stats.docs = (S.stats.docs || 0) + 1;
    saveStats();
    buildEditGrid();
    renderAnnotsList();
    renderBmList();
    renderStats();
    paintBookmarkBtn();
    const mt = document.getElementById('metaTitle');
    if (mt) mt.value = (S.props && (S.props.Title || '')) || '';
    const ma = document.getElementById('metaAuthor');
    if (ma) ma.value = (S.props && (S.props.Author || '')) || '';
    const sr = document.getElementById('splitRange');
    if (sr && !sr.value) sr.value = S.numPages > 1 ? '1-' + Math.min(3, S.numPages) : '1';
    setTimeout(() => { try { wordCountStats(true); } catch (e) {} }, 800);
    schedulePrefetch();
  } catch (e) {}
  return r;
};

/* --------------------------------------------------------------------------
   38b. MAX POWER V2 — unlimited free edit + marker + reading engines
   Fast, local, silent. All functions are defensive (no-ops without a doc).
   -------------------------------------------------------------------------- */
function parsePageRange(str, max) {
  const out = new Set();
  if (!str || !max) return [];
  str.split(',').forEach(part => {
    part = part.trim();
    if (!part) return;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (a > b) { const t = a; a = b; b = t; }
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) out.add(i);
    } else {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= max) out.add(n);
    }
  });
  return Array.from(out).sort((a, b) => a - b);
}
function duplicateSelected() {
  const sel = selPages();
  mutatePdf('Duplicating ' + sel.length + ' page(s)', async (src) => {
    const copied = await (async () => {
      const out = src;
      const idx = sel.map(p => p - 1);
      const pages = await out.copyPages(out, idx);
      pages.forEach(p => out.addPage(p));
      return null;
    })();
  }, 'duplicated.pdf');
}
function reversePages() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  (async () => {
    try {
      setStatus('Reversing…', 'busy');
      showProgress(25);
      const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
      const n = src.getPageCount();
      const out = await PDFLib.PDFDocument.create();
      const copied = await out.copyPages(src, Array.from({ length: n }, (_, i) => n - 1 - i));
      copied.forEach(p => out.addPage(p));
      const bytes = await out.save({ useObjectStreams: true });
      hideProgress();
      setStatus('Ready', 'ok');
      await openResultBytes(bytes, 'reversed.pdf');
      toast('Page order reversed', 'ok');
    } catch (e) {
      console.warn(e);
      hideProgress();
      setStatus('Ready');
      toast('Reverse failed', 'err', 2600);
    }
  })();
}
async function splitRangeDownload() {
  const inp = document.getElementById('splitRange');
  const raw = inp && inp.value.trim() ? inp.value.trim() : '';
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!raw) { toast('Type a range like 1-3, 5', null, 2000); return; }
  const sel = parsePageRange(raw, S.numPages);
  if (!sel.length) { toast('No valid pages in that range', 'err', 2200); return; }
  if (!needLib()) return;
  try {
    setStatus('Splitting…', 'busy');
    showProgress(30);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(src, sel.map(p => p - 1));
    copied.forEach(p => out.addPage(p));
    const bytes = await out.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    downloadBytes(bytes, 'split-p' + sel[0] + (sel.length > 1 ? '-plus' + (sel.length - 1) : '') + '.pdf');
    toast('Split ' + sel.length + ' page(s) — downloaded', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Split failed', 'err', 2600);
  }
}
async function addPageNumbers() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  try {
    setStatus('Numbering…', 'busy');
    showProgress(30);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    const font = await src.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = src.getPages();
    pages.forEach((pg, i) => {
      const { width } = pg.getSize();
      const label = '— ' + (i + 1) + ' —';
      const size = 11;
      const tw = font.widthOfTextAtSize(label, size);
      pg.drawText(label, { x: width / 2 - tw / 2, y: 24, size, font, color: PDFLib.rgb(0.35, 0.4, 0.5), opacity: 0.9 });
    });
    const bytes = await src.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'numbered.pdf');
    toast('Page numbers added', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Numbering failed', 'err', 2600);
  }
}
async function saveMetadata() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  const t = (document.getElementById('metaTitle') || {}).value || '';
  const a = (document.getElementById('metaAuthor') || {}).value || '';
  const su = (document.getElementById('metaSubject') || {}).value || '';
  const kw = (document.getElementById('metaKeywords') || {}).value || '';
  try {
    setStatus('Saving metadata…', 'busy');
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    if (t.trim()) src.setTitle(t.trim().slice(0, 120));
    if (a.trim()) src.setAuthor(a.trim().slice(0, 120));
    if (su.trim()) src.setSubject(su.trim().slice(0, 200));
    if (kw.trim()) src.setKeywords(kw.split(',').map(k => k.trim()).filter(Boolean).slice(0, 20));
    src.setProducer('Heros PDF');
    src.setModificationDate(new Date());
    const bytes = await src.save({ useObjectStreams: true });
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'metadata.pdf');
    toast('Metadata saved', 'ok');
  } catch (e) {
    console.warn(e);
    setStatus('Ready');
    toast('Metadata failed', 'err', 2600);
  }
}
async function getAllText(maxChars) {
  if (!S.doc) return '';
  await ensureSearchIndex();
  const full = (S.searchIndex || []).join('\n');
  return maxChars ? full.slice(0, maxChars) : full;
}
async function exportTXT() {
  if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
  const txt = await getAllText(2000000);
  if (!txt.trim()) { toast('No extractable text in this PDF', 'err', 2200); return; }
  const name = ((S.file && S.file.name) || 'document.pdf').replace(/\.pdf$/i, '') + '.txt';
  downloadBytes(new Blob([txt], { type: 'text/plain' }), name, 'text/plain');
  toast('Exported ' + txt.split(/\s+/).filter(Boolean).length + ' words as .TXT', 'ok');
}
async function wordCountStats(silent) {
  if (!S.doc) { if (!silent) toast('Open a PDF first', 'err', 1600); return null; }
  const txt = await getAllText(2000000);
  const words = txt.trim() ? txt.trim().split(/\s+/).length : 0;
  const chars = txt.length;
  const mins = Math.max(1, Math.round(words / 200));
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kvWords', words.toLocaleString());
  set('kvChars', chars.toLocaleString());
  set('kvRead', '~' + mins + ' min');
  if (!silent) {
    openModal({
      title: 'Word count — page insights',
      icon: 'i-chart',
      html: '<div class="prop-row"><div class="k">Words</div><div class="v"><b>' + words.toLocaleString() + '</b></div></div>' +
        '<div class="prop-row"><div class="k">Characters</div><div class="v">' + chars.toLocaleString() + '</div></div>' +
        '<div class="prop-row"><div class="k">Reading time</div><div class="v">~' + mins + ' min at 200 wpm</div></div>' +
        '<div class="prop-row"><div class="k">Pages</div><div class="v">' + S.numPages + '</div></div>' +
        '<div class="prop-row"><div class="k">Avg / page</div><div class="v">' + (S.numPages ? Math.round(words / S.numPages).toLocaleString() : '0') + ' words</div></div>'
    });
  }
  return { words, chars, mins };
}
function toggleSpread(force) {
  if (!S.doc && force !== false) { toast('Open a PDF first', 'err', 1600); return; }
  const on = force !== undefined ? force : !S.spreadOn;
  S.spreadOn = on;
  S.prefs.spread = on;
  savePrefs();
  document.body.classList.toggle('spread-on', on);
  if (D.pages) D.pages.classList.toggle('spread', on);
  const sw = document.getElementById('swSpread');
  if (sw) sw.checked = on;
  try { updateUI(); } catch (e) {}
  if (on && !S.continuous) setMode(true);
  else { layout(true); renderVisible(true); }
  if (on) toast('Two-page spread on — like a book', 'ok', 1600);
}
function setGap(px) {
  S.pageGap = px;
  S.prefs.gap = px;
  savePrefs();
  if (D.pages) D.pages.style.gap = px + 'px';
  const l = document.getElementById('pageGapLbl');
  if (l) l.textContent = px;
}
function stampAnnot(text) {
  if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
  if (!S.annotMode) toggleAnnotate(true);
  const pv = S.pageViews[S.pageNum - 1];
  if (!pv || !pv.viewport) { toast('Page not ready yet', null, 1600); return; }
  const cx = pv.viewport.width / 2, cy = pv.viewport.height / 2;
  let pt;
  try { pt = pv.viewport.convertToPdfPoint(cx, cy); } catch (e) { return; }
  const st = {
    id: makeStrokeId(), tool: 'text',
    color: '#1d4ed8', sizePt: 34,
    pts: [[pt[0], pt[1]]],
    text: '【 ' + text + ' 】'
  };
  pageStrokes(pv.num).push(st);
  S.undoStack.push({ type: 'add', page: pv.num, stroke: st });
  S.redoStack.length = 0;
  try { updateAnnotUndoUI(); } catch (e) {}
  saveAnnotsSoon();
  drawAnnots(pv);
  try { renderAnnotsList(); } catch (e) {}
  toast('Stamped “' + text + '” on page ' + pv.num, 'ok', 1800);
}
function importMarksFile(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      const pages = data.pages || data;
      if (!pages || typeof pages !== 'object') throw new Error('bad');
      let n = 0;
      Object.keys(pages).forEach(k => {
        const arr = pages[k];
        if (Array.isArray(arr) && arr.length) {
          if (!S.annots[k]) S.annots[k] = [];
          arr.forEach(st => { if (st && st.pts) { S.annots[k].push(st); n++; } });
        }
      });
      saveAnnotsNow();
      redrawAllAnnots();
      try { renderAnnotsList(); } catch (e) {}
      toast('Imported ' + n + ' marker(s)', 'ok');
    } catch (e) {
      toast('Invalid markers file', 'err', 2200);
    }
  };
  rd.readAsText(file);
}
function backupAll() {
  try {
    const data = {
      exportedAt: Date.now(),
      profile: S.profile,
      prefs: S.prefs,
      bookmarks: S.bookmarks,
      stats: S.stats,
      ttsRate: S.ttsRate
    };
    downloadBytes(JSON.stringify(data, null, 2), 'pdfstudio-backup.json', 'application/json');
    toast('Backup downloaded', 'ok', 1600);
  } catch (e) { toast('Backup failed', 'err', 1800); }
}
function resetAll() {
  openModal({
    title: 'Reset everything?',
    icon: 'i-trash',
    html: '<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.6">Clears profile, bookmarks, stats, prefs and all markers stored on this device. The open PDF stays open.</p>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn danger" id="resetGo" style="background:rgba(220,38,38,.14);color:var(--danger);height:36px;padding:0 14px;border-radius:12px;font-weight:700">Reset all</button>',
    onMount(m) {
      m.querySelector('#resetGo').addEventListener('click', async () => {
        try {
          ['pdfstudio-prefs-v2', 'pdfstudio-profile-v1', 'pdfstudio-stats-v1', 'pdfstudio-bookmarks-v1', 'pdfstudio-tts-v1', 'pdfstudio-theme'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
          try { await IDB.clear(); } catch (e) {}
          S.bookmarks = {};
          S.stats = { docs: 0, pagesRead: 0 };
          S.annots = {};
          saveAnnotsNow();
        } catch (e) {}
        closeModal();
        try { renderRecent(); renderBmList(); renderAnnotsList(); renderStats(); applyPrefs(); } catch (e) {}
        toast('All local data cleared', 'ok', 1800);
      });
    }
  });
}
/* prefetch next pages during idle — makes big PDFs feel instant */
let _prefetchIdle = null;
function prefetchNext() {
  if (!S.doc || S.indexing) return;
  try {
    const nums = Array.from(S.visiblePages).sort((a, b) => a - b);
    if (!nums.length) return;
    const last = nums[nums.length - 1];
    for (let i = 1; i <= 2; i++) {
      const pv = S.pageViews[last - 1 + i];
      if (pv && !pv.rendered && !pv.rendering) {
        if ('requestIdleCallback' in window) requestIdleCallback(() => renderPage(pv), { timeout: 1500 });
        else setTimeout(() => renderPage(pv), 300 * i);
      }
    }
  } catch (e) {}
}
function schedulePrefetch() {
  clearTimeout(_prefetchIdle);
  _prefetchIdle = setTimeout(prefetchNext, 600);
}

/* --------------------------------------------------------------------------
   38c. MAX POWER V3 — even more unlimited free tools
   Edit smart-select + reorder + header/footer + merge queue.
   Marker thickness + note size + edit-note. Search options + export.
   Accent + sidebar width + text-layer speed + present timer + session.
   -------------------------------------------------------------------------- */
let mergeQueue = [];
function selEven() {
  if (!S.doc) return;
  S.editSel.clear();
  for (let i = 2; i <= S.numPages; i += 2) S.editSel.add(i);
  buildEditGrid();
  toast(S.editSel.size + ' even pages selected', 'ok', 1300);
}
function selOdd() {
  if (!S.doc) return;
  S.editSel.clear();
  for (let i = 1; i <= S.numPages; i += 2) S.editSel.add(i);
  buildEditGrid();
  toast(S.editSel.size + ' odd pages selected', 'ok', 1300);
}
function keepOnlySelected() {
  const sel = selPages();
  if (!S.doc) return;
  const drop = [];
  for (let i = 1; i <= S.numPages; i++) if (sel.indexOf(i) === -1) drop.push(i);
  if (!drop.length) { toast('Nothing to remove', null, 1500); return; }
  mutatePdf('Keeping ' + sel.length + ' page(s)', async (src) => {
    drop.slice().sort((a, b) => b - a).forEach(p => { try { src.removePage(p - 1); } catch (e) {} });
  }, 'kept-pages.pdf');
}
function moveSelectedTo(edge) {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  const sel = selPages();
  (async () => {
    try {
      setStatus('Moving…', 'busy');
      showProgress(25);
      const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
      const n = src.getPageCount();
      const selSet = new Set(sel);
      const rest = [];
      for (let i = 1; i <= n; i++) if (!selSet.has(i)) rest.push(i - 1);
      const order = edge === 'start' ? sel.map(p => p - 1).concat(rest) : rest.concat(sel.map(p => p - 1));
      const out = await PDFLib.PDFDocument.create();
      const copied = await out.copyPages(src, order);
      copied.forEach(p => out.addPage(p));
      const bytes = await out.save({ useObjectStreams: true });
      hideProgress();
      setStatus('Ready', 'ok');
      await openResultBytes(bytes, 'reordered.pdf');
      toast('Moved ' + sel.length + ' page(s) to ' + edge, 'ok');
    } catch (e) {
      console.warn(e);
      hideProgress();
      setStatus('Ready');
      toast('Move failed', 'err', 2600);
    }
  })();
}
function rotateAllPages() {
  if (!S.doc) return;
  S.editSel.clear();
  for (let i = 1; i <= S.numPages; i++) S.editSel.add(i);
  buildEditGrid();
  rotateSelected();
}
async function splitEachPage() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  if (S.numPages > 30) {
    openModal({
      title: 'Split each page?',
      icon: 'i-split',
      html: '<p style="margin:0;font-size:13px;color:var(--muted);line-height:1.6">This will trigger <b>' + S.numPages + '</b> downloads (one per page). Continue?</p>',
      footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="splitEachGo">Split all</button>',
      onMount(m) {
        m.querySelector('#splitEachGo').addEventListener('click', () => { closeModal(); splitEachPageGo(); });
      }
    });
    return;
  }
  splitEachPageGo();
}
async function splitEachPageGo() {
  try {
    setStatus('Splitting…', 'busy');
    const srcBytes = await S.file.arrayBuffer();
    for (let i = 1; i <= S.numPages; i++) {
      const src = await PDFLib.PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const out = await PDFLib.PDFDocument.create();
      const copied = await out.copyPages(src, [i - 1]);
      copied.forEach(p => out.addPage(p));
      const bytes = await out.save({ useObjectStreams: true });
      downloadBytes(bytes, 'page-' + i + '.pdf');
      showProgress((i / S.numPages) * 100);
      await new Promise(r => setTimeout(r, 120));
    }
    hideProgress();
    setStatus('Ready', 'ok');
    toast('Split into ' + S.numPages + ' files', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Split-each failed', 'err', 2600);
  }
}
async function addHeaderFooter() {
  const top = ((document.getElementById('hfTop') || {}).value || '').trim().slice(0, 80);
  const bottom = ((document.getElementById('hfBottom') || {}).value || '').trim().slice(0, 80);
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!top && !bottom) { toast('Type a top or bottom line first', null, 2000); return; }
  if (!needLib()) return;
  try {
    setStatus('Stamping…', 'busy');
    showProgress(30);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    const font = await src.embedFont(PDFLib.StandardFonts.Helvetica);
    src.getPages().forEach(pg => {
      const { width, height } = pg.getSize();
      if (top) {
        const tw = font.widthOfTextAtSize(top, 10);
        pg.drawText(top, { x: width / 2 - tw / 2, y: height - 28, size: 10, font, color: PDFLib.rgb(0.3, 0.35, 0.45), opacity: 0.95 });
      }
      if (bottom) {
        const bw = font.widthOfTextAtSize(bottom, 10);
        pg.drawText(bottom, { x: width / 2 - bw / 2, y: 22, size: 10, font, color: PDFLib.rgb(0.3, 0.35, 0.45), opacity: 0.95 });
      }
    });
    const bytes = await src.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'header-footer.pdf');
    toast('Header/footer applied', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Stamp failed', 'err', 2600);
  }
}
function renderMergeList() {
  const box = document.getElementById('mergeList');
  const row = document.getElementById('mergeGoRow');
  if (!box) return;
  box.innerHTML = '';
  if (row) row.hidden = mergeQueue.length < 2;
  if (!mergeQueue.length) return;
  mergeQueue.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'bm-item';
    div.innerHTML = '<div class="n">' + (i + 1) + '</div>' +
      '<div class="meta"><div class="tt">' + esc(f.name) + '</div>' +
      '<div class="ss">' + esc((f.size / 1024).toFixed(0) + ' KB') + '</div></div>' +
      '<button class="x" data-a="up" title="Move up">▲</button>' +
      '<button class="x" data-a="dn" title="Move down">▼</button>' +
      '<button class="x" data-a="rm" title="Remove"><svg class="ic ic-sm"><use href="#i-x"/></svg></button>';
    div.querySelector('[data-a="rm"]').addEventListener('click', () => { mergeQueue.splice(i, 1); renderMergeList(); });
    div.querySelector('[data-a="up"]').addEventListener('click', () => { if (i > 0) { const t = mergeQueue[i - 1]; mergeQueue[i - 1] = mergeQueue[i]; mergeQueue[i] = t; renderMergeList(); } });
    div.querySelector('[data-a="dn"]').addEventListener('click', () => { if (i < mergeQueue.length - 1) { const t = mergeQueue[i + 1]; mergeQueue[i + 1] = mergeQueue[i]; mergeQueue[i] = t; renderMergeList(); } });
    box.appendChild(div);
  });
}
function queueMergeFiles(files) {
  if (!files || !files.length) return;
  Array.from(files).forEach(f => {
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') mergeQueue.push(f);
  });
  renderMergeList();
  if (mergeQueue.length) toast(mergeQueue.length + ' file(s) queued — reorder then Merge', 'ok', 2000);
}
async function doMergeQueue() {
  if (mergeQueue.length < 2) { toast('Queue at least 2 PDFs', 'err', 2000); return; }
  await doMerge(mergeQueue);
  mergeQueue = [];
  renderMergeList();
}
/* marker V3 */
let noteFontSize = 15;
function setThickness(px) {
  S.annotSize = px;
  const sz = document.getElementById('annotSize');
  if (sz) sz.value = px;
  document.querySelectorAll('#thickSeg button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.th, 10) === px));
}
function editTextNote(pageNum, strokeId) {
  const arr = pageStrokes(pageNum);
  const st = arr.find(s => s.id === strokeId);
  if (!st || st.tool !== 'text') return;
  openModal({
    title: 'Edit note — page ' + pageNum,
    icon: 'i-text',
    html: '<textarea class="annot-text-input" id="editNoteField">' + esc(st.text || '') + '</textarea>',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="editNoteGo">Save</button>',
    onMount(m) {
      m.querySelector('#editNoteGo').addEventListener('click', () => {
        const v = m.querySelector('#editNoteField').value.trim().slice(0, 600);
        if (v) st.text = v;
        saveAnnotsSoon();
        const pv = S.pageViews[pageNum - 1];
        if (pv) drawAnnots(pv);
        try { renderAnnotsList(); } catch (e) {}
        closeModal();
        toast('Note updated', 'ok', 1400);
      });
    }
  });
}
/* search V3 */
S.searchCase = false;
S.searchWhole = false;
function matchNeedle(hay, needle) {
  if (!S.searchCase) { hay = hay.toLowerCase(); needle = needle.toLowerCase(); }
  if (!S.searchWhole) return hay.indexOf(needle);
  const escN = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = S.searchCase ? 'g' : 'gi';
  const m = new RegExp('\\b' + escN + '\\b', flags).exec(hay);
  return m ? m.index : -1;
}
async function exportSearchResults() {
  if (!S.searchResults.length) { toast('No search results to export', 'err', 1600); return; }
  const q = S.searchQuery || '';
  let out = 'Heros PDF — search export\nQuery: ' + q + '\nFile: ' + ((S.file && S.file.name) || '') + '\nCount: ' + S.searchResults.length + '\n\n';
  S.searchResults.slice(0, 800).forEach((r, i) => {
    const ctx = (r.text || '').slice(Math.max(0, r.index - 80), r.index + q.length + 80).replace(/\s+/g, ' ');
    out += (i + 1) + '. p.' + r.page + ' — …' + ctx + '…\n';
  });
  downloadBytes(new Blob([out], { type: 'text/plain' }), 'search-results.txt', 'text/plain');
  toast('Search results exported', 'ok', 1600);
}
/* hub V3 */
function setAccent(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return;
  const root = document.documentElement;
  const dark = (Theme.currentResolved() || 'dark') === 'dark';
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-h', color);
  root.style.setProperty('--accent-soft', color + '26');
  root.style.setProperty('--accent-ring', color + '66');
  try { lsSet('pdfstudio-accent-v1', { color }); } catch (e) {}
  const lbl = document.getElementById('accentLbl');
  if (lbl) lbl.textContent = color;
  const pick = document.getElementById('accentPick');
  if (pick && pick.value !== color) pick.value = color;
}
function applyAccent() {
  try {
    const saved = lsGet('pdfstudio-accent-v1', null);
    if (saved && saved.color) setAccent(saved.color);
  } catch (e) {}
}
function setSideW(px) {
  px = Math.max(260, Math.min(420, parseInt(px, 10) || 308));
  document.documentElement.style.setProperty('--side-w', px + 'px');
  try { lsSet('pdfstudio-sidew-v1', { w: px }); } catch (e) {}
  const l = document.getElementById('sideWLbl');
  if (l) l.textContent = px;
  const s = document.getElementById('sideW');
  if (s && String(s.value) !== String(px)) s.value = px;
}
function applySideW() {
  try {
    const saved = lsGet('pdfstudio-sidew-v1', null);
    if (saved && saved.w) setSideW(saved.w);
  } catch (e) {}
}
function setTextLayer(on) {
  S.prefs.textLayer = on !== false;
  savePrefs();
  document.body.classList.toggle('no-text', S.prefs.textLayer === false);
  const sw = document.getElementById('swText');
  if (sw) sw.checked = S.prefs.textLayer !== false;
  if (S.doc) { layout(true); renderVisible(true); }
}
let presentTimer = null;
function startPresentTimer() {
  stopPresentTimer();
  const el = document.getElementById('presentDelay');
  const sec = el ? parseInt(el.value, 10) || 0 : 0;
  if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
  if (!sec) { togglePresent(); return; }
  if (!document.body.classList.contains('present')) togglePresent();
  presentTimer = setInterval(() => {
    if (S.pageNum >= S.numPages) { stopPresentTimer(); return; }
    nextPage();
  }, sec * 1000);
  toast('Auto-advance every ' + sec + 's', 'ok', 1800);
}
function stopPresentTimer() {
  if (presentTimer) { clearInterval(presentTimer); presentTimer = null; }
}
let sessionSecs = 0;
setInterval(() => {
  sessionSecs++;
  const el = document.getElementById('kvTime');
  if (el && S.doc) {
    const m = Math.floor(sessionSecs / 60), s = sessionSecs % 60;
    el.textContent = m + ':' + String(s).padStart(2, '0');
  }
}, 1000);
function renderSession() {
  const p = document.getElementById('kvProg');
  if (p) p.textContent = S.doc ? (S.pageNum + ' / ' + S.numPages + ' · ' + Math.round((S.pageNum / Math.max(1, S.numPages)) * 100) + '%') : '—';
}
async function backupAllFull() {
  try {
    let allMarks = {};
    try {
      const store = await ANN.get('__all__').catch(() => null);
      void store;
    } catch (e) {}
    allMarks.current = { docId: S.docId, pages: S.annots || {} };
    const data = {
      exportedAt: Date.now(), version: 3,
      profile: S.profile, prefs: S.prefs, bookmarks: S.bookmarks,
      stats: S.stats, ttsRate: S.ttsRate,
      accent: lsGet('pdfstudio-accent-v1', null),
      sideW: lsGet('pdfstudio-sidew-v1', null),
      marks: allMarks
    };
    downloadBytes(JSON.stringify(data, null, 2), 'pdfstudio-full-backup.json', 'application/json');
    toast('Full backup downloaded', 'ok', 1600);
  } catch (e) { toast('Backup failed', 'err', 1800); }
}
function restoreAllFull(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (d.profile) { S.profile = d.profile; saveProfile(); }
      if (d.prefs) { S.prefs = Object.assign(S.prefs, d.prefs); savePrefs(); }
      if (d.bookmarks) { S.bookmarks = d.bookmarks; saveBookmarks(); }
      if (d.stats) { S.stats = d.stats; saveStats(); }
      if (d.ttsRate) { S.ttsRate = d.ttsRate; lsSet('pdfstudio-tts-v1', { rate: d.ttsRate }); }
      if (d.accent && d.accent.color) lsSet('pdfstudio-accent-v1', d.accent);
      if (d.sideW && d.sideW.w) lsSet('pdfstudio-sidew-v1', d.sideW);
      if (d.marks && d.marks.current && d.marks.current.pages && S.docId && d.marks.current.docId === S.docId) {
        S.annots = d.marks.current.pages;
        saveAnnotsNow();
        redrawAllAnnots();
      }
      applyPrefs();
      applyAccent();
      applySideW();
      try { renderBmList(); renderStats(); renderAnnotsList(); } catch (e) {}
      toast('Backup restored', 'ok', 1800);
    } catch (e) { toast('Invalid backup file', 'err', 2200); }
  };
  rd.readAsText(file);
}

/* ---------- wire power UI ---------- */
function wirePower() {
  const on = (sel, ev, fn) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el && !el.dataset.pwired) { el.dataset.pwired = '1'; el.addEventListener(ev, fn); }
  };
  on(D.btnEdit, 'click', openEditPane);
  on(D.btnBookmark, 'click', () => toggleBookmark());
  on(D.btnNight, 'click', cyclePageMode);
  on('#sbAnnotate', 'click', () => { toggleAnnotate(); syncSbBtns(); });
  on('#sbTextsel', 'click', () => { if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; } toggleAnnotate(true); setAnnotTool('textsel'); syncSbBtns(); });
  on('#sbEdit', 'click', () => openEditPane());
  on('#sbBookmark', 'click', () => { toggleBookmark(); syncSbBtns(); });
  on('#sbSpread', 'click', () => { toggleSpread(); syncSbBtns(); });
  on('#sbNight', 'click', () => { cyclePageMode(); syncSbBtns(); });
  on('#sbAuto', 'click', () => { toggleAuto(); syncSbBtns(); });
  on('#sbSpeak', 'click', () => toggleSpeak());
  on('#sbPresent', 'click', () => togglePresent());
  on('#sbFull', 'click', () => toggleFullscreen());
  on('#sbTheme', 'click', () => Theme.toggle());

  on('#btnMerge', 'click', startMerge);
  on(D.mergeInput, 'change', (e) => {
    // snapshot first: FileList is LIVE — clearing the input empties it
    const f = Array.from(e.target.files || []);
    e.target.value = '';
    if (!f.length) return;
    const before = mergeQueue.length;
    queueMergeFiles(f);
    // one-click merge: a fresh pick of 2+ files merges immediately.
    // Single adds stay queued for reorder-then-merge via "Merge queued files".
    if (before === 0 && mergeQueue.length - before >= 2) doMergeQueue();
  });
  on('#btnEditAll', 'click', () => { if (!S.doc) return; for (let i = 1; i <= S.numPages; i++) S.editSel.add(i); buildEditGrid(); });
  on('#btnEditNone', 'click', () => { S.editSel.clear(); buildEditGrid(); });
  on('#btnEditFlip', 'click', () => { if (!S.doc) return; for (let i = 1; i <= S.numPages; i++) { if (S.editSel.has(i)) S.editSel.delete(i); else S.editSel.add(i); } buildEditGrid(); });
  on('#btnDelPages', 'click', deleteSelected);
  on('#btnExtractPages', 'click', extractSelectedReal);
  on('#btnRotPages', 'click', () => rotateSelected(1));
  on('#btnRotPagesL', 'click', () => rotateSelected(-1));
  on('#btnCopyAll2', 'click', () => copyAllText());
  on('#btnImgPage', 'click', exportPagePNG);
  on('#btnWatermark', 'click', watermarkApply);
  on('#btnOptimize', 'click', () => mutatePdf('Optimizing', async () => {}, 'optimized.pdf'));
  on('#btnAddBlank', 'click', () => mutatePdf('Adding page', async (src) => { src.addPage(); }, 'with-blank.pdf'));
  on('#btnMarksDraw', 'click', () => { toggleAnnotate(true); setAnnotTool('highlight'); switchPane('thumbs'); });
  on('#btnEraseStrokes', 'click', () => { toggleAnnotate(true); setAnnotTool('eraser'); switchPane('thumbs'); });
  on('#btnEraseEmbedded', 'click', removeEmbeddedAnnots);
  on('#btnTextSel', 'click', () => { toggleAnnotate(true); setAnnotTool('textsel'); switchPane('thumbs'); });
  on('#btnMarksClear', 'click', () => {
    if (!S.doc) return;
    const pages = Object.keys(S.annots).filter(p => (S.annots[p] || []).length);
    if (!pages.length) { toast('No markers to clear', null, 1500); return; }
    pages.forEach(p => { S.undoStack.push({ type: 'clear', page: Number(p), strokes: (S.annots[p] || []).slice() }); S.annots[p] = []; });
    S.redoStack.length = 0;
    try { updateAnnotUndoUI(); } catch (e) {}
    saveAnnotsSoon();
    redrawAllAnnots();
    renderAnnotsList();
    toast('All markers cleared (undo available)', 'ok', 2000);
  });
  on('#btnMarksExport', 'click', () => {
    if (!S.doc) { toast('Open a PDF first', 'err', 1600); return; }
    downloadBytes(JSON.stringify({ doc: S.docId, exportedAt: Date.now(), pages: S.annots }, null, 2), 'markers-backup.json', 'application/json');
    toast('Markers downloaded', 'ok', 1600);
  });
  on('#btnAddBookmark', 'click', () => toggleBookmark());
  on('#marksSeg', 'click', (e) => {
    const b = e.target.closest('button[data-mtab]');
    if (!b) return;
    document.querySelectorAll('#marksSeg button').forEach(x => x.classList.toggle('on', x === b));
    const t = b.dataset.mtab;
    const a = document.getElementById('mtab-annots');
    const m = document.getElementById('mtab-bookmarks');
    if (a) a.hidden = t !== 'annots';
    if (m) m.hidden = t !== 'bookmarks';
  });
  on('#pageModeSeg', 'click', (e) => {
    const b = e.target.closest('button[data-pm]');
    if (!b) return;
    setPageMode(b.dataset.pm);
  });
  on('#swFocus', 'change', (e) => {
    document.body.classList.toggle('focus-mode', e.target.checked);
    setTimeout(() => { layout(true); renderVisible(true); }, 60);
  });
  on('#swAuto', 'change', (e) => toggleAuto(e.target.checked));
  on('#autoSpeed', 'input', (e) => {
    S.prefs.autoSpeed = parseInt(e.target.value, 10) || 30;
    savePrefs();
    const l = document.getElementById('autoSpeedLbl');
    if (l) l.textContent = S.prefs.autoSpeed;
    const ab = document.getElementById('autoBarSpeed');
    if (ab) ab.value = S.prefs.autoSpeed;
    if (S.autoTimer) toggleAuto(true);
  });
  on('#autoBarSpeed', 'input', (e) => {
    S.prefs.autoSpeed = parseInt(e.target.value, 10) || 30;
    savePrefs();
    const l = document.getElementById('autoSpeedLbl');
    if (l) l.textContent = S.prefs.autoSpeed;
    const s = document.getElementById('autoSpeed');
    if (s) s.value = S.prefs.autoSpeed;
    if (S.autoTimer) toggleAuto(true);
  });
  on('#autoBarClose', 'click', () => toggleAuto(false));
  on('#ttsRate', 'input', (e) => {
    S.ttsRate = (parseInt(e.target.value, 10) || 10) / 10;
    lsSet('pdfstudio-tts-v1', { rate: S.ttsRate });
    const l = document.getElementById('ttsRateLbl');
    if (l) l.textContent = S.ttsRate.toFixed(1) + '×';
  });
  on('#btnSpeak', 'click', () => toggleSpeak());
  on('#btnCopyText', 'click', () => copyPageText());
  on('#btnShare', 'click', shareFile);
  on('#swHQ', 'change', (e) => {
    S.prefs.hq = e.target.checked;
    savePrefs();
    applyPrefs();
    if (S.doc) { layout(true); renderVisible(true); }
    toast(e.target.checked ? 'High quality on' : 'Speed mode on', 'ok', 1400);
  });
  on('#swResume', 'change', (e) => { S.prefs.resume = e.target.checked; savePrefs(); });
  on('#swAutoOpen', 'change', (e) => {
    S.prefs.autoOpen = e.target.checked;
    savePrefs();
    try {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ autoFile: S.prefs.autoOpen, autoWeb: S.prefs.autoOpen });
      }
    } catch (err) {}
  });
  on(D.btnSpread, 'click', () => toggleSpread());
  on('#swSpread', 'change', (e) => toggleSpread(e.target.checked));
  on('#pageGap', 'input', (e) => setGap(parseInt(e.target.value, 10) || 18));
  on('#btnDupPages', 'click', duplicateSelected);
  on('#btnReversePages', 'click', reversePages);
  on('#btnSplitRange', 'click', splitRangeDownload);
  on('#btnPageNums', 'click', addPageNumbers);
  on('#btnMetaSave', 'click', saveMetadata);
  on('#btnExportTxt', 'click', exportTXT);
  on('#btnExportTxt2', 'click', exportTXT);
  on('#btnWordCount', 'click', () => wordCountStats(false));
  on('#btnWordCount2', 'click', () => wordCountStats(false));
  on('#btnMarksImport', 'click', () => { if (D.marksInput) D.marksInput.click(); });
  on(D.marksInput, 'change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) importMarksFile(f);
  });
  on('#exportQSeg', 'click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    S.exportQ = parseFloat(b.dataset.q) || 2.5;
    document.querySelectorAll('#exportQSeg button').forEach(x => x.classList.toggle('on', x === b));
    toast('Export quality: ' + b.textContent.trim(), 'ok', 1300);
  });
  document.querySelectorAll('.stamp-chip').forEach(ch => {
    if (!ch.dataset.v2wired) {
      ch.dataset.v2wired = '1';
      ch.addEventListener('click', () => stampAnnot(ch.dataset.stamp));
    }
  });
  on('#btnBackupAll', 'click', backupAllFull);
  on('#btnRestoreAll', 'click', () => { const el = document.getElementById('restoreInput'); if (el) el.click(); });
  on('#restoreInput', 'change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) restoreAllFull(f);
  });
  on('#btnResetAll', 'click', resetAll);
  /* V3 edit */
  on('#btnSelEven', 'click', selEven);
  on('#btnSelOdd', 'click', selOdd);
  on('#btnKeepOnly', 'click', keepOnlySelected);
  on('#btnMoveStart', 'click', () => moveSelectedTo('start'));
  on('#btnMoveEnd', 'click', () => moveSelectedTo('end'));
  on('#btnRotAll', 'click', rotateAllPages);
  on('#btnSplitEach', 'click', splitEachPage);
  on('#btnHeaderFooter', 'click', addHeaderFooter);
  on('#btnMergeGo', 'click', doMergeQueue);
  on('#btnMergeClear', 'click', () => { mergeQueue = []; renderMergeList(); });
  /* V3 marker */
  on('#thickSeg', 'click', (e) => {
    const b = e.target.closest('button[data-th]');
    if (!b) return;
    setThickness(parseInt(b.dataset.th, 10) || 8);
  });
  on('#noteSize', 'input', (e) => {
    noteFontSize = parseInt(e.target.value, 10) || 15;
    const l = document.getElementById('noteSizeLbl');
    if (l) l.textContent = noteFontSize;
  });
  /* V3 search */
  on('#swCase', 'click', (e) => {
    S.searchCase = !S.searchCase;
    e.currentTarget.classList.toggle('accent', S.searchCase);
    if (S.searchQuery) runSearch(S.searchQuery);
    toast('Case sensitive ' + (S.searchCase ? 'on' : 'off'), 'ok', 1200);
  });
  on('#swWhole', 'click', (e) => {
    S.searchWhole = !S.searchWhole;
    e.currentTarget.classList.toggle('accent', S.searchWhole);
    if (S.searchQuery) runSearch(S.searchQuery);
    toast('Whole word ' + (S.searchWhole ? 'on' : 'off'), 'ok', 1200);
  });
  on('#btnSearchExport', 'click', exportSearchResults);
  /* V3 hub */
  on('#accentPick', 'input', (e) => setAccent(e.target.value));
  document.querySelectorAll('[data-accent]').forEach(b => {
    if (!b.dataset.v3wired) { b.dataset.v3wired = '1'; b.addEventListener('click', () => setAccent(b.dataset.accent)); }
  });
  on('#sideW', 'input', (e) => setSideW(e.target.value));
  on('#swText', 'change', (e) => setTextLayer(e.target.checked));
  on('#presentDelay', 'input', (e) => {
    const v = parseInt(e.target.value, 10) || 0;
    const l = document.getElementById('presentDelayLbl');
    if (l) l.textContent = v ? v + 's' : 'off';
  });
  on('#btnPresentGo', 'click', startPresentTimer);
  on('#btnPresentStop', 'click', () => { stopPresentTimer(); if (document.body.classList.contains('present')) togglePresent(); });
  on('#btnShortcuts', 'click', () => showShortcuts());
  on('#btnProfileEdit', 'click', () => {
    openModal({
      title: 'Local profile',
      icon: 'i-user',
      html: '<label class="field-label" for="pfName">Display name</label>' +
        '<input class="field" id="pfName" maxlength="24" value="' + esc(S.profile.name || '') + '" style="margin-top:6px">' +
        '<div class="field-label" style="margin:4px 0 8px">Color</div>' +
        '<div class="tool-row" id="pfColors">' +
        ['#4c8dff', '#22c55e', '#b45cf0', '#ff6b6a', '#ff8a00', '#111418'].map(c =>
          '<button class="swatch' + (S.profile.color === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + ';width:30px;height:30px"></button>').join('') +
        '</div>',
      footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="pfGo">Save</button>',
      onMount(m) {
        let col = S.profile.color;
        m.querySelectorAll('#pfColors .swatch').forEach(s => s.addEventListener('click', () => {
          col = s.dataset.c;
          m.querySelectorAll('#pfColors .swatch').forEach(x => x.classList.toggle('on', x === s));
        }));
        m.querySelector('#pfGo').addEventListener('click', () => {
          const v = m.querySelector('#pfName').value.trim().slice(0, 24) || 'My Studio';
          S.profile.name = v;
          S.profile.color = col;
          saveProfile();
          applyPrefs();
          closeModal();
          toast('Profile saved', 'ok', 1500);
        });
      }
    });
  });
  // extra keys: D bookmark, E edit, N night, G spread, U underline, S strike
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!S.doc) return;
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); toggleBookmark(); }
    else if ((e.key === 'e' || e.key === 'E') && !S.annotMode) { e.preventDefault(); openEditPane(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); cyclePageMode(); }
    else if (e.key === 'g' || e.key === 'G') { e.preventDefault(); toggleSpread(); }
    else if (e.key === 'u' || e.key === 'U') {
      if (selHasTextInDoc()) { e.preventDefault(); convertSelectionToHighlight(true, 'underline'); }
      else if (S.annotMode) { e.preventDefault(); setAnnotTool('underline'); }
    }
    else if ((e.key === 's' || e.key === 'S') && S.annotMode) { e.preventDefault(); setAnnotTool('strike'); }
  });
  // manual scroll stops auto-scroll + idle prefetch for speed
  try {
    D.viewer.addEventListener('wheel', () => { if (S.autoTimer) stopAuto(); }, { passive: true });
    D.viewer.addEventListener('scroll', schedulePrefetch, { passive: true });
  } catch (e) {}
  // keep lists fresh after strokes change
  const _saveSoon = saveAnnotsSoon;
  saveAnnotsSoon = function () {
    _saveSoon();
    clearTimeout(saveAnnotsSoon._t);
    saveAnnotsSoon._t = setTimeout(() => { try { renderAnnotsList(); } catch (e) {} }, 1200);
  };
  setInterval(() => { if (S.doc) updateRecentPage(); }, 5000);
}

/* --------------------------------------------------------------------------
   39. Init (power + silent instant boot)
   -------------------------------------------------------------------------- */
(function init() {
  Theme.apply();
  try { applyAccent(); } catch (e) {}
  try { applySideW(); } catch (e) {}
  applyPrefs();
  try { applyAccent(); } catch (e) {}
  try { applySideW(); } catch (e) {}
  updateUI();
  updateStatusBar();
  renderRecent();
  initAnnotBar();
  try { wireSelBar(); } catch (e) { console.warn('selbar', e); }
  wirePower();
  try { renderMergeList(); } catch (e) {}
  try { renderSession(); } catch (e) {}
  buildEditGrid();
  renderAnnotsList();
  renderBmList();
  renderStats();
  paintBookmarkBtn();
  setStatus('Ready');
  D.pages.hidden = false;
  // silent boot: drop the transition-kill class on next frame (no weird animation)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { document.body.classList.remove('booting'); } catch (e) {}
  }));
  setTimeout(() => { try { document.body.classList.remove('booting'); } catch (e) {} }, 300);

  if (window.innerWidth <= 900) {
    D.sidebar.classList.remove('open');
  }

  const params = new URLSearchParams(location.search);
  const pdfUrl = params.get('pdf');
  if (pdfUrl) {
    loadFromUrl(pdfUrl);
  } else if (params.get('launch') === '1') {
    loadPendingFile();
  }
})();

/* --------------------------------------------------------------------------
   40. NEVAI PORTS — security, image FX, cleaners & creators
   Ported from NevaiPDF (MIT): pdf-operations.ts, decrypt, remove-blank,
   flatten, text/image input nodes. Adapted to this app's offline engine.
   -------------------------------------------------------------------------- */
function nevHexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const v = parseInt(m[1], 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

/* ---------- password security (REAL crypto via qpdf.wasm, Nevai pattern) ---------- */
let nevQpdfP = null;
function nevaiQpdf() {
  if (nevQpdfP) return nevQpdfP;
  nevQpdfP = (async () => {
    if (typeof Module === 'undefined') throw new Error('qpdf engine missing (vendor/qpdf.js)');
    const inst = await Module({
      locateFile: (p) => ((window.chrome && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('vendor/' + p) : ('vendor/' + p))
    });
    if (!inst || !inst.FS || typeof inst.callMain !== 'function') throw new Error('qpdf init failed');
    return inst;
  })();
  nevQpdfP.catch(() => { nevQpdfP = null; });
  return nevQpdfP;
}
function nevUid() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}
async function nevaiEncrypt() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  const upw = (document.getElementById('secUserPw') || {}).value || '';
  const opw = (document.getElementById('secOwnerPw') || {}).value || '';
  if (!upw) { toast('Type a user password first', 'err', 2000); return; }
  let qpdf;
  try { qpdf = await nevaiQpdf(); }
  catch (e) { toast('Security engine failed to load', 'err', 2600); return; }
  const uid = nevUid();
  const inP = '/tmp/nev_enc_in_' + uid + '.pdf';
  const outP = '/tmp/nev_enc_out_' + uid + '.pdf';
  try {
    setStatus('Locking…', 'busy');
    showProgress(30);
    qpdf.FS.writeFile(inP, new Uint8Array(await S.file.arrayBuffer()));
    // NevaiPDF encrypt-node args: --encrypt user owner 256 (+ restrictions when owner differs)
    const args = [inP, '--encrypt', upw, opw || upw, '256'];
    if (opw && opw !== upw) {
      args.push('--modify=none', '--extract=n', '--print=none', '--accessibility=n',
        '--annotate=n', '--assemble=n', '--form=n', '--modify-other=n');
    }
    args.push('--', outP);
    qpdf.callMain(args);
    const out = qpdf.FS.readFile(outP);
    if (!out || !out.length) throw new Error('empty output');
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(new Uint8Array(out), 'locked.pdf');
    toast('PDF locked with 256-bit encryption', 'ok');
  } catch (e) {
    console.warn(e);
    nevQpdfP = null; // failed callMain may poison the runtime — force fresh next time
    hideProgress();
    setStatus('Ready');
    toast('Lock failed', 'err', 2600);
  } finally {
    try { qpdf.FS.unlink(inP); } catch (e) {}
    try { qpdf.FS.unlink(outP); } catch (e) {}
  }
}
async function nevaiFileLooksEncrypted() {
  try {
    if (S.props && S.props.IsEncrypted) return true;
    if (!S.file) return false;
    const buf = new Uint8Array(await S.file.arrayBuffer());
    const dec = new TextDecoder('latin1');
    const head = dec.decode(buf.slice(0, 4000));
    const tail = dec.decode(buf.slice(Math.max(0, buf.length - 12000)));
    return head.indexOf('/Encrypt') !== -1 || tail.indexOf('/Encrypt') !== -1;
  } catch (e) { return false; }
}
async function nevaiDecrypt() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  openModal({
    title: 'Unlock encrypted PDF',
    icon: 'i-lock',
    html: '<label class="field-label" for="decPwField">File password</label>' +
      '<input class="pw-input" type="password" id="decPwField" autocomplete="current-password" placeholder="••••••••" style="margin-top:6px">',
    footer: '<button class="btn" data-close="1">Cancel</button><button class="btn accent" id="decGo">Unlock & open</button>',
    onMount(m) {
      const inp = m.querySelector('#decPwField');
      const go = async () => {
        const pw = inp.value;
        if (!pw) return;
        closeModal();
        let qpdf;
        try { qpdf = await nevaiQpdf(); }
        catch (e) { toast('Security engine failed to load', 'err', 2600); return; }
        const uid = nevUid();
        const inP = '/tmp/nev_dec_in_' + uid + '.pdf';
        const outP = '/tmp/nev_dec_out_' + uid + '.pdf';
        try {
          setStatus('Unlocking…', 'busy');
          showProgress(30);
          qpdf.FS.writeFile(inP, new Uint8Array(await S.file.arrayBuffer()));
          // Nevai remove-restrictions pattern, single shot: --password only when encrypted
          const enc = await nevaiFileLooksEncrypted();
          const args = enc ? [inP, '--password=' + pw, '--decrypt', '--', outP]
                           : [inP, '--decrypt', '--', outP];
          try {
            qpdf.callMain(args);
          } catch (e) {
            nevQpdfP = null; // poison-safe: force a fresh engine next time
            throw e;
          }
          const out = qpdf.FS.readFile(outP);
          if (!out || !out.length) throw new Error('empty output');
          hideProgress();
          setStatus('Ready', 'ok');
          await openResultBytes(new Uint8Array(out), 'unlocked.pdf');
          toast('Unlocked — protection removed', 'ok');
        } catch (e) {
          console.warn(e);
          hideProgress();
          setStatus('Ready');
          toast('Wrong password or unsupported encryption', 'err', 3200);
        } finally {
          try { qpdf.FS.unlink(inP); } catch (e) {}
          try { qpdf.FS.unlink(outP); } catch (e) {}
        }
      };
      m.querySelector('#decGo').addEventListener('click', go);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
  });
}

/* ---------- image watermark (Nevai addImageWatermark) ---------- */
async function nevaiImageWatermark(file) {
  if (!file) return;
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  try {
    setStatus('Stamping image…', 'busy');
    showProgress(30);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    const image = isPng ? await src.embedPng(bytes) : await src.embedJpg(bytes);
    const angle = 0, rad = 0, scale = 0.45, opacity = 0.5;
    src.getPages().forEach(pg => {
      const { width, height } = pg.getSize();
      const imgW = image.width * scale, imgH = image.height * scale;
      pg.drawImage(image, {
        x: width / 2 - imgW / 2, y: height / 2 - imgH / 2,
        width: imgW, height: imgH, opacity: opacity, rotate: PDFLib.degrees(angle)
      });
    });
    const out = await src.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(out, 'image-stamped.pdf');
    toast('Image stamp applied', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Image stamp failed (PNG/JPG only)', 'err', 2800);
  }
}

/* ---------- remove blank pages (Nevai pixel detection) ---------- */
async function nevaiPageIsBlank(pdfjsPage, maxNonWhitePercent) {
  const viewport = pdfjsPage.getViewport({ scale: 0.5 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  await pdfjsPage.render({ canvasContext: ctx, viewport: viewport }).promise;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let nonWhite = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 240) nonWhite++;
  }
  return (nonWhite / total) * 100 <= maxNonWhitePercent;
}
async function nevaiCleanBlank() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  try {
    setStatus('Scanning pages…', 'busy');
    showProgress(15);
    const keep = [];
    for (let i = 1; i <= S.numPages; i++) {
      const p = await S.doc.getPage(i);
      const blank = await nevaiPageIsBlank(p, 0.5);
      if (!blank) keep.push(i - 1);
      showProgress(15 + (i / S.numPages) * 50);
      if (!S.doc) return;
    }
    if (!keep.length) { hideProgress(); setStatus('Ready'); toast('Every page looks blank — keeping all', 'err', 2600); return; }
    if (keep.length === S.numPages) { hideProgress(); setStatus('Ready', 'ok'); toast('No blank pages found', 'ok', 1800); return; }
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFLib.PDFDocument.create();
    (await out.copyPages(src, keep)).forEach(pg => out.addPage(pg));
    const bytes = await out.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'cleaned.pdf');
    toast('Removed ' + (S.numPages - keep.length) + ' blank page(s)', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Blank scan failed', 'err', 2600);
  }
}

/* ---------- flatten forms ---------- */
async function nevaiFlatten() {
  if (!S.doc || !S.file) { toast('Open a PDF first', 'err', 1600); return; }
  if (!needLib()) return;
  try {
    setStatus('Flattening…', 'busy');
    showProgress(30);
    const src = await PDFLib.PDFDocument.load(await S.file.arrayBuffer(), { ignoreEncryption: true });
    try { src.getForm().flatten(); } catch (e) { /* no forms — fine */ }
    const bytes = await src.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'flattened.pdf');
    toast('Forms flattened into static content', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Flatten failed', 'err', 2600);
  }
}

/* ---------- create PDF from images ---------- */
async function nevaiImageBytesToPng(file) {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d');
    if (!ctx) { bmp.close(); return null; }
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch (e) { return null; }
}
async function nevaiImagesToPdf(files) {
  const list = Array.from(files || []).filter(f => (f.type || '').startsWith('image/'));
  if (!list.length) { toast('Choose image files (PNG/JPG/WebP…)', 'err', 2200); return; }
  if (!needLib()) return;
  try {
    setStatus('Building PDF…', 'busy');
    showProgress(20);
    const out = await PDFLib.PDFDocument.create();
    let n = 0;
    for (const f of list) {
      const raw = new Uint8Array(await f.arrayBuffer());
      let img = null;
      try {
        img = (/\.png$/i.test(f.name) || f.type === 'image/png') ? await out.embedPng(raw) : await out.embedJpg(raw);
      } catch (e) {
        const png = await nevaiImageBytesToPng(f);
        if (!png) continue;
        img = await out.embedPng(png);
      }
      if (!img) continue;
      const pg = out.addPage([img.width, img.height]);
      pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      n++;
      showProgress(20 + (n / list.length) * 60);
    }
    if (!n) throw new Error('no images');
    const bytes = await out.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, 'from-images.pdf');
    toast('Created PDF with ' + n + ' image page(s)', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Could not build PDF from images', 'err', 2800);
  }
}

/* ---------- create PDF from a text file ---------- */
async function nevaiTextToPdf(file) {
  if (!file) return;
  if (!needLib()) return;
  try {
    setStatus('Building PDF…', 'busy');
    showProgress(25);
    const text = await file.text();
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (!lines.length || (lines.length === 1 && !lines[0].trim())) { toast('Text file is empty', 'err', 2000); hideProgress(); setStatus('Ready'); return; }
    const out = await PDFLib.PDFDocument.create();
    const font = await out.embedFont(PDFLib.StandardFonts.Helvetica);
    const size = 12, lh = 16, margin = 50;
    const PW = 595.28, PH = 841.89; // A4
    let pg = out.addPage([PW, PH]);
    let y = PH - margin;
    const pushLine = (ln) => {
      if (y < margin + lh) { pg = out.addPage([PW, PH]); y = PH - margin; }
      pg.drawText(ln, { x: margin, y: y - size, size: size, font: font, color: PDFLib.rgb(0.1, 0.1, 0.12) });
      y -= lh;
    };
    lines.forEach(raw => {
      let ln = raw;
      if (!ln.trim()) { y -= lh * 0.7; if (y < margin) { pg = out.addPage([PW, PH]); y = PH - margin; } return; }
      while (ln.length) {
        let cut = ln.length;
        while (cut > 0 && font.widthOfTextAtSize(ln.slice(0, cut), size) > PW - margin * 2) cut--;
        if (cut === 0) cut = 1;
        // avoid splitting words when possible
        if (cut < ln.length) {
          const sp = ln.lastIndexOf(' ', cut);
          if (sp > cut * 0.5) cut = sp + 1;
        }
        pushLine(ln.slice(0, cut).trimEnd());
        ln = ln.slice(cut).trimStart();
        if (!ln.trim()) break;
      }
    });
    const bytes = await out.save({ useObjectStreams: true });
    hideProgress();
    setStatus('Ready', 'ok');
    await openResultBytes(bytes, (file.name || 'text').replace(/\.[^.]+$/, '') + '.pdf');
    toast('Text converted to PDF', 'ok');
  } catch (e) {
    console.warn(e);
    hideProgress();
    setStatus('Ready');
    toast('Text conversion failed', 'err', 2600);
  }
}

/* ---------- Nevai tools wiring (own hook — never touches other wiring) ---------- */
function wireNevai() {
  const non = (sel, ev, fn) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el && !el.dataset.nevaiWired) { el.dataset.nevaiWired = '1'; el.addEventListener(ev, fn); }
  };
  non('#btnEncrypt', 'click', nevaiEncrypt);
  non('#btnDecrypt', 'click', nevaiDecrypt);
  non('#btnImgWatermark', 'click', () => {
    const i = document.querySelector('#imgWmInput');
    if (i) i.click(); else toast('Unavailable', 'err', 1500);
  });
  non('#imgWmInput', 'change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) nevaiImageWatermark(f);
  });
  non('#btnImgToPdf', 'click', () => {
    const i = document.querySelector('#imgInput');
    if (i) i.click(); else toast('Unavailable', 'err', 1500);
  });
  non('#imgInput', 'change', (e) => {
    // snapshot first: FileList is LIVE — clearing the input empties it
    const f = Array.from(e.target.files || []);
    e.target.value = '';
    if (f.length) nevaiImagesToPdf(f);
  });
  non('#btnTextToPdf', 'click', () => {
    const i = document.querySelector('#txtInput');
    if (i) i.click(); else toast('Unavailable', 'err', 1500);
  });
  non('#txtInput', 'change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) nevaiTextToPdf(f);
  });
  non('#btnCleanBlank', 'click', nevaiCleanBlank);
  non('#btnFlatten', 'click', nevaiFlatten);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireNevai);
} else {
  wireNevai();
}

})();