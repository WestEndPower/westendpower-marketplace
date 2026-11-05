/* Marketplace owns the header, navigation and price notice for all browse routes. */
(() => {
 'use strict';
 const root=new URL('../',document.currentScript.src);
 const domReady=document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
 window.WEPShoppingShellReady=(async()=>{
  if(document.getElementById('wep-generated-page')||location.pathname.endsWith('/marketplace.html'))return;
  if(!/\/shop-by-(?:product|brand)\.html$/.test(location.pathname))return;
  const [response]=await Promise.all([fetch(new URL('marketplace.html',root),{cache:'no-cache',credentials:'omit'}),domReady]);
  if(!response.ok)throw Error('Shared shopping header is unavailable.');
  const text=await response.text();if(text.length>600000)throw Error('Shared shopping header is too large.');
  const source=new DOMParser().parseFromString(text,'text/html');
  const portal=document.querySelector('.wep-dealer-portal-bar');
  for(const selector of ['.market-header','#we-shared-nav','footer.shop-notice']){
   const existing=document.querySelector(selector),replacement=source.querySelector(selector);
   if(!existing||!replacement)throw Error('Shared shopping section is missing.');
   if(selector==='#we-shared-nav'){
    replacement.querySelectorAll('[aria-current]').forEach(link=>link.removeAttribute('aria-current'));
    replacement.querySelector('a[href="'+(location.pathname.endsWith('/shop-by-product.html')?'shop-by-product.html':'shop-by-brand.html')+'"]')?.setAttribute('aria-current','page');
   }
   existing.replaceWith(document.importNode(replacement,true));
  }
  if(portal)document.querySelector('.market-header').append(portal);
  window.dispatchEvent(new CustomEvent('wep:shopping-shell-ready'));
 })().catch(error=>console.warn('Using the existing shopping header until the shared version is available.',error));
})();
