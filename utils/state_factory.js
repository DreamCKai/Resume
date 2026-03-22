// @ts-check

import { clone } from "./helpers.js";
import { DEFAULT_VIEW_MODE, GRID_COLUMNS, DEFAULT_MODULE_STYLE } from "./constants.js";

/**
 * @file App state factory helpers.
 */

/**
 * Build default module style object.
 * @returns {{inheritTheme: boolean, titleStyle: string, titleColor: string, dividerStyle: string, itemDividerStyle: string, borderStyle: string, ornamentStyle: string, backgroundStyle: "none"|"tint"|"panel"|"texture", paddingScale: string, align: "left"|"center"|"right"}}
 */
export function createDefaultModuleStyle() {
  return clone(DEFAULT_MODULE_STYLE);
}

/**
 * Build default theme based on preset collection.
 * @param {Record<string, any>} themePresets
 * @returns {any}
 */
export function createDefaultTheme(themePresets) {
  var preset = clone(themePresets["classic-formal"] || {});
  preset.presetId = "classic-formal";
  return preset;
}

/**
 * Create one module by type at top position.
 * @param {{
 *   type: string,
 *   top: number,
 *   moduleLibrary: Record<string, any>,
 *   uid: (prefix:string)=>string,
 *   spanToWidth: (span:number, metrics?:any)=>number,
 *   rowsToHeight: (rows:number, metrics?:any)=>number,
 *   getLayoutMetrics: ()=>any
 * }} params
 * @returns {any}
 */
export function createModule(params) {
  var def = params.moduleLibrary[params.type];
  var metrics = params.getLayoutMetrics();
  return {
    id: params.uid("module"),
    type: params.type,
    title: def.title,
    items: [def.createItem()],
    layout: {
      left: 0,
      top: Math.max(0, Math.round(params.top || 0)),
      width: params.spanToWidth(GRID_COLUMNS, metrics),
      height: params.rowsToHeight(def.minRows, metrics)
    },
    style: createDefaultModuleStyle()
  };
}

/**
 * Build default app state.
 * @param {{
 *   moduleLibrary: Record<string, any>,
 *   themePresets: Record<string, any>,
 *   uid: (prefix:string)=>string,
 *   getLayoutMetrics: ()=>any,
 *   spanToWidth: (span:number, metrics?:any)=>number,
 *   rowsToHeight: (rows:number, metrics?:any)=>number
 * }} params
 * @returns {any}
 */
export function createDefaultState(params) {
  /** @type {any[]} */
  var modules = [];
  var cursor = 0;
  var metrics = params.getLayoutMetrics();

  ["identity", "contacts", "experience", "project", "education", "skills"].forEach(function (type) {
    var module = createModule({
      type: type,
      top: cursor,
      moduleLibrary: params.moduleLibrary,
      uid: params.uid,
      spanToWidth: params.spanToWidth,
      rowsToHeight: params.rowsToHeight,
      getLayoutMetrics: params.getLayoutMetrics
    });
    modules.push(module);
    cursor += module.layout.height + metrics.gap;
  });

  return {
    meta: {
      docTitle: "Resume",
      viewMode: DEFAULT_VIEW_MODE
    },
    theme: createDefaultTheme(params.themePresets),
    view: {
      showGrid: false
    },
    modules: modules,
    runtime: {
      selectedModuleId: "",
      activePanel: "content",
      status: "未保存",
      statusTone: ""
    }
  };
}

