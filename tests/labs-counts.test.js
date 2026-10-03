/** Offline test: shared/labs-counts.js only sends allow-listed fixed strings; labs-forms.js stays hidden until configured. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
// Run: node tests/labs-counts.test.js   (no network, no dependencies)
const R = path.resolve(__dirname, '..') + '/';
const WARN = "Don't paste this report into a chatbot or share it publicly without redacting account IDs, names, and costs first.";
const DISCLAIMER = 'Personal project built on my own time. Not affiliated with or endorsed by my employer; views are my own.';

function run(cfg, opt) {
  opt = opt || {};
  const sent = [];
  const beacons = [];
  const elements = (opt.els || []).map(function (spec) {
    const el = {
      tagName: String(spec.tag || 'a').toUpperCase(),
      open: !!spec.open,
      attrs: spec.attrs || {},
      _L: {},
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      addEventListener: function (type, fn) { (this._L[type] || (this._L[type] = [])).push(fn); }
    };
    return el;
  });
  const sb = {
    console: console,
    Math: Math,
    encodeURIComponent: encodeURIComponent,
    String: String,
    Object: Object,
    location: { hostname: opt.host || 'ultimatixarup.github.io', protocol: opt.proto || 'https:' },
    navigator: {
      doNotTrack: opt.dnt,
      globalPrivacyControl: opt.gpc,
      sendBeacon: function (u) { beacons.push(u); sent.push({ src: u }); return true; }
    },
    Image: function () { const o = {}; sent.push(o); return o; },
    document: {
      readyState: 'complete',
      currentScript: { getAttribute: function () { return opt.page || 'agent-health-checker'; } },
      querySelectorAll: function (sel) {
        if (sel === '[data-count]') return elements.filter(function (e) { return e.getAttribute('data-count'); });
        if (sel === '[data-step]') return elements.filter(function (e) { return e.getAttribute('data-step'); });
        return [];
      },
      addEventListener: function () {},
      documentElement: opt.metrics ? {
        scrollHeight: opt.metrics.height,
        scrollTop: opt.metrics.top,
        clientHeight: opt.metrics.view
      } : undefined
    }
  };
  sb.window = sb;
  sb.doNotTrack = opt.winDnt;
  if (opt.metrics) {
    sb.pageYOffset = opt.metrics.top;
    sb.innerHeight = opt.metrics.view;
    sb.addEventListener = function () {};
  }
  if (opt.useIO) {
    sb.IntersectionObserver = function (cb) {
      this.observe = function (node) { cb([{ isIntersecting: true, target: node }]); };
      this.unobserve = function () {};
    };
  }
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(R + 'shared/labs-config.js', 'utf8'), sb);
  if (cfg) sb.window.LABS_CONFIG = Object.assign({}, sb.window.LABS_CONFIG, cfg);
  vm.runInContext(fs.readFileSync(R + 'shared/labs-counts.js', 'utf8'), sb);
  return {
    sb: sb,
    elements: elements,
    urls: function () { return sent.map(function (i) { return i.src; }); },
    paths: function () {
      return this.urls().map(function (u) {
        const q = new URL(u).searchParams;
        return q.get('p') + (q.get('e') ? ' [event]' : '');
      });
    }
  };
}

function pathsOf(cfg, opt) {
  const t = run(cfg, opt);
  return t.paths();
}

const BANNED = [
  'sk_live_SECRET', 'run_shell_tool', 'acct_12345', 'evil.example', 'My page title',
  'pasted bill for account', 'ignore previous instructions', 'sk-demo', 'user@example.com',
  'shell_exec', '?secret=', 'referrer', 'document.title'
];

function assertClean(urls, label) {
  urls.forEach(function (u) {
    const q = new URL(u);
    assert.strictEqual(q.protocol, 'https:', label);
    assert.ok(/^[a-z0-9-]+\.goatcounter\.com$/.test(q.host), q.host);
    const keys = [...q.searchParams.keys()].sort();
    assert.deepStrictEqual(keys, q.searchParams.get('e') ? ['e', 'p', 'rnd'] : ['p', 'rnd'], label + ' ' + u);
    const blob = decodeURIComponent(u);
    BANNED.forEach(function (bad) {
      assert.ok(blob.indexOf(bad) === -1, label + ' leaked ' + bad + ' in ' + blob);
    });
    assert.ok(!/[<>\s]/.test(q.searchParams.get('p')), 'path has free text: ' + q.searchParams.get('p'));
  });
}

// 1. A placeholder code still sends nothing, even on the public host.
let t = run({ GOATCOUNTER_CODE: 'GOATCOUNTER_CODE' });
const L0 = t.sb.LabsCount;
L0.event('analyze_clicked');
L0.event('score_bucket', '50-74');
L0.event('step_viewed', 'challenge');
L0.event('input_kind', 'own');
L0.event('scroll_depth', '25');
L0.event('nav_clicked', 'case-study');
L0.event('volunteer_clicked', 'top');
L0.event('copy_clicked', 'card-a');
assert.strictEqual(t.urls().length, 0, 'placeholder must send nothing');

// 1b. The committed site code sends only on https://ultimatixarup.github.io.
const liveCfg = fs.readFileSync(R + 'shared/labs-config.js', 'utf8');
assert.ok(/GOATCOUNTER_CODE:\s*"arup-labs"/.test(liveCfg), 'live site code');
assert.ok(/LIST_FORM_ACTION:\s*"LIST_FORM_ACTION"/.test(liveCfg), 'signup stays off');
assert.ok(/FEEDBACK_FORM_URL:\s*"FEEDBACK_FORM_URL"/.test(liveCfg), 'feedback stays off');
assert.ok(/GLP1_FEEDBACK_FORM_URL:\s*"GLP1_FEEDBACK_FORM_URL"/.test(liveCfg), 'glp1 form stays off');
t = run(null);
t.sb.LabsCount.event('analyze_clicked');
assert.ok(t.urls().length > 0, 'live code counts on the public host');
t.urls().forEach(function (u) {
  assert.strictEqual(new URL(u).host, 'arup-labs.goatcounter.com');
});
[
  { host: '127.0.0.1' },
  { host: 'localhost' },
  { host: 'ultimatixarup.github.io', proto: 'http:' },
  { host: 'evil.example' },
  { dnt: '1' },
  { gpc: true },
  { page: 'glp1-support' }
].forEach(function (o) {
  const x = run(null, o);
  x.sb.LabsCount.event('analyze_clicked');
  x.sb.LabsCount.event('step_viewed', 'challenge');
  assert.strictEqual(x.urls().length, 0, 'live code gated: ' + JSON.stringify(o));
});

// 2. Configured: original events and the new funnel events. Secrets are dropped.
t = run({ GOATCOUNTER_CODE: 'abl-test' });
const L = t.sb.LabsCount;
L.event('analyze_clicked');
L.event('score_bucket', '50-74');
L.event('copy_clicked', 'report');
L.event('copy_clicked', 'redteam');
L.event('copy_clicked', 'card-a');
L.event('copy_clicked', 'brief');
L.event('input_kind', 'sample');
L.event('input_kind', 'sample_transcript');
L.event('input_kind', 'own');
L.event('nav_clicked', 'case-study');
L.event('volunteer_clicked', 'module');
L.event('step_viewed', 'challenge');
L.event('step_viewed', 'challenge'); // once per view
L.event('scroll_depth', '75');
L.event('card_picked', 'd');
L.event('round_picked', '2');
L.event('quiz_opened');
L.event('score_bucket', 'sk_live_SECRET');
L.event('run_shell_tool');
L.event('analyze_clicked?x=1');
L.event('copy_clicked', 'my secret text');
L.event('step_viewed', 'pasted bill for account 9988');
L.event('nav_clicked', 'https://evil.example/?secret=1');
L.event('input_kind', 'acct_12345');
L.event('volunteer_clicked', 'user@example.com');
L.event('scroll_depth', '33');
L.event('card_picked', 'TuneUp.java');
L.event('quiz_opened', 'the answer is b');
assert.deepStrictEqual(t.paths(), [
  '/agent-health-checker/',
  'agent-health-checker/analyze_clicked [event]',
  'agent-health-checker/score_bucket/50-74 [event]',
  'agent-health-checker/copy_clicked/report [event]',
  'agent-health-checker/copy_clicked/redteam [event]',
  'agent-health-checker/copy_clicked/card-a [event]',
  'agent-health-checker/copy_clicked/brief [event]',
  'agent-health-checker/input_kind/sample [event]',
  'agent-health-checker/input_kind/sample_transcript [event]',
  'agent-health-checker/input_kind/own [event]',
  'agent-health-checker/nav_clicked/case-study [event]',
  'agent-health-checker/volunteer_clicked/module [event]',
  'agent-health-checker/step_viewed/challenge [event]',
  'agent-health-checker/scroll_depth/75 [event]',
  'agent-health-checker/card_picked/d [event]',
  'agent-health-checker/round_picked/2 [event]',
  'agent-health-checker/quiz_opened [event]',
  'agent-health-checker/copy_clicked/report [event]'
]);
assertClean(t.urls(), 'configured');

// 3. Wrong host / http / DNT / GPC / unknown page / GLP-1 page id: nothing.
[
  { host: '127.0.0.1' },
  { host: 'localhost' },
  { proto: 'http:' },
  { dnt: '1' },
  { winDnt: '1' },
  { gpc: true },
  { page: 'glp1-support' },
  { page: 'playbook-privacy' },
  { host: 'evil.example' }
].forEach(function (o) {
  const x = run({ GOATCOUNTER_CODE: 'abl-test' }, o);
  x.sb.LabsCount.event('analyze_clicked');
  x.sb.LabsCount.event('step_viewed', 'challenge');
  x.sb.LabsCount.event('input_kind', 'own');
  x.sb.LabsCount.event('nav_clicked', 'case-study');
  assert.strictEqual(x.urls().length, 0, JSON.stringify(o));
});

// 4. Bad code value (injection) -> nothing. Uppercase placeholder too.
['evil.com/x?', 'GOATCOUNTER_CODE', 'AbC', '../x', ''].forEach(function (code) {
  const b = run({ GOATCOUNTER_CODE: code });
  b.sb.LabsCount.event('analyze_clicked');
  b.sb.LabsCount.event('step_viewed', 'step-0');
  assert.strictEqual(b.urls().length, 0, code);
});

// 5. Hub GLP-1 click uses a beacon. The same attribute on another page does not.
let hub = run({ GOATCOUNTER_CODE: 'abl-test' }, {
  page: 'hub',
  els: [{ tag: 'a', attrs: { 'data-count': 'glp1_link_clicked' } }]
});
hub.elements[0]._L.click.forEach(function (fn) { fn(); });
assert.deepStrictEqual(hub.paths(), ['/', 'hub/glp1_link_clicked [event]']);
let notHub = run({ GOATCOUNTER_CODE: 'abl-test' }, {
  page: 'cloud-bill-smell',
  els: [{ tag: 'a', attrs: { 'data-count': 'glp1_link_clicked' } }]
});
notHub.elements[0]._L.click.forEach(function (fn) { fn(); });
assert.deepStrictEqual(notHub.paths(), ['/cloud-bill-smell/']);

// 6. Clicks, steps, and scroll only emit allow-listed labels.
let ui = run({ GOATCOUNTER_CODE: 'abl-test' }, {
  page: 'playbook',
  useIO: true,
  els: [
    { tag: 'a', attrs: { 'data-count': 'nav_clicked', 'data-detail': 'case-study' } },
    { tag: 'a', attrs: { 'data-count': 'nav_clicked', 'data-detail': 'https://evil.example/?secret=1' } },
    { tag: 'a', attrs: { 'data-count': 'volunteer_clicked', 'data-detail': 'top' } },
    { tag: 'details', attrs: { 'data-count': 'quiz_opened' } },
    { tag: 'section', attrs: { 'data-step': 'mission' } },
    { tag: 'section', attrs: { 'data-step': 'sk_live_SECRET' } }
  ]
});
ui.elements.forEach(function (el) {
  if (el.tagName === 'DETAILS') {
    el.open = true;
    (el._L.toggle || []).forEach(function (fn) { fn(); });
    el.open = false;
    (el._L.toggle || []).forEach(function (fn) { fn(); });
  } else if (el._L.click) {
    el._L.click.forEach(function (fn) { fn(); });
  }
});
assert.deepStrictEqual(ui.paths(), [
  '/playbook/',
  'playbook/step_viewed/mission [event]',
  'playbook/nav_clicked/case-study [event]',
  'playbook/volunteer_clicked/top [event]',
  'playbook/quiz_opened [event]'
]);
assertClean(ui.urls(), 'ui');

let scrolled = run({ GOATCOUNTER_CODE: 'abl-test' }, {
  page: 'playbook-m1',
  metrics: { height: 2000, top: 1000, view: 500 }
});
assert.deepStrictEqual(scrolled.paths(), [
  '/playbook/module-01/',
  'playbook-m1/scroll_depth/25 [event]',
  'playbook-m1/scroll_depth/50 [event]'
]);
let shortPage = run({ GOATCOUNTER_CODE: 'abl-test' }, {
  page: 'playbook-m2',
  metrics: { height: 400, top: 0, view: 800 }
});
assert.deepStrictEqual(shortPage.paths(), ['/playbook/module-02/']);

// 7. Every data-step / data-count in the counted pages is on the allow-list.
const PAGES = {
  'index.html': 'hub',
  'case-study/index.html': 'case-study',
  'agent-health-checker/index.html': 'agent-health-checker',
  'cloud-bill-smell/index.html': 'cloud-bill-smell',
  'observability-gap-finder/index.html': 'observability-gap-finder',
  'playbook/index.html': 'playbook',
  'playbook/module-01/index.html': 'playbook-m1',
  'playbook/module-02/index.html': 'playbook-m2',
  'playbook/module-03/index.html': 'playbook-m3',
  'playbook/module-04/index.html': 'playbook-m4'
};
Object.keys(PAGES).forEach(function (file) {
  const html = fs.readFileSync(R + file, 'utf8');
  const page = PAGES[file];
  const live = run({ GOATCOUNTER_CODE: 'abl-test' }, { page: page });
  const tags = html.match(/<[^>]*\sdata-count="[^"]*"[^>]*>/g) || [];
  tags.forEach(function (tag) {
    const name = /data-count="([^"]*)"/.exec(tag)[1];
    const detail = /data-detail="([^"]*)"/.exec(tag);
    const before = live.urls().length;
    live.sb.LabsCount.event(name, detail ? detail[1] : null);
    assert.ok(live.urls().length === before + 1, file + ' dropped ' + name + ' ' + (detail && detail[1]));
  });
  const steps = html.match(/data-step="([^"]*)"/g) || [];
  steps.forEach(function (raw) {
    const id = /data-step="([^"]*)"/.exec(raw)[1];
    const before = live.urls().length;
    live.sb.LabsCount.event('step_viewed', id);
    assert.ok(live.urls().length === before + 1, file + ' dropped step ' + id);
    live.sb.LabsCount.event('step_viewed', id + ' pasted bill');
    assert.strictEqual(live.urls().length, before + 1, file + ' accepted a tampered step');
  });
  assertClean(live.urls(), file);
  assert.ok(html.indexOf(DISCLAIMER) !== -1, file + ' disclaimer');
});

// 8. The counter script itself cannot store or read identity. GLP-1 and playbook legal pages stay off.
const src = fs.readFileSync(R + 'shared/labs-counts.js', 'utf8');
['localStorage', 'sessionStorage', 'document.cookie', 'document.referrer', 'fingerprint', 'document.title'].forEach(function (needle) {
  assert.ok(src.indexOf(needle) === -1, 'counts script mentions ' + needle);
});
['glp1-support/index.html', 'glp1-support/terms.html', 'playbook/privacy.html', 'playbook/terms.html'].forEach(function (file) {
  const html = fs.readFileSync(R + file, 'utf8');
  assert.ok(html.indexOf('labs-counts.js') === -1, file + ' loads the counter');
  assert.ok(html.indexOf('goatcounter') === -1, file + ' allows GoatCounter');
  assert.ok(/connect-src 'none'/.test(html), file + ' connect-src');
});
const glp = fs.readFileSync(R + 'glp1-support/index.html', 'utf8');
assert.ok(/img-src 'self' data:/.test(glp) && glp.indexOf('https://*.goatcounter.com') === -1, 'GLP-1 img-src changed');
assert.ok(/script-src 'self'/.test(glp) && /script-src 'none'/.test(fs.readFileSync(R + 'glp1-support/terms.html', 'utf8')));

['playbook/index.html', 'playbook/module-01/index.html', 'playbook/module-02/index.html', 'playbook/module-03/index.html', 'playbook/module-04/index.html'].forEach(function (file) {
  const html = fs.readFileSync(R + file, 'utf8');
  assert.ok(html.indexOf('labs-counts.js') !== -1, file);
  assert.ok(/script-src 'self'/.test(html), file + ' script-src');
  assert.ok(html.indexOf('https://*.goatcounter.com') !== -1, file + ' img-src');
  assert.ok(/connect-src 'none'/.test(html), file + ' connect-src');
  assert.ok(html.indexOf('unsafe-eval') === -1, file);
  assert.ok(html.indexOf(DISCLAIMER) !== -1, file);
});
assert.ok(/script-src 'none'/.test(fs.readFileSync(R + 'playbook/privacy.html', 'utf8')));
assert.ok(/script-src 'none'/.test(fs.readFileSync(R + 'playbook/terms.html', 'utf8')));

['cloud-bill-smell', 'observability-gap-finder', 'agent-health-checker'].forEach(function (dir) {
  const html = fs.readFileSync(R + dir + '/index.html', 'utf8');
  const js = fs.readFileSync(R + dir + '/app.js', 'utf8');
  assert.ok(html.indexOf(WARN) !== -1, dir + ' page warning');
  assert.ok(js.indexOf(WARN) !== -1, dir + ' report warning');
});

console.log('labs-counts: ALL PASS');

// labs-forms
function forms(cfg) {
  const els = {
    'labs-optional': { hidden: true },
    'labs-signup': { hidden: true, attrs: {}, setAttribute: function (k, v) { this.attrs[k] = v; } },
    'labs-feedback': { hidden: true, a: { href: '#' }, querySelector: function () { return this.a; } }
  };
  const sb = { document: { readyState: 'complete', getElementById: function (id) { return els[id]; }, addEventListener: function () {} }, Object: Object };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(R + 'shared/labs-config.js', 'utf8'), sb);
  if (cfg) sb.window.LABS_CONFIG = Object.assign({}, sb.window.LABS_CONFIG, cfg);
  vm.runInContext(fs.readFileSync(R + 'shared/labs-forms.js', 'utf8'), sb);
  return els;
}
let e = forms(null);
assert(e['labs-optional'].hidden && e['labs-signup'].hidden && e['labs-feedback'].hidden, 'placeholders keep all hidden');
e = forms({ LIST_FORM_ACTION: 'https://buttondown.com/api/emails/embed-subscribe/x' });
assert(!e['labs-optional'].hidden && !e['labs-signup'].hidden && e['labs-feedback'].hidden);
assert.strictEqual(e['labs-signup'].attrs.action, 'https://buttondown.com/api/emails/embed-subscribe/x');
e = forms({ FEEDBACK_FORM_URL: 'https://forms.gle/abc' });
assert(!e['labs-optional'].hidden && e['labs-signup'].hidden && !e['labs-feedback'].hidden && e['labs-feedback'].a.href === 'https://forms.gle/abc');
e = forms({ FEEDBACK_FORM_URL: 'javascript:alert(1)', LIST_FORM_ACTION: 'http://insecure' });
assert(e['labs-optional'].hidden);
console.log('labs-forms: ALL PASS');
