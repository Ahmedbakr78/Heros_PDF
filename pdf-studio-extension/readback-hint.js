/* Early 2d-context hint: pdf.js reads pixels back from its scratch canvases
   (soft-mask compose, font probing, text measurement). Chromium warns
   "Multiple readback operations ... willReadFrequently" unless the context
   is created with that hint. Loaded as an external file (not inline) so it
   complies with the extension Content Security Policy, and runs before
   vendor scripts — so every future getContext('2d') inside pdf.js carries
   it. Callers that already pass an explicit willReadFrequently value are
   left untouched. */
(function () {
  'use strict';
  function withHint(orig) {
    var patched = function (type, opts) {
      if (type === '2d') {
        if (opts == null) {
          opts = { willReadFrequently: true };
        } else if (typeof opts === 'object' && !('willReadFrequently' in opts)) {
          try { opts.willReadFrequently = true; }
          catch (e) { opts = Object.assign({}, opts, { willReadFrequently: true }); }
        }
      }
      return orig.call(this, type, opts);
    };
    patched.__herosReadbackPatched = true;
    return patched;
  }
  try {
    if (window.HTMLCanvasElement && HTMLCanvasElement.prototype.getContext &&
        !HTMLCanvasElement.prototype.getContext.__herosReadbackPatched) {
      HTMLCanvasElement.prototype.getContext = withHint(HTMLCanvasElement.prototype.getContext);
    }
  } catch (e) {}
  try {
    if (window.OffscreenCanvas && OffscreenCanvas.prototype.getContext &&
        !OffscreenCanvas.prototype.getContext.__herosReadbackPatched) {
      OffscreenCanvas.prototype.getContext = withHint(OffscreenCanvas.prototype.getContext);
    }
  } catch (e) {}
})();
