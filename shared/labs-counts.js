/**
 * Arup Banerjee Labs — anonymous, cookieless usage counts (GoatCounter).
 *
 * Sends ONLY fixed strings from the allow-lists below: a page path, or an event
 * such as "playbook-m1/step_viewed/challenge". It never reads pasted text,
 * findings, secrets, names, costs, the document title, the referrer or the
 * query string, and it sets no cookies and writes no storage. It does nothing
 * until GOATCOUNTER_CODE is set in labs-config.js, only runs on COUNT_HOST
 * over https, and skips browsers that send Do Not Track or Global Privacy Control.
 *
 * Usage: <script src="../shared/labs-counts.js" data-page="cloud-bill-smell"></script>
 * Clicks: <a data-count="nav_clicked" data-detail="case-study">
 * Sections: <section data-step="challenge">
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
    "observability-gap-finder": "/observability-gap-finder/",
    "playbook": "/playbook/",
    "playbook-m1": "/playbook/module-01/",
    "playbook-m2": "/playbook/module-02/",
    "playbook-m3": "/playbook/module-03/",
    "playbook-m4": "/playbook/module-04/"
  };
  // Events with no detail. An extra argument is ignored, never appended.
  var BARE = { analyze_clicked: 1, glp1_link_clicked: 1, quiz_opened: 1 };
  // Unknown copy labels collapse to "report" so a free-text label is never sent.
  var COPY_KINDS = {
    report: 1, redteam: 1,
    "card-a": 1, "card-b": 1, "card-c": 1, "card-d": 1,
    "download-a": 1, "download-b": 1, "download-c": 1, "download-d": 1,
    brief: 1, log: 1, template: 1, results: 1
  };
  var DETAILS = {
    score_bucket: { "0-24": 1, "25-49": 1, "50-74": 1, "75-100": 1 },
    input_kind: { sample: 1, sample_transcript: 1, own: 1 },
    nav_clicked: {
      hub: 1, "agent-health-checker": 1, "cloud-bill-smell": 1,
      "observability-gap-finder": 1, "case-study": 1, playbook: 1,
      "module-01": 1, "module-02": 1, "module-03": 1, "module-04": 1
    },
    volunteer_clicked: { top: 1, bottom: 1, mission: 1, module: 1 },
    step_viewed: {
      mission: 1, volunteer: 1, who: 1, paths: 1, modules: 1, tool: 1, "volunteer-end": 1,
      "step-0": 1, stop: 1, tale: 1, unlearn: 1, comm: 1, examples: 1, owner: 1,
      challenge: 1, quiz: 1, artifact: 1, next: 1, sources: 1,
      why: 1, setup: 1, unsafe: 1, before: 1, changed: 1, after: 1, misses: 1, borrow: 1, try: 1, method: 1
    },
    scroll_depth: { "25": 1, "50": 1, "75": 1, "100": 1 },
    card_picked: { a: 1, b: 1, c: 1, d: 1 },
    round_picked: { "1": 1, "2": 1 }
  };
  // Once per page view. Not stored. A reload counts again, which is what we want.
  var ONCE = { step_viewed: 1, scroll_depth: 1, quiz_opened: 1, card_picked: 1, round_picked: 1 };
  var seen = {};

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

  // name + optional detail must both be allow-listed. detail is never copied into the path
  // unless it is one of the fixed keys above.
  function event(name, detail, beacon) {
    if (!BARE.hasOwnProperty(name) && name !== "copy_clicked" && !DETAILS.hasOwnProperty(name)) return;
    if (name === "glp1_link_clicked" && page !== "hub") return;
    var p = page + "/" + name;
    if (name === "copy_clicked") {
      var copy = String(detail == null ? "" : detail);
      p += "/" + (COPY_KINDS.hasOwnProperty(copy) ? copy : "report");
    } else if (DETAILS.hasOwnProperty(name)) {
      var key = String(detail == null ? "" : detail);
      if (!DETAILS[name].hasOwnProperty(key)) return;
      p += "/" + key;
    }
    if (!enabled()) return;
    if (ONCE.hasOwnProperty(name)) {
      if (seen[p]) return;
      seen[p] = 1;
    }
    send(p, true, beacon);
  }

  window.LabsCount = Object.freeze({ event: event });

  function bindClicks() {
    if (!document.querySelectorAll) return;
    var nodes = document.querySelectorAll("[data-count]");
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        if (!el.getAttribute) return;
        var name = el.getAttribute("data-count");
        if (!name) return;
        if (el.tagName === "DETAILS") {
          el.addEventListener("toggle", function () {
            if (el.open) event(name, el.getAttribute("data-detail"), false);
          });
          return;
        }
        el.addEventListener("click", function () {
          event(name, el.getAttribute("data-detail"), true);
        });
      })(nodes[i]);
    }
  }

  function watchSteps() {
    if (typeof IntersectionObserver !== "function" || !document.querySelectorAll) return;
    var nodes = document.querySelectorAll("[data-step]");
    if (!nodes || !nodes.length) return;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting || !entries[i].target || !entries[i].target.getAttribute) continue;
        event("step_viewed", entries[i].target.getAttribute("data-step"), false);
        try { io.unobserve(entries[i].target); } catch (_) {}
      }
    });
    for (var j = 0; j < nodes.length; j++) io.observe(nodes[j]);
  }

  // Buckets only when the page is tall enough to scroll, so a short page does not look like a completed read.
  function watchScroll() {
    var root = document.documentElement;
    if (!root || typeof root.scrollHeight !== "number" || !window.addEventListener) return;
    function measure() {
      var el = document.documentElement;
      if (!el) return;
      var view = window.innerHeight || el.clientHeight || 0;
      var max = (el.scrollHeight || 0) - view;
      if (max <= 16) return;
      var top = window.pageYOffset;
      if (typeof top !== "number") top = el.scrollTop || 0;
      var pct = (top / max) * 100;
      if (pct >= 25) event("scroll_depth", "25", false);
      if (pct >= 50) event("scroll_depth", "50", false);
      if (pct >= 75) event("scroll_depth", "75", false);
      if (pct >= 99) event("scroll_depth", "100", false);
    }
    measure();
    window.addEventListener("scroll", measure);
  }

  function init() {
    if (!PAGES.hasOwnProperty(page)) return;
    send(PAGES[page], false, false);
    bindClicks();
    watchSteps();
    watchScroll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
