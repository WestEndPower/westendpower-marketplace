'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const window={WEPKitComponents:require('../universal/package-components.js')},document={querySelector(){return null},createElement(){return {}},head:{append(){}}};
 const stored=new Map();const context={window,document,URL,URLSearchParams,Intl,CSS:{escape:x=>x},CustomEvent:class{constructor(name){this.type=name;}},localStorage:{getItem:k=>stored.get(k)||'[]',setItem:(k,v)=>stored.set(k,v)}};window.dispatchEvent=()=>{};
 vm.runInNewContext(fs.readFileSync('universal/package-pricing.js','utf8'),context);
 vm.runInNewContext(fs.readFileSync('universal/marketplace-card.js','utf8'),context);
 const tool={sku:'TOOL',description:'Bare Blower',type:'Tool',price:100,msrp:100,marketplaceRow:{ProductURL:'https://manufacturer.example/blower',Warranty:'3 years'}};
 const kit={sku:'KIT',description:'Blower with battery and charger',type:'Kit',price:180,msrp:200,marketplaceRow:{}};
 const f={key:'blower',brand:'STIHL',model:'Blower',power:'Battery',variants:[tool,kit],specs:{Weight:'5 lb'}};
 let selected=kit;
 const c={selectedPriceVariant:()=>selected,selectedStock:()=>null,DATA:{batteries:[{SKU:'BAT',BatteryID:'AK30',MSRP:60},{SKU:'BAT2',BatteryID:'AK20',MSRP:50}],chargers:[{SKU:'CHG',ChargerID:'AL101',MSRP:40}],compatibility:[{ToolSKU:'TOOL',BatteryID1:'AK20'}],packages:[{ParentSKU:'KIT',BatterySKU1:'BAT',ChargerSKU1:'CHG'}]},currentPrice:r=>Number(r.MSRP),paymentSelectionUrl:()=>`https://dealer.example/payment-options.html?brand=STIHL&sku=${selected.sku}&quantity=1`,inventoryMarkup:()=>'',priceChoices:()=>[],pricePanel:()=>'',stockHeaderMarkup:()=>'',sawHeaderBars:()=>'',state:{compare:new Set()},promoInfo:()=>null,money:String,cardFinanceMarkup:()=>'',selectPackageVariant:(_,v)=>selected=v,refreshSelectedCard(){}};
 c.selectedPriceQuantity=()=>1;c.updateCartFloat=()=>{};c.track=()=>{};return {window,document,f,c,stored};
}
test('package cards keep bare-tool identity, link the image, and share compact actions',()=>{
 const {window,f,c}=fixture(),html=window.WestEndMarketplaceCard.render(f,c);
 assert.match(html,/SKU: TOOL/);assert.match(html,/title="Bare Blower"/);assert.match(html,/href="https:\/\/manufacturer.example\/blower"/);
 assert.ok(html.indexOf('3 years')<html.indexOf('market-buy'));
 assert.equal((html.match(/data-pp-inventory/g)||[]).length,1);assert.doesNotMatch(html,/Check Inventory|View Details|wep-card-build|data-pp-build/);
 assert.match(html,/data-pp-add/);assert.match(html,/>Run Times</);
});
test('builder links use exact kit SKU or explicit changed components without adding to cart',()=>{
 const {window,document,f,c}=fixture(),api=window.WestEndPackagePricing;
 api.render(f,c);const kit=new URL(api.buildUrl(f,c));assert.equal(kit.searchParams.get('sku'),'KIT');assert.equal(kit.searchParams.get('cardOptions'),'[]');
 const host={dataset:{key:f.key}},button={dataset:{ppComponent:'battery',ppIndex:'0'},disabled:false};
 const target={closest(selector){return selector==='.wep-restored-card'?host:selector==='[data-pp-component]'?button:null;}};
 // Toggle the first battery; options are ordered by BatteryID.
 api.handle({target});const custom=new URL(api.buildUrl(f,c));assert.equal(custom.searchParams.get('sku'),'TOOL');
 const parts=JSON.parse(custom.searchParams.get('cardOptions'));assert.ok(parts.some(p=>p.sku==='BAT2'&&p.type==='battery'));assert.ok(parts.some(p=>p.sku==='CHG'&&p.type==='charger'));
});
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'])test(file+': pricing links differ only by quote anchor',()=>{
 const source=fs.readFileSync(file,'utf8'),start=source.indexOf('  function cardFinanceMarkup('),end=source.indexOf('\n  async function requestMarketplaceFinanceSummary',start);
 const sandbox={URL,DATA:{financeSummaryCache:new Map([['offer',{none:true}]])},financeSummaryKey:()=> 'offer',catalogBuildUrl:()=>'',esc:x=>x};vm.runInNewContext(source.slice(start,end)+';this.render=cardFinanceMarkup;',sandbox);
 const markup=sandbox.render({},'https://dealer.example/product-options.html?sku=TOOL&cardOptions=%5B%5D');const links=[...markup.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1]));assert.equal(links.length,2);assert.equal(links[0].hash,'');assert.equal(links[1].hash,'#wep-itemized-quote');links[1].hash='';assert.equal(links[0].href,links[1].href);
});
test('custom card selection restores quantities, clears stale extras, and rejects incompatible components',()=>{
 const source=fs.readFileSync('universal/product-options.js','utf8'),start=source.indexOf('function restoreCardSelection('),end=source.indexOf('// Category photos',start);
 const make=(type,sku)=>({dataset:{type,sku},checked:true}),checks=[make('battery','BAT'),make('charger','CHG'),make('accessory','STALE')],saved=new Map(),inputs={};const nodes={'equipment-qty':{},'options-message':{}};
 const qs=new URLSearchParams({quantity:'2',cardOptions:JSON.stringify([{type:'battery',sku:'BAT',quantity:2}])});
 const sandbox={qs,sku:'TOOL',selectedBrand:'stihl',Date,JSON,URL,location:{href:'https://dealer.example/product-options.html?sku=TOOL&cardOptions=payload&quantity=2'},history:{replaceState(_,__,href){this.href=href;}},mainSetupSelected:()=>false,optionSetupSelected:()=>false,sessionStorage:{setItem:(k,v)=>saved.set(k,v)},$:id=>nodes[id],CSS:{escape:x=>x},document:{querySelector:s=>inputs[s]||=( {})}};
 vm.runInNewContext(source.slice(start,end)+';this.restore=restoreCardSelection;',sandbox);sandbox.restore(checks);
 const draft=JSON.parse(saved.values().next().value);assert.equal(draft.items[0].quantity,2);assert.equal(draft.items[1].quantity,4);assert.equal(checks[1].checked,false);assert.equal(checks[2].checked,false);assert.equal(new URL(sandbox.history.href).searchParams.has('cardOptions'),false);
 saved.clear();qs.set('cardOptions',JSON.stringify([{type:'battery',sku:'UNKNOWN',quantity:1}]));sandbox.restore(checks);assert.equal(saved.size,0);assert.match(nodes['options-message'].textContent,/no longer available/);
});
test('package comparison uses component MSRP and omits savings and MSRP labels',()=>{
 const {window,f,c}=fixture();f.variants[1].msrp=999;
 const html=window.WestEndPackagePricing.render(f,c);
 assert.match(html,/>STIHL Base Price:</);assert.doesNotMatch(html,/Package savings|MSRP|Sale/);
 const price=html.match(/class="pp-price-select pp-package-total"[\s\S]*?<\/button>/)[0];
 assert.match(price,/<del>\$200\.00<\/del>/);assert.match(price,/<strong>\$180\.00<\/strong>/);assert.doesNotMatch(price,/999/);
});
test('equal combined and package prices display one amount, and missing MSRP never invents a comparison',()=>{
 for(const missing of [false,true]){
  const {window,f,c}=fixture();f.variants[1].price=200;if(missing)c.DATA.batteries[0].MSRP='';
  const html=window.WestEndPackagePricing.render(f,c),price=html.match(/class="pp-price-select pp-package-total"[\s\S]*?<\/button>/)[0];
  assert.doesNotMatch(price,/<del>/);assert.equal((price.match(/\$200\.00/g)||[]).length,1);
 }
});
test('a complete promotional kit is selected before the image banner renders, ahead of cheaper nonpromotional kits',()=>{
 const {window,f,c}=fixture();
 f.variants.push({sku:'CHEAPER',type:'Kit',description:'Other kit',price:150,msrp:150});c.DATA.packages.push({ParentSKU:'CHEAPER',BatterySKU1:'BAT2',ChargerSKU1:'CHG'});
 c.promoInfo=v=>v.sku==='KIT'?{type:'sale',savings:20,end:'2026-12-31'}:null;
 const html=window.WestEndMarketplaceCard.render(f,c);
 assert.equal(c.selectedPriceVariant(f).sku,'KIT');assert.match(html,/data-pp-select="package" aria-pressed="true"/);assert.match(html,/Save 20/);
});

test('card selection adds priced required connection items once and carries them into the cart',()=>{
 const {window,f,c,stored}=fixture();c.DATA.componentSources={STIHL:{...c.DATA,requirements:[{ToolSKU:'TOOL',BatterySKU:'BAT2',RequiredType:'accessory',RequiredSKU:'CABLE',RequiredQty:1}],accessories:[{SKU:'CABLE',Description:'Full connection cable',MSRP:20}]}};
 const api=window.WestEndPackagePricing;api.render(f,c);const host={dataset:{key:f.key}},button={dataset:{ppComponent:'battery',ppIndex:'0'},disabled:false};
 const target={closest(s){return s==='.wep-restored-card'?host:s==='[data-pp-component]'?button:null;}};api.handle({target});
 const html=api.render(f,c);assert.match(html,/Required items included/);assert.equal(c.selectedPriceVariant(f).price,210);
 const add={closest(s){return s==='.wep-restored-card'?host:s==='[data-pp-add]'?{}:null;}};api.handle({target:add});
 const cart=JSON.parse(stored.get('wepCart'));assert.equal(cart.filter(r=>r.sku==='CABLE').length,1);assert.equal(cart.find(r=>r.sku==='CABLE').packageComponent,true);assert.equal(cart.reduce((n,r)=>n+r.itemPrice*r.quantity,0),210);
});

test('all shopping entries load component definitions before package card initialization',()=>{
 for(const file of ['marketplace.html','shop-by-product.html','shop-by-brand.html']){const html=fs.readFileSync(file,'utf8');assert.ok(html.indexOf('src="universal/package-components.js')<html.indexOf('src="universal/package-pricing.js'),file);}
});

test('nonpromotional kits and recommended custom packages are selected immediately without resetting customer changes',()=>{
 for(const listedKit of [true,false]){
  const {window,f,c}=fixture();
  if(!listedKit){f.variants=f.variants.slice(0,1);c.DATA.packages=[];c.DATA.compatibility=[{ToolSKU:'TOOL',BatteryID1:'AK20',ChargerID1:'AL101',RecommendedBatteryID1:'AK20',RecommendedChargerID1:'AL101'}];}
  const api=window.WestEndPackagePricing,html=api.render(f,c);
  assert.match(html,/data-pp-select="package" aria-pressed="true"/);
  assert.equal(c.selectedPriceVariant(f).sku,listedKit?'KIT':'TOOL');
  assert.equal(c.selectedPriceVariant(f).price,listedKit?180:190);
  assert.match(html,/>STIHL Base Price:</);assert.match(html,/<strong>\$100\.00<\/strong>/);
  const host={dataset:{key:f.key}},button={dataset:{ppSelect:'tool'}};
  api.handle({target:{closest(s){return s==='.wep-restored-card'?host:s==='[data-pp-select]'?button:null;}}});
  assert.match(api.render(f,c),/data-pp-select="tool" aria-pressed="true"/);
  assert.equal(c.selectedPriceVariant(f).sku,'TOOL');
 }
});

test('tractor card keeps the description fixed but shows the selected configuration SKU',()=>{
 const {window,f,c}=fixture();f.category='Compact Tractors';f.brand='YANMAR';f.power='Diesel';
 const base=f.variants[0];base.sku='SA325BI';base.description='Yanmar SA325BI Compact Tractor';
 f.variants[1].sku='SA325BI-L';f.variants[1].description='Yanmar SA325BI-L Compact Tractor';c.compactBaseVariant=(_,v,fixed)=>{assert.equal(fixed,true);return base;};
 const html=window.WestEndMarketplaceCard.render(f,c);
 assert.match(html,/SKU: SA325BI-L<\/span>/);assert.match(html,/title="Yanmar SA325BI Compact Tractor"/);assert.doesNotMatch(html,/title="Yanmar SA325BI-L Compact Tractor"/);
 assert.equal(c.selectedPriceVariant(f).sku,'SA325BI-L');
});

test('tractor inventory lists only the selected exact SKU while battery inventory retains its options',()=>{
 for(const compact of [true,false]){
  const {window,document,f,c}=fixture(),dialogs=[],seen=[];
  if(compact){f.category='Compact Tractors';f.power='Diesel';}
  document.body={append(d){dialogs.push(d);}};
  document.createElement=tag=>tag==='template'?{content:{querySelector(){return {innerHTML:'Store availability'};}}}:{setAttribute(){},querySelector(){return {};},addEventListener(){},showModal(){}};
  c.inventoryMarkup=(_,v)=>{seen.push(v.sku);return '';};window.WestEndPackagePricing.actions(f,c);
  const host={dataset:{key:f.key}},check={focus(){}};
  const target={closest(s){return s==='.wep-restored-card'?host:s==='[data-pp-inventory]'?check:null;}};
  window.WestEndPackagePricing.handle({target});
  if(compact){assert.deepEqual(seen,['KIT']);assert.match(dialogs[0].innerHTML,/Selected Configuration Inventory/);assert.doesNotMatch(dialogs[0].innerHTML,/SKU: TOOL/);}
  else {assert.ok(seen.includes('TOOL'));assert.ok(seen.includes('KIT'));assert.ok(seen.includes('BAT2'));assert.match(dialogs[0].innerHTML,/Tool &amp; Package Inventory/);}
 }
});
