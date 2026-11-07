const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'])test(file+': generated comparison uses all filtered families and their selected SKU',()=>{
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf('  function syncGeneratedComparison(){'),end=source.indexOf('  let cardRenderVersion=',start);
 let received;const window={WEPGeneratedCatalog:{},WEPGeneratedComparison:{update:(...args)=>received=args}},f={brand:'STIHL',model:'BR',power:'Gas',specs:{Wrong:'family value'},variants:[{sku:'a',description:'Blower',specs:{'Air Volume':'400 cfm','Dealer Cost':'PRIVATE'}}]};
 const box={window,DATA:{filtered:[f,{...f,brand:'REDMAX'}]},state:{shopMode:'equipment'},clean:v=>String(v??'').trim(),selectedPriceVariant:f=>f.variants[0]};
 vm.runInNewContext(source.slice(start,end)+';this.sync=syncGeneratedComparison;',box);box.sync();
 assert.equal(received[0].length,2);assert.equal(received[0][0].sku,'a');assert.equal(received[0][1].brand,'REDMAX');assert.equal(received[0][0].specs[0].value,'400 cfm');assert.doesNotMatch(JSON.stringify(received),/PRIVATE|Wrong/);
 box.DATA.filtered=[];box.sync();assert.equal(received[0].length,0);
 box.DATA.filtered=[{...f,variants:[{sku:'battery'}]}];box.state.shopMode='batteries';box.sync();assert.equal(received[1],'batteries');assert.equal(received[0][0].specs[0].value,'family value');
 delete window.WEPGeneratedCatalog;received=null;box.sync();assert.equal(received,null);
 assert.match(source,/function renderCards\(\)\{\s+syncGeneratedComparison\(\);/);
});
