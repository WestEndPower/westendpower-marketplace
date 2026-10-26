(function(){
'use strict';
 const buildStorage=window.WEPDealerOrderEdit?.storage||window.localStorage;
const qs=new URLSearchParams(location.search);
const implementBrowser=/\/choose-implements\.html$/i.test(location.pathname);
window.addEventListener('pageshow',event=>{if(event.persisted&&!implementBrowser)location.reload();});
const sku=(qs.get('sku')||'').trim();
const category=(qs.get('category')||'Equipment').trim();
const returnUrl=(qs.get('return')||'').trim();
let safeReturn='';
try{const url=new URL(returnUrl,location.href);if(returnUrl&&url.origin===location.origin&&/^https?:$/.test(url.protocol))safeReturn=url.href}catch(_){}
function updateReturn(product,brand){
 const params=new URLSearchParams();
 if(brand)params.set('brand',brand.toUpperCase());
 if(category!=='Equipment')params.set('category',category);
 if(product&&String(product.Model||'').trim())params.set('model',String(product.Model).trim());
 $('return-link').href=safeReturn||('./marketplace.html'+(params.size?'?'+params.toString():''));
 $('return-link').textContent='← Return to '+(safeReturn?(/\/checkout(?:\.html)?\/?$/i.test(new URL(safeReturn).pathname)?'Quote':'Marketplace selection'):category);
}
// WEP_MARKET_OPTIONS_V1
let selectedProduct=null,selectedBrand='',stockLocations=[],buildContext=null;
const requestedBrand=(qs.get('brand')||'').trim().toLowerCase();
// WEP_ALL_BRAND_QUOTE_OPTIONS_V1
const brandRegistry=Object.values(window.WESTEND_BRANDS||{});
function quoteEnabled(){return brandRegistry.some(b=>String(b.id).toLowerCase()===selectedBrand);}
const $=id=>document.getElementById(id);
const clean=v=>String(v==null?'':v).replace(/^\uFEFF/,'').trim();
const money=v=>{const n=Number(clean(v).replace(/[$,]/g,''));return Number.isFinite(n)?n:0};
const fmt=n=>'$'+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>clean(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const trueish=v=>['T','TRUE','Y','YES','1','X'].includes(clean(v).toUpperCase());

function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;}else field+=c;}
  else{if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 }
 if(field.length||row.length){row.push(field);rows.push(row)}
 const headers=(rows.shift()||[]).map((h,i)=>i===0?clean(h):clean(h));
 return rows.filter(r=>r.some(x=>clean(x)!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
async function csv(path,optional=false){const r=await fetch(path,{cache:'no-store'});if(optional&&r.status===404)return [];if(!r.ok)throw new Error(path+' '+r.status);return parseCSV(await r.text())}

function runtimeSection(compat,batteries){
 const rows=[];
 for(let i=1;i<=10;i++){
  const id=clean(compat['BatteryID'+i]);
  if(!id)continue;
  const battery=batteries.find(b=>clean(b.BatteryID).toUpperCase()===id.toUpperCase());
  const min=clean(compat['RunTimeMin'+i]),max=clean(compat['RunTimeMax'+i]);
  const valid=v=>v!==''&&Number.isFinite(Number(v))&&Number(v)>0;
  if(!valid(min)&&!valid(max))continue;
  const value=valid(min)&&valid(max)?(min===max?min:min+'–'+max):(valid(max)?'Up to '+max:min);
  rows.push('<tr><th scope="row">'+esc(battery&&(battery.Model||battery.Description)||id)+'</th><td>'+esc(value)+' minutes</td></tr>');
 }
 if(!rows.length&&qs.get('view')!=='runtime')return '';
 return '<section id="battery-runtime" class="section"><h2>Battery Run Times</h2>'+(rows.length?'<table><thead><tr><th scope="col">Battery</th><th scope="col">Estimated run time</th></tr></thead><tbody>'+rows.join('')+'</tbody></table><p class="note">Published estimates vary with use and conditions. Confirm the battery and equipment combination with either store.</p>':'<p>Contact New Milford or Danbury for run-time information for this product.</p>')+'</section>';
}

function requiredSetup(x){return clean(x&&x.AssemblyOption).toUpperCase()==='F'?Math.max(0,money(x.AssemblyAmount)):0}
function assemblyAmount(x){return Math.max(0,money(x&&x.AssemblyAmount))}
function assemblyCode(x){return clean(x&&x.AssemblyOption).toUpperCase()}
function setupChoice(type,id){return document.querySelector('[data-install-type="'+CSS.escape(type)+'"][data-install-sku="'+CSS.escape(String(id))+'"]')}
function mainSetupSelected(){return assemblyCode(selectedProduct)==='F'||(assemblyCode(selectedProduct)==='T'&&!!setupChoice('tool',sku)?.checked)}
function optionSetupSelected(c){return c.dataset.setupOption==='F'||(c.dataset.setupOption==='T'&&!!setupChoice(c.dataset.type,c.dataset.sku)?.checked)}
function setupMarkup(x,type){
 const amount=assemblyAmount(x),code=assemblyCode(x);
 if(amount===0)return '<p class="note">Set-Up / Assembly Included</p>';
 if(code==='T')return '<label class="note"><input type="checkbox" class="setup-choice" data-install-type="'+esc(type)+'" data-install-sku="'+esc(x.SKU)+'" checked> Optional Dealer Installation: '+fmt(amount)+' per item</label>';
 if(code==='F')return '<p class="note">Required Set-Up / Assembly: '+fmt(amount)+' per item</p><p class="note">Additional to item price. Added automatically.</p>';
 return '<p class="note">Dealer installation fee: '+fmt(amount)+' per item. Confirm with the store.</p>';
}

function inlineImplementPanel(items){
 const groups=implementGroups(items);
 return '<section class="section wep-inline-implements"><div class="wep-carousel-heading wep-implements-main-heading"><h2>Compatible Implements</h2></div><button type="button" class="stock-action wep-implement-back" hidden>← All Implements</button><div class="wep-implement-type-row" data-wep-implement-types tabindex="0" role="region" aria-label="Implement types">'+groups.map((group,index)=>{
  const sample=group.items.find(item=>imageUrl(item))||group.items[0],categoryImage=selectedBrand==='yanmar'?implementCategoryImages[group.name]:'';
  const picture=imageUrl(sample)?img(sample,group.name):categoryImage?'<img src="'+esc(categoryImage)+'" alt="'+esc(group.name)+'" loading="lazy">':img(sample,group.name);
  return '<button type="button" class="wep-inline-implement-tile" data-wep-implement-group="'+index+'" aria-controls="wep-inline-implement-group-'+index+'" aria-expanded="false"><span class="wep-inline-implement-image">'+picture+'</span><strong>'+esc(group.name)+'</strong><span>'+group.items.length+' '+(group.items.length===1?'Option':'Options')+'</span></button>';
 }).join('')+'</div><div class="wep-inline-implement-groups">'+groups.map((group,index)=>'<div id="wep-inline-implement-group-'+index+'" data-wep-implement-group-content hidden>'+optionSection(group.name+' ('+group.items.length+' '+(group.items.length===1?'Option':'Options')+')',group.items,'attachment')+'</div>').join('')+'</div></section>';
}
function buildPanels(bats,chgs,atts,accs,prts,impls=[]){
 const groups=[['energy','Batteries & Chargers',bats.length+chgs.length,optionSection('Additional Batteries',bats,'battery')+optionSection('Additional Chargers',chgs,'charger')],['implement','Implements',impls.length,inlineImplementPanel(impls)],['attachment','Attachments',atts.length,optionSection('Compatible Attachments',atts,'attachment')],['accessory','Accessories',accs.length,optionSection('Compatible Accessories',accs,'accessory')],['part','Parts',prts.length,optionSection('Maintenance & Replacement Parts',prts,'part')]].filter(x=>x[2]);
 if(!groups.length)return '<p class="empty">No additional compatible options are currently listed for this SKU.</p>';
 return '<nav class="wep-option-nav" aria-label="Compatible options">'+groups.map(([id,label,count])=>'<button type="button" data-wep-panel="'+id+'" aria-controls="wep-panel-'+id+'" aria-expanded="false">'+label+' ('+count+' Available)</button>').join('')+'</nav>'+groups.map(([id,label,count,html])=>'<div class="wep-option-panel" id="wep-panel-'+id+'" hidden>'+html+'</div>').join('');
}

function wireBuildPage(){
 const implementPanel=$('wep-panel-implement');
 if(implementPanel){
  const tiles=implementPanel.querySelector('[data-wep-implement-types]'),back=implementPanel.querySelector('.wep-implement-back');
  implementPanel.querySelectorAll('[data-wep-implement-group]').forEach(button=>button.addEventListener('click',()=>{
   implementPanel.classList.remove('wep-view-all-active');
   const all=implementPanel.querySelector('.wep-view-all-options');if(all){all.textContent='View All';all.setAttribute('aria-expanded','false');}
   tiles.hidden=true;back.hidden=false;
   implementPanel.querySelectorAll('[data-wep-implement-group-content]').forEach(group=>group.hidden=group.id!=='wep-inline-implement-group-'+button.dataset.wepImplementGroup);
   implementPanel.querySelectorAll('[data-wep-implement-group]').forEach(tile=>tile.setAttribute('aria-expanded',String(tile===button)));
   back.dataset.returnFocus=button.dataset.wepImplementGroup;window.dispatchEvent(new Event('resize'));
  }));
  back.addEventListener('click',()=>{
   tiles.hidden=false;back.hidden=true;
   implementPanel.querySelectorAll('[data-wep-implement-group-content]').forEach(group=>group.hidden=true);
   implementPanel.querySelectorAll('[data-wep-implement-group]').forEach(tile=>tile.setAttribute('aria-expanded','false'));
   implementPanel.querySelector('[data-wep-implement-group="'+back.dataset.returnFocus+'"]')?.focus({preventScroll:true});
   window.dispatchEvent(new Event('resize'));
  });
 }
 const summary=document.querySelector('.wep-compact-actions'),hero=document.querySelector('.hero');
 if(summary&&hero){hero.classList.add('wep-summary-hero');hero.appendChild(summary);}
 $('wep-print-build')?.addEventListener('click',()=>window.print());
 document.querySelectorAll('[data-wep-panel]').forEach(button=>button.addEventListener('click',()=>{
  const opening=button.getAttribute('aria-expanded')!=='true';
  document.querySelectorAll('[data-wep-panel]').forEach(b=>b.setAttribute('aria-expanded','false'));
  document.querySelectorAll('.wep-option-panel').forEach(p=>p.hidden=true);
  button.setAttribute('aria-expanded',String(opening));const panel=$('wep-panel-'+button.dataset.wepPanel);panel.hidden=!opening;
  if(opening)panel.scrollIntoView({behavior:'smooth',block:'start'});
 }));
 document.querySelectorAll('.wep-card-chart').forEach(button=>button.addEventListener('click',()=>WEPBuildBuy.openChart(buildContext,button.dataset.wepCardKind,button.dataset.wepCardSku)));
 const groupButtons=[...document.querySelectorAll('[data-wep-panel]')];
 const batteryProduct=/battery/i.test(clean(selectedProduct.PowerType));
 const preferred=batteryProduct?groupButtons.find(b=>b.dataset.wepPanel==='energy'):groupButtons.find(b=>b.dataset.wepPanel!=='energy');
 const first=preferred||groupButtons[0];
 if(first){first.setAttribute('aria-expanded','true');$('wep-panel-'+first.dataset.wepPanel).hidden=false;}
 $('wep-runtime')?.addEventListener('click',()=>WEPBuildBuy.openChart(buildContext));
 if(qs.get('view')==='runtime'&&WEPBuildBuy.hasChart(buildContext))WEPBuildBuy.openChart(buildContext);
}

function currentPrice(x){return money(x.SalePrice)>0?money(x.SalePrice):money(x.MSRP)}
function imageUrl(x){let v=clean(x.ImageURL).replace(/\\/g,'/');if(!v)return '';if(/^https?:\/\//i.test(v))return v;if(v.startsWith('/'))return v;v=v.replace(/^\.\//,'');if(/^brands\//i.test(v))return v;if(selectedBrand==='yanmar'&&/^images\//i.test(v))return v;return 'brands/'+selectedBrand+'/'+v}
function img(x,alt){const src=imageUrl(x);return src?'<img src="'+esc(src)+'" alt="'+esc(alt)+'" loading="lazy">':'<div class="placeholder">Image Coming Soon</div>'}
function stockMarkup(x){
 const name=clean(x.Description)||clean(x.Model)||clean(x.SKU);
 const rows=stockLocations.filter(location=>clean(location.Phone)).map(location=>{
  const label=clean(location.ShortName)||clean(location.LocationName)||'Store';
  const field=/danbury/i.test(label)?'QtyDanbury':/milford/i.test(label)?'QtyNewMilford':'';
  const stocked=field&&money(x[field])>0;
  const message='Please confirm '+(stocked?'availability':'availability or lead time')+' for '+selectedBrand.toUpperCase()+' '+name+' (SKU '+clean(x.SKU)+') at '+label+'. Quantity 1. '+window.location.href;
  const separator=/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?';
  return '<div>'+esc(label)+' - '+(stocked?'Confirm Availability':'Request Lead Time')+'<a data-stock-sku="'+esc(x.SKU)+'" href="'+esc('sms:'+clean(location.Phone).replace(/[^0-9+]/g,'')+separator+'body='+encodeURIComponent(message))+'">Text to Confirm</a></div>';
 }).join('');
 return '<details class="stock-details"><summary class="stock-action">Check Stock</summary>'+(rows||'<p>Contact New Milford or Danbury to confirm availability.</p>')+'<small>Opens your text app. Send the message to request confirmation.</small></details>';
}
function itemCard(x,type){
 const baseName=clean(x.Model)||clean(x.ChargerName)||clean(x.Description)||clean(x.SKU);
 const name=type==='battery'?(clean(x.BatteryID)||baseName.replace(/\s*Battery\s*$/i,''))+' Battery':type==='charger'?(clean(x.ChargerID)||baseName.replace(/\s*Charger\s*$/i,''))+' Charger':baseName;
 const price=currentPrice(x);
 const energyCard=['battery','charger'].includes(type);
 const shortName=v=>clean(v).toUpperCase().replace(/\b(BATTERY|CHARGER)\b/g,'').replace(/[^A-Z0-9]/g,'');
 const description=shortName(x.Description)===shortName(name)?'':clean(x.Description);
 return '<article class="card'+(energyCard?' wep-energy-card':'')+'"><div class="card-media">'+img(x,name)+'</div><div class="card-body"><h3>'+esc(name)+'</h3><small>SKU '+esc(x.SKU)+'</small>'+(description?'<p>'+esc(description)+'</p>':'')+'<small class="wep-package-included-note" data-package-included-sku="'+esc(x.SKU)+'"'+(packageIncludedSku(x.SKU)?'':' hidden')+'>Included in package</small><p class="card-price">'+(price>0?fmt(price):'Contact Us')+'</p>'+(!energyCard||assemblyAmount(x)>0?setupMarkup(x,type):'')+stockMarkup(x)+'<label class="select-row"><input type="checkbox" class="option-check" data-type="'+esc(type)+'" data-sku="'+esc(x.SKU)+'" data-name="'+esc(name)+'" data-price="'+price+'" data-regular-price="'+money(x.MSRP)+'" data-setup="'+assemblyAmount(x)+'" data-setup-option="'+esc(assemblyCode(x))+'"'+(price<=0?' disabled':'')+'> Add <input class="qty" type="number" min="1" max="20" value="1" data-qty="'+esc(x.SKU)+'" aria-label="Quantity"></label>'+(quoteEnabled()?'<button class="stock-action add-option-cart" data-type="'+esc(type)+'" data-sku="'+esc(x.SKU)+'" type="button"'+(price<=0?' disabled':'')+'>Add to Cart</button>':'')+WEPBuildBuy.cardInfo(x,type,buildContext)+'</div>'+WEPBuildBuy.energySpecs(x,type)+'</article>';
}


function powerRank(v){const types=['manual','electric','battery','gas','diesel','hybrid','kerosene','natural gas','propane','tow-behind'];const rank=types.indexOf(String(v??'').trim().toLowerCase());return rank<0?types.length:rank}
function sortOrderValue(v){const s=String(v??'').trim(),n=Number(s);return s!==''&&Number.isFinite(n)?n:Infinity}
function optionSection(title,items,type){
 if(!items.length)return '';
 return '<section class="section"><h2>'+esc(title)+'</h2><div class="grid">'+items.slice().sort((a,b)=>{const av=sortOrderValue(a.SortOrder),bv=sortOrderValue(b.SortOrder);return powerRank(a.PowerType)-powerRank(b.PowerType)||(av===bv?0:av-bv)}).map(x=>itemCard(x,type)).join('')+'</div></section>';
}
function implementGroups(items){
 const groups=new Map();
 for(const item of items){
  let name=clean(item.SubCategory);
  if(!name){
   const description=clean(item.Description);
   // A short generic description can identify a type when SubCategory is blank.
   const identifiers=[item.SKU,item.Model,item.BrandID,selectedBrand].map(clean).filter(Boolean);
   name=description&&description.length<=40&&description.split(/\s+/).length<=5&&!identifiers.some(id=>description.toLowerCase().includes(id.toLowerCase()))?description:'Other Implements';
  }
  name=name.replace(/\s+/g,' ');
  const key=name.toLowerCase();if(!groups.has(key))groups.set(key,{name,items:[]});groups.get(key).items.push(item);
 }
 const plural=name=>/s$/i.test(name)?name:/[^aeiou]y$/i.test(name)?name.slice(0,-1)+'ies':/(x|z|ch|sh)$/i.test(name)?name+'es':name+'s';
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(group=>({...group,name:plural(group.name)}));
}
function implementSections(items){
 return implementGroups(items).map(group=>optionSection(group.name+' ('+group.items.length+' '+(group.items.length===1?'Option':'Options')+')',group.items,'attachment')).join('');
}
function compatibilityChoice(row,toolSku,product=selectedProduct||{}){
 const normalize=value=>clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
 const direct=[toolSku,product.Model].map(normalize).filter(Boolean);
 const groups=[product.Model,product.Series,product.System,product.Category,product.SubCategory].map(value=>'GROUP'+normalize(value)).filter(value=>value!=='GROUP');
 const brandGroup='GROUPALL'+normalize(product.BrandID||selectedBrand);
 const fields=new Map(Object.entries(row).map(([key,value])=>[normalize(key),clean(value)]));
 // Explicit SKU/model exclusions keep priority over broader groups and horsepower.
 for(const key of [...direct,...groups,brandGroup,'ALLPRODUCTS'])if(fields.has(key)&&fields.get(key)!=='')return trueish(fields.get(key));
 return null;
}
function compatibleRows(rows,toolSku,product=selectedProduct||{}){
 return rows.filter(row=>(!clean(row.Active)||trueish(row.Active))&&compatibilityChoice(row,toolSku,product)===true);
}
const implementHPFields=['RequiredEngineHPMin','RequiredEngineHPMax','RequiredPTOHPMin','RequiredPTOHPMax'];
function hasImplementHPLimits(row){return implementHPFields.some(key=>clean(row[key])!=='');}
function horsepowerImplements(rows,toolSku,product=selectedProduct||{}){
 const positive=value=>{const n=Number(clean(value));return clean(value)!==''&&Number.isFinite(n)&&n>0?n:null;};
 const engineHP=positive(product.GrossEngineHP)??positive(product.NetEngineHP),ptoHP=positive(product.PTOHP);
 const inRange=(actual,min,max)=>{
  const lower=clean(min),upper=clean(max);if(!lower&&!upper)return true;
  if(actual===null)return false;
  const valid=value=>value===''||(Number.isFinite(Number(value))&&Number(value)>=0);
  if(!valid(lower)||!valid(upper)||(lower!==''&&upper!==''&&Number(lower)>Number(upper)))return false;
  return (lower===''||actual>=Number(lower))&&(upper===''||actual<=Number(upper));
 };
 const seen=new Set();
 return rows.filter(row=>{
  const key=clean(row.SKU).toUpperCase();
  if(!key||seen.has(key)||(clean(row.Active)&&!trueish(row.Active))||!hasImplementHPLimits(row)||compatibilityChoice(row,toolSku,product)===false)return false;
  if(!inRange(engineHP,row.RequiredEngineHPMin,row.RequiredEngineHPMax)||!inRange(ptoHP,row.RequiredPTOHPMin,row.RequiredPTOHPMax))return false;
  seen.add(key);return true;
 });
}

let inventoryPackageIncludes=[];
let horsepowerImplementSkus=new Set();
const implementFreightNote='Additional freight charges apply. We’ll contact you to confirm the freight charge before finalizing your order.';
function implementFreightMarkup(){return '<p class="wep-implement-freight-note" role="note">'+esc(implementFreightNote)+'</p>';}

let factoryPackageIncludedSkus=new Set();
function packageIncludedSku(value){
 const key=clean(value).toUpperCase();
 return factoryPackageIncludedSkus.has(key)||requiredPackageComponents.some(item=>clean(item.sku).toUpperCase()===key)||inventoryPackageIncludes.some(item=>clean(item.sku).toUpperCase()===key&&Number(item.quantity)>0);
}
function refreshPackageIncludedLabels(){
 document.querySelectorAll('[data-package-included-sku]').forEach(label=>{label.hidden=!packageIncludedSku(label.dataset.packageIncludedSku);});
}

function packageInclusions(){
 const product=selectedProduct||{},names=[];
 for(const [field,label] of [['P1-Loader','Front loader'],['P2-Backhoe','Backhoe'],['P3-Mower','Mower'],['P4-Cab','Cab']])if(trueish(product[field]))names.push(label);
 for(const item of inventoryPackageIncludes){const name=clean(item.description)||clean(item.sku),quantity=Number(item.quantity);if(name&&quantity>0)names.push(name+(quantity>1?' (Qty '+quantity+')':''));}
 for(const item of requiredPackageComponents){
  if(inventoryPackageIncludes.some(row=>clean(row.sku).toUpperCase()===item.sku.toUpperCase()))continue;
  const name=clean(item.name).replace(/^(\d+)\s*["″]\s+Bucket$/i,'$1-inch Backhoe Bucket');
  names.push(name+(item.quantity>1?' (Qty '+item.quantity+')':''));
 }
 return [...new Set(names)];
}
window.WEPBuildSetIncludedEquipment=function(items){
 inventoryPackageIncludes=Array.isArray(items)?items:[];
 refreshPackageIncludedLabels();
 const target=$('wep-package-includes');if(!target)return;
 const names=packageInclusions(),text=names.length?'Includes: '+names.join(' · '):'';
 if(target.textContent!==text)target.textContent=text;target.hidden=!names.length;
};
// Factory-installed assemblies use their workbook prerequisite chain for loose components.
let requiredPackageComponents=[];
const requiredControlState=new Map();
function factoryComponentRequirements(product,attachments){
 if(!trueish(product['P1-Loader'])||!trueish(product['P2-Backhoe']))return [];
 const assemblies=attachments.filter(row=>/^backhoes?$/i.test(clean(row.SubCategory)));
 if(!assemblies.length)return [];
 const choices=assemblies.map(assembly=>{
  const components=new Map();
  for(let i=1;i<=4;i++){
   const parent=attachments.find(row=>clean(row.SKU)===clean(assembly['RequiredSKU'+i])&&/loader/i.test(clean(row.SubCategory)||clean(row.Description)));
   if(!parent)continue;
   const parentQty=Number(clean(assembly['RequiredSKU'+i+'Qty'])||1);
   for(let j=1;j<=2;j++){
    const id=clean(assembly['SKU'+i+'Requires'+j]);if(!id)continue;
    const row=attachments.find(row=>clean(row.SKU)===id),quantity=parentQty*Number(clean(assembly['SKU'+i+'Requires'+j+'Qty'])||1);
    if(!row||!Number.isInteger(quantity)||quantity<1)throw Error('A required package component needs store confirmation.');
    components.set(id,{sku:id,type:'attachment',name:clean(row.Description)||id,quantity});
   }
  }
  return [...components.values()].sort((a,b)=>a.sku.localeCompare(b.sku));
 });
 if(choices.some(rows=>JSON.stringify(rows)!==JSON.stringify(choices[0])))throw Error('The required factory-package components need store confirmation.');
 return choices[0]||[];
}
window.WEPBuildSyncRequiredComponents=function(includedItems,mainQuantity){
 let changed=false;
 for(const component of requiredPackageComponents){
  const check=[...document.querySelectorAll('.option-check')].find(el=>el.dataset.type===component.type&&el.dataset.sku===component.sku);
  if(!check)throw Error('The required package component is not listed: '+component.name);
  const qty=document.querySelector('[data-qty="'+CSS.escape(component.sku)+'"]'),button=check.closest('.card')?.querySelector('.add-option-cart');
  const included=(includedItems||[]).reduce((sum,item)=>sum+(clean(item.sku).toUpperCase()===component.sku.toUpperCase()?Number(item.quantity)||0:0),0);
  const needed=Math.max(0,component.quantity*mainQuantity-included),key=component.type+':'+component.sku;
  let original=requiredControlState.get(key);
  if(needed>0){
   if(!original){original={checked:check.checked&&check.dataset.wepAutoRequired!=='true',quantity:qty.value,disabled:check.disabled,buttonDisabled:button?.disabled||false};requiredControlState.set(key,original);}
   const quantity=Math.max(needed,original.checked?Number(original.quantity)||0:0);
   if(quantity>20)throw Error('The required component quantity needs store confirmation.');
   if(!check.checked||Number(qty.value)!==quantity)changed=true;
   check.checked=true;qty.value=quantity;check.disabled=true;qty.readOnly=true;
   check.dataset.wepRequired='true';check.dataset.wepAutoRequired=original.checked?'false':'true';
   if(button){button.disabled=true;if(button.textContent!=='Required with package')button.textContent='Required with package';}
  }else if(original||check.dataset.wepAutoRequired==='true'){
   const checked=original?.checked||false,quantity=original?.quantity||'1';
   if(check.checked!==checked||qty.value!==String(quantity))changed=true;
   check.checked=checked;qty.value=quantity;check.disabled=original?.disabled||false;qty.readOnly=false;
   if(button)button.disabled=original?.buttonDisabled||false;
   delete check.dataset.wepRequired;delete check.dataset.wepAutoRequired;requiredControlState.delete(key);
  }
 }
 return changed;
};
let optionRequirementRows=[],optionRequirementCatalog=[];
const optionRequirementState=new Map();
function optionRequirementPlan(selected){
 const key=item=>item.type+':'+clean(item.sku||item.row.SKU).toUpperCase(),desired=new Map();
 const installed=row=>factoryPackageIncludedSkus.has(clean(row.SKU).toUpperCase())||inventoryPackageIncludes.some(item=>clean(item.sku).toUpperCase()===clean(row.SKU).toUpperCase()&&Number(item.quantity)>0)||[['P1-Loader',/^(front\s+)?loaders?$/i],['P2-Backhoe',/^backhoes?$/i],['P3-Mower',/mower/i],['P4-Cab',/^cabs?$/i]].some(([flag,category])=>trueish(selectedProduct?.[flag])&&category.test(clean(row.SubCategory)));
 const available=id=>optionRequirementRows.find(item=>clean(item.row.SKU).toUpperCase()===clean(id).toUpperCase()&&compatibilityChoice(item.row,sku)===true)||optionRequirementCatalog.find(item=>clean(item.row.SKU).toUpperCase()===clean(id).toUpperCase()&&installed(item.row));
 function visit(item,quantity,parent,path=[]){
  if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('Choose whole option quantities from 1 to 20.');
  const id=key(item);if(path.includes(id))throw Error('The required options contain a circular rule. Please contact the store.');
  const row=item.row;let listed=false,matched=false;
  for(let i=1;i<=4;i++){
   const required=clean(row['RequiredSKU'+i]);if(!required)continue;listed=true;
   const target=available(required);if(!target)continue;
   const children=[];let eligible=true;
   for(let j=1;j<=2;j++){const childId=clean(row['SKU'+i+'Requires'+j]);if(!childId)continue;const child=available(childId);if(!child){eligible=false;break;}children.push({item:child,multiplier:Number(clean(row['SKU'+i+'Requires'+j+'Qty'])||1)});}
   if(!eligible)continue;matched=true;
   const multiplier=Number(clean(row['RequiredSKU'+i+'Qty'])||1);
   for(const entry of [{item:target,multiplier},...children]){
    if(!Number.isInteger(entry.multiplier)||entry.multiplier<1)throw Error('A required option quantity needs store confirmation.');
    if(installed(entry.item.row))continue;
    const count=quantity*entry.multiplier;if(count>20)throw Error('A required option quantity exceeds 20. Please contact the store.');
    const childKey=key(entry.item),previous=desired.get(childKey);
    if(!previous||count>previous.quantity)desired.set(childKey,{...entry.item,sku:clean(entry.item.row.SKU),quantity:count,parent});
    visit(entry.item,count,parent,[...path,id]);
   }
  }
  if(listed&&!matched)throw Error('Required equipment for '+(clean(row.Description)||clean(row.SKU))+' needs store confirmation.');
 }
 for(const item of selected)visit(item,item.quantity,key(item));
 return desired;
}
function syncOptionRequirements(){
 if(!optionRequirementRows.length)return;
 const controls=[...document.querySelectorAll('.option-check')],key=c=>c.dataset.type+':'+clean(c.dataset.sku).toUpperCase();
 const selected=controls.filter(c=>c.checked&&c.dataset.wepAutoRequired!=='true').map(c=>{
  const item=optionRequirementRows.find(item=>key(c)===item.type+':'+clean(item.row.SKU).toUpperCase());
  return item?{...item,quantity:Number(document.querySelector('[data-qty="'+CSS.escape(c.dataset.sku)+'"]')?.value)}:null;
 }).filter(Boolean);
 const desired=optionRequirementPlan(selected);
 for(const [id,original] of optionRequirementState)if(!desired.has(id)){
  const {check,qty,button}=original;check.checked=original.checked;check.disabled=original.disabled;qty.value=original.quantity;qty.readOnly=original.readOnly;
  if(button)button.disabled=original.buttonDisabled;
  delete check.dataset.wepRequired;delete check.dataset.wepAutoRequired;delete check.dataset.wepDependencyParent;delete check.dataset.wepDependencyLabel;optionRequirementState.delete(id);
 }
 for(const [id,item] of desired){
  const check=controls.find(c=>key(c)===id);if(!check)throw Error('A required option is not listed: '+item.sku);
  const qty=document.querySelector('[data-qty="'+CSS.escape(check.dataset.sku)+'"]'),button=check.closest('.card')?.querySelector('.add-option-cart');
  if(!optionRequirementState.has(id))optionRequirementState.set(id,{check,qty,button,checked:check.checked&&check.dataset.wepAutoRequired!=='true',disabled:check.disabled,quantity:qty.value,readOnly:qty.readOnly,buttonDisabled:button?.disabled||false});
  const original=optionRequirementState.get(id),count=Math.max(item.quantity,original.checked?Number(original.quantity)||0:0);
  check.checked=true;check.disabled=true;qty.value=count;qty.readOnly=true;check.dataset.wepRequired='true';check.dataset.wepAutoRequired=original.checked?'false':'true';check.dataset.wepDependencyParent=item.parent;
  const parent=controls.find(c=>key(c)===item.parent);check.dataset.wepDependencyLabel='Required with '+(parent?.dataset.name||'selected equipment');
  if(button){button.disabled=true;if(button.textContent!==check.dataset.wepDependencyLabel)button.textContent=check.dataset.wepDependencyLabel;}
 }
}
window.WEPBuildSyncOptionRequirements=syncOptionRequirements;
function byId(rows,ids,idFields){
 const set=new Set(ids.map(x=>clean(x).toUpperCase()).filter(Boolean));
 return rows.filter(x=>idFields.some(f=>set.has(clean(x[f]).toUpperCase())));
}
function idsFromRuntime(runtime,prefix,count){
 const ids=[];for(let i=1;i<=count;i++){const v=clean(runtime[prefix+i]);if(v)ids.push(v)}return ids;
}
// Keep required package rows together, then preserve the customer's add order.
let optionSelectionOrder=null;
function orderedPackageItems(items){
 const key=item=>clean(item.type)+':'+clean(item.sku).toUpperCase();
 const component=item=>requiredPackageComponents.some(row=>row.type===item.type&&clean(row.sku).toUpperCase()===clean(item.sku).toUpperCase());
 const parentKey=item=>{const controls=typeof document==='undefined'?[]:[...document.querySelectorAll('.option-check')];return controls.find(c=>c.dataset.type===item.type&&clean(c.dataset.sku).toUpperCase()===clean(item.sku).toUpperCase())?.dataset.wepDependencyParent||key(item);};
 if(optionSelectionOrder===null){
  let saved=[];
  try{const draft=JSON.parse(sessionStorage.getItem('wepBuildDraft:'+selectedBrand.toUpperCase()+':'+sku)||'null');saved=Array.isArray(draft?.items)?draft.items:JSON.parse(buildStorage.getItem('wepCart')||'[]').filter(row=>row.packageId===selectedBrand.toUpperCase()+':'+sku);}catch(_){}
  optionSelectionOrder=[...new Set(saved.filter(item=>item.type!=='tool'&&!component(item)).map(key))];
 }
 const additions=items.filter(item=>item.type!=='tool'&&!component(item)),active=new Set(additions.map(parentKey));
 optionSelectionOrder=optionSelectionOrder.filter(id=>active.has(id));
 for(const item of additions)if(!optionSelectionOrder.includes(parentKey(item)))optionSelectionOrder.push(parentKey(item));
 const rank=item=>item.type==='tool'?0:component(item)?1:2;
 return items.slice().sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?optionSelectionOrder.indexOf(parentKey(a))-optionSelectionOrder.indexOf(parentKey(b))||Number(parentKey(a)!==key(a))-Number(parentKey(b)!==key(b)):0));
}
window.WEPBuildOrderItems=orderedPackageItems;
function packageSpec(){
 syncOptionRequirements();
 const mainQty=Number($('equipment-qty')?.value||1);if(!Number.isInteger(mainQty)||mainQty<1||mainQty>20)throw new Error('Choose whole quantities from 1 to 20.');
 const items=[{type:'tool',sku,qty:mainQty,setupSelected:mainSetupSelected()}];
 document.querySelectorAll('.option-check:checked').forEach(c=>{
  const q=document.querySelector('[data-qty="'+CSS.escape(c.dataset.sku)+'"]');
  const qty=Number(q.value);if(!Number.isInteger(qty)||qty<1||qty>20)throw new Error('Choose whole quantities from 1 to 20.');
  items.push({type:c.dataset.type,sku:c.dataset.sku,qty,setupSelected:optionSetupSelected(c)});
 });
 return {brandId:selectedBrand.toUpperCase(),sku,items:orderedPackageItems(items)};
}
function reviewPackage(){
 addPackageToCart();
 // WEP_RETURN_TO_QUOTE_V1
 location.assign("checkout.html"+(qs.get('api')==='local'?'?api=local':''));
}
function addPackageToCart(){
 if(currentPrice(selectedProduct)<=0)throw new Error('Contact the store for equipment pricing.');
 const spec=packageSpec();
 let cart=JSON.parse(buildStorage.getItem('wepCart')||'[]');if(!Array.isArray(cart))throw new Error('Cart could not be read.');
 const group=selectedBrand.toUpperCase()+':'+sku;
 const previousPackage=cart.filter(row=>row.packageId===group);
 cart=cart.filter(row=>row.packageId!==group);
 spec.items.forEach(row=>{
  const c=[...document.querySelectorAll('.option-check')].find(c=>c.dataset.sku===row.sku&&c.dataset.type===row.type);
  // Keep the pricing choice when editing the same quantity; current inventory is rechecked on return.
  const previous=previousPackage.find(old=>old.type===row.type&&old.sku===row.sku&&Number(old.quantity)===row.qty);
  cart.push({autoRequiredComponent:c?.dataset.wepAutoRequired==='true',inventoryId:window.WEPBuildInventorySelection?.(row.type,row.sku,row.qty)??previous?.inventoryId??'',quoteStockChoice:(window.WEPBuildInventorySelection?.(row.type,row.sku,row.qty)??previous?.inventoryId)?'stock':'orderable',brandId:selectedBrand.toUpperCase(),packageId:group,equipmentSku:sku,type:row.type,sku:row.sku,quantity:row.qty,productName:row.type==='tool'?(clean(selectedProduct.Description)||clean(selectedProduct.Model)||sku):c.dataset.name,itemPrice:row.type==='tool'?currentPrice(selectedProduct):Number(c.dataset.price),assemblyOption:row.type==='tool'?assemblyCode(selectedProduct):c.dataset.setupOption,assemblyAmount:row.type==='tool'?assemblyAmount(selectedProduct):Number(c.dataset.setup||0),setupSelected:row.setupSelected,setupAmount:row.setupSelected?(row.type==='tool'?assemblyAmount(selectedProduct):Number(c.dataset.setup||0)):0,shipping:null});
 });
 buildStorage.setItem('wepCart',JSON.stringify(cart));
 renderSavedCartSubtotal();
 $('options-message').textContent='Package saved in cart. Review your quote for setup, freight, delivery and payment totals.';
}
function renderSavedCartSubtotal(){
 const target=$('wep-cart-subtotal');if(!target)return;
 try{
  const rows=JSON.parse(buildStorage.getItem('wepCart')||'[]');if(!Array.isArray(rows))throw Error('Invalid cart');
  const total=rows.reduce((sum,row)=>{
   const qty=Number(row.quantity),price=Number(row.itemPrice);if(!Number.isFinite(qty)||qty<0||!Number.isFinite(price)||price<0)throw Error('Invalid cart amount');
   const code=clean(row.assemblyOption).toUpperCase();
   let fee=Number(row.assemblyAmount??row.setupAmount??0);
   if(!Number.isFinite(fee)||fee<0)throw Error('Invalid installation amount');
   if(code==='T'&&!row.setupSelected)fee=0;
   return sum+(price+fee)*qty;
  },0);
  target.textContent=fmt(total);
 }catch(e){target.textContent='View Cart';}
}

function pricingIssues(q){return (q?.issues||[]).filter(message=>!(q?.excludedFactoryFreight?.length&&message==='Additional freight charges apply. We’ll contact you to confirm the freight charge before finalizing your order.'));}
function renderBuildPackageReview(quote=null,message=""){
 const container=$('wep-package-lines');if(!container)return;
 const mainQty=Number($('equipment-qty')?.value||1);
 const confirmed=Array.isArray(quote?.lines)&&quote.lines.length>0;
 const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
 let lines=[{name:clean(selectedProduct.Description)||clean(selectedProduct.Model)||sku,sku,type:'tool',code:assemblyCode(selectedProduct),fee:assemblyAmount(selectedProduct),qty:mainQty,regular:money(selectedProduct.MSRP),unit:currentPrice(selectedProduct),setup:mainSetupSelected()?assemblyAmount(selectedProduct):0}];
 document.querySelectorAll('.option-check:checked').forEach(c=>{const qty=Number(document.querySelector('[data-qty="'+CSS.escape(c.dataset.sku)+'"]')?.value);lines.push({name:c.dataset.name,sku:c.dataset.sku,type:c.dataset.type,code:c.dataset.setupOption,fee:Number(c.dataset.setup||0),qty,required:c.dataset.wepRequired==='true',requiredLabel:c.dataset.wepDependencyLabel||'Required with package',regular:Number(c.dataset.regularPrice||0),unit:Number(c.dataset.price||0),setup:optionSetupSelected(c)?Number(c.dataset.setup||0):0});});
 lines=orderedPackageItems(lines);
 // Prices come from the same response as the payment boxes. A changed build
 // falls back to clearly marked listed prices until its new response arrives.
 lines.forEach(line=>{
  const live=confirmed?quote.lines.find(row=>row.type===line.type&&clean(row.sku)===line.sku&&Number(row.quantity)===line.qty):null;
  line.live=live;
  if(live){if(amount(live.baseUnitPrice))line.regular=Math.max(line.regular,live.baseUnitPrice);line.unit=amount(live.unitPrice)?live.unitPrice:null;line.itemTotal=amount(live.itemTotal)?live.itemTotal:null;line.setup=live.setupSelected&&amount(live.setupTotal)?live.setupTotal/line.qty:0;}
  else if(confirmed){line.unit=null;line.itemTotal=null;}
  else line.itemTotal=Number.isInteger(line.qty)&&line.qty>=1&&line.qty<=20?line.unit*line.qty:null;
 });
 container.innerHTML='<div class="wep-itemized-status" role="status"></div><div class="wep-package-table-scroll"><table class="wep-package-table"><caption class="wep-visually-hidden">Selected equipment and options with quantities, prices, and installation</caption><thead><tr><th scope="col">Equipment &amp; options</th><th scope="col">Qty</th><th scope="col">Installation / Set-Up</th><th scope="col">Unit price</th><th scope="col">Sale price</th><th scope="col">Item total</th></tr></thead><tbody>'+lines.map(line=>{
  const valid=Number.isInteger(line.qty)&&line.qty>=1&&line.qty<=20;
  const optional=line.code==='T'&&line.fee>0;
  const regular=amount(line.unit)?Math.max(line.unit,amount(line.regular)?line.regular:0):null;
  const sale=amount(line.unit)&&amount(regular)&&Math.round(regular*100)>Math.round(line.unit*100)?line.unit:null;
  const installation=optional?'<label class="wep-itemized-install"><input type="checkbox" data-review-install-type="'+esc(line.type)+'" data-review-install-sku="'+esc(line.sku)+'" aria-label="Dealer installation for '+esc(line.name)+': '+fmt(line.fee)+' per item" '+(line.setup>0?'checked':'')+'><span>'+fmt(line.fee)+' / item</span></label>':valid&&line.setup>0?'<span class="wep-itemized-install">'+fmt(line.setup*line.qty)+(line.code==='F'?' (required)':'')+'</span>':'—';
  const source=line.live?.pricingSource==='stock'?'In-Stock Unit':line.live?.pricingSource==='orderable'?(line.type==='tool'?'Build-to-Order Unit':'Available to Order'):'';
  const additionalFreight=confirmed?line.live?.factoryFreightExcluded===true:line.type==='attachment'&&horsepowerImplementSkus.has(clean(line.sku).toUpperCase());
  return '<tr'+(additionalFreight?' class="wep-has-implement-freight"':'')+'><th scope="row">'+esc(line.name)+(additionalFreight?' <sup>*</sup>':'')+(line.type==='tool'&&packageInclusions().length?'<div class="wep-itemized-meta wep-itemized-includes">Includes: '+esc(packageInclusions().join(' · '))+'</div>':'')+'<div class="wep-itemized-meta"><span>SKU '+esc(line.sku)+'</span>'+(source?'<span class="wep-itemized-source">'+source+'</span>':'')+(line.required?'<span>'+esc(line.requiredLabel)+'</span>':'')+(line.type!=='tool'&&!line.required?'<button type="button" data-review-remove-type="'+esc(line.type)+'" data-review-remove-sku="'+esc(line.sku)+'" aria-label="Remove '+esc(line.name)+'">Remove</button>':'')+'</div>'+'</th><td><input class="qty wep-review-qty" '+(line.required?'readonly aria-readonly="true" ':'')+'type="number" min="1" max="20" value="'+esc(line.qty)+'" data-review-qty-type="'+esc(line.type)+'" data-review-qty-sku="'+esc(line.sku)+'" aria-label="Quantity for '+esc(line.name)+'"><span class="wep-print-qty">'+esc(line.qty)+'</span></td><td>'+installation+'</td><td class="wep-itemized-money">'+(amount(regular)?fmt(regular):'Needs confirmation')+'</td><td class="wep-itemized-money">'+(amount(sale)?fmt(sale):'—')+'</td><td>'+(valid?(amount(line.itemTotal)?fmt(line.itemTotal):'Needs confirmation'):'Check quantity')+'</td></tr>';
 }).join('')+'</tbody></table></div><div class="wep-itemized-footer"><div class="wep-itemized-payment"></div><div class="wep-itemized-totals"><dl></dl></div></div><strong id="selected-total" hidden></strong><p class="note">Installation is shown separately from merchandise. Prices and availability are subject to confirmation.</p>';
 const status=container.querySelector('.wep-itemized-status');
 status.textContent=message||(confirmed?(pricingIssues(quote).length?'Some items need store confirmation.':'Current prices for your selected equipment and options.'):'Listed item prices — updating freight, tax and payment totals…');
 status.classList.toggle('wep-itemized-pending',!confirmed);
 if(confirmed&&pricingIssues(quote).length)status.textContent+=' '+pricingIssues(quote).join(' ');
 const dl=container.querySelector('.wep-itemized-totals dl');
 const listedMerchandise=lines.reduce((sum,line)=>sum+(amount(line.itemTotal)?line.itemTotal:NaN),0);
 const listedInstallation=lines.reduce((sum,line)=>sum+line.setup*line.qty,0);
 const values=confirmed?[['Merchandise',quote.merchandise],['Installation / Set-Up',quote.installation],['Special order / factory freight',quote.freight],['Local delivery',quote.delivery],...(quote.fulfillment==='SHIP'?[['UPS Ground shipping',quote.shipping]]:[]),['Subtotal',quote.subtotal],['Estimated sales tax',quote.tax],['Estimated total',pricingIssues(quote).length?null:quote.total]]:[['Merchandise (listed)',listedMerchandise],['Installation / Set-Up',listedInstallation],['Special order / factory freight',null],['Local delivery',null],['Subtotal',null],['Estimated sales tax',null],['Estimated total',null]];
 values.forEach(([label,value])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label+(confirmed&&quote.excludedFactoryFreight?.length&&label==='Estimated total'?' *':'');dd.textContent=confirmed&&quote.excludedFactoryFreight?.length&&label==='Special order / factory freight'?(Number(value)>0?fmt(value)+' + pending *':'To be confirmed *'):amount(value)?fmt(value):'To be confirmed';row.append(dt,dd);dl.append(row);});
 if(confirmed&&quote.excludedFactoryFreight?.length){const footnote=document.createElement('p');footnote.className='note wep-freight-footnote';footnote.setAttribute('role','note');footnote.textContent='* Additional freight applies to marked items. We’ll confirm the charge before finalizing your order.';container.querySelector('.wep-itemized-totals').append(footnote);}
 const payment=container.querySelector('.wep-itemized-payment');
 const paymentTitle=document.createElement('h3');paymentTitle.textContent='Payment Options';payment.append(paymentTitle);
 const paymentCards=document.createElement('div');paymentCards.className='wep-itemized-payment-cards';paymentCards.setAttribute('aria-label','Choose a payment option');payment.append(paymentCards);
 if(confirmed&&amount(quote.subtotal))$('selected-total').textContent=fmt(quote.subtotal);
 renderSavedCartSubtotal();
 container.querySelectorAll('[data-review-qty-type]').forEach(input=>input.addEventListener('change',()=>{
  const source=input.dataset.reviewQtyType==='tool'?$('equipment-qty'):document.querySelector('[data-qty="'+CSS.escape(input.dataset.reviewQtySku)+'"]');
  if(!source)return;
  source.value=input.value;
  source.dispatchEvent(new Event('input',{bubbles:true}));
 }));
 container.querySelectorAll('[data-review-remove-type]').forEach(button=>button.addEventListener('click',()=>{
  const choice=[...document.querySelectorAll('.option-check')].find(c=>c.dataset.type===button.dataset.reviewRemoveType&&c.dataset.sku===button.dataset.reviewRemoveSku);
  if(!choice)return;
  choice.checked=false;
  choice.dispatchEvent(new Event('change',{bubbles:true}));
 }));
 container.querySelectorAll('[data-review-install-type]').forEach(input=>input.addEventListener('change',()=>{
  const choice=setupChoice(input.dataset.reviewInstallType,input.dataset.reviewInstallSku);
  if(!choice)return;
  choice.checked=input.checked;
  choice.dispatchEvent(new Event('change',{bubbles:true}));
 }));
}

window.addEventListener('wep:build-pricing',event=>{
 renderBuildPackageReview(event.detail?.quote||null,event.detail?.message||'');
});

// WEP_OPTION_INSTALL_DEFAULT_V1
function restoreOptionInstallation(choice,row,currentFee){
 if(!choice)return;
 const optionalComponent=['attachment','accessory','part'].includes(row.type);
 const savedFee=Number(row.assemblyAmount??row.setupAmount??0);
 // New controls already start checked. A stale no-charge cart entry must not
 // turn off installation when a fee is subsequently added to the workbook.
 if(optionalComponent&&currentFee>0&&(!Number.isFinite(savedFee)||savedFee!==currentFee)){
  choice.checked=true;
 }else if(typeof row.setupSelected==='boolean'){
  choice.checked=row.setupSelected;
 }
}
function wireSummary(basePrice){
 const checks=[...document.querySelectorAll('.option-check')];
 if(quoteEnabled()){
  try{
   const saved=JSON.parse(buildStorage.getItem('wepCart')||'[]').filter(row=>row.packageId===selectedBrand.toUpperCase()+':'+sku);
   const main=saved.find(row=>row.type==='tool');if(main){$('equipment-qty').value=main.quantity;const choice=setupChoice('tool',sku);if(choice&&typeof main.setupSelected==='boolean')choice.checked=main.setupSelected;}
   saved.forEach(row=>{
    const check=checks.find(c=>c.dataset.type===row.type&&c.dataset.sku===row.sku);
    if(check&&!check.disabled){if(row.autoRequiredComponent===true)check.dataset.wepAutoRequired='true';check.checked=true;document.querySelector('[data-qty="'+CSS.escape(row.sku)+'"]').value=row.quantity;const choice=setupChoice(row.type,row.sku);restoreOptionInstallation(choice,row,Number(check.dataset.setup||0));}
   });
  }catch(e){$('options-message').textContent='Your saved cart could not be restored. Review your selections.';}
  restoreCardSelection(checks);
  $('equipment-qty').addEventListener('input',recalc);
  $('save-options').textContent='Add to Cart';
  $('review-package').addEventListener('click',()=>{try{reviewPackage(packageSpec());}catch(e){$('options-message').textContent=e.message;}});
  document.querySelectorAll('.add-option-cart').forEach(button=>button.addEventListener('click',()=>{
   const check=checks.find(c=>c.dataset.sku===button.dataset.sku&&c.dataset.type===button.dataset.type);check.checked=true;recalc();
   try{addPackageToCart();button.textContent='Added to Cart';}catch(e){$('options-message').textContent=e.message;}
  }));
 }
 function recalc(){
  try{syncOptionRequirements();}catch(error){$('options-message').textContent=error.message;return;}
  let add=0,count=0,setup=0;
  const mainQty=Math.max(1,Math.min(20,Number($('equipment-qty')?.value)||1));
  checks.forEach(c=>{if(c.checked){const q=document.querySelector('[data-qty="'+CSS.escape(c.dataset.sku)+'"]');const qty=Math.max(1,Number(q&&q.value)||1);add+=Number(c.dataset.price||0)*qty;setup+=(optionSetupSelected(c)?Number(c.dataset.setup||0):0)*qty;count+=qty}});
  $('selected-count').textContent=count+' additional item'+(count===1?'':'s');
  const merchandise=basePrice*mainQty+add;setup+=(mainSetupSelected()?assemblyAmount(selectedProduct):0)*mainQty;
  $('selected-merchandise').textContent=fmt(merchandise);
  $('selected-setup').textContent=fmt(setup);
  renderBuildPackageReview();
  $('selected-total').textContent=fmt(merchandise+setup);
 }
 document.querySelectorAll('[data-stock-sku]').forEach(link=>link.addEventListener('click',()=>{
  const q=link.dataset.stockSku===sku?$('equipment-qty'):document.querySelector('[data-qty="'+CSS.escape(link.dataset.stockSku)+'"]');
  const qty=Math.max(1,Math.min(20,Math.floor(Number(q?.value)||1)));
  const href=link.getAttribute('href'),index=href.indexOf('body=');
  if(index>=0)link.setAttribute('href',href.slice(0,index+5)+encodeURIComponent(decodeURIComponent(href.slice(index+5)).replace(/Quantity \d+\./,'Quantity '+qty+'.')));
 }));
 checks.forEach(c=>c.addEventListener('change',recalc));
 document.querySelectorAll('.qty').forEach(q=>q.addEventListener('input',recalc));
 document.querySelectorAll('.setup-choice').forEach(c=>c.addEventListener('change',recalc));
 $('save-options').addEventListener('click',()=>{
  if(quoteEnabled()){try{addPackageToCart();}catch(e){$('options-message').textContent=e.message;}return;}
  const selected=checks.filter(c=>c.checked).map(c=>{const q=document.querySelector('[data-qty="'+CSS.escape(c.dataset.sku)+'"]');return {type:c.dataset.type,sku:c.dataset.sku,name:c.dataset.name,price:Number(c.dataset.price||0),setupSelected:optionSetupSelected(c),assemblyOption:c.dataset.setupOption,assemblyAmount:Number(c.dataset.setup||0),qty:Math.max(1,Number(q&&q.value)||1)}})
  sessionStorage.setItem('wep-options:'+sku,JSON.stringify({sku,selected,updated:new Date().toISOString()}));
  $('save-options').textContent='Options Saved';
 });
 recalc();
}

// Card links carry component identities only. Current workbook rows supply all prices.
function restoreCardSelection(checks){
 if(!qs.has('cardOptions'))return;
 try{
  const parts=JSON.parse(qs.get('cardOptions')),quantity=Number(qs.get('quantity')||1);
  if(!Array.isArray(parts)||parts.length>30||!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('Invalid card selection.');
  const seen=new Set(),items=[{type:'tool',sku,quantity,setupSelected:mainSetupSelected()}];
  for(const part of parts){
   if(!['battery','charger'].includes(part.type)||!Number.isInteger(part.quantity)||part.quantity<1||part.quantity*quantity>20)throw Error('Invalid component quantity.');
   const check=checks.find(c=>c.dataset.type===part.type&&c.dataset.sku===part.sku&&!c.disabled),id=part.type+':'+part.sku;
   if(!check||seen.has(id))throw Error('A selected component is no longer available for this tool.');seen.add(id);
   items.push({type:part.type,sku:part.sku,quantity:part.quantity*quantity,setupSelected:optionSetupSelected(check)});
  }
  sessionStorage.setItem('wepBuildDraft:'+selectedBrand.toUpperCase()+':'+sku,JSON.stringify({brandId:selectedBrand.toUpperCase(),sku,items,paymentConfirmed:false,updated:Date.now()}));
  $('equipment-qty').value=quantity;
  checks.forEach(check=>{const item=items.find(p=>p.type===check.dataset.type&&p.sku===check.dataset.sku);check.checked=!!item;if(item)document.querySelector('[data-qty="'+CSS.escape(item.sku)+'"]').value=item.quantity;});
  // Consume the entry selection so a reload or factory-option change keeps later edits.
  const url=new URL(location.href);url.searchParams.delete('cardOptions');url.searchParams.delete('quantity');history.replaceState(history.state,'',url.href);
 }catch(error){$('options-message').textContent='Your card selection could not be restored. Please review the options: '+error.message;}
}
// Category photos from Yanmar public attachment pages; workbook ImageURL takes precedence.
const implementCategoryImages={"Box Blades":"brands/yanmar/images/implements/box-blades.jpg","Grader Blades":"brands/yanmar/images/implements/grader-blades.jpg","Land Graders":"brands/yanmar/images/implements/land-graders.jpg","Landscape Rakes":"brands/yanmar/images/implements/landscape-rakes.jpg","Rotary Cutters":"brands/yanmar/images/implements/rotary-cutters.jpg","Rotary Tillers":"brands/yanmar/images/implements/rotary-tillers.jpg","Disc Harrows":"brands/yanmar/images/implements/disc-harrows.jpg","Cultivators":"brands/yanmar/images/implements/cultivators.jpg","Subsoilers":"brands/yanmar/images/implements/subsoilers.jpg","Spreaders":"brands/yanmar/images/implements/spreaders.jpg","Bed Shapers":"brands/yanmar/images/implements/bed-shapers.jpg","Disc Mowers":"brands/yanmar/images/implements/disc-mowers.jpg","Hay Balers":"brands/yanmar/images/implements/hay-balers.jpg","Hay Rakes":"brands/yanmar/images/implements/hay-rakes.jpg"};
function renderImplementBrowser(items){
 document.title='Choose Implements | West End Power';
 const quoteUrl=new URL('product-options.html',location.href);quoteUrl.search=location.search;quoteUrl.hash='wep-itemized-quote';
 const packageId=selectedBrand.toUpperCase()+':'+sku,draftKey='wepBuildDraft:'+packageId;
 const returnLink=$('return-link');if(returnLink){returnLink.href=quoteUrl.href;returnLink.textContent='← Return to Quote';}
 const groups=implementGroups(items);
 $('app').innerHTML='<header class="wep-implements-title"><div><h1>Choose Implements</h1><p>'+esc(clean(selectedProduct.Description)||sku)+' · SKU '+esc(sku)+'</p></div><a class="wep-return-quote" href="'+esc(quoteUrl.href)+'">Return to Quote <span data-implement-count></span></a></header>'+implementFreightMarkup()+'<p id="implement-message" role="status" aria-live="polite"></p><div id="implement-groups" class="wep-implement-tiles">'+groups.map((group,index)=>{
  const sample=group.items.find(item=>imageUrl(item))||group.items[0];
  const categoryImage=selectedBrand==='yanmar'?implementCategoryImages[group.name]:'';
  const tileImage=imageUrl(sample)?img(sample,group.name):categoryImage?'<img src="'+esc(categoryImage)+'" alt="'+esc(group.name)+'" loading="lazy">':img(sample,group.name);
  return '<button type="button" class="wep-implement-tile" data-implement-group="'+index+'" aria-controls="implement-group-'+index+'" aria-expanded="false"><span class="wep-implement-tile-image">'+tileImage+'</span><strong>'+esc(group.name)+'</strong><span>'+group.items.length+' '+(group.items.length===1?'Option':'Options')+'</span></button>';
 }).join('')+'</div><div id="implement-group-detail" hidden><button id="all-implement-groups" class="back" type="button">← All Implements</button><div class="wep-option-panel" id="wep-panel-implement">'+groups.map((group,index)=>'<div class="wep-implement-group" id="implement-group-'+index+'" hidden>'+optionSection(group.name+' ('+group.items.length+' '+(group.items.length===1?'Option':'Options')+')',group.items,'attachment')+'</div>').join('')+'</div></div>'+(!groups.length?'<p>No compatible implements are currently listed for this equipment.</p>':'')+'<footer class="wep-implements-footer"><span data-implement-summary></span><a class="wep-return-quote" href="'+esc(quoteUrl.href)+'">Return to Quote <span data-implement-count></span></a></footer><p class="note">Tax and payment pricing are updated when you return to your quote. Implement factory freight is confirmed separately.</p>';
 let opener=null;
 function readCart(){const rows=JSON.parse(buildStorage.getItem('wepCart')||'[]');if(!Array.isArray(rows))throw Error('Your quote could not be read. Return to Quote and try again.');return rows;}
 function refresh(){
  try{
   const saved=readCart().filter(row=>row.packageId===packageId&&row.type==='attachment'&&items.some(item=>clean(item.SKU)===clean(row.sku)));
   const quantity=saved.reduce((sum,row)=>sum+Number(row.quantity||0),0);
   document.querySelectorAll('[data-implement-count]').forEach(el=>el.textContent=quantity?'('+quantity+' Added)':'');
   document.querySelector('[data-implement-summary]').textContent=quantity+' implement'+(quantity===1?'':'s')+' in your quote';
   for(const card of document.querySelectorAll('.wep-implement-group .card')){
    const check=card.querySelector('.option-check'),row=saved.find(row=>row.sku===check?.dataset.sku),count=Number(row?.quantity||0);
    let notice=card.querySelector('.wep-implement-in-quote');if(!notice){notice=document.createElement('small');notice.className='wep-implement-in-quote';card.querySelector('.card-body').append(notice);}
    notice.textContent=count?'In your quote: '+count:'';notice.hidden=!count;
   }
  }catch(error){$('implement-message').textContent=error.message;}
 }
 document.querySelectorAll('[data-implement-group]').forEach(button=>button.addEventListener('click',()=>{
  opener=button;const id=button.dataset.implementGroup;
  $('implement-groups').hidden=true;$('implement-group-detail').hidden=false;
  document.querySelectorAll('.wep-implement-group').forEach(group=>group.hidden=group.id!=='implement-group-'+id);
  document.querySelectorAll('[data-implement-group]').forEach(tile=>tile.setAttribute('aria-expanded',String(tile===button)));
  const heading=$('implement-group-'+id).querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
  window.dispatchEvent(new Event('resize'));
 }));
 $('all-implement-groups').addEventListener('click',()=>{
  $('implement-groups').hidden=false;$('implement-group-detail').hidden=true;
  document.querySelectorAll('[data-implement-group]').forEach(tile=>tile.setAttribute('aria-expanded','false'));opener?.focus({preventScroll:true});
 });
 document.querySelectorAll('.wep-implement-group .add-option-cart').forEach(button=>{
  button.textContent='Add to Quote';button.addEventListener('click',()=>{
   try{
    const item=items.find(row=>clean(row.SKU)===button.dataset.sku);if(!item)throw Error('This implement needs store confirmation.');
    const input=document.querySelector('[data-qty="'+CSS.escape(item.SKU)+'"]'),quantity=Number(input?.value);
    if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('Choose a whole quantity from 1 to 20.');
    const rawCart=buildStorage.getItem('wepCart'),rawDraft=sessionStorage.getItem(draftKey),cart=readCart();
    if(!cart.some(row=>row.packageId===packageId&&row.type==='tool'&&clean(row.sku)===sku))throw Error('Return to Quote to save your equipment before adding implements.');
    const index=cart.findIndex(row=>row.packageId===packageId&&row.type==='attachment'&&clean(row.sku)===clean(item.SKU)),previous=index<0?null:cart[index];
    const total=Number(previous?.quantity||0)+quantity;if(!Number.isInteger(total)||total>20)throw Error('The total quantity for this implement must be 20 or less.');
    const selected=assemblyCode(item)==='F'||(assemblyCode(item)==='T'&&!!setupChoice('attachment',item.SKU)?.checked);
    const row={...previous,brandId:selectedBrand.toUpperCase(),packageId,equipmentSku:sku,type:'attachment',sku:clean(item.SKU),quantity:total,productName:clean(item.Description)||clean(item.Model)||clean(item.SKU),itemPrice:currentPrice(item),assemblyOption:assemblyCode(item),assemblyAmount:assemblyAmount(item),setupSelected:selected,setupAmount:selected?assemblyAmount(item):0,inventoryId:'',quoteStockChoice:'orderable',shipping:null};
    if(index<0)cart.push(row);else cart[index]=row;
    let draft=rawDraft?JSON.parse(rawDraft):null;
    if(draft){
     if(!Array.isArray(draft.items))throw Error('Your saved quote needs confirmation. Return to Quote before adding implements.');
     const entry={brandId:row.brandId,type:'attachment',sku:row.sku,quantity:total,setupSelected:selected,inventoryId:''};
     const n=draft.items.findIndex(x=>x.type==='attachment'&&x.sku===row.sku);if(n<0)draft.items.push(entry);else draft.items[n]=entry;draft.updated=Date.now();
    }
    try{buildStorage.setItem('wepCart',JSON.stringify(cart));if(draft)sessionStorage.setItem(draftKey,JSON.stringify(draft));}
    catch(error){if(rawCart===null)buildStorage.removeItem('wepCart');else buildStorage.setItem('wepCart',rawCart);if(rawDraft!==null)sessionStorage.setItem(draftKey,rawDraft);throw Error('This implement could not be saved. Please try again.');}
    $('implement-message').textContent=quantity+' × '+row.productName+' added to your quote.';refresh();
   }catch(error){$('implement-message').textContent=error.message;}
  });
 });
 refresh();
}

async function init(){
 updateReturn(null,requestedBrand);
 if(!sku){$('app').innerHTML='<section class="section"><h2>No product selected</h2><p>Return to Marketplace and choose Build &amp; Buy.</p></section>';return}
 try{
  const brands=requestedBrand?brandRegistry.filter(b=>String(b.id).toLowerCase()===requestedBrand):brandRegistry;
  if(!brands.length)throw new Error('This brand is not configured yet.');
  let root='';
  const matches=[];
  for(const brand of brands){
   const candidate=clean(brand.dataRoot);
   if(!/^brands\/[a-z0-9_-]+\/data\/$/i.test(candidate))throw new Error('This brand needs a valid data folder.');
   const rows=await csv(candidate+'products.csv');
   if(rows.some(x=>clean(x.SKU)===sku))matches.push({root:candidate,brand:String(brand.id).toLowerCase()});
  }
  if(matches.length>1)throw new Error('This SKU belongs to more than one brand. Return to Marketplace and select the brand.');
  if(matches.length===1){root=matches[0].root;selectedBrand=matches[0].brand;}
  if(!root)throw new Error('Product SKU not found: '+sku);
  const [products,runtime,batteries,chargers,attachments,accessories,parts]=await Promise.all([
   csv(root+'products.csv'),csv(root+'compatibility-runtime.csv',true),csv(root+'batteries.csv',true),csv(root+'chargers.csv',true),csv(root+'attachments.csv',true),csv(root+'accessories.csv',true),csv(root+'parts.csv',true)
  ]);
  stockLocations=await csv('data/locations.csv').catch(()=>[]);
  const product=products.find(x=>clean(x.SKU)===sku);
  if(!product)throw new Error('Product SKU not found: '+sku);
  selectedProduct=product;
  // WEP_PUBLIC_BUILD_REBATE_OFFERS_V1: customer promotion metadata only; pricing remains server-calculated.
  window.WEPBuildRebateOffers=[['tool',[product]],['attachment',attachments],['accessory',accessories],['part',parts],['battery',batteries],['charger',chargers]].flatMap(([type,rows])=>rows.flatMap(row=>{
   const amount=Number(String(row.RebateToCustomer||row.CustomerRebateAmount||'').trim().replace(/[$,]/g,'')),id=clean(row.SKU||row.StihlID||row.BatteryID||row.ChargerID);
   return id&&Number.isFinite(amount)&&amount>0?[{type,sku:id,amount,name:clean(row.RebateName||row.PromoName),startDate:clean(row.RebateStartDate),endDate:clean(row.RebateEndDate)}]:[];
  }));
  // WEP_PUBLIC_BUILD_SPECS_V1: expose only the four customer-visible specification pairs.
  window.WEPBuildProductSpecs=[];
  for(let i=1;i<=10&&window.WEPBuildProductSpecs.length<4;i++){
   const label=clean(product['SpecLabel'+i]),value=clean(product['SpecValue'+i]);
   if(label&&value)window.WEPBuildProductSpecs.push({label,value});
  }
  buildContext=WEPBuildBuy.context(product,runtime,batteries,chargers);
  document.title=(clean(product.Model)||sku)+" | Build & Buy | West End Power";
  updateReturn(product,selectedBrand);
  const compat=runtime.find(x=>clean(x.ToolSKU)===sku)||{};
  const batteryIds=idsFromRuntime(compat,'BatteryID',10);
  const chargerIds=idsFromRuntime(compat,'ChargerID',10);
  const bats=buildContext.batteries;
  const chgs=buildContext.chargers;
  const atts=compatibleRows(attachments,sku).filter(row=>!hasImplementHPLimits(row)).filter(WEPBuildBuy.usable);
  const impls=horsepowerImplements(attachments,sku).filter(WEPBuildBuy.usable);
  horsepowerImplementSkus=new Set(impls.map(item=>clean(item.SKU).toUpperCase()));
  if(implementBrowser){renderImplementBrowser(impls);return;}
  const accs=compatibleRows(accessories,sku).filter(WEPBuildBuy.usable);
  const prts=compatibleRows(parts,sku).filter(WEPBuildBuy.usable);
  requiredPackageComponents=factoryComponentRequirements(product,atts);
  // The same factory equipment flags that supply the package Includes summary.
  const factoryCategories=[['P1-Loader',/^(front\s+)?loaders?$/i],['P2-Backhoe',/^backhoes?$/i],['P3-Mower',/mower/i],['P4-Cab',/^cabs?$/i]];
  factoryPackageIncludedSkus=new Set(atts.filter(row=>factoryCategories.some(([flag,category])=>trueish(product[flag])&&category.test(clean(row.SubCategory)))).map(row=>clean(row.SKU).toUpperCase()));
  optionRequirementRows=[...atts.map(row=>({type:'attachment',row})),...accs.map(row=>({type:'accessory',row})),...prts.map(row=>({type:'part',row}))];
  optionRequirementCatalog=[...attachments.map(row=>({type:'attachment',row})),...accessories.map(row=>({type:'accessory',row})),...parts.map(row=>({type:'part',row}))];
  const name=clean(product.Model)||clean(product.Description)||sku;
  const base=currentPrice(product);
  const kit=['kit','package'].includes(clean(product.ProductType).toLowerCase());
  const included=kit?clean(product.Description):'';
  $('app').innerHTML=
   '<section class="hero"><div class="media">'+img(product,name)+'</div><div><div class="eyebrow wep-build-name">Build &amp; Buy</div><h1 class="wep-build-description">'+esc(clean(product.Description)||name)+'</h1><small class="wep-build-sku">SKU '+esc(sku)+'</small><small id="wep-package-includes"'+(packageInclusions().length?'':' hidden')+'>'+esc(packageInclusions().length?'Includes: '+packageInclusions().join(' · '):'')+'</small><p class="price" data-wep-msrp="'+esc(product.MSRP)+'" data-wep-assembly="'+esc(assemblyCode(product))+'" data-wep-base-price="'+esc(base)+'" data-wep-setup-fee="'+esc(assemblyAmount(product))+'">'+(money(product.MSRP)>0?fmt(money(product.MSRP)):'Contact Us')+'</p>'+(/battery/i.test(clean(product.PowerType))?WEPBuildBuy.costMarkup(product):'')+setupMarkup(product,'tool')+stockMarkup(product)+(quoteEnabled()?'<label>Equipment quantity <input id="equipment-qty" class="qty" type="number" min="1" max="20" value="1"></label>':'')+(included?'<div class="included"><strong>Included in this kit:</strong> '+esc(included)+'<small> Batteries and chargers added below are additional to the included kit.</small></div>':'')+'<a class="wep-spec-link" href="product.html?'+new URLSearchParams({brand:selectedBrand,sku,view:'specs'})+'">View Specifications</a>'+(WEPBuildBuy.hasChart(buildContext)?'<button id="wep-runtime" class="wep-runtime-button" type="button">Run &amp; Charge Times</button>':'')+'</div></section>'+
   buildPanels(bats,chgs,atts,accs,prts,impls)+
   '<section id="wep-itemized-quote" class="section wep-package-review" tabindex="-1" aria-labelledby="wep-itemized-title"><div class="wep-itemized-heading"><div><div class="eyebrow">Your selected equipment &amp; options</div><h2 id="wep-itemized-title">Your Itemized Quote</h2></div><span class="wep-itemized-badge">Updates with your selections</span></div><div id="wep-package-lines" aria-live="polite"></div></section><div class="summary wep-compact-actions" aria-label="Package subtotal and actions"><div class="wep-summary-hidden"><span id="selected-count"></span><span id="selected-merchandise"></span><span id="selected-setup"></span></div><div class="wep-subtotal">Cart subtotal: <strong id="wep-cart-subtotal">$0.00</strong><small>Saved items</small></div><div class="summary-actions"><button id="save-options" type="button">Save Options</button>'+(quoteEnabled()?'<button id="review-package" type="button">Review Quote</button><a class="back" href="cart.html">View Cart</a>':'')+'<button id="wep-print-build" type="button">Print</button></div></div><p id="options-message" role="status"></p><p class="note">Prices and availability are subject to change. Totals reflect your selected equipment, options, payment method and delivery choice. Financing is subject to credit approval. Availability is confirmed before order acceptance. Pricing errors are subject to correction.</p>';
  wireSummary(base);
  wireBuildPage();
  if(location.hash==='#wep-itemized-quote')requestAnimationFrame(()=>requestAnimationFrame(()=>{$('wep-itemized-quote')?.scrollIntoView({block:'start'});}));
  if(!implementBrowser&&window.WEPFactoryOptions){
   WEPFactoryOptions.mount({products,product,brand:selectedBrand,onChange:next=>{
    const snapshot=window.WEPBuildConfiguration?.snapshot();
    if(!snapshot)throw Error('Please wait for availability to load, then try again.');
    const nextSku=clean(next.SKU),nextContext=WEPBuildBuy.context(next,runtime,batteries,chargers);
    const nextAttachments=[...compatibleRows(attachments,nextSku,next).filter(row=>!hasImplementHPLimits(row)),...horsepowerImplements(attachments,nextSku,next)].filter(WEPBuildBuy.usable);
    const allowed=[
     ...nextAttachments.map(row=>({type:'attachment',row,included:factoryCategories.some(([flag,category])=>trueish(next[flag])&&category.test(clean(row.SubCategory)))})),
     ...compatibleRows(accessories,nextSku,next).filter(WEPBuildBuy.usable).map(row=>({type:'accessory',row})),
     ...compatibleRows(parts,nextSku,next).filter(WEPBuildBuy.usable).map(row=>({type:'part',row})),
     ...nextContext.batteries.map(row=>({type:'battery',row})),...nextContext.chargers.map(row=>({type:'charger',row}))
    ];
    const cart=JSON.parse(buildStorage.getItem('wepCart')||'[]');
    const plan=WEPFactoryOptions.transfer({snapshot,current:product,next,brand:selectedBrand,cart,allowed});
    WEPFactoryOptions.persist(plan,buildStorage,sessionStorage);
    const url=new URL(location.href);url.searchParams.set('sku',nextSku);url.searchParams.set('brand',selectedBrand);url.searchParams.delete('unit');url.searchParams.delete('inventoryId');url.hash='';
    window.WEPBuildConfiguration.leave();location.replace(url.href);
   }});
   try{
    const saved=JSON.parse(sessionStorage.getItem('wepBuildDraft:'+selectedBrand.toUpperCase()+':'+sku)||'null');
    if(saved?.configurationNotice){const notice=document.createElement('p');notice.className='wep-configuration-notice';notice.setAttribute('role','status');notice.textContent=saved.configurationNotice+'. Pricing is being updated for this configuration; select a payment option when ready.';document.querySelector('.hero').after(notice);}
   }catch(_){}
  }

 }catch(e){$('app').innerHTML='<section class="section"><h2>Unable to load options</h2><p>'+esc(e.message)+'</p></section>'}
}
init();
})();



