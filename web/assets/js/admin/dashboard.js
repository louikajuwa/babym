/* admin/dashboard.js — Dashboard screen. Uses window.C/Utils/Admin. Exposes window.Admin.scDashboard.
   Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, attr = C.attr, CARD = A.CARD;

  function scDashboard(v, anim) {
    return '<div class="' + (anim || "") + '">' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">' + v.statCards.map(function (s) {
        return '<div style="' + CARD + 'padding:18px;"><div style="font-size:12px;color:#9a93b8;font-weight:600;">' + esc(s.label) + '</div><div style="font-family:\'Fredoka\';font-weight:700;font-size:28px;color:#2b2540;margin-top:4px;">' + esc(s.value) + '</div><div style="font-size:12px;font-weight:600;color:#22a06b;margin-top:2px;">' + esc(s.delta) + "</div></div>";
      }).join("") + "</div>" +
      '<div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mt-4">' +
        '<div style="' + CARD + 'padding:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:2px;">Attempts — last 14 days</div><div style="font-size:11px;color:#b6afce;margin-bottom:14px;">Quiz starts per day, all quizzes</div>' +
        '<div style="display:flex;align-items:flex-end;gap:5px;height:140px;">' + v.trendBars.map(function (t) { return '<div title="' + attr(t.value) + '" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px;"><div style="width:100%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#8a6bff,#c3b0ff);height:' + t.height + ';"></div><div style="font-size:9px;color:#b6afce;">' + esc(t.label) + "</div></div>"; }).join("") + "</div></div>" +
        '<div style="' + CARD + 'padding:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:12px;">Recent activity</div>' +
        (v.recentActivity.length ? '<div style="display:flex;flex-direction:column;gap:12px;">' + v.recentActivity.map(function (a) { return '<div style="display:flex;align-items:center;gap:10px;"><span style="width:10px;height:10px;border-radius:3px;background:' + a.color + ';flex:none;"></span><div style="flex:1;min-width:0;"><div style="font-size:12.5px;color:#2b2540;"><b>' + esc(a.name) + "</b> matched <b>" + esc(a.result) + '</b></div><div style="font-size:11px;color:#9a93b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(a.quiz) + " · " + esc(a.date) + "</div></div></div>"; }).join("") + "</div>" : "") + "</div>" +
      "</div>" +
      '<div style="' + CARD + 'padding:20px;margin-top:16px;"><div style="font-size:14px;font-weight:700;margin-bottom:14px;">Top quizzes by finishers</div><div style="display:flex;flex-direction:column;gap:12px;">' +
        v.topQuizzes.map(function (q) { return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><button data-action="openWorkspace" data-id="' + q.id + '" style="border:none;background:none;padding:0;cursor:pointer;width:170px;max-width:45%;text-align:left;font-size:13px;font-weight:600;color:#2b2540;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(q.name) + '</button><div style="flex:1;min-width:80px;height:14px;border-radius:7px;background:#f2eefc;overflow:hidden;"><div style="height:100%;border-radius:7px;background:linear-gradient(90deg,#8a6bff,#ff9bc0);width:' + q.comp + ';"></div></div><div style="width:42px;text-align:right;font-size:12px;color:#9a93b8;">' + esc(q.comp) + '</div><div style="width:66px;text-align:right;font-size:13px;font-weight:700;color:#2b2540;">' + esc(q.finishers) + "</div>" + C.statusBadge(q.status) + "</div>"; }).join("") + "</div></div>" +
      '<div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mt-4">' +
        '<div style="' + CARD + 'padding:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:4px;">Conversion funnel</div><div style="font-size:11px;color:#b6afce;margin-bottom:14px;">Sample traffic across all quizzes</div>' +
        v.funnel.map(function (f) { return '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;"><span style="color:#6b6486;font-weight:600;">' + esc(f.label) + '</span><span style="color:#9a93b8;">' + esc(f.value) + '</span></div><div style="height:22px;border-radius:7px;background:#f2eefc;overflow:hidden;"><div style="height:100%;border-radius:7px;background:' + f.color + ";width:" + f.width + ';"></div></div></div>'; }).join("") + "</div>" +
        '<div style="' + CARD + 'padding:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:4px;">Result distribution</div><div style="font-size:11px;color:#b6afce;margin-bottom:14px;">Derived from ' + v.submissionCount + " submissions</div>" +
        (v.resultDist.length ? v.resultDist.map(function (r) { return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px;"><div style="width:62px;font-size:12px;font-weight:700;color:#2b2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(r.name) + '</div><div style="flex:1;height:12px;border-radius:6px;background:#f2eefc;overflow:hidden;"><div style="height:100%;border-radius:6px;background:' + r.color + ";width:" + r.width + ';"></div></div><div style="width:34px;text-align:right;font-size:12px;color:#9a93b8;">' + esc(r.pct) + "</div></div>"; }).join("") : '<div style="font-size:12px;color:#9a93b8;padding:8px 0;">No submissions yet.</div>') + "</div>" +
      "</div></div>";
  }

  A.scDashboard = scDashboard;
})();
