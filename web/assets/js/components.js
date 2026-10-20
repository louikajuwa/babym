/* components.js — shared HTML builders + escaping. Exposes window.C. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // escape for use inside a double-quoted attribute (keeps it compact)
  function attr(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  // build data-* attribute string from a map
  function data(map) {
    return Object.keys(map || {}).map(function (k) {
      return "data-" + k + '="' + attr(map[k]) + '"';
    }).join(" ");
  }

  // status pill (Active/Draft/Paused)
  function statusBadge(st) {
    var cls = st === "Active" ? "bg-[#e9f7f0] text-bm-ok"
      : st === "Draft" ? "bg-bm-surface-2 text-bm-purple"
      : "bg-[#fff3e0] text-bm-warn";
    return '<span class="inline-block text-[11px] font-bold px-[9px] py-[3px] rounded-full ' + cls + '">' + esc(st) + "</span>";
  }
  function roleBadge(role) {
    var map = {
      Owner: "bg-[#efe8ff] text-bm-purple-deep",
      Admin: "bg-[#e6f0ff] text-[#3b6fd6]",
      Editor: "bg-[#e9f7f0] text-bm-ok",
      Viewer: "bg-bm-surface-2 text-bm-muted-2",
    };
    return '<span class="inline-block text-[11px] font-bold px-[9px] py-[3px] rounded-full ' + (map[role] || map.Viewer) + '">' + esc(role) + "</span>";
  }
  function statusMemberBadge(st) {
    var cls = st === "Active" ? "bg-[#e9f7f0] text-bm-ok" : "bg-[#fff3e0] text-bm-warn";
    return '<span class="inline-block text-[11px] font-bold px-[9px] py-[3px] rounded-full ' + cls + '">' + esc(st) + "</span>";
  }

  // toggle switch button. dataMap wires the click (e.g. {action:'toggleGate'})
  function toggle(on, dataMap) {
    return '<button type="button" ' + data(dataMap) + ' aria-pressed="' + (on ? "true" : "false") +
      '" class="w-11 h-[26px] rounded-full border-0 cursor-pointer p-[3px] flex ' +
      (on ? "justify-end bg-bm-purple" : "justify-start bg-[#d5cfe6]") + '">' +
      '<span class="w-5 h-5 rounded-full bg-white block shadow-[0_1px_3px_rgba(0,0,0,.25)]"></span></button>';
  }

  // small icon action button
  function iconBtn(icon, dataMap, title) {
    return '<button type="button" class="bm-icon" ' + data(dataMap) + ' title="' + attr(title || "") + '" aria-label="' + attr(title || "") + '">' + icon + "</button>";
  }

  // pager row from Utils.buildPager output; scope names the target (e.g. quizPage) via data-pager
  function pager(buttons, pagerName) {
    return buttons.map(function (b) {
      if (b.ellipsis) return '<span class="min-w-[20px] h-8 inline-flex items-center justify-center text-bm-muted text-[13px]">…</span>';
      var base = "min-w-[32px] h-8 px-[9px] rounded-[9px] border text-[13px] font-semibold ";
      var cls = b.active ? "border-bm-purple bg-bm-purple text-white"
        : b.disabled ? "border-bm-border-2 bg-white text-[#cfc7e6] cursor-default"
        : "border-bm-border-2 bg-white text-[#5b566f] cursor-pointer";
      var attrs = (b.page && !b.disabled) ? data({ pager: pagerName, page: b.page }) : "";
      return '<button type="button" class="' + base + cls + '" ' + attrs + (b.disabled ? " disabled" : "") + ">" + esc(b.label) + "</button>";
    }).join("");
  }

  // toast into #toast
  function toast(msg) {
    var $t = window.jQuery && jQuery("#toast");
    if (!$t || !$t.length) return;
    if (!msg) { $t.empty(); return; }
    $t.html('<div class="fixed bottom-7 left-1/2 -translate-x-1/2 z-[130] bg-bm-ink text-white px-5 py-3 rounded-full text-[13px] font-semibold shadow-[0_16px_40px_-12px_rgba(0,0,0,.4)] animate-bm-fadeup">' + esc(msg) + "</div>");
  }

  // modal shell: header (title + X), body, footer. Wrapped in scrim (data-action=closeModal).
  function modalShell(title, bodyHtml, footerHtml, maxW) {
    return '<div class="fixed inset-0 z-[120] bg-[rgba(30,22,60,.45)] flex items-center justify-center p-4 animate-bm-fadeup-fast" data-action="closeModal">' +
      '<div class="bg-white rounded-3xl w-full ' + (maxW || "max-w-[440px]") + ' max-h-[90vh] overflow-y-auto shadow-[0_40px_90px_-30px_rgba(56,32,120,.55)]" role="dialog" aria-modal="true" data-stop="1">' +
      '<div class="flex items-center justify-between px-[22px] py-5 border-b border-bm-border-3">' +
      '<div class="font-display font-bold text-[18px] text-bm-ink">' + esc(title) + "</div>" +
      '<button type="button" data-action="closeModal" aria-label="Close" class="border-0 bg-bm-surface-3 w-[30px] h-[30px] rounded-[9px] text-bm-muted-2 text-base cursor-pointer">✕</button>' +
      "</div>" + bodyHtml +
      (footerHtml ? '<div class="px-[22px] py-4 border-t border-bm-border-3 flex gap-[10px] justify-end">' + footerHtml + "</div>" : "") +
      "</div></div>";
  }

  // centered loading spinner, fills its parent (use inside a fixed-height box)
  function spinner() {
    return '<div class="w-full h-full min-h-[80px] flex items-center justify-center"><div class="w-8 h-8 rounded-full border-[3px] border-bm-border-2 border-t-bm-purple animate-bm-spin" role="status" aria-label="Searching…"></div></div>';
  }

  function btnGhost(label, dataMap) {
    return '<button type="button" ' + data(dataMap) + ' class="px-[18px] py-3 rounded-[11px] border-[1.5px] border-bm-border-2 bg-white text-[#5b566f] font-semibold text-sm cursor-pointer">' + esc(label) + "</button>";
  }
  function btnPrimary(label, dataMap, disabled) {
    return '<button type="button" ' + data(dataMap) + (disabled ? " disabled" : "") +
      ' class="px-5 py-3 rounded-[11px] border-0 text-white font-bold text-sm ' +
      (disabled ? "bg-[#cfc4f5] cursor-not-allowed" : "bg-bm-purple cursor-pointer") + '">' + esc(label) + "</button>";
  }

  window.C = {
    esc: esc, attr: attr, data: data,
    statusBadge: statusBadge, roleBadge: roleBadge, statusMemberBadge: statusMemberBadge,
    toggle: toggle, iconBtn: iconBtn, pager: pager, toast: toast, modalShell: modalShell, spinner: spinner,
    btnGhost: btnGhost, btnPrimary: btnPrimary,
  };
})();
