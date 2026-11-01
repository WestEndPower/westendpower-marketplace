(() => {
 'use strict';
 const brandNavigation=document.createElement('script');brandNavigation.src='https://westendpower.github.io/westendpower-marketplace/universal/brand-navigation.js?v=20261025-brandnav1';document.head.append(brandNavigation);
 const displayNames={BILLYGOAT:'Billy Goat',GREENWORKS:'Greenworks',HONDA:'Honda',MITM:'Mi-T-M',REDMAX:'RedMax',STIHL:'STIHL',TORO:'Toro',YANMAR:'Yanmar'};
 const colors={BILLYGOAT:'#00653d',GREENWORKS:'#447a12',HONDA:'#c00000',MITM:'#003b70',REDMAX:'#ba1425',STIHL:'#aa4b00',TORO:'#c00025',YANMAR:'#bb002a'};
 function initializeMenus(){document.querySelectorAll('.wep-nav').forEach(nav=>{
  if(nav.dataset.dropdownControlReady)return;nav.dataset.dropdownControlReady='1';
  const menus=Array.from(nav.querySelectorAll('details'));const closeOthers=keep=>menus.forEach(menu=>{if(menu!==keep)menu.open=false});
  nav.addEventListener('click',event=>{const summary=event.target.closest('summary');if(summary&&nav.contains(summary))closeOthers(summary.closest('details'));else if(event.target.closest('a,button'))closeOthers(null)});
  nav.addEventListener('toggle',event=>{if(event.target.matches('details')&&event.target.open)closeOthers(event.target)},true);
  document.addEventListener('click',event=>{if(!nav.contains(event.target))closeOthers(null)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeOthers(null)});
 });}
 function drawBrands(profiles){document.querySelectorAll('.wep-nav #wep-home-brands .wep-menu').forEach(menu=>{
  menu.replaceChildren();const all=document.createElement('a');all.textContent='All Brands';all.href=new URL('shop-by-brand.html',location.href).href;menu.append(all);
  [...profiles].sort((a,b)=>(displayNames[a.id]||a.name||a.id).localeCompare(displayNames[b.id]||b.name||b.id)).forEach(profile=>{
   const link=document.createElement('a');link.textContent=displayNames[profile.id]||profile.name||profile.id;link.style.color=colors[profile.id]||'#176A14';
   const url=new URL('shop-by-brand.html',location.href);url.searchParams.set('brand',profile.id);link.href=url.href;menu.append(link);
  });
 });}
 async function loadBrands(){if(Array.isArray(window.WESTEND_PUBLISHED_BRANDS)){drawBrands(window.WESTEND_PUBLISHED_BRANDS);return;}
  try{const response=await fetch(new URL('data/marketplace-catalog.json',document.baseURI),{cache:'no-cache'});if(!response.ok)throw Error('Catalog unavailable');const data=await response.json();
   const clean=v=>String(v??'').trim();const active=v=>/^(T|TRUE|Y|YES|1)$/i.test(clean(v));
   const profiles=(data.productSources||[]).filter(src=>{const ix=(src.headers||[]).indexOf('Active');return ix>=0&&(src.rows||[]).some(row=>{let value;if(src.encoding==='sparse'){for(let i=0;i<row.length;i+=2)if(row[i]===ix){value=row[i+1];break}}else value=row[ix];return active(value)})}).map(src=>({id:clean(src.brand).toUpperCase(),name:displayNames[clean(src.brand).toUpperCase()]||clean(src.brand)}));drawBrands(profiles);
  }catch(error){console.warn('Brand navigation will use its existing links until the catalog is available.',error);}
 }
 function start(){document.querySelectorAll('a[href*="marketplace.html?promo=1"]').forEach(link=>{link.href=new URL('promotions.html',document.currentScript?.src||'https://westendpower.github.io/westendpower-marketplace/').href;});initializeMenus();loadBrands();window.addEventListener('westend:catalog-ready',()=>drawBrands(window.WESTEND_PUBLISHED_BRANDS||[]));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
