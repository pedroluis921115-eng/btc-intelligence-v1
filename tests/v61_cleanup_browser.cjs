'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const file=path.resolve(root,name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain','cache-control':'no-store'});fs.createReadStream(file).pipe(res)
});
async function audit(browser,width,height){
 const page=await browser.newPage(),errors=[],network={};
 const sockets=[];
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('websocket',s=>sockets.push(s.url()));
  page.on('request',r=>{
   try{const u=new URL(r.url());
    if(u.hostname==='api.bybit.com'&&['/v5/market/kline','/v5/market/open-interest'].includes(u.pathname))
     network[u.pathname]=(network[u.pathname]||0)+1;
   }catch{}
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:16000});
  await page.waitForFunction(()=>document.getElementById('vsMacroSpotlight')?.textContent!=='Comprobando eventos y horarios...',{timeout:15000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,4500));
  const before=await page.evaluate(()=>{
   const get=id=>document.getElementById(id);
   const analysis=get('vsPaneAnalysis');
   const children=[...analysis.children].map(x=>x.id);
   const hidden=(e)=>{while(e&&e.nodeType===1){if(e.hidden||getComputedStyle(e).display==='none')return true;e=e.parentElement}return false};
   return {
    height:Math.round(analysis.getBoundingClientRect().height),
    viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    detailsClosed:!get('vsMacroDetails').open&&!get('vsVenueOiDetails').open,
    week: get('vsMacroSpotlight').textContent,
    hiddenOld: hidden(get('vsLegacyMarket')),
    header:document.querySelector('header')?.textContent?.slice(0,180),
    funding:!!get('vsFundingTrade'),order:children
   };
  });
  assert.equal(before.detailsClosed,true,'future week and exchange totals should be optional');
  assert.equal(before.hiddenOld,true,'duplicate legacy market must not be visible');
  assert.ok(before.order.indexOf('vsTrendPanel')<before.order.indexOf('vsOiUnderstanding'));
  assert.ok(before.order.indexOf('vsZonesPanel')<before.order.indexOf('vsOiUnderstanding'));
  assert.ok(before.height<1900,'analysis is too tall '+JSON.stringify(before));
  assert.ok(before.scrollWidth<=before.viewport+2,'horizontal overflow');
  assert.ok(!before.header.includes('asistente manual V4'),'outdated badge');
  assert.ok(before.header.includes('V6'));
  assert.ok(!sockets.some(s=>s.includes('fstream.binance.com')),'no abandoned Binance depth20 WS');
  // Urgent event cannot disappear into the collapsed weekly calendar.
  await page.evaluate(()=>{document.getElementById('vsMacroWarn').hidden=false;document.getElementById('vsMacroWarn').textContent='AVISO: IPC · posible volatilidad'})
  await page.waitForFunction(()=>document.getElementById('vsMacroSpotlight').textContent.includes('AVISO: IPC'),{timeout:2000});
  assert.equal(await page.$eval('#vsMacroDetails',x=>x.open),false);
  await page.evaluate(()=>document.getElementById('vsMacroWarn').hidden=true);
  await page.$eval('#vsMacroDetails',x=>x.open=true);
  const opened=await page.evaluate(()=>({
   news:document.getElementById('vsMacroEvents').children.length,
   weekHeight:document.getElementById('vsMacroPanel').getBoundingClientRect().height,
   corp:document.getElementById('vsCorporateEvents').textContent.slice(0,150)
  }));
  assert.ok(opened.weekHeight>100&&opened.news>=1,'weekly agenda still available when expanded');
  await page.click('[data-vs-view="liquidity"]');
  await page.$eval('#vsVenueOiDetails',x=>x.open=true);
  const liquidity=await page.evaluate(()=>({
   map:document.getElementById('vsLiqCanvas').getBoundingClientRect().height,
   oi:!!document.getElementById('vsOiTotal'),
   intervals:!!document.getElementById('vsOiPercent15')&&!!document.getElementById('vsOiPercent60')
  }));
  assert.ok(liquidity.map>=350&&liquidity.oi&&liquidity.intervals);
  await page.click('[data-vs-view="trade"]');
  assert.ok((await page.$eval('#vsFundingTrade',x=>x.textContent)).length>0);
  assert.deepEqual(errors,[],'browser JavaScript errors');
  const metrics=await page.metrics(),cache=await page.evaluate(()=>BTCMarketCache.stats);
  console.log('V61_CLEANUP_BROWSER_PASS',width,height,JSON.stringify({
   before,opened,liquidity,sockets,network,cache,jsHeap:metrics.JSHeapUsedSize
  }).slice(0,9000));
 }finally{await page.close()}
}
(async()=>{let browser;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 await audit(browser,390,844);await audit(browser,1280,800);
 console.log('V61_BROWSER_COMPLETE_PASS');
}catch(e){console.error('V61_BROWSER_HOLD',e.stack||e.message);process.exitCode=1}
finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}})();
