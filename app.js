'use strict';
const $=id=>document.getElementById(id);const state={tf:'5',price:0,lastPrice:0,priceAtFirst:0,priceAtTf:0,oi:0,oiFirst:0,oiSource:'',candles:[],candlesTf:'',candleSource:'',candlesRequest:0,liq:[],trades:[],whales:[],longLiq:0,shortLiq:0,bids:new Map(),asks:new Map(),ws:null,liqws:null,restOk:false,wsOk:false,liqOk:false,alerts:[],lastAlerts:new Map(),alertGroups:new Map(),alertReceived:0,alertGrouped:0,alertEscalations:0,lastAlertRenderAt:0,lastAlertCleanupAt:0,lastPriceAt:0,lastBookAt:0,lastLiqAt:0,lastOiAt:0,model:[],threshold:1e6,distance:.3,oiHistory:[],fiveCandles:[],lastHistoryAt:0,sessionCvd:0,sessionStart:Date.now(),tradeIds:new Map(),liqFingerprints:new Map(),tradeDuplicates:0,liqDuplicates:0,tradeRejected:0,liqRejected:0,lastTradeEventTs:0,lastTradeSeq:-1,tradeWindowTruncated:false,liqWindowTruncated:false,printPolicyCache:null,lastFlowPrune:0,oiSeries:[],oiSeriesTf:'',oiSeriesRequest:0,oiSeriesAt:0,oiAligned:null,zoneSeen:new Map(),wallSeen:new Map(),wallQualifiedSince:new Map(),lastBookRenderAt:0,heatSamples:[],lastHeatAt:0,lastTradeRenderAt:0,absorption:null,fundingRate:null,fundingNextAt:0,fundingAt:0,lastFundingRate:null,lastFundingAt:0,lastFundingFetchedAt:0,fundingHistoryRequest:0,ratioLong:null,ratioShort:null,ratioAt:0,ratioTf:'',ratioReq:0,lastLargeAlertAt:0,wallDrops:[],wallDropCooldown:new Map(),wallMetrics:new Map(),wallEvents:[],wallDisappeared:new Map(),wallReappearances:[],wallPolicy:null,wallWatch:new Map(),breakouts:[],breakoutSuppressed:0,lastBreakCheckAt:0,binanceWs:null,binanceBids:[],binanceAsks:[],binanceLastAt:0,binanceReconn:null,lastCompareAt:0,compareTracks:new Map(),compareSampleAt:0,compareSampleBybit:0,compareSampleBinance:0,lastWallArrivalAt:0,lastWallDropAlertAt:0,fngAt:0,fngValue:null,fngPrev:null,hourlySlot:-1,hourlyInFlight:false,hourlyAt:0,hourlyWindowEnd:0,oiRelevance:null};
const cash=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n):'—';const usd=n=>Number.isFinite(n)?'$'+cash(n):'—';const pct=n=>Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'—';const time=ms=>new Date(ms).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const dateTime=ms=>new Date(ms).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});const status=(id,label,ok)=>{$(id).textContent=label;$(id).className=ok?'up':'gold'};const asNum=n=>{let v=Number(n);return Number.isFinite(v)?v:0};
// Alert priorities reflect OBSERVED magnitude and evidential source, never
// a directional recommendation, win probability or trading instruction.
const ALERT_PRIORITY={info:1,medium:2,high:3};
function alertPriority(meta={},total=0){
 const k=meta.kind||'generic';
 const baseline=Number(meta.baseline)>0?Number(meta.baseline):100000;
 const value=Math.max(0,Number(meta.amount)||0,total);
 const ratio=value/baseline;
 if(k==='zone')return {rank:1,name:'INFORMATIVA',reason:'Zona hipotética, no liquidación observada'};
 if(k==='absorption'){
  const share=Number(meta.share)||0;
  const volume=Number(meta.amount)||0;
  return share>=.82&&volume>=1500000?{rank:3,name:'ALTA',reason:'Desequilibrio y volumen observados'}:
   share>=.70&&volume>=500000?{rank:2,name:'MEDIA',reason:'Presión relativa con muestra suficiente'}:
   {rank:1,name:'INFORMATIVA',reason:'Señal de flujo cualitativa'}
 }
 if(k==='whale'||k==='sequence'){
  return ratio>=4?{rank:3,name:'ALTA',reason:'Volumen ≥4 veces el umbral de referencia'}:
   ratio>=1.5?{rank:2,name:'MEDIA',reason:'Volumen superior al umbral de referencia'}:
   {rank:1,name:'INFORMATIVA',reason:'Evento sobre el umbral mínimo'}
 }
 if(k==='wall-drop'||k==='wall-arrive'){
  return ratio>=2.5?{rank:3,name:'ALTA',reason:'Liquidez observada ≥2,5 veces la referencia'}:
   ratio>=1.2?{rank:2,name:'MEDIA',reason:'Liquidez observada superior a referencia'}:
   {rank:1,name:'INFORMATIVA',reason:'Nivel visible observado'}
 }
 return {rank:1,name:'INFORMATIVA',reason:'Evento descriptivo'}
}
function alertWindow(kind,limit){
 if(kind==='whale')return 30000;
 if(kind==='sequence')return 90000;
 if(kind==='wall-arrive')return 600000;
 if(kind==='wall-drop')return 180000;
 if(kind==='absorption')return 120000;
 if(kind==='zone')return 300000;
 return Math.max(1000,limit||60000)
}
function alertGroupKey(key,meta={}){
 if(meta.kind==='whale'||meta.kind==='sequence'){
  const price=Number(meta.price);
  const width=price>0?Math.max(10,Math.round(price*.0005/5)*5):25;
  return meta.kind+':'+(meta.side||'unknown')+':'+Math.round(price/width)*width
 }
 return key
}
function pruneAlertGroups(now=Date.now()){
 if(now-state.lastAlertCleanupAt<30000&&state.alertGroups.size<=220)return;
 state.lastAlertCleanupAt=now;
 for(const [k,g] of state.alertGroups){
  if(now-g.lastSeen>Math.max(60000,g.windowMs*2))state.alertGroups.delete(k)
 }
 if(state.alertGroups.size>220){
  const items=[...state.alertGroups].sort((a,b)=>a[1].lastSeen-b[1].lastSeen);
  for(const [k] of items.slice(0,state.alertGroups.size-220))state.alertGroups.delete(k)
 }
}
function resetLiveAlertGrouping(){
 // The alert feed remains as history, but a reconnect cannot certify that
 // trades or resting liquidity remained continuous during the gap.
 for(const [key,group] of state.alertGroups){
  if(group.kind!=='zone'&&group.kind!=='generic')state.alertGroups.delete(key)
 }
}
function renderAlerts(now=Date.now(),force=false){
 if(!force&&now-state.lastAlertRenderAt<1000)return;
 state.lastAlertRenderAt=now;
 const target=$('alerts');if(!target)return;
 const ranked=[...state.alerts].sort((a,b)=>b.priority.rank-a.priority.rank||b.lastImportantAt-a.lastImportantAt);
 const latest=state.alerts[0];
 const rows=ranked.slice(0,12);
 if(latest&&!rows.includes(latest)){rows.pop();rows.push(latest)}
 target.innerHTML=rows.map(a=>'<div class="alertrow alert-tier-'+a.priority.rank+'">'+
  '<span class="alert-label alert-label-'+a.priority.rank+'">'+escapeHtml(a.priority.name)+'</span> '+
  '<span class="muted">'+time(a.lastImportantAt)+'</span> · '+
  escapeHtml(a.text)+
  (a.count>1?' · '+a.count+' observaciones relacionadas':'')+
  '<div class="sub">'+escapeHtml(a.priority.reason)+' · '+escapeHtml(a.source)+'</div></div>').join('')||
  '<div class="empty">No hay alertas registradas en esta sesión.</div>';
 $('alertsSummary').textContent=rows.length+' alertas visibles · '+state.alertReceived+
  ' observaciones consideradas · '+state.alertGrouped+' agrupadas sin nueva tarjeta · '+
  state.alertEscalations+' aumentos materiales destacados. Prioridad: ALTA, MEDIA, INFORMATIVA; último evento nuevo siempre visible.'
}
function alertUser(txt,key,limit=60000,meta={}){
 if(!key||typeof key!=='string'||!txt)return false;
 const now=Date.now(),kind=meta.kind||'generic',groupKey=alertGroupKey(key,meta),windowMs=alertWindow(kind,limit);
 let group=state.alertGroups.get(groupKey);
 const newGroup=!group||now-group.lastSeen>windowMs||now<group.lastSeen;
 if(newGroup){
  group={key:groupKey,kind,firstAt:now,lastSeen:now,windowMs,total:0,count:0,
   eventTotals:new Map(),lastNoticeTotal:0,lastNoticeRank:0,lastNoticeAt:0,
   maxObserved:0,lastNoticeMax:0,record:null};
  state.alertGroups.set(groupKey,group)
 }
 const amount=Number.isFinite(Number(meta.amount))&&Number(meta.amount)>0?Number(meta.amount):0;
 // Snapshot events (e.g. a sequence still in progress) add only the increment.
 // Individual trades are unique by Bybit trade ID and cannot be double counted.
 const eventId=meta.eventId||key;
 const prior=group.eventTotals.get(eventId);
 const isNewEvent=prior===undefined;
 const incremental=isNewEvent?amount:Math.max(0,amount-prior);
 if(!isNewEvent&&incremental===0){
  group.lastSeen=now;
  return false
 }
 if(isNewEvent)group.count++;
 if(incremental>0)group.total+=incremental;
 if(amount>group.maxObserved)group.maxObserved=amount;
 group.eventTotals.set(eventId,Math.max(amount,prior||0));
 if(group.eventTotals.size>250){
  // Bound memory: the total already holds accepted event amounts.
  while(group.eventTotals.size>250)group.eventTotals.delete(group.eventTotals.keys().next().value)
 }
 group.lastSeen=now;state.alertReceived++;
 const priority=alertPriority(meta,group.total);
 const baseline=Math.max(100000,Number(meta.baseline)||100000);
 const first=!group.record||newGroup;
 const volumeNew=group.total>=Math.max(group.lastNoticeTotal*1.8,group.lastNoticeTotal+baseline*2);
 const peakNew=amount>=Math.max(group.lastNoticeMax*2,baseline*3);
 const independent=(kind==='sequence'||kind==='wall-drop'||kind==='wall-arrive'||kind==='absorption')&&isNewEvent;
 const material=first||independent||priority.rank>group.lastNoticeRank||volumeNew||peakNew;
 const label=kind==='whale'?
  (meta.side==='Buy'?'Compras':'Ventas')+' agresivas agrupadas cerca de '+usd(meta.price)+
  ' · '+group.count+' '+(group.count===1?'operación':'operaciones')+' · '+usd(group.total)+' acumulados (umbral por ejecución '+usd(meta.baseline)+')':
  kind==='sequence'?
  'Rachas '+(meta.side==='Buy'?'compradoras':'vendedoras')+' cerca de '+usd(meta.price)+
   ' · '+group.count+' '+(group.count===1?'racha':'rachas')+' · '+usd(group.total)+' acumulados (no identifica operador)':
  kind==='wall-drop'&&group.count>1?
   txt+' · '+usd(group.total)+' en '+group.count+' reducciones observadas':
   txt;
 const source=meta.source||'BTCUSDT · datos observados';
 let record=group.record;
 if(first){
  record={groupKey,text:label,priority,source,count:group.count,ts:now,lastImportantAt:now};
  group.record=record
 }else{
  record.text=label;record.count=group.count;record.source=source;
  if(priority.rank>=record.priority.rank)record.priority=priority
 }
 if(material){
  record.lastImportantAt=now;
  group.lastNoticeAt=now;group.lastNoticeTotal=group.total;
  group.lastNoticeRank=priority.rank;group.lastNoticeMax=group.maxObserved;
  if(!first)state.alertEscalations++;
  state.alerts=state.alerts.filter(a=>a!==record);
  state.alerts.unshift(record);
  // Retain recent material changes AND a few older high/medium alerts, so a
  // burst of informational events cannot erase every important observation.
  const recent=state.alerts.slice(0,12);
  const high=state.alerts.filter(a=>a.priority.rank===3).slice(0,6);
  const medium=state.alerts.filter(a=>a.priority.rank===2).slice(0,6);
  state.alerts=[...new Set([...recent,...high,...medium])].slice(0,24);
 }else state.alertGrouped++;
 pruneAlertGroups(now);
 renderAlerts(now,material);
 renderTopSnapshot(now,material);
 return material
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function model(){
 const p=state.price,oi=state.oiHistory,candles=state.fiveCandles;
 if(!p||oi.length<2||!candles.length){state.model=[];draw();$('mapnote').textContent='Sin historial suficiente de Open Interest y velas 5m. No se generan zonas ficticias.';return}
 const candleByStart=new Map(candles.filter(k=>Array.isArray(k)).map(k=>[Number(k[0]),k]));
 const cutoff=Date.now()-Number(state.tf)*60000,buckets=new Map(),levs=[10,25,50],step=p*.002;
 let used=0,added=0;
 for(let i=1;i<oi.length;i++){
  const prev=oi[i-1],cur=oi[i],inc=cur.v-prev.v;
  if(cur.ts<cutoff||cur.ts>Date.now()||inc<=0||Math.abs(cur.ts-prev.ts-300000)>30000)continue;
  const candle=closedPriceCandle([candleByStart.get(prev.ts)],prev.ts,cur.ts,Date.now());
  const anchor=candle?.close;
  if(!(anchor>0))continue;
  used++;added+=inc;
  for(const lev of levs)for(const side of ['long','short']){
   const level=anchor*(side==='long'?1-.92/lev:1+.92/lev);
   const bucket=Math.round(level/step),key=side+':'+bucket;
   const z=buckets.get(key)||{side,level:bucket*step,weight:0};
   z.weight+=inc/(levs.length*2);buckets.set(key,z);
  }
 }
 state.model=[...buckets.values()].filter(z=>Number.isFinite(z.level)&&z.weight>0);
 $('mapnote').textContent=used
  ?'Modelo histórico: '+used+' intervalos con aumento neto de OI ('+cash(added)+' BTC), anclados al precio de Bybit. Apalancamiento 10x/25x/50x supuesto; distribución por lado desconocida. No son posiciones observadas ni precios de liquidación reales.'
  :'Sin aumentos netos de Open Interest detectados durante esta ventana. No se inventan concentraciones.';
 draw();
 for(const z of state.model){if(state.distance>0&&Math.abs(z.level/p-1)*100<state.distance)alertUser('Cerca de nivel hipotético '+z.side+' '+usd(z.level),'zone-'+z.side+':'+Math.round(z.level/step),300000,
  {kind:'zone',side:z.side,price:z.level,amount:z.weight,baseline:1,eventId:z.side+':'+Math.round(z.level/step),source:'Modelo hipotético OI; no liquidación real'})}
}
function draw(){
 const canvas=$('heat'),rect=canvas.parentElement.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(250,rect.width),h=Math.max(240,rect.height);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const c=canvas.getContext('2d');c.scale(dpr,dpr);c.fillStyle='#0b1425';c.fillRect(0,0,w,h);
 const p=state.price;
 if(!p){c.font='12px system-ui';c.fillStyle='#a5b8ce';c.fillText('Esperando precio...',12,h/2);return}
 const min=p*.885,max=p*1.115,yFor=v=>h-24-(v-min)/(max-min)*(h-48);
 for(let i=0;i<5;i++){
  const price=max-(max-min)*i/4,y=yFor(price);
  c.strokeStyle='#23334a';c.lineWidth=.7;c.beginPath();c.moveTo(6,y);c.lineTo(w-5,y);c.stroke();
  c.fillStyle='#8698ad';c.font='10px system-ui';c.textAlign='right';c.fillText('$'+cash(price),w-6,Math.max(12,y-5));
 }
 const candidates=state.model.filter(z=>z.level>=min&&z.level<=max).sort((a,b)=>b.weight-a.weight),picked=[];
 for(const z of candidates){
  const y=yFor(z.level);
  if(picked.length>=8)break;
  if(Math.abs(y-yFor(p))<17||picked.some(x=>Math.abs(y-yFor(x.level))<21))continue;
  picked.push(z)
 }
 const biggest=Math.max(1,...picked.map(z=>z.weight));
 for(const z of picked){
  const y=yFor(z.level),length=Math.max(34,(w-110)*(.23+.76*Math.sqrt(z.weight/biggest)));
  const g=c.createLinearGradient(15,y,15+length,y);
  g.addColorStop(0,'rgba(250,207,86,.04)');g.addColorStop(1,'rgba(250,207,86,.9)');
  c.fillStyle=g;c.fillRect(15,y-6,length,12);
  c.fillStyle=z.side==='long'?'#a5e1c9':'#f0abb7';c.font='bold 10px system-ui';c.textAlign='left';c.fillText(z.side==='long'?'L':'S',6,y-9);
  c.fillStyle='#f6e9c4';c.font='11px system-ui';c.textAlign='right';c.fillText('$'+cash(z.level),w-6,y+4);
 }
 const y=yFor(p);c.strokeStyle='#67d8f2';c.setLineDash([5,4]);c.lineWidth=1.5;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();c.setLineDash([]);
 c.fillStyle='#123849';c.fillRect(w-102,y-16,102,18);c.fillStyle='#d3f7ff';c.textAlign='right';c.font='bold 11px system-ui';c.fillText('BTC $'+cash(p),w-6,y-3);c.textAlign='left';
 if(!picked.length){c.fillStyle='#a5b8ce';c.font='12px system-ui';c.fillText('Sin niveles estimables en este intervalo',12,h*.25)}
}

function activeBybitCandle(now=Date.now()){
 if(state.candleSource!=='Bybit'||state.candlesTf!==state.tf)return null;
 const start=Math.floor(now/(Number(state.tf)*60000))*(Number(state.tf)*60000);
 return state.candles.find(c=>Number(c[0])===start&&Number(c[1])>0)||null;
}
function renderPrice(){if(!state.price)return;$('price').textContent=usd(state.price);$('lastTick').textContent='Última operación: '+time(state.lastPriceAt);$('clock').textContent='Ahora '+time(Date.now());$('priceDelta').textContent=state.priceAtFirst?pct((state.price/state.priceAtFirst-1)*100):'—';const c=activeBybitCandle();$('change').textContent=c?pct((state.price/Number(c[1])-1)*100):'—'}

function renderLiq(now=Date.now()){
 const win90=liquidationWindow(90000,now),win5=liquidationWindow(300000,now);
 $('liqLong').textContent=usd(state.longLiq);$('liqShort').textContent=usd(state.shortLiq);
 $('liq90Detail').textContent='90 s · longs '+usd(win90.long)+' / shorts '+usd(win90.short)+
   ' · '+win90.count+' eventos observados';
 $('liq5Detail').textContent='5 min · longs '+usd(win5.long)+' / shorts '+usd(win5.short)+
   ' · '+win5.count+' eventos observados';
 $('liqDedupStatus').textContent='Repeticiones aproximadas '+state.liqDuplicates+
   ' · inválidas/atrasadas '+state.liqRejected+
   (state.liqWindowTruncated?' · eventos en memoria acotados':'')+
   ' · sin ID único, coincidencias exactas pueden corresponder a eventos distintos';
 const rows=state.liq.filter(x=>now-x.ts>=0&&now-x.ts<300000)
   .sort((a,b)=>b.ts-a.ts).slice(0,12);
 $('events').innerHTML=rows.map(x=>'<div class="alertrow"><span class="'+
  (x.side==='long'?'down':'up')+'">'+x.side.toUpperCase()+'</span> · '+usd(x.notional)+
  ' · '+usd(x.price)+' · <span class="muted">'+time(x.ts)+'</span></div>').join('')||
  '<div class="empty">Todavía no se han recibido liquidaciones públicas en los últimos 5 minutos.</div>'
}
function wallAge(ms){let sec=Math.max(0,Math.floor(ms/1000));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}
function renderBook(){
 const now=Date.now();
 if(now-state.lastBookAt>30000){
  $('bigBid').textContent='—';$('bigAsk').textContent='—';$('bidSize').textContent='—';$('askSize').textContent='—';
  $('walls').innerHTML='<tr><td colspan="4">Libro desconectado o caducado</td></tr>';
  $('wallSummary').textContent='Sin observaciones vigentes';
  return
 }
 const levels=[...state.bids].map(([p,q])=>({p:+p,q:+q,side:'Compra',key:'B:'+p})).concat([...state.asks].map(([p,q])=>({p:+p,q:+q,side:'Venta',key:'A:'+p})))
  .filter(x=>x.p>0&&x.q>0).map(x=>({...x,v:x.p*x.q,age:now-(state.wallSeen.get(x.key)||now)}));
 levels.sort((a,b)=>b.v-a.v);
 const bid=levels.find(x=>x.side==='Compra'),ask=levels.find(x=>x.side==='Venta');
 $('bigBid').textContent=bid?usd(bid.p):'—';$('bidSize').textContent=bid?usd(bid.v)+' · visible '+wallAge(bid.age):'Sin datos';
 $('bigAsk').textContent=ask?usd(ask.p):'—';$('askSize').textContent=ask?usd(ask.v)+' · visible '+wallAge(ask.age):'Sin datos';
 const persistent=levels.filter(x=>x.age>=60000);
 $('wallSummary').textContent='Visibles ≥1 min: '+persistent.filter(x=>x.side==='Compra').length+' compras / '+persistent.filter(x=>x.side==='Venta').length+' ventas · solo 200 niveles por lado';
 $('walls').innerHTML=levels.slice(0,7).map(x=>'<tr><td class="'+(x.side==='Compra'?'up':'down')+'">'+x.side+'</td><td>'+usd(x.p)+'</td><td>'+usd(x.v)+'</td><td class="'+(x.age>=60000?'up':'')+'">'+wallAge(x.age)+'</td></tr>').join('')||'<tr><td colspan="4">Sin datos</td></tr>'
}

// Bybit L2 only: observed resting orders. Samples are captured in this browser,
// never backfilled, and are intentionally capped at 72 x 100 levels for mobile.
// Real-time L2 historical heatmap: chronological snapshots only while visible.
// Fixed prices, never re-center previous quantities onto the newest price.
const HEAT_SAMPLE_MS=5000,HEAT_MAX_SAMPLES=72,HEAT_WINDOW_MS=HEAT_SAMPLE_MS*HEAT_MAX_SAMPLES;
const HEAT_ROWS=34,HEAT_CAPTURE_BINS=160;
function heatBucketWidth(price){
 return Math.max(2,Math.round(price*.00012/2)*2)
}
function compressHeatSide(book,price){
 const step=heatBucketWidth(price),min=price*.987,max=price*1.013,bins=new Map();
 for(const [rawPrice,rawQty] of book){
  const p=Number(rawPrice),q=Number(rawQty);
  if(!(p>0&&q>0&&p>=min&&p<=max))continue;
  const bucket=Math.round(p/step);
  bins.set(bucket,(bins.get(bucket)||0)+p*q)
 }
 // Retain most relevant buckets in bounded form; each stored center is ABSOLUTE.
 return [...bins].map(([bucket,value])=>[bucket*step,value])
  .sort((a,b)=>b[1]-a[1]).slice(0,HEAT_CAPTURE_BINS)
  .sort((a,b)=>a[0]-b[0])
}
function pruneHeat(now=Date.now()){
 state.heatSamples=state.heatSamples.filter(s=>now-s.ts<=HEAT_WINDOW_MS&&s.ts<=now+1000);
 if(state.heatSamples.length>HEAT_MAX_SAMPLES)state.heatSamples=state.heatSamples.slice(-HEAT_MAX_SAMPLES)
}
function captureLiquidityHeat(){
 const now=Date.now();
 if(document.hidden||!state.wsOk||now-state.lastBookAt>12000||now-state.lastPriceAt>30000||!state.price)return;
 const sample={ts:now,price:state.price,bids:compressHeatSide(state.bids,state.price),asks:compressHeatSide(state.asks,state.price)};
 if(state.heatSamples.length&&sample.ts<=state.heatSamples.at(-1).ts)return;
 state.heatSamples.push(sample);pruneHeat(now);state.lastHeatAt=now;
 drawLiquidityHeat()
}
// Pure geometry for deterministic tests and browser drawing.
function heatGeometry(samples,currentPrice){
 const anchors=samples.map(s=>s.price).filter(x=>x>0&&Number.isFinite(x));
 if(currentPrice>0&&Number.isFinite(currentPrice))anchors.push(currentPrice);
 if(!anchors.length)return null;
 const lower=Math.min(...anchors),upper=Math.max(...anchors);
 const margin=Math.max(currentPrice*.0011,(upper-lower)*.20);
 const min=lower-margin,max=upper+margin;
 return {min,max,step:(max-min)/HEAT_ROWS,rows:HEAT_ROWS,
  priceRow:p=>Math.floor((max-p)/(max-min)*HEAT_ROWS),
  yRatio:p=>(max-p)/(max-min)}
}
function heatIntensity(volume,scale){
 if(!(volume>0)||!(scale>0))return 0;
 // Logarithmic transform prevents one very large wall from drowning other levels.
 return Math.min(.95,.13+.82*Math.log1p(volume)/Math.log1p(scale))
}
function drawLiquidityHeat(){
 const canvas=$('liquidityHeat');if(!canvas)return;
 const now=Date.now();
 pruneHeat(now);
 if(document.hidden)return;
 const width=Math.max(240,Math.round(canvas.parentElement.getBoundingClientRect().width)),
 height=Math.max(205,Math.round(canvas.parentElement.getBoundingClientRect().height)),
 dpr=Math.min(window.devicePixelRatio||1,2),pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){
  canvas.width=pixelWidth;canvas.height=pixelHeight
 }
 const c=canvas.getContext('2d');if(!c)return;
 c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#091322';c.fillRect(0,0,width,height);
 const samples=state.heatSamples;
 if(!samples.length){
  c.fillStyle='#9cb0c8';c.font='12px system-ui';c.fillText('Reuniendo muestras del libro en vivo...',14,height/2);
  $('liquidityHeatStamp').textContent='Historial solo con la página abierta, sin reconstrucción artificial';return
 }
 const geom=heatGeometry(samples,state.price);if(!geom)return;
 const x0=8,y0=15,axisWidth=70,chartWidth=width-axisWidth-x0,chartHeight=height-44;
 const rowHeight=chartHeight/HEAT_ROWS,windowStart=Math.max(now-HEAT_WINDOW_MS,samples[0].ts-HEAT_SAMPLE_MS);
 const timeSpan=Math.max(HEAT_SAMPLE_MS,now-windowStart);
 const xAt=t=>x0+(t-windowStart)/timeSpan*chartWidth;
 const colWidth=Math.max(1,Math.min(chartWidth/HEAT_MAX_SAMPLES,chartWidth*HEAT_SAMPLE_MS/timeSpan));
 const histogram=[],quantities=[],gaps=[];
 for(let i=0;i<samples.length;i++){
  const snap=samples[i],rows=Array.from({length:HEAT_ROWS},()=>[0,0]);
  for(const [book,side] of [[snap.bids,0],[snap.asks,1]]){
   for(const [price,value] of book){
    const row=geom.priceRow(price);
    if(row>=0&&row<HEAT_ROWS&&Number.isFinite(value)&&value>0)rows[row][side]+=value
   }
  }
  histogram.push(rows);
  for(const [buy,sell] of rows){if(buy>0)quantities.push(buy);if(sell>0)quantities.push(sell)}
  if(i>0&&snap.ts-samples[i-1].ts>HEAT_SAMPLE_MS*1.8)gaps.push(snap.ts-samples[i-1].ts)
 }
 quantities.sort((a,b)=>a-b);
 const scale=Math.max(1,quantities[Math.floor((quantities.length-1)*.90)]||1);
 for(let i=0;i<samples.length;i++){
  const snap=samples[i],x=xAt(snap.ts);
  if(x<0||x>=width-axisWidth+1)continue;
  const rows=histogram[i];
  for(let r=0;r<HEAT_ROWS;r++){
   const [b,a]=rows[r],value=Math.max(b,a);
   if(!value)continue;
   const y=y0+r*rowHeight,cellW=Math.max(.8,colWidth-.5),cellH=Math.max(.5,rowHeight-.6);
   // Both sides can coexist at the same price bucket: split the cell vertically.
   if(b>0&&a>0){
    c.fillStyle='rgba(52,213,161,'+heatIntensity(b,scale)+')';c.fillRect(x,y,cellW,cellH/2);
    c.fillStyle='rgba(250,107,132,'+heatIntensity(a,scale)+')';c.fillRect(x,y+cellH/2,cellW,cellH/2)
   }else{
    c.fillStyle=b>0?'rgba(52,213,161,'+heatIntensity(b,scale)+')':'rgba(250,107,132,'+heatIntensity(a,scale)+')';
    c.fillRect(x,y,cellW,cellH)
   }
  }
 }
 // Transparent areas without samples are gaps, NOT zero-liquidity observations.
 c.strokeStyle='#26364a';c.lineWidth=.7;c.font='10px system-ui';c.textAlign='right';
 for(let r=0;r<=HEAT_ROWS;r+=Math.max(1,Math.floor(HEAT_ROWS/4))){
  const y=y0+r*rowHeight,v=geom.max-r*geom.step;
  c.beginPath();c.moveTo(x0,y);c.lineTo(width-axisWidth+4,y);c.stroke();
  c.fillStyle='#93abc5';c.fillText('$'+cash(v),width-3,Math.min(height-27,y+3))
 }
 const yPrice=y0+geom.yRatio(state.price)*chartHeight;
 if(yPrice>=y0&&yPrice<y0+chartHeight){
  c.strokeStyle='#62d6ed';c.lineWidth=1.2;c.setLineDash([3,3]);
  c.beginPath();c.moveTo(x0,yPrice);c.lineTo(width-axisWidth+3,yPrice);c.stroke();c.setLineDash([])
 }
 const fmt=ts=>new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
 c.font='10px system-ui';c.fillStyle='#9cb0c8';c.textAlign='left';
 // Tick labels reflect actual time, not sample ordinal.
 const tickCount=3;
 for(let i=0;i<tickCount;i++){
  const ts=windowStart+timeSpan*i/(tickCount-1),x=xAt(ts);
  c.textAlign=i===0?'left':i===tickCount-1?'right':'center';
  c.fillText(fmt(ts),x,height-5)
 }
 const duration=(samples.at(-1).ts-samples[0].ts)/60000;
 $('liquidityHeatStamp').textContent=samples.length+' muestras / '+duration.toFixed(1)+
  ' min de alcance · paso nominal 5 s · hora local · precios absolutos · intensidad logarítmica relativa';
 if(gaps.length)$('liquidityHeatStamp').textContent+=' · '+gaps.length+' hueco(s) sin reconstruir';
 if(now-state.lastHeatAt>15000)$('liquidityHeatStamp').textContent+=' · captura pausada';
}

// Heuristic, not proof of a passive order or a specific whale: compare aggressor
// side imbalance against actual price displacement over the same 90-second sample.

function evaluateAbsorption(now=Date.now()){
 if(now-state.lastPriceAt>20000||!state.wsOk){
  $('absorptionStatus').textContent='Datos recientes no disponibles';
  $('absorptionDetail').textContent='Se requieren operaciones Bybit recientes y sus horas de ejecución';
  return
 }
 const w=flowWindow(tradesWithin(90000,now));
 if(w.count<12||w.duration<25000||w.total<500000){
  $('absorptionStatus').textContent='Reuniendo datos (90 s)';
  $('absorptionDetail').textContent='Ventana móvil 90 s: mínimo 25 s observados, 12 ejecuciones y US$500.000';
  return
 }
 const share=Math.max(w.buy,w.sell)/w.total;
 const tolerance=Math.max(.025,Math.min(.12,w.rangePct*.25));
 const buyAbsorption=share>=.68&&w.sell>w.buy&&w.movePct>=-tolerance;
 const sellAbsorption=share>=.68&&w.buy>w.sell&&w.movePct<=tolerance;
 const sideText=w.buy>w.sell?'compras':'ventas';
 if(buyAbsorption){
  $('absorptionStatus').textContent='Posible absorción compradora';
  $('absorptionStatus').className='num up'
 }else if(sellAbsorption){
  $('absorptionStatus').textContent='Posible absorción vendedora';
  $('absorptionStatus').className='num down'
 }else{
  $('absorptionStatus').textContent='Sin absorción destacable';
  $('absorptionStatus').className='num'
 }
 $('absorptionDetail').textContent=(100*share).toFixed(0)+'% '+sideText+
  ' agresivas · '+usd(w.total)+' en '+Math.round(w.duration/1000)+' s; cambio BTC '+pct(w.movePct)+
  ' (mismos primeros y últimos trades); rango '+pct(w.rangePct)+
  ', tolerancia de desplazamiento '+tolerance.toFixed(3)+'%. Descripción, no prueba de órdenes ocultas.';
 if(buyAbsorption||sellAbsorption){
  alertUser('Posible absorción '+(buyAbsorption?'compradora':'vendedora')+
   ' · presión '+(share*100).toFixed(0)+'% · BTC '+pct(w.movePct),
   'absorption-'+(buyAbsorption?'buy':'sell'),180000,
    {kind:'absorption',side:buyAbsorption?'buy':'sell',amount:w.total,baseline:500000,share,
     eventId:'90s-'+Math.floor(now/90000),source:'Bybit operaciones · misma ventana 90 s'})
 }
}
// Large prints are public tape records, not identified wallets or unique traders.
// "Sequence" means multiple trades in the same aggressor direction, NOT one whale.

function renderAdvancedWhales(now=Date.now()){
 const root=$('largeFlow');if(!root)return;
 const r=evaluateTradeSequences(now),p=r.policy;
 const buyer=r.large.filter(t=>t.buy).reduce((a,t)=>a+t.usdt,0);
 const seller=r.large.filter(t=>!t.buy).reduce((a,t)=>a+t.usdt,0);
 $('largeBuy').textContent=usd(buyer)+' · '+r.large.filter(t=>t.buy).length+' ejec.';
 $('largeSell').textContent=usd(seller)+' · '+r.large.filter(t=>!t.buy).length+' ejec.';
 $('largeFlowThreshold').textContent='Umbral relativo '+usd(p.printMin)+' por ejecución; racha desde '+
  usd(p.sequenceMin)+' · '+(p.provisional?'calibración inicial con mínimo de seguridad':'referencia P95 de 5 min');
 if(!state.wsOk||now-state.lastPriceAt>20000){
  $('largeFlowStatus').textContent='Datos de operaciones no disponibles';
  root.innerHTML='<div class="empty">Esperando flujo en vivo.</div>';return
 }
 const sequences=r.grouped.sort((a,b)=>b.at(-1).ts-a.at(-1).ts);
 $('largeFlowStatus').textContent=sequences.length+' racha(s) observada(s) · '+
  r.isolated.length+' operaciones grandes no agrupadas (90 s)';
 const rows=sequences.slice(0,4).map(group=>{
  const value=group.reduce((a,t)=>a+t.usdt,0),first=group[0],last=group.at(-1);
  return '<div class="alertrow"><strong>RACHA '+(first.buy?'COMPRADORA':'VENDEDORA')+
   '</strong> · '+group.length+' ejec. · '+usd(value)+' · '+wallAge(last.ts-first.ts)+
   ' · '+usd(first.price)+' → '+usd(last.price)+'</div>'
 });
 for(const t of r.isolated.sort((a,b)=>b.ts-a.ts).slice(0,3)){
  rows.push('<div class="alertrow">Aislada '+(t.buy?'COMPRA':'VENTA')+' · '+
   usd(t.usdt)+' · '+usd(t.price)+' · '+time(t.ts)+'</div>')
 }
 root.innerHTML=rows.join('')||'<div class="empty">Sin operaciones grandes ni rachas observadas en 90 s.</div>';
 if(sequences.length){
  const g=sequences[0],value=g.reduce((a,t)=>a+t.usdt,0);
  alertUser('Racha '+(g[0].buy?'compradora':'vendedora')+' · '+
   g.length+' operaciones; '+usd(value)+' (sin identificar operador)',
   'large-flow-'+(g[0].buy?'buy':'sell'),300000,
   {kind:'sequence',side:g[0].buy?'Buy':'Sell',price:g[0].price,
    amount:value,baseline:p.sequenceMin,eventId:g[0].id,
    source:'Bybit publicTrade · racha, no identidad de operador'})
 }
}
const tfPeriod=()=>({'5':'5min','15':'15min','30':'30min','60':'1h','240':'4h'})[state.tf];
const finiteNum=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;

async function getFunding(){
 const request=++state.fundingHistoryRequest,now=Date.now();
 const [current,history]=await Promise.allSettled([
  req('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'),
  req('https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=2')
 ]);
 if(request!==state.fundingHistoryRequest)return;
 if(current.status==='fulfilled'){
  const d=current.value,row=d.retCode===0?d.result?.list?.[0]:null;
  const val=finiteNum(row?.fundingRate),next=finiteNum(row?.nextFundingTime);
  if(val!==null&&Math.abs(val)<.2&&next&&next>now&&next<=now+86400000){
   state.fundingRate=val;state.fundingNextAt=next;state.fundingAt=Date.now();
   $('fundingCurrent').textContent=(val>=0?'+':'')+(val*100).toFixed(4)+'%';
   $('fundingNext').textContent='Indicativa para '+dateTime(next)+' · Bybit tickers · consultada '+time(state.fundingAt)+
    ' · puede variar antes del pago'
  }else{
   state.fundingRate=null;state.fundingAt=0;state.fundingNextAt=0;
   $('fundingCurrent').textContent='—';$('fundingNext').textContent='Bybit tickers · tasa indicativa no disponible'
  }
 }else{
  state.fundingRate=null;state.fundingAt=0;state.fundingNextAt=0;
  $('fundingCurrent').textContent='—';$('fundingNext').textContent='Bybit tickers · consulta fallida'
 }
 if(history.status==='fulfilled'){
  const d=history.value,row=d.retCode===0?d.result?.list?.[0]:null;
  const val=finiteNum(row?.fundingRate),ts=finiteNum(row?.fundingRateTimestamp);
  if(val!==null&&Math.abs(val)<.2&&ts&&ts<=Date.now()&&Date.now()-ts<86400000){
   state.lastFundingRate=val;state.lastFundingAt=ts;state.lastFundingFetchedAt=Date.now();
   $('fundingPrevious').textContent=(val>=0?'+':'')+(val*100).toFixed(4)+'%';
   $('fundingPreviousStamp').textContent='Liquidación histórica '+dateTime(ts)+' · Bybit funding/history · consultada '+time(state.lastFundingFetchedAt);
  }else{
   state.lastFundingRate=null;state.lastFundingAt=0;state.lastFundingFetchedAt=0;
   $('fundingPrevious').textContent='—';$('fundingPreviousStamp').textContent='Bybit funding/history · último pago no verificable'
  }
 }else{
  state.lastFundingRate=null;state.lastFundingAt=0;state.lastFundingFetchedAt=0;
  $('fundingPrevious').textContent='—';$('fundingPreviousStamp').textContent='Bybit funding/history · consulta fallida'
 }
 renderMarketSummary();renderSourceFreshness()
}
async function getAccountRatio(){
 const tf=state.tf,period=tfPeriod(),request=++state.ratioReq;
 if(state.ratioTf!==tf){state.ratioTf=tf;state.ratioLong=null;state.ratioShort=null;state.ratioAt=0;
  $('accountLong').textContent='—';$('accountShort').textContent='—';
  $('accountRatioStamp').textContent='Bybit · actualizando muestras '+period;}
 try{
  const d=await req('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period='+period+'&limit=2');
  const row=d.retCode===0?d.result?.list?.[0]:null;
  const l=finiteNum(row?.buyRatio),sh=finiteNum(row?.sellRatio),ts=finiteNum(row?.timestamp);
  if(l===null||sh===null||l<0||sh<0||Math.abs(l+sh-1)>.03||!ts)throw Error('Datos del ratio inválidos');
  if(request!==state.ratioReq||tf!==state.tf)return;
  state.ratioLong=l;state.ratioShort=sh;state.ratioAt=ts;
  $('accountLong').textContent=(l*100).toFixed(1)+'%';
  $('accountShort').textContent=(sh*100).toFixed(1)+'%';
  $('accountRatioStamp').textContent='Bybit REST · cuentas con posiciones · '+period+' · muestra '+dateTime(ts);
 }catch(e){
  if(request!==state.ratioReq||tf!==state.tf)return;
  state.ratioLong=null;state.ratioShort=null;state.ratioAt=0;
  $('accountLong').textContent='—';$('accountShort').textContent='—';
  $('accountRatioStamp').textContent='Ratio Bybit no disponible para '+period
 }
 renderMarketSummary()
}

function sourceFreshness(now=Date.now()){
 const min=60000,tf=Number(state.tf)*60000;
 const sources=[
  {name:'Precio BTCUSDT',origin:'Bybit WebSocket publicTrade',ts:state.lastPriceAt,ttl:20000},
  {name:'Libro y mapa de calor',origin:'Bybit WebSocket orderbook.200',ts:state.lastBookAt,ttl:12000},
  {name:'Libro comparativo',origin:'Binance USD-M depth20',ts:state.binanceLastAt,ttl:8000},
  {name:'Liquidaciones ejecutadas',origin:'Bybit WebSocket allLiquidation',ts:state.lastLiqAt,ttl:300000,noEvents:state.wsOk&&state.lastLiqAt===0},
  {name:'OI puntual',origin:state.oiSource?state.oiSource+' REST BTCUSDT':'REST',ts:state.lastOiAt,ttl:120000},
  {name:'OI histórico + vela cerrada',origin:'Bybit REST OI/kline',ts:state.oiSeriesAt,ttl:Math.max(180000,tf*.5)},
  {name:'Funding indicativo siguiente',origin:'Bybit REST tickers',ts:state.fundingAt,ttl:300000},
  {name:'Funding histórico liquidado',origin:'Bybit REST funding/history',ts:state.lastFundingFetchedAt,ttl:600000},
  {name:'Cuentas long/short',origin:'Bybit REST account-ratio',ts:state.ratioAt,ttl:Math.max(600000,tf*3)},
  {name:'Miedo y Codicia diario',origin:'Alternative.me',ts:state.fngAt,ttl:36*3600000,dated:true},
  {name:'Sentimiento BTC horario',origin:'Bybit REST kline/OI/account-ratio/tickers',ts:state.hourlyAt,ttl:Math.max(60000,(Math.floor(now/3600000)+1)*3600000-now),sameHour:true}
 ];
 return sources.map(x=>{
  let valid=x.ts>0&&now>=x.ts&&now-x.ts<=x.ttl;
  if(x.sameHour)valid=valid&&state.hourlyWindowEnd===Math.floor(now/3600000)*3600000;
  if(x.name==='Funding histórico liquidado')valid=valid&&state.lastFundingAt>0;
  if(x.name==='Funding indicativo siguiente'&&state.fundingNextAt<=now)valid=false;
  const status=x.noEvents?'Sin eventos observados':valid?'VIGENTE':x.ts?'ATRASADO':'SIN DATOS';
  const label=x.name+' · '+x.origin+' · '+status+
   (x.ts?' · dato '+dateTime(x.dated?x.ts:x.sameHour?state.hourlyWindowEnd:x.name==='Funding histórico liquidado'?state.lastFundingAt:x.ts):'');
  return {...x,status,label,valid}
 })
}
function renderSourceFreshness(now=Date.now()){
 const target=$('sourceFreshness');if(!target)return;
 const rows=sourceFreshness(now);
 target.innerHTML=rows.map(x=>'<div class="alertrow">'+escapeHtml(x.label)+'</div>').join('');
 const up=rows.filter(x=>x.valid).length;
 $('sourceFreshnessSummary').textContent=up+'/'+rows.length+' lecturas con datos vigentes · último control '+time(now)+
  ' · los cortes y los periodos sin eventos no se reconstruyen';
 if(state.fngAt&&now-state.fngAt>36*3600000){
  $('fngClass').textContent='Dato diario atrasado';
  $('fngValue').textContent='—'
 }
 if(state.lastFundingFetchedAt&&now-state.lastFundingFetchedAt>600000){
  $('fundingPrevious').textContent='—';$('fundingPreviousStamp').textContent='Bybit · historial sin consulta reciente'
 }
 if(state.fundingAt&&(now-state.fundingAt>300000||state.fundingNextAt<=now)){
  state.fundingRate=null;$('fundingCurrent').textContent='—';
  $('fundingNext').textContent='Bybit · tasa indicativa atrasada; sin tasa vigente'
 }
 if(state.hourlyAt&&state.hourlyWindowEnd!==Math.floor(now/3600000)*3600000){
  $('hourlySentimentLabel').textContent='Nueva hora: cálculo pendiente';
  $('hourlySentimentLabel').className='num';
  $('hourlySentimentStamp').textContent='Última ventana '+dateTime(state.hourlyWindowEnd)+
   ' · lectura anterior, no vigente'
 }
 if(state.ratioAt&&now-state.ratioAt>Math.max(600000,Number(state.tf)*60000*3)){
  state.ratioLong=null;state.ratioShort=null;
  $('accountLong').textContent='—';$('accountShort').textContent='—';
  $('accountRatioStamp').textContent='Bybit REST · ratio atrasado; esperando actualización'
 }
 if(state.lastOiAt&&now-state.lastOiAt>120000){
  $('oi').textContent='—';$('oiDelta').textContent='—';
  $('oiStamp').textContent='Bybit/Binance REST · OI puntual atrasado'
 }
}


// Compact read-only summary of EXISTING data, never a new signal.
function topSnapshot(now=Date.now()){
 const tf=Number(state.tf),period=tf*60000;
 const priceFresh=state.wsOk&&state.price>0&&state.lastPriceAt>0&&
  now>=state.lastPriceAt&&now-state.lastPriceAt<=20000;
 const price=priceFresh?
  {value:usd(state.price),detail:'Bybit publicTrade · '+time(state.lastPriceAt),valid:true}:
  {value:'Sin precio vigente',detail:state.lastPriceAt?'Último dato '+time(state.lastPriceAt)+' · atrasado':'Bybit · esperando operaciones',valid:false};
 const trades=tradesWithin(300000,now);
 const flow=flowWindow(trades),enough=priceFresh&&flow.count>=12&&flow.total>=150000&&
  flow.duration>=25000;
 const buyPercent=flow.total>0?100*flow.buy/flow.total:null;
 const flowData=enough?
  {value:buyPercent>=60?'Compras '+buyPercent.toFixed(0)+'%':buyPercent<=40?'Ventas '+(100-buyPercent).toFixed(0)+'%':'Equilibrado',
   detail:usd(flow.total)+' · '+flow.count+' operaciones · ventana móvil 5 min · Bybit',valid:true}:
  {value:'Muestra insuficiente',detail:'Bybit publicTrade · 5 min; no inferir predominio',valid:false};
 const aligned=state.oiAligned;
 const oiValid=!!aligned&&aligned.ok&&aligned.tf===state.tf&&
  aligned.computedAt>0&&now-aligned.computedAt<180000&&
  aligned.end<=now&&aligned.end>=now-Math.max(period*2,600000)&&
  state.oiSeriesTf===state.tf&&now-state.oiSeriesAt<Math.max(180000,period*.5);
 const oi=oiValid?
  {value:'OI '+pct(aligned.oiPct)+' · BTC '+pct(aligned.pricePct),
   detail:'Vela Bybit cerrada '+time(aligned.start)+'–'+time(aligned.end)+' · misma ventana',valid:true}:
  {value:'Sin pareja OI–BTC',detail:'Esperando vela cerrada y OI consecutivo '+tfPeriod(),valid:false};
 const fundingValid=state.fundingRate!==null&&Number.isFinite(state.fundingRate)&&state.fundingAt>0&&
  now-state.fundingAt>=0&&now-state.fundingAt<=300000&&state.fundingNextAt>now;
 const funding=fundingValid?
  {value:(state.fundingRate>=0?'+':'')+(state.fundingRate*100).toFixed(4)+'%',
   detail:'Indicativa próximo pago '+dateTime(state.fundingNextAt)+' · Bybit',valid:true}:
  {value:'Funding no vigente',detail:'Bybit tickers · esperando tasa y fecha del próximo pago',valid:false};
 const material=state.alerts.filter(a=>a.priority&&a.priority.rank>=2&&now-a.lastImportantAt<=600000&&now>=a.lastImportantAt)
  .sort((a,b)=>b.priority.rank-a.priority.rank||b.lastImportantAt-a.lastImportantAt)[0]||null;
 return {price,flow:flowData,oi,funding,material}
}
function renderTopSnapshot(now=Date.now(),force=false){
 const target=$('topSnapshot');if(!target)return;
 if(!force&&state.lastTopRenderAt&&now-state.lastTopRenderAt<2000)return;
 state.lastTopRenderAt=now;
 const snapshot=topSnapshot(now),fields=[
  ['topPrice',snapshot.price],['topFlow',snapshot.flow],
  ['topOi',snapshot.oi],['topFunding',snapshot.funding]
 ];
 for(const [id,data] of fields){
  const value=$(id),detail=$(id+'Detail');
  if(value&&value.textContent!==data.value)value.textContent=data.value;
  if(value)value.classList.toggle('top-unavailable',!data.valid);
  if(detail&&detail.textContent!==data.detail)detail.textContent=data.detail
 }
 const alert=$('topImportantAlert'),stamp=$('topImportantStamp');
 let label='Sin alertas ALTA/MEDIA recientes';
 let description='Se muestran solo eventos observados durante la sesión con antigüedad ≤10 min; consulta todos abajo.';
 if(snapshot.material){
  const a=snapshot.material;
  label=a.priority.name+' · '+a.text;
  description=(a.source||'BTCUSDT · evento registrado')+' · '+time(a.lastImportantAt)+' · '+a.priority.reason+
   ' · evento observado, no dirección futura';
 }else if(!state.wsOk||!snapshot.price.valid){
  label='Mercado sin datos recientes';
  description='Sin evaluación actual de alertas importantes; los avisos anteriores siguen abajo.'
 }
 if(alert.textContent!==label)alert.textContent=label;
 if(stamp.textContent!==description)stamp.textContent=description;
 $('topSnapshotClock').textContent='Última comprobación '+time(now)+' · datos read-only'
}
function initFolds(){
 const key='btc-intelligence-v2-panels';
 let stored={};
 try{
  const raw=JSON.parse(localStorage.getItem(key)||'{}');
  if(raw&&typeof raw==='object'&&!Array.isArray(raw))stored=raw
 }catch{}
 const panels=[...document.querySelectorAll('details.foldable[data-panel]')];
 for(const panel of panels){
  const id=panel.dataset.panel;
  if(Object.prototype.hasOwnProperty.call(stored,id)){
   panel.open=stored[id]===true
  }
  panel.addEventListener('toggle',()=>{
   if(panel.open){
    requestAnimationFrame(()=>{
     if(panel.querySelector('#heat'))draw();
     if(panel.querySelector('#liquidityHeat'))drawLiquidityHeat();
     if(panel.querySelector('#oiChart'))drawOiSeries()
    })
   }
   const updated={};
   for(const p of panels)updated[p.dataset.panel]=p.open;
   try{localStorage.setItem(key,JSON.stringify(updated))}catch{}
  })
 }
}

function renderMarketSummary(now=Date.now()){
 if(!$('marketSummary'))return;
 if(!state.wsOk||now-state.lastPriceAt>20000){
  $('marketSummary').textContent='Esperando operaciones en vivo para describir el mercado.';
  $('summaryStamp').textContent='Datos insuficientes';
  return
 }
 const recent=tradesWithin(300000,now);
 let buy=0,sell=0;
 for(const t of recent){if(t.buy)buy+=t.usdt;else sell+=t.usdt}
 const total=buy+sell,lines=[];
 if(total>=150000){
  const buyPercent=100*buy/total;
  const flow=buyPercent>=60?'predominan compras agresivas':buyPercent<=40?'predominan ventas agresivas':'flujo comprador/vendedor equilibrado';
  lines.push('Flujo 5m: '+flow+' ('+buyPercent.toFixed(0)+'% compras, '+usd(total)+' negociados).');
 }else lines.push('Flujo 5m: volumen observado aún insuficiente para clasificar predominio.');
 if(state.candles.length&&state.price){
  const liveCandle=activeBybitCandle(now);
  const open=Number(liveCandle?.[1]);
  if(open>0){const change=(state.price/open-1)*100;lines.push('BTC vela ACTIVA '+tfPeriod()+' ('+(change>=0?'+':'')+change.toFixed(2)+'% desde apertura; puede variar).')}
 }
 const joined=state.oiAligned;
 if(joined&&joined.tf===state.tf&&now-joined.computedAt<180000&&now-joined.end<=Math.max(now,0)&&now-joined.end<=Math.max(Number(state.tf)*60000*2,600000)){
  lines.push('Precio y OI alineados, vela CERRADA '+time(joined.start)+'–'+time(joined.end)+
   ': BTC '+pct(joined.pricePct)+'; OI '+pct(joined.oiPct)+
   (state.oiRelevance?.tf===state.tf&&state.oiRelevance.end===joined.end?' ('+state.oiRelevance.label.toLowerCase()+')':'')+'. No implica causalidad.');
 }else lines.push('Precio/OI cerrado: sin pareja temporal comparable reciente.');
 if(state.ratioLong!==null&&state.ratioAt>now-Number(state.tf)*60000*3-900000)
  lines.push('Ratio de cuentas: '+(state.ratioLong*100).toFixed(0)+'% con posiciones long y '+(state.ratioShort*100).toFixed(0)+'% short; no mide su capital.');
 if(state.fundingRate!==null&&now-state.fundingAt<300000)
  lines.push('Funding indicativo para siguiente liquidación '+dateTime(state.fundingNextAt)+': '+(state.fundingRate>=0?'+':'')+(state.fundingRate*100).toFixed(4)+'% (no es pago histórico).');
 $('marketSummary').textContent=lines.join(' ');
 $('summaryStamp').textContent='Último análisis '+time(now)+' · descriptivo, sin señales ni probabilidades';
}


// Reading guide: order-book levels are visible aggregate orders, not guaranteed support/resistance.
const WALL_MIN_USD=180000,WALL_MIN_AGE=12000,WALL_MAX_DIST=.012;
// Same book-relative policy for classification, drops, reappearances and alerts.
// Absolute floors and ceilings avoid noisy or unreachable thresholds.
function relativeWallPolicy(now=Date.now()){
 if(state.wallPolicy&&now-state.wallPolicy.at<5000)return state.wallPolicy;
 const sidePolicy=book=>{
  const amounts=[...book].map(([p,q])=>Number(p)*Number(q))
   .filter(v=>v>0&&Number.isFinite(v)).sort((a,b)=>a-b);
  const n=amounts.length,median=n>=15?amounts[Math.floor((n-1)/2)]:0;
  const p90=n>=15?amounts[Math.floor((n-1)*.9)]:0;
  const threshold=Math.max(80000,Math.min(850000,p90*2.5));
  return {median,p90,threshold,n,notice:Math.max(250000,Math.min(1800000,threshold*2.4)),
   drop:Math.max(120000,Math.min(950000,threshold*.9)),
   move:Math.max(70000,Math.min(600000,threshold*.5))}
 };
 state.wallPolicy={at:now,bid:sidePolicy(state.bids),ask:sidePolicy(state.asks)};
 return state.wallPolicy
}
function wallThreshold(side,now=Date.now()){
 return relativeWallPolicy(now)[side].threshold
}
function captureWallChanges(side,p,oldQty,newQty,now,key){
 const policy=relativeWallPolicy(now)[side];
 const previous=p*oldQty,next=p*newQty,change=next-previous;
 const near=state.price>0&&Math.abs(p/state.price-1)<=WALL_MAX_DIST;
 let m=state.wallMetrics.get(key);
 if(!m){m={key,side,p,firstAt:now,updates:0,added:0,removed:0,peak:0,lastNotional:previous,qualifiedSince:0};state.wallMetrics.set(key,m)}
 if(Math.abs(change)>=0.01){m.updates++;if(change>0)m.added+=change;else m.removed-=change}
 m.lastNotional=next;m.peak=Math.max(m.peak,previous,next);m.lastAt=now;
 if(near&&Math.abs(change)>=policy.move&&Math.abs(change)>=Math.max(previous,next)*.25){
  state.wallEvents.unshift({ts:now,side,p,change,from:previous,to:next,type:change>0?'up':'down'});
  state.wallEvents=state.wallEvents.slice(0,24)
 }
 if(previous>=policy.threshold&&next<policy.threshold&&next<=previous*.30&&near){
  state.wallDisappeared.set(key,{ts:now,side,p,former:previous});
 }else if(previous<=policy.threshold*.25&&next>=policy.threshold&&near){
  const prior=state.wallDisappeared.get(key);
  if(prior&&now-prior.ts>=1500&&now-prior.ts<=180000){
   state.wallReappearances.unshift({ts:now,side,p,notional:next,absence:now-prior.ts,former:prior.former});
   state.wallReappearances=state.wallReappearances.slice(0,12);
   state.wallDisappeared.delete(key)
  }
 }
}
function cleanupWallHistory(now=Date.now()){
 for(const [key,rec] of state.wallDropCooldown){
  if(now-(rec?.ts||0)>180000)state.wallDropCooldown.delete(key)
 }
 for(const [k,v] of state.wallDisappeared)if(now-v.ts>180000)state.wallDisappeared.delete(k);
 for(const [k,v] of state.wallMetrics)if(now-v.lastAt>300000)state.wallMetrics.delete(k);
 if(state.wallDisappeared.size>300){
  const keys=[...state.wallDisappeared].sort((a,b)=>a[1].ts-b[1].ts);
  for(const [k] of keys.slice(0,state.wallDisappeared.size-300))state.wallDisappeared.delete(k)
 }
 if(state.wallMetrics.size>550){
  const keys=[...state.wallMetrics].sort((a,b)=>a[1].lastAt-b[1].lastAt);
  for(const [k] of keys.slice(0,state.wallMetrics.size-550))state.wallMetrics.delete(k)
 }
}
function renderWallEvolution(now=Date.now()){
 const policy=relativeWallPolicy(now),target=$('wallEvolution'),returning=$('wallReturns');
 if(!target||!returning)return;
 $('wallAdaptiveScope').textContent='Umbral visible · compra '+usd(policy.bid.threshold)+
  ' / venta '+usd(policy.ask.threshold)+' · basado en percentil 90 por lado ×2,5, con límites';
 target.innerHTML=state.wallEvents.filter(x=>now-x.ts<300000).slice(0,6).map(x=>
  '<div class="alertrow"><span class="'+(x.side==='bid'?'up':'down')+'">'+
  (x.side==='bid'?'COMPRA':'VENTA')+'</span> '+usd(x.p)+' · '+
  (x.change>=0?'aumentó ':'disminuyó ')+usd(Math.abs(x.change))+
  ' · antes '+usd(x.from)+' / después '+usd(x.to)+'</div>').join('')||
  '<div class="empty">Sin cambios de tamaño relevantes observados.</div>';
 returning.innerHTML=state.wallReappearances.filter(x=>now-x.ts<600000).slice(0,5).map(x=>
  '<div class="alertrow"><span class="'+(x.side==='bid'?'up':'down')+'">'+
  (x.side==='bid'?'COMPRA':'VENTA')+'</span> '+usd(x.p)+
  ' · reapareció el nivel tras '+wallAge(x.absence)+' · '+usd(x.notional)+
  ' visibles</div>').join('')||
  '<div class="empty">Sin niveles que hayan desaparecido y reaparecido en esta sesión.</div>'
}


// Two distinct views: exact price levels (for breakouts) and aggregate price
// buckets (for nearby liquidity). A zone is NOT one executable order.
function wallPriority(v,qualifiedAge,distPct,baseline=WALL_MIN_USD){
 return Math.log1p(Math.max(0,v)/Math.max(1,baseline))*
  (1+Math.min(Math.max(0,qualifiedAge)/60000,1))/
  (1+Math.abs(distPct)/.40);
}
function liquidityZones(now=Date.now()){
 if(!state.price||!state.wsOk||now-state.lastBookAt>10000){state.zoneSeen.clear();return {bid:[],ask:[],width:0}}
 const width=Math.max(10,Math.round(state.price*.0003/5)*5),zones=new Map();
 const policy=relativeWallPolicy(now);
 for(const [book,side] of [[state.bids,'bid'],[state.asks,'ask']]){
  for(const [raw,q] of book){
   const price=Number(raw),qty=Number(q);
   if(!(price>0&&qty>0)||Math.abs(price/state.price-1)>WALL_MAX_DIST)continue;
   const bucket=Math.floor(price/width),key=side+':'+width+':'+bucket;
   const z=zones.get(key)||{key,side,lo:bucket*width,hi:(bucket+1)*width,total:0,levels:0,pv:0};
   const notional=price*qty;z.total+=notional;z.pv+=price*notional;z.levels++;zones.set(key,z)
  }
 }
 const out={bid:[],ask:[],width},visible=new Set();
 for(const side of ['bid','ask']){
  const list=[...zones.values()].filter(x=>x.side===side);
  const levelBook=side==='bid'?state.bids:state.asks;
  const notionalLevels=[...levelBook].map(([p,q])=>Number(p)*Number(q))
   .filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
  const median=notionalLevels.length>=10?notionalLevels[Math.floor((notionalLevels.length-1)/2)]:0;
  const threshold=Math.max(policy[side].threshold,Math.min(2500000,median*4));
  for(const x of list){
   x.threshold=threshold;x.center=x.pv/x.total;
   x.dist=Math.abs(x.center/state.price-1)*100;
   if(x.total>=threshold){
    visible.add(x.key);
    if(!state.zoneSeen.has(x.key))state.zoneSeen.set(x.key,now)
   }else state.zoneSeen.delete(x.key);
   x.age=now-(state.zoneSeen.get(x.key)||now);
   x.qualified=x.total>=threshold&&x.age>=15000;
   x.priority=wallPriority(x.total,x.age,x.dist,threshold)
  }
  out[side]=list.sort((a,b)=>Number(b.qualified)-Number(a.qualified)||b.priority-a.priority).slice(0,3)
 }
 for(const key of state.zoneSeen.keys())if(!visible.has(key))state.zoneSeen.delete(key);
 return out
}
function renderLiquidityZones(now=Date.now()){
 const out=liquidityZones(now);
 const render=side=>{
  const target=$(side==='bid'?'liquidityBidZones':'liquidityAskZones');
  if(!target)return;
  const entries=out[side];
  target.innerHTML=entries.map((z,i)=>
   '<div class="alertrow">'+(i+1)+'. '+usd(z.lo)+'–'+usd(z.hi)+' · '+usd(z.total)+
   ' · '+z.levels+' niveles · '+(z.qualified?'PERSISTENTE':'reciente/menor')+
   ' · '+wallAge(z.age)+' · prioridad '+z.priority.toFixed(2)+'</div>').join('')||
   '<div class="empty">Sin niveles próximos para agrupar.</div>'
 };
 render('bid');render('ask');
 if($('zoneScope'))$('zoneScope').textContent='Bandas '+usd(out.width)+' · umbral adaptativo por lado; zona = concentración agregada, distinta de un nivel individual · observado desde que abriste la app';
}

function rankWallLevels(now=Date.now()){
 if(!state.price||now-state.lastBookAt>15000)return [];
 const combined=[...state.bids].map(([p,q])=>({p:+p,v:+p*+q,side:'bid',key:'B:'+p}))
 .concat([...state.asks].map(([p,q])=>({p:+p,v:+p*+q,side:'ask',key:'A:'+p})));
 return combined.filter(x=>Number.isFinite(x.v)&&x.v>0&&x.p>0&&Math.abs(x.p/state.price-1)<=WALL_MAX_DIST)
 .map(x=>({...x,age:now-(state.wallSeen.get(x.key)||now),qualifiedAge:now-(state.wallQualifiedSince.get(x.key)||now),dist:100*(x.p/state.price-1)})).map(x=>({...x,priority:wallPriority(x.v,x.qualifiedAge,x.dist,wallThreshold(x.side,now))}))
 .sort((a,b)=>Number(b.qualifiedAge>=WALL_MIN_AGE&&b.v>=wallThreshold(b.side,now))-Number(a.qualifiedAge>=WALL_MIN_AGE&&a.v>=wallThreshold(a.side,now))||b.priority-a.priority);
}
function recordWallDrop(side,p,oldQty,newQty,age,now){
 const prev=p*oldQty,next=p*newQty,lost=prev-next,key=(side==='bid'?'B:':'A:')+p;
 const policy=relativeWallPolicy(now)[side];
 if(prev<policy.threshold||lost<policy.drop||lost/prev<.65||age<8000||!state.price||Math.abs(p/state.price-1)>.008)return;
 const lastDrop=state.wallDropCooldown.get(key);
 if(lastDrop&&now-lastDrop.ts<45000&&lost<lastDrop.lost*1.7)return;
 state.wallDropCooldown.set(key,{ts:now,lost});
 state.wallDrops.unshift({ts:now,side,p,prev,lost,next,status:'pending',matched:0});
 state.wallDrops=state.wallDrops.slice(0,12);
 if(lost>=policy.notice*.60&&Math.abs(p/state.price-1)<.004){
  alertUser('MURO '+(side==='bid'?'COMPRADOR':'VENDEDOR')+' reducido '+usd(lost)+' en '+usd(p)+'; ejecución/cancelación no confirmada','wall-drop-'+side+'-'+p,180000,
   {kind:'wall-drop',side,price:p,amount:lost,baseline:policy.notice*.6,
    eventId:'drop-'+key+'-'+now,source:'Bybit L2 · cancelación o ejecución no confirmada'})
 }
}
function evaluateWallDrops(now=Date.now()){
 for(const e of state.wallDrops){
  if(e.status!=='pending'||now-e.ts<3000)continue;
  let matched=0;
  for(const t of state.trades){
   if(Math.abs(t.ts-e.ts)>3500||Math.abs(t.price-e.p)>Math.max(5,e.p*.00012))continue;
   if(t.buy===(e.side==='ask'))matched+=t.usdt
  }
  e.matched=matched;
  e.status=matched>=Math.min(100000,e.lost*.30)?'coincident':'unconfirmed'
 }
}
function renderWallInsights(now=Date.now()){
 const bids=$('strongBidLevels'),asks=$('strongAskLevels'),events=$('wallDropEvents');
 if(!bids||!asks||!events)return;
 if(now-state.lastBookAt>15000||!state.wsOk){
  if($('wallEvolution'))$('wallEvolution').textContent='Sin datos recientes';
  if($('wallReturns'))$('wallReturns').textContent='Sin datos recientes';
  bids.textContent='Libro sin datos recientes';asks.textContent='Libro sin datos recientes';
  state.zoneSeen.clear();
  $('liquidityBidZones').textContent='Libro sin datos recientes';
  $('liquidityAskZones').textContent='Libro sin datos recientes';
  $('zoneScope').textContent='Zonas pausadas: esperando libro Bybit reciente';
  $('wallInsightStamp').textContent='Requiere conexión activa a Bybit L2';return
 }
 const levels=rankWallLevels(now);
 renderLiquidityZones(now);
 renderWallEvolution(now);
 for(const notable of levels.filter(x=>x.v>=relativeWallPolicy(now)[x.side].notice&&
   x.qualifiedAge>=15000&&Math.abs(x.dist)<=.30).slice(0,6)){
  alertUser('MURO '+(notable.side==='bid'?'COMPRADOR':'VENDEDOR')+
   ' visible '+usd(notable.v)+' a '+usd(notable.p)+
   ' (persistencia '+wallAge(notable.age)+')',
   'wall-arrive-'+notable.side+':'+notable.p,600000,
   {kind:'wall-arrive',side:notable.side,price:notable.p,amount:notable.v,
    baseline:relativeWallPolicy(now)[notable.side].notice,
    eventId:notable.key+':'+String(state.wallSeen.get(notable.key)||0),
    source:'Bybit libro L2 · nivel visible, no orden identificada'})
 }
 const list=side=>levels.filter(x=>x.side===side).slice(0,3)
  .map((x,i)=>'<div class="alertrow">'+(i+1)+'. <strong>'+usd(x.p)+'</strong> · '+usd(x.v)+' · '+wallAge(x.age)+' visible · '+Math.abs(x.dist).toFixed(2)+'% del precio · '+(x.qualifiedAge>=WALL_MIN_AGE&&x.v>=wallThreshold(x.side,now)?'VIGILADO':'nuevo/menor')+' · prioridad '+x.priority.toFixed(2)+'</div>').join('')
  ||'<div class="empty">Sin niveles visibles dentro de ±1,2%.</div>';
 bids.innerHTML=list('bid');asks.innerHTML=list('ask');
 $('wallInsightStamp').textContent='Candidatos observados desde que abriste la app · '+time(now);
 // Arm prior levels; do not infer past crossings from levels first seen after the move.
 for(const x of levels){
  if(x.qualifiedAge<WALL_MIN_AGE||x.v<wallThreshold(x.side,now))continue;
  const onExpectedSide=x.side==='bid'?state.price>x.p*1.00025:state.price<x.p*.99975;
  let watch=state.wallWatch.get(x.key);
  if(!watch){
   if(!onExpectedSide)continue;
   watch={key:x.key,side:x.side,level:x.p,seenAt:now,lastSeen:now,armedAt:now,done:false};
   state.wallWatch.set(x.key,watch)
  }else watch.lastSeen=now;
 }
 for(const [key,watch] of state.wallWatch){
  if(!isTrackedWallPresent(watch,now)||now-watch.seenAt>360000)state.wallWatch.delete(key)
 }
 if(state.wallWatch.size>40){
  const obsolete=[...state.wallWatch.values()].sort((a,b)=>a.lastSeen-b.lastSeen);
  for(const x of obsolete.slice(0,state.wallWatch.size-40))state.wallWatch.delete(x.key)
 }
 evaluateWallDrops(now);
 events.innerHTML=state.wallDrops.filter(e=>now-e.ts<600000).slice(0,6).map(e=>{
  let stateText=e.status==='pending'?'Contrastando con ejecuciones…':
   e.status==='coincident'?'Operaciones agresivas próximas: '+usd(e.matched)+' (coincidencia, no prueba)':
   'Sin ejecuciones próximas suficientes (cancelación o cambio de profundidad posibles)';
  return '<div class="alertrow"><span class="'+(e.side==='bid'?'up':'down')+'">'+(e.side==='bid'?'COMPRA':'VENTA')+'</span> '+usd(e.p)+' · liquidez visible reducida '+usd(e.lost)+' · '+time(e.ts)+'<div class="sub">'+stateText+'</div></div>'
 }).join('')||'<div class="empty">Sin reducciones importantes detectadas en esta sesión.</div>';
 $('wallLossScope').textContent='Bybit, 200 niveles por lado · cambios observados durante esta sesión';
}

function isTrackedWallPresent(watch,now=Date.now()){
 if(!state.wsOk||now-state.lastBookAt>8000)return false;
 const book=watch.side==='bid'?state.bids:state.asks;
 const qty=Number(book.get(watch.key.slice(2)));
 const since=state.wallQualifiedSince.get(watch.key);
 return Number.isFinite(qty)&&qty*watch.level>=wallThreshold(watch.side,now)&&Number.isFinite(since)&&now-since>=WALL_MIN_AGE;
}


// Breakout observations use Bybit price candles of the selected timeframe only.
// A tick crossing is NOT a candle-close confirmation or a profitable signal.
function breakoutVolatility(now=Date.now()){
 const tf=state.tf,period=Number(tf)*60000;
 if(state.candleSource!=='Bybit'||state.candlesTf!==tf||!Number.isFinite(period)||period<=0)return null;
 const expectedLast=Math.floor(now/period)*period-period;
 const closed=state.candles.filter(k=>Array.isArray(k)&&Number(k[0])+period<=now&&Number(k[0])>=expectedLast-4*period)
  .sort((a,b)=>Number(b[0])-Number(a[0]));
 if(closed.length<3||Number(closed[0][0])!==expectedLast||!state.candles.some(k=>Number(k[0])>=expectedLast+period))return null;
 const ranges=closed.slice(0,4).map(k=>{
  const high=Number(k[2]),low=Number(k[3]),close=Number(k[4]);
  return high>=low&&low>0&&close>0?(high-low)/close*100:NaN
 });
 if(ranges.length<3||ranges.some(v=>!Number.isFinite(v)))return null;
 const rangePct=ranges.reduce((a,b)=>a+b,0)/ranges.length;
 // Move threshold is a small fraction of recent closed candle range (4-35 bp).
 const movePct=Math.min(.35,Math.max(.04,rangePct*.32));
 return {tf,period,rangePct,movePct,ts:expectedLast+period}
}
function breakoutSignedDistance(evt,price){
 return (evt.side==='bid'?-1:1)*(price-evt.level)
}
function breakoutDuplicate(side,level,now,thresholdUsd){
 return state.breakouts.some(e=>e.side===side&&now-e.ts<300000&&now>=e.ts&&
  Math.abs(e.level-level)<=Math.max(10,level*.0006,thresholdUsd*1.5,e.thresholdUsd||0))
}
function updateBreakoutCandles(now=Date.now()){
 for(const e of state.breakouts){
  if(e.candle!=='awaiting')continue;
  const period=Number(e.tf)*60000;
  if(!(period>0))continue;
  const start=Math.floor(e.ts/period)*period,end=start+period;
  if(now<end)continue;
  // Using selected timeframe data; never interpret a Binance fallback as Bybit.
  if(state.candlesTf!==e.tf||state.candleSource!=='Bybit'){
   if(now-end>Math.max(period,600000))e.candle='unavailable';
   continue
  }
  const nextCandleExists=state.candles.some(k=>Number(k[0])>=end);
  const row=nextCandleExists?state.candles.find(k=>Number(k[0])===start):null;
  if(!row){if(now-end>Math.max(period,600000))e.candle='unavailable';continue}
  const close=Number(row[4]);
  if(!(close>0&&Number.isFinite(close))){e.candle='unavailable';continue}
  e.candleClose=close;e.candleAt=end;
  e.candle=breakoutSignedDistance(e,close)>=e.thresholdUsd*.5?'confirmed':'rejected'
 }
}
function updateRetest(e,now=Date.now()){
 if(e.retest==='held'||e.retest==='failed'||e.retest==='expired')return;
 if(now-e.ts>240000){e.retest='expired';return}
 if(now-e.ts<5000)return;
 const dist=breakoutSignedDistance(e,state.price),band=e.thresholdUsd*.75;
 if(e.retest==='waiting'){
  // Price approaches the pre-cross level from the broken side.
  if(Math.abs(dist)<=band){e.retest='touched';e.retestAt=now}
 }else if(e.retest==='touched'){
  if(dist< -e.thresholdUsd*.6){e.retest='failed';e.retestResolved=now}
  else if(now-e.retestAt>=15000&&dist>=e.thresholdUsd*1.10){
   e.retest='held';e.retestResolved=now
  }
 }
}
function checkBreakouts(now=Date.now()){
 updateBreakoutCandles(now);
 if(!state.wsOk||now-state.lastPriceAt>18000||!state.price||now-state.lastBookAt>8000)return;
 const volatility=breakoutVolatility(now);
 for(const evt of state.breakouts){
  if(evt.status==='pending'){
   const elapsed=now-evt.ts,dist=breakoutSignedDistance(evt,state.price);
   if(dist<=-evt.thresholdUsd*.8&&elapsed>=8000){evt.status='returned';evt.resolved=now;evt.last=state.price}
   else if(elapsed>=45000&&dist>=evt.thresholdUsd*.55){evt.status='sustained';evt.resolved=now;evt.last=state.price}
   else if(elapsed>=90000){evt.status='uncertain';evt.resolved=now;evt.last=state.price}
  }
  updateRetest(evt,now)
 }
 if(!volatility)return;
 const watches=[...state.wallWatch.values()].sort((a,b)=>{
  const notional=w=>Number((w.side==='bid'?state.bids:state.asks).get(w.key.slice(2))||0)*w.level;
  return notional(b)-notional(a)
 });
 for(const watch of watches){
  if(!isTrackedWallPresent(watch,now)){state.wallWatch.delete(watch.key);continue}
  if(watch.done||now-watch.armedAt<2500)continue;
  const thresholdUsd=watch.level*volatility.movePct/100;
  const dist=watch.side==='bid'?watch.level-state.price:state.price-watch.level;
  if(dist<thresholdUsd)continue;
  watch.done=true;
  if(breakoutDuplicate(watch.side,watch.level,now,thresholdUsd)){
   state.breakoutSuppressed++;continue
  }
  const evt={ts:now,side:watch.side,level:watch.level,status:'pending',resolved:0,last:state.price,
   tf:volatility.tf,thresholdUsd,thresholdPct:volatility.movePct,candle:'awaiting',candleClose:null,candleAt:0,
   retest:'waiting',retestAt:0,retestResolved:0};
  state.breakouts.unshift(evt);state.breakouts=state.breakouts.slice(0,64)
 }
}
function renderBreakouts(now=Date.now()){
 const el=$('breakoutEvents');if(!el)return;
 const volatility=breakoutVolatility(now);
 if(!state.wsOk||now-state.lastPriceAt>18000||now-state.lastBookAt>8000){
  $('breakoutStamp').textContent='Sin libro u operaciones recientes; detección pausada'
 }else if(!volatility){
  $('breakoutStamp').textContent='Esperando 3–4 velas Bybit cerradas '+tfPeriod()+' para calcular umbral adaptable; no se generan cruces sin referencia'
 }else{
  $('breakoutStamp').textContent='Umbral de cruce '+volatility.movePct.toFixed(3)+'% (rango medio cerrado '+volatility.rangePct.toFixed(3)+
   '% · '+tfPeriod()+') · cruces cercanos omitidos: '+state.breakoutSuppressed+' · '+time(now)
 }
 const openClosures=state.breakouts.filter(e=>e.candle==='awaiting'&&now-e.ts<Math.max(900000,Number(e.tf)*60000+1800000)).length;
 const names={pending:'Cruce de precio en seguimiento',returned:'Precio volvió al lado anterior',sustained:'Precio al otro lado ≥45 s (sin confirmar cierre)',uncertain:'Sin continuidad suficiente'};
 const candleNames={awaiting:'Cierre de vela pendiente',confirmed:'Cierre de vela confirmado más allá del nivel',rejected:'Cierre NO confirmó la ruptura',unavailable:'Cierre no verificable con datos Bybit'};
 const retestNames={waiting:'Retesteo aún no observado',touched:'Retesteo observado; esperando reacción',held:'Rebote tras retesteo observado (solo precio)',failed:'Retesteo fallido: retorno al lado original',expired:'Retesteo no verificable (plazo o reconexión)'};
 if(openClosures&&volatility)$('breakoutStamp').textContent+=' · cierres pendientes: '+openClosures;
 const ordered=state.breakouts.filter(e=>now-e.ts>=0&&now-e.ts<Math.max(900000,Number(e.tf)*60000+1800000))
  .sort((a,b)=>Number(b.candle==='awaiting')-Number(a.candle==='awaiting')||b.ts-a.ts);
 el.innerHTML=ordered.slice(0,7).map(e=>
  '<div class="alertrow"><span class="'+(e.side==='bid'?'down':'up')+'">'+(e.side==='bid'?'Cruce BAJISTA':'Cruce ALCISTA')+
  '</span> de '+usd(e.level)+' · '+time(e.ts)+'<div class="sub">'+(names[e.status]||'Observación')+
  ' · umbral '+Number(e.thresholdPct||0).toFixed(3)+'% · vela '+(e.tf==='60'?'1h':e.tf==='240'?'4h':e.tf+'m')+
  '<div>'+ (candleNames[e.candle]||'Cierre pendiente')+(e.candleAt?' · '+time(e.candleAt):'')+'</div>'+
  '<div>'+(retestNames[e.retest]||'Sin retesteo validado')+'</div></div></div>'
 ).join('')||'<div class="empty">No se han registrado cruces válidos de muros previamente observados.</div>'
}

function resetWallTracking(){
 for(const e of state.breakouts){
  if(e.status==='pending'){e.status='uncertain';e.resolved=Date.now()}
  if(e.retest==='waiting'||e.retest==='touched')e.retest='expired'
 }
 state.wallWatch.clear();
}


// Bybit trade messages include a unique trade ID. Liquidations have no event ID:
// a fingerprint prevents identical repeated packets but may conflate truly identical
// executions, so it is not proof of a uniquely identified liquidation event.
const FLOW_KEEP_MS=300000,FLOW_IDS_KEEP_MS=360000,FLOW_CAP=45000,LIQ_CAP=8000;
function compactEventIds(map,now=Date.now(),max=75000){
 for(const [key,ts] of map){if(now-ts>FLOW_IDS_KEEP_MS)map.delete(key)}
 while(map.size>max)map.delete(map.keys().next().value)
}
function trimObservedFlows(now=Date.now()){
 state.trades=state.trades.filter(t=>t.ts>=now-FLOW_KEEP_MS&&t.ts<=now+5000);
 state.liq=state.liq.filter(t=>t.ts>=now-FLOW_KEEP_MS&&t.ts<=now+5000);
 state.whales=state.whales.filter(t=>t.ts>=now-FLOW_KEEP_MS&&t.ts<=now+5000);
 if(state.trades.length>FLOW_CAP){
  state.tradeWindowTruncated=true;
  state.trades.sort((a,b)=>a.ts-b.ts||(a.seq||0)-(b.seq||0));
  state.trades=state.trades.slice(-FLOW_CAP)
 }
 if(state.liq.length>LIQ_CAP){
  state.liqWindowTruncated=true;
  state.liq.sort((a,b)=>a.ts-b.ts);
  state.liq=state.liq.slice(-LIQ_CAP)
 }
 compactEventIds(state.tradeIds,now,75000);
 compactEventIds(state.liqFingerprints,now,18000)
}
function tradesWithin(durationMs,now=Date.now()){
 return state.trades.filter(t=>now-t.ts>=0&&now-t.ts<=durationMs)
}
function flowWindow(trades){
 let buy=0,sell=0,first=null,last=null,min=Infinity,max=0;
 const precedes=(a,b)=>a.ts<b.ts||(a.ts===b.ts&&(a.seq||0)<(b.seq||0));
 for(const t of trades){
  if(t.buy)buy+=t.usdt;else sell+=t.usdt;
  if(!first||precedes(t,first))first=t;
  if(!last||precedes(last,t))last=t;
  min=Math.min(min,t.price);max=Math.max(max,t.price)
 }
 const total=buy+sell,move=first&&last?(last.price/first.price-1)*100:0;
 const range=first&&min>0?(max/min-1)*100:0;
 return {buy,sell,total,count:trades.length,first,last,
  duration:first&&last?last.ts-first.ts:0,movePct:move,rangePct:range,
  buyShare:total?buy/total:0}
}
function adaptivePrintPolicy(now=Date.now()){
 if(state.printPolicyCache&&now-state.printPolicyCache.at<5000){
  const policy=state.printPolicyCache.policy;
  return {...policy,individualMin:Math.max(state.threshold,policy.printMin)}
 }
 const sample=tradesWithin(FLOW_KEEP_MS,now),n=sample.length;
 let sorted=[],baseline=null;
 if(n>=35){
  const span=flowWindow(sample).duration;
  if(span>=30000){
   sorted=sample.map(t=>t.usdt).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
   baseline=sorted[Math.floor((sorted.length-1)*.95)]
  }
 }
 const printMin=baseline===null?100000:Math.max(100000,Math.min(900000,baseline*3));
 const policy={printMin,sequenceMin:Math.max(300000,printMin*2.5),baseline,n,provisional:baseline===null};
 state.printPolicyCache={at:now,policy};
 return {...policy,individualMin:Math.max(state.threshold,printMin)}
}
function evaluateTradeSequences(now=Date.now()){
 const policy=adaptivePrintPolicy(now),large=tradesWithin(90000,now)
  .filter(t=>t.usdt>=policy.printMin).sort((a,b)=>a.ts-b.ts||(a.seq||0)-(b.seq||0));
 const runs=[];let current=[];
 const flush=()=>{if(current.length){runs.push(current);current=[]}};
 for(const t of large){
  const prior=current.at(-1);
  const near=prior&&t.buy===prior.buy&&t.ts-prior.ts<=12000&&
   Math.abs(t.price/prior.price-1)<=.0006;
  if(!near)flush();
  current.push(t)
 }
 flush();
 const grouped=runs.filter(group=>group.length>=3&&group.reduce((sum,t)=>sum+t.usdt,0)>=policy.sequenceMin);
 const ids=new Set(grouped.flatMap(g=>g.map(t=>t.id)));
 const isolated=large.filter(t=>!ids.has(t.id));
 return {policy,large,grouped,isolated}
}
function renderFlowStatus(now=Date.now()){
 const w90=flowWindow(tradesWithin(90000,now)),w5=flowWindow(tradesWithin(300000,now));
 $('flow90Detail').textContent='90 s · '+usd(w90.total)+' · '+w90.count+' ejec. · precio '+
  (w90.count>1?pct(w90.movePct):'sin desplazamiento medible');
 $('flow5Detail').textContent='5 min · '+usd(w5.total)+' · '+w5.count+' ejec. · precio '+
  (w5.count>1?pct(w5.movePct):'sin desplazamiento medible');
 $('flowSessionDetail').textContent='CVD desde abrir: '+(state.sessionCvd>=0?'+':'')+
  usd(state.sessionCvd)+' · solo operaciones recibidas; los cortes de conexión no se reconstruyen';
 $('flowDedupStatus').textContent='Eventos descartados: '+state.tradeDuplicates+
  ' IDs repetidos · '+state.tradeRejected+' inválidos/atrasados'+
  (state.tradeWindowTruncated?' · ventana 5m acotada; totales mínimos':'')
}


function renderTrades(){
 const now=Date.now();trimObservedFlows(now);
 const w=flowWindow(tradesWithin(300000,now)),large=state.whales.filter(t=>now-t.ts>=0&&now-t.ts<300000)
  .sort((a,b)=>b.ts-a.ts);
 $('buyVol').textContent=usd(w.buy);$('sellVol').textContent=usd(w.sell);
 $('delta').textContent=(w.buy-w.sell>=0?'+':'')+usd(w.buy-w.sell);
 $('cvd').textContent=(state.sessionCvd>=0?'+':'')+usd(state.sessionCvd);
 $('whales').innerHTML=large.slice(0,5).map(x=>'<div class="alertrow"><span class="'+
  (x.buy?'up':'down')+'">'+(x.buy?'COMPRA':'VENTA')+'</span> · '+usd(x.usdt)+' · '+
  usd(x.price)+' <span class="muted">'+time(x.ts)+'</span></div>').join('')||
  '<div class="empty">Sin operaciones individuales por encima del umbral configurado.</div>';
 renderFlowStatus(now)
}
function onTrade(d){
 const entries=Array.isArray(d.data)?d.data:[],now=Date.now();
 // Exchange documents that T is the match time, i is the trade ID and S is taker side.
 for(const x of entries){
  const p=Number(x.p),q=Number(x.v),ts=Number(x.T),id=typeof x.i==='string'?x.i:'',seq=Number(x.seq)||0;
  if(x.s&&x.s!=='BTCUSDT')continue;
  if(!(p>0&&q>0&&Number.isFinite(p)&&Number.isFinite(q)&&Number.isFinite(ts)&&
   ts>=state.sessionStart-5000&&ts>=now-FLOW_KEEP_MS&&ts<=now+5000&&id&&
   (x.S==='Buy'||x.S==='Sell'))){state.tradeRejected++;continue}
  if(state.tradeIds.has(id)){state.tradeDuplicates++;continue}
  state.tradeIds.set(id,now);
  const t={id,price:p,usdt:p*q,buy:x.S==='Buy',ts,seq};
  state.trades.push(t);
  state.sessionCvd+=(t.buy?1:-1)*t.usdt;
  // Delayed or out-of-order packets must never roll the live price backwards.
  if(now-ts<=18000&&(ts>state.lastTradeEventTs||
    (ts===state.lastTradeEventTs&&seq>=state.lastTradeSeq))){
   state.lastPrice=state.price;state.price=p;state.lastPriceAt=now;
   if(!state.priceAtFirst)state.priceAtFirst=p;
   state.lastTradeEventTs=ts;state.lastTradeSeq=seq
  }
  const policy=adaptivePrintPolicy(now);
  if(t.usdt>=policy.individualMin&&now-ts<=15000){
   state.whales.unshift(t);state.whales=state.whales.slice(0,35);
   alertUser((t.buy?'Compra':'Venta')+' agresiva grande '+usd(t.usdt)+' a '+usd(p)+
    ' (umbral observado '+usd(policy.individualMin)+')','whale-'+id,0,
    {kind:'whale',side:t.buy?'Buy':'Sell',price:p,amount:t.usdt,
     baseline:policy.individualMin,eventId:id,source:'Bybit publicTrade · operación ejecutada'})
  }
 }
 if(now-(state.lastFlowPrune||0)>5000||state.trades.length>FLOW_CAP+300){
  state.lastFlowPrune=now;trimObservedFlows(now)
 }
 if(now-(state.lastTradeRenderAt||0)>1000){
  state.lastTradeRenderAt=now;renderPrice();renderTrades()
 }
 if(now-state.lastBreakCheckAt>1000){
  state.lastBreakCheckAt=now;checkBreakouts();renderBreakouts()
 }
 if(now-(state.lastModelAt||0)>30000){state.lastModelAt=now;model()}
}
function onBook(d){
 const a=d.data;
 if(!a||!Array.isArray(a.b)||!Array.isArray(a.a))return;
 const now=Date.now();
 if(d.type==='snapshot'||a.u===1){
  resetLiveAlertGrouping();
  resetComparisonPersistence();
  resetWallTracking();
  state.bids.clear();state.asks.clear();state.wallSeen.clear();state.wallQualifiedSince.clear();state.zoneSeen.clear();state.wallDisappeared.clear();state.wallPolicy=null;state.heatSamples=[];state.lastHeatAt=0;drawLiquidityHeat();
 }
 for(const [updates,book,prefix] of [[a.b,state.bids,'B:'],[a.a,state.asks,'A:']]){
  for(const [p,q] of updates){
   if(!Number.isFinite(+p)||+p<=0||!Number.isFinite(+q))continue;
   const key=prefix+p;
   const oldQty=Number(book.get(p))||0,priorNotional=oldQty*(+p),newNotional=(+q)*(+p);
   if(d.type==='delta'&&a.u!==1)captureWallChanges(prefix==='B:'?'bid':'ask',+p,oldQty,+q,now,key);
   if(d.type==='delta'&&a.u!==1&&oldQty>+q){
    const age=now-(state.wallSeen.get(key)||now);
    recordWallDrop(prefix==='B:'?'bid':'ask',+p,oldQty,+q,age,now)
   }
   if(+q<=0){book.delete(p);state.wallSeen.delete(key);state.wallQualifiedSince.delete(key);continue}
   if(!book.has(p))state.wallSeen.set(key,now);
   const limit=wallThreshold(prefix==='B:'?'bid':'ask',now);
   if(newNotional>=limit){
    if(priorNotional<limit||!state.wallQualifiedSince.has(key))state.wallQualifiedSince.set(key,now)
   }else state.wallQualifiedSince.delete(key);
   book.set(p,q)
  }
 }
 state.lastBookAt=now;
 // Recalibrate only after the completed snapshot, or every five seconds for deltas.
 if(d.type==='snapshot'||a.u===1||!state.wallPolicy||now-state.wallPolicy.at>=5000){
  state.wallPolicy=null;
  const policy=relativeWallPolicy(now);
  for(const [book,prefix,side] of [[state.bids,'B:','bid'],[state.asks,'A:','ask']]){
   for(const [p,q] of book){
    const key=prefix+p,notional=Number(p)*Number(q);
    if(notional>=policy[side].threshold){
     if(!state.wallQualifiedSince.has(key))state.wallQualifiedSince.set(key,now)
    }else state.wallQualifiedSince.delete(key)
   }
  }
 }
 if(!state.lastWallCleanupAt||now-state.lastWallCleanupAt>15000){state.lastWallCleanupAt=now;cleanupWallHistory(now)}
 if(now-state.lastBookRenderAt>500){state.lastBookRenderAt=now;renderBook()}
}

function liquidationWindow(durationMs,now=Date.now()){
 const out={long:0,short:0,count:0};
 for(const x of state.liq){
  if(now-x.ts<0||now-x.ts>durationMs)continue;
  out[x.side]+=x.notional;out.count++
 }
 return out
}
function onLiquidation(d){
 if(!Array.isArray(d.data))return;
 const now=Date.now();
 for(const l of d.data){
  const p=Number(l.p),q=Number(l.v),ts=Number(l.T),side=l.S==='Buy'?'long':l.S==='Sell'?'short':'';
  if(l.s&&l.s!=='BTCUSDT')continue;
  if(!(p>0&&q>0&&Number.isFinite(ts)&&ts>=state.sessionStart-5000&&
       ts>=now-FLOW_KEEP_MS&&ts<=now+5000&&side)){state.liqRejected++;continue}
  // There is no guaranteed unique liquidation ID. Exact fingerprint is best effort.
  const fp=[l.s||'BTCUSDT',l.S,String(ts),String(p),String(q)].join('|');
  if(state.liqFingerprints.has(fp)){state.liqDuplicates++;continue}
  state.liqFingerprints.set(fp,now);
  const v=p*q;
  if(side==='long')state.longLiq+=v;else state.shortLiq+=v;
  state.liq.push({side,price:p,notional:v,ts,fp});
  state.lastLiqAt=now
 }
 trimObservedFlows(now);renderLiq()
}
// Binance partial book depth20 is a full top-20 snapshot, never a diff.
function normalizeBookRows(rows,descending){
 if(!Array.isArray(rows))return [];
 return rows.slice(0,20).map(x=>({p:Number(x[0]),q:Number(x[1])}))
  .filter(x=>x.p>0&&x.q>0&&Number.isFinite(x.p)&&Number.isFinite(x.q))
  .sort((a,b)=>descending?b.p-a.p:a.p-b.p).slice(0,20)
}
function onBinanceBook(msg,now=Date.now()){
 if(msg.e!=='depthUpdate'||msg.s!=='BTCUSDT'||!Array.isArray(msg.b)||!Array.isArray(msg.a))return;
 const bids=normalizeBookRows(msg.b,true),asks=normalizeBookRows(msg.a,false);
 if(bids.length<2||asks.length<2)return;
 state.binanceBids=bids;state.binanceAsks=asks;state.binanceLastAt=now;
 if(now-state.lastCompareAt>1000){state.lastCompareAt=now;renderExchangeComparison(now)}
}
function connectBinance(){
 if(state.binanceReconn){clearTimeout(state.binanceReconn);state.binanceReconn=null}
 let socket;
 try{socket=new WebSocket('wss://fstream.binance.com/ws/btcusdt@depth20@500ms')}
 catch(e){$('binanceStatus').textContent='No disponible';state.binanceReconn=setTimeout(connectBinance,10000);return}
 state.binanceWs=socket;
 socket.onopen=()=>{$('binanceStatus').textContent='Conectado · esperando libro'};
 socket.onmessage=e=>{try{onBinanceBook(JSON.parse(e.data))}catch(err){console.warn('Binance depth',err.message)}};
 socket.onerror=()=>{$('binanceStatus').textContent='Error de conexión'};
 socket.onclose=()=>{
  if(state.binanceWs!==socket)return;
  state.binanceBids=[];state.binanceAsks=[];state.binanceLastAt=0;resetComparisonPersistence();
  $('binanceStatus').textContent='Reconectando';renderExchangeComparison();
  if(!state.binanceReconn)state.binanceReconn=setTimeout(connectBinance,9000)
 }
}
function bestComparisonLevels(book,side){
 const rows=side==='bid'?[...book].sort((a,b)=>Number(b[0])-Number(a[0])):[...book].sort((a,b)=>Number(a[0])-Number(b[0]));
 return normalizeBookRows(rows,side==='bid');
}
function majorLevel(rows){
 if(!rows.length)return null;
 return rows.map(x=>({p:x.p,v:x.p*x.q})).sort((a,b)=>b.v-a.v)[0]
}

function findWallMatches(bybitRows,binanceRows,side,reference){
 const tol=Math.max(10,reference*.00035);
 const top=rows=>rows.map((x,i)=>({p:Number(x.p),v:Number(x.p)*Number(x.q),i}))
  .filter(x=>Number.isFinite(x.p)&&Number.isFinite(x.v)&&x.p>0&&x.v>=100000);
 const bs=top(bybitRows),ns=top(binanceRows),pairs=[];
 for(const a of bs)for(const b of ns){
  if(Math.abs(a.p-b.p)<=tol)pairs.push({side,p:(a.p+b.p)/2,dist:Math.abs(a.p-b.p),importance:Math.min(a.v,b.v),ai:a.i,bi:b.i})
 }
 pairs.sort((a,b)=>b.importance-a.importance||a.dist-b.dist);
 const seenA=new Set(),seenB=new Set(),chosen=[];
 for(const x of pairs){
  if(seenA.has(x.ai)||seenB.has(x.bi))continue;
  seenA.add(x.ai);seenB.add(x.bi);chosen.push(x);
  if(chosen.length===2)break
 }
 return chosen
}


// Only compare equal top-20 book coverage, in quote notional USD (price × BTC qty).
// Each market has its own best bid/ask midpoint. A common raw price can be a
// DIFFERENT depth from mid when the two venues have a basis/spread difference.
function comparisonReference(bids,asks){
 if(bids.length<2||asks.length<2)return null;
 const bestBid=Number(bids[0].p),bestAsk=Number(asks[0].p);
 if(!(bestBid>0&&bestAsk>bestBid))return null;
 const mid=(bestBid+bestAsk)/2,spreadBps=(bestAsk-bestBid)/mid*10000;
 if(!Number.isFinite(spreadBps)||spreadBps>20)return null;
 return {mid,bestBid,bestAsk,spreadBps}
}
function comparableCandidates(rows,mid){
 const list=rows.slice(0,20).map((x,i)=>({
  p:Number(x.p),q:Number(x.q),i
 })).filter(x=>x.p>0&&x.q>0&&Number.isFinite(x.p)&&Number.isFinite(x.q))
  .map(x=>({...x,v:x.p*x.q,offsetBps:(x.p/mid-1)*10000}));
 const sizes=list.map(x=>x.v).sort((a,b)=>a-b);
 const median=sizes.length?sizes[Math.floor((sizes.length-1)/2)]:1;
 return list.filter(x=>x.v>=100000).map(x=>({...x,relative:x.v/Math.max(1,median)}))
}
function normalizedCrossMatches(bybitRows,binanceRows,side,bybitMid,binanceMid){
 const a=comparableCandidates(bybitRows,bybitMid),b=comparableCandidates(binanceRows,binanceMid),matches=[];
 // Prior relative tolerance is max($10, 0.035%); express in common basis points.
 const toleranceBps=Math.max(3.5,100000/Math.min(bybitMid,binanceMid));
 for(const x of a)for(const y of b){
  const separation=Math.abs(x.offsetBps-y.offsetBps);
  if(separation>toleranceBps)continue;
  const comparableStrength=Math.min(x.relative,y.relative);
  const score=comparableStrength*Math.log1p(Math.min(x.v,y.v)/100000);
  matches.push({side,bybitPrice:x.p,binancePrice:y.p,bybitUsd:x.v,binanceUsd:y.v,
   bybitOffsetBps:x.offsetBps,binanceOffsetBps:y.offsetBps,separationBps:separation,
   comparableStrength,score,ai:x.i,bi:y.i,toleranceBps})
 }
 matches.sort((x,y)=>y.score-x.score||x.separationBps-y.separationBps);
 const chosen=[],usedA=new Set(),usedB=new Set();
 for(const x of matches){
  if(usedA.has(x.ai)||usedB.has(x.bi))continue;
  usedA.add(x.ai);usedB.add(x.bi);chosen.push(x);
  if(chosen.length>=2)break
 }
 return chosen
}
function resetComparisonPersistence(){
 state.compareTracks.clear();state.compareSampleAt=0;
 state.compareSampleBybit=0;state.compareSampleBinance=0
}
function comparisonTrackKey(x){
 // Exact visible prices in each venue, not a claim of identical order identity.
 return x.side+'|'+x.bybitPrice.toFixed(2)+'|'+x.binancePrice.toFixed(2)
}
function observeComparison(matches,now=Date.now()){
 if(state.compareSampleAt&&now-state.compareSampleAt>10000)resetComparisonPersistence();
 if(state.compareSampleAt&&now-state.compareSampleAt<3800)return false;
 // A UI repaint alone cannot increase persistence: both book streams must advance.
 if(state.lastBookAt<=state.compareSampleBybit||
   state.binanceLastAt<=state.compareSampleBinance)return false;
 const next=new Map();
 for(const x of matches){
  const key=comparisonTrackKey(x),old=state.compareTracks.get(key);
  if(old&&now-old.lastAt<=10000)
   next.set(key,{firstAt:old.firstAt,lastAt:now,count:old.count+1});
  else next.set(key,{firstAt:now,lastAt:now,count:1})
 }
 state.compareTracks=next;state.compareSampleBybit=state.lastBookAt;
 state.compareSampleBinance=state.binanceLastAt;state.compareSampleAt=now;
 return true
}
function renderExchangeComparison(now=Date.now()){
 const bybitFresh=state.wsOk&&now-state.lastBookAt>=0&&now-state.lastBookAt<8000;
 const binanceFresh=now-state.binanceLastAt>=0&&now-state.binanceLastAt<8000;
 const market=(name,bids,asks)=>{
  const b=majorLevel(bids),a=majorLevel(asks);
  $(name+'Bid').textContent=b?usd(b.p)+' · '+usd(b.v):'—';
  $(name+'Ask').textContent=a?usd(a.p)+' · '+usd(a.v):'—'
 };
 const bybitBids=bybitFresh?bestComparisonLevels(state.bids,'bid'):[];
 const bybitAsks=bybitFresh?bestComparisonLevels(state.asks,'ask'):[];
 const binanceBids=binanceFresh?state.binanceBids:[],binanceAsks=binanceFresh?state.binanceAsks:[];
 market('cmpBybit',bybitBids,bybitAsks);market('cmpBinance',binanceBids,binanceAsks);
 const src=$('compareStatus'),conf=$('compareCoincidence'),detail=$('compareNormalization');
 src.textContent='Bybit '+(bybitFresh?'actualizado':'sin datos recientes')+
  ' · Binance '+(binanceFresh?'actualizado':'sin datos recientes')+' · '+time(now);
 $('binanceStatus').textContent=binanceFresh?'Conectado':'Sin datos recientes';
 if(!bybitFresh||!binanceFresh||Math.abs(state.lastBookAt-state.binanceLastAt)>5000){
  resetComparisonPersistence();
  detail.textContent='Sin referencias de precio simultáneas y frescas; persistencia reiniciada.';
  conf.textContent='Comparación no disponible: fuentes ausentes o sin sincronía temporal suficiente.';return
 }
 const bRef=comparisonReference(bybitBids,bybitAsks),nRef=comparisonReference(binanceBids,binanceAsks);
 if(!bRef||!nRef){
  resetComparisonPersistence();
  detail.textContent='Libro incompleto, cruzado o spread excesivo en algún mercado; persistencia reiniciada.';
  conf.textContent='Coincidencias no comparables: no se pudo validar el mejor bid/ask de ambos mercados.';return
 }
 const basis=(nRef.mid/bRef.mid-1)*10000;
 detail.textContent='Mids: Bybit '+usd(bRef.mid)+' (spread '+bRef.spreadBps.toFixed(2)+' pb), Binance '+
  usd(nRef.mid)+' (spread '+nRef.spreadBps.toFixed(2)+' pb). Diferencia de mids '+
  (basis>=0?'+':'')+basis.toFixed(2)+' pb · importe nivel = precio × BTC (US$) · fortaleza relativa a mediana de 20 niveles por lado.';
 if(Math.abs(basis)>25){
  resetComparisonPersistence();
  conf.textContent='Comparación suspendida: diferencia de precio medio entre exchanges superior a 25 pb; no se presume equivalencia.';return
 }
 const matches=[
  ...normalizedCrossMatches(bybitBids,binanceBids,'bid',bRef.mid,nRef.mid),
  ...normalizedCrossMatches(bybitAsks,binanceAsks,'ask',bRef.mid,nRef.mid)
 ];
 observeComparison(matches,now);
 conf.textContent=matches.length?matches.map(x=>{
  const track=state.compareTracks.get(comparisonTrackKey(x));
  const age=track?now-track.firstAt:0,observed=track?.count||0;
  const confirmed=track&&observed>=3&&age>=12000&&now-track.lastAt<=8000;
  return (x.side==='bid'?'Compras':'Ventas')+' a profundidad relativa similar: '+
   'Bybit '+usd(x.bybitPrice)+' ('+usd(x.bybitUsd)+') y Binance '+usd(x.binancePrice)+
   ' ('+usd(x.binanceUsd)+') · separación '+x.separationBps.toFixed(2)+' pb · '+
   'fortaleza relativa mínima ×'+x.comparableStrength.toFixed(2)+' · '+
   (confirmed?'PERSISTENTE':'EN OBSERVACIÓN')+
   ' ('+observed+' muestras de ambos libros; '+Math.round(age/1000)+' s)'
 }).join(' · ')+'. Son precios/posiciones relativas similares, no una misma orden ni garantía de soporte.':
  'Sin niveles ≥US$100.000 en cada mercado a profundidad relativa comparable (máximo 2 por lado). No se suman importes entre exchanges.'
}

function connectBybit(){let ws=new WebSocket('wss://stream.bybit.com/v5/public/linear');state.ws=ws;ws.onopen=()=>{ws.send(JSON.stringify({op:'subscribe',args:['publicTrade.BTCUSDT','orderbook.200.BTCUSDT','allLiquidation.BTCUSDT']}));state.wsOk=true;status('bybitStatus','Conectado',true);status('liqStatus','Conectado',true);$('error').textContent=''};ws.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(!d.topic)return;if(d.topic.startsWith('publicTrade.'))onTrade(d);else if(d.topic.startsWith('orderbook.'))onBook(d);else if(d.topic.startsWith('allLiquidation.'))onLiquidation(d)};ws.onerror=()=>{status('bybitStatus','Error de conexión',false);status('liqStatus','Error de conexión',false)};ws.onclose=()=>{state.wsOk=false;status('bybitStatus','Reconectando',false);status('liqStatus','Reconectando',false);resetLiveAlertGrouping();resetComparisonPersistence();resetWallTracking();state.bids.clear();state.asks.clear();state.wallSeen.clear();state.wallQualifiedSince.clear();state.zoneSeen.clear();state.wallDisappeared.clear();state.wallPolicy=null;state.heatSamples=[];state.lastHeatAt=0;state.lastBookAt=0;renderBook();drawLiquidityHeat();setTimeout(connectBybit,6000)};if(state.pingTimer)clearInterval(state.pingTimer);state.pingTimer=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({op:'ping'}))},20000)}
async function req(url){let ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),8000);try{let r=await fetch(url,{signal:ctl.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(timeout)}}
async function getOi(){// Public sources, no credentials, no simulated fallback.
const providers=[{name:'Bybit',url:'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=1',parse:d=>{if(d.retCode!==0)throw Error('Bybit '+d.retMsg);return asNum(d.result?.list?.[0]?.openInterest)}},{name:'Binance',url:'https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',parse:d=>asNum(d.openInterest)}];for(let p of providers){try{let d=await req(p.url),v=p.parse(d);if(v>0){if(state.oiSource!==p.name){state.oiFirst=0}state.oi=v;state.oiSource=p.name;if(!state.oiFirst)state.oiFirst=v;state.lastOiAt=Date.now();$('oi').textContent=cash(v)+' BTC';$('oiSource').textContent=p.name;$('oiStamp').textContent=p.name+' REST BTCUSDT · consultado '+dateTime(state.lastOiAt)+' · OI en BTC';$('oiDelta').textContent=pct((v/state.oiFirst-1)*100);state.restOk=true;status('restStatus','OI: '+p.name,true);if(state.lastHistoryAt)model();return}}catch(err){console.warn('OI '+p.name,err.message)}}status('restStatus','Open Interest no disponible',false);if(Date.now()-state.lastOiAt>120000){state.oi=0;$('oi').textContent='—';$('oiDelta').textContent='—';model()}}
async function getCandles(){const tf=state.tf,request=++state.candlesRequest;
 const providers=[{name:'Bybit',url:`https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=${tf}&limit=8`,parse:d=>{if(d.retCode!==0)throw Error('Bybit error');return d.result.list}},{name:'Binance',url:`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${tf==='60'?'1h':tf==='240'?'4h':tf+'m'}&limit=8`,parse:d=>d.map(x=>[x[0],x[1],x[2],x[3],x[4]])}];
 for(const source of providers){try{const d=await req(source.url),v=source.parse(d);
  if(tf!==state.tf||request!==state.candlesRequest)return;
  if(Array.isArray(v)&&v.length){state.candles=v.sort((a,b)=>+b[0]-+a[0]);state.candlesTf=tf;state.candleSource=source.name;renderPrice();checkBreakouts();renderBreakouts();return}
 }catch(e){console.warn('kline '+source.name,e.message)}}
 if(tf!==state.tf||request!==state.candlesRequest)return;
 state.candles=[];state.candlesTf=tf;state.candleSource='';renderPrice()
}


// OI timestamps are observations; a closed Bybit kline starts at the first OI
// observation and ends at the second. Never align live unfinished candles.
function closedPriceCandle(candles,start,end,now=Date.now()){
 if(!Array.isArray(candles)||!Number.isFinite(start)||!Number.isFinite(end)||end>now)return null;
 const k=candles.find(row=>Array.isArray(row)&&Number(row[0])===start);
 if(!k)return null;
 const open=Number(k[1]),close=Number(k[4]);
 if(!(open>0&&close>0&&Number.isFinite(open)&&Number.isFinite(close)))return null;
 return {start,end,open,close,pricePct:(close/open-1)*100};
}

// A descriptive relative threshold, NOT a statistical significance test.
function classifyOiChange(points,periodMs,now=Date.now()){
 if(!Array.isArray(points)||points.length<2)return {ok:false,reason:'OI insuficiente'};
 const sorted=[...points].sort((a,b)=>a.ts-b.ts),last=sorted.at(-1),prev=sorted.at(-2);
 if(!(last.v>0&&prev.v>0)||last.ts>now+1000||now-last.ts>Math.max(periodMs*2,600000)||
  Math.abs(last.ts-prev.ts-periodMs)>1000)return {ok:false,reason:'Muestras OI no consecutivas o atrasadas'};
 const observed=(last.v/prev.v-1)*100,history=[];
 // Baseline excludes the interval being classified (avoid calibrating on itself).
 for(let i=1;i<sorted.length-1;i++){
  const a=sorted[i-1],b=sorted[i];
  if(a.v>0&&b.v>0&&Math.abs(b.ts-a.ts-periodMs)<=1000){
   history.push(Math.abs((b.v/a.v-1)*100))
  }
 }
 if(history.length<8)return {ok:true,observed,samples:history.length,threshold:null,
  label:'Sin histórico suficiente para valorar importancia'};
 history.sort((a,b)=>a-b);
 const median=history[Math.floor((history.length-1)/2)];
 const threshold=Math.max(.03,Math.min(2,median*2));
 const notable=Math.abs(observed)>=threshold;
 return {ok:true,observed,threshold,samples:history.length,median,notable,
  label:notable?'Mayor que la variación habitual reciente':'Variación moderada frente a histórico reciente'}
}

function alignPriceOi(points,candles,periodMs,now=Date.now()){
 if(!Array.isArray(points)||points.length<2)return {ok:false,reason:'Datos OI insuficientes'};
 const last=points.at(-1),prev=points.at(-2),gap=last.ts-prev.ts;
 if(Math.abs(gap-periodMs)>Math.min(1000,periodMs*.01))return {ok:false,reason:'Muestras OI no consecutivas'};
 if(last.ts>now)return {ok:false,reason:'Muestra OI futura o vela sin cerrar'};
 if(now-last.ts>Math.max(600000,periodMs*2))return {ok:false,reason:'Muestras OI atrasadas'};
 if(!(last.v>0&&prev.v>0))return {ok:false,reason:'Open Interest inválido'};
 const candle=closedPriceCandle(candles,prev.ts,last.ts,now);
 if(!candle)return {ok:false,reason:'No existe vela cerrada exactamente alineada con OI'};
 return {ok:true,start:prev.ts,end:last.ts,pricePct:candle.pricePct,oiPct:(last.v/prev.v-1)*100,
         priceOpen:candle.open,priceClose:candle.close,oiStart:prev.v,oiEnd:last.v};
}

function drawOiSeries(){
 const cvas=$('oiChart'),box=cvas.parentElement,rect=box.getBoundingClientRect(),w=Math.max(230,rect.width),h=Math.max(110,rect.height),dpr=Math.min(devicePixelRatio||1,2);
 cvas.width=Math.round(w*dpr);cvas.height=Math.round(h*dpr);
 const ctx=cvas.getContext('2d');ctx.scale(dpr,dpr);
 ctx.fillStyle='#0c1523';ctx.fillRect(0,0,w,h);
 const data=state.oiSeries;
 if(data.length<2){ctx.fillStyle='#9db0c5';ctx.font='12px system-ui';ctx.fillText('Histórico no disponible',12,h/2);return}
 const values=data.map(z=>z.v);
 const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(1,hi-lo),pad=span*.12,min=lo-pad,max=hi+pad;
 const x=i=>14+i*(w-28)/(data.length-1);
 const y=v=>13+(max-v)/(max-min)*(h-31);
 for(let k=0;k<3;k++){const yy=13+(h-31)*k/2;ctx.strokeStyle='#22334a';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(8,yy);ctx.lineTo(w-8,yy);ctx.stroke()}
 ctx.beginPath();data.forEach((z,i)=>{i?ctx.lineTo(x(i),y(z.v)):ctx.moveTo(x(i),y(z.v))});
 ctx.lineWidth=2;ctx.strokeStyle=data.at(-1).v>=data[0].v?'#40d5a4':'#fa6b84';ctx.stroke();
 const last=data.at(-1);ctx.beginPath();ctx.fillStyle=ctx.strokeStyle;ctx.arc(x(data.length-1),y(last.v),3,0,Math.PI*2);ctx.fill();
 ctx.font='10px system-ui';ctx.fillStyle='#9bb1c8';ctx.textAlign='left';ctx.fillText(time(data[0].ts).slice(0,5),8,h-4);
 ctx.textAlign='right';ctx.fillText(time(last.ts).slice(0,5),w-8,h-4)
}
async function getOiSeries(){
 const tf=state.tf,interval=({'5':'5min','15':'15min','30':'30min','60':'1h','240':'4h'})[tf],request=++state.oiSeriesRequest;
 if(state.oiSeriesTf!==tf){
  state.oiSeries=[];state.oiSeriesTf=tf;state.oiAligned=null;state.oiRelevance=null;
  $('oiAlignedPrice').textContent='—';
  $('oiRelevance').textContent='Calibrando variación OI...';
  $('oiWindowDelta').textContent='—';$('oiWindowStamp').textContent='Cargando historial '+interval+'...';
  $('oiAlignedDetails').textContent='Buscando vela cerrada alineada con OI...';
  drawOiSeries()
 }
 try{
  const [d,k]=await Promise.all([
   req('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime='+interval+'&limit=48'),
   req('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval='+tf+'&limit=7')
  ]);
  if(d.retCode!==0||k.retCode!==0)throw Error('Respuesta Bybit inválida');
  const points=(d.result?.list||[]).map(x=>({ts:Number(x.timestamp),v:Number(x.openInterest)}))
   .filter(x=>Number.isFinite(x.ts)&&Number.isFinite(x.v)&&x.ts>1500000000000&&x.v>0).sort((a,b)=>a.ts-b.ts);
  if(points.length<2)throw Error('Historial OI incompleto');
  if(state.tf!==tf||state.oiSeriesRequest!==request)return;
  state.oiSeries=points;state.oiSeriesAt=Date.now();
  const aligned=alignPriceOi(points,k.result?.list||[],Number(tf)*60000,Date.now());
  const relevance=classifyOiChange(points,Number(tf)*60000,Date.now());
  state.oiRelevance=aligned.ok&&relevance.ok?{...relevance,tf,end:aligned.end,computedAt:Date.now()}:null;
  $('oiRelevance').textContent=aligned.ok&&relevance.ok?
   relevance.label+' · '+(relevance.threshold===null?'umbral no disponible':'umbral relativo ±'+relevance.threshold.toFixed(3)+'%')+
   ' · cambio '+pct(relevance.observed)+' · '+relevance.samples+' intervalos previos consecutivos · Bybit '+interval:
   'Sin clasificación OI: '+(!aligned.ok?aligned.reason:relevance.reason);
  state.oiAligned=aligned.ok?{...aligned,tf,computedAt:Date.now()}:null;
  if(aligned.ok){
   $('oiWindowDelta').textContent=pct(aligned.oiPct);
   $('oiWindowDelta').className='num mono '+(aligned.oiPct>=0?'up':'down');
   $('oiWindowStamp').textContent='Bybit · '+points.length+' registros · '+time(aligned.start)+'–'+time(aligned.end)+' · '+interval+' · vela cerrada';
   $('oiAlignedPrice').textContent=pct(aligned.pricePct);
   $('oiAlignedPrice').className='num mono '+(aligned.pricePct>=0?'up':'down');
   $('oiAlignedDetails').textContent='Mismo periodo cerrado '+time(aligned.start)+'–'+time(aligned.end)+
    ': BTC '+usd(aligned.priceOpen)+' → '+usd(aligned.priceClose)+
    '; OI '+cash(aligned.oiStart)+' → '+cash(aligned.oiEnd)+' BTC. Observaciones, no causalidad.';
  }else{
   $('oiWindowDelta').textContent='—';$('oiWindowDelta').className='num mono';
   $('oiAlignedPrice').textContent='—';$('oiAlignedPrice').className='num mono';
   $('oiWindowStamp').textContent='Bybit · '+aligned.reason+' ('+interval+')';
   $('oiAlignedDetails').textContent='Sin comparación precio–OI: '+aligned.reason+'. No se mezclan periodos ni velas abiertas.';
  }
  drawOiSeries();renderMarketSummary()
 }catch(e){
  if(state.tf!==tf||state.oiSeriesRequest!==request)return;
  state.oiAligned=null;state.oiRelevance=null;
  $('oiRelevance').textContent='Clasificación OI no disponible; fuente o ventana caducada';console.warn('OI y precio alineados',e.message);
  const age=(Date.now()-state.oiSeriesAt)/60000;
  if(age>10||!state.oiSeries.length)state.oiSeries=[];
  $('oiWindowDelta').textContent='—';$('oiAlignedPrice').textContent='—';
  $('oiWindowStamp').textContent='Bybit no disponible ('+interval+')';
  $('oiAlignedDetails').textContent='Comparación precio–OI no disponible; no se conservan porcentajes sin fuente vigente.';
  drawOiSeries();renderMarketSummary()
 }
}

async function getHistory(){
 try{
  const [oi,k]=await Promise.all([
   req('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=80'),
   req('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=5&limit=85')
  ]);
  if(oi.retCode!==0||k.retCode!==0)throw Error('Respuesta de Bybit inválida');
  const points=(oi.result?.list||[]).map(x=>({ts:Number(x.timestamp),v:Number(x.openInterest)}))
   .filter(x=>Number.isFinite(x.ts)&&Number.isFinite(x.v)&&x.v>0).sort((a,b)=>a.ts-b.ts);
  if(points.length<2||!(k.result?.list?.length))throw Error('Historial insuficiente');
  state.oiHistory=points;state.fiveCandles=k.result.list;state.lastHistoryAt=Date.now();model();
 }catch(err){
  console.warn('Historial OI',err.message);
  if(Date.now()-state.lastHistoryAt>360000){state.oiHistory=[];state.fiveCandles=[];model()}
 }
}

function tabs(){for(const b of document.querySelectorAll('[data-tf]'))b.addEventListener('click',()=>{state.tf=b.dataset.tf;document.querySelectorAll('[data-tf]').forEach(x=>x.classList.toggle('active',x===b));getCandles();getOiSeries();getAccountRatio();model();renderMarketSummary()})}function apply(){let n=Number($('threshold').value),d=Number($('distance').value);if(!Number.isFinite(n)||n<10000||!Number.isFinite(d)||d<.05||d>5){$('error').textContent='Umbral mínimo US$10.000; distancia entre 0,05% y 5%.';return}state.threshold=n;state.distance=d;state.whales=state.whales.filter(x=>x.usdt>=n);renderTrades();$('error').textContent='Configuración guardada en este dispositivo.';try{localStorage.setItem('btc-intelligence-config',JSON.stringify({threshold:n,distance:d}))}catch{}}function restore(){try{let d=JSON.parse(localStorage.getItem('btc-intelligence-config')||'{}');if(d.threshold>=10000)$('threshold').value=d.threshold;if(d.distance>=.05&&d.distance<=5)$('distance').value=d.distance}catch{}apply()}

// Alternative.me is a DAILY index for crypto generally, not an hourly BTC signal.
const FNG_URL='https://api.alternative.me/fng/?limit=2&format=json';
async function getOfficialFearGreed(){
 try{
  const d=await req(FNG_URL);
  if(!Array.isArray(d.data)||!d.data.length)throw Error('API sin datos');
  const first=d.data[0],prev=d.data[1];
  const val=Number(first.value),stamp=Number(first.timestamp)*1000,prior=prev?Number(prev.value):null;
  if(!Number.isInteger(val)||val<0||val>100||!Number.isFinite(stamp)||stamp<1500000000000||stamp>Date.now()+86400000)throw Error('Valor oficial inválido');
  state.fngValue=val;state.fngPrev=Number.isFinite(prior)&&prior>=0&&prior<=100?prior:null;state.fngAt=stamp;
  const names={'Extreme Fear':'Miedo extremo','Fear':'Miedo','Neutral':'Neutral','Greed':'Codicia','Extreme Greed':'Codicia extrema'};
  $('fngValue').textContent=String(val)+' / 100';
  $('fngClass').textContent=names[first.value_classification]||'Valor diario oficial';
  $('fngChange').textContent=state.fngPrev!==null?'Ayer: '+state.fngPrev+' · cambio '+(val-state.fngPrev>=0?'+':'')+(val-state.fngPrev):'Ayer: no disponible';
  $('fngUpdated').textContent='Dato del '+new Date(stamp).toLocaleDateString('es-ES')+' · actualizado diariamente';
 }catch(err){
  console.warn('Fear and Greed oficial',err.message);
  if(state.fngValue===null){$('fngValue').textContent='—';$('fngClass').textContent='Dato oficial no disponible';$('fngUpdated').textContent='No se sustituyen valores por estimaciones'}
  else $('fngUpdated').textContent='Último valor recibido: '+new Date(state.fngAt).toLocaleDateString('es-ES')+' · actualización pendiente';
 }
}
// Uses the PREVIOUS CLOSED hourly candle only, along with historical hourly
// open interest and account positioning. A label is descriptive, NOT a trained index.

function classifyHourlyContext(row){
 const {open,close,high,low,oiStart,oiEnd,ratioLong,funding,oiRelevance}=row;
 if(!(open>0&&close>0&&high>=low&&low>0&&oiStart>0&&oiEnd>0&&ratioLong>=0&&ratioLong<=1))
  return {ok:false,reason:'Datos horarios fuera de rango'};
 const pricePct=(close/open-1)*100,oiPct=(oiEnd/oiStart-1)*100;
 const rangePct=(high/low-1)*100;
 const priceBand=Math.max(.18,Math.min(.7,rangePct*.4));
 const direction=pricePct>priceBand?'up':pricePct<-priceBand?'down':'flat';
 const oiNotable=oiRelevance?.threshold!==null&&Number.isFinite(oiRelevance?.threshold)?
  Math.abs(oiPct)>=oiRelevance.threshold:null;
 const oiState=oiNotable===null?'sin contexto histórico':!oiNotable?'variación OI moderada':
  oiPct>0?'expansión relevante de OI':'contracción relevante de OI';
 const disagreement=(direction==='down'&&ratioLong>.60)||(direction==='up'&&ratioLong<.40);
 const label=disagreement?'Precio y cuentas contrapuestos':direction==='up'?
  'Subida con '+oiState:direction==='down'?'Caída con '+oiState:'Precio lateral y '+oiState;
 const txt='BTC '+pct(pricePct)+' (umbral de movimiento '+priceBand.toFixed(3)+'%) · '+
   'OI '+pct(oiPct)+' ('+oiState+') · cuentas long '+(ratioLong*100).toFixed(1)+
   '% (cuentas, no capital). '+(disagreement?'Predomina un posicionamiento contrario al cambio del precio. ':'')+
   (funding===null?'Funding no disponible como contexto actual.':
    'Funding indicativo para el próximo pago '+(funding>=0?'+':'')+(funding*100).toFixed(4)+'%'+
    ' (dato ACTUAL, no pertenece a la hora cerrada).')+
   ' Sin inferencia de dirección futura.';
 return {ok:true,label,detail:txt,pricePct,oiPct,direction,disagreement,oiNotable};
}
async function getHourlySentiment(){
 const slot=Math.floor(Date.now()/3600000);
 if(state.hourlyInFlight||slot===state.hourlySlot)return;
 state.hourlyInFlight=true;
 const start=(slot-1)*3600000,end=slot*3600000;
 try{
  const [k,o,a,t]=await Promise.all([
   req('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=60&limit=5'),
   req('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=48'),
   req('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=1h&limit=5'),
   req('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT')
  ]);
  if([k,o,a,t].some(x=>x.retCode!==0))throw Error('Bybit: respuesta incompleta');
  const c=(k.result?.list||[]).find(x=>Number(x[0])===start);
  const points=(o.result?.list||[]).map(x=>({ts:Number(x.timestamp),v:Number(x.openInterest)}))
   .filter(x=>x.v>0&&Number.isFinite(x.ts)).sort((a,b)=>a.ts-b.ts);
  const from=points.find(x=>x.ts===start),to=points.find(x=>x.ts===end);
  // Account ratio is a snapshot; use the observation at the end of the interval.
  const ratio=(a.result?.list||[]).find(x=>Number(x.timestamp)===end);
  const long=finiteNum(ratio?.buyRatio),short=finiteNum(ratio?.sellRatio);
  const funding=finiteNum(t.result?.list?.[0]?.fundingRate);
  const next=finiteNum(t.result?.list?.[0]?.nextFundingTime);
  const now=Date.now();
  if(!c||!from||!to||end>now||!Array.isArray(c)||
   !Number.isFinite(Number(c[1]))||!Number.isFinite(Number(c[4]))||
   long===null||short===null||Math.abs(long+short-1)>.03||
   !Number.isFinite(from.v)||!Number.isFinite(to.v))throw Error('Hora OI/precio/ratio sin correspondencia');
  // Never use the currently forming candle or stale account readings.
  if(Math.floor(now/3600000)!==slot)return;
  const history=points.filter(x=>x.ts<=end);
  const relevance=classifyOiChange(history,3600000,now);
  if(!relevance.ok)throw Error('OI horario no consecutivo o atrasado');
  const currFunding=funding!==null&&Math.abs(funding)<.2&&next&&next>now&&next<now+86400000?funding:null;
  const result=classifyHourlyContext({open:Number(c[1]),close:Number(c[4]),high:Number(c[2]),low:Number(c[3]),
    oiStart:from.v,oiEnd:to.v,ratioLong:long,funding:currFunding,oiRelevance:relevance});
  if(!result.ok)throw Error(result.reason);
  state.hourlySlot=slot;state.hourlyAt=now;state.hourlyWindowEnd=end;
  $('hourlySentimentLabel').textContent=result.label;
  $('hourlySentimentLabel').className='num '+(result.disagreement?'gold':result.direction==='up'?'up':result.direction==='down'?'down':'');
  $('hourlySentimentDetail').textContent=result.detail;
  $('hourlySentimentStamp').textContent='Ventana CERRADA '+dateTime(start)+'–'+dateTime(end)+
   ' · Bybit kline/OI; ratio de cuentas '+dateTime(end)+' · calculado '+time(now);
 }catch(err){
  console.warn('Termómetro horario',err.message);
  if(state.hourlyWindowEnd!==end){
   $('hourlySentimentLabel').textContent='Sin lectura horaria vigente';
   $('hourlySentimentLabel').className='num';
   $('hourlySentimentDetail').textContent='No se mezclan OI, precio o cuentas de intervalos distintos. '+err.message;
   $('hourlySentimentStamp').textContent='Bybit · actualización pendiente · '+dateTime(end);
  }else $('hourlySentimentStamp').textContent='Última lectura '+dateTime(end)+' · no se pudo refrescar';
 }finally{state.hourlyInFlight=false;renderSourceFreshness()}
}
function init(){initFolds();tabs();restore();renderTopSnapshot(Date.now(),true);$('apply').addEventListener('click',apply);connectBybit();connectBinance();getOfficialFearGreed();getHourlySentiment();getOi();getCandles();getHistory();getOiSeries();getAccountRatio();getFunding();renderSourceFreshness();setInterval(getOiSeries,60000);setInterval(getAccountRatio,60000);setInterval(getFunding,120000);setInterval(getOfficialFearGreed,3600000);setInterval(()=>{if(!document.hidden)getHourlySentiment()},60000);setInterval(getHistory,300000);setInterval(getOi,60000);setInterval(getCandles,60000);setInterval(captureLiquidityHeat,HEAT_SAMPLE_MS);setInterval(()=>{let now=Date.now();$('clock').textContent='Ahora '+time(now);let fresh=state.wsOk&&now-state.lastPriceAt<20000;$('connection').textContent=fresh?'EN VIVO':state.wsOk?'SIN OPERACIONES RECIENTES':'SIN CONEXIÓN';$('connection').className='pill '+(fresh?'good':'warn');renderBook();renderExchangeComparison(now);renderWallInsights(now);checkBreakouts(now);renderBreakouts(now);evaluateAbsorption(now);renderAdvancedWhales(now);renderLiq(now);renderMarketSummary(now);renderSourceFreshness(now);renderTopSnapshot(now);if(now-state.lastPriceAt>60000){$('lastTick').textContent='Precio no actualizado · última operación '+(state.lastPriceAt?time(state.lastPriceAt):'—')}renderTrades()},5000);window.addEventListener('resize',()=>{draw();drawOiSeries();drawLiquidityHeat()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){getHourlySentiment();getOfficialFearGreed();getOi();getCandles();if(!state.binanceWs||state.binanceWs.readyState===3)connectBinance();getAccountRatio();getFunding();drawLiquidityHeat();if(state.ws&&state.ws.readyState===1)state.ws.send(JSON.stringify({op:'ping'}))}});if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}init();
