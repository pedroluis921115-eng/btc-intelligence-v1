'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const root=path.join(__dirname,'..');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',f=path.join(root,rel);
 if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res)
});
(async()=>{let browser;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:17000});
 await new Promise(done=>setTimeout(done,16000));
 const live=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  const bybitRef=comparisonReference(bestComparisonLevels(state.bids,'bid'),bestComparisonLevels(state.asks,'ask'));
  const binanceRef=comparisonReference(state.binanceBids,state.binanceAsks);
  return {
    price:t('price'),connection:t('connection'),source:t('compareStatus'),
    normalize:t('compareNormalization'),coincidences:t('compareCoincidence')?.slice(0,520),
    bybitBid:t('cmpBybitBid'),binanceBid:t('cmpBinanceBid'),
    bDepth:[state.bids.size,state.asks.size],
    nDepth:[state.binanceBids.length,state.binanceAsks.length],
    mids:[bybitRef?.mid,binanceRef?.mid],spreads:[bybitRef?.spreadBps,binanceRef?.spreadBps],
    sampleCount:state.compareTracks.size,
    lastBook:Date.now()-state.lastBookAt,lastBinance:Date.now()-state.binanceLastAt,
    script:!!document.querySelector('script[src*="v2-cross-venue-f-20261114"]'),
    overflow:document.body.scrollWidth>innerWidth+2
  };
 });
 // Synchronous deterministic UI scenario in the actual Android-size browser,
 // without changing live code or source streams.
 const simulated=await page.evaluate(()=>{
  const base=Date.now();
  state.bids=new Map([['69993','5'],['69990','1']]);
  state.asks=new Map([['70007','5'],['70010','1']]);
  state.binanceBids=[{p:70063,q:5},{p:70060,q:1}];
  state.binanceAsks=[{p:70077,q:5},{p:70080,q:1}];
  state.wsOk=true;state.price=70000;
  resetComparisonPersistence();
  for(const dt of [0,5000,10000,15000]){
    const t=base+dt;
    state.lastBookAt=t-80;state.binanceLastAt=t-120;
    renderExchangeComparison(t);
  }
  const content=document.getElementById('compareCoincidence').textContent;
  const norm=document.getElementById('compareNormalization').textContent;
  const evidence=[...state.compareTracks.values()].map(x=>({...x}));
  resetComparisonPersistence();
  return {content:content.slice(0,700),norm:norm.slice(0,270),evidence,
    overflow:document.body.scrollWidth>innerWidth+2}
 });
 console.log('F_MOBILE_REAL',JSON.stringify({live,simulated,errors}));
 if(errors.length||!live.script||live.overflow||simulated.overflow||!live.price.startsWith('$')||
  !live.bybitBid.startsWith('$')||!live.binanceBid.startsWith('$')||!live.normalize.includes('Mids:')||
  live.bDepth[0]<20||live.nDepth[0]<2||!simulated.content.includes('PERSISTENTE')||
  !simulated.content.includes('Bybit')||!simulated.content.includes('Binance')||
  !simulated.norm.includes('Diferencia de mids')||simulated.evidence.some(x=>x.count<3||x.lastAt-x.firstAt<12000)){
   process.exitCode=4;
 }
}catch(err){console.error('F_MOBILE_FAILURE',err.stack);process.exitCode=5}finally{if(browser)await browser.close();await new Promise(done=>server.close(done))}})();
