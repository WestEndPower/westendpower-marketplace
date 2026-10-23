/* Complete catalog configurations: factory equipment is never priced as guessed add-ons. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.WEPFactoryOptions=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 const clean=value=>String(value??'').trim();
 const yes=value=>/^(T|TRUE|Y|YES|1|X)$/i.test(clean(value));
 const number=value=>Number(clean(value).replace(/[$,]/g,''));
 const fields=[['Loader','P1-Loader'],['Backhoe','P2-Backhoe'],['Mower','P3-Mower'],['Cab','P4-Cab']];
 const tires=[['R-1','Ag'],['R-3','Turf'],['R-4','Industrial'],['Hybrid','Hybrid']];
 const flags=row=>fields.map(([,field])=>yes(row[field]));
 const price=row=>number(row.SalePrice)>0?number(row.SalePrice):number(row.MSRP);
 function tire(row){
  const raw=clean(row['B2-Tires']||row.Tires),value=raw.toLowerCase().replace(/[\s-]/g,'');
  if(/^(ag|agricultural|r1)$/.test(value))return 'R-1';
  if(/^(turf|r3)$/.test(value))return 'R-3';
  if(/^(industrial|r4)$/.test(value))return 'R-4';
  if(/hybrid|^r14/.test(value))return 'Hybrid';
  return raw;
 }
 function variants(products,current,brand){
  if(!/^compact tractors?$/i.test(clean(current.Category))||!clean(current.Model))return [];
  const model=clean(current.Model).toUpperCase(),cab=model.match(/^(YT235|YT347|YT359)C?$/);
  const models=clean(brand).toUpperCase()==='YANMAR'&&cab?[cab[1],cab[1]+'C']:[model];
  const seen=new Set();
  return products.filter(row=>{
   const sku=clean(row.SKU);
   if(!sku||seen.has(sku)||!models.includes(clean(row.Model).toUpperCase())||!/^compact tractors?$/i.test(clean(row.Category)))return false;
   if(clean(row.BrandID)&&clean(row.BrandID).toUpperCase()!==clean(brand).toUpperCase())return false;
   if(clean(row.Active)&&!yes(row.Active)||!(price(row)>0))return false;
   seen.add(sku);return true;
  });
 }
 function optionCandidate(rows,current,index){
  const original=flags(current),wanted=!original[index];
  return rows.filter(row=>tire(row)===tire(current)&&flags(row)[index]===wanted&&(!wanted||original.every((on,i)=>i===index||!on||flags(row)[i])))
   .sort((a,b)=>{
    const changes=row=>flags(row).reduce((n,on,i)=>n+Number(i!==index&&on!==original[i]),0);
    return changes(a)-changes(b)||price(a)-price(b)||number(a.SortOrder)-number(b.SortOrder)||clean(a.SKU).localeCompare(clean(b.SKU));
   })[0]||null;
 }
 function tireCandidate(rows,current,value){
  return rows.filter(row=>tire(row)===value&&flags(row).every((on,i)=>on===flags(current)[i]))
   .sort((a,b)=>price(a)-price(b)||number(a.SortOrder)-number(b.SortOrder)||clean(a.SKU).localeCompare(clean(b.SKU)))[0]||null;
 }
 function transfer({snapshot,current,next,brand,cart,allowed}){
  const brandId=clean(brand).toUpperCase(),oldGroup=brandId+':'+clean(current.SKU),newGroup=brandId+':'+clean(next.SKU);
  if(!Array.isArray(cart)||!Array.isArray(snapshot.items))throw Error('Your saved package could not be read. Nothing changed.');
  if(cart.some(row=>row.packageId===newGroup)&&oldGroup!==newGroup)throw Error('This configuration is already saved in your cart. Open that package from the cart before changing it.');
  const main=snapshot.items.find(item=>item.type==='tool'&&item.sku===clean(current.SKU));
  if(!main||main.inventoryId)throw Error('Select Order Unit before changing factory options or tires.');
  if(!Number.isInteger(main.quantity)||main.quantity<1||main.quantity>20)throw Error('Choose an equipment quantity from 1 to 20.');
  const mainSetup=clean(next.AssemblyOption).toUpperCase()==='F'||clean(next.AssemblyOption).toUpperCase()==='T'&&main.setupSelected===true;
  const items=[{brandId,type:'tool',sku:clean(next.SKU),quantity:main.quantity,setupSelected:mainSetup,inventoryId:''}],rows=[{type:'tool',row:next,item:items[0]}],removed=[];
  for(const item of snapshot.items.filter(item=>item.type!=='tool')){
   if(item.autoRequiredComponent===true)continue; // The new package regenerates its own prerequisites.
   const match=allowed.find(entry=>entry.type===item.type&&clean(entry.row.SKU||entry.row.BatteryID||entry.row.ChargerID)===item.sku);
   if(!match||match.included){
    const previous=cart.find(row=>row.packageId===oldGroup&&row.type===item.type&&row.sku===item.sku);
    removed.push((clean(previous?.productName)||item.sku)+(match?.included?' (now factory included)':' (not compatible)'));continue;
   }
   const setup=clean(match.row.AssemblyOption).toUpperCase();
   const carried={...item,setupSelected:setup==='F'||setup==='T'&&item.setupSelected===true};delete carried.autoRequiredComponent;
   items.push(carried);rows.push({...match,item:carried});
  }
  const changed=fields.filter(([,field])=>yes(current[field])!==yes(next[field])).map(([label,field])=>(yes(next[field])?'Added ':'Removed ')+label.toLowerCase());
  if(tire(current)!==tire(next))changed.push('Tires: '+tire(next));
  const notice=[...changed,...(removed.length?['Removed additional items: '+removed.join('; ')]:[])].join('. ');
  const draft={brandId,sku:clean(next.SKU),items,paymentMethod:snapshot.paymentMethod||'standard',programId:snapshot.programId||snapshot.financeProgramIds?.[brandId]||'',paymentConfirmed:['cash','credit','finance'].includes(snapshot.paymentMethod),financeDownPayments:snapshot.financeDownPayments||{},fulfillment:['NEW_MILFORD','DANBURY','DELIVERY'].includes(snapshot.fulfillment)?snapshot.fulfillment:'NEW_MILFORD',zip:clean(snapshot.zip),configurationNotice:notice,updated:Date.now()};
  const nextCart=cart.filter(row=>row.packageId!==oldGroup).concat(rows.map(({type,row,item})=>{
   const fee=Math.max(0,number(row.AssemblyAmount)||0);
   return {brandId,packageId:newGroup,equipmentSku:clean(next.SKU),type,sku:item.sku,quantity:item.quantity,productName:clean(row.Description)||clean(row.Model)||item.sku,itemPrice:price(row),assemblyOption:clean(row.AssemblyOption).toUpperCase(),assemblyAmount:fee,setupSelected:item.setupSelected,setupAmount:item.setupSelected?fee:0,inventoryId:clean(item.inventoryId),quoteStockChoice:item.inventoryId?'stock':'orderable',autoRequiredComponent:false,shipping:null};
  }));
  return {draft,cart:nextCart,oldGroup,newGroup};
 }
 function persist(plan,local,session){
  const oldKey='wepBuildDraft:'+plan.oldGroup,newKey='wepBuildDraft:'+plan.newGroup;
  const originalCart=local.getItem('wepCart'),keys=[...new Set([oldKey,newKey,'wepBuildCheckoutChoices'])],originals=keys.map(key=>[key,session.getItem(key)]);
  const restore=(storage,key,value)=>value===null?storage.removeItem(key):storage.setItem(key,value);
  let cartWritten=false;
  try{
   session.setItem(newKey,JSON.stringify(plan.draft));
   local.setItem('wepCart',JSON.stringify(plan.cart));cartWritten=true;
   if(oldKey!==newKey)session.removeItem(oldKey);
   session.removeItem('wepBuildCheckoutChoices');
  }catch(error){
   if(cartWritten)try{restore(local,'wepCart',originalCart);}catch(_){}
   for(const [key,value] of originals)try{restore(session,key,value);}catch(_){}
   throw Error('The new configuration could not be saved. Please try again.');
  }
 }
 function mount({products,product,brand,onChange}){
  const choices=variants(products,product,brand);if(!choices.length)return;
  const section=document.createElement('section');section.className='wep-factory-options';section.setAttribute('aria-label','Tractor configuration');
  const heading=document.createElement('h3');heading.textContent='Configure Your Tractor';section.append(heading);
  const buttons=document.createElement('div');buttons.className='wep-factory-buttons';buttons.setAttribute('role','group');buttons.setAttribute('aria-label','Factory-installed options');section.append(buttons);
  const entries=[];
  fields.forEach(([label],index)=>{
   if(!flags(product)[index]&&!choices.some(row=>flags(row)[index]))return;
   const button=document.createElement('button'),candidate=optionCandidate(choices,product,index);button.type='button';button.textContent=label;button.dataset.factoryOption=label;button.setAttribute('aria-pressed',String(flags(product)[index]));buttons.append(button);entries.push({button,candidate,selected:flags(product)[index]});
  });
  if(!entries.length){heading.hidden=true;buttons.hidden=true;}
  const tireHeading=document.createElement('h3');tireHeading.textContent='Tires';section.append(tireHeading);
  const tireButtons=document.createElement('div');tireButtons.className='wep-factory-buttons';tireButtons.setAttribute('role','group');tireButtons.setAttribute('aria-label','Tire options');section.append(tireButtons);
  const offered=[...new Set(choices.map(tire).filter(Boolean))];
  for(const value of offered.sort((a,b)=>tires.findIndex(x=>x[0]===a)-tires.findIndex(x=>x[0]===b))){
   const button=document.createElement('button'),candidate=tireCandidate(choices,product,value),label=tires.find(row=>row[0]===value)?.[1]||value;button.type='button';button.textContent=label;button.dataset.factoryTire=value;button.setAttribute('aria-label',label+' tires'+(label!==value?' ('+value+')':''));button.setAttribute('aria-pressed',String(tire(product)===value));tireButtons.append(button);entries.push({button,candidate,selected:tire(product)===value,tire:true});
  }
  tireHeading.hidden=tireButtons.hidden=!offered.length;
  const status=document.createElement('p');status.className='wep-factory-status';status.setAttribute('role','status');section.append(status);
  const notice=document.createElement('p');notice.className='wep-factory-notice';notice.setAttribute('role','status');notice.hidden=true;section.append(notice);
  const stock=document.querySelector('.hero .wep-build-stock'),anchor=document.querySelector('.hero .stock-details');if(stock)stock.prepend(section);else if(anchor)anchor.before(section);else return;
  window.WEPBuildConfiguration?.layout(section);
  let changing=false;
  function refresh(){
   if(!section.isConnected){observer.disconnect();return;}
   const state=window.WEPBuildConfiguration?.status()||{ready:false};
   const message=changing?'Loading your new configuration…':!state.ready?'Checking availability before changing configuration…':state.stocked?'Factory options and tires are fixed on this in-stock unit. Select Order Unit in Availability to change them.':'';
   if(status.textContent!==message)status.textContent=message;status.hidden=!message;
   for(const {button,candidate,selected,tire:isTire} of entries){
    button.disabled=changing||!state.ready||state.stocked||!candidate||isTire&&selected;
    button.title=state.stocked?'Select Order Unit to change configuration':!candidate?'This combination is not listed':(selected&&!isTire?'Remove ':'Select ')+button.textContent;
   }
  }
  for(const entry of entries)entry.button.onclick=()=>{
   if(entry.button.disabled||changing)return;
   try{changing=true;refresh();onChange(entry.candidate);}catch(error){changing=false;notice.hidden=false;notice.textContent=error.message;refresh();}
  };
  const observer=new MutationObserver(refresh);observer.observe(document.getElementById('app'),{childList:true,subtree:true});
  document.getElementById('app').addEventListener('change',()=>queueMicrotask(refresh));
  refresh();return section;
 }
 return {fields,flags,tire,variants,optionCandidate,tireCandidate,transfer,persist,mount};
});
