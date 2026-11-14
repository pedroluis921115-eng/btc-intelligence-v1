'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.join(__dirname,'..'),puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',f=path.join(root,rel);
 if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res)
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:14000});
  await new Promise(resolve=>setTimeout(resolve,9000));
  const results=[];
  for(const tf of ['5','15','30','60','240']){
   await page.evaluate(tf=>{const button=document.querySelector('[data-tf="'+tf+'"]');button.click()},tf);
   await new Promise(resolve=>setTimeout(resolve,2600));
   results.push(await page.evaluate(tf=>{
    const text=id=>document.getElementById(id)?.textContent;
    return {tf,oi:text('oiWindowDelta'),priceAligned:text('oiAlignedPrice'),
     alignment:text('oiAlignedDetails')?.slice(0,180),
     zoneBuy:text('liquidityBidZones')?.slice(0,150),
     zoneSell:text('liquidityAskZones')?.slice(0,150),
     source:text('oiWindowStamp')?.slice(0,180)}
   },tf));
  }
  const final=await page.evaluate(()=>({
    price:document.getElementById('price').textContent,connection:document.getElementById('connection').textContent,
    zoneScope:document.getElementById('zoneScope').textContent,
    noHorizontalOverflow:document.body.scrollWidth<=innerWidth+2,
    format:document.querySelector('script[src*="v2-a2-aligned-zones"]')!==null
  }));
  console.log('A2_LIVE_MOBILE',JSON.stringify({results,final,errors}));
  if(errors.length||!final.noHorizontalOverflow||!final.format||!final.price.startsWith('$')||results.some(x=>x.alignment?.includes('Esperando')||!x.zoneBuy||!x.zoneSell))process.exitCode=4;
 }catch(err){console.error('A2_MOBILE_FAILURE',err.stack);process.exitCode=5}
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})();
