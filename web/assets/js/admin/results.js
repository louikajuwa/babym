/* admin/results.js — Results & scoring (characters) screen. Uses window.C/Admin.
   Exposes window.Admin.scResults. Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, attr = C.attr, CARD = A.CARD;

  function scResults(v, anim) {
    var cards = v.characterCards.map(function (c) {
      var gallery = c.gallery.map(function (g) { return '<div title="' + attr(g.caption) + '" style="width:42px;height:42px;border-radius:8px;overflow:hidden;background:' + c.grad + ';display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.6);font-family:\'Fredoka\';font-weight:700;font-size:15px;">' + (g.hasPhoto ? '<img src="' + attr(g.photo) + '" alt="' + attr(g.caption) + '" style="width:100%;height:100%;object-fit:cover;">' : esc(c.initial)) + "</div>"; }).join("");
      return '<div style="' + CARD + 'overflow:hidden;"><div style="position:relative;height:76px;background:' + c.grad + ';display:flex;align-items:center;justify-content:center;font-family:\'Fredoka\';font-weight:700;font-size:26px;color:#fff;">' + esc(c.name) + '<button data-action="deleteChar" data-key="' + attr(c.key) + '" aria-label="Delete character" title="Delete character" style="position:absolute;top:8px;right:8px;width:26px;height:26px;border:none;border-radius:8px;background:rgba(0,0,0,.22);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;">🗑</button></div>' +
        '<div style="padding:14px;"><div style="display:flex;align-items:center;gap:8px;"><div style="width:16px;height:16px;border-radius:5px;background:' + c.color + ';"></div><span style="font-size:13px;font-weight:700;">' + esc(c.colorName) + '</span></div><div style="margin-top:8px;font-size:12px;color:#6b6486;line-height:1.45;height:52px;overflow:hidden;">' + esc(c.blurb) + '</div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' + gallery + '</div><div style="margin-top:8px;font-size:11px;color:#b6afce;">' + esc(c.artStatus) + '</div><button data-action="openEditChar" data-key="' + attr(c.key) + '" style="margin-top:8px;width:100%;border:1px solid #e6ddf7;background:#faf9fd;color:#7c5cff;font-size:12px;font-weight:600;padding:8px;border-radius:9px;cursor:pointer;">Edit member &amp; cards</button></div></div>';
    }).join("");
    return '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 ' + (anim || "") + '">' + cards +
      (v.noCharacters ? '<div class="sm:col-span-2 xl:col-span-3" style="padding:40px 20px;text-align:center;color:#9a93b8;font-size:14px;background:#fff;border:1px dashed #e6ddf7;border-radius:14px;">No characters yet — click <b style="color:#7c5cff;">+ New character</b> to define the first result.</div>' : "") + "</div>";
  }

  A.scResults = scResults;
})();
