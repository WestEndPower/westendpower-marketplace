/* Public catalog enhancement. The initial HTML remains usable without JavaScript. */
(() => {
  'use strict';
  const seed=document.getElementById('wep-catalog-data');
  if(!seed)return;
  let data;
  try{data=JSON.parse(seed.textContent);}catch{return;}
  const models=Array.isArray(data.models)?data.models:[];
  const controls=[...document.querySelectorAll('[data-catalog-filter]')];
  const availability=document.querySelector('[data-catalog-availability]');
  const cards=new Map([...document.querySelectorAll('[data-model-key]')].map(el=>[el.dataset.modelKey,el]));
  const displayed=new Map(),chosen=new Set(),financeCache=new Map();
  const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value)||0);
  const text=(el,value)=>{if(el)el.textContent=value;};
  const element=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)text(el,value);return el;};
  const fieldValue=(variant,field)=>(variant.filters||[]).find(f=>f.field===field)?.value||'';
  function matches(variant,ignore=''){
    return (!availability?.value||Number(variant.stock)>0)&&controls.every(c=>c.dataset.catalogFilter===ignore||!c.value||fieldValue(variant,c.dataset.catalogFilter)===c.value);
  }
  const matching=model=>model.variants.filter(v=>matches(v)).sort((a,b)=>(a.price||Infinity)-(b.price||Infinity)||a.sku.localeCompare(b.sku));
  function updateCard(model,variant,count){
    const card=cards.get(model.key);
    if(!card)return;
    const previous=card.dataset.currentSku;
    card.dataset.currentSku=variant.sku;
    text(card.querySelector('[data-catalog-sku]'),'SKU: '+variant.sku);
    text(card.querySelector('[data-catalog-price-label]'),variant.saleActive?'Sale price':count>1?'Starting MSRP':'MSRP');
    text(card.querySelector('[data-catalog-price]'),variant.price?money(variant.price):'Contact Us');
    for(const a of card.querySelectorAll('[data-catalog-buy]'))a.href=variant.buy;
    for(const a of card.querySelectorAll('[data-catalog-details]'))a.href='https://westendpower.github.io/westendpower-marketplace/product.html?brand='+encodeURIComponent(variant.brand||'YANMAR')+'&sku='+encodeURIComponent(variant.sku);
    const imageHost=card.querySelector('.market-image');
    let img=card.querySelector('[data-catalog-image]');
    if(variant.image){
      if(!img){imageHost.replaceChildren();img=element('img');img.dataset.catalogImage='';img.loading='lazy';img.width=230;img.height=132;imageHost.append(img);}
      img.src=variant.image;img.alt=variant.name;
    }else {imageHost.replaceChildren(element('span','Image coming soon'));}
    const rebate=card.querySelector('[data-catalog-rebate]');
    rebate.hidden=!variant.rebate;
    rebate.replaceChildren();if(variant.rebate){rebate.append(element('strong',money(variant.rebate).replace(/\.00$/,'')+' Rebate'));if(variant.rebateEnd)rebate.append(element('small','thru '+new Date(variant.rebateEnd+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})));}
    const specs=card.querySelector('[data-catalog-specs]');
    specs.replaceChildren(...(variant.specs||[]).slice(0,4).map(s=>{const div=element('div');div.append(element('dt',s.label),element('dd',s.value));return div;}));
    const popup=card.querySelector('[data-catalog-inventory-popup]');if(popup){popup.hidden=true;card.querySelector('[data-catalog-inventory]').setAttribute('aria-expanded','false');}
    if(previous!==variant.sku){text(card.querySelector('[data-catalog-apr]'),'Current promotions in Build & Buy');for(const key of ['monthly','down','expiry']){const el=card.querySelector('[data-catalog-'+key+']');if(el)el.hidden=true;}}
    scheduleFinance(card,variant);
  }
  function refresh(){
    displayed.clear();
    for(const model of models){
      const variants=matching(model),card=cards.get(model.key);
      if(card)card.hidden=!variants.length;
      if(variants.length){displayed.set(model.key,variants[0]);updateCard(model,variants[0],variants.length);}
    }
    for(const control of controls){
      const selected=control.value,field=control.dataset.catalogFilter,values=new Map();
      for(const model of models){
        const once=new Set();
        for(const v of model.variants)if(matches(v,field)){const value=fieldValue(v,field);if(value)once.add(value);}
        for(const value of once)values.set(value,(values.get(value)||0)+1);
      }
      if(selected&&!values.has(selected))values.set(selected,0);
      const all=element('option',(control.getAttribute('aria-label')||'Filter')+': All');all.value='';
      control.replaceChildren(all,...[...values].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([value,count])=>{const option=element('option',(control.getAttribute('aria-label')||'Filter')+': '+value+' ('+count+')');option.value=value;return option;}));
      control.value=selected;
    }
    text(document.querySelector('[data-catalog-count]'),displayed.size+' model'+(displayed.size===1?'':'s'));
    document.querySelector('[data-catalog-empty]').hidden=displayed.size>0;
    updateComparisonButtons();
  }
  function updateComparisonButtons(){
    const n=[...chosen].filter(k=>displayed.has(k)).length;
    const selected=document.querySelector('[data-catalog-selected]'),all=document.querySelector('[data-catalog-all]');
    text(selected,'Compare Selected ('+n+')');selected.disabled=n<2;selected.hidden=displayed.size<2;
    text(all,'Compare All in View ('+displayed.size+')');all.disabled=displayed.size<2;all.hidden=displayed.size<2;
    for(const checkbox of document.querySelectorAll('[data-catalog-compare]'))checkbox.closest('label').hidden=displayed.size<2;
  }
  function compare(keys){
    const entries=keys.map(k=>({model:models.find(m=>m.key===k),variant:displayed.get(k)})).filter(x=>x.variant);
    if(entries.length<2)return;
    const table=element('table'),head=element('thead'),tr=element('tr');
    tr.append(element('th','Specification'));
    for(const {model}of entries)tr.append(element('th',model.name));
    head.append(tr);table.append(head);
    const body=element('tbody'),rows=[['SKU',v=>v.sku],['MSRP / sale price',v=>v.price?money(v.price):'Contact us'],['Customer rebate',v=>v.rebate?money(v.rebate):'View current promotions'],['Availability',v=>v.stock>0?'In stock · '+v.stock:'Available to order']];
    const labels=new Set(entries.flatMap(({variant})=>(variant.specs||[]).map(s=>s.label)));
    for(const label of labels)rows.push([label,v=>(v.specs||[]).find(s=>s.label===label)?.value||'—']);
    for(const [label,value]of rows){const row=element('tr');row.append(element('th',label));for(const {variant}of entries)row.append(element('td',value(variant)));body.append(row);}
    const links=element('tr');links.append(element('th','Configure'));
    for(const {variant}of entries){const td=element('td'),a=element('a','Build & Buy');a.href=variant.buy;td.append(a);links.append(td);}
    body.append(links);table.append(body);
    const host=document.querySelector('[data-catalog-comparison]');host.replaceChildren(table);
    document.querySelector('[data-catalog-dialog]').showModal();
  }
  // Only request a customer financing preview for visible, matching cards.
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);loadFinance(entry.target);}},{rootMargin:'120px'}):null;
  function scheduleFinance(card,variant){
    if(data.preview||!window.WestEndPayments)return;
    const cacheKey=(variant.brand||'YANMAR')+'|'+variant.sku;
    if(financeCache.has(cacheKey)){applyFinance(card,variant.sku,financeCache.get(cacheKey));return;}
    if(observer)observer.observe(card);else loadFinance(card);
  }
  function applyFinance(card,sku,offer){
    if(card.hidden||card.dataset.currentSku!==sku||!offer)return;
    text(card.querySelector('[data-catalog-apr]'),offer.apr.toFixed(2)+'% for '+offer.term+' Months');
    const monthly=card.querySelector('[data-catalog-monthly]');monthly.replaceChildren(element('strong',money(offer.monthly)),element('span',' per Month (est.)'));monthly.hidden=false;
    const down=card.querySelector('[data-catalog-down]');text(down,money(offer.down)+' required down');down.hidden=!(offer.down>0);
    const expiry=card.querySelector('[data-catalog-expiry]');text(expiry,offer.expiry);expiry.hidden=!offer.expiry;
  }
  async function loadFinance(card){
    const variant=displayed.get(card.dataset.modelKey),payments=window.WestEndPayments;
    if(!variant||card.hidden||!payments)return;
    const sku=variant.sku,brand=variant.brand||'YANMAR',cacheKey=brand+'|'+sku;
    if(financeCache.has(cacheKey)){applyFinance(card,sku,financeCache.get(cacheKey));return;}
    financeCache.set(cacheKey,null);
    try{
      const programs=await payments.programs(brand,sku,'');
      const program=payments.bestMarketplaceFinanceProgram(programs);
      if(!program)return;
      const result=await payments.quote(brand,sku,{Taxable:variant.taxable?'T':'F'},'finance',program,'',1,{shouldRun:()=>!card.hidden&&card.dataset.currentSku===sku,priority:'background'});
      if(!result)return;
      const summary=result.summary||result;
      const subtotal=Math.max(0,Number(variant.price)-(payments.programAllowsRebate(program)?Number(variant.rebate)||0:0))+Number(summary.freight||0);
      const total=subtotal+(variant.taxable?Math.round(subtotal*0.0635*100)/100:0);
      const down=payments.programMinimumDown(program,total);
      const principal=Math.max(0,total-down)+Number(summary.applicationFee||0);
      const monthly=payments.monthlyPayment(principal,summary.apr,summary.termMonths);
      if(!(monthly>0))return;
      const term=Number(summary.termMonths||program.TermMonths),apr=Number(summary.apr??program.APR);
      const expiry=payments.programExpirationLabel(program);
      const offer={apr,term,monthly,down,expiry};
      financeCache.set(cacheKey,offer);applyFinance(card,sku,offer);
    }catch{/* Build & Buy remains the source for confirmed terms. */}
  }
  const inventoryCache=new Map();let locationsPromise;
  const stockKey=value=>String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  function csvRows(source){
    const rows=[];let row=[],value='',quoted=false;
    for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'&&source[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(value);value='';}else if(c==='\n'){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}else value+=c;}
    if(value||row.length){row.push(value.replace(/\r$/,''));rows.push(row);}const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,'').trim());return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
  }
  function catalogLocations(){
    if(!locationsPromise)locationsPromise=fetch('https://westendpower.github.io/westendpower-marketplace/data/locations.csv',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Locations unavailable');return r.text();}).then(source=>csvRows(source).filter(r=>/^(T|TRUE|YES|1)$/i.test(r.Active)).sort((a,b)=>Number(a.SortOrder)-Number(b.SortOrder)));
    return locationsPromise;
  }
  function catalogInventory(brand){
    let cached=inventoryCache.get(brand);if(!cached||Date.now()-cached.time>30000){cached={time:Date.now(),promise:fetch('https://westendpower-configurator-api.westendpower-nm.workers.dev/inventory-availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandId:brand})}).then(async r=>{if(!r.ok)throw Error('Inventory unavailable');const data=await r.json();if(!Array.isArray(data.availability))throw Error('Inventory unavailable');return data.availability;})};inventoryCache.set(brand,cached);cached.promise.catch(()=>inventoryCache.delete(brand));}return cached.promise;
  }
  function closeInventory(){for(const popup of document.querySelectorAll('[data-catalog-inventory-popup]')){popup.hidden=true;popup.closest('.market-inventory-wrap').querySelector('button').setAttribute('aria-expanded','false');}}
  async function openCatalogInventory(button){
    const card=button.closest('[data-model-key]'),variant=displayed.get(card.dataset.modelKey),popup=card.querySelector('[data-catalog-inventory-popup]');
    const opening=popup.hidden;closeInventory();if(!opening||!variant)return;
    button.setAttribute('aria-expanded','true');popup.hidden=false;popup.replaceChildren(element('p','Checking inventory…'));
    const [locationsResult,stockResult]=await Promise.allSettled([catalogLocations(),catalogInventory(variant.brand)]);
    if(button.getAttribute('aria-expanded')!=='true'||card.dataset.currentSku!==variant.sku)return;
    const locations=locationsResult.status==='fulfilled'?locationsResult.value:[{LocationID:'NM',ShortName:'New Milford'},{LocationID:'DA',ShortName:'Danbury'}];
    const record=stockResult.status==='fulfilled'?stockResult.value.find(r=>stockKey(r.sku)===stockKey(variant.sku)):null;
    popup.replaceChildren();
    for(const location of locations){
      const name=location.ShortName||location.LocationName,selections=record?.selections||[];
      const count=selections.filter(unit=>[name,location.LocationID,location.LocationName].some(value=>value&&stockKey(unit.store)===stockKey(value))).reduce((sum,unit)=>sum+Math.max(Number(unit.quantity)||0,0),0);
      const unknown=stockResult.status!=='fulfilled'||(Number(record?.quantity)>0&&!selections.length),available=count>0;
      const status=unknown?'Availability needs confirmation':available?'In Stock':'Out of Stock - Check Lead Time';
      const action=available||unknown?'Text to Confirm Availability':'Text to Request Lead Time',wrap=element('div');wrap.className='market-inventory-store';
      const heading=element('div',name+' - '+status);heading.className='market-inventory-line'+(available?'':' market-inventory-order');wrap.append(heading);
      const phone=String(location.Phone||'').replace(/[^0-9+]/g,'');
      if(phone){const link=element('a',action);link.className='market-inventory-contact market-inventory-text-action';link.setAttribute('aria-label',action+' at '+name);const body=(available||unknown?'Please confirm availability of ':'Please provide lead time for ')+variant.name+' (SKU: '+variant.sku+') at '+name+'. I am interested in quantity 1.';link.href='sms:'+phone+(/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(body);wrap.append(link);}
      popup.append(wrap);
    }
  }
  for(const button of document.querySelectorAll('[data-catalog-inventory]'))button.addEventListener('click',()=>openCatalogInventory(button));
  document.addEventListener('click',event=>{if(!event.target.closest('.market-inventory-wrap'))closeInventory();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeInventory();});

  for(const control of [...controls,availability].filter(Boolean))control.addEventListener('change',refresh);
  document.querySelector('[data-catalog-clear]').addEventListener('click',()=>{for(const c of controls)c.value='';if(availability)availability.value='';refresh();});
  for(const checkbox of document.querySelectorAll('[data-catalog-compare]'))checkbox.addEventListener('change',()=>{if(checkbox.checked)chosen.add(checkbox.dataset.catalogCompare);else chosen.delete(checkbox.dataset.catalogCompare);updateComparisonButtons();});
  document.querySelector('[data-catalog-selected]').addEventListener('click',()=>compare([...chosen].filter(k=>displayed.has(k))));
  document.querySelector('[data-catalog-all]').addEventListener('click',()=>compare([...displayed.keys()]));
  document.querySelector('[data-catalog-close]').addEventListener('click',()=>document.querySelector('[data-catalog-dialog]').close());
  refresh();
})();


