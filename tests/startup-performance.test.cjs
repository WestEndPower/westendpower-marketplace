const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('compact render reuses broad scope scans and does not replace unchanged controls',()=>{
 const window={},document={addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('universal/compact-filters.js','utf8'),{window,document});
 let scans=0,writes=0,html='';const host={firstChild:null,get innerHTML(){return html},set innerHTML(value){writes++;html=value;this.firstChild={}}};
 const rows=Array.from({length:100},(_,i)=>({Category:'Blowers',SubCategory:i%2?'Backpack':'Handheld',Series:'AP',System:'AP',PowerType:'Battery',Use:'Residential'}));
 const context={rows,state:{subcategory:'Backpack'},generated:true,hosts:[host],matches:r=>{scans++;return !context.state.subcategory||r.SubCategory===context.state.subcategory}};
 window.WEPCompactFilters.render(context);assert.ok(scans<=rows.length*3,`Too many match scans: ${scans}`);assert.equal(writes,1);
 const first=scans;window.WEPCompactFilters.render(context);assert.equal(writes,1);assert.equal(scans-first,first);
 context.state.subcategory='Handheld';window.WEPCompactFilters.render(context);assert.equal(writes,2);assert.match(html,/data-value="Handheld" aria-pressed="true"/);
 context.rows=[];window.WEPCompactFilters.render(context);assert.equal(writes,3);
 // Component browsing replaces these same hosts outside the compact renderer.
 host.innerHTML='Component series';window.WEPCompactFilters.render(context);assert.equal(writes,5);assert.doesNotMatch(html,/Component series/);
});
function catalog(fetch,preload){
 const window={addEventListener(){}},document={baseURI:'https://westendpower.github.io/westendpower-marketplace/',head:{append(){}},createElement:()=>({}),readyState:'loading',addEventListener(){}};
 document.querySelector=()=>preload?{getAttribute:()=>preload}:null;
 vm.runInNewContext(fs.readFileSync('universal/navigation-dropdowns.js','utf8'),{window,document,fetch,URL});
 return window.WEPReadMarketplaceCatalog;
}
test('unversioned navigation shares the declared versioned preload without merging explicit versions',async()=>{
 const calls=[],read=catalog(async url=>{calls.push(url);return {ok:true,json:async()=>({})}},'data/marketplace-catalog.json?v=current');
 const first=read('data/marketplace-catalog.json');assert.equal(first,read('data/marketplace-catalog.json?v=current'));await first;
 assert.match(calls[0],/v=current$/);await read('data/marketplace-catalog.json?v=other');assert.equal(calls.length,2);
 await read('https://example.com/data/marketplace-catalog.json');assert.equal(calls.length,3);assert.doesNotMatch(calls[2],/v=current/);
});
test('static header precedes loading notice while interactive content stays hidden and fallback text stays accessible',()=>{
 for(const file of ['marketplace.html','shop-by-product.html','shop-by-brand.html']){
  const html=fs.readFileSync(file,'utf8');assert.ok(html.indexOf('class="market-header"')<html.indexOf('id="market-loading"'));
  assert.match(html,/#market-app\[hidden\]>:where\(:not\(\.market-header\):not\(#we-shared-nav\):not\(#market-loading\)\)/);
  assert.match(html,/content-visibility:auto;contain-intrinsic-size:auto 1600px/);
  assert.match(html,/<noscript><style>html body #market-app\[hidden\]>#wep-page-information/);
 }
});
test('navigation and shopping share one in-flight fetch and JSON parse for the same URL',async()=>{
 let fetches=0,decodes=0;const read=catalog(async()=>{fetches++;return {ok:true,json:async()=>{decodes++;return {brands:['STIHL']}}}});
 const a=read('data/marketplace-catalog.json'),b=read('https://westendpower.github.io/westendpower-marketplace/data/marketplace-catalog.json');
 assert.equal(a,b);const [x,y]=await Promise.all([a,b]);assert.equal(x,y);assert.equal(fetches,1);assert.equal(decodes,1);
 await read('data/marketplace-catalog.json');assert.equal(fetches,1);
 await read('data/marketplace-catalog.json?v=new');assert.equal(fetches,2);
});
test('failed catalog requests are evicted so a retry can succeed',async()=>{
 let fail=true,calls=0;const read=catalog(async()=>{calls++;return {ok:!fail,json:async()=>({brands:[]})}});
 await assert.rejects(read('data/marketplace-catalog.json'),/Catalog unavailable/);fail=false;
 await read('data/marketplace-catalog.json');assert.equal(calls,2);
});
test('all shopping entry points and brand navigation use the shared reader with standalone fallbacks',()=>{
 for(const file of ['universal/marketplace.js','shop-by-brand.html','shop-by-product.html','universal/brand-navigation.js']){
  const code=fs.readFileSync(file,'utf8');assert.match(code,/window.WEPReadMarketplaceCatalog\?/);assert.match(code,/fetch\(/);
 }
});

test('pre-rendered portal prevents the deferred installer from adding another header row',()=>{
 for(const file of ['marketplace.html','shop-by-product.html','shop-by-brand.html']){
  const html=fs.readFileSync(file,'utf8'),header=html.match(/<header class="market-header">([\s\S]*?)<\/header>/)[1];
  assert.equal((header.match(/class="wep-dealer-portal-bar wep-dealer-portal-inline"/g)||[]).length,1);
  assert.match(html,/#we-shared-nav\{margin:6px 0!important;padding:0 4px!important\}/);
  assert.match(html,/html\{scrollbar-gutter:stable\}/);
 }
 const source=fs.readFileSync('universal/dealer-portal-link.js','utf8');
 vm.runInNewContext(source,{document:{querySelector:()=>({}),createElement(){throw Error('Existing portal must prevent new markup or late styles');}}});
});
