/* admin/submissions.js — Submissions screen (global + scoped-to-workspace). Uses window.C/Admin.
   Exposes window.Admin.scSubmissions. Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, attr = C.attr, CARD = A.CARD, tableHead = A.tableHead, pagerRow = A.pagerRow;

  function scSubmissions(v, anim) {
    var cols = "1.1fr 1.6fr 1.2fr 1fr .8fr .7fr";
    var filter = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">' +
      (v.showSubFilter ? '<select data-change="subFilter" aria-label="Filter by quiz" style="padding:10px 12px;border-radius:10px;border:1.5px solid #e6ddf7;font-size:13px;font-family:\'DM Sans\';color:#2b2540;background:#fff;outline:none;">' + v.subFilterQuizzes.map(function (o) { return '<option value="' + attr(o.value) + '"' + (String(o.value) === String(v.subQuizFilterVal) ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") + "</select>" : "") +
      '<input data-change="subSearch" value="' + attr(v.subSearchVal) + '" placeholder="Search name or email…" aria-label="Search submissions" style="flex:1;min-width:180px;padding:10px 12px;border-radius:10px;border:1.5px solid #e6ddf7;font-size:13px;font-family:\'DM Sans\';color:#2b2540;outline:none;">' +
      "</div>";
    var rows = v.subRows.map(function (sub) {
      return '<div class="bm-row" style="grid-template-columns:' + cols + ';font-size:13px;">' +
        '<div data-label="NAME" style="font-weight:600;">' + esc(sub.name) + "</div>" +
        '<div data-label="EMAIL" style="color:#6b6486;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(sub.email) + "</div>" +
        '<div data-label="QUIZ" style="color:#6b6486;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(sub.quizName) + "</div>" +
        '<div data-label="RESULT" style="display:flex;align-items:center;gap:7px;"><span style="width:12px;height:12px;border-radius:4px;background:' + sub.color + ';"></span><span style="font-weight:600;">' + esc(sub.result) + "</span></div>" +
        '<div data-label="DATE" style="color:#9a93b8;">' + esc(sub.date) + "</div>" +
        '<div data-label="ACTIONS" style="display:flex;gap:4px;justify-content:flex-end;">' + C.iconBtn("👁", { action: "openViewSub", id: sub.id }, "View") + C.iconBtn("🗑", { action: "deleteSubmission", id: sub.id }, "Delete") + "</div></div>";
    }).join("");
    return '<div class="' + (anim || "") + '">' + filter + '<div style="' + CARD + 'overflow:hidden;">' + tableHead(["NAME", "EMAIL", "QUIZ", "RESULT", "DATE", "ACTIONS"], cols) + '<div class="block p-3 md:p-0" style="height:570px;overflow-y:auto;">' + (v.subSearching ? C.spinner() : rows) + "</div>" +
      (v.noSubmissions ? '<div style="padding:40px 20px;text-align:center;color:#9a93b8;font-size:14px;">No submissions captured yet.</div>' : "") + pagerRow(v.subPager, "subPage") + "</div></div>";
  }

  A.scSubmissions = scSubmissions;
})();
