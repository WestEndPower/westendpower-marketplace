const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('only a prioritized card requests eager loading; remaining cards stay lazy and decode asynchronously',()=>{
 const window={};vm.runInNewContext(fs.readFileSync('universal/marketplace-card.js','utf8'),{window,document:{querySelector:()=>null},URL,URLSearchParams});
 const v={sku:'A',description:'Equipment',marketplaceRow:{ImageURL:'images/example.png'}},f={key:'A',brand:'HONDA',power:'Gas',category:'Generators',variants:[v]};
 const c={selectedPriceVariant:()=>v,selectedStock:()=>null,priceChoices:()=>[],stockHeaderMarkup:()=>'',sawHeaderBars:()=>'',cardFinanceMarkup:()=>'',paymentSelectionUrl:()=> 'https://example.test/product-options.html',promoInfo:()=>null,state:{compare:new Set()}};
 const first=window.WestEndMarketplaceCard.render(f,{...c,imagePriority:'high'});assert.match(first,/<img[^>]*loading="eager" fetchpriority="high" decoding="async"/);
 const later=window.WestEndMarketplaceCard.render(f,{...c,imagePriority:'auto'});assert.match(later,/<img[^>]*loading="lazy" decoding="async"/);assert.doesNotMatch(later,/fetchpriority="high"/);
});
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'])test(file+': priority follows the first filtered result after selections change',()=>{
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf('  function card(f){'),end=source.indexOf('    const first=selectedPriceVariant(f)',start);
 let received;const box={window:{WestEndMarketplaceCard:{render:(_f,c)=>received=c}},DATA:{filtered:[{key:'A'},{key:'B'}]},state:{}};
 for(const key of ['selectedPriceVariant','priceChoices','pricePanel','selectedStock','stockHeaderMarkup','sawHeaderBars','cardFinanceMarkup','paymentSelectionUrl','promoInfo','money','currentPrice','inventoryMarkup','familyInventoryStatus','selectPackageVariant','refreshSelectedCard','selectedPriceQuantity','updateCartFloat','track','compactBaseVariant'])box[key]=()=>{};
 vm.runInNewContext(source.slice(start,end)+'}\nthis.card=card;',box);
 box.card({key:'A'});assert.equal(received.imagePriority,'high');box.card({key:'B'});assert.equal(received.imagePriority,'auto');
 box.DATA.filtered=[{key:'B'}];box.card({key:'B'});assert.equal(received.imagePriority,'high');
});
