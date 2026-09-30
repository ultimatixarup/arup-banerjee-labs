/**
 * Arup Banerjee Labs — anonymous, cookieless usage counts (GoatCounter).
 *
 * Sends ONLY fixed strings from the allow-lists below: a page path, or an event
 * name such as "agent-health-checker/score_bucket/50-74". It never reads the
 * page, never sends pasted text, findings, secrets, agent tool names, the
 * document title, the referrer or the query string, and sets no cookies or
 * storage. It does nothing until GOATCOUNTER_CODE is set in labs-config.js,
 * only runs on COUNT_HOST over https, and skips browsers that send
 * Do Not Track or Global Privacy Control.
 *
 * Usage: <script src="../shared/labs-counts.js" data-page="cloud-bill-smell"></script>
 * Tools call window.LabsCount.event("analyze_clicked") etc.
 * Never loaded by GLP-1 Support.
 */
(function () {
  "use strict";
  var PAGES = {
    "hub": "/",
    "case-study": "/case-study/",
    "agent-health-checker": "/agent-health-checker/",
    "cloud-bill-smell": "/cloud-bill-smell/",
    "observability-gap-finder": "/observability-gap-finder/"
  };
  var EVENTS = { analyze_clicked: 1, score_bucket: 1, copy_clicked: 1, glp1_link_clicked: 1 };
  var BUCKETS = { "0-24": 1, "25-49": 1, "50-74": 1, "75-100": 1 };
  var COPY_KINDS = { report: 1, redteam: 1 };

  var me = document.currentScript;
  var page = me && me.getAttribute("data-page");
  var cfg = window.LABS_CONFIG || {};
  var code = String(cfg.GOATCOUNTER_CODE || "");

  function enabled() {
    if (!PAGES.hasOwnProperty(page)) return false;
    if (!/^[a-z0-9-]+$/.test(code)) return false;
    if (location.protocol !== "https:" || location.hostname !== cfg.COUNT_HOST) return false;
    var n = navigator || {};
    if (n.doNotTrack === "1" || window.doNotTrack === "1" || n.globalPrivacyControl === true) return false;
    return true;
  }

  function send(path, isEvent, beacon) {
    if (!enabled()) return;
    var url = "https://" + code + ".goatcounter.com/count?p=" + encodeURIComponent(path) +
      (isEvent ? "&e=true" : "") + "&rnd=" + Math.random().toString(36).slice(2, 7);
    try { if (beacon && navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (_) {}
    var img = new Image();
    img.src = url; // 1x1 GIF; no cookies are set by GoatCounter
  }

  // name: one of EVENTS. detail: a score bucket (score_bucket) or copy kind (copy_clicked).
  function event(name, detail, beacon) {
    if (!EVENTS.hasOwnProperty(name)) return;
    var p = page + "/" + name;
    if (name === "score_bucket") {
      if (!BUCKETS.hasOwnProperty(detail)) return;
      p += "/" + detail;
    } else if (name === "copy_clicked") {
      p += "/" + (COPY_KINDS.hasOwnProperty(detail) ? detail : "report");
    }
    send(p, true, beacon);
  }

  window.LabsCount = Object.freeze({ event: event });

  function init() {
    if (PAGES.hasOwnProperty(page)) send(PAGES[page], false, false);
    // Hub only: count clicks on the GLP-1 Support link (the GLP-1 page itself is never counted).
    if (page === "hub") {
      var links = document.querySelectorAll("a[data-count='glp1_link_clicked']");
      for (var i = 0; i < links.length; i++) {
        links[i].addEventListener("click", function () { event("glp1_link_clicked", null, true); });
      }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
