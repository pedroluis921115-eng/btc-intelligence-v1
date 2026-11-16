'use strict';
// Prueba real Chromium local; servicios externos simulados, ninguna orden.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const file=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',target=path.resolve(root,file);
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404);res.end('Not Found');return}
 res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(target).pipe(res)
});
function mockCandles(minutes){
 const ms=Number(minutes)*60000,now=Date.now(),base=Math.floor(now/ms)*ms-40*ms;
 return Array.from({length:40},(_,i)=>{
  const open=90000+i*20,close=open+16,high=close+1,low=open-1;
  return [String(base+i*ms),String(open),String(high),String(low),String(close),'100','1'];
 }).reverse()
}
async function testViewport(browser,width,height){
 const page=await browser.newPage(),errors=[];
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',err=>errors.push(err.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=req.url();
   if(url.startsWith('http://127.0.0.1:')){req.continue();return}
   if(url.includes('api.bybit.com/v5/market/kline?')){
    const u=new URL(url),min=u.searchParams.get('interval');
    req.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
     body:JSON.stringify({retCode:0,result:{list:mockCandles(min)}})}).catch(()=>{});
    return
   }
   req.abort().catch(()=>{})
  });
  const target='http://127.0.0.1:'+server.address().port+'/';
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:15000});
  await new Promise(resolve=>setTimeout(resolve,1400));
  const status=await page.evaluate(()=>{
   const ids=['manualTF240','manualTF60','manualTF15','manualTF5'];
   return {states:ids.map(x=>document.getElementById(x)?.textContent),
    title:document.getElementById('manualContext')?.textContent,
    width:document.documentElement.scrollWidth,window:window.innerWidth,
    hasOI:!!document.getElementById('modelNearestAbove')};
  });
  assert.equal(status.hasOI,true,'map preserved');
  assert.equal(status.states.length,4,'four timeframe cards');
  assert.ok(status.states.every(x=>x==='Alcista'),JSON.stringify(status));
  assert.ok(status.width<=status.window+1,'No horizontal overflow '+JSON.stringify(status));
  await page.evaluate(()=>{
   const set=(id,value)=>{document.getElementById(id).value=String(value)};
   const box=document.querySelector('details[data-panel="manual-plan"]');box.open=true;
   set('manualEntry',90000);set('manualStop',89750);set('manualTarget',90800);
   document.getElementById('manualRiskCalculate').click()
  });
  const calc=await page.$eval('#manualRiskResult',el=>el.textContent);
  assert.match(calc,/Pérdida al stop con costes/);assert.match(calc,/Beneficio\/riesgo NETO/);
  await page.evaluate(()=>{
   document.querySelector('details[data-panel="manual-partials"]').open=true;
   document.getElementById('manualPartialPrice').value=90400;
   document.getElementById('manualNewStop').value=90000;
   document.getElementById('manualPartialCalculate').click();
  });
  const partial=await page.$eval('#manualPartialResult',el=>el.textContent);
  assert.match(partial,/TOTAL hipotético/);
  assert.deepEqual(errors,[],'JS page errors');
  console.log('BROWSER_PASS '+width+'x'+height,JSON.stringify(status));
 }finally{await page.close()}
}
(async()=>{
 let browser;
 try{
  await new Promise(res=>server.listen(0,'127.0.0.1',res));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
  await testViewport(browser,390,844);
  await testViewport(browser,1280,800);
  console.log('MANUAL_ASSISTANT_BROWSER_PASS');
 }catch(err){console.error('MANUAL_ASSISTANT_BROWSER_FAIL',err);process.exitCode=1}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})();
