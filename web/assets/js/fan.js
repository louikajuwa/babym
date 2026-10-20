/* fan.js — public quiz app. Uses window.Data/Utils/Store/C. Quiz definition, tracking events,
   and the final submission all go through the real API (routes/web.php under /api). */
(function () {
  "use strict";
  var D = window.Data, U = window.Utils, S = window.Store, C = window.C;
  var $ = window.jQuery;
  var esc = C.esc, attr = C.attr;
  var RESULT_REVEAL = "Suspense";
  var timers = { rt: null, tt: null, adv: null, fit: null };
  function clearTimers() { clearTimeout(timers.rt); clearTimeout(timers.tt); clearTimeout(timers.adv); }
  var lastScreenKey = null;

  function slugFromUrl() { return new URLSearchParams(location.search).get("quiz") || "vibe"; }
  function visitorId() {
    try {
      if (!window.sessionStorage.getItem("bm_visitor")) window.sessionStorage.setItem("bm_visitor", (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()));
      return window.sessionStorage.getItem("bm_visitor");
    } catch (e) { return String(Date.now()); }
  }

  function api(path, opts) {
    return fetch("/api" + path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); });
  }
  function track(eventType, questionIndex) {
    var quiz = fanQuiz(); if (!quiz) return;
    api("/quiz/" + encodeURIComponent(quiz.slug) + "/events", { method: "POST", body: JSON.stringify({ visitorId: visitorId(), eventType: eventType, questionIndex: questionIndex }) });
  }

  var initial = { booting: true, loadError: "", fanScreen: "landing", quiz: null, qIndex: 0, answers: [], startedAt: null,
    gateDone: false, consentDone: false, consentChecked: {}, consentTouched: false,
    recorded: false, result: null, gateTouched: false, revealing: false, toast: "",
    form: { email: "", first: "", last: "" } };

  function fanQuiz() { return S.get().quiz; }

  // ---------- fan flow handlers ----------
  function localPreview() {
    // Client-side best guess for the live per-question progress UX only — the
    // server recomputes the authoritative result from raw answers on submit.
    var quiz = fanQuiz();
    if (!quiz || !quiz.characters.length) return { name: "—", initial: "?", colorName: "—", color: "#8a6bff", grad: "linear-gradient(155deg,#a98cff,#6f4fd8)", blurb: "", why: "", cards: [{ id: "x-1", photo: "", caption: "" }] };
    // scoreWinner() indexes q.options[optIndex], so it needs the raw option
    // INDEX per question — state stores {questionId, optionIndex, optionId}
    // objects. Passing those objects straight through silently scored nothing
    // (q.options[{...}] is undefined), so the preview always showed the first
    // character regardless of the answers.
    var answersByIndex = S.get().answers.map(function (a) {
      return (a && a.optionIndex != null) ? a.optionIndex : null;
    });
    return U.scoreWinner(quiz.characters, quiz.questions, answersByIndex);
  }
  function flashToast(msg) { S.setState({ toast: msg }); clearTimeout(timers.tt); timers.tt = setTimeout(function () { S.setState({ toast: "" }); }, 1900); }

  var H = {
    startQuiz: function () {
      S.setState({ fanScreen: "quiz", qIndex: 0, answers: [], gateDone: false, consentDone: false, consentChecked: {}, recorded: false, result: null, startedAt: Date.now() });
      track("start");
    },
    goBack: function () { clearTimers(); var s = S.get(); if (s.qIndex > 0) S.setState({ qIndex: s.qIndex - 1 }); else S.setState({ fanScreen: "landing" }); },
    selectOption: function (oi) {
      var s = S.get(), quiz = fanQuiz();
      var answers = s.answers.slice(); answers[s.qIndex] = { questionId: quiz.questions[s.qIndex].id, optionIndex: oi, optionId: (quiz.questions[s.qIndex].options[oi] || {}).id };
      S.setState({ answers: answers });
      clearTimeout(timers.adv); timers.adv = setTimeout(H.advance, 240);
    },
    advance: function () {
      var quiz = fanQuiz(), q = S.get().qIndex;
      if (q + 1 < quiz.questions.length) { S.setState({ qIndex: q + 1 }); track("question_reached", q + 1); return; }
      H.afterQuestions();
    },
    skipQuestion: function () { clearTimers(); H.advance(); },
    gateBack: function () { clearTimers(); var quiz = fanQuiz(); S.setState({ fanScreen: "quiz", qIndex: Math.max(0, quiz.questions.length - 1) }); },
    consentBack: function () { S.setState({ fanScreen: "gate", gateTouched: false }); },
    afterQuestions: function () {
      var quiz = fanQuiz(), s = S.get();
      if (quiz.gateEnabled && !s.gateDone) { S.setState({ fanScreen: "gate", gateTouched: false }); track("gate_reached"); }
      else if (quiz.esign.enabled && quiz.esign.items.length && !s.consentDone) S.setState({ fanScreen: "consent" });
      else H.goResult();
    },
    goResult: function () {
      H.recordSubmission();
    },
    // NOTE: "Another look" was removed. The card is now fully determined by the
    // fan's own answers (member + outfit + pose), so re-rolling it would show
    // them a card that contradicts what they picked.
    recordSubmission: function () {
      var s = S.get(); if (s.recorded) return;
      S.setState({ recorded: true });
      var quiz = fanQuiz();
      var answersMap = {};
      s.answers.forEach(function (a) { if (a && a.questionId != null && a.optionId != null) answersMap[a.questionId] = a.optionId; });
      var consentMap = {};
      Object.keys(s.consentChecked).forEach(function (id) { if (s.consentChecked[id]) consentMap[id] = true; });
      var timeSpentSeconds = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0;

      if (RESULT_REVEAL !== "Instant") { S.setState({ fanScreen: "result", revealing: true }); }

      api("/quiz/" + encodeURIComponent(quiz.slug) + "/submissions", {
        method: "POST",
        body: JSON.stringify({
          answers: answersMap, first: s.form.first, last: s.form.last, email: s.form.email,
          source: "Direct link", consent: consentMap, timeSpentSeconds: timeSpentSeconds, visitorId: visitorId(),
        }),
      }).then(function (res) {
        var result = (res.body && res.body.result) || { character: localPreview(), card: null };
        clearTimeout(timers.rt);
        timers.rt = setTimeout(function () { S.setState({ result: result, revealing: false }); }, RESULT_REVEAL !== "Instant" ? 1000 : 0);
        if (RESULT_REVEAL === "Instant") S.setState({ result: result, fanScreen: "result", revealing: false });
        track("complete");
      });
    },
    restart: function () { clearTimers(); S.setState({ fanScreen: "landing", qIndex: 0, answers: [], gateDone: false, consentDone: false, consentChecked: {}, recorded: false, revealing: false, result: null }); },
    submitGate: function () {
      if (!gateValid()) { S.setState({ gateTouched: true }); return; }
      S.setState({ gateDone: true });
      var quiz = fanQuiz(), s = S.get();
      if (quiz.esign.enabled && quiz.esign.items.length && !s.consentDone) S.setState({ fanScreen: "consent" });
      else H.goResult();
    },
    toggleConsent: function (id) { var cc = Object.assign({}, S.get().consentChecked); cc[id] = !cc[id]; S.setState({ consentChecked: cc }); },
    submitConsent: function () { if (consentMissing()) { S.setState({ consentTouched: true }); return; } S.setState({ consentDone: true }); H.goResult(); },
    copyLink: function () { try { navigator.clipboard.writeText(location.origin + "/index.html?quiz=" + fanQuiz().slug); } catch (e) {} flashToast("Link copied!"); },
    download: function () { flashToast("Saving your result card…"); },
    share: function (label) { flashToast("Opening " + label + "…"); },
  };

  function emailValid() { return U.emailValid(S.get().form.email); }
  function gateValid() {
    var fs = U.fieldsOf(fanQuiz()), f = S.get().form;
    if (!emailValid()) return false;
    if (fs.first.show && fs.first.required && !(f.first || "").trim()) return false;
    if (fs.last.show && fs.last.required && !(f.last || "").trim()) return false;
    return true;
  }
  function gateErrorText() {
    var fs = U.fieldsOf(fanQuiz()), f = S.get().form;
    var needFirst = fs.first.show && fs.first.required && !(f.first || "").trim();
    var needLast = fs.last.show && fs.last.required && !(f.last || "").trim();
    if (needFirst || needLast) return "Please enter your name.";
    if (!emailValid()) return "Please enter a valid email address.";
    return "";
  }
  function consentMissing() { return fanQuiz().esign.items.some(function (it) { return it.required && !S.get().consentChecked[it.id]; }); }

  // ---------- compute view model ----------
  function computeVals(s) {
    var quiz = fanQuiz();
    var d = quiz.design || {};
    var cp = U.copyOf(quiz), fcFields = U.fieldsOf(quiz), fcChannels = U.channelsOf(quiz);
    var nQ = quiz.questions.length, nC = quiz.characters.length;
    var total = Math.max(1, nQ);
    var gradOf = {}; quiz.characters.forEach(function (c) { gradOf[c.key] = c.grad; });
    var q = quiz.questions[s.qIndex] || quiz.questions[0] || { title: "", sub: "", layout: "list", options: [] };
    var sel = s.answers[s.qIndex] ? s.answers[s.qIndex].optionIndex : null;

    var fanBg = quiz.bgImage
      ? "linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.35)), url(" + quiz.bgImage + ") center/cover"
      : "radial-gradient(120% 90% at 15% 0%, #f4ecff 0%, " + (d.bg || "#e7dbfb") + " 55%, #ddd0f7 100%)";

    var result = s.result ? s.result.character : localPreview();
    var resultCard = s.result ? s.result.card : (result.cards || [])[0];
    var resultHasPhoto = !!(resultCard && resultCard.photo);

    return {
      hashtag: quiz.hashtag || "#MatchYourBias",
      fanBgGradient: fanBg,
      fanAccent: d.accent || "#5b3fd6",
      fanBadgeColor: d.accent || "#7c5cff",
      fanText: d.text || "#2b2540",
      fanButtonBg: "linear-gradient(180deg, " + U.shade(d.button || "#7c5cff", 12) + ", " + (d.button || "#6f4fd8") + ")",
      fanBarGrad: "linear-gradient(90deg, " + (d.button || "#8a6bff") + ", " + (d.accent || "#ff77a9") + ")",
      fanHeroGrad: "linear-gradient(155deg, " + U.shade(d.button || "#7c5cff", 24) + ", " + (d.button || "#6f4fd8") + " 68%, " + (d.accent || "#ff9bc0") + ")",
      fanLogo: quiz.logo || "BABYM", fanLogoImg: quiz.logoImage || "", fanHasLogoImg: !!quiz.logoImage,
      fanHeroImg: quiz.heroImage || quiz.bgImage || "", fanHasHeroImg: !!(quiz.heroImage || quiz.bgImage),
      fanButtonColor: d.button || "#7c5cff",
      landing: {
        fanHeadline: quiz.headline || "WHICH BABYM ARE YOU?",
        fanBadge: quiz.badge || "K-POP VIBE CHECK",
        fanTagline: quiz.tagline || ("A " + nQ + "-question vibe check that reveals your BABYM member and your signature colorway."),
        fanStartLabel: quiz.startLabel || "Start the vibe check →",
        fanMembersCount: nC, fanMembersLabel: cp.membersLabel, fanMatchLabel: cp.matchLabel,
        fanShowMembersBadge: quiz.showMembersBadge !== false,
        fanStartMeta: nQ + " questions · " + cp.startMeta, fanCanStart: nQ > 0,
      },
      cp: cp,
      currentQuestion: {
        counter: "QUESTION " + (s.qIndex + 1) + " / " + total,
        progress: Math.round(((s.qIndex + 1) / total) * 100) + "%",
        title: q.title, sub: q.sub, isEmpty: !q.options.length,
        isList: q.layout === "list" && q.options.length > 0, isGrid: q.layout === "grid" && q.options.length > 0,
        options: q.options.map(function (o, oi) {
          return {
            badge: o.badge, label: o.label, sub: o.sub || "",
            tint: Object.keys(o.scores || {})[0] ? (gradOf[Object.keys(o.scores)[0]] || "#8a6bff") : "#8a6bff",
            imgSrc: o.img || "", hasImg: !!o.img, imgLabel: "[ IMAGE ]",
            chev: sel === oi ? "✓" : "›", chevColor: sel === oi ? "#7c5cff" : "#c9bff0",
            selected: sel === oi, idx: oi,
          };
        }),
      },
      result: {
        name: result.name, initial: result.initial, colorName: result.colorName, color: result.color, grad: result.grad,
        blurb: result.blurb, why: result.why, photo: resultCard ? resultCard.photo : "", hasPhoto: resultHasPhoto,
        artLabel: (resultCard && resultCard.caption) ? resultCard.caption : "[ PORTRAIT ]",
      },
      fields: { showFirst: fcFields.first.show, showLast: fcFields.last.show, first: fcFields.first, last: fcFields.last },
      shareChannels: fcChannels.filter(function (c) { return c.on; }).map(function (c) {
        var bg = { ig: "linear-gradient(135deg, #f9ce34, #ee2a7b 55%, #6228d7)", tt: "#111014", x: "#26272b", fb: "#1877F2" }[c.key] || "#26272b";
        return { key: c.key, label: c.label, bg: bg };
      }),
      consentItems: quiz.esign.items.map(function (it) { return { id: it.id, text: it.text, reqMark: it.required ? " *" : "", checked: !!s.consentChecked[it.id] }; }),
      showCopyLink: quiz.showCopyLink !== false, showDownload: quiz.showDownload !== false,
      gate: {
        emailBad: s.gateTouched && !emailValid(),
        firstBad: s.gateTouched && fcFields.first.show && fcFields.first.required && !(s.form.first || "").trim(),
        lastBad: s.gateTouched && fcFields.last.show && fcFields.last.required && !(s.form.last || "").trim(),
        error: s.gateTouched ? gateErrorText() : "",
      },
      consentError: s.consentTouched && consentMissing() ? "Please check the required items to continue." : "",
    };
  }

  // ---------- screen builders ----------
  function inputStyle(bad) { return "border-color:" + (bad ? "#f2a6a6" : "#e6ddf7"); }
  var INPUT_CLS = "mt-1.5 w-full px-[15px] py-3.5 rounded-2xl border-[1.5px] bg-white text-[15px] text-bm-ink outline-none";

  function screenLanding(v, s, anim) {
    var l = v.landing;
    var logo = v.fanHasLogoImg
      ? '<img src="' + attr(v.fanLogoImg) + '" alt="logo" class="h-[26px] w-auto object-contain">'
      : esc(v.fanLogo) + '<span style="color:#ff77a9;">✦</span>';
    return '<div class="min-h-full flex flex-col p-6 ' + anim + '" style="background:linear-gradient(180deg,#fbf8ff 0%,#f2e9ff 100%);">' +
      '<div class="flex items-center justify-between">' +
        '<div class="flex items-center gap-[7px] font-display font-bold text-xl tracking-wide" style="color:' + v.fanAccent + ';">' + logo + "</div>" +
        '<div class="font-sans text-[10px] font-bold tracking-[1.4px] bg-[#efe8ff] border border-[#ddd0fb] px-[10px] py-[5px] rounded-full" style="color:' + v.fanBadgeColor + ';">' + esc(l.fanBadge) + "</div>" +
      "</div>" +
      '<div class="mt-6 text-center">' +
        '<div class="font-display font-bold text-[42px] leading-[.98] tracking-[-.5px]" style="color:' + v.fanText + ';">' + esc(l.fanHeadline) + "</div>" +
        '<div class="mt-2.5 text-[13.5px] text-[#7a72a0] leading-relaxed px-1.5">' + esc(l.fanTagline) + "</div>" +
      "</div>" +
      '<div class="flex-1 min-h-[220px] flex items-center justify-center my-2">' +
        '<div class="relative h-full min-h-[220px] max-h-[420px] w-auto max-w-full aspect-[23/26]">' +
          '<div class="absolute inset-0 rounded-[28px] overflow-hidden shadow-[0_26px_50px_-20px_rgba(111,79,216,.7)]" style="background:' + v.fanHeroGrad + ';">' +
            '<div class="absolute inset-0" style="background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.09) 0 10px,transparent 10px 20px);"></div>' +
            (v.fanHasHeroImg ? '<img src="' + attr(v.fanHeroImg) + '" alt="" class="absolute inset-0 w-full h-full object-cover">' : "") +
            '<div class="absolute top-3.5 left-4 text-2xl text-white/85">✦</div>' +
            '<div class="absolute bottom-10 right-4 text-lg text-white/70">★</div>' +
            (!v.fanHasHeroImg ? '<div class="absolute left-0 right-0 bottom-3.5 text-center font-mono text-[10px] tracking-[2px] text-white/75">[ HERO ART ]</div>' : "") +
          "</div>" +
          (l.fanShowMembersBadge ? '<div class="absolute -top-3 -right-3.5 max-w-[130px] bg-white text-[#ff5c9c] font-display font-bold text-xs px-3 py-2 rounded-[14px] shadow-[0_10px_20px_-8px_rgba(0,0,0,.25)] text-center [overflow-wrap:break-word] [word-break:break-word]" style="transform:rotate(-8deg);">' + l.fanMembersCount + " " + esc(l.fanMembersLabel) + "<br>" + esc(l.fanMatchLabel) + "</div>" : "") +
        "</div>" +
      "</div>" +
      (l.fanCanStart
        ? '<button data-action="startQuiz" class="mt-6 w-full border-0 cursor-pointer py-[17px] rounded-[18px] text-white font-display font-bold text-lg tracking-[.3px] shadow-[0_16px_30px_-12px_rgba(111,79,216,.8)]" style="background:' + v.fanButtonBg + ';">' + esc(l.fanStartLabel) + "</button>"
        : '<div class="mt-6 p-4 rounded-2xl bg-[#fff3e0] text-[#b06a12] text-[13px] text-center border border-[#ffe0b8]">This quiz has no questions yet.</div>') +
      '<div class="mt-3 text-center text-xs text-bm-muted">' + esc(l.fanStartMeta) + ' · <span class="text-bm-purple font-semibold">' + esc(v.hashtag) + "</span></div>" +
      "</div>";
  }

  function screenQuiz(v, s, anim) {
    var cq = v.currentQuestion;
    var body;
    if (cq.isEmpty) {
      body = '<div class="mt-6 p-[18px] rounded-[14px] bg-[#f6f5fb] text-bm-muted text-[13px] text-center">This question has no answers yet.</div>' +
        '<button data-action="skipQuestion" class="mt-3 w-full border-[1.5px] border-[#e0d3fb] bg-white text-bm-purple-deep cursor-pointer py-3 rounded-[14px] font-semibold text-[13px]">Skip →</button>';
    } else if (cq.isList) {
      body = '<div class="mt-[22px] flex flex-col gap-3">' + cq.options.map(function (o) {
        var brd = o.selected ? "#8a6bff" : "#efe9fb";
        var sh = o.selected ? "0 10px 24px -12px rgba(124,92,255,.6)" : "0 8px 20px -14px rgba(91,63,214,.4)";
        return '<button data-action="selectOption" data-idx="' + o.idx + '" class="flex items-center gap-3.5 text-left cursor-pointer bg-white rounded-[18px] px-4 py-3.5 transition-transform" style="border:1.5px solid ' + brd + ';box-shadow:' + sh + ';">' +
          '<div class="flex-none w-[34px] h-[34px] rounded-[11px] bg-bm-surface-2 text-bm-purple font-display font-bold text-[15px] flex items-center justify-center">' + esc(o.badge) + "</div>" +
          '<div class="flex-1"><div class="text-[15.5px] font-semibold text-bm-ink">' + esc(o.label) + '</div><div class="text-[12.5px] text-bm-muted mt-px">' + esc(o.sub) + "</div></div>" +
          '<div class="text-[22px]" style="color:' + o.chevColor + ';">' + o.chev + "</div>" +
        "</button>";
      }).join("") + "</div>";
    } else {
      body = '<div class="mt-[22px] grid grid-cols-2 gap-3">' + cq.options.map(function (o) {
        var brd = o.selected ? "#8a6bff" : "#efe9fb";
        var sh = o.selected ? "0 10px 24px -12px rgba(124,92,255,.6)" : "0 8px 20px -14px rgba(91,63,214,.4)";
        var tile = '<div class="relative h-[108px] rounded-xl overflow-hidden" style="background:' + o.tint + ';">' +
          '<div class="absolute inset-0" style="background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 8px,transparent 8px 16px);"></div>' +
          (o.hasImg ? '<img src="' + attr(o.imgSrc) + '" alt="' + attr(o.label) + '" class="absolute inset-0 w-full h-full object-cover">' : "") +
          '<div class="absolute top-2 left-2 w-[26px] h-[26px] rounded-lg bg-white/90 text-bm-ink font-display font-bold text-[13px] flex items-center justify-center">' + esc(o.badge) + "</div>" +
          (!o.hasImg ? '<div class="absolute left-0 right-0 bottom-2 text-center font-mono text-[8.5px] tracking-[1.5px] text-white/85">' + esc(o.imgLabel) + "</div>" : "") +
          "</div>";
        return '<button data-action="selectOption" data-idx="' + o.idx + '" class="text-left cursor-pointer bg-white rounded-[18px] p-2 pb-3 transition-transform" style="border:1.5px solid ' + brd + ';box-shadow:' + sh + ';">' +
          tile + '<div class="mt-[9px] px-1 text-sm font-semibold text-bm-ink">' + esc(o.label) + "</div></button>";
      }).join("") + "</div>";
    }
    return '<div class="min-h-full flex flex-col p-5 pb-6 ' + anim + '">' +
      '<div class="flex items-center justify-between text-[#8a86a6]">' +
        '<button data-action="goBack" aria-label="Go back" class="border-0 bg-bm-surface-2 w-[34px] h-[34px] rounded-full text-lg text-bm-muted-2 cursor-pointer">‹</button>' +
        '<div class="font-sans text-xs font-bold tracking-wider text-bm-purple">' + esc(cq.counter) + "</div>" +
        '<div class="w-[34px]"></div>' +
      "</div>" +
      '<div class="mt-3.5 h-[7px] rounded-full bg-[#eee6fb] overflow-hidden"><div class="h-full rounded-full transition-[width] duration-500" style="width:' + cq.progress + ";background:" + v.fanBarGrad + ';"></div></div>' +
      '<div class="mt-[26px] font-display font-semibold text-[26px] leading-tight text-bm-ink">' + esc(cq.title) + "</div>" +
      '<div class="mt-1.5 text-[13px] text-bm-muted">' + esc(cq.sub) + "</div>" +
      body + "</div>";
  }

  function screenGate(v, s, anim) {
    var cp = v.cp, g = v.gate;
    var nameRow = "";
    if (v.fields.showFirst || v.fields.showLast) {
      nameRow = '<div class="flex gap-2.5">' +
        (v.fields.showFirst ? '<label class="flex-1 text-xs font-semibold text-bm-muted-2">' + esc(cp.firstLabel) + '<input data-model="form.first" value="' + attr(s.form.first) + '" placeholder="' + attr(cp.firstPh) + '" class="' + INPUT_CLS + '" style="' + inputStyle(g.firstBad) + '"></label>' : "") +
        (v.fields.showLast ? '<label class="flex-1 text-xs font-semibold text-bm-muted-2">' + esc(cp.lastLabel) + '<input data-model="form.last" value="' + attr(s.form.last) + '" placeholder="' + attr(cp.lastPh) + '" class="' + INPUT_CLS + '" style="' + inputStyle(g.lastBad) + '"></label>' : "") +
        "</div>";
    }
    return '<div class="min-h-full flex flex-col p-6 ' + anim + '" style="background:linear-gradient(180deg,#fbf8ff,#f2e9ff);">' +
      '<div class="flex items-center gap-2.5">' +
        '<button data-action="gateBack" aria-label="Go back" class="border-0 bg-bm-surface-2 w-[34px] h-[34px] rounded-full text-lg text-bm-muted-2 cursor-pointer flex-none">‹</button>' +
        '<div class="flex-1 h-[7px] rounded-full bg-[#eee6fb] overflow-hidden"><div class="h-full w-full" style="background:' + v.fanBarGrad + ';"></div></div>' +
      "</div>" +
      '<div class="mt-10 text-center"><div class="text-[40px]">✦</div>' +
        '<div class="mt-2 font-display font-bold text-[28px] text-bm-ink">' + esc(cp.gateHeading) + "</div>" +
        '<div class="mt-1.5 text-sm text-[#7a72a0] leading-relaxed">' + esc(cp.gateSub) + "</div></div>" +
      '<div class="mt-7 flex flex-col gap-3">' +
        '<label class="text-xs font-semibold text-bm-muted-2">' + esc(cp.emailLabel) + '<input data-model="form.email" type="email" value="' + attr(s.form.email) + '" placeholder="' + attr(cp.emailPh) + '" class="' + INPUT_CLS + '" style="' + inputStyle(g.emailBad) + '"></label>' +
        nameRow +
        (g.error ? '<div role="alert" class="text-xs text-bm-danger font-semibold">' + esc(g.error) + "</div>" : "") +
      "</div>" +
      '<div class="flex-1 min-h-[16px]"></div>' +
      '<button data-action="submitGate" class="mt-6 w-full border-0 cursor-pointer py-[17px] rounded-[18px] text-white font-display font-bold text-lg shadow-[0_16px_30px_-12px_rgba(111,79,216,.55)]" style="background:' + v.fanButtonBg + ';">' + esc(cp.gateButton) + "</button>" +
      '<div class="mt-3 text-center text-[11px] text-[#a9a2c4]">' + esc(cp.privacyNote) + "</div>" +
      "</div>";
  }

  function screenConsent(v, s, anim) {
    var cp = v.cp;
    return '<div class="min-h-full flex flex-col p-6 ' + anim + '" style="background:linear-gradient(180deg,#fbf8ff,#f2e9ff);">' +
      '<div><button data-action="consentBack" aria-label="Go back" class="border-0 bg-bm-surface-2 w-[34px] h-[34px] rounded-full text-lg text-bm-muted-2 cursor-pointer">‹</button></div>' +
      '<div class="mt-4 text-center"><div class="text-[34px]">📝</div>' +
        '<div class="mt-2 font-display font-bold text-2xl text-bm-ink">' + esc(cp.consentHeading) + "</div>" +
        '<div class="mt-1.5 text-[13.5px] text-[#7a72a0] leading-relaxed">' + esc(cp.consentSub) + "</div></div>" +
      '<div class="mt-6 flex flex-col gap-3">' + v.consentItems.map(function (ci) {
        return '<label class="flex gap-[11px] items-start p-[13px] px-3.5 bg-white border-[1.5px] border-[#ece6f8] rounded-[14px] cursor-pointer">' +
          '<input type="checkbox" data-action="toggleConsent" data-id="' + attr(ci.id) + '"' + (ci.checked ? " checked" : "") + ' class="mt-0.5 w-[18px] h-[18px] cursor-pointer" style="accent-color:#7c5cff;">' +
          '<span class="text-[13px] text-[#4a4463] leading-normal">' + esc(ci.text) + '<span style="color:#ff5c7c;">' + esc(ci.reqMark) + "</span></span></label>";
      }).join("") + "</div>" +
      (v.consentError ? '<div role="alert" class="mt-3 text-xs text-bm-danger font-semibold">' + esc(v.consentError) + "</div>" : "") +
      '<div class="flex-1 min-h-[16px]"></div>' +
      '<button data-action="submitConsent" class="mt-6 w-full border-0 cursor-pointer py-[17px] rounded-[18px] text-white font-display font-bold text-lg shadow-[0_16px_30px_-12px_rgba(111,79,216,.55)]" style="background:' + v.fanButtonBg + ';">' + esc(cp.gateButton) + "</button>" +
      "</div>";
  }

  function screenResult(v, s) {
    var cp = v.cp, r = v.result;
    if (s.revealing) {
      return '<div class="min-h-full p-[18px] pb-6" style="background:linear-gradient(180deg,#f4ecff,#efe4fc);">' +
        '<div class="min-h-[640px] flex flex-col items-center justify-center gap-[18px]">' +
        '<div class="w-[54px] h-[54px] rounded-full border-4 border-[#e0d3fb] border-t-bm-purple animate-bm-spin"></div>' +
        '<div class="font-display font-semibold text-xl text-bm-purple-deep">' + esc(cp.loadingLabel) + "</div></div></div>";
    }
    var portrait = r.hasPhoto
      ? '<img src="' + attr(r.photo) + '" alt="' + attr(r.name) + '" class="absolute inset-0 w-full h-full object-cover">'
      : '<div class="absolute inset-0 flex items-center justify-center font-display font-bold text-[92px] text-white/30">' + esc(r.initial) + "</div>";
    var shareBtns = v.shareChannels.map(function (ch) {
      return '<button data-action="share" data-label="' + attr(ch.label) + '" aria-label="Share to ' + attr(ch.label) + '" class="flex-1 border-0 cursor-pointer py-3 px-1.5 rounded-[14px] text-white font-semibold text-xs" style="background:' + ch.bg + ';">' + esc(ch.label) + "</button>";
    }).join("");
    var actionCls = "flex-1 cursor-pointer py-3 rounded-[14px] border-[1.5px] bg-white font-semibold text-[13px]";
    var secondary = "";
    if (v.showCopyLink) secondary += '<button data-action="copyLink" class="' + actionCls + '" style="border-color:' + v.fanButtonColor + ";color:" + v.fanButtonColor + ';">' + esc(cp.copyLinkLabel) + "</button>";
    if (v.showDownload) secondary += '<button data-action="download" class="' + actionCls + '" style="border-color:' + v.fanButtonColor + ";color:" + v.fanButtonColor + ';">' + esc(cp.downloadLabel) + "</button>";
    return '<div class="min-h-full p-[18px] pb-6" style="background:linear-gradient(180deg,#f4ecff,#efe4fc);">' +
      '<div class="animate-bm-pop">' +
        '<div class="relative rounded-[26px] overflow-hidden shadow-[0_30px_60px_-22px_rgba(56,32,120,.6)] px-[18px] pt-5 pb-[22px]" style="background:' + r.grad + ';">' +
          '<div class="absolute inset-0 pointer-events-none" style="background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 12px,transparent 12px 24px);"></div>' +
          '<div class="relative text-center text-white"><div class="text-[10.5px] font-bold tracking-[2.5px] opacity-90">' + esc(cp.resultLabel) + "</div>" +
            '<div class="font-display font-bold text-[52px] leading-none mt-1" style="text-shadow:0 3px 0 rgba(0,0,0,.12);">' + esc(r.name) + "</div></div>" +
          '<div class="relative mx-auto mt-4 w-[190px] max-w-full h-[200px] rounded-[20px] overflow-hidden bg-white/[.16] border-[1.5px] border-white/40">' +
            '<div class="absolute inset-0" style="background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 9px,transparent 9px 18px);"></div>' + portrait +
            '<div class="absolute left-0 right-0 bottom-2.5 text-center font-mono text-[9px] tracking-[2px] text-white/85" style="text-shadow:0 1px 3px rgba(0,0,0,.4);">' + esc(r.artLabel) + "</div>" +
          "</div>" +
          '<div class="relative mt-4 flex items-center justify-center gap-2"><div class="w-5 h-5 rounded-md border-2 border-white/85" style="background:' + r.color + ';"></div>' +
            '<div class="font-display font-bold text-lg text-white">' + esc(r.colorName) + "</div></div>" +
          '<div class="relative mt-3 bg-white/[.16] border border-white/30 rounded-[14px] px-3.5 py-3 text-white">' +
            '<div class="text-[13px] leading-normal text-center">' + esc(r.blurb) + "</div>" +
            '<div class="mt-2.5 pt-2.5 border-t border-white/[.28] text-[11.5px] leading-snug text-center opacity-95"><b>' + esc(cp.whyLabel) + " " + esc(r.colorName) + "?</b> " + esc(r.why) + "</div></div>" +
          '<div class="relative mt-3.5 text-center font-display font-bold text-[13px] tracking-[.5px] text-white">' + esc(v.hashtag) + "</div>" +
        "</div>" +
        (shareBtns ? '<div class="mt-4 flex gap-2">' + shareBtns + "</div>" : "") +
        (secondary ? '<div class="mt-2 flex gap-2">' + secondary + "</div>" : "") +
        '<button data-action="restart" class="mt-3 w-full bg-transparent border-0 cursor-pointer text-[#8a86a6] font-sans text-[13px] font-semibold underline">' + esc(cp.retakeLabel) + "</button>" +
      "</div></div>";
  }

  function screenLoading() {
    return '<div class="min-h-full flex items-center justify-center p-6" style="background:linear-gradient(180deg,#fbf8ff,#f2e9ff);">' +
      '<div class="w-10 h-10 rounded-full border-4 border-[#e0d3fb] border-t-bm-purple animate-bm-spin"></div></div>';
  }
  function screenError(msg) {
    return '<div class="min-h-full flex items-center justify-center p-6 text-center" style="background:linear-gradient(180deg,#fbf8ff,#f2e9ff);">' +
      '<div class="text-sm text-bm-danger font-semibold">' + esc(msg) + "</div></div>";
  }

  function render(s) {
    if (s.booting) { $("#fan-app").html(screenLoading()); return; }
    if (s.loadError) { $("#fan-app").html(screenError(s.loadError)); return; }
    var v = computeVals(s);
    var screenKey = s.fanScreen + ":" + s.qIndex + ":" + s.revealing;
    var isNew = screenKey !== lastScreenKey;
    lastScreenKey = screenKey;
    var animSlow = isNew ? "animate-bm-fadeup" : "";
    var animFast = isNew ? "animate-bm-fadeup-fast" : "";
    var screen = s.fanScreen === "landing" ? screenLanding(v, s, animSlow)
      : s.fanScreen === "quiz" ? screenQuiz(v, s, animFast)
      : s.fanScreen === "gate" ? screenGate(v, s, animSlow)
      : s.fanScreen === "consent" ? screenConsent(v, s, animSlow)
      : screenResult(v, s);
    var html = '<div id="fan-stage" class="h-[100dvh] w-full flex items-center justify-center p-0 md:p-6 overflow-hidden" style="background:' + v.fanBgGradient + ';">' +
      '<div id="fan-screen-wrap" class="relative w-full max-w-none md:max-w-md lg:max-w-lg bg-[#fbf8ff] rounded-none md:rounded-[36px] shadow-none md:shadow-[0_40px_90px_-30px_rgba(56,32,120,.45)] overflow-hidden">' + screen + "</div></div>";
    $("#fan-app").html(html);
    C.toast(s.toast);
    fitToViewport();
  }

  // ---------- scale-to-fit: shrink the card uniformly so it never needs a scroll ----------
  function fitToViewport() {
    var stage = document.getElementById("fan-stage"), wrap = document.getElementById("fan-screen-wrap");
    if (!stage || !wrap) return;
    wrap.style.transform = "none";
    wrap.style.height = "";
    var isMobile = window.innerWidth < 768;
    var cs = window.getComputedStyle(stage);
    var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var availW = Math.max(100, stage.clientWidth - padX);
    var availH = Math.max(100, stage.clientHeight - padY);
    var naturalW = wrap.offsetWidth, naturalH = wrap.offsetHeight;
    if (!naturalW || !naturalH) return;
    var scale = Math.min(1, availW / naturalW, availH / naturalH);
    if (scale < 1) {
      wrap.style.transform = "scale(" + scale + ")";
    } else if (isMobile && naturalH < availH) {
      wrap.style.height = availH + "px";
    }
  }
  $(window).on("resize orientationchange", function () {
    clearTimeout(timers.fit); timers.fit = setTimeout(fitToViewport, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitToViewport(); });

  // ---------- events ----------
  $(function () {
    var $app = $("#fan-app");
    $app.on("click", "[data-action]", function (e) {
      var el = e.currentTarget, action = el.getAttribute("data-action");
      if (action === "toggleConsent") return;
      if (action === "selectOption") { H.selectOption(parseInt(el.getAttribute("data-idx"), 10)); return; }
      if (action === "share") { H.share(el.getAttribute("data-label")); return; }
      if (typeof H[action] === "function") H[action]();
    });
    $app.on("change", 'input[type="checkbox"][data-action="toggleConsent"]', function (e) {
      H.toggleConsent(e.currentTarget.getAttribute("data-id"));
    });
    $app.on("input", "[data-model]", function (e) {
      S.setPath(e.currentTarget.getAttribute("data-model"), e.currentTarget.value, { silent: true });
    });

    S.init(initial, render);
    fetch("/api/quiz/" + encodeURIComponent(slugFromUrl()))
      .then(function (r) { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(function (quiz) { S.setState({ booting: false, quiz: quiz }); track("view"); })
      .catch(function () { S.setState({ booting: false, loadError: "This quiz couldn't be loaded." }); });
  });
})();
