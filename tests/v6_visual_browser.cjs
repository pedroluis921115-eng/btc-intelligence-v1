'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain','cache-control':'no-store'});fs.createReadStream(file).pipe(res)
});
async function check(browser,width,height){
 const page=await browser.newPage(),errors=[];
 try{
  await page.setViewport({width,height,deviceScaleFactor:1});
  page.on('pageerror',err=>errors.push(err.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{
   if(request.url().startsWith('http://127.0.0.1:'))return request.continue();
   return request.abort().catch(()=>{})
  });
  const url='http://127.0.0.1:'+server.address().port+'/';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
  const initial=await page.evaluate(()=>({
   decision:document.getElementById('vsDecision').textContent,
   insight:document.getElementById('vsImportantList').textContent,
   fund:!!document.getElementById('vsFunding'),
   tabs:document.querySelectorAll('[data-vs-view]').length,
   width:document.documentElement.scrollWidth,inner:innerWidth
  }));
  assert.equal(initial.tabs,3);assert.equal(initial.fund,true);
  assert.ok(initial.width<=initial.inner+1);
  await page.evaluate(()=>{
   const now=Date.now(),base=Math.floor(now/300000)*300000;
   state.price=90000;state.lastPriceAt=now;state.wsOk=true;
   state.lastHistoryAt=now;
   state.fiveCandles=Array.from({length:75},(_,i)=>{
    const ts=base-(75-i)*300000;
    const o=90000+100*Math.sin(i/8),c=o+(i%2===0?25:-30);
    return [String(ts),String(o),String(Math.max(o,c)+20),String(Math.min(o,c)-20),String(c)];
   });
   state.model=[
    {level:91200,weight:1000,side:'short'},
    {level:92500,weight:700,side:'short'},
    {level:89100,weight:950,side:'long'},
    {level:88400,weight:450,side:'long'}
   ];
   state.fundingRate=0.00001;state.fundingAt=now;state.fundingNextAt=now+3600000;
   BTCImportant.render();
  });
  const info=await page.evaluate(()=>({
   events:document.querySelectorAll('#vsImportantList .vs-important-item').length,
   text:document.getElementById('vsImportantList').textContent
  }));
  assert.ok(info.events>0&&info.events<=3);
  assert.ok(info.text.includes('Funding')||info.text.includes('OI')||info.text.includes('Zona'));
  await page.click('[data-vs-view="liquidity"]');
  await page.evaluate(()=>BTCLiqVisual.render());
  const chart=await page.evaluate(()=>{
    // Fijar el estado sintético justo antes del render: las peticiones REST de la app se abortan en esta prueba.
    const now=Date.now(),base=Math.floor(now/300000)*300000;
    state.wsOk=true;state.price=90000;state.lastPriceAt=now;state.lastHistoryAt=now;
    state.fiveCandles=Array.from({length:75},(_,i)=>{
      const ts=base-(75-i)*300000,o=90000+100*Math.sin(i/8),c=o+(i%2===0?25:-30);
      return [String(ts),String(o),String(Math.max(o,c)+20),String(Math.min(o,c)-20),String(c)];
    });
    state.model=[{level:91200,weight:1000,side:'short'},{level:92500,weight:700,side:'short'},
      {level:89100,weight:950,side:'long'},{level:88400,weight:450,side:'long'}];
    BTCLiqVisual.render();
    const canvas=document.getElementById('vsLiqCanvas'),
     ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect();
    const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let colored=0;
    for(let i=0;i<bytes.length;i+=40){
     const red=bytes[i],green=bytes[i+1],blue=bytes[i+2];
     if(red>125&&green>65&&blue>65)colored++;
    }
    return {
     visible:rect.height,above:document.getElementById('vsLiqAbove').textContent,
     below:document.getElementById('vsLiqBelow').textContent,
     note:document.getElementById('vsLiqChartStatus').textContent,
     colored,width:document.documentElement.scrollWidth,inner:innerWidth,
     oldCollapsed:document.getElementById('vsOriginalModel').open===false
    };
  });
  assert.ok(chart.above.includes('91,200')&&chart.below.includes('89,100'),JSON.stringify(chart));
  assert.ok(chart.colored>60,'chart contains visible color bands '+JSON.stringify(chart));
  assert.ok(chart.note.includes('NO liquidez real'),chart.note);
  assert.equal(chart.oldCollapsed,true);
  assert.ok(chart.width<=chart.inner+1);
  await page.click('[data-vs-zoom="7"]');
  assert.equal(await page.$eval('[data-vs-zoom="7"]',el=>el.classList.contains('active')),true);
  await page.evaluate(()=>{
   state.lastHistoryAt=Date.now()-600000;
   BTCLiqVisual.render()
  });
  assert.equal(await page.$eval('#vsLiqAbove',el=>el.textContent),'—','old OI not shown');
  await page.evaluate(()=>{
   state.lastHistoryAt=Date.now();
   document.getElementById('vsOriginalModel').open=true;
   draw()
  });
  assert.ok((await page.$eval('#heat',el=>el.getBoundingClientRect().height))>=380);
  assert.deepEqual(errors,[],'page errors');
  console.log('V6_BROWSER_PASS',width+'x'+height,JSON.stringify({info,chart}));
 }finally{await page.close()}
}
(async()=>{let browser;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  await check(browser,320,780);await check(browser,390,844);await check(browser,1280,800);
  console.log('V6_BROWSER_COMPLETE_PASS')
 }catch(e){console.error('V6_BROWSER_HOLD',e.stack||e.message);process.exitCode=1}
 finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
})();
