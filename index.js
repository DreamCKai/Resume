// @ts-check

import { createDockComponent } from "./components/dock/dock.js";
import { createResumeModuleComponent } from "./components/resume_module/resume_module.js";
import { createDockCardComponent } from "./components/dock_card/dock_card.js";
import { createRender } from "./render/render.js";
import { createFileManager } from "./file_manager/file_manager.js";
import { createMessager } from "./messager/messager.js";
import {
  COMPOSITE_TYPES,
  DOCK_GLASS_TOKENS,
  FONT_FAMILIES,
  GRID_COLUMNS,
  LEGACY_KEYS,
  PAGE_RATIO,
  STORAGE_KEY,
  TEXT_TYPES,
  DEFAULT_THEME_PRESETS,
  createModuleLibrary
} from "./utils/constants.js";
import { createLayoutTools } from "./utils/layout.js";
import { createNormalizer } from "./utils/normalize.js";
import { createReducer } from "./utils/reducer.js";
import { createDefaultState } from "./utils/state_factory.js";
import { createStore } from "./utils/store.js";
import { createUidGenerator } from "./utils/helpers.js";
import { buildThemeCssVars, resolveModuleAppearance } from "./utils/appearance.js";
import { createCommandRouter } from "./utils/command_router.js";

/**
 * @file Application bootstrap entry.
 * @description
 * This file only wires modules together and manages top-level lifecycle events.
 */

/**
 * Load theme presets from json config.
 * @returns {Promise<Record<string, any>>}
 */
async function loadThemePresets() {
  try {
    var response = await fetch("./configs/theme_preset.json", { cache: "no-cache" });
    if (!response.ok) {
      return DEFAULT_THEME_PRESETS;
    }
    var data = await response.json();
    if (!data || typeof data !== "object") {
      return DEFAULT_THEME_PRESETS;
    }
    return /** @type {Record<string, any>} */ (data);
  } catch (error) {
    return DEFAULT_THEME_PRESETS;
  }
}

/**
 * Run application bootstrap.
 * @returns {Promise<void>}
 */
async function bootstrap() {
  /** @type {{canvasStage: HTMLElement, canvasFrame: HTMLElement, pageGuides: HTMLElement, gridOverlay: HTMLElement, canvas: HTMLElement, resumeDock: HTMLElement|null, importUsrSaveInput: HTMLInputElement|null}} */
  var refs = {
    canvasStage: /** @type {HTMLElement} */ (document.getElementById("canvas-stage")),
    canvasFrame: /** @type {HTMLElement} */ (document.getElementById("canvas-frame")),
    pageGuides: /** @type {HTMLElement} */ (document.getElementById("page-guides")),
    gridOverlay: /** @type {HTMLElement} */ (document.getElementById("grid-overlay")),
    canvas: /** @type {HTMLElement} */ (document.getElementById("resume-canvas")),
    resumeDock: document.getElementById("resume-dock"),
    importUsrSaveInput: /** @type {HTMLInputElement|null} */ (document.getElementById("import-json-input"))
  };

  if (!refs.canvas || !refs.canvasFrame || !refs.canvasStage) {
    throw new Error("核心画布节点缺失，初始化失败。");
  }

  var uid = createUidGenerator();
  var moduleLibrary = createModuleLibrary(uid);
  var themePresets = await loadThemePresets();
  var messager = createMessager();

  var layoutTools = createLayoutTools({
    refs: {
      canvas: refs.canvas,
      canvasFrame: refs.canvasFrame
    },
    gridColumns: GRID_COLUMNS,
    pageRatio: PAGE_RATIO
  });

  /**
   * Build default state for current runtime metrics.
   * @returns {any}
   */
  function getDefaultState() {
    return createDefaultState({
      moduleLibrary: moduleLibrary,
      themePresets: themePresets,
      uid: uid,
      getLayoutMetrics: layoutTools.getLayoutMetrics,
      spanToWidth: layoutTools.spanToWidth,
      rowsToHeight: layoutTools.rowsToHeight
    });
  }

  var normalizer = createNormalizer({
    moduleLibrary: moduleLibrary,
    textTypes: TEXT_TYPES,
    compositeTypes: COMPOSITE_TYPES,
    themePresets: themePresets,
    uid: uid,
    getDefaultState: getDefaultState,
    layoutTools: layoutTools
  });

  var store = createStore({
    initialState: getDefaultState(),
    reducer: createReducer(),
    messager: messager
  });

  var commandRouter = createCommandRouter({
    messager: messager,
    store: store,
    uid: uid,
    moduleLibrary: moduleLibrary,
    textTypes: TEXT_TYPES,
    compositeTypes: COMPOSITE_TYPES,
    themePresets: themePresets,
    layoutTools: layoutTools
  });
  commandRouter.bind();

  var render = createRender({ messager: messager });
  render.mount();

  var dock = createDockComponent({
    messager: messager,
    refs: { resumeDock: refs.resumeDock },
    tokens: DOCK_GLASS_TOKENS,
    getState: store.getState
  });
  dock.mount();
  dock.bindEvents();
  dock.startTimerLoop();

  var resumeModule = createResumeModuleComponent({
    messager: messager,
    refs: {
      canvas: refs.canvas,
      canvasFrame: refs.canvasFrame
    },
    getState: store.getState,
    moduleLibrary: moduleLibrary,
    textTypes: TEXT_TYPES,
    compositeTypes: COMPOSITE_TYPES,
    layoutTools: layoutTools,
    resolveModuleAppearance: resolveModuleAppearance
  });
  resumeModule.mount();

  var dockCard = createDockCardComponent({
    messager: messager,
    getState: store.getState,
    moduleLibrary: moduleLibrary,
    themePresets: themePresets,
    fontFamilies: FONT_FAMILIES,
    root: refs.resumeDock || document.body
  });
  dockCard.mount();

  var fileManager = createFileManager({
    messager: messager,
    refs: { importUsrSaveInput: refs.importUsrSaveInput },
    storageKey: STORAGE_KEY,
    legacyKeys: LEGACY_KEYS,
    normalizeState: normalizer.normalizeState,
    getPersistedState: normalizer.getPersistedState,
    getDefaultState: getDefaultState,
    syncDocTitle: normalizer.syncDocTitle,
    getState: store.getState,
    dispatch: store.dispatch
  });
  fileManager.bindInput();

  /**
   * Apply state-driven global view updates.
   * @param {any} state
   * @returns {void}
   */
  function applyGlobalView(state) {
    normalizer.syncDocTitle(state);
    document.title = state.meta.docTitle || "Resume";
    messager.publish("theme:apply", {
      vars: buildThemeCssVars(state.theme)
    });
    messager.publish("view:update", {
      slot: "stage.flags",
      selector: "#canvas-stage",
      attrs: {
        "data-view-mode": state.meta.viewMode === "artboard" ? "artboard" : "continuous",
        "data-grid-visible": state.view.showGrid ? "true" : "false"
      }
    });
  }

  messager.subscribe("state:changed", function (payload) {
    applyGlobalView(payload.state);
  });

  window.addEventListener("pointermove", function (event) {
    if (dock.handlePointerMove(event)) {
      return;
    }
    resumeModule.handlePointerMove(event);
  });

  window.addEventListener("pointerup", function () {
    dock.handlePointerUp();
    resumeModule.handlePointerUp();
  });

  window.addEventListener("resize", function () {
    messager.publish("command:request", {
      type: "module/normalize-all-layouts",
      payload: {}
    });
    resumeModule.requestLayout();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      dock.stopTimerLoop();
      return;
    }
    dock.startTimerLoop();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }
    if (resumeModule.cancelInteraction()) {
      return;
    }
    dock.closeTopDockWindow();
  });

  var initialState = fileManager.loadInitialState();
  store.dispatch({
    type: "state/replace",
    payload: { state: initialState }
  });
  store.dispatch({
    type: "runtime/set-status",
    payload: { message: "模板已就绪", tone: "" }
  });
}

bootstrap().catch(function (error) {
  // eslint-disable-next-line no-console
  console.error(error);
  window.alert("页面初始化失败，请打开控制台查看错误信息。");
});
