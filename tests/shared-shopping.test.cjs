const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function compact(){const listeners={},window={},document={addEventListener:(event,fn)=>listeners[event]=fn};vm.runInNewContext(fs.readFileSync('universal/compact-filters.js','utf8'),{window,document});return {api:window.WEPCompactFilters,listeners};}
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
test('generated pages scope by brand and SKU, retain saved order, and preserve sale-date projections in preview',()=>{
 const window={},data={preview:true,query:'brand=TORO&use=Residential',products:[{brand:'TORO',sku:'B',stock:1,discontinued:true,msrp:1000,price:900,saleActive:true,rebate:50},{brand:'TORO',sku:'A',msrp:2000,price:2000,rebate:0}]};
 vm.runInNewContext(fs.readFileSync('universal/generated-catalog.js','utf8'),{window,URLSearchParams,document:{getElementById:()=>({textContent:JSON.stringify(data)})}});
 const rows=window.WEPGeneratedCatalog.products([{BrandID:'TORO',SKU:'A'},{BrandID:'OTHER',SKU:'B'},{BrandID:'TORO',SKU:'B'},{BrandID:'TORO',SKU:'EXCLUDED'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].SKU,'B');assert.equal(rows[0].Active,'T');assert.equal(rows[0].SellRemainingStockOnly,'T');assert.equal(rows[0].SalePrice,'900');assert.equal(rows[0].RebateToCustomer,'50');assert.equal(rows[0].SaleStartDate,'');
 const p=window.WEPGeneratedCatalog.params('?use=Commercial&spec.B1-Engine=X&spec.B1-Engine=Y');assert.equal(p.get('brand'),'TORO');assert.equal(p.get('use'),'Commercial');assert.equal(p.getAll('spec.B1-Engine').length,2);
});
function handoff(origin,cart=[],hash=''){
 const window={},storage=new Map([['wepCart',JSON.stringify(cart)]]),location={origin,hash,pathname:'/pages/test',search:''},history={replaceState(_a,_b,url){this.url=url;}},document={baseURI:origin+'/',addEventListener(){}};
 const sandbox={window,document,location,history,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,console,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),unescape,escape,encodeURIComponent,decodeURIComponent};
 vm.runInNewContext(fs.readFileSync('universal/cart-handoff.js','utf8'),sandbox);return {api:window.WEPCartHandoff,storage,history};
}
test('cart handoff preserves exact quantities and kit pricing, excludes customer fields and removes the fragment',()=>{
 const source=handoff('https://westendpower.github.io',[{sku:'KIT',brandId:'STIHL',quantity:2,customerEmail:'PRIVATE',itemPrice:500,kitComponents:[{sku:'TOOL',quantity:2,itemTotal:600,regularUnitPrice:350,locked:true,parentSku:'KIT',customerName:'PRIVATE'}]}]);
 const target=new URL(source.api.url('https://westendpower-configurator-api.westendpower-nm.workers.dev/pages/stihl'));
 const received=handoff(target.origin,[],target.hash),cart=JSON.parse(received.storage.get('wepCart'));assert.equal(cart[0].quantity,2);assert.equal(cart[0].kitComponents[0].itemTotal,600);assert.equal(cart[0].kitComponents[0].regularUnitPrice,350);assert.equal(cart[0].kitComponents[0].locked,true);
 assert.doesNotMatch(received.storage.get('wepCart'),/PRIVATE|customer/);assert.equal(received.history.url,'/pages/test');
 const anchored=new URL(source.api.url('https://westendpower-configurator-api.westendpower-nm.workers.dev/pages/stihl#wep-itemized-quote'));assert.equal(handoff(anchored.origin,[],anchored.hash).history.url,'/pages/test#wep-itemized-quote');
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
