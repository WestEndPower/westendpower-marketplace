/* Shared Marketplace and payment-options pricing. Dealer prices come from the configurator API. */
(function(root){
'use strict';
const API='https://westendpower-configurator-api.westendpower-nm.workers.dev';
const TAX_RATE=0.0635;
// MARKETPLACE_LIVE_PRICING_V2: quantities, inventory precedence and cent-rounded totals.
const cents=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
const clean=v=>String(v==null?'':v).trim();
const truthy=v=>/^(T|TRUE|Y|YES|1)$/i.test(clean(v));
const num=v=>{const n=Number(clean(v).replace(/[$,%]/g,''));return Number.isFinite(n)?n:0;};
  function monthlyPayment(principal,apr,months){
    principal=Number(principal)||0;
    apr=Number(apr)||0;
    months=Number(months)||0;
    if(!principal || !months) return 0;
    if(apr<=0) return principal/months;
    const rate=apr/100/12;
    return principal*rate/(1-Math.pow(1+rate,-months));
  }

  function programAllowsRebate(program){
    const raw=clean(program && program.RebateCompatible);
    return raw==='' || truthy(raw);
  }

  function programMinimumDown(program,total){
    if(!program) return 0;
    const fixed=num(program.MinDownAmount||program.MinimumDownAmount);
    const rawPercent=num(program.MinDownPercent||program.MinimumDownPercent);
    const percent=rawPercent>0 && rawPercent<1 ? rawPercent*100 : rawPercent;
    if(fixed>0) return Math.min(fixed,total);
    if(percent>0) return Math.min(Math.ceil(total*percent/100/10)*10,total);
    return 0;
  }


  function programExpirationLabel(program){
    const raw=clean(program&&program.EndDate);if(!raw)return '';
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const date=match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12):new Date(raw);
    if(!Number.isFinite(date.getTime()))return '';
    return 'Expires '+['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sept.','Oct.','Nov.','Dec.'][date.getMonth()]+' '+date.getDate()+', '+date.getFullYear();
  }

  function bestMarketplaceFinanceProgram(programs){
    return (programs||[]).slice().sort((a,b)=>{
      const aa=num(a.APR), ab=num(b.APR);
      return aa-ab ||
        num(b.TermMonths)-num(a.TermMonths) ||
        num(a.MinDownAmount)-num(b.MinDownAmount);
    })[0]||null;
  }


// PAYMENT_PRICING_REQUEST_PACING_V1
const pricingQueue=[];
let pricingRunning=false;
let lastPricingRequest=-Infinity;
const paymentDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function sendPaymentRequest(path,body){
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(response.status===429&&path==='/customer-pricing'&&attempt===0){
   const retry=response.headers.get('Retry-After');
   const seconds=Number(retry);
   const wait=retry&&Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-Date.now();
   await paymentDelay(Math.max(Number.isFinite(wait)?wait:60000,1000)+1000);
   lastPricingRequest=Date.now();
   continue;
  }
  if(!response.ok || data.ok===false || data.error) throw new Error(data.error||'Payment options are temporarily unavailable.');
  return data;
 }
}
function pricingCancelled(){const error=new Error('Selection changed.');error.name='AbortError';return error;}
function pricingPriority(job){try{return Number(job.options.priority?.())||0;}catch(_){return 0;}}
async function drainPricingQueue(){
 if(pricingRunning)return;
 pricingRunning=true;
 try{
  while(pricingQueue.length){
   // Keep service pacing, but choose the next job after the wait so a new selection can move ahead.
   const wait=1500-(Date.now()-lastPricingRequest);
   if(wait>0)await paymentDelay(wait);
   pricingQueue.sort((a,b)=>pricingPriority(b)-pricingPriority(a));
   const job=pricingQueue.shift();
   try{
    if(job.options.shouldRun&&!job.options.shouldRun())throw pricingCancelled();
    lastPricingRequest=Date.now();
    job.resolve(await sendPaymentRequest('/customer-pricing',job.body));
   }catch(error){job.reject(error);}
  }
 }finally{pricingRunning=false;}
}
async function post(path,body,options={}){
 if(path!=='/customer-pricing')return sendPaymentRequest(path,body);
 return new Promise((resolve,reject)=>{
  pricingQueue.push({body,options,resolve,reject});
  void drainPricingQueue();
 });
}
const inventoryCache=new Map();
async function inventory(brandId,sku){
 if(!inventoryCache.has(brandId)){
  const pending=post('/inventory-availability',{brandId}).then(data=>data.availability||[]).catch(error=>{inventoryCache.delete(brandId);throw error;});
  inventoryCache.set(brandId,pending);
 }
 const rows=await inventoryCache.get(brandId);
 const wanted=clean(sku).toUpperCase().replace(/[^A-Z0-9]/g,'');
 const item=rows.find(row=>clean(row.sku).toUpperCase().replace(/[^A-Z0-9]/g,'')===wanted);
 return (item&&item.selections||[]).filter(selection=>clean(selection.selectionId)&&!/^INCOMING:/i.test(clean(selection.selectionId))&&Number(selection.quantity)>0);
}
async function selectInventory(brandId,sku,requested){
 const choices=await inventory(brandId,sku);
 if(requested==='')return '';
 if(requested!=null){if(choices.some(x=>clean(x.selectionId)===requested))return requested;throw new Error('The selected in-stock unit is no longer available.');}
 return choices.length?clean(choices[0].selectionId):'';
}
function selectedPackageItems(items,quantity){
  if(!Array.isArray(items)||items.length>20)throw new Error('Invalid package selection.');
  return items.map(item=>{
    const count=Number(item.quantity)*quantity;
    if(!clean(item.sku)||!Number.isInteger(count)||count<1||count>100)throw new Error('The package component quantity must be between 1 and 100.');
    return {sku:clean(item.sku),quantity:count};
  });
}
async function programs(brandId,sku,inventoryId,quantity=1,packageItems=[]){
  quantity=Number(quantity);
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw new Error('Choose a whole-number quantity from 1 to 100.');
  const selected=await selectInventory(brandId,sku,inventoryId);
  const selectionItems=selectedPackageItems(packageItems,quantity);
  const data=await post('/customer-finance-programs',{brandId,sku,inventoryId:selected,quantity,...(selected?{inventorySelectionRequired:true}:{}),...(selectionItems.length?{selectionItems}:{})});
  return (data.programs||[]).filter(p=>num(p.TermMonths)>0 && clean(p.ProgramID));
}
async function quote(brandId,sku,row,paymentMethod,program,inventoryId,quantity=1,requestOptions={}){
  quantity=Number(quantity);
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw new Error('Choose a whole-number quantity from 1 to 100.');
  const selected=await selectInventory(brandId,sku,inventoryId);
  const selectionItems=selectedPackageItems(row.__packageItems||[],quantity);
  const pricing=await post('/customer-pricing',{
    brandId,sku,quantity,paymentMethod,inventoryId:selected,includeFreightQuote:true,
    ...(selected?{inventorySelectionRequired:true}:{}),
    ...(selectionItems.length?{selectionItems}:{}),
    ...(program?{financeProgramId:clean(program.ProgramID)}:{}),
    cart:{primarySku:sku,items:[{sku,quantity,inventoryId:selected},...selectionItems]}
  },requestOptions);
  if(!Number.isFinite(Number(pricing.customerLinePrice)) || num(pricing.customerLinePrice)<0) throw new Error('Pricing is not available for this product.');
  if(selectionItems.length&&!pricing.customerPackageQuote)throw new Error('Package pricing is unavailable. Please retry after the pricing service is updated.');
  const sellingPrice=selectionItems.length?num(pricing.customerPackageQuote.merchandiseAmount):num(pricing.customerLinePrice);
  const freightQuote=pricing.customerFreightQuote;
  if(!freightQuote)throw new Error('The pricing API needs the Freight update before these payment options can load.');
  const freightConfirmed=freightQuote.confirmed===true && Number.isFinite(Number(freightQuote.amount)) && freightQuote.amount!==null;
  const freight=freightConfirmed?Math.max(num(freightQuote.amount),0):0;
  const taxableSubtotal=cents(sellingPrice+freight);
  const salesTax=selectionItems.length?cents((num(pricing.customerPackageQuote.taxableMerchandiseAmount)+freight)*TAX_RATE):(!/^(F|FALSE|N|NO|0)$/i.test(clean(row.Taxable))?cents(taxableSubtotal*TAX_RATE):0);
  const outTheDoor=cents(taxableSubtotal+salesTax);
  const requiredDown=program?Math.max(programMinimumDown(program,outTheDoor),num(pricing.profitProtectionDown)):0;
  const applicationFee=program?(brandId==='YANMAR'?299:num(program.CustomerOriginationFee||program.ApplicationFee||program.UCCFilingFee)):0;
  const amountFinanced=program?cents(Math.max(outTheDoor-requiredDown,0)+applicationFee):0;
  // The pricing API already returns APR in percentage points (0.99 means 0.99%).
  const apr=program?num(program.APR):0;
  const termMonths=program?num(program.TermMonths):0;
  return {quantity,pricing,sellingPrice,freight,freightConfirmed,freightSource:freightQuote.source,freightMessage:freightQuote.message||'',inventoryId:selected,salesTax,outTheDoor,requiredDown,applicationFee,amountFinanced,
    expirationLabel:programExpirationLabel(program),apr,aprLabel:apr.toFixed(2)+'%',termMonths,
    monthly:program?monthlyPayment(amountFinanced,apr,termMonths):0,
    rebateAmount:cents(selectionItems.length?num(pricing.customerPackageQuote.rebateAmount):num(pricing.customerRebate)),rebateCompatible:program?programAllowsRebate(program):true};
}

// Shared payment links retain the shopping page, including dynamically rendered price tags.
if(root.document?.addEventListener)root.document.addEventListener('click',event=>{
 const link=event.target?.closest?.('a[href]');if(!link)return;
 try{
  const url=new URL(link.href,root.location?.href);
  if(!/\/payment-options(?:\.html)?\/?$/i.test(url.pathname))return;
  link.target='_blank';
  const rel=new Set((link.getAttribute('rel')||'').split(/\s+/).filter(Boolean));
  rel.add('noopener');rel.add('noreferrer');link.setAttribute('rel',[...rel].join(' '));
 }catch(_){}
},true);

root.WestEndPayments={programExpirationLabel,inventory,selectInventory,programs,quote,bestMarketplaceFinanceProgram,monthlyPayment,programMinimumDown,programAllowsRebate};
})(typeof window==='undefined'?globalThis:window);
