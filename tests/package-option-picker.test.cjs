const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Picker=require('../universal/package-option-picker.js'),Session=require('../universal/build-session.js');
const window={};vm.runInNewContext(fs.readFileSync('universal/equipment-package-pricing.js','utf8'),{window,URL,URLSearchParams,Intl});
const rules=window.WestEndEquipmentPackages;
const product={SKU:'72530',Model:'MULTI FORCE',BrandID:'TORO',MSRP:18888};
function fixture(){
 const tables={attachments:[{SKU:'DECK',Description:'52 inch deck',MSRP:2000,Active:'T','72530':'T','72530-Req1':'MOUNT','72530-Qty1':'2'},
  {SKU:'BLADE',Description:'Snow blade',MSRP:900,Active:'T','72530':'T'},
  {SKU:'WRONG',Description:'Wrong fit',MSRP:20,Active:'T','72530':'F',Group_ALL_TORO:'T'}],
  accessories:[{SKU:'LIGHT',Description:'Light kit',MSRP:100,Active:'T','72530':'T'}],
  parts:[{SKU:'MOUNT',Description:'Mount kit',MSRP:50,Active:'T','72530':'T'}]};
 const catalog=Picker.catalogFor(tables),options=Picker.optionsFor(catalog,product,rules);
 return {catalog,options,tables};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('SKU compatibility exposes only compatible active image-picker options, leaving required parts automatic',()=>{
 const {options}=fixture();assert.deepEqual(options.map(item=>item.row.SKU).sort(),['BLADE','DECK','LIGHT']);
 assert.equal(rules.compatibility({'72530':'F',Group_ALL_TORO:'T'},product),false);
});
test('numbered hyphenated and compact requirement headings are model-specific and expandable',()=>{
 const row={'72530-Req1':'A','72530-Qty1':'2','72530Req12':'B','72530Qty12':'3','72524-Req1':'WRONG',RequiredSKU1:'OLD'};
 assert.deepEqual(plain(rules.requirementSlots(row,product)),[{sku:'A',quantity:2},{sku:'B',quantity:3}]);
 assert.deepEqual(plain(rules.requirementSlots({'72530-Req1':'',RequiredSKU1:'OLD'},product)),[]);
 assert.deepEqual(plain(rules.requirementSlots({RequiredSKU7:'LEGACY',RequiredQty7:2,RequiredModel7:'72530'},product)),[{sku:'LEGACY',quantity:2}]);
 assert.deepEqual(plain(rules.requirementSlots({RequiredSKU1:'OTHER',RequiredModel1:'72524'},product)),[]);
});
test('selected options, quantities and mandatory parts reconcile package MSRP without double charging',()=>{
 const {catalog,options}=fixture(),selected=[{type:'attachment',sku:'DECK',quantity:2},{type:'accessory',sku:'LIGHT',quantity:1}];
 const result=Picker.plan(product,catalog,options,selected,2,rules);
 assert.equal(result.msrp,23188);assert.equal(result.items.find(item=>item.row.SKU==='MOUNT').quantity,4);
 assert.equal(result.items.filter(item=>item.row.SKU==='MOUNT').length,1);
 assert.equal(Picker.plan(product,catalog,options,[],2,rules).items.length,0);
});
test('missing, cyclic and invalid requirement quantities block continuing an incomplete package',()=>{
 for(const change of ['missing','cycle','zero','large']){
  const {tables}=fixture();
  if(change==='missing')tables.parts=[];
  if(change==='cycle')Object.assign(tables.parts[0],{'72530-Req1':'DECK'});
  if(change==='zero')tables.attachments[0]['72530-Qty1']='0';
  if(change==='large')tables.attachments[0]['72530-Qty1']='21';
  const catalog=Picker.catalogFor(tables),options=Picker.optionsFor(catalog,product,rules);
  assert.throws(()=>Picker.plan(product,catalog,options,[{type:'attachment',sku:'DECK',quantity:1}],1,rules),/confirmation|compatible/);
 }
 const {catalog,options}=fixture();assert.throws(()=>Picker.plan(product,catalog,options,[{type:'accessory',sku:'LIGHT',quantity:11}],2,rules),/quantities/);
});
test('Build & Buy handoff preserves SKU, quantity and explicit choices, not prices or duplicated mandatory parts',()=>{
 const url=new URL(Picker.buildUrl('https://dealer.test/package-options.html?api=local','TORO','72530',[{type:'attachment',sku:'DECK',quantity:2}],2,'config-a'));
 assert.equal(url.pathname,'/product-options.html');assert.equal(url.searchParams.get('configuration'),'config-a');assert.equal(url.searchParams.get('quantity'),'2');
 assert.deepEqual(JSON.parse(url.searchParams.get('cardOptions')),[{type:'attachment',sku:'DECK',quantity:2}]);
 assert.equal(url.searchParams.get('api'),'local');assert.equal(url.searchParams.has('price'),false);
});
test('two builds of the same model and their checkouts have isolated carts; marketplace cart is unchanged',()=>{
 const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
 const shared=storage(),tabA=storage(),tabB=storage();shared.setItem('wepCart','original marketplace cart');
 const a=Session.create('config-a',shared,tabA),b=Session.create('config-b',shared,tabB);
 assert.equal(a.getItem('wepCart'),'[]');a.setItem('wepCart','deck configuration');b.setItem('wepCart','snow configuration');
 assert.equal(a.getItem('wepCart'),'deck configuration');assert.equal(b.getItem('wepCart'),'snow configuration');
 assert.equal(shared.getItem('wepCart'),'original marketplace cart');a.removeItem('wepCart');assert.equal(b.getItem('wepCart'),'snow configuration');
 assert.throws(()=>Session.create('../bad',shared,tabA),/Invalid/);
});
test('builder derives the same model-specific requirements after picker handoff',()=>{
 const {catalog}=fixture(),source=fs.readFileSync('universal/product-options.js','utf8');
 const code=source.slice(source.indexOf('function optionRequirementPlan('),source.indexOf('function syncOptionRequirements('));
 const context={window:{WestEndEquipmentPackages:rules},clean:v=>String(v??'').trim(),sku:'72530',selectedProduct:product,
  factoryPackageIncludedSkus:new Set(),inventoryPackageIncludes:[],trueish:()=>false,optionRequirementRows:catalog,optionRequirementCatalog:catalog,
  compatibilityChoice:(row,sku)=>rules.compatibility(row,{...product,SKU:sku})};
 vm.runInNewContext(code,context);const plan=context.optionRequirementPlan([{...catalog.find(item=>item.row.SKU==='DECK'),quantity:2}]);
 assert.equal(plan.get('part:MOUNT').quantity,4);
});
test('picker page and checkout routes load isolation before their cart readers',()=>{
 for(const page of ['product-options.html','choose-implements.html','checkout.html']){
  const source=fs.readFileSync(page,'utf8');assert.ok(source.includes('universal/build-session.js'));assert.ok(source.indexOf('universal/build-session.js')<source.indexOf('</head>'));
 }
 const source=fs.readFileSync('package-options.html','utf8');assert.match(source,/package-option-picker.js/);assert.match(source,/equipment-package-pricing.js/);
});
test('configuration IDs follow same-tab checkout/edit links without changing marketplace links',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},handlers={};
 const window={location:{search:'?configuration=config-a',href:'https://dealer.test/product-options.html?configuration=config-a',origin:'https://dealer.test'},localStorage:storage,sessionStorage:storage,
  document:{addEventListener:(name,handler)=>handlers[name]=handler}};
 vm.runInNewContext(fs.readFileSync('universal/build-session.js','utf8'),{window,URL,URLSearchParams});
 assert.equal(new URL(window.WEPBuildSession.url('checkout.html')).searchParams.get('configuration'),'config-a');
 assert.equal(new URL(window.WEPBuildSession.url('cart.html')).pathname,'/checkout.html');
 assert.equal(new URL(window.WEPBuildSession.url('marketplace.html')).searchParams.has('configuration'),false);
 const link={href:'https://dealer.test/product-options.html?brand=TORO&sku=72530'};handlers.click({target:{closest:()=>link}});
 assert.equal(new URL(link.href).searchParams.get('configuration'),'config-a');
});
test('missing or malformed images fall back without blocking compatible selections',()=>{
 assert.equal(Picker.imageUrl({ImageURL:'javascript:alert(1)'},'TORO','https://dealer.test/package-options.html'),'');
 assert.equal(Picker.imageUrl({ImageURL:'https://['},'TORO','https://dealer.test/package-options.html'),'');
 assert.equal(Picker.imageUrl({ImageURL:''},'TORO','https://dealer.test/package-options.html'),'');
 assert.equal(Picker.imageUrl({ImageURL:'images/products/deck.jpg'},'TORO','https://dealer.test/package-options.html'),'https://dealer.test/brands/toro/images/products/deck.jpg');
});
