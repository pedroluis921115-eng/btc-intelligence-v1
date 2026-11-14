'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.join(__dirname,'..'),puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const types={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const f=path.join(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res)
});
(async()=>{let browser;try{
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
 await new Promise(done=>setTimeout(done,18000));
 const d=await page.evaluate(()=>{
  const tx=id=>document.getElementById(id)?.textContent||'';
  const cv=document.getElementById('liquidityHeat');
  const ctx=cv.getContext('2d'), pixels=ctx.getImageData(0,0,cv.width,cv.height).data;
  let painted=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>22||pixels[i+1]>35||pixels[i+2]>57)painted++;
  const hist=state.heatSamples||[];
  return {price:tx('price'),connection:tx('connection'),heatStamp:tx('liquidityHeatStamp'),
   source:tx('compareStatus'),oi:tx('oiAlignedDetails').slice(0,190),
   sampleCount:hist.length,counts:hist.map(s=>[s.bids.length,s.asks.length]),
   extent:hist.length?heatGeometry(hist,state.price):null,painted,pixelCount:cv.width*cv.height,
   width:document.body.scrollWidth,viewport:innerWidth,overflow:document.body.scrollWidth>innerWidth+2,
   version:!!document.querySelector('script[src*="v2-heatmap-b-20261114"]')}
 });
 console.log('B_MOBILE',JSON.stringify(d));console.log('JS_ERRORS',JSON.stringify(errors));
 if(errors.length||d.overflow||!d.version||!d.price.startsWith('$')||d.sampleCount<2||!d.heatStamp.includes('precios absolutos')||!d.heatStamp.includes('hora local')||d.counts.some(x=>x[0]>160||x[1]>160)||d.painted<1000)process.exitCode=4;
}catch(e){console.error('B_BROWSER_ERROR',e.stack);process.exitCode=5}finally{if(browser)await browser.close();await new Promise(resolve=>srv.close(resolve))}})();
