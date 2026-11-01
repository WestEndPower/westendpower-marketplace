const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../universal/quote-request.js');
const customer={firstName:'Sample',lastName:'Customer',companyName:'Sample Company',email:'sample@example.com',phone:'860-555-0100',address1:'123 Sample Road',address2:'',city:'New Milford',state:'CT',zip:'06776',notes:'Call before delivery.'};
function state(method='credit',fulfillment='NEW_MILFORD',finance={}){
 const items=[{brandId:'TORO',type:'tool',sku:'77501',quantity:1,setupSelected:false,inventoryId:'public-choice'},{brandId:'TORO',type:'attachment',sku:'79501',quantity:2,setupSelected:true,inventoryId:''}];
 const down=finance.down??500,fee=finance.fee??299,delivery=fulfillment==='DELIVERY'?170:0,shipping=fulfillment==='SHIP'?36.86:0,subtotal=6647+delivery+shipping,tax=422.09+Math.round(delivery*.0635*100)/100+Math.round(shipping*.0635*100)/100,total=Math.round((subtotal+tax)*100)/100,amountFinanced=Math.round((total-down)*100)/100,principalWithFees=Math.round((amountFinanced+fee)*100)/100;
 const quote={ok:true,createdAt:'2026-10-22T12:00:00Z',paymentMethod:method,fulfillment,zip:fulfillment==='DELIVERY'?'06776':'',lines:items.map((x,i)=>({...x,productName:i?'Bagger':'Mower',regularUnitPrice:i?1099:4599,unitPrice:i?999:4199,itemTotal:i?1998:4199,setupTotal:i?300:0})),merchandise:6197,installation:300,freight:150,delivery,shipping,subtotal,tax,total,issues:[],shippingDetails:fulfillment==='SHIP'?{destination:{...customer}}:undefined,financePlans:method==='finance'?[{brandId:'TORO',program:{ProgramID:'EXAMPLE',ProgramName:'0% APR / 60 months',APR:0,TermMonths:60,RebateCompatible:'F'},requiredDown:down,minimumRequiredDown:0,requestedDownPayment:down,applicationFee:fee,amountFinanced,principalWithFees,monthlyPayment:Math.round(principalWithFees/60*100)/100}]:[]};
 return {selection:{brandId:'TORO',sku:'77501',items,paymentMethod:method,fulfillment,zip:quote.zip},quote,paymentConfirmed:true};
}
for(const store of ['NEW_MILFORD','DANBURY'])test('pickup needs contact details, allows no address: '+store,()=>{const c={...customer,address1:'',city:'',state:'',zip:''};assert.equal(R.validate(c,state('credit',store).quote),null);assert.equal(R.validate({...c,phone:'123'},state().quote).field,'phone');});
test('delivery quote requests require the priced ZIP; checkout also requires the full address',()=>{
 const q=state('cash','DELIVERY').quote;
 assert.equal(R.validate(customer,q),null);assert.equal(R.validate({...customer,zip:'06810'},q).field,'zip');
 const noStreet={...customer,address1:''};assert.equal(R.validate(noStreet,q),null);
 assert.equal(R.validate(noStreet,q,{checkout:true}).field,'address1');
 for(const field of ['address1','city','state','zip'])assert.equal(R.validate({...customer,[field]:''},q,{checkout:true}).field,field);
 assert.equal(R.validate(customer,q,{checkout:true}),null);
});
test('shipping rejects a changed destination until repriced',()=>{const q=state('credit','SHIP').quote;assert.equal(R.validate(customer,q),null);assert.equal(R.validate({...customer,address1:'456 Other Road'},q).field,'address1');assert.equal(R.validate({...customer,zip:'06776-1234'},q).field,'zip');});
for(const method of ['cash','credit','finance'])test('carries the item quantities, installation, freight and chosen payment: '+method,()=>{const s=state(method),p=R.payload(s,customer,'Q-TEST');assert.equal(p.items[1].qty,2);assert.equal(p.lines[1].finalLineTotal,1998);assert.equal(p.totals.setupInstallation,300);assert.equal(p.totals.freight.total,150);assert.equal(p.total,'$7,069.09');assert.equal(p.requestOnly,true);assert.equal(p.payments,undefined);assert.equal(p.sale,undefined);assert.equal(p.customerDetails.contactName,'Sample Customer');assert.equal(p.selection.items[0].inventoryId,'public-choice');assert(p.notes.includes('No payment collected'));if(method==='finance'){assert(p.paymentProgram.includes('60 months'));assert(p.notes.includes('$114.47'));assert.equal(p.paymentDetails.financed,6569.09);assert.equal(p.paymentDetails.applicationFee,299);assert.equal(p.paymentDetails.principalWithFees,6868.09);assert.equal(p.paymentDetails.plannedDownPayment,500);}});
test('shipping remains separate in the snapshot and reconciles in the existing dashboard total',()=>{const p=R.payload(state('credit','SHIP'),customer,'Q-SHIP');assert.equal(p.marketplaceQuote.totals.shipping,36.86);assert.equal(p.totals.delivery,36.86);assert.equal(p.deliveryDetails.street,customer.address1);});
test('unknown charges remain unconfirmed, never silently zeroed',()=>{const s=state();Object.assign(s.quote,{freight:null,subtotal:null,tax:null,total:null});const p=R.payload(s,customer,'Q-UNKNOWN');assert.equal(p.total,'Needs confirmation');assert.equal(p.totals.freight.total,null);assert.equal(p.totals.total,null);});
test('identity ignores refresh time but changes with customer, delivery or payment choice',()=>{const s=state(),id=R.identity(s,customer);s.quote.createdAt='2026-10-22T12:01:00Z';assert.equal(R.identity(s,customer),id);assert.notEqual(R.identity(s,{...customer,phone:'860-555-0101'}),id);assert.notEqual(R.identity(state('cash'),customer),id);assert.notEqual(R.identity(state('credit','DANBURY'),customer),id);});

test('quote requests allow minimal contact while checkout requires identity, address and a phone',()=>{
 const minimal={email:'customer@example.com'},q=state().quote;
 assert.equal(R.validate(minimal,q),null);assert.equal(R.validate(minimal,q,{checkout:true}).field,'firstName');
 assert.equal(R.validate({...customer,phone:'',cell:'',email:'customer@example.com'},q,{checkout:true}).field,'phone');
 assert.equal(R.validate({...customer,firstName:'',lastName:'',companyName:'Landscape Company'},q,{checkout:true}),null);
 assert.equal(R.validate({...customer,firstName:'',lastName:'',companyName:''},q,{checkout:true}).field,'firstName');
});
test('saved financing separates down payment, principal and fees without recording a payment',()=>{
 for(const down of [0,500,2500])for(const fee of [0,299]){
  const s=state('finance','NEW_MILFORD',{down,fee}),p=R.payload(s,customer,'Q-LOAN'),loan=p.paymentDetails;
  assert.equal(Math.round((loan.financed+down)*100)/100,s.quote.total);
  assert.equal(Math.round((loan.financed+loan.applicationFee)*100)/100,loan.principalWithFees);
  assert.equal(loan.principalWithFees,s.quote.financePlans[0].principalWithFees);
  assert.equal(loan.monthlyPayment,Math.round(loan.principalWithFees/60*100)/100);
  assert.equal(loan.requiredDown,down);assert.equal(loan.plannedDownPayment,down);
  assert.equal(p.payments,undefined);assert.equal(p.sale,undefined);
 }
});
