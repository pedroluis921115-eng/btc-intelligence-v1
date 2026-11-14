'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const els=new Map(),ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(obj,k)=>obj[k]??(()=>{})});
function $(id){if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',className:'',parentElement:{getBoundingClientRect:()=>({width:390,height:250})},getContext:()=>ctx});return els.get(id)}
const sandbox={document:{getElementById:$,hidden:false},window:{devicePixelRatio:1},console,Date,Math,Intl,devicePixelRatio:1,setInterval,clearInterval,setTimeout,clearTimeout};
vm.createContext(sandbox);vm.runInContext(source.replace(/init\(\);\s*$/,''),sandbox);
const run=code=>vm.runInContext(code,sandbox);
let tests=0;function check(a,desc){assert.ok(a,desc);tests++;console.log('PASS',desc)}
(async()=>{
 const now=Date.now();
 for(const m of [5,15,30,60,240]){
  const period=m*60000,t=Math.floor((now-period)/period)*period;
  sandbox.pair=[{ts:t,v:200},{ts:t+period,v:220}];sandbox.rows=[[String(t),'70000','71400','69800','70700']];
  const result=run('alignPriceOi(pair,rows,'+period+','+(t+period+1)+')');
  check(result.ok&&Math.abs(result.pricePct-1)<.0001&&Math.abs(result.oiPct-10)<.00001&&result.start===t&&result.end===t+period,'matched closed interval '+m+'m');
  check(!run('alignPriceOi(pair,rows,'+period+','+(t+period-1)+').ok'),'reject unclosed interval '+m+'m');
  check(!run('alignPriceOi(pair,rows,'+period+','+(t+period*4)+').ok'),'reject stale interval '+m+'m');
  check(!run('alignPriceOi(pair,[[String('+(t+60000)+'),"70000","70100","69000","70700"]],'+period+','+(t+period+1)+').ok'),'reject wrong price interval '+m+'m');
 }
 const period=5*60000,t=Math.floor(now/period)*period;
 sandbox.pair=[{ts:t-3*period,v:100},{ts:t,v:110}];sandbox.rows=[[String(t-period),'70000','71400','69800','70700']];
 check(!run('alignPriceOi(pair,rows,300000,'+(t+1)+').ok'),'reject missing OI intervals');
 sandbox.pair=[{ts:t-period,v:100},{ts:t,v:110}];sandbox.rows=[[String(t-period),'70000','71400','69800','70700']];
 check(run('closedPriceCandle(rows,'+(t-period)+','+t+','+(t+1)+').close===70700'),'candle contains actual closed value');
 // Dataset deliberately has large raw levels at both ends and smaller nearby groups.
 run("state.price=70000;state.wsOk=true;state.lastBookAt=Date.now();state.bids.clear();state.asks.clear();state.zoneSeen.clear()");
 sandbox.bids=[['69990','4'],['69995','5'],['69970','1'],['69930','2']];
 sandbox.asks=[['70010','4'],['70015','4'],['70035','1']];
 run("for(const [p,q] of bids)state.bids.set(p,q);for(const [p,q] of asks)state.asks.set(p,q)");
 const first=run('liquidityZones()');
 check(first.bid.length>0&&first.ask.length>0,'zones on both sides');
 check(first.bid.some(x=>x.levels>=2&&x.total>600000),'aggregate nearby bid levels into a zone');
 check(first.ask.some(x=>x.levels>=2&&x.total>500000),'aggregate nearby ask levels into a zone');
 const bid=first.bid.find(x=>x.levels>=2);
 sandbox.id=bid.key;
 const seen=run('state.zoneSeen.get(id)');
 run('state.lastBookAt='+(seen+20000));const later=run('liquidityZones('+(seen+20000)+')');
 check(later.bid.find(x=>x.key===sandbox.id).qualified===true,'zone persistence after 15s');
 sandbox.clearKey=sandbox.id;
 run('state.bids.clear();state.asks.clear();liquidityZones()');
 check(!run('state.zoneSeen.has(clearKey)'),'zone persistence reset on removal');
 // Priority is relative ranking, NOT a market probability.
 const a=run('wallPriority(700000,60000,.05)'),b=run('wallPriority(200000,1000,.60)');
 check(a>b&&a>0&&b>0,'priority weighs size, age and proximity');
 run("state.bids.set('69980','4');state.lastBookAt=Date.now();state.wsOk=true;state.wallSeen.set('B:69980',Date.now()-30000);state.wallQualifiedSince.set('B:69980',Date.now()-30000);renderWallInsights()");
 check($('liquidityBidZones').innerHTML.includes('prioridad'),'render zone prioritization');
 // Request timeout/race/stale handling for selected timeframe
 sandbox.oi=[{timestamp:String(t),openInterest:'110'},{timestamp:String(t-period),openInterest:'100'}];
 sandbox.kl=[[String(t-period),'70000','71400','69800','70700']];
 run("req=async u=>u.includes('open-interest')?{retCode:0,result:{list:oi}}:{retCode:0,result:{list:kl}};state.tf='5'");
 await run('getOiSeries()');
 check(run('state.oiAligned?.ok===true')&&$('oiAlignedPrice').textContent.includes('1.00%'),'data-dependent synchronized OI panel');
 sandbox.kl=[[String(t),'70000','71400','69800','70700']];
 await run('getOiSeries()');
 check(run('state.oiAligned===null')&&$('oiAlignedPrice').textContent==='—','no stale values when candle does not match');
 // Source guard: a Bybit trade must not be compared with a Binance candle open.
 run("state.tf='5';state.candlesTf='5';state.candleSource='Binance';state.candles=[[String(Math.floor(Date.now()/300000)*300000),'70000','70100','69900','70050']];state.price=70050;renderPrice()");
 check($('change').textContent==='—','do not mix Binance open with Bybit trade price');
 run("state.candleSource='Bybit';state.candlesTf='15';renderPrice()");
 check($('change').textContent==='—','reject stale timeframe candle');
 run("state.candlesTf='5';renderPrice()");
 check($('change').textContent.includes('0.07%'),'same-exchange, same-timeframe live change permitted');
 run("state.wsOk=false;renderWallInsights()");
 check($('liquidityBidZones').textContent.includes('sin datos recientes'),'hide stale zones when disconnected');
 console.log('A2_UNIT_PASS='+tests);
})().catch(e=>{console.error('A2_UNIT_FAILURE',e.stack);process.exitCode=1});
