/* Manufacturer demo bridge: no dealer credentials or costs are stored here. */
(function(){
 'use strict';
 if(new URLSearchParams(location.search).get('wepDemo')!=='yanmar')return;
 const apiOrigin='https://westendpower-configurator-api.westendpower-nm.workers.dev',realFetch=window.fetch.bind(window),realSession=window.sessionStorage;
 const storage=prefix=>({getItem:k=>realSession.getItem(prefix+k),setItem:(k,v)=>realSession.setItem(prefix+k,String(v)),removeItem:k=>realSession.removeItem(prefix+k),clear:()=>{for(let i=realSession.length-1;i>=0;i--){const k=realSession.key(i);if(k.startsWith(prefix))realSession.removeItem(k);}},key:i=>Object.keys(realSession).filter(k=>k.startsWith(prefix))[i]?.slice(prefix.length)||null,get length(){return Object.keys(realSession).filter(k=>k.startsWith(prefix)).length;}});
 Object.defineProperty(window,'localStorage',{value:storage('wepYanmarDemo:local:')});
 Object.defineProperty(window,'sessionStorage',{value:storage('wepYanmarDemo:session:')});
 const pending=new Map();
 window.addEventListener('message',event=>{if(event.origin!==apiOrigin||event.source!==parent||event.data?.type!=='wep:yanmar-demo-result')return;const job=pending.get(event.data.id);if(!job)return;pending.delete(event.data.id);clearTimeout(job.timer);job.resolve(event.data);});
 function send(action,body,id=crypto.randomUUID()){return new Promise((resolve,reject)=>{if(parent===window){reject(Error('Open this demonstration from the Yanmar demo sign-in page.'));return;}const timer=setTimeout(()=>{pending.delete(id);reject(Error('Demo session unavailable. Return to the demo home page and sign in again.'));},35000);pending.set(id,{resolve,timer});parent.postMessage({type:'wep:yanmar-demo',id,action,body},apiOrigin);});}
 const customer=()=>{const form=document.getElementById('wep-inline-form');return Object.fromEntries(['firstName','lastName','companyName','phone','cell','email','address1','address2','city','state','zip'].map(k=>[k,String(form?.elements.namedItem(k)?.value||'').trim()]));};
 const current=()=>{const s=window.WEPBuilderCheckout?.current();if(!s?.paymentConfirmed||!s.quote)throw Error('Choose a payment option and wait for the quote to finish updating.');return s;};
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
  if(url.origin===apiOrigin&&['/quote-lead','/marketplace-order','/online-order'].includes(url.pathname)){
   if(options.signal?.aborted)throw new DOMException('Changed','AbortError');
   try{const data=JSON.parse(options.body||'{}'),s=current(),checkout=url.pathname!=='/quote-lead';const reply=await send(checkout?'checkout':'quote',checkout?data:{selection:s.selection,customer:customer(),requestKey:data.quoteNumber});return new Response(JSON.stringify(reply.result),{status:reply.status,headers:{'Content-Type':'application/json'}});}catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{'Content-Type':'application/json'}});}
  }
  return realFetch(input,options);
 };
 window.WEPManufacturerDemo={active:true};
 window.addEventListener('message',async event=>{
  if(event.origin!==apiOrigin||event.source!==parent||event.data?.type!=='wep:yanmar-demo-command'||event.data.action!=='view-quote'||typeof event.data.id!=='string'||event.data.id.length>80)return;
  try{const s=current();await send('quote',{selection:s.selection,customer:customer()},event.data.id);}
  catch(error){parent.postMessage({type:'wep:yanmar-demo-command-error',id:event.data.id,error:error.message},apiOrigin);}
 });
 document.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');style.textContent='.wep-dealer-portal-bar{display:none!important}';document.head.append(style);
  send('event',{event:'builder_opened'}).catch(()=>{});
  document.addEventListener('click',event=>{if(event.target.closest('#review-package'))send('event',{event:'quote_reviewed'}).catch(()=>{});});
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;try{const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname.endsWith('/product-options.html')){url.searchParams.set('wepDemo','yanmar');link.href=url.href;}else if(url.protocol==='https:'&&url.hash!==location.hash){link.target='_blank';link.rel='noopener noreferrer';}}catch{}},true);
 });
})();
