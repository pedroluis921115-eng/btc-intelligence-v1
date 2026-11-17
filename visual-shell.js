/* BTC Intelligence V5 · Vistas visuales. Conserva todos los datos originales sin duplicar flujos. */
(function(root){
'use strict';
let alive=true,view='analysis';
const el=id=>root.document.getElementById(id);
function set(id,value){const n=el(id);if(n)n.textContent=value}
function dir(v){return v==='Alcista'?'ALCISTA':v==='Bajista'?'BAJISTA':v==='Mixto / rango'?'LATERAL':'SIN DATOS'}
function cash(v){return Number.isFinite(v)?'$'+Math.round(v).toLocaleString('en-US'):'—'}
function freshFrame(f,m,now){return !!f?.ok&&f.closedAt<=now&&now-f.closedAt<=Math.max(m*120000,600000)}
function render(){
 if(!alive||!el('vsDecision')||root.document.hidden)return;
 const n=Date.now(),frames=root.BTCManualRadar?.snapshot?.()||new Map();
 const r=root.BTCConfluence?.snapshot?.(),stateRef=typeof state!=='undefined'?state:{};
 const px=Number(stateRef.price),pxOk=px>0&&stateRef.lastPriceAt>0&&n-stateRef.lastPriceAt<20000;
 let title='ESPERAR',tone='neutral',why='Comprobando datos vigentes.';
 if(r&&r.status!=='DATOS INCOMPLETOS'){
  if(r.ready){title='REVISAR '+r.side;tone=r.side==='LONG'?'bull':'bear';
   why='Confluencia observada. Comprueba stop, riesgo y costes.'}
  else if(r.side){title='VIGILAR '+r.side;tone=r.side==='LONG'?'bull':'bear';
   const missing=r.checks?.filter(x=>!x.ok).slice(0,2).map(x=>x.label).join(' · ');
   why=missing?'Falta: '+missing:'Esperar confirmación antes de entrar.'}
  else why='4H y 1H no tienen una dirección común definida.';
 }
 el('vsDecisionCard').dataset.tone=tone;
 set('vsDecision',title);set('vsDecisionReason',why);
 set('vsDecisionLabel',r?.status==='DATOS INCOMPLETOS'?'DATOS INCOMPLETOS · NO OPERAR':'LECTURA DESCRIPTIVA · NO SEÑAL');
 for(const m of [240,60,15,5]){
  const f=frames.get(m),valid=freshFrame(f,m,n),node=el('vsFrame'+m);
  if(node){node.textContent=valid?dir(f.direction):'SIN DATOS';
   node.dataset.tone=valid?(f.direction==='Alcista'?'bull':f.direction==='Bajista'?'bear':'neutral'):'neutral'}
 }
 const h=frames.get(60),m15=frames.get(15),valid=pxOk&&freshFrame(h,60,n)&&freshFrame(m15,15,n);
 const upper=valid?[h.high,m15.high].filter(x=>Number.isFinite(x)&&x>px).sort((a,b)=>a-b)[0]:null;
 const lower=valid?[h.low,m15.low].filter(x=>Number.isFinite(x)&&x<px).sort((a,b)=>b-a)[0]:null;
 set('vsUpper',cash(upper));set('vsLower',cash(lower));
 set('vsUpperDist',upper&&pxOk?'+'+((upper/px-1)*100).toFixed(2)+'%':'Sin referencia');
 set('vsLowerDist',lower&&pxOk?'-'+((1-lower/px)*100).toFixed(2)+'%':'Sin referencia');
 const snapshot=typeof topSnapshot==='function'?topSnapshot(n):null;
 set('vsFlow',snapshot?.flow?.valid?snapshot.flow.value:'SIN DATOS');
 set('vsOi',snapshot?.oi?.valid?snapshot.oi.value:'SIN DATOS');
 set('vsClock',pxOk?'PRECIO VIGENTE':'SIN PRECIO VIGENTE');
}
function switchView(next){
 if(!['analysis','liquidity','trade'].includes(next))return;
 view=next;
 for(const [id,name] of [['Analysis','analysis'],['Liquidity','liquidity'],['Trade','trade']]){
  const pane=el('vsPane'+id);if(pane)pane.hidden=name!==next;
  const btn=root.document.querySelector('[data-vs-view="'+name+'"]');
  if(btn){btn.setAttribute('aria-selected',String(name===next));btn.classList.toggle('active',name===next)}
 }
 if(next==='analysis')render();
 root.document.dispatchEvent(new CustomEvent('btc:viewchange',{detail:{view:next}}));
 root.scrollTo?.({top:0,behavior:'instant'});
}
function setup(){
 const main=root.document.querySelector('main.wrap'),layout=el('vsRoot');
 if(!main||!layout||layout.dataset.ready)return;
 layout.dataset.ready='yes';
 const original=[...main.children].filter(x=>x!==layout);
 const grids=original.filter(x=>x.classList?.contains('main-grid'));
 const analysis=el('vsPaneAnalysis'),evidence=el('vsAnalysisEvidence'),
  liquidity=el('vsLiquidityMap'),advanced=el('vsAdvancedMarket'),trade=el('vsTradeContent');
 const move=(node,parent)=>{if(node&&parent)parent.appendChild(node)};
 const fold=id=>original.find(x=>x.getAttribute('data-fold-card')===id);
 const price=original.find(x=>x.classList?.contains('row'));
 if(price)analysis.insertBefore(price,el('vsDecisionCard'));
 move(el('manualRadar'),evidence);move(el('manualConfluencePanel'),evidence);
 move(original.find(x=>x.classList?.contains('liquidation-model-card')),liquidity);
 for(const id of ['manual-plan','manual-partials'])move(fold(id),trade);
 move(el('manualJournalPanel'),trade);
 // Los paneles tradicionales se conservan en un único cajón técnico.
 for(const node of original)if(node.parentElement===main)move(node,advanced);
 // Reducir dibujo de gráficos que el usuario no ha pedido mostrar.
 for(const details of advanced.querySelectorAll('details.foldable'))details.open=false;
 for(const details of trade.querySelectorAll('details.foldable'))details.open=false;
 // No cerramos el mapa principal, ni activamos servicios adicionales.
 const brand=root.document.querySelector('header .brand .pill');if(brand)brand.textContent='V5';
 root.document.title='BTC Intelligence V5';
 for(const b of layout.querySelectorAll('[data-vs-view]'))b.addEventListener('click',()=>switchView(b.dataset.vsView));
 for(const b of layout.querySelectorAll('[data-vs-go]'))b.addEventListener('click',()=>switchView(b.dataset.vsGo));
 render();
 root.setInterval(()=>{if(alive&&view==='analysis'&&!root.document.hidden)render()},12000);
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden&&view==='analysis')render()});
 root.addEventListener('pagehide',()=>{alive=false},{once:true});
}
if(root?.document){
 root.BTCVisual={switchView,render};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup()
}
})(typeof window==='undefined'?null:window);
