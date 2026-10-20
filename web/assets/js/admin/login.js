/* admin/login.js — login gate screen shown before the admin shell. Uses window.C/Admin.
   Exposes window.Admin.scLogin. Load AFTER admin-state.js, BEFORE admin-shell.js. */
(function () {
  "use strict";
  var C = window.C, A = window.Admin;
  var esc = C.esc, attr = C.attr;
  var INPUT_CLS = "mt-1.5 w-full px-[15px] py-3.5 rounded-2xl border-[1.5px] border-bm-border-2 bg-white text-[15px] text-bm-ink outline-none";

  function scLogin(v) {
    var f = v.loginForm || { email: "", password: "" };
    return '<div class="min-h-[100dvh] w-full flex items-center justify-center p-6" style="background:linear-gradient(180deg,#fbf8ff 0%,#f2e9ff 100%);">' +
      '<form data-submit="login" class="w-full max-w-[380px] bg-white rounded-[28px] p-8 shadow-[0_40px_90px_-30px_rgba(56,32,120,.45)] animate-bm-fadeup">' +
        '<div class="text-center font-display font-bold text-xl text-bm-ink">Login</div>' +
        '<div class="mt-7 flex flex-col gap-3">' +
          '<label class="text-xs font-semibold text-bm-muted-2">Email<input data-model="loginForm.email" type="email" value="' + attr(f.email) + '" placeholder="you@email.com" class="' + INPUT_CLS + '"></label>' +
          '<label class="text-xs font-semibold text-bm-muted-2">Password<input data-model="loginForm.password" type="password" value="' + attr(f.password) + '" placeholder="••••••••" class="' + INPUT_CLS + '"></label>' +
          (v.loginError ? '<div role="alert" class="text-xs text-bm-danger font-semibold">' + esc(v.loginError) + "</div>" : "") +
        "</div>" +
        '<button type="submit" class="mt-6 w-full border-0 cursor-pointer py-[15px] rounded-[16px] text-white font-display font-bold text-base" style="background:linear-gradient(180deg,#8a6bff,#7c5cff);">Log in</button>' +
        '<div class="mt-4 text-center text-[11px] text-bm-muted">Demo access: admin@admin.com / password</div>' +
      "</form></div>";
  }

  A.scLogin = scLogin;
})();
