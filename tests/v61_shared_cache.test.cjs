'use strict';
const assert=require('node:assert/strict');
const {create}=require('../market-cache.js');
let now=1000000,calls=0;
const fetcher=async url=>{
 calls++;
 const limit=Number(new URL(url).searchParams.get('limit')||1);
 return {ok:true,json:async()=>({retCode:0,result:{list:Array.from({length:limit},(_,i)=>['row-'+i])}})};
};
const cache=create(fetcher,()=>now);
(async()=>{
 const stem='https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=5&limit=';
 const [a,b,c]=await Promise.all([cache.get(stem+'85'),cache.get(stem+'40'),cache.get(stem+'7')]);
 assert.equal(calls,1,'one network request for three compatible simultaneous consumers');
 assert.equal(a.result.list.length,85);assert.equal(b.result.list.length,40);assert.equal(c.result.list.length,7);
 assert.equal(cache.stats.reused,2);
 now+=1000;
 assert.equal((await cache.get(stem+'40')).result.list.length,40);
 assert.equal(calls,1,'15-second cache reuse');
 now+=16000;
 await cache.get(stem+'7');
 assert.equal(calls,2,'expired response triggers new network fetch');
 const o='https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=';
 await cache.get(o+'80');await cache.get(o+'10');
 assert.equal(calls,3,'OI uses independent key and slices superset');
 await cache.get('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=15&limit=10');
 assert.equal(calls,4,'different timeframe not silently reused');
 const failing=create(async()=>({ok:false,status:503,json:async()=>({})}),()=>1000000);
 let failed=false;try{await failing.get(o+'48')}catch{failed=true}
 assert.ok(failed,'API error propagated');
 assert.equal(failing.stats.errors,1);
 console.log('V61_SHARED_BYBIT_CACHE_PASS',JSON.stringify({calls,reused:cache.stats.reused}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
