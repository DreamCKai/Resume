// @ts-check

/**
 * @file Rendering executor.
 * @description
 * This module only consumes view events and applies DOM updates.
 */

/**
 * @typedef {Object} ViewUpdatePayload
 * @property {string} slot
 * @property {string} selector
 * @property {string=} html
 * @property {string=} text
 * @property {Record<string, string>=} attrs
 * @property {Record<string, string>=} style
 * @property {string=} className
 */

/**
 * Create render runtime.
 * @param {{
 *   messager: {subscribe: (topic: string, handler: (payload: any) => void) => () => void, publish: (topic: string, payload: Record<string, unknown>) => void}
 * }} context
 */
export function createRender(context) {
  var messager = context.messager;

  /** @type {Map<string, ViewUpdatePayload>} */
  var updateQueue = new Map();
  /** @type {Set<string>} */
  var removeQueue = new Set();
  /** @type {number} */
  var rafId = 0;
  /** @type {Array<() => void>} */
  var offList = [];

  /**
   * Apply one view patch.
   * @param {ViewUpdatePayload} patch
   * @returns {void}
   */
  function applyPatch(patch) {
    var node = document.querySelector(patch.selector);
    if (!node) {
      return;
    }
    if (typeof patch.className === "string") {
      node.className = patch.className;
    }
    if (patch.attrs && typeof patch.attrs === "object") {
      Object.keys(patch.attrs).forEach(function (key) {
        node.setAttribute(key, patch.attrs[key]);
      });
    }
    if (patch.style && typeof patch.style === "object") {
      Object.keys(patch.style).forEach(function (key) {
        // @ts-ignore css property index
        node.style.setProperty(key, patch.style[key]);
      });
    }
    if (typeof patch.html === "string") {
      node.innerHTML = patch.html;
    } else if (typeof patch.text === "string") {
      node.textContent = patch.text;
    }
  }

  /**
   * Flush queued updates in one animation frame.
   * @returns {void}
   */
  function flush() {
    rafId = 0;
    /** @type {string[]} */
    var flushedSlots = [];

    removeQueue.forEach(function (selector) {
      var node = document.querySelector(selector);
      if (node) {
        node.innerHTML = "";
      }
    });
    removeQueue.clear();

    updateQueue.forEach(function (patch, slot) {
      applyPatch(patch);
      flushedSlots.push(slot);
    });
    updateQueue.clear();

    if (flushedSlots.length) {
      messager.publish("render:flushed", { slots: flushedSlots });
    }
  }

  /**
   * Ensure flush is scheduled.
   * @returns {void}
   */
  function scheduleFlush() {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(flush);
  }

  /**
   * Apply theme vars to :root.
   * @param {{vars: Record<string, string>}} payload
   * @returns {void}
   */
  function handleThemeApply(payload) {
    var vars = payload.vars || {};
    var root = document.documentElement;
    Object.keys(vars).forEach(function (name) {
      root.style.setProperty(name, vars[name]);
    });
  }

  /**
   * Mount render event listeners.
   * @returns {void}
   */
  function mount() {
    offList.push(messager.subscribe("view:update", function onViewUpdate(payload) {
      var patch = /** @type {ViewUpdatePayload} */ (payload);
      updateQueue.set(patch.slot, patch);
      scheduleFlush();
    }));
    offList.push(messager.subscribe("view:remove", function onViewRemove(payload) {
      removeQueue.add(String(payload.selector || ""));
      scheduleFlush();
    }));
    offList.push(messager.subscribe("theme:apply", handleThemeApply));
  }

  /**
   * Destroy render listeners and pending frame.
   * @returns {void}
   */
  function destroy() {
    offList.forEach(function (off) {
      off();
    });
    offList = [];
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    updateQueue.clear();
    removeQueue.clear();
  }

  return {
    mount: mount,
    destroy: destroy
  };
}

