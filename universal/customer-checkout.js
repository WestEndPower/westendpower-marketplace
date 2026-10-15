/* WEP_MARKETPLACE_CUSTOMER_REVIEW_V1 */
(function(){'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>v===null?'Store confirmation':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const api=local&&new URLSearchParams(location.search).get('api')==='local'?'http://127.0.0.1:8787':'https://westendpower-configurator-api.westendpower-nm.workers.dev';
let quote=null,busy=false,requestNumber=0;
function cartText(){return localStorage.getItem('wepCart')||'[]';}
function readCart(){const rows=JSON.parse(cartText());if(!Array.isArray(rows)||!rows.length)throw Error('Your cart is empty. Choose equipment from Marketplace first.');return rows.map(x=>({brandId:String(x.brandId||'STIHL').toUpperCase(),type:x.type||'tool',sku:String(x.sku||''),quantity:Number(x.quantity),setupSelected:x.setupSelected===true}));}
function clearQuote(){quote=null;if($('payment-panel'))$('payment-panel').hidden=true;requestNumber++;$('review').hidden=true;$('email').removeAttribute('href');}
let financeLoad=0,financeSnapshot='',financeReady=false;
function selectedFulfillment(){return new FormData($('choices')).get('fulfillment');}
function shippingAddress(){const f=new FormData($('choices'));return {address1:String(f.get('shipAddress1')||'').trim(),address2:String(f.get('shipAddress2')||'').trim(),city:String(f.get('shipCity')||'').trim(),state:String(f.get('shipState')||'').trim().toUpperCase(),zip:String(f.get('shipZip')||'').trim()};}
function financeProgramIds(){const ids={};document.querySelectorAll('[data-finance-brand]').forEach(select=>{ids[select.dataset.financeBrand]=select.value;});return ids;}
function changes(){
 clearQuote();const delivery=selectedFulfillment()==='DELIVERY',ship=selectedFulfillment()==='SHIP';
 $('zip-field').hidden=!delivery;$('zip').required=delivery;
 $('shipping-address').hidden=!ship;$('shipping-address').disabled=!ship;
 for(const method of ['cash','finance']){const input=$('choices').querySelector('[name="paymentMethod"][value="'+method+'"]');input.disabled=ship;if(ship)input.checked=false;}
 if(ship)$('choices').querySelector('[name="paymentMethod"][value="credit"]').checked=true;
 const finance=new FormData($('choices')).get('paymentMethod')==='finance';$('finance-options').hidden=!finance;
 $('status').textContent='Select Review Current Pricing to update your quote.';
 if(finance&&financeSnapshot!==cartText())loadFinanceOptions();
 $('update').disabled=busy||(finance&&!financeReady);
}
async function loadFinanceOptions(){
 const number=++financeLoad;financeSnapshot=cartText();financeReady=false;$('update').disabled=true;$('finance-options').textContent='Loading eligible financing programs…';
 try{
  const groups=new Map();for(const line of readCart()){if(!groups.has(line.brandId))groups.set(line.brandId,[]);groups.get(line.brandId).push(line);}
  const choices=await Promise.all([...groups].map(async([brand,lines])=>{
   const tools=lines.filter(l=>l.type==='tool');if(!tools.length)throw Error(brand+' accessories alone require store financing review.');
   const lists=await Promise.all(tools.map(async l=>{const r=await fetch(api+'/customer-finance-programs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandId:brand,sku:l.sku})});const v=await r.json();if(!r.ok||v.ok!==true||!Array.isArray(v.programs))throw Error('Unable to load '+brand+' financing. Try again or contact a store.');return v.programs;}));
   const programs=lists[0].filter(p=>lists.every(list=>list.some(x=>x.ProgramID===p.ProgramID)));
   if(!programs.length)throw Error('No eligible financing programs for this '+brand+' equipment. Choose cash / check or credit card.');
   programs.sort((a,b)=>Number(a.APR)-Number(b.APR)||Number(b.TermMonths)-Number(a.TermMonths));
   return '<label class="finance-selector">'+esc(brand)+' financing program<select data-finance-brand="'+esc(brand)+'" required><option value="">Choose a program</option>'+programs.map(p=>'<option value="'+esc(p.ProgramID)+'">'+esc(p.ProgramName||p.ProgramID)+' · '+esc(p.APR)+'% APR · '+esc(p.TermMonths)+' months</option>').join('')+'</select></label>';
  }));
  if(number!==financeLoad||financeSnapshot!==cartText())return;
  $('finance-options').innerHTML=choices.join('');financeReady=true;
 }catch(error){if(number===financeLoad){financeSnapshot='';$('finance-options').textContent=error.message;}}
 finally{if(number===financeLoad)$('update').disabled=busy||(new FormData($('choices')).get('paymentMethod')==='finance'&&!financeReady);}
}
let fulfillmentLoad=0;
async function loadShippingEligibility(){
 const number=++fulfillmentLoad,input=$('choices').querySelector('[name="fulfillment"][value="SHIP"]');input.disabled=true;
 try{const r=await fetch(api+'/marketplace-fulfillment-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:readCart()})}),v=await r.json();if(number!==fulfillmentLoad)return;
  if(!r.ok||v.ok!==true)throw Error('Shipping eligibility is unavailable. Choose pickup or local delivery.');
  input.disabled=!v.shipEligible;$('shipping-eligibility').textContent=v.message;
 }catch(error){if(number===fulfillmentLoad)$('shipping-eligibility').textContent=error.message;}
 if(input.disabled&&input.checked){input.checked=false;changes();}
}
$('choices').addEventListener('change',changes);
$('choices').addEventListener('input',e=>{if(e.target.name!=='fulfillment'&&e.target.name!=='paymentMethod')changes();});
window.addEventListener('storage',e=>{if(e.key==='wepCart'){financeLoad++;financeSnapshot='';financeReady=false;loadShippingEligibility();changes();$('status').textContent='Your cart changed. Review current pricing again.';}});
function render(q){
 $('lines').innerHTML=q.lines.map(l=>'<tr><td><strong>'+esc(l.productName)+'</strong><small>'+esc(l.brandId)+' · SKU '+esc(l.sku)+'</small></td><td>'+l.quantity+'</td><td>'+fmt(l.unitPrice)+'</td><td>'+fmt(l.itemTotal)+'</td><td>'+(l.setupUnit>0?(l.setupSelected?fmt(l.setupTotal)+' applied'+(l.assemblyOption==='F'?'<small>Required</small>':''):'Available · '+fmt(l.setupUnit)+' per item'):'—')+'</td></tr>').join('');
 const amounts=[['Merchandise',q.merchandise],['Installation / Set-Up',q.installation],['Special order / factory freight',q.freight],['Local delivery',q.delivery],['UPS Ground shipping',q.shipping||0],['Subtotal',q.subtotal],['Estimated CT sales tax',q.tax],['Estimated total',q.total]];
 $('totals').innerHTML=amounts.map(([name,value],i)=>'<div'+(i===amounts.length-1?' class="total"':'')+'><dt>'+name+'</dt><dd>'+fmt(value)+'</dd></div>').join('');
 const store=q.fulfillment==='SHIP'?'Ship to '+q.shippingDetails.destination.city+', '+q.shippingDetails.destination.state+' '+q.shippingDetails.destination.zip:q.fulfillment==='NEW_MILFORD'?'New Milford':q.fulfillment==='DANBURY'?'Danbury':(q.deliveryDetails?.confirmed?'Delivery to '+q.deliveryDetails.town+', '+q.deliveryDetails.state+' '+q.zip:'Delivery');
 const financeText=(q.financePlans||[]).map(p=>p.brandId+' · '+(p.program.ProgramName||p.program.ProgramID)+' · '+p.program.APR+'% APR / '+p.program.TermMonths+' months | Required down payment '+fmt(p.requiredDown)+' | Amount financed '+fmt(p.amountFinanced)+' | Application fee '+fmt(p.applicationFee||0)+' | Financed amount with fee '+fmt(p.principalWithFees)+' | Estimated monthly payment '+fmt(p.monthlyPayment)+' | '+(String(p.program.RebateCompatible||'').match(/^(F|FALSE|NO|N|0)$/i)?'In lieu of customer rebates':'Compatible customer rebates included')+(Number(p.program.CreditScoreMin)>0?' | Minimum credit score '+p.program.CreditScoreMin:''));
 $('finance-summary').innerHTML=financeText.length?'<h3>Financing estimate</h3>'+financeText.map(t=>'<p>'+esc(t)+'</p>').join('')+'<p class="note">Subject to credit approval. Final lender terms and payment schedule are confirmed through the store. Application fees are included in the financed amount, separately from the equipment total.</p>':'';
 $('confirmation').textContent=store+(q.deliveryDetails?.note?' · '+q.deliveryDetails.note:'')+' · '+(q.paymentMethod==='cash'?'Cash / check':q.paymentMethod==='finance'?'Financing':'Credit card')+' pricing. '+q.issues.join(' ');
 $('confirmation').className=q.issues.length?'warning':'';$('dated').textContent='Prepared '+new Date(q.createdAt).toLocaleString();
 const text=['West End Power Equipment — Quote Request',store+' / '+(q.paymentMethod==='cash'?'Cash / check':q.paymentMethod==='finance'?'Financing':'Credit card'),q.zip?'Delivery ZIP: '+q.zip:'',q.fulfillment==='SHIP'?'Ship-to street: '+q.shippingDetails.destination.address1+' '+q.shippingDetails.destination.address2:'','',...q.lines.map(l=>l.brandId+' '+l.productName+' | SKU '+l.sku+' | Qty '+l.quantity+' | Unit '+fmt(l.unitPrice)+' | Item total '+fmt(l.itemTotal)+' | Installation '+(l.setupSelected?fmt(l.setupTotal)+' applied':'not selected')), '',...amounts.map(([n,v])=>n+': '+fmt(v)),...financeText,...q.issues,'','Please confirm availability, compatibility and final pricing.','Customer name:','Phone:'].join('\n');
 $('email').href='mailto:sales@westendpower.com?subject='+encodeURIComponent('Marketplace quote request — '+store)+'&body='+encodeURIComponent(text);
 $('review').hidden=false;$('review').focus();$('status').textContent='Quote ready for store review. No order or payment has been created.';
}
$('choices').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;clearQuote();const number=++requestNumber;let snapshot;
 try{
  const items=readCart();snapshot=cartText();const values=new FormData($('choices'));
  busy=true;$('update').disabled=true;$('status').textContent='Checking current prices and installation…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
  let response;try{response=await fetch(api+'/marketplace-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,paymentMethod:values.get('paymentMethod'),fulfillment:values.get('fulfillment'),zip:values.get('zip')||'',financeProgramIds:financeProgramIds(),shippingAddress:selectedFulfillment()==='SHIP'?shippingAddress():undefined}),signal:controller.signal});}finally{clearTimeout(timeout);}
  const q=await response.json().catch(()=>({}));
  if(!response.ok||q.ok!==true)throw Error(q.error||'Current quote pricing is unavailable. Please contact either store.');
  if(number!==requestNumber)return;
  if(snapshot!==cartText())throw Error('Your cart changed. Review current pricing again.');
  if(!Array.isArray(q.lines)||!q.lines.length||!Array.isArray(q.issues))throw Error('Current quote pricing is unavailable. Please try again.');
  quote=q;render(q);showMarketplacePayment(q,snapshot);
 }catch(error){if(number===requestNumber){$('status').textContent=error.name==='AbortError'?'Pricing took too long. Please try again.':error.message;$('review').hidden=true;}}
 finally{busy=false;$('update').disabled=new FormData($('choices')).get('paymentMethod')==='finance'&&!financeReady;}
});
$('print').onclick=()=>{if(quote&&Date.now()-Date.parse(quote.createdAt)<300000)window.print();else{clearQuote();$('status').textContent='Refresh current pricing before printing your quote.';}};
$('email').addEventListener('click',e=>{if(!quote||Date.now()-Date.parse(quote.createdAt)>300000){e.preventDefault();clearQuote();$('status').textContent='Refresh current pricing before requesting your quote.';}});
/* WEP_MARKETPLACE_SECURE_CHECKOUT_V1 */
let paymentBusy=false,paymentCart='',paymentQuote=null;
const testPayment=local||new URLSearchParams(location.search).get('test')==='1';
function showMarketplacePayment(q,snapshot){
 paymentQuote=q;paymentCart=snapshot;
 const supported=q.paymentMethod==='credit'&&['NEW_MILFORD','DANBURY','SHIP'].includes(q.fulfillment)&&q.total!==null&&q.issues.length===0&&q.fingerprint&&q.terms?.version;
 $('payment-panel').hidden=!supported;if(!supported)return;
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

try{readCart();loadShippingEligibility();changes();}catch(e){$('choices').hidden=true;$('status').textContent=e.message;}
})();

// WEP_MARKETPLACE_SECURE_CHECKOUT_V1

// WEP_MARKETPLACE_DELIVERY_V1
