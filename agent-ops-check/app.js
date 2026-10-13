/* agent-ops-check browser UI. All work happens in this tab via vendor/agent-ops-check.js
 * (generated from the CLI's src/ and rules/). No network, no storage, no analytics. */
(function () {
  "use strict";
  var AOC = window.AgentOpsCheck, S = window.AOC_SAMPLES || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var queue = [], docs = [], steFiles = [], steDict = null, lastOutputs = null, lastReport = null;

  $("engine-ver").textContent = "v" + AOC.version;
  var ri = AOC.rulesInfo(); $("rules-ver").textContent = ri.version;

  function status(t) { $("status").textContent = t; }
  function renderQueue() {
    $("queue").innerHTML = queue.map(function (q, i) { return "<li>" + esc(q.kind === "zip" ? q.name : q.kind === "folder" ? q.name + "/" : q.entries.map(function (e) { return e.path; }).join(", ")) + " · " + q.entries.length + " file(s) <button type=button class=ghost data-rm=" + i + ">remove</button></li>"; }).join("")
      + docs.map(function (d) { return "<li>ADSF doc: " + esc(d.path) + "</li>"; }).join("")
      + steFiles.map(function (d) { return "<li>STE file: " + esc(d.name) + "</li>"; }).join("")
      + (steDict ? "<li>STE word list: " + esc(steDict.path) + "</li>" : "");
  }
  $("queue").addEventListener("click", function (e) { var i = e.target.getAttribute("data-rm"); if (i != null) { queue.splice(+i, 1); renderQueue(); } });

  function readText(file) { return file.text(); }
  function keep(path, size) { return AOC.wanted(path) && size <= (AOC.maxBytes ? AOC.maxBytes(path) : AOC.MAX_BYTES); } // same filter as the CLI; others are never read
  async function addZip(file) {
    var entries = await AOC.readZip(window.JSZip, await file.arrayBuffer());
    queue.push({ name: file.name, kind: "zip", entries: entries });
  }
  async function addFolderFiles(list) { // [{file, rel:"top/sub/x"}]
    var groups = {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i], parts = it.rel.split("/"), top = parts.length > 1 ? parts.shift() : "files", rel = parts.join("/");
      if (/(^|\/)(node_modules|\.git)(\/|$)/.test(rel)) continue;
      if (!keep(rel, it.file.size)) continue;
      (groups[top] = groups[top] || []).push({ path: rel, text: await readText(it.file) });
    }
    Object.keys(groups).forEach(function (k) { queue.push({ name: k, kind: k === "files" ? "file" : "folder", entries: groups[k] }); });
  }
  async function addLoose(files) {
    var entries = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (/\.zip$/i.test(f.name)) { await addZip(f); continue; }
      if (keep(f.name, f.size)) entries.push({ path: f.name, text: await readText(f) });
    }
    if (entries.length) queue.push({ name: "files", kind: "file", entries: entries });
  }
  function guard(fn) { return async function (e) { try { status("Reading…"); await fn(e); status(""); } catch (err) { status("Could not read input: " + err.message); } renderQueue(); }; }

  $("in-folder").addEventListener("change", guard(async function (e) { await addFolderFiles([].map.call(e.target.files, function (f) { return { file: f, rel: f.webkitRelativePath || f.name }; })); e.target.value = ""; }));
  $("in-zip").addEventListener("change", guard(async function (e) { for (var i = 0; i < e.target.files.length; i++) await addZip(e.target.files[i]); e.target.value = ""; }));
  $("in-files").addEventListener("change", guard(async function (e) { await addLoose([].slice.call(e.target.files)); e.target.value = ""; }));
  $("in-docs").addEventListener("change", guard(async function (e) { for (var i = 0; i < e.target.files.length; i++) { var f = e.target.files[i]; if (f.size <= 5 * 1024 * 1024) docs.push({ path: f.name, text: await f.text() }); } e.target.value = ""; }));
  $("ste-files").addEventListener("change", guard(async function (e) { for (var i = 0; i < e.target.files.length; i++) steFiles.push({ name: e.target.files[i].name, text: await e.target.files[i].text() }); e.target.value = ""; }));
  $("ste-dict").addEventListener("change", guard(async function (e) { var f = e.target.files[0]; steDict = f ? { path: f.name, text: await f.text() } : null; }));

  // Drag and drop: folders via webkitGetAsEntry, zips and files directly.
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove("over"); }); });
  function walkEntry(entry, prefix, out) {
    return new Promise(function (res) {
      if (entry.isFile) entry.file(function (f) { out.push({ file: f, rel: prefix + f.name }); res(); }, res);
      else if (entry.isDirectory) {
        var rd = entry.createReader(), all = [];
        (function next() { rd.readEntries(function (ents) { if (!ents.length) Promise.all(all.map(function (c) { return walkEntry(c, prefix + entry.name + "/", out); })).then(res); else { all = all.concat([].slice.call(ents)); next(); } }, res); })();
      } else res();
    });
  }
  drop.addEventListener("drop", guard(async function (e) {
    e.preventDefault();
    var items = [].slice.call(e.dataTransfer.items || []), loose = [];
    for (var i = 0; i < items.length; i++) {
      var en = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
      if (en && en.isDirectory) { var out = []; await walkEntry(en, "", out); await addFolderFiles(out); }
      else { var f = items[i].getAsFile(); if (f) loose.push(f); }
    }
    if (!items.length) loose = [].slice.call(e.dataTransfer.files);
    await addLoose(loose);
  }));

  function clearAll() { queue = []; docs = []; steFiles = []; steDict = null; ["ste-text", "cmp-orig", "cmp-rew", "ignore"].forEach(function (id) { $(id).value = ""; }); renderQueue(); status(""); }
  $("btn-clear").onclick = function () { clearAll(); $("results").classList.add("hidden"); $("details").classList.add("hidden"); $("results-empty").classList.remove("hidden"); };
  $("btn-bad").onclick = function () { clearAll(); queue.push({ name: "bad-agent", kind: "folder", entries: S["bad-agent"] }); renderQueue(); run(); };
  $("btn-good").onclick = function () { clearAll(); queue.push({ name: "good-agent", kind: "folder", entries: S["good-agent"] }); renderQueue(); run(); };
  $("btn-ste").onclick = function () { clearAll(); $("ste-text").value = S["ste/rewrite.txt"]; $("cmp-orig").value = S["ste/original.txt"]; $("cmp-rew").value = S["ste/rewrite.txt"]; steDict = { path: "approved-words.txt", text: S["ste/approved-words.txt"] }; renderQueue(); run(); };
  $("btn-run").onclick = function () { run(); };

  function run() {
    var req = { inputs: queue, docs: docs, steTexts: steFiles.slice(), options: {
      noLabs: $("opt-nolabs").checked, noSte: $("opt-noste").checked, noInjection: $("opt-noinj").checked, noEvals: $("opt-noevals").checked,
      ignore: $("ignore").value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean) } };
    if ($("ste-text").value.trim()) req.steTexts.unshift({ name: "(pasted text)", text: $("ste-text").value });
    if (steDict) req.steDict = steDict;
    if ($("cmp-orig").value.trim() && $("cmp-rew").value.trim()) req.steCompare = [{ path: "original.txt", text: $("cmp-orig").value }, { path: "rewrite.txt", text: $("cmp-rew").value }];
    if (!queue.length && !docs.length && !req.steTexts.length && !req.steCompare) { status("Add a folder, .zip, files or STE text first."); return; }
    var r;
    try { r = AOC.scan(req); } catch (err) { status("Scan failed: " + err.message); return; }
    lastReport = r; lastOutputs = AOC.outputs(r);
    status("Done: " + r.filesScanned + " file(s), " + r.agents.length + " agent(s).");
    render(r);
  }

  var SEV = function (s) { return "<span class=sev-" + esc(s) + ">" + esc(s) + "</span>"; };
  function findingsTable(fs) {
    if (!fs.length) return "<p>No findings.</p>";
    return "<table class=aoc-tbl><tr><th>Severity</th><th>Rule</th><th>Where</th><th>What</th><th>Evidence</th></tr>" + fs.map(function (f) {
      return "<tr><td>" + SEV(f.severity) + "</td><td><code>" + esc(f.rule) + "</code></td><td>" + esc(f.file + (f.line ? ":" + f.line : "")) + "</td><td>" + esc(f.message) + "</td><td>" + (f.evidence ? "<code>" + esc(f.evidence) + "</code>" : "") + "</td></tr>";
    }).join("") + "</table>";
  }
  function extra(g) {
    var yn = function (b) { return b ? "<td class=yes>yes</td>" : "<td class=no>no</td>"; };
    if (g.id === "crossover") return "<h3>Source-to-sink matrix</h3>" + (g.matrix.length ? "<table class=aoc-tbl><tr><th>Agent</th><th>Personal source</th><th>Work sink</th></tr>" + g.matrix.map(function (m) { return "<tr><td>" + esc(m.agent) + "</td><td>" + esc(m.source) + "<br><small>" + esc(m.sourceAt) + "</small></td><td>" + esc(m.sink) + "<br><small>" + esc(m.sinkAt) + "</small></td></tr>"; }).join("") + "</table>" : "<p>No agent both reads a personal source and writes to a work sink.</p>")
      + "<h3>Connector inventory</h3><table class=aoc-tbl><tr><th>Agent</th><th>Connectors</th><th>Credentials (names only)</th><th>Scopes</th></tr>" + g.inventory.map(function (a) { return "<tr><td>" + esc(a.agent) + "</td><td>" + esc(a.connectors.join(", ")) + "</td><td>" + esc(a.credentials.join(", ")) + "</td><td>" + esc(a.scopes.join(", ")) + "</td></tr>"; }).join("") + "</table>";
    if (g.id === "actions") return "<h3>Gate map</h3><table class=aoc-tbl><tr><th>Agent</th><th>Action</th><th>Where</th><th>Approval</th><th>Dry-run</th><th>Rate limit</th><th>Allowlist</th></tr>" + g.actions.map(function (t) { return "<tr><td>" + esc(t.agent) + "</td><td><code>" + esc(t.action) + "</code></td><td>" + esc(t.file + ":" + t.line) + "</td>" + yn(t.gates.approval) + yn(t.gates.dry_run) + yn(t.gates.rate_limit) + yn(t.gates.domain_allowlist) + "</tr>"; }).join("") + "</table>";
    if (g.id === "governance") { var inv = g.inventory; return "<h3>AI inventory</h3><ul><li>Providers: " + esc(Object.keys(inv.providers).join(", ") || "none found") + "</li><li>Frameworks/SDKs: " + esc(Object.keys(inv.frameworks).join(", ") || "none found") + "</li><li>Models: " + esc(Object.keys(inv.models).join(", ") || "none found") + "</li></ul>"; }
    if (g.id === "labs") return "<h3>Tool runs</h3><table class=aoc-tbl><tr><th>Tool</th><th>Input</th><th>Score</th><th>Verdict</th></tr>" + g.runs.map(function (x) { return "<tr><td>" + esc(x.tool) + "</td><td>" + esc(x.file) + "</td><td>" + esc(x.score) + "</td><td>" + esc(x.verdict) + "</td></tr>"; }).join("") + "</table>";
    if (g.id === "injection") return "<p class=hint>" + esc(g.note) + " " + g.docsScanned + " file(s) scanned.</p>";
    if (g.id === "ste") return "<p class=hint>" + esc(g.note) + "</p>" + (g.dictionary ? "<p>Approved-word list: " + esc(g.dictionary) + "</p>" : "")
      + "<table class=aoc-tbl><tr><th>Input</th><th>Sentences</th><th>Findings</th></tr>" + g.docs.map(function (d) { return "<tr><td>" + esc(d.file) + "</td><td>" + d.sentences + "</td><td>" + d.findings + "</td></tr>"; }).join("") + "</table>"
      + (g.compare ? "<h3>Information-loss check</h3><p><b>" + g.compare.missing.length + "</b> fact(s) or constraint(s) missing from the rewrite.</p><table class=aoc-tbl><tr><th>Severity</th><th>Kind</th><th>Missing value</th></tr>" + g.compare.missing.map(function (m) { return "<tr><td>" + SEV(m.severity) + "</td><td>" + esc(m.kind) + "</td><td><code>" + esc(m.value) + "</code></td></tr>"; }).join("") + "</table>" : "");
    return "";
  }
  function standardsTab(r) {
    return "<p class=hint>Coverage describes what this tool checks, mapped to each framework. It is not a compliance assessment.</p>" + r.standards.map(function (fw) {
      return "<h3>" + esc(fw.name) + "</h3><p class=hint>maps to: ✅ " + fw.summary.covered + " · 🟡 " + fw.summary.partial + " · ⬜ " + fw.summary.none + (fw.note ? " — " + esc(fw.note) : "") + "</p><table class=aoc-tbl><tr><th>Item</th><th>Title</th><th>Coverage</th><th>How</th><th>Findings (high)</th></tr>"
        + fw.items.map(function (i) { return "<tr><td>" + esc(i.id) + "</td><td>" + esc(i.title) + "</td><td>" + i.icon + " " + esc(i.coverage) + "</td><td>" + esc(i.how) + "</td><td>" + i.findings + " (" + i.high + ")</td></tr>"; }).join("") + "</table>";
    }).join("");
  }
  function evalsTab(r) {
    if (!r.evals) return "<p>Eval sets were not generated for this run.</p>";
    var rows = function (a) { return "<table class=aoc-tbl><tr><th>ID</th><th>Agent</th><th>Category</th><th>Input</th><th>Expected</th></tr>" + a.map(function (c) { return "<tr><td>" + esc(c.id) + "</td><td>" + esc(c.agent) + "</td><td>" + esc(c.category + (c.owasp ? " (" + c.owasp + ")" : "")) + "</td><td>" + esc(c.input) + "</td><td>" + esc(c.expect) + "</td></tr>"; }).join("") + "</table>"; };
    return "<p class=hint>Generated from your agent's source. These are test cases for you to run against your agent; this page does not run them.</p><h3>Functional (" + r.evals.functional.length + ")</h3>" + rows(r.evals.functional) + "<h3>Security (" + r.evals.security.length + ")</h3>" + rows(r.evals.security);
  }
  function render(r) {
    $("results-empty").classList.add("hidden"); $("results").classList.remove("hidden"); $("details").classList.remove("hidden");
    $("score-num").textContent = r.score; $("score-ring").style.setProperty("--p", r.score);
    $("score-title").textContent = r.steOnly ? "STE score" : "Overall score (crossover, actions, governance)";
    $("score-sub").textContent = r.filesScanned + " file(s) · " + r.agents.length + " agent(s) · rules " + r.rules.version + " (" + r.rules.date + ")";
    $("group-table").innerHTML = "<tr><th>Check</th><th>Score</th><th>High</th><th>Medium</th><th>Low</th></tr>" + r.groups.map(function (g) { return "<tr><td>" + esc(g.title) + "</td><td>" + g.score + "</td><td>" + g.counts.high + "</td><td>" + g.counts.medium + "</td><td>" + g.counts.low + "</td></tr>"; }).join("");
    $("network-line").textContent = "No network calls were made. Nothing left this browser tab. " + r.disclaimer;
    var tabs = r.groups.map(function (g) { return { t: g.title + " (" + g.findings.length + ")", h: function () { return extra(g) + "<h3>Findings</h3>" + findingsTable(g.findings); } }; });
    tabs.push({ t: "Standards map (" + r.standards.length + ")", h: function () { return standardsTab(r); } });
    tabs.push({ t: "Eval sets" + (r.evals ? " (" + (r.evals.functional.length + r.evals.security.length) + ")" : ""), h: function () { return evalsTab(r); } });
    $("tabs").innerHTML = tabs.map(function (t, i) { return "<button type=button role=tab data-t=" + i + (i ? "" : " class=on") + ">" + esc(t.t) + "</button>"; }).join("");
    var show = function (i) { [].forEach.call($("tabs").children, function (b) { b.classList.toggle("on", +b.getAttribute("data-t") === i); }); $("tab-body").innerHTML = tabs[i].h(); };
    $("tabs").onclick = function (e) { var i = e.target.getAttribute("data-t"); if (i != null) show(+i); };
    show(0);
    var names = Object.keys(lastOutputs);
    $("downloads").innerHTML = "<button type=button class=primary data-dl=__zip>All reports (.zip)</button>" + names.map(function (n) { return "<button type=button data-dl='" + esc(n) + "'>" + esc(n) + "</button>"; }).join("");
  }
  function save(name, blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  var MIME = { html: "text/html", json: "application/json", md: "text/markdown", sarif: "application/sarif+json", jsonl: "application/x-ndjson", txt: "text/plain" };
  $("downloads").addEventListener("click", async function (e) {
    var n = e.target.getAttribute("data-dl"); if (!n || !lastOutputs) return;
    if (n === "__zip") { var z = new window.JSZip(); Object.keys(lastOutputs).forEach(function (k) { z.file("agent-ops-report/" + k, lastOutputs[k]); }); save("agent-ops-report.zip", await z.generateAsync({ type: "blob" })); return; }
    save(n.replace(/\//g, "-"), new Blob([lastOutputs[n]], { type: MIME[n.split(".").pop()] || "text/plain" }));
  });
  // "What it checks": standards each check group maps to (generated from data/standards/ by the CLI's build-web.js).
  (function () {
    var CS = window.AOC_CHECK_STANDARDS; if (!CS) return;
    CS.groups.forEach(function (g) {
      var el = document.querySelector('[data-std-group="' + g.id + '"]'); if (!el || !g.frameworks.length) return;
      el.innerHTML = '<details class="std-details"><summary>Maps to ' + g.frameworks.length + ' frameworks</summary><ul>' + g.frameworks.map(function (fw) {
        return '<li><a href="' + esc(fw.source) + '">' + esc(fw.name) + '</a>: ' + fw.items.map(function (it) { return esc(it.icon + " " + it.id + " " + it.title); }).join("; ") + '</li>';
      }).join("") + '</ul></details>';
    });
    var L = CS.llmail, n = $("llmail-note");
    if (L && n) n.innerHTML = 'Includes ' + esc(L.rules) + ' rules derived from Microsoft’s <a href="https://huggingface.co/datasets/microsoft/llmail-inject-challenge">LLMail-Inject</a> dataset (MIT License). On ' + esc(L.heldout) + ' held-out attacks the scan flags ' + esc(L.any) + ' at any severity and ' + esc(L.medium) + ' at medium or higher, with ' + esc(L.fp) + ' false positives on the dataset’s benign emails; about a third of attacks are still missed. <a href="https://github.com/ultimatixarup/agent-ops-check/blob/main/docs/LLMAIL_BENCHMARK.md">Benchmark details</a>.';
  })();
  window.__AOC_LAST__ = function () { return lastReport; }; // for automated tests only
})();
