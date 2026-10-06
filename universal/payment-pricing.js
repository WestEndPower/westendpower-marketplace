/* Shared Marketplace and payment-options pricing. Dealer prices come from the configurator API. */
(function(root){
'use strict';
const API='https://westendpower-configurator-api.westendpower-nm.workers.dev';
const TAX_RATE=0.0635;
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

  function bestMarketplaceFinanceProgram(programs){
    return (programs||[]).slice().sort((a,b)=>{
      const aa=num(a.APR), ab=num(b.APR);
      return aa-ab ||
        num(b.TermMonths)-num(a.TermMonths) ||
        num(a.MinDownAmount)-num(b.MinDownAmount);
    })[0]||null;
  }


async function post(path,body){
  const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok || data.ok===false || data.error) throw new Error(data.error||'Payment options are temporarily unavailable.');
  return data;
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
async function programs(brandId,sku,inventoryId){
  const selected=await selectInventory(brandId,sku,inventoryId);
  const data=await post('/customer-finance-programs',{brandId,sku,inventoryId:selected});
  return (data.programs||[]).filter(p=>num(p.TermMonths)>0 && clean(p.ProgramID));
}
async function quote(brandId,sku,row,paymentMethod,program,inventoryId){
  const selected=await selectInventory(brandId,sku,inventoryId);
  const pricing=await post('/customer-pricing',{
    brandId,sku,quantity:1,paymentMethod,inventoryId:selected,includeFreightQuote:true,
    ...(program?{financeProgramId:clean(program.ProgramID)}:{}),
    cart:{primarySku:sku,items:[{sku,quantity:1,inventoryId:selected}]}
  });
  if(!Number.isFinite(Number(pricing.customerLinePrice)) || num(pricing.customerLinePrice)<0) throw new Error('Pricing is not available for this product.');
  const sellingPrice=num(pricing.customerLinePrice);
  const freightQuote=pricing.customerFreightQuote;
  if(!freightQuote)throw new Error('The pricing API needs the Freight update before these payment options can load.');
  const freightConfirmed=freightQuote.confirmed===true && Number.isFinite(Number(freightQuote.amount)) && freightQuote.amount!==null;
  const freight=freightConfirmed?Math.max(num(freightQuote.amount),0):0;
  const taxableSubtotal=sellingPrice+freight;
  const salesTax=clean(row.Taxable).toUpperCase()!=='F'?taxableSubtotal*TAX_RATE:0;
  const outTheDoor=taxableSubtotal+salesTax;
  const requiredDown=program?Math.max(programMinimumDown(program,outTheDoor),num(pricing.profitProtectionDown)):0;
  const applicationFee=program?(brandId==='YANMAR'?299:num(program.CustomerOriginationFee||program.ApplicationFee)):0;
  const amountFinanced=program?Math.max(outTheDoor-requiredDown,0)+applicationFee:0;
  let apr=program?num(program.APR):0;
  if(apr>0 && apr<1) apr*=100;
  const termMonths=program?num(program.TermMonths):0;
  return {pricing,sellingPrice,freight,freightConfirmed,freightSource:freightQuote.source,freightMessage:freightQuote.message||'',inventoryId:selected,salesTax,outTheDoor,requiredDown,applicationFee,amountFinanced,
    apr,aprLabel:apr===0?'0%':apr.toFixed(2).replace(/\.00$/,'')+'%',termMonths,
    monthly:program?monthlyPayment(amountFinanced,apr,termMonths):0,
    rebateAmount:num(pricing.customerRebate),rebateCompatible:program?programAllowsRebate(program):true};
}
root.WestEndPayments={inventory,selectInventory,programs,quote,bestMarketplaceFinanceProgram,monthlyPayment,programMinimumDown,programAllowsRebate};
})(typeof window==='undefined'?globalThis:window);
