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

Privacy: localStorage only (`abl_glp1_*` keys), "Clear my data" button, export-to-CSV, no analytics, no email signup, no network calls
(a Content-Security-Policy with `connect-src 'none'` enforces this). Sources (FDA, DailyMed, MedlinePlus, NIDDK, CDC, peer-reviewed) are listed on the page.

## Usage counts, updates signup and feedback (all optional)

All account values live in one file: **`shared/labs-config.js`**. While a value is still a placeholder
(`GOATCOUNTER_CODE`, `LIST_FORM_ACTION`, `FEEDBACK_FORM_URL`, `GLP1_FEEDBACK_FORM_URL`) that feature is off.

- **Counts** (`shared/labs-counts.js`, [GoatCounter](https://www.goatcounter.com/), cookieless): hub, case study and the three dev
  tools only. Sent: the page path, plus fixed event names `<page>/analyze_clicked`, `<page>/score_bucket/0-24|25-49|50-74|75-100`,
  `<page>/copy_clicked/report|redteam`, and `hub/glp1_link_clicked`. Never sent: pasted text, findings, secrets, agent tool names,
  page title, referrer, query string. Only on `https://ultimatixarup.github.io`; skipped with Do Not Track / Global Privacy Control.
- **Get updates** (`shared/labs-forms.js`): optional email form on the hub and the three dev tools, posting to a double-opt-in list
  (Buttondown). Opens in a new tab; the tools work the same without it.
- **Share feedback / testimonial**: a link to a separate hosted form. Nothing is published automatically; quotes are hand-approved
  and only used with the OK-to-quote box ticked.
- **GLP-1 Support**: no counts, no email signup. Only a plain link to a separate usability form (no health questions).

Test the counting allow-list: `node tests/labs-counts.test.js` (no network; checks that nothing but the fixed strings above can be sent).

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
