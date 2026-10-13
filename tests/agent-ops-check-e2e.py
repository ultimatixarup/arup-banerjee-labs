#!/usr/bin/env python3
"""Headless check of /agent-ops-check/: load a sample zip, run, and compare findings + scores with the CLI.
Usage: python3 tests/agent-ops-check-e2e.py <path-to-agent-ops-check-repo> [--chrome /usr/bin/google-chrome]
Needs: pip install playwright (uses an installed Chrome via --chrome, or `playwright install chromium`)."""
import json, subprocess, sys, threading, functools, http.server, os, pathlib
from playwright.sync_api import sync_playwright

LABS = pathlib.Path(__file__).resolve().parent.parent
AOC = pathlib.Path(sys.argv[1]).resolve()
chrome = sys.argv[sys.argv.index("--chrome") + 1] if "--chrome" in sys.argv else None
ZIP = AOC / "test" / "fixtures" / "bad-agent.zip"

STRIP = """const {analyze}=require('./src');const r=analyze([process.argv[1]]);
const s={score:r.score,filesScanned:r.filesScanned,agents:r.agents,groups:r.groups.map(g=>({id:g.id,score:g.score,findings:g.findings.map(f=>[f.rule,f.severity,f.file,f.line,f.message,f.evidence===undefined?null:f.evidence])})),standards:r.standards.map(s=>[s.id,s.items.map(i=>[i.id,i.findings,i.high])]),evals:[r.evals.functional.length,r.evals.security.length]};
console.log(JSON.stringify(s))"""
cli = json.loads(subprocess.check_output(["node", "-e", STRIP, str(ZIP)], cwd=AOC, text=True))

srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(LABS)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % srv.server_address[1]
fails, requests, errors = [], [], []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
    pg = b.new_page(accept_downloads=True)
    pg.on("request", lambda r: requests.append(r.url))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(base + "agent-ops-check/")
    n_before = len(requests)
    pg.set_input_files("#in-zip", str(ZIP))
    pg.wait_for_selector("#queue:has-text('bad-agent.zip')")
    pg.click("#btn-run")
    pg.wait_for_selector("#status:has-text('Done:')")
    web = pg.evaluate("""() => { const r = window.__AOC_LAST__();
      return {score:r.score,filesScanned:r.filesScanned,agents:r.agents,groups:r.groups.map(g=>({id:g.id,score:g.score,findings:g.findings.map(f=>[f.rule,f.severity,f.file,f.line,f.message,f.evidence===undefined?null:f.evidence])})),standards:r.standards.map(s=>[s.id,s.items.map(i=>[i.id,i.findings,i.high])]),evals:[r.evals.functional.length,r.evals.security.length]}; }""")
    shown = pg.inner_text("#score-num")
    tabs = pg.inner_text("#tabs")
    with pg.expect_download() as d: pg.click("[data-dl=__zip]")
    dl = "/tmp/aoc-e2e-report.zip"; d.value.save_as(dl)
    pg.screenshot(path=str(pathlib.Path("/tmp/aoc-web.png")), full_page=False)
    scan_requests = requests[n_before:]
    b.close()
srv.shutdown()

def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (" — " + detail if detail else ""))
    if not ok: fails.append(name)
check("score matches CLI", web["score"] == cli["score"], "web %s / cli %s / shown %s" % (web["score"], cli["score"], shown))
check("files scanned match", web["filesScanned"] == cli["filesScanned"], str(web["filesScanned"]))
for gw, gc in zip(web["groups"], cli["groups"]):
    check("group %s: score %s, %d findings identical" % (gw["id"], gw["score"], len(gw["findings"])), gw == gc)
check("same groups", [g["id"] for g in web["groups"]] == [g["id"] for g in cli["groups"]])
check("standards map (10 frameworks) matches", web["standards"] == cli["standards"] and len(web["standards"]) == 10)
check("eval-set counts match", web["evals"] == cli["evals"], str(web["evals"]))
check("findings show zip!/path labels", any(f[2].startswith("bad-agent.zip!/") for g in web["groups"] for f in g["findings"]))
check("no network requests during scan", not [u for u in scan_requests if not u.startswith("blob:")], str(scan_requests))
check("page only loaded same-origin files", all(u.startswith(base) or u.startswith("blob:") or u.startswith("data:") for u in requests), str([u for u in requests if not u.startswith(base)]))
check("no console errors / CSP violations", not errors, str(errors))
import zipfile; zn = zipfile.ZipFile(dl).namelist()
check("report zip has HTML/JSON/MD/SARIF + evals", all("agent-ops-report/" + n in zn for n in ["index.html", "report.json", "report.md", "report.sarif", "evals/functional.jsonl", "evals/security.jsonl", "ste.html", "redteam-pack.txt"]), ", ".join(zn))
check("tabs rendered", "Standards map (10)" in tabs and "Eval sets" in tabs, tabs.replace("\n", " | "))
sys.exit(1 if fails else 0)
