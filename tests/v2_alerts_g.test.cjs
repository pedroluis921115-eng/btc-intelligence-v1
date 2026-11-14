'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const els=new Map(),ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
function el(id){if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',className:'',value:'',parentElement:{getBoundingClientRect:()=>({width:390,height:240})},getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:240})});return els.get(id)}
const sandbox={document:{getElementById:el,hidden:false},window:{devicePixelRatio:1},console,Math,Intl,devicePixelRatio:1,setTimeout,clearTimeout,setInterval,clearInterval};
sandbox.clock=Date.now();
sandbox.Date=class extends Date {static now(){return sandbox.clock}};
vm.createContext(sandbox);vm.runInContext(src.replace(/init\(\);\s*$/,''),sandbox);
const run=s=>vm.runInContext(s,sandbox);let n=0;
const check=(ok,msg)=>{assert.ok(ok,msg);n++;console.log('PASS',msg)};
function advance(ms=1000){sandbox.clock+=ms;}
function alert(text,key,meta={},limit=60000){sandbox.caseAlert={text,key,meta,limit};return run('alertUser(caseAlert.text,caseAlert.key,caseAlert.limit,caseAlert.meta)')}
const p=(kind,amount,base,more={})=>{sandbox.caseP={kind,amount,baseline:base,...more};return run('alertPriority(caseP,caseP.amount)')};
check(p('whale',100000,100000).rank===1,'normal print is informational');
check(p('whale',200000,100000).rank===2,'medium print relative to configured baseline');
check(p('whale',600000,100000).rank===3,'high print by 4x relative magnitude');
check(p('wall-drop',300000,150000).rank===2,'wall reduction has independent priority');
check(p('wall-arrive',800000,250000).rank===3,'large visible wall has high priority');
check(p('absorption',900000,500000,{share:.73}).rank===2,'adequately sampled pressure is medium');
check(p('absorption',1600000,500000,{share:.84}).rank===3,'large strong pressure is high');
check(p('zone',10000000,1).rank===1,'hypothetical OI zones never high priority');
check(!run('alertPriority({kind:"zone",amount:100,baseline:1},100).reason.includes("beneficio")'),'priority makes no trading claim');
function whale(id,price,side='Buy',amount=110000){
 return alert('Operación grande '+amount,'whale-'+id,{kind:'whale',side,price,amount,baseline:100000,eventId:id,source:'Bybit publicTrade'});
}
check(whale('a1',70000),'first observed trade produces alert');
const group=run('state.alertGroups.get("whale:Buy:70000")');
check(group?.count===1&&group.total===110000,'initial whale count and notional');
advance(120);
check(!whale('a1',70000),'repeated ID never re-counted');
check(run('state.alertGroups.get("whale:Buy:70000").total===110000'),'ID replay does not inflate notional');
check(whale('a2',70003),'additional materially larger cluster becomes visible when rank increases');
check(run('state.alertGroups.get("whale:Buy:70000").count===2'),'same-side nearby prints grouped');
check(run('state.alerts.filter(x=>x.groupKey.startsWith("whale:Buy")).length===1'),'one UI row for related trades');
check(!whale('a3',70001),'small same-group addition updates total without a new alert');
check(whale('a4',70002),'group turns high priority as aggregate grows');
check(run('state.alertGroups.get("whale:Buy:70000").record.priority.rank===3'),'aggregate priority escalation recorded');
check(el('alerts').innerHTML.includes('4 operaciones'),'UI shows grouped count');
check(el('alerts').innerHTML.includes('$440,000'),'UI shows accurate total notional');
check(el('alertsSummary').textContent.includes('aumentos materiales'),'material escalation count visible');
const gBefore=run('state.alertGroups.size');
check(whale('a5',70000,'Sell'),'opposite aggressor direction is a distinct event');
check(run('state.alertGroups.size===2'),'Buy and Sell do not silently merge');
check(whale('a6',70200),'materially different price is a distinct group');
check(run('state.alertGroups.size===3'),'far prices do not merge');
for(let i=0;i<25;i++){advance(90);whale('flood-'+i,70000,'Buy',100000)}
check(run('state.alertGroups.get("whale:Buy:70000").count===29'),'all new IDs accounted without losing notional');
check(run('state.alerts.filter(x=>x.groupKey==="whale:Buy:70000").length===1'),'25-trade burst remains one notification row');
check(run('state.alertGrouped>0'),'normal grouped updates recorded without cards');
check(run('state.alerts.length<=24'),'bounded alert record list');
advance(31000);
check(whale('new-after-expiry',70000),'new interval is independently visible');
check(run('state.alertGroups.get("whale:Buy:70000").count===1'),'stale group not reused across 30s window');
// independent walls, no global 120s blackout
check(alert('MURO 1','wall-arrive-bid:70000',{kind:'wall-arrive',side:'bid',price:70000,amount:300000,baseline:250000,eventId:'B:70000',source:'Bybit L2'},600000),'new wall #1');
advance(100);
check(alert('MURO 2','wall-arrive-bid:70020',{kind:'wall-arrive',side:'bid',price:70020,amount:320000,baseline:250000,eventId:'B:70020',source:'Bybit L2'},600000),'new distinct nearby wall is never muted');
check(run('state.alerts.some(x=>x.groupKey==="wall-arrive-bid:70020")'),'second wall visible immediately');
advance(100);
check(!alert('MURO 2','wall-arrive-bid:70020',{kind:'wall-arrive',side:'bid',price:70020,amount:320000,baseline:250000,eventId:'B:70020',source:'Bybit L2'},600000),'same unchanged wall does not repeat');
check(alert('MURO 2 ampliado','wall-arrive-bid:70020',{kind:'wall-arrive',side:'bid',price:70020,amount:900000,baseline:250000,eventId:'B:70020',source:'Bybit L2'},600000),'materially enlarged same-level wall overrides silence');
check(run('state.alertGroups.get("wall-arrive-bid:70020").record.priority.rank===3'),'increased wall severity promoted');
// wall drops with different prices even within legacy global silence
run('state.price=70050;state.wsOk=true;state.bids.clear();state.asks.clear();state.wallPolicy=null');
run('recordWallDrop("bid",70000,7.2,.3,30000,Date.now())');
run('recordWallDrop("bid",70020,7.2,.3,30000,Date.now())');
check(run('state.wallDrops.length===2'),'distinct wall losses retained without 90-second global suppression');
check(run('state.alerts.some(x=>x.groupKey==="wall-drop-bid-70000")&&state.alerts.some(x=>x.groupKey==="wall-drop-bid-70020")'),'both distinct wall-drop alerts are shown');
run('recordWallDrop("bid",70000,7.2,.3,30000,Date.now())');
check(run('state.wallDrops.length===2'),'exact wall loss replay is locally suppressed');
// sequences: same sequence snapshot updated, not double added
check(alert('Racha 3','large-flow-buy',{kind:'sequence',side:'Buy',price:70000,amount:400000,baseline:300000,eventId:'first-seq',source:'Bybit'},300000),'new sequence visible');
check(!alert('Racha 3','large-flow-buy',{kind:'sequence',side:'Buy',price:70000,amount:400000,baseline:300000,eventId:'first-seq',source:'Bybit'},300000),'same sequence repeated poll does not count twice');
check(alert('Racha 7','large-flow-buy',{kind:'sequence',side:'Buy',price:70000,amount:1300000,baseline:300000,eventId:'first-seq',source:'Bybit'},300000),'expanded material sequence triggers priority update');
check(run('state.alertGroups.get("sequence:Buy:70000").total===1300000'),'sequence increments snapshot difference only');
check(alert('Racha distinta','large-flow-buy',{kind:'sequence',side:'Buy',price:70000,amount:350000,baseline:300000,eventId:'second-seq',source:'Bybit'},300000),'independent new sequence not lost');
check(run('state.alertGroups.get("sequence:Buy:70000").count===2&&state.alertGroups.get("sequence:Buy:70000").total===1650000'),'two distinct sequences accounted');
// escape all UI text
alert('<img src=x onerror=evil()>','xss',{kind:'generic',eventId:'xss1',source:'<script>evil</script>'});
check(!el('alerts').innerHTML.includes('<img')&&!el('alerts').innerHTML.includes('<script>'),'alert text and attribution HTML escaped');
check(el('alerts').innerHTML.includes('&lt;img'),'safe escaped alert text retained');
for(let i=0;i<35;i++){advance(20);alert('Info '+i,'extra-'+i,{kind:'zone',eventId:'z'+i,amount:1,source:'modelo'})}
check(run('state.alerts.length<=24'),'bounded history under many unrelated events');
check(el('alerts').innerHTML.includes('Info 34'),'latest independent alert remains visible even with many high-priority older alerts');
check(el('alerts').innerHTML.includes('ALTA'),'important older alert remains in prioritised display');
for(let i=0;i<350;i++){advance(1);alert('Extra '+i,'unique-'+i,{kind:'generic',eventId:'unique'+i,source:'test'})}
check(run('state.alertGroups.size<=220'),'alert group map bounded');
check(run('state.alerts.length<=24'),'alert record memory bounded');
// Actual trade ingestion routes distinct trade IDs through the low-noise alert scheduler.
run('state.trades=[];state.tradeIds.clear();state.sessionStart=Date.now()-60000;state.threshold=10000;state.printPolicyCache=null;state.lastTradeRenderAt=Date.now();state.lastBreakCheckAt=Date.now();state.lastModelAt=Date.now()');
sandbox.batch=[];
for(let i=0;i<20;i++)sandbox.batch.push({i:'live-trade-'+i,T:sandbox.clock-1000,p:'70100',v:'2',S:'Buy',s:'BTCUSDT',seq:i});
run('onTrade({data:batch})');
check(run('state.tradeIds.size===20'),'live ingestion accepts 20 unique Bybit trade IDs');
check(run('state.alertGroups.get("whale:Buy:70105")?.count===20')||
      run('state.alertGroups.get("whale:Buy:70100")?.count===20'),'live ingestion merges related executed trades into one group');
const beforeDup=run('state.alertReceived');
run('onTrade({data:batch})');
check(run('state.tradeDuplicates>=20')&&run('state.alertReceived')===beforeDup,'onTrade replay cannot inflate alerts');
// Reset continuity without erasing historical alert feed.
const retained=run('state.alerts.length');
run('resetLiveAlertGrouping()');
check(![...run('state.alertGroups.keys()')].some(k=>k.startsWith('whale:')),'websocket reset clears grouping continuity');
check(run('state.alerts.length')===retained,'reconnect retains old alerts as history');
run('state.wallDropCooldown.set("B:test",{ts:Date.now()-200000,lost:100000});cleanupWallHistory()');
check(!run('state.wallDropCooldown.has("B:test")'),'expired wall-loss cooldown pruned');

console.log('G_ALERT_UNIT_PASS',n);
