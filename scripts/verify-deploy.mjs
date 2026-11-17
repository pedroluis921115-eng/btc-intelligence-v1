// Verify current public GitHub Pages publication against the pushed commit.
import assert from 'node:assert/strict';
const base='https://pedroluis921115-eng.github.io/btc-intelligence-v1/';
const repo='pedroluis921115-eng/btc-intelligence-v1',version='v6-macro-20261117';
const expected=process.env.EXPECTED_COMMIT||'',token=process.env.GH_TOKEN||'';
async function retrieve(url,headers={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(url,{cache:'no-store',signal:controller.signal,
   headers:{'user-agent':'BTC-Intelligence-check','accept':'application/json, text/plain, */*',...headers}});
  if(!response.ok)throw Error('HTTP '+response.status+' '+url);
  return response.text()
 }finally{clearTimeout(timer)}
}
function assertDeployed(html,js,sw,plan){
 assert.ok(html.includes('app.js?v='+version),'old HTML deployed');
 assert.ok(html.includes('topSnapshot')&&html.includes('alertsPanel')&&html.includes('runtimeHealth')&&html.includes('manualRadar')&&html.includes('manualConfluencePanel')&&html.includes('manualJournalPanel')&&html.includes('vsRoot')&&html.includes('vsPaneLiquidity')&&html.includes('vsMacroEvents'),'UI incomplete');
 for(const fn of ['monitorStreams','clearBybitLive','sourceFreshness','foldClosed','recordSkipped'])
  assert.ok(js.includes(fn),'missing deployed JS '+fn);
 assert.ok(sw.includes('btc-intelligence-'+version),'old service worker cache');
 assert.ok(html.includes('radar.js?v='+version)&&html.includes('planner.js?v='+version)&&html.includes('decision-assistant.js?v='+version)&&html.includes('manual-journal.js?v='+version)&&html.includes('visual-shell.js?v='+version)&&html.includes('multi-oi.js?v='+version)&&html.includes('liquidation-visual.js?v='+version)&&html.includes('market-insights.js?v='+version)&&html.includes('macro-calendar.js?v='+version)&&html.includes('macro-calendar.css?v='+version)&&html.includes('manual-assistant.css?v='+version)&&html.includes('visual-shell.css?v='+version)&&html.includes('v6-visual.css?v='+version),'manual assistant assets not linked');
 assert.ok(plan.includes('Estado tras Bloque Final'),'plan missing final record');
 const green=(plan.match(/🟢 \d{2} /g)||[]).length,red=(plan.match(/🔴 \d{2} /g)||[]).length;
 assert.equal(green,39);assert.equal(red,1);
 assert.ok(plan.includes('🔴 39 '),'physical Android cannot be automatically certified');
 return {green,red}
}
async function builtCurrentCommit(){
 if(!expected||!token)return;
 const raw=await retrieve('https://api.github.com/repos/'+repo+'/pages/builds/latest',{
  authorization:'Bearer '+token,accept:'application/vnd.github+json'});
 const build=JSON.parse(raw);
 if(build.status!=='built'||build.commit!==expected)
  throw Error('Pages status '+build.status+' commit '+build.commit+' != '+expected)
}
let last,passed=false;
for(let i=1,n=expected?36:1;i<=n;i++){
 try{
  await builtCurrentCommit();
  const q='?verify='+Date.now()+'-'+(expected||version).slice(0,9);
  const [html,js,sw,plan,radar,planner,decision,journal,visual,venueOi,liqVisual,insights,macro,macroCss,css,visualCss,v6Css,manifest]=await Promise.all(['','app.js','sw.js','PLAN_V2_ESTADO.md','radar.js','planner.js','decision-assistant.js','manual-journal.js','visual-shell.js','multi-oi.js','liquidation-visual.js','market-insights.js','macro-calendar.js','macro-calendar.css','manual-assistant.css','visual-shell.css','v6-visual.css','manifest.webmanifest']
   .map(f=>retrieve(base+f+q)));
  const result=assertDeployed(html,js,sw,plan);
  assert.ok(radar.includes('classifyCandles')&&planner.includes('planTrade')&&decision.includes('evaluateContext')&&journal.includes('validateRecord')&&visual.includes('switchView')&&venueOi.includes('parseResponse')&&liqVisual.includes('prepareChart')&&insights.includes('pickImportant')&&macro.includes('selectEvents')&&macroCss.includes('vs-macro')&&sw.includes("'./macro-calendar.js'")&&sw.includes("'./macro-calendar.css'")&&css.includes('.manual-radar')&&visualCss.includes('.vs-root')&&v6Css.includes('.vs-map-box')&&manifest.includes('BTC Intelligence V6'),'V6 assets incomplete');
  console.log('PUBLICATION_PASS',version,result,expected||'local');
  passed=true;break
 }catch(e){
  last=e;console.log('PUBLICATION_RETRY',i,e.message);
  if(i<n)await new Promise(resolve=>setTimeout(resolve,10000))
 }
}
if(!passed){console.error('PUBLICATION_HOLD',last?.message);process.exitCode=1}
