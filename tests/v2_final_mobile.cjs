'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const srv=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',f=path.join(root,rel);
 if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res)
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let browser;try{
 await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
 await sleep(16500);
 const first=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  const sources=sourceFreshness();
  return {price:t('price'),top:t('topPrice'),book:state.bids.size,binance:state.binanceBids.length,
   tradeCount:state.tradeIds.size,health:t('runtimeHealth'),
   sources:sources.map(x=>[x.name,x.status]),folds:document.querySelectorAll('details.foldable').length,
   skipped:state.hiddenDrawSkipped,retained:state.heatSamples.length,
   script:!!document.querySelector('script[src*="v2-final-20261114"]'),
   overflow:document.body.scrollWidth>innerWidth+2}
 });
 // Keep sources active during simulated fold interactions.
 await page.evaluate(()=>{
  const f=document.querySelector('details.foldable:has(#liquidityHeat)');
  f.open=false;for(let i=0;i<8;i++){draw();drawOiSeries();drawLiquidityHeat();renderBook()}
 });
 const skipped=await page.evaluate(()=>({draw:state.hiddenDrawSkipped,computes:state.hiddenComputeSkipped,
  samples:state.heatSamples.length}));
 // Scope source failure to Bybit, keep independent Binance valid.
 const beforeClose=await page.evaluate(()=>({binance:state.binanceWs?.readyState,bybit:state.ws?.readyState}));
 await page.evaluate(()=>state.ws?.close());
 await page.waitForFunction(()=>!state.wsOk&&state.lastPriceAt===0,{timeout:5000});
 const down=await page.evaluate(()=>{
  const s=sourceFreshness(),t=id=>document.getElementById(id)?.textContent||'';
  return {price:t('price'),last:t('lastTick'),top:topSnapshot().price.value,book:state.bids.size,
   priceSource:s.find(x=>x.name==='Precio BTCUSDT')?.status,
   bookSource:s.find(x=>x.name==='Libro y mapa de calor')?.status,
   binance:s.find(x=>x.name==='Libro comparativo')?.status,
   gap:state.streamGaps,retry:!!state.bybitRetry}
 });
 await page.evaluate(()=>connectBybit());
 await page.waitForFunction(()=>state.ws?.readyState===1&&state.bids.size>=20&&state.lastPriceAt>0,{timeout:15000});
 const restored=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  return {price:t('price'),book:state.bids.size,trades:state.trades.length,session:state.sessionCvd,
   health:t('runtimeHealth'),gap:state.streamGaps,reconnects:state.bybitReconnections,
   alertsVisible:!document.getElementById('alertsPanel').closest('details'),layout:document.body.scrollWidth<=innerWidth+2}
 });
 await page.setViewport({width:320,height:780,deviceScaleFactor:1});await sleep(250);
 const narrow=await page.evaluate(()=>({overflow:document.body.scrollWidth>innerWidth+2,
  top:document.getElementById('topSnapshot')?.offsetWidth,
  alerts:!document.getElementById('alertsPanel').closest('details')}));
 console.log('FINAL_MOBILE',JSON.stringify({first,skipped,beforeClose,down,restored,narrow,errors}));
 if(errors.length||!first.script||first.overflow||first.book<20||first.binance<2||
   !first.price.startsWith('$')||first.tradeCount<5||first.folds!==14||
   !first.health.includes('Operaciones Bybit')||skipped.draw<first.skipped+12||
   down.price!=='—'||down.book!==0||down.priceSource!=='SIN CONEXIÓN'||
   down.bookSource!=='SIN CONEXIÓN'||down.binance==='SIN CONEXIÓN'||
   !down.retry||down.gap<1||!restored.price.startsWith('$')||restored.book<20||
   !restored.alertsVisible||!restored.layout||narrow.overflow||!narrow.alerts)
   process.exitCode=4
}catch(e){console.error('FINAL_MOBILE_FAILURE',e.stack);process.exitCode=5}
finally{if(browser)await browser.close();await new Promise(ok=>srv.close(ok))}})();
