/* BTC Intelligence V6.1 · Shared, short-lived cache for public Bybit REST market reads.
   Coalesces concurrent equal queries and uses larger page responses for smaller requests.
   NEVER caches order execution, private endpoints, websockets or trading data. */
(function(root){
'use strict';
function create(fetcher=(...args)=>fetch(...args),clock=()=>Date.now()){
 const cache=new Map(),stats={network:0,reused:0,errors:0};
 const TTL=15000,MAX=40;
 function info(url){
  if(typeof url!=='string'||!url.startsWith('https://api.bybit.com/v5/market/'))
   return {key:url,limit:0,compatible:false};
  const u=new URL(url),limit=Number(u.searchParams.get('limit'));
  if(!Number.isInteger(limit)||limit<1||limit>1000)return {key:url,limit:0,compatible:false};
  u.searchParams.delete('limit');
  u.searchParams.sort();
  return {key:u.toString(),limit,compatible:true};
 }
 async function get(url){
  const source=info(url),now=clock();
  for(const [key,entry] of cache){
   if(now-entry.at>TTL)cache.delete(key);
  }
  let entry=cache.get(source.key);
  if(entry&&now-entry.at<=TTL&&(!source.compatible||entry.limit>=source.limit)){
   stats.reused++;
  }else{
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
   const promise=(async()=>{
    stats.network++;
    const response=await fetcher(url,{cache:'no-store',signal:ctl.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
   })().finally(()=>clearTimeout(timer));
   entry={at:now,limit:source.limit,promise};
   cache.set(source.key,entry);
   // Ensure a rejected in-flight request doesn't poison the cache.
   promise.catch(()=>{stats.errors++;if(cache.get(source.key)===entry)cache.delete(source.key)});
   if(cache.size>MAX)cache.delete(cache.keys().next().value);
  }
  const payload=await entry.promise;
  if(source.compatible&&entry.limit>source.limit&&Array.isArray(payload?.result?.list)){
   return {...payload,result:{...payload.result,list:payload.result.list.slice(0,source.limit)}};
  }
  return payload;
 }
 return {get,stats,info};
}
if(typeof module==='object'&&module.exports)module.exports={create};
if(root?.document)root.BTCMarketCache=create(root.fetch.bind(root));
})(typeof window==='undefined'?null:window);
