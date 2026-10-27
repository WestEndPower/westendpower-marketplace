'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),K=require('../universal/package-components.js'),fs=require('node:fs'),{parse}=require('../scripts/marketplace-sync.cjs');
const tool={SKU:'TOOL',Description:'Full bare tool name',Model:'Demo',MSRP:'219.99'},battery={SKU:'BAT',Description:'Full AP300S Battery',BatteryID:'AP300S',MSRP:'149.99'},charger={SKU:'CHG',Description:'Full AL101 Charger',ChargerID:'AL101',MSRP:'59.99'};
const def={parent:{SKU:'KIT'},tool,parts:[{type:'battery',row:battery,qty:1},{type:'charger',row:charger,qty:1}]};
test('kit selling allocations keep the bare price exact, round batteries to $10 and reconcile charger balance',()=>{
 const rows=K.breakdown(def,269.99,2);assert.equal(rows[0].unitPrice,219.99);assert.equal(rows[1].unitPrice,50);assert.equal(rows[2].unitPrice,0);assert.equal(rows.reduce((n,l)=>n+Math.round(l.itemTotal*100),0),53998);assert.ok(rows.every(r=>r.locked&&r.quantity===2));assert.equal(rows[1].productName,battery.Description);
});
test('multiple included batteries and chargers scale from package quantity without editable component quantities',()=>{
 const two={...def,parts:[{type:'battery',row:battery,qty:2},{type:'charger',row:charger,qty:2}]};const rows=K.breakdown(two,419.99,3);assert.equal(rows[1].quantity,6);assert.equal(rows[2].quantity,6);assert.equal(rows.reduce((n,l)=>n+Math.round(l.itemTotal*100),0),125997);assert.equal(rows[1].perPackageQuantity,2);
});
test('dealer allocations have no $10 rounding and preserve actual tool and charger costs',()=>{
 const prices={TOOL:140.13,BAT:99.17,CHG:29.73},rows=K.breakdown(def,200.11,2,{dealer:true,price:r=>prices[r.SKU]});assert.equal(rows[0].unitPrice,140.13);assert.equal(rows[1].unitPrice,30.25);assert.equal(rows[2].unitPrice,29.73);assert.equal(rows.reduce((n,l)=>n+Math.round(l.itemTotal*100),0),40022);
});
test('negative or unpriceable allocations require confirmation instead of fabricating a component amount',()=>{
 assert.throws(()=>K.breakdown(def,275.36),/rounding/);assert.throws(()=>K.breakdown(def,100),/below/);assert.throws(()=>K.breakdown(def,269.99,{value:1}),/./);
});
test('series grouping preserves old full names and shortens only the contextual button label',()=>{
 assert.equal(K.batteryGroup(battery,'STIHL'),'AP / AR Series');assert.equal(K.batteryGroup({BatteryID:'AP300PC'},'STIHL'),'PRO AP Series');assert.equal(K.shortName({BatteryID:'AP300PC'},'PRO AP Series'),'300.0PC');assert.equal(K.shortName({BatteryID:'82BD250'},'82BD Series'),'250');assert.equal(K.shortName({BatteryID:'CORE530'},'CORE Series'),'530');assert.equal(K.shortName(battery,'AP / AR Series'),'AP300S');
});
test('only sell-remaining-stock rows disappear at zero; orderable new batteries remain',()=>{
 assert.equal(K.visible({...battery,SellRemainingStockOnly:'T'},0),false);assert.equal(K.visible({...battery,SellRemainingStockOnly:'T'},1),true);assert.equal(K.visible(battery,0),true);assert.equal(K.visible({...battery,Active:'F'},1),false);
});
test('Greenworks series metadata and model prefixes resolve to the same selector families',()=>{
 assert.equal(K.batteryGroup({BatteryID:'82BD250'},'GREENWORKS'),'82BD Series');
 assert.equal(K.batteryGroup({BatteryID:'CORE530'},'GREENWORKS'),'CORE Series');
 assert.equal(K.batteryGroup({BatteryID:'MODEL',BatterySeries:'Core Series'},'GREENWORKS'),'CORE Series');
 assert.equal(K.batteryGroup({BatteryID:'MODEL',Series:'82BD'},'GREENWORKS'),'82BD Series');
});
test('requirements are specific to tool and battery, deduplicated, and absent after switching batteries',()=>{
 const cable={SKU:'CABLE',Description:'AR cable',MSRP:20},rules=[{ToolSKU:'TOOL',BatterySKU:'BAT',RequiredType:'accessory',RequiredSKU:'CABLE',RequiredQty:1},{ToolSKU:'OTHER',BatterySKU:'BAT',RequiredSKU:'MISSING'}],catalog={accessories:[cable]};
 assert.equal(K.required(tool,[{row:battery,qty:2}],rules,catalog)[0].qty,1);assert.deepEqual(K.required(tool,[{row:{SKU:'OTHER'},qty:1}],rules,catalog),[]);assert.throws(()=>K.required(tool,[{row:battery,qty:1}],rules,{accessories:[]}),/confirmation/);
});
test('real BGA60 and multi-AS2 kit definitions produce exact sums from current published rows',()=>{
 const data=Object.fromEntries(['products','packages','batteries','chargers','attachments','accessories','parts'].map(t=>[t,parse(fs.readFileSync('brands/stihl/data/'+t+'.csv','utf8')).rows]));
 for(const sku of ['BA04 011 5941 US','BA08 011 5912 US']){const product=data.products.find(p=>p.SKU===sku),definition=K.definition(product,data.products,data.packages,data),rows=K.breakdown(definition,K.current(product));assert.equal(rows.reduce((n,l)=>n+Math.round(l.itemTotal*100),0),Math.round(K.current(product)*100));assert.equal(rows[0].sku,definition.tool.SKU);}
});
test('quote snapshot retains the priced package identity and strips all dealer data from included rows',()=>{
 const D=require('../universal/quote-document.js'),children=K.breakdown(def,269.99,2);children[0].DealerCost=123;
 const quote={ok:true,createdAt:new Date().toISOString(),paymentMethod:'cash',fulfillment:'NEW_MILFORD',lines:[{brandId:'STIHL',type:'tool',sku:'KIT',productName:'Factory kit',quantity:2,unitPrice:269.99,itemTotal:539.98,setupTotal:0,kitComponents:children}],merchandise:539.98,installation:0,freight:0,delivery:0,subtotal:539.98,tax:34.29,total:574.27,issues:[],financePlans:[]};
 const snap=D.snapshot(quote,{});assert.equal(snap.lines.length,1);assert.equal(snap.lines[0].sku,'KIT');assert.equal(snap.lines[0].kitComponents.length,3);assert.doesNotMatch(JSON.stringify(snap),/DealerCost/);assert.match(D.text(snap),/Full AP300S Battery/);assert.match(D.text(snap),/Package KIT/);assert.match(D.text(snap),/SKU BAT/);
});
