'use strict';
const $=id=>document.getElementById(id);const state={tf:'5',price:0,lastPrice:0,priceAtFirst:0,priceAtTf:0,oi:0,oiFirst:0,oiSource:'',candles:[],liq:[],trades:[],whales:[],longLiq:0,shortLiq:0,bids:new Map(),asks:new Map(),ws:null,liqws:null,restOk:false,wsOk:false,liqOk:false,alerts:[],lastAlerts:new Map(),lastPriceAt:0,lastBookAt:0,lastLiqAt:0,lastOiAt:0,model:[],threshold:1e6,distance:.3,oiHistory:[],fiveCandles:[],lastHistoryAt:0,sessionCvd:0,oiSeries:[],oiSeriesTf:'',oiSeriesRequest:0,oiSeriesAt:0,wallSeen:new Map(),lastBookRenderAt:0};
const cash=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n):'—';const usd=n=>Number.isFinite(n)?'$'+cash(n):'—';const pct=n=>Number.isFinite(n)?(n>=0?'+':'')+n.toFixed(2)+'%':'—';const time=ms=>new Date(ms).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit'});const status=(id,label,ok)=>{$(id).textContent=label;$(id).className=ok?'up':'gold'};const asNum=n=>{let v=Number(n);return Number.isFinite(v)?v:0};function alertUser(txt,key,limit=60000){let now=Date.now();if(now-(state.lastAlerts.get(key)||0)<limit)return;state.lastAlerts.set(key,now);state.alerts.unshift({ts:now,txt});state.alerts=state.alerts.slice(0,12);$('alerts').innerHTML=state.alerts.map(a=>`<div class="alertrow">${time(a.ts)} · ${escapeHtml(a.txt)}</div>`).join('')}function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function model(){
 const p=state.price,oi=state.oiHistory,candles=state.fiveCandles;
 if(!p||oi.length<2||!candles.length){state.model=[];draw();$('mapnote').textContent='Sin historial suficiente de Open Interest y velas 5m. No se generan zonas ficticias.';return}
 const closeByStart=new Map(candles.map(k=>[Number(k[0]),Number(k[4])]));
 const cutoff=Date.now()-Number(state.tf)*60000,buckets=new Map(),levs=[10,25,50],step=p*.002;
 let used=0,added=0;
 for(let i=1;i<oi.length;i++){
  const prev=oi[i-1],cur=oi[i],inc=cur.v-prev.v;
  if(cur.ts<cutoff||cur.ts>Date.now()+300000||inc<=0)continue;
  const t=Math.floor((cur.ts-1)/300000)*300000,anchor=closeByStart.get(t);
  if(!Number.isFinite(anchor)||anchor<=0)continue;
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

function renderPrice(){if(!state.price)return;$('price').textContent=usd(state.price);$('lastTick').textContent='Última operación: '+time(state.lastPriceAt);$('clock').textContent='Ahora '+time(Date.now());$('priceDelta').textContent=state.priceAtFirst?pct((state.price/state.priceAtFirst-1)*100):'—';if(state.candles.length){let c=state.candles[0];$('change').textContent=pct((state.price/asNum(c[1])-1)*100)}else $('change').textContent='—'}
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
 $('wallSummary').textContent='Visibles ≥1 min: '+persistent.filter(x=>x.side==='Compra').length+' compras / '+persistent.filter(x=>x.side==='Venta').length+' ventas · solo 50 niveles por lado';
 $('walls').innerHTML=levels.slice(0,7).map(x=>'<tr><td class="'+(x.side==='Compra'?'up':'down')+'">'+x.side+'</td><td>'+usd(x.p)+'</td><td>'+usd(x.v)+'</td><td class="'+(x.age>=60000?'up':'')+'">'+wallAge(x.age)+'</td></tr>').join('')||'<tr><td colspan="4">Sin datos</td></tr>'
}
function renderTrades(){let now=Date.now();state.trades=state.trades.filter(t=>now-t.ts<300000);state.whales=state.whales.filter(t=>now-t.ts<300000);let buy=0,sell=0;for(const t of state.trades){if(t.buy)buy+=t.usdt;else sell+=t.usdt}$('buyVol').textContent=usd(buy);$('sellVol').textContent=usd(sell);$('delta').textContent=(buy-sell>=0?'+':'')+usd(buy-sell);const cvd=state.sessionCvd;$('cvd').textContent=(cvd>=0?'+':'')+usd(cvd);$('whales').innerHTML=state.whales.slice(0,5).map(x=>`<div class="alertrow"><span class="${x.buy?'up':'down'}">${x.buy?'COMPRA':'VENTA'}</span> · ${usd(x.usdt)} · ${usd(x.price)} <span class="muted">${time(x.ts)}</span></div>`).join('')||'<div class="empty">No se han observado operaciones por encima del umbral.</div>'}
function onTrade(d){const entries=Array.isArray(d.data)?d.data:[];for(const x of entries){let p=asNum(x.p),q=asNum(x.v),ts=asNum(x.T)||Date.now(),buy=x.S==='Buy';if(!p||!q)continue;state.lastPrice=state.price;state.price=p;state.lastPriceAt=Date.now();if(!state.priceAtFirst)state.priceAtFirst=p;const t={price:p,usdt:p*q,buy,ts};state.trades.push(t);state.sessionCvd+=(buy?1:-1)*t.usdt;if(t.usdt>=state.threshold){state.whales.unshift(t);state.whales=state.whales.slice(0,20);alertUser(`${buy?'Compra':'Venta'} agresiva grande ${usd(t.usdt)} a ${usd(p)}`,'whale-'+ts+'-'+p,0)}}if(state.trades.length>30000)state.trades=state.trades.slice(-15000);renderPrice();renderTrades();if(Date.now()-(state.lastModelAt||0)>30000){state.lastModelAt=Date.now();model()}}
function onBook(d){
 const a=d.data;
 if(!a||!Array.isArray(a.b)||!Array.isArray(a.a))return;
 const now=Date.now();
 if(d.type==='snapshot'||a.u===1){
  state.bids.clear();state.asks.clear();state.wallSeen.clear();
 }
 for(const [updates,book,prefix] of [[a.b,state.bids,'B:'],[a.a,state.asks,'A:']]){
  for(const [p,q] of updates){
   if(!Number.isFinite(+p)||+p<=0||!Number.isFinite(+q))continue;
   const key=prefix+p;
   if(+q<=0){book.delete(p);state.wallSeen.delete(key);continue}
   if(!book.has(p))state.wallSeen.set(key,now);
   book.set(p,q)
  }
 }
 state.lastBookAt=now;
 if(now-state.lastBookRenderAt>500){state.lastBookRenderAt=now;renderBook()}
}
function onLiquidation(d){if(!Array.isArray(d.data))return;for(const l of d.data){let p=asNum(l.p),q=asNum(l.v);if(!p||!q)continue;let side=l.S==='Buy'?'long':'short',v=p*q,ts=asNum(l.T)||Date.now();if(side==='long')state.longLiq+=v;else state.shortLiq+=v;state.liq.unshift({side,price:p,notional:v,ts})}state.liq=state.liq.slice(0,100);state.lastLiqAt=Date.now();renderLiq()}
function connectBybit(){let ws=new WebSocket('wss://stream.bybit.com/v5/public/linear');state.ws=ws;ws.onopen=()=>{ws.send(JSON.stringify({op:'subscribe',args:['publicTrade.BTCUSDT','orderbook.50.BTCUSDT','allLiquidation.BTCUSDT']}));state.wsOk=true;status('bybitStatus','Conectado',true);status('liqStatus','Conectado',true);$('error').textContent=''};ws.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch{return}if(!d.topic)return;if(d.topic.startsWith('publicTrade.'))onTrade(d);else if(d.topic.startsWith('orderbook.'))onBook(d);else if(d.topic.startsWith('allLiquidation.'))onLiquidation(d)};ws.onerror=()=>{status('bybitStatus','Error de conexión',false);status('liqStatus','Error de conexión',false)};ws.onclose=()=>{state.wsOk=false;status('bybitStatus','Reconectando',false);status('liqStatus','Reconectando',false);state.bids.clear();state.asks.clear();state.wallSeen.clear();state.lastBookAt=0;renderBook();setTimeout(connectBybit,6000)};if(state.pingTimer)clearInterval(state.pingTimer);state.pingTimer=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({op:'ping'}))},20000)}
async function req(url){let ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),8000);try{let r=await fetch(url,{signal:ctl.signal,cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(timeout)}}
async function getOi(){// Public sources, no credentials, no simulated fallback.
const providers=[{name:'Bybit',url:'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=1',parse:d=>{if(d.retCode!==0)throw Error('Bybit '+d.retMsg);return asNum(d.result?.list?.[0]?.openInterest)}},{name:'Binance',url:'https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT',parse:d=>asNum(d.openInterest)}];for(let p of providers){try{let d=await req(p.url),v=p.parse(d);if(v>0){if(state.oiSource!==p.name){state.oiFirst=0}state.oi=v;state.oiSource=p.name;if(!state.oiFirst)state.oiFirst=v;state.lastOiAt=Date.now();$('oi').textContent=cash(v)+' BTC';$('oiSource').textContent=p.name;$('oiStamp').textContent='Última lectura '+time(state.lastOiAt)+' · contratos BTC';$('oiDelta').textContent=pct((v/state.oiFirst-1)*100);state.restOk=true;status('restStatus','OI: '+p.name,true);if(state.lastHistoryAt)model();return}}catch(err){console.warn('OI '+p.name,err.message)}}status('restStatus','Open Interest no disponible',false);if(Date.now()-state.lastOiAt>120000){state.oi=0;$('oi').textContent='—';$('oiDelta').textContent='—';model()}}
async function getCandles(){const providers=[{name:'Bybit',url:`https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=${state.tf}&limit=4`,parse:d=>{if(d.retCode!==0)throw Error('Bybit error');return d.result.list}},{name:'Binance',url:`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${state.tf==='60'?'1h':state.tf==='240'?'4h':state.tf+'m'}&limit=4`,parse:d=>d.map(x=>[x[0],x[1],x[2],x[3],x[4]])}];for(const p of providers){try{let d=await req(p.url),v=p.parse(d);if(Array.isArray(v)&&v.length){state.candles=v.sort((a,b)=>+b[0]-+a[0]);renderPrice();return}}catch(e){console.warn('kline '+p.name,e.message)}}state.candles=[];renderPrice()}

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
 if(state.oiSeriesTf!==tf){state.oiSeries=[];state.oiSeriesTf=tf;$('oiWindowDelta').textContent='—';$('oiWindowStamp').textContent='Cargando historial '+interval+'...';drawOiSeries()}
 try{
  const d=await req('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime='+interval+'&limit=48');
  if(d.retCode!==0)throw Error('Bybit '+(d.retMsg||'error'));
  const points=(d.result?.list||[]).map(x=>({ts:Number(x.timestamp),v:Number(x.openInterest)}))
   .filter(x=>Number.isFinite(x.ts)&&Number.isFinite(x.v)&&x.v>0).sort((a,b)=>a.ts-b.ts);
  if(points.length<2)throw Error('Historial incompleto');
  if(state.tf!==tf||state.oiSeriesRequest!==request)return;
  state.oiSeries=points;state.oiSeriesAt=Date.now();
  const latest=points[points.length-1],previous=points[points.length-2];
  const change=(latest.v/previous.v-1)*100;
  $('oiWindowDelta').textContent=pct(change);
  $('oiWindowDelta').className='num mono '+(change>=0?'up':'down');
  $('oiWindowStamp').textContent='Bybit · '+points.length+' registros · último '+time(latest.ts)+' · intervalo '+interval+' (últimos 2 registros)';
  drawOiSeries()
 }catch(e){
  if(state.tf!==tf||state.oiSeriesRequest!==request)return;
  console.warn('OI por temporalidad',e.message);
  const ago=(Date.now()-state.oiSeriesAt)/60000;
  if(ago>10||!state.oiSeries.length){state.oiSeries=[];$('oiWindowDelta').textContent='—';$('oiWindowStamp').textContent='Historial Bybit no disponible ('+interval+'); no se inventan valores'}
  else $('oiWindowStamp').textContent='Última lectura histórica hace '+Math.floor(ago)+' min · reintentando';
  drawOiSeries()
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

function tabs(){for(const b of document.querySelectorAll('[data-tf]'))b.addEventListener('click',()=>{state.tf=b.dataset.tf;document.querySelectorAll('[data-tf]').forEach(x=>x.classList.toggle('active',x===b));getCandles();getOiSeries();model()})}function apply(){let n=Number($('threshold').value),d=Number($('distance').value);if(!Number.isFinite(n)||n<10000||!Number.isFinite(d)||d<.05||d>5){$('error').textContent='Umbral mínimo US$10.000; distancia entre 0,05% y 5%.';return}state.threshold=n;state.distance=d;state.whales=state.whales.filter(x=>x.usdt>=n);renderTrades();$('error').textContent='Configuración guardada en este dispositivo.';try{localStorage.setItem('btc-intelligence-config',JSON.stringify({threshold:n,distance:d}))}catch{}}function restore(){try{let d=JSON.parse(localStorage.getItem('btc-intelligence-config')||'{}');if(d.threshold>=10000)$('threshold').value=d.threshold;if(d.distance>=.05&&d.distance<=5)$('distance').value=d.distance}catch{}apply()}
function init(){tabs();restore();$('apply').addEventListener('click',apply);connectBybit();getOi();getCandles();getHistory();getOiSeries();setInterval(getOiSeries,60000);setInterval(getHistory,300000);setInterval(getOi,60000);setInterval(getCandles,60000);setInterval(()=>{let now=Date.now();$('clock').textContent='Ahora '+time(now);let fresh=state.wsOk&&now-state.lastPriceAt<20000;$('connection').textContent=fresh?'EN VIVO':state.wsOk?'SIN OPERACIONES RECIENTES':'SIN CONEXIÓN';$('connection').className='pill '+(fresh?'good':'warn');renderBook();if(now-state.lastPriceAt>60000){$('lastTick').textContent='Precio no actualizado · última operación '+(state.lastPriceAt?time(state.lastPriceAt):'—')}renderTrades()},5000);window.addEventListener('resize',()=>{draw();drawOiSeries()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){getOi();getCandles();if(state.ws&&state.ws.readyState===1)state.ws.send(JSON.stringify({op:'ping'}))}});if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}init();
