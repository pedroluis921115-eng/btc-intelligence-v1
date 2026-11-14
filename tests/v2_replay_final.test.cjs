'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'app.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','public_stream_fixture.json'),'utf8'));
const els=new Map(),context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
function element(id){if(!els.has(id))els.set(id,{id,textContent:'',innerHTML:'',className:'',value:'',classList:{toggle(){}},
 closest:()=>({open:false}),parentElement:{getBoundingClientRect:()=>({width:390,height:260})},getContext:()=>context});
 return els.get(id)}
const later=[];const sockets=[];
class FakeWS{
 constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this)}
 send(txt){this.sent.push(txt)}
 open(){this.readyState=1;this.onopen?.()}
 receive(msg){this.onmessage?.({data:JSON.stringify(msg)})}
 close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.()}
}
let time=Number(fixture.capturedAt);
const D=class extends Date {static now(){return time}};
const sandbox={Date:D,document:{getElementById:element,hidden:false},window:{devicePixelRatio:1},console,Math,Intl,
 devicePixelRatio:1,WebSocket:FakeWS,setTimeout:(fn,ms)=>{const t={fn,ms,active:true};later.push(t);return t},
 clearTimeout:id=>{if(id)id.active=false},setInterval:()=>42,clearInterval:()=>{},requestAnimationFrame:fn=>fn(),
 navigator:{serviceWorker:null},localStorage:{getItem:()=>null,setItem:()=>{}}
};
vm.createContext(sandbox);vm.runInContext(src.replace(/init\(\);\s*$/,''),sandbox);
const run=q=>vm.runInContext(q,sandbox);let count=0;
function ok(value,name){assert.ok(value,name);count++;console.log('PASS',name)}
function tick(ms){time+=ms}
function live(name){return run('sourceFreshness()').find(x=>x.name===name)}
function reconnectTimer(){const job=later.find(x=>x.active&&x.ms>=3000);assert.ok(job,'reconnection timer present');job.active=false;job.fn()}
run('state.sessionStart=Date.now()-200000');
run('connectBybit();connectBinance()');
ok(sockets.length===2&&sockets[0].readyState===0&&sockets[1].readyState===0,'two separate public WebSocket transports');
sockets.forEach(x=>x.open());
ok(run('state.wsOk&&state.liqOk'),'Bybit opened and liquidations subscribed');
ok(live('Liquidaciones ejecutadas').status==='SUSCRITO SIN EVENTOS','zero liquidation messages do not become invented observations');
// Replay real public packets from captured fixture, without any extra network call.
const bybit=sockets[0],binance=sockets[1];
bybit.receive(fixture.bybitSnapshot);
bybit.receive(fixture.bybitDelta);
bybit.receive(fixture.trade);
binance.receive(fixture.binance);
ok(run('state.bids.size>0&&state.asks.size>0'),'recorded Bybit book snapshots replayed');
ok(run('state.trades.length>=1&&state.tradeIds.size>=1'),'real public trade IDs received');
ok(run('state.binanceBids.length>=2&&state.binanceAsks.length>=2'),'recorded Binance top-20 depth replayed');
ok(live('Precio BTCUSDT').valid&&live('Libro y mapa de calor').valid,'price and book independently fresh');
ok(live('Libro comparativo').valid,'Binance independently fresh');
ok(!live('Liquidaciones ejecutadas').valid,'subscription without liquidations is not a liquidation observation');
const originalCount=run('state.trades.length'),originalCvd=run('state.sessionCvd');
bybit.receive(fixture.trade);
ok(run('state.trades.length')===originalCount&&run('state.sessionCvd')===originalCvd,'replayed duplicate trades do not inflate CVD');
run('state.lastBookAt=Date.now()-40000');
ok(live('Precio BTCUSDT').valid&&!live('Libro y mapa de calor').valid,'trade can be fresh while Bybit book stale');
run('state.lastBookAt=Date.now()');
tick(16000);run('state.lastPriceAt=Date.now()-500');
run('monitorStreams()');
ok(bybit.readyState===3,'silent open Bybit book triggers forced close');
ok(!run('state.wsOk')&&run('state.price')===0&&run('state.lastBookAt')===0,'reconnection invalidates price and book immediately');
ok(run('state.sessionCvd')===0&&run('state.trades.length')===0&&run('state.liq.length')===0,'gap resets incomplete session flow and liquidations');
ok(live('Precio BTCUSDT').status==='SIN CONEXIÓN'&&live('Libro y mapa de calor').status==='SIN CONEXIÓN','disconnected streams never pass freshness check');
ok(!run('topSnapshot().price.valid'),'top summary cannot show old disconnected price');
const before=sockets.length;
run('connectBybit()');
ok(sockets.length===before+1,'manual reconnection opens only one replacement socket');
run('connectBybit()');
ok(sockets.length===before+1,'duplicate connect attempt does not spawn second socket');
const bybit2=sockets.at(-1);bybit2.open();
ok(run('state.wsOk')===true,'new socket subscribed');
run('state.sessionStart=Date.now()-1000');
const replay={...fixture.trade,data:fixture.trade.data.map((x,i)=>({...x,i:'new-session-'+i,T:time-500,seq:i+1}))};
bybit2.receive(fixture.bybitSnapshot);
bybit2.receive(replay);
ok(run('state.price>0&&state.trades.length>=1'),'replay new-session trade restarts live data');
ok(live('Precio BTCUSDT').valid&&live('Libro y mapa de calor').valid,'new snapshot and trade restore freshness');
const old=run('state.sessionCvd');
bybit.receive(replay);
ok(run('state.sessionCvd')===old,'old socket callback cannot corrupt new session');
// Isolated Binance stale should not force Bybit offline.
tick(15000);
run('state.lastPriceAt=Date.now()-500;state.lastBookAt=Date.now()-500');
run('monitorStreams()');
ok(binance.readyState===3,'silent open Binance stream triggers separate restart');
ok(run('state.wsOk')===true,'Binance disconnect does not disconnect Bybit');
ok(live('Libro comparativo').status==='SIN CONEXIÓN','Binance stale not classified as fresh');
// No expensive offscreen drawing; samples are still captured when panel is closed.
run('state.lastBookAt=Date.now();state.lastPriceAt=Date.now();state.wsOk=true');
const dataCount=run('state.bids.size');
run('draw();drawLiquidityHeat();drawOiSeries();renderBook();renderTrades();renderLiq();renderMarketSummary()');
ok(run('state.hiddenDrawSkipped')>=3&&run('state.hiddenComputeSkipped')>=3,'closed panels skip unnecessary canvas and DOM work');
ok(run('state.bids.size')===dataCount,'folding does not delete orderbook information');
run('captureLiquidityHeat()');
ok(run('state.heatSamples.length')>=1,'heatmap retains samples while its drawing is folded');
// Resume from background without phantom recency.
sandbox.document.hidden=true;
const beforeSkip=run('state.hiddenDrawSkipped');
run('monitorStreams();safeVisibleCall(()=>{throw Error("should not run")});drawLiquidityHeat()');
ok(run('state.hiddenDrawSkipped')>beforeSkip,'background draw skipped without running new fetches');
sandbox.document.hidden=false;
run('state.wsOk=false;state.lastPriceAt=0;state.lastBookAt=0');
ok(!live('Precio BTCUSDT').valid,'background resurrection does not invent live price');
run('renderRuntimeHealth()');
ok(element('runtimeHealth').textContent.includes('interrupciones no reconstruidas'),'visible diagnostics distinguish gaps and stream types');
console.log('FINAL_ADVERSARIAL_PASS',count,'PUBLIC_FIXTURE',fixture.kind);
