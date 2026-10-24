/* WEP_INLINE_CHECKOUT_V1: the builder is the quote; Checkout opens its customer form. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
 let shippingTimer,shippingController,shippingGeneration=0,shippingKey='',opened=false,busy=false;
 const fields=['firstName','lastName','companyName','phone','cell','email','address1','city','state','zip','notes'];
 function state(){if(!window.WEPBuilderCheckout)throw Error('Wait for your package to finish loading.');return WEPBuilderCheckout.current();}
 function customer(){const form=$('wep-inline-form');return WEPCustomerFormat.customer({address2:'',...Object.fromEntries(fields.map(k=>[k,clean(form?.elements.namedItem(k)?.value)]))});}
 function remember(){try{sessionStorage.setItem('wepCheckoutCustomer',JSON.stringify(customer()));}catch(_){}}
 function message(text){for(const target of document.querySelectorAll('#wep-inline-status,#options-message,.wep-inline-print-status'))target.textContent=text;}
 function fresh(){const s=state();if(!s.paymentConfirmed||!s.quote||!['cash','credit','finance'].includes(s.quote.paymentMethod))throw Error('Select a payment option and wait for your current quote.');if(s.quote.fulfillment==='SHIP'&&WEPQuoteRequest.addressKey(customer())!==WEPQuoteRequest.addressKey(s.quote.shippingDetails?.destination))throw Error('Wait for shipping and tax to update for this address.');return s;}
  function reference(force=false){try{let saved=JSON.parse(sessionStorage.getItem('wepInlineReference')||'null');const s=state(),key=JSON.stringify(s.selection.items);if(!force&&saved?.key===key)return saved.reference;const id=crypto.randomUUID?crypto.randomUUID().slice(0,8):Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('');saved={key,reference:'Q-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+id.toUpperCase()};sessionStorage.setItem('wepInlineReference',JSON.stringify(saved));return saved.reference;}catch(_){return 'Equipment Quote';}}
 function savedRequest(){try{return JSON.parse(sessionStorage.getItem('wepInlineOrderRequest')||'null');}catch(_){return null;}}
 function showReceipt(pending){
  const receipt=$('wep-inline-receipt');if(!receipt)return;
  receipt.hidden=false;receipt.textContent=pending.status==='sent'?'Quote request received. Reference '+pending.reference+'. We will contact you to review pricing, availability and delivery.':'Quote request '+pending.reference+' may already be saved. Please call 860-355-8722 to confirm receipt before sending another request.';
 }
 function update(){
  const form=$('wep-inline-form');if(!form)return;
  let s;try{s=state();}catch(_){return;}
  const q=s.quote,shipping=s.selection.fulfillment==='SHIP',delivery=s.selection.fulfillment==='DELIVERY',needed=WEPQuoteRequest.required(s.selection.fulfillment,customer(),checkoutDetailsRequired);
  form.noValidate=true;
  $('wep-inline-requirements').textContent=checkoutDetailsRequired?'For checkout, enter first and last name or a business name, your address, and at least one phone number. Email and notes are optional. Fields marked * are required.':'For price and availability, enter a phone number or email address. Other details are optional. All fields are optional for printing a quote.';
  if(delivery&&form.elements.namedItem('zip').value!==s.selection.zip)form.elements.namedItem('zip').value=s.selection.zip;
  for(const key of fields){const field=form.elements.namedItem(key);field.required=needed.includes(key);const label=form.querySelector('[data-wep-field-label="'+key+'"]');if(label){const text=(key==='address1'?(shipping?'Billing / shipping address':'Address'):label.dataset.label)+(needed.includes(key)?' *':key==='email'?' (optional)':'');if(label.textContent!==text)label.textContent=text;}}
  form.elements.namedItem('zip').pattern=shipping||delivery?'[0-9]{5}':'[0-9]{5}(-[0-9]{4})?';form.elements.namedItem('zip').maxLength=shipping||delivery?5:10;
  const addressReady=!shipping||q&&WEPQuoteRequest.addressKey(customer())===WEPQuoteRequest.addressKey(q.shippingDetails?.destination);
  const pending=savedRequest();let same=false;try{same=!!q&&pending?.identity===WEPQuoteRequest.identity(s,customer());}catch(_){}
  const received=same&&['sent','check'].includes(pending.status);
  $('wep-inline-submit').disabled=busy||!q||!s.paymentConfirmed||!addressReady||received;
  $('wep-inline-submit').textContent=busy?'Sending quote…':received?'Quote Request '+(pending.status==='sent'?'Received':'Needs Confirmation'):same&&pending?.status==='retry'?'Retry Quote Request':pending?.status==='sent'?'Send Updated Quote Request':'Confirm Price & Availability';
  $('wep-inline-mode').textContent=!q?shipping?'Enter your billing / shipping address to calculate UPS shipping and tax.':'Your quote is updating. You can enter customer details while it loads.':!addressReady?'Shipping and tax must finish updating for this address.':'';
  $('wep-inline-checkout-final').disabled=busy||!q||!s.paymentConfirmed||!addressReady;
  if(received)showReceipt(pending);
 }
 function formMarkup(){return '<h2>Customer information</h2><p class="note" id="wep-inline-requirements">For price and availability, enter a phone number or email address. Other details are optional. All fields are optional for printing a quote.</p><p class="note">We use your information only to respond to your request. We don\'t sell or share it.</p><p id="wep-inline-mode"></p><form id="wep-inline-form" novalidate><div class="wep-inline-fields">'+[
  ['firstName','First name','given-name','text'],['lastName','Last name','family-name','text'],['companyName','Company name','organization','text'],['phone','Phone / Cell','section-contact tel','tel'],['cell','Business Phone','section-business work tel','tel'],['email','Email','email','email'],['address1','Address','street-address','text'],['city','City','address-level2','text'],['state','State','address-level1','text'],['zip','ZIP','postal-code','text']
 ].map(([key,label,auto,type])=>'<label>'+'<span data-wep-field-label="'+key+'" data-label="'+label+'">'+label+'</span>'+'<input name="'+key+'" type="'+type+'" autocapitalize="'+(['firstName','lastName','companyName','address1','city'].includes(key)?'words':'off')+'" autocomplete="'+auto+'" maxlength="'+(key==='state'?2:250)+'"'+(key==='state'?' pattern="[A-Za-z]{2}"':key==='zip'?' inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?"':'')+'></label>').join('')+'</div><label class="wep-inline-notes">Notes / special instructions (optional)<textarea name="notes" rows="2" maxlength="2000"></textarea></label><div class="wep-inline-actions"><button type="button" id="wep-inline-print-copy">Print Quote</button><button type="submit" id="wep-inline-submit" disabled>Confirm Price &amp; Availability</button><button type="button" id="wep-inline-checkout-final">Proceed to Checkout</button></div><p id="wep-inline-status" role="status" aria-live="polite"></p><div id="wep-inline-receipt" role="status" hidden></div></form>';}
 function mount(){
  const app=$('app'),invoice=$('wep-itemized-quote'),actions=app?.querySelector('.summary-actions');if(!invoice||!actions)return;
  $('review-package')?.setAttribute('hidden','');
  if(!$('wep-inline-review')){const button=document.createElement('button');button.id='wep-inline-review';button.type='button';button.textContent='Review Quote';button.onclick=()=>{invoice.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});invoice.focus({preventScroll:true});};actions.prepend(button);}
  if(!$('wep-inline-print')){const button=document.createElement('button');button.id='wep-inline-print';button.type='button';button.textContent='Print Quote';button.onclick=printQuote;$('wep-inline-review').after(button);}
  const totals=invoice.querySelector('.wep-itemized-totals');
  if(totals&&!totals.querySelector('.wep-inline-quote-actions')){const buttons=document.createElement('div');buttons.className='wep-inline-quote-actions';const print=document.createElement('button'),checkout=document.createElement('button');print.type=checkout.type='button';print.textContent='Print Quote';checkout.textContent='Checkout';print.onclick=printQuote;checkout.textContent='Proceed to Checkout';checkout.onclick=()=>{checkoutRequested=true;WEPBuilderCheckout.review();};const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Confirm Price & Availability';confirm.onclick=()=>{checkoutRequested=false;checkoutDetailsRequired=false;open();};buttons.append(print,confirm,checkout);totals.append(buttons);}
  for(const group of [actions,totals])if(group&&!group.querySelector('.wep-inline-print-status')){const status=document.createElement('p');status.className='wep-inline-print-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');group.append(status);}
  if(!$('wep-inline-customer')){
   const section=document.createElement('section');section.id='wep-inline-customer';section.className='wep-inline-customer';section.hidden=true;section.innerHTML=formMarkup();invoice.after(section);
   try{const saved=JSON.parse(sessionStorage.getItem('wepCheckoutCustomer')||sessionStorage.getItem('wepQuoteCustomer')||'{}');for(const key of fields)if(typeof saved[key]==='string')$('wep-inline-form').elements.namedItem(key).value=saved[key];if(clean(saved.address2))$('wep-inline-form').elements.namedItem('address1').value=[clean(saved.address1),clean(saved.address2)].filter(Boolean).join(', ');}catch(_){}
   $('wep-inline-print-copy').onclick=printQuote;$('wep-inline-form').addEventListener('submit',submit);
   $('wep-inline-checkout-final').onclick=reviewCheckout;
   for(const key of fields)formatField($('wep-inline-form').elements.namedItem(key));
   $('wep-inline-form').addEventListener('focusout',event=>{formatField(event.target);remember();update();});
   $('wep-inline-form').addEventListener('input',event=>{
    const field=event.target;if(event.isComposing)return;if(!['phone','cell'].includes(field.name))formatField(field);
    for(const el of $('wep-inline-form').elements){el.setCustomValidity?.('');el.removeAttribute?.('aria-invalid');}remember();if(['address1','address2','city','state','zip'].includes(field.name)){try{const s=state();if(s.selection.fulfillment==='SHIP')queueShipping();else if(s.selection.fulfillment==='DELIVERY'&&field.name==='zip'){const zip=$('wep-build-zip');if(zip&&zip.value!==field.value){zip.value=field.value;zip.dispatchEvent(new Event('input',{bubbles:true}));}}}catch(_){}}update();
   });
  }
  for(const dt of invoice.querySelectorAll('.wep-itemized-totals dt'))if(clean(dt.firstChild?.textContent)==='Local delivery'&&!dt.querySelector('.wep-inline-edit-delivery')){const button=document.createElement('button');button.type='button';button.className='wep-inline-edit-delivery';button.textContent='Edit';button.onclick=editDelivery;dt.append(' ',button);}
 }
 function editDelivery(){
  const source=$('wep-build-fulfillment');if(!source)return;
  let panel=$('wep-inline-delivery-editor');if(!panel){panel=document.createElement('section');panel.id='wep-inline-delivery-editor';panel.className='wep-inline-delivery-editor';panel.innerHTML='<h3>Pickup / delivery</h3><label>Delivery option<select id="wep-inline-delivery-choice"></select></label><label id="wep-inline-delivery-zip-label">Delivery ZIP<input id="wep-inline-delivery-zip" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required></label><button id="wep-inline-delivery-apply" type="button">Apply</button>';$('wep-itemized-quote').after(panel);
   $('wep-inline-delivery-choice').onchange=()=>{$('wep-inline-delivery-zip-label').hidden=$('wep-inline-delivery-choice').value!=='DELIVERY';};
   $('wep-inline-delivery-apply').onclick=()=>{const choice=$('wep-inline-delivery-choice').value,zip=clean($('wep-inline-delivery-zip').value);if(choice==='DELIVERY'&&!/^\d{5}$/.test(zip)){$('wep-inline-delivery-zip').reportValidity();return;}$('wep-build-zip').value=zip;source.value=choice;source.dispatchEvent(new Event('change',{bubbles:true}));panel.hidden=true;if(choice==='SHIP')open();};
  }
  $('wep-inline-delivery-choice').replaceChildren(...[...source.options].map(option=>option.cloneNode(true)));$('wep-inline-delivery-choice').value=source.value;$('wep-inline-delivery-zip').value=$('wep-build-zip')?.value||'';$('wep-inline-delivery-zip-label').hidden=source.value!=='DELIVERY';panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'center'});
 }
 function open(){mount();if(!opened&&!$('wep-inline-form').elements.namedItem('zip').value){try{const s=state();if(s.selection.fulfillment==='DELIVERY')$('wep-inline-form').elements.namedItem('zip').value=s.selection.zip;}catch(_){}}opened=true;$('wep-inline-customer').hidden=false;update();$('wep-inline-customer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('wep-inline-form').elements.namedItem('firstName').focus({preventScroll:true});queueShipping();if(checkoutRequested){checkoutRequested=false;reviewCheckout();}}
 let checkoutRequested=false,purchaseBusy=false,checkoutContext=null,checkoutDetailsRequired=false;
 function formatField(field){
  if(!field?.name||!fields.includes(field.name))return;
  const before=field.value,after=WEPCustomerFormat.value(field.name,before);if(before===after)return;
  const start=field.selectionStart,end=field.selectionEnd;field.value=after;
  if(document.activeElement===field&&typeof start==='number'&&before.length===after.length){try{field.setSelectionRange(start,end);}catch(_){}}
 }
 function verifiedCustomer(){
  const form=$('wep-inline-form');checkoutDetailsRequired=true;update();for(const key of fields){const field=form.elements.namedItem(key);formatField(field);field.setCustomValidity?.('');field.removeAttribute?.('aria-invalid');}remember();
  const s=fresh(),c=customer(),invalid=WEPQuoteRequest.validate(c,s.quote,{checkout:true});
  if(invalid){const field=form.elements.namedItem(invalid.field);field.setAttribute('aria-invalid','true');field.setCustomValidity(invalid.message);field.reportValidity();throw Error(invalid.message);}
  for(const key of ['address1','city','state','zip'])if(!c[key]){const field=form.elements.namedItem(key);field.setAttribute('aria-invalid','true');field.setCustomValidity('Complete your address before final checkout.');field.reportValidity();throw Error('Complete your address before final checkout.');}
  return {s,c};
 }
 function checkoutIdentity(s,c){return JSON.stringify([s.selection,s.quote.fingerprint,s.quote.terms?.version,c]);}
 function reviewCheckout(){
  if(purchaseBusy)return;
  try{
   const {s,c}=verifiedCustomer(),q=s.quote;
   if(q.fulfillment==='SHIP'&&q.paymentMethod!=='credit')throw Error('Shipped orders require credit card payment.');
   if(q.total===null||q.issues.length||!q.fingerprint)throw Error('Use Confirm Price & Availability so the store can confirm the remaining charges before checkout.');
   if(q.terms?.version!=='2026-10-22-v4')throw Error('The updated checkout agreement is not loaded yet. Refresh current pricing and try again.');
   let dialog=$('wep-inline-checkout-review');
   if(!dialog){
    dialog=document.createElement('dialog');dialog.id='wep-inline-checkout-review';dialog.setAttribute('aria-labelledby','wep-checkout-title');
    dialog.innerHTML='<h2 id="wep-checkout-title">Review &amp; complete checkout</h2><div id="wep-checkout-summary"></div><p id="wep-checkout-payment-note"></p><p id="wep-checkout-common-terms"></p><label class="wep-checkout-agreement"><input id="wep-checkout-agree" type="checkbox"> I have read and agree to these order terms.</label><div class="wep-checkout-review-actions"><button type="button" id="wep-checkout-back">Back to Quote</button><button type="button" id="wep-checkout-complete" disabled></button></div><p id="wep-checkout-result" role="status" aria-live="polite"></p>';
    document.body.append(dialog);$('wep-checkout-back').onclick=()=>dialog.close();
    $('wep-checkout-agree').onchange=()=>{$('wep-checkout-complete').disabled=!$('wep-checkout-agree').checked||purchaseBusy;};
    $('wep-checkout-complete').onclick=completeCheckout;
    dialog.addEventListener('cancel',event=>{if(purchaseBusy)event.preventDefault();});
   }
   checkoutContext=checkoutIdentity(s,c);$('wep-checkout-agree').checked=false;$('wep-checkout-complete').disabled=true;$('wep-checkout-back').disabled=false;$('wep-checkout-result').textContent='';
   $('wep-checkout-summary').textContent=WEPQuoteDocument.paymentLabel(WEPQuoteDocument.snapshot(q))+' · '+WEPQuoteDocument.fulfillmentLabel(WEPQuoteDocument.snapshot(q))+' · Total '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(q.total);
   $('wep-checkout-common-terms').textContent=q.terms.text;
   const payment=q.paymentMethod;
   $('wep-checkout-complete').textContent=payment==='finance'?'Agree & Apply for Financing':payment==='credit'?'Agree & Pay Securely':'Agree & Place Order';
   $('wep-checkout-payment-note').textContent=payment==='finance'?'Selected program: '+q.financePlans.map(p=>p.program.ProgramName||p.program.ProgramID).join('; ')+'. Your purchase remains pending credit approval and dealer confirmation.':payment==='credit'?'Continue to Stripe for secure credit card payment.':(q.fulfillment==='DELIVERY'?'Payment due on delivery.':'Payment due at pickup.')+' Availability will be confirmed before processing.';
   if(!dialog.open)dialog.showModal();
  }catch(error){message(error.message);}
 }
 async function completeCheckout(){
  if(purchaseBusy||!$('wep-checkout-agree').checked)return;
  const status=$('wep-checkout-result');let pending,applicationTab=null;
  try{
   const {s,c}=verifiedCustomer(),q=s.quote;
   if(checkoutIdentity(s,c)!==checkoutContext)throw Error('Your quote or details changed. Return to the quote and review checkout again.');
   if(q.fulfillment==='SHIP'&&q.paymentMethod!=='credit')throw Error('Shipped orders require credit card payment.');
   const body={items:s.selection.items,financeDownPayments:s.selection.financeDownPayments||{},customer:c,customerNotes:c.notes,paymentMethod:q.paymentMethod,fulfillment:q.fulfillment,zip:q.zip,financeProgramIds:s.selection.financeProgramIds||{},shippingAddress:q.fulfillment==='SHIP'?q.shippingDetails.destination:undefined,termsAccepted:true,termsVersion:q.terms.version,quoteFingerprint:q.fingerprint,testMode:s.testMode===true};
   // The builder stores its selected program as programId; preserve that exact program.
   if(q.paymentMethod==='finance')body.financeProgramIds=Object.fromEntries(q.financePlans.map(p=>[p.brandId,p.program.ProgramID]));
   const identity=JSON.stringify(body);try{pending=JSON.parse(sessionStorage.getItem('wepInlinePurchase')||'null');}catch(_){}
   if(!pending||pending.identity!==identity)pending={identity,requestKey:crypto.randomUUID()};
   body.requestKey=pending.requestKey;sessionStorage.setItem('wepInlinePurchase',JSON.stringify(pending));
   // Reserve the application tab during the click so the async order request
   // does not turn the lender navigation into a blocked popup.
   if(q.paymentMethod==='finance'){try{applicationTab=window.open('about:blank','_blank');if(applicationTab)applicationTab.opener=null;}catch(_){applicationTab=null;}}
   purchaseBusy=true;$('wep-checkout-complete').disabled=true;$('wep-checkout-back').disabled=true;$('wep-checkout-agree').disabled=true;status.textContent='Submitting your selection…';
   const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),30000);let response,result;
   try{response=await fetch(s.api+'/marketplace-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal});result=await response.json().catch(()=>({}));}finally{clearTimeout(timeout);}
   if(!response.ok||result.ok!==true)throw Error(result.error||'Checkout could not be confirmed. Retry the same checkout or contact a store.');
   if(result.demo===true&&window.WEPManufacturerDemo?.active){if(applicationTab&&!applicationTab.closed)applicationTab.close();$('wep-inline-checkout-review')?.close();message('Demo checkout complete. No order was placed and no payment was collected. Reference '+result.orderNumber+'.');const link=document.createElement('a');link.href=s.api+result.documentUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' View Demo Order & Dealer Costs';$('wep-inline-status')?.append(link);$('wep-checkout-agree').checked=false;return;}
   pending={...pending,orderNumber:result.orderNumber,checkoutToken:result.checkoutToken};sessionStorage.setItem('wepInlinePurchase',JSON.stringify(pending));
   if(q.paymentMethod==='credit'){
    sessionStorage.setItem('wepMarketplacePending',JSON.stringify({...pending,api:s.api,cartSnapshot:null}));
    if(result.alreadyPaid){status.textContent='Payment already received. Reference '+result.orderNumber+'. The store will confirm availability.';return;}
    const link=new URL(result.checkoutUrl);if(link.protocol!=='https:'||link.hostname!=='checkout.stripe.com')throw Error('Secure payment returned an invalid address.');location.assign(link.href);return;
   }
   if(q.paymentMethod==='finance'){
    const link=new URL(result.applicationUrl);if(link.protocol!=='https:'||link.username||link.password)throw Error('The selected financing application needs store confirmation.');
    status.textContent='Reference '+result.orderNumber+'. '+(applicationTab&&!applicationTab.closed?'Your financing application opened in a new tab.':'Select the link below to open your financing application in a new tab.')+' Purchase pending credit approval and availability confirmation. ';
    const finishApplication=()=>{$('wep-inline-checkout-review')?.close();message('Financing application opened in a new tab. Reference '+result.orderNumber+'. Purchase pending credit approval and dealer confirmation.');};
    const applicationLink=document.createElement('a');applicationLink.href=link.href;applicationLink.target='_blank';applicationLink.rel='noopener noreferrer';applicationLink.textContent='Open Financing Application';applicationLink.addEventListener('click',finishApplication);status.append(applicationLink);
    if(applicationTab&&!applicationTab.closed){applicationTab.location.replace(link.href);finishApplication();}
    $('wep-checkout-complete').textContent='Application Ready';$('wep-checkout-agree').checked=false;return;
   }
   status.textContent='Order submitted. Reference '+result.orderNumber+'. '+result.paymentDue+'. The store will confirm availability before processing.';
   $('wep-checkout-complete').textContent='Order Submitted';$('wep-checkout-agree').checked=false;
  }catch(error){if(applicationTab&&!applicationTab.closed)applicationTab.close();status.textContent=error.name==='AbortError'?'Checkout timed out. Retry using the same request or contact a store.':error.message;}
  finally{purchaseBusy=false;$('wep-checkout-back').disabled=false;$('wep-checkout-agree').disabled=false;$('wep-checkout-complete').disabled=!$('wep-checkout-agree').checked;}
 }

 let printBusy=false,printUrl='';
 async function printQuote(){
  if(printBusy)return;
  let dialog=$('wep-inline-pdf-preview');
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='wep-inline-pdf-preview';dialog.setAttribute('aria-labelledby','wep-inline-pdf-title');
   dialog.innerHTML='<div class="wep-inline-pdf-header"><h2 id="wep-inline-pdf-title">Printable Quote PDF</h2><a id="wep-inline-pdf-download" hidden download="Equipment-Quote.pdf">Save PDF</a><button type="button" id="wep-inline-pdf-close">Close</button></div><p id="wep-inline-pdf-status" role="status" aria-live="polite"></p><iframe id="wep-inline-pdf-frame" title="Printable equipment quote PDF" hidden></iframe>';
   document.body.append(dialog);$('wep-inline-pdf-close').onclick=()=>dialog.close();
   dialog.addEventListener('close',()=>{if(!printBusy){$('wep-inline-pdf-frame').src='about:blank';if(printUrl)URL.revokeObjectURL(printUrl);printUrl='';}});
  }
  if(!dialog.open)dialog.showModal();
  const status=$('wep-inline-pdf-status'),frame=$('wep-inline-pdf-frame'),download=$('wep-inline-pdf-download');
  frame.hidden=true;download.hidden=true;status.textContent='Preparing your printable quote PDF…';message('Preparing your printable quote PDF…');printBusy=true;
  try{
   let s=state();
   if(!s.paymentConfirmed)throw Error('Choose Cash / Bank Check, Credit Card or Financing on the quote, then select Print Quote.');
   if(!s.quote){
    if(s.selection.fulfillment==='SHIP')throw Error('Enter your billing / shipping address under Checkout so shipping and tax can be calculated, then select Print Quote.');
    status.textContent='Updating current quote prices…';
    await new Promise((resolve,reject)=>{const ready=()=>{if(state().quote){clearTimeout(timer);window.removeEventListener('wep:build-pricing',ready);resolve();}},timer=setTimeout(()=>{window.removeEventListener('wep:build-pricing',ready);reject(Error('Current pricing is not ready. Please wait for the total to finish updating and try Print Quote again.'));},20000);window.addEventListener('wep:build-pricing',ready);try{WEPBuilderCheckout.refresh();ready();}catch(error){clearTimeout(timer);window.removeEventListener('wep:build-pricing',ready);reject(error);}});
   }
   s=fresh();const snapshot=WEPQuoteDocument.snapshot(s.quote,customer(),reference()),bytes=await WEPQuotePDF.create(snapshot);
   if(printUrl)URL.revokeObjectURL(printUrl);printUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
   if(!dialog.open){URL.revokeObjectURL(printUrl);printUrl='';return;}
   frame.src=printUrl;frame.hidden=false;download.href=printUrl;download.download=(snapshot.reference||'Equipment-Quote')+'.pdf';download.hidden=false;
   status.textContent='Use the PDF toolbar to print, or select Save PDF.';message('Your printable quote PDF is ready.');
  }catch(error){status.textContent=error.message;message(error.message);}finally{printBusy=false;}
 }
 function shippingAddress(){const c=customer();return Object.fromEntries(['address1','address2','city','state','zip'].map(k=>[k,c[k]]));}
 function queueShipping(){
  clearTimeout(shippingTimer);shippingController?.abort();const generation=++shippingGeneration;if(!opened)return;
  let s;try{s=state();}catch(_){return;}if(s.selection.fulfillment!=='SHIP')return;
  const address=shippingAddress();if(!address.address1||!address.city||!/^[A-Za-z]{2}$/.test(address.state)||!/^\d{5}$/.test(address.zip))return;
  const key=JSON.stringify([s.selection,address]);if(key===shippingKey&&s.quote)return;
  shippingTimer=setTimeout(async()=>{const id=generation;shippingController=new AbortController();try{message('Calculating UPS shipping and tax…');await WEPBuilderCheckout.shippingQuote(address,shippingController.signal);if(id===shippingGeneration){shippingKey=key;update();message('Shipping and tax updated.');}}catch(error){if(error.name!=='AbortError')message(error.message);}},450);
 }
 async function submit(event){
  event.preventDefault();if(busy)return;
  checkoutDetailsRequired=false;update();
  try{
   const form=$('wep-inline-form');for(const key of fields)formatField(form.elements.namedItem(key));for(const el of form.elements)el.setCustomValidity?.('');
   const s=fresh(),c=customer(),invalid=WEPQuoteRequest.validate(c,s.quote);
   if(invalid){const field=form.elements.namedItem(invalid.field);field.setCustomValidity(invalid.message);field.reportValidity();message(invalid.message);return;}
   if(!form.reportValidity())return;remember();
   const identity=WEPQuoteRequest.identity(s,c);let pending=savedRequest();
   if(pending?.identity===identity&&['sent','check'].includes(pending.status)){showReceipt(pending);update();return;}
   if(!pending||pending.identity!==identity)pending={identity,reference:reference(!!pending),status:'sending'};
   const body=WEPQuoteRequest.payload(s,c,pending.reference);sessionStorage.setItem('wepInlineOrderRequest',JSON.stringify(pending));
   busy=true;update();message('Sending your quote request…');
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);let response,result;
   try{response=await fetch(s.api+'/quote-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});result=await response.json().catch(()=>({}));}finally{clearTimeout(timeout);}
   if(!response.ok||result.ok!==true){
    if(response.status===409||/deliver the quote email/i.test(result.error||'')){pending.status='check';sessionStorage.setItem('wepInlineOrderRequest',JSON.stringify(pending));showReceipt(pending);message('Please contact the store to confirm quote request '+pending.reference+'.');return;}
    throw Error(result.error||'Your quote request could not be confirmed. Retry using the same quote reference or call the store.');
   }
   pending.status='sent';sessionStorage.setItem('wepInlineOrderRequest',JSON.stringify(pending));showReceipt(pending);message('Quote request received: '+pending.reference+'.');
  }catch(error){const pending=savedRequest();if(pending&&pending.status==='sending'){pending.status='retry';try{sessionStorage.setItem('wepInlineOrderRequest',JSON.stringify(pending));}catch(_){}}message(error.name==='AbortError'?'The quote request timed out. Retry to check this quote request or call the store with your quote reference.':error.message);}finally{busy=false;update();}
 }
 window.WEPInlineCheckout={open};
 window.addEventListener('wep:build-pricing',event=>{mount();update();if(!event.detail?.quote&&opened)queueShipping();});
 window.addEventListener('pagehide',remember);
 window.addEventListener('pageshow',update);
 window.addEventListener('focus',update);
 const app=$('app');if(app)new MutationObserver(mount).observe(app,{childList:true,subtree:true});mount();
})();


