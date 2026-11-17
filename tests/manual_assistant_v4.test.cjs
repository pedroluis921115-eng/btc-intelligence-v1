'use strict';
const assert=require('node:assert/strict');
const {evaluateContext,shouldNotify,describeOrderBook}=require('../decision-assistant.js');
const {validateRecord,metrics,appendUnique}=require('../manual-journal.js');
let passes=0;const pass=(name,fn)=>{fn();passes++;console.log('PASS',passes,name)};
const now=Date.now();
const aligned={
 240:{ok:true,closedAt:now-3600000,direction:'Alcista'},
 60:{ok:true,closedAt:now-1200000,direction:'Alcista',low:89800,high:90600},
 15:{ok:true,closedAt:now-600000,direction:'Alcista',low:89900,high:90100},
 5:{ok:true,closedAt:now-300000,direction:'Alcista',recentBreak:'Ruptura superior 3 velas'}
};
const market={price:90000,priceAt:now-2000,flow:{valid:true,side:'LONG',label:'Compras 71%'}};
pass('aligned context + closed break + flow + near structure produce descriptive confluence',()=>{
 const r=evaluateContext(aligned,market,now);
 assert.equal(r.ready,true);assert.equal(r.side,'LONG');assert.equal(r.score,5);
 assert.match(r.status,/CONFLUENCIA DESCRIPTIVA/);assert.ok(r.alertKey.includes('LONG:'));
});
pass('negative flow refuses confluence',()=>{
 const r=evaluateContext(aligned,{...market,flow:{valid:true,side:'SHORT',label:'Ventas 65%'}},now);
 assert.equal(r.ready,false);assert.equal(r.score,4);
});
pass('missing flow refuses confluence',()=>{
 assert.equal(evaluateContext(aligned,{...market,flow:{valid:false}},now).ready,false);
});
pass('opposing 15M refuses confluence',()=>{
 const x={...aligned,15:{...aligned[15],direction:'Bajista'}};
 assert.equal(evaluateContext(x,market,now).ready,false);
});
pass('5M needs closed matching break',()=>{
 const x={...aligned,5:{...aligned[5],recentBreak:'Sin ruptura 3 velas'}};
 assert.equal(evaluateContext(x,market,now).ready,false);
});
pass('no nearby structural anchor refuses confluence',()=>{
 const x={...aligned,60:{...aligned[60],low:80000},15:{...aligned[15],low:82000}};
 assert.equal(evaluateContext(x,market,now).ready,false);
});
pass('4H/1H contrary refuses side',()=>{
 const x={...aligned,240:{...aligned[240],direction:'Bajista'}};
 const r=evaluateContext(x,market,now);
 assert.equal(r.side,null);assert.equal(r.ready,false);
});
pass('stale frame/price refuse directional evaluation',()=>{
 const x={...aligned,5:{...aligned[5],closedAt:now-3600000}};
 assert.equal(evaluateContext(x,market,now).status,'DATOS INCOMPLETOS');
 assert.equal(evaluateContext(aligned,{...market,priceAt:now-61000},now).status,'DATOS INCOMPLETOS');
});
pass('no duplicated alert and at least 15m cooldown per side',()=>{
 const r=evaluateContext(aligned,market,now);
 const history=new Map();assert.equal(shouldNotify(r,history,now),true);
 history.set('LONG',{at:now,key:r.alertKey});
 assert.equal(shouldNotify(r,history,now+200000),false);
 const altered={...r,alertKey:r.alertKey+'-next'};
 assert.equal(shouldNotify(altered,history,now+200000),false);
 assert.equal(shouldNotify(altered,history,now+901000),true);
});
const trade={id:'btc_abcde123456',ts:now-10000,kind:'PAPER',side:'LONG',setup:'Retroceso',
 origin:'Análisis propio',entry:90000,exit:90200,qty:0.01,fees:0.45,note:'ok'};
pass('paper journal calculates net profit, not gross',()=>{
 const result=validateRecord(trade);assert.equal(result.ok,true);
 assert.ok(Math.abs(result.record.net-1.55)<1e-9);
});
pass('real short loss calculated correctly',()=>{
 const result=validateRecord({...trade,kind:'REAL',side:'SHORT',exit:90200});
 assert.equal(result.ok,true);assert.ok(Math.abs(result.record.net-(-2.45))<1e-9);
});
pass('invalid journal data rejected, no NaN or infinite values',()=>{
 for(const t of [
 {...trade,entry:0},{...trade,exit:NaN},{...trade,qty:Infinity},
 {...trade,kind:'TEST'},{...trade,fees:-2},{...trade,ts:'nan'},
 {...trade,id:'bad'},{...trade,setup:'malicioso'}
 ])assert.equal(validateRecord(t).ok,false);
});
pass('manual entries deduplicated on import without trusting precomputed PnL',()=>{
 const input=[{...trade,net:999999},{...trade,net:-5},
  {...trade,id:'btc_987654321aaa',kind:'REAL',side:'SHORT',exit:90100}];
 const result=appendUnique([],input);
 assert.equal(result.records.length,2);assert.equal(result.rejected.length,0);
 assert.ok(result.records[0].net<1000);
});
pass('analytics separates PAPER and REAL',()=>{
 const data=appendUnique([],[trade,{...trade,id:'btc_987654321aaa',kind:'REAL',side:'SHORT',exit:90100}]).records;
 const p=metrics(data,'PAPER'),r=metrics(data,'REAL');
 assert.equal(p.count,1);assert.equal(r.count,1);assert.ok(p.total>0);assert.ok(r.total<0);
 assert.equal(p.maxDrawdown,0);assert.ok(r.maxDrawdown>0);
});
pass('L2 source requires fresh book and never invents levels',()=>{
 const book={wsOk:true,price:90000,lastBookAt:now-1000,bids:new Map([['89900','3'],['86000','40']]),asks:new Map([['90100','4']])};
 const value=describeOrderBook(book,now);assert.match(value,/Bybit L2/);assert.match(value,/89,900/);assert.match(value,/90,100/);
 assert.match(describeOrderBook({...book,lastBookAt:now-16000},now),/sin datos recientes/);
});
console.log('MANUAL_V4_LOGIC_PASS',passes);
