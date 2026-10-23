/* Customer quote requests reuse the existing /quote-lead contract. No payment is recorded. */
(function(root){
 'use strict';
 const D=root.WEPQuoteDocument||require('./quote-document.js'),clean=v=>String(v??'').trim();
 const fields=['firstName','lastName','companyName','email','phone','cell','address1','address2','city','state','zip','notes'];
 function required(fulfillment){return ['firstName','lastName',...(['DELIVERY','SHIP'].includes(fulfillment)?['address1','city','state','zip']:[])];}
 function addressKey(c){return JSON.stringify(['address1','address2','city','state','zip'].map(k=>clean(c?.[k]).toUpperCase()));}
 function validate(c,q){
  for(const key of required(q.fulfillment))if(!clean(c[key]))return {field:key,message:'Complete the required customer details.'};
  if(clean(c.email)&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))return {field:'email',message:'Enter a valid email address.'};
  if(!clean(c.phone)&&!clean(c.cell))return {field:'phone',message:'Enter a Phone / Cell or Business Phone number.'};
  const digits=clean(c.phone).replace(/\D/g,'');if(clean(c.phone)&&digits.length!==10&&!(digits.length===11&&digits[0]==='1'))return {field:'phone',message:'Enter a valid phone number.'};
  if(clean(c.cell)){const cellDigits=clean(c.cell).replace(/\D/g,'');if(cellDigits.length!==10&&!(cellDigits.length===11&&cellDigits[0]==='1'))return {field:'cell',message:'Enter a valid business phone number.'};}
  if(c.state&&!/^[A-Za-z]{2}$/.test(c.state))return {field:'state',message:'Enter a two-letter state.'};
  if(c.zip&&!/^\d{5}(-\d{4})?$/.test(c.zip))return {field:'zip',message:'Enter a valid ZIP code.'};
  if(['SHIP','DELIVERY'].includes(q.fulfillment)&&!/^\d{5}$/.test(c.zip))return {field:'zip',message:'Enter a five-digit ZIP code for delivery or shipping.'};
  if(q.fulfillment==='DELIVERY'&&clean(c.zip)!==clean(q.zip))return {field:'zip',message:'Wait for delivery and tax to update for this ZIP code.'};
  if(q.fulfillment==='SHIP'&&addressKey(c)!==addressKey(q.shippingDetails?.destination))return {field:'address1',message:'Wait for shipping and tax to update for this address.'};
  return null;
 }
 function identity(s,c){const {createdAt,reference,...snapshot}=D.snapshot(s.quote,c);if(!snapshot.customer.cell)delete snapshot.customer.cell;return JSON.stringify([s.selection,snapshot]);}
 function payload(s,c,reference){
  const q=s.quote,snapshot=D.snapshot(q,c,reference),money=n=>n===null?'Needs confirmation':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const name=[c.firstName,c.lastName].filter(Boolean).join(' '),street=[c.address1,c.address2].filter(Boolean).join(', '),cityStateZip=[c.city,c.state,c.zip].filter(Boolean).join(', ');
  const details={displayName:c.companyName||name,contactName:name,business:c.companyName,street,cityStateZip,phone:clean(c.phone)||clean(c.cell),altPhone:clean(c.phone)?clean(c.cell):'',email:c.email};
  const ship=q.fulfillment==='SHIP'?q.shippingDetails.destination:c;
  const shipping=q.fulfillment==='SHIP'?q.shipping??0:0;
  const notes=[c.notes,'CUSTOMER QUOTE REQUEST - please confirm pricing and availability. No payment collected and no inventory reserved.',D.text(snapshot)].filter(Boolean).join('\n\n');
  return {
   quoteNumber:reference,configurator:s.selection.brandId,source:'Marketplace Builder',action:'Customer Quote Request',
   customer:name,business:c.companyName,phone:clean(c.phone)||clean(c.cell),altPhone:clean(c.phone)?clean(c.cell):'',email:c.email,address:[street,cityStateZip].filter(Boolean).join('\n'),customerDetails:details,
   delivery:D.fulfillmentLabel(snapshot),deliveryDetails:{...details,street:[ship.address1,ship.address2].filter(Boolean).join(', '),cityStateZip:[ship.city,ship.state,ship.zip].filter(Boolean).join(', ')},
   payment:D.paymentLabel(snapshot),paymentProgram:snapshot.plans.map(p=>p.name+' - '+p.apr+'% APR / '+p.termMonths+' months').join('; '),
   // Payment preferences are estimates, never payments received or deposits.
   paymentDetails:{cash:q.paymentMethod==='cash'?q.total:0,credit:q.paymentMethod==='credit'?q.total:0,financed:q.paymentMethod==='finance'?snapshot.plans.reduce((sum,p)=>sum+(p.principalWithFees||0),0):0,plannedDownPayment:snapshot.plans.reduce((sum,p)=>sum+(p.requiredDown||0),0),program:snapshot.plans.map(p=>p.name).join('; ')},
   selectedTool:q.lines.find(l=>l.type==='tool')?.productName||q.lines[0].productName,
   items:snapshot.lines.map(l=>({qty:l.quantity,sku:l.sku,name:l.productName,price:money(l.unitPrice),lineTotal:money(l.itemTotal)})),
   lines:snapshot.lines.map(l=>({qty:l.quantity,sku:l.sku,name:l.productName,price:l.unitPrice,originalLineTotal:Math.round(l.regularUnitPrice*l.quantity*100)/100,finalLineTotal:l.itemTotal,lineTotal:l.itemTotal,setupTotal:l.setupTotal})),
   totals:{equipment:snapshot.totals.merchandise,setupInstallation:q.installation,freight:{total:q.freight,factoryAmount:0,specialOrderAmount:q.freight,label:'Special order / factory freight'},delivery:q.delivery===null||shipping===null?null:q.delivery+shipping,shipping,subtotal:q.subtotal,salesTax:q.tax,total:q.total},
   subtotal:money(q.subtotal),tax:money(q.tax),total:money(q.total),notes,marketplaceQuote:snapshot,selection:s.selection,requestOnly:true
  };
 }
 root.WEPQuoteRequest={fields,required,addressKey,validate,identity,payload};if(typeof module!=='undefined'&&module.exports)module.exports=root.WEPQuoteRequest;
})(typeof window==='undefined'?globalThis:window);
