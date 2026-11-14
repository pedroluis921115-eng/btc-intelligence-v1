'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const els=new Map(),ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
function el(id){if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',className:'',parentElement:{getBoundingClientRect:()=>({width:390,height:240})},getContext:()=>ctx});return els.get(id)}
const sandbox={document:{getElementById:el,hidden:false},window:{devicePixelRatio:1},console,Date,Math,Intl,devicePixelRatio:1,setTimeout,clearTimeout,setInterval,clearInterval};
vm.createContext(sandbox);vm.runInContext(src.replace(/init\(\);\s*$/,''),sandbox);
const run=x=>vm.runInContext(x,sandbox);let tests=0;
function pass(x,label){assert.ok(x,label);tests++;console.log('PASS',label)}
const now=Date.now();
run('state.sessionStart=Date.now()-600000;state.lastModelAt=Date.now();state.lastBreakCheckAt=Date.now();state.wsOk=true;state.lastBookAt=Date.now()');
function trade(id,offset,price,qty,side='Buy',seq=0){return {i:id,T:now+offset,p:String(price),v:String(qty),S:side,s:'BTCUSDT',seq}}
function feed(rows){sandbox.feedData={data:rows};run('onTrade(feedData)')}
feed([trade('one',-5000,70000,.1,'Buy',1)]);
pass(run("state.trades.length===1&&state.sessionCvd===7000"),'trade ingested with correctly signed CVD');
const price=run('state.price');
feed([trade('one',-5000,70000,.1,'Buy',1)]);
pass(run('state.trades.length===1&&state.tradeDuplicates===1&&state.sessionCvd===7000'),'trade ID dedup prevents double-counting CVD');
feed([trade('old-but-valid',-11000,68000,.2,'Sell',2)]);
pass(run('state.price===70000'),'out-of-order trade cannot roll live price backwards');
pass(run('state.trades.length===2&&state.trades.some(x=>x.id==="old-but-valid")'),'out-of-order valid event remains in windows');
feed([trade('ancient',-500000,65000,.2),trade('future',25000,65000,.2)]);
pass(run('state.trades.length===2&&state.tradeRejected===2'),'stale and future trades rejected');
feed([{...trade('bad',-2000,70000,.2),i:''}]);
pass(run('state.tradeRejected===3'),'missing trade ID fails closed');
const extras=[];for(let i=0;i<45;i++)extras.push(trade('base-'+i,-75000+i*1300,70000+(i%3),.005+(i%4)*.001,'Buy',i+3));
feed(extras);
run('state.printPolicyCache=null');
const policy=run('adaptivePrintPolicy()');
pass(policy.n>=35&&policy.printMin>=100000&&policy.sequenceMin>=300000,'relative baseline and absolute floors');
pass(!policy.provisional,'adaptation uses sufficient history span');
pass(run('state.printPolicyCache!==null'),'flow P95 memoized to avoid per-trade sorting');
const grouped=[
 trade('big1',-13000,70000,2.2,'Buy',201),
 trade('big2',-9500,70003,2.2,'Buy',202),
 trade('big3',-6000,70005,2.2,'Buy',203),
 trade('isolate',-3000,70000,2.4,'Sell',204),
];
feed(grouped);
const res=run('evaluateTradeSequences()');
pass(res.grouped.some(g=>g.length===3),'three nearby same-side trades recognized as sequence');
pass(res.isolated.some(t=>t.id==='isolate'),'unrelated large sell stays isolated');
run('renderAdvancedWhales()');
pass(el('largeFlow').innerHTML.includes('RACHA')&&el('largeFlow').innerHTML.includes('Aislada'),'sequences and isolated prints displayed separately');
pass(el('largeFlowThreshold').textContent.includes('Umbral relativo'),'relative threshold is visible');
run('renderTrades()');
pass(el('flow90Detail').textContent.includes('90 s')&&el('flow5Detail').textContent.includes('5 min'),'separate 90 second and 5 minute windows');
pass(el('flowSessionDetail').textContent.includes('CVD desde abrir'),'session CVD is explicitly separate');
pass(el('flowDedupStatus').textContent.includes('IDs repetidos'),'dedup status visible in flow UI');
// Absorption uses same-window earliest/latest, independent of delivery order
sandbox.synthetic=[];
for(let i=0;i<18;i++)sandbox.synthetic.push({id:'abs'+i,ts:now-76000+i*4200,seq:i,price:70020-i*.25,usdt:42000,buy:i%9===0});
run('state.trades=synthetic;state.price=70016;state.lastPriceAt=Date.now();evaluateAbsorption()');
pass(el('absorptionStatus').textContent.includes('Posible absorción compradora'),'seller-dominated flow with small same-window price move');
pass(el('absorptionDetail').textContent.includes('mismos primeros y últimos trades'),'movement and flow evaluated over identical trade window');
// Counterexample: dominant seller flow and a large adverse price drop is not absorption.
sandbox.synthetic.forEach((t,i)=>t.price=71000-i*60);
run('state.trades=synthetic;evaluateAbsorption()');
pass(el('absorptionStatus').textContent==='Sin absorción destacable','large displacement invalidates absorption interpretation');
// Liquidations: exact fingerprint and Buy means liquidated LONG (not taker buy).
function liq(T,S,p,v){return {T,s:'BTCUSDT',S,p:String(p),v:String(v)}}
sandbox.liqMsg={data:[liq(now-16000,'Buy',70000,'0.5'),liq(now-16000,'Buy',70000,'0.5'),liq(now-125000,'Sell',70100,'0.4')]};
run('onLiquidation(liqMsg)');
pass(run('state.liq.length===2&&state.liqDuplicates===1'),'liquidation fingerprint filters exact replay');
sandbox.liqMsg={data:[liq(now-16000,'Buy','70000.00','0.50')]};run('onLiquidation(liqMsg)');
pass(run('state.liq.length===2&&state.liqDuplicates===2'),'liquidation fingerprint normalizes equivalent numeric representations');
pass(run('state.longLiq===35000&&state.shortLiq===70100*.4'),'Bybit liquidation position sides correctly mapped');
const w90=run('liquidationWindow(90000)'),w5=run('liquidationWindow(300000)');
pass(w90.count===1&&w5.count===2,'liquidation 90 second and 5 minute windows distinguish events');
pass(el('liq90Detail').textContent.includes('90 s')&&el('liq5Detail').textContent.includes('5 min'),'liquidation UI separates windows');
pass(el('liqDedupStatus').textContent.includes('sin ID único'),'liquidation dedup limitation disclosed');
sandbox.liqMsg={data:[liq(now-2000000,'Buy',70000,'0.5'),liq(now+20000,'Buy',70000,'0.5')]};
run('onLiquidation(liqMsg)');
pass(run('state.liqRejected===2'),'out-of-window and future liquidations excluded');
run('state.tradeIds.set("expired",Date.now()-500000);state.liqFingerprints.set("expired",Date.now()-500000);trimObservedFlows()');
pass(!run('state.tradeIds.has("expired")||state.liqFingerprints.has("expired")'),'obsolete id fingerprints pruned');
console.log('D_FOCAL_PASS',tests);
