/* BTC Intelligence V6 Macro: releases importantes USA, solo informativo. Sin órdenes ni background. */
(function(root){
'use strict';
// Fetch FULL provider feed, then apply our restrictive, event-specific BTC filters.
const API='https://xoomar.com/api/markets/calendar';
const SOURCE='https://xoomar.com/markets/api/calendar';
const MAX_AGE=72*3600000;
const HOUR=3600000,DAY=24*HOUR;
const RULES=[
 {rx:/\bFOMC Rate Decision\b/i,title:'DECISIÓN FED · TIPOS',tier:'CRÍTICO',reason:'Tipos de interés · puede provocar volatilidad fuerte'},
 {rx:/\bSummary of Economic Projections\b|\bFOMC Projections\b|\bDot Plot\b/i,title:'FED · PROYECCIONES',tier:'CRÍTICO',reason:'Expectativas de tipos futuros y política monetaria'},
 {rx:/\bCPI\b|\bConsumer Price Index\b/i,title:'INFLACIÓN · IPC',tier:'CRÍTICO',reason:'Inflación de EE. UU. · influye en expectativas de tipos'},
 {rx:/\bNonfarm Payrolls\b|\bEmployment Situation\b/i,title:'EMPLEO · NFP',tier:'CRÍTICO',reason:'Empleo y salarios · alta sensibilidad macro'},
 {rx:/\bPersonal Income and Outlays\b|\bCore PCE\b|\bPCE Price\b/i,title:'INFLACIÓN · PCE',tier:'CRÍTICO',reason:'Indicador de inflación seguido por la Fed'},
 {rx:/\bGDP.*Advance\b|\bGDP \(Advance/i,title:'PIB · PRELIMINAR',tier:'IMPORTANTE',reason:'Crecimiento económico · primera estimación'},
 {rx:/\bRetail Sales\b/i,title:'VENTAS MINORISTAS',tier:'IMPORTANTE',reason:'Consumo estadounidense y expectativas económicas'},
 {rx:/\bPPI\b|\bProducer Price Index\b/i,title:'PRECIOS DE PRODUCCIÓN',tier:'IMPORTANTE',reason:'Presiones de precios en productores'},
 {rx:/\bFOMC Minutes\b/i,title:'ACTAS DE LA FED',tier:'IMPORTANTE',allowMedium:true,reason:'Detalles del debate de política monetaria'},
 {rx:/\bISM.*(Manufacturing|Services|PMI)\b/i,title:'ACTIVIDAD · ISM',tier:'IMPORTANTE',allowMedium:true,reason:'Actividad económica y expectativas de crecimiento'},
 {rx:/\bIndustrial Production\b/i,title:'PRODUCCIÓN INDUSTRIAL',tier:'RELEVANTE',allowMedium:true,reason:'Actividad industrial estadounidense; puede afectar expectativas macro'}
];
function classifyEvent(raw){
 if(!raw||typeof raw.eventName!=='string')return null;
 const rule=RULES.find(x=>x.rx.test(raw.eventName));
 if(!rule||!(raw.importance==='high'||(rule.allowMedium&&['med','medium'].includes(raw.importance))))return null;
 const t=Date.parse(raw.scheduledAt||'');
 if(!Number.isFinite(t)||!/\d\d:\d\d/.test(raw.scheduledAt||''))return null;
 const unit=typeof raw.unit==='string'?raw.unit.slice(0,85):null;
 const actual=typeof raw.actual==='string'&&raw.actual.trim()?raw.actual.trim().slice(0,40):null;
 const previous=typeof raw.previous==='string'&&raw.previous.trim()?raw.previous.trim().slice(0,40):null;
 const source=['bls','bea','fed','census','dol','treasury'].includes(raw.source)?raw.source:'externo';
 const link=typeof raw.canonicalUrl==='string'&&raw.canonicalUrl.startsWith('https://xoomar.com/')?raw.canonicalUrl:SOURCE;
 return {id:source+':'+raw.eventName+':'+t,time:t,title:rule.title,tier:rule.tier,
   reason:rule.reason,source,link,unit,actual,previous,original:raw.eventName.slice(0,110)};
}
function selectEvents(data,now=Date.now(),days=7){
 if(!data||!Array.isArray(data.data)||data.data.length>2000)return {ok:false,reason:'Formato de datos inválido'};
 const updated=Date.parse(data.updatedAt||'');
 if(!Number.isFinite(updated)||updated>now+5*60000||now-updated>MAX_AGE)
  return {ok:false,reason:'Calendario sin actualización reciente; consultar fuente'};
 // Mantener los eventos de HOY hasta las 23:59 de Curitiba, aunque ya se publicaron.
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
 const get=t=>Number(parts.find(x=>x.type===t).value);
 const start=Date.UTC(get('year'),get('month')-1,get('day'),3);
 const seen=new Set(),items=[];
 for(const x of data.data){
  const e=classifyEvent(x);if(!e||seen.has(e.id))continue;seen.add(e.id);
  if(e.time>=start&&e.time<start+days*DAY)items.push(e);
 }
 items.sort((a,b)=>a.time-b.time||(a.tier==='CRÍTICO'?-1:1));
 return {ok:true,events:items,updated,coverage:days};
}
function nextCritical(data,now=Date.now()){
 const r=selectEvents(data,now,30);
 return r.ok?r.events.filter(x=>x.time>=now).slice(0,1):[];
}
function eventState(e,now=Date.now()){
 const dt=e.time-now;
 if(dt>=0){
  if(dt<=15*60000)return {label:'EN MENOS DE 15 MIN',urgent:true};
  if(dt<=60*60000)return {label:'EN MENOS DE 1 HORA',urgent:true};
  if(dt<=24*HOUR)return {label:'EN '+Math.ceil(dt/HOUR)+' H',urgent:false};
  return {label:'EN '+Math.ceil(dt/DAY)+' DÍAS',urgent:false};
 }
 if(e.actual)return {label:'PUBLICADO',urgent:false};
 return {label:'HORARIO PASADO · SIN VALOR CONFIRMADO',urgent:false};
}
const el=id=>root?.document?.getElementById(id);
let alive=true,loading=false,lastLoaded=0,latest=null,viewDays=7,error='',controller=null,lastAttempt=0;
const dateFmt=new Intl.DateTimeFormat('es-ES',{timeZone:'America/Sao_Paulo',weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});
const hourFmt=new Intl.DateTimeFormat('es-ES',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false});
function addText(parent,tag,cls,value){
 const child=root.document.createElement(tag);child.className=cls;child.textContent=value;parent.appendChild(child);return child;
}
function render(){
 const holder=el('vsMacroEvents'),status=el('vsMacroStatus');
 if(!holder||!status||!alive)return;
 holder.replaceChildren();
 const now=Date.now(),data=latest&&selectEvents(latest,now,viewDays);
 if(!latest||!data?.ok){
  status.textContent=loading?'Consultando agenda económica...':error||data?.reason||'Sin calendario verificado';
  addText(holder,'div','vs-macro-empty','No se muestran fechas sin una fuente reciente.');
  return;
 }
 status.textContent='AGENDA ACTUALIZADA · '+(viewDays===7?'7 DÍAS':'14 DÍAS')+' · HORA DE CURITIBA';
 let list=data.events.slice(0,6);
 if(!list.length){
  const upcoming=nextCritical(latest,now);
  addText(holder,'div','vs-macro-empty','Sin otros datos macroeconómicos prioritarios en este periodo.');
  if(upcoming.length){
   addText(holder,'div','vs-macro-next','Próximo: '+upcoming[0].title+' · '+dateFmt.format(upcoming[0].time));
  }
 }else{
  for(const e of list){
   const t=eventState(e,now),row=root.document.createElement('article');
   row.className='vs-macro-event';row.dataset.tier=e.tier;row.dataset.urgent=String(t.urgent);
   const top=root.document.createElement('div');top.className='vs-macro-row';
   addText(top,'span','vs-macro-tier',e.tier);
   addText(top,'strong','vs-macro-title',e.title);
   addText(top,'span','vs-macro-clock',dateFmt.format(e.time)+' BRT');
   row.appendChild(top);
   const bot=root.document.createElement('div');bot.className='vs-macro-row vs-macro-details';
   addText(bot,'strong',t.urgent?'vs-macro-urgent':'vs-macro-countdown',t.label);
   addText(bot,'span','vs-macro-why',e.reason);
   row.appendChild(bot);
   if(e.actual&&e.time<=now){
    const extra=root.document.createElement('div');extra.className='vs-macro-actual';
    extra.textContent='PUBLICADO: '+e.actual+(e.unit?' '+e.unit:'')+(e.previous?' · anterior '+e.previous:'');
    row.appendChild(extra);
   }
   holder.appendChild(row);
  }
 }
 const dateText=el('vsMacroUpdate');
 if(dateText)dateText.textContent='Datos: XOOMAR · '+hourFmt.format(data.updated)+' BRT · sin previsiones de consenso';
 const warn=el('vsMacroWarn');
 if(warn){
  const imminent=data.events.find(x=>{const minutes=(x.time-now)/60000;return minutes>=-10&&minutes<=30});
  warn.hidden=!imminent;
  if(imminent)warn.textContent='AVISO: '+imminent.title+' · posible volatilidad. Evita entrar por impulso.';
 }
}
async function refresh(force=false){
 if(!alive||loading||root.document.hidden)return;
 const now=Date.now();
 if(!force&&now-lastAttempt<30*60000)return;
 if(force&&now-lastAttempt<60000)return;
 lastAttempt=now;loading=true;error='';render();
 controller=new AbortController();const timer=root.setTimeout(()=>controller?.abort(),9000);
 try{
  const response=await fetch(API,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  const body=await response.json(),candidate=selectEvents(body,Date.now(),14);
  if(!candidate.ok)throw Error(candidate.reason);
  latest=body;lastLoaded=Date.now();
 }catch(e){
  if(!latest)error=String(e.message).includes('sin actualización')?'Calendario desactualizado · confirmar en la fuente':'Fuente macro temporalmente inaccesible · abrir calendario original';
 }finally{
  root.clearTimeout(timer);controller=null;loading=false;if(alive)render();
 }
}
function init(){
 if(!el('vsMacroEvents'))return;
 for(const button of root.document.querySelectorAll('[data-vs-macro-days]'))button.addEventListener('click',()=>{
  viewDays=Number(button.dataset.vsMacroDays)===14?14:7;
  for(const b of root.document.querySelectorAll('[data-vs-macro-days]'))b.classList.toggle('active',Number(b.dataset.vsMacroDays)===viewDays);
  render();
 });
 el('vsMacroRefresh')?.addEventListener('click',()=>refresh(true));
 root.document.addEventListener('btc:viewchange',e=>{if(e.detail?.view==='analysis'){render();refresh()}});
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden){render();refresh()}});
 root.setInterval(()=>{if(alive&&!root.document.hidden&&!el('vsPaneAnalysis')?.hidden){render();
   if(Date.now()-lastLoaded>30*60000)refresh();
 }},60000);
 root.addEventListener('pagehide',()=>{alive=false;controller?.abort()},{once:true});
 render();refresh();
}
if(typeof module==='object'&&module.exports)module.exports={classifyEvent,selectEvents,nextCritical,eventState};
if(root?.document){
 root.BTCMacro={refresh,render};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
})(typeof window==='undefined'?null:window);
