'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'app.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','public_stream_fixture.json'),'utf8'));
const elements=new Map(),ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
const el=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',className:'',classList:{toggle(){}},
 closest:()=>({open:false}),parentElement:{getBoundingClientRect:()=>({width:390,height:240})},
 getContext:()=>ctx,getBoundingClientRect:()=>({width:390,height:240})});return elements.get(id)};
let now=Number(fixture.capturedAt);
const Clock=class extends Date{static now(){return now}};
const mocks=[];
class FakeWS{
 constructor(url){this.url=url;this.readyState=0;this.sent=[];mocks.push(this)}
 send(t){this.sent.push(t)}open(){this.readyState=1;this.onopen?.()}
 receive(o){this.onmessage?.({data:JSON.stringify(o)})}
 close(){this.readyState=3;this.onclose?.()}
}
const doc={getElementById:el,hidden:false};
const sandbox={document:doc,window:{devicePixelRatio:1},Date:Clock,console,Math,Intl,WebSocket:FakeWS,
 devicePixelRatio:1,setTimeout:()=>99,clearTimeout:()=>{},setInterval:()=>100,clearInterval:()=>{}};
vm.createContext(sandbox);vm.runInContext(src.replace(/init\(\);\s*$/,''),sandbox);
const run=q=>vm.runInContext(q,sandbox);let n=0;
function ok(value,title){assert.ok(value,title);n++;console.log('PASS',title)}
const text=id=>el(id).textContent;
run('state.sessionStart=Date.now()-200000;connectBybit();connectBinance()');mocks.forEach(x=>x.open());
ok(text('bybitStatus').includes('esperando operaciones y libro'),'no false live label before data');
ok(text('liqStatus').includes('sin liquidaciones observadas'),'subscribe does not invent liquidation');
ok(text('connection')==='CONECTANDO...','header requires real data');
const ws=mocks[0],other=mocks[1];
ws.receive(fixture.trade);
ok(text('connection')==='DATOS PARCIALES','trade without book is partial, not live');
ok(text('bybitStatus').includes('esperando libro'),'partial state identifies missing book');
ws.receive(fixture.bybitSnapshot);
ok(text('connection')==='EN VIVO','price and book both current');
ok(text('bybitStatus')==='Operaciones y libro vigentes','source row updated after book data');
ok(text('liqStatus').includes('sin liquidaciones observadas'),'trades do not count as liquidations');
const liquid={topic:'allLiquidation.BTCUSDT',data:[{s:'BTCUSDT',S:'Buy',p:'65400',v:'0.5',T:now-500}]};
ws.receive(liquid);
ok(text('liqStatus').includes('Última liquidación recibida'),'liquidation label updated on actual event');
now+=300001;run('state.lastBookAt=Date.now()-1000;state.lastPriceAt=Date.now()-1000;refreshConnectionLabels()');
ok(text('liqStatus').includes('Sin eventos recientes'),'old liquidation not advertised as current');
now+=10;run('state.lastBookAt=0;refreshConnectionLabels()');
ok(text('connection')==='DATOS PARCIALES','stale Bybit book not counted as healthy');
ws.close();
ok(text('connection')==='SIN CONEXIÓN'&&text('price')==='—','disconnect clears primary header and last price');
// old alert remains historic after reconnect without being misread as new
const t=now;
sandbox.oldAlerts=[
{text:'MURO VENDEDOR antiguo',groupKey:'hist-1',priority:{rank:3,name:'ALTA',reason:'Importe'},source:'Bybit L2',count:1,lastImportantAt:t-1200000},
{text:'Compras nuevas',groupKey:'fresh-2',priority:{rank:2,name:'MEDIA',reason:'Volumen'},source:'Bybit publicTrade',count:1,lastImportantAt:t-5000}
];
run('state.sessionStart=Date.now()-120000;state.alerts=oldAlerts;renderAlerts(Date.now(),true)');
ok(el('alerts').innerHTML.includes('HISTÓRICA · hace 20 min'),'stale alert explicitly tagged');
ok(el('alerts').innerHTML.indexOf('Compras nuevas')<el('alerts').innerHTML.indexOf('MURO VENDEDOR antiguo'),'recent alert ahead of historical high alert');
ok(el('alerts').innerHTML.includes('ALTA')&&el('alerts').innerHTML.includes('MEDIA'),'no event information lost');
now+=660000;run('renderAlerts(Date.now(),true)');
ok(el('alerts').innerHTML.includes('HISTÓRICA · hace 11 min'),'age label changes across time');
// test comparable levels lacking synchronized samples are not labelled as positive observations
run('state.ws={readyState:1};state.wsOk=true;state.binanceWs={readyState:1};state.bids=new Map([["69993","5"],["69990","1"]]);state.asks=new Map([["70007","5"],["70010","1"]]);state.binanceBids=[{p:70063,q:5},{p:70060,q:1}];state.binanceAsks=[{p:70077,q:5},{p:70080,q:1}];state.lastBookAt=Date.now()-100;state.binanceLastAt=Date.now()-110;resetComparisonPersistence();state.compareSampleBybit=state.lastBookAt;state.compareSampleBinance=state.binanceLastAt;renderExchangeComparison()');
ok(text('compareCoincidence').includes('PENDIENTE DE MUESTRA SINCRONIZADA'),'zero sampled matches explicitly pending');
ok(!text('compareCoincidence').includes('(0 muestras'),'zero samples not presented as observed comparison');
now+=5000;run('state.lastBookAt=Date.now()-100;state.binanceLastAt=Date.now()-120;renderExchangeComparison()');
ok(text('compareCoincidence').includes('EN OBSERVACIÓN')&&text('compareCoincidence').includes('1 muestra de ambos'),'paired book changes count as one real sample');
console.log('LABELS_ANDROID_PASS',n);
