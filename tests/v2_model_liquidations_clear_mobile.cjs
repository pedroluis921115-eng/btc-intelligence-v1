'use strict';
// No orders: isolated, synthetic display data to test clarity and scientific labels.
const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..'),mime={'.html':'text/html','.js':'application/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',p=path.join(root,rel);
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end('not found');return}
 res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(p).pipe(res)
});
(async()=>{let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:15000});
  // V5: mapa conserva su función, ahora en la pestaña Liquidez.
  await page.evaluate(()=>document.querySelector('[data-vs-view="liquidity"]').click());
  // Inject only into private local browser test, not an exchange and not deployed.
  const inspect=()=>page.evaluate(()=>{
   const text=id=>document.getElementById(id)?.textContent||'';
   const panel=document.getElementById('heat').closest('details');
   const canvas=document.getElementById('heat');
   const rect=canvas.getBoundingClientRect();
   const ladder=modelZoneLadder(state.price);
   return {first:document.querySelector('[data-fold-card]')?.dataset.foldCard,
    modelOpen:panel.open,bookOpen:document.getElementById('liquidityHeat').closest('details').open,
    top:text('modelNearestAbove'),bot:text('modelNearestBelow'),topInfo:text('modelNearestAboveDetail'),
    botInfo:text('modelNearestBelowDetail'),scope:text('modelZoneScope'),
    above:ladder.above.map(z=>z.level),below:ladder.below.map(z=>z.level),
    dimensions:[Math.round(rect.width),Math.round(rect.height)],
    drawing:[canvas.width,canvas.height],
    overflow:document.documentElement.scrollWidth>innerWidth+2
   }
  });
  await page.evaluate(()=>{
   state.price=62500;state.wsOk=true;state.lastPriceAt=Date.now();
   state.model=[
    {level:63750,side:'short',weight:25},{level:65120,side:'short',weight:20},
    {level:68900,side:'short',weight:30},{level:60800,side:'long',weight:15},
    {level:58000,side:'long',weight:22},
    {level:62000,side:'short',weight:99999}, // Wrong side excluded
    {level:62800,side:'long',weight:99999},  // Wrong side excluded
    {level:72400,side:'short',weight:99999}  // Outside +/- 11.5%
   ];
   draw()
  });
  const normal=await inspect();
  assert.equal(normal.first,'fold-03','requested map must appear first');
  assert.equal(normal.modelOpen,true,'requested map must be expanded initially');
  assert.equal(normal.bookOpen,false,'near-orderbook map collapsed initially');
  assert.deepEqual(normal.above,[63750,65120,68900]);
  assert.deepEqual(normal.below,[60800,58000]);
  assert.equal(normal.top,'$63,750');assert.equal(normal.bot,'$60,800');
  assert.match(normal.topInfo,/\+2\.00%/);assert.match(normal.botInfo,/-2\.72%/);
  assert.match(normal.scope,/NO a escala vertical/);
  assert.ok(normal.dimensions[1]>=400&&!normal.overflow,'readable 390 px chart');
  await page.setViewport({width:320,height:780,deviceScaleFactor:1});
  await page.evaluate(()=>draw());
  const narrow=await inspect();
  assert.ok(!narrow.overflow&&narrow.dimensions[0]>=240&&narrow.dimensions[1]>=400,'readable 320 px chart');
  await page.evaluate(()=>{state.lastPriceAt=Date.now()-30000;draw()});
  const stale=await inspect();
  assert.equal(stale.top,'—');assert.equal(stale.bot,'—');
  assert.match(stale.scope,/Sin estimación vigente/);
  assert.deepEqual(modelSort([63750]),modelSort([63750]));
  assert.equal(errors.length,0,'no JavaScript errors: '+errors.join(' | '));
  console.log('MODEL_LIQUIDATIONS_MOBILE_PASS',JSON.stringify({normal,narrow,stale,errors}));
 }catch(err){console.error('MODEL_LIQUIDATIONS_MOBILE_HOLD',err.stack);process.exitCode=5}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})();
function modelSort(a){return a.sort((x,y)=>x-y)}
