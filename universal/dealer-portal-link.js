/* Shared dealer entry point; business records remain behind the dealer sign-in. */
(()=>{
 'use strict';
 if(document.querySelector('.wep-dealer-portal-bar'))return;
 const url=new URL('https://westendpower-configurator-api.westendpower-nm.workers.dev/dealer-portal');
 if(location.pathname===url.pathname)return;
 const style=document.createElement('style');
 style.textContent='.wep-dealer-portal-bar{box-sizing:border-box;display:flex;justify-content:flex-end;width:100%;padding:5px max(18px,calc((100% - 1704px)/2));background:#176a14;font:700 13px/1.4 Arial,Helvetica,sans-serif}.wep-dealer-portal-bar a{display:inline-block;padding:5px 9px;border:1px solid #ffffff70;border-radius:5px;color:#fff;text-decoration:none;white-space:nowrap}.wep-dealer-portal-bar a:hover{background:#ffffff20}.wep-dealer-portal-bar a:focus-visible{outline:3px solid #efce65;outline-offset:2px}@media(max-width:560px){.wep-dealer-portal-bar{padding:5px 10px}}@media print{.wep-dealer-portal-bar{display:none!important}}';
 style.textContent+='\n.wep-dealer-portal-bar.wep-dealer-portal-inline{width:auto;flex:0 0 auto;padding:0;background:transparent;font-size:12px}.wep-dealer-portal-inline a{display:flex;align-items:center;justify-content:center;min-height:36px;padding:7px 9px;border-color:#647e67;color:#185b25;background:#fff}.wep-dealer-portal-inline a:hover{background:#eaf2e7}.market-searchbox:has(.wep-dealer-portal-inline){gap:7px}.market-searchbox:has(.wep-dealer-portal-inline) input{flex:1 1 auto;min-width:90px;width:0}@media(max-width:600px){.market-searchbox:has(.wep-dealer-portal-inline){flex-wrap:wrap}.market-searchbox:has(.wep-dealer-portal-inline) input{flex-basis:120px}.wep-dealer-portal-bar.wep-dealer-portal-inline{padding:0}}';
 style.textContent+='\n.market-header:has(.wep-dealer-portal-inline){position:relative}.market-header>.wep-dealer-portal-inline{position:absolute;right:14px;bottom:12px;margin:0}@media(max-width:600px){.market-header>.wep-dealer-portal-inline{position:static;grid-column:1/-1;justify-self:end}}';
 document.head.append(style);
 const bar=document.createElement('div');bar.className='wep-dealer-portal-bar';
 const link=document.createElement('a');link.href=url.href;link.textContent='Dealer Portal';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Dealer Portal (opens in a new tab)');bar.append(link);
 const mount=()=>{const clear=document.querySelector('#market-clear');const search=clear?.closest('.market-searchbox');if(search){bar.classList.add('wep-dealer-portal-inline');search.closest('.market-header').append(bar);}else document.body.prepend(bar);};
 if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();

