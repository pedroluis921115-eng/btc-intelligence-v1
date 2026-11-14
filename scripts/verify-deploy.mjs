// Verify current public GitHub Pages publication against the pushed commit.
import assert from 'node:assert/strict';
const base='https://pedroluis921115-eng.github.io/btc-intelligence-v1/';
const repo='pedroluis921115-eng/btc-intelligence-v1',version='v2-final-20261114';
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
 assert.ok(html.includes('topSnapshot')&&html.includes('alertsPanel')&&html.includes('runtimeHealth'),'UI incomplete');
 for(const fn of ['monitorStreams','clearBybitLive','sourceFreshness','foldClosed','recordSkipped'])
  assert.ok(js.includes(fn),'missing deployed JS '+fn);
 assert.ok(sw.includes('btc-intelligence-'+version),'old service worker cache');
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
  const [html,js,sw,plan]=await Promise.all(['','app.js','sw.js','PLAN_V2_ESTADO.md']
   .map(f=>retrieve(base+f+q)));
  const result=assertDeployed(html,js,sw,plan);
  console.log('PUBLICATION_PASS',version,result,expected||'local');
  passed=true;break
 }catch(e){
  last=e;console.log('PUBLICATION_RETRY',i,e.message);
  if(i<n)await new Promise(resolve=>setTimeout(resolve,10000))
 }
}
if(!passed){console.error('PUBLICATION_HOLD',last?.message);process.exitCode=1}
