/* WEP_QUOTE_HANDOFF_V2: review existing choices; enter customer information once. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let current=null;
 function sync(){
  $('selected-payment').textContent=$('payment-summary').textContent;
  $('selected-fulfillment').textContent=current?WEPQuoteDocument.fulfillmentLabel(WEPQuoteDocument.snapshot(current)):$('fulfillment-summary').textContent;
 }
 sync();
 new MutationObserver(sync).observe($('payment-summary'),{childList:true,subtree:true});
 new MutationObserver(sync).observe($('fulfillment-summary'),{childList:true,subtree:true});
 function needsReview(){document.body.classList.remove('checkout-preloaded');}
 window.addEventListener('wep:quote-cleared',()=>{current=null;sync();});
 window.addEventListener('wep:quote-stock-error',needsReview);
 window.addEventListener('wep:quote-error',needsReview);
 window.addEventListener('wep:quote-ready',event=>{
  const q=event.detail.quote;current=q;
  sync();
  const confirmed=WEPQuoteDocument.fulfillmentLabel(WEPQuoteDocument.snapshot(q));
  $('selected-fulfillment').textContent=confirmed;$('fulfillment-summary').textContent=confirmed;
  document.body.classList.add('checkout-preloaded');
  const edit=$('lines').querySelector('.quote-edit-options');if(edit)$('review-equipment').href=edit.href;
 });
})();
