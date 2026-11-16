/* BTC Intelligence V3 - radar contextual, descriptivo, SOLO LECTURA. */
(function(root){
'use strict';
const frames=[{minutes:240,label:'4H'},{minutes:60,label:'1H'},
 {minutes:15,label:'15M'},{minutes:5,label:'5M'}];
const results=new Map();
const controllers=new Set();
let loading=false,lastLoaded=0,ended=false;
function classifyCandles(raw,minutes,now=Date.now()){
 const ms=minutes*60000;
 if(!Array.isArray(raw))return {ok:false,reason:'Sin datos'};
 const unique=new Map();
 for(const r of raw){
  if(!Array.isArray(r))continue;
  const ts=Number(r[0]),open=Number(r[1]),high=Number(r[2]),low=Number(r[3]),close=Number(r[4]);
  if(![ts,open,high,low,close].every(Number.isFinite)||ts<=0||low<=0||high<low||open<low||open>high||close<low||close>high)continue;
  if(ts+ms>now||ts+ms<=0)continue;
  unique.set(ts,{ts,open,high,low,close});
 }
 const rows=[...unique.values()].sort((a,b)=>a.ts-b.ts).slice(-24);
 if(rows.length<16)return {ok:false,reason:'Menos de 16 velas cerradas válidas'};
 const last=rows[rows.length-1],age=now-(last.ts+ms);
 if(age<0||age>Math.max(2*ms,600000))return {ok:false,reason:'Velas cerradas desactualizadas'};
 for(let i=rows.length-16+1;i<rows.length;i++){
  if(rows[i].ts-rows[i-1].ts!==ms)return {ok:false,reason:'Hay huecos en el histórico'};
 }
 const a=rows.slice(-16,-8),b=rows.slice(-8);
 const h=x=>Math.max(...x.map(v=>v.high)),l=x=>Math.min(...x.map(v=>v.low));
 const tolerance=.0005;
 let direction='Mixto / rango';
 if(h(b)>h(a)*(1+tolerance)&&l(b)>l(a)*(1+tolerance))direction='Alcista';
 else if(h(b)<h(a)*(1-tolerance)&&l(b)<l(a)*(1-tolerance))direction='Bajista';
 const prev=rows.slice(-4,-1),breakHigh=Math.max(...prev.map(x=>x.high)),breakLow=Math.min(...prev.map(x=>x.low));
 const recentBreak=last.close>breakHigh?'Ruptura superior 3 velas':
                   last.close<breakLow?'Ruptura inferior 3 velas':'Sin ruptura 3 velas';
 return {ok:true,direction,high:h(rows.slice(-20)),low:l(rows.slice(-20)),
  latestClose:last.close,closedAt:last.ts+ms,ageMs:age,
  recentBreak,source:'',method:'Comparación de máximos/mínimos de dos bloques de 8 velas; no es una predicción'};
}
function buildSummary(byFrame,price,priceAt,now=Date.now()){
 const get=m=>byFrame.get(m);
 const four=get(240),hour=get(60),m15=get(15),m5=get(5);
 const valid=frames.filter(x=>get(x.minutes)?.ok).length;
 if(valid<4)return {status:'Datos incompletos',detail:'Se requieren velas cerradas recientes y continuas en 4H, 1H, 15M y 5M.',
  setup:'Sin evaluar entrada hasta disponer de las cuatro temporalidades.',zones:'Zonas de estructura no disponibles.',count:valid};
 let status='Contexto mixto / esperar';
 if(four.direction===hour.direction&&['Alcista','Bajista'].includes(hour.direction))
  status='Sesgo '+hour.direction.toLowerCase()+' 4H / 1H';
 else if(['Alcista','Bajista'].includes(four.direction)&&['Alcista','Bajista'].includes(hour.direction))
  status='Contradicción 4H / 1H';
 const setup=(m15.direction===hour.direction?'15M coincide con 1H. ':m15.direction==='Mixto / rango'?'15M sin dirección clara. ':'15M contradice 1H; posible retroceso, no confirmado. ')+
  '5M: '+m5.recentBreak.toLowerCase()+'. Es un evento de precio, no una señal de ejecución.';
 let zones='Máx/mín 1H últimas 20 velas: US$'+hour.high.toFixed(2)+' / US$'+hour.low.toFixed(2);
 if(Number.isFinite(price)&&price>0&&now-priceAt<20000){
  const upper=[hour.high,m15.high].filter(x=>x>price).sort((a,b)=>a-b)[0],
        lower=[hour.low,m15.low].filter(x=>x<price).sort((a,b)=>b-a)[0];
  zones='Referencia superior: '+(upper?'US$'+upper.toFixed(2)+' ('+(100*(upper/price-1)).toFixed(2)+'%)':'sin máximo por encima cercano')+
   ' · inferior: '+(lower?'US$'+lower.toFixed(2)+' ('+(100*(price-lower)/price).toFixed(2)+'%)':'sin mínimo por debajo cercano')+
   '. Máximos/mínimos 1H/15M de 20 velas cerradas; NO son órdenes ni liquidaciones.';
 }
 return {status,detail:'Lectura descriptiva, sin ventaja estadística demostrada ni probabilidad LONG/SHORT.',setup,zones,count:valid};
}
function nowText(ms){return new Date(ms).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}
function render(){
 if(!root?.document)return;
 const get=id=>root.document.getElementById(id);
 const now=Date.now();
 for(const f of frames){
  const x=results.get(f.minutes);
  const el=get('manualTF'+f.minutes),meta=get('manualMeta'+f.minutes);
  if(el)el.textContent=x?.ok?x.direction:(x?'Sin datos':'Esperando...');
  if(meta)meta.textContent=x?.ok?(x.source+' · cierre '+nowText(x.closedAt)):(x?.reason||'Recibiendo velas');
 }
 const current=typeof state==='undefined'?{}:state;
 const summary=buildSummary(results,current.price,current.lastPriceAt,now);
 if(get('manualContext'))get('manualContext').textContent=summary.status;
 if(get('manualContextDetails'))get('manualContextDetails').textContent=summary.detail;
 if(get('manualZones'))get('manualZones').textContent=summary.zones;
 if(get('manualSetup'))get('manualSetup').textContent=summary.setup;
 if(get('manualDataStatus'))get('manualDataStatus').textContent=summary.count+'/4 temporalidades válidas · actualizadas '+(lastLoaded?nowText(lastLoaded):'pendiente');
 if(get('manualFlow')){
  const snap=typeof topSnapshot==='function'?topSnapshot(now):null;
  get('manualFlow').textContent=snap?.flow?.valid?snap.flow.value+' · '+snap.flow.detail:'Flujo 5M: esperando muestra válida de operaciones Bybit';
 }
}
async function requestJSON(url,signal){
 const r=await fetch(url,{cache:'no-store',signal});
 if(!r.ok)throw new Error('HTTP '+r.status);
 return r.json();
}
async function fetchFrame(frame){
 const minutes=frame.minutes,ctl=new AbortController();
 controllers.add(ctl);
 const timer=setTimeout(()=>ctl.abort(),8000);
 try{
  const a=await requestJSON('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval='+minutes+'&limit=40',ctl.signal);
  if(a.retCode===0&&Array.isArray(a.result?.list)&&a.result.list.length)
   return {rows:a.result.list,source:'Bybit'};
 }catch(e){}
 finally{clearTimeout(timer);controllers.delete(ctl)}
 const c2=new AbortController();controllers.add(c2);
 const timer2=setTimeout(()=>c2.abort(),8000);
 try{
  const tf=minutes===240?'4h':minutes===60?'1h':minutes+'m';
  const a=await requestJSON('https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval='+tf+'&limit=40',c2.signal);
  if(Array.isArray(a)&&a.length)return {rows:a,source:'Binance'};
 }catch(e){}
 finally{clearTimeout(timer2);controllers.delete(c2)}
 return null;
}
async function refresh(){
 if(ended||loading||root?.document?.hidden)return;
 loading=true;
 try{
  const incoming=await Promise.all(frames.map(fetchFrame));
  if(ended)return;
  const now=Date.now();
  for(let i=0;i<frames.length;i++){
   const frame=frames[i],payload=incoming[i];
   const value=payload?classifyCandles(payload.rows,frame.minutes,now):{ok:false,reason:'Bybit/Binance no disponibles'};
   if(value.ok)value.source=payload.source;
   results.set(frame.minutes,value);
  }
  lastLoaded=now;
 }finally{loading=false;render()}
}
function shutdown(){
 ended=true;
 for(const c of controllers)c.abort();
 controllers.clear();
 // La ventana que se cierra no debe dejar conexiones de mercado de esta sesión.
 if(typeof state!=='undefined'){
  for(const key of ['ws','liqws','binanceWs']){
   try{const ws=state[key];if(ws&&ws.readyState<2)ws.close(1000,'Cierre de BTC Intelligence');}catch{}
  }
  if(state.pingTimer)clearInterval(state.pingTimer);
  if(state.binanceReconn)clearTimeout(state.binanceReconn);
 }
}
function init(){
 if(!root?.document?.getElementById('manualRadar'))return;
 render();refresh();
 root.setInterval(()=>{if(!ended&&!root.document.hidden&&Date.now()-lastLoaded>=90000)refresh()},30000);
 root.setInterval(()=>{if(!ended&&!root.document.hidden)render()},15000);
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden&&!ended)refresh()});
 root.addEventListener('pagehide',shutdown,{once:true});
}
if(typeof module==='object'&&module.exports)module.exports={classifyCandles,buildSummary};
if(root&&root.document){
 root.BTCManualRadar={refresh,shutdown};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init()
}
})(typeof window==='undefined'?null:window);
