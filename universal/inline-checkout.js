/* WEP_INLINE_CHECKOUT_V1: the builder is the quote; Checkout opens its customer form. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
 let shippingTimer,shippingController,shippingGeneration=0,shippingKey='',opened=false,busy=false,lastQuote=null;
 const fields=['firstName','lastName','companyName','email','phone','address1','address2','city','state','zip','notes'];
 function state(){if(!window.WEPBuilderCheckout)throw Error('Wait for your package to finish loading.');return WEPBuilderCheckout.current();}
 function customer(){const form=$('wep-inline-form');return Object.fromEntries(fields.map(k=>[k,clean(form?.elements.namedItem(k)?.value)]));}
 function remember(){try{sessionStorage.setItem('wepCheckoutCustomer',JSON.stringify(customer()));}catch(_){}}
 function message(text){if($('wep-inline-status'))$('wep-inline-status').textContent=text;else if($('options-message'))$('options-message').textContent=text;}
 function fresh(){const s=state();if(!s.paymentConfirmed||!s.quote||!['cash','credit','finance'].includes(s.quote.paymentMethod))throw Error('Select a payment option and wait for your current quote.');return s;}
 function cardSupported(q){return q.paymentMethod==='credit'&&['NEW_MILFORD','DANBURY','SHIP'].includes(q.fulfillment)&&Number.isFinite(q.total)&&!q.issues.length&&!q.excludedFactoryFreight?.length&&!q.lines.some(l=>l.freightNote)&&q.fingerprint&&q.terms?.version;}
 function reference(){try{let saved=JSON.parse(sessionStorage.getItem('wepInlineReference')||'null');const s=state(),key=JSON.stringify(s.selection.items);if(saved?.key===key)return saved.reference;const id=crypto.randomUUID?crypto.randomUUID().slice(0,8):Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('');saved={key,reference:'Q-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+id.toUpperCase()};sessionStorage.setItem('wepInlineReference',JSON.stringify(saved));return saved.reference;}catch(_){return 'Equipment Quote';}}
 function update(){
  if(!$('wep-inline-form'))return;
  let s;try{s=state();}catch(_){return;}
  const q=s.quote,shipping=s.selection.fulfillment==='SHIP';lastQuote=q;
  $('wep-inline-address-label').textContent=shipping?'Billing / shipping address':'Street address';$('wep-inline-form').elements.namedItem('zip').pattern=shipping?'[0-9]{5}':'[0-9]{5}(-[0-9]{4})?';$('wep-inline-form').elements.namedItem('zip').maxLength=shipping?5:10;
  $('wep-inline-terms-row').hidden=!q||!cardSupported(q);$('wep-inline-form').elements.namedItem('termsAccepted').required=!!q&&!!cardSupported(q);
  const signature=q?JSON.stringify([q.fingerprint,q.paymentMethod,q.fulfillment,q.total,q.createdAt]):'';
  if($('wep-inline-form').dataset.quote!==signature){$('wep-inline-form').elements.namedItem('termsAccepted').checked=false;$('wep-inline-form').dataset.quote=signature;}
  $('wep-inline-terms').textContent=q&&cardSupported(q)?q.terms.text:'';
  $('wep-inline-submit').disabled=busy||!q||!s.paymentConfirmed;
  $('wep-inline-submit').textContent=q&&cardSupported(q)?s.testMode?'Continue to Stripe Test Payment':'Continue to Secure Payment':'Email Order Request';
  $('wep-inline-mode').textContent=!q?shipping?'Enter your matching billing / shipping address to calculate UPS shipping and tax.':'Your quote is updating. You can enter customer details while it loads.':cardSupported(q)?s.testMode?'STRIPE TEST MODE — no real payment will be collected.':'Card details are entered on Stripe’s secure payment page.':q.paymentMethod==='finance'?'Send your details to the store to confirm availability and complete your selected financing.':'Send your details to the store to confirm availability and arrange payment.';
 }
 function formMarkup(){return '<h2>Customer information</h2><p class="note">Optional when printing a quote. Complete the required fields below when placing an order.</p><p id="wep-inline-mode"></p><form id="wep-inline-form"><div class="wep-inline-fields">'+[
  ['firstName','First name','given-name','text'],['lastName','Last name','family-name','text'],['email','Email','email','email'],['phone','Phone','tel','tel'],['companyName','Company (optional)','organization','text'],['address1','Street address','street-address','text'],['address2','Apartment / suite (optional)','address-line2','text'],['city','City','address-level2','text'],['state','State','address-level1','text'],['zip','ZIP','postal-code','text']
 ].map(([key,label,auto,type])=>'<label>'+(key==='address1'?'<span id="wep-inline-address-label">'+label+'</span>':label)+'<input name="'+key+'" type="'+type+'" autocomplete="'+auto+'" maxlength="'+(key==='state'?2:250)+'"'+(key==='state'?' pattern="[A-Za-z]{2}"':key==='zip'?' inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?"':'')+'></label>').join('')+'</div><label class="wep-inline-notes">Notes (optional)<textarea name="notes" rows="2" maxlength="2000"></textarea></label><p id="wep-inline-terms"></p><label id="wep-inline-terms-row" hidden><input type="checkbox" name="termsAccepted"> I have read and accept these terms.</label><div class="wep-inline-actions"><button type="button" id="wep-inline-print-copy">Print Quote</button><button type="submit" id="wep-inline-submit" disabled>Continue to Checkout</button></div><p id="wep-inline-status" role="status" aria-live="polite"></p></form>';}
 function mount(){
  const app=$('app'),invoice=$('wep-itemized-quote'),actions=app?.querySelector('.summary-actions');if(!invoice||!actions)return;
  $('review-package')?.setAttribute('hidden','');
  if(!$('wep-inline-print')){const button=document.createElement('button');button.id='wep-inline-print';button.type='button';button.textContent='Print Quote';button.onclick=printQuote;actions.prepend(button);}
  if(!$('wep-inline-customer')){
   const section=document.createElement('section');section.id='wep-inline-customer';section.className='wep-inline-customer';section.hidden=true;section.innerHTML=formMarkup();invoice.after(section);
   try{const saved=JSON.parse(sessionStorage.getItem('wepCheckoutCustomer')||sessionStorage.getItem('wepQuoteCustomer')||'{}');for(const key of fields)if(typeof saved[key]==='string')$('wep-inline-form').elements.namedItem(key).value=saved[key];}catch(_){}
   $('wep-inline-print-copy').onclick=printQuote;$('wep-inline-form').addEventListener('submit',submit);
   $('wep-inline-form').addEventListener('input',event=>{
    const field=event.target;if(field.name==='email')field.value=field.value.toLowerCase();if(field.name==='state')field.value=field.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2);
    remember();if(['address1','address2','city','state','zip'].includes(field.name)){try{if(state().selection.fulfillment==='SHIP'){$('wep-inline-submit').disabled=true;queueShipping();}}catch(_){}}
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
 function open(){mount();opened=true;$('wep-inline-customer').hidden=false;update();$('wep-inline-customer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('wep-inline-form').elements.namedItem('firstName').focus({preventScroll:true});queueShipping();}
 function printQuote(){
  try{const s=fresh(),snapshot=WEPQuoteDocument.snapshot(s.quote,customer(),reference());$('wep-inline-print-frame')?.remove();const frame=document.createElement('iframe');frame.id='wep-inline-print-frame';frame.title='Printable equipment quote';frame.style.cssText='position:fixed;left:-10000px;top:0;width:850px;height:1100px;border:0';frame.onload=()=>{frame.contentWindow.focus();frame.contentWindow.print();};frame.srcdoc=WEPQuoteDocument.html(snapshot);document.body.append(frame);}catch(error){message(error.message);try{WEPBuilderCheckout.review();}catch(_){}}
 }
 function shippingAddress(){const c=customer();return Object.fromEntries(['address1','address2','city','state','zip'].map(k=>[k,c[k]]));}
 function queueShipping(){
  clearTimeout(shippingTimer);shippingController?.abort();if(!opened)return;
  let s;try{s=state();}catch(_){return;}if(s.selection.fulfillment!=='SHIP')return;
  const address=shippingAddress();if(!address.address1||!address.city||!/^[A-Za-z]{2}$/.test(address.state)||!/^\d{5}$/.test(address.zip))return;
  const key=JSON.stringify([s.selection,address]);if(key===shippingKey&&s.quote)return;
  shippingTimer=setTimeout(async()=>{const id=++shippingGeneration;shippingController=new AbortController();try{message('Calculating UPS shipping and tax…');await WEPBuilderCheckout.shippingQuote(address,shippingController.signal);if(id===shippingGeneration){shippingKey=key;update();message('Shipping and tax updated.');}}catch(error){if(error.name!=='AbortError')message(error.message);}},450);
 }
 async function submit(event){
  event.preventDefault();if(busy)return;
  try{
   const form=$('wep-inline-form');for(const key of ['firstName','lastName','email','phone','address1','city','state','zip'])form.elements.namedItem(key).required=true;
   if(!form.reportValidity())return;
   const s=fresh(),q=s.quote,c=customer();if(q.fulfillment==='SHIP'){const key=a=>JSON.stringify(['address1','address2','city','state','zip'].map(k=>clean(a?.[k])));if(key(c)!==key(q.shippingDetails?.destination))throw Error('Wait for shipping and tax to update for this address.');}
   remember();
   if(!cardSupported(q)){const snapshot=WEPQuoteDocument.snapshot(q,c,reference());location.href='mailto:sales@westendpower.com?subject='+encodeURIComponent('Equipment order request — '+snapshot.reference)+'&body='+encodeURIComponent(WEPQuoteDocument.text(snapshot)+'\n\nPlease contact me to confirm this order.');message('Review and send the request in your email app. The store will contact you to confirm your order.');return;}
   if(!form.elements.namedItem('termsAccepted').checked)throw Error('Accept the order terms before continuing.');
   const customerData=Object.fromEntries(fields.filter(k=>k!=='notes').map(k=>[k,c[k]]));
   const body={items:s.selection.items,customer:customerData,fulfillment:q.fulfillment,zip:q.zip||'',shippingAddress:q.fulfillment==='SHIP'?q.shippingDetails.destination:undefined,paymentMethod:'credit',termsAccepted:true,termsVersion:q.terms.version,quoteFingerprint:q.fingerprint,testMode:s.testMode};
   const identity=JSON.stringify(body);let pending;try{pending=JSON.parse(sessionStorage.getItem('wepMarketplacePending')||'null');}catch(_){}
   if(!pending||pending.identity!==identity)pending={identity,requestKey:crypto.randomUUID(),cartSnapshot:localStorage.getItem('wepCart')||'[]',api:s.api};
   sessionStorage.setItem('wepMarketplacePending',JSON.stringify(pending));body.requestKey=pending.requestKey;busy=true;update();message('Preparing your order and secure payment…');
   const response=await fetch(s.api+'/marketplace-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await response.json().catch(()=>({}));
   if(!response.ok||result.ok!==true){if(response.status===409){sessionStorage.removeItem('wepMarketplacePending');lastQuote=null;WEPBuilderCheckout.review();}throw Error(result.error||'Payment could not start. Retry or contact a store.');}
   pending={...pending,orderNumber:result.orderNumber,checkoutToken:result.checkoutToken};sessionStorage.setItem('wepMarketplacePending',JSON.stringify(pending));
   if(result.alreadyPaid){location.assign('checkout-success.html?order='+encodeURIComponent(result.orderNumber)+(location.hostname==='localhost'||location.hostname==='127.0.0.1'?'&api=local':''));return;}
   const url=new URL(result.checkoutUrl);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Secure payment returned an invalid address.');location.assign(url.href);
  }catch(error){message(error.message);}finally{busy=false;update();}
 }
 window.WEPInlineCheckout={open};
 window.addEventListener('wep:build-pricing',event=>{mount();update();if(!event.detail?.quote&&opened)queueShipping();});
 window.addEventListener('pagehide',remember);
 const app=$('app');if(app)new MutationObserver(mount).observe(app,{childList:true,subtree:true});mount();
})();
