/**
 * Observability Gap Finder — Arup Banerjee Labs
 * Client-side self-check only. No remote scanning.
 */
(function () {
  "use strict";
  const STORAGE_KEY = "abl_ogf_runs_v1";
  let FALLBACK_SAMPLE = '# Sanitized DEMO observability snippet for Arup Banerjee Labs — Observability Gap Finder\n# Fictional. Safe for demos. Intentional gaps: missing SLIs, no tracing, high-cardinality risk.\n\napiVersion: labs.demo/v1\nkind: ServiceObservabilityInventory\nmetadata:\n  name: checkout-platform\n  environment: prod\n\nservices:\n  - name: checkout-api\n    owner: platform\n    language: go\n    metrics:\n      prometheus:\n        scrape: true\n        path: /metrics\n        # Missing: latency histogram SLI, error-rate SLI, availability SLI\n        labels:\n          - service\n          - instance\n          - user_id   # cardinality smell\n    logs:\n      destination: splunk\n      index: main\n      # Missing: structured fields / trace_id correlation\n    tracing:\n      enabled: false   # gap: no OTel / Langfuse / Jaeger\n    alerts:\n      - name: cpu-high\n        expr: avg(cpu_usage) > 0.9\n        # Missing: burn-rate / SLO-based alerts\n\n  - name: agent-orchestrator\n    owner: ai-platform\n    language: python\n    metrics:\n      prometheus:\n        scrape: true\n        path: /metrics\n        # Missing: llm_latency, tool_error_rate, token_cost\n    logs:\n      destination: stdout\n    tracing:\n      enabled: false\n      # Missing: Langfuse / OTel hooks for agent spans\n    alerts: []   # gap: no alerts\n\n  - name: payments-worker\n    owner: payments\n    language: java\n    metrics:\n      prometheus:\n        scrape: false  # gap: not scraped\n    logs:\n      destination: splunk\n      index: payments\n    tracing:\n      otel:\n        endpoint: http://otel-collector:4317\n        # Partial: tracing present but no exemplars / no SLO\n    alerts:\n      - name: queue-depth\n        expr: queue_depth > 10000\n\n# Global gaps intentional for demo scorecard:\n# - no organization-wide SLO objects\n# - no cardinality guards / metric relabel drop rules\n# - no synthetic checks\n# - inconsistent trace_id in logs\n';

  const DIMENSIONS = [
    { id: "otel", title: "OpenTelemetry traces/metrics", weight: 18,
      good: /opentelemetry|\botel\b|otlp|traceparent|TracerProvider|meter.?provider/i,
      snippet: "from opentelemetry import trace\nfrom opentelemetry.sdk.trace import TracerProvider\nfrom opentelemetry.sdk.trace.export import BatchSpanProcessor\nfrom opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter\n\ntrace.set_tracer_provider(TracerProvider())\ntrace.get_tracer_provider().add_span_processor(\n    BatchSpanProcessor(OTLPSpanExporter(endpoint=\"http://localhost:4318/v1/traces\"))\n)" },
    { id: "langfuse", title: "LLM observability (Langfuse / LangSmith)", weight: 16,
      good: /langfuse|langsmith|helicone|phoenix|weave|llm.?observ/i,
      snippet: "# LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY via env only\n# Wire CallbackHandler at agent entry — never hardcode secrets." },
    { id: "prometheus", title: "Prometheus metrics / alerts", weight: 16,
      good: /prometheus|promql|alertmanager|ServiceMonitor|scrape_configs/i,
      snippet: "scrape_configs:\n  - job_name: my-agent\n    metrics_path: /metrics\n    static_configs:\n      - targets: [\"localhost:8080\"]" },
    { id: "splunk_logs", title: "Centralized logs (Splunk / Loki / ELK)", weight: 14,
      good: /splunk|hec|loki|elasticsearch|opensearch|fluent-?bit|vector/i,
      snippet: "# Fields: service, env, trace_id, span_id, tool_name, latency_ms, outcome\n# Forward via your collector — do not paste HEC tokens." },
    { id: "golden_signals", title: "Golden signals (latency/errors/saturation)", weight: 12,
      good: /latency|error.?rate|saturation|apdex|\bslo\b|golden.?signal|p95|p99/i,
      snippet: "# Minimum: latency histogram, error rate by dependency, worker saturation gauges" },
    { id: "agent_specific", title: "Agent-specific telemetry", weight: 12,
      good: /tool_calls|token|prompt.?version|model.?name|langgraph|agent.?trace/i,
      snippet: "# Spans: model call, each tool, graph node\n# Attrs: agent.name, prompt.version, tool.name, tool.ok, tokens.in/out" },
    { id: "runbooks_alerts", title: "Alerts tied to runbooks", weight: 12,
      good: /runbook|pagerduty|opsgenie|alert.*runbook|on[-_]?call/i,
      snippet: "annotations:\n  summary: Agent tool error rate high\n  runbook_url: https://runbooks.example/agent-tool-errors" }
  ];

  const CHECKLIST = [
    { id: "ck_otel", dim: "otel", label: "We export traces via OpenTelemetry / OTLP" },
    { id: "ck_langfuse", dim: "langfuse", label: "LLM calls are traced (Langfuse/LangSmith/etc.)" },
    { id: "ck_prom", dim: "prometheus", label: "Prometheus (or equivalent) scrapes service metrics" },
    { id: "ck_logs", dim: "splunk_logs", label: "Logs ship to Splunk/Loki/ELK with trace IDs" },
    { id: "ck_golden", dim: "golden_signals", label: "Latency / error / saturation dashboards exist" },
    { id: "ck_agent", dim: "agent_specific", label: "Tool calls & prompt versions are spanned/attributed" },
    { id: "ck_runbook", dim: "runbooks_alerts", label: "Pages include runbook links for agent failures" }
  ];

  function track(name, props) {
    try { if (typeof window.plausible === "function") window.plausible(name, { props: props || {} }); } catch (_) {}
  }

  function analyze(text, checked) {
    const raw = String(text || "");
    const findings = [];
    let penalty = 0, total = 0;
    const snippets = [];
    DIMENSIONS.forEach((d) => {
      total += d.weight;
      const fromText = d.good.test(raw);
      const fromCk = CHECKLIST.some((c) => c.dim === d.id && checked[c.id]);
      if (fromText || fromCk) {
        findings.push({ id: d.id, title: d.title, status: "pass", message: "Signal present in paste and/or checklist." });
      } else {
        penalty += d.weight;
        findings.push({ id: d.id, title: d.title, status: "fail", message: "Gap — no clear signal for " + d.title + "." });
        snippets.push({ title: d.title, code: d.snippet });
      }
    });
    const score = Math.round(100 * (1 - penalty / total));
    const bucket = score <= 24 ? "0-24" : score <= 49 ? "25-49" : score <= 74 ? "50-74" : "75-100";
    const headlines = {
      "0-24": "Major observability gaps — instrument before scaling traffic.",
      "25-49": "Partial visibility — traces or metrics likely missing.",
      "50-74": "Baseline present — close remaining high gaps.",
      "75-100": "Strong signals — verify collectors actually receive data."
    };
    return { score, bucket, headline: headlines[bucket], findings, snippets };
  }

  function render(r) {
    const empty = document.getElementById("results-empty");
    const body = document.getElementById("results-body");
    if (r.error) { empty.textContent = r.error; empty.classList.remove("hidden"); body.classList.add("hidden"); return; }
    empty.classList.add("hidden"); body.classList.remove("hidden");
    const colors = { "0-24": "#ff6b7a", "25-49": "#f5c542", "50-74": "#5b8cff", "75-100": "#3ecf8e" };
    const ring = document.getElementById("score-ring");
    ring.style.setProperty("--p", String(r.score));
    ring.style.setProperty("--ring", colors[r.bucket]);
    document.getElementById("score-num").textContent = String(r.score);
    document.getElementById("score-grade").textContent = r.bucket;
    document.getElementById("score-headline").textContent = r.headline;
    document.getElementById("score-sub").textContent = "OTel · Langfuse · Prometheus · Splunk-oriented · in-browser";
    const list = document.getElementById("check-list");
    list.innerHTML = "";
    r.findings.forEach((f) => {
      const div = document.createElement("div");
      div.className = "check-row";
      div.innerHTML = "<div><strong></strong></div><div class='status'></div><div class='msg'></div>";
      div.querySelector("strong").textContent = f.title;
      const st = div.querySelector(".status");
      st.textContent = f.status.toUpperCase();
      st.classList.add(f.status);
      div.querySelector(".msg").textContent = f.message;
      list.appendChild(div);
    });
    const sn = document.getElementById("snippets");
    sn.innerHTML = "";
    if (!r.snippets.length) {
      sn.innerHTML = "<p class='hint'>No starter snippets — signals look covered. Still verify collectors in staging.</p>";
    } else {
      r.snippets.forEach((s) => {
        const wrap = document.createElement("div");
        wrap.innerHTML = "<h3 style='font-size:.9rem;margin:0.75rem 0 0.25rem'></h3><pre class='snippet-box'></pre>";
        wrap.querySelector("h3").textContent = "Starter: " + s.title;
        wrap.querySelector("pre").textContent = s.code;
        sn.appendChild(wrap);
      });
    }
    window.__lastObs = r;
    bump();
  }

  function bump() {
    let n = 0; try { n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch (_) {}
    n++; try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
    const el = document.getElementById("local-runs"); if (el) el.textContent = String(n);
  }

  function checkedMap() {
    const o = {};
    CHECKLIST.forEach((c) => { const el = document.getElementById(c.id); o[c.id] = !!(el && el.checked); });
    return o;
  }

  function run() {
    const text = document.getElementById("input").value;
    if (text.trim().length < 5 && !Object.values(checkedMap()).some(Boolean)) {
      return render({ error: "Paste a stack description and/or tick checklist items you already have." });
    }
    track("analyze_clicked", { input_kind: "text" });
    const r = analyze(text, checkedMap());
    render(r);
    track("score_bucket", { bucket: r.bucket });
  }

  function toast(m) {
    const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
  }

  async function loadSample() {
    try {
      const res = await fetch("sample-observability.yaml");
      FALLBACK_SAMPLE = await res.text();
      document.getElementById("input").value = FALLBACK_SAMPLE;
      run();
    } catch {
      document.getElementById("input").value = FALLBACK_SAMPLE ||
        "service: checkout-api\nlogs: fluent-bit -> splunk\nmetrics: jvm /metrics (no ServiceMonitor)\nllm: langgraph without langfuse\non_call: pagerduty\n";
      run();
      toast("Loaded embedded sample (fetch blocked on file://)");
    }
  }

  function bind() {
    const box = document.getElementById("checklist");
    CHECKLIST.forEach((c) => {
      const label = document.createElement("label");
      label.className = "check-item";
      label.innerHTML = "<input type='checkbox' /> <span></span>";
      label.querySelector("input").id = c.id;
      label.querySelector("span").textContent = c.label;
      box.appendChild(label);
    });
    document.getElementById("btn-run").onclick = run;
    document.getElementById("btn-sample").onclick = loadSample;
    document.getElementById("btn-clear").onclick = () => {
      document.getElementById("input").value = "";
      CHECKLIST.forEach((c) => { const el = document.getElementById(c.id); if (el) el.checked = false; });
      document.getElementById("results-empty").classList.remove("hidden");
      document.getElementById("results-body").classList.add("hidden");
    };
    document.getElementById("btn-copy").onclick = async () => {
      const r = window.__lastObs; if (!r || r.error) return toast("Run first");
      const lines = ["# Observability Gap Report", "", "**Score:** " + r.score + " (" + r.bucket + ")", r.headline, "", "## Findings"];
      r.findings.forEach((f) => lines.push("- **" + f.title + "** — " + f.status + ": " + f.message));
      lines.push("", "_Arup Banerjee Labs · client-side self-check only_", "");
      try { await navigator.clipboard.writeText(lines.join("\n")); toast("Copied"); track("share_clicked", { surface: "copy_link" }); }
      catch { toast("Clipboard blocked"); }
    };
    // Preload sample text for file:// fallback
    fetch("sample-observability.yaml").then((r) => r.text()).then((t) => { FALLBACK_SAMPLE = t; }).catch(() => {});
    let n = 0; try { n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch (_) {}
    const el = document.getElementById("local-runs"); if (el) el.textContent = String(n);
    track("pageview");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  window.__ABL_OBS__ = analyze;
})();
