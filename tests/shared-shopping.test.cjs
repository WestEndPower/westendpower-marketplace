const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function compact(){const listeners={},window={},document={addEventListener:(event,fn)=>listeners[event]=fn,querySelector:()=>true};vm.runInNewContext(fs.readFileSync('universal/compact-filters.js','utf8'),{window,document,queueMicrotask});return {api:window.WEPCompactFilters,listeners};}
test('compact groups replace the second row without dropping selected Series, Use, deck or power',()=>{
 const {api,listeners}=compact(),state={seriesFilter:'TimeCutter',use:'Residential',deck:'42',power:'Gas'},host={innerHTML:'',contains:()=>true};
 const rows=[{Series:'TimeCutter',Use:'Residential',CuttingWidth:'42',PowerType:'Gas'},{Series:'TITAN',Use:'Residential',CuttingWidth:'48',PowerType:'Gas'}];
 const context={rows,state,hosts:[host],matches:()=>true,changed:()=>api.render(context)};api.render(context);
 const click=(dataset)=>listeners.click({target:{closest:selector=>selector==='[data-compact-group]'&&dataset.compactGroup?{dataset}:selector==='[data-compact-choice]'&&dataset.compactChoice?{dataset}:null},preventDefault(){}});
 click({compactGroup:'series'});assert.match(host.innerHTML,/aria-label="Series options"/);
 click({compactGroup:'deck'});assert.doesNotMatch(host.innerHTML,/aria-label="Series options"/);assert.match(host.innerHTML,/aria-label="Deck Size options"/);
 click({compactChoice:'deck',value:'48'});assert.equal(state.deck,'48');assert.equal(state.seriesFilter,'TimeCutter');assert.equal(state.use,'Residential');assert.equal(state.power,'Gas');
 click({compactGroup:'deck'});assert.doesNotMatch(host.innerHTML,/wep-filter-options/);
 assert.equal(api.deckValue({'SpecLabel4':'Mower Deck',SpecValue4:'42" Stamped'}),'42" Stamped');
});
test('compact options hide incompatible choices while keeping selected values available to clear',()=>{
 const {api,listeners}=compact(),state={use:'Residential',power:'Gas'},host={innerHTML:'',contains:()=>true};
 const rows=[{Use:'Residential',PowerType:'Gas'},{Use:'Commercial',PowerType:'Battery'},{Use:'Commercial',PowerType:'Diesel'}];
 const context={rows,state,hosts:[host],matches:(r,o)=>
  (o.ignoreUse||!state.use||r.Use===state.use)&&(o.ignorePower||!state.power||r.PowerType===state.power),changed:()=>api.render(context)};
 api.render(context);
 listeners.click({target:{closest:selector=>selector==='[data-compact-group]'?{dataset:{compactGroup:'power'}}:null},preventDefault(){}});
 assert.match(host.innerHTML,/data-value="Gas"/);
 assert.doesNotMatch(host.innerHTML,/data-value="(?:Battery|Diesel)"/);
 state.use='Commercial';api.render(context);
 assert.match(host.innerHTML,/data-value="Battery"/);assert.match(host.innerHTML,/data-value="Diesel"/);
 assert.match(host.innerHTML,/data-value="Gas"/);assert.equal(state.power,'Gas');
});
test('all five top controls remain visible even without matches while retaining selections',()=>{
 const {api,listeners}=compact(),state={use:'Residential',seriesFilter:'TimeCutter',deck:'42',power:'Gas'},host={innerHTML:'',contains:()=>true};
 const rows=[{Use:'Residential',Series:'TimeCutter',CuttingWidth:'42',PowerType:'Gas'},{Use:'Commercial',Series:'TimeCutter',CuttingWidth:'42',PowerType:'Gas'}];
 const context={rows,state,hosts:[host],matches:(r,o)=>(o.ignoreUse||!state.use||r.Use===state.use),changed:()=>api.render(context)};api.render(context);
 assert.ok(host.innerHTML.indexOf('>Residential</button>')<host.innerHTML.indexOf('>Commercial</button>'));
 assert.ok(host.innerHTML.indexOf('>Commercial</button>')<host.innerHTML.indexOf('data-compact-group="series"'));
 assert.match(host.innerHTML,/Power Type/);assert.doesNotMatch(host.innerHTML,/data-compact-group="use"/);
 const click=dataset=>listeners.click({target:{closest:s=>s==='[data-compact-group]'&&dataset.compactGroup?{dataset}:s==='[data-compact-choice]'&&dataset.compactChoice?{dataset}:null},preventDefault(){}});
 click({compactGroup:'series'});click({compactChoice:'use',value:'Commercial'});
 assert.equal(state.use,'Commercial');assert.equal(state.seriesFilter,'TimeCutter');assert.equal(state.deck,'42');assert.equal(state.power,'Gas');assert.match(host.innerHTML,/Series options/);
 click({compactChoice:'use',value:'Commercial'});assert.equal(state.use,'');assert.match(host.innerHTML,/>Residential<\/button>/);assert.match(host.innerHTML,/>Commercial<\/button>/);
 state.seriesFilter='';state.deck='';state.power='';context.rows=[{Use:'Residential'}];api.render(context);
 assert.match(host.innerHTML,/>Commercial<\/button>/);
 context.rows=[];api.render(context);
 assert.match(host.innerHTML,/>Residential<\/button>/);assert.match(host.innerHTML,/>Commercial<\/button>/);
 for(const id of ['series','deck','power'])assert.match(host.innerHTML,new RegExp('data-compact-group="'+id+'"'));
 click({compactGroup:'power'});assert.match(host.innerHTML,/All Power Types/);assert.doesNotMatch(host.innerHTML,/data-value="(?:Battery|Diesel|Gas)"/);
});
test('Series follows the earliest workbook SortOrder per series including generated-page rows',()=>{
 const {api,listeners}=compact(),host={innerHTML:'',contains:()=>true};
 const rows=[{Series:'2000 Series',SortOrder:'1',__wepWorkbookSortOrder:'326'},{Series:'TimeCutter',SortOrder:'99',__wepWorkbookSortOrder:'203'},{Series:'TimeCutter',SortOrder:'100',__wepWorkbookSortOrder:'199'},{Series:'TITAN',SortOrder:'2',__wepWorkbookSortOrder:'222'},{Series:'TimeCutter Max',SortOrder:'3',__wepWorkbookSortOrder:'209'},{Series:'Unranked',SortOrder:''}];
 api.render({rows,state:{},hosts:[host],matches:()=>true,changed(){}});
 listeners.click({target:{closest:s=>s==='[data-compact-group]'?{dataset:{compactGroup:'series'}}:null},preventDefault(){}});
 const ordered=[...host.innerHTML.matchAll(/data-compact-choice="series" data-value="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ordered,['TimeCutter','TimeCutter Max','TITAN','2000 Series','Unranked']);
});
test('brand changes refresh the open filter choices after the shopping handler updates state',async()=>{
 const {api,listeners}=compact(),state={brand:'TORO'},host={innerHTML:'',contains:()=>true};
 const context={rows:[{BrandID:'TORO',Series:'TimeCutter'},{BrandID:'STIHL',Series:'RZ'}],state,hosts:[host],matches:r=>r.BrandID===state.brand,changed(){}};api.render(context);
 listeners.click({target:{closest:s=>s==='[data-compact-group]'?{dataset:{compactGroup:'series'}}:null},preventDefault(){}});
 assert.match(host.innerHTML,/data-value="TimeCutter"/);
 listeners.change({target:{matches:()=>true}});state.brand='STIHL';await Promise.resolve();
 assert.match(host.innerHTML,/data-value="RZ"/);assert.doesNotMatch(host.innerHTML,/data-value="TimeCutter"/);
});
test('generated pages scope by brand and SKU, retain saved order, and preserve sale-date projections in preview',()=>{
 const window={},data={preview:true,query:'brand=TORO&use=Residential',products:[{brand:'TORO',sku:'B',stock:1,discontinued:true,msrp:1000,price:900,saleActive:true,rebate:50},{brand:'TORO',sku:'A',msrp:2000,price:2000,rebate:0}]};
 vm.runInNewContext(fs.readFileSync('universal/generated-catalog.js','utf8'),{window,URLSearchParams,document:{getElementById:()=>({textContent:JSON.stringify(data)})}});
 const rows=window.WEPGeneratedCatalog.products([{BrandID:'TORO',SKU:'A'},{BrandID:'OTHER',SKU:'B'},{BrandID:'TORO',SKU:'B',SortOrder:'326'},{BrandID:'TORO',SKU:'EXCLUDED'}]);
 assert.equal(rows[0].__wepWorkbookSortOrder,'326');
 assert.equal(rows.length,2);assert.equal(rows[0].SKU,'B');assert.equal(rows[0].Active,'T');assert.equal(rows[0].SellRemainingStockOnly,'T');assert.equal(rows[0].SalePrice,'900');assert.equal(rows[0].RebateToCustomer,'50');assert.equal(rows[0].SaleStartDate,'');
 const p=window.WEPGeneratedCatalog.params('?use=Commercial&spec.B1-Engine=X&spec.B1-Engine=Y');assert.equal(p.get('brand'),'TORO');assert.equal(p.get('use'),'Commercial');assert.equal(p.getAll('spec.B1-Engine').length,2);
});
test('preview filtering and Clear retain the saved page slug and selected preview date across reloads',()=>{
 const window={location:{search:'?slug=toro-zero-turns-residential&date=2026-12-01'}},data={preview:true,query:'brand=TORO&category=Mowers&use=Residential',products:[]};
 vm.runInNewContext(fs.readFileSync('universal/generated-catalog.js','utf8'),{window,URLSearchParams,document:{getElementById:()=>({textContent:JSON.stringify(data)})}});
 const api=window.WEPGeneratedCatalog,query=api.preserveContext(new URLSearchParams('brand=TORO&deck=42'));
 assert.equal(query.get('slug'),'toro-zero-turns-residential');assert.equal(query.get('date'),'2026-12-01');assert.equal(query.get('deck'),'42');
 assert.equal(query.get('use'),'');assert.equal(api.params('?'+query).get('use'),'');
 const allBrands=api.preserveContext(new URLSearchParams('use=Commercial'));assert.equal(allBrands.get('brand'),'');assert.equal(api.params('?'+allBrands).get('brand'),'');
 const cleared=new URL(api.resetURL('/webpage-builder/preview'),'https://dealer.test');
 assert.equal(cleared.searchParams.get('slug'),'toro-zero-turns-residential');assert.equal(cleared.searchParams.get('date'),'2026-12-01');assert.equal(cleared.searchParams.has('deck'),false);
 assert.equal(api.params(cleared.search).get('use'),'Residential');
 for(const path of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
  const source=fs.readFileSync(path,'utf8');assert.match(source,/WEPGeneratedCatalog\?\.preserveContext\(params\)/);assert.match(source,/WEPGeneratedCatalog.resetURL\(location.pathname\)/);
 }
});
function handoff(origin,cart=[],hash='',baseURI=origin+'/'){
 const window={},storage=new Map([['wepCart',JSON.stringify(cart)]]),location={origin,hash,pathname:'/pages/test',search:''},history={replaceState(_a,_b,url){const resolved=new URL(url,baseURI);if(resolved.origin!==origin)throw new Error('SecurityError: cross-origin history URL');this.url=resolved.href;}},document={baseURI,addEventListener(){}};
 const sandbox={window,document,location,history,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,console,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),unescape,escape,encodeURIComponent,decodeURIComponent};
 vm.runInNewContext(fs.readFileSync('universal/cart-handoff.js','utf8'),sandbox);return {api:window.WEPCartHandoff,storage,history};
}
test('cart handoff preserves exact quantities and kit pricing, excludes customer fields and removes the fragment',()=>{
 const source=handoff('https://westendpower.github.io',[{sku:'KIT',brandId:'STIHL',quantity:2,customerEmail:'PRIVATE',itemPrice:500,kitComponents:[{sku:'TOOL',quantity:2,itemTotal:600,regularUnitPrice:350,locked:true,parentSku:'KIT',customerName:'PRIVATE'}]}]);
 const target=new URL(source.api.url('https://westendpower-configurator-api.westendpower-nm.workers.dev/pages/stihl'));
 const received=handoff(target.origin,[],target.hash),cart=JSON.parse(received.storage.get('wepCart'));assert.equal(cart[0].quantity,2);assert.equal(cart[0].kitComponents[0].itemTotal,600);assert.equal(cart[0].kitComponents[0].regularUnitPrice,350);assert.equal(cart[0].kitComponents[0].locked,true);
 assert.doesNotMatch(received.storage.get('wepCart'),/PRIVATE|customer/);assert.equal(received.history.url,target.origin+'/pages/test');
 const anchored=new URL(source.api.url('https://westendpower-configurator-api.westendpower-nm.workers.dev/pages/stihl#wep-itemized-quote'));assert.equal(handoff(anchored.origin,[],anchored.hash).history.url,anchored.origin+'/pages/test#wep-itemized-quote');
 assert.equal(source.api.url('https://unrelated.example/cart.html'),'https://unrelated.example/cart.html');
 const empty=handoff('https://westendpower.github.io',[]);assert.match(empty.api.url(target.origin+'/pages/test'),/wep-cart=/);
});
test('direct builder visits preserve an existing Marketplace basket and additions apply once across repeated links',()=>{
 const market='https://westendpower.github.io',pages='https://westendpower-configurator-api.westendpower-nm.workers.dev';
 const builder=handoff(pages,[]);builder.storage.set('wepCart',JSON.stringify([{brandId:'TORO',sku:'MOWER',quantity:2,itemPrice:1000}]));builder.api.changed();
 const first=new URL(builder.api.url(market+'/westendpower-marketplace/cart.html'));
 const destination=handoff(market,[{brandId:'TORO',sku:'MOWER',quantity:8,itemPrice:1000},{sku:'OTHER',quantity:1,itemPrice:50}],first.hash);
 let cart=JSON.parse(destination.storage.get('wepCart'));assert.equal(cart.find(r=>r.sku==='MOWER').quantity,10);assert.equal(cart.find(r=>r.sku==='OTHER').quantity,1);
 // Simulate the same URL opening again with the receiver's receipt storage intact.
 const window={},history={},document={baseURI:market+'/',addEventListener(){}},storage=destination.storage;
 const sandbox={window,document,location:{origin:market,pathname:'/cart.html',search:'',hash:first.hash},history:{replaceState(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,console,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),unescape,escape,encodeURIComponent,decodeURIComponent};
 vm.runInNewContext(fs.readFileSync('universal/cart-handoff.js','utf8'),sandbox);cart=JSON.parse(storage.get('wepCart'));assert.equal(cart.find(r=>r.sku==='MOWER').quantity,10);
 const empty=handoff(pages,[]),noAdds=new URL(empty.api.url(market+'/westendpower-marketplace/cart.html'));const kept=handoff(market,cart,noAdds.hash);assert.equal(JSON.parse(kept.storage.get('wepCart')).length,2);
});

test('generated page cart cleanup stays on its own origin with a Marketplace base URI',()=>{
 const pages='https://westendpower-configurator-api.westendpower-nm.workers.dev',market='https://westendpower.github.io/westendpower-marketplace/';
 const source=handoff('https://westendpower.github.io',[{brandId:'STIHL',sku:'4283 011 1610 US',quantity:1}]);
 const target=new URL(source.api.url(pages+'/pages/stihl-backpack#equipment'));
 const received=handoff(pages,[],target.hash,market);
 assert.ok(received.api,'initialization reaches the cart API export');
 assert.equal(received.history.url,pages+'/pages/test#equipment');
 assert.equal(JSON.parse(received.storage.get('wepCart'))[0].sku,'4283 011 1610 US');
 const search=source.api.url(pages+'/pages/stihl-backpack');
 assert.equal(handoff(pages,[],new URL(search).hash,market).history.url,pages+'/pages/test');
});

function builderCompact(){
 const {api,listeners}=compact(),state={category:'Blowers',subcategory:'Backpack',seriesFilter:'',modelFilter:'',power:'',use:'',deck:'',specFilters:new Map(),packageComponents:new Set(),promoOnly:false},host={innerHTML:'',contains:()=>true};
 const rows=[{Category:'Blowers',SubCategory:'Backpack',Series:'BR',Model:'BR600',PowerType:'Gas',SortOrder:'5','B1-Engine':'2-MIX','P1-Kit':'T'},{Category:'Blowers',SubCategory:'Backpack',Series:'BR',Model:'BR800',PowerType:'Gas',SortOrder:'6','B1-Engine':'4-MIX'},{Category:'Blowers',SubCategory:'Backpack',Series:'AP',Model:'BGA300',PowerType:'Battery',SortOrder:'2','B1-Engine':'Electric'}];
 const matches=(r,o)=>[['category','Category','ignoreCategory'],['subcategory','SubCategory','ignoreSubcategory'],['seriesFilter','Series','ignoreSeries'],['modelFilter','Model','ignoreModel'],['power','PowerType','ignorePower'],['use','Use','ignoreUse']].every(([key,field,ignore])=>o[ignore]||!state[key]||r[field]===state[key])&&[...state.specFilters].every(([field,values])=>o.ignoreSpecifications||o.ignoreField===field||values.has(r[field]))&&(o.ignorePackage||[...state.packageComponents].every(field=>r[field]==='T'));
 const context={generated:true,rows,state,hosts:[host],matches,specGroups:[{field:'B1-Engine',label:'Engine'}],packageGroups:[{field:'P1-Kit',label:'Kit'}],promoAvailable:true,changed(){api.render(context);}};
 api.render(context);
 const click=dataset=>listeners.click({target:{closest:s=>s==='[data-compact-group]'&&dataset.compactGroup?{dataset}:s==='[data-compact-choice]'&&dataset.compactChoice?{dataset}:s==='[data-compact-action]'&&dataset.compactAction?{dataset}:null},preventDefault(){}});
 return {api,state,host,context,click};
}
test('builder backpack pages list actual subcategories, Power Type then Series, without Type or Model controls',()=>{
 const b=builderCompact();assert.match(b.host.innerHTML,/data-compact-choice="subcategory" data-value="Backpack"/);assert.doesNotMatch(b.host.innerHTML,/data-compact-group="(?:model|subcategory)"/);
 assert.ok(b.host.innerHTML.indexOf('data-compact-group="power"')<b.host.innerHTML.indexOf('data-compact-group="series"'));
 b.click({compactGroup:'series'});assert.match(b.host.innerHTML,/Series options/);
 const choices=[...b.host.innerHTML.matchAll(/data-compact-choice="series" data-value="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(choices,['AP','BR']);
 b.click({compactChoice:'series',value:'BR'});b.click({compactGroup:'power'});assert.equal(b.state.seriesFilter,'BR');assert.match(b.host.innerHTML,/Power Type options/);assert.doesNotMatch(b.host.innerHTML,/Series options|data-value="Battery"/);
});
test('builder workbook specification and package choices remain usable and retain other selections',()=>{
 const b=builderCompact();b.state.power='Gas';b.api.render(b.context);
 b.click({compactGroup:'spec:B1-Engine'});assert.match(b.host.innerHTML,/All Engine/);assert.doesNotMatch(b.host.innerHTML,/All undefined/);
 b.click({compactChoice:'spec:B1-Engine',value:'2-MIX'});b.click({compactChoice:'spec:B1-Engine',value:'4-MIX'});assert.equal(b.state.specFilters.get('B1-Engine').size,2);
 b.click({compactGroup:'packages'});assert.doesNotMatch(b.host.innerHTML,/Engine options/);b.click({compactChoice:'packages',value:'P1-Kit'});assert.equal(b.state.packageComponents.has('P1-Kit'),true);assert.equal(b.state.power,'Gas');assert.equal(b.state.specFilters.get('B1-Engine').size,2);
 b.click({compactChoice:'packages',value:''});assert.equal(b.state.packageComponents.size,0);
 b.click({compactGroup:'spec:B1-Engine'});b.click({compactChoice:'spec:B1-Engine',value:''});assert.equal(b.state.specFilters.size,0);
});
test('builder controls retain incompatible selected values for clearing, without clearing other filters',()=>{
 const b=builderCompact();b.state.power='Gas';b.state.modelFilter='BGA300';b.api.render(b.context);
 b.click({compactGroup:'power'});assert.match(b.host.innerHTML,/data-value="Gas"/);assert.match(b.host.innerHTML,/data-value="Battery"/);
 b.click({compactChoice:'power',value:''});assert.equal(b.state.power,'');assert.equal(b.state.modelFilter,'BGA300');
 b.click({compactAction:'promos'});assert.equal(b.state.promoOnly,true);assert.equal(b.state.modelFilter,'BGA300');
 b.click({compactAction:'models'});assert.equal(b.state.modelFilter,'');assert.equal(b.state.promoOnly,true);
});


test('category pages replace Type and Model controls with direct subcategories on both entry paths',()=>{
 const b=builderCompact();b.context.categoryLayout=true;b.context.componentControls='<div class="wep-component-nav">Batteries &amp; Chargers</div>';b.state.subcategory='';
 b.context.rows.push({Category:'Blowers',SubCategory:'Handheld',Series:'AK',Model:'BGA60',PowerType:'Battery',SortOrder:'1'},{Category:'Blowers',SubCategory:'Walk-Behind',Series:'Force',Model:'F602X',PowerType:'Gas',SortOrder:'8'},{Category:'Trimmers',SubCategory:'Other type',Series:'FS',Model:'FS1',PowerType:'Gas'});
 const match=b.context.matches;b.context.matches=(r,o)=>r.Category==='Blowers'&&match(r,o);
 b.api.render(b.context);const generated=b.host.innerHTML;
 assert.match(generated,/data-compact-choice="subcategory" data-value="Handheld"/);assert.match(generated,/data-value="Backpack"/);assert.match(generated,/data-value="Walk-Behind"/);assert.doesNotMatch(generated,/Other type|data-compact-group="subcategory"|data-compact-group="model"/);
 b.context.generated=false;b.api.render(b.context);assert.equal(b.host.innerHTML,generated);
 b.click({compactChoice:'subcategory',value:'Handheld'});assert.equal(b.state.subcategory,'Handheld');
 b.click({compactGroup:'series'});assert.match(b.host.innerHTML,/data-compact-choice="series" data-value="AK"/);assert.doesNotMatch(b.host.innerHTML,/data-compact-choice="series" data-value="BR"/);
 b.click({compactChoice:'series',value:'AK'});b.click({compactGroup:'power'});assert.equal(b.state.subcategory,'Handheld');assert.equal(b.state.seriesFilter,'AK');assert.match(b.host.innerHTML,/Power Type options/);assert.doesNotMatch(b.host.innerHTML,/Series options/);assert.match(b.host.innerHTML,/Batteries &amp; Chargers/);
 b.click({compactAction:'models'});assert.equal(b.state.subcategory,'');assert.equal(b.state.seriesFilter,'');
});

test('mower categories use the same category format while retaining applicable Use and Deck filters',()=>{
 const b=builderCompact();b.context.categoryLayout=true;b.context.generated=false;b.state.category='Mowers';b.state.subcategory='';
 b.context.componentControls='<span>Batteries &amp; Chargers</span>';
 b.context.rows.splice(0,b.context.rows.length,{Category:'Mowers',SubCategory:'Zero-Turns',Series:'TimeCutter',Use:'Residential',PowerType:'Gas',CuttingWidth:'42'},{Category:'Mowers',SubCategory:'Walk-Behind',Series:'TurfMaster',Use:'Commercial',PowerType:'Gas',CuttingWidth:'30'});
 b.api.render(b.context);for(const label of ['All Models','Zero-Turns','Walk-Behind','Use','Series','Deck Size','Power Type','Batteries &amp; Chargers','Promos'])assert.ok(b.host.innerHTML.includes(label),label);
 assert.doesNotMatch(b.host.innerHTML,/data-compact-group="(?:subcategory|model)"/);
 assert.ok(b.host.innerHTML.indexOf('Power Type')<b.host.innerHTML.indexOf('>Series<'));
 assert.ok(b.host.innerHTML.indexOf('Batteries &amp; Chargers')<b.host.innerHTML.indexOf('>Promos<'));
 b.click({compactChoice:'subcategory',value:'Zero-Turns'});assert.equal(b.state.subcategory,'Zero-Turns');
 b.click({compactGroup:'use'});assert.match(b.host.innerHTML,/Residential/);b.click({compactChoice:'use',value:'Commercial'});assert.equal(b.state.use,'Commercial');
});
