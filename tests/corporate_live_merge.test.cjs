'use strict';const assert=require('node:assert/strict');
const x=require('../corporate-calendar.js'),official=require('../data/corporate-calendar.json');
const now=Date.parse('2026-11-17T21:14:00Z');
const external={updatedAt:'2026-11-17T16:00:00Z',data:[{ticker:'NVDA',date:'2026-11-18',status:'estimated'},
{ticker:'AMD',date:'2026-11-19',status:'estimated'},{ticker:'AAPL',date:'2026-11-20',status:'estimated'}]};
let m=x.mergeCompanyFeeds(official,external,now);
assert.ok(m.ok);assert.equal(m.feed.events.filter(e=>e.symbol==='NVDA').length,1);
assert.equal(m.feed.events.find(e=>e.symbol==='NVDA').date,'2026-11-17');
assert.equal(m.feed.events.find(e=>e.symbol==='AMD').official,false);
assert.equal(m.feed.events.find(e=>e.symbol==='AMD').scheduled,null);
assert.ok(x.selectCompanyEvents(m.feed,now).events.length===3);
assert.equal(x.normalizeEarningsFeed({...external,updatedAt:'2026-11-10T00:00:00Z'},now).ok,false);
m=x.mergeCompanyFeeds(official,{...external,updatedAt:'2026-11-10T00:00:00Z'},now);
assert.equal(m.feed.events.length,1);
console.log('CORPORATE_LIVE_MERGE_PASS official priority, estimated labels, stale prevention');
