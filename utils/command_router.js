// @ts-check

import { clampPx, clone } from "./helpers.js";
import { createModule } from "./state_factory.js";

/**
 * @file Command router.
 * @description
 * Translates high-level command messages to reducer actions and
 * state-aware immutable updates.
 */

/**
 * Find module by id.
 * @param {any} state
 * @param {string} moduleId
 * @returns {any|null}
 */
function findModule(state, moduleId) {
  return state.modules.find(function (module) {
    return module.id === moduleId;
  }) || null;
}

/**
 * Find item index by id.
 * @param {any[]} items
 * @param {string} itemId
 * @returns {number}
 */
function findItemIndex(items, itemId) {
  return items.findIndex(function (item) {
    return item.id === itemId;
  });
}

/**
 * Clone one item according to module type.
 * @param {string} type
 * @param {any} item
 * @param {(prefix: string) => string} uid
 * @param {Record<string, boolean>} textTypes
 * @param {Record<string, boolean>} compositeTypes
 * @returns {any}
 */
function cloneItem(type, item, uid, textTypes, compositeTypes) {
  if (type === "identity") {
    return { id: uid("item"), name: item.name, role: item.role };
  }
  if (type === "contacts") {
    return { id: uid("item"), label: item.label, value: item.value };
  }
  if (textTypes[type]) {
    return { id: uid("item"), content: item.content };
  }
  if (type === "skills") {
    return { id: uid("item"), label: item.label, value: item.value };
  }
  if (compositeTypes[type]) {
    return {
      id: uid("item"),
      title: item.title,
      subtitle: item.subtitle,
      date: item.date,
      description: item.description,
      bullets: clone(item.bullets || [])
    };
  }
  return {
    id: uid("item"),
    title: item.title,
    bullets: clone(item.bullets || [])
  };
}

/**
 * Clone module with new ids for module and child items.
 * @param {any} module
 * @param {(prefix: string) => string} uid
 * @param {Record<string, boolean>} textTypes
 * @param {Record<string, boolean>} compositeTypes
 * @returns {any}
 */
function cloneModule(module, uid, textTypes, compositeTypes) {
  return {
    id: uid("module"),
    type: module.type,
    title: module.title,
    items: module.items.map(function (item) {
      return cloneItem(module.type, item, uid, textTypes, compositeTypes);
    }),
    layout: clone(module.layout),
    style: clone(module.style)
  };
}

/**
 * Create command router runtime.
 * @param {{
 *   messager: {subscribe: (topic: string, handler: (payload: any) => void) => () => void},
 *   store: {getState: () => any, dispatch: (action: {type: string, payload: Record<string, unknown>}) => void},
 *   uid: (prefix: string) => string,
 *   moduleLibrary: Record<string, any>,
 *   textTypes: Record<string, boolean>,
 *   compositeTypes: Record<string, boolean>,
 *   themePresets: Record<string, any>,
 *   layoutTools: {
 *     getLayoutMetrics: () => any,
 *     spanToWidth: (span:number, metrics?:any) => number,
 *     rowsToHeight: (rows:number, metrics?:any) => number,
 *     getMinModuleWidthPx: (metrics?:any) => number,
 *     getMinModuleHeightPx: (metrics?:any) => number,
 *     normalizeAbsoluteLayout: (type:string, source: Record<string, unknown>, context: any, moduleLibrary: Record<string, any>) => any
 *   }
 * }} context
 */
export function createCommandRouter(context) {
  var messager = context.messager;
  var store = context.store;
  var uid = context.uid;
  var moduleLibrary = context.moduleLibrary;
  var textTypes = context.textTypes;
  var compositeTypes = context.compositeTypes;
  var themePresets = context.themePresets;
  var layoutTools = context.layoutTools;

  /** @type {Array<() => void>} */
  var offList = [];

  /**
   * Dispatch status message.
   * @param {string} message
   * @param {""|"ok"|"warn"} tone
   * @returns {void}
   */
  function setStatus(message, tone) {
    store.dispatch({
      type: "runtime/set-status",
      payload: { message: message, tone: tone }
    });
  }

  /**
   * Calculate default insert top by bottom-most module.
   * @param {any} state
   * @returns {number}
   */
  function getSuggestedTop(state) {
    var metrics = layoutTools.getLayoutMetrics();
    var maxBottom = 0;
    state.modules.forEach(function (module) {
      maxBottom = Math.max(maxBottom, module.layout.top + module.layout.height + metrics.gap);
    });
    return Math.round(maxBottom);
  }

  /**
   * Normalize all module layouts for current viewport metrics.
   * @returns {void}
   */
  function normalizeAllModuleLayouts() {
    var state = store.getState();
    var metrics = layoutTools.getLayoutMetrics();
    var changed = false;
    var nextModules = state.modules.map(function (module) {
      var normalized = layoutTools.normalizeAbsoluteLayout(module.type, module.layout, metrics, moduleLibrary);
      if (
        normalized.left !== module.layout.left ||
        normalized.top !== module.layout.top ||
        normalized.width !== module.layout.width ||
        normalized.height !== module.layout.height
      ) {
        changed = true;
        return Object.assign({}, module, { layout: normalized });
      }
      return module;
    });
    if (!changed) {
      return;
    }
    store.dispatch({
      type: "state/replace",
      payload: {
        state: Object.assign({}, state, { modules: nextModules })
      }
    });
  }

  /**
   * Handle one command message.
   * @param {{type?: string, payload?: Record<string, unknown>}} message
   * @returns {void}
   */
  function handleCommand(message) {
    var commandType = String(message.type || "");
    var payload = message.payload || {};
    if (!commandType) {
      return;
    }

    if (commandType.indexOf("file/") === 0) {
      return;
    }

    if (commandType === "runtime/select-module") {
      store.dispatch({
        type: "runtime/set-selected-module",
        payload: { moduleId: String(payload.moduleId || "") }
      });
      if (payload.activateStylePanel) {
        store.dispatch({
          type: "runtime/set-active-panel",
          payload: { panel: "style" }
        });
      }
      return;
    }

    if (commandType === "runtime/set-active-panel") {
      store.dispatch({
        type: "runtime/set-active-panel",
        payload: { panel: String(payload.panel || "content") }
      });
      return;
    }

    if (commandType === "runtime/set-status") {
      setStatus(String(payload.message || ""), /** @type {""|"ok"|"warn"} */ (payload.tone || ""));
      return;
    }

    if (commandType === "module/normalize-all-layouts") {
      normalizeAllModuleLayouts();
      return;
    }

    if (commandType === "theme/apply-preset") {
      var presetId = String(payload.presetId || "");
      if (!themePresets[presetId]) {
        return;
      }
      var nextTheme = clone(themePresets[presetId]);
      nextTheme.presetId = presetId;
      store.dispatch({
        type: "theme/apply-preset",
        payload: { theme: nextTheme }
      });
      setStatus("已切换主题预设", "ok");
      return;
    }

    if (commandType === "theme/set-field") {
      store.dispatch({
        type: "theme/set-field",
        payload: {
          field: String(payload.field || ""),
          value: payload.value
        }
      });
      setStatus("已更新主题", "ok");
      return;
    }

    if (commandType === "theme/set-font") {
      store.dispatch({
        type: "theme/set-font",
        payload: {
          field: String(payload.field || ""),
          value: String(payload.value || "")
        }
      });
      setStatus("已更新全局字体", "ok");
      return;
    }

    if (commandType === "theme/set-color") {
      store.dispatch({
        type: "theme/set-color",
        payload: {
          field: String(payload.field || ""),
          value: String(payload.value || "")
        }
      });
      setStatus("已更新主题颜色", "ok");
      return;
    }

    if (commandType === "view/set-grid") {
      store.dispatch({
        type: "view/set-grid",
        payload: { showGrid: payload.showGrid === true }
      });
      setStatus("已切换网格显示", "ok");
      return;
    }

    if (commandType === "meta/set-view-mode") {
      store.dispatch({
        type: "meta/set-view-mode",
        payload: { viewMode: payload.viewMode === "artboard" ? "artboard" : "continuous" }
      });
      setStatus("已切换画布视图", "ok");
      return;
    }

    if (commandType === "module/add") {
      var moduleType = String(payload.moduleType || "");
      var state = store.getState();
      if (!moduleLibrary[moduleType]) {
        return;
      }
      var metrics = layoutTools.getLayoutMetrics();
      var selected = findModule(state, state.runtime.selectedModuleId);
      var top = selected
        ? selected.layout.top + selected.layout.height + metrics.gap
        : getSuggestedTop(state);
      var nextModule = createModule({
        type: moduleType,
        top: top,
        moduleLibrary: moduleLibrary,
        uid: uid,
        spanToWidth: layoutTools.spanToWidth,
        rowsToHeight: layoutTools.rowsToHeight,
        getLayoutMetrics: layoutTools.getLayoutMetrics
      });
      if (selected) {
        nextModule.layout.left = selected.layout.left;
      }
      var insertIndex = selected
        ? state.modules.findIndex(function (module) { return module.id === selected.id; }) + 1
        : state.modules.length;
      store.dispatch({
        type: "module/add",
        payload: { module: nextModule, index: insertIndex }
      });
      setStatus("已新增模块", "ok");
      return;
    }

    if (commandType === "module/duplicate") {
      var sourceId = String(payload.moduleId || "");
      var sourceState = store.getState();
      var sourceModule = findModule(sourceState, sourceId);
      if (!sourceModule) {
        return;
      }
      var sourceMetrics = layoutTools.getLayoutMetrics();
      var duplicated = cloneModule(sourceModule, uid, textTypes, compositeTypes);
      duplicated.layout.left = sourceModule.layout.left;
      duplicated.layout.top = sourceModule.layout.top + sourceModule.layout.height + sourceMetrics.gap;
      store.dispatch({
        type: "module/duplicate",
        payload: {
          moduleId: sourceId,
          module: duplicated
        }
      });
      setStatus("已复制模块", "ok");
      return;
    }

    if (commandType === "module/delete") {
      store.dispatch({
        type: "module/delete",
        payload: { moduleId: String(payload.moduleId || "") }
      });
      setStatus("已删除模块", "ok");
      return;
    }

    if (commandType === "module/update-layout") {
      var layoutModuleId = String(payload.moduleId || "");
      var layoutState = store.getState();
      var layoutModule = findModule(layoutState, layoutModuleId);
      if (!layoutModule) {
        return;
      }
      var rawLayout = Object.assign({}, layoutModule.layout, payload.layout || {});
      var normalizedLayout = layoutTools.normalizeAbsoluteLayout(layoutModule.type, rawLayout, layoutTools.getLayoutMetrics(), moduleLibrary);
      store.dispatch({
        type: "module/update-layout",
        payload: {
          moduleId: layoutModuleId,
          layout: normalizedLayout
        }
      });
      if (!payload.silent) {
        setStatus("已调整布局", "ok");
      }
      return;
    }

    if (commandType === "module/nudge") {
      var nudgeState = store.getState();
      var nudgeModule = findModule(nudgeState, String(payload.moduleId || ""));
      if (!nudgeModule) {
        return;
      }
      var nudgeMetrics = layoutTools.getLayoutMetrics();
      var nudgeAxis = String(payload.axis || "x");
      var nudgeStep = Number(payload.step || 0);
      var nextLayout = clone(nudgeModule.layout);
      if (nudgeAxis === "x") {
        nextLayout.left = clampPx(
          nextLayout.left + nudgeStep * nudgeMetrics.colUnit,
          0,
          Math.max(0, nudgeMetrics.innerWidth - nextLayout.width),
          nextLayout.left
        );
      } else {
        nextLayout.top = clampPx(nextLayout.top + nudgeStep * nudgeMetrics.rowUnit, 0, 60000, nextLayout.top);
      }
      store.dispatch({
        type: "module/update-layout",
        payload: { moduleId: nudgeModule.id, layout: nextLayout }
      });
      setStatus("已微调模块位置", "ok");
      return;
    }

    if (commandType === "module/resize-step") {
      var resizeState = store.getState();
      var resizeModule = findModule(resizeState, String(payload.moduleId || ""));
      if (!resizeModule) {
        return;
      }
      var resizeMetrics = layoutTools.getLayoutMetrics();
      var resizeMinWidth = layoutTools.getMinModuleWidthPx(resizeMetrics);
      var resizeMinHeight = layoutTools.getMinModuleHeightPx(resizeMetrics);
      var resizeStep = Number(payload.step || 0);
      var resizeDimension = String(payload.dimension || "w");
      var resizedLayout = clone(resizeModule.layout);
      if (resizeDimension === "w") {
        resizedLayout.width = clampPx(
          resizedLayout.width + resizeStep * resizeMetrics.colUnit,
          resizeMinWidth,
          Math.max(resizeMinWidth, resizeMetrics.innerWidth - resizedLayout.left),
          resizedLayout.width
        );
      } else {
        resizedLayout.height = clampPx(
          resizedLayout.height + resizeStep * resizeMetrics.rowUnit,
          resizeMinHeight,
          60000,
          resizedLayout.height
        );
      }
      store.dispatch({
        type: "module/update-layout",
        payload: { moduleId: resizeModule.id, layout: resizedLayout }
      });
      setStatus("已微调模块尺寸", "ok");
      return;
    }

    if (commandType === "module/update-title") {
      store.dispatch({
        type: "module/update-title",
        payload: {
          moduleId: String(payload.moduleId || ""),
          value: String(payload.value || "")
        }
      });
      setStatus("已更新内容", "ok");
      return;
    }

    if (commandType === "module/style-set-flag" || commandType === "module/style-set-field" || commandType === "module/style-set-color") {
      store.dispatch({
        type: commandType,
        payload: {
          moduleId: String(payload.moduleId || ""),
          field: String(payload.field || ""),
          value: payload.value
        }
      });
      setStatus("已更新模块样式", "ok");
      return;
    }

    if (commandType === "item/add") {
      var addState = store.getState();
      var addModule = findModule(addState, String(payload.moduleId || ""));
      if (!addModule || moduleLibrary[addModule.type].singleItem) {
        return;
      }
      store.dispatch({
        type: "item/add",
        payload: {
          moduleId: addModule.id,
          item: moduleLibrary[addModule.type].createItem()
        }
      });
      setStatus("已新增条目", "ok");
      return;
    }

    if (commandType === "item/duplicate") {
      var dupState = store.getState();
      var dupModule = findModule(dupState, String(payload.moduleId || ""));
      if (!dupModule || moduleLibrary[dupModule.type].singleItem) {
        return;
      }
      var dupItemId = String(payload.itemId || "");
      var dupIndex = findItemIndex(dupModule.items, dupItemId);
      if (dupIndex < 0) {
        return;
      }
      store.dispatch({
        type: "item/duplicate",
        payload: {
          moduleId: dupModule.id,
          itemId: dupItemId,
          item: cloneItem(dupModule.type, dupModule.items[dupIndex], uid, textTypes, compositeTypes)
        }
      });
      setStatus("已复制条目", "ok");
      return;
    }

    if (commandType === "item/delete") {
      store.dispatch({
        type: "item/delete",
        payload: {
          moduleId: String(payload.moduleId || ""),
          itemId: String(payload.itemId || "")
        }
      });
      setStatus("已删除条目", "ok");
      return;
    }

    if (commandType === "item/update-field") {
      store.dispatch({
        type: "item/update-field",
        payload: {
          moduleId: String(payload.moduleId || ""),
          itemId: String(payload.itemId || ""),
          field: String(payload.field || ""),
          value: String(payload.value || "")
        }
      });
      setStatus("已更新内容", "ok");
      return;
    }

    if (commandType === "bullet/add") {
      store.dispatch({
        type: "bullet/add",
        payload: {
          moduleId: String(payload.moduleId || ""),
          itemId: String(payload.itemId || "")
        }
      });
      setStatus("已新增要点", "ok");
      return;
    }

    if (commandType === "bullet/delete") {
      store.dispatch({
        type: "bullet/delete",
        payload: {
          moduleId: String(payload.moduleId || ""),
          itemId: String(payload.itemId || ""),
          index: Number(payload.index || 0)
        }
      });
      setStatus("已删除要点", "ok");
      return;
    }

    if (commandType === "bullet/update") {
      store.dispatch({
        type: "bullet/update",
        payload: {
          moduleId: String(payload.moduleId || ""),
          itemId: String(payload.itemId || ""),
          index: Number(payload.index || 0),
          value: String(payload.value || "")
        }
      });
      setStatus("已更新内容", "ok");
    }
  }

  /**
   * Start command routing.
   * @returns {void}
   */
  function bind() {
    offList.push(messager.subscribe("command:request", handleCommand));
  }

  /**
   * Stop command routing.
   * @returns {void}
   */
  function destroy() {
    offList.forEach(function (off) { off(); });
    offList = [];
  }

  return {
    bind: bind,
    destroy: destroy
  };
}
