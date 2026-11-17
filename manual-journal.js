/* BTC Intelligence V4 — diario manual LOCAL: no API, no órdenes, no nube. */
(function(root){
'use strict';
const KEY='btc-intelligence-manual-journal-v1';
const MAX=500,MAX_NOTES=350;
const kinds=new Set(['PAPER','REAL']),sides=new Set(['LONG','SHORT']);
const setups=new Set(['Retroceso','Ruptura','Barrido','Rango','Otro']);
const origins=new Set(['Análisis propio','Trader en vivo','Mixto']);
function number(x){if(x===null||x===undefined||String(x).trim()==='')return NaN;return Number(x)}
function validateRecord(raw){
 if(!raw||typeof raw!=='object'||!kinds.has(raw.kind)||!sides.has(raw.side)||
    !setups.has(raw.setup)||!origins.has(raw.origin))return {ok:false,reason:'Tipo, lado, setup u origen no válido.'};
 const entry=number(raw.entry),exit=number(raw.exit),qty=number(raw.qty),fees=number(raw.fees);
 if(![entry,exit,qty,fees].every(Number.isFinite)||entry<=0||exit<=0||qty<=0||fees<0||
    Math.max(entry,exit)>100000000||qty>100000||fees>100000000)
  return {ok:false,reason:'Entrada, salida, cantidad BTC y comisiones deben ser números válidos.'};
 const note=String(raw.note??'').trim().slice(0,MAX_NOTES);
 const ts=number(raw.ts);
 if(!Number.isSafeInteger(ts)||ts<1700000000000||ts>Date.now()+86400000)
  return {ok:false,reason:'Fecha inválida.'};
 const id=String(raw.id??'').slice(0,90);
 if(!/^[a-zA-Z0-9:_-]{6,90}$/.test(id))return {ok:false,reason:'ID inválido.'};
 const gross=(exit-entry)*(raw.side==='LONG'?1:-1)*qty;
 const net=gross-fees;
 if(!Number.isFinite(gross)||!Number.isFinite(net))return {ok:false,reason:'Resultado inválido.'};
 return {ok:true,record:{id,ts,kind:raw.kind,side:raw.side,setup:raw.setup,
  origin:raw.origin,entry,exit,qty,fees,note,gross,net}};
}
function metrics(records,kind){
 const data=records.filter(x=>x.kind===kind).sort((a,b)=>a.ts-b.ts);
 const wins=data.filter(x=>x.net>0),losses=data.filter(x=>x.net<0);
 const grossWin=wins.reduce((n,x)=>n+x.net,0),grossLoss=losses.reduce((n,x)=>n-x.net,0);
 let equity=0,peak=0,maxDd=0;
 for(const r of data){equity+=r.net;peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity)}
 return {count:data.length,wins:wins.length,losses:losses.length,
  total:equity,winRate:data.length?wins.length/data.length*100:null,
  expectancy:data.length?equity/data.length:null,
  profitFactor:grossLoss>0?grossWin/grossLoss:null,maxDrawdown:maxDd};
}
function appendUnique(current,newRecords){
 const seen=new Set(current.map(x=>x.id)),out=[...current],rejects=[];
 for(const raw of newRecords){
  const v=validateRecord(raw);
  if(!v.ok){rejects.push(v.reason);continue}
  if(seen.has(v.record.id))continue;
  if(out.length>=MAX){rejects.push('Alcanzado el máximo local de '+MAX+' registros');break}
  out.push(v.record);seen.add(v.record.id);
 }
 return {records:out.sort((a,b)=>a.ts-b.ts),rejected:rejects};
}
function load(){
 try{
  const raw=JSON.parse(root.localStorage.getItem(KEY)||'[]');
  if(!Array.isArray(raw))return [];
  return appendUnique([],raw.slice(0,MAX)).records;
 }catch{return []}
}
function save(records){
 try{
  root.localStorage.setItem(KEY,JSON.stringify(records));
  return root.localStorage.getItem(KEY)===JSON.stringify(records);
 }catch{return false}
}
const $=id=>root.document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>(n<0?'-':'')+'US$'+fmt(Math.abs(n));
let entries=[],visible=true;
function render(){
 if(!root?.document||!$('journalHistory'))return;
 const kind=$('journalFilter')?.value==='REAL'?'REAL':'PAPER';
 const m=metrics(entries,kind);
 $('journalMetrics').textContent=
  kind+': '+m.count+' operaciones cerradas · P&L neto '+money(m.total)+
  ' · aciertos '+(m.winRate===null?'—':m.winRate.toFixed(1)+'%')+
  ' · media por operación '+(m.expectancy===null?'—':money(m.expectancy))+
  ' · factor beneficio '+(m.profitFactor===null?'no calculable':m.profitFactor.toFixed(2))+
  ' · caída máxima acumulada '+money(m.maxDrawdown)+
  ' (basada en orden de registros; no en equity intratrade).';
 const container=$('journalHistory');container.replaceChildren();
 const recent=entries.filter(x=>x.kind===kind).sort((a,b)=>b.ts-a.ts).slice(0,15);
 if(!recent.length){container.textContent='Sin operaciones cerradas '+kind.toLowerCase()+' registradas en este navegador.';return}
 for(const r of recent){
  const div=root.document.createElement('div');div.className='manual-journal-row';
  const first=root.document.createElement('div');first.className='manual-journal-row-head';
  first.textContent=new Date(r.ts).toLocaleString('es-ES')+' · '+r.side+' · '+r.setup+
   ' · '+money(r.net)+' netos';div.appendChild(first);
  const detail=root.document.createElement('div');
  detail.textContent=r.origin+' · '+r.qty+' BTC · entrada '+fmt(r.entry)+
   ' · salida '+fmt(r.exit)+' · costes '+money(r.fees)+
   (r.note?' · '+r.note:'');
  div.appendChild(detail);container.appendChild(div);
 }
}
function status(message){if($('journalStatus'))$('journalStatus').textContent=message}
function idForNew(){
 const rnd=typeof root.crypto?.randomUUID==='function'?root.crypto.randomUUID().replace(/-/g,'').slice(0,24):
  Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
 return 'btc_'+Date.now().toString(36)+'_'+rnd;
}
function currentInput(){
 return {id:idForNew(),ts:Date.now(),kind:$('journalKind').value,side:$('journalSide').value,
  setup:$('journalSetup').value,origin:$('journalOrigin').value,
  entry:$('journalEntry').value,exit:$('journalExit').value,
  qty:$('journalQty').value,fees:$('journalFees').value,note:$('journalNote').value};
}
function init(){
 if(!$('journalSave'))return;
 entries=load();render();
 $('journalFilter').addEventListener('change',render);
 $('journalUsePlan').addEventListener('click',()=>{
  const p=root.BTCManualPlanCurrent;
  if(!p?.ok){status('Calcula primero un plan válido en la sección de riesgo.');return}
  $('journalSide').value=p.side;
  $('journalEntry').value=p.entry.toFixed(2);
  $('journalQty').value=p.quantity.toFixed(6);
  $('journalFees').value=(p.quantity*(p.entry+p.target)*p.friction).toFixed(2);
  status('Campos rellenados desde el PLAN, no desde ejecuciones reales. Corrige cantidad, precio y costes según lo efectivamente ejecutado.');
 });
 $('journalSave').addEventListener('click',()=>{
  const v=validateRecord(currentInput());
  if(!v.ok){status('No guardado: '+v.reason);return}
  if(entries.length>=MAX){status('Diario lleno. Exporta una copia de seguridad antes de continuar.');return}
  const next=appendUnique(entries,[v.record]);
  if(next.records.length!==entries.length+1||!save(next.records)){status('No se pudo guardar: verifica almacenamiento privado o espacio libre.');return}
  entries=next.records;render();
  $('journalExit').value='';$('journalNote').value='';
  status('Operación cerrada guardada LOCALMENTE. Total registros en este navegador: '+entries.length+'.');
 });
 $('journalExport').addEventListener('click',()=>{
  const data=JSON.stringify({format:'BTC_INTELLIGENCE_JOURNAL_V1',exportedAt:new Date().toISOString(),records:entries},null,2);
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=root.document.createElement('a');
  a.href=url;a.download='btc-intelligence-diario-'+new Date().toISOString().slice(0,10)+'.json';
  root.document.body.appendChild(a);a.click();a.remove();root.setTimeout(()=>URL.revokeObjectURL(url),2000);
  status('Exportación preparada. Guarda este JSON: laptop y celular NO sincronizan automáticamente.');
 });
 $('journalImport').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  if(file.size>3000000){status('Importación rechazada: archivo mayor de 3 MB.');return}
  try{
   const data=JSON.parse(await file.text());
   if(data?.format!=='BTC_INTELLIGENCE_JOURNAL_V1'||!Array.isArray(data.records)||data.records.length>MAX){
    status('Importación rechazada: formato JSON del diario no válido.');return
   }
   const result=appendUnique(entries,data.records);
   if(result.rejected.length){status('Importación rechazada: '+result.rejected.length+' registros inválidos o excedidos; no se modificó el diario.');return}
   const added=result.records.length-entries.length;
   if(!save(result.records)){status('No se pudo guardar la importación; diario original conservado.');return}
   entries=result.records;render();
   status('Importación validada: '+added+' nuevos, '+(data.records.length-added)+' duplicados omitidos.');
  }catch(err){status('No se pudo importar: JSON inválido o inaccesible. Diario original conservado.')}
 });
 root.addEventListener('pagehide',()=>{visible=false},{once:true});
}
if(typeof module==='object'&&module.exports)module.exports={validateRecord,metrics,appendUnique};
if(root?.document){
 root.BTCJournal={read:()=>entries.map(x=>({...x}))};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init()
}
})(typeof window==='undefined'?null:window);
