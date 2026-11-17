'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain','cache-control':'no-store'});fs.createReadStream(file).pipe(res)
});
const ms=86400000;
function mockBody(now,stale=false){
 const get=(name,days,source,importance='high')=>({source,eventName:name,importance,scheduledAt:new Date(now+days*ms).toISOString(),actual:null,previous:null,forecast:null,unit:null});
 return {updatedAt:new Date(now-(stale?5*ms:120000)).toISOString(),
  data:[get('Initial Jobless Claims',1,'dol'),get('Personal Income and Outlays (PCE)',2,'bea'),
   get('FOMC Rate Decision',9,'fed'),get('CPI (Consumer Price Index)',10,'bls'),
   get('Housing Starts',3,'census')]}
}
async function check(browser,width,height,stale){
 const page=await browser.newPage(),errors=[];let callCount=0;
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const u=request.url();
   if(u.startsWith('http://127.0.0.1:'))return request.continue();
   if(u.includes('xoomar.com/api/markets/calendar')){
    callCount++;
    return request.respond({status:200,headers:{'access-control-allow-origin':'*'},
     contentType:'application/json',body:JSON.stringify(mockBody(Date.now(),stale))}).catch(()=>{});
   }
   request.abort().catch(()=>{});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:16000});
  await page.waitForFunction(()=>document.getElementById('vsMacroStatus')?.textContent.includes('AGENDA ACTUALIZADA')||
   document.getElementById('vsMacroStatus')?.textContent.includes('Calendario desactualizado'),{timeout:8000});
  const initial=await page.evaluate(()=>({
   count:document.querySelectorAll('#vsMacroEvents .vs-macro-event').length,
   status:document.getElementById('vsMacroStatus').textContent,
   text:document.getElementById('vsMacroEvents').textContent,
   credit:document.querySelector('.vs-macro-footer>a')?.href,
   inner:innerWidth,body:document.documentElement.scrollWidth
  }));
  assert.ok(initial.body<=initial.inner+2,'no overflow '+JSON.stringify(initial));
  if(stale){
   assert.equal(initial.count,0,'stale feed must show no fabricated releases');
   assert.match(initial.status,/desactualizado/);
  }else{
   assert.equal(initial.count,1,'one selected high impact within 7 days');
   assert.ok(initial.text.includes('PCE')&&!initial.text.includes('Claims')&&!initial.text.includes('Housing'));
   assert.ok(initial.text.includes('BRT'),'show Curitiba time');
   assert.ok(initial.credit.startsWith('https://xoomar.com'));
   await page.click('[data-vs-macro-days="14"]');
   assert.equal(await page.$$eval('#vsMacroEvents .vs-macro-event',xs=>xs.length),3,'14-day includes 3 priority releases');
   await page.click('[data-vs-macro-days="7"]');
   assert.equal(await page.$$eval('#vsMacroEvents .vs-macro-event',xs=>xs.length),1);
   await page.click('[data-vs-view="liquidity"]');
   await page.click('[data-vs-view="analysis"]');
   assert.equal(await page.$$eval('#vsMacroEvents .vs-macro-event',xs=>xs.length),1,'return from liquidity preserves macro');
  }
  assert.deepEqual(errors,[],'JS errors');
  console.log('MACRO_BROWSER_PASS',width,height,stale?'STALE_REJECTION':'UI',JSON.stringify({callCount,initial}));
 }finally{await page.close()}
}
(async()=>{let browser;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 await check(browser,320,780,false);await check(browser,390,844,false);await check(browser,1280,800,false);
 await check(browser,390,844,true);
 console.log('MACRO_BROWSER_SUITE_PASS');
}catch(e){console.error('MACRO_BROWSER_HOLD',e.stack||e.message);process.exitCode=1}
finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}})();
