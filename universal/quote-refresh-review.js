/* Only refreshed shared quotes receive this introduction and optional Toro confirmation. */
(function(){
 'use strict';
 if(!window.WEPQuoteRefresh||window.WEPQuoteRefreshError)return;
 const selection=window.WEPQuoteRefresh,form=document.getElementById('choices'),notice=document.createElement('section');notice.className='quote-refresh-notice';
 const heading=document.createElement('h2');heading.textContent='Current pricing and financing';
 const text=document.createElement('p');text.textContent='This is a new estimate for your quoted equipment and options. Your original quote is unchanged. Choose a current payment option and review availability.';
 notice.append(heading,text);document.querySelector('.quote-page-title').after(notice);
 if(selection.hadSpecialProgram){const message=document.createElement('p');message.textContent='If a special program applied to your original quote, confirm your eligibility again below. Unavailable programs cannot be carried forward.';notice.append(message);}
 if(!selection.items.some(l=>l.brandId==='TORO'))return;
 const ui=window.WEPToroCustomerOptions;ui.restore(window.WEPCheckoutSelection||{toroFreightMethod:selection.toroFreightMethod});ui.mount(notice);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 const post=async(path,body,signal)=>{const r=await fetch(WEPCheckout.api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal}),v=await r.json();if(!r.ok||v.ok!==true)throw Error('Program eligibility could not be checked. Please retry or contact the store.');return v;};
 ui.load(WEPCheckout.context(),post,controller.signal).catch(error=>{const message=document.createElement('p');message.textContent=error.name==='AbortError'?'Program eligibility took too long. Refresh this page to retry.':error.message;notice.append(message);}).finally(()=>clearTimeout(timer));
 window.addEventListener('wep:toro-choice',()=>{
  const choices=ui.choices();window.WEPCheckoutSelection={...window.WEPCheckoutSelection,dealerPrograms:choices.dealerPrograms||{},toroFreightMethod:choices.toroFreightMethod||'DEALER_SHIP_DAY'};
  const cash=form.querySelector('[name="paymentMethod"][value="cash"]');if(!cash.disabled)cash.checked=true;
  form.dispatchEvent(new Event('change',{bubbles:true}));WEPCheckout.refresh();
 });
})();
