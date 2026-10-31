/* Promotion discovery only. Checkout continues to validate dates, prices and eligibility. */
(function(root){
 'use strict';
 const clean=v=>String(v??'').trim();
 const yes=v=>/^(T|TRUE|Y|YES|1)$/i.test(clean(v));
 const number=v=>{const s=clean(v).replace(/[$,% ,]/g,'');return s!==''&&Number.isFinite(Number(s))?Number(s):NaN;};
 const key=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
 const views={current:'Current',expiring:'Expiring Soon',coming:'Coming Soon',responders:'1st Responder',fleet:'Fleet Programs'};
 const messages={responders:'Available to Military, Firefighters, Police Officers and EMT.',fleet:'For-profit landscape contractors only.'};
 const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}),offerCache=new WeakMap();
 function today(now=new Date()){
  const parts=dayFormatter.formatToParts(now);
  const get=t=>parts.find(p=>p.type===t).value;
  return get('year')+'-'+get('month')+'-'+get('day');
 }
 function date(raw){
  const s=clean(raw);if(!s||s==='0')return '';
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  return d.toISOString().slice(0,10)===s?s:null;
 }
 function period(start,end,day=today()){
  const a=date(start),b=date(end);
  if(a===null||b===null||(a&&b&&b<a))return 'invalid';
  if(b&&b<day)return 'expired';
  if(a&&a>day)return 'coming';
  return 'current';
 }
 function groups(row){
  const brand=key(row.BrandID||row.BrandName),values=[row.Category,row.SubCategory,row.Series,row.Model];
  const result=new Set(['Group_ALL_'+brand]);
  for(const v of values){if(clean(v)){result.add('Group_'+clean(v));result.add('Group_'+key(v));}}
  for(const v of [key(row.Series),key(row.Model)]){
   for(const prefix of ['RZ1','RZ2','RZ5','RZ7','RZ752','RZ9','AZA','RZA','RMA','RM'])if(v.startsWith(prefix))result.add('Group_'+({RZ1:'RZ100',RZ2:'RZ200',RZ5:'RZ500',RZ7:'RZ700',RZ9:'RZ900'}[prefix]||prefix));
   if(/^FSA120/.test(v))result.add('FSA 120');
  }
  if(values.some(v=>/ZERO[- ]?TURN/i.test(clean(v)))||[key(row.Model),key(row.Series)].some(v=>/^RZ\d|^AZA|^RZA/.test(v)))result.add('Group_ALL_ZTR');
  return result;
 }
 function financeMatches(row,program){
  if(!yes(row.FinancingEligible)||!yes(program.Active)||!yes(program.Public)||!yes(program.Display))return false;
  if(number(program.APR)!==0||!(number(program.TermMonths)>0))return false;
  if(clean(program.BrandID)&&key(program.BrandID)!==key(row.BrandID||row.BrandName))return false;
  const sku=key(row.SKU),direct=Object.entries(program).find(([name])=>!/^Group_/i.test(name)&&key(name)===sku);
  // An explicit SKU flag overrides the broader group flag, including an explicit F.
  if(direct&&clean(direct[1]))return yes(direct[1]);
  return [...groups(row)].some(g=>yes(program[g]));
 }
 function offers(row,programs=[],day=today()){
  if(!row||!yes(row.Active))return [];
  const cached=offerCache.get(row);if(cached&&cached.programs===programs&&cached.day===day)return cached.offers;
  const result=[],msrp=number(row.MSRP),sale=number(row.SalePrice),rebate=number(row.RebateToCustomer);
  const add=(type,start,end,extra)=>{const status=period(start,end,day);if(status==='current'||status==='coming')result.push({type,status,start:date(start)||'',end:date(end)||'',...extra});};
  // Undated MAP fallback is normal pricing, not a timed sale promotion.
  if(sale>0&&msrp>sale&&(date(row.SaleStartDate)||date(row.SaleEndDate)))add('sale',row.SaleStartDate,row.SaleEndDate,{amount:sale});
  if(rebate>0&&rebate<msrp&&clean(row.RebateEligible).toUpperCase()!=='F')add('rebate',row.RebateStartDate,row.RebateEndDate,{amount:rebate});
  for(const p of programs)if(financeMatches(row,p))add('finance',p.StartDate,p.EndDate,{months:number(p.TermMonths),program:p});
  offerCache.set(row,{programs,day,offers:result});return result;
 }
 function selectedOffers(row,view,programs=[],day=today()){
  return offers(row,programs,day).filter(o=>view==='coming'?o.status==='coming':o.status==='current'&&(view!=='expiring'||Boolean(o.end&&o.end.slice(0,7)===day.slice(0,7))));
 }
 function matches(row,view='current',programs=[],day=today()){
  if(!row||!yes(row.Active))return false;
  if(view==='responders')return yes(row.PromotionFirstResponders)||number(row.FirstRespondersDiscount)>0;
  if(view==='fleet')return yes(row.PromotionFleet)||(yes(row.FleetEligible)&&[1,2,3].some(t=>number(row['FleetTier'+t+'Discount'])>0));
  return selectedOffers(row,view,programs,day).length>0;
 }
 function confirmEligibility(view){
  if(!messages[view])return Promise.resolve(true);
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='wep-promo-dialog';
   const title=document.createElement('h2');title.textContent=views[view];
   const message=document.createElement('p');message.textContent=messages[view];
   const note=document.createElement('p');note.textContent='See store for details. Selecting a program does not confirm customer eligibility.';
   const actions=document.createElement('div'),cancel=document.createElement('button'),ok=document.createElement('button');
   cancel.type=ok.type='button';cancel.textContent='Cancel';ok.textContent='View eligible equipment';
   let accepted=false;cancel.onclick=()=>dialog.close();ok.onclick=()=>{accepted=true;dialog.close();};actions.append(cancel,ok);dialog.append(title,message,note,actions);document.body.append(dialog);
   dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted);},{once:true});dialog.showModal();
  });
 }
 function renderControls(host,view,onChange){
  host.replaceChildren();host.className='wep-promo-controls';
  const heading=document.createElement('h1');heading.textContent='Promotions';
  const buttons=document.createElement('div');buttons.className='wep-promo-buttons';buttons.setAttribute('role','group');buttons.setAttribute('aria-label','Promotion type');
  for(const [value,label] of Object.entries(views)){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.promotionView=value;button.setAttribute('aria-pressed',String(value===view));
   button.onclick=async()=>{if(value!==view&&await confirmEligibility(value))onChange(value);};buttons.append(button);
  }
  const note=document.createElement('p');note.className='wep-promo-note';
  note.textContent=view==='coming'?'Preview upcoming offers. Current prices apply until the offer starts.':messages[view]?messages[view]+' See store for details.':view==='expiring'?'Explore offers ending this month.':'Explore sale prices, customer rebates and 0% financing offers.';
  host.append(heading,buttons,note);
 }
 function offerLabels(row,view,programs,day=today()){
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
  const format=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
  const selected=selectedOffers(row,view,programs,day),finance=selected.filter(o=>o.type==='finance').sort((a,b)=>b.months-a.months)[0];
  return [...new Set(selected.filter(o=>o.type!=='finance'||o===finance).map(o=>(o.type==='sale'?'Sale price '+money(o.amount):o.type==='rebate'?money(o.amount)+' customer rebate':'0% financing up to '+o.months+' months')+(o.status==='coming'?' · Starts '+format(o.start):'')+(o.end?' · Ends '+format(o.end):'')))];
 }
 async function loadProgramCatalog(products){
  const response=await fetch(root.WESTEND_PROMOTION_PROGRAMS_URL||'https://westendpower-configurator-api.westendpower-nm.workers.dev/marketplace-promotion-programs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandId:'TORO'}),cache:'no-store'});
  if(!response.ok)throw Error('Program availability is temporarily unavailable.');
  const data=await response.json();if(data.ok!==true||data.brandId!=='TORO'||!Array.isArray(data.items)||data.items.some(item=>!clean(item.sku)||typeof item.responders!=='boolean'||typeof item.fleet!=='boolean'))throw Error('Invalid program availability.');
  const bySKU=new Map(data.items.map(item=>[key(item.sku),item]));
  for(const row of products)if(key(row.BrandID||row.BrandName)==='TORO'){const flags=bySKU.get(key(row.SKU));row.PromotionFirstResponders=flags?.responders?'T':'F';row.PromotionFleet=flags?.fleet?'T':'F';}
 }
 const api={views,messages,today,date,period,offers,selectedOffers,matches,financeMatches,confirmEligibility,renderControls,offerLabels,loadProgramCatalog};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.WestEndPromotions=api;
})(typeof window==='undefined'?globalThis:window);
