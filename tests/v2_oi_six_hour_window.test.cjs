'use strict';
// Targeted regression: 5m selection must not erase valid earlier OI increases.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const el=new Map();
const canvas=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(obj,key)=>obj[key]||(()=>{})});
function getEl(id){
 if(!el.has(id))el.set(id,{textContent:'',parentElement:{getBoundingClientRect:()=>({width:390,height:420})},getContext:()=>canvas});
 return el.get(id)
}
const sandbox={document:{getElementById:getEl,hidden:false},window:{devicePixelRatio:1},console,Date,Math,Intl,devicePixelRatio:1,setInterval,clearInterval,setTimeout,clearTimeout};
vm.createContext(sandbox);
vm.runInContext(source.replace(/init\(\);\s*$/,''),sandbox);
const period=300000,latest=Math.floor(Date.now()/period)*period,start=latest-4*period;
sandbox.history=[
 {ts:start,v:100},{ts:start+period,v:150},{ts:start+2*period,v:130},{ts:start+3*period,v:110},{ts:start+4*period,v:105}
];
sandbox.candles=[
 [String(start),'63000','63300','62900','63100'],
 [String(start+period),'63100','63300','62800','62950'],
 [String(start+2*period),'62950','63000','62500','62700'],
 [String(start+3*period),'62700','63000','62500','62900']
];
vm.runInContext("state.price=63000;state.wsOk=true;state.lastPriceAt=Date.now();state.tf='5';state.oiHistory=history;state.fiveCandles=candles;state.lastHistoryAt=Date.now();model()",sandbox);
assert.equal(vm.runInContext('state.model.length>0',sandbox),true,'6h model should use an earlier valid OI increase even when latest interval declines');
assert.notEqual(getEl('modelNearestAbove').textContent,'—');
assert.notEqual(getEl('modelNearestBelow').textContent,'—');
assert.match(getEl('mapnote').textContent,/últimas 6h/);
vm.runInContext("state.oiHistory=[{ts:history[0].ts,v:150},{ts:history[1].ts,v:140},{ts:history[2].ts,v:130},{ts:history[3].ts,v:120},{ts:history[4].ts,v:110}];model()",sandbox);
assert.equal(vm.runInContext('state.model.length',sandbox),0,'all-negative OI deltas must not fabricate zones');
console.log('OI_SIX_HOUR_WINDOW_PASS');
