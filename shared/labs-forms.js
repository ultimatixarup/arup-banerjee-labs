/**
 * Arup Banerjee Labs — optional "Get updates" signup + "Share feedback" link.
 * Reads LIST_FORM_ACTION and FEEDBACK_FORM_URL from labs-config.js. Anything
 * still a placeholder stays hidden, so pages work exactly as before.
 * The signup form holds only the email field. Nothing you paste into a tool
 * is ever added to it. The provider emails a confirmation link first
 * (double opt-in). Never loaded by GLP-1 Support.
 */
(function () {
  "use strict";
  var cfg = window.LABS_CONFIG || {};
  function httpsUrl(v) { return typeof v === "string" && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : ""; }

  function init() {
    var box = document.getElementById("labs-optional");
    if (!box) return;
    var action = httpsUrl(cfg.LIST_FORM_ACTION);
    var feedback = httpsUrl(cfg.FEEDBACK_FORM_URL);
    var form = document.getElementById("labs-signup");
    var fb = document.getElementById("labs-feedback");
    if (form && action) { form.setAttribute("action", action); form.hidden = false; }
    if (fb && feedback) {
      var a = fb.querySelector("a");
      if (a) { a.href = feedback; fb.hidden = false; }
    }
    if ((form && !form.hidden) || (fb && !fb.hidden)) box.hidden = false;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
