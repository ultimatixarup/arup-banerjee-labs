/** Offline test: shared/labs-counts.js only sends allow-listed fixed strings; labs-forms.js stays hidden until configured. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
// Run: node tests/labs-counts.test.js   (no network, no dependencies)
const R=require('path').resolve(__dirname,'..')+'/';
function run(cfg,{host='ultimatixarup.github.io',proto='https:',dnt,gpc,page='agent-health-checker'}={}){
  const imgs=[],beacons=[],listeners=[];
  const links=[{addEventListener:(t,f)=>listeners.push(f)}];
  const sb={console,Math,encodeURIComponent,String,Object,
    location:{hostname:host,protocol:proto},
    navigator:{doNotTrack:dnt,globalPrivacyControl:gpc,sendBeacon:(u)=>{beacons.push(u);return true;}},
    Image:function(){const o={};imgs.push(o);return o;},
    document:{readyState:'complete',currentScript:{getAttribute:()=>page},querySelectorAll:()=>links,addEventListener(){}}};
  sb.window=sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(R+'shared/labs-config.js','utf8'),sb);
  if(cfg) sb.window.LABS_CONFIG=Object.assign({},sb.window.LABS_CONFIG,cfg);
  vm.runInContext(fs.readFileSync(R+'shared/labs-counts.js','utf8'),sb);
  return {sb,imgs,beacons,listeners,urls:()=>imgs.map(i=>i.src).concat(beacons)};
}
// 1. placeholder config: nothing sent
let t=run(null); t.sb.LabsCount.event('analyze_clicked'); t.sb.LabsCount.event('score_bucket','50-74');
assert.strictEqual(t.urls().length,0,'placeholder must send nothing');
// 2. configured
t=run({GOATCOUNTER_CODE:'abl-test'});
const L=t.sb.LabsCount;
L.event('analyze_clicked'); L.event('score_bucket','50-74'); L.event('copy_clicked','report'); L.event('copy_clicked','redteam');
L.event('score_bucket','sk_live_SECRET'); L.event('run_shell_tool'); L.event('analyze_clicked?x=1'); L.event('copy_clicked','my secret text');
const paths=t.urls().map(u=>{const q=new URL(u).searchParams;return q.get('p')+(q.get('e')?' [event]':'');});
console.log(paths);
assert.deepStrictEqual(paths,['/agent-health-checker/','agent-health-checker/analyze_clicked [event]','agent-health-checker/score_bucket/50-74 [event]','agent-health-checker/copy_clicked/report [event]','agent-health-checker/copy_clicked/redteam [event]','agent-health-checker/copy_clicked/report [event]']);
t.urls().forEach(u=>{const q=new URL(u);assert.strictEqual(q.host,'abl-test.goatcounter.com');assert.deepStrictEqual([...q.searchParams.keys()].sort(),[...(q.searchParams.get('e')?['e']:[]),'p','rnd'].sort());});
// 3. wrong host / http / DNT / GPC / unknown page: nothing
for (const o of [{host:'127.0.0.1'},{proto:'http:'},{dnt:'1'},{gpc:true},{page:'glp1-support'},{host:'evil.example'}]){
  const x=run({GOATCOUNTER_CODE:'abl-test'},o); x.sb.LabsCount.event('analyze_clicked'); assert.strictEqual(x.urls().length,0,JSON.stringify(o));
}
// 4. bad code value (injection attempt) -> nothing
let b=run({GOATCOUNTER_CODE:'evil.com/x?'}); b.sb.LabsCount.event('analyze_clicked'); assert.strictEqual(b.urls().length,0);
// 5. hub GLP-1 click uses beacon, event only on hub
let h=run({GOATCOUNTER_CODE:'abl-test'},{page:'hub'}); h.listeners.forEach(f=>f());
assert.deepStrictEqual(h.urls().map(u=>new URL(u).searchParams.get('p')),['/','hub/glp1_link_clicked']);
let nh=run({GOATCOUNTER_CODE:'abl-test'},{page:'cloud-bill-smell'}); assert.strictEqual(nh.listeners.length,0);
console.log('labs-counts: ALL PASS');

// labs-forms
function forms(cfg){
  const els={'labs-optional':{hidden:true},'labs-signup':{hidden:true,attrs:{},setAttribute(k,v){this.attrs[k]=v;}},'labs-feedback':{hidden:true,a:{href:'#'},querySelector(){return this.a;}}};
  const sb={document:{readyState:'complete',getElementById:(id)=>els[id],addEventListener(){}},Object};sb.window=sb;vm.createContext(sb);
  vm.runInContext(fs.readFileSync(R+'shared/labs-config.js','utf8'),sb);
  if(cfg) sb.window.LABS_CONFIG=Object.assign({},sb.window.LABS_CONFIG,cfg);
  vm.runInContext(fs.readFileSync(R+'shared/labs-forms.js','utf8'),sb); return els;
}
let e=forms(null); assert(e['labs-optional'].hidden&&e['labs-signup'].hidden&&e['labs-feedback'].hidden,'placeholders keep all hidden');
e=forms({LIST_FORM_ACTION:'https://buttondown.com/api/emails/embed-subscribe/x'}); assert(!e['labs-optional'].hidden&&!e['labs-signup'].hidden&&e['labs-feedback'].hidden);
assert.strictEqual(e['labs-signup'].attrs.action,'https://buttondown.com/api/emails/embed-subscribe/x');
e=forms({FEEDBACK_FORM_URL:'https://forms.gle/abc'}); assert(!e['labs-optional'].hidden&&e['labs-signup'].hidden&&!e['labs-feedback'].hidden&&e['labs-feedback'].a.href==='https://forms.gle/abc');
e=forms({FEEDBACK_FORM_URL:'javascript:alert(1)',LIST_FORM_ACTION:'http://insecure'}); assert(e['labs-optional'].hidden);
console.log('labs-forms: ALL PASS');
