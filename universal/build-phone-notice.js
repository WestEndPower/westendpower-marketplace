/* WEP_BUILD_PHONE_NOTICE_V1: phone-only guidance before opening the equipment builder. */
(function(){
 'use strict';
 const seenKey='wepBuildPhoneNotice:v1';
 let seen=false,dialog,sourceLink,destination,shareUrl;
 function isPhone(){
  const ua=navigator.userAgent||'';
  if(/iPad|Tablet/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1))return false;
  if(typeof navigator.userAgentData?.mobile==='boolean')return navigator.userAgentData.mobile;
  return /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua);
 }
 function alreadySeen(){try{return seen||sessionStorage.getItem(seenKey)==='1';}catch(_){return seen;}}
 function markSeen(){seen=true;try{sessionStorage.setItem(seenKey,'1');}catch(_){}}
 function publicBuildLink(href){
  const input=new URL(href,location.href);
  if(input.origin!==location.origin||!/^https?:$/.test(input.protocol))return null;
  const brand=input.searchParams.get('brand'),sku=input.searchParams.get('sku');
  if(!brand||!sku)return null;
  const link=new URL('product-options.html',input);
  link.search='';link.hash='';
  link.searchParams.set('brand',brand);link.searchParams.set('sku',sku);
  return link.href;
 }
 function fallback(message){
  dialog.querySelector('[data-phone-fallback]').hidden=false;
  dialog.querySelector('[data-phone-link]').value=shareUrl;
  dialog.querySelector('[data-phone-email]').href='mailto:?'+new URLSearchParams({subject:'My West End Power equipment build',body:'Open this equipment build on your tablet or computer:\n\n'+shareUrl}).toString().replace(/\+/g,'%20');
  dialog.querySelector('[data-phone-status]').textContent=message||'Email this link to yourself, or copy it to open on another device.';
 }
 async function share(){
  const status=dialog.querySelector('[data-phone-status]');
  if(typeof navigator.share!=='function'){fallback();return;}
  try{
   await navigator.share({title:'My West End Power equipment build',text:'Open my equipment build on a tablet or computer.',url:shareUrl});
   status.textContent='Link shared. You can also continue on this phone.';
  }catch(error){if(error.name!=='AbortError')fallback('You can email or copy the link below.');}
 }
 async function copy(){
  const status=dialog.querySelector('[data-phone-status]'),input=dialog.querySelector('[data-phone-link]');
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(shareUrl);status.textContent='Link copied. Paste it into a text or email to yourself.';
  }catch(_){input.focus();input.select();status.textContent='Touch and hold the selected link, then choose Copy.';}
 }
 function createDialog(){
  const style=document.createElement('style');
  style.textContent='#wep-build-phone-notice{box-sizing:border-box;width:calc(100% - 28px);max-width:460px;max-height:calc(100dvh - 28px);overflow:auto;padding:22px;border:1px solid #c5cec7;border-top:5px solid #287a32;border-radius:14px;background:#fff;color:#202020;font:16px/1.5 Arial,sans-serif;box-shadow:0 12px 42px #0004}#wep-build-phone-notice::backdrop{background:#0008}#wep-build-phone-notice h2{margin:0 0 10px;font-size:23px}#wep-build-phone-notice p{margin:0 0 18px}#wep-build-phone-notice .wep-phone-actions{display:grid;gap:10px}#wep-build-phone-notice button,#wep-build-phone-notice .wep-phone-email{box-sizing:border-box;display:block;width:100%;min-height:46px;padding:10px 14px;border:1px solid #7b897f;border-radius:8px;background:#fff;color:#225c30;text-align:center;font:700 16px/1.4 Arial,sans-serif;cursor:pointer;text-decoration:none}#wep-build-phone-notice [data-phone-continue]{border-color:#287a32;background:#287a32;color:#fff}#wep-build-phone-notice button:focus-visible,#wep-build-phone-notice a:focus-visible{outline:3px solid #287a32;outline-offset:3px}#wep-build-phone-notice [data-phone-fallback]{margin-top:16px}#wep-build-phone-notice [hidden]{display:none!important}#wep-build-phone-notice input{box-sizing:border-box;width:100%;padding:10px;margin:6px 0 10px;border:1px solid #7b897f;border-radius:6px;font-size:16px}#wep-build-phone-notice [data-phone-status]{margin:12px 0 0;font-size:14px}';
  document.head.append(style);
  dialog=document.createElement('dialog');dialog.id='wep-build-phone-notice';
  dialog.setAttribute('aria-labelledby','wep-phone-title');dialog.setAttribute('aria-describedby','wep-phone-description');
  dialog.innerHTML='<h2 id="wep-phone-title">For easier viewing</h2><p id="wep-phone-description">Building your equipment package works best on a tablet or computer, where you can see options, pricing and payments together.</p><div class="wep-phone-actions"><button type="button" data-phone-continue autofocus>Continue on Phone</button><button type="button" data-phone-share>Share / Send Link</button><button type="button" data-phone-back>Go Back</button></div><div data-phone-fallback hidden><a class="wep-phone-email" data-phone-email>Email Link to Myself</a><label>Equipment link<input data-phone-link type="url" readonly></label><button type="button" data-phone-copy>Copy Link</button></div><p data-phone-status role="status" aria-live="polite"></p>';
  dialog.querySelector('[data-phone-continue]').onclick=()=>{const href=destination;dialog.close();location.assign(href);};
  dialog.querySelector('[data-phone-share]').onclick=share;
  dialog.querySelector('[data-phone-copy]').onclick=copy;
  dialog.querySelector('[data-phone-back]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>sourceLink?.focus());
  document.body.append(dialog);
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a.market-product-page-link');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!isPhone()||alreadySeen())return;
  const url=publicBuildLink(link.href);if(!url||typeof HTMLDialogElement==='undefined'||typeof HTMLDialogElement.prototype.showModal!=='function')return;
  try{
   if(!dialog)createDialog();sourceLink=link;destination=link.href;shareUrl=url;
   dialog.querySelector('[data-phone-fallback]').hidden=true;dialog.querySelector('[data-phone-status]').textContent='';
   dialog.showModal();markSeen();event.preventDefault();
  }catch(_){/* If the notice is unavailable, the original equipment link still works. */}
 });
})();
