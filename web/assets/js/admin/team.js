/* admin/team.js — Team & roles screen. Uses window.C/Admin. Exposes window.Admin.scTeam.
   Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, attr = C.attr, CARD = A.CARD, tableHead = A.tableHead, pagerRow = A.pagerRow;

  function scTeam(v, anim) {
    var cols = "1.6fr 1.9fr .9fr 1.6fr .8fr .7fr";
    var search = '<div style="margin-bottom:14px;"><input data-change="memberSearch" value="' + attr(v.memberSearchVal) + '" placeholder="Search team members…" aria-label="Search team members" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e6ddf7;font-size:13px;font-family:\'DM Sans\';color:#2b2540;outline:none;"></div>';
    var rows = v.memberRows.map(function (mem) {
      return '<div class="bm-row" style="grid-template-columns:' + cols + ';font-size:13px;">' +
        '<div data-label="MEMBER"><div style="display:flex;align-items:center;gap:10px;"><div style="width:34px;height:34px;border-radius:50%;flex:none;background:linear-gradient(135deg,#8a6bff,#ff77a9);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">' + esc(mem.initials) + '</div><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(mem.name) + "</span></div></div>" +
        '<div data-label="EMAIL" style="color:#6b6486;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(mem.email) + "</div>" +
        '<div data-label="ROLE">' + C.roleBadge(mem.role) + "</div>" +
        '<div data-label="ASSIGNED QUIZZES" style="color:#6b6486;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(mem.assigned) + "</div>" +
        '<div data-label="STATUS">' + C.statusMemberBadge(mem.status) + "</div>" +
        '<div data-label="ACTIONS" style="display:flex;gap:4px;justify-content:flex-end;">' + C.iconBtn("✎", { action: "openEditMember", id: mem.id }, "Edit") + (mem.canRemove ? C.iconBtn("🗑", { action: "removeMember", id: mem.id }, "Remove") : "") + "</div></div>";
    }).join("");
    return '<div class="' + (anim || "") + '">' + search +
      '<div style="' + CARD + 'overflow:hidden;margin-bottom:16px;">' + tableHead(["MEMBER", "EMAIL", "ROLE", "ASSIGNED QUIZZES", "STATUS", "ACTIONS"], cols) + '<div class="block p-3 md:p-0" style="height:300px;overflow-y:auto;">' + (v.memberSearching ? C.spinner() : rows) + "</div>" +
      (v.noMembers ? '<div style="padding:40px 20px;text-align:center;color:#9a93b8;font-size:14px;">No team members yet — click <b style="color:#7c5cff;">+ Invite member</b> to add one.</div>' : "") +
      pagerRow(v.memberPager, "memberPage") + "</div>" +
      '<div style="' + CARD + 'padding:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:4px;">Roles &amp; permissions</div><div style="font-size:12px;color:#9a93b8;margin-bottom:14px;">Roles set sensible defaults — fine-tune any member\'s access per feature when you edit them.</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">' + v.roleLegend.map(function (r) { return '<div style="border:1px solid #f0eef7;border-radius:12px;padding:14px;">' + C.roleBadge(r.role) + '<div style="margin-top:8px;font-size:12px;color:#6b6486;line-height:1.45;">' + esc(r.desc) + "</div></div>"; }).join("") + "</div></div></div>";
  }

  A.scTeam = scTeam;
})();
