/* BTC Intelligence V4 — checklist de confluencias, sin recomendaciones automáticas. */
(function(root){
'use strict';
const frameNames={240:'4H',60:'1H',15:'15M',5:'5M'};
function validFrame(f,m,now){
 return !!f?.ok&&Number.isFinite(f.closedAt)&&f.closedAt<=now&&
  now-f.closedAt<=m*60000+Math.min(600000,m*60000)&&
  ['Alcista','Bajista','Mixto / rango'].includes(f.direction);
}
function evaluateContext(frames,market={},now=Date.now()){
 const get=m=>frames instanceof Map?frames.get(m):frames?.[m];
 const input=[240,60,15,5].map(m=>get(m));
 const missing=[240,60,15,5].filter((m,i)=>!validFrame(input[i],m,now));
 const price=Number(market.price),lastPriceAt=Number(market.priceAt);
 const fresh=price>0&&lastPriceAt>0&&lastPriceAt<=now&&now-lastPriceAt<=20000;
 const result={status:'DATOS INCOMPLETOS',side:null,score:0,max:5,ready:false,
  checks:[],zone:'Sin evaluar',detail:'',alertKey:null,priceFresh:fresh};
 if(missing.length||!fresh){
  result.detail=(missing.length?'Falta información vigente: '+missing.map(m=>frameNames[m]).join(', ')+'. ':'')+
   (!fresh?'Precio actual no disponible. ':'')+
   'No se deduce dirección ni se crea alerta con datos incompletos.';
  return result;
 }
 const [f4,f1,f15,f5]=input;
 const bias=(f4.direction===f1.direction&&f4.direction==='Alcista')?'LONG':
            (f4.direction===f1.direction&&f4.direction==='Bajista')?'SHORT':null;
 result.side=bias;
 if(!bias){
  result.status='CONTEXTO NO ALINEADO';
  result.detail='4H y 1H no tienen la misma dirección definida. No hay escenario preferente.';
  return result;
 }
 const isLong=bias==='LONG',dir=isLong?'Alcista':'Bajista';
 const aligned15=f15.direction===dir;
 const break5=f5.recentBreak===(isLong?'Ruptura superior 3 velas':'Ruptura inferior 3 velas');
 const flow=market.flow&&market.flow.valid===true?market.flow:{};
 const matchesFlow=flow.side===bias;
 const supportive=[f1[isLong?'low':'high'],f15[isLong?'low':'high']].
  filter(x=>Number.isFinite(x)&&x>0&&(isLong?x<=price:x>=price));
 const nearest=supportive.length?
  (isLong?Math.max(...supportive):Math.min(...supportive)):null;
 const distance=nearest!==null?Math.abs(nearest/price-1)*100:null;
 const nearZone=distance!==null&&distance<=0.35;
 result.zone=nearest===null?'No hay referencia estructural del lado de invalidación':
  'Referencia '+(isLong?'inferior':'superior')+' US$'+nearest.toFixed(2)+
  ' · distancia '+distance.toFixed(2)+'% (máximo/mínimo 1H o 15M, no liquidez confirmada)';
 result.checks=[
  {label:'4H y 1H coinciden en '+dir.toLowerCase(),ok:true},
  {label:'15M coincide con el contexto '+dir.toLowerCase(),ok:aligned15},
  {label:'5M cerró con ruptura '+(isLong?'superior':'inferior')+' de 3 velas',ok:break5},
  {label:flow.valid?'Flujo agresivo 5M: '+flow.label:'Flujo 5M insuficiente',ok:matchesFlow},
  {label:nearZone?'Referencia estructural a '+distance.toFixed(2)+'%':
   'Referencia estructural cercana no confirmada',ok:nearZone}
 ];
 result.score=result.checks.filter(x=>x.ok).length;
 result.ready=aligned15&&break5&&matchesFlow&&nearZone;
 result.status=result.ready?'CONFLUENCIA DESCRIPTIVA '+bias:
  'OBSERVAR '+bias+' · FALTAN CONDICIONES';
 result.detail=result.ready?
  'Condiciones observadas en varias fuentes. NO es una señal validada para comprar o vender. Comprueba coste, stop y calendario antes de decidir.':
  'Se muestra un escenario, pero no hay confluencia completa. No anticipar la confirmación.';
 if(result.ready)result.alertKey=bias+':'+f5.closedAt;
 return result;
}
function shouldNotify(current,lastIssued,now=Date.now(),minGapMs=900000){
 if(!current?.ready||!current.alertKey)return false;
 const last=lastIssued.get(current.side);
 return !last||(last.key!==current.alertKey&&now-last.at>=minGapMs);
}
const notifications=[];
const lastIssued=new Map();
let active=true;
const $=id=>root?.document?.getElementById(id);
const historyMax=12;
function selectedFlow(now){
 if(typeof topSnapshot!=='function')return {valid:false,label:'No disponible'};
 const snap=topSnapshot(now).flow;
 const valid=snap?.valid===true;
 const label=valid?snap.value:'Muestra insuficiente';
 return {valid,label,side:valid&&label.startsWith('Compras')?'LONG':
  valid&&label.startsWith('Ventas')?'SHORT':null};
}
function snapshot(){
 const now=Date.now(),frames=root?.BTCManualRadar?.snapshot?.()||new Map();
 const market={price:typeof state==='undefined'?NaN:state.price,
  priceAt:typeof state==='undefined'?0:state.lastPriceAt,flow:selectedFlow(now)};
 return evaluateContext(frames,market,now);
}
function describeOrderBook(book,now=Date.now()){
 if(!book||!book.wsOk||!Number.isFinite(book.lastBookAt)||now-book.lastBookAt>15000||
    !(book.price>0)||!(book.bids instanceof Map)||!(book.asks instanceof Map))
  return 'Libro L2 Bybit sin datos recientes; no inferir muros.';
 const level=(raw,side)=>{
  let best=null;
  for(const [x,q] of raw){
   const p=Number(x),qty=Number(q);
   if(!(p>0&&qty>0))continue;
   if(side==='BID'&&(p>book.price||p<book.price*.995))continue;
   if(side==='ASK'&&(p<book.price||p>book.price*1.005))continue;
   const usd=p*qty;
   if(!best||usd>best.usd)best={p,usd};
  }
  return best;
 };
 const bid=level(book.bids,'BID'),ask=level(book.asks,'ASK');
 const fmt=v=>Math.round(v).toLocaleString('en-US');
 return 'Bybit L2 (hasta ±0,5%): muro comprador visible '+
  (bid?'US$'+fmt(bid.p)+' · tamaño US$'+fmt(bid.usd):'no detectado')+
  '; vendedor visible '+(ask?'US$'+fmt(ask.p)+' · tamaño US$'+fmt(ask.usd):'no detectado')+
  '. Las órdenes pueden retirarse y no garantizan soporte o resistencia.';
}
function render(){
 if(!active||!$('manualConfluence'))return;
 const r=snapshot();
 $('manualConfluence').textContent=r.status;
 $('manualConfluenceDetail').textContent=r.detail;
 $('manualConfluenceChecks').replaceChildren();
 for(const c of r.checks){
  const item=root.document.createElement('div');
  item.className='manual-confluence-check '+(c.ok?'ok':'missing');
  item.textContent=(c.ok?'✓ ':'○ ')+c.label;
  $('manualConfluenceChecks').appendChild(item);
 }
 $('manualConfluenceCount').textContent=r.score+'/'+r.max+
  ' condiciones descriptivas; no representa una probabilidad.';
 $('manualConfluenceZone').textContent=r.zone;
 if($('manualConfluenceBook'))$('manualConfluenceBook').textContent=describeOrderBook(typeof state==='undefined'?null:state,Date.now());
 if($('manualConfluenceOi')){
  const oi=typeof topSnapshot==='function'?topSnapshot(Date.now()).oi:null;
  $('manualConfluenceOi').textContent=oi?.valid?oi.value+' · '+oi.detail+' · no predicción':
   'No hay pareja reciente de OI y precio cerrados para la temporalidad seleccionada.';
 }
 if(!root.document.hidden&&r.ready&&shouldNotify(r,lastIssued,Date.now())&&
    $('manualConfluenceAlertsEnabled')?.checked){
  const stamp=Date.now();
  notifications.unshift({at:stamp,side:r.side,text:'Confluencia descriptiva '+r.side+
   ' observada en 4H/1H/15M/5M y flujo 5M. Revisar manualmente; no orden automática.'});
  notifications.splice(historyMax);
  lastIssued.set(r.side,{at:stamp,key:r.alertKey});
  renderAlerts();
 }
}
function renderAlerts(){
 const el=$('manualConfluenceHistory');if(!el)return;
 el.replaceChildren();
 if(!notifications.length){el.textContent='Sin alertas de confluencia en esta sesión.';return}
 for(const entry of notifications){
  const div=root.document.createElement('div');
  div.className='manual-alert-item';
  div.textContent=new Date(entry.at).toLocaleTimeString('es-ES')+' · '+entry.text;
  el.appendChild(div);
 }
}
function init(){
 if(!$('manualConfluence'))return;
 let stored=true;
 try{const s=root.localStorage.getItem('btc-confluence-alerts-enabled');if(s!==null)stored=s==='yes'}catch{}
 $('manualConfluenceAlertsEnabled').checked=stored;
 $('manualConfluenceAlertsEnabled').addEventListener('change',e=>{
  try{root.localStorage.setItem('btc-confluence-alerts-enabled',e.target.checked?'yes':'no')}catch{}
 });
 renderAlerts();render();
 root.setInterval(()=>{if(active&&!root.document.hidden)render()},15000);
 root.document.addEventListener('visibilitychange',()=>{if(active&&!root.document.hidden)render()});
 root.addEventListener('pagehide',()=>{active=false},{once:true});
}
if(typeof module==='object'&&module.exports)module.exports={evaluateContext,shouldNotify,describeOrderBook};
if(root?.document){
 root.BTCConfluence={snapshot,render};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
})(typeof window==='undefined'?null:window);
