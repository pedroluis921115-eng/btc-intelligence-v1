'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',f=path.join(root,rel);
 if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);res.end('missing');return}
 res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res)
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{let browser;try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:17000});
 await delay(13500);
 const before=await page.evaluate(()=>{
  const t=id=>document.getElementById(id)?.textContent||'';
  const folds=[...document.querySelectorAll('details.foldable')];
  return {
   price:t('price'),lastTrade:state.lastPriceAt,tradeCount:state.tradeIds.size,
   sourceBybit:state.bids.size,sourceBinance:state.binanceBids.length,
   summary:t('topSnapshotClock'),topPrice:t('topPrice'),topFlow:t('topFlow'),
   topOi:t('topOi'),topFunding:t('topFunding'),
   alwaysVisibleAlert:!!document.getElementById('topAlertRegion')&&
    !document.getElementById('topAlertRegion').closest('details'),
   fullAlertVisible:!!document.getElementById('alertsPanel')&&
    !document.getElementById('alertsPanel').closest('details'),
   folds:folds.length,openCount:folds.filter(x=>x.open).length,
   semanticHeadings:document.querySelectorAll('details.foldable summary [role="heading"][aria-level="2"]').length,
   nativeSummary:folds.every(x=>x.querySelector(':scope > summary')&&x.querySelector(':scope > div.fold-body')),
   uniqueIds:(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);return ids.length===new Set(ids).size})(),
   version:!!document.querySelector('script[src*="v2-mobile-h-20261114"]'),
   overflow:document.body.scrollWidth>innerWidth+2
  }
 });
 // Native <summary> is keyboard operable without JS-specific click behavior.
 const selector='details.foldable[data-panel="fold-01"] > summary';
 await page.focus(selector);
 await page.keyboard.press('Enter');await delay(220);
 const toggled=await page.evaluate(()=>{
  const d=document.querySelector('details.foldable[data-panel="fold-01"]');
  return{open:d.open,stored:JSON.parse(localStorage.getItem('btc-intelligence-v2-panels')||'{}')[d.dataset.panel]}
 });
 // Open all three previously-hidden charts and validate redraw on reveal.
 const opened=await page.evaluate(async()=>{
  const ids=['heat','liquidityHeat','oiChart'],result=[];
  for(const id of ids){
   const c=document.getElementById(id),fold=c.closest('details.foldable');
   fold.open=true;
   await new Promise(resolve=>setTimeout(resolve,160));
   result.push({id,panel:fold.dataset.panel,open:fold.open,canvasWidth:c.width,canvasHeight:c.height,
    boxWidth:c.getBoundingClientRect().width,boxHeight:c.getBoundingClientRect().height});
  }
  return result
 });
 // Controlled injection checks urgent alert remains visible with all information panels folded.
 const alertCase=await page.evaluate(()=>{
  for(const details of document.querySelectorAll('details.foldable'))details.open=false;
  alertUser('MURO grande nuevo · prueba controlada','h-synthetic-wall',0,
   {kind:'wall-arrive',side:'bid',price:state.price||65000,amount:1800000,baseline:200000,
    eventId:'h-controlled',source:'PRUEBA CONTROLADA · no ocurrió en el mercado'});
  const top=document.getElementById('topImportantAlert').textContent;
  return {top,full:document.getElementById('alerts').textContent.slice(0,320),
   fullAlertInFold:!!document.getElementById('alertsPanel').closest('details'),
   topAlertInFold:!!document.getElementById('topAlertRegion').closest('details'),
   closed:[...document.querySelectorAll('details.foldable')].every(x=>!x.open),
   latestSource:document.getElementById('topImportantStamp').textContent}
 });
 // Native fold preference persisted after reload. No indicator or market state persisted.
 await delay(450);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('btc-intelligence-v2-panels')||'{}'));
 await page.reload({waitUntil:'domcontentloaded',timeout:17000});await delay(6500);
 const restored=await page.evaluate(()=>{
  const panels=[...document.querySelectorAll('details.foldable')];
  const stored=JSON.parse(localStorage.getItem('btc-intelligence-v2-panels')||'{}');
  return {same:panels.every(x=>x.open===stored[x.dataset.panel]),
   details:panels.length,topStill:!!document.getElementById('topSnapshot'),
   fullAlertsOutsideFolds:!document.getElementById('alertsPanel').closest('details'),
   summary:document.getElementById('topSnapshotClock').textContent,
   price:document.getElementById('price').textContent,
   overflow:document.body.scrollWidth>innerWidth+2}
 });
 await page.setViewport({width:320,height:780,deviceScaleFactor:1});await delay(450);
 const narrow=await page.evaluate(()=>({overflow:document.body.scrollWidth>innerWidth+2,
  topWidth:document.getElementById('topSnapshot').getBoundingClientRect().width,
  tabWidth:document.getElementById('tabs').getBoundingClientRect().width,
  columnCount:getComputedStyle(document.querySelector('.top-grid')).gridTemplateColumns,
  panelCount:document.querySelectorAll('details.foldable').length}));
 console.log('H_MOBILE_REAL',JSON.stringify({before,toggled,opened,alertCase,saved,restored,narrow,errors}));
 if(errors.length||!before.version||before.overflow||!before.uniqueIds||!before.nativeSummary||
  !before.alwaysVisibleAlert||!before.fullAlertVisible||before.folds!==14||before.openCount!==1||before.semanticHeadings!==14||
  !before.price.startsWith('$')||before.tradeCount<20||before.sourceBybit<20||
  before.sourceBinance<2||!before.topPrice.startsWith('$')||
  !toggled.open||toggled.stored!==true||
  opened.some(x=>!x.open||x.canvasWidth<=0||x.canvasHeight<=0||x.boxWidth<=0)||
  !alertCase.top.includes('ALTA')||!alertCase.full.includes('MURO grande nuevo')||
  alertCase.fullAlertInFold||alertCase.topAlertInFold||!alertCase.closed||
  !alertCase.latestSource.includes('PRUEBA CONTROLADA')||!alertCase.latestSource.includes('evento observado')||!restored.same||restored.details!==14||
  !restored.topStill||!restored.fullAlertsOutsideFolds||restored.overflow||narrow.overflow){
  process.exitCode=4;
 }
 }catch(err){console.error('H_MOBILE_FAILURE',err.stack);process.exitCode=5}
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}})();
