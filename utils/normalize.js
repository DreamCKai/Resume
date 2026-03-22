// @ts-check

import { GRID_COLUMNS, DEFAULT_VIEW_MODE, FONT_FAMILIES } from "./constants.js";
import { asText, clampInt, clone, normalizeColor, oneOf } from "./helpers.js";
import { createDefaultModuleStyle } from "./state_factory.js";

/**
 * @file State normalization and migration helpers.
 */

/**
 * Create normalizer utilities.
 * @param {{
 *   moduleLibrary: Record<string, any>,
 *   textTypes: Record<string, boolean>,
 *   compositeTypes: Record<string, boolean>,
 *   themePresets: Record<string, any>,
 *   uid: (prefix:string)=>string,
 *   getDefaultState: () => any,
 *   layoutTools: {
 *     getLayoutMetrics: () => any,
 *     spanToWidth: (span:number, metrics?:any)=>number,
 *     rowsToHeight: (rows:number, metrics?:any)=>number,
 *     normalizeAbsoluteLayout: (type:string, source: Record<string, unknown>, context: any, moduleLibrary: Record<string, any>)=>any,
 *     normalizeLegacyGridLayout: (type:string, source: Record<string, unknown>, context: any, moduleLibrary: Record<string, any>, columns: number)=>any
 *   }
 * }} context
 */
export function createNormalizer(context) {
  var moduleLibrary = context.moduleLibrary;
  var textTypes = context.textTypes;
  var compositeTypes = context.compositeTypes;
  var themePresets = context.themePresets;
  var uid = context.uid;
  var getDefaultState = context.getDefaultState;
  var layoutTools = context.layoutTools;

  /**
   * Sync doc title from identity module name.
   * @param {any} targetState
   * @returns {void}
   */
  function syncDocTitle(targetState) {
    var identity = targetState.modules.find(function (module) {
      return module.type === "identity";
    });
    var name = identity && identity.items[0] ? asText(identity.items[0].name).trim() : "";
    targetState.meta.docTitle = name || "Resume";
  }

  /**
   * Normalize app state from raw json.
   * @param {unknown} raw
   * @returns {any}
   */
  function normalizeState(raw) {
    if (!raw || typeof raw !== "object") {
      return getDefaultState();
    }

    if (Array.isArray(/** @type {any} */ (raw).modules)) {
      return normalizeV4(/** @type {any} */ (raw));
    }

    var rawAny = /** @type {any} */ (raw);
    if (
      Array.isArray(rawAny.sections) ||
      (rawAny.meta && (rawAny.meta.name || rawAny.meta.role || Array.isArray(rawAny.meta.contacts)))
    ) {
      return migrateLegacyState(rawAny);
    }

    return getDefaultState();
  }

  /**
   * Normalize current v4 state.
   * @param {any} raw
   * @returns {any}
   */
  function normalizeV4(raw) {
    var fallback = getDefaultState();
    var meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
    var theme = normalizeTheme(raw.theme);
    var view = raw.view && typeof raw.view === "object" ? raw.view : {};
    var runtime = raw.runtime && typeof raw.runtime === "object" ? raw.runtime : {};
    var modules = (Array.isArray(raw.modules) ? raw.modules : []).map(normalizeModule).filter(Boolean);

    if (!modules.length) {
      modules = fallback.modules;
    }

    var normalized = {
      meta: {
        docTitle: asText(meta.docTitle) || "Resume",
        viewMode: meta.viewMode === "artboard" ? "artboard" : DEFAULT_VIEW_MODE
      },
      theme: theme,
      view: {
        showGrid: view.showGrid === true
      },
      modules: modules,
      runtime: {
        selectedModuleId: asText(runtime.selectedModuleId),
        activePanel: oneOf(runtime.activePanel, ["content", "style", "view", "file"], "content"),
        status: asText(runtime.status) || "未保存",
        statusTone: oneOf(runtime.statusTone, ["", "ok", "warn"], "")
      }
    };

    syncDocTitle(normalized);
    return normalized;
  }

  /**
   * Normalize theme object.
   * @param {any} theme
   * @returns {any}
   */
  function normalizeTheme(theme) {
    var base = clone(themePresets["classic-formal"] || getDefaultState().theme);
    var source = theme && typeof theme === "object" ? theme : {};
    return {
      presetId: asText(source.presetId) || "classic-formal",
      colors: {
        text: normalizeColor(source.colors && source.colors.text, base.colors.text),
        heading: normalizeColor(source.colors && source.colors.heading, base.colors.heading),
        accent: normalizeColor(source.colors && source.colors.accent, base.colors.accent)
      },
      typography: {
        headingFont: FONT_FAMILIES.indexOf(asText(source.typography && source.typography.headingFont)) >= 0 ? asText(source.typography.headingFont) : base.typography.headingFont,
        bodyFont: FONT_FAMILIES.indexOf(asText(source.typography && source.typography.bodyFont)) >= 0 ? asText(source.typography.bodyFont) : base.typography.bodyFont
      },
      dividerStyle: oneOf(source.dividerStyle, ["none", "thin", "double", "ornament"], base.dividerStyle),
      itemDividerStyle: oneOf(source.itemDividerStyle, ["none", "thin", "double", "ornament"], source.dividerStyle || base.dividerStyle),
      borderStyle: oneOf(source.borderStyle, ["none", "frame", "left-rule", "label"], base.borderStyle),
      ornamentStyle: oneOf(source.ornamentStyle, ["none", "corners", "title", "wash"], base.ornamentStyle),
      density: oneOf(source.density, ["compact", "standard", "relaxed"], base.density)
    };
  }

  /**
   * Normalize one module.
   * @param {any} module
   * @returns {any|null}
   */
  function normalizeModule(module) {
    if (!module || typeof module !== "object" || !moduleLibrary[module.type]) {
      return null;
    }

    return {
      id: asText(module.id) || uid("module"),
      type: module.type,
      title: asText(module.title),
      items: normalizeItems(module.type, module.items),
      layout: normalizeLayout(module.type, module.layout),
      style: normalizeModuleStyle(module.style)
    };
  }

  /**
   * Normalize layout from absolute or legacy format.
   * @param {string} type
   * @param {any} layout
   * @returns {any}
   */
  function normalizeLayout(type, layout) {
    var source = layout && typeof layout === "object" ? layout : {};
    var hasAbsolute =
      Number.isFinite(Number(source.left)) ||
      Number.isFinite(Number(source.top)) ||
      Number.isFinite(Number(source.width)) ||
      Number.isFinite(Number(source.height));
    var metrics = layoutTools.getLayoutMetrics();

    if (hasAbsolute) {
      return layoutTools.normalizeAbsoluteLayout(type, source, metrics, moduleLibrary);
    }
    return layoutTools.normalizeLegacyGridLayout(type, source, metrics, moduleLibrary, GRID_COLUMNS);
  }

  /**
   * Normalize module style object.
   * @param {any} style
   * @returns {any}
   */
  function normalizeModuleStyle(style) {
    var source = style && typeof style === "object" ? style : {};
    return {
      inheritTheme: source.inheritTheme !== false,
      titleStyle: oneOf(source.titleStyle, ["", "plain", "smallcaps", "boxed", "ribbon"], ""),
      titleColor: normalizeColor(source.titleColor, ""),
      dividerStyle: oneOf(source.dividerStyle, ["", "none", "thin", "double", "ornament"], ""),
      itemDividerStyle: oneOf(source.itemDividerStyle, ["", "none", "thin", "double", "ornament"], ""),
      borderStyle: oneOf(source.borderStyle, ["", "none", "frame", "left-rule", "label"], ""),
      ornamentStyle: oneOf(source.ornamentStyle, ["", "none", "corners", "title", "wash"], ""),
      backgroundStyle: oneOf(source.backgroundStyle, ["none", "tint", "panel", "texture"], "none"),
      paddingScale: oneOf(source.paddingScale, ["", "compact", "standard", "relaxed"], ""),
      align: oneOf(source.align, ["left", "center", "right"], "left")
    };
  }

  /**
   * Normalize item collection by module type.
   * @param {string} type
   * @param {any} items
   * @returns {any[]}
   */
  function normalizeItems(type, items) {
    var rawItems = Array.isArray(items) ? items : [];
    var normalized = rawItems.map(function (item) {
      return normalizeItem(type, item);
    }).filter(Boolean);

    if (moduleLibrary[type].singleItem) {
      normalized = normalized.slice(0, 1);
      if (!normalized.length) {
        normalized.push(moduleLibrary[type].createItem());
      }
    }
    return normalized;
  }

  /**
   * Normalize item by module type.
   * @param {string} type
   * @param {any} item
   * @returns {any|null}
   */
  function normalizeItem(type, item) {
    if (!item || typeof item !== "object") {
      return null;
    }
    if (type === "identity") {
      return { id: asText(item.id) || uid("item"), name: asText(item.name), role: asText(item.role) };
    }
    if (type === "contacts") {
      return { id: asText(item.id) || uid("item"), label: asText(item.label), value: asText(item.value) };
    }
    if (textTypes[type]) {
      return { id: asText(item.id) || uid("item"), content: asText(item.content) };
    }
    if (type === "skills") {
      return { id: asText(item.id) || uid("item"), label: asText(item.label), value: asText(item.value) };
    }
    if (compositeTypes[type]) {
      return {
        id: asText(item.id) || uid("item"),
        title: asText(item.title),
        subtitle: asText(item.subtitle),
        date: asText(item.date),
        description: asText(item.description),
        bullets: normalizeBullets(item.bullets)
      };
    }
    if (type === "list") {
      return { id: asText(item.id) || uid("item"), title: asText(item.title), bullets: normalizeBullets(item.bullets) };
    }
    return null;
  }

  /**
   * Normalize bullet collection.
   * @param {any} bullets
   * @returns {string[]}
   */
  function normalizeBullets(bullets) {
    return (Array.isArray(bullets) ? bullets : []).map(asText);
  }

  /**
   * Migrate legacy schema to current schema.
   * @param {any} raw
   * @returns {any}
   */
  function migrateLegacyState(raw) {
    var legacyModules = [];
    var cursor = 0;
    var metrics = layoutTools.getLayoutMetrics();
    var sections = [];
    var meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};

    if (meta.name || meta.role) {
      sections.push({
        type: "identity",
        title: "",
        items: [{ id: uid("item"), name: asText(meta.name), role: asText(meta.role) }]
      });
    }

    if (Array.isArray(meta.contacts) && meta.contacts.length) {
      sections.push({
        type: "contacts",
        title: "",
        items: meta.contacts.filter(function (item) {
          return item && item.enabled !== false;
        }).map(function (item) {
          return { id: asText(item.id) || uid("item"), label: asText(item.label), value: asText(item.value) };
        })
      });
    }

    if (meta.summary) {
      sections.push({
        type: "summary",
        title: "Profile",
        items: [{ id: uid("item"), content: asText(meta.summary) }]
      });
    }

    if (Array.isArray(raw.sections)) {
      raw.sections.forEach(function (section) {
        if (section && moduleLibrary[section.type]) {
          sections.push(section);
        }
      });
    }

    if (!sections.length) {
      return getDefaultState();
    }

    sections.forEach(function (section) {
      var normalized = normalizeModule({
        id: uid("module"),
        type: section.type,
        title: section.title,
        items: section.items,
        layout: {
          left: 0,
          top: cursor,
          width: layoutTools.spanToWidth(GRID_COLUMNS, metrics),
          height: layoutTools.rowsToHeight(moduleLibrary[section.type].minRows, metrics)
        },
        style: createDefaultModuleStyle()
      });
      legacyModules.push(normalized);
      cursor += normalized.layout.height + metrics.gap;
    });

    var migrated = {
      meta: {
        docTitle: asText(meta.docTitle) || "Resume",
        viewMode: DEFAULT_VIEW_MODE
      },
      theme: normalizeTheme({}),
      view: { showGrid: false },
      modules: legacyModules,
      runtime: {
        selectedModuleId: "",
        activePanel: "content",
        status: "未保存",
        statusTone: ""
      }
    };
    syncDocTitle(migrated);
    return migrated;
  }

  /**
   * Build export-safe persisted state payload.
   * @param {any} state
   * @returns {any}
   */
  function getPersistedState(state) {
    syncDocTitle(state);
    return {
      meta: {
        docTitle: state.meta.docTitle || "Resume",
        viewMode: state.meta.viewMode === "artboard" ? "artboard" : "continuous"
      },
      theme: clone(state.theme),
      view: {
        showGrid: state.view.showGrid === true
      },
      modules: clone(state.modules)
    };
  }

  return {
    syncDocTitle: syncDocTitle,
    normalizeState: normalizeState,
    getPersistedState: getPersistedState
  };
}
