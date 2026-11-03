const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const inline=fs.readFileSync(require.resolve('../universal/inline-checkout.js'),'utf8'),checkout=fs.readFileSync(require.resolve('../universal/customer-checkout.js'),'utf8');
const fields=['firstName','lastName','companyName','phone','cell','email','address1','city','state','zip','notes'];
function storage(){const data=new Map([['wepCheckoutCustomer',JSON.stringify({firstName:'Other customer'})],['staff:42',JSON.stringify({firstName:'Barry',lastName:'Decker',companyName:'Example Co',phone:'9144905866',cell:'2035550199',email:'barry@example.test',address1:'4 Bogus Hill Road',address2:'Unit 2',city:'New Fairfield',state:'CT',zip:'06812',notes:'Set delivery when in.'})]]);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('the product builder imports every contact field, business phone, address and notes from its staff session',()=>{
 const session=storage(),inputs=Object.fromEntries(fields.map(key=>[key,{value:''}])),form={elements:{namedItem:key=>inputs[key]}},start=inline.indexOf('   try{const saved=JSON.parse('),end=inline.indexOf("   $('wep-inline-print-copy')",start),code=inline.slice(start,end);
 new Function('window','sessionStorage','$','fields','customerStorageKey','clean',code)({WEPDealerOrderEdit:{customerKey:'staff:42'}},session,()=>form,fields,'staff:42',v=>String(v||'').trim());
 assert.equal(inputs.firstName.value,'Barry');assert.equal(inputs.lastName.value,'Decker');assert.equal(inputs.companyName.value,'Example Co');assert.equal(inputs.cell.value,'2035550199');assert.equal(inputs.address1.value,'4 Bogus Hill Road, Unit 2');assert.equal(inputs.notes.value,'Set delivery when in.');assert.equal(JSON.parse(session.getItem('wepCheckoutCustomer')).firstName,'Other customer');
});
test('remembering builder customer edits writes only its staff session',()=>{
 const session=storage(),start=inline.indexOf(' function remember(){'),end=inline.indexOf(' function message(',start);
 new Function('sessionStorage','customerStorageKey','customer',inline.slice(start,end)+';remember();')(session,'staff:42',()=>({firstName:'Edited'}));assert.equal(JSON.parse(session.getItem('staff:42')).firstName,'Edited');assert.equal(JSON.parse(session.getItem('wepCheckoutCustomer')).firstName,'Other customer');
});
test('full-cart customer restoration and edits preserve staff notes and business phone',()=>{
 const session=storage(),keys=['firstName','lastName','companyName','email','phone','address1','address2','city','state','zip','termsAccepted'],inputs=Object.fromEntries(keys.map(key=>[key,{value:''}])),form={elements:{namedItem:key=>inputs[key]}},start=checkout.indexOf('const customerStorageKey='),end=checkout.indexOf('restoreCheckoutCustomer();',start),code=checkout.slice(start,end);
 const remember=new Function('window','sessionStorage','$','paymentRecord',code+'restoreCheckoutCustomer();return rememberCheckoutCustomer;')({WEPDealerOrderEdit:{customerKey:'staff:42'}},session,()=>form,()=>{throw Error('Staff sessions must not restore another payment customer');});
 assert.equal(inputs.firstName.value,'Barry');assert.equal(inputs.address2.value,'Unit 2');inputs.firstName.value='Edited';remember();const saved=JSON.parse(session.getItem('staff:42'));assert.equal(saved.firstName,'Edited');assert.equal(saved.cell,'2035550199');assert.equal(saved.notes,'Set delivery when in.');assert.equal(JSON.parse(session.getItem('wepCheckoutCustomer')).firstName,'Other customer');
});
