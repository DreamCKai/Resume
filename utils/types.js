// @ts-check

/**
 * @file Shared JSDoc type definitions.
 * @description
 * This file is imported by runtime modules to provide static type hints for
 * JavaScript (`@ts-check`) without switching to TypeScript.
 */

/**
 * @typedef {"continuous"|"artboard"} ViewMode
 */

/**
 * @typedef {"none"|"thin"|"double"|"ornament"} DividerStyle
 */

/**
 * @typedef {"none"|"frame"|"left-rule"|"label"} BorderStyle
 */

/**
 * @typedef {"none"|"corners"|"title"|"wash"} OrnamentStyle
 */

/**
 * @typedef {"none"|"tint"|"panel"|"texture"} BackgroundStyle
 */

/**
 * @typedef {"compact"|"standard"|"relaxed"} DensityStyle
 */

/**
 * @typedef {"left"|"center"|"right"} TextAlign
 */

/**
 * @typedef {Object} Layout
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} ThemeTypography
 * @property {string} headingFont
 * @property {string} bodyFont
 */

/**
 * @typedef {Object} ThemeColors
 * @property {string} text
 * @property {string} heading
 * @property {string} accent
 */

/**
 * @typedef {Object} Theme
 * @property {string} presetId
 * @property {ThemeColors} colors
 * @property {ThemeTypography} typography
 * @property {DividerStyle} dividerStyle
 * @property {DividerStyle} itemDividerStyle
 * @property {BorderStyle} borderStyle
 * @property {OrnamentStyle} ornamentStyle
 * @property {DensityStyle} density
 */

/**
 * @typedef {Object} ModuleStyle
 * @property {boolean} inheritTheme
 * @property {string} titleStyle
 * @property {string} titleColor
 * @property {string} dividerStyle
 * @property {string} itemDividerStyle
 * @property {string} borderStyle
 * @property {string} ornamentStyle
 * @property {BackgroundStyle} backgroundStyle
 * @property {string} paddingScale
 * @property {TextAlign} align
 */

/**
 * @typedef {Object} ResumeItem
 * @property {string} id
 * @property {string=} name
 * @property {string=} role
 * @property {string=} label
 * @property {string=} value
 * @property {string=} content
 * @property {string=} title
 * @property {string=} subtitle
 * @property {string=} date
 * @property {string=} description
 * @property {string[]=} bullets
 */

/**
 * @typedef {Object} ResumeModule
 * @property {string} id
 * @property {string} type
 * @property {string} title
 * @property {ResumeItem[]} items
 * @property {Layout} layout
 * @property {ModuleStyle} style
 */

/**
 * @typedef {Object} AppMeta
 * @property {string} docTitle
 * @property {ViewMode} viewMode
 */

/**
 * @typedef {Object} AppView
 * @property {boolean} showGrid
 */

/**
 * @typedef {Object} RuntimeState
 * @property {string} selectedModuleId
 * @property {"content"|"style"|"view"|"file"} activePanel
 * @property {string} status
 * @property {""|"ok"|"warn"} statusTone
 */

/**
 * @typedef {Object} AppState
 * @property {AppMeta} meta
 * @property {Theme} theme
 * @property {AppView} view
 * @property {ResumeModule[]} modules
 * @property {RuntimeState} runtime
 */

/**
 * @typedef {Object} MessageTopicMap
 * @property {{type: string, payload: Record<string, unknown>}} ["command:request"]
 * @property {{state: AppState, prevState: AppState|null, action: {type: string, payload: Record<string, unknown>}}} ["state:changed"]
 * @property {{slot: string, selector: string, html: string}} ["view:update"]
 * @property {{slots: string[]}} ["render:flushed"]
 */

/**
 * @typedef {Object} CommandPayload
 * @property {string} type
 * @property {Record<string, unknown>} payload
 */

/**
 * @typedef {Object} ViewPayload
 * @property {string} slot
 * @property {string} selector
 * @property {string} html
 */

export {};

