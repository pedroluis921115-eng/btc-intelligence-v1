'use strict';
const assert=require('node:assert/strict');
const {classifyEvent,selectEvents,eventState}=require('../macro-calendar.js');
const {cleanEvent,selectCompanyEvents,companyStatus,localDay}=require('../corporate-calendar.js');
const seed=require('../data/corporate-calendar.json');
const actualNow=Date.now();
let count=0;function test(name,fn){fn();count++;console.log('PASS',count,name)}
const nvidia=seed.events.find(x=>x.symbol==='NVDA');
const event=cleanEvent(nvidia);
test('NVIDIA earnings is in curated feed',()=>{
 assert.ok(event);assert.equal(event.name,'NVIDIA');assert.equal(event.official,true);
 assert.equal(event.scheduled,Date.parse('2026-11-17T21:20:00Z'));
 assert.equal(event.followupTime,Date.parse('2026-11-17T22:00:00Z'));
});
test('Verified NVIDIA source official',()=>assert.ok(nvidia.sourceUrl.startsWith('https://investor.nvidia.com/')));
test('Time is treated as EST/EDT conversion not guessed by Nasdaq',()=>{
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false});
 assert.equal(fmt.format(event.scheduled),'18:20');assert.equal(fmt.format(event.followupTime),'19:00');
});
test('Nasdaq date-only must not create exact release time',()=>{
 const row=cleanEvent({id:'nasdaq-AMD-2026-11-17',symbol:'AMD',name:'AMD',date:'2026-11-17',
  exactTime:null,session:'after',tier:'IMPORTANTE',officialConfirmed:false,sourceUrl:'https://www.nasdaq.com/market-activity/earnings'});
 assert.equal(row.official,false);assert.equal(row.scheduled,null);
 assert.match(companyStatus(row).label,/SIN CONFIRMAR/);
});
test('Nasdaq before/after date cannot fabricate countdown',()=>{
 const row=cleanEvent({id:'nasdaq-AMD-2026-11-17',symbol:'AMD',name:'AMD',date:'2026-11-17',
  exactTime:null,session:'after',tier:'IMPORTANTE',officialConfirmed:false,sourceUrl:'https://www.nasdaq.com/market-activity/earnings'});
 assert.match(companyStatus(row).label,/HORA SIN CONFIRMAR/);assert.equal(companyStatus(row).urgent,false);
});
test('Unknown or unsafe corporate sources are rejected',()=>{
 assert.equal(cleanEvent({...nvidia,sourceUrl:'javascript:alert(1)'}),null);
 assert.equal(cleanEvent({...nvidia,symbol:'UNKNOWN'}),null);
});
test('Fresh corporate feed selects NVIDIA today',()=>{
 const r=selectCompanyEvents(seed,actualNow,7);
 assert.equal(r.ok,true);
 assert.ok(r.events.find(x=>x.symbol==='NVDA'&&x.official));
});
test('Company calendar stale rejected rather than claiming no upcoming events',()=>{
 const r=selectCompanyEvents({...seed,generatedAt:new Date(actualNow-3*86400000).toISOString()},actualNow,7);
 assert.equal(r.ok,false);
});
test('No duplicates or beyond 7 days',()=>{
 const feed={generatedAt:new Date(actualNow).toISOString(),events:[nvidia,nvidia,{...nvidia,id:'other',date:'2026-12-01'}]};
 const r=selectCompanyEvents(feed,actualNow,7);
 assert.ok(r.ok);assert.equal(r.events.length,1);
});
test('Retail sales from today remains visible after 2h',()=>{
 const est=Date.parse('2026-11-17T13:30:00Z');
 const now=Date.parse('2026-11-17T20:10:00Z');
 const feed={updatedAt:new Date(now-60000).toISOString(),data:[{
  source:'census',eventName:'Retail Sales (Advance)',importance:'high',scheduledAt:new Date(est).toISOString(),
  actual:'0.2',previous:'0.8'}]};
 const r=selectEvents(feed,now,7);
 assert.equal(r.events.length,1);
 assert.equal(eventState(r.events[0],now).label,'PUBLICADO');
});
test('Industrial production marked med may be shown as context',()=>{
 const row={source:'fed',eventName:'Industrial Production (G.17)',importance:'med',scheduledAt:'2026-11-17T14:15:00Z'};
 assert.equal(classifyEvent(row).title,'PRODUCCIÓN INDUSTRIAL');
});
test('FOMC minutes marked medium included as significant',()=>{
 const row={source:'fed',eventName:'FOMC Minutes',importance:'med',scheduledAt:'2026-11-18T19:00:00Z'};
 assert.equal(classifyEvent(row).title,'ACTAS DE LA FED');
});
test('No arbitrary medium CPI or weekly jobless promotions',()=>{
 assert.equal(classifyEvent({source:'bls',eventName:'CPI',importance:'med',scheduledAt:'2026-11-18T13:30:00Z'}),null);
 assert.equal(classifyEvent({source:'dol',eventName:'Initial Jobless Claims',importance:'high',scheduledAt:'2026-11-19T13:30:00Z'}),null);
});
test('Unconfirmed past event does not falsely become published',()=>{
 const now=Date.parse('2026-11-17T20:30:00Z');
 const row=classifyEvent({source:'census',eventName:'Retail Sales (Advance)',importance:'high',scheduledAt:'2026-11-17T13:30:00Z'});
 assert.match(eventState(row,now).label,/SIN VALOR CONFIRMADO/);
});
test('Full macro API must not pre-filter medium relevant releases',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','macro-calendar.js'),'utf8');
 assert.ok(source.includes("const API='https://xoomar.com/api/markets/calendar';"));
 assert.ok(!source.includes('calendar?importance=high'));
});
console.log('EVENTS_CRITICAL_REGRESSIONS_PASS',count);
