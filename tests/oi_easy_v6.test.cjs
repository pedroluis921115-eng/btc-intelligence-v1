'use strict';
const assert=require('node:assert/strict');
const {analyzePair,interpret}=require('../oi-easy.js');
let k=0;function test(name,cb){cb();console.log('PASS',++k,name)}
const now=Date.parse('2026-11-17T22:17:00Z'),p=900000;
const oi=[{timestamp:String(now-2*60000),openInterest:'100.5'},{timestamp:String(now-17*60000),openInterest:'100'},{timestamp:String(now-32*60000),openInterest:'98'}];
const candles=[[String(now-17*60000),'90000','90900','89980','90500','1'],[String(now-2*60000),'90500','90700','90300','90600','1']];
test('15-minute OI and price are compared on same closed candle',()=>{
 const r=analyzePair(oi,candles,p,now);
 assert.equal(r.ok,true);assert.ok(Math.abs(r.oiPct-.5)<.001);
 assert.ok(Math.abs(r.pricePct-(90500/90000-1)*100)<.001);
});
test('reject ongoing active candle if no closed one corresponds',()=>{
 const r=analyzePair(oi,[[String(now-2*60000),'90500','90700','90300','90600']],p,now);
 assert.equal(r.ok,false);
});
test('reject stale samples',()=>{
 const stale=oi.map(x=>({...x,timestamp:String(Number(x.timestamp)-7200000)}));
 assert.equal(analyzePair(stale,candles,p,now).ok,false);
});
test('reject inconsistent OI intervals',()=>{
 const broken=oi.map((x,i)=>({...x,timestamp:String(Number(x.timestamp)+i*1000)}));
 assert.equal(analyzePair(broken,candles,p,now).ok,false);
});
test('OI up while price down does not assert short dominance',()=>{
 const interpretation=interpret({ok:true,oiPct:.8,pricePct:-.5});
 assert.match(interpretation.headline,/BTC BAJA \+ OI SUBE/);
 assert.match(interpretation.explain,/No sabemos cuántos son LONG o SHORT/);
});
test('OI down while BTC up no guaranteed short covering',()=>{
 const interpretation=interpret({ok:true,oiPct:-.9,pricePct:.6});
 assert.match(interpretation.explain,/podría/);
});
test('Small OI movement has neutral classification',()=>assert.match(interpret({ok:true,oiPct:.05,pricePct:1.8}).headline,/ESTABLE/));
test('Missing data cannot make a trade prediction',()=>assert.match(interpret({ok:false}).headline,/SIN COMPARACIÓN/));
console.log('OI_EASY_UNIT_PASS',k);
