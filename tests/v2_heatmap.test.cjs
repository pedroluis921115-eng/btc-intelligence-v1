'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const calls=[],ctx=new Proxy({
 createLinearGradient:()=>({addColorStop(){}}),
 createRadialGradient:()=>({addColorStop(){}}),
 fillRect(...args){calls.push({kind:'fill',args})},
 fillText(...args){calls.push({kind:'text',args})},
 setTransform(...args){calls.push({kind:'transform',args})},
 scale(){calls.push({kind:'scale'})},
 setLineDash(){},
},{get:(o,k)=>o[k]??(()=>{})});
const els=new Map();function el(id){if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',className:'',width:0,height:0,parentElement:{getBoundingClientRect:()=>({width:390,height:270})},getContext:()=>ctx});return els.get(id)}
const sandbox={document:{getElementById:el,hidden:false},window:{devicePixelRatio:2},console,Date,Math,Intl,devicePixelRatio:2,setInterval,clearInterval,setTimeout,clearTimeout};
vm.createContext(sandbox);vm.runInContext(src.replace(/init\(\);\s*$/,''),sandbox);
const run=x=>vm.runInContext(x,sandbox);let n=0;function check(bool,description){assert.ok(bool,description);console.log('PASS',description);n++}
const now=Date.now();
run("state.wsOk=true;state.price=67000;state.lastBookAt=Date.now();state.lastPriceAt=Date.now()");
const density=new Map();for(let i=-120;i<=120;i++){density.set(String(67000+i*2),String(.3+Math.abs(i)*.001))}
sandbox.density=density;
run('state.bids=density;state.asks=density');
const compressed=run('compressHeatSide(state.bids,67000)');
check(compressed.length<=160,'compact maximum 160 buckets per side');
check(compressed.length<density.size,'compression reduces raw 241 price levels');
check(compressed.every(([p,v])=>p>0&&v>0),'no invalid compact levels');
const reference=now;
sandbox.sampleTimes=[reference-10000,reference-5000,reference];
sandbox.samplePrices=[70000,68500,67000];
sandbox.sampleValues=[
 {ts:reference-10000,price:70000,bids:[[70000,120000]],asks:[[70040,200000]]},
 {ts:reference-5000,price:68500,bids:[[68500,140000]],asks:[[68540,210000]]},
 {ts:reference,price:67000,bids:[[67000,160000]],asks:[[67040,300000]]}
];
const g=run('heatGeometry(sampleValues,67000)');
check(g.min<67000&&g.max>70000,'adaptive range contains historical BTC drift');
check(g.priceRow(70000)!==g.priceRow(67000),'historical prices retain distinct rows');
check(g.priceRow(70000)>=0&&g.priceRow(67000)<34,'both endpoints visible in heat');
check(run('heatIntensity(10000,1000000)')<run('heatIntensity(1000000,1000000)'),'intensity monotonic');
check(run('heatIntensity(1000000000,1000000)')<=.95,'outlier opacity cap');
check(run('heatIntensity(0,1000000)')===0,'zero liquidity transparent');
run('state.heatSamples=sampleValues;state.lastHeatAt=Date.now();drawLiquidityHeat()');
check(calls.some(c=>c.kind==='text'&&String(c.args[0]).includes(':')),'real time labels');
check(el('liquidityHeatStamp').textContent.includes('precios absolutos'),'descriptive scale label');
check(el('liquidityHeatStamp').textContent.includes('intensidad logarítmica'),'intensity legend label');
check(calls.some(c=>c.kind==='transform')&&!calls.some(c=>c.kind==='scale'),'canvas uses nonaccumulating transform');
const canvas=el('liquidityHeat'),w=canvas.width;
calls.length=0;run('drawLiquidityHeat()');
check(canvas.width===w,'no redundant canvas resize while dimensions unchanged');
run('state.heatSamples=[{ts:Date.now()-200000,price:69000,bids:[[69000,200000]],asks:[]},{ts:Date.now()-5000,price:67000,bids:[[67000,150000]],asks:[]}];state.lastHeatAt=Date.now();drawLiquidityHeat()');
check(el('liquidityHeatStamp').textContent.includes('hueco(s)'),'missing intervals explicitly disclosed');
run('state.heatSamples=[{ts:Date.now()-500000,price:69000,bids:[[69000,100000]],asks:[]},{ts:Date.now()-5000,price:67000,bids:[[67000,100000]],asks:[]}];drawLiquidityHeat()');
check(run('state.heatSamples.length===1'),'old observations pruned from 6-minute window');
run('state.heatSamples=[];state.lastBookAt=Date.now();state.lastPriceAt=Date.now();state.price=67000;state.wsOk=true;state.heatSamples=[]');
run('captureLiquidityHeat()');
check(run('state.heatSamples.length===1'),'one captured snapshot');
check(run('state.heatSamples[0].bids.length<=160'),'capture retains bounded samples');
const count=run('state.heatSamples.length');run('document.hidden=true;captureLiquidityHeat();drawLiquidityHeat()');
check(run('state.heatSamples.length')===count,'hidden mode stops snapshot capture');
run('document.hidden=false;state.wsOk=false;captureLiquidityHeat()');
check(run('state.heatSamples.length')===count,'disconnected mode never fabricates samples');
console.log('B_HEATMAP_PASS',n);
