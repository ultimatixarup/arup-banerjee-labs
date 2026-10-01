# Arup Banerjee Labs

Free-forever, client-side scorecards:

1. `agent-health-checker/` — AI Agent Health Checker: config / prompt mode (8 engineering checks + 9 customer-safety checks) and chat-transcript mode (9 checks). Heuristic keyword checker, not a security audit.
2. `cloud-bill-smell/` — Cloud Bill Smell Detector (user-owned CSV/JSON only)
3. `observability-gap-finder/` — Observability Gap Finder
4. `glp1-support/` — GLP-1 Support (free, private organizer; not medical advice)
5. `case-study/` — Controlled local test of a scripted chatbot for a fictional business (Example Family Dental); not a real customer
6. `playbook/` — The Agentic AI Career Playbook. Free, static, no signup, nothing to buy. Module 1 is available; modules 2–4 have coming-soon pages; modules 5–8 are listed on the playbook index only.

Hub: `index.html`

## The Agentic AI Career Playbook (`playbook/`)

A free, browser-only playbook for anyone who can communicate. Module 1 includes the Hands-Off Challenge, a Brief Card, and an Ownership Log.

Privacy: localStorage only (`abl_playbook_m1`), a visible “Clear my data” button, copy-as-text, no analytics, no network calls (Content-Security-Policy with `connect-src 'none'`). Bug cards download from a Blob in the browser. Share images live in `playbook/img/`.

## GLP-1 Support (`glp1-support/`)

A free, browser-only organizer for people on, changing, or coming off GLP-1 medicines (Wegovy, Ozempic, Zepbound, Mounjaro and similar).
Educational/organizing tool only — it does not diagnose, suggest doses, or recommend medication changes, and never points to sources of medication.

- Daily symptom / side-effect log (dose field is "as written on your prescription" only), red-flag alert, 7-day summary, CSV export
- Protein / fluids / fiber checklist with commonly cited general ranges (linked sources, "ask your clinician")
- Strength & muscle-preservation checklist + weekly activity tracker (CDC general guideline)
- Maintenance / coming-off planner with 30/60/90-day check-ins (download as .txt)
- Insurance, prior-auth & refill question checklist + reminders
- "Questions for my prescriber" generator (copy / download / print)

Privacy: localStorage only (`abl_glp1_*` keys), "Clear my data" button, export-to-CSV, no analytics, no network calls
(a Content-Security-Policy with `connect-src 'none'` enforces this). Sources (FDA, DailyMed, MedlinePlus, NIDDK, CDC, peer-reviewed) are listed on the page.

## Report a problem

If a check looks wrong, [tell me on GitHub](https://github.com/ultimatixarup/arup-banerjee-labs/issues/new/choose). Please redact secrets before you post. A short snippet is enough — not a full config or bill export.

GLP-1 Support page bugs go on the [GLP-1 form](https://github.com/ultimatixarup/arup-banerjee-labs/issues/new?template=03-glp1-support.yml). Please don’t post personal health information. The tool is not medical advice, and questions about treatment belong with your prescriber.

## Open locally

```bash
cd /workspace/passive-income/labs
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

Or open `index.html` via `file://` (sample fetch may use embedded fallbacks).

## Marketing
`marketing/wave1/` — DRAFT only. Do not auto-publish.

## Zip
`/workspace/passive-income/arup-banerjee-labs.zip`

Maintainer: Arup Kumar Banerjee · Little Elm, Texas · arupkumar.banerjee@gmail.com

Personal project built on my own time. Not affiliated with or endorsed by my employer; views are my own.
