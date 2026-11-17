/* V6: mapa visual de escenarios OI; bandas son fotografía del modelo ACTUAL, jamás heatmap histórico real. */
(function(root){
'use strict';
const $=id=>root?.document?.getElementById(id);
let active=true,zoom=4;
function prepareChart(price,rows,zones,now=Date.now(),rangePct=4){
 if(!(Number.isFinite(price)&&price>0))return {ok:false,reason:'Sin precio BTC vigente'};
 if(!Array.isArray(rows)||!Array.isArray(zones))return {ok:false,reason:'Faltan velas u observaciones de OI'};
 const raw=new Map();
 for(const row of rows){
  if(!Array.isArray(row))continue;
  const [ts,o,h,l,c]=row.slice(0,5).map(Number);
  if([ts,o,h,l,c].every(Number.isFinite)&&o>0&&l>0&&l<=Math.min(o,c)&&h>=Math.max(o,c)&&ts+300000<=now&&ts>=now-6*3600000)
   raw.set(ts,{ts,o,h,l,c});
 }
 const candles=[...raw.values()].sort((a,b)=>a.ts-b.ts);
 if(candles.length<18||now-(candles.at(-1)?.ts+300000)>900000)
  return {ok:false,reason:'Histórico de velas 5m insuficiente o atrasado'};
 const low=price*(1-rangePct/100),high=price*(1+rangePct/100);
 const filtered=zones.filter(z=>Number.isFinite(z?.level)&&Number.isFinite(z.weight)&&z.weight>0&&
  z.level>=low&&z.level<=high&&((z.side==='short'&&z.level>price)||(z.side==='long'&&z.level<price)));
 const unique=[];
 for(const z of filtered.sort((a,b)=>b.weight-a.weight)){
  if(unique.length>=8)break;
  if(unique.some(x=>x.side===z.side&&Math.abs(x.level-z.level)/price<.003))continue;
  unique.push({level:z.level,weight:z.weight,side:z.side});
 }
 const above=unique.filter(z=>z.side==='short'),below=unique.filter(z=>z.side==='long');
 return {ok:true,price,low,high,candles,zones:unique,above,below,rangePct,
  first:candles[0].ts,last:candles.at(-1).ts,source:'Velas Bybit 5m cerradas; bandas hipotéticas calculadas del OI Bybit 6h actual'};
}
function chooseMajor(zones){return zones.length?zones.reduce((a,b)=>a.weight>=b.weight?a:b):null}
function format(x){return '$'+Math.round(x).toLocaleString('en-US')}
function render(){
 const pane=$('vsPaneLiquidity'),canvas=$('vsLiqCanvas');
 if(!active||!pane||pane.hidden||root.document.hidden||!canvas)return;
 const s=typeof state==='undefined'?null:state,now=Date.now();
 const price=s?.wsOk&&s.lastPriceAt>0&&now-s.lastPriceAt<20000?s.price:NaN;
 const historic=s?.lastHistoryAt>0&&now-s.lastHistoryAt<450000;
 const data=prepareChart(price,historic?s.fiveCandles:[],historic?s.model:[],now,zoom);
 const above=data.ok?chooseMajor(data.above):null,below=data.ok?chooseMajor(data.below):null;
 if($('vsLiqAbove'))$('vsLiqAbove').textContent=above?format(above.level):'—';
 if($('vsLiqBelow'))$('vsLiqBelow').textContent=below?format(below.level):'—';
 if($('vsLiqAbovePct'))$('vsLiqAbovePct').textContent=above?'+'+(100*(above.level/price-1)).toFixed(2)+'% · peso relativo del modelo':'Sin nivel calculable';
 if($('vsLiqBelowPct'))$('vsLiqBelowPct').textContent=below?'-'+(100*(1-below.level/price)).toFixed(2)+'% · peso relativo del modelo':'Sin nivel calculable';
 if($('vsLiqChartStatus'))$('vsLiqChartStatus').textContent=data.ok?
  'Velas Bybit 5m · últimas 6h · bandas: escenario OI actual, NO liquidez real ni historial de liquidaciones':
  data.reason+'. Sin estimaciones inventadas.';
 const rect=canvas.getBoundingClientRect(),w=Math.floor(rect.width),h=Math.floor(rect.height);
 if(w<200||h<200)return;
 const dpr=Math.min(root.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 }
 const c=canvas.getContext('2d');if(!c)return;
 c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 c.fillStyle='#071222';c.fillRect(0,0,w,h);
 if(!data.ok){
  c.fillStyle='#a6c8dc';c.font='13px system-ui';c.fillText('Esperando precio y OI vigentes...',16,h/2);
  return;
 }
 const left=12,right=w-74,top=34,bottom=h-35,plotH=bottom-top;
 const y=v=>top+(data.high-v)/(data.high-data.low)*plotH;
 const tick=()=>{},axisSteps=6;
 c.lineWidth=1;c.font='11px system-ui';
 for(let i=0;i<=axisSteps;i++){
  const p=data.low+(data.high-data.low)*i/axisSteps,yy=y(p);
  c.strokeStyle='rgba(110,140,172,.16)';c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();
  c.fillStyle='#9bb6cf';c.textAlign='left';c.fillText(Math.round(p).toLocaleString('en-US'),right+7,yy+4);
 }
 const max=Math.max(1,...data.zones.map(z=>z.weight));
 for(const z of data.zones){
  const yy=y(z.level),intensity=Math.max(.2,Math.min(1,Math.sqrt(z.weight/max)));
  const upper=z.side==='short',rad=4+intensity*8;
  const grd=c.createLinearGradient(left,0,right,0);
  if(upper){
   grd.addColorStop(0,'rgba(79,38,109,.04)');
   grd.addColorStop(.35,'rgba(127,55,183,'+(.12+.18*intensity)+')');
   grd.addColorStop(1,'rgba(223,80,238,'+(.21+.49*intensity)+')');
  }else{
   grd.addColorStop(0,'rgba(12,95,110,.04)');
   grd.addColorStop(.35,'rgba(21,143,155,'+(.14+.22*intensity)+')');
   grd.addColorStop(1,'rgba(65,241,178,'+(.24+.46*intensity)+')');
  }
  c.fillStyle=grd;c.fillRect(left,yy-rad/2,right-left,rad);
  c.strokeStyle=upper?'rgba(232,120,255,.85)':'rgba(90,243,190,.85)';
  c.lineWidth=1;c.beginPath();c.moveTo(right-37,yy);c.lineTo(right,yy);c.stroke();
 }
 const start=Math.max(now-6*3600000,data.first),end=Math.max(data.last+300000,start+300000);
 const x=ts=>left+(ts-start)/(end-start)*(right-left);
 const candleW=Math.max(2,Math.min(9,(right-left)/Math.max(60,data.candles.length)*.68));
 for(const row of data.candles){
  if(row.ts<start||row.ts>end)continue;
  const xx=x(row.ts),up=row.c>=row.o;
  c.strokeStyle=up?'#89eee0':'#ff7695';c.fillStyle=up?'#8be8d6':'#ff7d9c';
  c.lineWidth=1;c.beginPath();c.moveTo(xx,y(Math.min(data.high,row.h)));
  c.lineTo(xx,y(Math.max(data.low,row.l)));c.stroke();
  const y1=y(Math.min(data.high,Math.max(row.o,row.c)));
  const y2=y(Math.max(data.low,Math.min(row.o,row.c)));
  c.fillRect(xx-candleW/2,Math.min(y1,y2),candleW,Math.max(1,Math.abs(y1-y2)));
 }
 const currentY=y(price);
 c.setLineDash([6,5]);c.strokeStyle='#ffe3a2';c.lineWidth=1.6;c.beginPath();
 c.moveTo(left,currentY);c.lineTo(right,currentY);c.stroke();c.setLineDash([]);
 c.fillStyle='#ffdc8d';c.fillRect(right-1,currentY-10,Math.min(73,w-right),20);
 c.font='bold 11px system-ui';c.fillStyle='#102338';c.textAlign='center';
 c.fillText(Math.round(price).toLocaleString('en-US'),right+35,currentY+4);
 c.font='10px system-ui';c.fillStyle='#829db6';c.textAlign='left';
 c.fillText('Hace 6h',left,bottom+20);
 c.textAlign='right';c.fillText('Ahora',right,bottom+20);
 c.textAlign='left';c.fillStyle='#a7c8e0';c.font='bold 11px system-ui';
 c.fillText('ESCENARIOS ESTIMADOS DE OI · FOTO ACTUAL',left,17);
}
function setup(){
 if(!$('vsLiqCanvas'))return;
 for(const button of root.document.querySelectorAll('[data-vs-zoom]')){
  button.addEventListener('click',()=>{
   zoom=Number(button.dataset.vsZoom)||4;
   for(const other of root.document.querySelectorAll('[data-vs-zoom]'))other.classList.toggle('active',other===button);
   render();
  });
 }
 root.document.addEventListener('btc:viewchange',e=>{if(e.detail?.view==='liquidity')root.requestAnimationFrame?.(render)});
 root.setInterval(()=>{if(active&&!root.document.hidden)render()},15000);
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)render()});
 root.addEventListener('pagehide',()=>{active=false},{once:true});
 render();
}
if(typeof module==='object'&&module.exports)module.exports={prepareChart,chooseMajor};
if(root?.document){
 root.BTCLiqVisual={render};
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup()
}
})(typeof window==='undefined'?null:window);
