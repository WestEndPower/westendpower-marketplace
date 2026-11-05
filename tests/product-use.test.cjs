const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const routes=['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'];
const clean=v=>String(v??'').trim(),truthy=v=>/^(T|TRUE|1)$/i.test(clean(v));
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
for(const file of routes){
 test(file+': Use filters exact variants, including prices/comparison selection',()=>{
  const source=fs.readFileSync(file,'utf8'),state={shopMode:'equipment',category:'Mowers',subcategory:'Zero-Turns',use:'Residential',power:'',seriesFilter:'',modelFilter:'',specFilters:new Map(),packageComponents:new Set()};
  const sandbox={state,clean,truthy,DATA:{},marketplacePowerContextGroup:()=>null};
  vm.runInNewContext(section(source,'  function marketplaceRowMatches(','  function marketplaceSpecGroups(')+';this.matches=marketplaceRowMatches;',sandbox);
  const base={Active:'T',Category:'Mowers',SubCategory:'Zero-Turns'};
  assert.equal(sandbox.matches({...base,Use:'Residential'}),true);
  assert.equal(sandbox.matches({...base,Use:'Commercial'}),false);
  assert.equal(sandbox.matches(base),false);
  assert.equal(sandbox.matches({...base,Use:'Commercial'},{ignoreUse:true}),true);
  vm.runInNewContext(section(source,'  function relevantVariants(','  function activeLocation')+';this.variants=relevantVariants;',sandbox);
  const family={variants:[{sku:'COMMERCIAL',price:500,marketplaceRow:{...base,Use:'Commercial'}},{sku:'RESIDENTIAL',price:100,marketplaceRow:{...base,Use:'Residential'}}]};
  assert.equal(sandbox.variants(family)[0].sku,'RESIDENTIAL');
  state.use='';assert.equal(sandbox.matches(base),true);assert.equal(sandbox.variants(family).length,2);
 });
 test(file+': shared URLs preserve Use and Clear removes it',()=>{
  const source=fs.readFileSync(file,'utf8');const state={shopMode:'equipment',category:'Mowers',subcategory:'Zero-Turns',use:'Commercial',brand:new Set(['TORO']),availability:new Set(),specFilters:new Map(),packageComponents:new Set()};
  const sandbox={state,URLSearchParams,clean,$:()=>null};
  vm.runInNewContext(section(source,'  function marketplaceUrlParams(','  function syncMarketplaceUrl(')+';this.params=marketplaceUrlParams;',sandbox);
  assert.equal(sandbox.params().get('use'),'Commercial');
  assert.match(source,/state\.use=clean\(params\.get\('use'\)\)/);
  const clearSandbox={...sandbox,state:Object.assign(state,{hpRanges:new Map()})};vm.runInNewContext(section(source,'  function resetContext(','  function track(')+';resetContext();',clearSandbox);
  assert.equal(state.use,'');assert.equal(sandbox.params().has('use'),false);
  assert.match(source,/button\('All Uses','','use',!state\.use\)/);
  assert.match(source,/useHtml \+/);
 });
}
test('published Toro catalog carries Use and current workbook categories without private fields',()=>{
 const {parse,isPrivate}=require('../scripts/marketplace-sync.cjs');const table=parse(fs.readFileSync('brands/toro/data/products.csv','utf8'));
 assert.ok(table.headers.includes('Use'));assert.equal(table.headers.some(isPrivate),false);
 assert.equal(table.rows.filter(r=>clean(r.Use)==='Residential').length,27);
 assert.equal(table.rows.filter(r=>clean(r.Use)==='Commercial').length,109);
 const bundle=JSON.parse(fs.readFileSync('data/marketplace-catalog.json','utf8'));assert.ok(bundle.productSources.find(s=>s.brand==='TORO').headers.includes('Use'));
});
