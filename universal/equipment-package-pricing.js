/* Shared standard-equipment and chainsaw price tags; battery and Yanmar compact tags retain their own rules. */
(() => {
 'use strict';
 const clean=v=>String(v??'').trim(),key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,''),yes=v=>/^(T|TRUE|Y|YES|1|X)$/i.test(clean(v));
 const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=v=>{const n=Number(clean(v).replace(/[$,]/g,''));return Number.isFinite(n)?n:0;},round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const usable=r=>r&&clean(r.SKU)&&!['STOP','REFERENCEONLY'].includes(key(r.SKU))&&(!clean(r.Active)||yes(r.Active));
 const states=new Map(),contexts=new Map();
 function compatibility(row,product){
  const fields=new Map(Object.entries(row).map(([k,v])=>[key(k),clean(v)]));
  const direct=[product.SKU,product.Model],groups=[product.Model,product.Series,product.System,product.Category,product.SubCategory].map(v=>clean(v)?'Group_'+v:'');
  for(const candidate of [...direct,...groups,'Group_ALL_'+product.BrandID,'AllProducts'].map(key).filter(Boolean))if(fields.has(candidate)&&fields.get(candidate)!=='')return yes(fields.get(candidate));
  return false;
 }
 function hasModelRequirements(row,product){
  const pattern=new RegExp('^'+key(product.SKU)+'REQ[1-9]\\d*$');
  return !!key(product.SKU)&&Object.keys(row).some(field=>pattern.test(key(field)));
 }
 function requirementSlots(row,product){
  const result=[],fields=new Map(Object.entries(row).map(([field,value])=>[key(field),clean(value)]));
  if(hasModelRequirements(row,product)){
   const pattern=new RegExp('^'+key(product.SKU)+'REQ([1-9]\\d*)$');
   for(const [field,sku] of [...fields].sort((a,b)=>Number(a[0].match(pattern)?.[1]||0)-Number(b[0].match(pattern)?.[1]||0))){
    const slot=field.match(pattern);if(slot&&sku)result.push({sku,quantity:Number(fields.get(key(product.SKU)+'QTY'+slot[1])||1)});
   }
   return result;
  }
  for(const field of Object.keys(row).filter(field=>/^RequiredSKU[1-9]\d*$/i.test(field))){
   const i=field.match(/\d+$/)[0],sku=clean(row[field]);if(!sku)continue;
   const model=clean(row['RequiredModel'+i]);if(model&&!model.split(/[;,|]/).some(v=>[product.SKU,product.Model].some(p=>key(v)===key(p))))continue;
   result.push({sku,quantity:Number(clean(row['RequiredQty'+i]||row['RequiredSKU'+i+'Qty'])||1)});
   for(const childField of Object.keys(row).filter(field=>new RegExp('^SKU'+i+'Requires[1-9]\\d*$','i').test(field))){
    const child=clean(row[childField]);if(child)result.push({sku:child,quantity:Number(clean(row[childField+'Qty'])||1)});
   }
  }
  return result;
 }
 function requirements(selected,catalog,product){
  const output=new Map();
  function visit(item,quantity,path){
   const id=key(item.row.SKU);if(path.includes(id))throw Error('Required package items need store confirmation.');
   for(const rule of requirementSlots(item.row,product)){
    const target=catalog.find(p=>key(p.row.SKU)===key(rule.sku)&&usable(p.row)&&compatibility(p.row,product)),count=quantity*rule.quantity;
    if(!target||!Number.isInteger(count)||count<1||count>20)throw Error('Required package items need store confirmation.');
    const previous=output.get(key(target.row.SKU));if(!previous||previous.quantity<count)output.set(key(target.row.SKU),{...target,quantity:count,required:true});
    visit(target,count,[...path,id]);
   }
  }
  for(const item of selected)visit(item,item.quantity,[]);
  return [...output.values()];
 }
 function shortName(row){
  const text=clean(row.Description||row.Model||row.SKU);
  return text;
 }
 function model(f,c){
  if((/battery/i.test(f.power)&&!c.emptyBattery)||(key(f.brand)==='YANMAR'&&/^compact tractors?$/i.test(clean(f.category))))return null;
  const saw=!c.emptyBattery&&/^chainsaws?$/i.test(clean(f.category)),stock=c.selectedStock(f),current=c.selectedPriceVariant(f);
  if(!clean(current.sku))return null;
  if(saw){
   const bars=[],seen=new Set();
   for(const v of [...f.variants].sort((a,b)=>num(a.marketplaceRow?.SortOrder)-num(b.marketplaceRow?.SortOrder))){
    if(v.recommendedPackage||/kit|package/i.test(v.type)||!usable({...v.marketplaceRow,SKU:v.sku}))continue;
    const match=clean(v.description).match(/(\d+(?:\.\d+)?)\s*["\u2033\u201d]/);if(!match)continue;
    const size=Number(match[1]),light=/\blight(?:weight)?\b/i.test(clean(v.description)),id=(light?'light':'standard')+size;
    if(seen.has(id))continue;seen.add(id);bars.push({variant:v,size,light});
   }
   const chosen=stock?current:(bars.find(b=>b.variant.sku===states.get(f.key)?.barSku)||bars.find(b=>b.variant.sku===current.sku)||bars[0])?.variant||current;
   if(stock){const size=clean(chosen.description).match(/(\d+(?:\.\d+)?)\s*["\u2033\u201d]/),light=/\blight(?:weight)?\b/i.test(clean(chosen.description));if(size){const bar=bars.find(b=>b.size===Number(size[1])&&b.light===light);if(bar)bar.variant=chosen;}}
   const tool={...chosen,chainsawBarTrial:true,marketplaceRow:{...chosen.marketplaceRow}};
   return {tool,product:tool.marketplaceRow,catalog:[],options:[],bars,stock};
  }
  const original=stock?current:f.variants.find(v=>v.sku===current.sku&&!v.recommendedPackage)||current;
  const source=c.DATA.componentSources?.[clean(f.brand).toUpperCase()]||{};
  const tool={...original,marketplaceRow:{...original.marketplaceRow}},product={...tool.marketplaceRow,SKU:tool.sku,Model:tool.marketplaceRow?.Model||f.model,BrandID:f.brand};
  // Correct the known public export typo using the existing, verified product photo.
  if(/\/RZ14\.jpg$/i.test(clean(tool.marketplaceRow.ImageURL)))tool.marketplaceRow.ImageURL=tool.marketplaceRow.ImageURL.replace(/\/RZ14\.jpg$/i,'/RZ142.jpg');
  const catalog=['attachment','accessory','part'].flatMap(type=>(source[{attachment:'attachments',accessory:'accessories',part:'parts'}[type]]||[]).filter(usable).map(row=>({type,row,quantity:1})));
  const compatible=catalog.filter(p=>compatibility(p.row,product));
  const dependencies=new Set(compatible.flatMap(p=>requirementSlots(p.row,product)).map(p=>key(p.sku)));
  const options=compatible.filter(p=>p.type!=='part'&&!dependencies.has(key(p.row.SKU))).sort((a,b)=>num(a.row.SortOrder)-num(b.row.SortOrder)||clean(a.row.Description).localeCompare(clean(b.row.Description)));
  return {tool,product,catalog,options:stock?[]:options,stock,standard:!(key(f.brand)==='STIHL'&&/^RZ142(?:0)?$/.test(key(f.model))),emptyBattery:c.emptyBattery};
 }
 function state(f){if(!states.has(f.key))states.set(f.key,{selected:new Set()});return states.get(f.key);}
 function configuration(m,s,c){
  const selected=m.options.filter(p=>s.selected.has(key(p.row.SKU))),parts=new Map(selected.map(p=>[key(p.row.SKU),{...p}]));
  try{
   if(!(m.tool.price>0))throw Error('Package pricing needs store confirmation.');
   for(const p of requirements(selected,m.catalog,m.product)){const old=parts.get(key(p.row.SKU));parts.set(key(p.row.SKU),{...p,quantity:Math.max(p.quantity,old?.quantity||0),required:!old});}
   const list=[...parts.values()],price=round(m.tool.price+list.reduce((n,p)=>n+c.currentPrice(p.row)*p.quantity,0)),msrp=round((m.tool.msrp||m.tool.price)+list.reduce((n,p)=>n+num(p.row.MSRP)*p.quantity,0));
   if(list.some(p=>!(num(p.row.MSRP)>0)||!(c.currentPrice(p.row)>0)))throw Error('Package pricing needs store confirmation.');
   const variant=list.length?{...m.tool,type:'Package',recommendedPackage:true,price,msrp,sale:0,rebate:0,packageItems:list.map(p=>({type:p.type,sku:clean(p.row.SKU),name:clean(p.row.Description||p.row.Model),quantity:p.quantity,price:c.currentPrice(p.row)}))}:m.tool;
   return {parts:list,price,msrp,variant};
  }catch(error){return {parts:[],price:0,msrp:0,variant:m.tool,error:error.message};}
 }
 function entry(f){return contexts.get(f.key);}
 function render(f,c){
  const m=model(f,c);if(!m){contexts.delete(f.key);return null;}
  const initial=!states.has(f.key),s=state(f),allowed=new Set(m.options.map(p=>key(p.row.SKU)));
  for(const id of s.selected)if(!allowed.has(id))s.selected.delete(id);
  const config=configuration(m,s,c);contexts.set(f.key,{f,c,m,s});
  const previous=c.selectedPriceVariant(f);
  if(!m.stock&&(!m.standard||s.selected.size>0)&&(initial||previous.sku!==config.variant.sku||previous.price!==config.variant.price||previous.msrp!==config.variant.msrp||JSON.stringify(previous.packageItems||[])!==JSON.stringify(config.variant.packageItems||[])))c.selectPackageVariant(f,config.variant);
  const selected=s.selected.size>0,rows=m.bars?[false,true].map(light=>{
   const label=light?'Light Bar':'Std. Bar';
   return '<div class="pp-component-row"><span class="pp-component-label">'+label+'</span><div role="group" aria-label="'+label+'">'+m.bars.filter(b=>b.light===light).sort((a,b)=>a.size-b.size).map(b=>'<button type="button" data-eqp-bar="'+esc(b.variant.sku)+'" '+(m.stock?'disabled ':'')+'aria-pressed="'+(b.variant.sku===m.tool.sku)+'">'+b.size+'&quot;</button>').join('')+'</div></div>';
  }).join(''):['attachment','accessory'].map(type=>{
   const label=m.emptyBattery?(type==='attachment'?'Batteries':'Chargers'):(type==='attachment'?'Attachments':'Accessories');
   if(m.emptyBattery)return '<div class="pp-component-row"><span class="pp-component-label">'+label+'</span><div role="group" aria-label="'+label+'"></div></div>';
   const count=m.options.filter(item=>item.type===type).length;
   return '<div class="pp-component-row pp-picker-row">'+(count?'<a class="pp-option-picker" href="'+esc(pickerUrl(f,c,type))+'" target="_blank" rel="noopener">'+label+' ('+count+' Available)</a>':'<button class="pp-option-picker" type="button" disabled>'+label+' (0 Available)</button>')+'</div>';
  }).join('');
  const offer=c.promoInfo(m.tool),sale=offer?.type==='sale',basePrice=sale?offer.price:m.tool.msrp||m.tool.price;
  return '<div class="pp-box pp-equipment-base'+(!selected?' pp-selected':'')+'" data-pp-box="tool"><button class="pp-price-select" type="button" data-eqp-select="tool" aria-pressed="'+!selected+'"><span>'+esc(f.brand)+' Base Price:</span><span class="pp-prices">'+(sale?'<del>'+c.money(offer.regular)+'</del>':'')+'<strong>'+c.money(basePrice)+'</strong></span></button></div>'+
   '<div class="pp-box pp-package pp-equipment-package'+(selected?' pp-selected':'')+'" data-pp-box="package"><button class="pp-price-select pp-package-total" type="button" data-eqp-select="package" aria-pressed="'+selected+'"><span>'+(m.emptyBattery?'Package Price:':'Package MSRP:')+'</span><span class="pp-prices"><strong>'+(config.error?'Confirm price':c.money(config.msrp))+'</strong></span></button>'+rows+(config.parts.some(p=>p.required)?'<small class="pp-package-contents">Includes required '+esc(config.parts.filter(p=>p.required).map(p=>p.row.Description).join(' · '))+'</small>':'')+(config.error?'<small class="pp-package-contents" role="alert">'+esc(config.error)+'</small>':'')+'</div>';
 }
 function tool(f){return entry(f)?.m.tool;}
 function buildUrl(f,c){const e=entry(f);if(!e||e.m.stock||e.m.standard)return null;const config=configuration(e.m,e.s,c),url=new URL(c.paymentSelectionUrl(f));url.pathname=url.pathname.replace(/payment-options(?:\.html)?\/?$/,'product-options.html');url.hash='';url.searchParams.set('sku',e.m.tool.sku);url.searchParams.delete('package');url.searchParams.set('cardOptions',JSON.stringify(config.parts.filter(p=>!p.required).map(p=>({type:p.type,sku:clean(p.row.SKU),quantity:p.quantity}))));return url.href;}
 function pickerUrl(f,c,type){
  const e=entry(f);if(!e||e.m.stock)return '';
  const url=new URL(c.paymentSelectionUrl(f));url.pathname=url.pathname.replace(/(?:payment-options|product-options)(?:\.html)?\/?$/,'package-options.html');
  url.hash='';url.searchParams.set('sku',e.m.tool.sku);url.searchParams.set('brand',f.brand);url.searchParams.set('group',type);url.searchParams.delete('package');
  const config=configuration(e.m,e.s,c);url.searchParams.set('cardOptions',JSON.stringify(config.parts.filter(item=>!item.required).map(item=>({type:item.type,sku:clean(item.row.SKU),quantity:item.quantity}))));return url.href;
 }
 function publishedPrice(f,allowsRebate){
  const e=entry(f);if(!e||e.m.stock||e.m.standard)return undefined;const config=configuration(e.m,e.s,e.c);if(config.error)return 0;
  const rows=[{row:e.m.tool.marketplaceRow,quantity:1},...config.parts];
  return round(rows.reduce((n,p)=>n+p.quantity*(allowsRebate?e.c.currentPrice(p.row):window.WEPKitComponents.current({...p.row,RebateToCustomer:0})),0));
 }
 function actions(f,c){const e=entry(f);if(!e)return '';if(e.m.stock||e.m.standard)return window.WestEndPackagePricing?.actions(f,c)||'';const config=configuration(e.m,e.s,c);return '<button class="pp-add-cart" type="button" data-eqp-add aria-label="Add selected tool or package to cart" '+(config.error?'disabled ':'')+'><span aria-hidden="true">🛒</span> Add</button>';}
 function cartRows(e){
  const {f,c,m,s}=e,config=configuration(m,s,c),q=c.selectedPriceQuantity(f);if(config.error)throw Error(config.error);
  const signature=config.parts.map(p=>key(p.row.SKU)+'*'+p.quantity).sort().join('|'),packageId=key(f.brand)+':'+clean(m.tool.sku)+':card:'+encodeURIComponent(JSON.stringify([key(f.brand),key(m.tool.sku),'',signature]));
  const make=(row,type,quantity,price)=>({brandId:key(f.brand),type,sku:clean(row.SKU),quantity,productName:clean(row.Description||row.Model||row.SKU),description:'',itemPrice:price,shipping:null,packageId,equipmentSku:clean(m.tool.sku),inventoryId:'',quoteStockChoice:'orderable',assemblyOption:clean(row.AssemblyOption),assemblyAmount:num(row.AssemblyAmount),setupSelected:clean(row.AssemblyOption).toUpperCase()==='F',setupAmount:clean(row.AssemblyOption).toUpperCase()==='F'?num(row.AssemblyAmount):0,cardConfiguration:true});
  const rows=[{...make({...m.tool.marketplaceRow,SKU:m.tool.sku,Description:m.tool.description},'tool',q,m.tool.price),description:config.parts.map(p=>p.row.Description).join(' · ')},...config.parts.map(p=>({...make(p.row,p.type,p.quantity*q,c.currentPrice(p.row)),packageComponent:true,autoRequiredComponent:!!p.required,perToolQuantity:p.quantity}))];
  if(rows.some(p=>!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>99||!(p.itemPrice>0)))throw Error('Please reduce the quantity or confirm package pricing.');return rows;
 }
 function handle(event){
  const host=event.target.closest('.wep-restored-card'),e=host&&contexts.get(host.dataset.key);if(!e)return false;
  const {f,c,m,s}=e,option=event.target.closest('[data-eqp-option]'),select=event.target.closest('[data-eqp-select]');
  const bar=event.target.closest('[data-eqp-bar]');
  if(bar){if(!m.stock&&m.bars?.some(b=>b.variant.sku===bar.dataset.eqpBar)){s.barSku=bar.dataset.eqpBar;s.selected.clear();c.refreshSelectedCard(f);}return true;}
  if(option||select){
   if(m.stock)return true;
   if(option){const id=key(option.dataset.eqpOption);if(!m.options.some(p=>key(p.row.SKU)===id))return true;s.selected.has(id)?s.selected.delete(id):s.selected.add(id);}
   else if(select.dataset.eqpSelect==='tool')s.selected.clear();
   const config=configuration(m,s,c);c.selectPackageVariant(f,config.variant);c.refreshSelectedCard(f);return true;
  }
  const inventory=event.target.closest('[data-pp-inventory]');if(inventory){
   const config=configuration(m,s,c),items=[{row:{...m.tool.marketplaceRow,SKU:m.tool.sku,Description:m.tool.description}},...config.parts],dialog=document.createElement('dialog');dialog.className='pp-dialog pp-inventory-dialog';dialog.setAttribute('aria-label','Selected configuration inventory');
   dialog.innerHTML='<h2>Selected Configuration Inventory</h2>'+items.map((p,i)=>{const template=document.createElement('template');template.innerHTML=c.inventoryMarkup(f,{sku:p.row.SKU,marketplaceRow:p.row,description:p.row.Description},'option-'+i);return '<section><strong>'+esc(p.row.Description)+'</strong><small class="pp-inventory-sku">SKU: '+esc(p.row.SKU)+'</small>'+(template.content.querySelector('.market-inventory-popover')?.innerHTML||'Contact us to confirm availability.')+'</section>';}).join('')+'<button type="button">Close</button>';
   document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();inventory.focus();},{once:true});dialog.showModal();return true;
  }
  const add=event.target.closest('[data-eqp-add]');if(add){
   try{
    const rows=cartRows(e),saved=JSON.parse(localStorage.getItem('wepCart')||'[]');if(!Array.isArray(saved))throw Error('Your cart could not be read.');
    for(const row of rows){const old=saved.find(x=>x.packageId===row.packageId&&x.type===row.type&&key(x.sku)===key(row.sku));if(old){if(Number(old.quantity)+row.quantity>99)throw Error('Your cart already contains the maximum quantity.');old.quantity=Number(old.quantity)+row.quantity;}else saved.push(row);}
    localStorage.setItem('wepCart',JSON.stringify(saved));c.updateCartFloat();window.dispatchEvent(new CustomEvent('wep:cart-updated'));const status=host.querySelector('.pp-cart-status');if(status)status.textContent='Added to Cart ✓';c.track('marketplace_add_to_cart',{sku:m.tool.sku,model:f.model,quantity:rows[0].quantity});
   }catch(error){const status=host.querySelector('.pp-cart-status');if(status)status.textContent=error.message;}
   return true;
  }
  return false;
 }
 window.WestEndEquipmentPackages={render,tool,buildUrl,actions,handle,publishedPrice,compatibility,requirements,requirementSlots,hasModelRequirements,pickerUrl,shortName};
})();
