# AI Agent Health Checker — Arup Banerjee Labs

Heuristic keyword checker, not a security audit. Client-side only: no network calls (the page sets
`connect-src 'none'`), no LLM, no account. It can miss problems and it can flag harmless text.

## Modes

- **Config / prompt** (JSON, YAML or plain text):
  - 8 engineering-hygiene checks (the original SCORECARD-SPEC set, same weights): retries/backoff, timeouts,
    tracing, secrets in the config, prompt-injection sinks, tool auth/scope notes (counted per tool), evals/tests,
    single LLM with no fallback.
  - 9 customer-safety checks on the instructions and tools: confidential content in the prompt, high-risk tools
    (refund/payment/messaging/records) with no approval or scope, "I don't know" rule, human handoff rules,
    medical/dosing/legal/financial advice rules, customer text treated as untrusted, bot disclosure, SSN/card
    collection, access to other customers' records. These skip when the paste doesn't look customer-facing.
- **Chat transcript** (JSONL/JSON, CSV, or `User:` / `Bot:` lines), optionally with a pasted FAQ / price list:
  9 checks on what the bot actually said (leaks, made-up prices/policies, dosing, obeyed overrides, refund
  promises, SSN/card requests, claims to be human, other customers' data, missed handoffs).

Any high-severity customer-safety failure sets the verdict to "Not safe for customer traffic".
User turns inside example chats are ignored in config mode, so an attacker's "ignore previous instructions"
never counts as a safeguard.

Also on the page: a copyable 20-message red-team pack to send to your own bot, and a scorecard preview
computed live from the built-in sample (`sample-agent-config.yaml`).

Testing: see the case study (`../case-study/`). The fixtures there are for a fictional business; nothing in
`app.js` refers to them.

## Report a wrong check

If a check missed something or flagged harmless text, [tell me on GitHub](https://github.com/ultimatixarup/arup-banerjee-labs/issues/new?template=01-wrong-or-missing-check.yml). Please redact secrets before you post. A short snippet is enough.

Copy Markdown report masks secrets this checker already found. It can still miss some, so redact before you post the report.

Maintainer: Arup Kumar Banerjee · Little Elm, Texas · arupkumar.banerjee@gmail.com
