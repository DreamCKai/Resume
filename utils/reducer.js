// @ts-check

import { clone } from "./helpers.js";

/**
 * @file Application reducer for immutable state updates.
 */

/**
 * Find module index by id.
 * @param {any[]} modules
 * @param {string} moduleId
 * @returns {number}
 */
function findModuleIndex(modules, moduleId) {
  return modules.findIndex(function (module) {
    return module.id === moduleId;
  });
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
 * Build app reducer.
 * @returns {(state: any, action: {type: string, payload: Record<string, unknown>}) => any}
 */
export function createReducer() {
  /**
   * Apply immutable state transitions.
   * @param {any} state
   * @param {{type: string, payload: Record<string, unknown>}} action
   * @returns {any}
   */
  function reducer(state, action) {
    var type = action.type;
    var payload = action.payload || {};

    if (type === "state/replace") {
      return /** @type {any} */ (payload.state);
    }

    if (type === "runtime/set-status") {
      var nextStatus = String(payload.message || "");
      var nextTone = /** @type {""|"ok"|"warn"} */ (payload.tone || "");
      if (state.runtime.status === nextStatus && state.runtime.statusTone === nextTone) {
        return state;
      }
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules,
        runtime: {
          selectedModuleId: state.runtime.selectedModuleId,
          activePanel: state.runtime.activePanel,
          status: nextStatus,
          statusTone: nextTone
        }
      };
    }

    if (type === "runtime/set-selected-module") {
      var nextSelectedModuleId = String(payload.moduleId || "");
      if (state.runtime.selectedModuleId === nextSelectedModuleId) {
        return state;
      }
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules,
        runtime: {
          selectedModuleId: nextSelectedModuleId,
          activePanel: state.runtime.activePanel,
          status: state.runtime.status,
          statusTone: state.runtime.statusTone
        }
      };
    }

    if (type === "runtime/set-active-panel") {
      var nextActivePanel = /** @type {"content"|"style"|"view"|"file"} */ (payload.panel || "content");
      if (state.runtime.activePanel === nextActivePanel) {
        return state;
      }
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules,
        runtime: {
          selectedModuleId: state.runtime.selectedModuleId,
          activePanel: nextActivePanel,
          status: state.runtime.status,
          statusTone: state.runtime.statusTone
        }
      };
    }

    if (type === "theme/apply-preset") {
      return {
        meta: state.meta,
        theme: clone(payload.theme),
        view: state.view,
        modules: state.modules,
        runtime: state.runtime
      };
    }

    if (type === "theme/set-field") {
      var themeField = String(payload.field || "");
      return {
        meta: state.meta,
        theme: Object.assign({}, state.theme, /** @type {any} */ ({ [themeField]: payload.value }), { presetId: "custom" }),
        view: state.view,
        modules: state.modules,
        runtime: state.runtime
      };
    }

    if (type === "theme/set-font") {
      var fontField = String(payload.field || "");
      return {
        meta: state.meta,
        theme: Object.assign({}, state.theme, {
          presetId: "custom",
          typography: Object.assign({}, state.theme.typography, /** @type {any} */ ({ [fontField]: payload.value }))
        }),
        view: state.view,
        modules: state.modules,
        runtime: state.runtime
      };
    }

    if (type === "theme/set-color") {
      var colorField = String(payload.field || "");
      return {
        meta: state.meta,
        theme: Object.assign({}, state.theme, {
          presetId: "custom",
          colors: Object.assign({}, state.theme.colors, /** @type {any} */ ({ [colorField]: payload.value }))
        }),
        view: state.view,
        modules: state.modules,
        runtime: state.runtime
      };
    }

    if (type === "view/set-grid") {
      return {
        meta: state.meta,
        theme: state.theme,
        view: { showGrid: payload.showGrid === true },
        modules: state.modules,
        runtime: state.runtime
      };
    }

    if (type === "meta/set-view-mode") {
      return {
        meta: {
          docTitle: state.meta.docTitle,
          viewMode: payload.viewMode === "artboard" ? "artboard" : "continuous"
        },
        theme: state.theme,
        view: state.view,
        modules: state.modules,
        runtime: state.runtime
      };
    }

    if (type === "module/add") {
      var nextModules = state.modules.slice();
      var insertIndex = Number(payload.index);
      var nextModule = clone(payload.module);
      if (Number.isInteger(insertIndex) && insertIndex >= 0 && insertIndex <= nextModules.length) {
        nextModules.splice(insertIndex, 0, nextModule);
      } else {
        nextModules.push(nextModule);
      }
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: nextModules,
        runtime: Object.assign({}, state.runtime, {
          selectedModuleId: nextModule.id,
          activePanel: "style"
        })
      };
    }

    if (type === "module/duplicate") {
      var sourceIndex = findModuleIndex(state.modules, String(payload.moduleId || ""));
      if (sourceIndex < 0) {
        return state;
      }
      var duplicated = clone(payload.module);
      var duplicatedModules = state.modules.slice();
      duplicatedModules.splice(sourceIndex + 1, 0, duplicated);
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: duplicatedModules,
        runtime: Object.assign({}, state.runtime, {
          selectedModuleId: duplicated.id,
          activePanel: "style"
        })
      };
    }

    if (type === "module/delete") {
      var deleteId = String(payload.moduleId || "");
      var filtered = state.modules.filter(function (module) {
        return module.id !== deleteId;
      });
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: filtered,
        runtime: Object.assign({}, state.runtime, {
          selectedModuleId: state.runtime.selectedModuleId === deleteId ? "" : state.runtime.selectedModuleId
        })
      };
    }

    if (type === "module/update-layout") {
      var moduleId = String(payload.moduleId || "");
      var patchedLayout = payload.layout;
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== moduleId) {
            return module;
          }
          return Object.assign({}, module, {
            layout: Object.assign({}, module.layout, clone(patchedLayout))
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "module/update-title") {
      var titleModuleId = String(payload.moduleId || "");
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== titleModuleId) {
            return module;
          }
          return Object.assign({}, module, { title: String(payload.value || "") });
        }),
        runtime: state.runtime
      };
    }

    if (type === "module/style-set-flag" || type === "module/style-set-field" || type === "module/style-set-color") {
      var styleModuleId = String(payload.moduleId || "");
      var styleField = String(payload.field || "");
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== styleModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            style: Object.assign({}, module.style, /** @type {any} */ ({ [styleField]: payload.value }))
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "item/add") {
      var addModuleId = String(payload.moduleId || "");
      var addItem = clone(payload.item);
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== addModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            items: module.items.concat([addItem])
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "item/duplicate") {
      var dupModuleId = String(payload.moduleId || "");
      var dupItemId = String(payload.itemId || "");
      var duplicatedItem = clone(payload.item);
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== dupModuleId) {
            return module;
          }
          var idx = findItemIndex(module.items, dupItemId);
          if (idx < 0) {
            return module;
          }
          var nextItems = module.items.slice();
          nextItems.splice(idx + 1, 0, duplicatedItem);
          return Object.assign({}, module, { items: nextItems });
        }),
        runtime: state.runtime
      };
    }

    if (type === "item/delete") {
      var deleteModuleId = String(payload.moduleId || "");
      var deleteItemId = String(payload.itemId || "");
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== deleteModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            items: module.items.filter(function (item) {
              return item.id !== deleteItemId;
            })
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "item/update-field") {
      var updateModuleId = String(payload.moduleId || "");
      var updateItemId = String(payload.itemId || "");
      var updateField = String(payload.field || "");
      var updateValue = String(payload.value || "");
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== updateModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            items: module.items.map(function (item) {
              if (item.id !== updateItemId) {
                return item;
              }
              return Object.assign({}, item, /** @type {any} */ ({ [updateField]: updateValue }));
            })
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "bullet/add") {
      var addBulletModuleId = String(payload.moduleId || "");
      var addBulletItemId = String(payload.itemId || "");
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== addBulletModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            items: module.items.map(function (item) {
              if (item.id !== addBulletItemId) {
                return item;
              }
              var bullets = Array.isArray(item.bullets) ? item.bullets.slice() : [];
              bullets.push("");
              return Object.assign({}, item, { bullets: bullets });
            })
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "bullet/delete") {
      var deleteBulletModuleId = String(payload.moduleId || "");
      var deleteBulletItemId = String(payload.itemId || "");
      var deleteIndex = Number(payload.index);
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== deleteBulletModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            items: module.items.map(function (item) {
              if (item.id !== deleteBulletItemId) {
                return item;
              }
              var bullets = Array.isArray(item.bullets) ? item.bullets.slice() : [];
              if (deleteIndex >= 0 && deleteIndex < bullets.length) {
                bullets.splice(deleteIndex, 1);
              }
              return Object.assign({}, item, { bullets: bullets });
            })
          });
        }),
        runtime: state.runtime
      };
    }

    if (type === "bullet/update") {
      var updateBulletModuleId = String(payload.moduleId || "");
      var updateBulletItemId = String(payload.itemId || "");
      var updateIndex = Number(payload.index);
      var bulletValue = String(payload.value || "");
      return {
        meta: state.meta,
        theme: state.theme,
        view: state.view,
        modules: state.modules.map(function (module) {
          if (module.id !== updateBulletModuleId) {
            return module;
          }
          return Object.assign({}, module, {
            items: module.items.map(function (item) {
              if (item.id !== updateBulletItemId) {
                return item;
              }
              var bullets = Array.isArray(item.bullets) ? item.bullets.slice() : [];
              if (updateIndex >= 0 && updateIndex < bullets.length) {
                bullets[updateIndex] = bulletValue;
              }
              return Object.assign({}, item, { bullets: bullets });
            })
          });
        }),
        runtime: state.runtime
      };
    }

    return state;
  }

  return reducer;
}
