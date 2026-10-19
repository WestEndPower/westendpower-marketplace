/* WEP_QUOTE_REVIEW_FEEDBACK_V1 */
(function(){
 'use strict';
 const form=document.getElementById('choices'),button=document.getElementById('update'),status=document.getElementById('status');
 function reason(){
  const messages=[];
  if(window.WEPQuoteStock&&!window.WEPQuoteStock.ready())messages.push('Wait for the inventory check or choose an available pricing source.');
  if(!form.querySelector('[name="fulfillment"]:checked'))messages.push('Choose a pickup store, local delivery or shipping.');
  const payment=form.querySelector('[name="paymentMethod"]:checked');
  if(!payment)messages.push('Choose Cash / check, Credit card or Financing.');
  if(payment?.value==='finance'){
   const selects=[...form.querySelectorAll('[data-finance-brand]')];
   if(!selects.length)messages.push(document.getElementById('finance-options').textContent.trim()||'Wait for financing programs to load.');
   else for(const select of selects)if(!select.value)messages.push('Choose a financing program for '+select.dataset.financeBrand+'.');
  }
  if(form.querySelector('[name="fulfillment"]:checked')?.value==='DELIVERY'&&!document.getElementById('zip').validity.valid)messages.push('Enter a five-digit delivery ZIP.');
  return messages.join(' ');
 }
 function report(){const message=reason();if(message&&document.getElementById('review').hidden)status.textContent=message;}
 form.addEventListener('invalid',()=>{status.textContent=reason()||'Complete the highlighted field before reviewing pricing.';},true);
 form.addEventListener('change',()=>queueMicrotask(report));
 new MutationObserver(report).observe(button,{attributes:true,attributeFilter:['disabled']});
 new MutationObserver(report).observe(document.getElementById('finance-options'),{childList:true,subtree:true});
 queueMicrotask(report);
})();
