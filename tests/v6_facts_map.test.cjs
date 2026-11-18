'use strict';
const assert=require('node:assert/strict');
const {prepareChart,chooseMajor}=require('../liquidation-visual.js');
const {pickImportant}=require('../market-insights.js');
const now=Date.UTC(2026,10,17,20,20,5);
let passed=0;
function check(name,fn){fn();console.log('PASS',++passed,name)}
const candles=Array.from({length:72},(_,i)=>{
 const ts=Math.floor(now/300000)*300000-(72-i)*300000;
 const open=90000+40*Math.sin(i/5),close=open+(i%2?18:-14);
 return [String(ts),String(open),String(Math.max(open,close)+30),String(Math.min(open,close)-30),String(close)];
});
const zones=[{level:91000,weight:100,side:'short'},{level:91900,weight:80,side:'short'},
 {level:89100,weight:90,side:'long'},{level:88200,weight:75,side:'long'},
 {level:90600,weight:999,side:'long'}, // side WRONG, must drop
 {level:89500,weight:999,side:'short'} // side WRONG, must drop
];
check('Chart needs real price',()=>{
 const r=prepareChart(NaN,candles,zones,now);
 assert.equal(r.ok,false);
});
check('Chart needs at least 18 closed candles',()=>assert.equal(prepareChart(90000,candles.slice(0,10),zones,now).ok,false));
check('Chart refuses stale candles',()=>assert.equal(prepareChart(90000,candles.map(x=>[Number(x[0])-3600000,...x.slice(1)]),zones,now).ok,false));
check('Actual closed candles can be plotted with corresponding model bands',()=>{
 const r=prepareChart(90000,candles,zones,now,4);
 assert.equal(r.ok,true);assert.equal(r.candles.length,71);
 assert.equal(r.above.length,2);assert.equal(r.below.length,2);
 assert.equal(chooseMajor(r.above).level,91000);
 assert.equal(chooseMajor(r.below).level,89100);
});
check('Wrong-side scenario never rendered',()=>{
 const r=prepareChart(90000,candles,zones,now,4);
 assert.ok(!r.zones.some(x=>x.weight===999));
});
check('Reject out-of-range bands on 4 percent zoom',()=>{
 const r=prepareChart(90000,candles,[...zones,{level:101000,weight:999,side:'short'}],now,4);
 assert.ok(r.zones.every(x=>x.level<93601&&x.level>86400));
});
check('Do not fabricate historical model motion',()=>{
 const r=prepareChart(90000,candles,zones,now,4);
 assert.ok(r.zones.every(x=>x.level&&x.weight&&x.side));
 assert.ok(r.candles[0].ts>=candles[0][0]*1);
});
check('Facts do not produce a scenario without fresh BTC price',()=>{
 const r=pickImportant({price:90000,priceAt:now-40000},now);
 assert.equal(r[0].kind,'missing');
});
check('Important facts never repeat routine OI and cap at 2 cards',()=>{
 const frames={240:{ok:true,direction:'Alcista'},60:{ok:true,direction:'Bajista'}};
 const r=pickImportant({price:90000,priceAt:now-2000,frames,model:zones,modelAt:now-50000,
  flow:{valid:true,buyPct:20},oi:{valid:true,oiPct:.6,pricePct:-.3},
  funding:{valid:true,value:'+0.0020%'},confluence:{ready:true,side:'LONG'}},now);
 assert.ok(r.length<=2);assert.ok(!r.some(x=>x.title.includes('divergen')));assert.ok(r.some(x=>x.kind==='flow'));
 assert.ok(!r.some(x=>x.detail.includes('garantiza')));
});
check('No highlight from stale model',()=>{
 const r=pickImportant({price:90000,priceAt:now-1000,model:[{level:90100,weight:100,side:'short'}],modelAt:now-1000000},now);
 assert.equal(r.length,1);assert.equal(r[0].kind,'neutral');
});
check('Flow is explicitly not a forecast',()=>{
 const r=pickImportant({price:90000,priceAt:now-1000,flow:{valid:true,buyPct:72}},now);
 assert.equal(r[0].kind,'flow');assert.match(r[0].detail,/no predice/);
});
check('Routine funding is not elevated into high-impact event',()=>{
 const r=pickImportant({price:90000,priceAt:now-1000,funding:{valid:true,value:'-0.0008%'}},now);
 assert.equal(r[0].kind,'neutral');
});
console.log('V6_FACTS_AND_MAP_PASS',passed);
