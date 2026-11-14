const fs=require('fs'),path=require('path');
const puppeteer=require('C:\\Users\\pedro\\AppData\\Local\\npm-cache\\_npx\\4b4c857f6efdfb61\\node_modules\\puppeteer');
const out=path.join(__dirname,'fixtures','public_stream_fixture.json');
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage(),cdp=await page.createCDPSession();
 await cdp.send('Network.enable');
 const captured={},deadline=Date.now()+19000;
 cdp.on('Network.webSocketFrameReceived',x=>{
  try{
   const msg=JSON.parse(x.response.payloadData);
   if(msg.topic==='publicTrade.BTCUSDT'&&!captured.trade){
    captured.trade={topic:msg.topic,type:msg.type,data:msg.data?.slice(0,3)};
   }else if(msg.topic==='orderbook.200.BTCUSDT'){
    if(msg.type==='snapshot'&&!captured.bybitSnapshot){
     captured.bybitSnapshot={topic:msg.topic,type:msg.type,data:{...msg.data,b:msg.data.b.slice(0,20),a:msg.data.a.slice(0,20)}}
    }else if(msg.type==='delta'&&!captured.bybitDelta&&(msg.data?.b?.length||msg.data?.a?.length)){
     captured.bybitDelta={topic:msg.topic,type:msg.type,data:{...msg.data,b:msg.data.b.slice(0,12),a:msg.data.a.slice(0,12)}}
    }
   }else if(msg.e==='depthUpdate'&&msg.s==='BTCUSDT'&&!captured.binance){
    captured.binance={...msg,b:msg.b?.slice(0,20),a:msg.a?.slice(0,20)}
   }
  }catch{}
 });
 try{
  await page.goto('https://pedroluis921115-eng.github.io/btc-intelligence-v1/',{waitUntil:'domcontentloaded',timeout:14000});
  while(Date.now()<deadline&&Object.keys(captured).length<4)await new Promise(r=>setTimeout(r,550));
 }finally{await browser.close()}
 const fixture={kind:'BTCUSDT public WebSocket sampled messages; shortened L2 arrays for lightweight replay',capturedAt:Date.now(),...captured};
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(fixture,null,2));
 console.log('CAPTURED',JSON.stringify(Object.fromEntries(Object.entries(captured).map(([k,v])=>[k,{topic:v.topic||v.e,rows:v.data?.length||v.data?.b?.length||v.b?.length}]))),'PATH',out);
 if(!captured.trade||!captured.bybitSnapshot||!captured.bybitDelta||!captured.binance)process.exitCode=4;
})().catch(e=>{console.error(e.stack);process.exitCode=5});
