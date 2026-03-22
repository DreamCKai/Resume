// @ts-check

/**
 * @file Dock component.
 * @description
 * Owns dock shell view, popover window stack, drag behavior, and dock icon events.
 */

var PANEL_LABELS = { content: "内容", style: "样式", view: "视图", file: "文件" };

var ICON_MARKUP = {
  content: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"></rect><rect x="14" y="4" width="6" height="6" rx="1.5"></rect><rect x="4" y="14" width="6" height="6" rx="1.5"></rect><rect x="14" y="14" width="6" height="6" rx="1.5"></rect></svg>',
  style: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18a2 2 0 0 0 2 2h1.6"></path><path d="M10 7l7 7"></path><path d="M13.5 4.8l5.7 5.7a1.8 1.8 0 0 1 0 2.6l-3 3-8.3-8.3 3-3a1.8 1.8 0 0 1 2.6 0z"></path></svg>',
  view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.8h6.6L19 8.2V18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2z"></path><path d="M14.6 3.8V8H19"></path><path d="M9 13h6"></path><path d="M9 16h4.5"></path></svg>'
};

var DOCK_WINDOW_MEMORY_STORAGE_KEY = "resume-template.dock.window-memory.v1";

/**
 * Build dock host template.
 * @returns {string}
 */
function getDockTemplate() {
  return [
    '<div id="dock" class="dock no-print" data-open="false">',
    '  <div id="dock-layer" class="dock-layer">',
    '    <div id="dock-glass" class="dock-glass" aria-hidden="true"></div>',
    '    <div id="dock-popover-host" class="dock-popover-host"></div>',
    '    <div id="dock-strip" class="dock-strip" role="toolbar" aria-label="Dock"></div>',
    "  </div>",
    "</div>",
    '<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">',
    '  <filter id="dock-frosted" primitiveUnits="objectBoundingBox">',
    '    <feImage href="capsule.png" preserveAspectRatio="none" x="0" y="0" width="1" height="1" result="map"></feImage>',
    '    <feGaussianBlur in="SourceGraphic" stdDeviation="0.0005" result="blur"></feGaussianBlur>',
    '    <feDisplacementMap id="disp" in="blur" in2="map" scale="0.02" xChannelSelector="R" yChannelSelector="G">',
    '      <animate attributeName="scale" to="0.025" dur="0.3s" begin="btn.mouseover" fill="freeze"></animate>',
    '      <animate attributeName="scale" to="0.02" dur="0.3s" begin="btn.mouseout" fill="freeze"></animate>',
    "    </feDisplacementMap>",
    "  </filter>",
    "</svg>"
  ].join("");
}

/**
 * Register dock custom element once.
 * @returns {void}
 */
function ensureDockElement() {
  if (customElements.get("resume-dock")) {
    return;
  }
  var ResumeDockElement = class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.mounted === "true") {
        return;
      }
      this.dataset.mounted = "true";
      this.innerHTML = getDockTemplate();
    }
  };
  customElements.define("resume-dock", ResumeDockElement);
}

/**
 * Clamp number.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Build dock component.
 * @param {{
 *   messager: {publish: (topic: string, payload: Record<string, unknown>) => void, subscribe: (topic: string, handler: (payload: any) => void) => () => void},
 *   refs: {resumeDock: HTMLElement|null},
 *   tokens: {activeFill?: number, activeBorder?: number, popoverBorder?: number, popoverTop?: number, popoverBottom?: number, popoverShadow?: number, popoverInsetBottom?: number},
 *   getState: () => any
 * }} context
 */
export function createDockComponent(context) {
  var messager = context.messager;
  var refs = context.refs;
  var tokens = context.tokens || {};
  var getState = context.getState;

  /** @type {HTMLElement|null} */
  var dockRoot = null;
  /** @type {HTMLElement|null} */
  var dockLayer = null;
  /** @type {HTMLElement|null} */
  var dockGlass = null;
  /** @type {HTMLElement|null} */
  var dockStrip = null;
  /** @type {HTMLElement|null} */
  var dockPopoverHost = null;
  /** @type {boolean} */
  var eventsBound = false;
  /** @type {number} */
  var timerId = 0;
  /** @type {Array<() => void>} */
  var offList = [];
  /** @type {{x:number,y:number,inside:boolean}} */
  var pointerState = { x: 0, y: 0, inside: false };
  /** @type {{phase:number,lastTickAt:number}} */
  var timeState = { phase: 0, lastTickAt: 0 };
  /** @type {{panel:string,startX:number,startY:number,originX:number,originY:number,pointerId:number,node:HTMLElement|null}|null} */
  var dragState = null;
  /** @type {{zCounter:number,items:Record<string,{x:number,y:number,z:number}>}} */
  var windows = { zCounter: 0, items: {} };
  /** @type {Record<string,{x:number,y:number}>} */
  var windowMemory = {};

  /**
   * Read dock window memory from localStorage.
   * @returns {Record<string,{x:number,y:number}>}
   */
  function readWindowMemoryStorage() {
    try {
      var raw = window.localStorage.getItem(DOCK_WINDOW_MEMORY_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }
      var safe = {};
      Object.keys(parsed).forEach(function (panel) {
        var entry = parsed[panel];
        if (!entry || typeof entry !== "object") {
          return;
        }
        safe[panel] = {
          x: Number(entry.x) || 0,
          y: Number(entry.y) || 0
        };
      });
      return safe;
    } catch (error) {
      return {};
    }
  }

  /**
   * Persist dock window memory into localStorage.
   * @returns {void}
   */
  function writeWindowMemoryStorage() {
    try {
      if (!Object.keys(windowMemory).length) {
        window.localStorage.removeItem(DOCK_WINDOW_MEMORY_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(DOCK_WINDOW_MEMORY_STORAGE_KEY, JSON.stringify(windowMemory));
    } catch (error) {
    }
  }

  /**
   * Apply liquid-glass token vars to dock root.
   * @returns {void}
   */
  function applyDockGlassTokens() {
    if (!dockRoot) {
      return;
    }
    dockRoot.style.setProperty("--dock-glass-active-fill", "rgba(255, 255, 255, " + Number(tokens.activeFill || 0.1).toFixed(3) + ")");
    dockRoot.style.setProperty("--dock-glass-active-border", "rgba(255, 255, 255, " + Number(tokens.activeBorder || 0.24).toFixed(3) + ")");
    dockRoot.style.setProperty("--dock-popover-border", "rgba(255, 255, 255, " + Number(tokens.popoverBorder || 0.62).toFixed(3) + ")");
    dockRoot.style.setProperty("--dock-popover-bg-top", "rgba(252, 254, 255, " + Number(tokens.popoverTop || 0.66).toFixed(3) + ")");
    dockRoot.style.setProperty("--dock-popover-bg-bottom", "rgba(236, 245, 255, " + Number(tokens.popoverBottom || 0.38).toFixed(3) + ")");
    dockRoot.style.setProperty("--dock-popover-shadow", "rgba(48, 72, 108, " + Number(tokens.popoverShadow || 0.2).toFixed(3) + ")");
    dockRoot.style.setProperty("--dock-popover-inset-bottom", "rgba(162, 198, 238, " + Number(tokens.popoverInsetBottom || 0.18).toFixed(3) + ")");
  }

  /**
   * Ensure one window state exists.
   * @param {string} panel
   * @returns {{x:number,y:number,z:number}}
   */
  function ensureWindowState(panel) {
    if (!windows.items[panel]) {
      var cached = windowMemory[panel] || { x: 0, y: 0 };
      windows.zCounter += 1;
      windows.items[panel] = {
        x: Number(cached.x) || 0,
        y: Number(cached.y) || 0,
        z: windows.zCounter
      };
    }
    return windows.items[panel];
  }

  /**
   * Test whether panel window is currently open.
   * @param {string} panel
   * @returns {boolean}
   */
  function isWindowOpen(panel) {
    return !!windows.items[panel];
  }

  /**
   * Focus panel window (bring to top z-index).
   * @param {string} panel
   * @returns {void}
   */
  function focusWindow(panel) {
    if (!isWindowOpen(panel)) {
      return;
    }
    windows.zCounter += 1;
    windows.items[panel].z = windows.zCounter;
    messager.publish("command:request", {
      type: "runtime/set-active-panel",
      payload: { panel: panel }
    });
  }

  /**
   * Raise one window to top z-index without publishing state commands.
   * @param {string} panel
   * @returns {number}
   */
  function raiseWindowZ(panel) {
    if (!isWindowOpen(panel)) {
      return 0;
    }
    windows.zCounter += 1;
    windows.items[panel].z = windows.zCounter;
    return windows.items[panel].z;
  }

  /**
   * Open one panel window.
   * @param {string} panel
   * @returns {void}
   */
  function openWindow(panel) {
    ensureWindowState(panel);
    focusWindow(panel);
  }

  /**
   * Close one panel window.
   * @param {string} panel
   * @param {{preservePosition: boolean}} options
   * @returns {void}
   */
  function closeWindow(panel, options) {
    var state = windows.items[panel];
    if (!state) {
      return;
    }
    if (options.preservePosition) {
      windowMemory[panel] = {
        x: Number(state.x) || 0,
        y: Number(state.y) || 0
      };
    } else {
      delete windowMemory[panel];
    }
    writeWindowMemoryStorage();
    delete windows.items[panel];
    if (dragState && dragState.panel === panel) {
      dragState = null;
    }
  }

  /**
   * Close top-most open window.
   * @returns {boolean}
   */
  function closeTopDockWindow() {
    var panels = Object.keys(windows.items);
    if (!panels.length) {
      return false;
    }
    var topPanel = panels[0];
    var topZ = ensureWindowState(topPanel).z;
    panels.forEach(function (panel) {
      var z = ensureWindowState(panel).z;
      if (z > topZ) {
        topPanel = panel;
        topZ = z;
      }
    });
    closeWindow(topPanel, { preservePosition: true });
    render();
    return true;
  }

  /**
   * Build strip icon buttons html.
   * @returns {string}
   */
  function renderDockStripHtml() {
    return Object.keys(PANEL_LABELS).map(function (panel) {
      var active = isWindowOpen(panel);
      return [
        '<button type="button" class="dock-icon' + (active ? " is-active" : "") + '" data-panel="' + panel + '" title="' + PANEL_LABELS[panel] + '" aria-label="' + PANEL_LABELS[panel] + '" aria-pressed="' + (active ? "true" : "false") + '">',
        '<span class="dock-icon-art" aria-hidden="true">',
        ICON_MARKUP[panel] || ICON_MARKUP.content,
        "</span>",
        '<span class="dock-label">' + PANEL_LABELS[panel] + "</span>",
        '<span class="dock-dot" aria-hidden="true"></span>',
        "</button>"
      ].join("");
    }).join("");
  }

  /**
   * Resolve title/note by panel.
   * @param {string} panel
   * @param {any} state
   * @returns {{title: string, note: string}}
   */
  function getWindowMeta(panel, state) {
    var selectedModuleId = String(state.runtime.selectedModuleId || "");
    var hasSelected = !!selectedModuleId;
    if (panel === "style") {
      return hasSelected
        ? { title: "模块样式", note: "正在调整当前模块的局部样式。" }
        : { title: "全局主题", note: "当前未选中模块，正在编辑全局主题。" };
    }
    if (panel === "view") {
      return { title: "视图", note: "可以切换连续画布与 A4 画板辅助视图。" };
    }
    if (panel === "file") {
      return { title: "文件", note: "可以导入、导出或打印当前简历。" };
    }
    return hasSelected
      ? { title: "内容", note: "已选中模块，可复制、删除、微调位置或尺寸。" }
      : { title: "内容", note: "可以新增模块，或调整当前选中的模块。" };
  }

  /**
   * Render one popover window shell.
   * @param {string} panel
   * @param {{x:number,y:number,z:number}} winState
   * @param {any} state
   * @returns {string}
   */
  function renderPopoverWindow(panel, winState, state) {
    var meta = getWindowMeta(panel, state);
    var status = String(state.runtime.status || "未保存");
    var tone = String(state.runtime.statusTone || "");
    return [
      '<div class="dock-popover" data-open="true" data-panel="' + panel + '" style="z-index:' + winState.z + ";--dock-popover-x:" + Math.round(winState.x) + "px;--dock-popover-y:" + Math.round(winState.y) + 'px;">',
      '  <div class="drawer-head">',
      "    <div>",
      '      <h2 class="drawer-title">' + meta.title + "</h2>",
      '      <p class="drawer-note">' + meta.note + "</p>",
      "    </div>",
      '    <div class="drawer-head-actions">',
      '      <div class="window-controls">',
      '        <button type="button" class="window-control window-control-close" data-action="close-popover" data-panel="' + panel + '" aria-label="关闭" title="关闭"><span>×</span></button>',
      '        <button type="button" class="window-control window-control-minimize" data-action="minimize-popover" data-panel="' + panel + '" aria-label="最小化" title="最小化"><span>−</span></button>',
      "      </div>",
      '      <div class="dock-status' + (tone ? " " + tone : "") + '">' + status + "</div>",
      "    </div>",
      "  </div>",
      '  <div class="drawer-panel" data-panel="' + panel + '"></div>',
      "</div>"
    ].join("");
  }

  /**
   * Render all popover windows sorted by z-index.
   * @returns {string}
   */
  function renderPopoverWindowsHtml() {
    var state = getState();
    return Object.keys(windows.items)
      .sort(function (a, b) {
        return ensureWindowState(a).z - ensureWindowState(b).z;
      })
      .map(function (panel) {
        return renderPopoverWindow(panel, ensureWindowState(panel), state);
      })
      .join("");
  }

  /**
   * Publish dock view updates.
   * @returns {void}
   */
  function render() {
    if (!dockRoot || !dockStrip || !dockPopoverHost) {
      return;
    }
    var panels = Object.keys(windows.items);
    messager.publish("view:update", {
      slot: "dock.strip",
      selector: "#dock-strip",
      html: renderDockStripHtml()
    });
    messager.publish("view:update", {
      slot: "dock.windows",
      selector: "#dock-popover-host",
      html: renderPopoverWindowsHtml()
    });
    messager.publish("view:update", {
      slot: "dock.root",
      selector: "#dock",
      attrs: { "data-open": panels.length ? "true" : "false" }
    });
    messager.publish("dock:windows-changed", { panels: panels });
  }

  /**
   * Refresh popover header/status text in-place without rebuilding windows.
   * @returns {void}
   */
  function refreshWindowMetaFromState() {
    if (!dockLayer) {
      return;
    }
    var state = getState();
    var popovers = dockLayer.querySelectorAll(".dock-popover");
    Array.prototype.forEach.call(popovers, function (popover) {
      var panel = String(popover.getAttribute("data-panel") || "content");
      var meta = getWindowMeta(panel, state);
      var titleNode = popover.querySelector(".drawer-title");
      if (titleNode) {
        titleNode.textContent = meta.title;
      }
      var noteNode = popover.querySelector(".drawer-note");
      if (noteNode) {
        noteNode.textContent = meta.note;
      }
      var statusNode = popover.querySelector(".dock-status");
      if (statusNode) {
        var tone = String(state.runtime.statusTone || "");
        statusNode.textContent = String(state.runtime.status || "未保存");
        statusNode.className = "dock-status" + (tone ? " " + tone : "");
      }
    });
  }

  /**
   * Handle dock strip button click.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleDockStripClick(event) {
    var target = /** @type {HTMLElement} */ (event.target);
    var button = target.closest("[data-panel]");
    if (!button) {
      return;
    }
    var panel = String(button.dataset.panel || "content");
    if (isWindowOpen(panel)) {
      closeWindow(panel, { preservePosition: true });
      render();
      return;
    }
    openWindow(panel);
    render();
  }

  /**
   * Handle click events inside dock layer.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleDockLayerClick(event) {
    var target = /** @type {HTMLElement} */ (event.target);
    var popover = target.closest(".dock-popover");
    if (!popover) {
      return;
    }
    var panel = String(popover.dataset.panel || "content");
    var interactiveTarget = target.closest("input,select,textarea,option,label");
    var actionNode = target.closest("[data-action]");
    if (actionNode) {
      var action = String(actionNode.dataset.action || "");
      if (action === "close-popover") {
        closeWindow(panel, { preservePosition: false });
        render();
        return;
      }
      if (action === "minimize-popover") {
        closeWindow(panel, { preservePosition: true });
        render();
        return;
      }
      return;
    }
    if (interactiveTarget) {
      return;
    }
    var nextZ = raiseWindowZ(panel);
    if (nextZ > 0) {
      popover.style.zIndex = String(nextZ);
    }
  }

  /**
   * Handle pointer down for popover focus and drag.
   * @param {PointerEvent} event
   * @returns {void}
   */
  function handleDockPointerDown(event) {
    var target = /** @type {HTMLElement} */ (event.target);
    var popover = target.closest(".dock-popover");
    if (!popover) {
      return;
    }
    var panel = String(popover.dataset.panel || "content");
    var interactiveTarget = target.closest("[data-action],button,input,select,textarea,a,label");
    var head = target.closest(".drawer-head");
    var canDrag = !!head && !interactiveTarget;
    if (canDrag) {
      var nextZ = raiseWindowZ(panel);
      if (nextZ > 0) {
        popover.style.zIndex = String(nextZ);
      }
    } else if (!interactiveTarget) {
      var clickZ = raiseWindowZ(panel);
      if (clickZ > 0) {
        popover.style.zIndex = String(clickZ);
      }
    }

    if (!canDrag) {
      return;
    }
    var winState = ensureWindowState(panel);
    dragState = {
      panel: panel,
      startX: event.clientX,
      startY: event.clientY,
      originX: Number(winState.x) || 0,
      originY: Number(winState.y) || 0,
      pointerId: event.pointerId,
      node: /** @type {HTMLElement|null} */ (popover)
    };
    if (typeof popover.setPointerCapture === "function") {
      try {
        popover.setPointerCapture(event.pointerId);
      } catch (error) {
      }
    }
    popover.classList.add("is-dragging");
    event.preventDefault();
  }

  /**
   * Update pointer state in dock-layer coordinates.
   * @param {PointerEvent} event
   * @returns {void}
   */
  function updatePointerState(event) {
    if (!dockLayer) {
      return;
    }
    var rect = dockLayer.getBoundingClientRect();
    pointerState.x = event.clientX - rect.left;
    pointerState.y = event.clientY - rect.top;
    pointerState.inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
  }

  /**
   * Handle global pointermove from app root.
   * @param {PointerEvent} event
   * @returns {boolean}
   */
  function handlePointerMove(event) {
    updatePointerState(event);
    if (!dragState) {
      return false;
    }
    var winState = ensureWindowState(dragState.panel);
    winState.x = Math.round(dragState.originX + (event.clientX - dragState.startX));
    winState.y = Math.round(dragState.originY + (event.clientY - dragState.startY));
    if (dragState.node) {
      dragState.node.style.setProperty("--dock-popover-x", Math.round(winState.x) + "px");
      dragState.node.style.setProperty("--dock-popover-y", Math.round(winState.y) + "px");
    }
    return true;
  }

  /**
   * Handle global pointerup from app root.
   * @returns {boolean}
   */
  function handlePointerUp() {
    if (!dragState) {
      return false;
    }
    var panel = dragState.panel;
    if (dragState.node) {
      dragState.node.classList.remove("is-dragging");
      if (typeof dragState.node.releasePointerCapture === "function") {
        try {
          dragState.node.releasePointerCapture(dragState.pointerId);
        } catch (error) {
        }
      }
    }
    dragState = null;
    messager.publish("command:request", {
      type: "runtime/set-active-panel",
      payload: { panel: panel }
    });
    return true;
  }

  /**
   * Ensure dock-layer metrics for liquid-glass drawing.
   * @returns {{width:number,height:number,layerRect:DOMRect}|null}
   */
  function ensureDockLayerMetrics() {
    if (!dockLayer) {
      return null;
    }
    var layerRect = dockLayer.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(layerRect.width)),
      height: Math.max(1, Math.round(layerRect.height)),
      layerRect: layerRect
    };
  }

  /**
   * Collect icon slot rectangles for active highlighting.
   * @param {DOMRect} layerRect
   * @returns {Array<{x:number,y:number,width:number,height:number,active:boolean}>}
   */
  function collectDockSlots(layerRect) {
    if (!dockStrip) {
      return [];
    }
    return Array.prototype.map.call(dockStrip.querySelectorAll(".dock-icon"), function (button) {
      var rect = button.getBoundingClientRect();
      return {
        x: rect.left - layerRect.left,
        y: rect.top - layerRect.top,
        width: rect.width,
        height: rect.height,
        active: button.classList.contains("is-active")
      };
    });
  }

  /**
   * Compute dock capsule shape based on pointer and strip size.
   * @param {number} width
   * @param {number} height
   * @param {{width:number,height:number}} stripSize
   * @returns {{x:number,y:number,width:number,height:number,radius:number,centerX:number,centerY:number}|null}
   */
  function computeDockShape(width, height, stripSize) {
    if (!stripSize.width || !stripSize.height) {
      return null;
    }
    var paddingX = 7;
    var dockWidth = Math.min(Math.max(stripSize.width + paddingX * 2, 220), Math.max(188, width - 8));
    var dockHeight = clamp(stripSize.height + 1, 32, 36);
    var centerX = width / 2;
    var centerY = height - dockHeight / 2 - 4.5;
    var pointerPullX = pointerState.inside ? clamp((pointerState.x - centerX) * 0.006, -1.2, 1.2) : 0;
    var pointerPullY = pointerState.inside ? clamp((pointerState.y - centerY) * 0.004, -0.45, 0.45) : 0;
    centerX += pointerPullX;
    centerY += pointerPullY;
    return {
      x: centerX - dockWidth / 2,
      y: centerY - dockHeight / 2,
      width: dockWidth,
      height: dockHeight,
      radius: dockHeight / 2,
      centerX: centerX,
      centerY: centerY
    };
  }

  /**
   * Draw dock liquid-glass scene.
   * @returns {void}
   */
  function drawDockScene() {
    if (!dockStrip || !dockGlass) {
      return;
    }
    if (dragState) {
      return;
    }
    var metrics = ensureDockLayerMetrics();
    if (!metrics) {
      return;
    }
    var slots = collectDockSlots(metrics.layerRect);
    if (!slots.length) {
      return;
    }
    var stripSize = {
      width: Math.max(1, dockStrip.offsetWidth),
      height: Math.max(1, dockStrip.offsetHeight)
    };
    var shape = computeDockShape(metrics.width, metrics.height, stripSize);
    if (!shape) {
      return;
    }
    dockStrip.style.left = shape.centerX.toFixed(2) + "px";
    dockStrip.style.top = shape.centerY.toFixed(2) + "px";
    dockGlass.style.left = shape.x.toFixed(2) + "px";
    dockGlass.style.top = shape.y.toFixed(2) + "px";
    dockGlass.style.width = shape.width.toFixed(2) + "px";
    dockGlass.style.height = shape.height.toFixed(2) + "px";
    dockGlass.style.borderRadius = shape.radius.toFixed(2) + "px";
  }

  /**
   * Start dock animation timer.
   * @returns {void}
   */
  function startTimerLoop() {
    if (timerId) {
      return;
    }
    timeState.lastTickAt = Date.now();
    timerId = window.setInterval(function () {
      timeState.phase += 0.033;
      timeState.lastTickAt = Date.now();
      drawDockScene();
    }, 33);
    drawDockScene();
  }

  /**
   * Stop dock animation timer.
   * @returns {void}
   */
  function stopTimerLoop() {
    if (!timerId) {
      return;
    }
    window.clearInterval(timerId);
    timerId = 0;
  }

  /**
   * Bind dock DOM events and bus subscriptions.
   * @returns {void}
   */
  function bindEvents() {
    if (eventsBound || !dockLayer || !dockStrip) {
      return;
    }
    dockStrip.addEventListener("click", handleDockStripClick);
    dockLayer.addEventListener("click", handleDockLayerClick);
    dockLayer.addEventListener("pointerdown", handleDockPointerDown);
    eventsBound = true;

    offList.push(messager.subscribe("state:changed", function () {
      if (dragState) {
        return;
      }
      refreshWindowMetaFromState();
    }));
    offList.push(messager.subscribe("render:flushed", function (payload) {
      var slots = Array.isArray(payload.slots) ? payload.slots : [];
      if (slots.indexOf("dock.strip") >= 0 || slots.indexOf("dock.windows") >= 0) {
        drawDockScene();
      }
    }));
  }

  /**
   * Mount dock template and local refs.
   * @returns {void}
   */
  function mount() {
    ensureDockElement();
    windowMemory = readWindowMemoryStorage();
    var host = refs.resumeDock || document.getElementById("resume-dock");
    if (!host) {
      return;
    }
    if (host.innerHTML.trim() === "") {
      host.innerHTML = getDockTemplate();
    }
    dockRoot = /** @type {HTMLElement|null} */ (host.querySelector("#dock"));
    dockLayer = /** @type {HTMLElement|null} */ (host.querySelector("#dock-layer"));
    dockGlass = /** @type {HTMLElement|null} */ (host.querySelector("#dock-glass"));
    dockStrip = /** @type {HTMLElement|null} */ (host.querySelector("#dock-strip"));
    dockPopoverHost = /** @type {HTMLElement|null} */ (host.querySelector("#dock-popover-host"));
    applyDockGlassTokens();
    render();
  }

  /**
   * Reset runtime-only dock states.
   * @returns {void}
   */
  function resetRuntimeUi() {
    windows = { zCounter: 0, items: {} };
    windowMemory = {};
    writeWindowMemoryStorage();
    dragState = null;
    render();
  }

  /**
   * Remove event bindings and timers.
   * @returns {void}
   */
  function destroy() {
    stopTimerLoop();
    offList.forEach(function (off) { off(); });
    offList = [];
    if (eventsBound && dockStrip && dockLayer) {
      dockStrip.removeEventListener("click", handleDockStripClick);
      dockLayer.removeEventListener("click", handleDockLayerClick);
      dockLayer.removeEventListener("pointerdown", handleDockPointerDown);
      eventsBound = false;
    }
  }

  return {
    mount: mount,
    bindEvents: bindEvents,
    render: render,
    startTimerLoop: startTimerLoop,
    stopTimerLoop: stopTimerLoop,
    handlePointerMove: handlePointerMove,
    handlePointerUp: handlePointerUp,
    closeTopDockWindow: closeTopDockWindow,
    resetRuntimeUi: resetRuntimeUi,
    destroy: destroy
  };
}

/**
 * Backward-compatible named export.
 * @type {{create: typeof createDockComponent}}
 */
export var ResumeDockController = {
  create: createDockComponent
};

if (typeof window !== "undefined") {
  // @ts-ignore runtime bridge for debugging
  window.ResumeDockController = ResumeDockController;
}
