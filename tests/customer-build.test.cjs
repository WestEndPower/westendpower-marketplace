const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../universal/customer-build.js'),{create}=require('../universal/build-session.js');
const store=(entries=[])=>{const map=new Map(entries);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const config=()=>({version:1,items:[{brandId:'TORO',type:'tool',sku:'72525',quantity:1,setupSelected:true,packageId:'TORO:72525'},{brandId:'TORO',type:'attachment',sku:'78593',quantity:2,setupSelected:true,packageId:'TORO:72525'}],fulfillment:'DELIVERY',zip:'06811',paymentMethod:'finance',financeDownPayments:{TORO:250}});

test('customer package loads options and setup without touching the shared cart or copying private fields',()=>{
 const local=store([['wepCart','NORMAL CART']]),session=store(),scoped=create('customer-example',local,session),raw=config();raw.customer={name:'PRIVATE'};raw.quoteId=42;raw.items[0].dealerCost=999;raw.items[0].inventoryId='SECRET';raw.financeProgramIds={TORO:'OLD'};
 const saved=C.prepare(raw,scoped,session);assert.equal(local.getItem('wepCart'),'NORMAL CART');assert.equal(JSON.parse(scoped.getItem('wepCart'))[1].quantity,2);assert.equal(saved.items[1].setupSelected,true);assert.equal(saved.items[0].inventoryId,'');assert.deepEqual(saved.financeProgramIds,{});assert.equal(saved.paymentConfirmed,false);assert.equal(saved.paymentMethod,'finance');assert.doesNotMatch(JSON.stringify(saved),/PRIVATE|SECRET|dealerCost|quoteId|OLD/);assert.equal(JSON.parse(session.getItem('wepBuildDraft:TORO:72525')).items.length,2);
});

test('multiple equipment packages keep their own options',()=>{
 const raw=config();raw.items.push({...raw.items[0],sku:'77501',packageId:'TORO:77501'},{...raw.items[1],sku:'BAG',packageId:'TORO:77501'});const session=store();C.prepare(raw,store(),session);assert.deepEqual(JSON.parse(session.getItem('wepBuildDraft:TORO:72525')).items.map(l=>l.sku),['72525','78593']);assert.deepEqual(JSON.parse(session.getItem('wepBuildDraft:TORO:77501')).items.map(l=>l.sku),['77501','BAG']);
});

test('bad or ambiguous links fail before writing and storage failures restore prior drafts',()=>{
 for(const raw of [{...config(),items:[]},{...config(),zip:'bad'},{...config(),items:[{...config().items[0],quantity:0}]},{...config(),items:[config().items[0],config().items[0]]}]){const cart=store([['wepCart','KEEP']]),session=store();assert.throws(()=>C.prepare(raw,cart,session));assert.equal(cart.getItem('wepCart'),'KEEP');assert.equal(session.map.size,0);}
 const raw=config();raw.items.push({...raw.items[0],sku:'OTHER'});delete raw.items[1].packageId;assert.throws(()=>C.normalize(raw),/which equipment/);
 const cart=store([['wepCart','KEEP']]),session=store([['wepBuildCheckoutChoices','OLD CHOICES']]);session.setItem=()=>{throw Error('full');};assert.throws(()=>C.prepare(config(),cart,session),/separate customer build/);assert.equal(cart.getItem('wepCart'),'KEEP');assert.throws(()=>C.decode('%%%'));
});

test('opening a copied link needs no staff window and reloading retains customer edits',()=>{
 const source=fs.readFileSync(require.resolve('../universal/customer-build.js'),'utf8'),local=store(),session=store(),scoped=create('customer-test',local,session),events={},location=new URL('https://westendpower.github.io/westendpower-marketplace/product-options.html?configuration=customer-test#customer-build='+Buffer.from(JSON.stringify(config())).toString('base64url'));
 const root={location,WEPBuildSession:{id:'customer-test'},WEPBuildStorage:scoped,sessionStorage:session,history:{replaceState(_s,_t,url){location.href=url;}},document:{addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({setAttribute(){},style:{}}),body:{prepend(){}}}};
 vm.runInNewContext(source,{window:root,URL,URLSearchParams,TextDecoder,Uint8Array,atob});assert.equal(root.WEPCustomerBuild.items[1].quantity,2);assert.equal(location.hash,'');scoped.setItem('wepCart','CUSTOMER EDITS');vm.runInNewContext(source,{window:root,URL,URLSearchParams,TextDecoder,Uint8Array,atob});assert.equal(scoped.getItem('wepCart'),'CUSTOMER EDITS');assert.equal(typeof events.DOMContentLoaded,'function');assert.equal(root.WEPDealerOrderEdit,undefined);
});
