/* utils.js — pure helpers (ported from BABYM Quiz.dc.html). Exposes window.Utils. */
(function () {
  "use strict";
  var D = window.Data;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function slugify(s) { return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

  function uniqueSlug(base, quizzes, ignoreId) {
    var slug = slugify(base) || "quiz";
    var taken = {};
    quizzes.filter(function (q) { return q.id !== ignoreId; }).forEach(function (q) { taken[q.slug] = true; });
    if (!taken[slug]) return slug;
    var n = 2; while (taken[slug + "-" + n]) n++; return slug + "-" + n;
  }

  function fmt(n) { return Number(n || 0).toLocaleString("en-US"); }

  function shade(hex, pct) {
    var h = String(hex || "#8B6FE8").replace("#", "");
    if (h.length < 6) return hex;
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255))); };
    var to2 = function (v) { return f(v).toString(16).padStart(2, "0"); };
    return "#" + to2(r) + to2(g) + to2(b);
  }

  function gradFromColor(hex) {
    var light = shade(hex, 26), dark = shade(hex, -22);
    return "linear-gradient(155deg," + light + "," + hex + " 72%," + dark + ")";
  }

  function scoreWinner(characters, questions, answers) {
    var totals = {};
    characters.forEach(function (c) { totals[c.key] = 0; });
    answers.forEach(function (optIndex, qi) {
      var q = questions[qi]; if (!q || optIndex == null) return;
      if (q.layout === "grid") return;
      var opt = q.options[optIndex]; if (!opt) return;
      Object.keys(opt.scores || {}).forEach(function (k) { if (k in totals) totals[k] += (+opt.scores[k] || 0); });
    });
    var best = characters[0], bestN = -Infinity;
    characters.forEach(function (c) { var n = totals[c.key] || 0; if (n > bestN) { bestN = n; best = c; } });
    return best;
  }

  // Mirror of QuizScorer::resolveCard(). Deterministic: the same triple always
  // yields the same card. Fallback chain matches the server exactly so the
  // optimistic client preview never disagrees with the recorded result.
  function resolveCard(member, outfitId, poseId) {
    var cards = (member && member.cards && member.cards.length) ? member.cards : null;
    if (!cards) return { id: (member && member.key || "x") + "-1", photo: "", caption: "" };
    var eq = function (a, b) { return String(a == null ? "" : a) === String(b == null ? "" : b); };

    var exact = cards.filter(function (c) { return eq(c.outfitId, outfitId) && eq(c.poseId, poseId); })[0];
    if (exact) return exact;
    if (outfitId != null) {
      var sameOutfit = cards.filter(function (c) { return eq(c.outfitId, outfitId); })[0];
      if (sameOutfit) return sameOutfit;
    }
    if (poseId != null) {
      var samePose = cards.filter(function (c) { return eq(c.poseId, poseId); })[0];
      if (samePose) return samePose;
    }
    return cards[0];
  }

  function emailValid(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim()); }

  // ---------- date range ----------
  function resolveRangeDays(form) {
    if (form.range !== "custom") {
      var days = parseInt(form.range) || 30;
      return { days: days, valid: true, label: "Last " + days + " days", from: null, to: null };
    }
    var from = form.from ? new Date(form.from + "T00:00:00") : null;
    var to = form.to ? new Date(form.to + "T00:00:00") : null;
    var valid = !!(from && to && !isNaN(from) && !isNaN(to) && to >= from);
    if (!valid) return { days: 30, valid: false, label: "Custom range", from: from, to: to };
    var d = Math.round((to - from) / 86400000) + 1;
    var f = function (x) { return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
    return { days: d, valid: true, label: f(from) + " – " + f(to), from: from, to: to };
  }

  // submissions filtered by form scope + range. activeQuiz forces scope when in a workspace.
  function matchingSubmissions(form, submissions, activeQuiz) {
    var scoped = activeQuiz
      ? submissions.filter(function (x) { return x.quizId === activeQuiz.id; })
      : (form.scope === "all" ? submissions : submissions.filter(function (x) { return String(x.quizId) === String(form.scope); }));
    var rr = resolveRangeDays(form);
    if (form.range === "custom" && !rr.valid) return [];
    var start, end;
    if (form.range === "custom") { start = rr.from; end = new Date(rr.to.getTime() + 86400000 - 1); }
    else { end = new Date(); start = new Date(end.getTime() - (rr.days - 1) * 86400000); start.setHours(0, 0, 0, 0); }
    return scoped.filter(function (x) { var d = new Date(x.date); return !isNaN(d) && d >= start && d <= end; });
  }

  function csvCell(v) { var s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  function downloadBlob(name, mime, text) {
    try {
      var blob = new Blob([text], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (e) { return false; }
  }

  // ---------- pagination ----------
  function makePages(current, total) {
    if (total <= 7) { var a = []; for (var i = 1; i <= total; i++) a.push(i); return a; }
    var pages = [1];
    var s = Math.max(2, current - 1), e = Math.min(total - 1, current + 1);
    if (s > 2) pages.push("…");
    for (var j = s; j <= e; j++) pages.push(j);
    if (e < total - 1) pages.push("…");
    pages.push(total);
    return pages;
  }
  // returns [{label, page|null, active, disabled}] — caller wires clicks via data-page
  function buildPager(current, total) {
    var btns = [];
    btns.push({ label: "‹", page: current > 1 ? current - 1 : null, active: false, disabled: current <= 1 });
    makePages(current, total).forEach(function (p) {
      if (p === "…") btns.push({ label: "…", page: null, active: false, disabled: true, ellipsis: true });
      else btns.push({ label: String(p), page: p, active: p === current, disabled: false });
    });
    btns.push({ label: "›", page: current < total ? current + 1 : null, active: false, disabled: current >= total });
    return btns;
  }

  function pctW(n, base) { return Math.round((n / Math.max(1, base)) * 100) + "%"; }

  function aggregateAnalytics(quizzes) {
    var a = { views: 0, starts: 0, gateReached: 0, perQuestionReached: [] };
    quizzes.forEach(function (q) {
      a.views += q.analytics.views; a.starts += q.analytics.starts; a.gateReached += q.analytics.gateReached;
      q.analytics.perQuestionReached.forEach(function (n, i) { a.perQuestionReached[i] = (a.perQuestionReached[i] || 0) + n; });
    });
    if (!a.perQuestionReached.length) a.perQuestionReached = [1];
    return a;
  }

  // 49 on/off flags for a 7x7 faux-QR, hashed from slug
  function qrCells(seed) {
    var cells = [];
    var qrSeed = seed || "quiz";
    for (var i = 0; i < 49; i++) {
      var h = 0; var str = qrSeed + i; for (var k = 0; k < str.length; k++) h = (h * 31 + str.charCodeAt(k)) & 255;
      cells.push((h % 2 === 0) || (i < 3 || i % 7 < 1));
    }
    return cells;
  }

  function downloadQR(slug) {
    try {
      var seed = slug || "quiz";
      var n = 7, cell = 24, pad = 24, size = n * cell + pad * 2;
      var cv = document.createElement("canvas"); cv.width = size; cv.height = size;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#2b2540"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#fff";
      for (var i = 0; i < n * n; i++) {
        var h = 0; var str = seed + i; for (var k = 0; k < str.length; k++) h = (h * 31 + str.charCodeAt(k)) & 255;
        var on = (h % 2 === 0) || (i < 3 || i % 7 < 1);
        if (on) { var x = pad + (i % n) * cell, y = pad + Math.floor(i / n) * cell; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2); }
      }
      var a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = seed + "-qr.png"; a.click();
      return true;
    } catch (e) { return false; }
  }

  function rebadge(options) {
    var B = ["A", "B", "C", "D", "E", "F", "G", "H"];
    return options.map(function (o, i) { return Object.assign({}, o, { badge: B[i] || String(i + 1) }); });
  }

  // ---------- per-quiz copy/fields/channels merges ----------
  function copyOf(q) { return Object.assign({}, D.defaultCopy(), (q && q.copy) || {}); }
  function fieldsOf(q) {
    var d = D.defaultFields(); var f = (q && q.fields) || {};
    return { first: Object.assign({}, d.first, f.first || {}), last: Object.assign({}, d.last, f.last || {}) };
  }
  function channelsOf(q) { var c = q && q.channels; return (c && c.length) ? c : D.defaultChannels(); }

  window.Utils = {
    clone: clone, slugify: slugify, uniqueSlug: uniqueSlug, fmt: fmt, shade: shade, gradFromColor: gradFromColor,
    scoreWinner: scoreWinner, resolveCard: resolveCard, emailValid: emailValid,
    resolveRangeDays: resolveRangeDays, matchingSubmissions: matchingSubmissions,
    csvCell: csvCell, downloadBlob: downloadBlob, makePages: makePages, buildPager: buildPager,
    pctW: pctW, aggregateAnalytics: aggregateAnalytics, qrCells: qrCells, downloadQR: downloadQR,
    rebadge: rebadge, copyOf: copyOf, fieldsOf: fieldsOf, channelsOf: channelsOf,
  };
})();
