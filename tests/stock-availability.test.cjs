const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 const source=fs.readFileSync(file,'utf8');
 test(file+': availability checkbox labels match both store quantity fields and actual inventory',()=>{
  const state={category:'',subcategory:'',power:'',seriesFilter:'',modelFilter:'',seriesOrEngine:'',brand:new Set(),availability:new Set(['Normally In Stock']),buyOnline:false,shopMode:'equipment',packageComponents:new Set(),promoOnly:false,deck:'',use:'',specFilters:new Map()};
  const box={state,clean:v=>String(v??'').trim(),num:v=>Math.max(0,Number(v)||0),searchKey:v=>String(v),relevantVariants:f=>f.variants.filter(v=>!v.excluded),familyInventoryStatus:f=>({status:f.status||'out-of-stock'})};
  vm.runInNewContext(section(source,'  function marketplaceFamilyMatches(','  function renderDynamicBrands(')+';this.matches=marketplaceFamilyMatches;',box);
  const family=(danbury,milford,status)=>({brand:'STIHL',model:'BR600',specs:{},status,variants:[{marketplaceRow:{QtyDanbury:danbury,QtyNewMilford:milford}}]});
  assert.equal(box.matches(family('1','0')),true);assert.equal(box.matches(family('0','2')),true);
  assert.equal(box.matches(family('0','0')),false);assert.equal(box.matches(family('','')),false);
  assert.equal(box.matches(family('0','0','in-stock')),true);
  assert.equal(box.matches(family('0','0','incoming')),false);
  state.availability=new Set(['Available to Order']);assert.equal(box.matches(family(0,0)),true);assert.equal(box.matches(family(1,0)),false);
  state.availability.add('Normally In Stock');assert.equal(box.matches(family(1,0)),true);assert.equal(box.matches(family(0,0)),true);
  state.availability=new Set(['Normally In Stock']);assert.equal(box.matches({brand:'STIHL',specs:{},variants:[{excluded:true,marketplaceRow:{QtyDanbury:1}},{marketplaceRow:{QtyDanbury:0,QtyNewMilford:0}}]}),false);
 });
 test(file+': card header always offers stock checking and counts single serialized units',()=>{
  const box={num:v=>Number(v)||0,selectedPriceVariant:f=>f.variant||{marketplaceRow:{}},stockChoices:f=>f.units||[],selectedStock:f=>f.selected||null,esc:v=>String(v).replace(/"/g,'&quot;')};
  vm.runInNewContext(section(source,'  function stockHeaderMarkup(','  function stockUnitMarkup(')+';this.header=stockHeaderMarkup;',box);
  assert.match(box.header({key:'A'}),/data-pp-inventory[^>]*>Check Availability<\/button>/);
  assert.match(box.header({key:'A',variant:{marketplaceRow:{QtyDanbury:1}}}),/data-stock-label="Stocked"[^>]*>Stocked<\/button>/);
  assert.match(box.header({key:'A',variant:{marketplaceRow:{QtyNewMilford:2}}}),/>Stocked<\/button>/);
  assert.match(box.header({key:'A',variant:{marketplaceRow:{QtyDanbury:0,QtyNewMilford:0}},variants:[{marketplaceRow:{QtyDanbury:3}}]}),/>Check Availability<\/button>/);
  assert.match(box.header({key:'A'}, {marketplaceRow:{QtyDanbury:2}}),/>Stocked<\/button>/);
  assert.match(box.header({key:'A',units:[{}]}),/data-stock-toggle="A"[^>]*>In-Stock \(1\)<\/button>/);
  assert.match(box.header({key:'A',units:[{},{},{}]}),/>In-Stock \(3\)<\/button>/);
  assert.match(box.header({key:'A',units:[{}],selected:{}}),/>Build \/ Order<\/button>/);
 });
}

test('all shopping sidebars keep Brand then Availability non-collapsible while other filters remain expandable',()=>{
 for(const file of ['marketplace.html','shop-by-product.html','shop-by-brand.html']){
 const html=fs.readFileSync(file,'utf8'),brand=html.indexOf('<section class="market-fixed-filter"><h3>Brand</h3>'),availability=html.indexOf('<section class="market-fixed-filter"><h3>Availability</h3>');
 assert.ok(brand>=0&&availability>brand,file);assert.match(html,/<details><summary>Online Purchase<\/summary>/);
 assert.doesNotMatch(html,/<summary>(Brand|Availability)<\/summary>/);
 }
});
