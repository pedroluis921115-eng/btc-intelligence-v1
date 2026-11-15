'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',p=path.join(root,rel);
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(p).pipe(res)
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
 await delay(12000);
 const live=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  const s=liveStreamStatus();
  return {version:document.title,headerVersion:document.querySelector('header .brand .pill')?.textContent,
   script:!!document.querySelector('script[src*="v2-liquidations-clear-20261114"]'),
   price:t('price'),connection:t('connection'),bybit:t('bybitStatus'),liquidations:t('liqStatus'),binance:t('binanceStatus'),
   summary:t('topPrice'),count:state.tradeIds.size,book:state.bids.size,binanceLevels:state.binanceBids.length,
   compare:t('compareCoincidence').slice(0,450),runtime:t('runtimeHealth'),
   freshness:s,overflow:document.body.scrollWidth>innerWidth+2}
 });
 // Inject historical alerts exclusively in the isolated browser test session.
 const historic=await page.evaluate(()=>{
  const n=Date.now();
  state.alerts=[
   {text:'MURO histórico de prueba',groupKey:'old',lastImportantAt:n-21*60000,
    count:1,source:'PRUEBA CONTROLADA · no evento real',priority:{name:'ALTA',rank:3,reason:'Prueba'}},
   {text:'Evento reciente de prueba',groupKey:'new',lastImportantAt:n-3000,
    count:1,source:'PRUEBA CONTROLADA · no evento real',priority:{name:'MEDIA',rank:2,reason:'Prueba'}}
  ];
  renderAlerts(n,true);
  const text=document.getElementById('alerts').textContent;
  return {oldTag:text.includes('HISTÓRICA · hace 21 min'),
   newFirst:text.indexOf('Evento reciente de prueba')<text.indexOf('MURO histórico de prueba'),
   both:text.includes('MURO histórico de prueba')&&text.includes('Evento reciente de prueba'),
   source:text.includes('PRUEBA CONTROLADA')};
 });
 await page.evaluate(()=>{state.ws?.close()});
 await page.waitForFunction(()=>!state.wsOk&&state.lastPriceAt===0,{timeout:4500});
 const down=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  return {connection:t('connection'),price:t('price'),bybit:t('bybitStatus'),liq:t('liqStatus'),
    freshness:liveStreamStatus(),binance:state.binanceWs?.readyState,alerts:t('alerts').includes('HISTÓRICA')};
 });
 await page.evaluate(()=>connectBybit());
 await page.waitForFunction(()=>state.ws?.readyState===1&&state.bids.size>=20&&state.lastPriceAt>0,{timeout:17000});
 await delay(1600);
 const restored=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  return {connection:t('connection'),price:t('price'),bybit:t('bybitStatus'),liq:t('liqStatus'),
   top:t('topPrice'),health:t('runtimeHealth'),freshness:liveStreamStatus(),version:document.title,
   overflow:document.body.scrollWidth>innerWidth+2}
 });
 await page.setViewport({width:320,height:780,deviceScaleFactor:1});await delay(300);
 const narrow=await page.evaluate(()=>({overflow:document.body.scrollWidth>innerWidth+2}));
 console.log('ANDROID_FOCAL_MOBILE',JSON.stringify({live,historic,down,restored,narrow,errors}));
 if(errors.length||live.overflow||!live.script||!live.version.includes('V2')||live.headerVersion!=='V2'||
  !live.price.startsWith('$')||!live.freshness.trade||!live.freshness.book||
  !live.bybit.includes('Operaciones y libro vigentes')||live.count<5||live.book<20||
  live.binanceLevels<2||live.compare.includes('(0 muestras')||
  !historic.oldTag||!historic.newFirst||!historic.both||!historic.source||
  down.connection!=='SIN CONEXIÓN'||down.price!=='—'||!down.liq.includes('Sin conexión')||
  !down.alerts||!restored.price.startsWith('$')||restored.connection!=='EN VIVO'||
  !restored.freshness.trade||!restored.freshness.book||restored.overflow||narrow.overflow)
  process.exitCode=4;
}catch(e){console.error('ANDROID_FOCAL_FAILURE',e.stack);process.exitCode=5}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}})();
