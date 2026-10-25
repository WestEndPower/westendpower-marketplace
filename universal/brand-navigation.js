/* Published builder pages and workbook brands share one navigation. */
(() => {
  'use strict';
  if(window.wepBrandNavigationReady)return;
  window.wepBrandNavigationReady=true;
  const market='https://westendpower.github.io/westendpower-marketplace/';
  const api='https://westendpower-configurator-api.westendpower-nm.workers.dev';
  const names={BILLYGOAT:'Billy Goat',GREENWORKS:'Greenworks',HONDA:'Honda',MITM:'Mi-T-M',REDMAX:'RedMax',STIHL:'STIHL',TORO:'Toro',YANMAR:'Yanmar'};
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=market+'universal/brand-navigation.css?v=20261025-brandnav1';document.head.append(stylesheet);
  const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
  const controllers=[];
  let profiles=[],published=[],loaded=false;
  function safePage(value){try{const url=new URL(value);return url.origin===api&&/^\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname)&&!url.search&&!url.hash?url.href:'';}catch{return '';}}
  function close(nav,keep){nav.querySelectorAll('details').forEach(menu=>{if(menu!==keep)menu.open=false;});}
  function wire(nav){
    if(nav.dataset.brandEventsReady)return;nav.dataset.brandEventsReady='1';
    nav.addEventListener('click',event=>{const summary=event.target.closest('summary');if(summary)close(nav,summary.parentElement);});
    nav.addEventListener('toggle',event=>{if(event.target.matches('details')&&event.target.open)close(nav,event.target);},true);
    document.addEventListener('click',event=>{if(!nav.contains(event.target))close(nav,null);});
    nav.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=event.target.closest('details');close(nav,null);menu?.querySelector('summary')?.focus();}});
  }
  function render(controller){
    const {nav}=controller;nav.replaceChildren();nav.classList.add('wep-brand-navigation');nav.setAttribute('aria-label','Shop by brand');
    const back=text('a','← Marketplace');back.href=market+'marketplace.html';
    back.addEventListener('click',event=>{event.preventDefault();controller.mode=false;nav.classList.remove('wep-brand-navigation');nav.setAttribute('aria-label','Site navigation');nav.replaceChildren(...controller.original);back.blur();nav.querySelector('a,summary')?.focus();});
    nav.append(back);
    for(const profile of profiles){
      const id=String(profile.id).toUpperCase(),label=names[id]||profile.name||id;
      const menu=document.createElement('details'),summary=text('summary',label),links=document.createElement('div');links.className='wep-menu';menu.append(summary,links);
      const all=text('a','All '+label+' Equipment');all.href=market+'shop-by-brand.html?'+new URLSearchParams({brand:id});links.append(all);
      const seen=new Set();
      for(const page of published.find(b=>b.id===id)?.pages||[]){
        const href=safePage(page.url);if(!href||seen.has(href))continue;seen.add(href);
        const link=text('a',String(page.label||'Equipment'));link.href=href;links.append(link);
      }
      nav.append(menu);
    }
    if(!loaded&&!profiles.length){const message=text('span','Loading brands…');message.setAttribute('role','status');nav.append(message);}
  }
  function refresh(){controllers.filter(c=>c.mode).forEach(render);}
  function applyProfiles(values){
    profiles=[...new Map((values||[]).filter(v=>v&&/^[A-Z0-9_-]+$/i.test(v.id)).map(v=>[v.id.toUpperCase(),v])).values()].sort((a,b)=>(names[a.id]||a.name||a.id).localeCompare(names[b.id]||b.name||b.id));refresh();
  }
  function start(){
    document.querySelectorAll('.wep-nav').forEach(nav=>{
      wire(nav);
      // Generated pages already have crawlable links rendered by the server.
      if(nav.hasAttribute('data-wep-brand-navigation'))return;
      const controller={nav,original:[...nav.childNodes],mode:false};controllers.push(controller);
      nav.addEventListener('click',event=>{
        const trigger=event.target.closest('a,summary');if(!trigger||controller.mode)return;
        const anchor=trigger.matches('a')&&new URL(trigger.href).pathname.endsWith('/shop-by-brand.html');
        if(!anchor&&!(trigger.matches('summary')&&trigger.closest('#wep-home-brands')))return;
        event.preventDefault();event.stopImmediatePropagation();controller.mode=true;render(controller);
      },true);
      if(location.pathname.endsWith('/shop-by-brand.html')){controller.mode=true;render(controller);}
    });
    if(!controllers.length)return;
    if(Array.isArray(window.WESTEND_PUBLISHED_BRANDS))applyProfiles(window.WESTEND_PUBLISHED_BRANDS);
    else fetch(market+'data/marketplace-catalog.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();}).then(data=>{
      const active=src=>{const index=src.headers?.indexOf('Active');if(index<0)return false;return (src.rows||[]).some(row=>{let value;if(src.encoding==='sparse'){for(let i=0;i<row.length;i+=2)if(row[i]===index){value=row[i+1];break;}}else value=row[index];return /^(T|TRUE|Y|YES|1)$/i.test(String(value||'').trim());});};
      applyProfiles((data.productSources||[]).filter(active).map(src=>({id:src.brand,name:src.brand})));
    }).catch(()=>{profiles=published.map(b=>({id:b.id,name:b.label}));loaded=true;refresh();});
    fetch(api+'/pages/navigation.json',{cache:'no-store',credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Pages unavailable');return r.json();}).then(data=>{published=Array.isArray(data.brands)?data.brands:[];loaded=true;if(!profiles.length)applyProfiles(published.map(b=>({id:b.id,name:b.label})));else refresh();}).catch(()=>{loaded=true;refresh();});
    window.addEventListener('westend:catalog-ready',()=>{if(Array.isArray(window.WESTEND_PUBLISHED_BRANDS))applyProfiles(window.WESTEND_PUBLISHED_BRANDS);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
