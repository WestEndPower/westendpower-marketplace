/* WEP_MARKETPLACE_PAYMENT_CONFIRMATION_V1 */
(function(){'use strict';const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
let busy=false;const params=new URLSearchParams(location.search),local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);const api=local&&params.get('api')==='local'?'http://127.0.0.1:8787':'https://westendpower-configurator-api.westendpower-nm.workers.dev';
async function check(){if(busy)return;busy=true;$('retry').disabled=true;
 try{
  const pending=JSON.parse(sessionStorage.getItem('wepMarketplacePending')||'null');
  if(!pending?.orderNumber||!pending.checkoutToken||pending.orderNumber!==params.get('order'))throw Error('Payment cannot be confirmed from this browser. Contact your store with the order number shown in your Stripe receipt.');
  const response=await fetch(api+'/marketplace-order-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:pending.orderNumber,checkoutToken:pending.checkoutToken})});const result=await response.json();
  if(!response.ok||result.ok!==true)throw Error(result.error||'Payment confirmation is temporarily unavailable.');
  if(result.paymentStatus!=='PAID'){$('heading').textContent='Payment awaiting confirmation';$('status').textContent='Your order is saved. Select Check Payment Status Again shortly. If Stripe showed a completed payment, contact your store before making another payment.';return;}
  $('heading').textContent=result.testMode?'Stripe test payment confirmed':'Payment confirmed';$('status').textContent=result.testMode?'TEST ONLY — no real payment or paid-order email was sent.':'Thank you. Availability will be confirmed before your order is processed.';
  const q=result.quote;$('order').textContent='Order '+result.orderNumber;$('store').textContent='Pickup · '+(q.fulfillment==='NEW_MILFORD'?'New Milford':'Danbury');
  $('items').innerHTML=q.lines.map(l=>'<tr><td><strong>'+esc(l.productName)+'</strong><small>'+esc(l.brandId)+' · SKU '+esc(l.sku)+'</small></td><td>'+l.quantity+'</td><td>'+fmt(l.unitPrice)+'</td><td>'+fmt(l.itemTotal)+'</td><td>'+fmt(l.setupTotal)+'</td></tr>').join('');
  $('totals').innerHTML=[['Merchandise',q.merchandise],['Installation / Set-Up',q.installation],['Factory freight',q.freight],['Subtotal',q.subtotal],['CT sales tax',q.tax],[result.testMode?'Test payment total':'Total paid',q.total]].map(([name,value],i)=>'<div'+(i===5?' class="total"':'')+'><dt>'+name+'</dt><dd>'+fmt(value)+'</dd></div>').join('');$('receipt').hidden=false;
  // Retain test carts, and retain any cart edited after the submitted snapshot.
  if(!result.testMode&&localStorage.getItem('wepCart')===pending.cartSnapshot)localStorage.setItem('wepCart','[]');
 }catch(error){$('heading').textContent='Payment confirmation needs review';$('status').textContent=error.message;}finally{busy=false;$('retry').disabled=false;}}
$('retry').onclick=check;$('print').onclick=()=>window.print();check();})();
