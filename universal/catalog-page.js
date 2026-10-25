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
    text(rebate,variant.rebate?money(variant.rebate)+' customer rebate'+(variant.rebateEnd?' through '+variant.rebateEnd:''):'');
    const specs=card.querySelector('[data-catalog-specs]');
    specs.replaceChildren(...(variant.specs||[]).slice(0,4).map(s=>{const div=element('div');div.append(element('dt',s.label),element('dd',s.value));return div;}));
    text(card.querySelector('[data-catalog-stock]'),variant.stock>0?'In stock · '+variant.stock+' available':variant.discontinued?'Contact us for availability':'Available to order');
    if(previous!==variant.sku){text(card.querySelector('[data-catalog-finance]'),'Current rebates and financing in Build & Buy');}
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
  function applyFinance(card,sku,message){if(!card.hidden&&card.dataset.currentSku===sku&&message)text(card.querySelector('[data-catalog-finance]'),message);}
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
      if(!result||result.freightConfirmed===false)return;
      const summary=result.summary||result;
      const subtotal=Math.max(0,Number(variant.price)-(payments.programAllowsRebate(program)?Number(variant.rebate)||0:0))+Number(summary.freight||0);
      const total=subtotal+(variant.taxable?Math.round(subtotal*0.0635*100)/100:0);
      const down=payments.programMinimumDown(program,total);
      const principal=Math.max(0,total-down)+Number(summary.applicationFee||0);
      const monthly=payments.monthlyPayment(principal,summary.apr,summary.termMonths);
      if(!(monthly>0))return;
      const term=Number(summary.termMonths||program.TermMonths),apr=Number(summary.apr??program.APR);
      const message=money(monthly)+'/mo'+(Number.isFinite(apr)?' · '+apr.toFixed(2)+'% APR':'')+(term>0?' · '+term+' months':'')+' · Est. with approved credit'+(down>0?' · '+money(down)+' down':'');
      financeCache.set(cacheKey,message);applyFinance(card,sku,message);
    }catch{/* Build & Buy remains the source for confirmed terms. */}
  }
  for(const control of [...controls,availability].filter(Boolean))control.addEventListener('change',refresh);
  document.querySelector('[data-catalog-clear]').addEventListener('click',()=>{for(const c of controls)c.value='';if(availability)availability.value='';refresh();});
  for(const checkbox of document.querySelectorAll('[data-catalog-compare]'))checkbox.addEventListener('change',()=>{if(checkbox.checked)chosen.add(checkbox.dataset.catalogCompare);else chosen.delete(checkbox.dataset.catalogCompare);updateComparisonButtons();});
  document.querySelector('[data-catalog-selected]').addEventListener('click',()=>compare([...chosen].filter(k=>displayed.has(k))));
  document.querySelector('[data-catalog-all]').addEventListener('click',()=>compare([...displayed.keys()]));
  document.querySelector('[data-catalog-close]').addEventListener('click',()=>document.querySelector('[data-catalog-dialog]').close());
  refresh();
})();

