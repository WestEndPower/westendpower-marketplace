const test=require('node:test');
const assert=require('node:assert/strict');
const factory=require('../universal/factory-options.js');
const unit=(sku,extra={})=>({SKU:sku,Model:'SA223',BrandID:'YANMAR',Category:'Compact Tractors',Active:'T',MSRP:'17000','B2-Tires':'Industrial',...extra});
const base=unit('BASE'),loader=unit('LOADER',{'P1-Loader':'T'}),backhoe=unit('BACKHOE',{'P1-Loader':'T','P2-Backhoe':'T'}),turf=unit('TURF',{'B2-Tires':'Turf'});

test('backhoe requires the catalog loader package; removing loader removes its dependent backhoe',()=>{
 assert.equal(factory.optionCandidate([base,loader,backhoe],base,1),backhoe);
 assert.equal(factory.optionCandidate([base,loader,backhoe],backhoe,0),base);
 assert.equal(factory.tireCandidate([base,loader,backhoe,turf],loader,'R-3'),null);
 assert.equal(factory.tireCandidate([base,loader,backhoe,turf],base,'R-3'),turf);
});
test('only active priced configurations in the same model family are selectable',()=>{
 const rows=[base,loader,unit('INACTIVE',{Active:'F'}),unit('UNPRICED',{MSRP:'0'}),unit('DIFFERENT',{Model:'SA425'}),unit('BRAND',{BrandID:'OTHER'}),unit('CATEGORY',{Category:'Mowers'})];
 assert.deepEqual(factory.variants(rows,base,'YANMAR'),[base,loader]);
 const yt=unit('YT',{Model:'YT235'}),cab=unit('CAB',{Model:'YT235C','P4-Cab':'T'});
 assert.deepEqual(factory.variants([yt,cab,unit('OTHER',{Model:'YT347C'})],yt,'YANMAR'),[yt,cab]);
 assert.deepEqual(factory.variants([unit('MOWER',{Category:'Mowers'})],unit('MOWER',{Category:'Mowers'}),'YANMAR'),[]);
});
const snapshot={brandId:'YANMAR',sku:'BASE',fulfillment:'DELIVERY',zip:'06776',paymentMethod:'finance',programId:'OLD',items:[
 {type:'tool',sku:'BASE',quantity:2,setupSelected:false,inventoryId:''},
 {type:'attachment',sku:'FORKS',quantity:1,setupSelected:true,inventoryId:'fork-unit'},
 {type:'attachment',sku:'LOOSE-LOADER',quantity:1,setupSelected:true,inventoryId:''},
 {type:'accessory',sku:'OLD-PART',quantity:1,setupSelected:false},
 {type:'attachment',sku:'REQUIRED',quantity:2,setupSelected:true,autoRequiredComponent:true}
]};
const cart=[{packageId:'OTHER:KEEP',type:'tool',sku:'KEEP'},...snapshot.items.map(item=>({...item,packageId:'YANMAR:BASE',productName:item.sku}))];
const allowed=[{type:'attachment',row:{SKU:'FORKS',Description:'Pallet Forks',MSRP:800,AssemblyOption:'T',AssemblyAmount:40}},{type:'attachment',row:{SKU:'LOOSE-LOADER'},included:true}];
const plan=()=>factory.transfer({snapshot,current:base,next:loader,brand:'yanmar',cart,allowed});
test('changing factory SKU preserves compatible extras, quantity, delivery and other packages; resets payment and main stock',()=>{
 const result=plan();
 assert.equal(result.draft.sku,'LOADER');assert.equal(result.draft.fulfillment,'DELIVERY');assert.equal(result.draft.zip,'06776');
 assert.equal(result.draft.paymentConfirmed,false);assert.equal(result.draft.paymentMethod,'standard');assert.equal(result.draft.programId,'');
 assert.deepEqual(result.draft.items.map(item=>item.sku),['LOADER','FORKS']);
 assert.equal(result.draft.items[0].quantity,2);assert.equal(result.draft.items[0].inventoryId,'');
 assert.equal(result.draft.items[1].inventoryId,'fork-unit');assert.equal(result.draft.items[1].setupSelected,true);
 assert.deepEqual(result.cart[0],cart[0]);assert.equal(result.cart.some(row=>row.packageId==='YANMAR:BASE'),false);
 assert.equal(result.cart.find(row=>row.type==='tool'&&row.sku==='LOADER').itemPrice,17000);
 assert(result.draft.configurationNotice.includes('LOOSE-LOADER (now factory included)'));
 assert(result.draft.configurationNotice.includes('OLD-PART (not compatible)'));
});
test('an in-stock tractor cannot be changed, and an existing target package cannot be overwritten',()=>{
 assert.throws(()=>factory.transfer({snapshot:{...snapshot,items:[{...snapshot.items[0],inventoryId:'stock-unit'}]},current:base,next:loader,brand:'YANMAR',cart,allowed}),/Order Unit/);
 assert.throws(()=>factory.transfer({snapshot,current:base,next:loader,brand:'YANMAR',cart:[...cart,{packageId:'YANMAR:LOADER'}],allowed}),/already saved/);
});
function storage(entries=[],failKey){
 const map=new Map(entries);let failed=false;
 return {getItem:key=>map.get(key)??null,setItem(key,value){if(!failed&&key===failKey){failed=true;throw Error('Storage full');}map.set(key,value);},removeItem:key=>map.delete(key),map};
}
test('migration clears old checkout and draft snapshots; a failed write restores both stores',()=>{
 const local=storage([['wepCart',JSON.stringify(cart)]]),session=storage([['wepBuildDraft:YANMAR:BASE','old'],['wepBuildCheckoutChoices','old-checkout']]);
 factory.persist(plan(),local,session);
 assert.equal(session.getItem('wepBuildDraft:YANMAR:BASE'),null);assert.equal(session.getItem('wepBuildCheckoutChoices'),null);
 assert.equal(JSON.parse(session.getItem('wepBuildDraft:YANMAR:LOADER')).sku,'LOADER');
 const failingLocal=storage([['wepCart','original-cart']],'wepCart'),failingSession=storage([['wepBuildDraft:YANMAR:BASE','old'],['wepBuildDraft:YANMAR:LOADER','target-draft'],['wepBuildCheckoutChoices','old-checkout']]);
 assert.throws(()=>factory.persist(plan(),failingLocal,failingSession),/could not be saved/);
 assert.equal(failingLocal.getItem('wepCart'),'original-cart');assert.equal(failingSession.getItem('wepBuildDraft:YANMAR:BASE'),'old');assert.equal(failingSession.getItem('wepBuildDraft:YANMAR:LOADER'),'target-draft');assert.equal(failingSession.getItem('wepBuildCheckoutChoices'),'old-checkout');
});
