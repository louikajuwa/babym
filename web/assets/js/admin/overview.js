/* admin/overview.js — Workspace Overview screen. Uses window.Admin. Exposes window.Admin.scOverview.
   Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, CARD = A.CARD;

  function scOverview(v, anim) {
    var qr = '<div style="margin:0 auto;width:150px;height:150px;border-radius:12px;background:#2b2540;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(7,1fr);gap:2px;padding:12px;">' +
      v.qrCells.map(function (on) { return '<div style="border-radius:1px;background:' + (on ? "#fff" : "transparent") + ';"></div>'; }).join("") + "</div>";
    return '<div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 ' + (anim || "") + '">' +
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' + v.overviewStats.map(function (s) { return '<div style="' + CARD + 'padding:16px;"><div style="font-size:12px;color:#9a93b8;font-weight:600;">' + esc(s.label) + '</div><div style="font-family:\'Fredoka\';font-weight:700;font-size:24px;margin-top:4px;">' + esc(s.value) + "</div></div>"; }).join("") + "</div>" +
        '<div style="' + CARD + 'padding:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:12px;">This quiz at a glance</div><div style="display:flex;flex-direction:column;gap:10px;font-size:13px;color:#6b6486;">' +
        [["Questions", v.overviewQ], ["Members", v.overviewC], ["Photo cards", v.overviewCards],
          ["Images per member", v.matrixConfigured ? (v.clothingSetSize + " outfits × " + v.poseSetSize + " poses = " + v.imagesPerMember) : "Not configured"],
          ["Lead-capture gate", v.overviewGate], ["Consent", v.overviewEsign]].map(function (r) { return '<div style="display:flex;justify-content:space-between;"><span>' + esc(r[0]) + '</span><b style="color:#2b2540;">' + esc(r[1]) + "</b></div>"; }).join("") + "</div></div>" +
      "</div>" +
      '<div style="' + CARD + 'padding:18px;height:fit-content;"><div style="font-size:13px;font-weight:700;margin-bottom:12px;">Public link & QR</div><div style="font-size:12.5px;color:#7c5cff;font-weight:600;word-break:break-all;margin-bottom:12px;">' + esc(v.workspaceUrl) + "</div>" + qr +
      '<button data-action="downloadQR" style="margin-top:14px;width:100%;border:1px solid #e6ddf7;background:#faf9fd;color:#7c5cff;font-size:12px;font-weight:600;padding:9px;border-radius:9px;cursor:pointer;">⬇ Download QR (PNG)</button>' +
      '<button data-action="previewAsFan" style="margin-top:8px;width:100%;border:none;background:#7c5cff;color:#fff;font-size:12px;font-weight:700;padding:10px;border-radius:9px;cursor:pointer;">▶ Preview as fan</button></div></div>';
  }

  A.scOverview = scOverview;
})();
