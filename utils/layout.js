// @ts-check

import { clampPx, clampInt } from "./helpers.js";

/**
 * @file Canvas layout utility factory.
 */

/**
 * @typedef {Object} LayoutTools
 * @property {() => number} getGap
 * @property {() => number} getRowSize
 * @property {() => number} getColumnWidth
 * @property {() => {left:number,right:number,top:number,bottom:number}} getCanvasPadding
 * @property {() => number} getCanvasInnerWidth
 * @property {() => {gap:number,row:number,col:number,rowUnit:number,colUnit:number,innerWidth:number,padding:{left:number,right:number,top:number,bottom:number}}} getLayoutMetrics
 * @property {(span:number, metrics?: ReturnType<LayoutTools["getLayoutMetrics"]>) => number} spanToWidth
 * @property {(rows:number, metrics?: ReturnType<LayoutTools["getLayoutMetrics"]>) => number} rowsToHeight
 * @property {(metrics?: ReturnType<LayoutTools["getLayoutMetrics"]>) => number} getMinModuleWidthPx
 * @property {(metrics?: ReturnType<LayoutTools["getLayoutMetrics"]>) => number} getMinModuleHeightPx
 * @property {() => void} updateCanvasMetrics
 * @property {(layout: {left:number,top:number,width:number,height:number}) => string} getModuleInlineLayoutStyle
 * @property {(type:string, source: Record<string, unknown>, context: ReturnType<LayoutTools["getLayoutMetrics"]>, moduleLibrary: Record<string, {minRows:number}>) => {left:number,top:number,width:number,height:number}} normalizeAbsoluteLayout
 * @property {(type:string, source: Record<string, unknown>, context: ReturnType<LayoutTools["getLayoutMetrics"]>, moduleLibrary: Record<string, {minRows:number}>, gridColumns: number) => {left:number,top:number,width:number,height:number}} normalizeLegacyGridLayout
 */

/**
 * Create layout tools bound to canvas refs.
 * @param {{refs: {canvas: HTMLElement, canvasFrame: HTMLElement}, gridColumns: number, pageRatio: number}} params
 * @returns {LayoutTools}
 */
export function createLayoutTools(params) {
  var refs = params.refs;
  var gridColumns = params.gridColumns;
  var pageRatio = params.pageRatio;

  /**
   * Read row/column gap from canvas.
   * @returns {number}
   */
  function getGap() {
    var style = window.getComputedStyle(refs.canvas);
    return parseFloat(style.rowGap || style.gap || "14") || 14;
  }

  /**
   * Read row size from root css var.
   * @returns {number}
   */
  function getRowSize() {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue("--row-size");
    return parseFloat(value) || 14;
  }

  /**
   * Read calculated column width from frame css var.
   * @returns {number}
   */
  function getColumnWidth() {
    var value = window.getComputedStyle(refs.canvasFrame).getPropertyValue("--col-px");
    return parseFloat(value) || 60;
  }

  /**
   * Read canvas paddings in pixels.
   * @returns {{left:number,right:number,top:number,bottom:number}}
   */
  function getCanvasPadding() {
    var style = window.getComputedStyle(refs.canvas);
    return {
      left: parseFloat(style.paddingLeft) || 0,
      right: parseFloat(style.paddingRight) || 0,
      top: parseFloat(style.paddingTop) || 0,
      bottom: parseFloat(style.paddingBottom) || 0
    };
  }

  /**
   * Compute available width excluding paddings.
   * @returns {number}
   */
  function getCanvasInnerWidth() {
    var padding = getCanvasPadding();
    return Math.max(120, refs.canvas.clientWidth - padding.left - padding.right);
  }

  /**
   * Compute current layout metrics.
   * @returns {{gap:number,row:number,col:number,rowUnit:number,colUnit:number,innerWidth:number,padding:{left:number,right:number,top:number,bottom:number}}}
   */
  function getLayoutMetrics() {
    var gap = getGap();
    var row = getRowSize();
    var innerWidth = getCanvasInnerWidth();
    var col = Math.max(8, (innerWidth - gap * (gridColumns - 1)) / gridColumns);
    var padding = getCanvasPadding();
    return {
      gap: gap,
      row: row,
      col: col,
      rowUnit: row + gap,
      colUnit: col + gap,
      innerWidth: innerWidth,
      padding: padding
    };
  }

  /**
   * Convert grid span to absolute width in px.
   * @param {number} span
   * @param {ReturnType<LayoutTools["getLayoutMetrics"]=} metrics
   * @returns {number}
   */
  function spanToWidth(span, metrics) {
    var context = metrics || getLayoutMetrics();
    var cols = clampInt(span, 1, gridColumns, gridColumns);
    return Math.round(cols * context.col + (cols - 1) * context.gap);
  }

  /**
   * Convert row count to absolute height in px.
   * @param {number} rows
   * @param {ReturnType<LayoutTools["getLayoutMetrics"]=} metrics
   * @returns {number}
   */
  function rowsToHeight(rows, metrics) {
    var context = metrics || getLayoutMetrics();
    var count = Math.max(1, Math.round(Number(rows) || 1));
    return Math.round(count * context.row + (count - 1) * context.gap);
  }

  /**
   * Minimum module width in px.
   * @param {ReturnType<LayoutTools["getLayoutMetrics"]=} metrics
   * @returns {number}
   */
  function getMinModuleWidthPx(metrics) {
    return spanToWidth(2, metrics || getLayoutMetrics());
  }

  /**
   * Minimum module height in px.
   * @param {ReturnType<LayoutTools["getLayoutMetrics"]=} metrics
   * @returns {number}
   */
  function getMinModuleHeightPx(metrics) {
    return rowsToHeight(2, metrics || getLayoutMetrics());
  }

  /**
   * Update frame css vars based on latest canvas geometry.
   * @returns {void}
   */
  function updateCanvasMetrics() {
    var width = refs.canvas.clientWidth;
    var padding = getCanvasPadding();
    var innerWidth = Math.max(120, width - padding.left - padding.right);
    var gap = getGap();
    var col = Math.max(8, (innerWidth - gap * (gridColumns - 1)) / gridColumns);
    var pageHeight = width * pageRatio;
    var height = refs.canvas.offsetHeight;

    refs.canvasFrame.style.setProperty("--sheet-width", width + "px");
    refs.canvasFrame.style.setProperty("--sheet-height", height + "px");
    refs.canvasFrame.style.setProperty("--page-height", pageHeight + "px");
    refs.canvasFrame.style.setProperty("--col-px", col + "px");
  }

  /**
   * Build inline style for module absolute layout.
   * @param {{left:number,top:number,width:number,height:number}} layout
   * @returns {string}
   */
  function getModuleInlineLayoutStyle(layout) {
    var metrics = getLayoutMetrics();
    return [
      "left:" + Math.round(metrics.padding.left + (Number(layout.left) || 0)) + "px",
      "top:" + Math.round(metrics.padding.top + (Number(layout.top) || 0)) + "px",
      "width:" + Math.round(Number(layout.width) || metrics.innerWidth) + "px",
      "min-height:" + Math.round(Number(layout.height) || getMinModuleHeightPx(metrics)) + "px"
    ].join(";");
  }

  /**
   * Normalize absolute layout object.
   * @param {string} type
   * @param {Record<string, unknown>} source
   * @param {ReturnType<LayoutTools["getLayoutMetrics"]>} context
   * @param {Record<string, {minRows:number}>} moduleLibrary
   * @returns {{left:number,top:number,width:number,height:number}}
   */
  function normalizeAbsoluteLayout(type, source, context, moduleLibrary) {
    var def = moduleLibrary[type];
    var minWidth = getMinModuleWidthPx(context);
    var minHeight = getMinModuleHeightPx(context);
    var innerWidth = Math.max(minWidth, context.innerWidth);
    var defaultHeight = rowsToHeight(def.minRows, context);
    var width = clampPx(source.width, minWidth, innerWidth, innerWidth);
    return {
      left: clampPx(source.left, 0, Math.max(0, innerWidth - width), 0),
      top: clampPx(source.top, 0, 60000, 0),
      width: width,
      height: clampPx(source.height, minHeight, 60000, defaultHeight)
    };
  }

  /**
   * Convert legacy grid layout `{x,y,w,minRows}` to absolute px layout.
   * @param {string} type
   * @param {Record<string, unknown>} source
   * @param {ReturnType<LayoutTools["getLayoutMetrics"]>} context
   * @param {Record<string, {minRows:number}>} moduleLibrary
   * @param {number} columns
   * @returns {{left:number,top:number,width:number,height:number}}
   */
  function normalizeLegacyGridLayout(type, source, context, moduleLibrary, columns) {
    var def = moduleLibrary[type];
    var widthCols = clampInt(source.w, 1, columns, columns);
    var x = clampInt(source.x, 1, columns - widthCols + 1, 1);
    var y = clampInt(source.y, 1, 999, 1);
    var rows = clampInt(source.minRows, 2, 120, def.minRows);
    return normalizeAbsoluteLayout(type, {
      left: (x - 1) * context.colUnit,
      top: (y - 1) * context.rowUnit,
      width: spanToWidth(widthCols, context),
      height: rowsToHeight(rows, context)
    }, context, moduleLibrary);
  }

  return {
    getGap: getGap,
    getRowSize: getRowSize,
    getColumnWidth: getColumnWidth,
    getCanvasPadding: getCanvasPadding,
    getCanvasInnerWidth: getCanvasInnerWidth,
    getLayoutMetrics: getLayoutMetrics,
    spanToWidth: spanToWidth,
    rowsToHeight: rowsToHeight,
    getMinModuleWidthPx: getMinModuleWidthPx,
    getMinModuleHeightPx: getMinModuleHeightPx,
    updateCanvasMetrics: updateCanvasMetrics,
    getModuleInlineLayoutStyle: getModuleInlineLayoutStyle,
    normalizeAbsoluteLayout: normalizeAbsoluteLayout,
    normalizeLegacyGridLayout: normalizeLegacyGridLayout
  };
}

