/* Open an independent, price-free estimate from an expired shared quote. */
(function(root){
 'use strict';
 const clean=v=>String(v??'').trim(),types=new Set(['tool','attachment','accessory','part','battery','charger']);
 function normalize(raw){
  if(raw?.version!==1||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>20)throw Error('The quote configuration is incomplete. Please request an updated quote from the store.');
  const seen=new Set(),items=raw.items.map(l=>{const brandId=clean(l.brandId).toUpperCase(),type=clean(l.type||'tool'),sku=clean(l.sku),quantity=Number(l.quantity),id=[brandId,type,sku.toUpperCase()].join(':');if(!/^[A-Z0-9_-]{1,40}$/.test(brandId)||!types.has(type)||!sku||sku.length>160||!Number.isInteger(quantity)||quantity<1||quantity>100||seen.has(id))throw Error('An item needs store confirmation. Please request an updated quote.');seen.add(id);return {brandId,type,sku,quantity,setupSelected:l.setupSelected===true,preferStock:l.preferStock===true};});
  const fulfillment=['NEW_MILFORD','DANBURY','DELIVERY','SHIP'].includes(raw.fulfillment)?raw.fulfillment:'NEW_MILFORD',zip=fulfillment==='DELIVERY'?clean(raw.zip):'';
  if(fulfillment==='DELIVERY'&&!/^\d{5}$/.test(zip))throw Error('The delivery ZIP needs store confirmation.');
  const financeDownPayments={};for(const [brand,value]of Object.entries(raw.financeDownPayments||{}))if(items.some(l=>l.brandId===brand)&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=10000000)financeDownPayments[brand]=Math.round(value*100)/100;
  return {version:1,items,fulfillment,zip,financeDownPayments,...(['DEALER_SHIP_DAY','SHIP_NOW'].includes(raw.toroFreightMethod)?{toroFreightMethod:raw.toroFreightMethod}:{}),hadSpecialProgram:raw.hadSpecialProgram===true};
 }
 function decode(encoded){if(!/^[A-Za-z0-9_-]{1,24000}$/.test(encoded))throw Error('This quote refresh link is invalid.');return normalize(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));}
 function prepare(data,storage,session){
  const value=normalize(data),main=value.items.find(l=>l.type==='tool')||value.items[0],packageId=main.brandId+':'+main.sku;
  const items=value.items.map(l=>({...l,inventoryId:'',packageId,productName:l.sku,...(!l.preferStock?{quoteStockChoice:'orderable'}:{})}));
  const saved={...value,items,brandId:main.brandId,sku:main.sku,paymentMethod:value.fulfillment==='SHIP'?'credit':'cash',paymentConfirmed:true,review:true,financeProgramIds:{},dealerPrograms:{},updated:Date.now()};
  const before=storage.getItem('wepCart'),oldChoices=session.getItem('wepBuildCheckoutChoices');
  try{storage.setItem('wepCart',JSON.stringify(items));session.setItem('wepBuildCheckoutChoices',JSON.stringify(saved));}
  catch(error){try{before===null?storage.removeItem('wepCart'):storage.setItem('wepCart',before);oldChoices===null?session.removeItem('wepBuildCheckoutChoices'):session.setItem('wepBuildCheckoutChoices',oldChoices);}catch(_){}throw Error('This quote could not start a separate estimate. Please reopen the link or contact the store.');}
  return saved;
 }
 const api={normalize,decode,prepare};if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.location)return;
 const hash=root.location.hash,id=new URLSearchParams(root.location.search).get('configuration'),contextKey=id?'wepQuoteRefresh:'+id:'';
 if(!hash.startsWith('#quote-refresh=')){if(id?.startsWith('refresh-')){try{const saved=JSON.parse(root.sessionStorage.getItem(contextKey)||'null');if(saved)root.WEPQuoteRefresh=normalize(saved);}catch(_){}}return;}
 try{
  if(!root.WEPBuildSession||!root.WEPBuildStorage)throw Error('This link needs a separate quote session. Please reopen it from your shared quote.');
  const saved=prepare(decode(hash.slice(15)),root.WEPBuildStorage,root.sessionStorage);root.sessionStorage.setItem(contextKey,JSON.stringify(saved));root.WEPQuoteRefresh=saved;
  const url=new URL(root.location.href);url.hash='';root.history.replaceState(null,'',url.href);
 }catch(error){
  root.WEPQuoteRefreshError=error.message;
  root.document.addEventListener('DOMContentLoaded',()=>{root.document.querySelector('main').replaceChildren();const note=root.document.createElement('p');note.textContent=error.message;root.document.querySelector('main').append(note);});
 }
})(typeof window==='undefined'?null:window);
