// Staff-opened Build & Buy. Only selections return; the quote API validates every revision.
(function(){
 'use strict';
 const query=new URLSearchParams(location.search),editId=query.get('dealerEdit');
 if(!location.hash.startsWith('#dealer-edit=')&&!editId)return;
 let seed;
 try{
  if(location.hash.startsWith('#dealer-edit=')){const value=decodeURIComponent(location.hash.slice(13));if(value.length>50000)throw Error('Invalid edit session.');seed=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0))));}
  else seed=JSON.parse(sessionStorage.getItem('wepDealerEditSeed:'+editId)||'null');
  if(seed?.returnOrigin!=='https://westendpower-configurator-api.westendpower-nm.workers.dev'||!window.opener||!Number.isInteger(seed.quoteId)||seed.quoteId<1||!/^[-a-zA-Z0-9]{20,80}$/.test(seed.nonce)||!Array.isArray(seed.draft?.items)||!seed.draft.items.length||seed.draft.items.length>20)throw Error('Invalid edit session.');
 }catch(error){document.addEventListener('DOMContentLoaded',()=>{const p=document.createElement('p');p.textContent='Open this equipment again from the Sales & Profit Center.';document.body.prepend(p);});return;}
 const real=window.localStorage,prefix='wepDealerCart:'+seed.quoteId+':'+seed.nonce;
 const storage={getItem:key=>key==='wepCart'?sessionStorage.getItem(prefix):real.getItem(key),setItem:(key,value)=>key==='wepCart'?sessionStorage.setItem(prefix,value):real.setItem(key,value),removeItem:key=>key==='wepCart'?sessionStorage.removeItem(prefix):real.removeItem(key)};
 const draft=structuredClone(seed.draft),brand=String(draft.brandId).toUpperCase(),sku=String(draft.sku),group=brand+':'+sku,lineKey=line=>[line.brandId,line.type||'tool',String(line.sku).toUpperCase()].join(':');
 const checkout=/\/checkout\.html$/i.test(location.pathname);
 draft.brandId=brand;draft.programId=draft.programId||draft.financeProgramIds?.[brand]||'';
 // A staff choice is preselected for review, not saved eligibility confirmation.
 for(const choice of Object.values(draft.dealerPrograms||{}))choice.verified=true;
 const cart=()=>JSON.parse(storage.getItem('wepCart')||'[]');
 const saveContext=context=>sessionStorage.setItem('wepCheckoutReviewSelection',JSON.stringify({cart:storage.getItem('wepCart'),context,updated:Date.now()}));
 if(storage.getItem('wepCart')===null){
  const editable=draft.items.map(line=>{const tools=draft.items.filter(main=>main.type==='tool'&&main.brandId===line.brandId);return {...line,inventoryId:'',quoteStockChoice:'orderable',packageId:line.packageId||(line.type==='tool'?line.brandId+':'+line.sku:tools.length===1?tools[0].brandId+':'+tools[0].sku:'')};});
  storage.setItem('wepCart',JSON.stringify(editable));
  for(const main of editable.filter(line=>line.type==='tool')){const packageId=main.packageId;sessionStorage.setItem('wepBuildDraft:'+main.brandId+':'+main.sku,JSON.stringify({...draft,brandId:main.brandId,sku:main.sku,programId:draft.financeProgramIds?.[main.brandId]||'',items:editable.filter(line=>line.packageId===packageId),paymentConfirmed:true,updated:Date.now()}));}
  saveContext({...draft,items:editable});
 }
 window.WEPBuildStorage=storage;window.WEPDealerOrderEdit={storage,quoteId:seed.quoteId,fullQuote:seed.fullQuote===true};
 sessionStorage.setItem('wepDealerEditSeed:'+seed.nonce,JSON.stringify(seed));
 const url=new URL(location.href);url.searchParams.set('dealerEdit',seed.nonce);url.hash='';history.replaceState(null,'',url.href);
 let pendingRequest='',handoffTimer;
 const pending=value=>document.querySelectorAll('[data-dealer-handoff]').forEach(button=>button.disabled=value);
 window.addEventListener('message',event=>{
  if(event.origin!==seed.returnOrigin||event.source!==window.opener||event.data?.type!=='wep:dealer-build-result'||event.data?.nonce!==seed.nonce||Number(event.data?.quoteId)!==seed.quoteId||!pendingRequest||event.data?.requestId!==pendingRequest)return;
  clearTimeout(handoffTimer);pendingRequest='';pending(false);
  if(event.data.ok===true){window.close();return;}
  document.getElementById('dealer-edit-status').textContent=event.data.error||'The changes could not be reviewed. Please try again.';
 });
 function combined(selection){
  const mainBrand=String(selection.brandId||brand).toUpperCase(),packageId=mainBrand+':'+(selection.sku||sku);
  const existing=cart(),rows=selection.items.map(line=>({...line,packageId:line.packageId??existing.find(old=>lineKey(old)===lineKey(line))?.packageId??packageId}));
  if(checkout)return {...selection,items:rows};
  const replaced=query.get('dealerPackage')||packageId,other=existing.filter(line=>line.packageId!==replaced&&line.packageId!==packageId),saved=JSON.parse(sessionStorage.getItem('wepCheckoutReviewSelection')||'null')?.context||draft;
  const dealerPrograms={...saved.dealerPrograms};if(selection.dealerPrograms?.[mainBrand])dealerPrograms[mainBrand]=selection.dealerPrograms[mainBrand];else delete dealerPrograms[mainBrand];
  return {...saved,...selection,items:[...other,...rows],dealerPrograms,financeProgramIds:{...saved.financeProgramIds,...selection.financeProgramIds,...(selection.programId?{[mainBrand]:selection.programId}:{})},financeDownPayments:{...saved.financeDownPayments,...selection.financeDownPayments}};
 }
 const save=()=>{
  if(pendingRequest)return;
  const current=checkout?window.WEPCheckout?.current():window.WEPBuilderCheckout?.current(),status=document.getElementById('dealer-edit-status');
  if(!current?.selection?.items?.length||!current.quote||!current.paymentConfirmed){status.textContent='Choose a compatible payment option and wait for current pricing before returning.';return;}
  const selection=combined(current.selection);
  storage.setItem('wepCart',JSON.stringify(selection.items));saveContext(selection);
  // Several packages must review their complete financing together in Build & Buy.
  if(!checkout&&selection.items.some(line=>line.packageId!==(current.selection.brandId+':'+current.selection.sku))){location.assign('checkout.html?dealerEdit='+encodeURIComponent(seed.nonce));return;}
  selection.items=selection.items.map(line=>{const old=draft.items.find(x=>lineKey(x)===lineKey(line)&&x.quantity===line.quantity);return {...line,inventoryId:line.inventoryId||old?.inventoryId||''};});
  pendingRequest=crypto.randomUUID();pending(true);
  window.opener.postMessage({type:'wep:dealer-build-save',requestId:pendingRequest,quoteId:seed.quoteId,nonce:seed.nonce,selection},seed.returnOrigin);
  status.textContent='Sending changes to '+seed.reference+' for final review…';
  handoffTimer=setTimeout(()=>{pendingRequest='';pending(false);status.textContent='The quote did not confirm receipt. Keep this tab open and return to the original quote.';},45000);
 };
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');if(link){const target=new URL(link.href,location.href);if(target.origin===location.origin&&/\/(?:product-options|choose-implements|checkout)\.html$/i.test(target.pathname)){target.searchParams.set('dealerEdit',seed.nonce);if(/product-options\.html$/i.test(target.pathname)){const targetGroup=String(target.searchParams.get('brand')||brand).toUpperCase()+':'+target.searchParams.get('sku');target.searchParams.set('dealerPackage',cart().some(line=>line.packageId===targetGroup)?targetGroup:query.get('dealerPackage')||group);}link.href=target.href;}}
  if(event.target.closest('#wep-build-checkout,#review-package,#proceed-checkout,#open-customer-details,#pay,a[href*="checkout.html"]')){event.preventDefault();event.stopImmediatePropagation();save();}
 },true);
 document.addEventListener('DOMContentLoaded',()=>{
  const style=document.createElement('style');style.textContent='.wep-build-delivery,#fulfillment-editor,#customer-details,#quote-details,#email{display:none!important}';document.head.append(style);
  const bar=document.createElement('aside');bar.style.cssText='position:sticky;top:0;z-index:10000;background:#edf4ea;border-bottom:2px solid #287a32;padding:12px 20px;display:flex;gap:15px;align-items:center;flex-wrap:wrap;font:14px Arial,sans-serif';
  const label=document.createElement('strong');label.textContent='Editing '+seed.reference+' · Build & Buy';
  const button=document.createElement('button');button.type='button';button.setAttribute('data-dealer-handoff','');button.textContent='Review Updated Quote';button.onclick=save;
  const status=document.createElement('span');status.id='dealer-edit-status';status.setAttribute('role','status');status.textContent='Customer details, delivery charges and recorded payments stay on the original quote. Review before saving.';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel & Return to Quote / Order';cancel.onclick=()=>{clearTimeout(handoffTimer);pendingRequest='';window.close();};
  bar.append(label,button,cancel,status);document.body.prepend(bar);
  if(checkout){
   const editor=document.getElementById('payment-editor');if(editor)editor.open=true;
   if(draft.items.some(line=>line.brandId==='TORO')&&window.WEPToroCustomerOptions){
    const host=document.createElement('section');document.getElementById('choices').before(host);const ui=window.WEPToroCustomerOptions;ui.restore(window.WEPCheckoutSelection||draft);ui.mount(host);
    const controller=new AbortController();ui.load(window.WEPCheckout.context(),async(path,body,signal)=>{const response=await fetch(window.WEPCheckout.api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal}),value=await response.json();if(!response.ok||value.ok!==true)throw Error(value.error||'Program options are unavailable.');return value;},controller.signal).catch(error=>status.textContent=error.message);
    window.addEventListener('wep:toro-choice',()=>{const choice=ui.choices();window.WEPCheckoutSelection={...window.WEPCheckoutSelection,dealerPrograms:choice.dealerPrograms||{},toroFreightMethod:choice.toroFreightMethod||draft.toroFreightMethod};document.getElementById('choices').dispatchEvent(new Event('change',{bubbles:true}));window.WEPCheckout.refresh();});
   }
   if(seed.section!=='programs')editor?.scrollIntoView({block:'center'});
  }
 });
})();
