'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const root=path.join(__dirname,'..');
const m={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^[/\\]+/,'')||'index.html',file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':m[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res)
});
(async()=>{
 let browser;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  const target=process.argv.includes('--public')?'https://pedroluis921115-eng.github.io/btc-intelligence-v1/':'http://127.0.0.1:'+server.address().port+'/';
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:20000});
  if((await page.title())!=='BTC Intelligence V6')throw Error('Versión pública anterior');
  await page.click('[data-vs-view="liquidity"]');
  try{await page.waitForFunction(()=>document.getElementById('vsOiTotal')?.textContent.includes('BTC'),{timeout:14000})}catch{}
  const result=await page.evaluate(()=>({
    total:document.getElementById('vsOiTotal').textContent,
    hint:document.getElementById('vsOiHint').textContent,
    sources:['binance','bybit','okx'].map(id=>({id,oi:document.getElementById('vsOi'+id+'Value').textContent,stamp:document.getElementById('vsOi'+id+'Stamp').textContent}))
  }));
  console.log('OI_LIVE_BROWSER',JSON.stringify(result));
  if(!result.total.includes('BTC')){console.log('LIVE_OI_HOLD_MISSING_SOURCES');process.exitCode=2}
  else console.log('LIVE_OI_PASS_THREE_EXCHANGES');
 }catch(e){console.error('LIVE_OI_HOLD',e);process.exitCode=2}
 finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
})();
