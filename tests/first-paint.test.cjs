const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
 const source=fs.readFileSync(file,'utf8');
 test(file+': render yields after six cards and cancels obsolete batches',()=>{
  const code=source.slice(source.indexOf('  let cardRenderVersion=0;'),source.indexOf('  // Universal category view'));
  const timers=[],grid={children:[],setAttribute(){},set innerHTML(value){this.children=value?value.split(','):[]},insertAdjacentHTML(position,value){this.children.push(...value.split(','))}};
  const DATA={filtered:Array.from({length:20},(_,i)=>i+1)},ctx={DATA,$:()=>grid,syncGeneratedComparison(){},marketplaceHasSelection:()=>true,card:x=>x+',',fitPriceDescriptions(){},observeCardFinance(){},setTimeout:fn=>timers.push(fn),financeCardObserver:null};
  // Delimit rendered items without depending on card HTML structure.
  Object.defineProperty(grid,'innerHTML',{set(value){this.children=value.split(',').filter(Boolean)},get(){return this.children.join(',')}});
  grid.insertAdjacentHTML=(position,value)=>grid.children.push(...value.split(',').filter(Boolean));
  vm.createContext(ctx);vm.runInContext(code,ctx);vm.runInContext('renderCards()',ctx);
  assert.equal(grid.children.length,6);assert.equal(timers.length,1);
  DATA.filtered=[99];vm.runInContext('renderCards()',ctx);timers.shift()();assert.deepEqual(grid.children,['99']);
  DATA.filtered=Array.from({length:20},(_,i)=>i+1);vm.runInContext('renderCards()',ctx);while(timers.length)timers.shift()();
  assert.deepEqual(grid.children,DATA.filtered.map(String));
  ctx.matchMedia=()=>({matches:true});DATA.filtered=[1,2,3];vm.runInContext('renderCards()',ctx);
  assert.deepEqual(grid.children,['1']);assert.equal(timers.length,1);
  while(timers.length)timers.shift()();assert.deepEqual(grid.children,['1','2','3']);
 });
 test(file+': inventory starts alongside setup but remains a gate before cards appear',async()=>{
  const code=source.slice(source.indexOf('  async function init(){'),source.indexOf("  window.addEventListener('popstate'"));
  let finishInventory,finishFinance,finishCatalog;const inventory=new Promise(r=>finishInventory=r),finance=new Promise(r=>finishFinance=r),events=[];
  const nodes={'#market-loading':{hidden:false},'#market-app':{hidden:true}};
  const ctx={location:{search:''},document:{getElementById:()=>null},window:{},performance:{now:()=>1},URLSearchParams,console,
   DATA:{componentSources:{STIHL:{}},promotionFinance:[]},clean:x=>x,loadMarketplaceCatalog:()=>new Promise(r=>finishCatalog=r),loadMarketplaceLocations:async()=>[],loadInventoryAvailability:()=>{events.push('inventory');return inventory},marketplaceBrandProfiles:()=>[{id:'STIHL'}],csv:()=>{events.push('finance');return finance},truthy:()=>true,
   enrichFactoryPackageSavings:x=>x,enrichRecommendedPackages:x=>x,groupFamilies:()=>[],groupComponents:()=>[],activeFamilies:()=>[],applyDealer(){},applyMarketplaceUrl(){},renderTopFilters(){},renderSidebar(){},filterFamilies(){events.push('render')},wire(){},updateCartFloat(){},$:selector=>nodes[selector],esc:x=>x};
  vm.createContext(ctx);const done=vm.runInContext(code+'init()',ctx);await new Promise(setImmediate);
  assert.deepEqual(events,['inventory']);assert.equal(nodes['#market-app'].hidden,true);
  finishCatalog([[],[],[],[],[],[]]);await new Promise(setImmediate);
  assert.deepEqual(events,['inventory','finance']);finishFinance([]);await new Promise(setImmediate);
  assert.equal(nodes['#market-app'].hidden,true);assert.ok(!events.includes('render'));
  finishInventory();await done;assert.equal(nodes['#market-app'].hidden,false);assert.ok(events.includes('render'));
 });
}
