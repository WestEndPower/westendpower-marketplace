/* Customer-visible catalog labels only. All payable amounts come from marketplace-quote. */
(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(/[$,]/g,''));return Number.isFinite(n)&&n>=0?n:null;};
 const money=v=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v):'Needs confirmation';
 const metadata=new Map(),id=l=>[String(l.brandId).toUpperCase(),l.type||'tool',String(l.sku).toUpperCase()].join(':');
 const files={tool:'products',attachment:'attachments',accessory:'accessories',part:'parts',battery:'batteries',charger:'chargers'};
 async function load(){
  let cart;try{cart=JSON.parse(localStorage.getItem('wepCart')||'[]');if(!Array.isArray(cart))return;}catch(_){return;}
  const groups=new Map();for(const l of cart){const root=window.WESTEND_BRANDS?.[String(l.brandId).toUpperCase()]?.dataRoot,file=files[l.type||'tool'];if(root&&file)groups.set(root+file+'.csv',[String(l.brandId).toUpperCase(),l.type||'tool']);}
  await Promise.all([...groups].map(async([path,[brandId,type]])=>{try{const response=await fetch(path);if(!response.ok)return;for(const r of WEPBuildBuy.parseCSV(await response.text())){const sku=r.SKU||r.StihlID||r.BatteryID||r.ChargerID;if(sku)metadata.set(id({brandId,type,sku}),r);}}catch(_){}}));
 }
 function active(r,date){const day=new Date(date).toLocaleDateString('en-CA');for(const [field,start] of [['RebateStartDate',true],['RebateEndDate',false]]){if(!r[field])continue;const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(r[field])?r[field]+'T12:00:00':r[field]);if(!Number.isFinite(d.getTime()))return false;const bound=d.toLocaleDateString('en-CA');if(start?day<bound:day>bound)return false;}return true;}
 function enrich(q){
  for(const l of q.lines){const r=metadata.get(id(l))||{};const values=[number(l.baseUnitPrice),number(r.MSRP),number(l.unitPrice)].filter(v=>v!==null);l.regularUnitPrice=values.length?Math.max(...values):null;
   l.freightNote=(l.type==='attachment'&&['RequiredEngineHPMin','RequiredEngineHPMax','RequiredPTOHPMin','RequiredPTOHPMax'].some(k=>number(r[k])>0))?'Additional freight charges apply. We’ll contact you to confirm the freight charge before finalizing your order.':'';
  }
  q.customerRebateDetails=[];
  for(const l of q.lines){const r=metadata.get(id(l)),amount=number(r?.RebateToCustomer);if(!r||!(amount>0)||!active(r,q.createdAt))continue;
   const plan=q.financePlans?.find(p=>String(p.brandId).toUpperCase()===String(l.brandId).toUpperCase()),compatible=!plan||!/^(F|FALSE|NO|N|0)$/i.test(String(plan.program?.RebateCompatible||''));
   const actual=number(l.customerRebate),base=number(l.baseUnitPrice),discount=number(l.discount)||0,expected=Math.round(amount*l.quantity*100)/100;
   const included=compatible&&((actual!==null&&Math.abs(actual-expected)<.02)||(base!==null&&Math.abs(base*l.quantity-l.itemTotal-discount-expected)<.02));
   q.customerRebateDetails.push({name:String(r.RebateName||'').trim()||String(r.PromoName||'').trim()||'Manufacturer rebate',amount:expected,endDate:r.RebateEndDate||'',status:!compatible?'Not included with this financing program':included?'Included in your price':'Eligibility needs store confirmation'});
  }
  return q;
 }
 function rows(lines,pending=false){return lines.map(l=>'<tr><td><strong>'+esc(l.productName||l.sku)+'</strong><small>'+esc(l.brandId)+' · SKU '+esc(l.sku)+(l.pricingSource?' · '+(l.pricingSource==='stock'?'In-stock pricing':'Available to order'):'')+'</small>'+(l.type==='tool'?'<a class="quote-edit-options" href="product-options.html?'+esc(new URLSearchParams({brand:l.brandId,sku:l.sku,return:location.pathname+location.search,...(new URLSearchParams(location.search).get('api')==='local'?{api:'local'}:{})}).toString())+'">Edit Package</a>':'')+'</td><td>'+esc(l.quantity)+'</td><td>'+(pending?'—':l.setupTotal>0?money(l.setupTotal)+(l.assemblyOption==='F'?'<small>Required</small>':''):number(l.setupUnit)>0?'Not selected<small>'+money(l.setupUnit)+' / item available</small>':'—')+'</td><td>'+ (pending?'—':money(l.regularUnitPrice))+'</td><td>'+(pending?'Updating…':money(l.unitPrice))+'</td><td>'+(pending?'Updating…':money(l.itemTotal))+'</td></tr>'+(l.freightNote?'<tr class="quote-freight-row"><td colspan="6">'+esc(l.freightNote)+'</td></tr>':'')).join('');}
 function rebates(q){document.getElementById('quote-rebates').innerHTML=(q.customerRebateDetails||[]).map(r=>'<div class="quote-rebate"><strong>'+esc(r.name)+' · '+money(r.amount)+'</strong><p>'+esc(r.status)+'</p>'+(r.endDate?'<p>Ends '+esc(r.endDate)+'</p>':'')+'</div>').join('');}
 window.WEPQuoteLayout={ready:load(),enrich,rows,rebates};
})();
