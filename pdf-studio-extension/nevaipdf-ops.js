/* ==========================================================================
   NevaiOps — NevaiPDF portable core, adapted to vanilla JS for Heros_PDF.
   --------------------------------------------------------------------------
   Full-function port of:
     - NevaiPDF src/js/utils/pdf-operations.ts  (merge/split/rotate/delete/
       watermarks/page-numbers/fix-page-size + range parsers)
     - NevaiPDF src/js/utils/helpers.ts         (portable pure utilities)
   Source: /home/ahmed/Downloads/NEVAI/NevaiPDF  (READ-ONLY, never modified)
   NevaiPDF is MIT-licensed (Copyright (c) 2026 Nevai Team). This port keeps
   the original logic intact; only TypeScript types / npm+Vite imports were
   translated to browser globals. pdf-lib is used via the vendored global
   `PDFLib` (vendor/pdf-lib.min.js).
   Adaptations vs. original:
     - `loadPdfDocument()` (qpdf-wasm repair + Vite env) replaced by
       `nvLoadPdf()` = PDFLib.PDFDocument.load(bytes, {ignoreEncryption:true}).
       The qpdf pre-repair step is unavailable in this extension context.
     - `downloadFile`, `escapeHtml` etc. live under the `NevaiOps`
       namespace so they never collide with the host app's own helpers.
   ========================================================================== */
'use strict';

(function () {
  function PL() {
    const lib = (typeof window !== 'undefined' && window.PDFLib) || (typeof PDFLib !== 'undefined' ? PDFLib : null);
    if (!lib || !lib.PDFDocument) {
      throw new Error('PDFLib missing (vendor/pdf-lib.min.js not loaded)');
    }
    return lib;
  }

  /* Replacement for NevaiPDF's loadPdfDocument() (which needs qpdf-wasm).
     Same call signature spirit: bytes in -> loaded PDFDocument out. */
  async function nvLoadPdf(pdfBytes, options) {
    const PLib = PL();
    const input = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    const opts = Object.assign({ ignoreEncryption: true, throwOnInvalidObject: false }, options || {});
    return PLib.PDFDocument.load(input, opts);
  }

  /* ================= pdf-operations.ts (full port) ================= */

  async function mergePdfs(pdfBytesList) {
    const PLib = PL();
    const mergedDoc = await PLib.PDFDocument.create();
    for (const bytes of pdfBytesList) {
      const srcDoc = await nvLoadPdf(bytes);
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }
    return new Uint8Array(await mergedDoc.save({ addDefaultPage: false }));
  }

  async function splitPdf(pdfBytes, pageIndices) {
    const PLib = PL();
    const srcDoc = await nvLoadPdf(pdfBytes);
    const newPdf = await PLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    return new Uint8Array(await newPdf.save());
  }

  async function rotatePdfUniform(pdfBytes, angle) {
    const PLib = PL();
    const srcDoc = await nvLoadPdf(pdfBytes);
    const newPdfDoc = await PLib.PDFDocument.create();
    const pageCount = srcDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
      const originalPage = srcDoc.getPage(i);
      const currentRotation = originalPage.getRotation().angle;
      const totalRotation = currentRotation + angle;

      if (totalRotation % 90 === 0) {
        const [copiedPage] = await newPdfDoc.copyPages(srcDoc, [i]);
        copiedPage.setRotation(PLib.degrees(totalRotation));
        newPdfDoc.addPage(copiedPage);
      } else {
        const embeddedPage = await newPdfDoc.embedPage(originalPage);
        const { width, height } = embeddedPage.scale(1);
        const angleRad = (totalRotation * Math.PI) / 180;
        const absCos = Math.abs(Math.cos(angleRad));
        const absSin = Math.abs(Math.sin(angleRad));
        const newWidth = width * absCos + height * absSin;
        const newHeight = width * absSin + height * absCos;
        const newPage = newPdfDoc.addPage([newWidth, newHeight]);
        const x =
          newWidth / 2 -
          ((width / 2) * Math.cos(angleRad) - (height / 2) * Math.sin(angleRad));
        const y =
          newHeight / 2 -
          ((width / 2) * Math.sin(angleRad) + (height / 2) * Math.cos(angleRad));
        newPage.drawPage(embeddedPage, {
          x,
          y,
          width,
          height,
          rotate: PLib.degrees(totalRotation),
        });
      }
    }

    return new Uint8Array(await newPdfDoc.save());
  }

  async function rotatePdfPages(pdfBytes, rotations) {
    const PLib = PL();
    const srcDoc = await nvLoadPdf(pdfBytes);
    const newPdfDoc = await PLib.PDFDocument.create();
    const pageCount = srcDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
      const rotation = rotations[i] || 0;
      const originalPage = srcDoc.getPage(i);
      const currentRotation = originalPage.getRotation().angle;
      const totalRotation = currentRotation + rotation;

      if (totalRotation % 90 === 0) {
        const [copiedPage] = await newPdfDoc.copyPages(srcDoc, [i]);
        copiedPage.setRotation(PLib.degrees(totalRotation));
        newPdfDoc.addPage(copiedPage);
      } else {
        const embeddedPage = await newPdfDoc.embedPage(originalPage);
        const { width, height } = embeddedPage.scale(1);
        const angleRad = (totalRotation * Math.PI) / 180;
        const absCos = Math.abs(Math.cos(angleRad));
        const absSin = Math.abs(Math.sin(angleRad));
        const newWidth = width * absCos + height * absSin;
        const newHeight = width * absSin + height * absCos;
        const newPage = newPdfDoc.addPage([newWidth, newHeight]);
        const x =
          newWidth / 2 -
          ((width / 2) * Math.cos(angleRad) - (height / 2) * Math.sin(angleRad));
        const y =
          newHeight / 2 -
          ((width / 2) * Math.sin(angleRad) + (height / 2) * Math.cos(angleRad));
        newPage.drawPage(embeddedPage, {
          x,
          y,
          width,
          height,
          rotate: PLib.degrees(totalRotation),
        });
      }
    }

    return new Uint8Array(await newPdfDoc.save());
  }

  async function deletePdfPages(pdfBytes, pagesToDelete) {
    const PLib = PL();
    const srcDoc = await nvLoadPdf(pdfBytes);
    const totalPages = srcDoc.getPageCount();

    const pagesToKeep = [];
    for (let i = 0; i < totalPages; i++) {
      if (!pagesToDelete.has(i + 1)) {
        pagesToKeep.push(i);
      }
    }

    if (pagesToKeep.length === 0) throw new Error('Cannot delete all pages');

    const newPdf = await PLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(srcDoc, pagesToKeep);
    copiedPages.forEach((page) => newPdf.addPage(page));
    return new Uint8Array(await newPdf.save());
  }

  function parsePageRange(rangeStr, totalPages) {
    const indices = new Set();
    const parts = rangeStr.split(',').map((s) => s.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = Math.max(1, parseInt(startStr, 10) || 1);
        const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      } else {
        const page = parseInt(part, 10);
        if (page >= 1 && page <= totalPages) {
          indices.add(page - 1);
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  function parseDeletePages(str, totalPages) {
    const pages = new Set();
    const parts = str.split(',').map((s) => s.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = Math.max(1, parseInt(startStr, 10) || 1);
        const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
        for (let i = start; i <= end; i++) pages.add(i);
      } else {
        const page = parseInt(part, 10);
        if (page >= 1 && page <= totalPages) pages.add(page);
      }
    }

    return pages;
  }

  async function addTextWatermark(pdfBytes, options) {
    const PLib = PL();
    const pdfDoc = await nvLoadPdf(pdfBytes);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create canvas context');

    const dpr = 2;
    const colorR = Math.round(options.color.r * 255);
    const colorG = Math.round(options.color.g * 255);
    const colorB = Math.round(options.color.b * 255);
    const fontStr = `bold ${options.fontSize * dpr}px "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", "Noto Sans Arabic", Arial, sans-serif`;

    ctx.font = fontStr;
    const metrics = ctx.measureText(options.text);

    canvas.width = Math.ceil(metrics.width) + 4;
    canvas.height = Math.ceil(options.fontSize * dpr * 1.4);

    ctx.font = fontStr;
    ctx.fillStyle = `rgb(${colorR}, ${colorG}, ${colorB})`;
    ctx.textBaseline = 'middle';
    ctx.fillText(options.text, 2, canvas.height / 2);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/png'
      );
    });
    const imageBytes = new Uint8Array(await blob.arrayBuffer());

    const image = await pdfDoc.embedPng(imageBytes);
    const pages = pdfDoc.getPages();
    const posX = options.x !== undefined && options.x !== null ? options.x : 0.5;
    const posY = options.y !== undefined && options.y !== null ? options.y : 0.5;
    const imgWidth = image.width / dpr;
    const imgHeight = image.height / dpr;

    const rad = (options.angle * Math.PI) / 180;
    const halfW = imgWidth / 2;
    const halfH = imgHeight / 2;

    const targetIndices = options.pageIndices !== undefined && options.pageIndices !== null
      ? options.pageIndices
      : pages.map((_, i) => i);
    for (const idx of targetIndices) {
      const page = pages[idx];
      if (!page) continue;
      const { width, height } = page.getSize();
      const cx = posX * width;
      const cy = posY * height;

      page.drawImage(image, {
        x: cx - Math.cos(rad) * halfW + Math.sin(rad) * halfH,
        y: cy - Math.sin(rad) * halfW - Math.cos(rad) * halfH,
        width: imgWidth,
        height: imgHeight,
        opacity: options.opacity,
        rotate: PLib.degrees(options.angle),
      });
    }

    return new Uint8Array(await pdfDoc.save());
  }

  async function addImageWatermark(pdfBytes, options) {
    const PLib = PL();
    const pdfDoc = await nvLoadPdf(pdfBytes);
    const image =
      options.imageType === 'png'
        ? await pdfDoc.embedPng(options.imageBytes)
        : await pdfDoc.embedJpg(options.imageBytes);
    const pages = pdfDoc.getPages();
    const posX = options.x !== undefined && options.x !== null ? options.x : 0.5;
    const posY = options.y !== undefined && options.y !== null ? options.y : 0.5;

    const imgWidth = image.width * options.scale;
    const imgHeight = image.height * options.scale;
    const rad = (options.angle * Math.PI) / 180;
    const halfW = imgWidth / 2;
    const halfH = imgHeight / 2;

    const targetIndices = options.pageIndices !== undefined && options.pageIndices !== null
      ? options.pageIndices
      : pages.map((_, i) => i);
    for (const idx of targetIndices) {
      const page = pages[idx];
      if (!page) continue;
      const { width, height } = page.getSize();
      const cx = posX * width;
      const cy = posY * height;

      page.drawImage(image, {
        x: cx - Math.cos(rad) * halfW + Math.sin(rad) * halfH,
        y: cy - Math.sin(rad) * halfW - Math.cos(rad) * halfH,
        width: imgWidth,
        height: imgHeight,
        opacity: options.opacity,
        rotate: PLib.degrees(options.angle),
      });
    }

    return new Uint8Array(await pdfDoc.save());
  }

  async function addPageNumbers(pdfBytes, options) {
    const PLib = PL();
    const pdfDoc = await nvLoadPdf(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(PLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const mediaBox = page.getMediaBox();
      const cropBox = page.getCropBox();
      const bounds = cropBox || mediaBox;
      const width = bounds.width;
      const height = bounds.height;
      const xOffset = bounds.x || 0;
      const yOffset = bounds.y || 0;

      const pageNumText =
        options.format === 'page_x_of_y'
          ? `${i + 1} / ${totalPages}`
          : `${i + 1}`;

      const textWidth = helveticaFont.widthOfTextAtSize(
        pageNumText,
        options.fontSize
      );
      const textHeight = options.fontSize;

      const minMargin = 8;
      const maxMargin = 40;
      const marginPercentage = 0.04;

      const horizontalMargin = Math.max(
        minMargin,
        Math.min(maxMargin, width * marginPercentage)
      );
      const verticalMargin = Math.max(
        minMargin,
        Math.min(maxMargin, height * marginPercentage)
      );

      const safeHorizontalMargin = Math.max(horizontalMargin, textWidth / 2 + 3);
      const safeVerticalMargin = Math.max(verticalMargin, textHeight + 3);

      let x = 0,
        y = 0;

      switch (options.position) {
        case 'bottom-center':
          x =
            Math.max(
              safeHorizontalMargin,
              Math.min(
                width - safeHorizontalMargin - textWidth,
                (width - textWidth) / 2
              )
            ) + xOffset;
          y = safeVerticalMargin + yOffset;
          break;
        case 'bottom-left':
          x = safeHorizontalMargin + xOffset;
          y = safeVerticalMargin + yOffset;
          break;
        case 'bottom-right':
          x =
            Math.max(
              safeHorizontalMargin,
              width - safeHorizontalMargin - textWidth
            ) + xOffset;
          y = safeVerticalMargin + yOffset;
          break;
        case 'top-center':
          x =
            Math.max(
              safeHorizontalMargin,
              Math.min(
                width - safeHorizontalMargin - textWidth,
                (width - textWidth) / 2
              )
            ) + xOffset;
          y = height - safeVerticalMargin - textHeight + yOffset;
          break;
        case 'top-left':
          x = safeHorizontalMargin + xOffset;
          y = height - safeVerticalMargin - textHeight + yOffset;
          break;
        case 'top-right':
          x =
            Math.max(
              safeHorizontalMargin,
              width - safeHorizontalMargin - textWidth
            ) + xOffset;
          y = height - safeVerticalMargin - textHeight + yOffset;
          break;
      }

      x = Math.max(xOffset + 3, Math.min(xOffset + width - textWidth - 3, x));
      y = Math.max(yOffset + 3, Math.min(yOffset + height - textHeight - 3, y));

      page.drawText(pageNumText, {
        x,
        y,
        font: helveticaFont,
        size: options.fontSize,
        color: PLib.rgb(options.color.r, options.color.g, options.color.b),
      });
    }

    return new Uint8Array(await pdfDoc.save());
  }

  async function fixPageSize(pdfBytes, options) {
    const PLib = PL();
    let targetWidth;
    let targetHeight;

    if (options.targetSize.toLowerCase() === 'custom') {
      const w = options.customWidth !== undefined && options.customWidth !== null ? options.customWidth : 210;
      const h = options.customHeight !== undefined && options.customHeight !== null ? options.customHeight : 297;
      const units = ((options.customUnits !== undefined && options.customUnits !== null ? options.customUnits : 'mm')).toLowerCase();
      if (units === 'in') {
        targetWidth = w * 72;
        targetHeight = h * 72;
      } else {
        targetWidth = w * (72 / 25.4);
        targetHeight = h * (72 / 25.4);
      }
    } else {
      const selected =
        PLib.PageSizes[options.targetSize] || PLib.PageSizes.A4;
      targetWidth = selected[0];
      targetHeight = selected[1];
    }

    const orientation = options.orientation.toLowerCase();
    if (orientation === 'landscape' && targetWidth < targetHeight) {
      [targetWidth, targetHeight] = [targetHeight, targetWidth];
    } else if (orientation === 'portrait' && targetWidth > targetHeight) {
      [targetWidth, targetHeight] = [targetHeight, targetWidth];
    }

    const sourceDoc = await nvLoadPdf(pdfBytes);
    const outputDoc = await PLib.PDFDocument.create();

    for (const sourcePage of sourceDoc.getPages()) {
      const { width: sourceWidth, height: sourceHeight } = sourcePage.getSize();
      const embeddedPage = await outputDoc.embedPage(sourcePage);

      let pageTargetWidth = targetWidth;
      let pageTargetHeight = targetHeight;

      if (orientation === 'auto') {
        const isSourceLandscape = sourceWidth > sourceHeight;
        const isTargetLandscape = pageTargetWidth > pageTargetHeight;
        if (isSourceLandscape !== isTargetLandscape) {
          [pageTargetWidth, pageTargetHeight] = [
            pageTargetHeight,
            pageTargetWidth,
          ];
        }
      }

      const outputPage = outputDoc.addPage([pageTargetWidth, pageTargetHeight]);
      outputPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageTargetWidth,
        height: pageTargetHeight,
        color: PLib.rgb(
          options.backgroundColor.r,
          options.backgroundColor.g,
          options.backgroundColor.b
        ),
      });

      const scaleX = pageTargetWidth / sourceWidth;
      const scaleY = pageTargetHeight / sourceHeight;
      const useFill = options.scalingMode.toLowerCase() === 'fill';
      const scale = useFill ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

      const scaledWidth = sourceWidth * scale;
      const scaledHeight = sourceHeight * scale;

      const x = (pageTargetWidth - scaledWidth) / 2;
      const y = (pageTargetHeight - scaledHeight) / 2;

      outputPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    return new Uint8Array(await outputDoc.save());
  }

  /* ================= helpers.ts (portable pure utilities) ================= */

  const STANDARD_SIZES = {
    A4: { width: 595.28, height: 841.89 },
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
    Tabloid: { width: 792, height: 1224 },
    A3: { width: 841.89, height: 1190.55 },
    A5: { width: 419.53, height: 595.28 },
  };

  function getStandardPageName(width, height) {
    const tolerance = 1; // Allow for minor floating point variations
    for (const [name, size] of Object.entries(STANDARD_SIZES)) {
      if (
        (Math.abs(width - size.width) < tolerance &&
          Math.abs(height - size.height) < tolerance) ||
        (Math.abs(width - size.height) < tolerance &&
          Math.abs(height - size.width) < tolerance)
      ) {
        return name;
      }
    }
    return 'Custom';
  }

  function convertPoints(points, unit) {
    let result;
    switch (unit) {
      case 'in':
        result = points / 72;
        break;
      case 'mm':
        result = (points / 72) * 25.4;
        break;
      case 'px':
        result = points * (96 / 72); // Assuming 96 DPI
        break;
      default: // 'pt'
        result = points;
    }
    return result.toFixed(2);
  }

  // Convert hex color to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 0, g: 0, b: 0 };
  }

  const formatBytes = (bytes, decimals) => {
    if (decimals === undefined || decimals === null) decimals = 1;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const downloadFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  function parsePageRanges(rangeString, totalPages) {
    if (!rangeString || rangeString.trim() === '') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const indices = new Set();
    const parts = rangeString.split(',');

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      if (trimmedPart.includes('-')) {
        const [start, end] = trimmedPart.split('-').map(Number);
        if (
          isNaN(start) ||
          isNaN(end) ||
          start < 1 ||
          end > totalPages ||
          start > end
        ) {
          console.warn(`Invalid range skipped: ${trimmedPart}`);
          continue;
        }

        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      } else {
        const pageNum = Number(trimmedPart);

        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
          console.warn(`Invalid page number skipped: ${trimmedPart}`);
          continue;
        }
        indices.add(pageNum - 1);
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Formats an ISO 8601 date string (e.g., "2008-02-21T17:15:56-08:00")
   * into a localized, human-readable string.
   */
  function formatIsoDate(isoDateString) {
    if (!isoDateString || typeof isoDateString !== 'string') {
      return isoDateString; // Return original value if it's not a valid string
    }
    try {
      const date = new Date(isoDateString);
      // Check if the date object is valid
      if (isNaN(date.getTime())) {
        return isoDateString; // Return original string if the date is invalid
      }
      return date.toLocaleString();
    } catch (e) {
      console.error('Could not parse ISO date:', e);
      return isoDateString; // Return original string on any error
    }
  }

  function formatStars(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  }

  /**
   * Truncates a filename to a maximum length, adding ellipsis if needed.
   * Preserves the file extension.
   */
  function truncateFilename(filename, maxLength) {
    if (maxLength === undefined || maxLength === null) maxLength = 25;
    if (filename.length <= maxLength) {
      return filename;
    }

    const lastDotIndex = filename.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
    const nameWithoutExt =
      lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;

    const availableLength = maxLength - extension.length - 3; // 3 for '...'

    if (availableLength <= 0) {
      return filename.substring(0, maxLength - 3) + '...';
    }

    return nameWithoutExt.substring(0, availableLength) + '...' + extension;
  }

  function formatShortcutDisplay(shortcut, isMac) {
    if (!shortcut) return '';
    return shortcut
      .replace('mod', isMac ? '⌘' : 'Ctrl')
      .replace('ctrl', isMac ? '^' : 'Ctrl') // Control key on Mac shows as ^
      .replace('alt', isMac ? '⌥' : 'Alt')
      .replace('shift', 'Shift')
      .split('+')
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
      .join(isMac ? '' : '+');
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  function uint8ArrayToBase64(bytes) {
    const CHUNK_SIZE = 0x8000;
    const chunks = [];
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
      chunks.push(String.fromCharCode.apply(null, chunk));
    }
    return btoa(chunks.join(''));
  }

  /**
   * Formats a raw RFC 2822 date string into a nicer human-readable format,
   * while preserving the original timezone and time.
   * Example input: "Sun, 8 Jan 2017 20:37:44 +0200"
   * Example output: "Sunday, January 8, 2017 at 8:37 PM (+0200)"
   */
  function formatRawDate(raw) {
    try {
      const match = raw.match(
        /([A-Za-z]{3}),\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+([+-]\d{4})/
      );

      if (match) {
        const dayAbbr = match[1];
        const dom = match[2];
        const monthAbbr = match[3];
        const year = match[4];
        const hoursStr = match[5];
        const minsStr = match[6];
        const timezone = match[8];

        const days = {
          Sun: 'Sunday',
          Mon: 'Monday',
          Tue: 'Tuesday',
          Wed: 'Wednesday',
          Thu: 'Thursday',
          Fri: 'Friday',
          Sat: 'Saturday',
        };
        const months = {
          Jan: 'January',
          Feb: 'February',
          Mar: 'March',
          Apr: 'April',
          May: 'May',
          Jun: 'June',
          Jul: 'July',
          Aug: 'August',
          Sep: 'September',
          Oct: 'October',
          Nov: 'November',
          Dec: 'December',
        };

        const fullDay = days[dayAbbr] || dayAbbr;
        const fullMonth = months[monthAbbr] || monthAbbr;

        let hours = parseInt(hoursStr, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const tzSign = timezone.substring(0, 1);
        const tzHours = timezone.substring(1, 3);
        const tzMins = timezone.substring(3, 5);
        const formattedTz = `UTC${tzSign}${tzHours}:${tzMins}`;

        return `${fullDay}, ${fullMonth} ${dom}, ${year} at ${hours}:${minsStr} ${ampm} (${formattedTz})`;
      }
    } catch (e) {
      console.error('Error parsing date string:', raw);
    }
    return raw;
  }

  /**
   * Returns a sanitized PDF filename (no trailing .pdf, trimmed, max 80 chars).
   */
  function getCleanPdfFilename(filename) {
    let clean = filename.replace(/\.pdf$/i, '').trim();
    if (clean.length > 80) {
      clean = clean.slice(0, 80);
    }
    return clean;
  }

  /* ================= remove-annotations (FULL NevaiPDF copy) =================
     Copied from NevaiPDF (MIT, Copyright (c) 2026 Nevai Team), source files
     (read-only, never modified):
       - src/js/logic/remove-annotations-page.ts :: processRemoveAnnotations
       - src/js/workflow/nodes/remove-annotations-node.ts
         :: RemoveAnnotationsNode.data (batch core)
     The original logic is kept intact: iterate every page, read the page
     node's Annots array, and delete the Annots key when non-empty, then
     save. Only adaptations for this extension context:
       - pdf-lib via the vendored global (PL()) instead of the npm import;
       - qpdf-wasm pre-repair (loadPdfDocument) replaced by nvLoadPdf();
       - DOM loader/alert/download UI replaced by pure in/out + counts, so
         the host app shows its own toasts and progress.
     ========================================================================== */

  /**
   * remove-annotations-page.ts :: processRemoveAnnotations (core loop).
   * @param {PDFLib.PDFDocument} pdfDoc already-loaded document (mutated).
   * @returns {number} count of pages stripped of annotations.
   */
  function stripAnnotationsFromLoadedDoc(pdfDoc) {
    const PLib = PL();
    const pages = pdfDoc.getPages();
    let stripped = 0;
    // Remove all annotations from all pages
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const annotRefs = (page.node.Annots() && page.node.Annots().asArray()) || [];
      if (annotRefs.length > 0) {
        page.node.delete(PLib.PDFName.of('Annots'));
        stripped++;
      }
    }
    return stripped;
  }

  /**
   * remove-annotations-node.ts :: RemoveAnnotationsNode.data (batch core).
   * Cleans one file's bytes; mirrors the node's `_clean.pdf` renaming.
   * @param {Uint8Array} pdfBytes
   * @param {string} filename e.g. "doc.pdf"
   * @returns {Promise<{bytes:Uint8Array, filename:string, stripped:number}>}
   */
  async function removeAnnotationsBatch(pdfBytes, filename) {
    const pdfDoc = await nvLoadPdf(pdfBytes);
    const stripped = stripAnnotationsFromLoadedDoc(pdfDoc);
    const out = await pdfDoc.save();
    const name = (filename || 'document.pdf').replace(/\.pdf$/i, '_clean.pdf');
    return { bytes: new Uint8Array(out), filename: name, stripped };
  }

  /**
   * Convenience single-file entry used by the host app's eraser UI.
   * @param {Uint8Array} pdfBytes
   * @returns {Promise<{bytes:Uint8Array, stripped:number, totalPages:number}>}
   */
  async function removeEmbeddedAnnotations(pdfBytes) {
    const pdfDoc = await nvLoadPdf(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    const stripped = stripAnnotationsFromLoadedDoc(pdfDoc);
    const out = await pdfDoc.save();
    return { bytes: new Uint8Array(out), stripped, totalPages };
  }

  /* ================= public namespace (no global collisions) ================= */
  window.NevaiOps = {
    // pdf-operations.ts
    mergePdfs,
    splitPdf,
    rotatePdfUniform,
    rotatePdfPages,
    deletePdfPages,
    parsePageRange,
    parseDeletePages,
    addTextWatermark,
    addImageWatermark,
    addPageNumbers,
    fixPageSize,
    // helpers.ts
    STANDARD_SIZES,
    getStandardPageName,
    convertPoints,
    hexToRgb,
    formatBytes,
    downloadFile,
    readFileAsArrayBuffer,
    parsePageRanges,
    formatIsoDate,
    formatStars,
    truncateFilename,
    formatShortcutDisplay,
    escapeHtml,
    uint8ArrayToBase64,
    formatRawDate,
    getCleanPdfFilename,
    // remove-annotations-page.ts + remove-annotations-node.ts (FULL copy)
    stripAnnotationsFromLoadedDoc,
    removeAnnotationsBatch,
    removeEmbeddedAnnotations,
    // loader (extension-adapted; qpdf repair step unavailable here)
    loadPdfDocument: nvLoadPdf,
    version: '1.1.0-nevai-port',
  };
})();
