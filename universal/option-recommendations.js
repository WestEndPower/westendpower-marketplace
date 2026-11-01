(function(root){
 'use strict';
 const clean=v=>String(v??'').trim(),key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,''),id=item=>item.type+':'+clean(item.sku||item.row.SKU).toUpperCase();
 function slots(row,product){
  const prefix=key(product.SKU),fields=new Map(Object.entries(row).map(([k,v])=>[key(k),clean(v)])),pattern=new RegExp('^'+prefix+'REC([1-9]\\d*)$');
  if(!prefix)return [];
  return [...fields].flatMap(([field,sku])=>{const match=field.match(pattern);if(!match||!sku)return [];const n=match[1];return [{sku,quantity:Number(fields.get(prefix+'RECQTY'+n)||fields.get(prefix+'RECQTYT'+n)||1),slot:Number(n)}];}).sort((a,b)=>a.slot-b.slot);
 }
 // Recommendations are optional. An unavailable recommendation never blocks its parent.
 function plan(selected,catalog,product,{required,excluded=new Set(),installed=()=>false}={}){
  const desired=new Map(),warnings=new Set(),roots=new Set(selected.map(id));
  function walk(item,path=[]){
   if(path.includes(id(item)))return;
   for(const rule of slots(item.row,product)){
    const target=catalog.find(p=>key(p.row.SKU)===key(rule.sku)),quantity=item.quantity*rule.quantity;
    if(target&&installed(target.row))continue;
    if(!target||!Number.isInteger(rule.quantity)||rule.quantity<1||!Number.isInteger(quantity)||quantity<1||quantity>20){warnings.add('Some recommended items are unavailable. Contact the store for help.');continue;}
    const targetId=id(target);if(excluded.has(targetId)||path.includes(targetId)||targetId===id(item)||roots.has(targetId))continue;
    const next={...target,quantity,parent:item.parent||id(item)};let dependencies;
    try{dependencies=required?required([next]):[];}catch(_){warnings.add('Some recommended items are unavailable. Contact the store for help.');continue;}
    const previous=desired.get(targetId);if(previous&&previous.quantity>=quantity)continue;
    desired.set(targetId,next);walk(next,[...path,id(item)]);
    for(const child of dependencies)walk({...child,parent:next.parent},[...path,id(item),targetId]);
   }
  }
  for(const item of [...selected,...(required?required(selected):[])])walk(item);
  return {items:desired,warnings:[...warnings]};
 }
 function createState(storage,storageKey){
  let saved={};try{saved=JSON.parse(storage?.getItem(storageKey)||'{}')||{};}catch(_){}
  const excluded=new Set(Array.isArray(saved.excluded)?saved.excluded:[]),automatic=new Set(Array.isArray(saved.automatic)?saved.automatic:[]);
  function save(){try{storage?.setItem(storageKey,JSON.stringify({excluded:[...excluded],automatic:[...automatic]}));}catch(_){} }
  function change(itemId,checked){automatic.delete(itemId);if(checked)excluded.delete(itemId);else excluded.add(itemId);save();}
  return {excluded,automatic,change,save};
 }
 const api={slots,plan,createState};if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WEPOptionRecommendations=api;
})(typeof window==='undefined'?null:window);
