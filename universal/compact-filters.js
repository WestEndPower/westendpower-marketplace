/* One two-row filter control for every filtered shopping page. */
(() => {
 'use strict';
 const clean=v=>String(v??'').trim(),esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const unique=values=>[...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 function deckValue(row){
  if(clean(row.CuttingWidth))return clean(row.CuttingWidth);
  for(const [field,value] of Object.entries(row))if(/^[BF]\d+-(?:cutting width|deck size|deck width|mower deck)$/i.test(field)&&clean(value))return clean(value);
  for(let i=1;i<=10;i++)if(/^(?:cutting width|deck size|deck width|mower deck)$/i.test(clean(row['SpecLabel'+i])))return clean(row['SpecValue'+i]);
  return '';
 }
 const groups=[['series','Series','seriesFilter','ignoreSeries',r=>clean(r.Series)],['use','Use','use','ignoreUse',r=>clean(r.Use)],['deck','Deck Size','deck','ignoreDeck',deckValue],['power','Power Type','power','ignorePower',r=>clean(r.PowerType)]];
 let open='',current;
 function markup({rows,state,matches}){
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
   choices='<div class="wep-filter-options" role="group" aria-label="'+esc(label)+' options"><button type="button" class="market-chip'+(!state[key]?' active':'')+'" data-compact-choice="'+id+'" data-value="">All '+esc(({series:'Series',use:'Uses',deck:'Deck Sizes',power:'Power Types'})[id])+'</button>'+all.map(v=>'<button type="button" class="market-chip'+(state[key]===v?' active':'')+'" data-compact-choice="'+id+'" data-value="'+esc(v)+'"'+(!available.has(v)&&state[key]!==v?' disabled':'')+'>'+esc(v)+'</button>').join('')+'</div>';
  }
  return '<div class="wep-filter-top" aria-label="Equipment filters">'+uses+top.join('')+'</div>'+choices;
 }
 function render(context){current=context;const html=markup(context);for(const host of context.hosts.filter(Boolean))host.innerHTML=html;}
 document.addEventListener('change',event=>{
  if(!current||!event.target.matches?.('[data-brand]')||!document.querySelector('#market-refine.wep-compact-active'))return;
  // Run after the shopping handler has applied the customer's brand selection.
  queueMicrotask(()=>{if(current)render(current);});
 });
 document.addEventListener('click',event=>{
  const group=event.target.closest('[data-compact-group]'),choice=event.target.closest('[data-compact-choice]');
  if(!current||(!group&&!choice)||!current.hosts.some(host=>host?.contains(group||choice)))return;
  event.preventDefault();
  if(group){open=open===group.dataset.compactGroup?'':group.dataset.compactGroup;render(current);return;}
  const selected=groups.find(g=>g[0]===choice.dataset.compactChoice);if(!selected)return;
  const value=choice.dataset.value||'',key=selected[2];current.state[key]=current.state[key]===value?'':value;
  current.changed();
 });
 window.WEPCompactFilters={render,markup,deckValue,reset(){open='';}};
})();
