// @ts-check

import { escapeAttr, escapeHtml } from "../../utils/helpers.js";

/**
 * @file Dock panel-card component.
 * @description
 * This component owns panel-card view generation and panel form events.
 */

/**
 * Build dock card component.
 * @param {{
 *   messager: {publish: (topic: string, payload: Record<string, unknown>) => void, subscribe: (topic: string, handler: (payload: any) => void) => () => void},
 *   getState: () => any,
 *   moduleLibrary: Record<string, any>,
 *   themePresets: Record<string, any>,
 *   fontFamilies: string[],
 *   root: HTMLElement
 * }} context
 */
export function createDockCardComponent(context) {
  var messager = context.messager;
  var getState = context.getState;
  var moduleLibrary = context.moduleLibrary;
  var themePresets = context.themePresets;
  var fontFamilies = context.fontFamilies;
  var root = context.root;

  /** @type {string[]} */
  var openPanels = [];
  /** @type {Array<() => void>} */
  var offList = [];
  /** @type {boolean} */
  var eventsBound = false;

  /**
   * Resolve selected module from state.
   * @param {any} state
   * @returns {any|null}
   */
  function getSelectedModule(state) {
    var selectedId = String(state.runtime.selectedModuleId || "");
    if (!selectedId) {
      return null;
    }
    return state.modules.find(function (module) {
      return module.id === selectedId;
    }) || null;
  }

  /**
   * Resolve module label from module library.
   * @param {string} type
   * @returns {string}
   */
  function getModuleLabel(type) {
    return moduleLibrary[type] ? String(moduleLibrary[type].label || type) : String(type || "");
  }

  /**
   * Render one select option list.
   * @param {string} selected
   * @param {Array<[string, string]>} list
   * @returns {string}
   */
  function renderSelectOptions(selected, list) {
    return list.map(function (entry) {
      return '<option value="' + escapeAttr(entry[0]) + '"' + (selected === entry[0] ? " selected" : "") + ">" + escapeHtml(entry[1]) + "</option>";
    }).join("");
  }

  /**
   * Render font-family options.
   * @param {string} selected
   * @returns {string}
   */
  function renderFontFamilyOptions(selected) {
    return fontFamilies.map(function (family) {
      var value = String(family || "");
      return '<option value="' + escapeAttr(value) + '"' + (selected === value ? " selected" : "") + ">" + escapeHtml(value) + "</option>";
    }).join("");
  }

  /**
   * Render preset options list.
   * @param {any} state
   * @returns {string}
   */
  function renderPresetOptions(state) {
    var options = Object.keys(themePresets).map(function (key) {
      var name = themePresets[key] && themePresets[key].name ? String(themePresets[key].name) : key;
      return '<option value="' + escapeAttr(key) + '"' + (state.theme.presetId === key ? " selected" : "") + ">" + escapeHtml(name) + "</option>";
    }).join("");
    if (state.theme.presetId === "custom") {
      options += '<option value="custom" selected>Custom</option>';
    }
    return options;
  }

  /**
   * Render content panel html.
   * @param {any} state
   * @returns {string}
   */
  function renderContentPanel(state) {
    var selected = getSelectedModule(state);
    return [
      '<section class="panel-card">',
      '  <h3 class="panel-title">新增模块</h3>',
      '  <div class="panel-grid">',
      '    <div class="panel-field">',
      '      <label for="panel-add-type">模块类型</label>',
      '      <select id="panel-add-type">',
      Object.keys(moduleLibrary).map(function (type) {
        return '<option value="' + escapeAttr(type) + '">' + escapeHtml(getModuleLabel(type)) + "</option>";
      }).join(""),
      "      </select>",
      "    </div>",
      "  </div>",
      '  <div class="drawer-actions">',
      '    <button type="button" class="drawer-btn primary" data-action="add-module">新增模块</button>',
      "  </div>",
      "</section>",
      selected ? renderSelectedContentCard(selected) : '<section class="panel-card"><h3 class="panel-title">当前模块</h3><p class="muted">点击画布中的任意模块后，这里会显示复制、删除和微调布局的控制。</p></section>'
    ].join("");
  }

  /**
   * Render selected-module content card.
   * @param {any} module
   * @returns {string}
   */
  function renderSelectedContentCard(module) {
    return [
      '<section class="panel-card">',
      '  <h3 class="panel-title">当前模块</h3>',
      '  <div class="metric-badges">',
      '    <span>' + escapeHtml(getModuleLabel(module.type)) + "</span>",
      '    <span>L ' + Math.round(module.layout.left) + "</span>",
      '    <span>T ' + Math.round(module.layout.top) + "</span>",
      '    <span>W ' + Math.round(module.layout.width) + "</span>",
      '    <span>H ' + Math.round(module.layout.height) + "</span>",
      "  </div>",
      '  <div class="drawer-actions">',
      '    <button type="button" class="drawer-btn" data-action="duplicate-module" data-module-id="' + escapeAttr(module.id) + '">复制</button>',
      '    <button type="button" class="drawer-btn danger" data-action="delete-module" data-module-id="' + escapeAttr(module.id) + '">删除</button>',
      "  </div>",
      '  <div class="toolbar-row"><span class="muted">微调位置</span></div>',
      '  <div class="nudge-grid">',
      '    <button type="button" class="nudge-btn" data-action="nudge-module" data-module-id="' + escapeAttr(module.id) + '" data-axis="y" data-step="-1">上</button>',
      '    <button type="button" class="nudge-btn" data-action="nudge-module" data-module-id="' + escapeAttr(module.id) + '" data-axis="x" data-step="-1">左</button>',
      '    <button type="button" class="nudge-btn" data-action="nudge-module" data-module-id="' + escapeAttr(module.id) + '" data-axis="x" data-step="1">右</button>',
      '    <button type="button" class="nudge-btn" data-action="nudge-module" data-module-id="' + escapeAttr(module.id) + '" data-axis="y" data-step="1">下</button>',
      "  </div>",
      '  <div class="toolbar-row"><span class="muted">微调尺寸</span></div>',
      '  <div class="nudge-grid">',
      '    <button type="button" class="nudge-btn" data-action="resize-module-step" data-module-id="' + escapeAttr(module.id) + '" data-dimension="w" data-step="-1">宽-</button>',
      '    <button type="button" class="nudge-btn" data-action="resize-module-step" data-module-id="' + escapeAttr(module.id) + '" data-dimension="w" data-step="1">宽+</button>',
      '    <button type="button" class="nudge-btn" data-action="resize-module-step" data-module-id="' + escapeAttr(module.id) + '" data-dimension="h" data-step="-1">高-</button>',
      '    <button type="button" class="nudge-btn" data-action="resize-module-step" data-module-id="' + escapeAttr(module.id) + '" data-dimension="h" data-step="1">高+</button>',
      "  </div>",
      "</section>"
    ].join("");
  }

  /**
   * Render style panel html.
   * @param {any} state
   * @returns {string}
   */
  function renderStylePanel(state) {
    var selected = getSelectedModule(state);
    return [
      renderGlobalThemeCard(state),
      selected ? renderModuleStyleCard(state, selected) : ""
    ].join("");
  }

  /**
   * Render global-theme card.
   * @param {any} state
   * @returns {string}
   */
  function renderGlobalThemeCard(state) {
    return [
      '<section class="panel-card">',
      '  <h3 class="panel-title">全局主题</h3>',
      '  <div class="panel-grid">',
      '    <div class="panel-field"><label for="theme-preset">主题预设</label><select id="theme-preset" data-theme-field="presetId">' + renderPresetOptions(state) + "</select></div>",
      '    <div class="panel-field"><label for="theme-density">密度</label><select id="theme-density" data-theme-field="density">' + renderSelectOptions(state.theme.density, [["compact", "紧凑"], ["standard", "标准"], ["relaxed", "宽松"]]) + "</select></div>",
      '    <div class="panel-field"><label for="theme-heading-font">标题字体</label><select id="theme-heading-font" data-theme-font="headingFont">' + renderFontFamilyOptions(state.theme.typography.headingFont) + "</select></div>",
      '    <div class="panel-field"><label for="theme-body-font">正文字体</label><select id="theme-body-font" data-theme-font="bodyFont">' + renderFontFamilyOptions(state.theme.typography.bodyFont) + "</select></div>",
      '    <div class="panel-field"><label for="theme-divider">分割线</label><select id="theme-divider" data-theme-field="dividerStyle">' + renderSelectOptions(state.theme.dividerStyle, [["none", "无"], ["thin", "细线"], ["double", "双线"], ["ornament", "装饰线"]]) + "</select></div>",
      '    <div class="panel-field"><label for="theme-item-divider">条目分割线</label><select id="theme-item-divider" data-theme-field="itemDividerStyle">' + renderSelectOptions(state.theme.itemDividerStyle || state.theme.dividerStyle, [["none", "无"], ["thin", "细线"], ["double", "双线"], ["ornament", "装饰线"]]) + "</select></div>",
      '    <div class="panel-field"><label for="theme-border">边框</label><select id="theme-border" data-theme-field="borderStyle">' + renderSelectOptions(state.theme.borderStyle, [["none", "无"], ["frame", "整块方框"], ["left-rule", "左侧竖框"], ["label", "标题框签"]]) + "</select></div>",
      '    <div class="panel-field"><label for="theme-ornament">花纹</label><select id="theme-ornament" data-theme-field="ornamentStyle">' + renderSelectOptions(state.theme.ornamentStyle, [["none", "无"], ["corners", "页角"], ["title", "标题装饰"], ["wash", "轻纹理"]]) + "</select></div>",
      '    <div class="panel-field"><label for="theme-text-color">正文颜色</label><input id="theme-text-color" type="color" value="' + escapeAttr(state.theme.colors.text) + '" data-theme-color="text"></div>',
      '    <div class="panel-field"><label for="theme-heading-color">标题颜色</label><input id="theme-heading-color" type="color" value="' + escapeAttr(state.theme.colors.heading) + '" data-theme-color="heading"></div>',
      '    <div class="panel-field"><label for="theme-accent-color">强调颜色</label><input id="theme-accent-color" type="color" value="' + escapeAttr(state.theme.colors.accent) + '" data-theme-color="accent"></div>',
      "  </div>",
      "</section>"
    ].join("");
  }

  /**
   * Render module-style card.
   * @param {any} state
   * @param {any} module
   * @returns {string}
   */
  function renderModuleStyleCard(state, module) {
    return [
      '<section class="panel-card">',
      '  <h3 class="panel-title">模块样式</h3>',
      '  <label class="check-row"><input type="checkbox" data-module-style-flag="inheritTheme" ' + (module.style.inheritTheme ? "checked" : "") + "> 跟随全局主题</label>",
      '  <div class="panel-grid">',
      '    <div class="panel-field"><label for="module-title-style">标题样式</label><select id="module-title-style" data-module-style-field="titleStyle" ' + (module.style.inheritTheme ? "disabled" : "") + ">" + renderSelectOptions(module.style.titleStyle || "plain", [["plain", "普通"], ["smallcaps", "小型大写"], ["boxed", "方框"], ["ribbon", "框签"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-divider-style">分割线</label><select id="module-divider-style" data-module-style-field="dividerStyle" ' + (module.style.inheritTheme ? "disabled" : "") + ">" + renderSelectOptions(module.style.dividerStyle || "thin", [["none", "无"], ["thin", "细线"], ["double", "双线"], ["ornament", "装饰线"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-item-divider-style">条目分割线</label><select id="module-item-divider-style" data-module-style-field="itemDividerStyle" ' + (module.style.inheritTheme ? "disabled" : "") + ">" + renderSelectOptions(module.style.itemDividerStyle || "", [["none", "无"], ["thin", "细线"], ["double", "双线"], ["ornament", "装饰线"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-border-style">边框</label><select id="module-border-style" data-module-style-field="borderStyle" ' + (module.style.inheritTheme ? "disabled" : "") + ">" + renderSelectOptions(module.style.borderStyle || "none", [["none", "无"], ["frame", "整块方框"], ["left-rule", "左侧竖框"], ["label", "标题框签"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-ornament-style">花纹</label><select id="module-ornament-style" data-module-style-field="ornamentStyle" ' + (module.style.inheritTheme ? "disabled" : "") + ">" + renderSelectOptions(module.style.ornamentStyle || "none", [["none", "无"], ["corners", "页角"], ["title", "标题装饰"], ["wash", "轻纹理"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-background-style">背景</label><select id="module-background-style" data-module-style-field="backgroundStyle">' + renderSelectOptions(module.style.backgroundStyle, [["none", "无"], ["tint", "浅底"], ["panel", "浅面板"], ["texture", "纹理"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-padding-scale">内边距</label><select id="module-padding-scale" data-module-style-field="paddingScale">' + renderSelectOptions(module.style.paddingScale || "standard", [["compact", "紧凑"], ["standard", "标准"], ["relaxed", "宽松"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-align">对齐</label><select id="module-align" data-module-style-field="align">' + renderSelectOptions(module.style.align, [["left", "左对齐"], ["center", "居中"], ["right", "右对齐"]]) + "</select></div>",
      '    <div class="panel-field"><label for="module-title-color">标题颜色</label><input id="module-title-color" type="color" value="' + escapeAttr(module.style.titleColor || state.theme.colors.heading) + '" data-module-style-color="titleColor" ' + (module.style.inheritTheme ? "disabled" : "") + "></div>",
      "  </div>",
      "</section>"
    ].join("");
  }

  /**
   * Render view panel html.
   * @param {any} state
   * @returns {string}
   */
  function renderViewPanel(state) {
    return [
      '<section class="panel-card">',
      '  <h3 class="panel-title">画布视图</h3>',
      '  <div class="drawer-actions">',
      '    <button type="button" class="drawer-btn' + (state.meta.viewMode === "continuous" ? " primary" : "") + '" data-action="set-view-mode" data-view-mode="continuous">连续画布</button>',
      '    <button type="button" class="drawer-btn' + (state.meta.viewMode === "artboard" ? " primary" : "") + '" data-action="set-view-mode" data-view-mode="artboard">A4 画板</button>',
      "  </div>",
      '  <label class="check-row"><input type="checkbox" data-view-flag="showGrid" ' + (state.view.showGrid ? "checked" : "") + "> 显示辅助网格</label>",
      '  <p class="muted">A4 画板仅用于屏幕辅助预览，实际打印与 PDF 分页仍由浏览器处理。</p>',
      "</section>"
    ].join("");
  }

  /**
   * Render file panel html.
   * @returns {string}
   */
  function renderFilePanel() {
    return [
      '<section class="panel-card">',
      '  <h3 class="panel-title">文件</h3>',
      '  <div class="drawer-actions">',
      '    <button type="button" class="drawer-btn" data-action="import-usr-save">导入 JSON</button>',
      '    <button type="button" class="drawer-btn" data-action="export-json">导出 JSON</button>',
      '    <button type="button" class="drawer-btn" data-action="export-html">导出 HTML</button>',
      '    <button type="button" class="drawer-btn primary" data-action="print">打印 / PDF</button>',
      '    <button type="button" class="drawer-btn danger" data-action="clear-draft">清空草稿</button>',
      "  </div>",
      '  <p class="muted">打印前请关闭浏览器“页眉和页脚”，避免出现日期和标题那一行。</p>',
      "</section>"
    ].join("");
  }

  /**
   * Render one panel body.
   * @param {string} panel
   * @param {any} state
   * @returns {string}
   */
  function renderPanel(panel, state) {
    if (panel === "style") {
      return renderStylePanel(state);
    }
    if (panel === "view") {
      return renderViewPanel(state);
    }
    if (panel === "file") {
      return renderFilePanel();
    }
    return renderContentPanel(state);
  }

  /**
   * Re-render all currently open panel bodies.
   * @returns {void}
   */
  function renderOpenPanels() {
    var state = getState();
    openPanels.forEach(function (panel) {
      messager.publish("view:update", {
        slot: "dock.cards." + panel,
        selector: '.dock-popover[data-panel="' + panel + '"] .drawer-panel',
        html: renderPanel(panel, state)
      });
    });
  }

  /**
   * Handle click actions inside drawer panel.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function handleClick(event) {
    var target = /** @type {HTMLElement} */ (event.target);
    var actionNode = target.closest("[data-action]");
    if (!actionNode || !actionNode.closest(".dock-popover .drawer-panel")) {
      return;
    }
    var action = String(actionNode.dataset.action || "");
    if (!action) {
      return;
    }

    if (action === "add-module") {
      var scope = actionNode.closest(".dock-popover");
      var select = scope ? scope.querySelector("#panel-add-type") : null;
      var moduleType = select && select.value ? select.value : "text";
      messager.publish("command:request", {
        type: "module/add",
        payload: { moduleType: moduleType }
      });
      return;
    }

    if (action === "duplicate-module") {
      messager.publish("command:request", {
        type: "module/duplicate",
        payload: { moduleId: String(actionNode.dataset.moduleId || "") }
      });
      return;
    }

    if (action === "delete-module") {
      messager.publish("command:request", {
        type: "module/delete",
        payload: { moduleId: String(actionNode.dataset.moduleId || "") }
      });
      return;
    }

    if (action === "add-item") {
      messager.publish("command:request", {
        type: "item/add",
        payload: { moduleId: String(actionNode.dataset.moduleId || "") }
      });
      return;
    }

    if (action === "duplicate-item") {
      messager.publish("command:request", {
        type: "item/duplicate",
        payload: {
          moduleId: String(actionNode.dataset.moduleId || ""),
          itemId: String(actionNode.dataset.itemId || "")
        }
      });
      return;
    }

    if (action === "delete-item") {
      messager.publish("command:request", {
        type: "item/delete",
        payload: {
          moduleId: String(actionNode.dataset.moduleId || ""),
          itemId: String(actionNode.dataset.itemId || "")
        }
      });
      return;
    }

    if (action === "add-bullet") {
      messager.publish("command:request", {
        type: "bullet/add",
        payload: {
          moduleId: String(actionNode.dataset.moduleId || ""),
          itemId: String(actionNode.dataset.itemId || "")
        }
      });
      return;
    }

    if (action === "delete-bullet") {
      messager.publish("command:request", {
        type: "bullet/delete",
        payload: {
          moduleId: String(actionNode.dataset.moduleId || ""),
          itemId: String(actionNode.dataset.itemId || ""),
          index: Number(actionNode.dataset.bulletIndex || 0)
        }
      });
      return;
    }

    if (action === "nudge-module") {
      messager.publish("command:request", {
        type: "module/nudge",
        payload: {
          moduleId: String(actionNode.dataset.moduleId || ""),
          axis: String(actionNode.dataset.axis || "x"),
          step: Number(actionNode.dataset.step || 0)
        }
      });
      return;
    }

    if (action === "resize-module-step") {
      messager.publish("command:request", {
        type: "module/resize-step",
        payload: {
          moduleId: String(actionNode.dataset.moduleId || ""),
          dimension: String(actionNode.dataset.dimension || "w"),
          step: Number(actionNode.dataset.step || 0)
        }
      });
      return;
    }

    if (action === "set-view-mode") {
      messager.publish("command:request", {
        type: "meta/set-view-mode",
        payload: { viewMode: String(actionNode.dataset.viewMode || "continuous") }
      });
      return;
    }

    if (action === "import-usr-save") {
      messager.publish("command:request", { type: "file/import-json", payload: {} });
      return;
    }
    if (action === "export-json") {
      messager.publish("command:request", { type: "file/export-json", payload: {} });
      return;
    }
    if (action === "export-html") {
      messager.publish("command:request", { type: "file/export-html", payload: {} });
      return;
    }
    if (action === "print") {
      messager.publish("command:request", { type: "file/print", payload: {} });
      return;
    }
    if (action === "clear-draft") {
      messager.publish("command:request", { type: "file/clear-draft", payload: {} });
    }
  }

  /**
   * Handle form changes inside drawer panel.
   * @param {Event} event
   * @returns {void}
   */
  function handleChange(event) {
    var target = /** @type {HTMLInputElement|HTMLSelectElement} */ (event.target);
    if (!target.closest(".dock-popover .drawer-panel")) {
      return;
    }
    if (target.matches("[data-theme-field='presetId']")) {
      messager.publish("command:request", {
        type: "theme/apply-preset",
        payload: { presetId: target.value }
      });
      return;
    }
    if (target.matches("[data-theme-field]")) {
      messager.publish("command:request", {
        type: "theme/set-field",
        payload: { field: String(target.dataset.themeField || ""), value: target.value }
      });
      return;
    }
    if (target.matches("[data-theme-font]")) {
      messager.publish("command:request", {
        type: "theme/set-font",
        payload: { field: String(target.dataset.themeFont || ""), value: target.value }
      });
      return;
    }
    if (target.matches("[data-theme-color]")) {
      messager.publish("command:request", {
        type: "theme/set-color",
        payload: { field: String(target.dataset.themeColor || ""), value: target.value }
      });
      return;
    }
    if (target.matches("[data-view-flag='showGrid']")) {
      messager.publish("command:request", {
        type: "view/set-grid",
        payload: { showGrid: /** @type {HTMLInputElement} */ (target).checked }
      });
      return;
    }

    var state = getState();
    var selected = getSelectedModule(state);
    if (!selected) {
      return;
    }

    if (target.matches("[data-module-style-flag='inheritTheme']")) {
      messager.publish("command:request", {
        type: "module/style-set-flag",
        payload: {
          moduleId: selected.id,
          field: "inheritTheme",
          value: /** @type {HTMLInputElement} */ (target).checked
        }
      });
      return;
    }
    if (target.matches("[data-module-style-field]")) {
      messager.publish("command:request", {
        type: "module/style-set-field",
        payload: {
          moduleId: selected.id,
          field: String(target.dataset.moduleStyleField || ""),
          value: target.value
        }
      });
      return;
    }
    if (target.matches("[data-module-style-color='titleColor']")) {
      messager.publish("command:request", {
        type: "module/style-set-color",
        payload: {
          moduleId: selected.id,
          field: "titleColor",
          value: target.value
        }
      });
    }
  }

  /**
   * Bind DOM listeners and bus listeners.
   * @returns {void}
   */
  function mount() {
    if (!eventsBound) {
      root.addEventListener("click", handleClick);
      root.addEventListener("change", handleChange);
      eventsBound = true;
    }

    offList.push(messager.subscribe("dock:windows-changed", function (payload) {
      openPanels = Array.isArray(payload.panels) ? payload.panels.map(String) : [];
      renderOpenPanels();
    }));

    offList.push(messager.subscribe("render:flushed", function (payload) {
      var slots = Array.isArray(payload.slots) ? payload.slots : [];
      if (slots.indexOf("dock.windows") >= 0) {
        renderOpenPanels();
      }
    }));

    offList.push(messager.subscribe("state:changed", function () {
      if (openPanels.length) {
        renderOpenPanels();
      }
    }));
  }

  /**
   * Remove listeners.
   * @returns {void}
   */
  function destroy() {
    offList.forEach(function (off) { off(); });
    offList = [];
    if (eventsBound) {
      root.removeEventListener("click", handleClick);
      root.removeEventListener("change", handleChange);
      eventsBound = false;
    }
    openPanels = [];
  }

  return {
    mount: mount,
    destroy: destroy,
    renderOpenPanels: renderOpenPanels
  };
}
