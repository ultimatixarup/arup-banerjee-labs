/**
 * GLP-1 Support — Arup Banerjee Labs
 * Free, browser-only organizer. Educational/organizational only: no diagnosis, no dosing,
 * no medication-change advice of its own. User data is kept in this browser's localStorage and is never
 * sent anywhere by this script (the page CSP also sets connect-src 'none'). No analytics, no third-party scripts.
 * Exports, downloads, prints and copies are created only when the user asks, and carry the disclaimer lines below.
 */
(function () {
  "use strict";

  var PREFIX = "abl_glp1_";
  // Disclaimer lines added to every export (legal review 4.9). No commas in EXPORT_NOTE so it stays one CSV cell.
  var EMERGENCY_LINE = "Emergency: call 911. Took too much: Poison Help 1-800-222-1222. Crisis: call or text 988.";
  var EXPORT_NOTE = "# GLP-1 Support export - personal notes - not medical advice. Emergency: 911. Took too much: 1-800-222-1222. Crisis: call or text 988.";
  var K = {
    log: PREFIX + "log_v1",
    daily: PREFIX + "daily_v1",
    week: PREFIX + "week_v1",
    strength: PREFIX + "strength_v1",
    plan: PREFIX + "plan_v1",
    ins: PREFIX + "ins_v1",
    q: PREFIX + "questions_v1",
    prefs: PREFIX + "prefs_v1"
  };

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_) { toast("Could not save — browser storage may be full or disabled."); return false; }
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoLocal(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return isoLocal(new Date()); }
  function parseISO(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function fmtDate(s) {
    if (!s) return "";
    try { return parseISO(s).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
    catch (_) { return s; }
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "checked") e.checked = !!attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  var toastTimer;
  function toast(msg) {
    var t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // guard against spreadsheet formula injection
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n"; }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function printPanel(panelId) {
    // Show only the chosen panel while printing.
    document.querySelectorAll(".tabpanel").forEach(function (p) { p.setAttribute("data-print", p.id === panelId ? "1" : "0"); });
    window.print();
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- tabs ----------
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      var panel = $(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t, false); });
    t.addEventListener("keydown", function (e) {
      var idx = null;
      if (e.key === "ArrowRight") idx = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") idx = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = tabs.length - 1;
      if (idx !== null) { e.preventDefault(); selectTab(tabs[idx], true); }
    });
  });

  // ---------- 1. Daily log ----------
  var SYMPTOMS = [
    ["nausea", "Nausea"], ["vomiting", "Vomiting"], ["diarrhea", "Diarrhea"], ["constipation", "Constipation"],
    ["reflux", "Heartburn / reflux"], ["stomach_pain", "Stomach pain"], ["bloating", "Bloating / gas"],
    ["fatigue", "Tiredness"], ["dizziness", "Dizziness"], ["headache", "Headache"],
    ["low_appetite", "Very low appetite"], ["site_reaction", "Injection-site reaction"]
  ];
  var LEVELS = ["none", "mild", "moderate", "severe"];
  var LOG_FIELDS = ["date", "medicine", "dose_as_prescribed", "dose_today", "injection_site"]
    .concat(SYMPTOMS.map(function (s) { return s[0]; }))
    .concat(["protein_g", "fluids_cups", "fiber_g", "activity_min", "strength", "weight", "red_flag", "notes"]);

  function buildSymptomGrid() {
    var g = $("sym-grid");
    SYMPTOMS.forEach(function (s) {
      var sel = el("select", { id: "s-" + s[0], "aria-label": s[1] + " severity" });
      LEVELS.forEach(function (l) { sel.appendChild(el("option", { value: l, text: l.charAt(0).toUpperCase() + l.slice(1) })); });
      g.appendChild(el("label", { "for": "s-" + s[0] }, [el("span", { text: s[1] }), sel]));
    });
  }

  function getLog() { var l = load(K.log, []); return Array.isArray(l) ? l : []; }
  function setLog(l) { save(K.log, l); }

  function readForm() {
    var e = {
      id: uid(),
      date: $("f-date").value || today(),
      medicine: $("f-med").value.trim(),
      dose_as_prescribed: $("f-dose").value.trim(),
      dose_today: $("f-taken").value,
      injection_site: $("f-site").value,
      protein_g: num($("f-protein").value),
      fluids_cups: num($("f-fluids").value),
      fiber_g: num($("f-fiber").value),
      activity_min: num($("f-activity").value),
      strength: $("f-strength").checked,
      weight: num($("f-weight").value),
      red_flag: $("f-redflag").checked,
      notes: $("f-notes").value.trim()
    };
    SYMPTOMS.forEach(function (s) { e[s[0]] = $("s-" + s[0]).value; });
    return e;
  }

  function alertFor(entry) {
    var msgs = [];
    if (entry.red_flag) {
      msgs.push("<strong>You marked a red-flag symptom.</strong> Don’t wait on this. Call 911 for trouble breathing or swallowing, swelling of the face, lips, tongue, or throat, or fainting. " +
        "For the other red-flag symptoms, contact your prescriber right away, or go to urgent care or an emergency room if you can’t reach them. " +
        "Your Medication Guide says what to do for each one.");
    }
    var severe = SYMPTOMS.filter(function (s) { return entry[s[0]] === "severe"; }).map(function (s) { return s[1].toLowerCase(); });
    if (severe.length) {
      msgs.push("<strong>You marked " + esc(severe.join(", ")) + " as severe.</strong> The Medication Guides say to tell your healthcare provider about " +
        "stomach problems that are severe or won’t go away. Contact your prescriber today. For severe stomach-area pain that won’t go away, get medical help right away.");
    }
    var gi = ["vomiting", "diarrhea"].some(function (k) { return entry[k] === "moderate" || entry[k] === "severe"; });
    if (gi) msgs.push("<strong>Vomiting or diarrhea can lead to dehydration.</strong> Tell your healthcare provider right away if it does not go away.");
    return msgs;
  }

  function showAlert(msgs) {
    var box = $("log-alert");
    if (!msgs.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.innerHTML = msgs.map(function (m) { return "<p>" + m + "</p>"; }).join("") + '<p><a href="#red-flags">See the red-flag list</a></p>';
    box.classList.remove("hidden");
  }

  function symptomSummary(e) {
    var parts = SYMPTOMS.filter(function (s) { return e[s[0]] && e[s[0]] !== "none"; })
      .map(function (s) { return s[1] + " (" + e[s[0]] + ")"; });
    if (e.red_flag) parts.unshift("RED FLAG");
    return parts.join(", ") || "none noted";
  }

  function renderLog() {
    var log = getLog().slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var tb = document.querySelector("#log-table tbody");
    tb.innerHTML = "";
    log.forEach(function (e) {
      var del = el("button", { type: "button", "class": "ghost", "aria-label": "Delete entry for " + e.date, text: "Delete" });
      del.addEventListener("click", function () {
        if (!confirm("Delete the entry for " + e.date + "?")) return;
        setLog(getLog().filter(function (x) { return x.id !== e.id; }));
        renderLog(); toast("Entry deleted.");
      });
      var tr = el("tr", null, [
        el("td", { text: e.date }), el("td", { text: symptomSummary(e) }),
        el("td", { text: e.protein_g != null ? e.protein_g + " g" : "—" }),
        el("td", { text: e.fluids_cups != null ? e.fluids_cups + " cups" : "—" }),
        el("td", { text: e.fiber_g != null ? e.fiber_g + " g" : "—" }),
        el("td", { text: e.strength ? "Yes" : "—" }),
        el("td", null, [del])
      ]);
      tb.appendChild(tr);
    });
    $("log-empty").classList.toggle("hidden", log.length > 0);
    $("log-table").classList.toggle("hidden", log.length === 0);
    renderSummary();
  }

  function lastNDays(n) {
    var cutoff = isoLocal(addDays(new Date(), -(n - 1)));
    return getLog().filter(function (e) { return e.date >= cutoff && e.date <= today(); });
  }
  function avg(arr, k) {
    var v = arr.map(function (e) { return e[k]; }).filter(function (x) { return x != null; });
    return v.length ? Math.round((v.reduce(function (a, b) { return a + b; }, 0) / v.length) * 10) / 10 : null;
  }
  function stat(value, label) { return '<div class="stat"><b>' + esc(value) + "</b><span>" + esc(label) + "</span></div>"; }
  function renderSummary() {
    var w = lastNDays(7);
    var days = {}; w.forEach(function (e) { days[e.date] = true; });
    var strengthDays = {}; w.forEach(function (e) { if (e.strength) strengthDays[e.date] = true; });
    var symptomDays = {}; w.forEach(function (e) {
      if (SYMPTOMS.some(function (s) { return e[s[0]] === "moderate" || e[s[0]] === "severe"; })) symptomDays[e.date] = true;
    });
    var rf = w.filter(function (e) { return e.red_flag; }).length;
    var a;
    $("summary").innerHTML =
      stat(Object.keys(days).length, "days logged") +
      stat((a = avg(w, "protein_g")) != null ? a + " g" : "—", "avg protein / entry") +
      stat((a = avg(w, "fluids_cups")) != null ? a + " cups" : "—", "avg fluids / entry") +
      stat((a = avg(w, "fiber_g")) != null ? a + " g" : "—", "avg fiber / entry") +
      stat(Object.keys(strengthDays).length, "strength days") +
      stat(Object.keys(symptomDays).length, "days w/ moderate+ symptoms") +
      (rf ? stat(rf, "red-flag entries — tell your prescriber") : "");
  }

  function logToRows(log) {
    var rows = [LOG_FIELDS.slice()];
    log.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
      rows.push(LOG_FIELDS.map(function (f) {
        var v = e[f];
        if (typeof v === "boolean") return v ? "yes" : "no";
        return v == null ? "" : v;
      }));
    });
    return rows;
  }

  function initLog() {
    buildSymptomGrid();
    $("f-date").value = today();
    $("log-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var entry = readForm();
      var log = getLog(); log.push(entry); setLog(log);
      showAlert(alertFor(entry));
      renderLog();
      toast("Saved " + entry.date + " to this browser.");
    });
    $("log-form").addEventListener("reset", function () {
      setTimeout(function () { $("f-date").value = today(); showAlert([]); }, 0);
    });
    $("f-redflag").addEventListener("change", function () { if (this.checked) showAlert(alertFor({ red_flag: true })); });
    $("btn-export").addEventListener("click", function () {
      var log = getLog();
      if (!log.length) { toast("Nothing to export yet."); return; }
      download("glp1-support-log-" + today() + ".csv", toCSV([[EXPORT_NOTE]].concat(logToRows(log))), "text/csv");
    });
    $("btn-sample").addEventListener("click", function () {
      var log = getLog();
      var base = new Date();
      var samples = [
        { off: -2, nausea: "mild", constipation: "mild", protein_g: 70, fluids_cups: 7, fiber_g: 18, activity_min: 30, strength: true },
        { off: -1, nausea: "moderate", low_appetite: "moderate", protein_g: 55, fluids_cups: 6, fiber_g: 14, activity_min: 20, strength: false },
        { off: 0, fatigue: "mild", protein_g: 80, fluids_cups: 8, fiber_g: 22, activity_min: 40, strength: true }
      ];
      samples.forEach(function (s) {
        var e = { id: uid(), date: isoLocal(addDays(base, s.off)), medicine: "(sample)", dose_as_prescribed: "", dose_today: "", injection_site: "",
          weight: null, red_flag: false, notes: "Sample entry — delete me" };
        SYMPTOMS.forEach(function (x) { e[x[0]] = s[x[0]] || "none"; });
        ["protein_g", "fluids_cups", "fiber_g", "activity_min", "strength"].forEach(function (k) { e[k] = s[k]; });
        log.push(e);
      });
      setLog(log); renderLog(); toast("Added 3 sample days (marked “sample”).");
    });
    renderLog();
  }

  // ---------- 2. Targets ----------
  var DAILY_ITEMS = [
    ["protein_meals", "Included a protein food at most meals", "Protein is a priority to help preserve muscle — 2025 advisory"],
    ["small_meals", "Ate regular, smaller meals (avoided very long gaps and very large meals)", "2025 advisory, Table 6"],
    ["fluids", "Sipped fluids through the day", "Medication Guides: drink fluids to reduce dehydration risk"],
    ["produce", "Had fruits and/or vegetables", "2025 advisory, Table 6"],
    ["whole_grains", "Had whole grains, beans, nuts, or seeds for fiber (increasing gradually)", "MedlinePlus fiber; 2025 advisory"],
    ["limit_sweet", "Limited sugary drinks and highly processed snacks", "2025 advisory, Table 6"],
    ["alcohol", "Kept alcohol minimal (it may worsen nausea and reflux)", "2025 advisory"],
    ["log_symptoms", "Logged any side effects to share with my care team", "Organizing step"]
  ];

  function renderChecklist(containerId, items, getState, setState) {
    var c = $(containerId); c.innerHTML = "";
    var st = getState();
    items.forEach(function (it) {
      var id = containerId + "-" + it[0];
      var cb = el("input", { type: "checkbox", id: id, checked: !!st[it[0]] });
      cb.addEventListener("change", function () { var s = getState(); s[it[0]] = cb.checked; setState(s); });
      var lab = el("label", { "for": id }, [document.createTextNode(it[1])]);
      if (it[2]) lab.appendChild(el("span", { "class": "src", text: it[2] }));
      c.appendChild(el("div", { "class": "check-item" }, [cb, lab]));
    });
  }

  function renderProtein() {
    var w = num($("p-weight").value), unit = $("p-unit").value;
    var out = $("p-out");
    if (w == null || w <= 0) { out.innerHTML = '<p class="small">Enter a weight to see the general reference numbers.</p>'; return; }
    var kg = unit === "lb" ? w / 2.20462 : w;
    function r(x) { return Math.round(x); }
    out.innerHTML =
      stat(r(kg * 0.8) + " g/day", "General adult RDA reference (0.8 g/kg)") +
      stat(r(kg * 1.2) + "–" + r(kg * 1.6) + " g/day", "Range proposed in some guidance during active weight loss (1.2–1.6 g/kg)") +
      '<p class="small">Based on the weight you entered (≈' + r(kg) + " kg). Experts have not agreed which body weight to use, and actual weight can overestimate needs. " +
      "<strong>Ask your clinician or a registered dietitian</strong> for your own target — especially if you have kidney disease.</p>";
  }

  function initTargets() {
    var prefs = load(K.prefs, {});
    if (prefs.weight) $("p-weight").value = prefs.weight;
    if (prefs.unit) $("p-unit").value = prefs.unit;
    function savePrefs() { save(K.prefs, { weight: $("p-weight").value, unit: $("p-unit").value }); renderProtein(); }
    $("p-weight").addEventListener("input", savePrefs);
    $("p-unit").addEventListener("change", savePrefs);
    renderProtein();
    renderChecklist("daily-checklist", DAILY_ITEMS,
      function () { var d = load(K.daily, {}); return d[today()] || {}; },
      function (s) { var d = load(K.daily, {}); d[today()] = s; save(K.daily, d); });
  }

  // ---------- 3. Strength ----------
  var STRENGTH_ITEMS = [
    ["ask_first", "Asked my clinician whether strength training is safe for me and whether I have any limits", "CDC; 2025 advisory"],
    ["two_days", "Planned muscle-strengthening on 2 or more days this week", "CDC adult guideline"],
    ["all_groups", "Covered all major muscle groups: legs, hips, back, abdomen, chest, shoulders, arms", "CDC adult guideline"],
    ["aerobic", "Aimed toward 150 minutes of moderate activity (e.g. brisk walking) across the week", "CDC adult guideline"],
    ["progress", "Started light and progressed gradually (bodyweight, bands, or weights)", "General safety prompt"],
    ["protein_training", "Paired training with protein-containing meals", "2025 advisory: resistance training plus appropriate diet"],
    ["assessment", "Asked whether my strength, function, or body composition should be checked", "2025 advisory"],
    ["referral", "Asked about a referral to a physical therapist or qualified trainer if I’m unsure where to start", "Organizing step"],
    ["sleep", "Protected sleep and rest days", "2025 advisory lists sleep in lifestyle assessment"]
  ];
  var weekOffset = 0;
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
  function renderWeek() {
    var start = addDays(mondayOf(new Date()), weekOffset * 7);
    var data = load(K.week, {});
    var logDays = {}; getLog().forEach(function (e) { if (e.strength) logDays[e.date] = true; });
    $("week-label").textContent = "Week of " + fmtDate(isoLocal(start));
    var g = $("week-grid"); g.innerHTML = "";
    for (var i = 0; i < 7; i++) {
      (function (d) {
        var key = isoLocal(d);
        var rec = data[key] || {};
        var name = d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
        var cb = el("input", { type: "checkbox", id: "wk-s-" + key, checked: rec.s != null ? !!rec.s : !!logDays[key] });
        var mins = el("input", { type: "number", id: "wk-m-" + key, min: "0", max: "600", step: "5", inputmode: "numeric", "aria-label": "Activity minutes on " + name });
        if (rec.m != null) mins.value = rec.m;
        function persist() {
          var all = load(K.week, {}); all[key] = { s: cb.checked, m: num(mins.value) }; save(K.week, all); weekSum();
        }
        cb.addEventListener("change", persist); mins.addEventListener("input", persist);
        g.appendChild(el("div", { "class": "day-cell" }, [
          el("span", { "class": "dname", text: name }),
          el("label", { "for": "wk-s-" + key }, [cb, document.createTextNode("Strength")]),
          el("label", { "for": "wk-m-" + key, text: "Active min" }), mins
        ]));
      })(addDays(start, i));
    }
    weekSum();
  }
  function weekSum() {
    var boxes = document.querySelectorAll('#week-grid input[type="checkbox"]');
    var s = 0, m = 0;
    boxes.forEach(function (b) { if (b.checked) s++; });
    document.querySelectorAll('#week-grid input[type="number"]').forEach(function (n) { m += num(n.value) || 0; });
    $("week-sum").innerHTML = stat(s + " / 2+", "strength days (CDC general guideline)") + stat(m + " / 150", "active minutes (moderate)");
  }
  function initStrength() {
    renderChecklist("strength-checklist", STRENGTH_ITEMS,
      function () { return load(K.strength, {}); }, function (s) { save(K.strength, s); });
    $("btn-week-prev").addEventListener("click", function () { weekOffset--; renderWeek(); });
    $("btn-week-next").addEventListener("click", function () { weekOffset++; renderWeek(); });
    renderWeek();
  }

  // ---------- 4. Plan ----------
  var REASONS = ["Cost or coverage", "Side effects", "Reached a goal", "Medicine shortage / refill trouble", "Planning pregnancy",
    "Upcoming surgery or procedure", "Not seeing the results I expected", "Just want a long-term plan"];
  var HABITS = ["Protein at most meals", "Strength training 2+ days/week", "Regular activity", "Regular meal times", "Sleep routine",
    "Keep logging symptoms & habits", "Regular check-ins with my care team", "Work with a dietitian", "Stress / mood support"];
  var PLAN_FIELDS = ["pl-status", "pl-change", "pl-visit", "pl-agreed", "pl-signals", "pl-rd", "pl-pt", "pl-pcp"];

  function chipGroup(containerId, options, selected) {
    var c = $(containerId); c.innerHTML = "";
    options.forEach(function (o, i) {
      var id = containerId + "-" + i;
      var cb = el("input", { type: "checkbox", id: id, value: o, checked: selected.indexOf(o) >= 0 });
      c.appendChild(el("label", { "for": id }, [cb, document.createTextNode(o)]));
    });
  }
  function chipValues(containerId) {
    return Array.prototype.slice.call(document.querySelectorAll("#" + containerId + " input:checked")).map(function (x) { return x.value; });
  }
  function readPlan() {
    var p = {};
    PLAN_FIELDS.forEach(function (f) { p[f] = $(f).value; });
    p.reasons = chipValues("pl-reasons"); p.habits = chipValues("pl-habits");
    return p;
  }
  function renderCheckins() {
    var ul = $("pl-checkins"); ul.innerHTML = "";
    var ch = $("pl-change").value;
    if (!ch) { ul.appendChild(el("li", { "class": "small", text: "Set a “date of change” to see check-in dates." })); return; }
    [30, 60, 90].forEach(function (n) {
      var d = isoLocal(addDays(parseISO(ch), n));
      ul.appendChild(el("li", { text: "Day " + n + ": " + fmtDate(d) + " — review your log, habits, and questions with your care team." }));
    });
  }
  function planText() {
    var p = readPlan();
    var lines = ["MY GLP-1 MAINTENANCE / TRANSITION PLAN", "Made with GLP-1 Support (Arup Banerjee Labs) on " + today(),
      "Educational/organizing tool only - not medical advice. My prescriber decides any medicine changes.", "",
      "Where I am now: " + (p["pl-status"] || "-"),
      "Reasons to discuss: " + (p.reasons.join("; ") || "-"),
      "Date of change: " + (p["pl-change"] || "-"),
      "Next prescriber visit: " + (p["pl-visit"] || "-"), "",
      "What my prescriber and I agreed:", p["pl-agreed"] || "-", "",
      "Signs we agreed I should call about:", p["pl-signals"] || "-", "",
      "Habits I want to keep: " + (p.habits.join("; ") || "-"), "",
      "Dietitian: " + (p["pl-rd"] || "-"), "Trainer / PT: " + (p["pl-pt"] || "-"), "Primary care / prescriber: " + (p["pl-pcp"] || "-")];
    if (p["pl-change"]) {
      lines.push("", "Check-ins:");
      [30, 60, 90].forEach(function (n) { lines.push("  Day " + n + ": " + isoLocal(addDays(parseISO(p["pl-change"]), n))); });
    }
    lines.push("", EMERGENCY_LINE, "Terms of Use: https://ultimatixarup.github.io/arup-banerjee-labs/glp1-support/terms.html");
    return lines.join("\r\n");
  }
  function initPlan() {
    var p = load(K.plan, {});
    chipGroup("pl-reasons", REASONS, p.reasons || []);
    chipGroup("pl-habits", HABITS, p.habits || []);
    PLAN_FIELDS.forEach(function (f) { if (p[f] != null) $(f).value = p[f]; });
    $("pl-change").addEventListener("change", renderCheckins);
    $("btn-plan-save").addEventListener("click", function () { if (save(K.plan, readPlan())) toast("Plan saved in this browser."); });
    $("btn-plan-dl").addEventListener("click", function () { download("glp1-plan-" + today() + ".txt", planText()); });
    $("btn-plan-print").addEventListener("click", function () { printPanel("panel-plan"); });
    renderCheckins();
  }

  // ---------- 5. Insurance ----------
  var INS_ITEMS = [
    ["formulary", "Is my medicine on my plan’s drug list (formulary), and for which uses?"],
    ["pa_needed", "Is prior authorization required? What does my prescriber need to send?"],
    ["pa_expiry", "How long does an approval last, and when must it be renewed?"],
    ["step", "Are there step-therapy rules or quantity limits?"],
    ["program", "Does my plan require a lifestyle or nutrition program alongside the medicine?"],
    ["cost", "What will I pay at my pharmacy vs. the plan’s mail-order pharmacy?"],
    ["denied", "If it’s denied, how do I appeal, and what is the deadline?"],
    ["year_change", "Will coverage change at the next plan year or if I change jobs or plans?"],
    ["hsa", "Ask the plan administrator: are related costs (e.g. dietitian visits) HSA/FSA-eligible?"],
    ["dietitian", "Does my plan cover visits with a registered dietitian or physical therapist?"],
    ["refill_early", "How early can I request a refill, and does the pharmacy have my medicine in stock?"],
    ["shortage", "If my pharmacy can’t fill it, I will call my prescriber before changing anything"]
  ];
  var INS_FIELDS = ["in-pa", "in-pa-exp", "in-refill", "in-renew", "in-pharm", "in-plan", "in-notes"];
  function insReminders() {
    var out = [];
    var t = parseISO(today());
    [["in-pa-exp", "Prior auth expires"], ["in-refill", "Next refill"], ["in-renew", "Plan renewal"]].forEach(function (f) {
      var v = $(f[0]).value; if (!v) return;
      var days = Math.round((parseISO(v) - t) / 86400000);
      out.push(stat(days < 0 ? Math.abs(days) + " days ago" : days === 0 ? "today" : "in " + days + " days", f[1] + " (" + v + ")"));
    });
    $("ins-reminders").innerHTML = out.join("");
  }
  function initIns() {
    var st = load(K.ins, { checks: {}, fields: {} });
    renderChecklist("ins-checklist", INS_ITEMS,
      function () { return (load(K.ins, { checks: {}, fields: {} }).checks) || {}; },
      function (s) { var all = load(K.ins, { checks: {}, fields: {} }); all.checks = s; save(K.ins, all); });
    INS_FIELDS.forEach(function (f) { if (st.fields && st.fields[f] != null) $(f).value = st.fields[f]; $(f).addEventListener("change", insReminders); });
    $("btn-ins-save").addEventListener("click", function () {
      var all = load(K.ins, { checks: {}, fields: {} }); all.fields = {};
      INS_FIELDS.forEach(function (f) { all.fields[f] = $(f).value; });
      if (save(K.ins, all)) toast("Details saved in this browser.");
      insReminders();
    });
    insReminders();
  }

  // ---------- 6. Questions ----------
  var QBANK = {
    "Side effects": [
      "Which side effects are expected for me, and which mean I should call you right away?",
      "What should I do if nausea, vomiting, or diarrhea makes it hard to drink enough fluids?",
      "Could this medicine affect how my other medicines work? (The labels say it slows stomach emptying.)"
    ],
    "Nutrition & protein": [
      "What daily protein range is right for me, and which body weight should it be based on?",
      "Could you refer me to a registered dietitian?",
      "Should I have any tests to check for nutrient deficiencies while eating less?"
    ],
    "Muscle & strength": [
      "Is it safe for me to start or increase strength training? Any limits I should know about?",
      "Should my muscle strength, function, or body composition be checked?",
      "Would physical therapy or a trainer referral make sense for me?"
    ],
    "Maintenance / coming off": [
      "How long do you expect I will take this medicine, and how will we decide?",
      "If we change or stop it, what is the plan and what follow-up will we schedule?",
      "After a change, what signs or changes should prompt me to contact you?",
      "What habits matter most for keeping my progress if the medicine changes?"
    ],
    "Insurance & refills": [
      "Will your office handle the prior authorization? What do you need from me?",
      "If coverage is denied or ends, will you support an appeal, and what are my options?",
      "If my pharmacy can’t fill my prescription, what should I do?"
    ],
    "Surgery or procedures": [
      "I have a procedure or sedation coming up — what should I tell the anesthesia team?"
    ],
    "Pregnancy & family planning": [
      "I am pregnant, breastfeeding, or planning a pregnancy — what do I need to know about this medicine?",
      "Does this medicine affect my birth control? (The Zepbound label mentions birth-control pills.)"
    ],
    "Diabetes & blood sugar": [
      "How should I watch for low blood sugar with my other diabetes medicines?",
      "Should I tell my eye doctor I’m on this medicine?"
    ],
    "Mood, eating & wellbeing": [
      "I’ve noticed changes in my mood, eating patterns, or relationship with food — who can I talk to?",
      "How can I support sleep and stress while on this medicine?"
    ]
  };
  function initQuestions() {
    var sel = load(K.q, ["Side effects"]);
    chipGroup("q-topics", Object.keys(QBANK), sel);
    $("q-topics").addEventListener("change", function () { save(K.q, chipValues("q-topics")); });
    $("btn-q-gen").addEventListener("click", genQuestions);
    $("btn-q-copy").addEventListener("click", function () {
      var txt = questionsText(); if (!txt) { toast("Make a list first."); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { toast("Copied."); }, function () { toast("Copy failed — use Download instead."); });
      } else toast("Copy not supported here — use Download.");
    });
    $("btn-q-dl").addEventListener("click", function () {
      var txt = questionsText(); if (!txt) { toast("Make a list first."); return; }
      download("glp1-questions-" + today() + ".txt", txt);
    });
    $("btn-q-print").addEventListener("click", function () { printPanel("panel-q"); });
  }
  var lastQuestions = null;
  function logSummaryLines() {
    var w = lastNDays(14);
    if (!w.length) return ["No log entries in the last 14 days."];
    var lines = [];
    var days = {}; w.forEach(function (e) { days[e.date] = true; });
    lines.push("Days logged: " + Object.keys(days).length + " of the last 14.");
    SYMPTOMS.forEach(function (s) {
      var md = {}; w.forEach(function (e) { if (e[s[0]] === "moderate" || e[s[0]] === "severe") md[e.date] = true; });
      var n = Object.keys(md).length; if (n) lines.push(s[1] + ": moderate or severe on " + n + " day(s).");
    });
    var rf = w.filter(function (e) { return e.red_flag; }).map(function (e) { return e.date; });
    if (rf.length) lines.push("Red-flag symptoms logged on: " + rf.join(", ") + ".");
    var a = avg(w, "protein_g"); if (a != null) lines.push("Average protein logged: about " + a + " g per entry.");
    a = avg(w, "fluids_cups"); if (a != null) lines.push("Average fluids logged: about " + a + " cups per entry.");
    var sd = {}; w.forEach(function (e) { if (e.strength) sd[e.date] = true; });
    lines.push("Strength-training days logged: " + Object.keys(sd).length + ".");
    return lines;
  }
  function genQuestions() {
    var topics = chipValues("q-topics");
    if (!topics.length) { toast("Pick at least one topic."); return; }
    lastQuestions = { topics: topics, log: $("q-include-log").checked ? logSummaryLines() : null };
    var h = "";
    if (lastQuestions.log) h += "<h3>My last 14 days (from my log)</h3><ul class=\"plain-list\">" + lastQuestions.log.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>";
    topics.forEach(function (t) {
      h += "<h3>" + esc(t) + "</h3><ol>" + QBANK[t].map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ol>";
    });
    h += '<p class="small mt">Bring your current medicine list. This list is a conversation starter, not medical advice.</p>';
    $("q-out").innerHTML = h;
  }
  function questionsText() {
    if (!lastQuestions) return "";
    var L = ["QUESTIONS FOR MY PRESCRIBER - " + today(), "(Made with GLP-1 Support, Arup Banerjee Labs. Not medical advice.)", EMERGENCY_LINE, ""];
    if (lastQuestions.log) { L.push("MY LAST 14 DAYS"); lastQuestions.log.forEach(function (l) { L.push("- " + l); }); L.push(""); }
    lastQuestions.topics.forEach(function (t) {
      L.push(t.toUpperCase()); QBANK[t].forEach(function (q, i) { L.push((i + 1) + ". " + q); }); L.push("");
    });
    return L.join("\r\n");
  }

  // ---------- data controls ----------
  function exportAll() {
    var rows = [["section", "date_or_key", "field", "value"]];
    logToRows(getLog()).slice(1).forEach(function (r) {
      LOG_FIELDS.forEach(function (f, i) { if (i > 0 && r[i] !== "") rows.push(["log", r[0], f, r[i]]); });
    });
    var d = load(K.daily, {}); Object.keys(d).sort().forEach(function (day) {
      Object.keys(d[day]).forEach(function (k) { if (d[day][k]) rows.push(["daily_checklist", day, k, "done"]); });
    });
    var w = load(K.week, {}); Object.keys(w).sort().forEach(function (day) {
      if (w[day].s) rows.push(["activity_week", day, "strength", "yes"]);
      if (w[day].m != null) rows.push(["activity_week", day, "active_minutes", w[day].m]);
    });
    var s = load(K.strength, {}); Object.keys(s).forEach(function (k) { if (s[k]) rows.push(["strength_checklist", "", k, "done"]); });
    var p = load(K.plan, null); if (p) Object.keys(p).forEach(function (k) {
      var v = Array.isArray(p[k]) ? p[k].join("; ") : p[k]; if (v) rows.push(["plan", "", k, v]);
    });
    var ins = load(K.ins, null); if (ins) {
      Object.keys(ins.checks || {}).forEach(function (k) { if (ins.checks[k]) rows.push(["insurance_checklist", "", k, "done"]); });
      Object.keys(ins.fields || {}).forEach(function (k) { if (ins.fields[k]) rows.push(["insurance_details", "", k, ins.fields[k]]); });
    }
    if (rows.length === 1) { toast("Nothing saved yet."); return; }
    download("glp1-support-all-" + today() + ".csv", toCSV([[EXPORT_NOTE]].concat(rows)), "text/csv");
  }
  function clearAll() {
    if (!confirm("Delete ALL GLP-1 Support data saved in this browser? This cannot be undone. (Export first if you want a copy.)")) return;
    try {
      var rm = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) rm.push(k); }
      rm.forEach(function (k) { localStorage.removeItem(k); });
    } catch (_) {}
    document.querySelectorAll("form").forEach(function (f) { f.reset(); });
    $("p-weight").value = ""; $("q-out").innerHTML = '<p class="results-empty">Choose topics and select “Make my question list”.</p>'; lastQuestions = null;
    initAllViews();
    toast("All GLP-1 Support data cleared from this browser.");
  }

  function initAllViews() {
    $("f-date").value = today();
    renderLog(); renderProtein();
    renderChecklist("daily-checklist", DAILY_ITEMS,
      function () { var d = load(K.daily, {}); return d[today()] || {}; },
      function (s) { var d = load(K.daily, {}); d[today()] = s; save(K.daily, d); });
    renderChecklist("strength-checklist", STRENGTH_ITEMS, function () { return load(K.strength, {}); }, function (s) { save(K.strength, s); });
    renderWeek();
    var p = load(K.plan, {});
    chipGroup("pl-reasons", REASONS, p.reasons || []); chipGroup("pl-habits", HABITS, p.habits || []);
    renderCheckins();
    renderChecklist("ins-checklist", INS_ITEMS,
      function () { return (load(K.ins, { checks: {}, fields: {} }).checks) || {}; },
      function (s) { var all = load(K.ins, { checks: {}, fields: {} }); all.checks = s; save(K.ins, all); });
    insReminders();
    chipGroup("q-topics", Object.keys(QBANK), load(K.q, ["Side effects"]));
  }

  window.addEventListener("afterprint", function () {
    document.querySelectorAll(".tabpanel").forEach(function (p) { p.removeAttribute("data-print"); });
  });

  initLog(); initTargets(); initStrength(); initPlan(); initIns(); initQuestions();
  $("btn-export-all").addEventListener("click", exportAll);
  $("btn-clear").addEventListener("click", clearAll);

  // Optional feedback link (plain link to a separate form; no request is made from this page).
  (function () {
    var url = (window.LABS_CONFIG || {}).GLP1_FEEDBACK_FORM_URL;
    var p = $("glp1-feedback");
    if (!p || typeof url !== "string" || !/^https:\/\/[^\s"'<>]+$/.test(url)) return;
    p.querySelector("a").href = url;
    p.hidden = false;
  })();

})();
