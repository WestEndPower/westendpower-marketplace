/* One two-row filter control for every filtered shopping page. */
(() => {
 'use strict';
 const clean=v=>String(v??'').trim(),esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const unique=values=>[...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 function seriesOrder(rows,values){
  const ranks=new Map(),positions=new Map();
  rows.forEach((row,index)=>{
   const series=clean(row.Series),raw=clean(row.__wepWorkbookSortOrder??row.SortOrder),rank=raw!==''&&Number.isFinite(Number(raw))?Number(raw):Infinity;
   if(!positions.has(series))positions.set(series,index);
   ranks.set(series,Math.min(ranks.get(series)??Infinity,rank));
  });
  return values.sort((a,b)=>((ranks.get(a)??Infinity)-(ranks.get(b)??Infinity))||((positions.get(a)??Infinity)-(positions.get(b)??Infinity))||a.localeCompare(b,undefined,{numeric:true}));
 }
 function deckValue(row){
  if(clean(row.CuttingWidth))return clean(row.CuttingWidth);
  for(const [field,value] of Object.entries(row))if(/^[BF]\d+-(?:cutting width|deck size|deck width|mower deck)$/i.test(field)&&clean(value))return clean(value);
  for(let i=1;i<=10;i++)if(/^(?:cutting width|deck size|deck width|mower deck)$/i.test(clean(row['SpecLabel'+i])))return clean(row['SpecValue'+i]);
  return '';
 }
 const groups=[['series','Series','seriesFilter','ignoreSeries',r=>clean(r.Series)],['use','Use','use','ignoreUse',r=>clean(r.Use)],['deck','Deck Size','deck','ignoreDeck',deckValue],['power','Power Type','power','ignorePower',r=>clean(r.PowerType)]];
 let open='',current,lastPower='';
 function builderGroups(context){
  const {state}=context;
  const list=[['category','Category','category','ignoreCategory',r=>clean(r.Category)],['subcategory','Type','subcategory','ignoreSubcategory',r=>clean(r.SubCategory)],groups[0],['model','Model','modelFilter','ignoreModel',r=>clean(r.Model)],groups[3],groups[1],groups[2]];
  for(const spec of context.specGroups||[])list.push(['spec:'+spec.field,spec.label,'','ignoreField',r=>clean(r[spec.field]),spec.field]);
  if((context.packageGroups||[]).length||state.packageComponents?.size)list.push(['packages','Packages','','ignorePackage',null]);
  if(context.powerContext&&state.seriesOrEngine)list.push(['context',context.powerContext.label,'seriesOrEngine','ignoreContext',r=>clean(r[context.powerContext.field])]);
  return list;
 }
 function builderSelected(group,state){
  if(group[0]==='packages')return [...(state.packageComponents||[])];
  if(group[5])return [...(state.specFilters?.get(group[5])||[])];
  return clean(state[group[2]])?[clean(state[group[2]])]:[];
 }
 function builderOptions(context,group,scope=false){
  const all={ignoreCategory:true,ignoreSubcategory:true,ignoreSeries:true,ignoreModel:true,ignorePower:true,ignoreUse:true,ignoreDeck:true,ignoreContext:true,ignorePackage:true,ignorePromo:true,ignoreSpecifications:true};
  const ignored=scope?all:{[group[3]]:group[5]||true};
  const rows=context.rows.filter(r=>context.matches(r,ignored));
  if(group[0]==='packages')return (context.packageGroups||[]).filter(g=>rows.some(r=>/^(T|TRUE|Y|YES|1)$/i.test(clean(r[g.field])))).map(g=>g.field);
  return unique(rows.map(group[4]));
 }
 function subcategoryButtons(context){
  const group=builderGroups(context).find(g=>g[0]==='subcategory');
  const values=unique([...builderOptions(context,group,true),context.state.subcategory]);
  return values.map(value=>'<button type="button" class="market-chip'+(context.state.subcategory===value?' active':'')+'" data-compact-choice="subcategory" data-value="'+esc(value)+'" aria-pressed="'+(context.state.subcategory===value)+'">'+esc(value)+'</button>').join('');
 }
 function builderMarkup(context){
  const {rows,state}=context;
  const list=builderGroups(context).filter(g=>{
   if(context.categoryLayout&&['category','subcategory','model'].includes(g[0]))return false;
   const values=builderOptions(context,g,true),selected=builderSelected(g,state);
   // Do not add meaningless type/category controls to a page with a single fixed scope.
   if(['category','subcategory'].includes(g[0]))return values.length>1||(!values.length&&selected.length);
   return values.length||selected.length;
  });
  if(!list.some(g=>g[0]===open))open='';
  const top=['<button type="button" class="market-chip'+(!state.seriesFilter&&!state.modelFilter&&(!context.categoryLayout||!state.subcategory)?' active':'')+'" data-compact-action="models">All Models</button>'];
  if(context.categoryLayout)top.push(subcategoryButtons(context));
  if(context.promoAvailable||state.promoOnly)top.push('<button type="button" class="market-chip'+(state.promoOnly?' active':'')+'" data-compact-action="promos" aria-pressed="'+!!state.promoOnly+'">Promos</button>');
  for(const g of list){
   const selected=builderSelected(g,state),suffix=selected.length?(g[5]||g[0]==='packages'?' ('+selected.length+')':': '+selected[0]):'';
   top.push('<button type="button" class="market-chip wep-filter-group'+(open===g[0]?' active':'')+'" data-compact-group="'+esc(g[0])+'" aria-expanded="'+(open===g[0])+'">'+esc(g[1]+suffix)+'</button>');
  }
  const group=list.find(g=>g[0]===open);let choices='';
  if(group){
   const selected=builderSelected(group,state),available=new Set(builderOptions(context,group)),values=unique([...available,...selected]);
   if(group[0]==='series')seriesOrder(rows,values);
   const label=value=>group[0]==='packages'?(context.packageGroups||[]).find(g=>g.field===value)?.label||value:value;
   const button=(value,name,active)=>'<button type="button" class="market-chip'+(active?' active':'')+'" data-compact-choice="'+esc(group[0])+'" data-value="'+esc(value)+'" aria-pressed="'+active+'">'+esc(name)+'</button>';
   choices='<div class="wep-filter-options" role="group" aria-label="'+esc(group[1])+' options">'+button('','All '+(({category:'Categories',subcategory:'Types',series:'Series',model:'Models',power:'Power Types',use:'Uses',deck:'Deck Sizes',packages:'Packages'})[group[0]]||group[1]),!selected.length)+values.map(v=>button(v,label(v),selected.includes(v))).join('')+'</div>';
  }
  return '<div class="wep-filter-top" aria-label="Equipment filters">'+top.join('')+(context.componentControls||'')+'</div>'+choices;
 }
 function markup(context){
  if((context.generated||context.categoryLayout)&&context.state.category!=='Mowers')return builderMarkup(context);
  const {rows,state,matches}=context;
  const scope=rows.filter(r=>matches(r,{ignoreSeries:true,ignoreModel:true,ignoreUse:true,ignoreDeck:true,ignorePower:true}));
  const useValues=unique([...scope.map(r=>r.Use),state.use]);
  const uses=['Residential','Commercial',...useValues.filter(v=>!['Residential','Commercial'].includes(v))].map(v=>'<button type="button" class="market-chip'+(state.use===v?' active':'')+'" data-compact-choice="use" data-value="'+esc(v)+'" aria-pressed="'+(state.use===v)+'">'+esc(v)+'</button>').join('');
  const top=groups.filter(g=>g[0]!=='use').map(([id,label,key])=>{
   return '<button type="button" class="market-chip wep-filter-group'+(open===id?' active':'')+'" data-compact-group="'+id+'" aria-expanded="'+(open===id)+'">'+esc(label)+(state[key]?': '+esc(state[key]):'')+'</button>';
  });
  const selected=groups.find(g=>g[0]===open);
  let choices='';
  if(selected){
   const [id,label,key,ignore,value]=selected,available=new Set(rows.filter(r=>matches(r,{[ignore]:true,ignoreModel:id==='series'})).map(value)),all=unique([...available,state[key]]);
   if(id==='series')seriesOrder(scope,all);
   choices='<div class="wep-filter-options" role="group" aria-label="'+esc(label)+' options"><button type="button" class="market-chip'+(!state[key]?' active':'')+'" data-compact-choice="'+id+'" data-value="">All '+esc(({series:'Series',use:'Uses',deck:'Deck Sizes',power:'Power Types'})[id])+'</button>'+all.map(v=>'<button type="button" class="market-chip'+(state[key]===v?' active':'')+'" data-compact-choice="'+id+'" data-value="'+esc(v)+'"'+(!available.has(v)&&state[key]!==v?' disabled':'')+'>'+esc(v)+'</button>').join('')+'</div>';
  }
  const categoryPrefix=context.categoryLayout?'<button type="button" class="market-chip" data-compact-action="models">All Models</button>'+subcategoryButtons(context):'';
  return '<div class="wep-filter-top" aria-label="Equipment filters">'+categoryPrefix+uses+top.join('')+(context.componentControls||'')+'</div>'+choices;
 }
 function render(context){if((context.generated||context.categoryLayout)&&context.state.power==='Battery'&&lastPower!=='Battery')open='series';lastPower=context.state.power;current=context;const html=markup(context);for(const host of context.hosts.filter(Boolean))host.innerHTML=html;}
 document.addEventListener('change',event=>{
  if(!current||!event.target.matches?.('[data-brand]')||!document.querySelector('#market-refine.wep-compact-active'))return;
  // Run after the shopping handler has applied the customer's brand selection.
  queueMicrotask(()=>{if(current)render(current);});
 });
 document.addEventListener('click',event=>{
  const group=event.target.closest('[data-compact-group]'),choice=event.target.closest('[data-compact-choice]'),action=event.target.closest('[data-compact-action]');
  if(!current||(!group&&!choice&&!action)||!current.hosts.some(host=>host?.contains(group||choice||action)))return;
  event.preventDefault();
  if(action){if(action.dataset.compactAction==='models'){current.state.seriesFilter='';current.state.modelFilter='';if(current.categoryLayout)current.state.subcategory='';open='';}else current.state.promoOnly=!current.state.promoOnly;current.changed(action.dataset.compactAction);return;}
  if(group){open=open===group.dataset.compactGroup?'':group.dataset.compactGroup;render(current);return;}
  if(choice.dataset.compactChoice==='subcategory'){current.state.subcategory=current.state.subcategory===choice.dataset.value?'':choice.dataset.value;current.changed();return;}
  if((current.generated||current.categoryLayout)&&current.state.category!=='Mowers'){
   const selected=builderGroups(current).find(g=>g[0]===choice.dataset.compactChoice);if(!selected)return;
   const value=choice.dataset.value||'';
   if(selected[0]==='packages'){const values=current.state.packageComponents;if(!value)values.clear();else values.has(value)?values.delete(value):values.add(value);}
   else if(selected[5]){const filters=current.state.specFilters;if(!value)filters.delete(selected[5]);else{const values=filters.get(selected[5])||new Set();values.has(value)?values.delete(value):values.add(value);if(values.size)filters.set(selected[5],values);else filters.delete(selected[5]);}}
   else current.state[selected[2]]=current.state[selected[2]]===value?'':value;
   if(selected[0]==='power'&&current.state.power==='Battery')open='series';
   current.changed();return;
  }
  const selected=groups.find(g=>g[0]===choice.dataset.compactChoice);if(!selected)return;
  const value=choice.dataset.value||'',key=selected[2];current.state[key]=current.state[key]===value?'':value;
  current.changed();
 });
 window.WEPCompactFilters={render,markup,deckValue,reset(){open='';}};
})();
