'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function runtime(file){
 let source=fs.readFileSync(file,'utf8');
 if(file.endsWith('.html')){const start=source.indexOf("(() => {\n  'use strict';\n\n  const DATA");source=source.slice(start,source.indexOf('</script>',start));}
 source=source.slice(0,source.indexOf("  document.addEventListener('DOMContentLoaded',init);"))+"window.test={DATA,loadMarketplaceProducts,financeSummaryKey,selectPackageVariant};})();";
 const paths=[];const window={WestEndPayments:{},addEventListener(){},WESTEND_BRANDS:{STIHL:{id:'STIHL',dataRoot:'brands/stihl/data/'},YANMAR:{id:'YANMAR',dataRoot:'brands/yanmar/data/'}}};
 vm.runInNewContext(source,{window,document:{querySelector(){return null},querySelectorAll(){return []},addEventListener(){}},fetch:async path=>{paths.push(path);return {ok:true,text:async()=> 'SKU,BrandID,PowerType,Active\n'+(path.includes('yanmar')?'TRACTOR,YANMAR,Diesel,T':'TOOL,STIHL,Battery,T')}}});
 return {...window.test,paths};
}
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 test(file+': CSV recovery loads all published brands without needing an existing product list',async()=>{const r=runtime(file),rows=await r.loadMarketplaceProducts();assert.equal(rows.length,2);assert.equal(rows[1].SKU,'TRACTOR');assert.deepEqual(r.paths,['brands/stihl/data/products.csv','brands/yanmar/data/products.csv']);});
 test(file+': changing package components invalidates the financing preview',()=>{const r=runtime(file),tool={sku:'TOOL',price:100,type:'Tool'},f={key:'STIHL|TOOL',brand:'STIHL',category:'Blowers',variants:[tool]};const select=(sku,quantity)=>r.selectPackageVariant(f,{...tool,recommendedPackage:true,packageItems:[{sku,quantity,price:50}]});select('BAT-A',1);const first=r.financeSummaryKey(f);select('BAT-B',1);assert.notEqual(r.financeSummaryKey(f),first);const second=r.financeSummaryKey(f);select('BAT-B',2);assert.notEqual(r.financeSummaryKey(f),second);});
}
