/* admin-shell.js — sidebar, shell, render loop, and event delegation for the admin app.
   Uses window.Data/Utils/Store/C/Modals + window.Admin (state/H/computeVals + whichever
   scX screen builder(s) this particular admin-*.html page loaded).
   Top-level sections and workspace tabs are real page links now (one HTML file per
   section) rather than client-side view-switching — only the currently-loaded screen's
   builder is ever called, since a given page's initial state only ever flags that one
   screen active (see admin-state.js's pageContext()).
   Loads LAST, after admin-state.js and this page's admin/*.js screen file(s). */
(function () {
  "use strict";
  var S = window.Store, C = window.C, M = window.Modals, A = window.Admin;
  var $ = window.jQuery;
  var esc = C.esc;
  var H = A.H;
  var lastScreenKey = null;
  var searchTimers = { quizSearch: null, subSearch: null, memberSearch: null };

  // ---------- shell ----------
  function sidebar(v) {
    var nav = v.navItems.map(function (n) { return '<a href="' + n.href + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;text-decoration:none;width:100%;text-align:left;background:' + (n.active ? "#f1ecfb" : "transparent") + ";color:" + (n.active ? "#5b3fd6" : "#5b566f") + ';"><span style="width:18px;text-align:center;" aria-hidden="true">' + n.icon + "</span>" + esc(n.label) + "</a>"; }).join("");
    var drawerCls = v.navOpen ? "translate-x-0" : "-translate-x-full";
    return '<div data-action="closeNav" class="fixed inset-0 z-40 bg-black/40 lg:hidden ' + (v.navOpen ? "block" : "hidden") + '"></div>' +
      '<aside class="fixed inset-y-0 left-0 z-50 w-[236px] flex-none flex flex-col bg-white transition-transform ' + drawerCls + ' lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:translate-x-0 lg:z-auto" style="border-right:1px solid #ececf3;padding:22px 16px;">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px 18px;"><div style="font-family:\'Fredoka\';font-weight:700;font-size:19px;color:#5b3fd6;">BABYM</div><div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#9a93b8;background:#f1ecfb;padding:3px 7px;border-radius:6px;">ADMIN</div></div>' +
      '<nav style="display:flex;flex-direction:column;gap:3px;">' + nav + "</nav><div style=\"flex:1;\"></div>" +
      '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:#f6f5fb;"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#8a6bff,#ff77a9);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex:none;">' + esc(v.meInitials) + '</div><div style="line-height:1.2;flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(v.meName) + '</div><div style="font-size:11px;color:#9a93b8;">' + esc(v.meRole) + '</div></div><button data-action="logout" aria-label="Log out" title="Log out" style="border:none;background:none;cursor:pointer;color:#9a93b8;font-size:16px;padding:4px;flex:none;">⏻</button></div></aside>';
  }

  function shell(v, anim) {
    var content = v.isDashboard ? A.scDashboard(v, anim) : v.isQuizzes ? A.scQuizzes(v, anim) : v.isOverview ? A.scOverview(v, anim) : v.isBuilder ? A.scBuilder(v, anim) : v.isResults ? A.scResults(v, anim) : v.isDesign ? A.scDesign(v, anim) : v.isSubmissions ? A.scSubmissions(v, anim) : v.isAnalytics ? A.scAnalytics(v, anim) : v.isTeam ? A.scTeam(v, anim) : "";
    var breadcrumb = v.inWorkspace ? '<div style="font-size:12.5px;color:#9a93b8;"><a href="admin-quizzes.html" style="text-decoration:none;color:#7c5cff;font-weight:600;font-size:12.5px;">All quizzes</a> <span aria-hidden="true">/</span> <span style="color:#6b6486;font-weight:600;">' + esc(v.workspaceQuizName) + "</span></div>" : "";
    var subnav = v.inWorkspace ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;"><div style="display:flex;gap:4px;background:#fff;border:1px solid #ececf3;padding:4px;border-radius:12px;overflow-x:auto;max-width:100%;">' +
      v.workspaceTabs.map(function (t) { return '<a href="' + t.href + '" style="text-decoration:none;display:inline-block;cursor:pointer;padding:8px 16px;border-radius:999px;font-family:\'DM Sans\';font-size:13px;font-weight:700;white-space:nowrap;background:' + (t.active ? "#7c5cff" : "transparent") + ";color:" + (t.active ? "#fff" : "#7a72a0") + ';">' + esc(t.label) + "</a>"; }).join("") +
      '</div><div style="display:flex;align-items:center;gap:8px;">' + C.statusBadge(v.workspaceStatus) + '<span style="font-size:12px;color:#9a93b8;">' + esc(v.workspaceMeta) + "</span></div></div>" : "";
    var main = '<main class="flex-1 min-w-0" style="padding:22px 20px;overflow-x:hidden;">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><button data-action="toggleNav" class="lg:hidden bm-icon" aria-label="Open menu" style="font-size:20px;padding:4px 8px;">☰</button>' + breadcrumb + "</div>" +
      '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap;"><div><div style="font-family:\'Fredoka\';font-weight:600;font-size:26px;color:#2b2540;">' + esc(v.adminTitle) + '</div><div style="font-size:13px;color:#9a93b8;margin-top:2px;">' + esc(v.adminSubtitle) + '</div></div><button data-action="adminAction" style="border:none;cursor:pointer;background:#7c5cff;color:#fff;font-family:\'DM Sans\';font-weight:600;font-size:13px;padding:11px 18px;border-radius:11px;box-shadow:0 10px 22px -10px rgba(124,92,255,.8);white-space:nowrap;">' + esc(v.adminAction) + "</button></div>" +
      subnav + content + "</main>";
    return '<div class="flex min-h-screen" style="background:#f6f5fb;color:#2b2540;">' + sidebar(v) + main + "</div>";
  }

  function captureFocus() {
    var el = document.activeElement;
    var root = document.getElementById("admin-app");
    if (!el || !root || !$.contains(root, el) || !el.hasAttribute("data-change")) return null;
    return { key: el.getAttribute("data-change"), start: el.selectionStart, end: el.selectionEnd, value: el.value };
  }
  function restoreFocus(info) {
    if (!info) return;
    var el = document.querySelector('#admin-app [data-change="' + info.key + '"]');
    if (!el) return;
    if (typeof info.value === "string" && el.value !== info.value) el.value = info.value;
    el.focus();
    if (typeof el.setSelectionRange === "function" && info.start != null) {
      try { el.setSelectionRange(info.start, info.end); } catch (e) {}
    }
  }

  function render(s) {
    if (s.booting) { $("#admin-app").html(C.spinner()); $("#modal-layer").html(""); return; }
    if (!s.authed) {
      $("#admin-app").html(A.scLogin({ loginForm: s.loginForm, loginError: s.loginError }));
      $("#modal-layer").html("");
      C.toast(s.toast);
      return;
    }
    var v = A.computeVals(s);
    var screenKey = s.adminScreen + ":" + s.activeQuizId + ":" + s.workspaceScreen;
    var isNewScreen = screenKey !== lastScreenKey;
    lastScreenKey = screenKey;
    var focusInfo = captureFocus();
    $("#admin-app").html(shell(v, isNewScreen ? "animate-bm-fadeup" : ""));
    restoreFocus(focusInfo);
    $("#modal-layer").html(M.render(s));
    C.toast(s.toast);
  }

  // ---------- events ----------
  function num(el, name) { var x = el.getAttribute("data-" + name); return x == null ? null : parseInt(x, 10); }
  $(function () {
    var $app = $("#admin-app"), $layer = $("#modal-layer");

    function onClick(e) {
      var el = e.currentTarget, a = el.getAttribute("data-action");
      if (a === "scrimClose") { if (e.target === el) H.closeModal(); return; }
      var id = el.getAttribute("data-id"), key = el.getAttribute("data-key"), idx = num(el, "idx"), qi = num(el, "qi"), oi = num(el, "oi"), dir = num(el, "dir"), page = num(el, "page");
      var idNum = id == null ? null : (/^\d+$/.test(id) ? parseInt(id, 10) : id);
      switch (a) {
        case "login": case "logout":
        case "toggleNav": case "closeNav":
        case "publishActive": case "previewAsFan": case "downloadQR":
        case "openNewQuiz": case "openNewChar": case "openNewQuestion": case "openInviteMember":
        case "openShareReport": case "openExportSubmissions": case "addConsentItem":
        case "uploadLogo": case "uploadBg": case "uploadHero": case "toggleGate": case "toggleEsign":
        case "toggleCopyLink": case "toggleDownload": case "toggleMembersBadge": case "toggleAssignAll":
        case "closeModal": case "confirmAction": case "deleteFromView":
        case "saveQuiz": case "saveChar": case "saveQuestion": case "saveMember":
        case "generateReport": case "exportSubmissions": H[a](); break;
        case "setPreviewScreen": case "toggleCopySection":
        case "togglePerm": case "setRange": H[a](key); break;
        case "openWorkspace": H.openWorkspace(idNum); break;
        case "openEditQuiz": H.openEditQuiz(idNum); break;
        case "duplicateQuiz": H.duplicateQuiz(idNum); break;
        case "deleteQuiz": { var q = S.get().quizzes.filter(function (x) { return x.id === idNum; })[0]; if (q) H.openConfirm("quiz", q.id, q.name); break; }
        case "openEditChar": H.openEditChar(key); break;
        case "deleteChar": H.askDeleteChar(key); break;
        case "openViewSub": H.openViewSub(idNum); break;
        case "deleteSubmission": { var sub = S.get().submissions.filter(function (x) { return x.id === idNum; })[0]; if (sub) H.openConfirm("submission", sub.id, sub.name); break; }
        case "openEditMember": H.openEditMember(id); break;
        case "removeMember": { var mem = S.get().members.filter(function (x) { return x.id === id; })[0]; if (mem) H.openConfirm("member", mem.id, mem.name); break; }
        case "viewCard": H.openViewCard(key, el.getAttribute("data-cardid")); break;
        case "builderJump": H.builderJump(page); break;
        case "openEditQuestion": H.openEditQuestion(idx); break;
        case "moveQuestion": H.moveQuestion(idx, dir); break;
        case "duplicateQuestion": H.duplicateQuestion(idx); break;
        case "deleteQuestion": { var qq = (A.activeQuiz() || { questions: [] }).questions[idx]; H.openConfirm("question", idx, qq ? qq.title : ""); break; }
        case "addAnswer": H.addAnswer(idx); break;
        case "deleteAnswer": H.deleteAnswer(qi, oi); break;
        case "uploadAnswerImg": H.uploadAnswerImg(qi, oi); break;
        case "removeScore": H.removeScore(qi, oi, key); break;
        case "cardUpload": H.cardUpload(idx); break;
        case "toggleField": H.toggleField(key); break;
        case "toggleFieldReq": H.toggleFieldReq(key); break;
        case "toggleChannel": H.toggleChannel(key); break;
        case "moveChannel": H.moveChannel(key, dir); break;
        case "moveConsent": H.moveConsent(id, dir); break;
        case "deleteConsentItem": H.deleteConsentItem(id); break;
      }
      // pager buttons carry data-pager/data-page (no data-action)
    }
    function onPager(e) {
      var el = e.currentTarget, pager = el.getAttribute("data-pager"), page = parseInt(el.getAttribute("data-page"), 10);
      if (pager) { var patch = {}; patch[pager] = page; S.setState(patch); }
    }
    function runSearch(field, pageField, searchingField, value, delay) {
      var p1 = {}; p1[searchingField] = true;
      S.setState(p1);
      clearTimeout(searchTimers[field]);
      searchTimers[field] = setTimeout(function () {
        var p2 = {}; p2[field] = value; p2[pageField] = 1; p2[searchingField] = false;
        S.setState(p2);
      }, delay);
    }
    function flushSearch(field, pageField, searchingField, value) {
      clearTimeout(searchTimers[field]);
      var p = {}; p[field] = value; p[pageField] = 1; p[searchingField] = false;
      S.setState(p);
    }
    function onChange(e) {
      var el = e.currentTarget, c = el.getAttribute("data-change"), field = el.getAttribute("data-field"), key = el.getAttribute("data-key"), id = el.getAttribute("data-id");
      var idx = num(el, "idx"), qi = num(el, "qi"), oi = num(el, "oi");
      var val = el.type === "checkbox" ? el.checked : el.value;
      switch (c) {
        case "mf": case "mfColor": A.setModalForm(field, el.value); break;
        case "mfRole": H.mfRole(el.value); break;
        case "assignQuiz": { var did = /^\d+$/.test(id) ? parseInt(id, 10) : id; H.toggleAssignQuiz(did); break; }
        case "qTitle": H.setQuestionTitle(idx, el.value); break;
        case "aLabel": H.setAnswerLabel(qi, oi, el.value); break;
        case "score": H.setScore(qi, oi, key, el.value); break;
        case "addTarget": H.addTarget(qi, oi, el.value); break;
        case "design": H.setDesign(field, el.value); break;
        case "quizField": H.setQuizField(field, el.value); break;
        case "copy": H.setCopy(key, el.value); break;
        case "consentText": H.setConsentText(id, el.value); break;
        case "consentReq": H.toggleConsentRequired(id); break;
        case "subFilter": S.setState({ subQuizFilter: el.value, subPage: 1 }); break;
        // NOTE: the search fields (quizSearch/subSearch/memberSearch) are deliberately NOT
        // handled here. Each keystroke's re-render removes the focused dirty input from the
        // DOM, which makes the browser fire `change` mid-typing — flushing here would commit
        // the search on every keystroke. They commit only via the debounce timer (or Enter).
      }
    }
    $app.on("click", "[data-action]", onClick);
    $app.on("submit", "form[data-submit]", function (e) {
      e.preventDefault();
      var a = e.currentTarget.getAttribute("data-submit");
      if (typeof H[a] === "function") H[a]();
    });
    $app.on("click", "[data-pager]", onPager);
    $app.on("change", "[data-change]", onChange);
    $app.on("input", "[data-model]", function (e) {
      S.setPath(e.currentTarget.getAttribute("data-model"), e.currentTarget.value, { silent: true });
    });
    var SEARCH_SEL = '[data-change="quizSearch"], [data-change="subSearch"], [data-change="memberSearch"]';
    function searchFields(el) {
      var c = el.getAttribute("data-change");
      return { field: c, pageField: c === "quizSearch" ? "quizPage" : c === "subSearch" ? "subPage" : "memberPage", searchingField: c + "ing" };
    }
    $app.on("input", SEARCH_SEL, function (e) {
      var el = e.currentTarget, f = searchFields(el);
      runSearch(f.field, f.pageField, f.searchingField, el.value, 1200);
    });
    $app.on("keydown", SEARCH_SEL, function (e) {
      if (e.key !== "Enter") return;
      var el = e.currentTarget, f = searchFields(el);
      flushSearch(f.field, f.pageField, f.searchingField, el.value);
    });
    $layer.on("click", "[data-action]", onClick);
    $layer.on("change", "[data-change]", onChange);
    $(document).on("keydown", function (e) { if (e.key === "Escape" && S.get().modal) H.closeModal(); });

    S.init(A.state, render);
    A.bootstrap();
  });
})();
