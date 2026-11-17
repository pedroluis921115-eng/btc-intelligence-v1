'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html';
 const file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain','cache-control':'no-store'});
 fs.createReadStream(file).pipe(res)
});
const mock=(now)=>({
 updatedAt:new Date(now-30000).toISOString(),
 data:[
  {source:'census',eventName:'Retail Sales (Advance)',importance:'high',scheduledAt:'2026-11-17T13:30:00Z',actual:'0.2',previous:'0.8',unit:'% m/m'},
  {source:'fed',eventName:'Industrial Production (G.17)',importance:'med',scheduledAt:'2026-11-17T14:15:00Z',actual:'-0.4',previous:'0.7',unit:'% m/m'},
  {source:'fed',eventName:'FOMC Minutes',importance:'med',scheduledAt:'2026-11-18T19:00:00Z',actual:null,previous:null},
  {source:'dol',eventName:'Initial Jobless Claims',importance:'high',scheduledAt:'2026-11-19T13:30:00Z'}
 ]});
async function check(browser,width,height){
 const page=await browser.newPage(),errors=[];
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',err=>errors.push(err.message));
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=req.url();
   if(url.startsWith('http://127.0.0.1:'))return req.continue();
   if(url.includes('xoomar.com/api/markets/calendar')){
    return req.respond({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',
      body:JSON.stringify(mock(Date.now()))}).catch(()=>{});
   }
   req.abort().catch(()=>{});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:18000});
  await page.waitForFunction(()=>{
   return document.querySelector('#vsCorporateEvents .vs-corporate-card')&&
      document.getElementById('vsMacroStatus')?.textContent.includes('AGENDA ACTUALIZADA');
  },{timeout:10000});
  const initial=await page.evaluate(()=>({
    corp:document.getElementById('vsCorporateEvents').textContent,
    corpCount:document.querySelectorAll('#vsCorporateEvents .vs-corporate-card').length,
    source:document.querySelector('#vsCorporateEvents .vs-corporate-source')?.href,
    macro:document.getElementById('vsMacroEvents').textContent,
    macroCount:document.querySelectorAll('#vsMacroEvents .vs-macro-event').length,
    status:document.getElementById('vsCorporateStatus').textContent,
    overflow:document.documentElement.scrollWidth-innerWidth
  }));
  assert.equal(initial.corpCount,1,'exactly one official Nvidia event');
  assert.ok(initial.corp.includes('NVIDIA')&&initial.corp.includes('18:20')&&initial.corp.includes('19:00'),JSON.stringify(initial));
  assert.ok(initial.source.startsWith('https://investor.nvidia.com'));
  assert.ok(initial.macro.includes('VENTAS MINORISTAS')&&initial.macro.includes('PRODUCCIÓN INDUSTRIAL')&&
    initial.macro.includes('ACTAS DE LA FED'),JSON.stringify(initial));
  assert.ok(initial.macro.includes('PUBLICADO'));
  assert.ok(!initial.macro.includes('Jobless'));
  assert.ok(initial.overflow<=2,'horizontal overflow '+initial.overflow);
  await page.click('[data-vs-macro-days="14"]');
  assert.equal(await page.$eval('#vsMacroStatus',x=>x.textContent.includes('14 DÍAS')),true);
  assert.deepEqual(errors,[],'no JS errors');
  console.log('IMPORTANT_EVENTS_BROWSER_PASS',width+'x'+height,JSON.stringify({corp:initial.corp.slice(0,180),macro:initial.macro.slice(0,200)}));
 }finally{await page.close()}
}
(async()=>{let browser;
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const [w,h] of [[320,780],[390,844],[1280,800]])await check(browser,w,h);
  console.log('IMPORTANT_EVENTS_BROWSER_SUITE_PASS');
 }catch(e){console.error('IMPORTANT_EVENTS_BROWSER_SUITE_HOLD',e.stack||e.message);process.exitCode=1}
 finally{if(browser)await browser.close();await new Promise(done=>server.close(done))}
})();
