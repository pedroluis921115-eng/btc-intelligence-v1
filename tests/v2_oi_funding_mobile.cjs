'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const full=path.join(root,rel);
 if(!full.startsWith(root)||!fs.existsSync(full)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(full)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(full).pipe(res)
});
(async()=>{let browser;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
 await new Promise(ok=>setTimeout(ok,9500));
 const first=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  return{price:t('price'),connection:t('connection'),fundingNext:t('fundingNext'),fundingPrevious:t('fundingPreviousStamp'),
    fundingCurrent:t('fundingCurrent'),fear:t('fngValue'),fearStamp:t('fngUpdated'),hourlyLabel:t('hourlySentimentLabel'),
    hourlyText:t('hourlySentimentDetail')?.slice(0,310),hourlyStamp:t('hourlySentimentStamp'),
    provenance:t('sourceFreshnessSummary'),provenanceCount:sourceFreshness().length,sourceList:t('sourceFreshness')?.slice(0,340),
    hasNewVersion:!!document.querySelector('script[src*="v2-oi-funding-e-20261114"]'),
    overflows:document.body.scrollWidth>innerWidth+2,
    fundingAt:state.fundingAt,lastFundingAt:state.lastFundingAt,hourlyAt:state.hourlyAt,
    priceLive:state.lastPriceAt>0
  }
 });
 const rows=[];
 for(const tf of ['5','15','30','60','240']){
  await page.evaluate(tf=>document.querySelector('[data-tf="'+tf+'"]').click(),tf);
  await new Promise(ok=>setTimeout(ok,2200));
  rows.push(await page.evaluate(tf=>{
   const text=id=>document.getElementById(id)?.textContent||'';
   return {tf,oi:text('oiWindowDelta'),aligned:text('oiAlignedDetails')?.slice(0,195),
    relevance:text('oiRelevance')?.slice(0,235),stamp:text('oiWindowStamp')?.slice(0,130),
    source:state.oiSeriesTf,ok:state.oiAligned?.tf===tf,
    labels:state.oiRelevance?.samples||null}
  },tf))
 }
 const after=await page.evaluate(()=>({count:sourceFreshness().length,labels:document.getElementById('sourceFreshnessSummary')?.textContent,
   price:document.getElementById('price')?.textContent,overflow:document.body.scrollWidth>innerWidth+2}));
 console.log('E_MOBILE_REAL',JSON.stringify({first,rows,after,errors}));
 if(errors.length||first.overflows||after.overflow||!first.hasNewVersion||!first.price.startsWith('$')||
  !first.fundingNext.includes('Indicativa')||!first.fundingPrevious.includes('Liquidación histórica')||
  !first.hourlyStamp.includes('Ventana CERRADA')||!first.hourlyText.includes('Funding indicativo')||
  !first.provenance.includes('lecturas con datos vigentes')||first.provenanceCount<10||
  rows.some(r=>!r.ok||!r.relevance.includes('Bybit')||!r.aligned.includes('Mismo periodo cerrado')))process.exitCode=4;
}catch(e){console.error('E_MOBILE_FAILURE',e.stack);process.exitCode=5}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}})();
