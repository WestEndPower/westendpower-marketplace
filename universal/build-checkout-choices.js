/* WEP_BUILD_CHOICES_V1 - carry choices only; checkout rechecks current pricing. */
(function(){
 'use strict';
 const form=document.getElementById('choices');if(!form)return;
 let saved;try{saved=JSON.parse(sessionStorage.getItem('wepBuildCheckoutChoices')||'null');}catch(_){return;}
 if(!saved||saved.paymentConfirmed!==true||Date.now()-saved.updated>1800000)return;
 const key=rows=>JSON.stringify(rows.map(x=>[String(x.brandId).toUpperCase(),x.type,x.sku,Number(x.quantity),x.setupSelected===true,String(x.inventoryId||'')]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 try{const cart=JSON.parse(localStorage.getItem('wepCart')||'[]'),group=cart.filter(x=>String(x.brandId).toUpperCase()===saved.brandId&&x.packageId===saved.brandId+':'+saved.sku);if(key(group)!==key(saved.items))return;let changed=false;for(const row of group){if(!row.inventoryId&&row.quoteStockChoice!=='orderable'){row.quoteStockChoice='orderable';changed=true;}}if(changed)localStorage.setItem('wepCart',JSON.stringify(cart));}catch(_){return;}
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
  if(complete){observer?.disconnect();clearTimeout(timer);}
 }
 observer=new MutationObserver(apply);observer.observe(form,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});timer=setTimeout(()=>observer.disconnect(),30000);apply();
})();
