/**
 * Cloud Bill Smell Detector — Arup Banerjee Labs
 * Client-side heuristics on user-pasted CSV/JSON exports they already own.
 * No cloud login. No scanning other accounts. Educational smells only.
 */
(function () {
  "use strict";
  const STORAGE_KEY = "abl_cbs_runs_v1";

  const SAMPLE_CSV = `billing_period_start,billing_period_end,provider,account_alias,service,region,resource_id,resource_name,usage_type,usage_qty,usage_unit,unblended_cost_usd,currency,tags_env,tags_owner,tags_project,notes
2026-08-01,2026-08-31,aws,demo-prod,AmazonEC2,us-east-1,i-0demoec2aaa111,web-api-1,BoxUsage:t3.medium,720,Hrs,62.40,USD,prod,platform,checkout,
2026-08-01,2026-08-31,aws,demo-prod,AmazonEC2,us-east-1,i-0demoec2bbb222,old-batch-worker,BoxUsage:m5.large,720,Hrs,70.08,USD,,,,"idle-ish low util demo"
2026-08-01,2026-08-31,aws,demo-prod,AmazonEC2,us-east-1,vol-0demodisk999,orphan-vol-old-node,EBS:VolumeUsage.gp3,500,GB-Mo,40.00,USD,,,,untagged orphaned volume
2026-08-01,2026-08-31,aws,demo-prod,AmazonS3,us-east-1,demo-logs-bucket,app-logs,TimedStorage-ByteHrs,1500000000000,Byte-Hrs,34.50,USD,prod,sre,logging,
2026-08-01,2026-08-31,aws,demo-prod,AWSDataTransfer,us-east-1,dt-demo-001,egress-spike,DataTransfer-Out-Bytes,2500000000000,Bytes,225.00,USD,prod,platform,checkout,unusual egress demo
2026-08-01,2026-08-31,aws,demo-prod,AmazonRDS,us-east-1,db-demodemo01,checkout-db,InstanceUsage:db.r5.xlarge,720,Hrs,580.00,USD,prod,data,checkout,
2026-08-01,2026-08-31,aws,demo-prod,AmazonCloudWatch,us-east-1,cw-demo-logs,ingest,TimedStorage-ByteHrs,800000000000,Byte-Hrs,48.00,USD,,,,missing owner project tags
2026-08-01,2026-08-31,gcp,demo-gcp,Compute Engine,us-central1,gce-demo-idle,notebook-leftover,N2-standard-4,720,hours,140.00,USD,,,,no labels leftover notebook
`;

  // Anonymous counts only: fixed event names, via ../shared/labs-counts.js (GoatCounter,
  // cookieless, off until configured). Never pass pasted text, findings, secrets, names, costs, or account ids.
  function track(name, detail) { if (window.LabsCount) window.LabsCount.event(name, detail); }
  let sampleLoadedText = null;
  let ownNoted = false;
  function noteOwn() {
    if (ownNoted) return;
    ownNoted = true;
    track("input_kind", "own");
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return { error: "Need a header row plus at least one data row." };
    const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      if (cols.length === 1 && !cols[0]) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (cols[idx] || "").trim(); });
      rows.push(obj);
    }
    return { headers, rows };
  }

  function splitCSVLine(line) {
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { q = !q; continue; }
      if (c === "," && !q) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }

  function num(v) {
    if (v == null || v === "") return 0;
    const n = parseFloat(String(v).replace(/[$,]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function pickCost(row) {
    const keys = Object.keys(row);
    const prefer = ["cost_usd", "cost", "unblendedcost", "blendedcost", "amount", "net_amortized_cost", "total"];
    for (const p of prefer) {
      const k = keys.find((x) => x.replace(/\s/g, "_") === p || x === p);
      if (k && num(row[k]) !== 0) return num(row[k]);
    }
    for (const k of keys) if (/cost|amount|charge|usd/i.test(k)) return num(row[k]);
    return 0;
  }

  function pickService(row) {
    for (const k of Object.keys(row)) if (/service|product|productname|sku/i.test(k)) return row[k] || "unknown";
    return "unknown";
  }

  function pickUsage(row) {
    for (const k of Object.keys(row)) if (/usage_type|usagetype|meter|description|lineitem/i.test(k)) return row[k] || "";
    return Object.values(row).join(" ");
  }

  function pickRegion(row) {
    for (const k of Object.keys(row)) if (/region|location|availabilityzone/i.test(k)) return row[k] || "";
    return "";
  }

  function analyzeRows(rows) {
    const smells = [];
    let total = 0;
    const byService = {};
    const byRegion = {};
    rows.forEach((r) => {
      const c = pickCost(r);
      total += c;
      const svc = pickService(r);
      byService[svc] = (byService[svc] || 0) + c;
      const reg = pickRegion(r) || "unspecified";
      byRegion[reg] = (byRegion[reg] || 0) + c;
    });

    const blob = rows.map(pickUsage).join("\n") + "\n" + rows.map(pickService).join("\n");

    function add(id, title, severity, message, evidence) {
      smells.push({ id, title, severity, message, evidence });
    }

    // Data transfer / egress
    if (/DataTransfer|NatGateway-Bytes|Bandwidth|egress|Outbound|network.?egress/i.test(blob)) {
      const egressCost = rows.filter((r) => /DataTransfer|NatGateway-Bytes|Bandwidth|egress/i.test(pickUsage(r) + pickService(r)))
        .reduce((s, r) => s + pickCost(r), 0);
      if (egressCost > 0) {
        add("egress", "Data transfer / egress concentration",
          egressCost / Math.max(total, 1) > 0.2 ? "high" : "med",
          "Egress-like line items found. Review NAT, cross-AZ, and internet out — often surprise spend.",
          "~$" + egressCost.toFixed(2) + " tagged as transfer-ish");
      }
    }

    // Idle / idle-ish: Elastic IP, unused volumes patterns
    if (/ElasticIP|Idle|EarlyDelete|Snapshot|gp2(?!\d)/i.test(blob)) {
      add("idle_ish", "Idle / orphan resource smells", "med",
        "Patterns like Elastic IP, early-delete, or snapshot-heavy lines may mean unused resources. Confirm in console — this is not a live scan.",
        "Matched idle-ish usage labels in export");
    }

    // NAT gateway
    if (/NatGateway/i.test(blob)) {
      add("nat", "NAT Gateway spend", "high",
        "NAT Gateway hours/bytes often dominate small accounts. Consider VPC endpoints or consolidating egress paths.",
        "NatGateway line items present");
    }

    // CloudWatch / metrics sprawl
    if (/CloudWatch|GMD-Metrics|Monitoring/i.test(blob)) {
      const cw = rows.filter((r) => /CloudWatch|GMD-Metrics/i.test(pickService(r) + pickUsage(r)))
        .reduce((s, r) => s + pickCost(r), 0);
      if (cw > 50 || (total > 0 && cw / total > 0.08)) {
        add("metrics", "Observability bill creep", "med",
          "Metrics/logging line items are material. Custom metrics and high-cardinality labels drive this — tune retention & cardinality.",
          "~$" + cw.toFixed(2));
      }
    }

    // Multi-cloud split
    const providers = new Set();
    rows.forEach((r) => {
      const p = (r.provider || r.cloud || "").toLowerCase();
      if (/aws|amazon/.test(p + pickService(r))) providers.add("aws");
      if (/gcp|google/.test(p + pickService(r))) providers.add("gcp");
      if (/azure|microsoft/.test(p + pickService(r))) providers.add("azure");
    });
    if (providers.size >= 2) {
      add("multicloud", "Multi-cloud export detected", "low",
        "Multiple clouds in one paste — normalize tags/accounts before comparing. Tool does not log into any cloud.",
        [...providers].join(", "));
    }

    // Concentration: top service > 40%
    const ranked = Object.entries(byService).sort((a, b) => b[1] - a[1]);
    if (ranked.length && total > 0 && ranked[0][1] / total > 0.4) {
      add("concentration", "Service concentration", "med",
        "One service exceeds ~40% of pasted cost. Validate rightsizing and reservations/savings plans (educational only).",
        ranked[0][0] + " ~$" + ranked[0][1].toFixed(2));
    }

    // Missing region
    const missingRegion = rows.filter((r) => !pickRegion(r)).length;
    if (missingRegion > rows.length * 0.5) {
      add("region_gap", "Weak region attribution", "low",
        "Many rows lack region/location columns. Cost allocation and data-residency reviews get harder.",
        missingRegion + "/" + rows.length + " rows");
    }

    // Duplicate-ish same service+usage
    const seen = {};
    rows.forEach((r) => {
      const k = pickService(r) + "|" + pickUsage(r) + "|" + pickRegion(r);
      seen[k] = (seen[k] || 0) + 1;
    });
    const dups = Object.values(seen).filter((n) => n > 1).length;
    if (dups > 2) {
      add("dup_lines", "Repeated line patterns", "low",
        "Repeated service/usage/region rows — normal for daily CUR slices, but check for overlapping exports pasted twice.",
        dups + " duplicated keys");
    }

    // Score: start 100, subtract by severity
    let score = 100;
    smells.forEach((s) => {
      if (s.severity === "high") score -= 18;
      else if (s.severity === "med") score -= 10;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    if (smells.length === 0) {
      add("clean", "No strong smells in heuristics", "low",
        "Export parsed cleanly. Absence of smells ≠ optimized bill — review rightsizing separately.",
        "n/a");
      score = Math.max(score, 80);
    }

    const bucket = score <= 24 ? "0-24" : score <= 49 ? "25-49" : score <= 74 ? "50-74" : "75-100";
    const headlines = {
      "0-24": "Many cost smells — treat as a triage list, not a verdict.",
      "25-49": "Notable smells — prioritize egress/NAT/idle checks on your own accounts.",
      "50-74": "Some smells — worth a FinOps pass on the top lines.",
      "75-100": "Few heuristic smells — still verify top services manually."
    };

    return {
      score, bucket, headline: headlines[bucket], total, rows: rows.length,
      topServices: ranked.slice(0, 5).map(([n, c]) => ({ name: n, cost: c })),
      smells, providers: [...providers]
    };
  }

  function analyzeText(raw) {
    const text = String(raw || "").trim();
    if (text.length < 10) return { error: "Paste a CSV export (header + rows) or billing JSON array." };
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        const data = JSON.parse(text);
        const rows = Array.isArray(data) ? data : (data.line_items || data.results || data.Rows || [data]);
        if (!Array.isArray(rows) || !rows.length) return { error: "JSON parsed but no row array found." };
        const normalized = rows.map((r) => {
          const o = {};
          Object.keys(r).forEach((k) => { o[String(k).toLowerCase()] = String(r[k]); });
          return o;
        });
        return analyzeRows(normalized);
      } catch {
        return { error: "JSON parse failed — paste CSV or valid billing JSON." };
      }
    }
    const parsed = parseCSV(text);
    if (parsed.error) return parsed;
    return analyzeRows(parsed.rows);
  }

  function render(result) {
    const empty = document.getElementById("results-empty");
    const body = document.getElementById("results-body");
    if (result.error) {
      empty.textContent = result.error; empty.classList.remove("hidden"); body.classList.add("hidden"); return;
    }
    empty.classList.add("hidden"); body.classList.remove("hidden");
    const ring = document.getElementById("score-ring");
    const colors = { "0-24": "#ff6b7a", "25-49": "#f5c542", "50-74": "#5b8cff", "75-100": "#3ecf8e" };
    ring.style.setProperty("--p", String(result.score));
    ring.style.setProperty("--ring", colors[result.bucket]);
    document.getElementById("score-num").textContent = String(result.score);
    document.getElementById("score-grade").textContent = result.bucket;
    document.getElementById("score-headline").textContent = result.headline;
    document.getElementById("score-sub").textContent =
      result.rows + " rows · ~$" + result.total.toFixed(2) + " summed from paste · in-browser only";

    const tb = document.getElementById("smell-body");
    tb.innerHTML = "";
    result.smells.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td><span class='chip'></span></td><td></td><td></td>";
      tr.cells[0].textContent = s.title;
      const chip = tr.cells[1].querySelector(".chip");
      chip.className = "chip " + (s.severity === "high" ? "high" : s.severity === "med" ? "med" : "low");
      chip.textContent = s.severity;
      tr.cells[2].textContent = s.message;
      tr.cells[3].textContent = s.evidence;
      tb.appendChild(tr);
    });

    const top = document.getElementById("top-services");
    top.innerHTML = result.topServices.map((t) =>
      "<li><strong>" + t.name + "</strong> — $" + t.cost.toFixed(2) + "</li>").join("");

    window.__lastBill = result;
    bump();
  }

  function bump() {
    let n = 0; try { n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch (_) {}
    n++; try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
    const el = document.getElementById("local-runs"); if (el) el.textContent = String(n);
  }

  function toast(m) {
    const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
  }

  function run() {
    const text = document.getElementById("input").value;
    if (String(text || "").trim() && text !== sampleLoadedText) noteOwn();
    track("analyze_clicked");
    const r = analyzeText(text);
    render(r);
    if (!r.error) track("score_bucket", r.bucket);
  }

  function reportMarkdown(r) {
    if (!r || r.error) return "";
    return ["# Cloud Bill Smell Report", "", window.LABS_PRIVATE_REPORT_LINE, "", "**Score:** " + r.score + " (" + r.bucket + ")", "**Verdict:** " + r.headline, "",
      "## Smells", ""].concat(r.smells.map((s) => "- **" + s.title + "** [" + s.severity + "]: " + s.message + " (" + s.evidence + ")"))
      .concat(["", "_Client-side only. Your export was not uploaded. Not a billing audit._", ""]).join("\n");
  }

  function bind() {
    document.getElementById("btn-run").onclick = run;
    document.getElementById("btn-sample").onclick = async () => {
      let text = SAMPLE_CSV;
      try {
        const res = await fetch("sample-cloud-bill.csv");
        text = await res.text();
      } catch {
        toast("Loaded embedded sample (fetch blocked on file://)");
      }
      sampleLoadedText = text;
      document.getElementById("input").value = text;
      track("input_kind", "sample");
      run();
    };
    document.getElementById("btn-clear").onclick = () => {
      sampleLoadedText = null;
      document.getElementById("input").value = "";
      document.getElementById("results-empty").classList.remove("hidden");
      document.getElementById("results-body").classList.add("hidden");
    };
    document.getElementById("file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { document.getElementById("input").value = String(reader.result || ""); noteOwn(); run(); };
      reader.readAsText(f);
    });
    document.getElementById("btn-copy").onclick = async () => {
      const r = window.__lastBill; if (!r || r.error) return toast("Run first");
      try { await navigator.clipboard.writeText(reportMarkdown(r)); toast("Copied"); track("copy_clicked", "report"); }
      catch { toast("Clipboard blocked"); }
    };
    document.getElementById("input").addEventListener("paste", function () { noteOwn(); });
    let n = 0; try { n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch (_) {}
    const el = document.getElementById("local-runs"); if (el) el.textContent = String(n);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  window.__ABL_BILL__ = analyzeText;
  window.__ABL_BILL_MD__ = reportMarkdown;
})();
