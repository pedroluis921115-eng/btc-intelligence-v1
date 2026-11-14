'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.join(__dirname,'..');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',full=path.join(root,rel);
 if(!full.startsWith(root)||!fs.existsSync(full)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(full)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(full).pipe(res)
});
(async()=>{
 let browser;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:16000});
  await new Promise(done=>setTimeout(done,15000));
  const data=await page.evaluate(()=>{
   const t=id=>document.getElementById(id)?.textContent||'';
   return {price:t('price'),connection:t('connection'),flow90:t('flow90Detail'),
    flow5:t('flow5Detail'),flowSession:t('flowSessionDetail'),flowDedup:t('flowDedupStatus'),
    sequences:t('largeFlowStatus'),threshold:t('largeFlowThreshold'),
    flowCard:t('largeFlow')?.slice(0,140),absorption:t('absorptionDetail')?.slice(0,200),
    liquidationSession:t('liqScope'),liquidation90:t('liq90Detail'),liquidation5:t('liq5Detail'),
    liquidationDedup:t('liqDedupStatus'),liquidationCard:t('events')?.slice(0,140),
    book:t('wallAdaptiveScope'),comparison:t('compareStatus'),
    heatmap:t('liquidityHeatStamp'),closedOI:t('oiAlignedDetails')?.slice(0,170),
    tradeCount:state.trades.length,ids:state.tradeIds.size,liquidations:state.liq.length,
    rawLastTradeTs:state.lastTradeEventTs,duplicateTrades:state.tradeDuplicates,
    jsVersion:!!document.querySelector('script[src*="v2-flow-d-20261114"]'),
    overflows:document.body.scrollWidth>innerWidth+2
   }
  });
  console.log('D_MOBILE_LIVE',JSON.stringify(data));console.log('D_BROWSER_ERRORS',JSON.stringify(errors));
  if(errors.length||data.overflows||!data.jsVersion||!data.price.startsWith('$')||!data.ids||
    data.rawLastTradeTs<1e12||!data.flow90.includes('90 s')||!data.flow5.includes('5 min')||
    !data.threshold.includes('Umbral relativo')||!data.liquidation90.includes('90 s')||
    !data.liquidation5.includes('5 min')||!data.flowDedup.includes('IDs repetidos')||
    !data.liquidationDedup.includes('sin ID único'))process.exitCode=4;
 }catch(e){console.log('D_MOBILE_ERROR',e.stack);process.exitCode=5}
 finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
})();
