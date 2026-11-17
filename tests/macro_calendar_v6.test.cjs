'use strict';
const assert=require('node:assert/strict');
const {classifyEvent,selectEvents,nextCritical,eventState}=require('../macro-calendar.js');
let n=0;const ok=(label,fn)=>{fn();console.log('PASS',++n,label)};
const now=Date.UTC(2026,10,17,18);
const raw=(name,date,source='bls')=>({eventName:name,importance:'high',source,scheduledAt:date,unit:null,actual:null,forecast:null,previous:null});
const dataset=(items,updatedAt=new Date(now-3600000).toISOString())=>({data:items,updatedAt});
ok('CPI critical',()=>assert.equal(classifyEvent(raw('CPI (Consumer Price Index)',new Date(now+DAY()).toISOString())).tier,'CRÍTICO'));
function DAY(){return 86400000}
ok('Nonfarm payroll critical',()=>assert.equal(classifyEvent(raw('Nonfarm Payrolls (Employment Situation)',new Date(now+DAY()).toISOString())).title,'EMPLEO · NFP'));
ok('FOMC decision critical',()=>assert.equal(classifyEvent(raw('FOMC Rate Decision',new Date(now+DAY()).toISOString(),'fed')).title,'DECISIÓN FED · TIPOS'));
ok('PCE critical',()=>assert.equal(classifyEvent(raw('Personal Income and Outlays (PCE)',new Date(now+DAY()).toISOString(),'bea')).tier,'CRÍTICO'));
ok('Red impact jobless claims ignored as routine',()=>assert.equal(classifyEvent(raw('Initial Jobless Claims',new Date(now+DAY()).toISOString(),'dol')),null));
ok('Red impact low value housing ignored',()=>assert.equal(classifyEvent(raw('New Home Sales',new Date(now+DAY()).toISOString(),'census')),null));
ok('GDP second estimate intentionally excluded',()=>assert.equal(classifyEvent(raw('GDP (Second Estimate)',new Date(now+DAY()).toISOString(),'bea')),null));
ok('No low or medium events leak',()=>assert.equal(classifyEvent({...raw('CPI',new Date(now+DAY()).toISOString()),importance:'low'}),null));
ok('Window 7 day includes only 7 day, not day 9',()=>{
 const r=selectEvents(dataset([raw('CPI',new Date(now+2*DAY()).toISOString()),raw('FOMC Rate Decision',new Date(now+9*DAY()).toISOString(),'fed')]),now,7);
 assert.equal(r.ok,true);assert.equal(r.events.length,1);
});
ok('Window 14 days includes both and sorted by time',()=>{
 const r=selectEvents(dataset([raw('FOMC Rate Decision',new Date(now+9*DAY()).toISOString(),'fed'),raw('CPI',new Date(now+2*DAY()).toISOString())]),now,14);
 assert.equal(r.events.length,2);assert.ok(r.events[0].title.includes('IPC'));
});
ok('One source event duplicated does not duplicate the UI',()=>{
 const x=raw('CPI',new Date(now+DAY()).toISOString());
 assert.equal(selectEvents(dataset([x,x]),now,7).events.length,1);
});
ok('Stale data is rejected rather than silently shown',()=>{
 const r=selectEvents(dataset([raw('CPI',new Date(now+DAY()).toISOString())],new Date(now-5*DAY()).toISOString()),now,7);
 assert.equal(r.ok,false);
});
ok('Missing updated timestamp is rejected',()=>assert.equal(selectEvents({data:[],updatedAt:null},now).ok,false));
ok('No fake forecasts: record only actual and previous',()=>{
 const e=classifyEvent({...raw('CPI',new Date(now-DAY()/48).toISOString()),actual:'2.5',previous:'2.7',unit:'% y/y',forecast:'2.6'});
 assert.equal(e.actual,'2.5');assert.equal(e.previous,'2.7');assert.equal(e.forecast,undefined);
});
ok('Urgent within 15 minutes',()=>{
 const e=classifyEvent(raw('CPI',new Date(now+8*60000).toISOString()));
 assert.equal(eventState(e,now).urgent,true);
});
ok('Show next important release when no events this week',()=>{
 const r=nextCritical(dataset([raw('Personal Income and Outlays (PCE)',new Date(now+9*DAY()).toISOString(),'bea')]),now);
 assert.equal(r.length,1);assert.match(r[0].title,/PCE/);
});
console.log('MACRO_CALENDAR_LOGIC_PASS',n);
