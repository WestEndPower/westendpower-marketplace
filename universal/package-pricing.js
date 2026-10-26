/* Workbook package contents and compatible components; no component prices are inferred. */
(() => {
 'use strict';
 const clean=v=>String(v??'').trim(),key=v=>clean(v).replace(/\s+/g,'').toUpperCase();
 const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const yes=v=>/^(T|TRUE|YES|Y|1|X)$/i.test(clean(v));
 const usable=r=>(!clean(r.Active)||yes(r.Active))&&clean(r.SKU)&&! /^(STOP|REFERENCE_ONLY|0000 000 0000)$/i.test(clean(r.SKU));
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 const number=v=>{const n=Number(clean(v).replace(/[$,]/g,''));return Number.isFinite(n)?n:0;};
 const qty=v=>{const n=clean(v)?Number(v):1;return Number.isInteger(n)&&n>0&&n<=99?n:0;};
 const models=new Map(),states=new Map(),contexts=new Map();
 const Kit=window.WEPKitComponents;
 const signature=parts=>parts.map(p=>key(p.row.SKU)+'*'+p.qty).sort().join('|');
 const addParts=(a,b)=>[...a,...b];
 function packageParts(row,type,rows){
  const result=[];let invalid=false;
  for(const field of Object.keys(row).filter(h=>new RegExp('^'+type+'SKU\\d+$','i').test(h))){
   if(!clean(row[field]))continue;
   const suffix=field.match(/\d+$/)[0],component=rows.find(r=>key(r.SKU)===key(row[field])),amount=qty(row[type+'Qty'+suffix]);
   if(!component||!usable(component)||!amount){invalid=true;continue;}
   const previous=result.find(p=>key(p.row.SKU)===key(component.SKU));if(previous)previous.qty+=amount;else result.push({row:component,qty:amount});
  }
  return invalid?null:result;
 }
 function options(rows,type,compat,packages){
  const ids=new Set();for(const r of compat)for(let i=1;i<=30;i++)if(clean(r[type+'ID'+i]))ids.add(key(r[type+'ID'+i]));
  const values=new Map(),insert=parts=>{if(parts?.length)values.set(signature(parts),parts);};
  for(const row of rows.filter(usable)){const explicit=ids.has(key(row.SKU));const preferred=clean(row[type+'ID'])||!rows.some(other=>usable(other)&&clean(other[type+'ID'])&&key(other[type+'ID'])===key(row.Model));if(explicit||(preferred&&[row[type+'ID'],row.Model].some(v=>key(v)&&ids.has(key(v)))))insert([{row,qty:1}]);}
  for(const p of packages){const parts=p[type.toLowerCase()];insert(parts);for(const part of parts)insert([{row:part.row,qty:1}]);}
  for(const r of compat){const id=key(r['Recommended'+type+'ID1']),amount=qty(r['Recommended'+type+'Qty1']);const row=rows.find(x=>usable(x)&&[x.SKU,x[type+'ID'],x.Model].some(v=>key(v)&&key(v)===id));if(row&&amount)insert([{row,qty:amount}]);}
  return [...values.values()].sort((a,b)=>a[0].row[type+'ID']?.localeCompare(b[0].row[type+'ID']||'',undefined,{numeric:true})||signature(a).localeCompare(signature(b)));
 }
 function model(f,c){
  if(!/battery/i.test(f.power)||c.selectedStock(f))return null;
  const source=c.DATA.componentSources?.[key(f.brand)]||(key(f.brand)==='STIHL'?{batteries:c.DATA.batteries,chargers:c.DATA.chargers,compatibility:c.DATA.compatibility,packages:c.DATA.packages||[]}:null);
  if(!source)return null;
  if(models.has(f.key))return models.get(f.key);
  const tool=f.variants.find(v=>!v.recommendedPackage&&!/kit|package/i.test(v.type)&&v.price>0);
  if(!tool)return null; // A kit-only SKU cannot be dismantled into an invented bare-tool SKU.
  // The unit feed can omit batteries/chargers entirely. Only an explicit component
  // record overrides its published stock fields; a missing record is not zero stock.
  const inventory=c.DATA.inventoryByBrand?.get(key(f.brand)),visible=r=>{
   const record=inventory?.loaded?inventory.get(key(r.SKU).replace(/[^A-Z0-9]/g,'')):undefined;
   return !Kit||Kit.visible(r,record?.quantity);
  };
  const batteries=(source.batteries||[]).filter(visible),chargers=(source.chargers||[]).filter(visible),runtime=source.compatibility||[];
  let compat=runtime.filter(r=>(!clean(r.Active)||yes(r.Active))&&!clean(r.AttachmentSKU)&&key(r.ToolSKU)===key(tool.sku));
  if(!compat.length)compat=runtime.filter(r=>(!clean(r.Active)||yes(r.Active))&&!clean(r.AttachmentSKU)&&key(r.Model)&&key(r.Model)===key(tool.model||f.model));
  const packages=[];
  for(const row of source.packages||[]){
   if(clean(row.Active)&&!yes(row.Active))continue;
   const variant=f.variants.find(v=>!v.recommendedPackage&&key(v.sku)===key(row.ParentSKU)&&v.price>0);if(!variant)continue;
   const battery=packageParts(row,'Battery',batteries),charger=packageParts(row,'Charger',chargers);
   if(!battery||!charger||(!battery.length&&!charger.length))continue;
   const fixed=[];let invalid=false;
   for(const type of ['Attachment','Accessory','Part']){const parts=packageParts(row,type,source[{Attachment:'attachments',Accessory:'accessories',Part:'parts'}[type]]||[]);if(parts===null){invalid=true;break;}fixed.push(...parts.map(p=>({...p,type:type.toLowerCase()})));}
   if(invalid)continue;
   packages.push({variant,battery,charger,fixed});
  }
  packages.sort((a,b)=>a.variant.price-b.variant.price);
  const batteryOptions=options(batteries,'Battery',compat,packages),chargerOptions=options(chargers,'Charger',compat,packages);
  if(!batteryOptions.length&&!chargerOptions.length)return null;
  const recommended=(type,rows,choices)=>{
   const r=compat[0]||{},id=key(r['Recommended'+type+'ID1']),amount=qty(r['Recommended'+type+'Qty1']);
   return choices.find(parts=>parts.length===1&&parts[0].qty===amount&&[parts[0].row.SKU,parts[0].row[type+'ID'],parts[0].row.Model].some(v=>key(v)&&key(v)===id))||[];
  };
  const complete=packages.filter(p=>p.battery.length&&p.charger.length);
  const promotional=complete.find(p=>c.promoInfo(p.variant)?.savings>0),cheapest=promotional||complete[0];
  const m={tool,packages,batteryOptions,chargerOptions,source,defaultPackage:cheapest,defaultBattery:cheapest?.battery||recommended('Battery',batteries,batteryOptions),defaultCharger:cheapest?.charger||recommended('Charger',chargers,chargerOptions)};
  models.set(f.key,m);return m;
 }
 function state(f,m){
  if(!states.has(f.key))states.set(f.key,{choice:'package',battery:m.defaultBattery,charger:m.defaultCharger,batterySeries:m.defaultBattery.length&&Kit?Kit.batteryGroup(m.defaultBattery[0].row,f.brand):null});
  return states.get(f.key);
 }
 function configured(m,s,c){
  const energy=addParts(s.battery.map(p=>({...p,type:'battery'})),s.charger.map(p=>({...p,type:'charger'}))),match=m.packages.find(p=>signature(p.battery)===signature(s.battery)&&signature(p.charger)===signature(s.charger));
  const included=[...energy,...(match?.fixed||[])];let extras=[];
  try{extras=(Kit?.required({...m.tool.marketplaceRow,SKU:m.tool.sku},s.battery,m.source.requirements||[],m.source)||[]).map(p=>({...p,qty:Math.max(0,p.qty-included.filter(x=>x.type===p.type&&key(x.row.SKU)===key(p.row.SKU)).reduce((n,x)=>n+x.qty,0))})).filter(p=>p.qty>0);}catch(error){return {variant:{...m.tool,price:0},regular:0,price:0,parts:included,kit:false,error:error.message};}
  const parts=[...included,...extras];
  const priced=parts.every(p=>c.currentPrice(p.row)>0);
  const separate=m.tool.price+parts.reduce((n,p)=>n+c.currentPrice(p.row)*p.qty,0);
  const regular=m.tool.msrp>0&&parts.every(p=>number(p.row.MSRP)>0)?m.tool.msrp+parts.reduce((n,p)=>n+number(p.row.MSRP)*p.qty,0):0;
  if(match){const added=extras.reduce((n,p)=>n+c.currentPrice(p.row)*p.qty,0),price=extras.every(p=>c.currentPrice(p.row)>0)?match.variant.price+added:0,variant=extras.length?{...match.variant,recommendedPackage:true,price,packageItems:extras.map(p=>({sku:p.row.SKU,name:p.row.Description,quantity:p.qty,price:c.currentPrice(p.row)}))}:match.variant;return {variant,regular,price,parentPrice:match.variant.price,parts,extras,included,kit:true};}
  const variant={...m.tool,type:'Package',recommendedPackage:true,price:priced?separate:0,msrp:regular,sale:0,rebate:0,packageItems:parts.map(p=>({sku:clean(p.row.SKU),name:clean(p.row.BatteryID||p.row.ChargerID||p.row.Model||p.row.Description),quantity:p.qty,price:c.currentPrice(p.row)}))};
  return {variant,regular,price:priced?separate:0,parts,kit:false};
 }
 function prices(regular,price){if(!(price>0))return '<strong>Confirm price</strong>';return '<span class="pp-prices">'+(regular>price+.005?'<del>'+money(regular)+'</del>':'')+'<strong>'+money(price)+'</strong></span>';}
 function optionName(parts,type){return parts.map(p=>(/^(AS|AK|AP|AR|AL)\s*\d/i.test(clean(p.row[type+'ID']||p.row.Model))?clean(p.row[type+'ID']||p.row.Model).replace(/\s+/g,''):clean(p.row[type+'ID']||p.row.Model||p.row.ChargerName||p.row.Description))+(p.qty>1?' × '+p.qty:'')).join(' + ');}
 function compatibleCharger(parts,battery){
  if(!battery.length)return true;
  return parts.every(p=>battery.every(b=>{const ids=Object.keys(b.row).filter(h=>/^ChargerID\d+$/.test(h)).map(h=>key(b.row[h])).filter(Boolean);return !ids.length||[p.row.ChargerID,p.row.Model,p.row.SKU].some(v=>ids.includes(key(v)));}));
 }
 function row(f,m,s,type){
  const field=type.toLowerCase(),choices=m[field+'Options'],selected=s[field];
  const groups=new Map(),seen=new Set(),identity=parts=>parts.map(p=>key(p.row.SKU)).sort().join('|');
  choices.forEach((parts,i)=>{const id=identity(parts);if(seen.has(id))return;seen.add(id);const group=type==='Battery'?(Kit?Kit.batteryGroup(parts[0].row,f.brand):'Batteries'):'Chargers';if(!groups.has(group))groups.set(group,[]);
   const active=id===identity(selected),disabled=type==='Charger'&&!compatibleCharger(parts,s.battery),label=parts.map(p=>Kit?Kit.shortName(p.row,group):optionName([p],type)).join(' + ');
   groups.get(group).push('<button type="button" data-pp-component="'+field+'" data-pp-index="'+i+'" aria-pressed="'+active+'" '+(disabled?'disabled ':'')+'title="'+esc((active?'Click to remove ':'Select ')+optionName(parts,type))+'">'+esc(label)+'</button>');
  });
  const order=['Batteries','AP / AR Series','PRO AP Series','82BD Series','CORE Series','Chargers'];
  const ordered=[...groups].sort((a,b)=>(order.indexOf(a[0])<0?99:order.indexOf(a[0]))-(order.indexOf(b[0])<0?99:order.indexOf(b[0])));
  if(type==='Charger')return '<div class="pp-energy-row"><strong class="pp-energy-heading">Chargers</strong><div role="group" aria-label="Chargers">'+ordered.flatMap(([,buttons])=>buttons).join('')+'</div></div>';
  if(!ordered.length)return '';
  const selectedGroup=selected.length?(Kit?Kit.batteryGroup(selected[0].row,f.brand):'Batteries'):null;
  if(!groups.has(s.batterySeries))s.batterySeries=groups.has(selectedGroup)?selectedGroup:ordered[0][0];
  const series=ordered.length>1||ordered[0][0]!=='Batteries';
  const label=group=>group==='AP / AR Series'?'AP Series':group==='PRO AP Series'?'Pro AP Series':group==='CORE Series'?'Core Series':group;
  return '<div class="pp-energy-row">'+(series?'<div class="pp-series-tabs" role="group" aria-label="Battery series">'+ordered.map(([group])=>'<button type="button" data-pp-series="'+esc(group)+'" aria-pressed="'+(group===s.batterySeries)+'">'+esc(label(group))+'</button>').join('')+'</div>':'<strong class="pp-energy-heading">Batteries</strong>')+'<div role="group" aria-label="Battery models">'+groups.get(s.batterySeries).join('')+'</div></div>';

 }
 function inventory(c,f,v,kind){return '<div class="market-price-inventory">'+c.inventoryMarkup(f,v,kind)+'</div>';}
 function render(f,c){
  contexts.set(f.key,{f,c});const m=model(f,c);if(!m)return null;
  const initial=!states.has(f.key),s=state(f,m),pkg=configured(m,s,c);
  if(initial&&s.choice==='package')c.selectPackageVariant(f,pkg.variant);
  return '<div class="pp-box'+(s.choice==='tool'?' pp-selected':'')+'" data-pp-box="tool">'+
   '<button class="pp-price-select" type="button" data-pp-select="tool" aria-pressed="'+(s.choice==='tool')+'"><span>'+esc(clean(f.brand)?clean(f.brand)+' Base Price:':'Base Price:')+'</span>'+prices(m.tool.msrp,m.tool.price)+'</button></div>'+
   '<div class="pp-box pp-package'+(s.choice==='package'?' pp-selected':'')+'" data-pp-box="package">'+
   '<button class="pp-price-select pp-package-total" type="button" data-pp-select="package" aria-pressed="'+(s.choice==='package')+'"><span>Package Price:</span>'+prices(pkg.regular,pkg.price)+'</button>'+
   row(f,m,s,'Battery')+row(f,m,s,'Charger')+((pkg.parts.some(p=>p.qty>1)||pkg.parts.some(p=>!['battery','charger'].includes(p.type)))?'<small class="pp-package-contents">Includes: '+esc(['battery','charger'].map(type=>{const count=pkg.parts.filter(p=>p.type===type).reduce((n,p)=>n+p.qty,0);return count?count+' '+(type==='battery'?(count===1?'battery':'batteries'):(count===1?'charger':'chargers')):'';}).filter(Boolean).concat(pkg.parts.some(p=>!['battery','charger'].includes(p.type))?['Required items included']:[]).join(' · '))+'</small>':'')+(pkg.error?'<small class="pp-package-contents">'+esc(pkg.error)+'</small>':'')+'</div>';
 }
 function popup(message,opener){
  document.querySelector('.pp-dialog')?.remove();const dialog=document.createElement('dialog');dialog.className='pp-dialog';dialog.setAttribute('aria-label','Choose your purchase option');
  const p=document.createElement('p');p.textContent=message;const close=document.createElement('button');close.type='button';close.textContent='OK';close.onclick=()=>dialog.close();dialog.append(p,close);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();opener?.focus();},{once:true});dialog.showModal();
 }
 function apply(f,m,s,c){const v=s.choice==='tool'?m.tool:configured(m,s,c).variant;c.selectPackageVariant(f,v);c.refreshSelectedCard(f);}
 function cartRows(f,c,m,s){
  const selected=c.selectedPriceVariant(f),stock=c.selectedStock(f),q=c.selectedPriceQuantity(f);
  const config=m&&s.choice==='package'?configured(m,s,c):null,v=m?(s.choice==='tool'?m.tool:config.variant):selected;
  if(!(v.price>0))throw Error('Pricing is not available for this selection.');
  const components=config?(config.kit?config.extras||[]:config.parts):[];
  const identity=JSON.stringify([key(f.brand),key(v.sku),stock?.selectionId||'',signature(components)]);
  const packageId=key(f.brand)+':'+clean(v.sku)+':card:'+encodeURIComponent(identity);
  const make=(row,type,quantity,price)=>({brandId:key(f.brand),type,sku:clean(row.SKU),quantity,productName:clean(row.Description||row.Model||row.SKU),description:'',itemPrice:price,shipping:null,packageId,equipmentSku:clean(v.sku),inventoryId:type==='tool'?stock?.selectionId||'':'',quoteStockChoice:type==='tool'&&stock?'stock':'orderable',assemblyOption:clean(row.AssemblyOption),assemblyAmount:number(row.AssemblyAmount),setupSelected:clean(row.AssemblyOption).toUpperCase()==='F',setupAmount:clean(row.AssemblyOption).toUpperCase()==='F'?number(row.AssemblyAmount):0,cardConfiguration:true});
  const tool=m&&config&&!config.kit?m.tool:v;
  const toolType=/^batteries$/i.test(f.category)?'battery':/^chargers$/i.test(f.category)?'charger':/^attachments?$/i.test(f.category)?'attachment':/^accessories$/i.test(f.category)?'accessory':/^parts$/i.test(f.category)?'part':'tool';
  const toolRow=make({...tool.marketplaceRow,SKU:tool.sku,Description:tool.description},toolType,q,config?.kit?config.parentPrice:tool.price);
  if(config?.kit&&Kit){try{toolRow.kitComponents=Kit.breakdown({parent:{SKU:tool.sku},tool:{...m.tool.marketplaceRow,SKU:m.tool.sku,Description:m.tool.description},parts:config.included},config.parentPrice,q,{price:c.currentPrice,toolPrice:m.tool.price});}catch(error){toolRow.kitBreakdownIssue=error.message;}}
  if(config)toolRow.description=config.parts.map(p=>optionName([p],p.type==='battery'?'Battery':'Charger')).join(' · ');
  const rows=[toolRow,...components.map(p=>({...make(p.row,p.type,p.qty*q,c.currentPrice(p.row)),packageComponent:true,perToolQuantity:p.qty}))];
  if(rows.some(r=>!Number.isInteger(r.quantity)||r.quantity<1||r.quantity>99))throw Error('Please reduce the quantity before adding this package.');
  return rows;
 }
 function add(f,c,m,s,opener,increment=true){
  if(m&&!s.choice){popup('No option selected. Please select the manufacturer Base Price or Package Price to continue.',opener);return false;}
  try{
   const rows=cartRows(f,c,m,s),saved=JSON.parse(localStorage.getItem('wepCart')||'[]');if(!Array.isArray(saved))throw Error('Your cart could not be read.');
   for(const row of rows){const old=saved.find(x=>x.packageId===row.packageId&&x.type===row.type&&key(x.sku)===key(row.sku));if(old){if(!increment)continue;if(Number(old.quantity)+row.quantity>99)throw Error('Your cart already contains the maximum quantity for this configuration.');old.quantity=Number(old.quantity)+row.quantity;}else saved.push(row);}
   localStorage.setItem('wepCart',JSON.stringify(saved));c.updateCartFloat();window.dispatchEvent(new CustomEvent('wep:cart-updated'));
   const status=document.querySelector('.market-card[data-key="'+CSS.escape(f.key)+'"] .pp-cart-status');if(status)status.textContent='Added to Cart ✓';
   c.track('marketplace_add_to_cart',{sku:rows[0].sku,model:f.model,quantity:rows[0].quantity});return true;
  }catch(error){popup(error.message||'This selection could not be added. Please try again.',opener);return false;}
 }
 function handle(event){
  const host=event.target.closest('.wep-restored-card'),entry=host&&contexts.get(host.dataset.key);if(!entry)return false;
  const {f,c}=entry,m=model(f,c),s=m&&state(f,m),component=event.target.closest('[data-pp-component]');
  const series=event.target.closest('[data-pp-series]');
  if(series&&m){s.batterySeries=series.dataset.ppSeries;c.refreshSelectedCard(f);return true;}
  let select=event.target.closest('[data-pp-select]');const box=event.target.closest('[data-pp-box]');
  if(!select&&box&&!event.target.closest('button,a,.market-inventory-wrap'))select={dataset:{ppSelect:box.dataset.ppBox}};
  if(component&&m){const field=component.dataset.ppComponent,parts=m[field+'Options'][Number(component.dataset.ppIndex)];if(!parts||component.disabled)return true;const same=parts.map(p=>key(p.row.SKU)).sort().join('|')===s[field].map(p=>key(p.row.SKU)).sort().join('|');s[field]=same?[]:parts;if(!same){const kit=m.packages.find(p=>p[field].length&&p[field].every(x=>parts.some(y=>key(y.row.SKU)===key(x.row.SKU)))&&(field==='battery'?signature(p.charger)===signature(s.charger):signature(p.battery)===signature(s.battery)));if(kit){s.battery=kit.battery;s.charger=kit.charger;}}if(field==='battery'&&!compatibleCharger(s.charger,s.battery))s.charger=[];s.choice='package';apply(f,m,s,c);document.querySelector('.market-card[data-key="'+CSS.escape(f.key)+'"] [data-pp-component="'+field+'"][data-pp-index="'+component.dataset.ppIndex+'"]')?.focus({preventScroll:true});return true;}
  if(select&&m){s.choice=s.choice===select.dataset.ppSelect?null:select.dataset.ppSelect;apply(f,m,s,c);return true;}
  const check=event.target.closest('[data-pp-inventory]');if(check){
   const compact=/^compact tractors?$/i.test(clean(f.category)),heading=compact?'Selected Configuration Inventory':'Tool &amp; Package Inventory';
   const dialog=document.createElement('dialog');dialog.className='pp-dialog pp-inventory-dialog';dialog.setAttribute('aria-label',compact?'Selected configuration inventory':'Tool and package inventory');
   const variants=compact?[c.selectedPriceVariant(f)]:m?[m.tool,...m.packages.map(p=>p.variant)]:f.variants;
   const parts=m?[...m.batteryOptions.flat(),...m.chargerOptions.flat(),...configured(m,s,c).parts]:[];
   const items=[...variants.filter(v=>!v.recommendedPackage).map(v=>({row:{...v.marketplaceRow,SKU:v.sku,Description:v.description},qty:1})),...parts];
   const seen=new Set();
   dialog.innerHTML='<h2>'+heading+'</h2>'+items.filter(p=>{const id=key(p.row.SKU);if(seen.has(id))return false;seen.add(id);return true;}).map((p,i)=>{const v={sku:p.row.SKU,marketplaceRow:p.row,description:p.row.Description},template=document.createElement('template');template.innerHTML=c.inventoryMarkup(f,v,'component-'+i);return '<section><strong>'+esc(clean(p.row.BatteryID||p.row.ChargerID||p.row.Description||p.row.SKU))+'</strong><small class="pp-inventory-sku">SKU: '+esc(p.row.SKU)+'</small>'+(template.content.querySelector('.market-inventory-popover')?.innerHTML||'Contact us to confirm availability.')+'</section>';}).join('')+'<button type="button">Close</button>';
   document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();check.focus();},{once:true});dialog.showModal();return true;
  }
  const addButton=event.target.closest('[data-pp-add]');if(addButton){add(f,c,m,s,addButton);return true;}
  const build=event.target.closest('[data-pp-build]');if(build&&m){event.preventDefault();if(add(f,c,m,s,build,false))location.assign('checkout.html'+(new URLSearchParams(location.search).get('api')==='local'?'?api=local':''));return true;}
  return false;
 }
 function actions(f,c){contexts.set(f.key,{f,c});return '<button class="pp-add-cart" type="button" data-pp-add title="Add selected tool or package to cart" aria-label="Add selected tool or package to cart"><span aria-hidden="true">🛒</span> Add</button>';}
 function tool(f,c){return model(f,c)?.tool||c.selectedPriceVariant(f);}
 function buildUrl(f,c){
  const url=new URL(c.paymentSelectionUrl(f));url.pathname=url.pathname.replace(/payment-options(?:\.html)?\/?$/,'product-options.html');url.hash='';
  url.searchParams.set('cardOptions','[]');
  const m=model(f,c);if(m){const s=state(f,m),pkg=s.choice==='tool'?null:configured(m,s,c),v=pkg?.variant||m.tool;
   url.searchParams.set('sku',v.sku);url.searchParams.delete('package');
   url.searchParams.set('cardOptions',JSON.stringify((pkg?(pkg.kit?pkg.extras||[]:pkg.parts):[]).map(p=>({type:p.type,sku:clean(p.row.SKU),quantity:p.qty}))));
  }
  return url.href;
 }
 function warranty(row){
  const residential=clean(row.WarrantyResidentialUse||row.WarrantyResidential),commercial=clean(row.WarrantyCommercialUse||row.WarrantyCommercial),general=clean(row.Warranty||row.WarrantyText);
  const text=[residential&&(residential+(/residential/i.test(residential)?'':' · Residential')),commercial&&(commercial+(/commercial|professional/i.test(commercial)?'':' · Commercial'))].filter(Boolean).join(' | ')||general;if(!text)return '';
  let url='';try{const parsed=new URL(clean(row.WarrantyURL||row.WarrantyStatementURL||row.ManufacturerWarrantyURL));if(['http:','https:'].includes(parsed.protocol))url=parsed.href;}catch{}
  return '<div class="market-card-warranty">'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">':'<span>')+esc(text)+(url?'</a>':'</span>')+'</div>';
 }
 window.WestEndPackagePricing={render,actions,handle,warranty,tool,buildUrl};
})();
