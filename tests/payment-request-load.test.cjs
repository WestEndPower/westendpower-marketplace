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
test('eligibility and price requests start without an artificial delay and cancelled cards do not call the API',async()=>{
 const source=fs.readFileSync('universal/payment-pricing.js','utf8'),start=source.indexOf('const pricingQueue=[];'),end=source.indexOf('const inventoryCache=',start),calls=[];let now=10000;
 const context={Date:{now:()=>now},setTimeout:(fn,ms)=>{now+=ms;queueMicrotask(fn);},fetch:async url=>{calls.push({url,time:now});return {ok:true,json:async()=>({ok:true})};},API:'https://pricing.test'};
 vm.runInNewContext(source.slice(start,end)+';this.post=post;',context);
 const results=await Promise.allSettled([context.post('/customer-finance-programs',{sku:'A'}),context.post('/customer-finance-programs',{sku:'offscreen'},{shouldRun:()=>false}),context.post('/customer-pricing',{sku:'A'})]);
 assert.deepEqual(calls.map(c=>c.url),['https://pricing.test/customer-finance-programs','https://pricing.test/customer-pricing']);assert.equal(calls[1].time,calls[0].time);
 assert.equal(results[1].reason.name,'AbortError');
});
test('no more than three finance requests run at once and a new selection moves ahead of queued cards',async()=>{
 const source=fs.readFileSync('universal/payment-pricing.js','utf8'),start=source.indexOf('const pricingQueue=[];'),end=source.indexOf('const inventoryCache=',start),started=[],pending=[];
 const context={Date,setTimeout,clearTimeout,API:'https://pricing.test',fetch:async(_url,options)=>{started.push(JSON.parse(options.body).sku);return new Promise(resolve=>pending.push(()=>resolve({ok:true,json:async()=>({ok:true})})));}};
 vm.runInNewContext(source.slice(start,end)+';this.post=post;',context);
 const jobs=['A','B','C','D','E'].map(sku=>context.post('/customer-finance-programs',{sku}));
 jobs.push(context.post('/customer-pricing',{sku:'SELECTED'},{priority:()=>100}));
 assert.deepEqual(started,['A','B','C']);pending.shift()();await new Promise(setImmediate);
 assert.deepEqual(started,['A','B','C','SELECTED']);
 while(pending.length){pending.shift()();await new Promise(setImmediate);}
 await Promise.all(jobs);assert.deepEqual(started,['A','B','C','SELECTED','D','E']);
});
test('each endpoint retains a rolling request budget without delaying the other endpoint',async()=>{
 const source=fs.readFileSync('universal/payment-pricing.js','utf8'),start=source.indexOf('const pricingQueue=[];'),end=source.indexOf('const inventoryCache=',start),calls=[];let now=10000;
 const timers=new Map();let id=0;
 const context={Date:{now:()=>now},clearTimeout:key=>timers.delete(key),setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;},API:'https://pricing.test',fetch:async(url,options)=>{calls.push({url,sku:JSON.parse(options.body).sku,time:now});return {ok:true,json:async()=>({ok:true})};}};
 vm.runInNewContext(source.slice(start,end)+';this.post=post;',context);
 const jobs=Array.from({length:41},(_,i)=>context.post('/customer-finance-programs',{sku:i}));
 await new Promise(setImmediate);assert.equal(calls.length,40);
 await context.post('/customer-pricing',{sku:'quote'});assert.equal(calls.length,41);assert.equal(calls.at(-1).time,10000);
 const timer=[...timers.values()][0];assert.ok(timer.ms>=60000);now+=timer.ms;timer.fn();await Promise.all(jobs);
 assert.equal(calls.length,42);assert.ok(calls.at(-1).time>=70000);
});
test('a financing lookup rate limit does not pause unrelated quote requests',async()=>{
 const source=fs.readFileSync('universal/build-finance.js','utf8'),start=source.indexOf(' async function post('),end=source.indexOf(' let deliverySelect',start);
 const context={AbortController,setTimeout,clearTimeout,Date,Error,api:'https://pricing.test',quoteCooldown:0,fetch:async()=>({ok:false,status:429,headers:{get:()=>60},json:async()=>({error:'Please wait.'})})};
 vm.runInNewContext(source.slice(start,end)+';this.post=post;',context);
 await assert.rejects(context.post('/customer-finance-programs',{},new AbortController().signal));assert.equal(context.quoteCooldown,0);
 await assert.rejects(context.post('/marketplace-quote',{},new AbortController().signal));assert.ok(context.quoteCooldown>Date.now());
});
