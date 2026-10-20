/* data.js — pure defaults/helpers still used client-side (permission presets, copy/field/channel
   defaults, pose labels). Seed factories (seedQuizzes/genSubmissions/seedMembers/mkAnalytics) were
   removed — all real data now comes from the API (see fan.js/admin-state.js). Exposes window.Data. */
(function () {
  "use strict";

  var POSE_SET_SIZE = 4;
  var CLOTHING_SET_SIZE = 4;
  var POSE_LABELS = ["Studio concept", "Stage close-up", "Polaroid", "Candid"];

  function FEATURES() { return [["dashboard", "Dashboard"], ["quizzes", "Quizzes"], ["builder", "Question builder"], ["results", "Results & scoring"], ["submissions", "Submissions"], ["analytics", "Analytics"], ["design", "Design settings"], ["team", "Team & roles"]]; }
  function rolePreset(role) {
    var all = {}, none = {};
    FEATURES().forEach(function (p) { all[p[0]] = true; none[p[0]] = false; });
    if (role === "Owner" || role === "Admin") return all;
    if (role === "Editor") return Object.assign({}, none, { dashboard: true, quizzes: true, builder: true, results: true, submissions: true, analytics: true, design: true });
    return Object.assign({}, none, { dashboard: true, submissions: true, analytics: true });
  }
  function effPerms(member) { return member.perms || rolePreset(member.role); }

  function defaultCopy() {
    return {
      membersLabel: "members", matchLabel: "1 match", startMeta: "about 1 minute",
      gateHeading: "Almost there!", gateSub: "Drop your details and we'll unlock your BABYM match card.",
      emailLabel: "Email", emailPh: "you@email.com",
      firstLabel: "First name", firstPh: "First", lastLabel: "Last name", lastPh: "Last",
      privacyNote: "We'll only email you about the campaign. Unsubscribe anytime.",
      gateButton: "See My Result ✦",
      consentHeading: "Before your result", consentSub: "Please review and agree to continue.",
      resultLabel: "YOUR BABYM MATCH IS", loadingLabel: "Finding your match…", whyLabel: "Why",
      copyLinkLabel: "🔗 Copy link", downloadLabel: "⬇ Download", retakeLabel: "Retake the quiz",
    };
  }
  function defaultFields() { return { first: { show: true, required: true }, last: { show: true, required: true } }; }
  function defaultChannels() { return [{ key: "ig", label: "Instagram", on: true }, { key: "tt", label: "TikTok", on: true }, { key: "x", label: "X", on: true }, { key: "fb", label: "Facebook", on: true }]; }

  window.Data = {
    FEATURES: FEATURES, rolePreset: rolePreset, effPerms: effPerms,
    defaultCopy: defaultCopy, defaultFields: defaultFields, defaultChannels: defaultChannels,
    POSE_SET_SIZE: POSE_SET_SIZE, CLOTHING_SET_SIZE: CLOTHING_SET_SIZE, POSE_LABELS: POSE_LABELS,
  };
})();
