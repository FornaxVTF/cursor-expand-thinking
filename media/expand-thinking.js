(function (global) {
  'use strict';

  var HEADER_SELECTOR = '[data-component="collapsible-header"]';
  var TARGET_SELECTOR = '.ui-thinking-collapsible, .ui-step-group-collapsible';
  var CLICK_COOLDOWN_MS = 400;

  function headerOf(root) {
    if (!root || !root.querySelector) return null;
    return root.querySelector(':scope > ' + HEADER_SELECTOR) || root.querySelector(HEADER_SELECTOR);
  }

  function actionText(root) {
    var header = headerOf(root);
    var action = header && header.querySelector('.ui-collapsible-action');
    if (action && action.textContent) return action.textContent.trim();
    var own = ((root && root.textContent) || '').trim();
    return own.length > 40 ? '' : own;
  }

  function isThinkingGroupLabel(text) {
    return text === 'Thinking' || text.indexOf('Thought') === 0;
  }

  function isTarget(root) {
    if (!root || !root.classList) return false;
    if (root.classList.contains('ui-thinking-collapsible')) return true;
    if (root.classList.contains('ui-step-group-collapsible')) return isThinkingGroupLabel(actionText(root));
    if (root.matches && root.matches('button, [role="button"]')) return isThinkingGroupLabel(actionText(root));
    return false;
  }

  function isClosed(root) {
    if (!root || !root.hasAttribute) return false;
    if (root.hasAttribute('data-open')) return false;
    if (root.hasAttribute('data-closed')) return true;
    var expanded = root.getAttribute('aria-expanded');
    if (expanded === 'false') return true;
    if (expanded === 'true') return false;
    var header = headerOf(root);
    if (!header || header === root) return false;
    var headerExpanded = header.getAttribute('aria-expanded');
    if (headerExpanded === 'false') return true;
    if (headerExpanded === 'true') return false;
    return false;
  }

  function createController(doc, options) {
    var opts = options || {};
    var now = opts.now || function () { return Date.now(); };
    var cooldownMs = opts.cooldownMs == null ? CLICK_COOLDOWN_MS : opts.cooldownMs;
    var userCollapsed = new WeakSet();
    var lastClick = new WeakMap();
    var scheduled = false;

    function expand(root) {
      if (!isTarget(root) || userCollapsed.has(root) || !isClosed(root)) return false;
      if (lastClick.has(root) && now() - lastClick.get(root) < cooldownMs) return false;
      var header = root.matches && root.matches('button, [role="button"]') ? root : headerOf(root);
      if (!header || typeof header.click !== 'function') return false;
      lastClick.set(root, now());
      header.click();
      return true;
    }

    function expandAll() {
      if (!doc.body || !doc.body.querySelectorAll) return 0;
      var nodes = doc.body.querySelectorAll(TARGET_SELECTOR);
      var clicks = 0;
      var i;
      for (i = 0; i < nodes.length; i++) {
        if (expand(nodes[i])) clicks++;
      }
      var buttons = doc.body.querySelectorAll('button, [role="button"]');
      for (i = 0; i < buttons.length; i++) {
        if (!isThinkingGroupLabel(actionText(buttons[i]))) continue;
        if (expand(buttons[i])) clicks++;
      }
      return clicks;
    }

    function onPointerDown(event) {
      var target = event && event.target;
      if (!target || !target.closest) return;
      var header = target.closest(HEADER_SELECTOR);
      if (!header) return;
      var root = header.closest('.ui-collapsible');
      if (!root || !isTarget(root)) return;
      if (isClosed(root)) userCollapsed.delete(root);
      else userCollapsed.add(root);
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        expandAll();
      }, 50);
    }

    function start() {
      if (doc.__cursorExpandThinking) return doc.__cursorExpandThinking;
      doc.__cursorExpandThinking = controller;
      doc.addEventListener('pointerdown', onPointerDown, true);
      var Observer = doc.defaultView && doc.defaultView.MutationObserver;
      if (Observer && doc.body) {
        var observer = new Observer(schedule);
        observer.observe(doc.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-open', 'data-closed'],
        });
      }
      expandAll();
      return controller;
    }

    var controller = {
      expand: expand,
      expandAll: expandAll,
      onPointerDown: onPointerDown,
      start: start,
    };
    return controller;
  }

  function installExpandThinking(doc, options) {
    var controller = createController(doc, options);
    if (doc.body) controller.start();
    else doc.addEventListener('DOMContentLoaded', function () { controller.start(); });
    return controller;
  }

  var exporting = typeof module !== 'undefined' && module.exports && typeof document === 'undefined';
  if (exporting) {
    module.exports = {
      createController: createController,
      installExpandThinking: installExpandThinking,
      isThinkingGroupLabel: isThinkingGroupLabel,
    };
  } else {
    installExpandThinking(global.document);
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
