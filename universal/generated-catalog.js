/* Scope a saved page without creating another shopping renderer. */
(() => {
 'use strict';
 const seed=document.getElementById('wep-generated-page');if(!seed)return;
 let data;try{data=JSON.parse(seed.textContent);}catch{return;}
 const key=(brand,sku)=>String(brand||'').trim().toUpperCase()+'|'+String(sku||'').trim().toUpperCase();
 const context=new URLSearchParams(window.location?.search||'');
 function preserveContext(params){if(data.preview)for(const name of ['slug','date'])if(context.has(name))params.set(name,context.get(name));return params;}
 function resetURL(pathname){const query=preserveContext(new URLSearchParams()).toString();return pathname+(query?'?'+query:'');}
 const selected=new Map((data.products||[]).map(p=>[key(p.brand,p.sku),p]));
 const rank=new Map([...selected.keys()].map((id,index)=>[id,index]));
 function products(rows){return rows.filter(r=>selected.has(key(r.BrandID,r.SKU))).sort((a,b)=>rank.get(key(a.BrandID,a.SKU))-rank.get(key(b.BrandID,b.SKU))).map((row,index)=>{
  const p=selected.get(key(row.BrandID,row.SKU));
  if(p.discontinued&&p.stock>0)row={...row,Active:'T',SellRemainingStockOnly:'T'};
  // Date previews use the server's already-evaluated sale/rebate amounts.
  if(!data.preview)return {...row,SortOrder:String(index+1)};
  return {...row,SortOrder:String(index+1),MSRP:String(p.msrp),SalePrice:p.saleActive?String(p.price):'',SaleStartDate:'',SaleEndDate:'',RebateEligible:p.rebate?'T':'F',RebateToCustomer:String(p.rebate||0),RebateStartDate:'',RebateEndDate:''};
 });}
 function params(search){const result=new URLSearchParams(data.query||''),overrides=new URLSearchParams(search);for(const key of new Set(overrides.keys())){result.delete(key);for(const value of overrides.getAll(key))result.append(key,value);}return result;}
 window.WEPGeneratedCatalog={products,params,preserveContext,resetURL,preview:!!data.preview};
})();
