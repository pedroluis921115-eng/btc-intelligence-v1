/* BTC Intelligence V6 · hechos breves, sin alertas automáticas inventadas. */
(function(root){
'use strict';
const $=id=>root?.document?.getElementById(id);
let active=true;
function pickImportant(input,now=Date.now()){
 const {price,priceAt,frames,flow,oi,funding,model,modelAt,confluence}=input||{};
 const market=Number.isFinite(price)&&price>0&&priceAt>0&&now-priceAt>=0&&now-priceAt<=20000;
 if(!market)return [{kind:'missing',title:'Datos insuficientes',value:'ESPERAR',detail:'Sin precio BTC vigente'}];
 const items=[];
 const get=tf=>frames instanceof Map?frames.get(tf):frames?.[tf];
 const f4=get(240),f1=get(60);
 const fresh=(f,minutes)=>!!f?.ok&&Number.isFinite(f.closedAt)&&f.closedAt<=now&&now-f.closedAt<=Math.max(minutes*120000,600000);
 if(fresh(f4,240)&&fresh(f1,60)&&f4.direction!==f1.direction&&
  ['Alcista','Bajista'].includes(f4.direction)&&['Alcista','Bajista'].includes(f1.direction)){
  items.push({kind:'caution',title:'Estructura contradictoria',value:'4H ≠ 1H',
   detail:'Los marcos mayores no coinciden · velas cerradas'});
 }
 if(modelAt&&now-modelAt<=450000&&Array.isArray(model)){
  const highest=Math.max(0,...model.filter(z=>Number.isFinite(z?.weight)&&z.weight>0).map(z=>z.weight));
  const nearest=model.filter(z=>Number.isFinite(z.level)&&Number.isFinite(z.weight)&&z.level>0&&z.weight>=highest*.3&&
   ((z.side==='short'&&z.level>price)||(z.side==='long'&&z.level<price))&&
   Math.abs(z.level/price-1)<=.006).sort((a,b)=>Math.abs(a.level-price)-Math.abs(b.level-price))[0];
  if(nearest)items.push({kind:'zone',title:'Zona hipotética OI cercana',
   value:'$'+Math.round(nearest.level).toLocaleString('en-US'),
   detail:(nearest.side==='short'?'Arriba · ':'Abajo · ')+(100*Math.abs(nearest.level/price-1)).toFixed(2)+'% · NO son liquidaciones observadas'});
 }
 const flowPct=Number(flow?.buyPct);
 if(flow?.valid&&Number.isFinite(flowPct)&&(flowPct>=65||flowPct<=35)){
  const buy=flowPct>=65;
  items.push({kind:'flow',title:'Presión agresiva 5M',
   value:(buy?'Compras ':'Ventas ')+Math.round(buy?flowPct:100-flowPct)+'%',
   detail:'Bybit · operaciones ejecutadas; no predice el siguiente movimiento'});
 }
 if(!items.length)items.push({kind:'neutral',title:'Sin eventos destacados',value:'MERCADO EN OBSERVACIÓN',
  detail:'Sin hechos nuevos verificables con estos filtros · no implica que sea seguro operar'});
 return items.slice(0,2);
}
function current(){
 const n=Date.now(),s=typeof state==='undefined'?null:state,raw=typeof topSnapshot==='function'?topSnapshot(n):{};
 const x=s?.oiAligned,oi=raw.oi?.valid&&x?.ok?{valid:true,oiPct:x.oiPct,pricePct:x.pricePct}:{valid:false};
 let flow={valid:false};
 if(raw.flow?.valid){
  const match=String(raw.flow.value||'').match(/^(Compras|Ventas) (\d+)%/);
  flow=match?{valid:true,buyPct:match[1]==='Compras'?Number(match[2]):100-Number(match[2])}:{valid:false};
 }
 return {price:s?.price,priceAt:s?.lastPriceAt,frames:root.BTCManualRadar?.snapshot?.(),
  model:s?.model,modelAt:s?.lastHistoryAt,flow,oi,funding:raw.funding,
  confluence:root.BTCConfluence?.snapshot?.()};
}
function render(){
 const container=$('vsImportantList'),pane=$('vsPaneAnalysis');
 if(!active||!container||!pane||pane.hidden||root.document.hidden)return;
 const items=pickImportant(current());
 container.replaceChildren();
 for(const item of items){
  const node=root.document.createElement('div');node.className='vs-important-item';node.dataset.kind=item.kind;
  for(const [cls,text] of [['vs-important-label',item.title],['vs-important-value',item.value],['vs-important-detail',item.detail]]){
   const part=root.document.createElement('div');part.className=cls;part.textContent=text;node.appendChild(part);
  }
  container.appendChild(node);
 }
 const count=$('vsImportantCount');if(count)count.textContent=items[0]?.kind==='neutral'?'SIN CAMBIOS DESTACADOS':items.length+' HECHOS DESTACADOS';
 const section=container.closest('.vs-important-panel');
 if(section)section.hidden=items[0]?.kind==='neutral';
}
function init(){
 if(!$('vsImportantList'))return;
 render();
 root.document.addEventListener('btc:viewchange',e=>{if(e.detail?.view==='analysis')render()});
 root.setInterval(()=>{if(active&&!root.document.hidden)render()},20000);
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)render()});
 root.addEventListener('pagehide',()=>{active=false},{once:true});
}
if(typeof module==='object'&&module.exports)module.exports={pickImportant};
if(root?.document){
 root.BTCImportant={render};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init()
}
})(typeof window==='undefined'?null:window);
