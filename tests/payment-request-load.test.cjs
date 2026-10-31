const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('all shopping routes request financing only for visible cards and pause in hidden tabs',()=>{
 for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
  const source=fs.readFileSync(file,'utf8'),start=source.indexOf('  let financeCardObserver;'),end=source.indexOf('  function cardFinanceMarkup',start);
  const cards=[{dataset:{key:'visible'}},{dataset:{key:'below'}}],families=cards.map(c=>({key:c.dataset.key})),calls=[];let callback,observed=[];
  const document={hidden:false,querySelectorAll:()=>cards,addEventListener(){}};
  class Observer{constructor(fn){callback=fn;}observe(el){observed.push(el);}disconnect(){} }
  vm.runInNewContext(source.slice(start,end)+';observeCardFinance();',{document,IntersectionObserver:Observer,DATA:{filtered:families},requestMarketplaceFinanceSummary:f=>calls.push(f.key)});
  assert.deepEqual(observed,cards,file);callback([{target:cards[0],isIntersecting:true},{target:cards[1],isIntersecting:false}]);assert.deepEqual(calls,['visible'],file);
  document.hidden=true;callback([{target:cards[1],isIntersecting:true}]);assert.deepEqual(calls,['visible'],file);
 }
});
test('finance eligibility lookups share the paced queue and cancelled cards do not call the API',async()=>{
 const source=fs.readFileSync('universal/payment-pricing.js','utf8'),start=source.indexOf('const pricingQueue=[];'),end=source.indexOf('const inventoryCache=',start),calls=[];let now=10000;
 const context={Date:{now:()=>now},setTimeout:(fn,ms)=>{now+=ms;queueMicrotask(fn);},fetch:async url=>{calls.push({url,time:now});return {ok:true,json:async()=>({ok:true})};},API:'https://pricing.test'};
 vm.runInNewContext(source.slice(start,end)+';this.post=post;',context);
 const results=await Promise.allSettled([context.post('/customer-finance-programs',{sku:'A'}),context.post('/customer-finance-programs',{sku:'offscreen'},{shouldRun:()=>false}),context.post('/customer-pricing',{sku:'A'})]);
 assert.deepEqual(calls.map(c=>c.url),['https://pricing.test/customer-finance-programs','https://pricing.test/customer-pricing']);assert.ok(calls[1].time-calls[0].time>=1500);
 assert.equal(results[1].reason.name,'AbortError');
});
test('a financing lookup rate limit does not pause unrelated quote requests',async()=>{
 const source=fs.readFileSync('universal/build-finance.js','utf8'),start=source.indexOf(' async function post('),end=source.indexOf(' let deliverySelect',start);
 const context={AbortController,setTimeout,clearTimeout,Date,Error,api:'https://pricing.test',quoteCooldown:0,fetch:async()=>({ok:false,status:429,headers:{get:()=>60},json:async()=>({error:'Please wait.'})})};
 vm.runInNewContext(source.slice(start,end)+';this.post=post;',context);
 await assert.rejects(context.post('/customer-finance-programs',{},new AbortController().signal));assert.equal(context.quoteCooldown,0);
 await assert.rejects(context.post('/marketplace-quote',{},new AbortController().signal));assert.ok(context.quoteCooldown>Date.now());
});
