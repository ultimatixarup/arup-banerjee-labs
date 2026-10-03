# Usage-count events

Anonymous, cookieless totals via GoatCounter. Every name below is fixed in `shared/labs-counts.js`. If a value is not on that list, it is dropped and nothing is sent. Counts stay off until `GOATCOUNTER_CODE` in `shared/labs-config.js` is a real site code, and they are sent only from `https://ultimatixarup.github.io`. Do Not Track and Global Privacy Control skip them.

A pageview is the path (`/playbook/module-01/`). An action is an event (`e=true`) whose path is `<page-id>/<event>/<detail>`. Page ids: `hub`, `case-study`, `agent-health-checker`, `cloud-bill-smell`, `observability-gap-finder`, `playbook`, `playbook-m1`, `playbook-m2`, `playbook-m3`, `playbook-m4`.

Nothing in these events is a person, a session, or a piece of text someone typed. The counter does not read the page title, the referrer, or the query string, and it does not use cookies, localStorage, or sessionStorage.

GLP-1 Support does not load this script.

## Pageviews

| Path | Question |
|---|---|
| `/` | Did they open the hub? |
| `/case-study/` | Did they open the case study? |
| `/agent-health-checker/`, `/cloud-bill-smell/`, `/observability-gap-finder/` | Which tool did they open? |
| `/playbook/` | Did they open the playbook landing page? |
| `/playbook/module-01/` … `/playbook/module-04/` | Which module did they open? Modules 2–4 are still the coming-soon promise. |

## Actions

| Event | Detail (fixed) | Where it fires | Question |
|---|---|---|---|
| `step_viewed` | Playbook landing: `mission`, `volunteer`, `who`, `paths`, `modules`, `tool`, `volunteer-end`. Module 1: `step-0`, `stop`, `tale`, `unlearn`, `comm`, `examples`, `tool`, `owner`, `challenge`, `quiz`, `artifact`, `next`, `sources`, `volunteer`. Case study: `why`, `setup`, `unsafe`, `before`, `changed`, `after`, `misses`, `borrow`, `try`, `method`. | Once, when that section enters the screen. | How far did they get, and where did they drop off? |
| `scroll_depth` | `25`, `50`, `75`, `100` | Once per bucket, and only when the page is tall enough to scroll. | Coarse drop-off on long pages (playbook, case study, tools). |
| `volunteer_clicked` | `mission`, `top`, `bottom` on the playbook landing page; `module` on Module 1. | The mailto “Volunteer as a tester” links. | Which volunteer button do people use? |
| `nav_clicked` | `hub`, `playbook`, `module-01`, `module-02`, `module-03`, `module-04`, `agent-health-checker`, `cloud-bill-smell`, `observability-gap-finder`, `case-study` | Links between the hub, playbook, tools, and case study. The href is not sent. | Where do they go next, including out to the case study or another tool? |
| `copy_clicked` | Playbook: `card-a`, `card-b`, `card-c`, `card-d`, `download-a` … `download-d`, `brief`, `log`, `template`, `results`. Tools: `report`. Agent Health Checker also: `redteam`. | Copy and download buttons. A label that is not on this list is recorded as `report` and the label itself is discarded. | Did they take the prompt, the brief, the report, or the red-team pack? |
| `card_picked` | `a`, `b`, `c`, `d` | Module 1, when they choose a bug card. Once per letter per view. | Which path do they try (spreadsheet, flyer, web page, Java)? |
| `round_picked` | `1`, `2` | Module 1, when they switch Round 1 / Rematch. | Do they come back for the rematch? |
| `quiz_opened` | (none) | Module 1, when the answer key is opened. | Did they reach the self-check and look at the key? |
| `input_kind` | `sample`, `sample_transcript` (Agent Health Checker only), `own` | Tools. `sample` is the Load sample button. `own` is a paste, a file upload, or Analyze on text that is not the loaded sample. The text is not sent. | Did they try the demo, or bring their own input? |
| `analyze_clicked` | (none) | The three tools, each time they run a check. | Did they actually run it? |
| `score_bucket` | `0-24`, `25-49`, `50-74`, `75-100` | The three tools, after a successful run. The exact score is not sent. | What result range do people see? |
| `glp1_link_clicked` | (none) | Hub only, on the GLP-1 Support links. The GLP-1 page itself is not counted. | Do hub visitors follow the GLP-1 link? |

## Reading a funnel

Module 1, top to bottom: pageview `/playbook/module-01/`, then `playbook-m1/step_viewed/step-0`, `stop`, `challenge`, `quiz`, `artifact`, `next`. The same idea on the landing page is `mission` → `modules` → `tool` → `volunteer-end`, plus `nav_clicked/module-01` for people who start the lesson. On a tool: pageview, then `input_kind/sample` or `input_kind/own`, then `analyze_clicked`, then `score_bucket/…`, then `copy_clicked/report`.

Totals only. There is no per-person path, because no session id is sent.
