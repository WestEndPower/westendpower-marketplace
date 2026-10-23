// Staff-opened Build Your Own session. Only SKU selections return; the API prices them again.
(function(){
 'use strict';
 const editId=new URLSearchParams(location.search).get('dealerEdit');
 if(!location.hash.startsWith('#dealer-edit=')&&!editId)return;
 let seed;
 try{
  if(location.hash.startsWith('#dealer-edit=')){const value=decodeURIComponent(location.hash.slice(13));if(value.length>50000)throw Error('Invalid edit session.');seed=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0))));}
  else seed=JSON.parse(sessionStorage.getItem('wepDealerEditSeed:'+editId)||'null');
  if(seed.returnOrigin!=='https://westendpower-configurator-api.westendpower-nm.workers.dev'||!window.opener||!Number.isInteger(seed.quoteId)||seed.quoteId<1||!/^[-a-zA-Z0-9]{20,80}$/.test(seed.nonce)||!Array.isArray(seed.draft?.items)||seed.draft.items.length>20)throw Error('Invalid edit session.');
 }catch(e){document.addEventListener('DOMContentLoaded',()=>{const p=document.createElement('p');p.textContent='Open this equipment again from the Sales & Profit Center.';document.body.prepend(p);});return;}
 const real=window.localStorage,prefix='wepDealerCart:'+seed.quoteId+':'+seed.nonce;
 const storage={getItem:k=>k==='wepCart'?sessionStorage.getItem(prefix):real.getItem(k),setItem:(k,v)=>k==='wepCart'?sessionStorage.setItem(prefix,v):real.setItem(k,v),removeItem:k=>k==='wepCart'?sessionStorage.removeItem(prefix):real.removeItem(k)};
 const draft={...seed.draft},brand=String(draft.brandId).toUpperCase(),sku=String(draft.sku),group=brand+':'+sku;
 draft.brandId=brand;draft.programId=draft.programId||draft.financeProgramIds?.[brand]||'';
 if(storage.getItem('wepCart')===null){const editable=draft.items.map(l=>({...l,inventoryId:'',packageId:group}));storage.setItem('wepCart',JSON.stringify(editable));sessionStorage.setItem('wepBuildDraft:'+brand+':'+sku,JSON.stringify({...draft,items:editable,paymentConfirmed:true,updated:Date.now()}));}
 sessionStorage.setItem('wepDealerEditSeed:'+seed.nonce,JSON.stringify(seed));
 window.WEPDealerOrderEdit={storage,quoteId:seed.quoteId};
 const sessionUrl=new URL(location.href);sessionUrl.searchParams.set('dealerEdit',seed.nonce);sessionUrl.hash='';history.replaceState(null,'',sessionUrl.href);
 let pendingRequest='',handoffTimer;
 const pending=value=>{for(const button of document.querySelectorAll('[data-dealer-handoff]'))button.disabled=value;};
 window.addEventListener('message',event=>{
  if(event.origin!==seed.returnOrigin||event.source!==window.opener||event.data?.type!=='wep:dealer-build-result'||event.data?.nonce!==seed.nonce||Number(event.data?.quoteId)!==seed.quoteId||!pendingRequest||event.data?.requestId!==pendingRequest)return;
  clearTimeout(handoffTimer);pendingRequest='';pending(false);
  if(event.data.ok===true){window.close();return;}
  document.getElementById('dealer-edit-status').textContent=event.data.error||'The changes could not be reviewed. Please try again.';
 });
 const save=()=>{
  if(pendingRequest)return;
  const current=window.WEPBuilderCheckout?.current();
  const status=document.getElementById('dealer-edit-status');
  if(!current?.selection?.items?.length){status.textContent='Wait for the equipment options to load.';return;}
  if(!['cash','credit','finance'].includes(current.selection.paymentMethod)){status.textContent='Choose a payment option before returning.';return;}
  pendingRequest=crypto.randomUUID();pending(true);
  window.opener.postMessage({type:'wep:dealer-build-save',requestId:pendingRequest,quoteId:seed.quoteId,nonce:seed.nonce,selection:{...current.selection,items:current.selection.items.map(l=>{const old=draft.items.find(x=>x.brandId===l.brandId&&x.type===l.type&&x.sku===l.sku&&x.quantity===l.quantity);return {...l,inventoryId:l.inventoryId||old?.inventoryId||''};})}},seed.returnOrigin);
  status.textContent='Sending changes to '+seed.reference+' for review…';
  handoffTimer=setTimeout(()=>{pendingRequest='';pending(false);status.textContent='The quote did not confirm receipt. Keep this tab open, refresh the original quote, then try again.';},45000);
 };
 document.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(link){const url=new URL(link.href,location.href);if(url.origin===location.origin&&/\/(?:product-options|choose-implements)\.html$/i.test(url.pathname)){url.searchParams.set('dealerEdit',seed.nonce);link.href=url.href;}}if(e.target.closest('#wep-build-checkout,#review-package,a[href*="checkout.html"]')){e.preventDefault();e.stopImmediatePropagation();save();}},true);
 document.addEventListener('DOMContentLoaded',()=>{
  const bar=document.createElement('aside');bar.style.cssText='position:sticky;top:0;z-index:10000;background:#edf4ea;border-bottom:2px solid #287a32;padding:12px 20px;display:flex;gap:15px;align-items:center;flex-wrap:wrap;font:14px Arial,sans-serif';
  const label=document.createElement('strong');label.textContent='Editing '+seed.reference;
  const button=document.createElement('button');button.type='button';button.setAttribute('data-dealer-handoff','');button.textContent='Add Changes to Quote / Order';button.style.cssText='padding:9px 14px;background:#287a32;color:white;border:0;border-radius:4px;cursor:pointer';button.onclick=save;
  const status=document.createElement('span');status.id='dealer-edit-status';status.setAttribute('role','status');status.textContent='Review and save changes in the Sales & Profit Center. Existing stock selections remain attached; use its Equipment editor to change the stock unit.';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel & Return to Quote / Order';cancel.style.cssText='padding:9px 14px;background:white;color:#245c35;border:1px solid #287a32;border-radius:4px;cursor:pointer';cancel.onclick=()=>{clearTimeout(handoffTimer);pendingRequest='';status.textContent='Changes cancelled. Return to the original quote / order tab.';window.close();};
  bar.append(label,button,cancel,status);document.body.prepend(bar);
 });
})();
