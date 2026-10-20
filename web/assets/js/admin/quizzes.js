/* admin/quizzes.js — Quizzes list screen. Uses window.C/Utils/Admin. Exposes window.Admin.scQuizzes.
   Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, attr = C.attr, CARD = A.CARD, tableHead = A.tableHead, pagerRow = A.pagerRow;

  function scQuizzes(v, anim) {
    var cols = "2.4fr 1.4fr 1fr .9fr 1.1fr";
    var search = '<div style="margin-bottom:14px;"><input data-change="quizSearch" value="' + attr(v.quizSearchVal) + '" placeholder="Search quizzes…" aria-label="Search quizzes" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e6ddf7;font-size:13px;font-family:\'DM Sans\';color:#2b2540;outline:none;"></div>';
    var rows = v.quizRows.map(function (q) {
      return '<div class="bm-row" style="grid-template-columns:' + cols + ';">' +
        '<div data-label="QUIZ"><div style="display:flex;align-items:center;gap:12px;"><button data-action="openWorkspace" data-id="' + q.id + '" aria-label="Open quiz workspace" style="border:none;cursor:pointer;flex:none;width:40px;height:40px;border-radius:8px;background:#2b2540;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:1px;padding:4px;">' + [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1].map(function (on) { return "<div" + (on ? ' style="background:#fff;"' : "") + "></div>"; }).join("") + '</button><div><button data-action="openWorkspace" data-id="' + q.id + '" style="border:none;background:none;padding:0;cursor:pointer;font-size:14px;font-weight:600;color:#2b2540;text-align:left;">' + esc(q.name) + '</button><div style="font-size:12px;color:#9a93b8;">' + esc(q.qcount) + "</div></div></div></div>" +
        '<div data-label="PUBLIC URL" style="font-size:12.5px;color:#7c5cff;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(q.url) + "</div>" +
        '<div data-label="FINISHERS" style="font-size:13px;font-weight:600;">' + esc(q.finishers) + "</div>" +
        '<div data-label="STATUS">' + C.statusBadge(q.status) + "</div>" +
        '<div data-label="ACTIONS" style="display:flex;gap:4px;justify-content:flex-end;">' + C.iconBtn("↗", { action: "openWorkspace", id: q.id }, "Open") + C.iconBtn("⧉", { action: "duplicateQuiz", id: q.id }, "Duplicate") + C.iconBtn("✏️", { action: "openEditQuiz", id: q.id }, "Edit") + C.iconBtn("🗑", { action: "deleteQuiz", id: q.id }, "Delete") + "</div></div>";
    }).join("");
    return '<div class="' + (anim || "") + '">' + search + '<div style="' + CARD + 'overflow:hidden;">' + tableHead(["QUIZ", "PUBLIC URL", "FINISHERS", "STATUS", "ACTIONS"], cols) +
      '<div class="block p-3 md:p-0" style="height:340px;overflow-y:auto;">' + (v.quizSearching ? C.spinner() : rows) + "</div>" +
      (v.noQuizzes ? '<div style="padding:40px 20px;text-align:center;color:#9a93b8;font-size:14px;">No quizzes yet — click <b style="color:#7c5cff;">+ New quiz</b> to create your first campaign.</div>' : "") +
      pagerRow(v.quizPager, "quizPage") + "</div></div>";
  }

  A.scQuizzes = scQuizzes;
})();
