'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html');
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'text/plain','cache-control':'no-store'});fs.createReadStream(f).pipe(res)
});
(async()=>{
 let browser;
 try{
  await new Promise(res=>server.listen(0,'127.0.0.1',res));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
  const page=await browser.newPage();
  const url=process.argv.includes('--public')?'https://pedroluis921115-eng.github.io/btc-intelligence-v1/':'http://127.0.0.1:'+server.address().port+'/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});
  await page.click('[data-vs-view="liquidity"]');
  const result=await page.evaluate(async()=>{
   const urls=[
    'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=80',
    'https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=5&limit=85',
    'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'
   ];
   const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12500);
   try{
    const all=await Promise.all(urls.map(u=>fetch(u,{signal:ctl.signal,cache:'no-store'}).then(r=>r.json())));
    const [oi,k,t]=all;
    if(oi.retCode!==0||k.retCode!==0||t.retCode!==0)throw Error('Bybit REST incomplete');
    const now=Date.now(),price=Number(t.result?.list?.[0]?.lastPrice);
    const series=(oi.result.list||[]).map(x=>({ts:Number(x.timestamp),v:Number(x.openInterest)})).
     filter(x=>x.ts>0&&x.v>0).sort((a,b)=>a.ts-b.ts);
    if(!(price>0&&series.length>=40&&k.result.list.length>=40))throw Error('Historical windows incomplete');
    state.price=price;state.lastPriceAt=now;state.wsOk=true;
    state.lastHistoryAt=now;state.oiHistory=series;state.fiveCandles=k.result.list;
    model();BTCLiqVisual.render();
    return {price,oiSamples:series.length,candles:k.result.list.length,
     modelZones:state.model.length,
     above:document.getElementById('vsLiqAbove').textContent,
     below:document.getElementById('vsLiqBelow').textContent,
     status:document.getElementById('vsLiqChartStatus').textContent,
     canvasWidth:document.getElementById('vsLiqCanvas').width};
   }finally{clearTimeout(timeout)}
  });
  console.log('V6_LIVE_SOURCE_RESULT',JSON.stringify(result));
  assert.ok(result.price>0&&result.oiSamples>=40&&result.candles>=40);
  assert.ok(result.modelZones>=0,'never assume model always has increasing OI');
  assert.ok(result.status.includes('Velas Bybit'),'chart real data status');
  if(result.modelZones>0&&result.above==='—'&&result.below==='—')
   console.log('MODEL_ZONES_OUTSIDE_SELECTED_ZOOM_NO_INVENTION');
  console.log('V6_LIVE_BYBIT_REST_PASS');
 }catch(e){console.error('V6_LIVE_REST_HOLD',e.stack||e.message);process.exitCode=2}
 finally{if(browser)await browser.close();await new Promise(done=>server.close(done))}
})();
