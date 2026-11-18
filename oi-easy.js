/* BTC Intelligence: Open Interest explicado por periodos cerrados, sin señales automatizadas. */
(function(root){
'use strict';
const CONFIG=[
 {key:'15',interval:'15min',candle:'15',period:900000,label:'15 MINUTOS'},
 {key:'60',interval:'1h',candle:'60',period:3600000,label:'1 HORA'}
];
const byId=id=>root?.document?.getElementById(id);
const cache=new Map(),controllers=new Set();
let running=false,closed=false,lastAttempt=0;
function analyzePair(points,candles,period,now=Date.now()){
 if(!Array.isArray(points)||!Array.isArray(candles))return {ok:false,reason:'Sin historial comparable'};
 const o=points.map(x=>({ts:Number(x.timestamp),v:Number(x.openInterest)}))
  .filter(x=>Number.isFinite(x.ts)&&Number.isFinite(x.v)&&x.v>0).sort((a,b)=>a.ts-b.ts);
 if(o.length<2)return {ok:false,reason:'Faltan muestras de OI'};
 const priceCandles=new Map();
 for(const row of candles){
  if(!Array.isArray(row))continue;
  const [ts,op,hi,lo,cl]=row.map(Number);
  if([ts,op,hi,lo,cl].every(Number.isFinite)&&op>0&&cl>0&&hi>=Math.max(op,cl)&&lo<=Math.min(op,cl)&&ts+period<=now)
   priceCandles.set(ts,{op,cl});
 }
 for(let j=o.length-1;j>=1;j--){
  const cur=o[j],prev=o[j-1];
  if(cur.ts>now||now-cur.ts>Math.max(2*period,600000))continue;
  if(Math.abs(cur.ts-prev.ts-period)>1000)continue;
  const candle=priceCandles.get(prev.ts);
  if(!candle)continue;
  const oiPct=(cur.v/prev.v-1)*100,pricePct=(candle.cl/candle.op-1)*100;
  if(![oiPct,pricePct].every(Number.isFinite)||Math.abs(oiPct)>100||Math.abs(pricePct)>30)continue;
  return {ok:true,oiPct,pricePct,start:prev.ts,end:cur.ts,oiBTC:cur.v,receivedAt:now};
 }
 return {ok:false,reason:'Sin vela cerrada alineada con OI'};
}
function interpret(pair){
 if(!pair?.ok)return {headline:'SIN COMPARACIÓN',explain:'Esperando BTC y OI del mismo periodo cerrado.',tone:'neutral'};
 const {oiPct,pricePct}=pair;
 const oiMove=Math.abs(oiPct)>=.2,priceMove=Math.abs(pricePct)>=.2;
 if(!oiMove)return {headline:'PARTICIPACIÓN ESTABLE',explain:'Cambio de OI inferior al 0,20% (umbral orientativo). No indica dirección.',tone:'neutral'};
 if(!priceMove)return {headline:oiPct>0?'ENTRAN POSICIONES':'SE CIERRAN POSICIONES',
  explain:'El OI cambió, pero el precio apenas se movió.',tone:'neutral'};
 if(oiPct>0)return {headline:pricePct>0?'BTC SUBE + OI SUBE':'BTC BAJA + OI SUBE',
  explain:'Hay más contratos abiertos. No sabemos cuántos son LONG o SHORT.',tone:pricePct>0?'bull':'bear'};
 return {headline:pricePct>0?'BTC SUBE + OI BAJA':'BTC BAJA + OI BAJA',
  explain:'Se reducen contratos abiertos; podría haber cierre de posiciones.',tone:'neutral'};
}
function pct(value){return (value>0?'+':'')+value.toFixed(2)+'%'}
function numeric(id,value){
 const el=byId(id);if(el)el.textContent=value;
}
function render(){
 const panel=byId('vsOiExplain15');
 if(!panel||closed)return;
 const latest=cache.get('15'),hour=cache.get('60'),now=Date.now();
 const fresh=(x,period)=>x?.ok&&now-x.receivedAt<Math.max(3*60000,period*.5);
 const p15=fresh(latest,900000)?latest:null,p60=fresh(hour,3600000)?hour:null;
 for(const [key,p] of [['15',p15],['60',p60]]){
  const result=interpret(p);
  numeric('vsOiExplain'+key,result.headline);
  numeric('vsOiPercent'+key,p?pct(p.oiPct):'—');
  numeric('vsOiPrice'+key,p?pct(p.pricePct):'—');
  numeric('vsOiMeaning'+key,result.explain);
  const el=byId('vsOiExplain'+key);if(el)el.dataset.tone='neutral';
 }
 const primary=p60&&(!p15||(Math.abs(p15.oiPct)<.2&&Math.abs(p60.oiPct)>=.2))?p60:p15;
 const result=interpret(primary);
 numeric('vsOiJointTitle',primary?result.headline:'ESPERANDO DATOS');
 numeric('vsOiJointText',primary?result.explain:'Necesitamos datos de BTC y OI del mismo periodo cerrado.');
 const snapshot=root.topSnapshot?.(now)||{};
 const flow=snapshot.flow?.valid?snapshot.flow.value:'SIN DATOS';
 numeric('vsOiJointFlow',flow==='Equilibrado'?'EQUILIBRADA':flow==='SIN DATOS'?'SIN DATOS':flow.toUpperCase());
 numeric('vsOiJointFlowInfo',snapshot.flow?.valid?'Compras y ventas ejecutadas · últimos 5 min':'No hay muestra suficiente de operaciones recientes');
 numeric('vsOiJointStatus',primary?(primary===p60?'1h':'15m')+': misma vela cerrada · Bybit':'Sin comparación válida · Bybit');
 const noProof=byId('vsOiJointCaution');
 if(noProof)noProof.textContent='El flujo es de 5m y no coincide necesariamente con la vela OI. No es señal de entrada.';
}
async function fetchPair(c){
 const ctl=new AbortController();controllers.add(ctl);
 const timer=root.setTimeout(()=>ctl.abort(),9000);
 try{
  const read=async url=>{
   if(root.BTCMarketCache)return root.BTCMarketCache.get(url);
   const response=await fetch(url,{signal:ctl.signal,cache:'no-store'});
   if(!response.ok)throw Error('Fuente no disponible');
   return response.json();
  };
  const [oi,k]=await Promise.all([
   read('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime='+c.interval+'&limit=10'),
   read('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval='+c.candle+'&limit=10')
  ]);
  if(oi.retCode!==0||k.retCode!==0)throw Error('Datos incompletos');
  if(closed)return;
  cache.set(c.key,analyzePair(oi.result?.list,k.result?.list,c.period,Date.now()));
 }catch(e){if(!closed)cache.set(c.key,{ok:false,reason:'Dato no disponible'})}
 finally{root.clearTimeout(timer);controllers.delete(ctl)}
}
async function refresh(force=false){
 if(closed||running||root.document?.hidden||!byId('vsOiJointTitle'))return;
 const now=Date.now();
 if(now-lastAttempt<180000)return;
 lastAttempt=now;running=true;
 try{await Promise.all(CONFIG.map(fetchPair))}
 finally{running=false;if(!closed)render()}
}
function init(){
 if(!byId('vsOiJointTitle'))return;
 render();refresh();
 root.document.addEventListener('btc:viewchange',()=>{render();refresh()});
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden){render();refresh()}});
 root.setInterval(()=>{if(closed||root.document.hidden)return;render();refresh()},60000);
 root.addEventListener('pagehide',()=>{closed=true;for(const c of controllers)c.abort();controllers.clear()},{once:true});
}
if(typeof module==='object'&&module.exports)module.exports={analyzePair,interpret};
if(root?.document){
 root.BTCOIEasy={refresh,render};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init()
}
})(typeof window==='undefined'?null:window);
