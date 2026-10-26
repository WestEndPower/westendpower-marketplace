/* WEP_MARKETPLACE_CUSTOMER_REVIEW_V1 */
(function(){'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>v===null?'Store confirmation':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const api=local&&new URLSearchParams(location.search).get('api')==='local'?'http://127.0.0.1:8787':'https://westendpower-configurator-api.westendpower-nm.workers.dev';
// WEP_QUOTE_STOCK_REQUEST_V1
const stockPending=()=>!!window.WEPQuoteStock&&!window.WEPQuoteStock.ready();
let quote=null,busy=false,requestNumber=0,customerDetailsOpen=true,activeQuoteController=null;
function cartText(){return localStorage.getItem('wepCart')||'[]';}
// WEP_ALL_BRAND_QUOTE_EVENTS_V1
function readCart(){
 const rows=JSON.parse(cartText());if(!Array.isArray(rows)||!rows.length)throw Error('Your cart is empty. Choose equipment from Marketplace first.');
 return rows.map(x=>{
  const brandId=String(x.brandId||'').trim().toUpperCase(),sku=String(x.sku||'').trim(),type=x.type||'tool',quantity=Number(x.quantity);
  if(!/^[A-Z0-9_-]+$/.test(brandId)||!sku||!['tool','attachment','accessory','part','battery','charger'].includes(type)||!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error('A cart item needs its brand, SKU and valid quantity. Return to the product page and add it again.');
  const inventoryId=String(x.inventoryId||'').trim();
  return {brandId,type,sku,quantity,setupSelected:x.setupSelected===true,inventoryId};
 });
}
function clearQuote(){activeQuoteController?.abort();document.body.classList.add('quote-stale');$('proceed-checkout').disabled=true;$('pay').disabled=true;$('print').disabled=true;$('email').setAttribute('aria-disabled','true');$('finance-summary').replaceChildren();$('quote-rebates').replaceChildren();$('totals').innerHTML='<div><dt>Estimated total</dt><dd>Updating…</dd></div>';window.dispatchEvent(new Event('wep:quote-cleared'));quote=null;if($('payment-panel'))$('payment-panel').hidden=!customerDetailsOpen;requestNumber++;$('review').hidden=false;$('email').removeAttribute('href');}
let financeLoad=0,financeSnapshot='',financeReady=false;
function selectedFulfillment(){return new FormData($('choices')).get('fulfillment');}
function shippingAddress(){const f=new FormData($('choices'));return {address1:String(f.get('shipAddress1')||'').trim(),address2:String(f.get('shipAddress2')||'').trim(),city:String(f.get('shipCity')||'').trim(),state:String(f.get('shipState')||'').trim().toUpperCase(),zip:String(f.get('shipZip')||'').trim()};}
function financeDownPayments(){return window.WEPCheckoutSelection?.financeDownPayments||{};}
function financeProgramIds(){const ids={};document.querySelectorAll('[data-finance-brand]').forEach(select=>{ids[select.dataset.financeBrand]=select.value;});return ids;}
function changes(){
 clearQuote();const delivery=selectedFulfillment()==='DELIVERY',ship=selectedFulfillment()==='SHIP';
 $('zip-field').hidden=!delivery;$('zip').required=delivery;
 $('shipping-address').hidden=!ship;$('shipping-address').disabled=!ship;
 for(const method of ['cash','finance']){const input=$('choices').querySelector('[name="paymentMethod"][value="'+method+'"]');input.disabled=ship;if(ship)input.checked=false;}
 if(ship)$('choices').querySelector('[name="paymentMethod"][value="credit"]').checked=true;
 const finance=new FormData($('choices')).get('paymentMethod')==='finance';$('finance-options').hidden=!finance;for(const select of $('finance-options').querySelectorAll('select'))select.disabled=!finance;
 $('status').textContent=document.body.classList.contains('checkout-preloaded')?'Loading your selected package and checking current pricing…':'Select Review Current Pricing to update your quote.';
 if(finance&&financeSnapshot!==cartText())loadFinanceOptions();
 updateChoiceSummaries();
 $('update').disabled=busy||(finance&&!financeReady)||stockPending();
 if(ship){$('proceed-checkout').disabled=false;syncShippingCustomer();}
}
async function loadFinanceOptions(){
 const number=++financeLoad;financeSnapshot=cartText();financeReady=false;$('update').disabled=true;$('finance-options').textContent='Loading eligible financing programs…';
 try{
  const groups=new Map();for(const line of readCart()){if(!groups.has(line.brandId))groups.set(line.brandId,[]);groups.get(line.brandId).push(line);}
  const choices=await Promise.all([...groups].map(async([brand,lines])=>{
   const tools=lines.filter(l=>l.type==='tool');if(!tools.length)throw Error(brand+' accessories alone require store financing review.');
   const lists=await Promise.all(tools.map(async l=>{const r=await fetch(api+'/customer-finance-programs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandId:brand,sku:l.sku,quantity:l.quantity,inventoryId:l.inventoryId,...(l.inventoryId?{inventorySelectionRequired:true}:{}),selectionItems:lines.filter(x=>x!==l).map(x=>({sku:x.sku,quantity:x.quantity}))})});const v=await r.json();if(!r.ok||v.ok!==true||!Array.isArray(v.programs))throw Error('Unable to load '+brand+' financing. Try again or contact a store.');return v.programs;}));
   const programs=lists[0].filter(p=>lists.every(list=>list.some(x=>x.ProgramID===p.ProgramID)));
   if(!programs.length)throw Error('No eligible financing programs for this '+brand+' equipment. Choose cash / check or credit card.');
   programs.sort((a,b)=>Number(a.APR)-Number(b.APR)||Number(b.TermMonths)-Number(a.TermMonths));
   return '<label class="finance-selector">'+esc(brand)+' financing program<select data-finance-brand="'+esc(brand)+'" required><option value="">Choose a program</option>'+programs.map(p=>'<option value="'+esc(p.ProgramID)+'">'+esc(p.ProgramName||p.ProgramID)+' · '+esc(p.APR)+'% APR · '+esc(p.TermMonths)+' months</option>').join('')+'</select></label>';
  }));
  if(number!==financeLoad||financeSnapshot!==cartText())return;
  $('finance-options').innerHTML=choices.join('');for(const select of $('finance-options').querySelectorAll('select'))select.disabled=new FormData($('choices')).get('paymentMethod')!=='finance';financeReady=true;queueMicrotask(scheduleAutoQuote);
 }catch(error){if(number===financeLoad){financeSnapshot='';$('finance-options').textContent=error.message;window.dispatchEvent(new Event('wep:quote-error'));}}
 finally{if(number===financeLoad)$('update').disabled=busy||(new FormData($('choices')).get('paymentMethod')==='finance'&&!financeReady)||stockPending();}
}
let fulfillmentLoad=0;
async function loadShippingEligibility(){
 const number=++fulfillmentLoad,input=$('choices').querySelector('[name="fulfillment"][value="SHIP"]');input.disabled=true;
 try{const r=await fetch(api+'/marketplace-fulfillment-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:readCart()})}),v=await r.json();if(number!==fulfillmentLoad)return;
  if(!r.ok||v.ok!==true)throw Error('Shipping eligibility is unavailable. Choose pickup or local delivery.');
  input.disabled=!v.shipEligible;$('shipping-eligibility').textContent=v.message;
 }catch(error){if(number===fulfillmentLoad)$('shipping-eligibility').textContent=error.message;}
 if(input.disabled&&input.checked){input.checked=false;changes();}scheduleAutoQuote();
}
$('choices').addEventListener('change',changes);
$('choices').addEventListener('input',e=>{if(e.target.name!=='fulfillment'&&e.target.name!=='paymentMethod')changes();});
window.addEventListener('storage',e=>{if(e.key==='wepCart'){financeLoad++;financeSnapshot='';financeReady=false;loadShippingEligibility();changes();$('status').textContent='Your cart changed. Review current pricing again.';}});
// WEP_QUOTE_EDIT_OPTIONS_V1
function quoteEditLink(line){
 if(line.type!=='tool')return '';
 const params=new URLSearchParams({brand:line.brandId,sku:line.sku,return:location.pathname+location.search});
 if(new URLSearchParams(location.search).get('api')==='local')params.set('api','local');
 return '<a class="quote-edit-options" href="product-options.html?'+esc(params.toString())+'">Edit Equipment &amp; Options</a>';
}
function render(q,preview=false){
 $('lines').innerHTML=window.WEPQuoteLayout.rows(q.lines);window.WEPQuoteLayout.rebates(q);
 const amounts=[['Merchandise',q.merchandise],['Installation / Set-Up',q.installation],['Special order / factory freight',q.freight],['Local delivery',q.delivery],['UPS Ground shipping',q.shipping||0],['Subtotal',q.subtotal],['Estimated sales tax',q.tax],['Estimated total',q.total]];
 $('totals').innerHTML=amounts.filter(([name,value])=>name!=='UPS Ground shipping'||q.fulfillment==='SHIP').map(([name,value],i)=>'<div'+(name==='Estimated total'?' class="total"':'')+'><dt>'+name+(name==='Local delivery'?' <button type="button" class="edit-delivery-total">Edit</button>':'')+'</dt><dd>'+fmt(value)+'</dd></div>').join('');
 const store=q.fulfillment==='SHIP'?'Ship to '+q.shippingDetails.destination.city+', '+q.shippingDetails.destination.state+' '+q.shippingDetails.destination.zip:q.fulfillment==='NEW_MILFORD'?'New Milford':q.fulfillment==='DANBURY'?'Danbury':(q.deliveryDetails?.confirmed?'Delivery to '+q.deliveryDetails.town+', '+q.deliveryDetails.state+' '+q.zip:'Delivery');
 const financeText=(q.financePlans||[]).map(p=>p.brandId+' · '+(p.program.ProgramName||p.program.ProgramID)+' · '+p.program.APR+'% APR / '+p.program.TermMonths+' months | Required down payment '+fmt(p.requiredDown)+' | Amount financed '+fmt(p.amountFinanced)+' | Application fee '+fmt(p.applicationFee||0)+' | Financed amount with fee '+fmt(p.principalWithFees)+' | Estimated monthly payment '+fmt(p.monthlyPayment)+' | '+(String(p.program.RebateCompatible||'').match(/^(F|FALSE|NO|N|0)$/i)?'In lieu of customer rebates':'Compatible customer rebates included')+(Number(p.program.CreditScoreMin)>0?' | Minimum credit score '+p.program.CreditScoreMin:''));
 $('finance-summary').innerHTML=window.WEPQuoteDocument.financeHtml(window.WEPQuoteDocument.snapshot(q).plans);
 $('confirmation').textContent=store+(q.deliveryDetails?.note?' · '+q.deliveryDetails.note:'')+' · '+(q.paymentMethod==='cash'?'Cash / check':q.paymentMethod==='finance'?'Financing':'Credit card')+' pricing. '+q.issues.join(' ');
 $('confirmation').className=q.issues.length?'warning':'';$('dated').textContent='Prepared '+new Date(q.createdAt).toLocaleString();
 const text=['West End Power Equipment — Quote Request',store+' / '+(q.paymentMethod==='cash'?'Cash / check':q.paymentMethod==='finance'?'Financing':'Credit card'),q.zip?'Delivery ZIP: '+q.zip:'',q.fulfillment==='SHIP'?'Ship-to street: '+q.shippingDetails.destination.address1+' '+q.shippingDetails.destination.address2:'','',...(window.WEPKitComponents?.displayLines(q.lines)||q.lines).map(l=>l.brandId+' '+l.productName+' | SKU '+l.sku+' | Qty '+l.quantity+' | Unit '+fmt(l.unitPrice)+' | Item total '+fmt(l.itemTotal)+' | Installation '+(l.setupSelected?fmt(l.setupTotal)+' applied':'not selected')), '',...amounts.map(([n,v])=>n+': '+fmt(v)),...financeText,...q.issues,'','Please confirm availability, compatibility and final pricing.','Customer name:','Phone:'].join('\n');
 $('email').href='mailto:sales@westendpower.com?subject='+encodeURIComponent('Marketplace quote request — '+store)+'&body='+encodeURIComponent(text);
 if(preview){$('status').textContent='Quote carried from your builder · checking current pricing…';return;}
 $('review').hidden=false;document.body.classList.remove('quote-stale');$('print').disabled=false;$('email').removeAttribute('aria-disabled');$('fulfillment-editor').open=false;$('payment-editor').open=false;updateChoiceSummaries();$('status').textContent='Quote ready for store review. No order or payment has been created.';
 window.dispatchEvent(new CustomEvent('wep:quote-ready',{detail:{quote:q,cartSnapshot:cartText()}}));
}
// Share the builder's eight-request window; unchanged server quotes can be reused.
async function quoteSlot(signal){
 for(;;){
  if(signal.aborted)throw new DOMException('Changed','AbortError');
  const now=Date.now();let recent=[];try{const stored=JSON.parse(sessionStorage.getItem('wepBuildQuoteBudget')||'[]');if(Array.isArray(stored))recent=stored.filter(t=>Number.isFinite(t)&&t>now-61000);}catch(_){}
  const wait=recent.length>=8?recent[0]+61000-now:0;
  if(wait>0){await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Changed','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},wait);signal.addEventListener('abort',abort,{once:true});});continue;}
  recent.push(now);try{sessionStorage.setItem('wepBuildQuoteBudget',JSON.stringify(recent));}catch(_){}return;
 }
}
function acceptCarried(q,originalItems){
 if(quote||busy||stockPending()||!q||Date.now()-Date.parse(q.createdAt)>120000)return false;
 const items=readCart(),fingerprint=rows=>JSON.stringify(rows.map(x=>[x.brandId,x.type,x.sku,Number(x.quantity),x.setupSelected===true,String(x.inventoryId||'')]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 if(fingerprint(items)!==fingerprint(originalItems)||q.paymentMethod!==new FormData($('choices')).get('paymentMethod')||q.fulfillment!==selectedFulfillment()||String(q.zip||'')!==String($('zip').value||''))return false;
 if(JSON.stringify(q.financeDownPayments||{})!==JSON.stringify(financeDownPayments()))return false;
 if(items.some(x=>x.inventoryId)&&q.stockPricingVersion!==1)return false;
 if(q.fulfillment==='SHIP'){const address=a=>JSON.stringify(['address1','address2','city','state','zip'].map(k=>String(a?.[k]||'').trim()));if(address(q.shippingDetails?.destination)!==address(shippingAddress()))return false;}
 if(q.paymentMethod==='finance'&&!(q.financePlans||[]).every(p=>financeProgramIds()[p.brandId]===p.program.ProgramID))return false;
 const withoutInventory=rows=>fingerprint(rows.map(x=>({...x,inventoryId:''})));
 if(withoutInventory(items)!==withoutInventory(q.lines||[]))return false;
 WEPQuoteDocument.snapshot(q);WEPQuoteLayout.enrich(q);quote=q;
 autoSignature=JSON.stringify([cartText(),[...new FormData($('choices'))],financeProgramIds(),financeDownPayments()]);
 render(q);showMarketplacePayment(q,cartText());return true;
}
window.WEPCheckout={
 quoteSlot,acceptCarried,
 context:()=>({items:readCart(),financeDownPayments:financeDownPayments(),paymentMethod:new FormData($('choices')).get('paymentMethod'),fulfillment:selectedFulfillment(),zip:$('zip').value||'',financeProgramIds:new FormData($('choices')).get('paymentMethod')==='finance'?financeProgramIds():{},...(selectedFulfillment()==='SHIP'?{shippingAddress:shippingAddress()}:{})}),
 api,
 preview:async q=>{await WEPQuoteLayout.ready;if(quote||!q)return;WEPQuoteDocument.snapshot(q);WEPQuoteLayout.enrich(q);render(q,true);},
 refresh:()=>{autoSignature='';scheduleAutoQuote();}
};
$('choices').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;clearQuote();const number=++requestNumber;let snapshot;
 try{
  if(stockPending())throw Error('Wait for the inventory check, then choose the pricing source.');
  const items=readCart();snapshot=cartText();const values=new FormData($('choices'));
  busy=true;$('update').disabled=true;$('status').textContent='Checking current prices and installation…';
  const controller=new AbortController();activeQuoteController=controller;await quoteSlot(controller.signal);if(number!==requestNumber)return;const timeout=setTimeout(()=>controller.abort(),60000);
  let response;try{response=await fetch(api+'/marketplace-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,financeDownPayments:financeDownPayments(),paymentMethod:values.get('paymentMethod'),fulfillment:values.get('fulfillment'),zip:values.get('zip')||'',financeProgramIds:financeProgramIds(),shippingAddress:selectedFulfillment()==='SHIP'?shippingAddress():undefined}),signal:controller.signal});}finally{clearTimeout(timeout);}
  const q=await response.json().catch(()=>({}));
  if(!response.ok||q.ok!==true)throw Error(q.error||'Current quote pricing is unavailable. Please contact either store.');
  if(q.paymentMethod==='finance'&&Object.values(financeDownPayments()).some(v=>v>0)&&q.downPaymentVersion!==1)throw Error('Down-payment estimates need the updated quote service. Please contact the store.');
  if(number!==requestNumber)return;
  if(snapshot!==cartText())throw Error('Your cart changed. Review current pricing again.');
  if(!Array.isArray(q.lines)||!q.lines.length||!Array.isArray(q.issues))throw Error('Current quote pricing is unavailable. Please try again.');
  if(items.some(l=>l.inventoryId)&&q.stockPricingVersion!==1)throw Error('The pricing service needs the quote stock update before in-stock pricing can be shown.');
  await window.WEPQuoteLayout.ready;if(number!==requestNumber||snapshot!==cartText())return;window.WEPQuoteLayout.enrich(q);quote=q;render(q);showMarketplacePayment(q,snapshot);
 }catch(error){if(number===requestNumber){window.dispatchEvent(new Event('wep:quote-error'));$('status').textContent=error.name==='AbortError'?'Pricing took too long. Please try again.':error.message;$('review').hidden=false;}}
 finally{busy=false;$('update').disabled=(new FormData($('choices')).get('paymentMethod')==='finance'&&!financeReady)||stockPending();}
});
$('print').onclick=()=>{if(quote&&Date.now()-Date.parse(quote.createdAt)<300000)window.print();else{clearQuote();$('status').textContent='Refresh current pricing before printing your quote.';}};
$('email').addEventListener('click',e=>{if(!quote||Date.now()-Date.parse(quote.createdAt)>300000){e.preventDefault();clearQuote();$('status').textContent='Refresh current pricing before requesting your quote.';}});
/* WEP_MARKETPLACE_SECURE_CHECKOUT_V1 */
let paymentBusy=false,paymentCart='',paymentQuote=null;
const testPayment=local||new URLSearchParams(location.search).get('test')==='1';
function showMarketplacePayment(q,snapshot){
 paymentQuote=q;paymentCart=snapshot;
 const supported=q.paymentMethod==='credit'&&['NEW_MILFORD','DANBURY','SHIP'].includes(q.fulfillment)&&q.total!==null&&q.issues.length===0&&!q.lines.some(l=>l.freightNote)&&q.fingerprint&&q.terms?.version;
 $('payment-panel').hidden=!customerDetailsOpen;$('proceed-checkout').disabled=false;$('pay').disabled=false;
 $('proceed-checkout').textContent='Checkout';
 $('selected-payment-description').textContent=(q.paymentMethod==='cash'?'Cash / check':q.paymentMethod==='finance'?'Financing':'Credit card')+' · '+window.WEPQuoteDocument.fulfillmentLabel(window.WEPQuoteDocument.snapshot(q));
 $('checkout-terms').hidden=!supported;$('payment-form').elements.namedItem('termsAccepted').required=supported;
 if(!supported){$('order-terms').textContent='';$('payment-mode').textContent=q.paymentMethod==='finance'?'Your selected financing is included below. Send your details to the store to confirm availability and complete financing.':q.paymentMethod==='cash'?'Send your details to the store to confirm availability and arrange payment by cash / check.':'This package needs store confirmation before payment can be collected.';$('pay').textContent='Email Order Request';$('payment-status').textContent='This opens your email app. Review and send the request; the store will confirm your order.';return;}

 $('order-terms').textContent=q.terms.text;
 $('payment-mode').textContent=testPayment?'STRIPE TEST MODE — no real payment will be collected. Test orders are labelled TEST.':'Review your total above. Card details are entered on Stripe’s secure payment page.';
 $('payment-mode').className=testPayment?'test-banner':'';
 $('pay').textContent=testPayment?'Continue to Stripe Test Payment':'Continue to Secure Payment';
 if(q.fulfillment==='SHIP'){const form=$('payment-form'),a=q.shippingDetails.destination;if(!form.elements.namedItem('address1').value){for(const k of ['address1','address2','city','state','zip'])form.elements.namedItem(k).value=a[k]||'';rememberCheckoutCustomer();}}
 $('payment-status').textContent=q.fulfillment==='SHIP'?'Shipping and billing addresses must match. Stripe verification and fraud checks are required.':'';
}
/* WEP_CUSTOMER_SESSION_V1 */
const customerSessionFields=['firstName','lastName','companyName','email','phone','address1','address2','city','state','zip'];
function rememberCheckoutCustomer(){
 try{
  const customer={},form=$('payment-form');
  for(const key of customerSessionFields){
   const input=form.elements.namedItem(key);
   if(input)customer[key]=String(input.value||'');
  }
  sessionStorage.setItem('wepCheckoutCustomer',JSON.stringify(customer));
 }catch(_error){}
}
function restoreCheckoutCustomer(){
 const form=$('payment-form');
 try{
  let customer=JSON.parse(sessionStorage.getItem('wepCheckoutCustomer')||'null');
  if(!customer){
   const pending=paymentRecord();
   customer=pending?.identity?JSON.parse(pending.identity).customer:null;
  }
  if(customer&&typeof customer==='object'&&!Array.isArray(customer)){
   for(const key of customerSessionFields){
    const input=form.elements.namedItem(key);
    if(input&&typeof customer[key]==='string')input.value=customer[key];
   }
  }
 }catch(_error){}
 const terms=form.elements.namedItem('termsAccepted');
 if(terms)terms.checked=false;
}
restoreCheckoutCustomer();
$('payment-form').elements.namedItem('termsAccepted').required=false;
rememberCheckoutCustomer();
$('payment-form').addEventListener('input',rememberCheckoutCustomer);
$('payment-form').addEventListener('change',rememberCheckoutCustomer);
$('payment-form').addEventListener('submit',rememberCheckoutCustomer);
window.addEventListener('pagehide',rememberCheckoutCustomer);
window.addEventListener('pageshow',restoreCheckoutCustomer);

function paymentRecord(){try{return JSON.parse(sessionStorage.getItem('wepMarketplacePending')||'null');}catch(_error){return null;}}
$('payment-form').addEventListener('submit',async e=>{
 e.preventDefault();if(paymentBusy)return;
 try{
  if(!paymentQuote||!quote||$('payment-panel').hidden)throw Error('Review current pricing first.');
  if(cartText()!==paymentCart||Date.now()-Date.parse(paymentQuote.createdAt)>300000){clearQuote();throw Error('Your cart or pricing changed. Review current pricing again.');}
  const values=new FormData($('payment-form')),customer={};
  for(const key of ['firstName','lastName','companyName','email','phone','address1','address2','city','state','zip'])customer[key]=String(values.get(key)||'').trim();
  const supported=paymentQuote.paymentMethod==='credit'&&['NEW_MILFORD','DANBURY','SHIP'].includes(paymentQuote.fulfillment)&&paymentQuote.total!==null&&paymentQuote.issues.length===0&&!paymentQuote.lines.some(l=>l.freightNote)&&paymentQuote.fingerprint&&paymentQuote.terms?.version;
  if(!supported){
   const snapshot=window.WEPQuoteDocument.snapshot(paymentQuote,customer);
   location.href='mailto:sales@westendpower.com?subject='+encodeURIComponent('Equipment order request')+'&body='+encodeURIComponent(window.WEPQuoteDocument.text(snapshot)+'\n\nPlease contact me to confirm this order.');
   $('payment-status').textContent='Your email app has been opened. Review and send the request. Your order is confirmed only after the store contacts you.';return;
  }
  const body={items:readCart(),customer,fulfillment:paymentQuote.fulfillment,zip:paymentQuote.zip,shippingAddress:paymentQuote.fulfillment==='SHIP'?paymentQuote.shippingDetails.destination:undefined,paymentMethod:'credit',termsAccepted:values.get('termsAccepted')==='on',termsVersion:paymentQuote.terms.version,quoteFingerprint:paymentQuote.fingerprint,testMode:testPayment};
  const identity=JSON.stringify(body);let pending=paymentRecord();
  if(!pending||pending.identity!==identity)pending={identity,requestKey:crypto.randomUUID(),cartSnapshot:paymentCart,api};
  sessionStorage.setItem('wepMarketplacePending',JSON.stringify(pending));body.requestKey=pending.requestKey;
  paymentBusy=true;$('pay').disabled=true;$('payment-status').textContent='Preparing your order and secure payment…';
  const response=await fetch(api+'/marketplace-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true){if(response.status===409){sessionStorage.removeItem('wepMarketplacePending');clearQuote();$('status').textContent=result.error||'Review current pricing again.';}throw Error(result.error||'Payment could not start. Retry or contact a store.');}
  pending={...pending,orderNumber:result.orderNumber,checkoutToken:result.checkoutToken};sessionStorage.setItem('wepMarketplacePending',JSON.stringify(pending));
  if(result.alreadyPaid){location.assign('checkout-success.html?order='+encodeURIComponent(result.orderNumber)+(local?'&api=local':''));return;}
  const url=new URL(result.checkoutUrl);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Secure payment returned an invalid address.');
  // The saved order is immutable after payment starts; editing the cart does not change it.
  location.assign(url.href);
 }catch(error){$('payment-status').textContent=error.message;}
 finally{paymentBusy=false;$('pay').disabled=false;}
});

let autoTimer,autoSignature='',autoQueued=false;
function updateChoiceSummaries(){
 const data=new FormData($('choices')),fulfillment=data.get('fulfillment'),method=data.get('paymentMethod');
 $('fulfillment-summary').textContent=({NEW_MILFORD:'Pickup · New Milford',DANBURY:'Pickup · Danbury',DELIVERY:'Local delivery'+($('zip').value?' · '+$('zip').value:''),SHIP:'UPS Ground shipping'}[fulfillment]||'Choose how you’ll receive your equipment');
 $('payment-summary').textContent=({cash:'Cash / check',credit:'Credit card',finance:'Financing'}[method]||'Choose a payment option');
 if(method==='finance'){const selected=[...$('finance-options').querySelectorAll('select')].filter(x=>x.value).map(x=>x.selectedOptions[0].textContent);if(selected.length)$('payment-summary').textContent=selected.join(' · ');}
}
function scheduleAutoQuote(){
 clearTimeout(autoTimer);autoTimer=setTimeout(()=>{
  if(busy){autoQueued=true;return;}
  if($('choices').hidden||$('update').disabled||stockPending())return;
  if(selectedFulfillment()==='SHIP'&&[...$('shipping-address').querySelectorAll('input')].some(x=>!x.validity.valid)){
   $('status').textContent='Enter your billing / shipping address below to calculate UPS shipping and tax.';return;
  }
  if(!$('choices').checkValidity())return;
  const data=new FormData($('choices'));if(!data.get('fulfillment')||!data.get('paymentMethod'))return;
  const signature=JSON.stringify([cartText(),[...data],financeProgramIds(),financeDownPayments()]);
  if(signature===autoSignature)return;autoSignature=signature;autoQueued=false;$('choices').requestSubmit();
 },400);
}
$('choices').addEventListener('change',scheduleAutoQuote);
$('choices').addEventListener('input',scheduleAutoQuote);
$('proceed-checkout').addEventListener('click',()=>{
 if(!quote&&selectedFulfillment()==='SHIP'&&window.WEPCheckoutSelection?.fulfillment==='SHIP'){
  customerDetailsOpen=true;$('payment-panel').hidden=false;$('quote-details').open=false;
  $('payment-mode').textContent='Enter your contact details and matching billing / shipping address. UPS shipping and tax will update automatically.';
  $('checkout-terms').hidden=true;$('payment-form').elements.namedItem('termsAccepted').required=false;$('pay').disabled=true;
  $('payment-panel').scrollIntoView({behavior:'smooth',block:'start'});$('payment-form').elements.namedItem('firstName').focus({preventScroll:true});$('payment-form').dispatchEvent(new Event('input',{bubbles:true}));return;
 }
 if(!quote||Date.now()-Date.parse(quote.createdAt)>300000||paymentCart!==cartText()){clearQuote();autoSignature='';scheduleAutoQuote();$('status').textContent='Refreshing current pricing before checkout.';return;}
 customerDetailsOpen=true;$('quote-details').open=false;$('payment-panel').hidden=false;$('payment-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('payment-form').elements.namedItem('firstName').focus({preventScroll:true});
});
function syncShippingCustomer(){
 if(selectedFulfillment()!=='SHIP')return;
 const from=$('payment-form').elements,to=$('choices').elements;let changed=false;
 for(const [key,target] of [['address1','shipAddress1'],['address2','shipAddress2'],['city','shipCity'],['state','shipState'],['zip','shipZip']]){
  const value=from.namedItem(key).value;if(to.namedItem(target).value!==value){to.namedItem(target).value=value;changed=true;}
 }
 if(changed)$('choices').dispatchEvent(new Event('input',{bubbles:true}));
}
$('payment-form').addEventListener('input',syncShippingCustomer);
window.addEventListener('wep:checkout-restored',syncShippingCustomer);
$('back-to-quote').addEventListener('click',()=>{customerDetailsOpen=true;$('payment-panel').hidden=false;$('review').scrollIntoView({behavior:'smooth'});});
new MutationObserver(()=>{if(autoQueued)scheduleAutoQuote();}).observe($('update'),{attributes:true,attributeFilter:['disabled']});
try{const rows=JSON.parse(cartText());if(Array.isArray(rows)&&rows.length)$('lines').innerHTML=window.WEPQuoteLayout.rows(rows,true);}catch(_){}
try{readCart();loadShippingEligibility();changes();}catch(e){$('choices').hidden=true;$('lines').innerHTML='<tr><td colspan="6" class="quote-empty">Your cart is empty. <a href="marketplace.html">Browse equipment</a> to start a quote.</td></tr>';$('totals').replaceChildren();$('status').textContent=e.message;}
})();

// WEP_MARKETPLACE_SECURE_CHECKOUT_V1

// WEP_MARKETPLACE_DELIVERY_V1
