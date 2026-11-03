/* A shareable public configuration. Never carries staff sessions, prices or customer details. */
(function(root){
 'use strict';
 const clean=v=>String(v??'').trim(),types=new Set(['tool','attachment','accessory','part','battery','charger']);
 function normalize(raw){
  if(raw?.version!==1||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>20)throw Error('This equipment package needs store confirmation.');
  const seen=new Set(),items=raw.items.map(l=>{const brandId=clean(l.brandId).toUpperCase(),type=clean(l.type||'tool'),sku=clean(l.sku),quantity=Number(l.quantity),id=[brandId,type,sku.toUpperCase()].join(':');if(!/^[A-Z0-9_-]{1,40}$/.test(brandId)||!types.has(type)||!sku||sku.length>160||!Number.isInteger(quantity)||quantity<1||quantity>100||seen.has(id))throw Error('This equipment package needs store confirmation.');seen.add(id);return {brandId,type,sku,quantity,setupSelected:l.setupSelected===true,preferStock:l.preferStock===true,packageId:clean(l.packageId)};});
  const tools=items.filter(l=>l.type==='tool'),parents=new Set(tools.map(l=>l.brandId+':'+l.sku));
  for(const l of items){const own=tools.filter(t=>t.brandId===l.brandId);if(l.type==='tool')l.packageId=l.brandId+':'+l.sku;else if(!parents.has(l.packageId)||!l.packageId.startsWith(l.brandId+':')){if(own.length>1)throw Error('The store needs to confirm which equipment these options belong to.');l.packageId=own.length===1?own[0].brandId+':'+own[0].sku:l.brandId+':'+l.sku;}}
  const fulfillment=['NEW_MILFORD','DANBURY','DELIVERY','SHIP'].includes(raw.fulfillment)?raw.fulfillment:'NEW_MILFORD',zip=fulfillment==='DELIVERY'?clean(raw.zip):'';
  if(fulfillment==='DELIVERY'&&!/^\d{5}$/.test(zip))throw Error('The delivery ZIP needs store confirmation.');
  const financeDownPayments={};for(const [brand,value]of Object.entries(raw.financeDownPayments||{}))if(items.some(l=>l.brandId===brand)&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=10000000)financeDownPayments[brand]=Math.round(value*100)/100;
  return {version:1,items,fulfillment,zip,financeDownPayments,paymentMethod:fulfillment==='SHIP'?'credit':['cash','credit','finance'].includes(raw.paymentMethod)?raw.paymentMethod:'cash',...(['DEALER_SHIP_DAY','SHIP_NOW'].includes(raw.toroFreightMethod)?{toroFreightMethod:raw.toroFreightMethod}:{}),hadSpecialProgram:raw.hadSpecialProgram===true};
 }
 function decode(encoded){if(!/^[A-Za-z0-9_-]{1,24000}$/.test(encoded))throw Error('This customer link is invalid.');return normalize(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));}
 function prepare(raw,storage,session){
  const value=normalize(raw),items=value.items.map(l=>({...l,inventoryId:'',productName:l.sku,...(!l.preferStock?{quoteStockChoice:'orderable'}:{})})),main=items.find(l=>l.type==='tool')||items[0],saved={...value,items,brandId:main.brandId,sku:main.sku,paymentConfirmed:false,financeProgramIds:{},dealerPrograms:{},updated:Date.now()};
  const changes=[{store:storage,key:'wepCart',value:JSON.stringify(items)},{store:session,key:'wepBuildCheckoutChoices',value:JSON.stringify(saved)}];
  for(const tool of items.filter(l=>l.type==='tool'))changes.push({store:session,key:'wepBuildDraft:'+tool.packageId,value:JSON.stringify({...saved,brandId:tool.brandId,sku:tool.sku,items:items.filter(l=>l.packageId===tool.packageId)})});
  for(const c of changes)c.before=c.store.getItem(c.key);
  try{for(const c of changes)c.store.setItem(c.key,c.value);}catch(error){for(const c of changes.reverse())try{c.before===null?c.store.removeItem(c.key):c.store.setItem(c.key,c.before);}catch(_){}throw Error('This package could not open a separate customer build. Please reopen the link or contact the store.');}
  return saved;
 }
 const api={normalize,decode,prepare};if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.location)return;
 const id=new URLSearchParams(root.location.search).get('configuration'),hash=root.location.hash,key=id?'wepCustomerBuild:'+id:'';
 if(!id?.startsWith('customer-'))return;
 let saved;
 try{
  if(hash.startsWith('#customer-build=')){if(!root.WEPBuildSession||!root.WEPBuildStorage)throw Error('This link needs a separate build session. Reopen the customer link.');saved=prepare(decode(hash.slice(16)),root.WEPBuildStorage,root.sessionStorage);root.sessionStorage.setItem(key,JSON.stringify(saved));const url=new URL(root.location.href);url.hash='';root.history.replaceState(null,'',url.href);}
  else{const stored=JSON.parse(root.sessionStorage.getItem(key)||'null');if(!stored)return;saved=normalize(stored);}
  root.WEPCustomerBuild=saved;
  root.document.addEventListener('DOMContentLoaded',()=>{const note=root.document.createElement('aside');note.setAttribute('role','note');note.style.cssText='background:#edf4ea;border-bottom:2px solid #287a32;padding:12px 20px;font:14px/1.5 Arial,sans-serif';note.textContent='Customer Build & Price · Uses current public pricing. Your original quote / order is unchanged. Review current payment options and availability before requesting a new quote.';root.document.body.prepend(note);});
 }catch(error){root.WEPCustomerBuildError=error.message;root.document.addEventListener('DOMContentLoaded',()=>{const note=root.document.createElement('p');note.setAttribute('role','alert');note.textContent=error.message;root.document.body.prepend(note);});}
})(typeof window==='undefined'?null:window);
