/* WEP_QUOTE_STOCK_PRICING_V1 — pricing only; never reserves or assigns a unit. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),clean=v=>String(v??'').trim(),key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
 const ORDERABLE='__orderable__'; // A real choice must pass native required-select validation.
 const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
 const api=local&&new URLSearchParams(location.search).get('api')==='local'?'http://127.0.0.1:8787':'https://westendpower-configurator-api.westendpower-nm.workers.dev';
 const panel=document.createElement('section');panel.className='panel';panel.id='quote-stock';
 panel.innerHTML='<details id="stock-editor" open><summary>Availability / pricing source · <span id="stock-choice-summary">Checking…</span></summary><h2>Availability for this quote</h2><p class="note">Choose available stock or an orderable unit. Stock is shared between both stores. This selects pricing only; no unit is reserved and no serial number is assigned.</p><div id="quote-stock-lines"></div><p id="quote-stock-status" role="status"></p></details>';
 $('choices').querySelectorAll('.panel')[1].before(panel);
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh Availability';refresh.onclick=()=>void load();panel.querySelector('details').appendChild(refresh);
 let ready=false,generation=0,signature='';
 const rawCart=()=>JSON.parse(localStorage.getItem('wepCart')||'[]');
 const cartSignature=rows=>JSON.stringify(rows.map(x=>[x.brandId,x.type||'tool',x.sku,x.quantity]));
 window.WEPQuoteStock={ready:()=>{try{return ready&&signature===cartSignature(rawCart());}catch(_error){return false;}}};
 function changed(){
  $('choices').dispatchEvent(new Event('change',{bubbles:true}));
 }
 function label(text){const p=document.createElement('p');p.className='note';p.textContent=text;return p;}
 async function load(){
  const current=++generation;ready=false;$('update').disabled=true;$('quote-stock-status').textContent='Checking current inventory…';$('quote-stock-lines').replaceChildren();
  try{
   const rows=rawCart();if(!Array.isArray(rows)||!rows.length)throw Error('Your cart is empty.');
   const snapshot=JSON.stringify(rows),brands=[...new Set(rows.map(x=>clean(x.brandId).toUpperCase()))];
   if(brands.some(x=>!x))throw Error('A cart item needs a brand. Return to the product page and add it again.');
   const byBrand=new Map(await Promise.all(brands.map(async brand=>{
    const response=await fetch(api+'/inventory-availability',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandId:brand})});
    const data=await response.json();if(!response.ok||data.ok!==true||!Array.isArray(data.availability))throw Error('Inventory could not be checked for '+brand+'.');
    return [brand,data.availability];
   })));
   if(current!==generation)return;
   if(snapshot!==JSON.stringify(rawCart())){void load();return;}
   const controls=[];
   rows.forEach((row,index)=>{
    const availability=byBrand.get(clean(row.brandId).toUpperCase());
    const exact=availability.filter(x=>clean(x.sku).toUpperCase()===clean(row.sku).toUpperCase());
    const matches=exact.length?exact:availability.filter(x=>key(x.sku)===key(row.sku));
    if(matches.length>1)throw Error('Inventory SKU matching needs store review for '+clean(row.sku)+'.');
    const item=matches[0],quantity=Number(row.quantity),all=(item?.selections||[]).filter(x=>clean(x.selectionId)&&!/^INCOMING:/i.test(clean(x.selectionId)));
    const choices=all.filter(x=>Number(x.quantity)>=quantity&&(!x.serialized||quantity===1)&&!(x.includedItems||[]).length);
    const selected=choices.find(x=>clean(x.selectionId)===clean(row.inventoryId));
    const preferred=selected||choices[0];
    const wrap=document.createElement('div');wrap.className='quote-stock-row';
    const title=document.createElement('label');title.textContent=clean(row.brandId)+' · '+clean(row.productName||row.sku)+' · Qty '+quantity;
    const select=document.createElement('select');select.dataset.stockLine=String(index);select.required=true;
    if(clean(row.inventoryId)&&!selected){const o=new Option('Previous stock selection is unavailable — choose again','__unavailable__');o.disabled=true;o.selected=true;select.add(o);}
    if(preferred){const o=new Option('In-stock pricing'+(clean(preferred.store)?' · '+clean(preferred.store):''),clean(preferred.selectionId));select.add(o);}
    select.add(new Option('Available to order',ORDERABLE));
    if(!clean(row.inventoryId)){select.value=row.quoteStockChoice==='orderable'?ORDERABLE:(preferred?clean(preferred.selectionId):ORDERABLE);}
    else if(selected)select.value=clean(selected.selectionId);
    title.appendChild(select);wrap.appendChild(title);
    if(!choices.length&&all.some(x=>(x.includedItems||[]).length))wrap.appendChild(label('Configured inventory packages need dealer review. This selection uses orderable pricing.'));
    else if(!choices.length&&Number(item?.quantity)>0)wrap.appendChild(label('Available stock needs review for this quantity. You can quote an orderable unit.'));
    $('quote-stock-lines').appendChild(wrap);controls.push({select,index});
   });
   function persist(){
    const now=rawCart();if(cartSignature(now)!==cartSignature(rows)){void load();return;}
    for(const {select,index} of controls){if(select.value==='__unavailable__'){ready=false;$('stock-editor').open=true;changed();$('update').disabled=true;$('quote-stock-status').textContent='A previous stock selection is unavailable. Choose the pricing source again.';return;}
     now[index].inventoryId=select.value===ORDERABLE?'':select.value;now[index].quoteStockChoice=select.value===ORDERABLE?'orderable':'stock';
    }
    localStorage.setItem('wepCart',JSON.stringify(now));signature=cartSignature(now);ready=true;$('stock-choice-summary').textContent=now.every(x=>x.quoteStockChoice==='orderable')?'Available to order':now.every(x=>x.quoteStockChoice==='stock')?'In-stock pricing':'Mixed stock / orderable pricing';$('stock-editor').open=false;changed();
    $('quote-stock-status').textContent='Availability checked for pricing. Final availability is checked again when you review prices.';
   }
   for(const {select} of controls)select.addEventListener('change',persist);
   persist();
  }catch(error){
   if(current!==generation)return;ready=false;$('stock-editor').open=true;changed();$('update').disabled=true;
   $('quote-stock-status').textContent=error.message+' Retry before reviewing this quote.';
   const retry=document.createElement('button');retry.type='button';retry.textContent='Retry Inventory Check';retry.onclick=load;$('quote-stock-status').append(' ',retry);
  }
 }
 window.addEventListener('storage',e=>{if(e.key==='wepCart')void load();});
 void load();
})();
