(function(root){
 'use strict';
 const clean=v=>String(v??'').trim(),key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,''),money=v=>clean(v)===''?NaN:Number(clean(v).replace(/[$,]/g,'')),cents=v=>Math.round((v+Number.EPSILON)*100)/100;
 const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const usable=row=>row&&clean(row.SKU)&&!['STOP','REFERENCEONLY','00000000000'].includes(key(row.SKU))&&(!clean(row.Active)||/^(T|TRUE|Y|YES|1|X)$/i.test(clean(row.Active)));
 const id=item=>item.type+':'+key(item.row.SKU);
 function catalogFor(tables){return ['attachment','accessory','part'].flatMap(type=>(tables[{attachment:'attachments',accessory:'accessories',part:'parts'}[type]]||[]).filter(usable).map(row=>({type,row,quantity:1})));}
 function optionsFor(catalog,product,rules){
  const compatible=catalog.filter(item=>rules.compatibility(item.row,product));
  const dependencies=new Set(compatible.flatMap(item=>rules.requirementSlots(item.row,product)).map(rule=>key(rule.sku)));
  return compatible.filter(item=>item.type!=='part'&&!dependencies.has(key(item.row.SKU)))
   .sort((a,b)=>(money(a.row.SortOrder)||0)-(money(b.row.SortOrder)||0)||clean(a.row.Description).localeCompare(clean(b.row.Description)));
 }
 function plan(product,catalog,options,selection,quantity,rules){
  if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('Choose an equipment quantity from 1 to 20.');
  if(!Array.isArray(selection)||selection.length>30)throw Error('Choose up to 30 package options.');
  const chosen=[],seen=new Set();
  for(const entry of selection){
   const item=options.find(item=>item.type===entry.type&&key(item.row.SKU)===key(entry.sku));
   if(!item||seen.has(id(item)))throw Error('A selected option is no longer compatible. Please review it.');
   if(!Number.isInteger(entry.quantity)||entry.quantity<1||entry.quantity*quantity>20)throw Error('Option quantities must be whole numbers, with no more than 20 of each item per build.');
   seen.add(id(item));chosen.push({...item,quantity:entry.quantity});
  }
  const all=new Map(chosen.map(item=>[id(item),item]));
  for(const item of rules.requirements(chosen,catalog,product)){
   const old=all.get(id(item));all.set(id(item),{...item,quantity:Math.max(item.quantity,old?.quantity||0),required:!old});
  }
  let total=money(product.MSRP);if(!(total>0))throw Error('Equipment pricing needs store confirmation.');
  for(const item of all.values()){
   const price=money(item.row.MSRP);if(!Number.isFinite(price)||price<0)throw Error('An option price needs store confirmation.');
   if(item.quantity*quantity>20)throw Error('A required item exceeds 20 units. Please reduce the package quantity.');
   total+=price*item.quantity;
  }
  return {selected:chosen,items:[...all.values()],msrp:cents(total),quantity};
 }
 function buildUrl(location,brand,sku,selection,quantity,configuration){
  const url=new URL('product-options.html',location);url.searchParams.set('brand',brand);url.searchParams.set('sku',sku);
  url.searchParams.set('quantity',String(quantity));url.searchParams.set('configuration',configuration);
  url.searchParams.set('cardOptions',JSON.stringify(selection.map(item=>({type:item.type,sku:clean(item.sku||item.row?.SKU),quantity:item.quantity}))));
  const entry=new URL(location);
  if(entry.searchParams.get('api')==='local')url.searchParams.set('api','local');
  for(const field of ['return','category'])if(entry.searchParams.has(field))url.searchParams.set(field,entry.searchParams.get(field));
  return url.href;
 }
 function imageUrl(row,brand,location){
  let value=clean(row.ImageURL).replace(/\\/g,'/');if(!value||/^[a-z][a-z0-9+.-]*:/i.test(value)&&!/^https?:/i.test(value))return '';
  if(/\/RZ14\.jpg$/i.test(value))value=value.replace(/\/RZ14\.jpg$/i,'/RZ142.jpg');
  if(!/^(https?:|\/|brands\/)/i.test(value))value='brands/'+brand.toLowerCase()+'/'+value.replace(/^\.\//,'');
  try{const url=new URL(value,location);return /^https?:$/.test(url.protocol)?url.href:'';}catch(_){return '';}
 }
 const api={catalogFor,optionsFor,plan,buildUrl,imageUrl};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;root.WEPPackageOptionPicker=api;
 async function start(){
  const host=document.getElementById('package-picker'),params=new URLSearchParams(location.search);
  try{
   const brand=clean(params.get('brand')).toUpperCase(),sku=clean(params.get('sku')),quantity=Number(params.get('quantity')||1);
   if(!['TORO','STIHL','HONDA','YANMAR','BILLYGOAT','REDMAX','GREENWORKS','MITM'].includes(brand)||!sku)throw Error('Choose equipment from the marketplace to begin.');
   let configuration=params.get('configuration');
   if(!configuration){configuration=crypto.randomUUID();const url=new URL(location.href);url.searchParams.set('configuration',configuration);history.replaceState(null,'',url.href);}
   if(!/^[a-zA-Z0-9_-]{1,80}$/.test(configuration))throw Error('This build link is invalid. Please reopen it from the marketplace.');
   const names=['products','attachments','accessories','parts'];
   const rows=await Promise.all(names.map(async name=>{const response=await fetch('brands/'+brand.toLowerCase()+'/data/'+name+'.csv',{cache:'no-store'});if(!response.ok)throw Error('Current '+name+' could not be loaded. Please reload this tab.');return root.WEPBuildBuy.parseCSV(await response.text());}));
   const tables=Object.fromEntries(names.map((name,i)=>[name,rows[i]])),product=tables.products.find(row=>usable(row)&&key(row.SKU)===key(sku));
   if(!product)throw Error('This equipment is no longer available. Please return to the marketplace.');
   product.BrandID=brand;
   const rules=root.WestEndEquipmentPackages,catalog=catalogFor(tables),options=optionsFor(catalog,product,rules),storageKey='wepPackagePicker:'+configuration;
   let selection=[];
   const saved=sessionStorage.getItem(storageKey);
   if(saved){const state=JSON.parse(saved);if(state.brand!==brand||key(state.sku)!==key(sku))throw Error('The saved build belongs to different equipment.');selection=state.selection;}
   else if(params.has('cardOptions'))selection=JSON.parse(params.get('cardOptions'));
   let group=params.get('group')==='accessory'?'accessory':'attachment';
   const format=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
   function save(){sessionStorage.setItem(storageKey,JSON.stringify({brand,sku,selection}));}
   function render(){
    let current,error='';try{current=plan(product,catalog,options,selection,quantity,rules);}catch(e){error=e.message;}
    const image=imageUrl(product,brand,location.href),counts=type=>options.filter(item=>item.type===type).length;
    host.innerHTML='<section class="picker-hero">'+(image?'<img src="'+esc(image)+'" alt="'+esc(product.Description||sku)+'">':'')+'<div><small>YOUR EQUIPMENT · QTY '+quantity+'</small><h1>'+esc(product.Description||product.Model||sku)+'</h1><small>SKU '+esc(sku)+'</small><p>Select attachments and accessories for this package. Final payment pricing is shown in Build &amp; Buy.</p></div></section>'+
     '<nav class="picker-tabs" role="tablist" aria-label="Package options">'+[['attachment','Attachments'],['accessory','Accessories']].map(([type,label])=>'<button type="button" role="tab" id="picker-tab-'+type+'" aria-controls="picker-options" aria-selected="'+(group===type)+'" data-group="'+type+'">'+label+' ('+counts(type)+' Available)</button>').join('')+'</nav>'+
     '<section id="picker-options" role="tabpanel" aria-labelledby="picker-tab-'+group+'"><div class="picker-grid">'+options.filter(item=>item.type===group).map(item=>{
      const selected=selection.find(entry=>entry.type===item.type&&key(entry.sku)===key(item.row.SKU)),index=options.indexOf(item),image=imageUrl(item.row,brand,location.href);
      const required=rules.requirementSlots(item.row,product).map(rule=>{const target=catalog.find(p=>key(p.row.SKU)===key(rule.sku));return (target?target.row.Description||target.row.Model:rule.sku)+' × '+rule.quantity;});
      return '<article class="option-card'+(selected?' selected':'')+'">'+(image?'<img src="'+esc(image)+'" loading="lazy" alt="'+esc(item.row.Description||item.row.SKU)+'">':'<div class="option-image-placeholder">Image coming soon</div>')+'<div class="option-body"><h3>'+esc(item.row.Description||item.row.Model||item.row.SKU)+'</h3><small>SKU '+esc(item.row.SKU)+'</small><span class="option-price">'+(Number.isFinite(money(item.row.MSRP))&&money(item.row.MSRP)>=0?format(money(item.row.MSRP)):'Contact us')+'</span>'+(required.length?'<p class="option-required">Requires '+esc(required.join(' · '))+'. Included automatically when selected.</p>':'')+'<div class="option-choice"><label><input id="choose-'+index+'" type="checkbox" data-option="'+index+'"'+(selected?' checked':'')+'> Add to package</label><label>Qty <input id="quantity-'+index+'" type="number" data-quantity="'+index+'" min="1" max="'+Math.floor(20/quantity)+'" value="'+(selected?.quantity||1)+'" aria-label="Quantity per equipment unit for '+esc(item.row.Description||item.row.SKU)+'"></label></div></div></article>';
     }).join('')+'</div>'+(!counts(group)?'<p>No compatible '+(group==='attachment'?'attachments':'accessories')+' are currently listed.</p>':'')+'</section>'+
     '<section class="picker-selection" aria-live="polite"><h2>Your package</h2>'+(current?.items.length?'<ul>'+current.items.map(item=>'<li>'+esc(item.row.Description||item.row.SKU)+' × '+item.quantity+(item.required?' — required':'')+'</li>').join('')+'</ul>':'<p>Base equipment only. No additional items selected.</p>')+'<p id="picker-error" class="picker-error"'+(error?'':' hidden')+'>'+esc(error)+'</p></section>'+
     '<footer class="picker-footer"><div>Package MSRP'+(quantity>1?' per unit':'')+'<strong>'+ (current?format(current.msrp):'Needs confirmation')+'</strong><small>'+selection.length+' selected option'+(selection.length===1?'':'s')+(quantity>1?' · '+quantity+' equipment units':'')+'</small></div><button id="continue-build" type="button"'+(current?'':' disabled')+'>Add to Package &amp; Build &amp; Buy →</button></footer>';
    host.setAttribute('aria-busy','false');
    host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const fallback=document.createElement('div');fallback.className='option-image-placeholder';fallback.textContent='Image coming soon';img.replaceWith(fallback);},{once:true}));
   }
   host.addEventListener('click',event=>{const tab=event.target.closest('[data-group]');if(tab){group=tab.dataset.group;render();document.getElementById('picker-tab-'+group).focus();}
    if(event.target.closest('#continue-build')){try{plan(product,catalog,options,selection,quantity,rules);save();location.assign(buildUrl(location.href,brand,sku,selection,quantity,configuration));}catch(e){const target=document.getElementById('picker-error');target.hidden=false;target.textContent=e.message;}}});
   host.addEventListener('change',event=>{const option=event.target.closest('[data-option],[data-quantity]');if(!option)return;const index=Number(option.dataset.option??option.dataset.quantity),item=options[index];if(!item)return;
    const check=document.getElementById('choose-'+index),qty=Number(document.getElementById('quantity-'+index).value);
    selection=selection.filter(entry=>!(entry.type===item.type&&key(entry.sku)===key(item.row.SKU)));
    if(check.checked)selection.push({type:item.type,sku:clean(item.row.SKU),quantity:qty});save();const focusId=option.id;render();document.getElementById(focusId)?.focus();});
   render();
  }catch(error){host.setAttribute('aria-busy','false');host.innerHTML='<section class="picker-error" role="alert"><h1>Options could not be loaded</h1><p>'+esc(error.message)+'</p><p>Your marketplace tab is still available. Reopen the options to try again.</p></section>';}
 }
 start();
})(typeof window==='undefined'?null:window);
