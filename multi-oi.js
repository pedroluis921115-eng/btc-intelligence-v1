/* BTC Intelligence V5 · Open Interest BTCUSDT por exchange, sin claves ni procesos residentes. */
(function(root){
'use strict';
const sources=[
 {id:'binance',label:'Binance',url:'https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',parse:(a,now)=>{
  if(a?.symbol!=='BTCUSDT')throw Error('Símbolo distinto');
  return {btc:Number(a.openInterest),ts:Number(a.time),now};
 }},
 {id:'bybit',label:'Bybit',url:'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=1',parse:(a,now)=>{
  if(a?.retCode!==0||!Array.isArray(a.result?.list)||!a.result.list.length)throw Error('Respuesta incompleta');
  const row=a.result.list[0];
  return {btc:Number(row.openInterest),ts:Number(row.timestamp),now};
 }},
 {id:'okx',label:'OKX',url:'https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP',parse:(a,now)=>{
  if(a?.code!=='0'||!Array.isArray(a.data))throw Error('Respuesta incompleta');
  const row=a.data.find(x=>x.instId==='BTC-USDT-SWAP');
  if(!row)throw Error('Contrato no encontrado');
  return {btc:Number(row.oiCcy),ts:Number(row.ts),now};
 }}];
const entries=new Map(),bases=new Map(),controllers=new Set();
let running=false,lastPoll=0,closed=false;
function parseResponse(source,payload,now=Date.now()){
 let v;try{v=source.parse(payload,now)}catch{return {ok:false,reason:'Símbolo o respuesta inválidos'}}
 if(!Number.isFinite(v.btc)||v.btc<=0||v.btc>10000000||!Number.isFinite(v.ts)||
    v.ts<=0||v.ts>now+60000||now-v.ts>(source.id==='bybit'?450000:180000))
   return {ok:false,reason:'Sin dato BTC vigente'};
 return {ok:true,btc:v.btc,ts:v.ts};
}
function summary(values,now=Date.now()){
 const valid=sources.map(s=>values.get(s.id)).filter(v=>v?.ok&&now-v.receivedAt<=180000);
 const sum=valid.reduce((n,x)=>n+x.btc,0);
 return {count:valid.length,total:sum,canAggregate:valid.length===3,
  title:valid.length===3?'3 mercados BTC-USDT perpetuos':'Fuentes disponibles: '+valid.length+'/3'};
}
function display(){
 const n=Date.now();
 for(const src of sources){
  const item=entries.get(src.id),base=bases.get(src.id);
  const qty=root.document?.getElementById('vsOi'+src.id+'Value');
  const change=root.document?.getElementById('vsOi'+src.id+'Change');
  const stamp=root.document?.getElementById('vsOi'+src.id+'Stamp');
  if(!qty||!change||!stamp)continue;
  const fresh=!!item?.ok&&n-item.receivedAt<=180000;
  qty.textContent=fresh?Math.round(item.btc).toLocaleString('en-US')+' BTC':'—';
  change.textContent=fresh&&base>0?((item.btc/base-1)*100).toFixed(2)+'% desde abrir':'Sin variación disponible';
  stamp.textContent=fresh?'Actualizado '+new Date(item.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):
   item?.reason||'Esperando fuente';
  qty.classList.toggle('vs-unavailable',!fresh);
 }
 const s=summary(entries,n);
 const total=root.document?.getElementById('vsOiTotal');
 const hint=root.document?.getElementById('vsOiHint');
 if(total)total.textContent=s.canAggregate?Math.round(s.total).toLocaleString('en-US')+' BTC':'—';
 if(hint)hint.textContent=s.canAggregate?'Suma de 3 contratos BTC-USDT perpetuos. No es el OI mundial.':
  'Suma no disponible: faltan mercados o datos vigentes. '+s.count+'/3 fuentes.';
}
async function fetchSource(s){
 const ctl=new AbortController();controllers.add(ctl);
 const timer=root.setTimeout(()=>ctl.abort(),7500);
 try{
  const response=await fetch(s.url,{signal:ctl.signal,cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const payload=await response.json();
  const n=Date.now(),v=parseResponse(s,payload,n);
  if(closed)return;
  if(v.ok){
   entries.set(s.id,{...v,receivedAt:n});
   if(!bases.has(s.id))bases.set(s.id,v.btc);
  }else entries.set(s.id,{...v,receivedAt:n});
 }catch(e){if(!closed)entries.set(s.id,{ok:false,reason:'No disponible: '+(e.name==='AbortError'?'tiempo agotado':'fuente inaccesible'),receivedAt:Date.now()})}
 finally{root.clearTimeout(timer);controllers.delete(ctl)}
}
async function refresh(force=false){
 const panel=root.document?.getElementById('vsPaneLiquidity');
 if(closed||running||root.document?.hidden||!panel||panel.hidden)return;
 if(!force&&Date.now()-lastPoll<90000)return;
 running=true;
 try{await Promise.all(sources.map(fetchSource));lastPoll=Date.now()}
 finally{running=false;display()}
}
function init(){
 if(!root.document.getElementById('vsOiTotal'))return;
 display();
 root.document.addEventListener('btc:viewchange',e=>{if(e.detail?.view==='liquidity')refresh(true)});
 root.setInterval(()=>{if(!closed&&!root.document.hidden)refresh()},30000);
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)refresh()});
 root.addEventListener('pagehide',()=>{closed=true;for(const c of controllers)c.abort();controllers.clear()},{once:true});
 if(!root.document.getElementById('vsPaneLiquidity').hidden)refresh(true);
}
if(typeof module==='object'&&module.exports)module.exports={parseResponse,summary,sources};
if(root?.document){
 root.BTCMultiOI={refresh,display};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init()
}
})(typeof window==='undefined'?null:window);
