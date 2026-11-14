'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..');
const types={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const full=path.join(root,rel);
 if(!full.startsWith(root)||!fs.existsSync(full)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':types[path.extname(full)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(full).pipe(res)
});
(async()=>{let browser;
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:16000});
  await new Promise(resolve=>setTimeout(resolve,14500));
  const live=await page.evaluate(()=>{
   const t=id=>document.getElementById(id)?.textContent||'';
   return {price:t('price'),connection:t('connection'),tradeIds:state.tradeIds.size,
    bidDepth:state.bids.size,binanceDepth:state.binanceBids.length,
    heat:t('liquidityHeatStamp')?.slice(0,145),oi:t('oiAlignedDetails')?.slice(0,160),
    funding:t('fundingNext')?.slice(0,160),comparison:t('compareNormalization')?.slice(0,160),
    alerts:t('alerts')?.slice(0,290),summary:t('alertsSummary'),
    version:!!document.querySelector('script[src*="v2-alerts-g-20261114"]'),
    overflow:document.body.scrollWidth>innerWidth+2}
  });
  const simulated=await page.evaluate(()=>{
   state.alerts=[];state.alertGroups.clear();state.alertReceived=0;state.alertGrouped=0;state.alertEscalations=0;
   const p=state.price||70000;
   // Uses the existing alert scheduler in the mobile browser, NOT the market feeds.
   for(let i=0;i<80;i++){
    alertUser('Compra observada '+i,'synthetic-whale-'+i,0,{
     kind:'whale',side:'Buy',price:p,amount:120000,baseline:100000,
     eventId:'sim-buy-'+i,source:'PRUEBA CONTROLADA · no evento real'
    })
   }
   const before=state.alertGroups.size;
   alertUser('Venta distinta','synthetic-sell-1',0,{
    kind:'whale',side:'Sell',price:p,amount:750000,baseline:100000,
    eventId:'sim-sell-1',source:'PRUEBA CONTROLADA · no evento real'
   });
   alertUser('Muro de compra distinto','wall-arrive-bid:69940',600000,{
    kind:'wall-arrive',side:'bid',price:p-60,amount:800000,baseline:250000,
    eventId:'sim-wall-1',source:'PRUEBA CONTROLADA · no evento real'
   });
   const html=document.getElementById('alerts').innerHTML;
   return {
    considered:state.alertReceived,grouped:state.alertGrouped,escalations:state.alertEscalations,
    groupBefore:before,groupAfter:state.alertGroups.size,
    records:state.alerts.length,whaleRows:state.alerts.filter(x=>x.groupKey.startsWith('whale:Buy')).length,
    snippet:document.getElementById('alerts').textContent.slice(0,650),
    summary:document.getElementById('alertsSummary').textContent,
    highCount:(html.match(/ALTA/g)||[]).length,
    sourceWarning:html.includes('PRUEBA CONTROLADA'),
    layoutOverflow:document.body.scrollWidth>innerWidth+2
   }
  });
  console.log('G_MOBILE_REAL',JSON.stringify({live,simulated,errors}));
  if(errors.length||live.overflow||simulated.layoutOverflow||!live.version||
   !live.price.startsWith('$')||live.tradeIds<25||live.bidDepth<20||live.binanceDepth<2||
   !live.comparison.includes('Mids:')||!live.heat.includes('precios absolutos')||
   simulated.whaleRows!==1||simulated.records>24||simulated.groupBefore!==1||
   simulated.groupAfter!==3||simulated.considered!==82||simulated.highCount<1||
   !simulated.sourceWarning||!simulated.summary.includes('agrupadas')){
   process.exitCode=4
  }
 }catch(err){console.error('G_MOBILE_FAILURE',err.stack);process.exitCode=5}
 finally{if(browser)await browser.close();await new Promise(done=>server.close(done))}
})();
