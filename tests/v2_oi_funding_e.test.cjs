'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const els=new Map(),ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
function $(id){if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',className:'',parentElement:{getBoundingClientRect:()=>({width:390,height:260})},getContext:()=>ctx});return els.get(id)}
const sandbox={document:{getElementById:$,hidden:false},window:{devicePixelRatio:1},console,Date,Math,Intl,devicePixelRatio:1,setTimeout,clearTimeout,setInterval,clearInterval};
vm.createContext(sandbox);vm.runInContext(src.replace(/init\(\);\s*$/,''),sandbox);
const run=q=>vm.runInContext(q,sandbox);let tests=0;
function check(test,name){assert.ok(test,name);console.log('PASS',name);tests++}
(async()=>{
 const now=Date.now(),interval=300000,slot=Math.floor(now/interval)*interval;
 sandbox.oiPoints=[];
 for(let i=25;i>=1;i--)sandbox.oiPoints.push({ts:slot-i*interval,v:1000+(25-i)*1});
 sandbox.oiPoints.push({ts:slot,v:1100});
 let r=run('classifyOiChange(oiPoints,300000)');
 check(r.ok&&r.notable&&r.threshold>=.03,'OI large change relative to earlier baseline');
 check(r.samples>=8&&r.observed>1,'OI comparison excludes current interval from baseline');
 const prior=sandbox.oiPoints.slice();prior[prior.length-1]={ts:slot,v:1025.1};sandbox.oiPoints=prior;
 r=run('classifyOiChange(oiPoints,300000)');
 check(r.ok&&!r.notable,'small OI variation distinguished from relevant change');
 sandbox.oiPoints=prior.map(x=>({...x}));sandbox.oiPoints.at(-1).ts=slot+interval;
 r=run('classifyOiChange(oiPoints,300000)');
 check(!r.ok,'OI with missing interval rejected');
 sandbox.oiPoints=prior.slice(-5);
 r=run('classifyOiChange(oiPoints,300000)');
 check(r.ok&&r.threshold===null,'OI too little history does not invent relevance');
 sandbox.oiPoints=[{ts:slot-interval,v:1000},{ts:slot+interval*2,v:1200}];
 check(!run('classifyOiChange(oiPoints,300000)').ok,'future OI snapshot rejected');
 // Funding indicative next vs historical settlement
 const hNow=Date.now();
 sandbox.fundingNow=hNow;sandbox.nextTime=hNow+60*60000;sandbox.historyTime=hNow-3*3600000;
 sandbox.mockFetcher=async url=>{
  if(url.includes('tickers'))return {retCode:0,result:{list:[{fundingRate:'0.00015',nextFundingTime:String(sandbox.nextTime)}]}};
  if(url.includes('funding/history'))return {retCode:0,result:{list:[{fundingRate:'-0.00010',fundingRateTimestamp:String(sandbox.historyTime)}]}};
  throw Error('unexpected '+url)
 };
 run('req=async url=>mockFetcher(url);state.wsOk=false;state.lastPriceAt=0');
 await run('getFunding()');
 check($('fundingCurrent').textContent==='+0.0150%','ticker funding displayed as indicative positive');
 check($('fundingPrevious').textContent==='-0.0100%','historical settled funding independent and negative');
 check($('fundingNext').textContent.includes('Indicativa para')&&$('fundingNext').textContent.includes('puede variar'),'future funding explicitly indicative with date');
 check($('fundingPreviousStamp').textContent.includes('Liquidación histórica')&&$('fundingPreviousStamp').textContent.includes('funding/history'),'last settled has historical origin and date');
 check(run('state.fundingNextAt===nextTime&&state.lastFundingAt===historyTime'),'separate funding timestamps retained');
 sandbox.nextTime=hNow-30000;await run('getFunding()');
 check($('fundingCurrent').textContent==='—'&&$('fundingPrevious').textContent==='-0.0100%','expired next event not treated as prospective rate');
 sandbox.nextTime=hNow+3600000;
 sandbox.mockFetcher=async url=>{if(url.includes('tickers'))throw Error('Ticker unavailable');return {retCode:0,result:{list:[{fundingRate:'0.00010',fundingRateTimestamp:String(sandbox.historyTime)}]}}};
 await run('getFunding()');
 check($('fundingCurrent').textContent==='—'&&$('fundingPrevious').textContent==='+0.0100%','partial source failure keeps verified historic funding only');
 // Hourly time alignment and disagreement
 const hour=Math.floor(Date.now()/3600000)*3600000,start=hour-3600000;
 sandbox.hourOi=[];for(let i=17;i>=0;i--){
  const ts=hour-i*3600000;
  sandbox.hourOi.push({timestamp:String(ts),openInterest:String(i===0?1150:1000+(17-i))})
 }
 sandbox.hourRatio=[{timestamp:String(hour),buyRatio:'.71',sellRatio:'.29'},{timestamp:String(start),buyRatio:'.25',sellRatio:'.75'}];
 sandbox.hourKline=[[String(start),'70000','70400','68600','69000'],[String(hour),'69000','69500','68800','69100']];
 sandbox.mockFetcher=async url=>{
  if(url.includes('/kline'))return{retCode:0,result:{list:sandbox.hourKline}};
  if(url.includes('open-interest'))return{retCode:0,result:{list:sandbox.hourOi}};
  if(url.includes('account-ratio'))return{retCode:0,result:{list:sandbox.hourRatio}};
  if(url.includes('tickers'))return{retCode:0,result:{list:[{fundingRate:'0.0001',nextFundingTime:String(Date.now()+3600000)}]}};
  throw Error(url)
 };
 run('state.hourlySlot=-1;state.hourlyAt=0;state.hourlyWindowEnd=0');
 await run('getHourlySentiment()');
 check(run('state.hourlyWindowEnd==='+hour+'&&state.hourlyAt>0'),'hourly data anchored at exact closing boundary');
 check($('hourlySentimentLabel').textContent.includes('contrapuestos'),'hourly downside price with long-heavy accounts displays disagreement');
 check($('hourlySentimentDetail').textContent.includes('Funding indicativo para el próximo pago'),'funding as current future context, not closed-hour data');
 check($('hourlySentimentStamp').textContent.includes('Ventana CERRADA')&&$('hourlySentimentStamp').textContent.includes('ratio de cuentas'),'timestamp and source of hourly components disclosed');
 const priorAt=run('state.hourlyAt');
 sandbox.hourOi=sandbox.hourOi.filter(x=>Number(x.timestamp)!==hour);
 run('state.hourlySlot=-1;state.hourlyWindowEnd=0');
 await run('getHourlySentiment()');
 check(run('state.hourlyAt')===priorAt&&$('hourlySentimentLabel').textContent.includes('cálculo pendiente'),'missing closing OI produces no invented sentiment');
 // Price sideways + very different OI should not infer upward move
 sandbox.synthetic={open:70000,close:70010,high:70050,low:69900,oiStart:1000,oiEnd:1200,ratioLong:.52,funding:0.0001,oiRelevance:{threshold:.07}};
 const sideways=run('classifyHourlyContext(synthetic)');
 check(sideways.ok&&sideways.direction==='flat'&&sideways.oiNotable,'OI expansion alone does not imply bullish BTC move');
 // source freshness explicit
 run('state.lastOiAt=Date.now()-700000;state.oiSource="Bybit";state.ratioAt=Date.now()-20000000;state.ratioLong=.7;state.ratioShort=.3;state.fngAt=Date.now()-40*3600000;state.fngValue=12;renderSourceFreshness()');
 check($('sourceFreshness').innerHTML.includes('OI puntual')&&$('sourceFreshness').innerHTML.includes('ATRASADO'),'OI stale status visible by source');
 check($('oi').textContent==='—'&&$('oiDelta').textContent==='—','stale spot OI cleared instead of left as live');
 check($('accountLong').textContent==='—'&&$('accountRatioStamp').textContent.includes('atrasado'),'stale account ratio not presented as current');
 check($('fngValue').textContent==='—'&&$('fngClass').textContent.includes('atrasado'),'expired daily fear greed not shown as current');
 check($('sourceFreshnessSummary').textContent.includes('lecturas con datos vigentes'),'source quality summary visible');
 const labels=run('sourceFreshness()');
 check(labels.length>=10&&labels.every(x=>x.origin&&x.status),'existing source inventory includes provenance and status');
 console.log('BLOQUE_E_FOCAL_PASS='+tests);
})().catch(err=>{console.error('E_TEST_FAILURE',err.stack);process.exitCode=1});
