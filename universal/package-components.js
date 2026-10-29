/* Shared package definitions and exact cent allocation. No dealer data is bundled. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WEPKitComponents=api;})(globalThis,function(){
 'use strict';
 const clean=v=>String(v??'').trim(),key=v=>clean(v).replace(/\s+/g,'').toUpperCase();
 const yes=v=>/^(T|TRUE|YES|Y|1|X)$/i.test(clean(v));
 const active=r=>r&&(!clean(r.Active)||yes(r.Active))&&clean(r.SKU)&&!['STOP','REFERENCE_ONLY'].includes(key(r.SKU));
 const amount=v=>{if(v==null||clean(v)==='')return null;const n=Number(clean(v).replace(/[$,]/g,''));return Number.isFinite(n)&&n>=0?n:null;};
 const cents=v=>{const n=amount(v);if(n===null)throw Error('Component pricing needs confirmation.');return Math.round((n+Number.EPSILON)*100);};
 const fields={battery:'batteries',charger:'chargers',attachment:'attachments',accessory:'accessories',part:'parts'};
 const family=r=>key(r.BuildFamily||r.MarketplaceFamily||r.Model);
 function current(row,now=new Date()){
  const day=now.toLocaleDateString('en-CA',{timeZone:'America/New_York'}),valid=(a,b)=>(!clean(a)||day>=clean(a).slice(0,10))&&(!clean(b)||day<=clean(b).slice(0,10));
  const msrp=amount(row.MSRP),sale=amount(row.SalePrice),rebate=amount(row.RebateToCustomer);
  if(sale>0&&msrp>sale&&valid(row.SaleStartDate,row.SaleEndDate))return sale;
  if(rebate>0&&msrp>rebate&&valid(row.RebateStartDate,row.RebateEndDate))return Math.round((msrp-rebate)*100)/100;
  return msrp;
 }
 function definition(product,products,packages,catalog){
  const rows=(packages||[]).filter(p=>key(p.ParentSKU)===key(product.SKU)&&(!clean(p.Active)||yes(p.Active)));
  if(!rows.length)return null;if(rows.length!==1)throw Error('More than one active package definition.');
  const row=rows[0],explicit=clean(row.ToolSKU||row.BaseToolSKU),tools=products.filter(p=>active(p)&&! /kit|package/i.test(clean(p.ProductType))&&(explicit?key(p.SKU)===key(explicit):family(p)&&family(p)===family(product)));
  if(tools.length!==1)throw Error('The package needs an explicit bare ToolSKU.');
  const parts=[];
  for(const [type,table] of Object.entries(fields))for(const field of Object.keys(row).filter(h=>new RegExp('^'+type+'SKU\\d+$','i').test(h))){
   if(!clean(row[field]))continue;const slot=field.match(/\d+$/)[0],quantity=clean(row[type[0].toUpperCase()+type.slice(1)+'Qty'+slot])||'1';
   const component=(catalog[table]||[]).find(p=>key(p.SKU)===key(row[field])&&active(p)),qty=Number(quantity);
   if(!component||!Number.isInteger(qty)||qty<1||qty>100)throw Error('An included package component needs confirmation.');
   const existing=parts.find(p=>p.type===type&&key(p.row.SKU)===key(component.SKU));if(existing)existing.qty+=qty;else parts.push({type,row:component,qty});
  }
  if(!parts.length)return null;
  return {parent:product,tool:tools[0],parts};
 }
 function allocate({total,tool,parts,price=current,dealer=false}){
  let remaining=cents(total)-cents(tool);if(remaining<0)throw Error('Package price is below the bare tool price.');
  const allocated=parts.map(p=>({...p,totalCents:0})),batteries=allocated.filter(p=>p.type==='battery'),chargers=allocated.filter(p=>p.type==='charger'),others=allocated.filter(p=>!['battery','charger'].includes(p.type));
  for(const p of others){p.totalCents=cents(price(p.row))*p.qty;remaining-=p.totalCents;}
  if(remaining<0)throw Error('Required items exceed the package balance.');
  if(dealer){
   for(const p of chargers){p.totalCents=cents(price(p.row))*p.qty;remaining-=p.totalCents;}
   if(remaining<0)throw Error('Tool and charger costs exceed actual kit cost.');
   distribute(remaining,batteries,price);remaining=0;
  }else{
   for(const p of batteries){
    const exact=Math.min(cents(price(p.row)),Math.floor(remaining/p.qty));
    // Keep tool MSRP and the package total fixed. If rounding up overruns
    // the available balance, use the largest $10 unit price that fits.
    const rounded=Math.min(Math.ceil(exact/1000)*1000,Math.floor(remaining/(p.qty*1000))*1000);
    p.totalCents=rounded*p.qty;remaining-=p.totalCents;
   }
   if(chargers.length){distribute(remaining,chargers,price);remaining=0;}
   else if(remaining&&batteries.length){batteries[batteries.length-1].totalCents+=remaining;remaining=0;}
  }
  if(remaining)throw Error('The package balance cannot be allocated.');
  return [{type:'tool',quantity:1,itemTotal:cents(tool)/100,unitPrice:cents(tool)/100},...allocated.map(p=>({type:p.type,sku:clean(p.row.SKU),productName:clean(p.row.Description||p.row.Model||p.row.SKU),quantity:p.qty,itemTotal:p.totalCents/100,unitPrice:p.totalCents/100/p.qty,regularUnitPrice:amount(p.row.MSRP),standaloneUnitPrice:amount(price(p.row)),included:true,locked:true}))];
 }
 function distribute(total,parts,price){
  if(!parts.length){if(total)throw Error('No battery or charger to receive the package balance.');return;}
  const weights=parts.map(p=>cents(price(p.row))*p.qty),sum=weights.reduce((a,b)=>a+b,0);let used=0;
  parts.forEach((p,i)=>{p.totalCents=i===parts.length-1?total-used:Math.floor(total*(sum?weights[i]/sum:1/parts.length));used+=p.totalCents;});
 }
 function breakdown(def,total,quantity=1,options={}){
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error('Choose a whole package quantity from 1 to 100.');
  const price=options.price||current,toolPrice=options.dealer?(options.toolPrice??price(def.tool)):amount(def.tool.MSRP),rows=allocate({total,tool:toolPrice,parts:def.parts,price,dealer:options.dealer});
  rows[0]={...rows[0],sku:clean(def.tool.SKU),productName:clean(def.tool.Description||def.tool.Model||def.tool.SKU),regularUnitPrice:amount(def.tool.MSRP),included:true,locked:true};
  return rows.map(row=>({...row,perPackageQuantity:row.quantity,perPackageTotal:row.itemTotal,quantity:row.quantity*quantity,itemTotal:Math.round(row.itemTotal*quantity*100)/100,parentSku:clean(def.parent.SKU)}));
 }
 function required(tool,batteries,rules,catalog){
  const result=new Map();
  for(const rule of rules||[]){
   if(clean(rule.Active)&&!yes(rule.Active)||key(rule.ToolSKU)!==key(tool.SKU))continue;
   const battery=batteries.find(p=>[p.row.SKU,p.row.BatteryID,p.row.Model].some(v=>key(v)&&key(v)===key(rule.BatterySKU||rule.BatteryID)));if(!battery)continue;
   const type=clean(rule.RequiredType||'accessory').toLowerCase(),table=fields[type],row=table&&(catalog[table]||[]).find(p=>active(p)&&key(p.SKU)===key(rule.RequiredSKU)),qty=Number(clean(rule.RequiredQty)||1)*(yes(rule.PerBattery)?battery.qty:1);
   if(!row||!Number.isInteger(qty)||qty<1||qty>100)throw Error('Required battery connection items need confirmation.');
   const id=type+':'+key(row.SKU),previous=result.get(id);if(!previous||previous.qty<qty)result.set(id,{type,row,qty,required:true});
  }
  return [...result.values()];
 }
 function batteryGroup(row,brand){
  if(key(brand)==='GREENWORKS'){
   const family=key(row.BatterySeries||row.Series);
   if(/^(82BD|CORE)(?:SERIES)?$/.test(family))return family.startsWith('82BD')?'82BD Series':'CORE Series';
  }
  if(clean(row.BatterySeries))return clean(row.BatterySeries);
  const name=key(row.BatteryID||row.Model);
  if(key(brand)==='STIHL')return /^AP(?:\d+\.\d|\d+P)/.test(name)?'PRO AP Series':/^(AP|AR)/.test(name)?'AP / AR Series':'Batteries';
  if(key(brand)==='GREENWORKS')return /^82BD/.test(name)?'82BD Series':/^CORE/.test(name)?'CORE Series':'Batteries';
  return 'Batteries';
 }
 function shortName(row,group){const name=clean(row.ButtonLabel||row.BatteryID||row.ChargerID||row.Model||row.Description);return group==='PRO AP Series'?name.replace(/^AP\s*/i,'').replace(/^(100|200|300)(PC?)$/i,'$1.0$2'):group==='82BD Series'?name.replace(/^82BD\s*/i,''):group==='CORE Series'?name.replace(/^CORE\s*/i,''):name.replace(/\s+/g,'');}
 function visible(row,stock){return active(row)&&(!yes(row.SellRemainingStockOnly)||Number(stock??((amount(row.QtyNewMilford)||0)+(amount(row.QtyDanbury)||0)))>0);}
 function reprice(line){
  if(!line.kitComponents?.length)return line;
  try{const tool=line.kitComponents.find(c=>c.type==='tool'),parts=line.kitComponents.filter(c=>c.type!=='tool'),def={parent:{SKU:line.sku},tool:{SKU:tool.sku,Description:tool.productName,MSRP:tool.regularUnitPrice},parts:parts.map(c=>({type:c.type,row:{SKU:c.sku,Description:c.productName,MSRP:c.regularUnitPrice,StandalonePrice:c.standaloneUnitPrice??c.regularUnitPrice},qty:c.quantity/line.quantity}))};line.kitComponents=breakdown(def,line.itemTotal/line.quantity,line.quantity,{price:r=>r.StandalonePrice});delete line.kitBreakdownIssue;}
  catch(error){delete line.kitComponents;line.kitBreakdownIssue=error.message;}return line;
 }
 function displayLines(lines){return (lines||[]).flatMap(line=>Array.isArray(line.kitComponents)&&line.kitComponents.length?line.kitComponents.map((c,i)=>({...line,...c,productName:(i===0?'Package '+line.sku+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(line.itemTotal)+' total — ':'')+c.productName,brandId:line.brandId,setupTotal:i===0?line.setupTotal:0,setupSelected:i===0?line.setupSelected:false,setupUnit:i===0?line.setupUnit:0,assemblyOption:i===0?line.assemblyOption:'',kitComponents:undefined,pricingSource:line.pricingSource,packageSku:line.sku,packagePrice:line.itemTotal,packageQuantity:line.quantity,baseUnitPrice:c.regularUnitPrice})): [line]);}
 return {key,active,amount,current,definition,allocate,breakdown,required,batteryGroup,shortName,visible,displayLines,reprice};
});
