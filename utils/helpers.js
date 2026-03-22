// @ts-check

/**
 * @file Generic helper utilities.
 */

/**
 * Create monotonic uid generator.
 * @returns {(prefix: string) => string}
 */
export function createUidGenerator() {
  /** @type {number} */
  var counter = 0;
  return function uid(prefix) {
    counter += 1;
    return prefix + "-" + Date.now().toString(36) + "-" + counter.toString(36);
  };
}

/**
 * Deep clone JSON-compatible value.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Convert unknown value to text.
 * @param {unknown} value
 * @returns {string}
 */
export function asText(value) {
  return value == null ? "" : String(value);
}

/**
 * Escape html entities.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape html attribute value.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAttr(value) {
  return escapeHtml(value);
}

/**
 * CSS selector value escape helper.
 * @param {unknown} value
 * @returns {string}
 */
export function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/"/g, "\\\"");
}

/**
 * Check whether text has visible content.
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasText(value) {
  return asText(value).replace(/\s+/g, "").length > 0;
}

/**
 * Format text to editable html.
 * @param {unknown} value
 * @returns {string}
 */
export function formatEditable(value) {
  if (!hasText(value)) {
    return "";
  }
  return escapeHtml(value).replace(/\n/g, "<br>");
}

/**
 * Clamp number to range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp rounded integer with fallback.
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampInt(value, min, max, fallback) {
  var num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(num)));
}

/**
 * Clamp rounded pixel value with fallback.
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampPx(value, min, max, fallback) {
  var num = Number(value);
  if (!Number.isFinite(num)) {
    num = fallback;
  }
  return Math.round(clamp(num, min, max));
}

/**
 * Normalize enum-like value.
 * @template {string} T
 * @param {unknown} value
 * @param {readonly T[]} list
 * @param {T} fallback
 * @returns {T}
 */
export function oneOf(value, list, fallback) {
  return list.indexOf(/** @type {T} */ (value)) >= 0 ? /** @type {T} */ (value) : fallback;
}

/**
 * Normalize HEX color.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeColor(value, fallback) {
  var text = asText(value).trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

/**
 * Convert hex color to rgba string.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
  var clean = normalizeColor(hex, "#000000").slice(1);
  var r = parseInt(clean.slice(0, 2), 16);
  var g = parseInt(clean.slice(2, 4), 16);
  var b = parseInt(clean.slice(4, 6), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

/**
 * Convert hex color to rgb channels string: "r, g, b".
 * @param {string} hex
 * @returns {string}
 */
export function hexToRgbChannels(hex) {
  var clean = normalizeColor(hex, "#000000").slice(1);
  var r = parseInt(clean.slice(0, 2), 16);
  var g = parseInt(clean.slice(2, 4), 16);
  var b = parseInt(clean.slice(4, 6), 16);
  return r + ", " + g + ", " + b;
}

/**
 * Sanitize file name for browser download.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFileName(name) {
  return asText(name).replace(/[\\/:*?"<>|]+/g, "-");
}

/**
 * Trigger browser download for text content.
 * @param {string} name
 * @param {string} content
 * @param {string} mime
 * @returns {void}
 */
export function downloadFile(name, content, mime) {
  var safeName = sanitizeFileName(name);
  var blob = new Blob([content], { type: mime });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Read text from editable element.
 * @param {HTMLElement} element
 * @returns {string}
 */
export function readEditableText(element) {
  var raw = typeof element.innerText === "string" ? element.innerText : element.textContent;
  var text = asText(raw).replace(/\u00A0/g, " ").replace(/\r/g, "");
  if (element.dataset.singleLine === "true") {
    return text.replace(/\s*\n+\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
  }
  return text.replace(/\n{3,}/g, "\n\n").replace(/\n+$/g, "");
}

/**
 * Place caret at editable element end.
 * @param {HTMLElement} element
 * @returns {void}
 */
export function placeCaretAtEnd(element) {
  var selection = window.getSelection();
  if (!selection) {
    return;
  }
  var range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Insert plain text into current editable selection.
 * @param {string} text
 * @returns {void}
 */
export function insertPlainText(text) {
  if (document.queryCommandSupported && document.queryCommandSupported("insertText")) {
    document.execCommand("insertText", false, text);
    return;
  }
  var selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return;
  }
  var range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
