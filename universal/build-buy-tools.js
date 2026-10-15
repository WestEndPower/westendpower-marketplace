/* WEP_BUILD_BUY_TOOLS_V1 */
(function(root){
'use strict';
const clean=v=>String(v??'').replace(/^\uFEFF/,'').trim();
const key=v=>clean(v).replace(/\s+/g,'').toUpperCase();
const positive=v=>{const n=Number(clean(v).replace(/[$,]/g,''));return Number.isFinite(n)&&n>0?n:null};
const active=x=>!clean(x.Active)||['T','TRUE','YES','Y','1','X'].includes(key(x.Active));
const usable=x=>active(x)&&clean(x.SKU)&&!['STOP','REFERENCE_ONLY','00000000000'].includes(key(x.SKU));
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function energyKWh(x){
 for(const f of ['BatteryCapacityKWh','BatteryKWh','KWh','kWh']){const n=positive(x[f]);if(n)return n;}
 for(const f of ['Wh','WattHours','WattHoursCapacity']){const n=positive(x[f]);if(n)return n/1000;}
 for(let i=1;i<=10;i++){
  const label=clean(x['SpecLabel'+i]),value=clean(x['SpecValue'+i]);
  if(!/battery.*(?:capacity|energy)|(?:capacity|energy).*battery/i.test(label))continue;
  const m=value.match(/^\s*([\d.,]+)\s*(kwh|wh)\s*$/i);if(m&&positive(m[1]))return positive(m[1])*(m[2].toLowerCase()==='wh'?.001:1);
  const n=positive(value);if(n&&/\bkwh\b/i.test(label))return n;if(n&&/\bwh\b/i.test(label))return n/1000;
 }
 const volts=positive(x.Voltage),ah=positive(x.Ah||x.AmpHours);return volts&&ah?volts*ah/1000:null;
}
function estimate(x){const kwh=energyKWh(x);if(!kwh)return null;const rate=positive(x.ElectricityRatePerKWh)||.35;let efficiency=positive(x.ChargingEfficiency);if(efficiency>1)efficiency/=100;if(!efficiency||efficiency>1)efficiency=.85;return {kwh,rate,efficiency,cost:kwh/efficiency*rate};}
const dollars=v=>v>0&&v<.01?'less than $0.01':'$'+v.toFixed(2);
function costMarkup(x){const e=estimate(x);return e?'<div class="wep-charge-cost"><strong>Est. charge: '+dollars(e.cost)+'</strong><details class="wep-cost-info"><summary aria-label="Electricity cost assumptions">i</summary><small>Electricity per full charge at $'+e.rate.toFixed(2)+'/kWh, assuming '+Math.round(e.efficiency*100)+'% charging efficiency. Actual cost varies.</small></details></div>':'';}
function versions(products,product){
 const family=clean(product.BuildFamily)||clean(product.MarketplaceFamily)||clean(product.Model);
 if(!family)return [product];
 return products.filter(x=>usable(x)&&key(x.BrandID)===key(product.BrandID)&&key(x.Category)===key(product.Category)&&key(x.PowerType)===key(product.PowerType)&&(clean(x.BuildFamily)||clean(x.MarketplaceFamily)||clean(x.Model))===family).sort((a,b)=>{const sort=v=>clean(v)!==''&&Number.isFinite(Number(v))?Number(v):Infinity;const av=sort(a.SortOrder),bv=sort(b.SortOrder);return av===bv?0:av-bv;});
}
function versionMarkup(products,product,brand,returnUrl){const rows=versions(products,product);if(rows.length<2)return '';return '<fieldset class="wep-versions"><legend>Choose your version</legend>'+rows.map(x=>{const selected=clean(x.SKU)===clean(product.SKU),kit=/^(kit|package)$/i.test(clean(x.ProductType)),price=positive(x.SalePrice)||positive(x.MSRP);const params=new URLSearchParams({brand,sku:clean(x.SKU)});if(returnUrl)params.set('return',returnUrl);const url='product-options.html?'+params;return '<a class="wep-version'+(selected?' selected':'')+'" '+(selected?'aria-current="true" ':'')+'href="'+esc(url)+'"><strong>'+(kit?'Kit / Package':/battery/i.test(product.PowerType)?'Tool Only':esc(x.Model||'Configuration'))+'</strong><span>'+esc(x.Description||x.Model)+'</span><small>SKU '+esc(x.SKU)+'</small><b>'+(price?'$'+price.toFixed(2):'Contact Us')+'</b>'+(selected?'<small>Selected</small>':'')+'</a>';}).join('')+'</fieldset>';}
function parseCSV(text){let field='',row=[],quoted=false,rows=[];text=String(text).replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}else if(c==='"')quoted=true;else if(c===','||c==='\n'||c==='\r'){row.push(field);field='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(clean))rows.push(row);row=[];}}else field+=c;}if(quoted)throw Error('Incomplete CSV');if(field||row.length){row.push(field);rows.push(row);}const headers=(rows.shift()||[]).map(clean);return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));}
function ids(rows,prefix){return new Set(rows.flatMap(r=>Array.from({length:10},(_,i)=>key(r[prefix+(i+1)]))).filter(Boolean));}
function context(product,runtime,batteries,chargers){let records=runtime.filter(r=>clean(r.ToolSKU)===clean(product.SKU)&&active(r)&&!clean(r.AttachmentSKU));const b=ids(records,'BatteryID'),c=ids(records,'ChargerID');const bats=batteries.filter(x=>usable(x)&&[x.BatteryID,x.Model,x.SKU].some(v=>b.has(key(v)))||usable(x)&&['T','TRUE','1','X'].includes(key(x[product.SKU])));const chgs=chargers.filter(x=>usable(x)&&[x.ChargerID,x.Model,x.ChargerName,x.SKU].some(v=>c.has(key(v)))||usable(x)&&['T','TRUE','1','X'].includes(key(x[product.SKU])));return {product,records,batteries:bats,chargers:chgs};}
function runtimeText(ctx,battery){for(const r of ctx.records)for(let i=1;i<=10;i++)if([battery.BatteryID,battery.Model,battery.SKU].some(v=>key(v)&&key(v)===key(r['BatteryID'+i]))){const min=positive(r['RunTimeMin'+i]),max=positive(r['RunTimeMax'+i]);if(min&&max)return (min===max?min:min+'–'+max)+' min';if(max)return 'Up to '+max+' min';if(min)return min+' min';}return '';}
function chargeTime(battery,charger){for(let i=1;i<=10;i++)if([charger.ChargerID,charger.Model,charger.ChargerName,charger.SKU].some(v=>key(v)&&key(v)===key(battery['ChargerID'+i]))){const a=positive(battery['Charger'+i+' 80%']),b=positive(battery['Charger'+i+' 100%']);if(a||b)return {a,b};}return null;}
function hasChart(ctx){return !!estimate(ctx.product)||ctx.batteries.some(b=>runtimeText(ctx,b)||estimate(b)||ctx.chargers.some(c=>chargeTime(b,c)));}
function cardInfo(x,type,ctx){let html='';const available=type==='battery'?!!runtimeText(ctx,x):type==='charger'?ctx.batteries.some(b=>chargeTime(b,x)):false;return html+(available?'<button type="button" class="stock-action wep-card-chart" data-wep-card-kind="'+type+'" data-wep-card-sku="'+esc(x.SKU)+'">'+(type==='battery'?'Run Time':'Charge Times')+'</button>':'');}
function chartMarkup(ctx,kind='all',sku=''){
 const bats=kind==='battery'?ctx.batteries.filter(x=>clean(x.SKU)===clean(sku)):ctx.batteries;
 const chgs=kind==='charger'?ctx.chargers.filter(x=>clean(x.SKU)===clean(sku)):ctx.chargers;
 const columns=chgs.filter(c=>bats.some(b=>chargeTime(b,c)));
 const rows=bats.filter(b=>runtimeText(ctx,b)||estimate(b)||columns.some(c=>chargeTime(b,c)));
 if(!rows.length){const e=estimate(ctx.product);return e?costMarkup(ctx.product)+'<p>Battery energy: '+e.kwh+' kWh. Run and charge times are not yet listed for this equipment.</p>':'<p>Run and charge times are not yet available for this selection.</p>';}
 return '<div class="wep-table-scroll"><table><thead><tr><th>Battery</th><th>Estimated run time</th><th>Est. electricity / full charge</th>'+columns.map(c=>'<th>'+esc(c.ChargerName||c.Model||c.ChargerID)+'<small>80% / 100% charge</small></th>').join('')+'</tr></thead><tbody>'+rows.map(b=>{const e=estimate(b);return '<tr><th>'+esc(b.Model||b.Description||b.BatteryID)+'<small>SKU '+esc(b.SKU)+'</small></th><td>'+esc(runtimeText(ctx,b)||'Not listed')+'</td><td>'+(e?dollars(e.cost)+'<small>$'+e.rate.toFixed(2)+'/kWh · '+Math.round(e.efficiency*100)+'% efficiency assumed</small>':'Not listed')+'</td>'+columns.map(c=>{const t=chargeTime(b,c);return '<td>'+(t?(t.a?t.a+' min':'Not listed')+' / '+(t.b?t.b+' min':'Not listed'):'Not listed')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><p class="note">Runtime and charging times are estimates and vary with use, temperature and battery condition. Electricity estimates include assumed charging losses, exclude standby use, and vary with your electricity rate.</p>';
}
function openChart(ctx,kind,sku){const d=document.createElement('dialog');d.className='wep-chart-dialog';d.setAttribute('aria-label','Run and charge times');d.innerHTML='<div class="wep-dialog-head"><h2>'+esc(ctx.product.Model||ctx.product.Description)+' — Run &amp; Charge Times</h2><button type="button" aria-label="Close chart">Close</button></div>'+chartMarkup(ctx,kind,sku);document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.showModal();}
const cache=new Map();
async function load(brand,sku){brand=clean(brand).toLowerCase();if(!['stihl','toro','yanmar','honda','billygoat','redmax','greenworks','mitm'].includes(brand))throw Error('Brand not found');const k=brand+':'+sku;if(!cache.has(k))cache.set(k,(async()=>{const root='brands/'+brand+'/data/';const tables=await Promise.all(['products','compatibility-runtime','batteries','chargers'].map(async n=>{const r=await fetch(root+n+'.csv',{cache:'no-store'});if(!r.ok){if(n==='products')throw Error('Product data unavailable');return [];}return parseCSV(await r.text());}));const product=tables[0].find(x=>clean(x.SKU)===clean(sku));if(!product)throw Error('Product not found');return context(product,...tables.slice(1));})().catch(e=>{cache.delete(k);throw e;}));return cache.get(k);}
function energySpecs(x,type){
 if(!['battery','charger'].includes(type))return '';
 const cells=[];
 const cell=(label,value)=>{if(value)cells.push('<div><small>'+label+'</small><strong>'+esc(value)+'</strong></div>');};
 if(type==='battery'){
  const kwh=energyKWh(x),ah=positive(x.Ah||x.AmpHours);
  cell('Energy',kwh?Number((kwh*1000).toFixed(2))+' Wh':'');
  cell('Capacity',ah?ah+' Ah':'');
 }
 let weight=positive(x.Weight),unit=clean(x.WeightUnit);
 if(!weight){if(positive(x.WeightLb)){weight=positive(x.WeightLb);unit='lb';}else if(positive(x.WeightKg)){weight=positive(x.WeightKg);unit='kg';}}
 cell('Weight',weight&&unit?weight+' '+unit:'');
 if(type==='battery'&&estimate(x))cells.push('<div class="wep-spec-charge">'+costMarkup(x).replace('<strong>Est. charge: ','<small>Est. charge</small><strong>')+'</div>');
 return cells.length?'<div class="wep-energy-specs">'+cells.join('')+'</div>':'';
}

const api={energySpecs,energyKWh,estimate,costMarkup,versions,versionMarkup,parseCSV,context,runtimeText,chargeTime,hasChart,cardInfo,chartMarkup,openChart,load,usable};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.WEPBuildBuy=api;
if(typeof document!=='undefined')document.addEventListener('click',async e=>{const a=e.target.closest('[data-wep-runtime-brand]');if(!a)return;e.preventDefault();try{openChart(await load(a.dataset.wepRuntimeBrand,a.dataset.wepRuntimeSku));}catch(error){alert('Unable to load the chart: '+error.message);}});
})(typeof window!=='undefined'?window:null);

// WEP_COMPACT_ENERGY_CARDS_V1

// WEP_OPTION_DEFAULTS_AND_ENERGY_SPECS_V1
