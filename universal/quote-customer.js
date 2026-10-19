/* WEP_ALL_BRAND_QUOTE_CUSTOMER_V1 */
(function(){
 'use strict';
 const D=window.WEPQuoteDocument,$=id=>document.getElementById(id);
 let current=null,cartSnapshot='',reference='';
 const form=document.createElement('form');form.id='quote-customer';form.className='panel';
 form.innerHTML='<h2>Customer details for your quote</h2><p class="note">Add the details you want included on your printed or saved quote.</p><div class="customer-fields">'+[
  ['firstName','First name','given-name'],['lastName','Last name','family-name'],['companyName','Company (optional)','organization'],['phone','Phone','tel'],['email','Email','email'],['address1','Street address','address-line1'],['address2','Apartment / suite (optional)','address-line2'],['city','City','address-level2'],['state','State','address-level1'],['zip','ZIP','postal-code']
 ].map(([key,label,auto])=>'<label>'+label+'<input name="'+key+'" autocomplete="'+auto+'" maxlength="250"'+(key==='email'?' type="email"':key==='phone'?' type="tel"':'')+'></label>').join('')+'</div><label class="quote-notes">Customer notes (optional)<textarea name="notes" rows="3" maxlength="2000"></textarea></label>';
 $('choices').before(form);
 const save=document.createElement('button');save.id='save-quote';save.type='button';save.textContent='Save Quote Copy';save.disabled=true;
 $('print').after(save);
 const preview=document.createElement('div');preview.id='quote-customer-preview';preview.className='quote-customer-preview';
 $('lines').closest('.table-wrap').before(preview);
 function details(){return D.customer(Object.fromEntries(new FormData(form)));}
 function remember(){try{sessionStorage.setItem('wepQuoteCustomer',JSON.stringify(details()));}catch(_error){}}
 function fill(values,target,onlyBlank=false){for(const [key,value] of Object.entries(values||{})){const input=target?.elements.namedItem(key);if(input&&typeof value==='string'&&(!onlyBlank||!input.value))input.value=value;}}
 try{fill(JSON.parse(sessionStorage.getItem('wepCheckoutCustomer')||'{}'),form);fill(JSON.parse(sessionStorage.getItem('wepQuoteCustomer')||'{}'),form);}catch(_error){}
 fill(details(),$('payment-form'),true);
 $('payment-form').dispatchEvent(new Event('input',{bubbles:true}));
 function fresh(){return current&&cartSnapshot===(localStorage.getItem('wepCart')||'[]')&&Date.now()-Date.parse(current.createdAt)<300000;}
 function documentSnapshot(){if(!fresh())throw Error('Refresh current pricing before printing or saving your quote.');return D.snapshot(current,details(),reference);}
 function showDetails(){
  if(!current)return;
  try{
   const s=D.snapshot(current,details(),reference);preview.replaceChildren();
   for(const line of ['Quote reference: '+reference,...D.customerText(s),s.customer.notes?'Customer notes: '+s.customer.notes:''].filter(Boolean)){const p=document.createElement('p');p.textContent=line;preview.appendChild(p);}
   $('email').href='mailto:sales@westendpower.com?subject='+encodeURIComponent('Quote request — '+reference)+'&body='+encodeURIComponent(D.text(s));
  }catch(error){$('status').textContent=error.message;save.disabled=true;}
 }
 form.addEventListener('submit',e=>e.preventDefault());
 form.addEventListener('input',()=>{remember();fill(details(),$('payment-form'));$('payment-form').dispatchEvent(new Event('input',{bubbles:true}));showDetails();});
 $('payment-form').addEventListener('input',()=>{fill(Object.fromEntries(new FormData($('payment-form'))),form);remember();showDetails();});
 window.addEventListener('wep:quote-ready',event=>{
  current=event.detail.quote;cartSnapshot=event.detail.cartSnapshot;
  try{
   const saved=JSON.parse(sessionStorage.getItem('wepQuoteReference')||'null');
   reference=saved?.cart===cartSnapshot?saved.reference:'Q-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
   sessionStorage.setItem('wepQuoteReference',JSON.stringify({cart:cartSnapshot,reference}));
  }catch(_error){reference='Q-'+crypto.randomUUID().slice(0,12).toUpperCase();}
  save.disabled=false;showDetails();
 });
 window.addEventListener('wep:quote-cleared',()=>{current=null;save.disabled=true;});
 save.addEventListener('click',()=>{
  try{
   if(!form.reportValidity())return;
   const s=documentSnapshot(),blob=new Blob([D.html(s)],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=reference+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   $('status').textContent='Quote copy saved. Open it to view, print or save as PDF. No order or reservation was created.';
  }catch(error){$('status').textContent=error.message;}
 });
 $('print').addEventListener('click',event=>{try{if(!form.reportValidity())throw Error('Review customer details before printing.');documentSnapshot();showDetails();}catch(error){event.stopImmediatePropagation();$('status').textContent=error.message;}},true);
 $('email').addEventListener('click',event=>{try{if(!form.reportValidity())throw Error('Review customer details before requesting your quote.');documentSnapshot();showDetails();}catch(error){event.preventDefault();$('status').textContent=error.message;}});
 window.addEventListener('beforeprint',showDetails);
})();
