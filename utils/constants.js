// @ts-check

/**
 * @file App-level static constants and factories.
 */

/**
 * Runtime storage key for autosave state.
 * @type {string}
 */
export var STORAGE_KEY = "resume-template.canvas.v4";

/**
 * Legacy storage keys for backward compatibility import.
 * @type {string[]}
 */
export var LEGACY_KEYS = ["resume-template.modular.v3"];

/**
 * Total number of horizontal grid columns.
 * @type {number}
 */
export var GRID_COLUMNS = 12;

/**
 * Default canvas mode.
 * @type {"continuous"|"artboard"}
 */
export var DEFAULT_VIEW_MODE = "continuous";

/**
 * A4 page ratio: height / width.
 * @type {number}
 */
export var PAGE_RATIO = 297 / 210;

/**
 * Font families allowed by theme editor.
 * @type {string[]}
 */
export var FONT_FAMILIES = [
  "Times New Roman",
  "Georgia",
  "Bahnschrift",
  "Aptos",
  "SimSun",
  "Microsoft YaHei",
  "serif",
  "sans-serif"
];

/**
 * Density presets.
 * @type {Record<string, {rowSize: number, gap: number, padding: number, titleSize: number}>}
 */
export var DENSITY_PRESETS = {
  compact: { rowSize: 12, gap: 12, padding: 16, titleSize: 14 },
  standard: { rowSize: 14, gap: 14, padding: 18, titleSize: 15 },
  relaxed: { rowSize: 16, gap: 16, padding: 22, titleSize: 16 }
};

/**
 * Default module style.
 * @type {{inheritTheme: boolean, titleStyle: string, titleColor: string, dividerStyle: string, itemDividerStyle: string, borderStyle: string, ornamentStyle: string, backgroundStyle: "none"|"tint"|"panel"|"texture", paddingScale: string, align: "left"|"center"|"right"}}
 */
export var DEFAULT_MODULE_STYLE = {
  inheritTheme: true,
  titleStyle: "",
  titleColor: "",
  dividerStyle: "",
  itemDividerStyle: "",
  borderStyle: "",
  ornamentStyle: "",
  backgroundStyle: "none",
  paddingScale: "",
  align: "left"
};

/**
 * Dock liquid glass tokens.
 * @type {{activeFill: number, activeBorder: number, popoverBorder: number, popoverTop: number, popoverBottom: number, popoverShadow: number, popoverInsetBottom: number}}
 */
export var DOCK_GLASS_TOKENS = {
  activeFill: 0.1,
  activeBorder: 0.24,
  popoverBorder: 0.62,
  popoverTop: 0.66,
  popoverBottom: 0.38,
  popoverShadow: 0.2,
  popoverInsetBottom: 0.18
};

/**
 * Composite module type lookup.
 * @type {Record<string, boolean>}
 */
export var COMPOSITE_TYPES = { experience: true, project: true, education: true };

/**
 * Text module type lookup.
 * @type {Record<string, boolean>}
 */
export var TEXT_TYPES = { summary: true, text: true };

/**
 * Human-readable labels for module types.
 * @type {Record<string, string>}
 */
export var MODULE_LABELS = {
  identity: "基本信息",
  contacts: "联系方式",
  summary: "个人简介",
  experience: "工作经历",
  project: "项目经历",
  education: "教育背景",
  skills: "技能",
  text: "文本",
  list: "列表"
};

/**
 * Default theme presets.
 * @type {Record<string, {
 *   name: string,
 *   colors: {text: string, heading: string, accent: string},
 *   typography: {headingFont: string, bodyFont: string},
 *   dividerStyle: "none"|"thin"|"double"|"ornament",
 *   itemDividerStyle: "none"|"thin"|"double"|"ornament",
 *   borderStyle: "none"|"frame"|"left-rule"|"label",
 *   ornamentStyle: "none"|"corners"|"title"|"wash",
 *   density: "compact"|"standard"|"relaxed"
 * }>}
 */
export var DEFAULT_THEME_PRESETS = {
  "classic-formal": {
    name: "经典正式",
    colors: { text: "#221d17", heading: "#1f1711", accent: "#8a5c33" },
    typography: { headingFont: "Times New Roman", bodyFont: "Aptos" },
    dividerStyle: "thin",
    itemDividerStyle: "thin",
    borderStyle: "none",
    ornamentStyle: "none",
    density: "standard"
  },
  "ledger-serif": {
    name: "书卷衬线",
    colors: { text: "#201913", heading: "#1a130e", accent: "#6d4824" },
    typography: { headingFont: "Georgia", bodyFont: "Georgia" },
    dividerStyle: "double",
    itemDividerStyle: "double",
    borderStyle: "left-rule",
    ornamentStyle: "corners",
    density: "compact"
  },
  "monochrome-executive": {
    name: "黑白商务",
    colors: { text: "#171717", heading: "#101010", accent: "#535353" },
    typography: { headingFont: "Bahnschrift", bodyFont: "Aptos" },
    dividerStyle: "thin",
    itemDividerStyle: "thin",
    borderStyle: "frame",
    ornamentStyle: "none",
    density: "standard"
  },
  "ornament-light": {
    name: "轻装饰",
    colors: { text: "#2a1f18", heading: "#47261f", accent: "#9c5a43" },
    typography: { headingFont: "Georgia", bodyFont: "Georgia" },
    dividerStyle: "ornament",
    itemDividerStyle: "ornament",
    borderStyle: "frame",
    ornamentStyle: "title",
    density: "relaxed"
  }
};

/**
 * Create module-library descriptor with runtime uid function.
 * @param {(prefix: string) => string} uid - UID generator.
 * @returns {Record<string, {
 *  label: string,
 *  title: string,
 *  singleItem?: boolean,
 *  minRows: number,
 *  createItem: () => Record<string, unknown>
 * }>}
 */
export function createModuleLibrary(uid) {
  return {
    identity: {
      label: "身份信息",
      title: "",
      singleItem: true,
      minRows: 8,
      createItem: function createIdentityItem() {
        return { id: uid("item"), name: "", role: "" };
      }
    },
    contacts: {
      label: "联系方式",
      title: "",
      minRows: 5,
      createItem: function createContactsItem() {
        return { id: uid("item"), label: "", value: "" };
      }
    },
    summary: {
      label: "Profile / 摘要",
      title: "个人简介",
      minRows: 6,
      createItem: function createSummaryItem() {
        return { id: uid("item"), content: "" };
      }
    },
    experience: {
      label: "工作经历",
      title: "工作经历",
      minRows: 8,
      createItem: function createExperienceItem() {
        return { id: uid("item"), title: "", subtitle: "", date: "", description: "", bullets: [] };
      }
    },
    project: {
      label: "项目经历",
      title: "项目经历",
      minRows: 8,
      createItem: function createProjectItem() {
        return { id: uid("item"), title: "", subtitle: "", date: "", description: "", bullets: [] };
      }
    },
    education: {
      label: "教育背景",
      title: "教育背景",
      minRows: 7,
      createItem: function createEducationItem() {
        return { id: uid("item"), title: "", subtitle: "", date: "", description: "", bullets: [] };
      }
    },
    skills: {
      label: "个人技能",
      title: "个人技能",
      minRows: 7,
      createItem: function createSkillsItem() {
        return { id: uid("item"), label: "", value: "" };
      }
    },
    text: {
      label: "自定义文本",
      title: "自定义文本",
      minRows: 6,
      createItem: function createTextItem() {
        return { id: uid("item"), content: "" };
      }
    },
    list: {
      label: "自定义列表",
      title: "自定义列表",
      minRows: 7,
      createItem: function createListItem() {
        return { id: uid("item"), title: "", bullets: [] };
      }
    }
  };
}

