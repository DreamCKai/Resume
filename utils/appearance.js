// @ts-check

import { DENSITY_PRESETS } from "./constants.js";
import { hexToRgba, hexToRgbChannels } from "./helpers.js";

/**
 * @file Theme and module appearance helpers.
 */

/**
 * Resolve module background by style key.
 * @param {"none"|"tint"|"panel"|"texture"|string} kind
 * @param {string} accent
 * @returns {string}
 */
export function resolveBackground(kind, accent) {
  if (kind === "tint") {
    return hexToRgba(accent, 0.05);
  }
  if (kind === "panel") {
    return "rgba(246, 240, 231, 0.92)";
  }
  if (kind === "texture") {
    return "rgba(246, 240, 231, 0.70)";
  }
  return "transparent";
}

/**
 * Resolve computed appearance fields used by module rendering.
 * @param {any} theme
 * @param {any} moduleStyle
 * @returns {{
 *  text: string,
 *  titleColor: string,
 *  accent: string,
 *  divider: string,
 *  border: string,
 *  background: string,
 *  align: "left"|"center"|"right",
 *  padding: number,
 *  titleStyle: "plain"|"smallcaps"|"boxed"|"ribbon",
 *  dividerStyle: "none"|"thin"|"double"|"ornament",
 *  itemDividerStyle: "none"|"thin"|"double"|"ornament",
 *  borderStyle: "none"|"frame"|"left-rule"|"label",
 *  ornamentStyle: "none"|"corners"|"title"|"wash",
 *  backgroundStyle: "none"|"tint"|"panel"|"texture"
 * }}
 */
export function resolveModuleAppearance(theme, moduleStyle) {
  var style = moduleStyle || {};
  var densityKey = style.paddingScale || theme.density;
  var density = DENSITY_PRESETS[densityKey] || DENSITY_PRESETS.standard;
  var titleColor = style.inheritTheme ? theme.colors.heading : (style.titleColor || theme.colors.heading);
  var dividerStyle = style.inheritTheme ? theme.dividerStyle : (style.dividerStyle || theme.dividerStyle);
  var itemDividerStyle = style.inheritTheme
    ? (theme.itemDividerStyle || theme.dividerStyle)
    : (style.itemDividerStyle || theme.itemDividerStyle || theme.dividerStyle);
  var borderStyle = style.inheritTheme ? theme.borderStyle : (style.borderStyle || theme.borderStyle);
  var ornamentStyle = style.inheritTheme ? theme.ornamentStyle : (style.ornamentStyle || theme.ornamentStyle);
  var titleStyle = style.inheritTheme ? "plain" : (style.titleStyle || "plain");
  var backgroundStyle = style.backgroundStyle || "none";
  var align = style.align || "left";
  return {
    text: theme.colors.text,
    titleColor: titleColor,
    accent: theme.colors.accent,
    divider: hexToRgba(theme.colors.accent, 0.38),
    border: hexToRgba(theme.colors.accent, 0.18),
    background: resolveBackground(backgroundStyle, theme.colors.accent),
    align: align === "center" || align === "right" ? align : "left",
    padding: density.padding,
    titleStyle: titleStyle === "smallcaps" || titleStyle === "boxed" || titleStyle === "ribbon" ? titleStyle : "plain",
    dividerStyle: dividerStyle === "none" || dividerStyle === "double" || dividerStyle === "ornament" ? dividerStyle : "thin",
    itemDividerStyle: itemDividerStyle === "none" || itemDividerStyle === "double" || itemDividerStyle === "ornament" ? itemDividerStyle : "thin",
    borderStyle: borderStyle === "frame" || borderStyle === "left-rule" || borderStyle === "label" ? borderStyle : "none",
    ornamentStyle: ornamentStyle === "corners" || ornamentStyle === "title" || ornamentStyle === "wash" ? ornamentStyle : "none",
    backgroundStyle: backgroundStyle === "tint" || backgroundStyle === "panel" || backgroundStyle === "texture" ? backgroundStyle : "none"
  };
}

/**
 * Build root CSS variables from current theme state.
 * @param {any} theme
 * @returns {Record<string, string>}
 */
export function buildThemeCssVars(theme) {
  var density = DENSITY_PRESETS[theme.density] || DENSITY_PRESETS.standard;
  return {
    "--theme-text": theme.colors.text,
    "--theme-heading": theme.colors.heading,
    "--theme-accent": theme.colors.accent,
    "--theme-accent-rgb": hexToRgbChannels(theme.colors.accent),
    "--theme-divider": hexToRgba(theme.colors.accent, 0.38),
    "--theme-border": hexToRgba(theme.colors.accent, 0.18),
    "--theme-heading-font": theme.typography.headingFont,
    "--theme-body-font": theme.typography.bodyFont,
    "--row-size": density.rowSize + "px",
    "--grid-gap": density.gap + "px",
    "--module-padding": density.padding + "px",
    "--module-title-size": density.titleSize + "px"
  };
}
