/* Shared public traffic and SKU interest. Never pass customer, quote, payment or free-text fields. */
(() => {
  'use strict';
  if (window.WEPSiteTracking) return;
  const script=document.currentScript;
  const root=new URL('../',script?.src||location.href);
  const api='https://westendpower-configurator-api.westendpower-nm.workers.dev';
  const params=new URLSearchParams(location.search);
  function excluded() {
    if(location.protocol!=='https:' || /^(?:localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname))return true;
    if(!['westendpower.github.io','westendpower.com','www.westendpower.com','westendpower-configurator-api.westendpower-nm.workers.dev'].includes(location.hostname))return true;
    if(/(?:preview|webpage-builder|dealer-|shared-quote|\/quotes?(?:\/|$)|\/q\/)/i.test(location.pathname))return true;
    if(params.get('api')==='local'||params.has('preview')||params.has('wepDemo')||navigator.webdriver)return true;
    const seed=document.getElementById('wep-catalog-data');
    try{if(seed&&JSON.parse(seed.textContent).preview)return true;}catch{return true;}
    return false;
  }
  const clean=value=>String(value??'').trim();
  const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const identity=(brandId,sku)=>({brandId:clean(brandId).toUpperCase(),sku:clean(sku)});
  const keyOf=item=>JSON.stringify([item.brandId,item.sku]);
  const cache=new Map(),inflight=new Map(),interestSeen=new Set();
  let configured=false,measurement='',settingsPromise,scanTimer,scanning=false,rescan=false,entry='direct_or_other';
  const safePage=location.origin+location.pathname;
  const safeReferrer=(()=>{try{return new URL(document.referrer).origin+'/';}catch{return '';}})();
  const pageName=location.pathname.split('/').filter(Boolean).pop()||'home';
  const allowedEvents=new Set(['page_view','navigation_click','search_catalog','catalog_filter','product_open','open_configurator','add_to_cart','begin_checkout','quote_requested','order_submitted','purchase_confirmed','contact_click','directions_click','dealer_spike_entry']);
  // Only named, non-personal catalog fields are accepted; no URLs, labels, form values or search text.
  const allowedFields=new Set(['brand_id','sku','item_count','quantity','query_length','control','destination','entry_source']);
  function event(name,fields={}) {
    if(excluded()||!allowedEvents.has(name))return;
    if(!configured){settings().then(()=>{if(configured)event(name,fields);});return;}
    if(!measurement)return;
    const safe={entry_source:entry,page_location:safePage,page_referrer:safeReferrer,page_title:pageName};
    for(const [key,value]of Object.entries(fields))if(allowedFields.has(key)&&(typeof value==='number'||typeof value==='string'))safe[key]=typeof value==='string'?value.slice(0,100):value;
    window.gtag('event',name,safe);
  }
  function configure(settings={}) {
    if(configured||excluded())return;
    measurement=clean(settings.GA4MeasurementID);
    if(!/^G-[A-Z0-9]+$/.test(measurement))return;
    configured=true;
    // Dealer Spike's shared button uses ?entry=dealerspike. Attribution expires after 30 idle minutes.
    try{
      const previous=JSON.parse(sessionStorage.getItem('wepTrafficEntry')||'null');
      const ref=new URL(document.referrer||location.href),own=['westendpower.github.io','westendpower.com','www.westendpower.com','westendpower-configurator-api.westendpower-nm.workers.dev'].includes(ref.hostname);
      entry=params.get('entry')==='dealerspike'?'dealerspike':previous&&Date.now()-previous.at<1800000&&own?previous.source:/^(?:www\.)?(?:google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(ref.hostname)?'search':'direct_or_other';
      sessionStorage.setItem('wepTrafficEntry',JSON.stringify({source:entry,at:Date.now()}));
    }catch{entry=params.get('entry')==='dealerspike'?'dealerspike':'direct_or_other';}
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    window.gtag('set',{page_location:safePage,page_referrer:safeReferrer,page_title:pageName,allow_google_signals:false,allow_ad_personalization_signals:false});
    window.gtag('js',new Date());
    window.gtag('config',measurement,{send_page_view:false,page_location:safePage,page_referrer:safeReferrer,page_title:pageName,allow_google_signals:false,allow_ad_personalization_signals:false});
    const tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurement);document.head.append(tag);
    event('page_view');
    if(params.get('entry')==='dealerspike')event('dealer_spike_entry');
  }
  function csvRows(text) {
    const rows=[];let row=[],value='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
      else if(c===','&&!quoted){row.push(value);value='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
      else value+=c;
    }
    if(value||row.length){row.push(value);rows.push(row);}
    const headers=(rows[0]||[]).map(h=>h.replace(/^\uFEFF/,'').trim());
    return Object.fromEntries(headers.map((h,i)=>[h,rows[1]?.[i]||'']));
  }
  function settings() {
    if(!settingsPromise)settingsPromise=fetch(new URL('data/dealer-settings.csv',root),{cache:'no-cache',credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Settings unavailable');return r.text();}).then(csvRows).then(value=>{configure(value);return value;}).catch(()=>({}));
    return settingsPromise;
  }
  async function post(path,body) {
    const response=await fetch(api+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true});
    if(!response.ok)throw Error('Tracking unavailable');
    const result=await response.json();if(result.ok!==true)throw Error('Tracking unavailable');return result;
  }
  function tokenFor(item,today) {
    // Do not count if durable browser deduplication is unavailable. Never invent a replacement per page load.
    try {
      const name='wepSkuView:'+today+':'+keyOf(item);
      let token=localStorage.getItem(name);
      if(!/^[a-f0-9]{32}$/.test(token||'')){
        token=[...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join('');
        localStorage.setItem(name,token);
        if(localStorage.getItem(name)!==token)return null;
      }
      // Discard old daily keys; no stable visitor identifier is retained.
      for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('wepSkuView:')&&!key.startsWith('wepSkuView:'+today+':'))localStorage.removeItem(key);}
      return token;
    }catch{return null;}
  }
  async function productOpened(brandId,sku,kind='details') {
    if(excluded()||document.visibilityState!=='visible')return;
    const item=identity(brandId,sku);if(!item.brandId||!item.sku)return;
    await settings();
    const openedKey=kind+':'+keyOf(item);
    if(!interestSeen.has(openedKey)){interestSeen.add(openedKey);event(kind==='builder'?'open_configurator':'product_open',{brand_id:item.brandId,sku:item.sku});}
    const today=day(),key=today+':'+keyOf(item);
    if(inflight.has(key))return;
    const send=async()=>{
      const token=tokenFor(item,today);if(!token)return;
      const result=await post('/product-view',{...item,day:today,key:token});
      if(result.counted){cache.delete(keyOf(item));scheduleScan();}
    };
    const pending=(navigator.locks?navigator.locks.request('wepSkuView:'+key,send):send()).catch(()=>{});
    inflight.set(key,pending);await pending;
  }
  function showCount(el,count) {
    el.textContent=count>0?count+' '+(count===1?'view':'views')+' in the last 7 days':'';
    el.hidden=!(count>0);
  }
  async function scan() {
    if(excluded())return;
    if(scanning){rescan=true;return;}
    scanning=true;
    try{
    const labels=[...document.querySelectorAll('[data-wep-view-sku][data-wep-view-brand]')];
    const items=new Map();
    for(const label of labels){const item=identity(label.dataset.wepViewBrand,label.dataset.wepViewSku),key=keyOf(item);if(!item.sku||!item.brandId)continue;const stored=cache.get(key);if(stored&&Date.now()-stored.at<60000)showCount(label,stored.views);else items.set(key,item);}
    const list=[...items.values()];
    for(let offset=0;offset<list.length;offset+=100){
      try{
        const result=await post('/product-view-counts',{items:list.slice(offset,offset+100)});
        for(const item of result.items||[])if(Number.isSafeInteger(item.views)&&item.views>=0)cache.set(keyOf(identity(item.brandId,item.sku)),{at:Date.now(),views:item.views});
      }catch{for(const item of list.slice(offset,offset+100))cache.set(keyOf(item),{at:Date.now(),unavailable:true});continue;}
    }
    for(const label of labels){const item=identity(label.dataset.wepViewBrand,label.dataset.wepViewSku),stored=cache.get(keyOf(item));if(stored&&Date.now()-stored.at<60000)showCount(label,stored.views);else {label.hidden=true;label.textContent='';}}
    }finally{scanning=false;if(rescan){rescan=false;scheduleScan();}}
  }
  function scheduleScan(){clearTimeout(scanTimer);scanTimer=setTimeout(scan,180);}
  window.WEPSiteTracking={configure,event,productOpened,refreshCounts:scheduleScan,excluded};
  const report=()=>{const item=window.WEPViewedProduct;if(item)productOpened(item.brandId,item.sku,item.kind);};
  window.addEventListener('wep:product-opened',report);
  function start() {
    if(excluded())return;
    settings();scheduleScan();report();
    setInterval(scheduleScan,60000);
    const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1)))scheduleScan();});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-wep-view-sku','data-wep-view-brand']});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){scheduleScan();report();}});
    document.addEventListener('click',e=>{
      const a=e.target.closest('a[href]');if(!a)return;
      let url;try{url=new URL(a.href,location.href);}catch{return;}
      if(['tel:','mailto:','sms:'].includes(url.protocol)){event('contact_click',{destination:url.protocol.slice(0,-1)});return;}
      if((/(^|\.)google\.[a-z.]+$/.test(url.hostname)&&(url.pathname.startsWith('/maps')||url.hostname.startsWith('maps.')))||url.hostname==='maps.apple.com'||url.hostname==='maps.app.goo.gl'){event('directions_click');return;}
      if(url.origin===location.origin&&/\/checkout\.html$/.test(url.pathname))event('begin_checkout');
      if(a.closest('nav')){const dest=url.pathname.split('/').pop()||'home';event('navigation_click',{destination:/^(?:marketplace|shop-by-product|shop-by-brand|promotions|cart|checkout|product-options|payment-options|equipment|contact|locations|service)(?:\.html)?$/.test(dest)?dest:'other_public_page'});}
    });
    document.addEventListener('change',e=>{const el=e.target;if(el.closest('#market-app')&&el.matches('select,input[type=checkbox]')||el.matches('[data-catalog-filter],[data-catalog-brand],[data-catalog-availability],[data-catalog-purchase]'))event('catalog_filter',{control:'catalog'});});
    let searchTimer;document.addEventListener('input',e=>{if(e.target.matches('#market-search,#we-search,input[type=search]')){clearTimeout(searchTimer);const n=e.target.value.length;searchTimer=setTimeout(()=>event('search_catalog',{query_length:n}),700);}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
