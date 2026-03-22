// @ts-check

import {
  clampPx,
  cssEscape,
  escapeAttr,
  formatEditable,
  hasText,
  insertPlainText,
  readEditableText
} from "../../utils/helpers.js";

/**
 * @file Resume module canvas component.
 * @description
 * Owns module view rendering, contenteditable write-back, selection, drag, and resize.
 */

/**
 * Register resume-module custom element once.
 * @returns {void}
 */
function ensureResumeModuleElement() {
  if (customElements.get("resume-module")) {
    return;
  }
  var ResumeModuleElement = class extends HTMLElement {
    connectedCallback() {
      if (!this.classList.contains("resume-module")) {
        this.classList.add("resume-module");
      }
    }
  };
  customElements.define("resume-module", ResumeModuleElement);
}

/**
 * Build resume module component.
 * @param {{
 *   messager: {publish: (topic: string, payload: Record<string, unknown>) => void, subscribe: (topic: string, handler: (payload: any) => void) => () => void},
 *   refs: {canvas: HTMLElement, canvasFrame: HTMLElement},
 *   getState: () => any,
 *   moduleLibrary: Record<string, any>,
 *   textTypes: Record<string, boolean>,
 *   compositeTypes: Record<string, boolean>,
 *   layoutTools: {
 *     getLayoutMetrics: () => any,
 *     getMinModuleWidthPx: (metrics?: any) => number,
 *     getMinModuleHeightPx: (metrics?: any) => number,
 *     getModuleInlineLayoutStyle: (layout: {left:number,top:number,width:number,height:number}) => string,
 *     updateCanvasMetrics: () => void
 *   },
 *   resolveModuleAppearance: (theme: any, moduleStyle: any) => any
 * }} context
 */
export function createResumeModuleComponent(context) {
  var messager = context.messager;
  var refs = context.refs;
  var getState = context.getState;
  var moduleLibrary = context.moduleLibrary;
  var textTypes = context.textTypes;
  var compositeTypes = context.compositeTypes;
  var layoutTools = context.layoutTools;
  var resolveModuleAppearance = context.resolveModuleAppearance;

  /** @type {Array<() => void>} */
  var offList = [];
  /** @type {boolean} */
  var eventsBound = false;
  /** @type {boolean} */
  var layoutQueued = false;
  /** @type {{kind:"move"|"resize-width"|"resize-height",moduleId:string,startX:number,startY:number,startLayout:{left:number,top:number,width:number,height:number},colUnit:number,rowUnit:number,currentLayout:{left:number,top:number,width:number,height:number}}|null} */
  var interaction = null;

  /**
   * Find module by id from current state.
   * @param {string} moduleId
   * @returns {any|null}
   */
  function findModule(moduleId) {
    var state = getState();
    return state.modules.find(function (module) {
      return module.id === moduleId;
    }) || null;
  }

  /**
   * Find module node in current canvas DOM.
   * @param {string} moduleId
   * @returns {HTMLElement|null}
   */
  function findModuleNode(moduleId) {
    return /** @type {HTMLElement|null} */ (
      refs.canvas.querySelector('.resume-module[data-module-id="' + cssEscape(moduleId) + '"]')
    );
  }

  /**
   * Convert unknown event target to nearest element node.
   * @param {EventTarget|null} target
   * @returns {HTMLElement|null}
   */
  function getTargetElement(target) {
    if (target instanceof HTMLElement) {
      return target;
    }
    if (target instanceof Node) {
      return target.parentElement;
    }
    return null;
  }

  /**
   * Update module selected flags without rebuilding canvas html.
   * @param {string} selectedModuleId
   * @returns {void}
   */
  function updateSelectionUI(selectedModuleId) {
    var nodes = refs.canvas.querySelectorAll(".resume-module");
    Array.prototype.forEach.call(nodes, function (node) {
      var moduleId = String(node.getAttribute("data-module-id") || "");
      var isSelected = moduleId === selectedModuleId;
      var isInteracting = !!interaction && moduleId === interaction.moduleId;
      node.setAttribute("data-selected", isSelected ? "true" : "false");
      node.setAttribute("data-interacting", isInteracting ? "true" : "false");
    });
  }

  /**
   * Update one module drag interaction flag.
   * @param {string} moduleId
   * @param {boolean} interacting
   * @returns {void}
   */
  function setModuleInteracting(moduleId, interacting) {
    var node = findModuleNode(moduleId);
    if (!node) {
      return;
    }
    node.setAttribute("data-interacting", interacting ? "true" : "false");
  }

  /**
   * Select one module if current selection differs.
   * @param {string} moduleId
   * @param {{activateStylePanel?: boolean}=} options
   * @returns {void}
   */
  function ensureModuleSelected(moduleId, options) {
    if (!moduleId) {
      return;
    }
    var selectedModuleId = String(getState().runtime.selectedModuleId || "");
    if (selectedModuleId === moduleId) {
      updateSelectionUI(moduleId);
      return;
    }
    updateSelectionUI(moduleId);
    /** @type {{moduleId:string,activateStylePanel?:boolean}} */
    var payload = { moduleId: moduleId };
    if (options && options.activateStylePanel) {
      payload.activateStylePanel = true;
    }
    messager.publish("command:request", {
      type: "runtime/select-module",
      payload: payload
    });
  }

  /**
   * Apply numeric layout to one module node.
   * @param {HTMLElement} node
   * @param {{left:number,top:number,width:number,height:number}} layout
   * @param {any} metrics
   * @returns {void}
   */
  function applyNodeLayoutStyle(node, layout, metrics) {
    node.style.left = Math.round(metrics.padding.left + (Number(layout.left) || 0)) + "px";
    node.style.top = Math.round(metrics.padding.top + (Number(layout.top) || 0)) + "px";
    node.style.width = Math.round(Number(layout.width) || metrics.innerWidth) + "px";
    node.style.minHeight = Math.round(Number(layout.height) || layoutTools.getMinModuleHeightPx(metrics)) + "px";
  }

  /**
   * Schedule layout pass to keep canvas height in sync.
   * @returns {void}
   */
  function scheduleLayout() {
    if (layoutQueued) {
      return;
    }
    layoutQueued = true;
    window.requestAnimationFrame(function () {
      layoutQueued = false;
      applyLayout();
    });
  }

  /**
   * Apply absolute styles and canvas min-height.
   * @returns {void}
   */
  function applyLayout() {
    layoutTools.updateCanvasMetrics();
    var state = getState();
    if (!state.modules.length) {
      refs.canvas.style.minHeight = "";
      return;
    }
    var metrics = layoutTools.getLayoutMetrics();
    var minHeight = layoutTools.getMinModuleHeightPx(metrics);
    var maxBottom = 0;

    state.modules.forEach(function (module) {
      var layout = module.layout;
      if (interaction && interaction.moduleId === module.id) {
        layout = interaction.currentLayout;
      }
      var node = findModuleNode(module.id);
      if (!node) {
        return;
      }
      applyNodeLayoutStyle(node, layout, metrics);
      var effectiveHeight = Math.max(minHeight, layout.height, node.offsetHeight);
      maxBottom = Math.max(maxBottom, layout.top + effectiveHeight);
    });

    refs.canvas.style.minHeight = Math.max(Math.round(metrics.padding.top + maxBottom + metrics.padding.bottom + metrics.gap * 2), 1123) + "px";
    window.requestAnimationFrame(layoutTools.updateCanvasMetrics);
  }

  /**
   * Render entire module canvas html.
   * @returns {void}
   */
  function renderCanvas() {
    var state = getState();
    var html = "";
    if (!state.modules.length) {
      html = '<div class="empty-state">当前还没有模块。可从底部 Dock 的“内容”面板中新增模块。</div>';
    } else {
      html = state.modules.map(function (module) {
        return renderModule(module, state);
      }).join("");
    }
    messager.publish("view:update", {
      slot: "canvas.modules",
      selector: "#resume-canvas",
      html: html
    });
  }

  /**
   * Render one module wrapper.
   * @param {any} module
   * @param {any} state
   * @returns {string}
   */
  function renderModule(module, state) {
    var selected = state.runtime.selectedModuleId === module.id;
    var resolved = resolveModuleAppearance(state.theme, module.style);
    var styleVars = [
      "--module-text:" + resolved.text,
      "--module-title-color:" + resolved.titleColor,
      "--module-accent:" + resolved.accent,
      "--module-divider:" + resolved.divider,
      "--module-border:" + resolved.border,
      "--module-bg:" + resolved.background,
      "--module-align:" + resolved.align,
      "--module-padding:" + resolved.padding + "px"
    ].join(";");
    return [
      '<resume-module class="resume-module" data-module-id="' + escapeAttr(module.id) + '" data-type="' + escapeAttr(module.type) + '" data-selected="' + (selected ? "true" : "false") + '" data-interacting="false" data-has-title="' + (hasText(module.title) ? "true" : "false") + '" data-title-style="' + resolved.titleStyle + '" data-divider-style="' + resolved.dividerStyle + '" data-item-divider-style="' + resolved.itemDividerStyle + '" data-border-style="' + resolved.borderStyle + '" data-ornament-style="' + resolved.ornamentStyle + '" data-background-style="' + resolved.backgroundStyle + '" style="' + escapeAttr(layoutTools.getModuleInlineLayoutStyle(module.layout) + ";" + styleVars) + '">',
      '  <div class="chrome-cluster no-print">',
      '    <button type="button" class="chrome-btn chrome-handle" data-interaction="move" data-module-id="' + escapeAttr(module.id) + '" aria-label="拖动模块">拖动</button>',
      '    <button type="button" class="chrome-btn" data-action="duplicate-module" data-module-id="' + escapeAttr(module.id) + '" aria-label="复制模块">复制</button>',
      '    <button type="button" class="chrome-btn" data-action="delete-module" data-module-id="' + escapeAttr(module.id) + '" aria-label="删除模块">删除</button>',
      "  </div>",
      '  <button type="button" class="module-resize module-resize-width no-print" data-interaction="resize-width" data-module-id="' + escapeAttr(module.id) + '" aria-label="调整模块宽度"></button>',
      '  <button type="button" class="module-resize module-resize-height no-print" data-interaction="resize-height" data-module-id="' + escapeAttr(module.id) + '" aria-label="调整模块高度"></button>',
      '  <div class="module-surface">',
      renderModuleHeader(module),
      '    <div class="module-content">',
      renderModuleBody(module),
      "    </div>",
      renderModuleFooter(module),
      "  </div>",
      "</resume-module>"
    ].join("");
  }

  /**
   * Render module header.
   * @param {any} module
   * @returns {string}
   */
  function renderModuleHeader(module) {
    return [
      '<div class="module-header">',
      '  <div class="module-title editable" contenteditable="true" data-bind-kind="module" data-module-id="' + escapeAttr(module.id) + '" data-field="title" data-placeholder="模块标题" data-single-line="true">' + formatEditable(module.title) + "</div>",
      "</div>"
    ].join("");
  }

  /**
   * Render module body by type.
   * @param {any} module
   * @returns {string}
   */
  function renderModuleBody(module) {
    if (module.type === "identity") {
      return renderIdentityModule(module);
    }
    if (module.type === "contacts") {
      return renderContactsModule(module);
    }
    if (textTypes[module.type]) {
      return renderTextModule(module);
    }
    if (module.type === "skills") {
      return renderSkillsModule(module);
    }
    if (compositeTypes[module.type]) {
      return renderCompositeModule(module);
    }
    if (module.type === "list") {
      return renderListModule(module);
    }
    return "";
  }

  /**
   * Render identity module body.
   * @param {any} module
   * @returns {string}
   */
  function renderIdentityModule(module) {
    var item = module.items[0];
    return [
      '<div class="item-block">',
      '  <div class="identity-name editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="name" data-placeholder="姓名">' + formatEditable(item.name) + "</div>",
      '  <div class="identity-role editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="role" data-placeholder="目标岗位 / 职位">' + formatEditable(item.role) + "</div>",
      "</div>"
    ].join("");
  }

  /**
   * Render contacts module body.
   * @param {any} module
   * @returns {string}
   */
  function renderContactsModule(module) {
    return module.items.map(function (item) {
      return [
        '<div class="item-block">',
        '  <div class="item-tools no-print">',
        '    <button type="button" class="tool-btn" data-action="duplicate-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">⧉</button>',
        '    <button type="button" class="tool-btn" data-action="delete-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">×</button>',
        "  </div>",
        '  <div class="contact-row">',
        '    <div class="contact-label editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="label" data-placeholder="类型" data-single-line="true">' + formatEditable(item.label) + "</div>",
        '    <div class="contact-value editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="value" data-placeholder="邮箱 / 电话 / 链接">' + formatEditable(item.value) + "</div>",
        "  </div>",
        "</div>"
      ].join("");
    }).join("");
  }

  /**
   * Render text module body.
   * @param {any} module
   * @returns {string}
   */
  function renderTextModule(module) {
    return module.items.map(function (item) {
      return [
        '<div class="item-block">',
        '  <div class="item-tools no-print">',
        '    <button type="button" class="tool-btn" data-action="duplicate-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">⧉</button>',
        '    <button type="button" class="tool-btn" data-action="delete-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">×</button>',
        "  </div>",
        '  <div class="text-paragraph editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="content" data-placeholder="输入正文内容">' + formatEditable(item.content) + "</div>",
        "</div>"
      ].join("");
    }).join("");
  }

  /**
   * Render skills module body.
   * @param {any} module
   * @returns {string}
   */
  function renderSkillsModule(module) {
    return module.items.map(function (item) {
      return [
        '<div class="item-block">',
        '  <div class="item-tools no-print">',
        '    <button type="button" class="tool-btn" data-action="duplicate-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">⧉</button>',
        '    <button type="button" class="tool-btn" data-action="delete-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">×</button>',
        "  </div>",
        '  <ul class="skill-row">',
        '    <li class="skill-item">',
        '      <div class="skill-value editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="value" data-placeholder="熟悉的语言、工具或能力">' + formatEditable(item.value) + "</div>",
        "    </li>",
        "  </ul>",
        "</div>"
      ].join("");
    }).join("");
  }

  /**
   * Render composite module body.
   * @param {any} module
   * @returns {string}
   */
  function renderCompositeModule(module) {
    return module.items.map(function (item) {
      return [
        '<div class="item-block">',
        '  <div class="item-tools no-print">',
        '    <button type="button" class="tool-btn" data-action="duplicate-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">⧉</button>',
        '    <button type="button" class="tool-btn" data-action="delete-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">×</button>',
        "  </div>",
        '  <div class="record-top">',
        '    <div class="record-main">',
        '      <div class="record-title editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="title" data-placeholder="公司 / 学校 / 项目名称">' + formatEditable(item.title) + "</div>",
        '      <div class="record-subtitle editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="subtitle" data-placeholder="岗位 / 专业 / 角色">' + formatEditable(item.subtitle) + "</div>",
        "    </div>",
        '    <div class="record-date editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="date" data-placeholder="时间" data-single-line="true">' + formatEditable(item.date) + "</div>",
        "  </div>",
        '  <div class="record-description editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="description" data-placeholder="简要说明，可留空。">' + formatEditable(item.description) + "</div>",
        renderBullets(module, item),
        "</div>"
      ].join("");
    }).join("");
  }

  /**
   * Render custom list module body.
   * @param {any} module
   * @returns {string}
   */
  function renderListModule(module) {
    return module.items.map(function (item) {
      return [
        '<div class="item-block">',
        '  <div class="item-tools no-print">',
        '    <button type="button" class="tool-btn" data-action="duplicate-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">⧉</button>',
        '    <button type="button" class="tool-btn" data-action="delete-item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">×</button>',
        "  </div>",
        '  <div class="list-title editable" contenteditable="true" data-bind-kind="item" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-field="title" data-placeholder="列表标题">' + formatEditable(item.title) + "</div>",
        renderBullets(module, item),
        "</div>"
      ].join("");
    }).join("");
  }

  /**
   * Render bullets section for one item.
   * @param {any} module
   * @param {any} item
   * @returns {string}
   */
  function renderBullets(module, item) {
    var bullets = Array.isArray(item.bullets) ? item.bullets : [];
    var listHtml = bullets.length
      ? '<ul class="bullet-list">' + bullets.map(function (bullet, index) {
        return [
          '<li class="bullet-row">',
          '  <div class="editable" contenteditable="true" data-bind-kind="bullet" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-bullet-index="' + index + '" data-placeholder="要点描述">' + formatEditable(bullet) + "</div>",
          '  <div class="item-tools no-print">',
          '    <button type="button" class="tool-btn" data-action="delete-bullet" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '" data-bullet-index="' + index + '">×</button>',
          "  </div>",
          "</li>"
        ].join("");
      }).join("") + "</ul>"
      : "";
    return [
      '<div class="inline-actions no-print">',
      '  <button type="button" class="mini-btn" data-action="add-bullet" data-module-id="' + escapeAttr(module.id) + '" data-item-id="' + escapeAttr(item.id) + '">新增要点</button>',
      "</div>",
      listHtml
    ].join("");
  }

  /**
   * Render module footer.
   * @param {any} module
   * @returns {string}
   */
  function renderModuleFooter(module) {
    if (moduleLibrary[module.type] && moduleLibrary[module.type].singleItem) {
      return "";
    }
    return '<div class="module-footer-actions no-print"><button type="button" class="mini-btn" data-action="add-item" data-module-id="' + escapeAttr(module.id) + '">新增条目</button></div>';
  }

  /**
   * Handle click events in module canvas.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleCanvasClick(event) {
    var target = getTargetElement(event.target);
    if (!target) {
      return;
    }
    var moduleNode = target.closest(".resume-module");
    var actionNode = target.closest("[data-action]");
    if (actionNode) {
      handleAction(actionNode);
      return;
    }
    if (!moduleNode) {
      updateSelectionUI("");
      messager.publish("command:request", {
        type: "runtime/select-module",
        payload: { moduleId: "" }
      });
      return;
    }
    ensureModuleSelected(String(moduleNode.dataset.moduleId || ""));
  }

  /**
   * Handle data-action button clicks in canvas.
   * @param {HTMLElement} node
   * @returns {void}
   */
  function handleAction(node) {
    var action = String(node.dataset.action || "");
    var moduleId = String(node.dataset.moduleId || "");
    var itemId = String(node.dataset.itemId || "");
    if (!action) {
      return;
    }
    if (action === "duplicate-module") {
      messager.publish("command:request", { type: "module/duplicate", payload: { moduleId: moduleId } });
      return;
    }
    if (action === "delete-module") {
      messager.publish("command:request", { type: "module/delete", payload: { moduleId: moduleId } });
      return;
    }
    if (action === "add-item") {
      messager.publish("command:request", { type: "item/add", payload: { moduleId: moduleId } });
      return;
    }
    if (action === "duplicate-item") {
      messager.publish("command:request", { type: "item/duplicate", payload: { moduleId: moduleId, itemId: itemId } });
      return;
    }
    if (action === "delete-item") {
      messager.publish("command:request", { type: "item/delete", payload: { moduleId: moduleId, itemId: itemId } });
      return;
    }
    if (action === "add-bullet") {
      messager.publish("command:request", { type: "bullet/add", payload: { moduleId: moduleId, itemId: itemId } });
      return;
    }
    if (action === "delete-bullet") {
      messager.publish("command:request", {
        type: "bullet/delete",
        payload: {
          moduleId: moduleId,
          itemId: itemId,
          index: Number(node.dataset.bulletIndex || 0)
        }
      });
      return;
    }
    if (action === "nudge-module") {
      messager.publish("command:request", {
        type: "module/nudge",
        payload: {
          moduleId: moduleId,
          axis: String(node.dataset.axis || "x"),
          step: Number(node.dataset.step || 0)
        }
      });
      return;
    }
    if (action === "resize-module-step") {
      messager.publish("command:request", {
        type: "module/resize-step",
        payload: {
          moduleId: moduleId,
          dimension: String(node.dataset.dimension || "w"),
          step: Number(node.dataset.step || 0)
        }
      });
    }
  }

  /**
   * Handle editable keydown restrictions.
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  function handleEditableKeydown(event) {
    var target = getTargetElement(event.target);
    var element = /** @type {HTMLElement|null} */ (target ? target.closest(".editable") : null);
    if (!element) {
      return;
    }
    if (event.key === "Enter" && element.dataset.singleLine === "true") {
      event.preventDefault();
    }
  }

  /**
   * Handle editable paste as plain text.
   * @param {ClipboardEvent} event
   * @returns {void}
   */
  function handleEditablePaste(event) {
    var target = getTargetElement(event.target);
    var element = /** @type {HTMLElement|null} */ (target ? target.closest(".editable") : null);
    if (!element) {
      return;
    }
    event.preventDefault();
    var data = event.clipboardData || window.clipboardData;
    var text = data ? data.getData("text/plain") : "";
    if (element.dataset.singleLine === "true") {
      text = text.replace(/\s*\n+\s*/g, " ");
    }
    insertPlainText(text);
  }

  /**
   * Ensure editing always enters selected state for module visual helpers.
   * @param {FocusEvent} event
   * @returns {void}
   */
  function handleEditableFocusIn(event) {
    var target = getTargetElement(event.target);
    var element = /** @type {HTMLElement|null} */ (target ? target.closest(".editable") : null);
    if (!element) {
      return;
    }
    var moduleNode = element.closest(".resume-module");
    var moduleId = moduleNode ? String(moduleNode.getAttribute("data-module-id") || "") : "";
    if (!moduleId) {
      return;
    }
    ensureModuleSelected(moduleId);
  }

  /**
   * Handle editable input to keep transient UI in sync.
   * @param {Event} event
   * @returns {void}
   */
  function handleEditableInput(event) {
    var target = getTargetElement(event.target);
    var element = /** @type {HTMLElement|null} */ (target ? target.closest(".editable") : null);
    if (!element) {
      return;
    }
    if (element.dataset.bindKind === "module" && element.dataset.field === "title") {
      var moduleNode = element.closest(".resume-module");
      if (moduleNode) {
        moduleNode.setAttribute("data-has-title", hasText(readEditableText(element)) ? "true" : "false");
      }
    }
    scheduleLayout();
  }

  /**
   * Write editable value back to state through commands.
   * @param {FocusEvent} event
   * @returns {void}
   */
  function handleEditableBlur(event) {
    var target = getTargetElement(event.target);
    var element = /** @type {HTMLElement|null} */ (target ? target.closest(".editable") : null);
    if (!element) {
      return;
    }
    var value = readEditableText(element);
    element.innerHTML = formatEditable(value);

    if (element.dataset.bindKind === "module") {
      messager.publish("command:request", {
        type: "module/update-title",
        payload: {
          moduleId: String(element.dataset.moduleId || ""),
          value: value
        }
      });
    } else if (element.dataset.bindKind === "item") {
      messager.publish("command:request", {
        type: "item/update-field",
        payload: {
          moduleId: String(element.dataset.moduleId || ""),
          itemId: String(element.dataset.itemId || ""),
          field: String(element.dataset.field || ""),
          value: value
        }
      });
    } else if (element.dataset.bindKind === "bullet") {
      messager.publish("command:request", {
        type: "bullet/update",
        payload: {
          moduleId: String(element.dataset.moduleId || ""),
          itemId: String(element.dataset.itemId || ""),
          index: Number(element.dataset.bulletIndex || 0),
          value: value
        }
      });
    }
    scheduleLayout();
  }

  /**
   * Begin move/resize interaction.
   * @param {PointerEvent} event
   * @returns {void}
   */
  function handlePointerDown(event) {
    var target = getTargetElement(event.target);
    if (!target) {
      return;
    }
    var moduleNode = target.closest(".resume-module");
    if (moduleNode) {
      ensureModuleSelected(String(moduleNode.getAttribute("data-module-id") || ""));
    }
    var handle = target.closest("[data-interaction]");
    if (!handle) {
      return;
    }
    var moduleId = String(handle.dataset.moduleId || "");
    var module = findModule(moduleId);
    if (!module) {
      return;
    }
    ensureModuleSelected(module.id);
    var metrics = layoutTools.getLayoutMetrics();
    interaction = {
      kind: /** @type {"move"|"resize-width"|"resize-height"} */ (handle.dataset.interaction || "move"),
      moduleId: module.id,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: {
        left: module.layout.left,
        top: module.layout.top,
        width: module.layout.width,
        height: module.layout.height
      },
      currentLayout: {
        left: module.layout.left,
        top: module.layout.top,
        width: module.layout.width,
        height: module.layout.height
      },
      colUnit: metrics.colUnit,
      rowUnit: metrics.rowUnit
    };
    setModuleInteracting(module.id, true);
    document.body.classList.add("is-dragging");
    event.preventDefault();
  }

  /**
   * Clear selected module when clicking outside modules and dock area.
   * @param {PointerEvent} event
   * @returns {void}
   */
  function handleDocumentPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    var target = getTargetElement(event.target);
    if (!target) {
      return;
    }
    if (target.closest(".resume-module")) {
      return;
    }
    if (target.closest("#resume-dock")) {
      return;
    }
    if (interaction) {
      handlePointerUp();
    }
    var state = getState();
    if (!state.runtime.selectedModuleId) {
      return;
    }
    updateSelectionUI("");
    messager.publish("command:request", {
      type: "runtime/select-module",
      payload: { moduleId: "" }
    });
  }

  /**
   * Handle global pointermove for active interaction.
   * @param {PointerEvent} event
   * @returns {boolean}
   */
  function handlePointerMove(event) {
    if (!interaction) {
      return false;
    }
    var module = findModule(interaction.moduleId);
    if (!module) {
      return false;
    }
    var metrics = layoutTools.getLayoutMetrics();
    var minWidth = layoutTools.getMinModuleWidthPx(metrics);
    var minHeight = layoutTools.getMinModuleHeightPx(metrics);
    var dx = event.clientX - interaction.startX;
    var dy = event.clientY - interaction.startY;
    var deltaCols = Math.round(dx / interaction.colUnit);
    var deltaRows = Math.round(dy / interaction.rowUnit);
    var next = {
      left: interaction.startLayout.left,
      top: interaction.startLayout.top,
      width: interaction.startLayout.width,
      height: interaction.startLayout.height
    };

    if (interaction.kind === "move") {
      var nextLeft = interaction.startLayout.left + deltaCols * interaction.colUnit;
      var nextTop = interaction.startLayout.top + deltaRows * interaction.rowUnit;
      next.left = clampPx(nextLeft, 0, Math.max(0, metrics.innerWidth - module.layout.width), interaction.startLayout.left);
      next.top = clampPx(nextTop, 0, 60000, interaction.startLayout.top);
    } else if (interaction.kind === "resize-width") {
      var nextWidth = interaction.startLayout.width + deltaCols * interaction.colUnit;
      var maxWidth = Math.max(minWidth, metrics.innerWidth - interaction.startLayout.left);
      next.width = clampPx(nextWidth, minWidth, maxWidth, interaction.startLayout.width);
    } else {
      var nextHeight = interaction.startLayout.height + deltaRows * interaction.rowUnit;
      next.height = clampPx(nextHeight, minHeight, 60000, interaction.startLayout.height);
    }

    interaction.currentLayout = next;
    var node = findModuleNode(interaction.moduleId);
    if (node) {
      applyNodeLayoutStyle(node, next, metrics);
    }
    scheduleLayout();
    return true;
  }

  /**
   * End global pointer interaction.
   * @returns {boolean}
   */
  function handlePointerUp() {
    if (!interaction) {
      return false;
    }
    var currentInteraction = interaction;
    var finalLayout = currentInteraction.currentLayout;
    var moduleId = currentInteraction.moduleId;
    interaction = null;
    setModuleInteracting(moduleId, false);
    document.body.classList.remove("is-dragging");
    messager.publish("command:request", {
      type: "module/update-layout",
      payload: {
        moduleId: moduleId,
        layout: finalLayout
      }
    });
    return true;
  }

  /**
   * Cancel active interaction and restore state-driven view.
   * @returns {boolean}
   */
  function cancelInteraction() {
    if (!interaction) {
      return false;
    }
    var currentInteraction = interaction;
    interaction = null;
    setModuleInteracting(currentInteraction.moduleId, false);
    document.body.classList.remove("is-dragging");
    renderCanvas();
    return true;
  }

  /**
   * Bind DOM events and bus subscriptions.
   * @returns {void}
   */
  function bindEvents() {
    if (eventsBound) {
      return;
    }
    refs.canvas.addEventListener("click", handleCanvasClick);
    refs.canvas.addEventListener("focusin", handleEditableFocusIn);
    refs.canvas.addEventListener("input", handleEditableInput);
    refs.canvas.addEventListener("blur", handleEditableBlur, true);
    refs.canvas.addEventListener("keydown", handleEditableKeydown);
    refs.canvas.addEventListener("paste", handleEditablePaste);
    refs.canvas.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerdown", handleDocumentPointerDown);
    eventsBound = true;

    offList.push(messager.subscribe("state:changed", function (payload) {
      var actionType = String(payload.action && payload.action.type || "");
      if (actionType === "runtime/set-status") {
        return;
      }
      if (actionType === "runtime/set-selected-module") {
        updateSelectionUI(String(payload.state.runtime.selectedModuleId || ""));
        return;
      }
      if (actionType === "runtime/set-active-panel") {
        return;
      }
      if (
        actionType === "module/update-title" ||
        actionType === "item/update-field" ||
        actionType === "bullet/update"
      ) {
        scheduleLayout();
        return;
      }
      if (!interaction) {
        renderCanvas();
      }
    }));

    offList.push(messager.subscribe("render:flushed", function (payload) {
      var slots = Array.isArray(payload.slots) ? payload.slots : [];
      if (slots.indexOf("canvas.modules") >= 0) {
        scheduleLayout();
      }
    }));
  }

  /**
   * Mount component.
   * @returns {void}
   */
  function mount() {
    ensureResumeModuleElement();
    bindEvents();
    renderCanvas();
  }

  /**
   * Remove listeners.
   * @returns {void}
   */
  function destroy() {
    offList.forEach(function (off) { off(); });
    offList = [];
    if (eventsBound) {
      refs.canvas.removeEventListener("click", handleCanvasClick);
      refs.canvas.removeEventListener("focusin", handleEditableFocusIn);
      refs.canvas.removeEventListener("input", handleEditableInput);
      refs.canvas.removeEventListener("blur", handleEditableBlur, true);
      refs.canvas.removeEventListener("keydown", handleEditableKeydown);
      refs.canvas.removeEventListener("paste", handleEditablePaste);
      refs.canvas.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      eventsBound = false;
    }
  }

  return {
    mount: mount,
    destroy: destroy,
    renderCanvas: renderCanvas,
    findModuleNode: findModuleNode,
    handlePointerMove: handlePointerMove,
    handlePointerUp: handlePointerUp,
    cancelInteraction: cancelInteraction,
    hasInteraction: function () { return !!interaction; },
    requestLayout: scheduleLayout
  };
}

/**
 * Backward-compatible named export.
 * @type {{create: typeof createResumeModuleComponent}}
 */
export var ResumeModuleController = {
  create: createResumeModuleComponent
};

if (typeof window !== "undefined") {
  // @ts-ignore runtime bridge for debugging
  window.ResumeModuleController = ResumeModuleController;
}
