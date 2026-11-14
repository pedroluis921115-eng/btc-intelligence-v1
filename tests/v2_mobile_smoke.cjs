'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.join(__dirname,'..');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const full=path.join(root,rel);
 if(!full.startsWith(root)||!fs.existsSync(full)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(full)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(full).pipe(res)
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:13000});
  await new Promise(done=>setTimeout(done,14500));
  const result=await page.evaluate(()=>{
   const text=id=>document.getElementById(id)?.textContent;
   return {
    price:text('price'),
    live:text('connection'),
    newWallEngine:typeof isTrackedWallPresent==='function',
    newMatching:typeof findWallMatches==='function',
    official:text('fngValue'),
    own:text('hourlySentimentLabel'),
    compare:text('compareStatus'),
    bBid:text('cmpBybitBid'),
    nBid:text('cmpBinanceBid'),
    oi:text('oiWindowStamp'),
    heat:text('liquidityHeatStamp'),
    newFormat:document.querySelector('script[src*="v2-precision-a1"]')!==null,
    overflow:document.body.scrollWidth>window.innerWidth+2
   };
  });
  console.log('MOBILE_SMOKE',JSON.stringify(result));
  console.log('JS_ERRORS',JSON.stringify(errors));
  if(errors.length||result.overflow||!result.newFormat||!result.newWallEngine||!result.newMatching||!result.price?.startsWith('$')||!result.bBid?.startsWith('$')||!result.nBid?.startsWith('$'))process.exitCode=4;
 }catch(e){console.log('TEST_ERROR',e.stack);process.exitCode=5}
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})();
