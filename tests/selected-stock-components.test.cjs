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
test('compact stock dialog has one selected-name line and one table row per location',()=>{
 const r=packageAPI(),items=[{type:'tool',qty:1,row:{SKU:'T',Model:'BGA300'}},{type:'battery',qty:2,row:{SKU:'B',BatteryID:'AP300S'}},{type:'charger',qty:1,row:{SKU:'C',ChargerID:'AL501'}}];
 const locations=[{id:'NM',name:'New Milford',phone:'8603558722',status:'normally-stocked'},{id:'D',name:'Danbury',phone:'2037923030',status:'out-of-stock'}];
 r.api.showInventory({}, {inventoryStatus:()=>({locations})},items,{});
 const html=r.opened().innerHTML;assert.match(html,/BGA300 — AP300S × 2 — AL501/);assert.equal((html.match(/<tr>/g)||[]).length,3);assert.equal((html.match(/<a href=/g)||[]).length,2);assert.doesNotMatch(html,/UNSELECTED|SKU:/);assert.match(html,/quantity%202/);assert.match(html,/Normally Stocked/);
});
function section(s,a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));}
for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'])test(file+': separate component browsing exposes series and restores tool filters',()=>{
 const source=fs.readFileSync(file,'utf8'),state={shopMode:'equipment',category:'Blowers',power:'Battery',brand:new Set(['STIHL']),availability:new Set(['Normally In Stock']),specFilters:new Map(),packageComponents:new Set(),compare:new Set(),hpRanges:new Map(),seriesFilter:'AK'};
 const box={state,Set,Map,clean:v=>String(v??'').trim(),truthy:v=>v==='T',DATA:{products:[{Active:'T',PowerType:'Battery',Category:'Blowers',BrandID:'STIHL'}],batteryFamilies:[{}],chargerFamilies:[{}]},button:(name,value,kind)=>'<button data-'+kind+'="'+value+'">'+name+'</button>',renderTopFilters(){},renderSidebar(){},filterFamilies(){}};
 vm.runInNewContext(section(source,'  function productSeries(','  function groupComponents(')+';this.series=componentSeries;this.tools=productSeries;this.switchMode=switchComponentBrowse;this.nav=componentNavigation;',box);
 assert.equal(box.tools({PowerType:'Battery',System:'AK'}),'AK');assert.equal(box.tools({Series:'PRO',PowerType:'Battery',System:'AK'}),'PRO');
 assert.equal(box.series({BrandID:'STIHL',BatteryID:'AP300S',System:'Battery'},'battery'),'AP');assert.equal(box.series({System:'AS'},'charger'),'AS');
 assert.match(box.nav(),/data-shop-mode="batteries">Batteries & Chargers/);assert.doesNotMatch(box.nav(),/data-shop-mode="chargers"/);
 box.switchMode('batteries');assert.equal(state.category,'');assert.equal(state.seriesFilter,'');assert.equal(state.availability.size,0);assert.match(box.nav(),/>Return to Tools/);
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
