'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const {analyzePair}=require('../oi-easy.js');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',p=path.resolve(root,pathname);
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);res.end('not found');return}
 res.writeHead(200,{'content-type':mime[path.extname(p)]||'text/plain','cache-control':'no-store'});fs.createReadStream(p).pipe(res)
});
async function local(browser,width,height){
 const page=await browser.newPage(),errors=[];
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>r.url().startsWith('http://127.0.0.1:')?r.continue():r.abort().catch(()=>{}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:16000});
  const initial=await page.evaluate(()=>({explain:!!document.getElementById('vsOiJointTitle'),
   hasMain:document.getElementById('vsOiUnderstanding')?.getBoundingClientRect().height>50,
   oldSummaryHidden:document.getElementById('vsInternalDiagnostics')?.contains(document.getElementById('topSnapshot')),
   width:document.documentElement.scrollWidth,inner:innerWidth,
   title:document.title}));
  assert.ok(initial.explain&&initial.hasMain&&initial.oldSummaryHidden,JSON.stringify(initial));
  assert.ok(initial.width<=initial.inner+2,'no scroll overflow '+JSON.stringify(initial));
  await page.click('[data-vs-go="liquidity"]');
  const liq=await page.evaluate(()=>({
   cards:!!document.getElementById('vsOiExplain15')&&!!document.getElementById('vsOiExplain60'),
   binance:!!document.getElementById('vsOibinanceValue'),
   oldTitle:document.getElementById('vsOiHint').textContent,
   width:document.documentElement.scrollWidth,inner:innerWidth
  }));
  assert.ok(liq.cards&&liq.binance);assert.ok(liq.width<=liq.inner+2);
  assert.deepEqual(errors,[]);
  console.log('OI_EASY_BROWSER_PASS',width,height,JSON.stringify(initial));
 }finally{await page.close()}
}
(async()=>{let browser;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [w,h] of [[320,780],[390,844],[1280,800]])await local(browser,w,h);
 const page=await browser.newPage();
 await page.goto('https://pedroluis921115-eng.github.io/btc-intelligence-v1/',{waitUntil:'domcontentloaded',timeout:17000});
 const responses=await page.evaluate(async()=>{
  const kinds=[['15min','15'],['1h','60']],all=[];
  for(const [interval,tf] of kinds){
   const u='https://api.bybit.com/v5/market/';
   const data=await Promise.all([
    fetch(u+'open-interest?category=linear&symbol=BTCUSDT&intervalTime='+interval+'&limit=10').then(r=>r.json()),
    fetch(u+'kline?category=linear&symbol=BTCUSDT&interval='+tf+'&limit=10').then(r=>r.json())
   ]);
   all.push(data);
  }return all
 });
 for(let i=0;i<2;i++){
  const [oi,k]=responses[i],period=i===0?900000:3600000;
  if(oi.retCode!==0||k.retCode!==0)throw Error('LIVE_BYBIT_RESPONSE_HOLD');
  const result=analyzePair(oi.result?.list,k.result?.list,period,Date.now());
  console.log('OI_EASY_LIVE_PAIR',i===0?'15m':'1h',JSON.stringify(result));
  assert.equal(result.ok,true,'live source must allow genuine aligned sample');
 }
 await page.close();console.log('OI_EASY_BROWSER_AND_LIVE_PASS');
}catch(e){console.error('OI_EASY_HOLD',e.stack||e.message);process.exitCode=1}
 finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
})();
