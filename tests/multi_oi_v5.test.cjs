'use strict';
const assert=require('node:assert/strict');
const {sources,parseResponse,summary}=require('../multi-oi.js');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',passed,name)}
const now=Date.now(),byId=id=>sources.find(s=>s.id===id);
test('Binance exact BTCUSDT USD-M quantities',()=>{
 const d=parseResponse(byId('binance'),{symbol:'BTCUSDT',openInterest:'92168.616',time:now},now);
 assert.equal(d.ok,true);assert.equal(d.btc,92168.616);
});
test('Bybit exact BTCUSDT linear 5 minute OI',()=>{
 const d=parseResponse(byId('bybit'),{retCode:0,result:{list:[{openInterest:'68907.2',timestamp:String(now-120000)}]}},now);
 assert.equal(d.ok,true);assert.equal(d.btc,68907.2);
});
test('OKX uses oiCcy BTC, not raw number of contracts',()=>{
 const d=parseResponse(byId('okx'),{code:'0',data:[{instId:'BTC-USDT-SWAP',oi:'3107710',oiCcy:'31077.1065',oiUsd:'1980000000',ts:String(now)}]},now);
 assert.equal(d.ok,true);assert.equal(d.btc,31077.1065);
});
test('Unavailable, wrong market and stale data fail closed',()=>{
 assert.equal(parseResponse(byId('binance'),{symbol:'ETHUSDT',openInterest:222,time:now},now).ok,false);
 assert.equal(parseResponse(byId('bybit'),{retCode:0,result:{list:[{openInterest:'0',timestamp:String(now)}]}},now).ok,false);
 assert.equal(parseResponse(byId('okx'),{code:'0',data:[{instId:'BTC-USDT-SWAP',oiCcy:'100',ts:String(now-1000000)}]},now).ok,false);
});
test('Aggregation only when three sources fresh',()=>{
 let m=new Map([['binance',{ok:true,btc:100,receivedAt:now}],['bybit',{ok:true,btc:20,receivedAt:now}]]);
 assert.equal(summary(m,now).canAggregate,false);
 m.set('okx',{ok:true,btc:30,receivedAt:now});
 assert.equal(summary(m,now).total,150);assert.equal(summary(m,now).canAggregate,true);
 assert.equal(summary(m,now+300000).canAggregate,false);
});
console.log('MULTI_OI_V5_PASS',passed);
