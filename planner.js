/* BTC Intelligence V3 - calculos manuales locales. Sin ordenes ni credenciales. */
(function(root){
'use strict';
const number=x=>(x===null||x===undefined||String(x).trim()==='')?NaN:Number(x);
function planTrade(input){
 const side=input.side==='SHORT'?'SHORT':input.side==='LONG'?'LONG':null;
 const entry=number(input.entry),stop=number(input.stop),target=number(input.target);
 const capital=number(input.capital),riskPercent=number(input.riskPercent);
 const feeBps=number(input.feeBps),slippageBps=number(input.slippageBps),leverage=number(input.leverage);
 if(!side||![entry,stop,target,capital,riskPercent,feeBps,slippageBps,leverage].every(Number.isFinite))
  return {ok:false,reason:'Completa los campos con números válidos.'};
 if(Math.min(entry,stop,target,capital)<=0||riskPercent<=0||riskPercent>10||feeBps<0||feeBps>100||slippageBps<0||slippageBps>100||![1,5,10].includes(leverage))
  return {ok:false,reason:'Revisa precios positivos, riesgo entre 0 y 10%, costes 0-100 pb por lado y apalancamiento 1x/5x/10x.'};
 const dir=side==='LONG'?1:-1;
 if((entry-stop)*dir<=0)return {ok:false,reason:'El stop debe quedar debajo de entrada en LONG y encima en SHORT.'};
 if((target-entry)*dir<=0)return {ok:false,reason:'El objetivo debe quedar por encima de entrada en LONG y debajo en SHORT.'};
 const friction=(feeBps+slippageBps)/10000;
 const unitRisk=Math.abs(entry-stop)+(entry+stop)*friction;
 const budget=capital*riskPercent/100;
 const riskQuantity=budget/unitRisk,marginQuantity=capital*leverage/entry;
 const quantity=Math.min(riskQuantity,marginQuantity);
 if(!Number.isFinite(quantity)||quantity<=0)return {ok:false,reason:'No se pudo determinar un tamaño de posición.'};
 const risk=quantity*unitRisk;
 const profit=quantity*(Math.abs(target-entry)-(entry+target)*friction);
 const gross=quantity*Math.abs(target-entry);
 const margin=quantity*entry/leverage;
 return {ok:true,side,entry,stop,target,capital,riskPercent,feeBps,slippageBps,leverage,
  dir,friction,quantity,notional:quantity*entry,margin,risk,budget,gross,profit,
  rr:profit/risk,riskLimitedByMargin:marginQuantity<riskQuantity,
  profitabilityWarning:profit<=0||profit/risk<1,
  assumptions:'Contrato lineal BTCUSDT liquidado en USDT, sin funding ni liquidación forzada; spread/deslizamiento aproximados.'};
}
function simulatePartial(plan,input){
 if(!plan||!plan.ok)return {ok:false,reason:'Primero prepara un plan válido.'};
 const close=number(input.close),fractionPercent=number(input.fractionPercent),newStop=number(input.newStop);
 if(![close,fractionPercent,newStop].every(Number.isFinite)||close<=0||newStop<=0||fractionPercent<=0||fractionPercent>100)
  return {ok:false,reason:'Introduce cierre, nuevo stop y porcentaje parcial entre 0 y 100.'};
 if((close-newStop)*plan.dir<=0)
  return {ok:false,reason:'El nuevo stop ya estaría cruzado respecto al precio del cierre parcial.'};
 const part=plan.quantity*fractionPercent/100,remain=plan.quantity-part;
 const realized=part*((close-plan.entry)*plan.dir-(plan.entry+close)*plan.friction);
 const remainderAtStop=remain*((newStop-plan.entry)*plan.dir-(plan.entry+newStop)*plan.friction);
 return {ok:true,partialQuantity:part,remainingQuantity:remain,realized,
  remainingIfStop:remainderAtStop,combinedIfStop:realized+remainderAtStop};
}
function init(){
 const el=id=>document.getElementById(id),f=id=>el(id)?.value;
 if(!el('manualRiskCalculate'))return;
 let current=null;
 const output=el('manualRiskResult'),management=el('manualPartialResult');
 const money=n=>'US$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const qty=n=>n.toLocaleString('en-US',{maximumFractionDigits:6});
 const result=(el,text)=>{el.textContent=text;el.setAttribute('aria-live','polite')};
 const invalidate=()=>{if(current?.ok){current=null;result(output,'Cambiaste un dato del plan: vuelve a calcular antes de usar estos importes.');result(management,'Plan anterior invalidado; calcula de nuevo.')}};
 for(const id of ['manualSide','manualCapital','manualRiskPercent','manualLeverage','manualEntry','manualStop','manualTarget','manualFeeBps','manualSlippageBps']){
  const field=el(id);if(field){field.addEventListener('input',invalidate);field.addEventListener('change',invalidate)}
 }
 el('manualUsePrice').addEventListener('click',()=>{
  const fresh=(typeof state!=='undefined')&&state.price>0&&state.lastPriceAt>0&&Date.now()-state.lastPriceAt<20000;
  if(!fresh){result(output,'No hay precio Bybit vigente; introduce la entrada manualmente.');return}
  el('manualEntry').value=state.price.toFixed(2);
  invalidate();
  result(output,'Entrada tomada del último precio Bybit vigente. Define stop y objetivo manualmente.');
 });
 el('manualRiskCalculate').addEventListener('click',()=>{
  current=planTrade({side:f('manualSide'),entry:f('manualEntry'),stop:f('manualStop'),
    target:f('manualTarget'),capital:f('manualCapital'),riskPercent:f('manualRiskPercent'),
    feeBps:f('manualFeeBps'),slippageBps:f('manualSlippageBps'),leverage:f('manualLeverage')});
  if(!current.ok){result(output,current.reason);result(management,'Pendiente de plan válido.');return}
  result(output,
   'Tamaño: '+qty(current.quantity)+' BTC · Exposición: '+money(current.notional)+
   ' · Margen estimado: '+money(current.margin)+
   '\nPérdida al stop con costes: '+money(current.risk)+
   ' (límite: '+money(current.budget)+')'+
   '\nBeneficio neto estimado en objetivo: '+money(current.profit)+
   ' · Beneficio/riesgo NETO: '+current.rr.toFixed(2)+':1'+
   (current.riskLimitedByMargin?'\nTamaño limitado por margen disponible.':'')+
   (current.profitabilityWarning?'\nATENCIÓN: objetivo con beneficio neto escaso o relación <1:1.':'')+
   '\n'+current.assumptions);
  result(management,'Plan preparado. Introduce el precio de parcial y el nuevo stop.');
 });
 el('manualPartialCalculate').addEventListener('click',()=>{
  const p=simulatePartial(current,{close:f('manualPartialPrice'),fractionPercent:f('manualPartialPercent'),newStop:f('manualNewStop')});
  if(!p.ok){result(management,p.reason);return}
  result(management,'Cierre parcial: '+qty(p.partialQuantity)+' BTC · Neto parcial: '+money(p.realized)+
   '\nPosición restante: '+qty(p.remainingQuantity)+' BTC'+
   '\nSi el resto saliera al nuevo stop: '+money(p.remainingIfStop)+
   '\nTOTAL hipotético: '+money(p.combinedIfStop)+
   '\nSimulación aritmética, no operación ni recomendación de mover el stop.');
 });
}
if(typeof module==='object'&&module.exports)module.exports={planTrade,simulatePartial};
if(root&&root.document){
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
}
})(typeof window==='undefined'?null:window);
