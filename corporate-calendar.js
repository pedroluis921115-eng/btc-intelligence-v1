/* BTC Intelligence · resultados empresariales importantes: Nasdaq + horas oficiales verificadas. */
(function(root){
'use strict';
const FEED='./data/corporate-calendar.json';
const LIVE_EARNINGS='https://xoomar.com/api/markets/earnings';
const EXTERNAL_MAX_AGE=72*3600000;
const MAX_AGE=40*3600000,DAY=86400000;
const el=id=>root?.document?.getElementById(id);
const dateFmt=new Intl.DateTimeFormat('es-ES',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
const dayFmt=new Intl.DateTimeFormat('es-ES',{timeZone:'America/Sao_Paulo',weekday:'short',day:'2-digit',month:'short'});
function localDay(timestamp){
 const pts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
 const get=t=>pts.find(x=>x.type===t)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
function offsetDay(iso,offset){
 const [y,m,d]=iso.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+offset)).toISOString().slice(0,10);
}
function cleanEvent(raw){
 if(!raw||!['NVDA','MSFT','AAPL','AMZN','GOOGL','GOOG','META','TSLA','AMD','AVGO','ORCL','NFLX','MU','PLTR'].includes(raw.symbol))return null;
 if(typeof raw.name!=='string'||raw.name.length>50||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date))return null;
 const official=raw.officialConfirmed===true||raw.official===true;
 const scheduled=official?(Number.isFinite(raw.scheduled)?raw.scheduled:Date.parse(raw.exactTime||'')):null;
 if(official&&(!Number.isFinite(scheduled)||!String(raw.sourceUrl).startsWith('https://investor.')))return null;
 const link=String(raw.sourceUrl||'');
 if(!link.startsWith('https://www.nasdaq.com/')&&!link.startsWith('https://investor.')&&!/^https:\/\/xoomar\.com\/markets\/stocks\/[a-z0-9-]+$/i.test(link))return null;
 return {symbol:raw.symbol,name:raw.name,date:raw.date,sourceUrl:link,
  official,scheduled,followupTime:official?(Number.isFinite(raw.followupTime)?raw.followupTime:Date.parse(raw.followupTime||'')):null,
  session:['before','after','during','unknown'].includes(raw.session)?raw.session:'unknown',
  tier:raw.tier==='CRITICO'?'CRÍTICO':'IMPORTANTE',
  id:String(raw.id||'').slice(0,110)};
}
function selectCompanyEvents(feed,now=Date.now(),days=7){
 if(!feed||!Array.isArray(feed.events)||feed.events.length>160)return {ok:false,reason:'Datos empresariales inválidos'};
 const updated=Date.parse(feed.generatedAt||'');
 if(!Number.isFinite(updated)||updated>now+300000||now-updated>MAX_AGE)
  return {ok:false,reason:'Agenda empresarial sin actualización reciente'};
 const start=localDay(now),end=offsetDay(start,days-1),seen=new Set(),list=[];
 for(const item of feed.events){
  const v=cleanEvent(item);
  if(!v||v.date<start||v.date>end||seen.has(v.id))continue;
  seen.add(v.id);list.push(v);
 }
 list.sort((a,b)=>a.date.localeCompare(b.date)||(a.tier==='CRÍTICO'?-1:1)||String(a.symbol).localeCompare(b.symbol));
 return {ok:true,events:list.slice(0,5),updated};
}
function companyStatus(e,now=Date.now()){
 if(!e.official||!Number.isFinite(e.scheduled))return {label:e.session==='before'?'ANTES DE APERTURA · HORA SIN CONFIRMAR':
  e.session==='after'?'TRAS EL CIERRE · HORA SIN CONFIRMAR':'HORA EXACTA NO CONFIRMADA',urgent:false};
 const dt=e.scheduled-now;
 if(dt<0){
  const callTime=e.followupTime;
  if(Number.isFinite(callTime)&&callTime>now)
   return {label:'RESULTADOS: HORA PASADA · CONFERENCIA PENDIENTE',urgent:false};
  return {label:'HORARIO PREVISTO SUPERADO · CONSULTAR FUENTE',urgent:false};
 }
 if(dt<=15*60000)return {label:'EN MENOS DE 15 MIN',urgent:true};
 if(dt<=60*60000)return {label:'EN MENOS DE 1 HORA',urgent:true};
 if(dt<DAY)return {label:'EN '+Math.ceil(dt/3600000)+' H',urgent:false};
 return {label:'EN '+Math.ceil(dt/DAY)+' DÍAS',urgent:false};
}

// Fuente gratuita viva: estimaciones sin hora. Nunca prevalecen sobre un comunicado de la empresa.
const WATCHLIST=new Map([
 ['NVDA','NVIDIA'],['MSFT','Microsoft'],['AAPL','Apple'],['AMZN','Amazon'],
 ['GOOGL','Alphabet'],['GOOG','Alphabet'],['META','Meta'],['TSLA','Tesla'],
 ['AMD','AMD'],['AVGO','Broadcom'],['ORCL','Oracle'],['NFLX','Netflix'],
 ['MU','Micron'],['PLTR','Palantir']
]);
function normalizeEarningsFeed(payload,now=Date.now()){
 const updated=Date.parse(payload?.updatedAt||'');
 if(!Array.isArray(payload?.data)||!Number.isFinite(updated)||updated>now+300000||now-updated>EXTERNAL_MAX_AGE)
  return {ok:false,reason:'Fuente empresarial externa no vigente'};
 const events=[];
 for(const raw of payload.data){
  const symbol=String(raw?.ticker||'').toUpperCase();
  if(!WATCHLIST.has(symbol)||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date||'')||raw.status!=='estimated')continue;
  const date=raw.date;
  const link='https://xoomar.com/markets/stocks/'+symbol.toLowerCase();
  const row=cleanEvent({id:'estimated-'+symbol+'-'+date,symbol,name:WATCHLIST.get(symbol),
   date,officialConfirmed:false,sourceUrl:link,session:'unknown',tier:
   ['NVDA','MSFT','AAPL','AMZN','GOOGL','META'].includes(symbol)?'CRITICO':'IMPORTANTE'});
  if(row)events.push(row);
 }
 return {ok:true,events,updated};
}
function mergeCompanyFeeds(official,external,now=Date.now()){
 const officialGood=official&&selectCompanyEvents(official,now,14).ok;
 const ext=normalizeEarningsFeed(external,now);
 if(!officialGood&&!ext.ok)return {ok:false,reason:'Sin fuente empresarial vigente'};
 const events=[],bySymbol=new Map();
 if(ext.ok)for(const e of ext.events)bySymbol.set(e.symbol,e);
 if(officialGood)for(const item of official.events){
  const clean=cleanEvent(item);if(clean?.official){
   // Prioridad estricta: comunicado oficial > estimado de proveedor externo (aunque otra fecha).
   bySymbol.delete(clean.symbol);
   if(clean.date>=localDay(now))bySymbol.set(clean.symbol,clean);
  }
 }
 events.push(...bySymbol.values());
 return {ok:true,feed:{generatedAt:new Date(now).toISOString(),events},
  source:officialGood&&ext.ok?'Oficial + XOOMAR':officialGood?'Oficial (cobertura limitada)':'XOOMAR (estimaciones)'};
}

let latest=null,alive=true,loading=false,lastAttempt=0,horizon=7,controller=null,sourceLabel='';
function render(){
 const target=el('vsCorporateEvents'),status=el('vsCorporateStatus');
 if(!alive||!target||!status)return;
 const now=Date.now(),selected=latest&&selectCompanyEvents(latest,now,horizon);
 target.replaceChildren();
 if(!selected?.ok){
  status.textContent=selected?.reason||'Sin agenda de resultados verificada';
  const item=root.document.createElement('div');item.className='vs-macro-empty';
  item.textContent='No se puede confirmar la cobertura empresarial. Revisa la fuente.';target.appendChild(item);
  return;
 }
 if(!selected.events.length){
  status.textContent='EMPRESAS · SIN EVENTOS RELEVANTES DETECTADOS EN LA LISTA VIGILADA';
  return;
 }
 status.textContent='EMPRESAS · '+selected.events.length+' EVENTO(S) · '+sourceLabel+' · horas solo si están confirmadas';
 for(const e of selected.events){
  const card=root.document.createElement('article');
  card.className='vs-macro-event vs-corporate-card';card.dataset.tier=e.tier;
  const state=companyStatus(e,now);card.dataset.urgent=String(state.urgent);
  const top=root.document.createElement('div');top.className='vs-macro-row';
  const label=root.document.createElement('span');label.className='vs-macro-tier';label.textContent=e.tier;top.appendChild(label);
  const company=root.document.createElement('strong');company.className='vs-macro-title';company.textContent='RESULTADOS '+e.name.toUpperCase();top.appendChild(company);
  const clock=root.document.createElement('span');clock.className='vs-macro-clock';
  clock.textContent=e.official?dateFmt.format(e.scheduled)+' BRT':dayFmt.format(Date.parse(e.date+'T15:00:00Z'))+' · HORA PENDIENTE';
  top.appendChild(clock);card.appendChild(top);
  const detail=root.document.createElement('div');detail.className='vs-macro-row vs-macro-details';
  const countdown=root.document.createElement('strong');countdown.className=state.urgent?'vs-macro-urgent':'vs-macro-countdown';countdown.textContent=state.label;detail.appendChild(countdown);
  const why=root.document.createElement('span');why.className='vs-macro-why';
  why.textContent=e.official?'Compañía: horario oficial confirmado. Puede aumentar la volatilidad tecnológica.':
   'Fecha estimada, NO anuncio oficial. Confirma siempre en la web de la compañía.';
  detail.appendChild(why);card.appendChild(detail);
  if(e.official&&Number.isFinite(e.followupTime)){
   const conf=root.document.createElement('div');conf.className='vs-corporate-call';
   conf.textContent='CONFERENCIA '+new Intl.DateTimeFormat('es-ES',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(e.followupTime)+' BRT';
   card.appendChild(conf);
  }
  const link=root.document.createElement('a');link.className='vs-corporate-source';link.href=e.sourceUrl;
  link.target='_blank';link.rel='noopener noreferrer';link.textContent=e.official?'FUENTE OFICIAL':e.sourceUrl.includes('xoomar.com')?'FECHA ESTIMADA · XOOMAR':'CALENDARIO NASDAQ';card.appendChild(link);
  target.appendChild(card);
 }
 const imminent=selected.events.some(x=>x.official&&(x.scheduled-now)>-600000&&(x.scheduled-now)<=1800000);
 const warn=el('vsCorporateWarn');if(warn){warn.hidden=!imminent;warn.textContent='RESULTADOS IMPORTANTES PRÓXIMOS · riesgo de volatilidad en tecnológicas y BTC';}
}
async function refresh(force=false){
 if(!alive||loading||root.document.hidden||Date.now()-lastAttempt<(force?60000:30*60000))return;
 loading=true;lastAttempt=Date.now();
 controller=new AbortController();const timer=root.setTimeout(()=>controller?.abort(),10000);
 try{
  const get=async url=>{
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   return response.json();
  };
  const results=await Promise.allSettled([get(FEED),get(LIVE_EARNINGS)]);
  const official=results[0].status==='fulfilled'?results[0].value:null;
  const external=results[1].status==='fulfilled'?results[1].value:null;
  const merged=mergeCompanyFeeds(official,external,Date.now());
  if(!merged.ok)throw Error(merged.reason);
  latest=merged.feed;sourceLabel=merged.source;
 }catch(err){if(!latest)sourceLabel='FUENTES TEMPORALMENTE INACCESIBLES'}
 finally{root.clearTimeout(timer);controller=null;loading=false;if(alive)render()}
}
function init(){
 if(!el('vsCorporateEvents'))return;
 for(const btn of root.document.querySelectorAll('[data-vs-macro-days]'))btn.addEventListener('click',()=>{
  horizon=Number(btn.dataset.vsMacroDays)===14?14:7;render()
 });
 el('vsMacroRefresh')?.addEventListener('click',()=>refresh(true));
 root.document.addEventListener('btc:viewchange',e=>{if(e.detail?.view==='analysis'){render();refresh()}});
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden){render();refresh()}});
 root.setInterval(()=>{if(alive&&!root.document.hidden&&!el('vsPaneAnalysis')?.hidden){render();refresh()}},60000);
 root.addEventListener('pagehide',()=>{alive=false;controller?.abort()},{once:true});
 render();refresh();
}
if(typeof module==='object'&&module.exports)module.exports={cleanEvent,selectCompanyEvents,companyStatus,localDay,normalizeEarningsFeed,mergeCompanyFeeds};
if(root?.document){
 root.BTCCorporate={render,refresh};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
})(typeof window==='undefined'?null:window);
