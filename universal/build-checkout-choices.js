/* WEP_BUILD_CHOICES_V1 - carry choices only; checkout rechecks current pricing. */
(function(){
 'use strict';
 const form=document.getElementById('choices');if(!form)return;
 let saved,cart;try{cart=JSON.parse((window.WEPBuildStorage||localStorage).getItem('wepCart')||'[]');saved=JSON.parse(sessionStorage.getItem('wepBuildCheckoutChoices')||'null');}catch(_){return;}
 if(!Array.isArray(cart)||!cart.length)return;
 const key=rows=>JSON.stringify(rows.map(x=>[String(x.brandId).toUpperCase(),x.type,x.sku,Number(x.quantity),x.setupSelected===true,String(x.inventoryId||'')]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const candidates=[saved];
 try{const review=JSON.parse(sessionStorage.getItem('wepCheckoutReviewSelection')||'null');if(review?.cart===(window.WEPBuildStorage||localStorage).getItem('wepCart')&&review.context){const ctx=review.context,main=ctx.items?.find(x=>x.type==='tool');candidates.push({...ctx,review:true,quote:review.quote,paymentConfirmed:true,brandId:main?.brandId,sku:main?.sku,updated:review.updated});}}catch(_){}

 // Existing saved packages also have a product-page draft; use it when the
 // customer reaches checkout from View Cart instead of the Checkout button.
 for(const main of cart.filter(x=>(x.type||'tool')==='tool')){try{
  const brand=String(main.brandId).toUpperCase(),draft=JSON.parse(sessionStorage.getItem('wepBuildDraft:'+brand+':'+main.sku)||'null');
  if(draft)candidates.push({...draft,financeDownPayments:draft.financeDownPayments||{},brandId:brand,sku:main.sku,financeProgramIds:draft.paymentMethod==='finance'?{[brand]:draft.programId}:{}});
 }catch(_){}}
 saved=candidates.filter(x=>x&&x.paymentConfirmed===true&&Number.isFinite(x.updated)&&Date.now()-x.updated<=1800000).sort((a,b)=>b.updated-a.updated).find(x=>{
  try{if(x.review)return key(cart)===key(x.items);const group=cart.filter(row=>String(row.brandId).toUpperCase()===x.brandId&&(row.packageId===x.brandId+':'+x.sku||(!row.packageId&&String(row.equipmentSku||row.sku)===String(x.sku))));return Array.isArray(x.items)&&key(group)===key(x.items);}catch(_){return false;}
 });
 if(!saved)return;
 window.WEPCheckoutSelection=saved;
 document.body.classList.add('checkout-preloaded');
 document.getElementById('fulfillment-editor').open=false;document.getElementById('payment-editor').open=false;
 try{let changed=false;for(const row of cart.filter(x=>String(x.brandId).toUpperCase()===saved.brandId&&x.packageId===saved.brandId+':'+saved.sku)){if(!row.inventoryId&&row.quoteStockChoice!=='orderable'){row.quoteStockChoice='orderable';changed=true;}}if(changed)(window.WEPBuildStorage||localStorage).setItem('wepCart',JSON.stringify(cart));}catch(_){return;}
 function radio(name,value){const input=[...form.querySelectorAll('input')].find(x=>x.name===name&&x.value===value);if(input&&!input.disabled){input.checked=true;return input;}return null;}
 const fulfillment=radio('fulfillment',saved.fulfillment),method=radio('paymentMethod',saved.paymentMethod),zip=document.getElementById('zip');if(zip&&/^\d{5}$/.test(saved.zip))zip.value=saved.zip;
 // The checkout's existing handlers load and verify eligible programs for every cart item.
 (method||fulfillment)?.dispatchEvent(new Event('change',{bubbles:true}));
 let observer,timer;function apply(){
  let complete=true;
  if(saved.fulfillment==='SHIP'){const input=radio('fulfillment','SHIP');if(!input)complete=false;else if(!input.dataset.wepShipRestored){input.dataset.wepShipRestored='true';input.dispatchEvent(new Event('change',{bubbles:true}));}}
  for(const [brand,id] of Object.entries(saved.financeProgramIds||{})){
   const select=[...form.querySelectorAll('[data-finance-brand]')].find(x=>x.dataset.financeBrand===brand);
   if(!select||![...select.options].some(x=>x.value===id)){complete=false;continue;}
   if(select.value!==id){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  if(saved.paymentMethod==='finance'&&[...form.querySelectorAll('[data-finance-brand]')].some(x=>!x.value))complete=false;
  if(complete){observer?.disconnect();clearTimeout(timer);window.dispatchEvent(new Event('wep:checkout-restored'));}
 }
 observer=new MutationObserver(apply);observer.observe(form,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});timer=setTimeout(()=>{observer.disconnect();document.body.classList.remove('checkout-preloaded');document.getElementById('status').textContent='Review your saved choices below. A payment program or shipping option still needs confirmation.';},30000);apply();
})();
