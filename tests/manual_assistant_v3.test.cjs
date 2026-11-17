'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const {planTrade,simulatePartial}=require('../planner.js');
const {classifyCandles,buildSummary}=require('../radar.js');
let checks=0;
function test(name,fn){fn();console.log('PASS '+(++checks)+' '+name)}
const buy={side:'LONG',entry:90000,stop:89750,target:90800,capital:1000,riskPercent:1,leverage:5,feeBps:5.5,slippageBps:2};
test('LONG calculated risk obeys budget after fees and slippage',()=>{
 const p=planTrade(buy);assert.equal(p.ok,true);assert.ok(p.risk<=10.0000001);assert.ok(p.quantity>0);assert.ok(p.profit>0);assert.ok(p.rr>0);
});
test('SHORT loss and target sides validated',()=>{
 const p=planTrade({...buy,side:'SHORT',stop:90250,target:89200});
 assert.equal(p.ok,true);assert.ok(p.risk<=10.0000001);assert.ok(p.profit>0);
 assert.equal(planTrade({...buy,side:'SHORT'}).ok,false);
});
test('Invalid stop and target rejected',()=>{
 assert.equal(planTrade({...buy,stop:90100}).ok,false);
 assert.equal(planTrade({...buy,target:89900}).ok,false);
});
test('Bad risk, fees, leverage rejected',()=>{
 assert.equal(planTrade({...buy,riskPercent:12}).ok,false);
 assert.equal(planTrade({...buy,feeBps:-1}).ok,false);
 assert.equal(planTrade({...buy,leverage:25}).ok,false);
});
test('Position is capped by available margin',()=>{
 const p=planTrade({...buy,stop:89999,riskPercent:10,leverage:1,capital:100});
 assert.equal(p.ok,true);assert.equal(p.riskLimitedByMargin,true);assert.ok(p.margin<=100.000001);
});
test('Partial and new stop reconcile with remaining exposure',()=>{
 const p=planTrade(buy),r=simulatePartial(p,{close:90400,fractionPercent:50,newStop:90000});
 assert.equal(r.ok,true);assert.ok(Math.abs(r.partialQuantity+r.remainingQuantity-p.quantity)<1e-8);
 assert.ok(Math.abs(r.realized+r.remainingIfStop-r.combinedIfStop)<1e-8);
});
test('Invalid partial stop rejected',()=>{
 const p=planTrade(buy);
 assert.equal(simulatePartial(p,{close:90400,fractionPercent:50,newStop:90500}).ok,false);
});
function bars(minutes,trend,now){
 const ms=minutes*60000,start=Math.floor(now/ms)*ms-40*ms;
 return Array.from({length:40},(_,i)=>{
  const open=90000+i*trend,close=open+trend*.8,high=Math.max(open,close)+1,low=Math.min(open,close)-1;
  return [start+i*ms,String(open),String(high),String(low),String(close)]
 });
}
const now=Date.UTC(2026,10,16,18,59,33);
test('Closed candles identify higher high and higher low',()=>{
 const x=classifyCandles(bars(5,20,now),5,now);assert.equal(x.ok,true);assert.equal(x.direction,'Alcista');
 assert.equal(x.recentBreak,'Ruptura superior 3 velas');
});
test('Closed candles identify lower high and lower low',()=>{
 const x=classifyCandles(bars(15,-20,now),15,now);assert.equal(x.ok,true);assert.equal(x.direction,'Bajista');
 assert.equal(x.recentBreak,'Ruptura inferior 3 velas');
});
test('Future/open candles never used',()=>{
 const rows=bars(5,20,now);rows.push([now+60000,'1','2','0.5','1.5']);
 const x=classifyCandles(rows,5,now);assert.equal(x.ok,true);assert.ok(x.closedAt<=now);
});
test('Data gaps trigger insufficient-data status',()=>{
 const rows=bars(5,20,now);rows.splice(35,1);
 assert.equal(classifyCandles(rows,5,now).ok,false);
});
test('Stale data triggers insufficient-data status',()=>{
 assert.equal(classifyCandles(bars(5,20,now-3600000),5,now).ok,false);
});
test('Incomplete mixed temporalities refuse directional analysis',()=>{
 const map=new Map([[240,classifyCandles(bars(240,20,now),240,now)]]);
 const r=buildSummary(map,90000,now,now);assert.equal(r.count,1);assert.equal(r.status,'Datos incompletos');
});
test('Four valid temporalities return descriptive context',()=>{
 const map=new Map([240,60,15,5].map(m=>[m,classifyCandles(bars(m,20,now),m,now)]));
 const r=buildSummary(map,91000,now,now);assert.equal(r.count,4);
 assert.match(r.status,/Sesgo alcista/);assert.match(r.detail,/sin ventaja/);
});
test('HTML, scripts, cache are wired without removing original maps',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 for(const id of ['manualRadar','manualRiskCalculate','manualPartialCalculate','modelNearestAbove','liquidityHeat','topSnapshot']){
  assert.ok(html.includes('id="'+id+'"'),'missing '+id);
 }
 for(const asset of ['radar.js','planner.js','manual-assistant.css']){
  assert.ok(html.includes(asset+'?v=v6-macro-20261117'));
  assert.ok(sw.includes("'./"+asset+"'"));
 }
 assert.ok(html.indexOf('app.js?v=')<html.indexOf('radar.js?v='));
});
console.log('MANUAL_ASSISTANT_TESTS_PASS',checks);
