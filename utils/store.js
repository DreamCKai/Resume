// @ts-check

/**
 * @file Minimal immutable store powered by reducer.
 */

/**
 * @typedef {{type: string, payload: Record<string, unknown>}} StoreAction
 */

/**
 * Create state store.
 * @param {{
 *   initialState: any,
 *   reducer: (state: any, action: StoreAction) => any,
 *   messager: {publish: (topic: string, payload: Record<string, unknown>) => void}
 * }} options
 */
export function createStore(options) {
  var state = options.initialState;
  var reducer = options.reducer;
  var messager = options.messager;

  /**
   * Read current state.
   * @returns {any}
   */
  function getState() {
    return state;
  }

  /**
   * Dispatch one action into reducer.
   * @param {StoreAction} action
   * @returns {void}
   */
  function dispatch(action) {
    var prevState = state;
    var nextState = reducer(state, action);
    if (nextState === prevState) {
      return;
    }
    state = nextState;
    messager.publish("state:changed", {
      state: nextState,
      prevState: prevState,
      action: action
    });
  }

  return {
    getState: getState,
    dispatch: dispatch
  };
}

