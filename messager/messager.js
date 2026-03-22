// @ts-check

/**
 * @file Message bus implementation for cross-module communication.
 * @description
 * This module provides a lightweight pub/sub service used by components,
 * file_manager, render, and the app bootstrap layer.
 */

/**
 * @typedef {Record<string, unknown>} MessagePayload
 */

/**
 * @callback MessageHandler
 * @param {MessagePayload} payload - Message payload.
 * @returns {void}
 */

/**
 * @typedef {Object} Messager
 * @property {(topic: string, payload: MessagePayload) => void} publish
 * @property {(topic: string, handler: MessageHandler) => () => void} subscribe
 * @property {(topic: string, handler: MessageHandler) => () => void} once
 */

/**
 * Create a publish/subscribe message bus.
 * @returns {Messager}
 */
export function createMessager() {
  /** @type {Map<string, Set<MessageHandler>>} */
  var topicHandlers = new Map();

  /**
   * Publish message to all subscribers of one topic.
   * @param {string} topic - Topic name.
   * @param {MessagePayload} payload - Message payload.
   * @returns {void}
   */
  function publish(topic, payload) {
    var handlers = topicHandlers.get(topic);
    if (!handlers || !handlers.size) {
      return;
    }
    handlers.forEach(function (handler) {
      handler(payload);
    });
  }

  /**
   * Subscribe handler to topic.
   * @param {string} topic - Topic name.
   * @param {MessageHandler} handler - Message callback.
   * @returns {() => void} Unsubscribe function.
   */
  function subscribe(topic, handler) {
    var handlers = topicHandlers.get(topic);
    if (!handlers) {
      handlers = new Set();
      topicHandlers.set(topic, handlers);
    }
    handlers.add(handler);
    return function unsubscribe() {
      var registered = topicHandlers.get(topic);
      if (!registered) {
        return;
      }
      registered.delete(handler);
      if (!registered.size) {
        topicHandlers.delete(topic);
      }
    };
  }

  /**
   * Subscribe handler that will run only once.
   * @param {string} topic - Topic name.
   * @param {MessageHandler} handler - Message callback.
   * @returns {() => void} Unsubscribe function.
   */
  function once(topic, handler) {
    /** @type {() => void} */
    var off = function noop() {};
    off = subscribe(topic, function onMessage(payload) {
      off();
      handler(payload);
    });
    return off;
  }

  return {
    publish: publish,
    subscribe: subscribe,
    once: once
  };
}

