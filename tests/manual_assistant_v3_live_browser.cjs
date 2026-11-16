'use strict';
// Verifica SOLO kline públicas reales; bloquea otras peticiones para ahorrar RAM.
const path=require('path'),fs=require('fs'),http=require('http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const dir=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const p=path.resolve(dir,rel);
 if(!p.startsWith(dir+path.sep)||!fs.existsSync(p)){res.writeHead(404);res.end();return}
 const ext=path.extname(p),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'}[ext]||'text/plain';
 res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});fs.createReadStream(p).pipe(res)
});
(async()=>{
 let browser;
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:800});
  const external=[],errors=[];
  page.on('requestfailed',r=>{if(/bybit.com|binance.com/.test(r.url()))external.push([r.url().split('?')[0],r.failure()?.errorText])});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const url=r.url();
   if(url.startsWith('http://127.0.0.1:')||url.startsWith('https://pedroluis921115-eng.github.io/btc-intelligence-v1/')||(
     url.includes('api.bybit.com/v5/market/kline?')||url.includes('fapi.binance.com/fapi/v1/klines?')
   )){r.continue();return}
   r.abort().catch(()=>{});
  });
  const url=process.argv.includes('--public')?'https://pedroluis921115-eng.github.io/btc-intelligence-v1/':'http://127.0.0.1:'+server.address().port+'/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
  try{await page.waitForFunction(()=>document.getElementById('manualDataStatus')?.textContent.includes('4/4'),{timeout:17000})}catch{}
  const status=await page.evaluate(()=>({
   radar:document.getElementById('manualDataStatus')?.textContent,
   states:[240,60,15,5].map(m=>document.getElementById('manualTF'+m)?.textContent),
   sources:[240,60,15,5].map(m=>document.getElementById('manualMeta'+m)?.textContent)
  }));
  console.log('REAL_PUBLIC_KLINE_CHECK',JSON.stringify({status,errors,external:external.slice(0,8)}));
  if(!status.radar.startsWith('4/4')||errors.length)process.exitCode=2;
  else console.log('REAL_KLINE_BROWSER_PASS_FOUR_TIMEFRAMES');
 }catch(e){console.error('REAL_KLINE_BROWSER_HOLD',e.message);process.exitCode=2}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})();
