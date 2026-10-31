(() => {
 'use strict';
 const api=window.WestEndPromotions,host=document.getElementById('promo-categories'),controls=document.getElementById('promo-controls');
 const clean=v=>String(v??'').trim(),yes=v=>/^(T|TRUE|Y|YES|1)$/i.test(clean(v));
 const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const params=new URLSearchParams(location.search);let view=Object.hasOwn(api.views,params.get('promo'))?params.get('promo'):'current',products=[],programs=[],query='',programError=false;
 let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const unpack=table=>(table.rows||[]).map(values=>{const row=Object.fromEntries(table.headers.map(h=>[h,'']));if(table.encoding==='dense')table.headers.forEach((h,i)=>row[h]=values[i]);else for(let i=0;i<values.length;i+=2)row[table.headers[values[i]]]=values[i+1];return row;});
 function csv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}const headers=(rows.shift()||[]).map(v=>v.replace(/^\uFEFF/,'').trim());return rows.filter(r=>r.some(clean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
 }
 async function fetchCSV(path){const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw Error('Unable to load promotion data.');return csv(await r.text());}
 const href=(category,sub='',power='')=>'marketplace.html?'+new URLSearchParams({promo:view,category,...(sub?{subcategory:sub}:{}),...(power?{power}:{}),...(query?{q:query}:{})});
 const unique=values=>[...new Set(values)].filter(Boolean);
 function imageURL(value){if(!clean(value))return '';try{const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
 function draw(){
  api.renderControls(controls,view,next=>{view=next;query='';document.getElementById('market-search').value='';history.pushState({},'',new URL('promotions.html?'+new URLSearchParams({promo:view}),location.href));draw();});
  if(programError&&['responders','fleet'].includes(view)){document.getElementById('promo-category-count').textContent='';host.innerHTML='<div class="promo-empty"><h2>Program availability is temporarily unavailable.</h2><p>Please refresh or see store for details.</p></div>';return;}
  const matching=products.filter(row=>api.matches(row,view,programs)&&(!query||[row.BrandID,row.Description,row.Model,row.Category,row.SubCategory,row.SKU].some(v=>clean(v).toLowerCase().includes(query))));
  const categories=unique(matching.map(row=>clean(row.Category))).filter(c=>!/^batteries|chargers$/i.test(c)).sort((a,b)=>a.localeCompare(b));
  document.getElementById('promo-category-count').textContent=categories.length+' equipment '+(categories.length===1?'category':'categories');
  host.innerHTML=categories.length?categories.map((category,offset)=>{
   const rows=matching.filter(row=>clean(row.Category)===category),subs=unique(rows.map(row=>clean(row.SubCategory))).sort((a,b)=>a.localeCompare(b)),choices=subs.length?subs:[''];
   return '<article class="shop-tile shop-carousel" data-slide="0" data-count="'+choices.length+'" data-offset="'+offset+'" aria-label="'+esc(category)+'"><h2 class="shop-tile-heading"><a class="shop-tile-name" href="'+esc(href(category))+'">'+esc(category)+'</a></h2><div class="shop-carousel-window">'+choices.map((sub,index)=>{
    const items=rows.filter(row=>!sub||clean(row.SubCategory)===sub),image=items.map(row=>imageURL(row.ImageURL)).find(Boolean),order=['Manual','Electric','Battery','Gas','Diesel'];
    const powers=unique(items.map(row=>clean(row.PowerType))).sort((a,b)=>{const rank=v=>{const n=order.findIndex(t=>t.toLowerCase()===v.toLowerCase());return n<0?99:n;};return rank(a)-rank(b)||a.localeCompare(b);});
    return '<div class="shop-slide"'+(index?' hidden':'')+'><div class="shop-subtile"><a class="shop-subimage" href="'+esc(href(category,sub))+'" aria-label="'+esc('View '+(sub?sub+' ':'')+category)+'">'+(image?'<img src="'+esc(image)+'" alt="" loading="lazy">':'<span>View equipment</span>')+'</a><a class="shop-sublabel" href="'+esc(href(category,sub))+'">'+esc(sub||'View All')+'</a></div><div class="shop-product-powers">'+powers.map(power=>'<a href="'+esc(href(category,sub,power))+'">'+esc(power)+'</a>').join('')+'</div></div>';
   }).join('')+'</div><div class="shop-carousel-controls"><button type="button" data-slide-direction="-1" aria-label="'+esc('Previous '+category+' type')+'">‹</button><span class="shop-slide-position">1 / '+choices.length+'</span><button type="button" data-slide-direction="1" aria-label="'+esc('Next '+category+' type')+'">›</button></div></article>';
  }).join(''):'<div class="promo-empty"><h2>No matching promotions right now.</h2><p>Choose another promotion type or check back soon.</p></div>';
  host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const message=document.createElement('span');message.textContent='View equipment';img.replaceWith(message);},{once:true}));
 }
 function advance(box,step){const slides=[...box.querySelectorAll('.shop-slide')];if(slides.length<2)return;const index=(Number(box.dataset.slide)+step+slides.length)%slides.length;slides.forEach((slide,i)=>slide.hidden=i!==index);box.dataset.slide=String(index);box.querySelector('.shop-slide-position').textContent=(index+1)+' / '+slides.length;}
 host.addEventListener('click',e=>{const arrow=e.target.closest('[data-slide-direction]');if(arrow){const box=arrow.closest('.shop-carousel');box.dataset.manualUntil=String(Date.now()+12000);advance(box,Number(arrow.dataset.slideDirection));}});
 const pause=document.getElementById('shop-carousel-pause');function updatePause(){pause.textContent=paused?'Resume rotation':'Pause rotation';pause.setAttribute('aria-pressed',String(paused));}updatePause();pause.onclick=()=>{paused=!paused;updatePause();};
 let tick=0;setInterval(()=>{if(paused||document.hidden)return;tick++;host.querySelectorAll('.shop-carousel').forEach(box=>{if(!box.matches(':hover')&&!box.contains(document.activeElement)&&Date.now()>=Number(box.dataset.manualUntil||0)&&(tick+Number(box.dataset.offset))%5===0)advance(box,1);});},1000);
 document.getElementById('market-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();draw();});document.getElementById('market-clear').onclick=()=>{query='';document.getElementById('market-search').value='';draw();};
 window.addEventListener('popstate',()=>{const value=new URLSearchParams(location.search).get('promo');view=Object.hasOwn(api.views,value)?value:'current';draw();});
 async function init(){
  try{
   try{const response=await fetch('data/marketplace-catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('Catalog unavailable');const bundle=await response.json();if(bundle.schema!==1||!bundle.financeSources?.length)throw Error('Catalog requires finance sources');products=bundle.productSources.flatMap(unpack);programs=bundle.financeSources.flatMap(source=>unpack(source).map(row=>({...row,BrandID:source.brand})));}
   catch{const brands=Object.keys(window.WESTEND_BRANDS||{});const sources=await Promise.all(brands.map(async brand=>({brand,products:await fetchCSV('brands/'+brand.toLowerCase()+'/data/products.csv'),finance:await fetchCSV('brands/'+brand.toLowerCase()+'/data/finance-programs.csv')})));products=sources.flatMap(s=>s.products);programs=sources.flatMap(s=>s.finance.map(row=>({...row,BrandID:s.brand})));}
   window.WESTEND_PUBLISHED_BRANDS=unique(products.filter(row=>yes(row.Active)).map(row=>clean(row.BrandID))).map(id=>({id}));window.dispatchEvent(new Event('westend:catalog-ready'));draw();
   try{await api.loadProgramCatalog(products);programError=false;}catch(error){programError=true;console.warn(error.message);}draw();
   // Keep rollover correct even when this page is left open overnight.
   let day=api.today();setInterval(()=>{const next=api.today();if(next!==day){day=next;draw();}},60000);
  }catch(error){host.innerHTML='<div class="promo-empty"><h2>Promotions are temporarily unavailable.</h2><p>Please refresh or contact the store.</p></div>';console.error(error);}
 }
 init();
})();
