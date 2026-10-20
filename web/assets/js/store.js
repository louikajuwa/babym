/* store.js — tiny state store + rAF-debounced render loop. Exposes window.Store. */
(function () {
  "use strict";

  var state = {};
  var renderFn = null;
  var scheduled = false;

  function scheduleRender() {
    if (scheduled || !renderFn) return;
    scheduled = true;
    (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
      scheduled = false;
      try { renderFn(state); } catch (e) { console.error("[render]", e); }
    });
  }

  function init(initialState, fn) {
    state = initialState || {};
    renderFn = fn || null;
    scheduleRender();
    return state;
  }

  // merge a shallow patch; opts.silent skips re-render (used for keystroke-level updates)
  function setState(patch, opts) {
    Object.assign(state, patch || {});
    if (!(opts && opts.silent)) scheduleRender();
  }

  // write a dotted path (e.g. "form.email", "modal.form.range") without re-render unless asked
  function setPath(path, value, opts) {
    var parts = String(path).split(".");
    var node = state;
    for (var i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] == null || typeof node[parts[i]] !== "object") node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    if (!(opts && opts.silent)) scheduleRender();
  }

  function get() { return state; }

  window.Store = { init: init, setState: setState, setPath: setPath, get: get, render: scheduleRender };
})();
