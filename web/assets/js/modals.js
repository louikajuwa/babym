/* modals.js — admin modal system (ported from BABYM Quiz.dc.html lines 1056-1453 + modalView 2786-2849).
   Pure view-builders. Exposes window.Modals.render(state) + window.Modals.view(state).
   All handlers live in admin.js's delegated dispatch (data-action / data-change). */
(function () {
  "use strict";
  var D = window.Data, U = window.Utils, C = window.C;
  var esc = C.esc, attr = C.attr;

  var INP = "margin-top:6px;width:100%;padding:12px 14px;border-radius:11px;border:1.5px solid #e6ddf7;font-size:14px;font-family:'DM Sans';color:#2b2540;outline:none;";
  var LBL = "font-size:12px;font-weight:600;color:#6b6486;";

  function activeQuiz(s) { return s.quizzes.filter(function (q) { return q.id === s.activeQuizId; })[0] || null; }
  function quizNameMap(s) { var m = {}; s.quizzes.forEach(function (q) { m[q.id] = q.name; }); return m; }

  function wrap(inner, maxW, isNew) {
    var scrimAnim = isNew ? " animate-bm-fadeup-fast" : "";
    var cardAnim = isNew ? " animate-bm-pop" : "";
    return '<div data-action="scrimClose" class="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-5' + scrimAnim + '" style="background:rgba(30,22,60,.42);backdrop-filter:blur(3px);">' +
      '<div data-stop="1" role="dialog" aria-modal="true" class="bg-white overflow-y-auto' + cardAnim + '" style="width:min(' + (maxW || 440) + 'px,100%);max-height:90vh;border-radius:22px;box-shadow:0 40px 90px -30px rgba(56,32,120,.6);">' +
      inner + "</div></div>";
  }
  function header(title) {
    return '<div class="flex items-center justify-between" style="padding:20px 22px;border-bottom:1px solid #f0eef7;">' +
      '<div class="font-display font-bold" style="font-size:18px;color:#2b2540;">' + esc(title) + "</div>" +
      '<button data-action="closeModal" aria-label="Close" class="border-0 cursor-pointer" style="background:#f4f2fa;width:30px;height:30px;border-radius:9px;color:#6b6486;font-size:16px;">✕</button></div>';
  }
  function footer(inner) { return '<div class="flex gap-[10px] justify-end" style="padding:16px 22px;border-top:1px solid #f0eef7;">' + inner + "</div>"; }
  function cancelBtn() { return '<button data-action="closeModal" style="padding:12px 18px;border-radius:11px;border:1.5px solid #e6ddf7;background:#fff;color:#5b566f;font-weight:600;font-size:14px;font-family:\'DM Sans\';cursor:pointer;">Cancel</button>'; }
  function submitBtn(action, label, disabled) {
    return '<button data-action="' + action + '"' + (disabled ? " disabled" : "") + ' style="padding:12px 20px;border-radius:11px;border:none;background:' + (disabled ? "#cfc4f5" : "#7c5cff") + ";color:#fff;font-weight:700;font-size:14px;font-family:'DM Sans';cursor:" + (disabled ? "not-allowed" : "pointer") + ';">' + esc(label) + "</button>";
  }
  function tin(field, val, ph, extra, type) {
    return '<input data-change="mf" data-field="' + field + '" type="' + (type || "text") + '" value="' + attr(val == null ? "" : val) + '"' + (ph ? ' placeholder="' + attr(ph) + '"' : "") + ' style="' + INP + (extra || "") + '">';
  }
  function selField(field, value, options, change) {
    return '<select data-change="' + (change || "mf") + '" data-field="' + field + '" style="' + INP + 'background:#fff;">' +
      options.map(function (o) { return '<option value="' + attr(o[0]) + '"' + (String(o[0]) === String(value) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
  }
  function rangeBtns(range, action) {
    return [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Custom"]].map(function (o) {
      var active = range === o[0];
      return '<button data-action="setRange" data-key="' + o[0] + '" style="flex:1;border:1.5px solid ' + (active ? "#7c5cff" : "#e6ddf7") + ";background:" + (active ? "#7c5cff" : "#fff") + ";color:" + (active ? "#fff" : "#6b6486") + ";font-size:12px;font-weight:600;padding:9px 6px;border-radius:10px;cursor:pointer;font-family:'DM Sans';\">" + esc(o[1]) + "</button>";
    }).join("");
  }
  function dateInputs(form) {
    return '<div class="flex gap-3">' +
      '<label style="flex:1;' + LBL + '">From' + tin("from", form.from, "", "font-size:13px;padding:11px 12px;cursor:pointer;", "date") + "</label>" +
      '<label style="flex:1;' + LBL + '">To' + tin("to", form.to, "", "font-size:13px;padding:11px 12px;cursor:pointer;", "date") + "</label></div>";
  }
  function errAlert(msg) { return msg ? '<div role="alert" style="font-size:12px;color:#d64545;font-weight:600;">' + esc(msg) + "</div>" : ""; }

  // ---------- modalView (ports lines 2786-2849) ----------
  function computeModalView(s) {
    var m = s.modal, mv = { slugError: "" };
    if (!m) return mv;
    var aq = activeQuiz(s), qn = quizNameMap(s);
    if (m.mode === "editChar") {
      mv.previewGrad = U.gradFromColor(m.form.color);

      // Lay the member's cards out as the (outfit x pose) matrix they now are:
      // one row per outfit, one upload slot per pose within it. Each slot is a
      // fixed binding — the admin fills in "this member, this outfit, this pose".
      var dimQ = function (id) {
        if (!aq || id == null) return null;
        return aq.questions.filter(function (q) { return String(q.id) === String(id); })[0] || null;
      };
      var outfitOpts = (dimQ(aq && aq.outfitQuestionId) || {}).options || [];
      var poseOpts = (dimQ(aq && aq.poseQuestionId) || {}).options || [];
      var cards = m.form.cards || [];
      var byIdx = {};
      cards.forEach(function (cd, i) { byIdx[String(cd.outfitId) + "|" + String(cd.poseId)] = { cd: cd, idx: i }; });

      mv.matrixConfigured = outfitOpts.length > 0 && poseOpts.length > 0;
      mv.matrixSummary = mv.matrixConfigured
        ? (outfitOpts.length + " outfits × " + poseOpts.length + " poses = " + (outfitOpts.length * poseOpts.length) + " cards")
        : "Set an outfit and a pose question in Design & share to build this member's card matrix.";
      mv.poseHeadings = poseOpts.map(function (p) { return p.label || "Pose"; });
      mv.matrixRows = outfitOpts.map(function (o) {
        return {
          label: o.label || "Outfit",
          slots: poseOpts.map(function (p) {
            var hit = byIdx[String(o.id) + "|" + String(p.id)];
            var cd = hit ? hit.cd : null;
            return {
              idx: hit ? hit.idx : -1,
              missing: !hit,
              poseLabel: p.label || "Pose",
              photo: cd && cd.photo ? cd.photo : "",
              hasPhoto: !!(cd && cd.photo),
              photoLabel: (cd && cd.photo) ? "Replace" : "Upload",
            };
          }),
        };
      });

      // Fallback for an unconfigured quiz: the old flat list, so the editor is
      // never empty while the dimensions are still being set up.
      mv.cardEdits = cards.map(function (cd, i) {
        return { idx: i, num: cd.caption || ("Card " + (i + 1)), caption: cd.caption || "", photo: cd.photo || "", hasPhoto: !!cd.photo, photoLabel: cd.photo ? "Replace photo" : "Upload photo" };
      });
    }
    if (m.mode === "editQuiz") {
      var desired = U.slugify(m.form.slug || m.form.name);
      var taken = s.quizzes.some(function (x) { return x.id !== m.id && x.slug === desired; });
      if (m.form.slug && U.slugify(m.form.slug) !== m.form.slug) mv.slugError = 'Will be saved as "' + desired + '".';
      else if (taken) mv.slugError = 'That URL is taken — will be saved as "' + U.uniqueSlug(desired, s.quizzes, m.id) + '".';
    }
    if (m.mode === "editQuestion") mv.isGrid = m.form.layout === "grid";
    if (m.mode === "viewSub") mv.hasConsent = (m.consent || []).length > 0;
    if (m.mode === "editMember") {
      mv.permItems = D.FEATURES().map(function (p) { return { key: p[0], label: p[1], on: !!m.form.perms[p[0]] }; });
      mv.assignLocked = m.form.role === "Owner" || m.form.role === "Admin";
      mv.assignAllOn = mv.assignLocked || !!m.form.quizzesAll;
      mv.assignQuizzes = s.quizzes.map(function (qz) { return { id: qz.id, name: qz.name, checked: mv.assignAllOn ? true : m.form.quizzes.indexOf(qz.id) !== -1 }; });
    }
    if (m.mode === "shareReport") {
      var rr = U.resolveRangeDays(m.form), factor = Math.min(1, rr.days / 90), src, fin;
      if (m.form.scope === "all") { src = U.aggregateAnalytics(s.quizzes); fin = s.quizzes.reduce(function (a, q) { return a + q.finishers; }, 0); }
      else { var qz = s.quizzes.filter(function (x) { return String(x.id) === String(m.form.scope); })[0] || s.quizzes[0]; src = qz.analytics; fin = qz.finishers; }
      var sv = Math.round(src.views * (0.3 + factor * 0.7)), sf = Math.round(fin * (0.3 + factor * 0.7));
      mv.reportScopeName = m.form.scope === "all" ? "All quizzes" : (qn[m.form.scope] || "—");
      mv.reportRangeLabel = rr.label;
      mv.reportStats = [{ label: "Page views", value: U.fmt(sv) }, { label: "Finishers", value: U.fmt(sf) }, { label: "Completion", value: Math.round((sf / Math.max(1, sv)) * 100) + "%" }];
      mv.reportIsCustom = m.form.range === "custom";
      mv.reportRangeError = (m.form.range === "custom" && !rr.valid) ? "Pick a valid date range (end date on or after the start date)." : "";
      mv.generateReportDisabled = m.form.range === "custom" && !rr.valid;
    }
    if (m.mode === "exportSubmissions") {
      var err = m.form.range === "custom" && !U.resolveRangeDays(m.form).valid;
      mv.exportScopeName = aq ? aq.name : (m.form.scope === "all" ? "All quizzes" : (qn[m.form.scope] || "—"));
      mv.exportRangeLabel = U.resolveRangeDays(m.form).label;
      mv.exportShowScope = !aq;
      mv.exportIsCustom = m.form.range === "custom";
      mv.exportRangeError = err ? "Pick a valid date range (end date on or after the start date)." : "";
      var cnt = err ? 0 : U.matchingSubmissions(m.form, s.submissions, aq).length;
      mv.exportMatchLabel = cnt + " submission" + (cnt === 1 ? "" : "s");
      mv.exportSubmitDisabled = err;
    }
    return mv;
  }

  // ---------- per-mode builders ----------
  function mConfirm(m) {
    return '<div style="padding:26px 24px 22px;">' +
      '<div style="width:52px;height:52px;border-radius:14px;background:#ffe9ef;color:#ff5c7c;display:flex;align-items:center;justify-content:center;font-size:24px;">🗑</div>' +
      '<div class="font-display font-bold" style="margin-top:16px;font-size:20px;color:#2b2540;">' + esc(m.title) + "</div>" +
      '<div style="margin-top:6px;font-size:14px;color:#6b6486;line-height:1.5;">' + esc(m.message) + "</div>" +
      (m.warn ? '<div style="margin-top:10px;font-size:13px;color:#b06a12;background:#fff3e0;border:1px solid #ffe0b8;border-radius:10px;padding:10px 12px;">' + esc(m.warn) + "</div>" : "") +
      '<div style="margin-top:22px;display:flex;gap:10px;">' +
      '<button data-action="closeModal" style="flex:1;padding:13px;border-radius:12px;border:1.5px solid #e6ddf7;background:#fff;color:#5b566f;font-weight:600;font-size:14px;font-family:\'DM Sans\';cursor:pointer;">Cancel</button>' +
      '<button data-action="confirmAction" style="flex:1;padding:13px;border-radius:12px;border:none;background:#ff5c7c;color:#fff;font-weight:700;font-size:14px;font-family:\'DM Sans\';cursor:pointer;">' + esc(m.confirmLabel) + "</button></div></div>";
  }

  function mEditQuiz(m, mv) {
    return header(m.title) +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">' +
      '<label style="' + LBL + '">Quiz name' + tin("name", m.form.name) + "</label>" +
      '<label style="' + LBL + '">Public URL' +
      '<div style="margin-top:6px;display:flex;align-items:center;border:1.5px solid #e6ddf7;border-radius:11px;overflow:hidden;">' +
      '<span style="padding:12px 4px 12px 14px;font-size:14px;color:#9a93b8;font-family:ui-monospace,monospace;">babym.link/</span>' +
      '<input data-change="mf" data-field="slug" value="' + attr(m.form.slug) + '" style="flex:1;padding:12px 14px 12px 0;border:none;font-size:14px;font-family:ui-monospace,monospace;color:#2b2540;outline:none;"></div></label>' +
      (mv.slugError ? '<div role="alert" style="font-size:12px;color:#d64545;font-weight:600;margin-top:-4px;">' + esc(mv.slugError) + "</div>" : "") +
      '<label style="' + LBL + '">Status' + selField("status", m.form.status, [["Active", "Active"], ["Draft", "Draft"], ["Paused", "Paused"]]) + "</label>" +
      "</div>" + footer(cancelBtn() + submitBtn("saveQuiz", m.saveLabel));
  }

  function mEditChar(m, mv) {
    var slotBtn = function (sl) {
      if (sl.missing) {
        return '<div style="height:84px;border:2px dashed #eee6f7;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#c9c2dd;">—</div>';
      }
      return '<button data-action="cardUpload" data-idx="' + sl.idx + '" title="' + attr(sl.poseLabel) + '" style="width:100%;height:84px;border:2px dashed #d8cef0;border-radius:10px;background:none;cursor:pointer;overflow:hidden;padding:0;color:#9a93b8;font-size:10px;">' +
        (sl.hasPhoto ? '<img src="' + attr(sl.photo) + '" alt="" style="width:100%;height:84px;object-fit:cover;">' : "<span>⬆ " + esc(sl.photoLabel) + "</span>") + "</button>";
    };

    var cards;
    if (mv.matrixConfigured) {
      var colCount = mv.poseHeadings.length;
      var head = '<div style="display:grid;grid-template-columns:92px repeat(' + colCount + ',1fr);gap:8px;margin-bottom:6px;">' +
        '<div></div>' + mv.poseHeadings.map(function (h) {
          return '<div style="font-size:10px;font-weight:700;color:#9a93b8;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(h) + "</div>";
        }).join("") + "</div>";
      var rows = mv.matrixRows.map(function (row) {
        return '<div style="display:grid;grid-template-columns:92px repeat(' + colCount + ',1fr);gap:8px;align-items:center;margin-bottom:8px;">' +
          '<div style="font-size:11px;font-weight:700;color:#6b6486;overflow:hidden;text-overflow:ellipsis;">' + esc(row.label) + "</div>" +
          row.slots.map(slotBtn).join("") + "</div>";
      }).join("");
      cards = '<div style="overflow-x:auto;">' + head + rows + "</div>";
    } else {
      // Dimensions not set up yet — fall back to the flat list.
      cards = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' + mv.cardEdits.map(function (cd) {
        return '<div style="border:1px solid #f0eef7;border-radius:12px;padding:10px;background:#faf9fd;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><span style="font-size:11px;font-weight:700;color:#9a93b8;">' + esc(cd.num) + '</span></div>' +
          '<button data-action="cardUpload" data-idx="' + cd.idx + '" style="width:100%;height:96px;border:2px dashed #d8cef0;border-radius:10px;background:none;cursor:pointer;overflow:hidden;padding:0;color:#9a93b8;font-size:11px;">' +
          (cd.hasPhoto ? '<img src="' + attr(cd.photo) + '" alt="" style="width:100%;height:96px;object-fit:cover;">' : "<span>⬆ " + esc(cd.photoLabel) + "</span>") + "</button></div>";
      }).join("") + "</div>";
    }
    return '<div style="height:84px;background:' + mv.previewGrad + ';display:flex;align-items:center;justify-content:center;font-family:\'Fredoka\';font-weight:700;font-size:28px;color:#fff;position:relative;">' +
      esc(m.form.name) +
      '<button data-action="closeModal" aria-label="Close" style="position:absolute;top:12px;right:12px;border:none;background:rgba(0,0,0,.24);width:30px;height:30px;border-radius:9px;color:#fff;font-size:16px;cursor:pointer;">✕</button></div>' +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">' +
      '<label style="' + LBL + '">Member name' + tin("name", m.form.name) + "</label>" +
      '<div style="display:flex;gap:12px;">' +
      '<label style="flex:1;' + LBL + '">Colorway name' + tin("colorName", m.form.colorName) + "</label>" +
      '<label style="' + LBL + '">Color<input data-change="mfColor" data-field="color" value="' + attr(m.form.color) + '" type="color" style="margin-top:6px;width:52px;height:45px;padding:2px;border-radius:11px;border:1.5px solid #e6ddf7;background:#fff;cursor:pointer;"></label></div>' +
      '<label style="' + LBL + '">Result blurb<textarea data-change="mf" data-field="blurb" rows="3" style="' + INP + 'resize:vertical;line-height:1.5;">' + esc(m.form.blurb) + "</textarea></label>" +
      '<div><div style="font-size:12px;font-weight:700;color:#6b6486;">Card matrix</div><div style="font-size:11px;color:#b6afce;">' + esc(mv.matrixSummary) + ' — one image per outfit + pose. A fan who picks that outfit and that pose gets exactly this card.</div></div>' +
      cards + "</div>" + footer(cancelBtn() + submitBtn("saveChar", m.saveLabel));
  }

  function mViewSub(m, mv) {
    var portrait = m.subHasPhoto
      ? '<img src="' + attr(m.subPhoto) + '" alt="' + attr(m.sub.result) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
      : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:\'Fredoka\';font-weight:700;font-size:58px;color:rgba(255,255,255,.32);">' + esc(m.subInitial) + "</div>";
    var rows = [["Matched member", m.sub.result, 700], ["Card colorway", m.subColorName, 600], ["Completed", m.sub.date, 600], ["Source", m.subSource, 600]].map(function (r) {
      return '<div style="display:flex;justify-content:space-between;padding:12px 14px;background:#fff;font-size:13px;"><span style="color:#9a93b8;">' + esc(r[0]) + '</span><span style="font-weight:' + r[2] + ';color:#2b2540;">' + esc(r[1]) + "</span></div>";
    }).join("");
    var consent = mv.hasConsent ? '<div style="margin-top:14px;font-size:12px;font-weight:700;color:#6b6486;">Consent recorded</div><div style="margin-top:6px;display:flex;flex-direction:column;gap:6px;">' +
      (m.consent || []).map(function (c) { return '<div style="font-size:12px;color:#4a4463;display:flex;gap:6px;align-items:flex-start;"><span style="color:#22a06b;">✓</span><span>' + esc(c) + "</span></div>"; }).join("") + "</div>" : "";
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #f0eef7;"><div class="font-display font-bold" style="font-size:18px;color:#2b2540;">Submission detail</div>' +
      '<button data-action="closeModal" aria-label="Close" style="border:none;background:#f4f2fa;width:30px;height:30px;border-radius:9px;color:#6b6486;font-size:16px;cursor:pointer;">✕</button></div>' +
      '<div style="padding:22px;">' +
      '<div style="display:flex;align-items:center;gap:14px;"><div style="width:56px;height:56px;border-radius:14px;background:' + m.subGrad + ';display:flex;align-items:center;justify-content:center;font-family:\'Fredoka\';font-weight:700;font-size:22px;color:#fff;">' + esc(m.subInitial) + "</div>" +
      '<div><div class="font-display font-bold" style="font-size:20px;color:#2b2540;">' + esc(m.sub.name) + '</div><div style="font-size:13px;color:#9a93b8;">' + esc(m.sub.email) + "</div></div></div>" +
      '<div style="margin-top:16px;font-size:12px;font-weight:700;color:#6b6486;">Card generated</div>' +
      '<div style="margin-top:8px;position:relative;border-radius:18px;overflow:hidden;background:' + m.subGrad + ';padding:16px 16px 18px;box-shadow:0 18px 40px -20px rgba(56,32,120,.55);">' +
      '<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 11px,transparent 11px 22px);pointer-events:none;"></div>' +
      '<div style="position:relative;text-align:center;color:#fff;"><div style="font-size:9px;font-weight:700;letter-spacing:2px;opacity:.9;">BABYM MATCH</div>' +
      '<div style="font-family:\'Fredoka\';font-weight:700;font-size:30px;line-height:1;margin-top:2px;text-shadow:0 2px 0 rgba(0,0,0,.12);">' + esc(m.sub.result) + "</div></div>" +
      '<div style="position:relative;margin:12px auto 0;width:120px;height:128px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.4);">' +
      '<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 8px,transparent 8px 16px);"></div>' + portrait +
      '<div style="position:absolute;left:0;right:0;bottom:7px;text-align:center;font-family:ui-monospace,monospace;font-size:8px;letter-spacing:1.5px;color:rgba(255,255,255,.85);">' + esc(m.subArtLabel) + "</div></div>" +
      '<div style="position:relative;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:7px;"><div style="width:16px;height:16px;border-radius:5px;background:' + m.subColor + ';border:2px solid rgba(255,255,255,.85);"></div>' +
      '<div style="font-family:\'Fredoka\';font-weight:700;font-size:14px;color:#fff;">' + esc(m.subColorName) + "</div></div></div>" +
      '<div style="margin-top:18px;display:flex;flex-direction:column;gap:1px;background:#f0eef7;border-radius:12px;overflow:hidden;border:1px solid #f0eef7;">' + rows + "</div>" + consent + "</div>" +
      '<div style="padding:16px 22px;border-top:1px solid #f0eef7;display:flex;gap:10px;justify-content:space-between;">' +
      '<button data-action="deleteFromView" style="padding:12px 18px;border-radius:11px;border:1.5px solid #ffd7e0;background:#fff;color:#ff5c7c;font-weight:600;font-size:14px;font-family:\'DM Sans\';cursor:pointer;">🗑 Delete</button>' +
      '<button data-action="closeModal" style="padding:12px 20px;border-radius:11px;border:none;background:#7c5cff;color:#fff;font-weight:700;font-size:14px;font-family:\'DM Sans\';cursor:pointer;">Close</button></div>';
  }

  function mEditQuestion(m, mv) {
    return header(m.title) +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">' +
      '<label style="' + LBL + '">Question title' + tin("title", m.form.title, "e.g. What's your ideal weekend?") + "</label>" +
      '<label style="' + LBL + '">Helper text' + tin("sub", m.form.sub, "Short prompt under the title") + "</label>" +
      '<label style="' + LBL + '">Answer layout' + selField("layout", m.form.layout, [["list", "List (text rows)"], ["grid", "Grid (image cards)"]]) + "</label>" +
      (mv.isGrid ? '<div style="font-size:11px;color:#b6afce;">Grid answers use uploaded answer images — add them per answer in the builder.</div>' : "") +
      "</div>" + footer(cancelBtn() + submitBtn("saveQuestion", m.saveLabel));
  }

  function mEditMember(m, mv) {
    var perms = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;">' + mv.permItems.map(function (p) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><span style="font-size:12.5px;color:#4a4463;">' + esc(p.label) + "</span>" +
        C.toggle(p.on, { action: "togglePerm", key: p.key }) + "</div>";
    }).join("") + "</div>";
    var assign = mv.assignAllOn
      ? '<div style="font-size:12px;color:#9a93b8;background:#faf9fd;border:1px solid #f0eef7;border-radius:10px;padding:12px;">Access to every quiz, including ones created later.</div>'
      : '<div style="display:flex;flex-direction:column;gap:7px;max-height:160px;overflow-y:auto;">' + mv.assignQuizzes.map(function (qz) {
        return '<label style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#faf9fd;border:1px solid #f0eef7;border-radius:10px;cursor:pointer;font-size:13px;color:#4a4463;">' +
          '<input type="checkbox" data-change="assignQuiz" data-id="' + attr(qz.id) + '"' + (qz.checked ? " checked" : "") + ' style="accent-color:#7c5cff;cursor:pointer;">' + esc(qz.name) + "</label>";
      }).join("") + "</div>";
    return header(m.title) +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:14px;">' +
      '<label style="' + LBL + '">Full name' + tin("name", m.form.name, "Jane Doe") + "</label>" +
      '<label style="' + LBL + '">Email<input data-change="mf" data-field="email" type="email" value="' + attr(m.form.email) + '" placeholder="name@company.com" style="' + INP + '"></label>' +
      '<div style="display:flex;gap:12px;">' +
      '<label style="flex:1;' + LBL + '">Role' + selField("role", m.form.role, [["Owner", "Owner"], ["Admin", "Admin"], ["Editor", "Editor"], ["Viewer", "Viewer"]], "mfRole") + "</label>" +
      '<label style="flex:1;' + LBL + '">Status' + selField("status", m.form.status, [["Active", "Active"], ["Invited", "Invited"]]) + "</label></div>" +
      '<div style="border-top:1px solid #f0eef7;padding-top:14px;"><div style="font-size:12px;font-weight:700;color:#6b6486;margin-bottom:2px;">Feature access</div>' +
      '<div style="font-size:11px;color:#b6afce;margin-bottom:10px;">Overrides the role default per feature.</div>' + perms + "</div>" +
      '<div style="border-top:1px solid #f0eef7;padding-top:14px;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
      '<div><div style="font-size:12px;font-weight:700;color:#6b6486;">Assigned quizzes</div><div style="font-size:11px;color:#b6afce;">Which quizzes this person can work on.</div></div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#6b6486;">All quizzes' + C.toggle(mv.assignAllOn, { action: "toggleAssignAll" }) + "</label></div>" +
      assign + "</div></div>" + footer(cancelBtn() + submitBtn("saveMember", m.saveLabel));
  }

  function mShareReport(m, mv) {
    var opts = [["all", "All quizzes"]].concat(m._scopeOptions);
    var stats = mv.reportStats.map(function (st) {
      return '<div style="flex:1;background:#fff;border:1px solid #f0eef7;border-radius:10px;padding:10px 12px;"><div style="font-size:11px;color:#9a93b8;font-weight:600;">' + esc(st.label) + '</div><div style="font-family:\'Fredoka\';font-weight:700;font-size:19px;color:#2b2540;margin-top:2px;">' + esc(st.value) + "</div></div>";
    }).join("");
    return header(m.title) +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:16px;">' +
      '<label style="' + LBL + '">Quiz' + selField("scope", m.form.scope, opts) + "</label>" +
      '<div><div style="font-size:12px;font-weight:600;color:#6b6486;margin-bottom:6px;">Reporting period</div><div style="display:flex;gap:8px;">' + rangeBtns(m.form.range) + "</div></div>" +
      (mv.reportIsCustom ? dateInputs(m.form) : "") +
      errAlert(mv.reportRangeError) +
      '<div style="background:#faf9fd;border:1px solid #f0eef7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#9a93b8;margin-bottom:10px;">' + esc(mv.reportScopeName) + " · " + esc(mv.reportRangeLabel) + "</div>" +
      '<div style="display:flex;gap:10px;">' + stats + "</div></div></div>" +
      footer(cancelBtn() + submitBtn("generateReport", "Generate report", mv.generateReportDisabled));
  }

  function mExportSubmissions(m, mv) {
    var opts = [["all", "All quizzes"]].concat(m._scopeOptions);
    return header(m.title) +
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:16px;">' +
      (mv.exportShowScope ? '<label style="' + LBL + '">Quiz' + selField("scope", m.form.scope, opts) + "</label>" : "") +
      '<div><div style="font-size:12px;font-weight:600;color:#6b6486;margin-bottom:6px;">Date range</div><div style="display:flex;gap:8px;">' + rangeBtns(m.form.range) + "</div></div>" +
      (mv.exportIsCustom ? dateInputs(m.form) : "") +
      errAlert(mv.exportRangeError) +
      '<div style="background:#faf9fd;border:1px solid #f0eef7;border-radius:12px;padding:14px;"><div style="font-size:11px;color:#9a93b8;margin-bottom:4px;">' + esc(mv.exportScopeName) + " · " + esc(mv.exportRangeLabel) + "</div>" +
      '<div style="font-family:\'Fredoka\';font-weight:700;font-size:22px;color:#2b2540;">' + esc(mv.exportMatchLabel) + "</div></div></div>" +
      footer(cancelBtn() + submitBtn("exportSubmissions", "⭳ Export CSV", mv.exportSubmitDisabled));
  }

  function mViewCard(m) {
    var c = m.card;
    var portrait = c.hasPhoto
      ? '<img src="' + attr(c.photo) + '" alt="' + attr(c.name) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
      : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:\'Fredoka\';font-weight:700;font-size:74px;color:rgba(255,255,255,.32);">' + esc(c.initial) + "</div>";
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #f0eef7;"><div class="font-display font-bold" style="font-size:18px;color:#2b2540;">Result card preview</div>' +
      '<button data-action="closeModal" aria-label="Close" style="border:none;background:#f4f2fa;width:30px;height:30px;border-radius:9px;color:#6b6486;font-size:16px;cursor:pointer;">✕</button></div>' +
      '<div style="padding:22px;"><div style="position:relative;border-radius:22px;overflow:hidden;background:' + c.grad + ';padding:20px 18px 22px;box-shadow:0 24px 50px -22px rgba(56,32,120,.55);">' +
      '<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 12px,transparent 12px 24px);pointer-events:none;"></div>' +
      '<div style="position:relative;text-align:center;color:#fff;"><div style="font-size:10px;font-weight:700;letter-spacing:2.5px;opacity:.9;">YOUR BABYM MATCH IS</div>' +
      '<div style="font-family:\'Fredoka\';font-weight:700;font-size:40px;line-height:1;margin-top:3px;text-shadow:0 3px 0 rgba(0,0,0,.12);">' + esc(c.name) + "</div></div>" +
      '<div style="position:relative;margin:14px auto 0;width:150px;height:160px;border-radius:18px;overflow:hidden;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.4);">' +
      '<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 9px,transparent 9px 18px);"></div>' + portrait +
      '<div style="position:absolute;left:0;right:0;bottom:9px;text-align:center;font-family:ui-monospace,monospace;font-size:8.5px;letter-spacing:2px;color:rgba(255,255,255,.85);text-shadow:0 1px 3px rgba(0,0,0,.4);">' + esc(c.artLabel) + "</div></div>" +
      '<div style="position:relative;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;"><div style="width:18px;height:18px;border-radius:6px;background:' + c.color + ';border:2px solid rgba(255,255,255,.85);"></div>' +
      '<div style="font-family:\'Fredoka\';font-weight:700;font-size:16px;color:#fff;">' + esc(c.colorName) + "</div></div>" +
      '<div style="position:relative;margin-top:12px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:12px 14px;color:#fff;"><div style="font-size:12.5px;line-height:1.5;text-align:center;">' + esc(c.blurb) + "</div></div></div>" +
      '<div style="margin-top:12px;font-size:11px;color:#b6afce;text-align:center;">One of this member\'s photo cards — fans get a random variant.</div></div>' +
      '<div style="padding:16px 22px;border-top:1px solid #f0eef7;display:flex;justify-content:flex-end;"><button data-action="closeModal" style="padding:12px 20px;border-radius:11px;border:none;background:#7c5cff;color:#fff;font-weight:700;font-size:14px;font-family:\'DM Sans\';cursor:pointer;">Close</button></div>';
  }

  var lastModalKey = null;
  function renderModal(s) {
    var m = s.modal;
    if (!m) { lastModalKey = null; return ""; }
    var mv = computeModalView(s);
    // scope options for share/export selects
    m._scopeOptions = s.quizzes.map(function (qz) { return [String(qz.id), qz.name]; });
    var inner, maxW = 440;
    switch (m.mode) {
      case "confirm": inner = mConfirm(m); break;
      case "editQuiz": inner = mEditQuiz(m, mv); break;
      case "editChar": inner = mEditChar(m, mv); maxW = 460; break;
      case "viewSub": inner = mViewSub(m, mv); break;
      case "editQuestion": inner = mEditQuestion(m, mv); break;
      case "editMember": inner = mEditMember(m, mv); maxW = 480; break;
      case "shareReport": inner = mShareReport(m, mv); break;
      case "exportSubmissions": inner = mExportSubmissions(m, mv); break;
      case "viewCard": inner = mViewCard(m); break;
      default: return "";
    }
    var key = m.mode + ":" + (m.id != null ? m.id : (m.key != null ? m.key : (m.index != null ? m.index : "")));
    var isNew = key !== lastModalKey;
    lastModalKey = key;
    return wrap(inner, maxW, isNew);
  }

  window.Modals = { render: renderModal, view: computeModalView };
})();
