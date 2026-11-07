const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function packageAPI(){let opened;const window={},document={querySelector:()=>null,body:{append:d=>opened=d},createElement:()=>({setAttribute(){},querySelector:()=>({}),addEventListener(){},showModal(){}})};vm.runInNewContext(fs.readFileSync('universal/package-pricing.js','utf8'),{window,document,Intl,URL,URLSearchParams});return {api:window.WestEndPackagePricing,opened:()=>opened};}
test('stock checks include only the currently selected tool, batteries and charger with package quantities',()=>{
 const {api}=packageAPI(),tool={sku:'TOOL',description:'Blower',model:'BGA300',price:100,msrp:100,marketplaceRow:{SKU:'TOOL'}};
 const battery={row:{SKU:'B1',BatteryID:'AP300S',MSRP:30},qty:2},charger={row:{SKU:'C1',ChargerID:'AL501',MSRP:10},qty:1};
 const f={brand:'STIHL',model:'BGA300'},c={selectedPriceVariant:()=>tool,currentPrice:r=>Number(r.MSRP),DATA:{}},m={tool,source:{},packages:[],batteryOptions:[battery,{row:{SKU:'UNSELECTED'}}],chargerOptions:[]},s={choice:'package',battery:[battery],charger:[charger]};
 let items=api.selectedInventoryItems(f,c,m,s);assert.deepEqual(Array.from(items,p=>p.row.SKU),['TOOL','B1','C1']);assert.equal(items[1].qty,2);
 s.choice='tool';assert.equal(api.selectedInventoryItems(f,c,m,s).length,1);
 s.choice='package';s.battery=[];assert.deepEqual(Array.from(api.selectedInventoryItems(f,c,m,s),p=>p.row.SKU),['TOOL','C1']);
});
test('compact stock dialog has one selected heading and text/email on each store row',()=>{
 const r=packageAPI(),items=[{type:'tool',qty:1,row:{SKU:'T',Model:'BGA86'}},{type:'battery',qty:2,row:{SKU:'B',BatteryID:'AP300S'}},{type:'charger',qty:1,row:{SKU:'C',ChargerID:'AL301'}}];
 const locations=[{id:'NM',name:'New Milford',phone:'8603558722',email:'sales@westendpower.com'},{id:'D',name:'Danbury',phone:'4754443901',email:'dawepe@westendpower.com'}];
 r.api.showInventory({brand:'STIHL'}, {inventoryStatus:()=>({locations})},items,{});
 const html=r.opened().innerHTML;assert.match(html,/<h2>Check Availability<\/h2>/);assert.match(html,/Confirm availability and lead time/);assert.match(html,/BGA86 — AP300S × 2 — AL301/);assert.equal((html.match(/class="pp-stock-location"/g)||[]).length,2);assert.equal((html.match(/href="sms:/g)||[]).length,2);assert.equal((html.match(/href="mailto:/g)||[]).length,2);assert.doesNotMatch(html,/<table|Normally Stocked|Check Lead Time/);
 const links=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&'));
 for(const link of links){const url=new URL(link),body=url.searchParams.get('body');assert.match(body,/Tool: BGA86 \(SKU: T\), quantity 1/);assert.match(body,/Battery: AP300S \(SKU: B\), quantity 2/);assert.match(body,/Charger: AL301 \(SKU: C\), quantity 1/);assert.match(body,/STIHL/);}
 assert.match(new URL(links[0]).searchParams.get('body'),/New Milford/);assert.match(new URL(links[2]).searchParams.get('body'),/Danbury/);
 assert.equal(new URL(links[1]).pathname,'sales@westendpower.com');assert.match(new URL(links[3]).searchParams.get('subject'),/BGA86 — AP300S × 2 — AL301 — Danbury/);
});
test('tool-only confirmation omits unselected components and invalid contact links',()=>{
 const r=packageAPI(),items=[{type:'tool',qty:1,row:{SKU:'T&1',Model:'<Tool>'}}];
 r.api.showInventory({}, {inventoryStatus:()=>({locations:[{name:'New Milford',email:'bad?subject=changed',phone:''}]})},items,{});
 const html=r.opened().innerHTML;assert.match(html,/&lt;Tool&gt;/);assert.doesNotMatch(html,/Battery|Charger|mailto:|sms:/);assert.match(html,/Contact store to confirm/);
});
function section(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));}
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'])test(file+': separate component browsing exposes series and restores tool filters',()=>{
 const source=fs.readFileSync(file,'utf8'),state={shopMode:'equipment',category:'Blowers',power:'Battery',brand:new Set(['STIHL']),availability:new Set(['Normally In Stock']),specFilters:new Map(),packageComponents:new Set(),compare:new Set(),hpRanges:new Map(),seriesFilter:'AK'};
 const box={state,Set,Map,clean:v=>String(v??'').trim(),truthy:v=>v==='T',DATA:{products:[{Active:'T',PowerType:'Battery',Category:'Blowers',BrandID:'STIHL'}],batteryFamilies:[{}],chargerFamilies:[{}]},button:(name,value,kind)=>'<button data-'+kind+'="'+value+'">'+name+'</button>',renderTopFilters(){},renderSidebar(){},filterFamilies(){}};
 vm.runInNewContext(section(source,'  function productSeries(','  function groupComponents(')+';this.series=componentSeries;this.tools=productSeries;this.switchMode=switchComponentBrowse;this.nav=componentNavigation;',box);
 assert.equal(box.tools({PowerType:'Battery',System:'AK'}),'AK');assert.equal(box.tools({Series:'PRO',PowerType:'Battery',System:'AK'}),'PRO');
 assert.equal(box.series({BrandID:'STIHL',BatteryID:'AP300S',System:'Battery'},'battery'),'AP');assert.equal(box.series({System:'AS'},'charger'),'AS');
 assert.match(box.nav(),/data-shop-mode="batteries">Battery/);assert.match(box.nav(),/data-shop-mode="chargers">Charger/);
 box.switchMode('batteries');assert.equal(state.category,'');assert.equal(state.seriesFilter,'');assert.equal(state.availability.size,0);assert.match(box.nav(),/>Tools/);
 box.switchMode('chargers');assert.equal(state.shopMode,'chargers');box.switchMode('equipment');assert.equal(state.category,'Blowers');assert.equal(state.seriesFilter,'AK');assert.equal(state.availability.has('Normally In Stock'),true);
 assert.match(source,/aria-label="'\+\(state.shopMode==='batteries'\?'Battery':'Charger'\)\+' series"/);
});

test('serialized stock is assigned only to its actual store in compact stock results',()=>{
 const source=fs.readFileSync('universal/marketplace.js','utf8'),locations=[{LocationID:'NM',ShortName:'New Milford',InventoryQtyField:'QtyNewMilford'},{LocationID:'DB',ShortName:'Danbury',InventoryQtyField:'QtyDanbury'}],inventory=new Map([['T',{quantity:1,selections:[{quantity:1,store:'Danbury'}]}]]);
 const box={clean:v=>String(v??'').trim(),num:v=>Number(v)||0,skuKey:v=>v,distinct:a=>[...new Set(a)],inventorySkuSet:()=>inventory,activeLocations:()=>locations,relevantVariants:f=>f.variants};
 vm.runInNewContext(section(source,'  function familyInventoryStatus(','  function availabilityText(')+';this.status=familyInventoryStatus;',box);
 const result=box.status({brand:'STIHL',variants:[{sku:'T',marketplaceRow:{QtyDanbury:0,QtyNewMilford:0}}]});
 assert.equal(result.locations[0].status,'confirm-stock');assert.equal(result.locations[1].status,'in-stock');
});

test('stock window heading follows the header action and the selected tool quantities',()=>{
 const r=packageAPI(),context={inventoryStatus:()=>({locations:[]})};
 r.api.showInventory({},context,[{row:{SKU:'T',Model:'Tool',QtyNewMilford:1},qty:1,type:'tool'}],{});
 assert.match(r.opened().innerHTML,/<h2>Stocked<\/h2>/);assert.match(r.opened().innerHTML,/Confirm before visiting/);
 r.api.showInventory({},context,[{row:{SKU:'T',Model:'Tool'},qty:1,type:'tool'},{row:{SKU:'B',QtyDanbury:5},qty:1,type:'battery'}],{});
 assert.match(r.opened().innerHTML,/<h2>Check Availability<\/h2>/);
 r.api.showInventory({},context,[{row:{SKU:'T',Model:'Tool'},qty:1,type:'tool'}],{dataset:{stockLabel:'Stocked'}});
 assert.match(r.opened().innerHTML,/<h2>Stocked<\/h2>/);
});
