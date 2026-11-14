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
(async()=>{let browser;try{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:16000});
 await new Promise(done=>setTimeout(done,10500));
 const results=[];
 for(const tf of ['5','15','30','60','240']){
  await page.evaluate(tf=>document.querySelector('[data-tf="'+tf+'"]').click(),tf);
  await new Promise(done=>setTimeout(done,2100));
  results.push(await page.evaluate(tf=>{
   const v=breakoutVolatility(),t=id=>document.getElementById(id)?.textContent;
   return {tf,source:state.candleSource,volatility:v?.movePct||null,range:v?.rangePct||null,breakoutStamp:t('breakoutStamp')?.slice(0,220)}
  },tf))
 }
 const final=await page.evaluate(()=>{
  const txt=id=>document.getElementById(id)?.textContent;
  const now=Date.now();
  const period=Number(state.tf)*60000,start=Math.floor(now/period)*period;
  const simulated={ts:start+10000,side:'bid',level:state.price+100,status:'pending',resolved:0,last:state.price,tf:state.tf,
   thresholdUsd:Math.max(20,state.price*.0006),thresholdPct:.06,candle:'awaiting',candleClose:null,candleAt:0,
   retest:'waiting',retestAt:0,retestResolved:0};
  state.breakouts.unshift(simulated);renderBreakouts();
  return {connection:txt('connection'),price:txt('price'),comparison:txt('compareStatus'),
    heat:txt('liquidityHeatStamp')?.slice(0,140),
    syntheticCard:txt('breakoutEvents')?.slice(0,420),
    jsVolatility:!!breakoutVolatility(),noHorizontalOverflow:document.body.scrollWidth<=innerWidth+2,
    newScript:!!document.querySelector('script[src*="v2-breakouts-c-20261114"]')};
 });
 console.log('C_MOBILE',JSON.stringify({results,final,errors}));
 if(errors.length||!final.noHorizontalOverflow||!final.newScript||!final.price?.startsWith('$')||
    !final.syntheticCard.includes('Cierre')||!results.every(x=>x.source==='Bybit'&&x.volatility!==null&&x.volatility>=.04&&x.volatility<=.35))process.exitCode=4;
}catch(e){console.error('C_MOBILE_FAILURE',e.stack);process.exitCode=5}finally{if(browser)await browser.close();await new Promise(done=>server.close(done))}})();
