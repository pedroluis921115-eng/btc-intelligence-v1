const fs=require('fs'),path=require('path'),http=require('http');
const root=path.join(__dirname,'..'),puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const types={'.js':'application/javascript','.html':'text/html','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',f=path.join(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('missing');return}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)});
(async()=>{let browser;try{
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded',timeout:14000});
 await new Promise(done=>setTimeout(done,13500));
 const d=await page.evaluate(()=>{const t=id=>document.getElementById(id)?.textContent||'';return {price:t('price'),connection:t('connection'),wallAdaptiveScope:t('wallAdaptiveScope'),wallEvolution:t('wallEvolution').slice(0,240),wallReturns:t('wallReturns').slice(0,220),zones:t('liquidityBidZones').slice(0,210),comparative:t('compareStatus'),funding:t('fundingCurrent'),oi:t('oiAlignedDetails').slice(0,180),official:t('fngValue'),custom:t('hourlySentimentLabel'),overflows:document.body.scrollWidth>innerWidth+2,loaded:!!document.querySelector('script[src*="v2-a3-walls-20261114"]')}});
 console.log('A3_MOBILE_REAL',JSON.stringify(d));console.log('A3_JS_ERRORS',JSON.stringify(errors));
 if(errors.length||d.overflows||!d.loaded||!d.price.startsWith('$')||!d.wallAdaptiveScope.toLowerCase().includes('umbral')||!d.zones||!d.oi.includes('periodo cerrado'))process.exitCode=3
}catch(e){console.log('ERROR',e.stack);process.exitCode=4}finally{if(browser)await browser.close();await new Promise(done=>srv.close(done))}})();
