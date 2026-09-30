/**
 * AI Agent Health Checker — Arup Banerjee Labs
 * Implements /workspace/fame-tools/product/SCORECARD-SPEC.md
 * Client-side only. Never send paste contents to a backend.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "abl_aahc_runs_v1";
  const FALLBACK_SAMPLE = '# Sanitized DEMO config for Arup Banerjee Labs — Agent Health Checker\n# Fictional. No real secrets. Safe to paste in demos / screenshots.\n# Intentional gaps so the scorecard shows mixed findings.\n\nname: demo-support-agent\nversion: "0.1"\nframework: langgraph\n\nllm:\n  provider: openai\n  model: gpt-4o-mini\n  # Intentionally no fallback / router → single_llm_spof\n  # Intentionally no request timeout → timeouts partial\n\ngraph:\n  entry: triage\n  nodes:\n    - id: triage\n      type: llm\n      prompt: |\n        You are a support triage agent. Classify the user message.\n        User message: {{user_input}}\n    - id: act\n      type: tool_router\n      tools:\n        - search_kb\n        - run_sql\n        - shell_exec\n\ntools:\n  - name: search_kb\n    description: Search internal knowledge base\n    parameters:\n      query: { type: string }\n    # Intentionally sparse auth notes → tool_auth_notes\n\n  - name: run_sql\n    description: Run a SQL query against the support warehouse\n    parameters:\n      sql: { type: string }   # free-form SQL → prompt_injection_sinks\n    # no auth/scope notes\n\n  - name: shell_exec\n    description: Execute a shell command on the runner\n    parameters:\n      command: { type: string }  # free-form shell → prompt_injection_sinks\n    # irreversible / no confirmation flag\n\n# Intentionally missing:\n# - retries / backoff\n# - tracing (langfuse / otel)\n# - evals / golden tests\n# - max_iterations / recursion limit\n\n# NOT a secret (demo placeholder only — pattern may still smell):\n# api_key: "sk-demo-not-a-real-key-000000"\n';
  
  const CHECKS = [
    {
      id: "retries_backoff",
      title: "Retries / backoff",
      weight: 14,
      severity: "high",
      failMsg: "No retry or backoff configuration detected.",
      passMsg: "Retry / backoff signals found.",
      re: /retry|retries|maxRetries|max_retries|backoff|exponentialBackoff|tenacity|RetryPolicy|retry_on/i
    },
    {
      id: "timeouts",
      title: "Timeouts",
      weight: 12,
      severity: "medium",
      failMsg: "No timeout / deadline settings found for LLM or tool calls.",
      passMsg: "Timeout / deadline settings detected.",
      re: /timeout|time_out|requestTimeout|request_timeout|deadline|AbortSignal|socketTimeout|llm_timeout|tool_timeout/i,
      llmRe: /llm.*timeout|timeout.*llm|model.*timeout|requestTimeout|deadline/i,
      toolRe: /tool.*timeout|timeout.*tool|socketTimeout/i
    },
    {
      id: "tracing_hooks",
      title: "Tracing hooks (Langfuse / OTel)",
      weight: 14,
      severity: "high",
      failMsg: "No tracing / observability hooks detected (Langfuse, OTel, callbacks, etc.).",
      passMsg: "Tracing / observability hooks detected.",
      re: /langfuse|opentelemetry|open.?telemetry|\botel\b|tracer|tracing|callback_manager|CallbackHandler|phoenix|helicone|weave|LangSmith|langsmith/i
    },
    {
      id: "secret_smells",
      title: "Secret-in-config smells",
      weight: 16,
      severity: "high",
      failMsg: "Possible secrets embedded in config. Prefer env/secret refs; redact before sharing screenshots.",
      passMsg: "No embedded secret smells detected (or env-style refs only).",
      embedRe: /(api[_-]?key|secret|password|token|bearer|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}/i,
      prefixRe: /\b(sk-[a-zA-Z0-9]{10,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-)/,
      envRe: /\$\{?\w*(KEY|SECRET|TOKEN|PASSWORD)\w*\}?|process\.env\.|os\.environ|getenv|secrets?\./i
    },
    {
      id: "prompt_injection_sinks",
      title: "Prompt-injection sinks",
      weight: 14,
      severity: "high",
      failMsg: "Tools that execute free-form text detected without clear guard language.",
      passMsg: "No unguarded free-form execution sinks detected.",
      sinkRe: /shell|bash|terminal|exec|execute|eval|sql|query|http_request|fetch_url|browse|filesystem|write_file|run_code|subprocess/i,
      freeRe: /run arbitrary|user provided|LLM decides command|do whatever/i,
      guardRe: /sandbox|allowlist|confirm|human.?in.?the.?loop|approval|guard|requires_approval/i
    },
    {
      id: "tool_auth_notes",
      title: "Tool auth / scope notes",
      weight: 10,
      severity: "medium",
      failMsg: "Tool definitions lack auth/scope/permission notes.",
      passMsg: "Auth / scope / permission notes found near tools.",
      skipMsg: "No tools detected — auth/scope check skipped.",
      toolsRe: /"tools"\s*:|tools\s*:|functions\s*:/i,
      authRe: /auth|scope|permission|oauth|rbac|acl|requires_auth|api_key_header|bearer/i
    },
    {
      id: "evals_tests",
      title: "Evals / tests",
      weight: 10,
      severity: "medium",
      failMsg: "No eval, dataset, or test references found in this config slice.",
      passMsg: "Eval / dataset / test references found.",
      re: /eval|evaluation|dataset|golden|test_case|pytest|unittest|prompt.?foo|ragas|deepEval|deepeval|benchmark/i
    },
    {
      id: "single_llm_spof",
      title: "Single-point LLM failure",
      weight: 10,
      severity: "medium",
      failMsg: "Single LLM/provider path with no fallback detected.",
      passMsg: "Fallback or multi-provider signals detected.",
      providerRe: /openai|anthropic|azure.?openai|bedrock|vertex|ollama|groq|mistral|model\s*[:=]|llm\s*[:=]|chat_model|ChatOpenAI|ChatAnthropic/i,
      fallbackRe: /fallback|router|model_fallback|secondary_model|backup_model|load.?balanc|multi.?model|with_fallbacks/i,
      families: [
        { id: "openai", re: /openai|ChatOpenAI|gpt-/i },
        { id: "anthropic", re: /anthropic|ChatAnthropic|claude/i },
        { id: "azure", re: /azure.?openai/i },
        { id: "bedrock", re: /bedrock/i },
        { id: "vertex", re: /vertex|gemini/i },
        { id: "ollama", re: /ollama/i },
        { id: "groq", re: /groq/i },
        { id: "mistral", re: /mistral/i }
      ]
    }
  ];

  const BUCKET_COPY = {
    "0-24": "Critical gaps — treat as prototype only.",
    "25-49": "Shippable prototype, not production-ready.",
    "50-74": "Solid baseline — close the high findings.",
    "75-100": "Strong config hygiene — still review high items."
  };

  function bucketFor(score) {
    if (score <= 24) return "0-24";
    if (score <= 49) return "25-49";
    if (score <= 74) return "50-74";
    return "75-100";
  }

  function inputKind(text) {
    const t = text.trim();
    if (!t) return "unknown";
    if (t.startsWith("{") || t.startsWith("[")) {
      try { JSON.parse(t); return "json"; } catch { return "text"; }
    }
    if (/^[\s]*[\w"-]+:\s/m.test(t) && !t.startsWith("<")) return "yaml";
    return "text";
  }

  function pasteLenBucket(n) {
    if (n < 1000) return "lt1k";
    if (n < 10000) return "1k_10k";
    return "10k_plus";
  }

  /** No analytics: local debug logging only (set window.__ABL_DEBUG__ = true). Nothing is sent anywhere. */
  function track(name, props) {
    if (window.__ABL_DEBUG__) console.debug("[abl]", name, props);
  }

  function runCheck(c, text) {
    if (c.id === "retries_backoff") {
      const ok = c.re.test(text);
      return { status: ok ? "pass" : "fail", message: ok ? c.passMsg : c.failMsg };
    }
    if (c.id === "timeouts") {
      const any = c.re.test(text);
      if (!any) return { status: "fail", message: c.failMsg };
      const llm = c.llmRe.test(text);
      const tool = c.toolRe.test(text);
      if (llm && tool) return { status: "pass", message: c.passMsg + " (LLM and tools)." };
      if (any) return { status: "partial", message: "Partial timeouts — ensure both LLM and tool calls have deadlines." };
      return { status: "pass", message: c.passMsg };
    }
    if (c.id === "tracing_hooks") {
      const ok = c.re.test(text);
      return { status: ok ? "pass" : "fail", message: ok ? c.passMsg : c.failMsg };
    }
    if (c.id === "secret_smells") {
      const embed = c.embedRe.test(text) || c.prefixRe.test(text);
      const envOnly = c.envRe.test(text);
      if (embed) return { status: "fail", message: c.failMsg };
      if (envOnly) return { status: "pass", message: "Env/secret refs look preferred over inline secrets." };
      return { status: "pass", message: c.passMsg };
    }
    if (c.id === "prompt_injection_sinks") {
      const sink = c.sinkRe.test(text);
      if (!sink) return { status: "pass", message: c.passMsg };
      const free = c.freeRe.test(text);
      const guard = c.guardRe.test(text);
      if (free && !guard) return { status: "fail", message: c.failMsg };
      if (sink && !guard) return { status: "fail", message: c.failMsg };
      if (sink && guard) return { status: "partial", message: "Execution-capable tools present but guard/approval language found — verify enforcement." };
      return { status: "pass", message: c.passMsg };
    }
    if (c.id === "tool_auth_notes") {
      if (!c.toolsRe.test(text) && !/"name"\s*:\s*"[^"]+"/i.test(text)) {
        // weak tools detect
        const toolish = /\btools\b/i.test(text);
        if (!toolish) return { status: "skip", message: c.skipMsg };
      }
      const hasTools = c.toolsRe.test(text) || /\btools\b/i.test(text);
      if (!hasTools) return { status: "skip", message: c.skipMsg };
      const authHits = (text.match(c.authRe) || []).length;
      // heuristic: <1 signal per 3 tools → fail; rough tool count
      const toolNameHits = (text.match(/"name"\s*:/g) || []).length || 1;
      if (authHits === 0) return { status: "fail", message: c.failMsg };
      if (authHits * 3 < toolNameHits) return { status: "partial", message: "Sparse auth/scope notes relative to tool count." };
      return { status: "pass", message: c.passMsg };
    }
    if (c.id === "evals_tests") {
      const ok = c.re.test(text);
      return { status: ok ? "pass" : "fail", message: ok ? c.passMsg : c.failMsg };
    }
    if (c.id === "single_llm_spof") {
      const providers = c.families.filter((f) => f.re.test(text)).map((f) => f.id);
      const hasProvider = providers.length > 0 || c.providerRe.test(text);
      if (!hasProvider) return { status: "skip", message: "No LLM/provider signals — SPOF check skipped." };
      const fallback = c.fallbackRe.test(text) || providers.length >= 2;
      if (fallback) return { status: "pass", message: c.passMsg };
      return { status: "fail", message: c.failMsg };
    }
    return { status: "skip", message: "Unknown check" };
  }

  function analyze(raw) {
    const text = String(raw || "").trim();
    // Strip line comments so demo YAML notes like "# intentionally missing retries" do not false-pass
    const scanText = text
      .split(/\r?\n/)
      .map((line) => {
        const s = line.trim();
        if (s.startsWith("#")) return "";
        // keep URLs; strip // comments only when preceded by space or start
        return line.replace(/(^|\s)\/\/.*$/, "$1");
      })
      .join("\n");
    if (text.length < 20) return { error: "Paste at least ~20 characters of agent config, YAML, or prompt+tools text." };

    // Prefer JSON parse for structural awareness (still scan full text)
    let kind = inputKind(text);
    if (kind === "json") {
      try { JSON.parse(text); } catch { kind = "text"; }
    }

    const results = [];
    let penalty = 0;
    let totalW = 0;

    CHECKS.forEach((c) => {
      const r = runCheck(c, scanText);
      const row = {
        id: c.id,
        title: c.title,
        weight: c.weight,
        severity: c.severity,
        status: r.status,
        message: r.message
      };
      results.push(row);
      if (r.status === "skip") return;
      totalW += c.weight;
      if (r.status === "fail") penalty += c.weight;
      else if (r.status === "partial") penalty += c.weight / 2;
    });

    if (totalW === 0) totalW = 1;
    const score = Math.round(100 * (1 - penalty / totalW));
    const bucket = bucketFor(score);

    return {
      score,
      bucket,
      headline: BUCKET_COPY[bucket],
      kind,
      pasteLen: text.length,
      results,
      at: new Date().toISOString()
    };
  }

  function ringColor(bucket) {
    if (bucket === "75-100") return "#3ecf8e";
    if (bucket === "50-74") return "#5b8cff";
    if (bucket === "25-49") return "#f5c542";
    return "#ff6b7a";
  }

  function render(result) {
    const empty = document.getElementById("results-empty");
    const body = document.getElementById("results-body");
    if (result.error) {
      empty.textContent = result.error;
      empty.classList.remove("hidden");
      body.classList.add("hidden");
      return;
    }
    empty.classList.add("hidden");
    body.classList.remove("hidden");

    const ring = document.getElementById("score-ring");
    ring.style.setProperty("--p", String(result.score));
    ring.style.setProperty("--ring", ringColor(result.bucket));
    document.getElementById("score-num").textContent = String(result.score);
    document.getElementById("score-grade").textContent = result.bucket;
    document.getElementById("score-headline").textContent = result.headline;
    document.getElementById("score-sub").textContent =
      result.kind.toUpperCase() + " · " + result.pasteLen + " chars · 8 checks · in-browser only";

    const list = document.getElementById("check-list");
    list.innerHTML = "";
    result.results.forEach((r) => {
      const div = document.createElement("div");
      div.className = "check-row";
      const sev = r.status === "skip" ? "info" : r.severity;
      div.innerHTML =
        '<div><strong class="title"></strong> <span class="sev-pill"></span></div>' +
        '<div class="status"></div><div class="msg"></div>';
      div.querySelector(".title").textContent = r.title;
      const pill = div.querySelector(".sev-pill");
      pill.classList.add("sev-pill", sev);
      pill.textContent = r.status === "skip" ? "info" : r.severity;
      const st = div.querySelector(".status");
      st.classList.add("status", r.status);
      st.textContent = r.status.toUpperCase();
      div.querySelector(".msg").textContent = r.message;
      list.appendChild(div);
    });

    window.__lastReport = result;
    bumpRuns();
  }

  function reportMarkdown(r) {
    if (!r || r.error) return "";
    const lines = [
      "# AI Agent Health Checker Report",
      "",
      "**Overall:** " + r.score + "/100 (" + r.bucket + ")",
      "**Verdict:** " + r.headline,
      "**Engine:** Arup Banerjee Labs (client-side)",
      "",
      "| Check | Status | Severity | Notes |",
      "|---|---|---|---|"
    ];
    r.results.forEach((x) => {
      lines.push("| " + x.title + " | " + x.status + " | " + x.severity + " | " + x.message.replace(/\|/g, "/") + " |");
    });
    lines.push("", "_Generated locally. Config was not uploaded._", "");
    return lines.join("\n");
  }

  function bumpRuns() {
    let n = 0;
    try { n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch (_) {}
    n += 1;
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
    const el = document.getElementById("local-runs");
    if (el) el.textContent = String(n);
  }

  function loadRuns() {
    let n = 0;
    try { n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; } catch (_) {}
    const el = document.getElementById("local-runs");
    if (el) el.textContent = String(n);
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  async function loadSample() {
    try {
      const res = await fetch("sample-agent-config.yaml");
      const text = await res.text();
      document.getElementById("input").value = text;
      runAnalyze();
    } catch {
      document.getElementById("input").value = FALLBACK_SAMPLE;
      runAnalyze();
      toast("Loaded embedded sample (fetch blocked on file://)");
    }
  }

  function runAnalyze() {
    const text = document.getElementById("input").value;
    const kind = inputKind(text);
    track("analyze_clicked", { input_kind: kind, paste_len_bucket: pasteLenBucket(text.length) });
    const result = analyze(text);
    render(result);
    if (!result.error) {
      track("score_bucket", { bucket: result.bucket });
    }
  }

  function bind() {
    document.getElementById("btn-run").addEventListener("click", runAnalyze);
    document.getElementById("btn-clear").addEventListener("click", () => {
      document.getElementById("input").value = "";
      document.getElementById("results-empty").classList.remove("hidden");
      document.getElementById("results-empty").textContent = "Paste a config and click Check my agent.";
      document.getElementById("results-body").classList.add("hidden");
    });
    document.getElementById("btn-sample").addEventListener("click", loadSample);
    document.getElementById("btn-copy").addEventListener("click", async () => {
      const md = reportMarkdown(window.__lastReport);
      if (!md) return toast("Run a check first");
      try {
        await navigator.clipboard.writeText(md);
        toast("Markdown report copied");
        track("share_clicked", { surface: "copy_link" });
      } catch { toast("Clipboard blocked"); }
    });
    document.getElementById("input").addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runAnalyze();
    });
    loadRuns();
    track("pageview");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  // Expose for smoke tests
  window.__ABL_ANALYZE__ = analyze;
})();
