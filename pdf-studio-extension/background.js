'use strict';

const VIEWER = 'viewer.html';
const PDF_RE = /\.pdf($|[?#])/i;
const DEFAULTS = { autoFile: true, autoWeb: true };

/* tabId -> { url, at } — loop guard so we never bounce a tab twice */
const recentRedirects = new Map();

async function settings() {
  try {
    const s = await chrome.storage.local.get(DEFAULTS);
    return { autoFile: s.autoFile !== false, autoWeb: s.autoWeb !== false };
  } catch (e) {
    return { autoFile: true, autoWeb: true };
  }
}

function viewerUrl(pdfUrl) {
  return VIEWER + '?pdf=' + encodeURIComponent(pdfUrl);
}

function openViewer(query) {
  chrome.tabs.create({ url: VIEWER + query });
}

/* ---------------------------------------------------------------------------
   Auto-open: when a tab navigates to a PDF (file:// or http(s)), take over
   and open it in Heros PDF instead of the built-in viewer.
   ---------------------------------------------------------------------------
   NOTE: for file:// URLs the extension needs "Allow access to file URLs"
   enabled on chrome://extensions — otherwise Chrome never tells us about
   the navigation.
--------------------------------------------------------------------------- */
async function maybeRedirect(details, stage) {
  try {
    if (!details || details.frameId !== 0) return;      // top frame only
    const url = details.url || '';
    if (url.startsWith('chrome-extension://') ||
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:')) return;
    if (url.indexOf('/' + VIEWER) !== -1) return;        // already our viewer

    const isFile = url.startsWith('file://');
    const isWeb = url.startsWith('http://') || url.startsWith('https://');
    if (!isFile && !isWeb) return;
    if (!PDF_RE.test(url)) return;
    console.log('[HerosPDF] PDF ' + stage + ' seen: ' + url);

    const s = await settings();
    if (isFile && !s.autoFile) return;
    if (isWeb && !s.autoWeb) return;

    const prev = recentRedirects.get(details.tabId);
    const now = Date.now();
    if (prev && prev.url === url && (now - prev.at) < 5000) return;
    recentRedirects.set(details.tabId, { url, at: now });
    // prune old entries
    if (recentRedirects.size > 50) {
      for (const [k, v] of recentRedirects) {
        if (now - v.at > 30000) recentRedirects.delete(k);
      }
    }

    console.log('[HerosPDF] redirecting tab ' + details.tabId + ' (' + stage + ')');
    await chrome.tabs.update(details.tabId, { url: viewerUrl(url) });
  } catch (e) {
    console.warn('[HerosPDF] auto-open redirect failed:', (e && e.message) || e);
  }
}

/* Early interception (before the built-in viewer starts) … */
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  maybeRedirect(details, 'navigate');
});
/* … plus a late fallback (catches anything the early pass missed,
   e.g. an event that arrived while the worker was still starting). */
chrome.webNavigation.onCommitted.addListener((details) => {
  maybeRedirect(details, 'committed');
});

/* ---------------------------------------------------------------------------
   Context menu: right-click on PDF links or PDF pages
--------------------------------------------------------------------------- */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'pdfstudio-open',
    title: 'Open with Heros PDF',
    contexts: ['link', 'page']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  let url = null;
  if (info.linkUrl && PDF_RE.test(info.linkUrl)) url = info.linkUrl;
  else if (info.pageUrl && PDF_RE.test(info.pageUrl)) url = info.pageUrl;
  if (url) openViewer('?pdf=' + encodeURIComponent(url));
  else openViewer('');
});

/* Popup "open" button (the popup cannot call tabs directly, so it messages us) */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'pdfstudio-open') {
    openViewer(msg.query || '');
    sendResponse({ ok: true });
    return true;
  }
});
