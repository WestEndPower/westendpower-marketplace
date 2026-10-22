/* WEP_CHECKOUT_PAYMENT_CARDS_V1: carried customer quotes; every selection is server-verified. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),clean=v=>String(v??'').trim();
 const cash=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const money=v=>cash(v)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v):'Needs confirmation';
 const compatible=p=>!/^(F|FALSE|NO|N|0)$/i.test(clean(p?.RebateCompatible));
 const methods=['cash','credit','finance','finance-inlieu'],labels={cash:'Cash / Bank Check',credit:'Credit Card',finance:'Financing + Rebates','finance-inlieu':'Financing in Lieu of Rebates'};
 const boxes=new Map();let activeKey='',requestKey='',controller=null,selectionGeneration=0,currentQuote=null,currentSlot='',carried=false,carryCandidate=null;
 const itemKey=items=>JSON.stringify(items.map(x=>[clean(x.brandId).toUpperCase(),x.type||'tool',clean(x.sku).toUpperCase(),Number(x.quantity),x.setupSelected===true,clean(x.inventoryId)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const key=ctx=>JSON.stringify([itemKey(ctx.items||[]),ctx.fulfillment,ctx.zip||'',ctx.shippingAddress||null]);
 const context=()=>WEPCheckout.context();
 const fresh=q=>q?.ok===true&&Array.isArray(q.lines)&&q.lines.length&&Array.isArray(q.issues)&&Number.isFinite(Date.parse(q.createdAt))&&Date.now()-Date.parse(q.createdAt)<300000;
 const slot=q=>q.paymentMethod==='finance'?(q.financePlans||[]).some(p=>!compatible(p.program))?'finance-inlieu':'finance':q.paymentMethod;
 function body(method,ctx,ids={}){return {...ctx,paymentMethod:method,financeProgramIds:ids};}
 async function post(path,data,signal){
  if(path==='/marketplace-quote')await WEPCheckout.quoteSlot(signal);
  const response=await fetch(WEPCheckout.api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal});
  const result=await response.json().catch(()=>({}));if(!response.ok||result.ok!==true){const error=Error(result.error||'Payment options need store confirmation.');error.status=response.status;throw error;}return result;
 }
 function readyContext(ctx){
  if(!ctx.items.length||!ctx.fulfillment||window.WEPQuoteStock&&!WEPQuoteStock.ready())return false;
  if(ctx.fulfillment==='DELIVERY'&&!/^\d{5}$/.test(ctx.zip))return false;
  if(ctx.fulfillment==='SHIP'){const a=ctx.shippingAddress||{};if(!a.address1||!a.city||!/^[A-Za-z]{2}$/.test(a.state)||!/^\d{5}$/.test(a.zip))return false;}
  return true;
 }
 function store(method,q,ctx){
  if(!fresh(q)||q.fulfillment!==ctx.fulfillment||clean(q.zip)!==clean(ctx.zip))return false;
  const noStock=rows=>itemKey(rows.map(x=>({...x,inventoryId:''})));
  if(noStock(q.lines)!==noStock(ctx.items))return false;
  if(ctx.fulfillment==='SHIP'){const address=a=>JSON.stringify(['address1','address2','city','state','zip'].map(k=>clean(a?.[k])));if(address(q.shippingDetails?.destination)!==address(ctx.shippingAddress))return false;}
  try{WEPQuoteDocument.snapshot(q);}catch(_){return false;}
  boxes.set(method,{quote:q,key:key(ctx)});return true;
 }
 function selectedSlot(){
  const method=new FormData($('choices')).get('paymentMethod');if(method!=='finance')return method||'';
  const ids=Object.fromEntries([...document.querySelectorAll('[data-finance-brand]')].map(s=>[s.dataset.financeBrand,s.value]));
  for(const name of ['finance','finance-inlieu']){const q=boxes.get(name)?.quote;if(q?.financePlans?.length&&q.financePlans.every(p=>ids[p.brandId]===p.program.ProgramID))return name;}
  return currentSlot.startsWith('finance')?currentSlot:'';
 }
 function make(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
 function render(){
  let ctx;try{ctx=context();}catch(_){return;}
  const selected=selectedSlot(),host=$('checkout-payment-cards');host.replaceChildren();
  for(const name of methods){
   const record=boxes.get(name),q=record?.key===key(ctx)&&fresh(record.quote)?record.quote:null,ship=ctx.fulfillment==='SHIP',blocked=ship&&name!=='credit';
   const card=make('article',undefined,'checkout-payment-card'+(name===selected?' is-selected':''));card.dataset.checkoutPayment=name;
   const title=name==='finance'&&!((window.WEPCheckoutSelection?.financeLayout?.hasRebate)||(record?.quote?.customerRebateDetails||[]).some(r=>r.status==='Included in your price'))?'Financing':labels[name];
   card.append(make('h3',title));
   const choose=make('button',undefined,'checkout-select-payment');choose.type='button';choose.setAttribute('aria-label','Select '+title);choose.setAttribute('aria-pressed',String(name===selected));choose.disabled=blocked||!q;
   choose.addEventListener('click',()=>void select(name,q));card.append(choose);
   if(name===selected)card.append(make('span','✓ Selected','checkout-selected-label'));
   if(q&&name.startsWith('finance')){
    for(const p of q.financePlans||[]){card.append(make('p',clean(p.program?.APR)+'% APR · '+clean(p.program?.TermMonths)+' months','checkout-program'));card.append(make('p',money(p.monthlyPayment)+' / month','checkout-payment-amount'));if(p.requiredDown>0)card.append(make('p',money(p.requiredDown)+' down'));if(p.applicationFee>0)card.append(make('p',money(p.applicationFee)+' application fee included'));}
    card.append(make('p','Equipment total '+money(q.total),'checkout-card-total'));
   }else if(q){card.append(make('p',money(q.total),'checkout-payment-amount'));card.append(make('p','Out the door estimate','checkout-card-caption'));}
   else card.append(make('p',blocked?'Credit card required for shipping':record?.error?'Could not load this offer':record?.unavailable?'No eligible offer for this package':controller&&!controller.signal.aborted?'Updating payment…':'Checking payment options…','checkout-card-caption'));
   if(q){for(const rebate of q.customerRebateDetails||[]){if(rebate.status==='Included in your price')card.append(make('p',rebate.name+' · '+money(rebate.amount)+' included'+(rebate.endDate?' · Ends '+rebate.endDate:''),'checkout-card-rebate'));}
    const ends=[...new Set((q.financePlans||[]).map(p=>clean(p.program?.EndDate||p.program?.ProgramEndDate)).filter(Boolean))];if(name==='finance-inlieu'&&ends.length)card.append(make('p','Ends '+ends.join(', '),'checkout-card-rebate'));
   }
   if(name.startsWith('finance')&&!blocked){const change=make('button','View / Change Financing','checkout-change-financing');change.type='button';change.addEventListener('click',()=>{$('payment-editor').open=true;$('payment-editor').scrollIntoView({behavior:'smooth',block:'center'});const input=$('choices').querySelector('[name=paymentMethod][value=finance]');if(!input.checked){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}});card.append(change);}
   host.append(card);
  }
  $('selected-financing-details').hidden=new FormData($('choices')).get('paymentMethod')!=='finance';
 }
 async function select(name,q){
  if(!q)return;const generation=++selectionGeneration,ctx=context();if(ctx.fulfillment==='SHIP'&&name!=='credit')return;
  currentSlot=name;
  const method=name.startsWith('finance')?'finance':name,input=$('choices').querySelector('[name=paymentMethod][value='+method+']');if(input.disabled)return;
  input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));render();
  if(method==='finance'){
   const ids=Object.fromEntries((q.financePlans||[]).map(p=>[p.brandId,p.program.ProgramID]));
   await new Promise(resolve=>{
    let observer,timer;function apply(){
     if(generation!==selectionGeneration){observer?.disconnect();clearTimeout(timer);resolve();return;}
     let complete=true;for(const [brand,id] of Object.entries(ids)){const select=[...document.querySelectorAll('[data-finance-brand]')].find(s=>s.dataset.financeBrand===brand);if(!select||![...select.options].some(o=>o.value===id)){complete=false;continue;}if(select.value!==id){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}}
     if(complete){observer?.disconnect();clearTimeout(timer);resolve();}
    }
    observer=new MutationObserver(apply);observer.observe($('finance-options'),{childList:true,subtree:true});timer=setTimeout(()=>{observer.disconnect();$('payment-editor').open=true;$('payment-cards-status').textContent='Review the eligible financing program below.';resolve();},15000);apply();
   });
  }
  if(generation===selectionGeneration){let reused=false;try{reused=WEPCheckout.acceptCarried(q,ctx.items);}catch(_){}if(!reused)WEPCheckout.refresh();render();}
 }
 async function loadOptions(ctx){
  const signature=key(ctx);if(!readyContext(ctx)||requestKey===signature)return;
  requestKey=signature;controller?.abort();controller=new AbortController();const signal=controller.signal;
  const isCurrent=()=>!signal.aborted&&key(context())===signature;
  const missing=methods.filter(m=>!(boxes.get(m)?.key===signature&&fresh(boxes.get(m)?.quote)));
  if(!missing.length){$('payment-cards-status').textContent='Payment options carried from your builder. Select a box to change payment.';controller=null;render();return;}
  const requestController=controller,timeout=setTimeout(()=>requestController.abort(),120000);$('payment-cards-status').textContent='Checking payment options for this package…';render();
  try{
   const prices=missing.filter(m=>m==='cash'||m==='credit').map(async m=>{if(ctx.fulfillment==='SHIP'&&m!=='credit')return;try{const q=await post('/marketplace-quote',body(m,ctx),signal);if(isCurrent()){WEPQuoteLayout.enrich(q);store(m,q,ctx);render();}}catch(e){if(isCurrent()){boxes.set(m,{error:true,key:signature});render();}}});
   const finance=(async()=>{
    if(ctx.fulfillment==='SHIP'||!missing.some(m=>m.startsWith('finance')))return;
    const groups=new Map();for(const l of ctx.items){if(!groups.has(l.brandId))groups.set(l.brandId,[]);groups.get(l.brandId).push(l);}
    const eligible=await Promise.all([...groups].map(async([brand,lines])=>{
     const tools=lines.filter(l=>l.type==='tool');if(!tools.length)return [brand,[]];
     const lists=await Promise.all(tools.map(l=>post('/customer-finance-programs',{brandId:brand,sku:l.sku,quantity:l.quantity,inventoryId:l.inventoryId,...(l.inventoryId?{inventorySelectionRequired:true}:{}),selectionItems:lines.filter(x=>x!==l).map(x=>({sku:x.sku,quantity:x.quantity}))},signal)));
     const rows=(lists[0].programs||[]).filter(p=>lists.every(v=>(v.programs||[]).some(x=>x.ProgramID===p.ProgramID))).sort((a,b)=>Number(a.APR)-Number(b.APR)||Number(b.TermMonths)-Number(a.TermMonths));return [brand,rows];
    }));
    for(const name of ['finance','finance-inlieu']){
     if(!missing.includes(name))continue;
     const candidates=eligible.map(([brand,rows])=>[brand,rows.filter(p=>compatible(p)===(name==='finance'))]);
     if(candidates.some(([,rows])=>!rows.length)){if(isCurrent())boxes.set(name,{unavailable:true,key:signature});continue;}
     const attempts=Math.max(...candidates.map(([,rows])=>rows.length));let found=false;
     for(let i=0;i<attempts;i++){
      if(!isCurrent())return;const ids=Object.fromEntries(candidates.map(([brand,rows])=>[brand,rows[Math.min(i,rows.length-1)].ProgramID]));
      try{const q=await post('/marketplace-quote',body('finance',ctx,ids),signal);if(!isCurrent())return;if(!q.financePlans?.length||!cash(q.total))continue;WEPQuoteLayout.enrich(q);store(name,q,ctx);found=true;render();break;}
      catch(e){if(signal.aborted)throw e;if(e.status===429)throw e;if(e.status!==400)break;}
     }
     if(!found&&isCurrent())boxes.set(name,{unavailable:true,key:signature});render();
    }
   })();
   const results=await Promise.allSettled([...prices,finance]);
   if(isCurrent()){
    for(const name of missing)if(!boxes.has(name)&&ctx.fulfillment!=='SHIP')boxes.set(name,{error:true,key:signature});
    $('payment-cards-status').textContent='Select a payment box to update your quote. Financing is subject to credit approval.';
    if(results.some(r=>r.status==='rejected')||[...boxes.values()].some(v=>v.error)){
     const retry=make('button','Retry Payment Options','checkout-retry-payments');retry.type='button';retry.onclick=()=>{requestKey='';void loadOptions(context());};$('payment-cards-status').append(' ',retry);
    }
   }
  }finally{clearTimeout(timeout);if(isCurrent()){controller=null;render();}}
 }
 function restore(){
  const saved=window.WEPCheckoutSelection;if(!saved)return;
  let ctx;try{ctx=context();if(itemKey(ctx.items)!==itemKey(saved.items))return;}catch(_){return;}
  currentSlot=saved.selectedPaymentBox||saved.paymentMethod;
  for(const col of saved.paymentBoxes||[]){if(col.build&&key(col.build)===key(ctx)&&fresh(col.quote)){WEPQuoteLayout.enrich(col.quote);store(col.method,col.quote,ctx);}}
  if(fresh(saved.quote)&&store(slot(saved.quote),saved.quote,ctx)){carried=true;carryCandidate={quote:saved.quote,items:saved.items};void WEPCheckout.preview(saved.quote).catch(()=>{});}
  // Older builders already cache complete server quotes; recover those too.
  try{for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(!k?.startsWith('wepBuildQuoteCache:'))continue;for(const [raw,q] of JSON.parse(sessionStorage.getItem(k)||'[]')){const b=JSON.parse(raw);if(key(b)===key(ctx)&&fresh(q)&&['cash','credit','finance'].includes(q.paymentMethod)){const name=slot(q);if(!boxes.has(name)){WEPQuoteLayout.enrich(q);store(name,q,ctx);}}}}}catch(_){}
  render();acceptCandidate();
 }
 function acceptCandidate(){if(!carryCandidate)return;try{if(WEPCheckout.acceptCarried(carryCandidate.quote,carryCandidate.items))carryCandidate=null;}catch(_){carryCandidate=null;}}
 $('totals').addEventListener('click',e=>{if(!e.target.closest('.edit-delivery-total'))return;$('fulfillment-editor').open=true;$('fulfillment-editor').scrollIntoView({behavior:'smooth',block:'center'});});
 $('open-customer-details').addEventListener('click',()=>{$('customer-details').open=true;$('customer-details').scrollIntoView({behavior:'smooth',block:'start'});$('payment-form').elements.namedItem('firstName').focus({preventScroll:true});});
 $('choices').addEventListener('change',()=>{let ctx;try{ctx=context();}catch(_){return;}const next=key(ctx);if(activeKey&&activeKey!==next){controller?.abort();controller=null;requestKey='';boxes.clear();}activeKey=next;render();queueMicrotask(acceptCandidate);if(ctx.fulfillment==='SHIP'&&!readyContext(ctx))$('customer-details').open=true;});
 window.addEventListener('wep:quote-ready',async event=>{
  const q=event.detail.quote,ctx=context();currentQuote=q;currentSlot=slot(q);activeKey=key(ctx);store(currentSlot,q,ctx);render();
  // Preserve current checkout choices for a refresh without changing the builder.
  try{sessionStorage.setItem('wepCheckoutReviewSelection',JSON.stringify({cart:event.detail.cartSnapshot,context:ctx,quote:q,updated:Date.now()}));}catch(_){}
  await WEPQuoteLayout.ready;void loadOptions(ctx);
 });
 window.addEventListener('wep:quote-cleared',()=>{currentQuote=null;render();});
 void WEPQuoteLayout.ready.then(restore);render();
 try{if(context().fulfillment==='SHIP'&&!readyContext(context()))$('customer-details').open=true;}catch(_){}
})();
