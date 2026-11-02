/* Chainsaw bar choices select complete, published equipment SKUs. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.WEPBarOptions=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 const clean=v=>String(v??'').trim(),upper=v=>clean(v).toUpperCase();
 const yes=v=>/^(T|TRUE|Y|YES|1|X)$/i.test(clean(v));
 const family=row=>upper(row.MarketplaceFamily||row.Model||row.Description||row.SKU);
 function bar(row){
  const match=clean(row.Description).match(/(\d+(?:\.\d+)?)\s*["\u2033\u201d]/);
  return match?{size:Number(match[1]),light:/\blight(?:weight)?\b/i.test(clean(row.Description))}:null;
 }
 function variants(products,current,brand){
  if(!/^chainsaws?$/i.test(clean(current.Category))||/battery/i.test(clean(current.PowerType)))return [];
  const seen=new Set(),sort=v=>Number(clean(v).replace(/[$,]/g,''))||0;
  return products.filter(row=>/^chainsaws?$/i.test(clean(row.Category))&&family(row)===family(current)&&
   (!clean(row.BrandID)||upper(row.BrandID)===upper(brand))&&upper(row.PowerType)===upper(current.PowerType)&&
   clean(row.SKU)&&!['STOP','REFERENCE_ONLY'].includes(upper(row.SKU))&&(!clean(row.Active)||yes(row.Active))&&
   !/kit|package/i.test(clean(row.ProductType)))
   .sort((a,b)=>sort(a.SortOrder)-sort(b.SortOrder))
   .flatMap(row=>{const choice=bar(row);if(!choice)return [];const key=choice.light+':'+choice.size;if(seen.has(key))return [];seen.add(key);return [{row,...choice}];});
 }
 function mount({products,product,brand,onChange}){
  const choices=variants(products,product,brand),selected=bar(product);
  if(!choices.length||!selected)return;
  const section=document.createElement('section');section.className='wep-bar-options';section.setAttribute('aria-label','Chainsaw bar options');
  const entries=[];
  for(const light of [false,true]){
   const row=document.createElement('div');row.className='wep-bar-row';
   const label=document.createElement('strong');label.textContent=light?'Light Bar':'Std. Bar';row.append(label);
   const group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label',label.textContent);row.append(group);
   for(const choice of choices.filter(c=>c.light===light).sort((a,b)=>a.size-b.size)){
    const button=document.createElement('button'),active=choice.size===selected.size&&choice.light===selected.light;
    button.type='button';button.textContent=choice.size+'"';button.dataset.barSku=clean(choice.row.SKU);button.setAttribute('aria-pressed',String(active));group.append(button);entries.push({button,choice,active});
   }
   section.append(row);
  }
  const status=document.createElement('p');status.setAttribute('role','status');section.append(status);
  const price=document.querySelector('.hero .price');if(!price)return;price.after(section);
  let changing=false,error='';
  function refresh(){
   if(!section.isConnected){observer.disconnect();return;}
   const state=window.WEPBuildConfiguration?.status()||{ready:false};
   const message=error||(changing?'Loading selected bar…':!state.ready?'Checking availability…':state.stocked?'The bar is fixed on this in-stock unit. Select Build to Order to change it.':'');
   if(status.textContent!==message)status.textContent=message;status.hidden=!message;
   for(const entry of entries)entry.button.disabled=changing||!state.ready||state.stocked||entry.active;
  }
  for(const entry of entries)entry.button.onclick=()=>{
   if(entry.button.disabled||changing)return;
   try{error='';changing=true;refresh();onChange(entry.choice.row);}catch(e){changing=false;error=e.message;refresh();}
  };
  const observer=new MutationObserver(refresh);observer.observe(document.getElementById('app'),{childList:true,subtree:true});
  document.getElementById('app').addEventListener('change',()=>queueMicrotask(refresh));refresh();return section;
 }
 return {bar,variants,mount};
});
