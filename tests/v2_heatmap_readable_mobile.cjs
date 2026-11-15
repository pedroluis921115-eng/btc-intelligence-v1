'use strict';
// Live public Bybit read-only browser smoke test, plus deterministic staleness controls.
// This never places orders. It does not alter the production app/session.
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',p=path.join(root,rel);
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(p).pipe(res)
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 await page.setViewport({width:390,height:844,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
 await page.waitForFunction(()=>state.wsOk&&state.bids.size>20&&state.asks.size>20&&state.lastPriceAt>0,{timeout:25000});
 const read=async()=>page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  const cards=[...document.querySelectorAll('[data-fold-card]')].map(e=>e.getAttribute('data-fold-card'));
  const c=document.getElementById('liquidityHeat'),rect=c.getBoundingClientRect();
  const s=heatWallSummary();
  return {first:cards[0],open:c.closest('details')?.open,price:t('heatCurrentPrice'),
   ask:t('heatStrongAsk'),bid:t('heatStrongBid'),reason:t('heatReadout'),
   askHint:t('heatStrongAskHint'),bidHint:t('heatStrongBidHint'),
   valid:s.fresh,askPrice:s.ask?.price||null,bidPrice:s.bid?.price||null,
   currentPrice:s.price,priceAt:state.lastPriceAt,bookAt:state.lastBookAt,
   chartWidth:Math.round(rect.width),chartHeight:Math.round(rect.height),
   canvasWidth:c.width,canvasHeight:c.height,
   version:document.querySelector('script[src*="app.js"]')?.src||'',
   overflow:document.body.scrollWidth>innerWidth+2
  }
 });
 await page.evaluate(()=>{document.getElementById('liquidityHeat').closest('details').open=true;drawLiquidityHeat()});
 const big=await read();
 assert.equal(big.first,'fold-03','requested hypothetical model must be first below summary');
 assert.equal(big.open,true,'primary map initially expanded');
 assert.equal(big.valid,true,'Bybit data must be fresh');
 assert.ok(big.price.startsWith('$')&&big.bid.startsWith('$')&&big.ask.startsWith('$'),'live price and walls visible');
 assert.ok(big.bidPrice<big.currentPrice&&big.askPrice>big.currentPrice,'correct bid/ask side');
 assert.ok(big.reason.includes('NO indican una dirección futura'),'no predictive label');
 assert.ok(big.version.includes('v2-liquidations-clear-20261114'),'fresh cache version');
 assert.ok(big.chartHeight>=300&&big.chartWidth>=250&&!big.overflow,'mobile full width no overflow');
 await page.evaluate(()=>{state.wsOk=false;state.lastBookAt=Date.now()-25000;drawLiquidityHeat()});
 const stale=await read();
 assert.equal(stale.valid,false,'stale book should not show confident walls');
 assert.equal(stale.bid,'—');assert.equal(stale.ask,'—');
 assert.ok(stale.reason.includes('Esperando precio'),'stale label visible');
 await page.evaluate(()=>{state.wsOk=true;state.lastBookAt=Date.now();drawLiquidityHeat()});
 await page.setViewport({width:320,height:780,deviceScaleFactor:1});
 await new Promise(r=>setTimeout(r,250));
 await page.evaluate(()=>drawLiquidityHeat());
 const narrow=await read();
 assert.equal(narrow.overflow,false,'320px no horizontal overflow');
 assert.ok(narrow.chartHeight>=280,'320px remains readable');
 assert.ok(!errors.length,'no browser JavaScript errors: '+errors.join('; '));
 console.log('MOBILE_READABLE_HEATMAP_PASS',JSON.stringify({
  at390:{price:big.price,ask:big.ask,bid:big.bid,plot:[big.chartWidth,big.chartHeight],open:big.open,scope:big.reason},
  stale:{ask:stale.ask,bid:stale.bid,scope:stale.reason},
  at320:{plot:[narrow.chartWidth,narrow.chartHeight],overflow:narrow.overflow},
  errors
 }));
}catch(e){console.error('MOBILE_READABLE_HEATMAP_HOLD',e.stack);process.exitCode=5}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}})();
