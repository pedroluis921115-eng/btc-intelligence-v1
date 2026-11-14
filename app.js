'use strict';
const $=id=>document.getElementById(id);const state={tf:'5',price:0,lastPrice:0,priceAtFirst:0,priceAtTf:0,oi:0,oiFirst:0,oiSource:'',candles:[],candlesTf:'',candleSource:'',candlesRequest:0,liq:[],trades:[],whales:[],longLiq:0,shortLiq:0,bids:new Map(),asks:new Map(),ws:null,liqws:null,restOk:false,wsOk:false,liqOk:false,alerts:[],lastAlerts:new Map(),lastPriceAt:0,lastBookAt:0,lastLiqAt:0,lastOiAt:0,model:[],threshold:1e6,distance:.3,oiHistory:[],fiveCandles:[],lastHistoryAt:0,sessionCvd:0,oiSeries:[],oiSeriesTf:'',oiSeriesRequest:0,oiSeriesAt:0,oiAligned:null,zoneSeen:new Map(),wallSeen:new Map(),wallQualifiedSince:new Map(),lastBookRenderAt:0,heatSamples:[],lastHeatAt:0,lastTradeRenderAt:0,absorption:null,fundingRate:null,fundingNextAt:0,fundingAt:0,lastFundingRate:null,lastFundingAt:0,ratioLong:null,ratioShort:null,ratioAt:0,ratioTf:'',ratioReq:0,lastLargeAlertAt:0,wallDrops:[],wallDropCooldown:new Map(),wallMetrics:new Map(),wallEvents:[],wallDisappeared:new Map(),wallReappearances:[],wallPolicy:null,wallWatch:new Map(),breakouts:[],breakoutSuppressed:0,lastBreakCheckAt:0,binanceWs:null,binanceBids:[],binanceAsks:[],binanceLastAt:0,binanceReconn:null,lastCompareAt:0,lastWallArrivalAt:0,lastWallDropAlertAt:0,fngAt:0,fngValue:null,fngPrev:null,hourlySlot:-1,hourlyInFlight:false,hourlyAt:0};
const cash=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n):'—';const usd=n=>Number.isFinite(n)?'$'+cash(n):'—';const pct=n=>Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'—';const time=ms=>new Date(ms).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'});const status=(id,label,ok)=>{$(id).textContent=label;$(id).className=ok?'up':'gold'};const asNum=n=>{let v=Number(n);return Number.isFinite(v)?v:0};function alertUser(txt,key,limit=60000){let now=Date.now();if(now-(state.lastAlerts.get(key)||0)<limit)return;state.lastAlerts.set(key,now);state.alerts.unshift({ts:now,txt});state.alerts=state.alerts.slice(0,12);$('alerts').innerHTML=state.alerts.map(a=>`<div class="alertrow">${time(a.ts)} · ${escapeHtml(a.txt)}</div>`).join('')}function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

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
 for(const z of state.model){if(state.distance>0&&Math.abs(z.level/p-1)*100<state.distance)alertUser('Cerca de nivel hipotético '+z.side+' '+usd(z.level),'zone-'+z.side+':'+Math.round(z.level/step),300000)}
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
function renderLiq(){let rows=state.liq.slice(0,12).map(x=>`<div class="alertrow"><span class="${x.side==='long'?'down':'up'}">${x.side.toUpperCase()}</span> · ${usd(x.notional)} · ${usd(x.price)} · <span class="muted">${time(x.ts)}</span></div>`).join('');$('liqLong').textContent=usd(state.longLiq);$('liqShort').textContent=usd(state.shortLiq);$('events').innerHTML=rows||'<div class="empty">Todavía no se ha recibido ninguna liquidación ejecutada.</div>'}
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
  $('absorptionDetail').textContent='Se requiere conexión activa y operaciones recientes de Bybit';
  return
 }
 let buy=0,sell=0,n=0,first=null,last=null;
 for(const t of state.trades){
  if(now-t.ts>90000||t.ts>now+5000)continue;
  n++;
  if(t.buy)buy+=t.usdt;else sell+=t.usdt;
  if(!first||t.ts<first.ts)first=t;
  if(!last||t.ts>last.ts)last=t
 }
 const duration=first&&last?last.ts-first.ts:0,total=buy+sell;
 if(!first||n<12||duration<25000||total<500000){
  $('absorptionStatus').textContent='Reuniendo datos (90 s)';
  $('absorptionDetail').textContent='Se necesitan al menos 25 s observados, 12 operaciones y US$500.000 de volumen agresivo en la ventana';
  return
 }
 const share=Math.max(buy,sell)/total,movePct=(last.price/first.price-1)*100;
 const enough=share>=.72;
 const buyAbsorption=enough&&sell>buy&&movePct>=-.035;
 const sellAbsorption=enough&&buy>sell&&movePct<=.035;
 const priceStr=(movePct>=0?'+':'')+movePct.toFixed(3)+'%';
 const sideText=sell>buy?'ventas':'compras';
 if(buyAbsorption){
  $('absorptionStatus').textContent='Posible absorción compradora';
  $('absorptionStatus').className='num up';
 }else if(sellAbsorption){
  $('absorptionStatus').textContent='Posible absorción vendedora';
  $('absorptionStatus').className='num down';
 }else{
  $('absorptionStatus').textContent='Sin absorción destacable';
  $('absorptionStatus').className='num';
 }
 $('absorptionDetail').textContent=(100*share).toFixed(0)+'% '+sideText+' agresivas · '+usd(total)+' negociados · BTC '+priceStr+' durante '+Math.round(duration/1000)+' s. '+(buyAbsorption||sellAbsorption?'Desequilibrio sin desplazamiento proporcional. Indicio, no confirmación.':'El flujo no cumple el criterio de absorción.');
 if(buyAbsorption||sellAbsorption){
  const label=buyAbsorption?'compradora':'vendedora';
  alertUser('Posible absorción '+label+': '+(share*100).toFixed(0)+'% '+sideText+' y precio '+priceStr,'absorption-'+label,180000)
 }
}


// Large prints are public tape records, not identified wallets or unique traders.
// "Sequence" means multiple trades in the same aggressor direction, NOT one whale.
function renderAdvancedWhales(now=Date.now()){
 const root=$('largeFlow');
 if(!root)return;
 const recent=state.trades.filter(t=>now-t.ts<=90000&&now-t.ts>=0&&t.usdt>=100000).sort((a,b)=>b.ts-a.ts);
 const bySide=(buy)=>recent.filter(t=>t.buy===buy);
 const long=bySide(true),short=bySide(false);
 const sum=x=>x.reduce((a,t)=>a+t.usdt,0);
 const buyer=sum(long),seller=sum(short);
 $('largeBuy').textContent=usd(buyer)+' · '+long.length+' ejec.';
 $('largeSell').textContent=usd(seller)+' · '+short.length+' ejec.';
 const candidate=(count,value)=>count>=3&&value>=500000;
 const buySeq=candidate(long.length,buyer),sellSeq=candidate(short.length,seller);
 if(!state.wsOk||now-state.lastPriceAt>20000){
  $('largeFlowStatus').textContent='Datos de operaciones no disponibles';
  root.innerHTML='<div class="empty">Esperando flujo en vivo.</div>';
  return
 }
 $('largeFlowStatus').textContent=buySeq&&sellSeq?'Rachas en ambos lados':buySeq?'Racha compradora detectada':sellSeq?'Racha vendedora detectada':'Sin rachas grandes detectadas';
 root.innerHTML=recent.slice(0,6).map(t=>'<div class="alertrow"><span class="'+(t.buy?'up':'down')+'">'+(t.buy?'COMPRA':'VENTA')+'</span> · '+usd(t.usdt)+' · '+usd(t.price)+' <span class="muted">'+time(t.ts)+'</span></div>').join('')||'<div class="empty">Sin ejecuciones individuales ≥US$100.000 durante los últimos 90 s.</div>';
 if((buySeq||sellSeq)&&now-state.lastLargeAlertAt>300000){
  state.lastLargeAlertAt=now;
  alertUser('Racha pública de operaciones grandes ('+(buySeq?'compras':'')+(buySeq&&sellSeq?'/':'')+(sellSeq?'ventas':'')+') en 90 s','large-flow',300000)
 }
}
const tfPeriod=()=>({'5':'5min','15':'15min','30':'30min','60':'1h','240':'4h'})[state.tf];
const finiteNum=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
async function getFunding(){
 const now=Date.now();
 const [current,history]=await Promise.allSettled([
  req('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'),
  req('https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=1')
 ]);
 if(current.status==='fulfilled'){
  const d=current.value;
  const row=d.retCode===0?d.result?.list?.[0]:null;
  const value=finiteNum(row?.fundingRate),next=finiteNum(row?.nextFundingTime);
  if(value!==null&&Math.abs(value)<.2&&next&&next>now-3600000){
   state.fundingRate=value;state.fundingNextAt=next;state.fundingAt=now;
   $('fundingCurrent').textContent=(value>=0?'+':'')+(value*100).toFixed(4)+'%';
   $('fundingNext').textContent=time(next)+' · próximo evento';
  }
 }
 if(history.status==='fulfilled'){
  const d=history.value;
  const row=d.retCode===0?d.result?.list?.[0]:null;
  const val=finiteNum(row?.fundingRate),ts=finiteNum(row?.fundingRateTimestamp);
  if(val!==null&&Math.abs(val)<.2&&ts&&ts<=now+300000){
   state.lastFundingRate=val;state.lastFundingAt=ts;
   $('fundingPrevious').textContent=(val>=0?'+':'')+(val*100).toFixed(4)+'% · '+time(ts)
  }
 }
 if(now-state.fundingAt>300000){
  state.fundingRate=null;
  $('fundingCurrent').textContent='—';
  $('fundingNext').textContent='Financiación actual no disponible';
 }
 renderMarketSummary()
}
async function getAccountRatio(){
 const tf=state.tf,period=tfPeriod(),request=++state.ratioReq;
 if(state.ratioTf!==tf){state.ratioTf=tf;state.ratioLong=null;state.ratioShort=null;state.ratioAt=0}
 try{
  const d=await req('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period='+period+'&limit=2');
  const row=d.retCode===0?d.result?.list?.[0]:null;
  const l=finiteNum(row?.buyRatio),sh=finiteNum(row?.sellRatio),ts=finiteNum(row?.timestamp);
  if(l===null||sh===null||l<0||sh<0||Math.abs(l+sh-1)>.03||!ts)throw Error('Datos del ratio inválidos');
  if(request!==state.ratioReq||tf!==state.tf)return;
  state.ratioLong=l;state.ratioShort=sh;state.ratioAt=ts;
  $('accountLong').textContent=(l*100).toFixed(1)+'%';
  $('accountShort').textContent=(sh*100).toFixed(1)+'%';
  $('accountRatioStamp').textContent='Cuentas con posiciones · '+period+' · '+time(ts);
 }catch(e){
  if(request!==state.ratioReq||tf!==state.tf)return;
  state.ratioLong=null;state.ratioShort=null;state.ratioAt=0;
  $('accountLong').textContent='—';$('accountShort').textContent='—';
  $('accountRatioStamp').textContent='Ratio Bybit no disponible para '+period
 }
 renderMarketSummary()
}
function renderMarketSummary(now=Date.now()){
 if(!$('marketSummary'))return;
 if(!state.wsOk||now-state.lastPriceAt>20000){
  $('marketSummary').textContent='Esperando operaciones en vivo para describir el mercado.';
  $('summaryStamp').textContent='Datos insuficientes';
  return
 }
 const recent=state.trades.filter(t=>now-t.ts<300000&&now-t.ts>=0);
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
   ': BTC '+pct(joined.pricePct)+'; OI '+pct(joined.oiPct)+'. No implica causalidad.');
 }else lines.push('Precio/OI cerrado: sin pareja temporal comparable reciente.');
 if(state.ratioLong!==null&&state.ratioAt>now-Number(state.tf)*60000*3-900000)
  lines.push('Ratio de cuentas: '+(state.ratioLong*100).toFixed(0)+'% con posiciones long y '+(state.ratioShort*100).toFixed(0)+'% short; no mide su capital.');
 if(state.fundingRate!==null&&now-state.fundingAt<300000)
  lines.push('Funding indicado: '+(state.fundingRate>=0?'+':'')+(state.fundingRate*100).toFixed(4)+'% (no es señal direccional).');
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
 if(now-(state.wallDropCooldown.get(key)||0)<45000)return;
 state.wallDropCooldown.set(key,now);
 state.wallDrops.unshift({ts:now,side,p,prev,lost,next,status:'pending',matched:0});
 state.wallDrops=state.wallDrops.slice(0,12);
 if(lost>=policy.notice*.60&&Math.abs(p/state.price-1)<.004&&now-state.lastWallDropAlertAt>90000){
  state.lastWallDropAlertAt=now;
  alertUser('MURO '+(side==='bid'?'COMPRADOR':'VENDEDOR')+' reducido '+usd(lost)+' en '+usd(p)+'; ejecución/cancelación no confirmada','wall-drop-'+side+'-'+p,180000)
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
 if(now-state.lastWallArrivalAt>120000){
  const notable=levels.find(x=>x.v>=relativeWallPolicy(now)[x.side].notice&&x.qualifiedAge>=15000&&Math.abs(x.dist)<=.30);
  if(notable){
   state.lastWallArrivalAt=now;
   alertUser('MURO '+(notable.side==='bid'?'COMPRADOR':'VENDEDOR')+' visible '+usd(notable.v)+' a '+usd(notable.p)+' (persistencia '+wallAge(notable.age)+')','wall-arrive-'+notable.side+':'+notable.p,600000)
  }
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

function renderTrades(){let now=Date.now();state.trades=state.trades.filter(t=>now-t.ts<300000);state.whales=state.whales.filter(t=>now-t.ts<300000);let buy=0,sell=0;for(const t of state.trades){if(t.buy)buy+=t.usdt;else sell+=t.usdt}$('buyVol').textContent=usd(buy);$('sellVol').textContent=usd(sell);$('delta').textContent=(buy-sell>=0?'+':'')+usd(buy-sell);const cvd=state.sessionCvd;$('cvd').textContent=(cvd>=0?'+':'')+usd(cvd);$('whales').innerHTML=state.whales.slice(0,5).map(x=>`<div class="alertrow"><span class="${x.buy?'up':'down'}">${x.buy?'COMPRA':'VENTA'}</span> · ${usd(x.usdt)} · ${usd(x.price)} <span class="muted">${time(x.ts)}</span></div>`).join('')||'<div class="empty">No se han observado operaciones por encima del umbral.</div>'}
function onTrade(d){const entries=Array.isArray(d.data)?d.data:[];for(const x of entries){let p=asNum(x.p),q=asNum(x.v),ts=asNum(x.T)||Date.now(),buy=x.S==='Buy';if(!p||!q)continue;state.lastPrice=state.price;state.price=p;state.lastPriceAt=Date.now();if(!state.priceAtFirst)state.priceAtFirst=p;const t={price:p,usdt:p*q,buy,ts};state.trades.push(t);state.sessionCvd+=(buy?1:-1)*t.usdt;if(t.usdt>=state.threshold){state.whales.unshift(t);state.whales=state.whales.slice(0,20);alertUser(`${buy?'Compra':'Venta'} agresiva grande ${usd(t.usdt)} a ${usd(p)}`,'whale-'+ts+'-'+p,0)}}if(state.trades.length>30000)state.trades=state.trades.slice(-15000);if(Date.now()-(state.lastTradeRenderAt||0)>1000){state.lastTradeRenderAt=Date.now();renderPrice();renderTrades()}if(Date.now()-state.lastBreakCheckAt>1000){state.lastBreakCheckAt=Date.now();checkBreakouts();renderBreakouts()}if(Date.now()-(state.lastModelAt||0)>30000){state.lastModelAt=Date.now();model()}}
function onBook(d){
 const a=d.data;
 if(!a||!Array.isArray(a.b)||!Array.isArray(a.a))return;
 const now=Date.now();
 if(d.type==='snapshot'||a.u===1){
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
function onLiquidation(d){if(!Array.isArray(d.data))return;for(const l of d.data){let p=asNum(l.p),q=asNum(l.v);if(!p||!q)continue;let side=l.S==='Buy'?'long':'short',v=p*q,ts=asNum(l.T)||Date.now();if(side==='long')state.longLiq+=v;else state.shortLiq+=v;state.liq.unshift({side,price:p,notional:v,ts})}state.liq=state.liq.slice(0,100);state.lastLiqAt=Date.now();renderLiq()}

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
  state.binanceBids=[];state.binanceAsks=[];state.binanceLastAt=0;
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

function renderExchangeComparison(now=Date.now()){
 const bybitFresh=state.wsOk&&now-state.lastBookAt<8000,binanceFresh=now-state.binanceLastAt<8000;
 const market=(name,bids,asks)=>{
  const b=majorLevel(bids),a=majorLevel(asks);
  $(name+'Bid').textContent=b?usd(b.p)+' · '+usd(b.v):'—';
  $(name+'Ask').textContent=a?usd(a.p)+' · '+usd(a.v):'—';
  return {bid:b,ask:a}
 };
 const bybitBids=bybitFresh?bestComparisonLevels(state.bids,'bid'):[],bybitAsks=bybitFresh?bestComparisonLevels(state.asks,'ask'):[];
 const binanceBids=binanceFresh?state.binanceBids:[],binanceAsks=binanceFresh?state.binanceAsks:[];
 market('cmpBybit',bybitBids,bybitAsks);
 market('cmpBinance',binanceBids,binanceAsks);
 const src=$('compareStatus'),conf=$('compareCoincidence');
 src.textContent='Bybit '+(bybitFresh?'actualizado':'sin datos recientes')+' · Binance '+(binanceFresh?'actualizado':'sin datos recientes')+' · '+time(now);
 $('binanceStatus').textContent=binanceFresh?'Conectado':'Sin datos recientes';
 if(!bybitFresh||!binanceFresh||Math.abs(state.lastBookAt-state.binanceLastAt)>5000){
  conf.textContent='Comparación no disponible: fuentes ausentes o sin sincronía temporal suficiente.';return
 }
 const overlaps=[
  ...findWallMatches(bybitBids,binanceBids,'bid',state.price),
  ...findWallMatches(bybitAsks,binanceAsks,'ask',state.price)
 ];
 conf.textContent=overlaps.length?overlaps.map(x=>(x.side==='bid'?'Compras':'Ventas')+' cerca de '+usd(x.p)+' (diferencia '+usd(x.dist)+')').join(' · ')+'. Hasta 2 coincidencias por lado; no son una misma orden.':
  'Sin coincidencias de liquidez ≥US$100.000 por exchange dentro de ±0,035% del precio (mínimo US$10), entre los primeros 20 niveles por lado.'
}

function connectBybit(){let ws=new WebSocket('wss://stream.bybit.com/v5/public/linear');state.ws=ws;ws.onopen=()=>{ws.send(JSON.stringify({op:'subscribe',args:['publicTrade.BTCUSDT','orderbook.200.BTCUSDT','allLiquidation.BTCUSDT']}));state.wsOk=true;status('bybitStatus','Conectado',true);status('liqStatus','Conectado',true);$('error').textContent=''};ws.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(!d.topic)return;if(d.topic.startsWith('publicTrade.'))onTrade(d);else if(d.topic.startsWith('orderbook.'))onBook(d);else if(d.topic.startsWith('allLiquidation.'))onLiquidation(d)};ws.onerror=()=>{status('bybitStatus','Error de conexión',false);status('liqStatus','Error de conexión',false)};ws.onclose=()=>{state.wsOk=false;status('bybitStatus','Reconectando',false);status('liqStatus','Reconectando',false);resetWallTracking();state.bids.clear();state.asks.clear();state.wallSeen.clear();state.wallQualifiedSince.clear();state.zoneSeen.clear();state.wallDisappeared.clear();state.wallPolicy=null;state.heatSamples=[];state.lastHeatAt=0;state.lastBookAt=0;renderBook();drawLiquidityHeat();setTimeout(connectBybit,6000)};if(state.pingTimer)clearInterval(state.pingTimer);state.pingTimer=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({op:'ping'}))},20000)}
async function req(url){let ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),8000);try{let r=await fetch(url,{signal:ctl.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(timeout)}}
async function getOi(){// Public sources, no credentials, no simulated fallback.
const providers=[{name:'Bybit',url:'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=1',parse:d=>{if(d.retCode!==0)throw Error('Bybit '+d.retMsg);return asNum(d.result?.list?.[0]?.openInterest)}},{name:'Binance',url:'https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',parse:d=>asNum(d.openInterest)}];for(let p of providers){try{let d=await req(p.url),v=p.parse(d);if(v>0){if(state.oiSource!==p.name){state.oiFirst=0}state.oi=v;state.oiSource=p.name;if(!state.oiFirst)state.oiFirst=v;state.lastOiAt=Date.now();$('oi').textContent=cash(v)+' BTC';$('oiSource').textContent=p.name;$('oiStamp').textContent='Última lectura '+time(state.lastOiAt)+' · contratos BTC';$('oiDelta').textContent=pct((v/state.oiFirst-1)*100);state.restOk=true;status('restStatus','OI: '+p.name,true);if(state.lastHistoryAt)model();return}}catch(err){console.warn('OI '+p.name,err.message)}}status('restStatus','Open Interest no disponible',false);if(Date.now()-state.lastOiAt>120000){state.oi=0;$('oi').textContent='—';$('oiDelta').textContent='—';model()}}
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
  state.oiSeries=[];state.oiSeriesTf=tf;state.oiAligned=null;
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
  state.oiAligned=null;console.warn('OI y precio alineados',e.message);
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
async function getHourlySentiment(){
 const slot=Math.floor(Date.now()/3600000);
 if(state.hourlyInFlight||slot===state.hourlySlot)return;
 state.hourlyInFlight=true;
 const closedStart=(slot-1)*3600000;
 try{
  const [k,o,a,t]=await Promise.all([
   req('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=60&limit=5'),
   req('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=5'),
   req('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=1h&limit=5'),
   req('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT')
  ]);
  if([k,o,a,t].some(x=>x.retCode!==0))throw Error('Bybit: respuesta incompleta');
  const candle=(k.result?.list||[]).find(x=>Number(x[0])===closedStart);
  const oi=(o.result?.list||[]).find(x=>Number(x.timestamp)===closedStart);
  const oiPrev=(o.result?.list||[]).find(x=>Number(x.timestamp)===closedStart-3600000);
  const ratio=(a.result?.list||[]).find(x=>Number(x.timestamp)===closedStart);
  const funding=Number(t.result?.list?.[0]?.fundingRate);
  const open=Number(candle?.[1]),close=Number(candle?.[4]);
  const ov=Number(oi?.openInterest),op=Number(oiPrev?.openInterest);
  const longs=Number(ratio?.buyRatio),shorts=Number(ratio?.sellRatio);
  if(!open||!Number.isFinite(close)||close<=0||!ov||!op||
    !Number.isFinite(longs)||!Number.isFinite(shorts)||Math.abs(longs+shorts-1)>.03||
    !Number.isFinite(funding)||Math.abs(funding)>.2)throw Error('Datos horarios insuficientes');
  // A new hour can begin while requests are in flight.
  if(Math.floor(Date.now()/3600000)!==slot)return;
  const priceCh=(close/open-1)*100,oiCh=(ov/op-1)*100;
  const trend=priceCh>.25?'up':priceCh<-.25?'down':'flat';
  const conflict=(trend==='up'&&longs<.4)||(trend==='down'&&longs>.6);
  let label=conflict?'Señales contrapuestas':trend==='up'?'Optimismo intradía':trend==='down'?'Cautela intradía':'Sentimiento mixto';
  const primary=trend==='up'?'BTC subió':trend==='down'?'BTC cayó':'BTC mostró poco desplazamiento';
  const oiText=oiCh>.05?'aumentó':oiCh<-.05?'disminuyó':'cambió poco';
  const fmt=x=>(x>=0?'+':'')+x.toFixed(2)+'%';
  $('hourlySentimentLabel').textContent=label;
  $('hourlySentimentLabel').className='num '+(conflict?'gold':trend==='up'?'up':trend==='down'?'down':'');
  $('hourlySentimentDetail').textContent=primary+' '+fmt(priceCh)+' en la hora cerrada; OI '+oiText+' '+fmt(oiCh)+'. '+(longs*100).toFixed(1)+'% de las cuentas estaban long (no equivale al capital). Funding indicado '+fmt(funding*100)+'.';
  $('hourlySentimentStamp').textContent='Ventana '+time(closedStart)+'–'+time(closedStart+3600000)+' · Bybit · cálculo horario';
  state.hourlySlot=slot;state.hourlyAt=Date.now();
 }catch(err){
  console.warn('Termómetro horario',err.message);
  if(state.hourlyAt===0){
   $('hourlySentimentLabel').textContent='Sin datos suficientes';
   $('hourlySentimentDetail').textContent='No se inventa una lectura si faltan velas cerradas, OI o ratios horarios.';
   $('hourlySentimentStamp').textContent='Intentará actualizar al recuperar datos';
  }else{
   $('hourlySentimentStamp').textContent='Último cálculo: '+time(state.hourlyAt)+' · actualización pendiente';
  }
 }finally{state.hourlyInFlight=false}
}

function init(){tabs();restore();$('apply').addEventListener('click',apply);connectBybit();connectBinance();getOfficialFearGreed();getHourlySentiment();getOi();getCandles();getHistory();getOiSeries();getAccountRatio();getFunding();setInterval(getOiSeries,60000);setInterval(getAccountRatio,60000);setInterval(getFunding,120000);setInterval(getOfficialFearGreed,3600000);setInterval(()=>{if(!document.hidden)getHourlySentiment()},60000);setInterval(getHistory,300000);setInterval(getOi,60000);setInterval(getCandles,60000);setInterval(captureLiquidityHeat,HEAT_SAMPLE_MS);setInterval(()=>{let now=Date.now();$('clock').textContent='Ahora '+time(now);let fresh=state.wsOk&&now-state.lastPriceAt<20000;$('connection').textContent=fresh?'EN VIVO':state.wsOk?'SIN OPERACIONES RECIENTES':'SIN CONEXIÓN';$('connection').className='pill '+(fresh?'good':'warn');renderBook();renderExchangeComparison(now);renderWallInsights(now);checkBreakouts(now);renderBreakouts(now);evaluateAbsorption(now);renderAdvancedWhales(now);renderMarketSummary(now);if(now-state.lastPriceAt>60000){$('lastTick').textContent='Precio no actualizado · última operación '+(state.lastPriceAt?time(state.lastPriceAt):'—')}renderTrades()},5000);window.addEventListener('resize',()=>{draw();drawOiSeries();drawLiquidityHeat()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){getHourlySentiment();getOfficialFearGreed();getOi();getCandles();if(!state.binanceWs||state.binanceWs.readyState===3)connectBinance();getAccountRatio();getFunding();drawLiquidityHeat();if(state.ws&&state.ws.readyState===1)state.ws.send(JSON.stringify({op:'ping'}))}});if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}init();
