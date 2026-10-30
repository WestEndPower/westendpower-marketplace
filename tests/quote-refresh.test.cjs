const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../universal/quote-refresh.js'),{create}=require('../universal/build-session.js');
function store(entries=[]){const map=new Map(entries);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function config(){return {version:1,items:[{brandId:'TORO',type:'tool',sku:'72525',quantity:1,setupSelected:true,preferStock:true},{brandId:'TORO',type:'attachment',sku:'78593',quantity:2,setupSelected:true},{brandId:'YANMAR',type:'tool',sku:'SA325BI-LB',quantity:1,setupSelected:false}],fulfillment:'DELIVERY',zip:'06776',financeDownPayments:{TORO:2500},toroFreightMethod:'SHIP_NOW',hadSpecialProgram:true};}
test('expired quote opens a separate full cart without overwriting normal cart or using old finance/prices',()=>{
 const local=store([['wepCart','NORMAL CART']]),session=store([['wepBuildDraft:TORO:72525','NORMAL DRAFT']]),scoped=create('refresh-example',local,session),raw={...config(),financeProgramIds:{TORO:'EXPIRED'},dealerPrograms:{TORO:{key:'NALP',verified:true}},customer:{email:'PRIVATE'},quote:{total:1},paid:500};
 const saved=R.prepare(raw,scoped,session),items=JSON.parse(scoped.getItem('wepCart'));
 assert.equal(local.getItem('wepCart'),'NORMAL CART');assert.equal(session.getItem('wepBuildDraft:TORO:72525'),'NORMAL DRAFT');assert.equal(items.length,3);assert.equal(items[1].quantity,2);assert.equal(items[1].setupSelected,true);assert.equal(items[0].inventoryId,'');assert.equal(items[0].quoteStockChoice,undefined);assert.equal(items[1].quoteStockChoice,'orderable');assert.equal(saved.fulfillment,'DELIVERY');assert.equal(saved.zip,'06776');assert.equal(saved.financeDownPayments.TORO,2500);assert.equal(saved.toroFreightMethod,'SHIP_NOW');assert.equal(saved.review,true);assert.deepEqual(saved.financeProgramIds,{});assert.deepEqual(saved.dealerPrograms,{});assert.equal(saved.paymentMethod,'cash');assert.doesNotMatch(JSON.stringify(saved),/EXPIRED|PRIVATE|total|paid|unitPrice/);
});
test('refresh links decode Unicode SKUs and strip all unchecked values',()=>{
 const raw=config();raw.items[0].sku='KIT–A';raw.items[0].unitPrice=1;raw.items[0].inventoryId='PRIVATE STOCK';
 const encoded=Buffer.from(JSON.stringify(raw)).toString('base64url'),result=R.decode(encoded);
 assert.equal(result.items[0].sku,'KIT–A');assert.equal(result.items[0].unitPrice,undefined);assert.equal(result.items[0].inventoryId,undefined);assert.equal(result.version,1);
});
test('malformed or partial quote configurations fail before any cart writes',()=>{
 for(const patch of [{items:[]},{items:[{...config().items[0],quantity:0}]},{items:[config().items[0],config().items[0]]},{items:[{...config().items[0],type:'invalid'}]},{zip:'bad'}]){const local=store([['wepCart','KEEP']]),session=store();assert.throws(()=>R.prepare({...config(),...patch},local,session));assert.equal(local.getItem('wepCart'),'KEEP');assert.equal(session.map.size,0);}
 assert.throws(()=>R.decode('%%%'));assert.throws(()=>R.decode(Buffer.from('{bad').toString('base64url')));
});
test('failed storage restores the previous isolated cart and shipping still requires a fresh address',()=>{
 const local=store([['wepCart','KEEP']]),session=store();session.setItem=()=>{throw Error('full');};assert.throws(()=>R.prepare(config(),local,session),/separate estimate/);assert.equal(local.getItem('wepCart'),'KEEP');
 const saved=R.prepare({...config(),fulfillment:'SHIP',shippingAddress:{address1:'PRIVATE'}},store(),store());assert.equal(saved.paymentMethod,'credit');assert.equal(saved.shippingAddress,undefined);
});
