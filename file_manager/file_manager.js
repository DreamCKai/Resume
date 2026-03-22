// @ts-check

import { asText, downloadFile } from "../utils/helpers.js";

/**
 * @file File manager for import/export/local persistence.
 */

/**
 * Create file manager runtime.
 * @param {{
 *   messager: {subscribe: (topic: string, handler: (payload: any) => void) => () => void, publish: (topic: string, payload: Record<string, unknown>) => void},
 *   refs: {importUsrSaveInput: HTMLInputElement|null},
 *   storageKey: string,
 *   legacyKeys: string[],
 *   normalizeState: (raw: unknown) => any,
 *   getPersistedState: (state: any) => any,
 *   getDefaultState: () => any,
 *   syncDocTitle: (state: any) => void,
 *   getState: () => any,
 *   dispatch: (action: {type: string, payload: Record<string, unknown>}) => void
 * }} context
 */
export function createFileManager(context) {
  var messager = context.messager;
  var refs = context.refs;
  var storageKey = context.storageKey;
  var legacyKeys = context.legacyKeys;
  var normalizeState = context.normalizeState;
  var getPersistedState = context.getPersistedState;
  var getDefaultState = context.getDefaultState;
  var syncDocTitle = context.syncDocTitle;
  var getState = context.getState;
  var dispatch = context.dispatch;

  /** @type {number} */
  var saveTimer = 0;
  /** @type {Array<() => void>} */
  var offList = [];

  /**
   * Update browser tab title from app state.
   * @param {any} state
   * @returns {void}
   */
  function updateDocumentTitle(state) {
    document.title = state.meta.docTitle || "Resume";
  }

  /**
   * Publish runtime status update.
   * @param {string} message
   * @param {""|"ok"|"warn"} tone
   * @returns {void}
   */
  function setStatus(message, tone) {
    dispatch({
      type: "runtime/set-status",
      payload: { message: message, tone: tone }
    });
  }

  /**
   * Read embedded state from html script tag.
   * @returns {any|null}
   */
  function readEmbeddedState() {
    var script = document.getElementById("embedded-resume-state");
    var text = script ? script.textContent.trim() : "";
    if (!text || text === "null") {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  /**
   * Load initial state from embedded, storage, or defaults.
   * @returns {any}
   */
  function loadInitialState() {
    var embedded = readEmbeddedState();
    if (embedded) {
      return normalizeState(embedded);
    }

    try {
      var fresh = window.localStorage.getItem(storageKey);
      if (fresh) {
        return normalizeState(JSON.parse(fresh));
      }
    } catch (error) {
    }

    for (var i = 0; i < legacyKeys.length; i += 1) {
      try {
        var legacy = window.localStorage.getItem(legacyKeys[i]);
        if (legacy) {
          return normalizeState(JSON.parse(legacy));
        }
      } catch (error) {
      }
    }

    return getDefaultState();
  }

  /**
   * Persist state immediately.
   * @param {string=} message
   * @param {""|"ok"|"warn"=} tone
   * @returns {void}
   */
  function saveNow(message, tone) {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }
    var state = getState();
    syncDocTitle(state);
    updateDocumentTitle(state);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(getPersistedState(state)));
      setStatus(message || "已保存", tone || "ok");
    } catch (error) {
      setStatus("本地保存失败，请及时导出 JSON 备份。", "warn");
    }
  }

  /**
   * Schedule delayed autosave.
   * @param {string=} message
   * @returns {void}
   */
  function scheduleSave(message) {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }
    setStatus(message || "编辑中", "");
    saveTimer = window.setTimeout(function () {
      saveNow("已自动保存", "ok");
    }, 260);
  }

  /**
   * Stringify state for html embed.
   * @param {any} value
   * @returns {string}
   */
  function stringifyStateForEmbed(value) {
    return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
  }

  /**
   * Handle import file.
   * @param {File} file
   * @returns {void}
   */
  function importUsrSaveFile(file) {
    var reader = new FileReader();
    reader.onload = function onload() {
      try {
        var next = normalizeState(JSON.parse(String(reader.result || "")));
        dispatch({ type: "state/replace", payload: { state: next } });
        setStatus("已导入 JSON", "ok");
      } catch (error) {
        setStatus("JSON 导入失败", "warn");
      }
    };
    reader.onerror = function onerror() {
      setStatus("文件读取失败", "warn");
    };
    reader.readAsText(file, "utf-8");
  }

  /**
   * Export state as JSON file.
   * @returns {void}
   */
  function exportJson() {
    var state = getState();
    syncDocTitle(state);
    updateDocumentTitle(state);
    var payload = getPersistedState(state);
    downloadFile((state.meta.docTitle || "Resume") + ".json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setStatus("已导出 JSON", "ok");
  }

  /**
   * Export editable html bundle.
   * @returns {void}
   */
  function exportHtml() {
    var state = getState();
    syncDocTitle(state);
    updateDocumentTitle(state);
    var payload = getPersistedState(state);
    var embedded = document.getElementById("embedded-resume-state");
    var previous = embedded ? embedded.textContent : "";
    if (embedded) {
      embedded.textContent = stringifyStateForEmbed(payload);
    }
    var html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    if (embedded) {
      embedded.textContent = previous;
    }
    downloadFile((state.meta.docTitle || "Resume") + ".html", html, "text/html;charset=utf-8");
    setStatus("已导出可继续编辑的 HTML", "ok");
  }

  /**
   * Reset app to default state and clear storage.
   * @returns {void}
   */
  function clearDraft() {
    if (!window.confirm("确定清空当前草稿并恢复默认模板吗？")) {
      return;
    }
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
    }
    dispatch({
      type: "state/replace",
      payload: { state: getDefaultState() }
    });
    setStatus("已清空草稿", "ok");
  }

  /**
   * Handle command requests owned by file_manager.
   * @param {{type: string, payload: Record<string, unknown>}} message
   * @returns {void}
   */
  function handleCommandRequest(message) {
    var type = message.type;
    if (type === "file/import-json") {
      if (refs.importUsrSaveInput) {
        refs.importUsrSaveInput.click();
      }
      return;
    }
    if (type === "file/export-json") {
      exportJson();
      return;
    }
    if (type === "file/export-html") {
      exportHtml();
      return;
    }
    if (type === "file/print") {
      window.alert("打印前请关闭浏览器“页眉和页脚”，避免出现日期和标题那一行。");
      window.print();
      return;
    }
    if (type === "file/clear-draft") {
      clearDraft();
    }
  }

  /**
   * Bind browser events and message subscriptions.
   * @returns {void}
   */
  function bindInput() {
    if (refs.importUsrSaveInput) {
      refs.importUsrSaveInput.addEventListener("change", function onInputChange(event) {
        var target = /** @type {HTMLInputElement} */ (event.target);
        var file = target.files && target.files[0];
        if (!file) {
          return;
        }
        importUsrSaveFile(file);
        target.value = "";
      });
    }

    offList.push(messager.subscribe("command:request", handleCommandRequest));
    offList.push(messager.subscribe("state:changed", function onStateChanged(payload) {
      var actionType = asText(payload.action && payload.action.type);
      if (actionType === "runtime/set-status") {
        return;
      }
      if (actionType === "state/replace") {
        saveNow("已保存", "ok");
        return;
      }
      scheduleSave("编辑中");
    }));
  }

  /**
   * Remove subscriptions and pending timer.
   * @returns {void}
   */
  function destroy() {
    offList.forEach(function (off) {
      off();
    });
    offList = [];
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }
  }

  return {
    loadInitialState: loadInitialState,
    bindInput: bindInput,
    scheduleSave: scheduleSave,
    saveNow: saveNow,
    destroy: destroy
  };
}

