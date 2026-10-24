/* Shared dealer entry point; business records remain behind the dealer sign-in. */
(()=>{
 'use strict';
 if(document.querySelector('.wep-dealer-portal-bar'))return;
 const script=document.currentScript,url=new URL('../dealer-portal.html',script?.src||new URL('universal/dealer-portal-link.js',document.baseURI));
 if(location.pathname===url.pathname)return;
 const style=document.createElement('style');
 style.textContent='.wep-dealer-portal-bar{box-sizing:border-box;display:flex;justify-content:flex-end;width:100%;padding:5px max(18px,calc((100% - 1704px)/2));background:#176a14;font:700 13px/1.4 Arial,Helvetica,sans-serif}.wep-dealer-portal-bar a{display:inline-block;padding:5px 9px;border:1px solid #ffffff70;border-radius:5px;color:#fff;text-decoration:none;white-space:nowrap}.wep-dealer-portal-bar a:hover{background:#ffffff20}.wep-dealer-portal-bar a:focus-visible{outline:3px solid #efce65;outline-offset:2px}@media(max-width:560px){.wep-dealer-portal-bar{padding:5px 10px}}@media print{.wep-dealer-portal-bar{display:none!important}}';
 document.head.append(style);
 const bar=document.createElement('div');bar.className='wep-dealer-portal-bar';
 const link=document.createElement('a');link.href=url.href;link.textContent='Dealer Portal';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Dealer Portal (opens in a new tab)');bar.append(link);
 const mount=()=>document.body.prepend(bar);
 if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
