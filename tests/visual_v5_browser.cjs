'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const f=path.resolve(root,relative);
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end('not found');return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'text/plain','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res);
});
const origin='http://127.0.0.1:';
function kline(m){
 const ms=Number(m)*60000,now=Date.now(),base=Math.floor(now/ms)*ms-ms*40;
 return Array.from({length:40},(_,i)=>{
  const o=90000+i*20,c=o+12;return [String(base+ms*i),String(o),String(c+2),String(o-3),String(c),'1','2'];
 }).reverse();
}
async function viewport(browser,width,height){
 const page=await browser.newPage(),errors=[];
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',err=>errors.push(err.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=req.url(),u=new URL(url);
   if(url.startsWith(origin))return req.continue();
   let data=null;
   if(url.includes('/v5/market/kline?'))data={retCode:0,result:{list:kline(u.searchParams.get('interval'))}};
   if(url.includes('/fapi/v1/openInterest?'))data={symbol:'BTCUSDT',openInterest:'92168.616',time:Date.now()};
   if(url.includes('/v5/market/open-interest?'))data={retCode:0,result:{list:[{openInterest:'68907.2',timestamp:String(Date.now()-120000)}]}};
   if(url.includes('/api/v5/public/open-interest?'))data={code:'0',data:[{instId:'BTC-USDT-SWAP',oiCcy:'31077.1065',oiUsd:'2000000000',oi:'3107710',ts:String(Date.now())}]};
   if(data!==null)return req.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)}).catch(()=>{});
   req.abort().catch(()=>{});
  });
  await page.goto(origin+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.getElementById('vsDecision')?.textContent!=='', {timeout:8000});
  const initial=await page.evaluate(()=>({
   selected:document.querySelector('.vs-tab.active')?.dataset.vsView,
   text:document.querySelector('#vsDecision')?.textContent,
   panes:[...document.querySelectorAll('.vs-pane')].map(x=>({id:x.id,hidden:x.hidden})),
   width:document.documentElement.scrollWidth,window:innerWidth,
   title:document.title
  }));
  assert.equal(initial.selected,'analysis');assert.ok(initial.text.length);
  assert.equal(initial.panes.filter(x=>!x.hidden).length,1);
  assert.equal(initial.title,'BTC Intelligence V6');
  assert.ok(initial.width<=initial.window+2,'no overflow in analysis '+JSON.stringify(initial));
  await page.click('[data-vs-view="liquidity"]');
  await page.waitForFunction(()=>document.getElementById('vsOiTotal')?.textContent.includes('BTC'),{timeout:8000});
  const oi=await page.evaluate(()=>({
   labels:['vsOibinanceValue','vsOibybitValue','vsOiokxValue'].map(id=>document.getElementById(id).textContent),
   total:document.getElementById('vsOiTotal').textContent,
   hint:document.getElementById('vsOiHint').textContent,
   hidden:document.getElementById('vsPaneAnalysis').hidden,
   mapVisible:document.getElementById('vsLiqCanvas').getBoundingClientRect().height,
   width:document.documentElement.scrollWidth,window:innerWidth
  }));
  assert.ok(oi.labels.every(x=>x.includes('BTC')),'all 3 OI '+JSON.stringify(oi));
  assert.ok(oi.total.includes('192,153')||oi.total.includes('192,152'),'sum '+JSON.stringify(oi));
  assert.equal(oi.hidden,true);assert.ok(oi.mapVisible>=350,'visual estimated map shown');
  await page.evaluate(()=>{document.getElementById('vsOriginalModel').open=true});
  await page.waitForFunction(()=>document.getElementById('heat').getBoundingClientRect().height>=400,{timeout:3500});
  assert.ok(oi.width<=oi.window+2,'liquidity overflow');
  await page.click('[data-vs-view="trade"]');
  const trade=await page.evaluate(()=>({
   pane:!document.getElementById('vsPaneTrade').hidden,
   buttons:['manualRiskCalculate','manualPartialCalculate','journalSave'].every(id=>!!document.getElementById(id)),
   width:document.documentElement.scrollWidth,window:innerWidth
  }));
  assert.ok(trade.pane&&trade.buttons);assert.ok(trade.width<=trade.window+2,'trade overflow');
  assert.deepEqual(errors,[],'no uncaught JS errors');
  console.log('VISUAL_BROWSER_PASS',width+'x'+height,JSON.stringify({initial,oi,trade}));
 }finally{await page.close()}
}
(async()=>{let browser;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 await viewport(browser,320,780);await viewport(browser,390,844);await viewport(browser,1280,800);
 console.log('VISUAL_V5_BROWSER_PASS')
}catch(e){console.error('VISUAL_V5_BROWSER_HOLD',e);process.exitCode=1}
finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}})();
