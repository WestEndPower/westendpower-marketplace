/* WEP_EQUIPMENT_RETURN_V1: preserve browsing position and relocate the return action. */
(function(){
 'use strict';
 const key='wepEquipmentDeparture',restoreKey='wepEquipmentRestore';
 const cleanUrl=value=>{try{const u=new URL(value,location.href);return u.origin===location.origin&&/^https?:$/.test(u.protocol)?u.href:'';}catch(_error){return '';}};
 const read=name=>{try{return JSON.parse(sessionStorage.getItem(name)||'null');}catch(_error){return null;}};
 const write=(name,value)=>{try{sessionStorage.setItem(name,JSON.stringify(value));}catch(_error){}};
 const buildPage=/\/product-options(?:\.html)?\/?$/i.test(location.pathname);
 let departure=read(key);
 // Record the actual source URL, including filters, before opening the builder.
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const a=event.target.closest?.('a[href]');if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
  const dest=cleanUrl(a.href);if(!dest||! /\/product(?:-options)?(?:\.html)?\/?$/i.test(new URL(dest).pathname))return;
  write(key,{source:location.href,destination:dest,x:scrollX,y:scrollY,time:Date.now()});
 },true);
 // Browser Back normally restores scrolling; retry after asynchronous cards load.
 function restorePosition(){
  const target=read(restoreKey);if(!target||cleanUrl(target.source)!==location.href||Date.now()-target.time>120000)return;
  try{sessionStorage.removeItem(restoreKey);}catch(_error){}
  const x=Math.max(0,Number(target.x)||0),y=Math.max(0,Number(target.y)||0),deadline=Date.now()+10000;
  let stopped=false,stableAt=0,timer;
  const stop=()=>{stopped=true;clearTimeout(timer);for(const name of ['wheel','touchstart','keydown','pointerdown'])window.removeEventListener(name,stop);};
  for(const name of ['wheel','touchstart','keydown','pointerdown'])window.addEventListener(name,stop,{once:true,passive:true});
  function step(){
   if(stopped)return;
   if(Date.now()>deadline){stop();return;}
   const height=document.scrollingElement?.scrollHeight||document.documentElement.scrollHeight;
   if(height-innerHeight>=y-2){
    const behavior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';
    window.scrollTo({left:x,top:y,behavior:'instant'});document.documentElement.style.scrollBehavior=behavior;
    if(Math.abs(scrollY-y)<3){stableAt ||= Date.now();if(Date.now()-stableAt>500){stop();return;}}else stableAt=0;
   }
   timer=setTimeout(step,80);
  }
  step();
 }
 window.addEventListener('pageshow',restorePosition);restorePosition();
 if(!buildPage)return;
 const oldLink=document.getElementById('return-link');if(!oldLink)return;
 const strip=oldLink.closest('.top');
 const style=document.createElement('style');style.textContent='.wrap>.top:has(#return-link){display:none!important}.summary-actions #return-link{order:99;display:flex;justify-content:center;align-items:center;width:100%;margin-top:6px;padding:10px 8px;font-size:13px;line-height:1.35;text-align:center;background:#fff;color:#202020;border:1px solid #aaa;border-radius:8px;text-decoration:none;font-weight:800}@media print{#return-link{display:none!important}}';document.head.append(style);
 let fallback=oldLink.href;
 const referrer=cleanUrl(document.referrer);
 const validDeparture=()=>{
  if(!departure||Date.now()-departure.time>1800000||!cleanUrl(departure.source))return false;
  try{
   const dest=new URL(departure.destination),current=new URL(location.href);
   return dest.origin===current.origin&&dest.searchParams.get('brand')?.toUpperCase()===current.searchParams.get('brand')?.toUpperCase()&&dest.searchParams.get('sku')===current.searchParams.get('sku');
  }catch(_error){return false;}
 };
 function mount(){
  const actions=document.querySelector('.summary-actions');if(!actions)return;
  // updateReturn runs before the async product render. Keep its safe fallback URL.
  if(oldLink.parentElement!==actions){fallback=oldLink.href;actions.append(oldLink);strip?.remove();}
  if(oldLink.textContent!=='← Return to Equipment')oldLink.textContent='← Return to Equipment';
  const source=validDeparture()?cleanUrl(departure.source):referrer;
  if(source&&source!==location.href)oldLink.href=source;
 }
 oldLink.addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  const hasSource=validDeparture();
  // Use browser history only when there is evidence of a previous page on this site.
  const fromThisSite=referrer&&referrer!==location.href;
  const source=hasSource?cleanUrl(departure.source):(fromThisSite?referrer:cleanUrl(fallback));
  if(hasSource)write(restoreKey,{source,x:departure.x,y:departure.y,time:Date.now()});
  // A price-tag link opens Build & Buy in a separate tab. Closing that tab reveals
  // the original equipment results with their filters, position and selections intact.
  if(history.length<=1&&fromThisSite){
   window.close();
   // Browsers may refuse to close a manually opened tab; retain a normal return path.
   setTimeout(()=>{if(source)location.assign(source);},150);
   return;
  }
  if(history.length>1&&fromThisSite){history.back();return;}
  if(source)location.assign(source);
 });
 const app=document.getElementById('app');if(app)new MutationObserver(mount).observe(app,{childList:true,subtree:true});
 mount();
})();
