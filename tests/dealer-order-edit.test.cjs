const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../universal/dealer-order-edit.js'),'utf8');
function store(entries=[]){const map=new Map(entries);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function setup({multi=false,fresh=true,checkout=false,section='equipment',customer}={}){
 const items=[{brandId:'TORO',type:'tool',sku:'72525',quantity:1,inventoryId:'STOCK1',packageId:'TORO:72525'},{brandId:'TORO',type:'attachment',sku:'78593',quantity:1,inventoryId:'',packageId:'TORO:72525'}];if(multi)items.push({brandId:'HONDA',type:'tool',sku:'667570',quantity:1,inventoryId:'',packageId:'HONDA:667570'});
 const seed={customer,quoteId:42,reference:'Q-TEST',nonce:'11111111-2222-3333-4444-555555555555',returnOrigin:'https://westendpower-configurator-api.westendpower-nm.workers.dev',fullQuote:true,section,draft:{brandId:'TORO',sku:'72525',items,paymentMethod:'finance',financeProgramIds:{TORO:'PLAN',HONDA:'OTHER'},financeDownPayments:{TORO:500},dealerPrograms:{TORO:{key:'NALP',verified:false,reference:''}},fulfillment:'NEW_MILFORD',zip:''}};
 const location=new URL('https://westendpower.github.io/westendpower-marketplace/product-options.html?brand=toro&sku=72525#dealer-edit='+encodeURIComponent(Buffer.from(JSON.stringify(seed)).toString('base64')));if(checkout)location.pathname='/westendpower-marketplace/checkout.html';location.assign=url=>location.assigned=url;
 const local=store([['wepCart','NORMAL CART']]),session=store(),listeners={},messages=[],buttons=[],nodes={},focused=[];
 const node=tag=>({tag,style:{},children:[],append(...children){this.children.push(...children);},setAttribute(k,v){this[k]=v;},scrollIntoView(){}});
 const document={querySelector:selector=>({hidden:false,getClientRects:()=>[{}],scrollIntoView:()=>focused.push(selector)}),head:{append(){}},body:{prepend(bar){for(const n of bar.children||[])if(n.tag==='button')buttons.push(n);for(const n of bar.children||[])if(n.id)nodes[n.id]=n;}},addEventListener:(name,fn)=>listeners[name]=fn,createElement:node,querySelectorAll:()=>buttons.filter(b=>'data-dealer-handoff' in b),getElementById:id=>nodes[id]};
 let closed=false;const window={localStorage:local,opener:{postMessage:data=>messages.push(data)},addEventListener:(name,fn)=>listeners['window:'+name]=fn,close(){closed=true;},WEPBuilderCheckout:{current:()=>({quote:fresh?{total:123}:null,paymentConfirmed:true,selection:{brandId:'TORO',sku:'72525',items:items.filter(x=>x.brandId==='TORO').map(x=>({...x,inventoryId:''})),paymentMethod:'finance',financeProgramIds:{TORO:'PLAN'},financeDownPayments:{TORO:500},dealerPrograms:{TORO:{key:'NALP',verified:true,reference:''}}}})}};
 if(checkout)window.WEPCheckout={current:()=>({quote:fresh?{total:123}:null,paymentConfirmed:true,selection:{...structuredClone(seed.draft),items:items.map(line=>({...line,inventoryId:'',packageId:undefined}))}})};
 vm.runInNewContext(source,{window,document,location,sessionStorage:session,history:{replaceState(_s,_t,url){location.href=url;}},URL,URLSearchParams,TextDecoder,Uint8Array,atob,structuredClone,crypto:{randomUUID:()=> 'request-id'},setTimeout:()=>1,clearTimeout(){}});
 listeners.DOMContentLoaded();return {window,location,local,session,messages,buttons,nodes,seed,focused,closed:()=>closed,listeners};
}
test('staff build uses an isolated full cart and seeds package drafts and the pending program',()=>{
 const f=setup({multi:true});assert.equal(f.local.getItem('wepCart'),'NORMAL CART');const cart=JSON.parse(f.window.WEPBuildStorage.getItem('wepCart'));assert.equal(cart.length,3);assert.equal(cart[0].inventoryId,'');assert.equal(JSON.parse(f.session.getItem('wepBuildDraft:TORO:72525')).items.length,2);assert.equal(JSON.parse(f.session.getItem('wepBuildDraft:HONDA:667570')).items.length,1);const review=JSON.parse(f.session.getItem('wepCheckoutReviewSelection'));assert.equal(review.context.dealerPrograms.TORO.key,'NALP');assert.equal(review.context.dealerPrograms.TORO.verified,true);assert.equal(f.seed.draft.dealerPrograms.TORO.verified,false);
});
test('return preserves the old stock selection and requires fresh calculated payment choices',()=>{
 const f=setup();f.buttons.find(b=>b.textContent==='Review Updated Quote').onclick();assert.equal(f.messages.length,1);assert.equal(f.messages[0].selection.items[0].inventoryId,'STOCK1');assert.equal(f.messages[0].selection.dealerPrograms.TORO.key,'NALP');assert.equal(f.local.getItem('wepCart'),'NORMAL CART');
 const stale=setup({fresh:false});stale.buttons[0].onclick();assert.equal(stale.messages.length,0);assert.match(stale.nodes['dealer-edit-status'].textContent,/current pricing/);
});
test('multi-package edits review full-cart financing before returning, and cancel never sends an update',()=>{
 const f=setup({multi:true});f.buttons[0].onclick();assert.match(f.location.assigned,/checkout.html\?dealerEdit=/);assert.equal(f.messages.length,0);assert.equal(JSON.parse(f.window.WEPBuildStorage.getItem('wepCart')).length,3);
 const cancelled=setup();cancelled.buttons.find(b=>b.textContent.startsWith('Cancel')).onclick();assert.equal(cancelled.closed(),true);assert.equal(cancelled.messages.length,0);assert.equal(cancelled.local.getItem('wepCart'),'NORMAL CART');
});

test('full cart financing returns every package with its package identifiers and stock intact',()=>{
 const f=setup({multi:true,checkout:true});f.buttons[0].onclick();assert.equal(f.messages.length,1);const selection=f.messages[0].selection;assert.equal(selection.items.length,3);assert.equal(selection.items[2].packageId,'HONDA:667570');assert.equal(selection.items[0].inventoryId,'STOCK1');assert.equal(selection.financeProgramIds.HONDA,'OTHER');assert.equal(f.local.getItem('wepCart'),'NORMAL CART');
});

test('program and payment entry focus the requested section of the product builder',()=>{
 const program=setup({section:'programs'});assert.deepEqual(program.focused,['.wep-toro-programs']);const payment=setup({section:'payment'});assert.deepEqual(payment.focused,['.wep-package-payment-previews']);
});
test('the actual Toro program control restores Fleet1 as the selected button',async()=>{
 const toroSource=fs.readFileSync(require.resolve('../universal/toro-customer-options.js'),'utf8'),window={WEPDealerOrderEdit:{}},make=tag=>({tag,children:[],attributes:{},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attributes[k]=v;}});
 vm.runInNewContext(toroSource,{window,document:{createElement:make},AbortController,Map,Date});const ui=window.WEPToroCustomerOptions;ui.restore({dealerPrograms:{TORO:{key:'FleetTier1',verified:true,reference:''}}});const parent=make('section');ui.mount(parent);
 await ui.load({items:[{brandId:'TORO',type:'tool',sku:'72525'}]},async()=>({programs:[{key:'NALP',label:'NALP',qualified:true,message:'NALP'},{key:'FleetTier1',label:'Toro Fleet Pro',qualified:true,message:'Fleet'}],freight:{available:false}}),{aborted:false});
 const buttons=parent.children[0].children[1].children;assert.equal(buttons[1].textContent,'Toro Fleet Pro');assert.equal(buttons[1].attributes['aria-pressed'],'true');assert.equal(buttons[0].attributes['aria-pressed'],'false');assert.equal(ui.choices().dealerPrograms.TORO.key,'FleetTier1');
});

test('entering from a pricing-program button clears every saved payment choice without clearing the program or package',()=>{
 const f=setup({multi:true,section:'programs'}),draft=JSON.parse(f.session.getItem('wepBuildDraft:TORO:72525')),other=JSON.parse(f.session.getItem('wepBuildDraft:HONDA:667570')),review=JSON.parse(f.session.getItem('wepCheckoutReviewSelection'));
 for(const value of [draft,other,review.context]){assert.equal(value.paymentMethod,'standard');assert.equal(value.paymentConfirmed,false);assert.deepEqual(value.financeProgramIds,{});assert.deepEqual(value.financeProgramEndDates,{});assert.equal(value.dealerPrograms.TORO.key,'NALP');}
 assert.equal(draft.programId,'');assert.equal(draft.items.length,2);assert.equal(other.items.length,1);assert.equal(f.seed.draft.paymentMethod,'finance');assert.equal(f.local.getItem('wepCart'),'NORMAL CART');
 const payment=setup({section:'payment'}),saved=JSON.parse(payment.session.getItem('wepBuildDraft:TORO:72525'));assert.equal(saved.paymentConfirmed,true);assert.equal(saved.programId,'PLAN');
});

test('customer imports use a quote-specific session and whitelist only contact fields',()=>{
 const f=setup({customer:{firstName:'Barry',lastName:'Decker',companyName:'Example Co',phone:'9144905866',cell:'2035550199',email:'barry@example.test',address1:'4 Bogus Hill Road',address2:'Unit 2',city:'New Fairfield',state:'CT',zip:'06812',notes:'Set delivery when in.',dealerCost:999}});
 const key=f.window.WEPDealerOrderEdit.customerKey,customer=JSON.parse(f.session.getItem(key));assert.match(key,/wepDealerCart:42:.*:customer$/);assert.equal(customer.firstName,'Barry');assert.equal(customer.cell,'2035550199');assert.equal(customer.notes,'Set delivery when in.');assert.equal(customer.dealerCost,undefined);assert.equal(f.session.getItem('wepCheckoutCustomer'),null);assert.equal(f.seed.draft.customer,undefined);
 const empty=setup(),blank=JSON.parse(empty.session.getItem(empty.window.WEPDealerOrderEdit.customerKey));assert.equal(blank.firstName,'');assert.equal(blank.notes,'');
});
