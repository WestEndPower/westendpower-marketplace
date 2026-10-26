'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function runtime(file){
 let source=fs.readFileSync(file,'utf8');
 if(file.endsWith('.html')){const start=source.indexOf("(() => {\n  'use strict';\n\n  const DATA");source=source.slice(start,source.indexOf('</script>',start));}
 source=source.slice(0,source.indexOf("  document.addEventListener('DOMContentLoaded',init);"))+"window.test={DATA,loadMarketplaceProducts,financeSummaryKey,selectPackageVariant,selectedPriceVariant,selectCardVariant,compactBaseVariant,compactPriceBoxes,selectCompactVariant,cardFinanceMarkup};})();";
 const paths=[];const window={WestEndPayments:{},addEventListener(){},WESTEND_BRANDS:{STIHL:{id:'STIHL',dataRoot:'brands/stihl/data/'},YANMAR:{id:'YANMAR',dataRoot:'brands/yanmar/data/'}}};
 vm.runInNewContext(source,{window,URL,document:{querySelector(){return null},querySelectorAll(){return []},addEventListener(){}},fetch:async path=>{paths.push(path);return {ok:true,text:async()=> 'SKU,BrandID,PowerType,Active\n'+(path.includes('yanmar')?'TRACTOR,YANMAR,Diesel,T':'TOOL,STIHL,Battery,T')}}});
 return {...window.test,paths};
}
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 test(file+': CSV recovery loads all published brands without needing an existing product list',async()=>{const r=runtime(file),rows=await r.loadMarketplaceProducts();assert.equal(rows.length,2);assert.equal(rows[1].SKU,'TRACTOR');assert.deepEqual(r.paths,['brands/stihl/data/products.csv','brands/yanmar/data/products.csv']);});
 test(file+': changing package components invalidates the financing preview',()=>{const r=runtime(file),tool={sku:'TOOL',price:100,type:'Tool'},f={key:'STIHL|TOOL',brand:'STIHL',category:'Blowers',variants:[tool]};const select=(sku,quantity)=>r.selectPackageVariant(f,{...tool,recommendedPackage:true,packageItems:[{sku,quantity,price:50}]});select('BAT-A',1);const first=r.financeSummaryKey(f);select('BAT-B',1);assert.notEqual(r.financeSummaryKey(f),first);const second=r.financeSummaryKey(f);select('BAT-B',2);assert.notEqual(r.financeSummaryKey(f),second);});
}

for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 test(file+': compact starts bare, other equipment starts at base, and customer selection persists',()=>{
  const r=runtime(file);
  const variant=(sku,price,flags,type='Tool')=>({sku,price,msrp:price,type,workbookSort:0,marketplaceRow:{'B2-Tires':'R-4','P1-Loader':flags[0]?'T':'F','P2-Backhoe':flags[1]?'T':'F','P3-Mower':flags[2]?'T':'F','P4-Cab':'F'}});
  const base=variant('SA325BI',19999,[]),loader=variant('SA325BI-L',24999,[true]),backhoe=variant('SA325BI-LB',32999,[true,true]);
  const f={key:'SA325',brand:'YANMAR',category:'Compact Tractors',model:'SA325',variants:[base,backhoe,loader]};
  assert.equal(r.selectedPriceVariant(f).sku,'SA325BI');
  r.selectCardVariant(f,2);assert.equal(r.selectedPriceVariant(f).sku,'SA325BI-L');
  r.selectCardVariant(f,0);assert.equal(r.selectedPriceVariant(f).sku,'SA325BI');
  const mower={key:'RZ142',brand:'STIHL',category:'Zero-Turn Mowers',variants:[variant('RZ142-BAG',4200,[],'Package'),variant('RZ142',3500,[])]};
  assert.equal(r.selectedPriceVariant(mower).sku,'RZ142');
 });
}

for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 test(file+': tractor has separate base/package boxes and exact-SKU base selection',()=>{
  const r=runtime(file);
  const variant=(sku,price,loader)=>({sku,price,msrp:price,type:'Tool',workbookSort:0,marketplaceRow:{'B2-Tires':'R-4','P1-Loader':loader?'T':''}});
  const base=variant('SA325BI',19999,false),loader=variant('SA325BI-L',25299,true),f={key:'SA325',brand:'YANMAR',category:'Compact Tractors',model:'SA325',variants:[base,loader]};
  assert.equal(r.compactBaseVariant(f).sku,'SA325BI');
  assert.equal(r.selectedPriceVariant(f).sku,'SA325BI');
  r.selectCompactVariant(f,loader);
  const html=r.compactPriceBoxes(f,r.selectedPriceVariant(f));
  assert.match(html,/pp-box pp-compact-base" data-pp-box="tool"/);
  assert.match(html,/pp-compact-package pp-selected/);
  assert.ok(html.indexOf('Package Price:')<html.indexOf('Factory Installed'));
  assert.match(html,/<div class="market-compact-tire-label"><div class="market-package-row-label">Tires<\/div><details/);
  assert.match(html,/aria-label="Tire guide">Guide<\/summary>/);
  assert.match(html,/data-compact-sku="SA325BI" aria-pressed="false"/);
  assert.match(html,/data-compact-sku="SA325BI-L" aria-pressed="true"/);
  assert.match(html,/\$19,999\.00/);assert.match(html,/\$25,299\.00/);
  r.selectCompactVariant(f,base);
  const bare=r.compactPriceBoxes(f,r.selectedPriceVariant(f));
  assert.match(bare,/pp-compact-base pp-selected/);assert.doesNotMatch(bare,/pp-compact-package pp-selected/);
 });
}

for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 test(file+': tractor finance condition follows the expiration date in parentheses',()=>{
  const r=runtime(file),base={sku:'SA325BI',price:19999,msrp:19999,type:'Tool',workbookSort:0,marketplaceRow:{'B2-Tires':'R-4'}},f={key:'SA325-note',brand:'YANMAR',category:'Compact Tractors',model:'SA325',variants:[base]};
  for(const compatible of [false,true]){
   const key=r.financeSummaryKey(f);r.DATA.financeSummaryCache.set(key,{aprLabel:'0.00%',termMonths:84,monthly:264.36,expirationLabel:'Expires Oct. 31, 2026',rebateCompatible:compatible});
   const html=r.cardFinanceMarkup(f,'https://dealer.example/product-options.html?sku=SA325BI');
   assert.equal(html.includes('In lieu of customer rebate'),!compatible);
   if(!compatible){assert.ok(html.indexOf('84 Months')<html.indexOf('In lieu'));assert.ok(html.indexOf('$264.36')<html.indexOf('Expires Oct. 31, 2026'));assert.ok(html.indexOf('Expires Oct. 31, 2026')<html.indexOf('(In lieu of customer rebate)'));}
  }
 });
}
