/* admin-state.js — admin state, handlers, the shared view-model, and the API/bootstrap layer.
   Uses window.Data/Utils/Store/C. Loads AFTER modals.js, BEFORE this page's admin/*.js screen
   file(s) and admin-shell.js. Exposes window.Admin = { state, H, computeVals, bootstrap, CARD,
   pagerRow, tableHead }.

   Each admin-*.html page is its own real page now (not one big SPA) — pageContext() below reads
   the current filename + "?quiz=" query param once at load to decide which single screen this
   page renders; nothing here switches screens client-side anymore (see admin-shell.js). */
(function () {
  "use strict";
  var D = window.Data, U = window.Utils, S = window.Store, C = window.C;
  var esc = C.esc, attr = C.attr;
  window.Admin = window.Admin || {};
  var A = window.Admin;

  // ---------- API helpers ----------
  function api(method, path, body) {
    return fetch("/api" + path, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (json) {
        if (!r.ok) { var err = new Error((json && json.message) || "Something went wrong."); err.status = r.status; err.body = json; throw err; }
        return json;
      });
    });
  }
  function apiUpload(path, formData) {
    return fetch("/api" + path, { method: "POST", body: formData }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (json) {
        if (!r.ok) throw new Error((json && json.message) || "Upload failed.");
        return json;
      });
    });
  }
  function apiError(e) { flashToast((e && e.message) || "Something went wrong."); }

  // ---------- per-page context ----------
  function pageContext() {
    var file = (location.pathname.split("/").pop() || "admin-dashboard.html").replace(/\.html$/, "");
    var qp = new URLSearchParams(location.search).get("quiz");
    var quizId = qp && /^\d+$/.test(qp) ? parseInt(qp, 10) : null;
    var map = {
      "admin-dashboard": { adminScreen: "dashboard" },
      "admin-quizzes": { adminScreen: "quizzes" },
      "admin-overview": { adminScreen: "quizzes", workspaceScreen: "overview", activeQuizId: quizId },
      "admin-builder": { adminScreen: "quizzes", workspaceScreen: "builder", activeQuizId: quizId },
      "admin-results": { adminScreen: "quizzes", workspaceScreen: "results", activeQuizId: quizId },
      "admin-design": { adminScreen: "quizzes", workspaceScreen: "design", activeQuizId: quizId },
      "admin-submissions": { adminScreen: "submissions", workspaceScreen: "submissions", activeQuizId: quizId },
      "admin-analytics": { adminScreen: "analytics", workspaceScreen: "analytics", activeQuizId: quizId },
      "admin-team": { adminScreen: "team" },
    };
    return map[file] || { adminScreen: "dashboard" };
  }
  var PAGE = pageContext();

  // ---------- state ----------
  var initial = Object.assign({
    booting: true, authed: false, me: null,
    loginForm: { email: "", password: "" }, loginError: "",
    activeQuizId: null, workspaceScreen: "overview",
    previewScreen: "landing", openCopySection: "gate", navOpen: false,
    quizzes: [], members: [], submissions: [],
    subPage: 1, quizPage: 1, builderPage: 1, memberPage: 1, cardDistPage: 1,
    subQuizFilter: "all", subSearch: "", quizSearch: "", memberSearch: "", modal: null, toast: "",
    quizSearching: false, subSearching: false, memberSearching: false,
  }, PAGE);
  var toastTimer = null;
  A.state = initial;

  function activeQuiz() { var s = S.get(); return s.quizzes.filter(function (q) { return q.id === s.activeQuizId; })[0] || null; }
  function updateActiveQuiz(patch) {
    var s = S.get();
    S.setState({ quizzes: s.quizzes.map(function (q) { return q.id === s.activeQuizId ? Object.assign({}, q, patch) : q; }) });
  }
  function flashToast(msg) { S.setState({ toast: msg }); clearTimeout(toastTimer); toastTimer = setTimeout(function () { S.setState({ toast: "" }); }, 1900); }
  function pickImage(cb) {
    try {
      var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; cb(f); };
      inp.click();
    } catch (e) { flashToast("Upload not available here"); }
  }
  function readAsDataUrl(file, cb) { var r = new FileReader(); r.onload = function () { cb(r.result); }; r.readAsDataURL(file); }
  function setModalForm(field, val) { var m = S.get().modal; if (!m) return; S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, (function () { var o = {}; o[field] = val; return o; })()) }) }); }
  A.activeQuiz = activeQuiz;
  A.setModalForm = setModalForm;

  // meta-vs-hard-column split for persisting quiz field patches (see app/Http/Controllers/Api/QuizController.php@update)
  // Real columns on quizzes — anything else is folded into the meta JSON bag.
  var HARD_KEYS = ["name", "slug", "status", "gateEnabled", "hashtag", "shareCopy", "showCopyLink", "showDownload", "esignEnabled", "outfitQuestionId", "poseQuestionId"];
  function persistQuizPatch(id, patch) {
    var body = {}, meta = {};
    Object.keys(patch).forEach(function (k) {
      if (HARD_KEYS.indexOf(k) !== -1) body[k] = patch[k];
      else meta[k] = patch[k];
    });
    if (Object.keys(meta).length) body.meta = meta;
    return api("PUT", "/quizzes/" + id, body).catch(apiError);
  }

  // ---------- handlers ----------
  var H = {
    // auth
    login: function () {
      var f = S.get().loginForm;
      api("POST", "/auth/login", f).then(function () {
        var next = new URLSearchParams(location.search).get("next");
        location.href = next || "admin-dashboard.html";
      }).catch(function () {
        S.setState({ loginError: "Incorrect email or password.", loginForm: Object.assign({}, f, { password: "" }) });
      });
    },
    logout: function () { api("POST", "/auth/logout", {}).finally(function () { location.href = "admin-login.html"; }); },

    // shell / nav
    toggleNav: function () { S.setState({ navOpen: !S.get().navOpen }); },
    closeNav: function () { S.setState({ navOpen: false }); },
    openWorkspace: function (id) { location.href = "admin-overview.html?quiz=" + id; },
    publishActive: function () { var id = S.get().activeQuizId; updateActiveQuiz({ status: "Active" }); persistQuizPatch(id, { status: "Active" }); flashToast("Published — now Active"); },
    previewAsFan: function () { var q = activeQuiz(); try { window.open("index.html?quiz=" + encodeURIComponent(q ? q.slug : ""), "_blank"); } catch (e) {} },
    downloadQR: function () { var q = activeQuiz(); var ok = U.downloadQR(q ? q.slug : "quiz"); flashToast(ok ? "QR downloaded (PNG)" : "QR download not available here"); },
    adminAction: function () {
      var s = S.get();
      if (s.activeQuizId != null) {
        var scr = s.workspaceScreen;
        if (scr === "builder") return H.openNewQuestion();
        if (scr === "results") return H.openNewChar();
        if (scr === "submissions") return H.openExportSubmissions();
        if (scr === "analytics") return H.openShareReport();
        return H.publishActive();
      }
      if (s.adminScreen === "quizzes") return H.openNewQuiz();
      if (s.adminScreen === "team") return H.openInviteMember();
      if (s.adminScreen === "submissions") return H.openExportSubmissions();
      return H.openShareReport();
    },

    // quizzes CRUD
    openNewQuiz: function () { S.setState({ modal: { mode: "editQuiz", id: null, title: "New quiz", saveLabel: "Create quiz", form: { name: "", slug: "", status: "Draft" } } }); },
    openEditQuiz: function (id) { var q = S.get().quizzes.filter(function (x) { return x.id === id; })[0]; if (q) S.setState({ modal: { mode: "editQuiz", id: q.id, title: "Edit quiz", saveLabel: "Save changes", form: { name: q.name, slug: q.slug, status: q.status } } }); },
    saveQuiz: function () {
      var s = S.get(), m = s.modal; if (!m) return; var f = m.form;
      if (!(f.name || "").trim()) { flashToast("Quiz name is required"); return; }
      if (m.id == null) {
        api("POST", "/quizzes", { name: f.name.trim(), slug: f.slug, status: f.status }).then(function (nq) {
          S.setState({ quizzes: [nq].concat(S.get().quizzes), quizPage: 1 }); flashToast("Quiz created");
        }).catch(apiError);
      } else {
        updateActiveQuizById(m.id, { name: f.name.trim(), slug: f.slug, status: f.status });
        api("PUT", "/quizzes/" + m.id, { name: f.name.trim(), slug: f.slug, status: f.status }).then(function (nq) {
          S.setState({ quizzes: S.get().quizzes.map(function (x) { return x.id === m.id ? nq : x; }) }); flashToast("Quiz saved");
        }).catch(apiError);
      }
      H.closeModal();
    },
    duplicateQuiz: function (id) {
      var s = S.get(), q = s.quizzes.filter(function (x) { return x.id === id; })[0]; if (!q) return;
      flashToast("Duplicating…");
      api("POST", "/quizzes", { name: q.name + " (copy)", slug: q.slug + "-copy", status: "Draft" }).then(function (nq) {
        var newId = nq.id;
        var chain = Promise.resolve();
        q.characters.forEach(function (c) {
          chain = chain.then(function () { return api("POST", "/quizzes/" + newId + "/characters", { name: c.name, colorName: c.colorName, color: c.color, blurb: c.blurb, why: c.why, cards: c.cards.map(function (cd) { return { caption: cd.caption }; }) }); });
        });
        q.questions.forEach(function (qq) {
          chain = chain.then(function () { return api("POST", "/quizzes/" + newId + "/questions", { title: qq.title, sub: qq.sub, layout: qq.layout, options: qq.options.map(function (o) { return { badge: o.badge, label: o.label, sub: o.sub, scores: o.scores }; }) }); });
        });
        return chain.then(function () { return api("GET", "/quizzes/" + newId); });
      }).then(function (full) {
        S.setState({ quizzes: [full].concat(S.get().quizzes), quizPage: 1 }); flashToast("Quiz duplicated");
      }).catch(apiError);
    },

    // characters CRUD
    openNewChar: function () {
      // No slots yet: the (outfit x pose) matrix is generated server-side the
      // moment the member is created, then filled in by reopening this editor.
      S.setState({ modal: { mode: "editChar", key: null, title: "New member", saveLabel: "Create member", form: { name: "NEW", colorName: "New Colorway", color: "#8B6FE8", blurb: "", cards: [] } } });
    },
    openEditChar: function (key) {
      var c = (activeQuiz() || { characters: [] }).characters.filter(function (x) { return x.key === key; })[0]; if (!c) return;
      // outfitId/poseId must survive — they are what binds each card to its slot
      // in the matrix grid.
      var cards = (c.cards || []).map(function (cd) {
        return { id: cd.id, photo: cd.photo || "", caption: cd.caption || "", outfitId: cd.outfitId, poseId: cd.poseId };
      });
      S.setState({ modal: { mode: "editChar", key: c.key, title: "Edit member", saveLabel: "Save changes", form: { name: c.name, colorName: c.colorName, color: c.color, blurb: c.blurb, cards: cards } } });
    },
    saveChar: function () {
      var s = S.get(), m = s.modal, quiz = activeQuiz(); if (!m || !quiz) return; var f = m.form;
      if (!(f.name || "").trim()) { flashToast("Member name is required"); return; }
      var cards = f.cards || [];
      // Only captions travel — the matrix's shape is owned by the server, so the
      // client can no longer add or remove slots.
      var payload = { name: f.name, colorName: f.colorName, color: f.color, blurb: f.blurb, cards: cards.map(function (c) { return { id: c.id, caption: c.caption || "" }; }) };
      if (m.key == null) {
        api("POST", "/quizzes/" + quiz.id + "/characters", payload).then(function (character) {
          uploadPendingCardPhotos(character, cards);
          updateActiveQuizById(quiz.id, { characters: activeQuiz().characters.concat([character]) });
          flashToast("Member added");
        }).catch(apiError);
      } else {
        var existing = quiz.characters.filter(function (x) { return x.key === m.key; })[0]; if (!existing) return;
        api("PUT", "/characters/" + existing.id, payload).then(function (character) {
          uploadPendingCardPhotos(character, cards);
          updateActiveQuiz({ characters: activeQuiz().characters.map(function (c) { return c.key === m.key ? character : c; }) });
          flashToast("Member saved");
        }).catch(apiError);
      }
      H.closeModal();
    },
    cardUpload: function (idx) {
      pickImage(function (file) {
        var m = S.get().modal; if (!m) return;
        readAsDataUrl(file, function (data) {
          S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, { cards: m.form.cards.map(function (c, i) { return i === idx ? Object.assign({}, c, { photo: data, pendingFile: file }) : c; }) }) }) });
        });
      });
    },

    // questions CRUD
    openNewQuestion: function () { S.setState({ modal: { mode: "editQuestion", index: null, title: "New question", saveLabel: "Add question", form: { title: "", sub: "", layout: "list" } } }); },
    openEditQuestion: function (i) { var q = (activeQuiz() || { questions: [] }).questions[i]; if (!q) return; S.setState({ modal: { mode: "editQuestion", index: i, title: "Edit question", saveLabel: "Save changes", form: { title: q.title, sub: q.sub, layout: q.layout } } }); },
    saveQuestion: function () {
      var m = S.get().modal, quiz = activeQuiz(); if (!m || !quiz) return; var f = m.form;
      var isGrid = f.layout === "grid";
      // Two grid questions are now legitimate — one drives the outfit axis of the
      // card matrix, the other the pose axis. Which is which is set explicitly in
      // Design & share, and the API validates the pair.
      if (m.index == null) {
        var badges = "ABCDEFGH".slice(0, isGrid ? D.CLOTHING_SET_SIZE : 2).split("");
        var firstKey = (quiz.characters[0] || {}).key, secondKey = ((quiz.characters[1] || quiz.characters[0]) || {}).key;
        var opts = badges.map(function (b, i) {
          if (isGrid) return { badge: b, label: "Choice " + b, scores: {} };
          var key = i === 0 ? firstKey : secondKey;
          return { badge: b, label: "Answer " + b, scores: key ? (function () { var o = {}; o[key] = 1; return o; })() : {} };
        });
        api("POST", "/quizzes/" + quiz.id + "/questions", { title: f.title || "Untitled question", sub: f.sub || "", layout: f.layout, options: opts }).then(function (question) {
          updateActiveQuizById(quiz.id, { questions: activeQuiz().questions.concat([question]) }); flashToast("Question added");
        }).catch(apiError);
      } else {
        var q = quiz.questions[m.index];
        updateActiveQuiz({ questions: quiz.questions.map(function (qq, i) { return i === m.index ? Object.assign({}, qq, { title: f.title, sub: f.sub, layout: f.layout }) : qq; }) });
        api("PUT", "/questions/" + q.id, { title: f.title, sub: f.sub, layout: f.layout }).catch(apiError);
        flashToast("Question saved");
      }
      H.closeModal();
    },
    setQuestionTitle: function (i, v) { var quiz = activeQuiz(), q = quiz.questions[i]; updateActiveQuiz({ questions: quiz.questions.map(function (qq, idx) { return idx === i ? Object.assign({}, qq, { title: v }) : qq; }) }); api("PUT", "/questions/" + q.id, { title: v }).catch(apiError); },
    moveQuestion: function (i, dir) {
      var quiz = activeQuiz(), qs = quiz.questions.slice(), j = i + dir; if (j < 0 || j >= qs.length) return;
      var t = qs[i]; qs[i] = qs[j]; qs[j] = t; updateActiveQuiz({ questions: qs });
      api("PUT", "/quizzes/" + quiz.id + "/questions/reorder", { order: qs.map(function (q) { return q.id; }) }).catch(apiError);
    },
    duplicateQuestion: function (i) {
      var quiz = activeQuiz(), q = quiz.questions[i];
      api("POST", "/quizzes/" + quiz.id + "/questions", { title: q.title, sub: q.sub, layout: q.layout, options: q.options }).then(function (created) {
        var qs = activeQuiz().questions.slice(); qs.splice(i + 1, 0, created); updateActiveQuiz({ questions: qs }); flashToast("Question duplicated");
      }).catch(apiError);
    },
    addAnswer: function (i) {
      var quiz = activeQuiz(), q = quiz.questions[i]; if (q.layout === "grid") { flashToast("Clothing-set answer count is fixed"); return; }
      if (q.options.length >= 8) { flashToast("Max answers reached"); return; }
      var firstKey = (quiz.characters[0] || {}).key; var opt = { badge: "", label: "New answer", scores: firstKey ? (function () { var o = {}; o[firstKey] = 1; return o; })() : {} };
      var options = U.rebadge(q.options.concat([opt]));
      updateActiveQuiz({ questions: quiz.questions.map(function (qq, idx) { return idx === i ? Object.assign({}, qq, { options: options }) : qq; }) });
      api("PUT", "/questions/" + q.id, { options: options }).then(function (saved) { updateActiveQuiz({ questions: activeQuiz().questions.map(function (qq, idx) { return idx === i ? saved : qq; }) }); }).catch(apiError);
    },
    deleteAnswer: function (qi, oi) {
      var quiz = activeQuiz(), q = quiz.questions[qi]; if (q.layout === "grid") { flashToast("Clothing-set answer count is fixed"); return; }
      var options = U.rebadge(q.options.filter(function (_, i) { return i !== oi; }));
      updateActiveQuiz({ questions: quiz.questions.map(function (qq, idx) { return idx === qi ? Object.assign({}, qq, { options: options }) : qq; }) });
      api("PUT", "/questions/" + q.id, { options: options }).then(function (saved) { updateActiveQuiz({ questions: activeQuiz().questions.map(function (qq, idx) { return idx === qi ? saved : qq; }) }); }).catch(apiError);
    },
    setAnswerLabel: function (qi, oi, v) {
      var quiz = activeQuiz(), q = quiz.questions[qi];
      var options = q.options.map(function (o, j) { return j === oi ? Object.assign({}, o, { label: v }) : o; });
      updateActiveQuiz({ questions: quiz.questions.map(function (qq, i) { return i === qi ? Object.assign({}, qq, { options: options }) : qq; }) });
      api("PUT", "/questions/" + q.id, { options: options }).catch(apiError);
    },
    setScore: function (qi, oi, key, v) {
      var pts = parseInt(v, 10); pts = isNaN(pts) ? 0 : pts;
      var quiz = activeQuiz(), q = quiz.questions[qi];
      var options = q.options.map(function (o, j) { if (j !== oi) return o; var sc = Object.assign({}, o.scores); sc[key] = pts; return Object.assign({}, o, { scores: sc }); });
      updateActiveQuiz({ questions: quiz.questions.map(function (qq, i) { return i === qi ? Object.assign({}, qq, { options: options }) : qq; }) });
      api("PUT", "/questions/" + q.id, { options: options }).catch(apiError);
    },
    removeScore: function (qi, oi, key) {
      var quiz = activeQuiz(), q = quiz.questions[qi];
      var options = q.options.map(function (o, j) { if (j !== oi) return o; var sc = Object.assign({}, o.scores); delete sc[key]; return Object.assign({}, o, { scores: sc }); });
      updateActiveQuiz({ questions: quiz.questions.map(function (qq, i) { return i === qi ? Object.assign({}, qq, { options: options }) : qq; }) });
      api("PUT", "/questions/" + q.id, { options: options }).catch(apiError);
    },
    addTarget: function (qi, oi, key) {
      if (!key) return;
      var quiz = activeQuiz(), q = quiz.questions[qi];
      var options = q.options.map(function (oo, j) { if (j !== oi) return oo; var sc = Object.assign({}, oo.scores); sc[key] = 1; return Object.assign({}, oo, { scores: sc }); });
      updateActiveQuiz({ questions: quiz.questions.map(function (qq, i) { return i === qi ? Object.assign({}, qq, { options: options }) : qq; }) });
      api("PUT", "/questions/" + q.id, { options: options }).catch(apiError);
      flashToast("Member added to this answer");
    },
    uploadAnswerImg: function (qi, oi) {
      pickImage(function (file) {
        var quiz = activeQuiz(), q = quiz.questions[qi], opt = q.options[oi];
        var fd = new FormData(); fd.append("img", file);
        apiUpload("/options/" + opt.id + "/image", fd).then(function (res) {
          var options = q.options.map(function (oo, j) { return j === oi ? Object.assign({}, oo, { img: res.img_url }) : oo; });
          updateActiveQuiz({ questions: activeQuiz().questions.map(function (qq, i) { return i === qi ? Object.assign({}, qq, { options: options }) : qq; }) });
          flashToast("Outfit image uploaded");
        }).catch(apiError);
      });
    },
    builderJump: function (page) { S.setState({ builderPage: page }); },

    // consent / gate / channels (design tab)
    toggleGate: function () { var q = activeQuiz(); updateActiveQuiz({ gateEnabled: !q.gateEnabled }); persistQuizPatch(q.id, { gateEnabled: !q.gateEnabled }); },
    toggleEsign: function () { var q = activeQuiz(); var on = !q.esign.enabled; updateActiveQuiz({ esign: Object.assign({}, q.esign, { enabled: on }) }); persistQuizPatch(q.id, { esignEnabled: on }); },
    addConsentItem: function () {
      var q = activeQuiz();
      api("POST", "/quizzes/" + q.id + "/consent-items", { text: "I agree to the terms." }).then(function (item) {
        var qq = activeQuiz(); updateActiveQuiz({ esign: Object.assign({}, qq.esign, { items: qq.esign.items.concat([item]) }) });
      }).catch(apiError);
    },
    setConsentText: function (id, v) { var q = activeQuiz(); updateActiveQuiz({ esign: Object.assign({}, q.esign, { items: q.esign.items.map(function (it) { return it.id === id ? Object.assign({}, it, { text: v }) : it; }) }) }); api("PUT", "/consent-items/" + id, { text: v }).catch(apiError); },
    toggleConsentRequired: function (id) {
      var q = activeQuiz(); var item = q.esign.items.filter(function (it) { return it.id === id; })[0]; var next = item ? !item.required : true;
      updateActiveQuiz({ esign: Object.assign({}, q.esign, { items: q.esign.items.map(function (it) { return it.id === id ? Object.assign({}, it, { required: next }) : it; }) }) });
      api("PUT", "/consent-items/" + id, { required: next }).catch(apiError);
    },
    deleteConsentItem: function (id) { var q = activeQuiz(); updateActiveQuiz({ esign: Object.assign({}, q.esign, { items: q.esign.items.filter(function (it) { return it.id !== id; }) }) }); api("DELETE", "/consent-items/" + id).catch(apiError); },
    moveConsent: function (id, dir) {
      var q = activeQuiz(), items = q.esign.items.slice(); var i = items.map(function (x) { return x.id; }).indexOf(id), j = i + dir; if (j < 0 || j >= items.length) return;
      var t = items[i]; items[i] = items[j]; items[j] = t; updateActiveQuiz({ esign: Object.assign({}, q.esign, { items: items }) });
      api("POST", "/consent-items/" + id + "/move", { dir: dir }).catch(apiError);
    },
    toggleCopyLink: function () { var q = activeQuiz(); var v = q.showCopyLink === false; updateActiveQuiz({ showCopyLink: v }); persistQuizPatch(q.id, { showCopyLink: v }); },
    toggleDownload: function () { var q = activeQuiz(); var v = q.showDownload === false; updateActiveQuiz({ showDownload: v }); persistQuizPatch(q.id, { showDownload: v }); },
    toggleMembersBadge: function () { var q = activeQuiz(); var v = q.showMembersBadge === false; updateActiveQuiz({ showMembersBadge: v }); persistQuizPatch(q.id, { showMembersBadge: v }); },
    toggleField: function (which) { var q = activeQuiz(), fs = U.fieldsOf(q); var patch = {}; patch[which] = Object.assign({}, fs[which], { show: !fs[which].show }); var fields = Object.assign({}, fs, patch); updateActiveQuiz({ fields: fields }); persistQuizPatch(q.id, { fields: fields }); },
    toggleFieldReq: function (which) { var q = activeQuiz(), fs = U.fieldsOf(q); var patch = {}; patch[which] = Object.assign({}, fs[which], { required: !fs[which].required }); var fields = Object.assign({}, fs, patch); updateActiveQuiz({ fields: fields }); persistQuizPatch(q.id, { fields: fields }); },
    toggleChannel: function (key) { var q = activeQuiz(); var ch = U.channelsOf(q).map(function (c) { return c.key === key ? Object.assign({}, c, { on: !c.on }) : c; }); updateActiveQuiz({ channels: ch }); persistQuizPatch(q.id, { channels: ch }); },
    moveChannel: function (key, dir) {
      var q = activeQuiz(), ch = U.channelsOf(q).slice(); var i = ch.map(function (c) { return c.key; }).indexOf(key), j = i + dir; if (i < 0 || j < 0 || j >= ch.length) return;
      var t = ch[i]; ch[i] = ch[j]; ch[j] = t; updateActiveQuiz({ channels: ch }); persistQuizPatch(q.id, { channels: ch });
    },
    setPreviewScreen: function (key) { S.setState({ previewScreen: key }); },
    toggleCopySection: function (key) { S.setState({ openCopySection: S.get().openCopySection === key ? "" : key }); },
    setDesign: function (field, v) { var q = activeQuiz(); var patch = {}; patch[field] = v; var design = Object.assign({}, q.design, patch); updateActiveQuiz({ design: design }); persistQuizPatch(q.id, { design: design }); },
    setQuizField: function (field, v) {
      var q = activeQuiz(); var patch = {}; patch[field] = v; updateActiveQuiz(patch);
      var p = persistQuizPatch(q.id, patch);
      // Re-pointing a dimension rebuilds every member's card matrix server-side,
      // so the optimistic copy's cards are stale — pull the real quiz back.
      if (field === "outfitQuestionId" || field === "poseQuestionId") {
        p.then(function () {
          return api("GET", "/quizzes/" + q.id).then(function (fresh) {
            updateActiveQuizById(q.id, fresh);
            flashToast("Card matrix rebuilt");
          });
        }).catch(apiError);
      }
    },
    setCopy: function (key, v) { var q = activeQuiz(); var patch = {}; patch[key] = v; var copy = Object.assign({}, U.copyOf(q), patch); updateActiveQuiz({ copy: copy }); persistQuizPatch(q.id, { copy: copy }); },
    uploadLogo: function () { pickImage(function (file) { readAsDataUrl(file, function (data) { var q = activeQuiz(); updateActiveQuiz({ logoImage: data }); persistQuizPatch(q.id, { logoImage: data }); flashToast("Logo uploaded"); }); }); },
    uploadBg: function () { pickImage(function (file) { readAsDataUrl(file, function (data) { var q = activeQuiz(); updateActiveQuiz({ bgImage: data }); persistQuizPatch(q.id, { bgImage: data }); flashToast("Background uploaded"); }); }); },
    uploadHero: function () { pickImage(function (file) { readAsDataUrl(file, function (data) { var q = activeQuiz(); updateActiveQuiz({ heroImage: data }); persistQuizPatch(q.id, { heroImage: data }); flashToast("Hero art uploaded"); }); }); },

    // members
    openInviteMember: function () { S.setState({ modal: { mode: "editMember", id: null, title: "Invite member", saveLabel: "Send invite", form: { name: "", email: "", role: "Editor", status: "Invited", quizzesAll: false, quizzes: [], perms: D.rolePreset("Editor") } } }); },
    openEditMember: function (id) { var mem = S.get().members.filter(function (x) { return x.id === id; })[0]; if (!mem) return; S.setState({ modal: { mode: "editMember", id: mem.id, title: "Edit member", saveLabel: "Save changes", form: { name: mem.name, email: mem.email, role: mem.role, status: mem.status, quizzesAll: mem.quizzes === "all", quizzes: Array.isArray(mem.quizzes) ? mem.quizzes.slice() : [], perms: Object.assign({}, D.effPerms(mem)) } } }); },
    mfRole: function (role) { var m = S.get().modal; S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, { role: role, perms: D.rolePreset(role), quizzesAll: (role === "Owner" || role === "Admin") ? true : m.form.quizzesAll }) }) }); },
    togglePerm: function (key) { var m = S.get().modal; var perms = Object.assign({}, m.form.perms); perms[key] = !perms[key]; S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, { perms: perms }) }) }); },
    toggleAssignAll: function () { var m = S.get().modal; S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, { quizzesAll: !m.form.quizzesAll }) }) }); },
    toggleAssignQuiz: function (id) { var m = S.get().modal; var has = m.form.quizzes.indexOf(id) !== -1; S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, { quizzes: has ? m.form.quizzes.filter(function (x) { return x !== id; }) : m.form.quizzes.concat([id]) }) }) }); },
    saveMember: function () {
      var s = S.get(), m = s.modal; if (!m) return; var f = m.form;
      if (!(f.name || "").trim()) { flashToast("Name is required"); return; }
      if (!U.emailValid(f.email)) { flashToast("A valid email is required"); return; }
      var payload = { name: f.name.trim(), email: f.email.trim(), role: f.role, status: f.status || "Invited", quizzesAll: f.quizzesAll, quizzes: f.quizzes, perms: f.perms };
      if (m.id == null) {
        api("POST", "/team", payload).then(function (member) { S.setState({ members: S.get().members.concat([member]) }); flashToast("Invite sent"); }).catch(apiError);
      } else {
        api("PUT", "/team/" + m.id, payload).then(function (member) { S.setState({ members: S.get().members.map(function (x) { return x.id === m.id ? member : x; }) }); flashToast("Member saved"); }).catch(apiError);
      }
      H.closeModal();
    },

    // submissions / view / confirm
    openViewSub: function (id) {
      var s = S.get(), sub = s.submissions.filter(function (x) { return x.id === id; })[0]; if (!sub) return;
      var quiz = s.quizzes.filter(function (q) { return q.id === sub.quizId; })[0] || s.quizzes[0] || { characters: [] };
      var c = quiz.characters.filter(function (x) { return x.key === sub.resultKey; })[0] || {};
      var card = ((c.cards || []).filter(function (cd) { return cd.id === sub.cardId; })[0]) || (c.cards || [])[0] || {};
      S.setState({ modal: { mode: "viewSub", id: sub.id, sub: sub, subGrad: c.grad || sub.color, subInitial: c.initial || (sub.result || "?")[0], subColorName: c.colorName || "—", subColor: c.color || sub.color, subPhoto: card.photo || "", subHasPhoto: !!card.photo, subArtLabel: card.caption ? card.caption : "[ PORTRAIT ]", subSource: sub.source || "Direct link", consent: sub.consent || [] } });
    },
    openViewCard: function (key, cardId) {
      var s = S.get(); var aq = activeQuiz();
      var chars = aq ? aq.characters : (s.quizzes[0] ? s.quizzes[0].characters : []);
      var c = chars.filter(function (x) { return x.key === key; })[0]; if (!c) return;
      var cd = ((c.cards || []).filter(function (x) { return x.id === cardId; })[0]) || (c.cards || [])[0] || { photo: "", caption: "" };
      S.setState({ modal: { mode: "viewCard", card: { name: c.name, initial: c.initial, grad: c.grad, color: c.color, colorName: c.colorName, blurb: c.blurb, why: c.why, photo: cd.photo || "", hasPhoto: !!cd.photo, artLabel: cd.caption || "[ PORTRAIT ]" } } });
    },
    openConfirm: function (entity, id, name, warn) {
      var map = {
        quiz: { title: "Delete quiz?", message: "“" + name + "” and its public link will be removed. This can’t be undone.", confirmLabel: "Delete quiz", done: "Quiz deleted" },
        submission: { title: "Delete submission?", message: "“" + name + "” will be permanently removed from your captured leads.", confirmLabel: "Delete", done: "Submission deleted" },
        character: { title: "Delete character?", message: "“" + name + "” will be removed as a possible result. Existing submissions keep their label.", confirmLabel: "Delete", done: "Character deleted" },
        question: { title: "Delete question?", message: "This question and all of its answers will be removed from the quiz.", confirmLabel: "Delete", done: "Question deleted" },
        member: { title: "Remove member?", message: "“" + name + "” will lose access to this workspace immediately.", confirmLabel: "Remove", done: "Member removed" },
      };
      var cfg = map[entity] || {};
      S.setState({ modal: { mode: "confirm", entity: entity, id: id, title: cfg.title, message: cfg.message, warn: warn || "", confirmLabel: cfg.confirmLabel, done: cfg.done } });
    },
    askDeleteChar: function (key) {
      var quiz = activeQuiz(); var c = quiz.characters.filter(function (x) { return x.key === key; })[0]; if (!c) return;
      var refs = 0; quiz.questions.forEach(function (q) { q.options.forEach(function (o) { if (o.scores && (key in o.scores)) refs++; }); });
      H.openConfirm("character", c.key, c.name, refs ? (refs + " answer" + (refs > 1 ? "s" : "") + " reference this character — their points will be removed.") : "");
    },
    confirmAction: function () {
      var s = S.get(), m = s.modal; if (!m) return;
      if (m.entity === "quiz") {
        S.setState({ quizzes: s.quizzes.filter(function (x) { return x.id !== m.id; }) });
        api("DELETE", "/quizzes/" + m.id).catch(apiError);
      } else if (m.entity === "submission") {
        S.setState({ submissions: s.submissions.filter(function (x) { return x.id !== m.id; }) });
        api("DELETE", "/submissions/" + m.id).catch(apiError);
      } else if (m.entity === "character") {
        var quiz = activeQuiz();
        var character = quiz.characters.filter(function (x) { return x.key === m.id; })[0];
        var characters = quiz.characters.filter(function (x) { return x.key !== m.id; });
        var questions = quiz.questions.map(function (q) { return Object.assign({}, q, { options: q.options.map(function (o) { var sc = Object.assign({}, o.scores); delete sc[m.id]; return Object.assign({}, o, { scores: sc }); }) }); });
        updateActiveQuiz({ characters: characters, questions: questions });
        if (character) api("DELETE", "/characters/" + character.id).catch(apiError);
      } else if (m.entity === "question") {
        var qz = activeQuiz(); var question = qz.questions[m.id];
        updateActiveQuiz({ questions: qz.questions.filter(function (q, i) { return i !== m.id; }) });
        if (question) api("DELETE", "/questions/" + question.id).catch(apiError);
      } else if (m.entity === "member") {
        S.setState({ members: s.members.filter(function (x) { return x.id !== m.id; }) });
        api("DELETE", "/team/" + m.id).catch(apiError);
      }
      flashToast(m.done || "Deleted"); H.closeModal();
    },
    deleteFromView: function () { var m = S.get().modal; if (m && m.sub) H.openConfirm("submission", m.sub.id, m.sub.name); },

    // report / export
    openShareReport: function () { var s = S.get(); var scope = s.activeQuizId != null ? String(s.activeQuizId) : "all"; S.setState({ modal: { mode: "shareReport", title: "Share a report", form: { scope: scope, range: "30", from: "", to: "" } } }); },
    openExportSubmissions: function () { var s = S.get(); var scope = s.activeQuizId != null ? String(s.activeQuizId) : "all"; S.setState({ modal: { mode: "exportSubmissions", title: "Export submissions", form: { scope: scope, range: "30", from: "", to: "" } } }); },
    setRange: function (v) { var m = S.get().modal; S.setState({ modal: Object.assign({}, m, { form: Object.assign({}, m.form, { range: v }) }) }); },
    generateReport: function () {
      var s = S.get(), m = s.modal; if (!m) return; var f = m.form; var rr = U.resolveRangeDays(f); if (!rr.valid) return;
      var factor = Math.min(1, rr.days / 90), src, fin, scopeName;
      if (f.scope === "all") { src = U.aggregateAnalytics(s.quizzes); fin = s.quizzes.reduce(function (a, q) { return a + q.finishers; }, 0); scopeName = "All quizzes"; }
      else { var qz = s.quizzes.filter(function (x) { return String(x.id) === String(f.scope); })[0] || s.quizzes[0]; src = qz.analytics; fin = qz.finishers; scopeName = qz.name; }
      var sv = Math.round(src.views * (0.3 + factor * 0.7)), sf = Math.round(fin * (0.3 + factor * 0.7));
      var lines = ["BABYM Quiz report", "Scope," + U.csvCell(scopeName), "Period," + U.csvCell(rr.label), "", "Metric,Value", "Page views," + sv, "Finishers," + sf, "Completion," + Math.round((sf / Math.max(1, sv)) * 100) + "%"];
      U.downloadBlob("babym-report.csv", "text/csv", lines.join("\n")); H.closeModal(); flashToast("Report downloaded (CSV)");
    },
    exportSubmissions: function () {
      var s = S.get(), m = s.modal; if (!m) return;
      var qs = new URLSearchParams();
      if (m.form.scope !== "all") qs.set("quiz_id", m.form.scope);
      if (m.form.range === "custom") { if (m.form.from) qs.set("from", m.form.from); if (m.form.to) qs.set("to", m.form.to); }
      window.location.href = "/api/submissions/export?" + qs.toString();
      H.closeModal();
    },
    closeModal: function () { S.setState({ modal: null }); },
  };
  A.H = H;

  function updateActiveQuizById(id, patch) {
    S.setState({ quizzes: S.get().quizzes.map(function (q) { return q.id === id ? Object.assign({}, q, patch) : q; }) });
  }

  /** After a character save, push any card photos picked via cardUpload's local preview
      up to the server (matched by array position — the server preserves card order). */
  function uploadPendingCardPhotos(character, formCards) {
    formCards.forEach(function (fc, i) {
      if (!fc.pendingFile) return;
      var card = character.cards[i]; if (!card) return;
      var fd = new FormData(); fd.append("photo", fc.pendingFile);
      apiUpload("/cards/" + card.id + "/photo", fd).then(function (res) {
        var s = S.get();
        S.setState({ quizzes: s.quizzes.map(function (q) {
          return Object.assign({}, q, { characters: q.characters.map(function (c) {
            if (c.key !== character.key) return c;
            return Object.assign({}, c, { cards: c.cards.map(function (cd, j) { return j === i ? Object.assign({}, cd, { photo: res.photo_url }) : cd; }) });
          }) });
        }) });
      }).catch(apiError);
    });
  }

  // ---------- view model ----------
  function computeVals(s) {
    var inWorkspace = s.activeQuizId != null;
    var aq = s.quizzes.filter(function (q) { return q.id === s.activeQuizId; })[0] || null;
    var quizNameById = {}; s.quizzes.forEach(function (qz) { quizNameById[qz.id] = qz.name; });

    // The two axes of the card matrix. Each is the option list of the question the
    // quiz designates for that dimension; an undesignated axis has no options.
    var dimQuestion = function (id) {
      if (!aq || id == null) return null;
      return aq.questions.filter(function (q) { return String(q.id) === String(id); })[0] || null;
    };
    var outfitQuestion = dimQuestion(aq && aq.outfitQuestionId);
    var poseQuestion = dimQuestion(aq && aq.poseQuestionId);
    var outfitOpts = outfitQuestion ? (outfitQuestion.options || []) : [];
    var poseOpts = poseQuestion ? (poseQuestion.options || []) : [];
    var gridQuestions = aq ? aq.questions.filter(function (q) { return q.layout === "grid"; }) : [];

    var navItems = [["dashboard", "Dashboard", "▦"], ["quizzes", "Quizzes", "≡"], ["submissions", "Submissions", "⭳"], ["analytics", "Analytics", "◔"], ["team", "Team & roles", "⚇"]]
      .map(function (n) { return { key: n[0], label: n[1], icon: n[2], href: "admin-" + n[0] + ".html", active: !inWorkspace && n[0] === s.adminScreen }; });
    var qsuffix = inWorkspace ? ("?quiz=" + s.activeQuizId) : "";
    var workspaceTabs = [["overview", "Overview"], ["builder", "Questions"], ["results", "Results & scoring"], ["design", "Design & share"], ["submissions", "Submissions"], ["analytics", "Analytics"]]
      .map(function (w) { return { key: w[0], label: w[1], href: "admin-" + w[0] + ".html" + qsuffix, active: s.workspaceScreen === w[0] }; });

    var adminTitle, adminSubtitle, adminAction;
    if (inWorkspace && aq) {
      var wm = { overview: ["Overview", "Public link, QR and quiz summary", "✓ Publish"], builder: ["Question builder", aq.questions.length + " question" + (aq.questions.length === 1 ? "" : "s"), "+ New question"], results: ["Results & scoring", "Members, colorways and photo cards", "+ New character"], design: ["Design & share", "Everything the fan sees: palette, copy, branding, consent & share", "✓ Publish"], submissions: ["Submissions", "Finishers of this quiz", "⭳ Export to Excel"], analytics: ["Analytics", "Funnel, drop-off and sources", "↗ Share report"] };
      var cfg = wm[s.workspaceScreen] || wm.overview; adminTitle = cfg[0]; adminSubtitle = cfg[1]; adminAction = cfg[2];
    } else {
      var gm = { dashboard: ["Dashboard", "Campaign performance across all quizzes", "↗ Share report"], quizzes: ["Quizzes", "All quizzes and their public links", "+ New quiz"], submissions: ["Submissions", s.submissions.length + " finishers captured", "⭳ Export to Excel"], analytics: ["Overall analytics", "Aggregated across all quizzes", "↗ Share report"], team: ["Team & roles", s.members.length + " people with access", "+ Invite member"] };
      var cfg2 = gm[s.adminScreen] || gm.dashboard; adminTitle = cfg2[0]; adminSubtitle = cfg2[1]; adminAction = cfg2[2];
    }

    var quizTerm = (s.quizSearch || "").trim().toLowerCase();
    var quizScope = !quizTerm ? s.quizzes : s.quizzes.filter(function (qz) { return (qz.name + " " + qz.slug).toLowerCase().indexOf(quizTerm) !== -1; });
    var perQuiz = 5, quizTotalPages = Math.max(1, Math.ceil(quizScope.length / perQuiz)), quizPage = Math.min(s.quizPage, quizTotalPages);
    var qStart = (quizPage - 1) * perQuiz, qEnd = Math.min(qStart + perQuiz, quizScope.length);
    var quizRows = quizScope.slice(qStart, qEnd).map(function (qz) { return { id: qz.id, name: qz.name, qcount: qz.questions.length + " question" + (qz.questions.length === 1 ? "" : "s"), url: "babym.link/" + qz.slug, finishers: U.fmt(qz.finishers), status: qz.status }; });
    var quizPagerInfo = quizScope.length ? ("Showing " + (qStart + 1) + "–" + qEnd + " of " + quizScope.length) : "No quizzes";

    var subTerm = (s.subSearch || "").trim().toLowerCase();
    var subScope;
    if (inWorkspace && aq) subScope = s.submissions.filter(function (x) { return x.quizId === aq.id && (!subTerm || (x.name + " " + x.email).toLowerCase().indexOf(subTerm) !== -1); });
    else { var qf = s.subQuizFilter || "all"; subScope = s.submissions.filter(function (x) { return (qf === "all" || String(x.quizId) === String(qf)) && (!subTerm || (x.name + " " + x.email).toLowerCase().indexOf(subTerm) !== -1); }); }
    var perSub = 10, subTotalPages = Math.max(1, Math.ceil(subScope.length / perSub)), subPage = Math.min(s.subPage, subTotalPages);
    var sStart = (subPage - 1) * perSub, sEnd = Math.min(sStart + perSub, subScope.length);
    var subRows = subScope.slice(sStart, sEnd).map(function (sub) { return { id: sub.id, name: sub.name, email: sub.email, quizName: quizNameById[sub.quizId] || "—", result: sub.result, color: sub.color, date: sub.date }; });
    var subPagerInfo = subScope.length ? ("Showing " + (sStart + 1) + "–" + sEnd + " of " + subScope.length) : "No submissions";
    var subFilterQuizzes = [{ value: "all", label: "All quizzes" }].concat(s.quizzes.map(function (qz) { return { value: String(qz.id), label: qz.name }; }));

    var distScope = (inWorkspace && aq) ? s.submissions.filter(function (x) { return x.quizId === aq.id; }) : s.submissions;
    var distChars = (inWorkspace && aq) ? aq.characters : (s.quizzes[0] ? s.quizzes[0].characters : []);
    var counts = {}; distScope.forEach(function (x) { counts[x.resultKey] = (counts[x.resultKey] || 0) + 1; });
    var distMax = Math.max.apply(null, [1].concat(Object.keys(counts).map(function (k) { return counts[k]; }))), distTotal = distScope.length || 1;
    var resultDist = distChars.map(function (c) { var n = counts[c.key] || 0; return { name: c.name, pct: Math.round((n / distTotal) * 100) + "%", width: Math.round((n / distMax) * 100) + "%", color: c.color, n: n }; }).sort(function (a, b) { return b.n - a.n; });

    var srcCounts = {}; distScope.forEach(function (x) { srcCounts[x.source] = (srcCounts[x.source] || 0) + 1; });
    var srcTotal = distScope.length || 1, srcMax = Math.max.apply(null, [1].concat(Object.keys(srcCounts).map(function (k) { return srcCounts[k]; })));
    var sourceDist = Object.keys(srcCounts).sort(function (a, b) { return srcCounts[b] - srcCounts[a]; }).map(function (name) { return { name: name, pct: Math.round((srcCounts[name] / srcTotal) * 100) + "%", width: Math.round((srcCounts[name] / srcMax) * 100) + "%" }; });

    var timeVals = distScope.map(function (x) { return x.timeSpent; }).filter(function (v) { return typeof v === "number"; });
    var avgSec = timeVals.length ? Math.round(timeVals.reduce(function (a, b) { return a + b; }, 0) / timeVals.length) : 0;
    var avgTimeStr = timeVals.length ? (Math.floor(avgSec / 60) + "m " + String(avgSec % 60).padStart(2, "0") + "s") : "—";
    var uniqEmails = {}; distScope.forEach(function (x) { var e = (x.email || "").toLowerCase(); if (e && e !== "(not captured)") uniqEmails[e] = 1; });
    var uniqueParticipants = Object.keys(uniqEmails).length;

    var anaSource = (inWorkspace && aq) ? aq.analytics : U.aggregateAnalytics(s.quizzes);
    var anaFinishers = (inWorkspace && aq) ? aq.finishers : s.quizzes.reduce(function (a, q) { return a + q.finishers; }, 0);
    var funnel = [
      { label: "Viewed landing", value: U.fmt(anaSource.views), width: "100%", color: "#8a6bff" },
      { label: "Started quiz", value: U.fmt(anaSource.starts), width: U.pctW(anaSource.starts, anaSource.views), color: "#a98cff" },
      { label: "Reached gate", value: U.fmt(anaSource.gateReached), width: U.pctW(anaSource.gateReached, anaSource.views), color: "#ff9bc0" },
      { label: "Finished", value: U.fmt(anaFinishers), width: U.pctW(anaFinishers, anaSource.views), color: "#ff77a9" },
    ];
    var completionPct = Math.round((anaFinishers / Math.max(1, anaSource.views)) * 100) + "%";
    var statCards = [
      { label: "Page views", value: U.fmt(anaSource.views), delta: "" },
      { label: "Finishers", value: U.fmt(anaFinishers), delta: "" },
      { label: "Completion rate", value: completionPct, delta: "" },
      { label: "Unique participants", value: U.fmt(uniqueParticipants), delta: "" },
    ];
    var totalFinAll = s.quizzes.reduce(function (a, q) { return a + q.finishers; }, 0);
    var trendRaw = []; for (var ti = 13; ti >= 0; ti--) { var h = 0, str = "trend-" + ti; for (var k = 0; k < str.length; k++) h = (h * 31 + str.charCodeAt(k)) & 1023; trendRaw.push(Math.round((totalFinAll / 55) * (0.68 + (h / 1023) * 0.7))); }
    var trendMax = Math.max.apply(null, [1].concat(trendRaw));
    var trendBars = trendRaw.map(function (v, i) { return { height: Math.max(5, Math.round((v / trendMax) * 100)) + "%", value: U.fmt(v), label: i === 0 ? "14d" : (i === 13 ? "now" : "") }; });
    var topQuizzes = s.quizzes.slice().sort(function (a, b) { return b.finishers - a.finishers; }).slice(0, 5).map(function (qz) { var comp = Math.round((qz.finishers / Math.max(1, qz.analytics.views)) * 100); return { id: qz.id, name: qz.name, finishers: U.fmt(qz.finishers), status: qz.status, comp: comp + "%" }; });
    var recentActivity = s.submissions.slice(0, 6).map(function (x) { return { name: x.name, result: x.result, color: x.color, quiz: quizNameById[x.quizId] || "—", date: x.date }; });
    var dropoff = anaSource.perQuestionReached.map(function (n, i) { var pct = Math.round((n / Math.max(1, anaSource.perQuestionReached[0])) * 100); return { q: "Q" + (i + 1), pct: pct + "%", height: pct + "%" }; });
    var analyticsCards = [{ label: "Total attempts", value: U.fmt(anaSource.starts) }, { label: "Unique participants", value: U.fmt(uniqueParticipants) }, { label: "Completion rate", value: completionPct }, { label: "Avg. time spent", value: avgTimeStr }];
    var anaCharsForCount = (inWorkspace && aq) ? aq.characters : (s.quizzes[0] ? s.quizzes[0].characters : []);
    var totalCards = anaCharsForCount.reduce(function (a, c) { return a + ((c.cards && c.cards.length) || 1); }, 0);
    var analyticsCards2 = [{ label: "Finishers", value: U.fmt(anaFinishers) }, { label: "Est. shares", value: U.fmt(Math.round(anaFinishers * 0.39)) }, { label: "Photo cards", value: totalCards }, { label: "Questions", value: (inWorkspace && aq) ? aq.questions.length : (s.quizzes[0] ? s.quizzes[0].questions.length : 0) }];
    var mostCommon = (inWorkspace && aq) ? aq.questions.map(function (qq, i) { var idx = qq.options.length ? ((i * 7 + 3) % qq.options.length) : 0; var opt = qq.options[idx] || {}; var share = qq.options.length ? (58 - (i % 4) * 5) : 0; return { q: "Q" + (i + 1), title: qq.title, answer: opt.label || "—", pct: share + "%", width: share + "%" }; }) : [];

    var anaChars = (inWorkspace && aq) ? aq.characters : (s.quizzes[0] ? s.quizzes[0].characters : []);
    var anaVariants = []; anaChars.forEach(function (c) { var cards = (c.cards && c.cards.length) ? c.cards : [{ id: c.key + "-1", photo: "", caption: "" }]; cards.forEach(function (cd, idx) { anaVariants.push({ member: c, card: cd, idx: idx }); }); });
    var vCounts = {}; distScope.forEach(function (x) { var kk = x.cardId || (x.resultKey + "-1"); vCounts[kk] = (vCounts[kk] || 0) + 1; });
    function mkRow(v, n) { return { key: v.member.key, cardId: v.card.id, name: v.member.name + " · " + (v.card.caption || ("Card " + (v.idx + 1))), color: v.member.color, photo: v.card.photo || "", hasPhoto: !!v.card.photo, initial: v.member.initial, n: n }; }
    var cardDistAll;
    if (distScope.length) {
      var cnts = anaVariants.map(function (v) { return vCounts[v.card.id] || 0; });
      var cmax = Math.max.apply(null, [1].concat(cnts)), ctot = distScope.length;
      cardDistAll = anaVariants.map(function (v, i) { var n = cnts[i]; var r = mkRow(v, n); r.pct = Math.round((n / ctot) * 100) + "%"; r.width = Math.round((n / cmax) * 100) + "%"; return r; }).sort(function (a, b) { return b.n - a.n; });
    } else {
      var weights = anaVariants.map(function (v, i) { return 24 - i * 2 + (String(v.member.key).charCodeAt(0) % 6); });
      var wtot = weights.reduce(function (a, b) { return a + b; }, 0) || 1, wmax = Math.max.apply(null, [1].concat(weights));
      cardDistAll = anaVariants.map(function (v, i) { var r = mkRow(v, weights[i]); r.pct = Math.round((weights[i] / wtot) * 100) + "%"; r.width = Math.round((weights[i] / wmax) * 100) + "%"; return r; }).sort(function (a, b) { return b.n - a.n; });
    }
    var perCardDist = 5, cardDistTotalPages = Math.max(1, Math.ceil(cardDistAll.length / perCardDist)), cardDistPage = Math.min(s.cardDistPage || 1, cardDistTotalPages);
    var cdStart = (cardDistPage - 1) * perCardDist, cdEnd = Math.min(cdStart + perCardDist, cardDistAll.length);
    var cardDist = cardDistAll.slice(cdStart, cdEnd);
    var cardDistPagerInfo = cardDistAll.length ? ("Showing " + (cdStart + 1) + "–" + cdEnd + " of " + cardDistAll.length) : "No cards";

    var charList = aq ? aq.characters : [];
    var characterCards = charList.map(function (c) {
      var cards = (c.cards && c.cards.length) ? c.cards : [{ id: c.key + "-1", photo: "", caption: "" }];
      var withPhoto = cards.filter(function (cd) { return cd.photo; }).length;
      // Surface matrix completeness: an empty slot is a combination a fan can
      // reach but that has no artwork behind it.
      var expected = (outfitOpts.length && poseOpts.length) ? (outfitOpts.length * poseOpts.length) : cards.length;
      return { key: c.key, name: c.name, grad: c.grad, color: c.color, colorName: c.colorName, blurb: c.blurb, initial: c.initial,
        artStatus: withPhoto + " of " + expected + " card" + (expected === 1 ? "" : "s") + " have an image",
        gallery: cards.map(function (cd, i) { return { photo: cd.photo || "", hasPhoto: !!cd.photo, caption: cd.caption || ("Card " + (i + 1)) }; }) };
    });

    var qList = aq ? aq.questions : [];
    var bPerPage = 8, bTotalPages = Math.max(1, Math.ceil(qList.length / bPerPage)), builderPage = Math.min(s.builderPage || 1, bTotalPages);
    var bStart = (builderPage - 1) * bPerPage, bEnd = Math.min(bStart + bPerPage, qList.length);
    var questionRail = qList.map(function (qq, i) { return { page: Math.floor(i / bPerPage) + 1, num: "Q" + (i + 1), title: qq.title, count: qq.options.length + "a", active: Math.floor(i / bPerPage) + 1 === builderPage }; });
    var nameOf = {}; charList.forEach(function (c) { nameOf[c.key] = c.name; });
    var builderQuestions = qList.map(function (qq, i) {
      var isGrid = qq.layout === "grid";
      var clothingUploaded = isGrid ? qq.options.filter(function (o) { return !!o.img; }).length : 0;
      return {
        index: i, num: "Q" + (i + 1), title: qq.title, isGrid: isGrid, layoutLabel: isGrid ? "Grid — outfit / image answers" : "List — text answers",
        clothingStatus: isGrid ? (clothingUploaded + " of " + D.CLOTHING_SET_SIZE + " clothing images uploaded") : "",
        answers: qq.options.map(function (o, oi) {
          return { oi: oi, badge: o.badge, label: o.label, isGrid: isGrid, hasImg: !!o.img, imgSrc: o.img || "", imgLabel: o.img ? "Replace outfit image" : "Add outfit image",
            canAddTarget: Object.keys(o.scores || {}).length < charList.length,
            availableTargets: charList.filter(function (c) { return !(c.key in (o.scores || {})); }).map(function (c) { return { value: c.key, name: c.name }; }),
            scores: Object.keys(o.scores || {}).map(function (kk) { return { key: kk, name: nameOf[kk] || kk, pts: o.scores[kk] }; }) };
        }),
      };
    }).slice(bStart, bEnd);
    var builderPagerShow = bTotalPages > 1, builderPagerInfo = qList.length ? ("Questions " + (bStart + 1) + "–" + bEnd + " of " + qList.length) : "No questions";

    var esignEnabled = aq ? aq.esign.enabled : false;
    var consentEditItems = aq ? aq.esign.items.map(function (it) { return { id: it.id, text: it.text, required: it.required }; }) : [];

    var dz = aq ? aq.design : {};
    var designSwatches = [
      { label: "Background", field: "bg", color: dz.bg || "#F2E9FF", hex: (dz.bg || "#F2E9FF").toUpperCase() },
      { label: "Buttons", field: "button", color: dz.button || "#7C5CFF", hex: (dz.button || "#7C5CFF").toUpperCase() },
      { label: "Text", field: "text", color: dz.text || "#2B2540", hex: (dz.text || "#2B2540").toUpperCase() },
      { label: "Accent", field: "accent", color: dz.accent || "#5B3FD6", hex: (dz.accent || "#5B3FD6").toUpperCase() },
    ];
    var cp = aq ? U.copyOf(aq) : D.defaultCopy();
    var fcFields = U.fieldsOf(aq || {}), fcChannels = U.channelsOf(aq || {});
    var rawSections = [
      { key: "landing", title: "Landing screen", fields: [["membersLabel", 'Badge — "members" word'], ["matchLabel", "Badge — match line"], ["startMeta", 'Time estimate (after "N questions ·")']] },
      { key: "gate", title: "Lead-capture gate", fields: [["gateHeading", "Heading"], ["gateSub", "Subtext", 1], ["emailLabel", "Email label"], ["emailPh", "Email placeholder"], ["firstLabel", "First-name label"], ["firstPh", "First-name placeholder"], ["lastLabel", "Last-name label"], ["lastPh", "Last-name placeholder"], ["privacyNote", "Privacy note", 1], ["gateButton", "Submit button"]] },
      { key: "result", title: "Result screen", fields: [["resultLabel", "Reveal label"], ["loadingLabel", "Loading text"], ["whyLabel", '"Why" prefix'], ["copyLinkLabel", "Copy-link button"], ["downloadLabel", "Download button"], ["retakeLabel", "Retake button"]] },
    ];
    var fanCopySections = rawSections.map(function (sec) { return { key: sec.key, title: sec.title, open: s.openCopySection === sec.key, chevron: s.openCopySection === sec.key ? "▾" : "▸", fields: sec.fields.map(function (f) { return { key: f[0], label: f[1], value: cp[f[0]], multiline: !!f[2] }; }) }; });
    var fieldToggles = ["first", "last"].map(function (w) { return { which: w, label: w === "first" ? "First name" : "Last name", show: fcFields[w].show, required: fcFields[w].required }; });
    var channelControls = fcChannels.map(function (c, i) { return { key: c.key, label: c.label, on: c.on, canUp: i > 0, canDown: i < fcChannels.length - 1 }; });
    var previewTabs = [["landing", "Landing"], ["gate", "Gate"], ["consent", "Consent"], ["result", "Result"]].map(function (t) { return { key: t[0], label: t[1], active: s.previewScreen === t[0] }; });
    var pvChar = (aq && aq.characters[0]) ? aq.characters[0] : null;
    var pvConsentItems = (aq && aq.esign && aq.esign.items.length) ? aq.esign.items.map(function (it) { return typeof it === "string" ? it : it.text; }) : ["I agree to the terms and privacy policy."];
    var pvPhoto = (pvChar && pvChar.cards && pvChar.cards[0]) ? pvChar.cards[0].photo : "";
    var pvResult = pvChar ? { name: pvChar.name, initial: pvChar.initial, colorName: pvChar.colorName, color: pvChar.color, grad: pvChar.grad, photo: pvPhoto || "", hasPhoto: !!pvPhoto } : { name: "RORA", initial: "R", colorName: "Lilac", color: "#a98cff", grad: "linear-gradient(155deg,#a98cff,#6f4fd8)", photo: "", hasPhoto: false };
    var shareChannelsPv = fcChannels.filter(function (c) { return c.on; });

    var memberTerm = (s.memberSearch || "").trim().toLowerCase();
    var memberScope = !memberTerm ? s.members : s.members.filter(function (mem) { return (mem.name + " " + mem.email).toLowerCase().indexOf(memberTerm) !== -1; });
    var perMember = 4, memberTotalPages = Math.max(1, Math.ceil(memberScope.length / perMember)), memberPage = Math.min(s.memberPage || 1, memberTotalPages);
    var mStart = (memberPage - 1) * perMember, mEnd = Math.min(mStart + perMember, memberScope.length);
    var memberRows = memberScope.slice(mStart, mEnd).map(function (mem) {
      var initials = (mem.name || "").trim().split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
      return { id: mem.id, name: mem.name, email: mem.email, initials: initials, role: mem.role, status: mem.status, assigned: mem.quizzes === "all" ? "All quizzes" : (mem.quizzes.map(function (id) { return quizNameById[id]; }).filter(Boolean).join(", ") || "None"), canRemove: mem.role !== "Owner" };
    });
    var memberPagerInfo = memberScope.length ? ("Showing " + (mStart + 1) + "–" + mEnd + " of " + memberScope.length) : "No members";
    var roleLegend = [["Owner", "Full access + billing & team"], ["Admin", "All quizzes, submissions & team"], ["Editor", "Build & edit assigned quizzes"], ["Viewer", "Read-only on assigned quizzes"]].map(function (r) { return { role: r[0], desc: r[1] }; });

    var meInitials = s.me ? (s.me.name || "").trim().split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase() : "";

    return {
      inWorkspace: inWorkspace, aq: aq, navItems: navItems, navOpen: s.navOpen,
      meName: s.me ? s.me.name : "", meRole: s.me ? s.me.role : "", meInitials: meInitials,
      workspaceQuizName: aq ? aq.name : "", workspaceTabs: workspaceTabs, workspaceStatus: aq ? aq.status : "",
      workspaceMeta: aq ? (U.fmt(aq.finishers) + " finishers · babym.link/" + aq.slug) : "", workspaceUrl: aq ? "https://babym.link/" + aq.slug : "",
      adminTitle: adminTitle, adminSubtitle: adminSubtitle, adminAction: adminAction,
      isDashboard: !inWorkspace && s.adminScreen === "dashboard", isQuizzes: !inWorkspace && s.adminScreen === "quizzes",
      isSubmissions: (!inWorkspace && s.adminScreen === "submissions") || (inWorkspace && s.workspaceScreen === "submissions"),
      isAnalytics: (!inWorkspace && s.adminScreen === "analytics") || (inWorkspace && s.workspaceScreen === "analytics"),
      isOverview: inWorkspace && s.workspaceScreen === "overview", isBuilder: inWorkspace && s.workspaceScreen === "builder",
      isResults: inWorkspace && s.workspaceScreen === "results", isDesign: inWorkspace && s.workspaceScreen === "design",
      isTeam: !inWorkspace && s.adminScreen === "team",
      statCards: statCards, funnel: funnel, resultDist: resultDist, submissionCount: distScope.length,
      trendBars: trendBars, topQuizzes: topQuizzes, recentActivity: recentActivity,
      analyticsCards: analyticsCards, analyticsCards2: analyticsCards2, dropoff: dropoff, sourceDist: sourceDist,
      mostCommon: mostCommon, cardDist: cardDist, cardDistPager: { info: cardDistPagerInfo, page: cardDistPage, total: cardDistTotalPages },
      quizRows: quizRows, quizPager: { info: quizPagerInfo, page: quizPage, total: quizTotalPages }, noQuizzes: quizScope.length === 0, quizSearchVal: s.quizSearch, quizSearching: !!s.quizSearching,
      subRows: subRows, subPager: { info: subPagerInfo, page: subPage, total: subTotalPages }, noSubmissions: subScope.length === 0, subSearching: !!s.subSearching,
      showSubFilter: !inWorkspace, subFilterQuizzes: subFilterQuizzes, subQuizFilterVal: s.subQuizFilter, subSearchVal: s.subSearch,
      overviewStats: aq ? [{ label: "Finishers", value: U.fmt(aq.finishers) }, { label: "Questions", value: aq.questions.length }, { label: "Characters", value: aq.characters.length }] : [],
      // Derived from the quiz's actual dimension questions, not the constants —
      // a card is one (outfit x pose) slot, so images per member MULTIPLY.
      poseSetSize: poseOpts.length, clothingSetSize: outfitOpts.length, imagesPerMember: outfitOpts.length * poseOpts.length,
      outfitOpts: outfitOpts, poseOpts: poseOpts,
      outfitQuestionId: aq ? (aq.outfitQuestionId || "") : "", poseQuestionId: aq ? (aq.poseQuestionId || "") : "",
      gridQuestionChoices: gridQuestions.map(function (q) { return { id: q.id, title: q.title }; }),
      matrixConfigured: outfitOpts.length > 0 && poseOpts.length > 0,
      matrixHint: (outfitOpts.length > 0 && poseOpts.length > 0)
        ? ("Each member needs " + outfitOpts.length + " × " + poseOpts.length + " = " + (outfitOpts.length * poseOpts.length) + " images. A fan's answers to these two questions pick exactly one.")
        : "Pick two different grid questions. Their answers become the outfit and pose axes of every member's card matrix.",
      overviewQ: aq ? aq.questions.length : 0, overviewC: aq ? aq.characters.length : 0, overviewCards: aq ? aq.characters.reduce(function (a, c) { return a + ((c.cards && c.cards.length) || 1); }, 0) : 0,
      overviewGate: aq ? (aq.gateEnabled ? "On" : "Off") : "", overviewEsign: aq ? (aq.esign.enabled ? "On (" + aq.esign.items.length + " items)" : "Off") : "",
      qrCells: U.qrCells(aq ? aq.slug : "quiz"),
      questionRail: questionRail, builderQuestions: builderQuestions, builderPager: { show: builderPagerShow, info: builderPagerInfo, page: builderPage, total: bTotalPages }, noQuestions: qList.length === 0, noCharacters: charList.length === 0,
      characterCards: characterCards,
      designSwatches: designSwatches, designLogo: aq ? (aq.logo || "BABYM") : "BABYM",
      designBg: dz.bg || "#F2E9FF", designButton: dz.button || "#7C5CFF", designText: dz.text || "#2B2540", designAccent: dz.accent || "#5B3FD6",
      designHeroGrad: "linear-gradient(155deg, " + U.shade(dz.button || "#7c5cff", 24) + ", " + (dz.button || "#6f4fd8") + " 68%, " + (dz.accent || "#ff9bc0") + ")",
      designHeadline: aq ? (aq.headline || "WHICH BABYM ARE YOU?") : "", designTagline: aq ? (aq.tagline || ("A " + aq.questions.length + "-question vibe check that reveals your BABYM member and your signature colorway.")) : "",
      designStartLabel: aq ? (aq.startLabel || "Start the vibe check →") : "", designHashtag: aq ? (aq.hashtag || "") : "", designBadge: aq ? (aq.badge || "K-POP VIBE CHECK") : "",
      hasDesignHashtag: !!(aq && (aq.hashtag || "").trim()),
      shareCopy: aq ? aq.shareCopy : "", sharePreview: aq ? (aq.shareCopy || "I got my BABYM match!") : "",
      hasLogoImg: !!(aq && aq.logoImage), logoImgSrc: (aq && aq.logoImage) || "", hasBgImg: !!(aq && aq.bgImage), bgImgSrc: (aq && aq.bgImage) || "",
      hasHeroImg: !!(aq && aq.heroImage), heroImgSrc: (aq && aq.heroImage) || "",
      showMembersBadgeVal: aq ? (aq.showMembersBadge !== false) : true, membersLabelVal: cp.membersLabel, matchLabelVal: cp.matchLabel, membersCount: aq ? aq.characters.length : 0,
      fanCopySections: fanCopySections, fieldToggles: fieldToggles, channelControls: channelControls, previewTabs: previewTabs, previewScreen: s.previewScreen,
      pvConsentItems: pvConsentItems, pvResultData: pvResult, shareChannelsPv: shareChannelsPv,
      cp: cp, pvShowFirst: fcFields.first.show, pvShowLast: fcFields.last.show,
      esignEnabled: esignEnabled, consentEditItems: consentEditItems, consentNoItems: !!(aq && aq.esign.enabled && aq.esign.items.length === 0),
      consentHeadingVal: cp.consentHeading, consentSubVal: cp.consentSub,
      gateEnabled: aq ? !!aq.gateEnabled : true, showCopyLinkVal: aq ? (aq.showCopyLink !== false) : true, showDownloadVal: aq ? (aq.showDownload !== false) : true,
      memberRows: memberRows, memberPager: { info: memberPagerInfo, page: memberPage, total: memberTotalPages }, memberSearchVal: s.memberSearch, memberSearching: !!s.memberSearching, roleLegend: roleLegend, noMembers: memberScope.length === 0,
    };
  }
  A.computeVals = computeVals;

  // ---------- bootstrap: auth check + this page's data + live socket ----------
  function connectRealtime() {
    if (!window.io) return;
    api("GET", "/realtime/token").then(function (res) {
      // Rooms are authorized server-side inside the token — the client does not
      // ask to join them.
      var socket = window.io({ path: "/socket.io/", auth: { token: res.token } });
      socket.on("analytics:changed", debounce(refetchAnalyticsAffectedData, 800));
      socket.on("submission:new", function (payload) {
        var s = S.get();
        if (s.adminScreen === "dashboard" || s.adminScreen === "submissions" || s.adminScreen === "analytics" || s.workspaceScreen === "submissions" || s.workspaceScreen === "analytics") {
          S.setState({ submissions: [payload].concat(s.submissions) });
        }
      });
      A._socket = socket;
    }).catch(function () {});
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); var args = arguments; t = setTimeout(function () { fn.apply(null, args); }, ms); }; }
  function refetchAnalyticsAffectedData() {
    var s = S.get();
    if (s.adminScreen !== "dashboard" && s.adminScreen !== "analytics" && s.workspaceScreen !== "analytics") return;
    api("GET", "/quizzes").then(function (quizzes) { S.setState({ quizzes: quizzes }); }).catch(function () {});
  }

  function bootstrap() {
    var isLoginPage = /admin-login/.test(location.pathname);
    api("GET", "/auth/me").then(function (me) {
      if (isLoginPage) { location.href = "admin-dashboard.html"; return; }
      var fetches = [api("GET", "/quizzes")];
      var needsSubmissions = ["dashboard", "submissions", "analytics"].indexOf(S.get().adminScreen) !== -1 || ["submissions", "analytics"].indexOf(S.get().workspaceScreen) !== -1;
      var needsTeam = S.get().adminScreen === "team";
      if (needsSubmissions) {
        var qp = S.get().activeQuizId;
        fetches.push(api("GET", qp ? "/quizzes/" + qp + "/submissions" : "/submissions").then(function (res) { return res.data || []; }));
      } else fetches.push(Promise.resolve(S.get().submissions));
      if (needsTeam) fetches.push(api("GET", "/team")); else fetches.push(Promise.resolve(S.get().members));

      return Promise.all(fetches).then(function (r) {
        S.setState({ booting: false, authed: true, me: me, quizzes: r[0], submissions: r[1], members: r[2] });
        connectRealtime();
      });
    }).catch(function () {
      if (isLoginPage) { S.setState({ booting: false }); return; }
      var next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
      location.href = "admin-login.html?next=" + next;
    });
  }
  A.bootstrap = bootstrap;

  // ---------- shared builders ----------
  A.CARD = "background:#fff;border:1px solid #ececf3;border-radius:14px;";
  A.pagerRow = function (pg, name) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#faf9fd;flex-wrap:wrap;gap:8px;"><div style="font-size:12px;color:#9a93b8;">' + esc(pg.info) + '</div><div style="display:flex;gap:6px;">' + C.pager(U.buildPager(pg.page, pg.total), name) + "</div></div>";
  };
  A.tableHead = function (cols, gridCols) {
    return '<div class="hidden md:grid" style="grid-template-columns:' + gridCols + ';gap:12px;padding:14px 20px;background:#faf9fd;border-bottom:1px solid #ececf3;font-size:11px;font-weight:700;letter-spacing:.6px;color:#9a93b8;">' +
      cols.map(function (c, i) { return "<div" + (i === cols.length - 1 ? ' style="text-align:right;"' : "") + ">" + esc(c) + "</div>"; }).join("") + "</div>";
  };
})();
