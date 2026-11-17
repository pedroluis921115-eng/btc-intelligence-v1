'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain','cache-control':'no-store'});
 fs.createReadStream(file).pipe(res)
});
function candles(tf){
 const m=+tf,ms=m*60000,now=Date.now(),first=Math.floor(now/ms)*ms-40*ms;
 return Array.from({length:40},(_,i)=>{
  const o=90000+i*20,c=o+16;
  return [String(first+i*ms),String(o),String(c+1),String(o-1),String(c),'1','1']
 }).reverse()
}
async function test(browser,width,height){
 const page=await browser.newPage(),errors=[],local='http://127.0.0.1:'+server.address().port+'/';
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=req.url();
   if(url.startsWith('http://127.0.0.1:'))return req.continue();
   if(url.includes('api.bybit.com/v5/market/kline?')){
    return req.respond({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},
     body:JSON.stringify({retCode:0,result:{list:candles(new URL(url).searchParams.get('interval'))}})}).catch(()=>{});
   }
   req.abort().catch(()=>{});
  });
  await page.goto(local,{waitUntil:'domcontentloaded',timeout:20000});
  // Cada viewport usa un diario de prueba vacío dentro del perfil Chromium temporal.
  await page.evaluate(()=>{localStorage.removeItem('btc-intelligence-manual-journal-v1');localStorage.removeItem('btc-confluence-alerts-enabled')});
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.getElementById('manualDataStatus').textContent.startsWith('4/4'),{timeout:9000});
  let display=await page.evaluate(()=>({
   radar:document.getElementById('manualConfluence')?.textContent,
   journal:!!document.getElementById('manualJournalPanel'),
   maps:!!document.getElementById('modelNearestAbove'),
   horizontal:document.documentElement.scrollWidth-window.innerWidth
  }));
  assert.equal(display.journal,true);assert.equal(display.maps,true);
  assert.ok(display.horizontal<=1,'horizontal overflow '+JSON.stringify(display));
  assert.equal(display.radar,'DATOS INCOMPLETOS','no signal without fresh WS');
  await page.evaluate(()=>{
    const t=Date.now();
    state.wsOk=true;state.price=90600;state.lastPriceAt=t;
    state.trades=Array.from({length:20},(_,i)=>({id:'test'+i,ts:t-65000+i*3000,
       buy:i<17,price:90600,usdt:15000,seq:i}));
    BTCConfluence.render();
  });
  const c=await page.$eval('#manualConfluence',el=>el.textContent);
  assert.match(c,/CONFLUENCIA DESCRIPTIVA LONG/,'nonpredictive confluence');
  const firstAlerts=await page.$$eval('#manualConfluenceHistory .manual-alert-item',xs=>xs.length);
  assert.equal(firstAlerts,1);
  await page.evaluate(()=>{const a=document.getElementById('manualConfluenceAlertsEnabled');a.checked=false;a.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.evaluate(()=>BTCConfluence.render());
  assert.equal(await page.$$eval('#manualConfluenceHistory .manual-alert-item',xs=>xs.length),1,'deduplicate');
  await page.evaluate(()=>{
   document.querySelector('details[data-panel="manual-journal"]').open=true;
   const set=(id,val)=>{document.getElementById(id).value=String(val)};
   set('journalKind','PAPER');set('journalSide','LONG');set('journalSetup','Retroceso');set('journalOrigin','Trader en vivo');
   set('journalEntry',90000);set('journalExit',90200);set('journalQty',0.01);set('journalFees',0.45);
   set('journalNote','Operación simulada; mi entrada no es el precio del trader.');
   document.getElementById('journalSave').click()
  });
  let metrics=await page.$eval('#journalMetrics',el=>el.textContent);
  assert.match(metrics,/PAPER: 1/);assert.match(metrics,/US\$1.55/);
  await page.evaluate(()=>{
    const set=(id,val)=>{document.getElementById(id).value=String(val)};
    set('journalKind','REAL');set('journalSide','SHORT');set('journalSetup','Ruptura');set('journalOrigin','Análisis propio');
    set('journalEntry',90000);set('journalExit',90200);set('journalQty',0.01);set('journalFees',0.5);
    document.getElementById('journalSave').click();
    set('journalFilter','REAL');document.getElementById('journalFilter').dispatchEvent(new Event('change'))
  });
  metrics=await page.$eval('#journalMetrics',el=>el.textContent);
  assert.match(metrics,/REAL: 1/);assert.match(metrics,/-US\$2.50/);
  const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('btc-intelligence-manual-journal-v1')).length);
  assert.equal(count,2,'stored locally');
  await page.evaluate(()=>{document.getElementById('journalEntry').value='0';document.getElementById('journalSave').click()});
  assert.match(await page.$eval('#journalStatus',el=>el.textContent),/No guardado/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('btc-intelligence-manual-journal-v1')).length),2,'bad trade not saved');
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.getElementById('journalMetrics')?.textContent.includes('PAPER: 1'),{timeout:5000});
  assert.equal(await page.$eval('#manualConfluenceAlertsEnabled',x=>x.checked),false,'mute choice persisted');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('btc-intelligence-manual-journal-v1')).length),2,'persisted after reopen');
  await page.evaluate(async()=>{
    const inp=document.getElementById('journalImport');
    const records=JSON.parse(localStorage.getItem('btc-intelligence-manual-journal-v1'));
    const file=new File([JSON.stringify({format:'BTC_INTELLIGENCE_JOURNAL_V1',records})],'diario.json',{type:'application/json'});
    const dt=new DataTransfer();dt.items.add(file);inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.getElementById('journalStatus').textContent.includes('Importación validada'),{timeout:5000});
  assert.match(await page.$eval('#journalStatus',x=>x.textContent),/0 nuevos, 2 duplicados omitidos/);
  await page.evaluate(()=>{
    const inp=document.getElementById('journalImport'),raw=JSON.parse(localStorage.getItem('btc-intelligence-manual-journal-v1'));
    const invalid={...raw[0],id:'bad'};
    const file=new File([JSON.stringify({format:'BTC_INTELLIGENCE_JOURNAL_V1',records:[invalid]})],'bad.json',{type:'application/json'});
    const dt=new DataTransfer();dt.items.add(file);inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.getElementById('journalStatus').textContent.includes('Importación rechazada'),{timeout:5000});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('btc-intelligence-manual-journal-v1')).length),2,'invalid import leaves diary intact');
  assert.deepEqual(errors,[],'no page errors');
  console.log('V4_BROWSER_PASS',width+'x'+height,JSON.stringify({confluence:c,paper:true,real:true,persist:true,import:true}));
 }finally{await page.close()}
}
(async()=>{
 let browser;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  await test(browser,390,844);await test(browser,1280,800);
  console.log('V4_BROWSER_FINAL_PASS');
 }catch(e){console.error('V4_BROWSER_FINAL_HOLD',e);process.exitCode=1}
 finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
})();
