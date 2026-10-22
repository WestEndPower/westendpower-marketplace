/* WEP_BUILD_FINANCE_V1 - all money and finance rules come from the existing quote service. */
(function(){
 'use strict';
 const app=document.getElementById('app');if(!app)return;
 const query=new URLSearchParams(location.search),local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const api=local&&query.get('api')==='local'?'http://127.0.0.1:8787':'https://westendpower-configurator-api.westendpower-nm.workers.dev';
 const clean=v=>String(v??'').trim(),number=v=>Number(clean(v).replace(/[$,% ,]/g,''));
 const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
 const validMoney=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 let checkoutPending=false;
 let panel,output,generation=0,timer,controller,lastStarted=-Infinity,lastQuote=-Infinity,activeSignature='',lastApplied='';
 const spacing=450; // Debounce edits; quotes use the shared request budget below.
 const quoteCache=new Map(),quoteSessionKey='wepBuildQuoteCache:implement-freight-v3:'+api,quoteBudgetKey='wepBuildQuoteBudget',quoteBudgetWindow=61000;
 let quoteCooldown=0,quoteBudgetMemory=[];
 try{const rows=JSON.parse(sessionStorage.getItem(quoteSessionKey)||'[]');if(Array.isArray(rows))for(const entry of rows.slice(-40)){if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string')continue;const q=entry[1];if(q&&Array.isArray(q.lines)&&q.lines.length&&q.lines.every(l=>validMoney(l.unitPrice))&&Array.isArray(q.issues)&&!pricingIssues(q).length&&validMoney(q.total)&&Date.now()-Date.parse(q.createdAt)<120000)quoteCache.set(entry[0],q);}}catch(_){}

 function pricingIssues(q){return (q?.issues||[]).filter(message=>!(q?.excludedFactoryFreight?.length&&message==='Additional freight charges apply. We’ll contact you to confirm the freight charge before finalizing your order.'));}
 function budget(){quoteBudgetMemory=quoteBudgetMemory.filter(t=>t>Date.now()-quoteBudgetWindow);try{const raw=JSON.parse(sessionStorage.getItem(quoteBudgetKey)||'[]'),stored=Array.isArray(raw)?raw.filter(t=>Number.isFinite(t)&&t>Date.now()-quoteBudgetWindow):[];if(stored.length>quoteBudgetMemory.length)quoteBudgetMemory=stored;}catch(_){}return [...quoteBudgetMemory];}
 async function quoteSlot(signal){
  for(;;){if(signal.aborted)throw new DOMException('Changed','AbortError');const now=Date.now(),recent=budget(),wait=Math.max(quoteCooldown-now,recent.length>=8?recent[0]+quoteBudgetWindow-now:0);
   if(wait>0){await pause(Math.max(wait,1),signal);continue;}
   recent.push(now);quoteBudgetMemory=recent;try{sessionStorage.setItem(quoteBudgetKey,JSON.stringify(recent));}catch(_){}return;
  }
 }
 function estimateTotalPayments(plan){
  if(!plan||!validMoney(plan.monthlyPayment)||!validMoney(plan.principalWithFees))return null;
  const term=Number(plan.program?.TermMonths);if(!Number.isInteger(term)||term<1)return null;
  // Summarize the server's payment estimate; do not calculate an APR or a new payment.
  if(Number(plan.program.APR)===0)return plan.principalWithFees;
  return Math.round((plan.monthlyPayment*term+Number.EPSILON)*100)/100;
 }
 function cachedQuote(body,program){const cached=quoteCache.get(JSON.stringify(body));if(!cached||Date.now()-Date.parse(cached.createdAt)>120000)return null;
  if(program){const p=cached.financePlans?.find(x=>clean(x.brandId).toUpperCase()===body.items[0].brandId)?.program;if(JSON.stringify(p)!==JSON.stringify(program))return null;}return cached;
 }
 async function packageQuote(body,signal,program){const cached=cachedQuote(body,program);if(cached)return cached;await quoteSlot(signal);lastQuote=Date.now();const q=await post('/marketplace-quote',body,signal);
  if(!signal.aborted&&Array.isArray(q.lines)&&q.lines.length&&q.lines.every(l=>validMoney(l.unitPrice))&&Array.isArray(q.issues)&&!pricingIssues(q).length&&validMoney(q.total)&&(!body.items.some(x=>x.inventoryId)||q.stockPricingVersion===1)&&(!program||q.financePlans?.some(p=>clean(p.program?.ProgramID)===clean(program.ProgramID)))&&Number.isFinite(Date.parse(q.createdAt))){quoteCache.set(JSON.stringify(body),q);if(quoteCache.size>40)quoteCache.delete(quoteCache.keys().next().value);try{sessionStorage.setItem(quoteSessionKey,JSON.stringify([...quoteCache]));}catch(_){}}return q;
 }
 function note(text,cls='wep-build-finance-note'){const p=document.createElement('p');p.className=cls;p.textContent=text;return p;}
 function status(text,preserveOffers=false){if(!output)return;panel.hidden=false;if(!preserveOffers){output.replaceChildren(note(text));output.setAttribute('aria-busy','true');}}
 function field(label,value){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);return row;}
 function cart(){try{const rows=JSON.parse(localStorage.getItem('wepCart')||'[]');return Array.isArray(rows)?rows:[];}catch(_error){return [];}}
 function selection(){
  const link=app.querySelector('.wep-spec-link');if(!link)throw Error('Choose equipment before reviewing financing.');
  const params=new URL(link.href,location.href).searchParams,brandId=clean(params.get('brand')||query.get('brand')).toUpperCase(),sku=clean(params.get('sku')||query.get('sku'));
  const qty=Number(app.querySelector('#equipment-qty')?.value||1);
  if(!brandId||!sku||!Number.isInteger(qty)||qty<1||qty>20)throw Error('Choose a whole equipment quantity from 1 to 20.');
  const choices=[...app.querySelectorAll('.setup-choice')];
  const installation=(type,id)=>{const choice=choices.find(x=>x.dataset.installType===type&&x.dataset.installSku===id);const code=type==='tool'?app.querySelector('.hero .price')?.dataset.wepAssembly:[...app.querySelectorAll('.option-check')].find(x=>x.dataset.type===type&&x.dataset.sku===id)?.dataset.setupOption;return code==='F'||choice?.checked===true;};
  const saved=cart(),group=brandId+':'+sku;
  function inventory(type,id,count){const explicit=sourceChoice(type,id,count);if(explicit!==undefined)return explicit;const row=saved.find(x=>clean(x.brandId).toUpperCase()===brandId&&x.type===type&&clean(x.sku)===id&&Number(x.quantity)===count&&(!x.packageId||x.packageId===group));return clean(row?.inventoryId);}
  const items=[{brandId,type:'tool',sku,quantity:qty,setupSelected:installation('tool',sku),inventoryId:inventory('tool',sku,qty)}];
  for(const choice of app.querySelectorAll('.option-check:checked')){
   const type=choice.dataset.type,id=clean(choice.dataset.sku),input=[...app.querySelectorAll('[data-qty]')].find(x=>x.dataset.qty===id),quantity=Number(input?.value);
   if(!id||!['attachment','accessory','part','battery','charger'].includes(type)||!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('Choose whole option quantities from 1 to 20.');
   items.push({brandId,type,sku:id,quantity,setupSelected:installation(type,id),inventoryId:inventory(type,id,quantity)});
  }
  return {brandId,sku,items};
 }
 function pause(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Changed','AbortError'));return;}const abort=()=>{clearTimeout(id);reject(new DOMException('Changed','AbortError'));};const id=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});}
 async function post(path,body,signal){
  const requestController=new AbortController(),abort=()=>requestController.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();const timeout=setTimeout(abort,30000);
  try{
   let response;for(let attempt=0;attempt<2;attempt++){try{response=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body),signal:requestController.signal});break;}catch(error){if(attempt||error.name!=='TypeError'||signal.aborted||requestController.signal.aborted)throw error;if(path==='/marketplace-quote')await quoteSlot(signal);await pause(500,signal);}}
   const value=await response.json().catch(()=>({}));
   if(!response.ok||value.ok!==true){const error=Error(value.error||'Current financing is unavailable. Please use Review Quote or try again.');error.httpStatus=response.status;if(response.status===429)quoteCooldown=Date.now()+Math.max(Number(response.headers?.get('Retry-After'))||60,1)*1000;throw error;}
   return value;
  }finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
 }

 let deliverySelect,zipInput,paymentSelect,paymentSelectionNote,paymentDetails,priceExtra,totals,programs=[],preferred='',lastSnapshot=null,lastResponse=null,paymentConfirmed=false,catalogPrice='';
 const draftKey=()=>{const params=new URL(app.querySelector('.wep-spec-link')?.href||location.href,location.href).searchParams;return 'wepBuildDraft:'+clean(params.get('brand')).toUpperCase()+':'+clean(params.get('sku'));};
 function readDraft(){try{return JSON.parse(sessionStorage.getItem(draftKey())||'null');}catch(_){return null;}}
 function state(){const s=selection();return {...s,paymentMethod:!paymentConfirmed?'standard':paymentSelect.value==='cash'||paymentSelect.value==='credit'?paymentSelect.value:paymentSelect.value.startsWith('finance:')?'finance':'standard',programId:paymentSelect.value.startsWith('finance:')&&paymentSelect.value!=='finance:auto'?paymentSelect.value.slice(8):'',fulfillment:deliverySelect.value,zip:deliverySelect.value==='DELIVERY'?zipInput.value.trim():''};}
 function updatePaymentSelection(){
  if(!paymentSelectionNote)return;
  let label='Not selected';
  if(deliverySelect?.value==='SHIP')label='Credit Card — required for shipping';
  else if(paymentConfirmed){const value=paymentSelect?.value;if(value==='cash')label='Cash / Bank Check';else if(value==='credit')label='Credit Card';else if(value?.startsWith('finance:'))label=clean(paymentSelect.selectedOptions[0]?.textContent)||'Financing';}
  paymentSelectionNote.textContent='Payment: '+label;paymentSelectionNote.hidden=paymentConfirmed;
  const button=document.getElementById('wep-open-payment-options');
  if(button){button.textContent=paymentConfirmed?label:'Select Payment Option';button.setAttribute('aria-label',paymentConfirmed?'Selected payment: '+label+'. View all payment options.':'Select Payment Option');}
  highlightPayment();
 }
 function remember(){if(departing)return;updatePaymentSelection();try{sessionStorage.setItem(draftKey(),JSON.stringify({...state(),paymentConfirmed,updated:Date.now()}));}catch(_){}}
 function publishItemized(quote=null,message=""){window.dispatchEvent(new CustomEvent("wep:build-pricing",{detail:{quote,message}}));}
 function showListedBuild(message,preserveOffers=false){
  publishItemized(null,message);
  if(!preserveOffers){panel?.querySelectorAll('.wep-payment-rebate-footer,.wep-finance-expiry-footer').forEach(el=>el.remove());setFinanceLayout({}, {primary:'any',dual:false,hasRebate:false});inLieuOutput?.replaceChildren();stopOffers();offerPlan=null;offerRebate=0;syncOfferJoin();if(offerDisclaimer)offerDisclaimer.replaceChildren();output.replaceChildren(note(message||'Configure your package to view current financing.'));promoOutput?.replaceChildren();creditOutput?.replaceChildren();}
  panel.hidden=false;highlightPayment();syncPaymentCards();
  const price=app.querySelector('.hero .price');if(price)price.textContent=catalogPrice;
  priceExtra.replaceChildren(note('MSRP','wep-build-msrp'));
  totals.replaceChildren();
  try{
   const s=selection(),unit=number(price?.dataset.wepBasePrice||catalogPrice);if(!validMoney(unit)||unit<=0)throw Error('Listed equipment pricing needs confirmation.');
   let merchandise=unit*s.items[0].quantity,installation=0;
   for(const item of s.items){
    const c=item.type==='tool'?null:[...app.querySelectorAll('.option-check')].find(c=>c.dataset.type===item.type&&c.dataset.sku===item.sku);
    const fee=number(item.type==='tool'?price?.dataset.wepSetupFee||0:c?.dataset.setup||0);
    if(item.type!=='tool'){const amount=number(c?.dataset.price);if(!validMoney(amount))throw Error('An option price needs confirmation.');merchandise+=amount*item.quantity;}
    if(item.setupSelected){if(!validMoney(fee))throw Error('Installation needs confirmation.');installation+=fee*item.quantity;}
   }
   const dl=document.createElement('dl');for(const [label,value] of [['Merchandise',money(merchandise)],['Installation / Set-Up',money(installation)],['Freight','To be confirmed'],['Local delivery',deliverySelect.value==='DELIVERY'?'To be confirmed':money(0)],['Package subtotal','To be confirmed'],['Tax','To be confirmed'],['Total','To be confirmed']])dl.append(field(label,value));totals.append(dl);
  }catch(error){totals.append(note(error.message));}
  // Detailed connection messages belong in the payment-options window.
 }
 function pricingFailure(error){if(error.name==='AbortError')return 'Current pricing took too long. Your selections are saved; please retry.';if(error instanceof TypeError||error.message==='Failed to fetch')return 'Could not connect to current pricing. Your selections are saved; listed amounts remain visible. Please retry.';return error.message;}

 function invalidate(text,preserveOffers=false){lastResponse=null;lastSnapshot=null;showListedBuild(text,preserveOffers);}
 function programLabel(p){return number(p.APR)+'% APR · '+number(p.TermMonths)+' months'+(clean(p.Lender)?' · '+clean(p.Lender):'');}
 function setPrograms(rows,s){
  programs=rows;const chosen=preferred||s.programId,old=paymentSelect.value;
  paymentSelect.replaceChildren(new Option('Choose a payment option',''));for(const [value,label] of [['cash','Cash / Bank Check'],['credit','Credit Card']]){const o=new Option(label,value);paymentSelect.append(o);}
  for(const p of programs)paymentSelect.append(new Option(programLabel(p),'finance:'+clean(p.ProgramID)));
  if(s.paymentMethod!=='finance')paymentSelect.value=s.paymentMethod;
  else if(chosen&&programs.some(p=>clean(p.ProgramID)===chosen))paymentSelect.value='finance:'+chosen;
  else if(chosen){paymentSelect.append(new Option('Selected program unavailable — choose another',''));paymentSelect.value='';paymentConfirmed=false;throw Error('Your selected financing program is no longer eligible. Choose another payment option.');}
  else {paymentSelect.value='';paymentConfirmed=false;throw Error('Select a payment option from Select Payment Option.');}
  preferred=paymentSelect.value.startsWith('finance:')?paymentSelect.value.slice(8):'';
 }
 let offersController,offersVersion=0,offersBuildKey='',promoOutput,creditOutput,inLieuOutput,offerJoin,offerPlan=null,offerRebate=0;
 function syncOfferJoin(){}
 const paymentPreviews=new Map(),lastGoodFinance=new Map(),financeLayouts=new Map();
 const layoutSessionKey='wepBuildFinanceLayouts:'+api;
 try{const rows=JSON.parse(sessionStorage.getItem(layoutSessionKey)||'[]');if(Array.isArray(rows))for(const [key,value] of rows.slice(-20))if(typeof key==='string'&&value&&['any','compatible','inlieu'].includes(value.primary))financeLayouts.set(key,{primary:value.primary,dual:value.dual===true,hasRebate:value.hasRebate===true});}catch(_){}
 let financeLayout={primary:'any',dual:false,hasRebate:false};
 function rebateCompatible(p){return !/^(F|FALSE|NO|N|0)$/i.test(clean(p?.RebateCompatible));}
 function financeGroup(p){return rebateCompatible(p)?'compatible':'inlieu';}
 function financeMethod(method){return method==='finance'||method==='finance-inlieu';}
 function previewBuild(s){return {brandId:clean(s.brandId||s.items?.[0]?.brandId).toUpperCase(),sku:clean(s.sku||s.items?.find(x=>x.type==='tool')?.sku),items:(s.items||[]).map(x=>({brandId:clean(x.brandId).toUpperCase(),type:clean(x.type),sku:clean(x.sku),quantity:Number(x.quantity),setupSelected:x.setupSelected===true,inventoryId:clean(x.inventoryId)})),fulfillment:clean(s.fulfillment),zip:clean(s.zip)};}
 function setFinanceLayout(snapshot,layout,persist=false){
  financeLayout={primary:layout.primary||'any',dual:layout.dual===true,hasRebate:layout.hasRebate===true};
  if(persist){financeLayouts.set(JSON.stringify(previewBuild(snapshot)),financeLayout);if(financeLayouts.size>20)financeLayouts.delete(financeLayouts.keys().next().value);try{sessionStorage.setItem(layoutSessionKey,JSON.stringify([...financeLayouts]));}catch(_){}}
  for(const method of ['finance','finance-inlieu']){
   const card=panel?.querySelector('[data-payment-preview="'+method+'"]');if(!card)continue;
   const kind=method==='finance-inlieu'?'inlieu':financeLayout.primary;
   const title=financeLayout.hasRebate?(kind==='inlieu'?'Financing in Lieu of Rebates':'Financing + Rebates'):'';
   let heading=card.querySelector('h4');if(!title)heading?.remove();else if(!heading){heading=document.createElement('h4');heading.textContent=title;card.prepend(heading);}else if(heading.textContent!==title)heading.textContent=title;
   const choice=card.querySelector('.wep-payment-card-choice');const label='Select '+(title||'Financing');if(choice?.getAttribute('aria-label')!==label)choice?.setAttribute('aria-label',label);
   if(method==='finance-inlieu')card.hidden=!financeLayout.dual;
  }
  highlightPayment();
 }
 function savedFinance(snapshot,group='any'){
  const build=JSON.stringify(previewBuild(snapshot)),saved=lastGoodFinance.get(build+'|'+group);if(saved)return saved;
  const candidates=[];
  for(const [raw,quote] of quoteCache){try{
   const body=JSON.parse(raw);if(body.paymentMethod!=='finance'||JSON.stringify(previewBuild(body))!==build||Date.now()-Date.parse(quote.createdAt)>120000||pricingIssues(quote).length)continue;
   const plan=quote.financePlans?.find(x=>clean(x.brandId).toUpperCase()===previewBuild(snapshot).brandId);
   if(plan?.program&&validMoney(plan.monthlyPayment)&&validMoney(quote.total)&&(group==='any'||financeGroup(plan.program)===group))candidates.push({method:'finance',quote,program:plan.program,build:previewBuild(snapshot)});
  }catch(_){}}
  candidates.sort((a,b)=>number(a.program.APR)-number(b.program.APR)||number(b.program.TermMonths)-number(a.program.TermMonths));return candidates[0]||null;
 }
 function restoreFinance(snapshot){
  const layout=financeLayouts.get(JSON.stringify(previewBuild(snapshot)))||{primary:'any',dual:false,hasRebate:false};
  const primary=savedFinance(snapshot,layout.primary),secondary=layout.dual?savedFinance(snapshot,'inlieu'):null;
  if(!primary)return false;setFinanceLayout(snapshot,{...layout,dual:layout.dual&&!!secondary});
  for(const [method,saved,target] of [['finance',primary,output],['finance-inlieu',secondary,inLieuOutput]]){
   if(!saved||!target)continue;const plan=saved.quote.financePlans?.find(x=>clean(x.program?.ProgramID)===clean(saved.program.ProgramID));if(!plan)continue;
   paymentPreviews.set(method,{...saved,method});financeDetails(saved.quote,plan,snapshot,false,target);
  }highlightPayment();return true;
 }
 function rememberPaymentPreview(method,quote,program,snapshot){
  if(Array.isArray(quote.issues)&&!pricingIssues(quote).length&&validMoney(quote.total)){
   const saved={method,quote,program,build:previewBuild(snapshot)};paymentPreviews.set(method,saved);
   if(financeMethod(method))for(const group of ['any',financeGroup(program)]){const key=JSON.stringify(saved.build)+'|'+group,previous=lastGoodFinance.get(key);if(!previous||number(program.APR)<number(previous.program.APR)||number(program.APR)===number(previous.program.APR)&&number(program.TermMonths)>=number(previous.program.TermMonths))lastGoodFinance.set(key,saved);}
   if(lastGoodFinance.size>60)lastGoodFinance.delete(lastGoodFinance.keys().next().value);
  }
 }
 // Carry customer quote snapshots, never dealer costs or payment credentials.
 function checkoutCarry(){
  const build=lastSnapshot?JSON.stringify(previewBuild(lastSnapshot)):'';
  return {quote:lastResponse,selectedPaymentBox:selectedPaymentCard(),financeLayout:{...financeLayout},paymentBoxes:[...paymentPreviews.values()].filter(col=>JSON.stringify(col.build)===build).map(col=>({method:col.method,quote:col.quote,program:col.program,build:col.build}))};
 }
 function selectedPaymentCard(){
  if(!paymentConfirmed)return '';if(!paymentSelect.value.startsWith('finance:'))return paymentSelect.value;
  const id=paymentSelect.value.slice(8),program=lastResponse?.financePlans?.find(p=>clean(p.program?.ProgramID)===id)?.program||programs.find(p=>clean(p.ProgramID)===id)||[...paymentPreviews.values()].find(p=>clean(p.program?.ProgramID)===id)?.program;
  return financeLayout.dual&&program&&!rebateCompatible(program)?'finance-inlieu':'finance';
 }
 function highlightPayment(){
  if(!panel||!deliverySelect)return;const selected=selectedPaymentCard();
  for(const card of panel.querySelectorAll('[data-payment-preview]')){
   const active=card.dataset.paymentPreview===selected;card.classList.toggle('is-selected',active);const badge=card.querySelector('.wep-payment-selected');badge.hidden=!active;badge.textContent='Selected';
   card.querySelector('.wep-payment-card-choice')?.setAttribute('aria-pressed',String(active));
   card.hidden=(deliverySelect.value==='SHIP'&&card.dataset.paymentPreview!=='credit')||(card.dataset.paymentPreview==='finance-inlieu'&&!financeLayout.dual);
  }syncFinanceAction();
 }
 function syncFinanceAction(){
  const selectedCard=selectedPaymentCard();
  for(const method of ['finance','finance-inlieu']){
   const card=panel?.querySelector('[data-payment-preview="'+method+'"]'),previous=card?.querySelector('.wep-view-all-payments');if(!card||!previous)continue;
   const selected=financeMethod(selectedCard)&&selectedCard===method;
   const id=selected?paymentSelect.value.slice(8):'',program=selected?lastResponse?.financePlans?.find(p=>clean(p.brandId).toUpperCase()===lastSnapshot?.brandId&&clean(p.program?.ProgramID)===id)?.program:null;
   let href='';if(selected&&program){try{const url=new URL(clean(program.ApplicationURL));if(url.protocol==='https:'&&!url.username&&!url.password)href=url.href;}catch(_){}}
   const label=selected?'Apply Online':'View All Financing Options',tag=href?'A':'BUTTON',disabled=selected&&!href;
   if(previous.tagName!==tag||previous.textContent!==label||(previous.getAttribute('href')||'')!==href||(tag!=='A'&&previous.disabled!==disabled)){
    const action=document.createElement(href?'a':'button');action.className='wep-view-all-payments'+(selected?' wep-finance-apply':'');action.textContent=label;
    if(href){action.href=href;action.target='_blank';action.rel='noopener noreferrer';action.setAttribute('aria-label','Apply online for '+programLabel(program));}
    else{action.type='button';action.disabled=disabled;if(disabled)action.title=program?'No online application link is listed for this program.':'Checking the selected financing program…';}previous.replaceWith(action);
   }
   let change=card.querySelector('.wep-change-financing');if(selected&&!change){change=document.createElement('button');change.type='button';change.className='wep-change-financing';change.textContent='Change Financing';card.append(change);}else if(!selected&&change)change.remove();
   const rebate=card.querySelector('.wep-payment-rebate-footer,.wep-finance-expiry-footer');if(rebate&&card.lastElementChild!==rebate)card.append(rebate);
  }
 }
 function alignInLieuCard(container){
  const reference=container?.querySelector('[data-payment-preview="finance"]'),card=container?.querySelector('[data-payment-preview="finance-inlieu"]');
  if(!reference||!card||card.hidden)return;
  const selectors=['h4','.wep-build-finance-program','.wep-build-finance-monthly','.wep-view-all-payments'];
  const heading=card.querySelector('h4'),refHeading=reference.querySelector('h4');
  for(const selector of [...selectors,'.wep-change-financing']){const el=card.querySelector(selector);if(el)el.style.translate='';}
  if(!heading||!refHeading)return;
  heading.style.fontSize='';heading.style.whiteSpace='';heading.style.lineHeight='';
  const sameRow=Math.abs(reference.getBoundingClientRect().top-card.getBoundingClientRect().top)<3;
  if(!sameRow)return;
  const headingStyle=getComputedStyle(refHeading);heading.style.whiteSpace='nowrap';heading.style.lineHeight=headingStyle.lineHeight;
  let size=parseFloat(headingStyle.fontSize);heading.style.fontSize=size+'px';
  while(heading.scrollWidth>heading.clientWidth&&size>9){size-=.25;heading.style.fontSize=size+'px';}
  let actionShift=0;
  for(const selector of selectors){
   const from=reference.querySelector(selector),to=card.querySelector(selector);if(!from||!to)continue;
   const offset=from.getBoundingClientRect().top-to.getBoundingClientRect().top;to.style.translate='0 '+offset+'px';
   if(selector==='.wep-view-all-payments')actionShift=offset;
  }
  const change=card.querySelector('.wep-change-financing');if(change)change.style.translate='0 '+actionShift+'px';
 }
 function syncPaymentCards(){
  const source=panel?.querySelector('.wep-package-payment-previews'),host=app.querySelector('.wep-itemized-payment-cards');
  if(!source||!host)return;
  alignInLieuCard(source);
  const html=source.innerHTML;if(host._wepPaymentMarkup===html){alignInLieuCard(host);return;}
  host._wepPaymentMarkup=html;host.innerHTML=html;
  for(const el of host.querySelectorAll('[id]'))el.removeAttribute('id');
  alignInLieuCard(host);
 }
 function applyPaymentQuote(col,build){
  if(JSON.stringify(build)!==JSON.stringify(previewBuild(compareState()))||Date.now()-Date.parse(col.quote.createdAt)>300000)throw Error('Your build changed or pricing expired. Reopen payment options for current pricing.');
  if(pricingIssues(col.quote).length||!validMoney(col.quote.total))throw Error('This payment option needs store confirmation.');
  const value=col.program?'finance:'+clean(col.program.ProgramID):col.method;
  if(![...paymentSelect.options].some(o=>o.value===value))paymentSelect.append(new Option(col.program?programLabel(col.program):col.method==='cash'?'Cash / Bank Check':'Credit Card',value));
  paymentSelect.value=value;paymentConfirmed=true;preferred=col.program?clean(col.program.ProgramID):'';
  cartPaused=false;saveCurrentBuild();++generation;controller?.abort();clearTimeout(timer);
  const snapshot=state();render(col.quote,col.quote.financePlans?.find(p=>clean(p.brandId).toUpperCase()===snapshot.brandId),snapshot);lastApplied=JSON.stringify(snapshot);
 }
 function selectPaymentPreview(method){
  if(deliverySelect.value==='SHIP'&&method!=='credit')return;
  const selected=selectedPaymentCard();
  if(selected===method){
   paymentConfirmed=false;paymentSelect.value='';preferred='';checkoutPending=false;cartPaused=false;
   schedule(true);return;
  }
  try{
   const col=paymentPreviews.get(method);
   if(col&&Date.now()-Date.parse(col.quote.createdAt)<=300000){applyPaymentQuote(col,col.build);return;}
   if(financeMethod(method)){
    if(!col?.program){openComparison(true,comparisonGroup(method));return;}
    const value='finance:'+clean(col.program.ProgramID);if(![...paymentSelect.options].some(o=>o.value===value))paymentSelect.append(new Option(programLabel(col.program),value));
    paymentSelect.value=value;paymentConfirmed=true;preferred=clean(col.program.ProgramID);cartPaused=false;schedule(true);return;
   }
   paymentSelect.value=method;paymentConfirmed=true;preferred='';cartPaused=false;schedule(true);
  }catch(error){const message=document.getElementById('options-message');if(message)message.textContent=error.message;schedule(true);}
 }
 function comparisonGroup(method){return method==='finance-inlieu'?'inlieu':financeLayout.hasRebate?financeLayout.primary:'any';}
 // Both stacks use native buttons and the same confirmed payment responses.
 app.addEventListener('click',event=>{
  const change=event.target.closest('.wep-change-financing');if(change){event.preventDefault();event.stopImmediatePropagation();openComparison(true,comparisonGroup(change.closest('[data-payment-preview]')?.dataset.paymentPreview));return;}
  const all=event.target.closest('.wep-view-all-payments');
  if(all){if(all.tagName==='A'){remember();return;}if(all.disabled)return;event.preventDefault();event.stopImmediatePropagation();openComparison(true,comparisonGroup(all.closest('[data-payment-preview]')?.dataset.paymentPreview));return;}
  const card=event.target.closest('[data-payment-preview]');
  if(card&&!event.target.closest('a,input,select')){event.preventDefault();event.stopImmediatePropagation();selectPaymentPreview(card.dataset.paymentPreview);}
 },true);

 // Reuse eligibility for the identical stock/configuration for at most one minute.
 // Every final package price still comes from the quote service.
 const eligibilityCache=new Map(),eligibilityRequests=new Map();
 function waitForEligibility(job,signal){
  if(signal.aborted)return Promise.reject(new DOMException('Changed','AbortError'));
  return new Promise((resolve,reject)=>{
   const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Changed','AbortError'));};
   signal.addEventListener('abort',abort,{once:true});
   job.then(value=>{signal.removeEventListener('abort',abort);if(!signal.aborted)resolve(value);},error=>{signal.removeEventListener('abort',abort);if(!signal.aborted)reject(error);});
  });
 }
 function eligiblePrograms(snapshot,signal){
  const main=snapshot.items[0],selectionItems=snapshot.items.slice(1).map(x=>({sku:x.sku,quantity:x.quantity})).sort((a,b)=>a.sku.localeCompare(b.sku));
  const body={brandId:snapshot.brandId,sku:snapshot.sku,quantity:main.quantity,inventoryId:main.inventoryId,...(main.inventoryId?{inventorySelectionRequired:true}:{}),...(selectionItems.length?{selectionItems}:{})};
  const key=JSON.stringify(body),cached=eligibilityCache.get(key);
  if(cached&&Date.now()-cached.time<60000)return signal.aborted?Promise.reject(new DOMException('Changed','AbortError')):Promise.resolve(cached.value);
  let job=eligibilityRequests.get(key);
  if(!job){
   const ac=new AbortController();
   job=post('/customer-finance-programs',body,ac.signal).then(value=>{if(Array.isArray(value.programs)){eligibilityCache.set(key,{value,time:Date.now()});if(eligibilityCache.size>20)eligibilityCache.delete(eligibilityCache.keys().next().value);}return value;}).finally(()=>eligibilityRequests.delete(key));
   eligibilityRequests.set(key,job);
  }
  return waitForEligibility(job,signal);
 }
 function includedRebate(base,quote){
  if(!validMoney(base?.merchandise)||!validMoney(quote?.merchandise)||!Array.isArray(quote.lines))return 0;
  const paymentSavings=quote.lines.reduce((n,line)=>n+(validMoney(line.discount)?line.discount:0),0);
  return Math.max(0,Math.round((base.merchandise-quote.merchandise-paymentSavings)*100)/100);
 }
 function paymentSavings(quote){return Array.isArray(quote?.lines)?Math.round(quote.lines.reduce((n,line)=>n+(validMoney(line.discount)?line.discount:0),0)*100)/100:0;}
 function offerMetadataActive(offer,createdAt){
  const day=new Date(createdAt);if(!Number.isFinite(day.getTime()))return false;day.setHours(0,0,0,0);
  for(const [key,isStart] of [['startDate',true],['endDate',false]]){const raw=clean(offer[key]);if(!raw)continue;const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T12:00:00':raw);if(!Number.isFinite(date.getTime()))return false;date.setHours(0,0,0,0);if(isStart?day<date:day>date)return false;}
  return true;
 }
 function appendManufacturerRebate(target,quote,amount){
  const card=target.closest('.wep-package-payment-card');if(!card)return;
  card.querySelector('.wep-payment-rebate-footer')?.remove();
  if(!(amount>0))return;
  const footer=document.createElement('div');footer.className='wep-payment-rebate-footer';
  footer.append(note(money(amount)+' manufacturer rebate included','wep-build-offer-saving'));
  const offers=Array.isArray(window.WEPBuildRebateOffers)?window.WEPBuildRebateOffers:[],details=[];
  for(const line of quote.lines||[]){const rows=offers.filter(o=>o.type===line.type&&clean(o.sku).toUpperCase()===clean(line.sku).toUpperCase()&&offerMetadataActive(o,quote.createdAt));if(rows.length===1&&validMoney(rows[0].amount)&&Number.isInteger(Number(line.quantity))&&Number(line.quantity)>0)details.push({...rows[0],amount:Math.round(rows[0].amount*Number(line.quantity)*100)/100});}
  if(details.length&&Math.abs(details.reduce((n,o)=>n+o.amount,0)-amount)<.01){
   for(const raw of [...new Set(details.map(o=>clean(o.endDate)).filter(Boolean))]){const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T12:00:00':raw);if(Number.isFinite(date.getTime()))footer.append(note('Ends '+date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),'wep-rebate-expiry'));}
  }
  card.append(footer);
 }
 function financeRebate(quote,snapshot){
  const build=JSON.stringify(previewBuild(snapshot));
  for(const [raw,base] of quoteCache){try{const body=JSON.parse(raw);if(body.paymentMethod==='standard'&&JSON.stringify(previewBuild(body))===build&&!pricingIssues(base).length&&Date.now()-Date.parse(base.createdAt)<=300000)return includedRebate(base,quote);}catch(_){}}
  return 0;
 }
 function pricePreview(target,quote,rebate=0){
  target.replaceChildren();appendManufacturerRebate(target,quote,0);
  if(pricingIssues(quote).length||!validMoney(quote.total)){target.append(note('Complete your package to view total.'));return;}
  target.append(note(money(quote.total),'wep-package-payment-total'),note('Out the door price','wep-package-payment-caption'));
  appendManufacturerRebate(target,quote,rebate);
 }
 function stopOffers(){++offersVersion;offersController?.abort();offersBuildKey='';paymentPreviews.clear();}
 let offerDisclaimer;
 function disclaimer(plan){
  if(!offerDisclaimer){offerDisclaimer=document.createElement('footer');offerDisclaimer.className='wep-build-offer-disclaimer';app.after(offerDisclaimer);}
  offerDisclaimer.replaceChildren();
  if(!plan?.program){offerDisclaimer.append(note('Manufacturer rebates and financing offers depend on current program eligibility. See payment options for your package.'));return;}
  const p=plan.program;
  offerDisclaimer.append(note((clean(p.Lender)?clean(p.Lender)+'. ':'')+'Estimated payment for this configured package. '+money(plan.requiredDown)+' down; '+money(plan.applicationFee||0)+' application fee included. Subject to credit approval. '+(/^(F|FALSE|NO|N|0)$/i.test(clean(p.RebateCompatible))?'This financing offer is in lieu of customer rebates. ':'')+'Final lender payment may vary. See your quote for financing details.'));
  for(const t of [...new Set([p.Disclaimer,p.Disclosure,p.Requirements,p.Terms].map(clean).filter(Boolean))])offerDisclaimer.append(note(t));
  try{const u=new URL(clean(p.ApplicationURL));if(u.protocol==='https:'){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Apply for Financing ↗';a.onclick=remember;offerDisclaimer.append(a);}}catch(_){}
 }
 function financeDetails(quote,plan,snapshot,selected,target=output){
  panel.hidden=false;target.closest('.wep-package-payment-card')?.querySelector('.wep-finance-expiry-footer')?.remove();target.replaceChildren();appendManufacturerRebate(target,quote,0);target.setAttribute('aria-busy','false');if(!plan?.program)return;
  target.append(note(number(plan.program.APR)+'% APR · '+number(plan.program.TermMonths)+' months*','wep-build-finance-program'));
  if(pricingIssues(quote).length||!validMoney(quote.total)||!validMoney(plan.monthlyPayment)||!validMoney(plan.requiredDown)){target.append(note('Complete your package to view payments.'));return;}
  const monthly=note('','wep-build-finance-monthly'),strong=document.createElement('strong');strong.textContent=money(plan.monthlyPayment);monthly.append(strong,document.createTextNode(' / month (est.)'));target.append(monthly);
  if(plan.requiredDown>0)target.append(note(money(plan.requiredDown)+' required down','wep-finance-rebate-note'));
  if(rebateCompatible(plan.program))appendManufacturerRebate(target,quote,financeRebate(quote,snapshot));
  if(target===inLieuOutput&&clean(plan.program.EndDate)){
   const raw=clean(plan.program.EndDate),date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T12:00:00':raw);
   if(Number.isFinite(date.getTime())){const footer=document.createElement('div');footer.className='wep-finance-expiry-footer';footer.append(note('Ends '+date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),'wep-rebate-expiry'));target.closest('.wep-package-payment-card')?.append(footer);}
  }
  if(target===output){offerPlan=plan;syncOfferJoin();disclaimer(lastResponse?.paymentMethod==='finance'?lastResponse.financePlans?.find(p=>clean(p.brandId).toUpperCase()===snapshot.brandId)||plan:plan);}
 }
 async function updateOffers(snapshot,currentQuote){
  if(snapshot.fulfillment==='SHIP'){
   stopOffers();pricePreview(creditOutput,currentQuote);rememberPaymentPreview('credit',currentQuote,null,snapshot);highlightPayment();syncPaymentCards();return;
  }
  const buildKey=JSON.stringify(previewBuild(snapshot));
  // Payment choice changes the applied quote, not the other methods' offers.
  if(offersBuildKey===buildKey&&offersController&&!offersController.signal.aborted){highlightPayment();syncPaymentCards();return;}
  panel?.querySelectorAll('.wep-payment-rebate-footer,.wep-finance-expiry-footer').forEach(el=>el.remove());
  stopOffers();offersBuildKey=buildKey;offerPlan=null;offerRebate=0;syncOfferJoin();disclaimer(null);offersController=new AbortController();const signal=offersController.signal,id=offersVersion;
  const fresh=()=>id===offersVersion&&!signal.aborted&&buildKey===JSON.stringify(previewBuild(compareState()));
  const body=method=>({items:snapshot.items,paymentMethod:method,fulfillment:snapshot.fulfillment,zip:snapshot.zip,financeProgramIds:{}});
  highlightPayment(snapshot);promoOutput.replaceChildren(note('Calculating your total…'));creditOutput.replaceChildren(note('Calculating your total…'));
  panel.hidden=false;if(!restoreFinance(snapshot)){output.replaceChildren(note('Calculating financing for your package…'));output.setAttribute('aria-busy','true');}
  const previewQuotes=new Map();
  const getQuote=method=>{
   if(!previewQuotes.has(method))previewQuotes.set(method,(async()=>{const q=currentQuote.paymentMethod===method?currentQuote:await packageQuote(body(method),signal);if(snapshot.items.some(x=>x.inventoryId)&&q.stockPricingVersion!==1)throw Error('Stock pricing could not be verified.');return q;})());
   return previewQuotes.get(method);
  };
  const loadPrice=async(method,target)=>{try{
   const quote=await getQuote(method);if(!fresh())return;rememberPaymentPreview(method,quote,null,snapshot);pricePreview(target,quote);
   // Rebate metadata must not block a valid package total.
   try{const base=await getQuote('standard');if(fresh())pricePreview(target,quote,includedRebate(base,quote));}catch(_){}
  }catch(error){if(fresh())target.replaceChildren(note('Open payment options to retry.'));}};
  const rebateTask=loadPrice('cash',promoOutput),creditTask=loadPrice('credit',creditOutput);
  const financeTask=(async()=>{try{
   const result=await eligiblePrograms(snapshot,signal);
   if(!fresh())return;const candidates=validPrograms(result.programs);programs=candidates;
   const findEligible=async rows=>{for(const p of rows){try{
    const q=await packageQuote({...body('finance'),financeProgramIds:{[snapshot.brandId]:clean(p.ProgramID)}},signal,p);if(!fresh())return null;
    if(snapshot.items.some(x=>x.inventoryId)&&q.stockPricingVersion!==1)throw Error('Stock pricing could not be verified.');
    const plan=q.financePlans?.find(x=>clean(x.brandId).toUpperCase()===snapshot.brandId&&clean(x.program?.ProgramID)===clean(p.ProgramID));
    if(!plan||pricingIssues(q).length)continue;
    if(!validMoney(q.total)||!validMoney(plan.monthlyPayment)||!validMoney(plan.requiredDown))throw Error('The financing program could not be confirmed.');
    return {quote:q,program:plan.program,plan};
   }catch(error){if(signal.aborted||!fresh())return null;if(error.httpStatus===400&&/not eligible|financed amount.*limits|requires full payment upfront/i.test(error.message))continue;throw error;}}return null;};
   const baseTask=getQuote('standard').catch(()=>null),cashTask=getQuote('cash').catch(()=>null);
   const offers=Array.isArray(window.WEPBuildRebateOffers)?window.WEPBuildRebateOffers:[];
   const metadataHint=snapshot.items.some(item=>offers.some(o=>o.type===item.type&&clean(o.sku).toUpperCase()===clean(item.sku).toUpperCase()&&o.amount>0&&offerMetadataActive(o,currentQuote.createdAt)));
   // Start eligible financing quotes before the independent cash preview finishes.
   const compatibleTask=metadataHint?findEligible(candidates.filter(rebateCompatible)):null;
   const inlieuTask=metadataHint?findEligible(candidates.filter(p=>!rebateCompatible(p))):null;
   const base=await baseTask;if(!fresh())return;
   const cashRebate=metadataHint?includedRebate(base,paymentPreviews.get('cash')?.quote):includedRebate(base,await cashTask);if(!fresh())return;
   const hint=metadataHint||cashRebate>0;
   let primary=null,secondary=null,layout={primary:'any',dual:false,hasRebate:false};
   if(hint){
    const dualPending=metadataHint&&candidates.some(rebateCompatible)&&candidates.some(p=>!rebateCompatible(p));
    if(dualPending){
     setFinanceLayout(snapshot,{primary:'compatible',dual:true,hasRebate:true});
     for(const [method,target,rows] of [['finance',output,candidates.filter(rebateCompatible)],['finance-inlieu',inLieuOutput,candidates.filter(p=>!rebateCompatible(p))]]){
      const saved=paymentPreviews.get(method),expected=method==='finance'?'compatible':'inlieu';
      if(saved?.program&&financeGroup(saved.program)===expected&&rows.some(p=>clean(p.ProgramID)===clean(saved.program.ProgramID)))continue;
      paymentPreviews.delete(method);target.closest('.wep-package-payment-card')?.querySelectorAll('.wep-payment-rebate-footer,.wep-finance-expiry-footer').forEach(el=>el.remove());
      target.replaceChildren(note(number(rows[0].APR)+'% APR · '+number(rows[0].TermMonths)+' months*','wep-build-finance-program'),note('Calculating payment…','wep-build-finance-monthly'));target.setAttribute('aria-busy','true');
     }
     syncPaymentCards();
    }
    const showReady=(result,method)=>{
     if(!result||!fresh())return result;
     if(dualPending){const target=method==='finance'?output:inLieuOutput;rememberPaymentPreview(method,result.quote,result.program,snapshot);financeDetails(result.quote,result.plan,snapshot,false,target);}
     else{setFinanceLayout(snapshot,{primary:financeGroup(result.program),dual:false,hasRebate:metadataHint||cashRebate>0});rememberPaymentPreview('finance',result.quote,result.program,snapshot);financeDetails(result.quote,result.plan,snapshot,false,output);}
     highlightPayment();syncPaymentCards();return result;
    };
    const results=await Promise.allSettled([(compatibleTask||findEligible(candidates.filter(rebateCompatible))).then(result=>showReady(result,'finance')),(inlieuTask||findEligible(candidates.filter(p=>!rebateCompatible(p)))).then(result=>showReady(result,'finance-inlieu'))]);if(!fresh())return;
    if(dualPending&&results.some(r=>r.status==='rejected')){
     for(const [index,method,target] of [[0,'finance',output],[1,'finance-inlieu',inLieuOutput]])if(results[index].status==='rejected'&&!paymentPreviews.has(method)){target.replaceChildren(note('Payment could not be loaded. View all financing options to retry.'));target.setAttribute('aria-busy','false');}
     highlightPayment();syncPaymentCards();return;
    }
    const compatible=results[0].status==='fulfilled'?results[0].value:null,inlieu=results[1].status==='fulfilled'?results[1].value:null;
    const compatibleRebate=base&&compatible?includedRebate(base,compatible.quote):0;
    if(compatibleRebate>0&&compatible&&inlieu){primary=compatible;secondary=inlieu;layout={primary:'compatible',dual:true,hasRebate:true};}
    else{primary=[compatible,inlieu].filter(Boolean).sort((a,b)=>number(a.program.APR)-number(b.program.APR)||number(b.program.TermMonths)-number(a.program.TermMonths))[0]||null;layout={primary:primary?financeGroup(primary.program):'any',dual:false,hasRebate:!!primary&&(compatibleRebate>0||cashRebate>0)};}
    if(!primary&&results.some(r=>r.status==='rejected'))throw results.find(r=>r.status==='rejected').reason;
   }else primary=await findEligible(candidates);
   if(!fresh())return;
   if(!primary){if(!restoreFinance(snapshot)){output.replaceChildren(note('No eligible program for this package.'));output.setAttribute('aria-busy','false');}return;}
   setFinanceLayout(snapshot,layout,true);
   rememberPaymentPreview('finance',primary.quote,primary.program,snapshot);financeDetails(primary.quote,primary.plan,snapshot,false,output);
   if(secondary){rememberPaymentPreview('finance-inlieu',secondary.quote,secondary.program,snapshot);financeDetails(secondary.quote,secondary.plan,snapshot,false,inLieuOutput);}
   else{paymentPreviews.delete('finance-inlieu');inLieuOutput.replaceChildren();}
   highlightPayment();syncPaymentCards();
  }catch(error){if(fresh()){if(!restoreFinance(snapshot))output.replaceChildren(note('Financing options could not be loaded. View all financing options to retry.'));output.setAttribute('aria-busy','false');}}})();
  await Promise.all([rebateTask,creditTask,financeTask]);
 }

 function render(quote,plan,snapshot){
  if(!Array.isArray(quote.lines)||!quote.lines.length||!Array.isArray(quote.issues))throw Error('Current pricing could not be confirmed.');
  panel.hidden=false;
  const main=quote.lines.find(l=>l.type==='tool'&&clean(l.sku)===snapshot.sku),price=app.querySelector('.hero .price');
  if(!main||!validMoney(main.unitPrice))throw Error('Equipment pricing needs store confirmation.');
  const msrp=number(price.dataset.wepMsrp);price.textContent=msrp>0?money(msrp):'Contact Us';priceExtra.replaceChildren(note('MSRP','wep-build-msrp'));
  totals.replaceChildren();const dl=document.createElement('dl');
  for(const [name,value] of [['Merchandise',quote.merchandise],['Installation / Set-Up',quote.installation],['Freight',quote.freight],['Local delivery',snapshot.fulfillment==='DELIVERY'?quote.delivery:0],['Package subtotal',quote.subtotal],['Tax',quote.tax],['Total',quote.total]]){

   dl.append(field(name,validMoney(value)?money(value):'Needs confirmation'));
  }totals.append(dl);
  const subtotal=document.getElementById('wep-cart-subtotal');if(subtotal)subtotal.textContent=validMoney(quote.subtotal)?money(quote.subtotal):'Needs confirmation';
  lastResponse=quote;lastSnapshot=snapshot;remember();if(snapshot.paymentMethod==='finance'&&plan)disclaimer(plan);else if(offerPlan)disclaimer(offerPlan);publishItemized(quote);syncPaymentCards();updateOffers(snapshot,quote);
 }
 async function run(id){
  if(id!==generation||!panel?.isConnected)return;
  try{
   let snapshot=state();activeSignature=JSON.stringify(snapshot);lastStarted=Date.now();controller=new AbortController();const signal=controller.signal;
   if(snapshot.paymentMethod!=='finance'){
    eligiblePrograms(snapshot,signal).catch(()=>{});
    const quote=await packageQuote({items:snapshot.items,paymentMethod:snapshot.paymentMethod,fulfillment:snapshot.fulfillment,zip:snapshot.zip,financeProgramIds:{}},signal);
    if(id!==generation||activeSignature!==JSON.stringify(state()))return;
    if(snapshot.items.some(x=>x.inventoryId)&&quote.stockPricingVersion!==1)throw Error('Selected stock pricing could not be verified.');
    render(quote,null,snapshot);lastApplied=activeSignature;return;
   }
   const result=await eligiblePrograms(snapshot,signal);
   if(id!==generation)return;
   const rows=(result.programs||[]).filter(p=>clean(p.ProgramID)&&clean(p.APR)!==''&&Number.isFinite(number(p.APR))&&number(p.APR)>=0&&Number.isInteger(number(p.TermMonths))&&number(p.TermMonths)>0).sort((a,b)=>number(a.APR)-number(b.APR)||number(b.TermMonths)-number(a.TermMonths));
   const automatic=snapshot.paymentMethod==='finance'&&!preferred&&!snapshot.programId;
   setPrograms(rows,snapshot);snapshot=state();activeSignature=JSON.stringify(snapshot);
   const candidates=snapshot.paymentMethod==='finance'?(automatic?rows:rows.filter(p=>clean(p.ProgramID)===snapshot.programId)):[null];
   if(!candidates.length)throw Error('Choose an available payment option.');
   for(const candidate of candidates){
   if(candidate){paymentSelect.value='finance:'+clean(candidate.ProgramID);snapshot=state();activeSignature=JSON.stringify(snapshot);}
   if(id!==generation)return;
   let quote;try{quote=await packageQuote({items:snapshot.items,paymentMethod:snapshot.paymentMethod,fulfillment:snapshot.fulfillment,zip:snapshot.zip,financeProgramIds:snapshot.paymentMethod==='finance'?{[snapshot.brandId]:snapshot.programId}:{}},signal,candidate);}catch(error){if(automatic&&error.httpStatus===400&&/not eligible|financed amount.*limits|requires full payment upfront/i.test(error.message))continue;throw error;}
   if(id!==generation||activeSignature!==JSON.stringify(state()))return;
   if(snapshot.items.some(x=>x.inventoryId)&&quote.stockPricingVersion!==1)throw Error('The quote service must confirm in-stock pricing before displaying this build.');
   const plan=quote.financePlans?.find(p=>clean(p.brandId).toUpperCase()===snapshot.brandId);
   preferred=snapshot.programId;render(quote,plan,snapshot);lastApplied=activeSignature;return;
   }
   throw Error('No eligible financing program fits this package. Choose cash / bank check, credit card, or another program.');
  }catch(error){if(id!==generation)return;lastResponse=null;lastSnapshot=null;let preserve=false;try{preserve=offersBuildKey===JSON.stringify(previewBuild(compareState()))||!!savedFinance(compareState());}catch(_){}
   showListedBuild(pricingFailure(error),preserve);output.setAttribute('aria-busy','false');if(preserve)restoreFinance(compareState());
   const message=document.getElementById('options-message');if(message){message.replaceChildren(document.createTextNode(pricingFailure(error)+' '));const retry=document.createElement('button');retry.type='button';retry.textContent='Retry current pricing';retry.onclick=()=>schedule(true);message.append(retry);}
  }
 }
 function schedule(force=false,persist=true){
  if(!panel?.isConnected||departing||autoSaving)return;
  if(!inventoryReady){inventoryPricingStatus(inventoryPromise?'Checking stock before calculating payment prices…':'Stock check required before calculating payment prices.',!inventoryPromise);return;}
  refreshStockControls();
  if(comparisonDialog?.open){comparisonController?.abort();comparisonDialog.close();}
  let s;try{s=state();if(s.fulfillment==='DELIVERY'&&!/^\d{5}$/.test(s.zip))throw Error('Enter a five-digit ZIP for local delivery.');}catch(error){++generation;controller?.abort();clearTimeout(timer);invalidate(error.message);status(error.message);output.setAttribute('aria-busy','false');remember();return;}
  refreshShipping(s);
  try{if(persist)saveCurrentBuild();}catch(error){showListedBuild(error.message);return;}
  if(s.fulfillment==='SHIP'){shippingStage();return;}
  const signature=JSON.stringify(s);if(!force&&signature===lastApplied&&lastResponse)return;
  const preserveOffers=offersBuildKey===JSON.stringify(previewBuild(s));
  ++generation;const id=generation;clearTimeout(timer);controller?.abort();invalidate('Updating this package…',preserveOffers);status('Updating current price and payment…',preserveOffers);remember();
  timer=setTimeout(()=>run(id),450);
 }
 let shippingKey='',shippingEligible=false,shippingController,shippingVersion=0;
 function shippingSignature(s){return JSON.stringify(s.items);}
 function refreshShipping(s){
  const key=shippingSignature(s);if(key===shippingKey)return;
  shippingKey=key;shippingEligible=false;shippingController?.abort();shippingController=new AbortController();const id=++shippingVersion;
  const option=deliverySelect.querySelector('[value="SHIP"]');option.hidden=true;option.disabled=true;
  post('/marketplace-fulfillment-options',{items:s.items},shippingController.signal).then(result=>{
   if(id!==shippingVersion||key!==shippingKey)return;
   shippingEligible=result.shipEligible===true;option.hidden=!shippingEligible;option.disabled=!shippingEligible;
   if(!shippingEligible&&deliverySelect.value==='SHIP'){deliverySelect.value='NEW_MILFORD';const message=document.getElementById('options-message');if(message)message.textContent='This package requires pickup or local delivery.';schedule(true);}
  }).catch(()=>{if(id===shippingVersion){shippingKey='';shippingEligible=false;}});
 }
 function shippingStage(){
  updatePaymentSelection();
  ++generation;controller?.abort();clearTimeout(timer);stopOffers();lastResponse=null;lastSnapshot=null;disclaimer(null);highlightPayment(null);
  panel.hidden=false;output.setAttribute('aria-busy','false');
  promoOutput.replaceChildren(note('Store pickup / local delivery only.'));
  creditOutput.replaceChildren(note('Enter your shipping address below to calculate shipping and tax.'));
  output.replaceChildren(note('Store pickup / local delivery only.'));
  totals.replaceChildren(note('Enter your shipping address below for your UPS shipping price and total.'));
  publishItemized(null,"Enter your shipping address at checkout for UPS shipping and tax totals.");
 }
 function shippingCheckout(){
  try{
   if(cartPaused)throw Error('Choose equipment or options before continuing.');
   const snapshot=state();if(!shippingEligible||shippingKey!==shippingSignature(snapshot))throw Error('Shipping eligibility is still being checked. Please try again.');
   saveCurrentBuild();paymentSelect.value='credit';paymentConfirmed=true;preferred='';remember();
   if(window.WEPInlineCheckout){window.WEPInlineCheckout.open();return;}
   sessionStorage.setItem('wepBuildCheckoutChoices',JSON.stringify({paymentConfirmed:true,paymentMethod:'credit',fulfillment:'SHIP',zip:'',brandId:snapshot.brandId,sku:snapshot.sku,items:snapshot.items,financeProgramIds:{},...checkoutCarry(),updated:Date.now()}));
   departing=true;location.assign('checkout.html'+(query.get('api')==='local'?'?api=local':''));
  }catch(error){const message=document.getElementById('options-message');if(message)message.textContent=error.message;}
 }
 let comparisonDialog,comparisonController,comparisonGeneration=0,comparisonColumns=[],comparisonSnapshot,comparisonTable,comparisonStatus,comparisonMore,comparisonNotice,comparisonBusy=false,comparisonOpener;
 function validPrograms(rows){return (rows||[]).filter(p=>clean(p.ProgramID)&&clean(p.APR)!==''&&Number.isFinite(number(p.APR))&&number(p.APR)>=0&&Number.isInteger(number(p.TermMonths))&&number(p.TermMonths)>0).sort((a,b)=>number(a.APR)-number(b.APR)||number(b.TermMonths)-number(a.TermMonths));}
 function compareState(){const s=selection();return {...s,fulfillment:deliverySelect.value,zip:deliverySelect.value==='DELIVERY'?zipInput.value.trim():''};}
 function comparisonFresh(){return comparisonSnapshot&&JSON.stringify(comparisonSnapshot)===JSON.stringify(compareState());}
 function renderComparison(){
  comparisonTable.replaceChildren();const head=document.createElement('thead');
  if(comparisonColumns.some(c=>c.program&&rebateCompatible(c.program))&&comparisonColumns.some(c=>c.program&&!rebateCompatible(c.program))&&financeLayout.hasRebate){
   const groups=document.createElement('tr');groups.className='wep-finance-group-head';const first=document.createElement('th');first.textContent='Financing choices';first.scope='col';groups.append(first);
   for(const [label,cols] of [['Cash / Card',comparisonColumns.filter(c=>!c.program)],['Keep Your Rebate',comparisonColumns.filter(c=>c.program&&rebateCompatible(c.program))],['Financing in Lieu of Rebates',comparisonColumns.filter(c=>c.program&&!rebateCompatible(c.program))]]){if(!cols.length)continue;const th=document.createElement('th');th.scope='colgroup';th.colSpan=cols.length;th.textContent=label;groups.append(th);}head.append(groups);
  }
  const tr=document.createElement('tr'),first=document.createElement('th');first.textContent='Price & Payment Details';first.scope='col';tr.append(first);
  for(const col of comparisonColumns){const th=document.createElement('th');th.scope='col';th.className=col.method;const title=document.createElement('strong');title.textContent=col.program?programLabel(col.program):col.method==='cash'?'Cash / Bank Check':'Credit Card';th.append(title);
   if(col.quote){const button=document.createElement('button');button.type='button';button.className='wep-payment-select';button.textContent='Select This Option';button.dataset.paymentChoice=col.program?'finance:'+clean(col.program.ProgramID):col.method;button.onclick=()=>acceptComparison(col);th.append(button);}
   else if(!col.error&&!col.loading)th.append(note('Not loaded'));
   if(col.error)th.append(note(col.error));else if(col.loading)th.append(note('Loading current pricing…'));
   tr.append(th);
  }head.append(tr);comparisonTable.append(head);
  const body=document.createElement('tbody'),rows=[
   ['Equipment price (each)',q=>q.lines.find(l=>l.type==='tool'&&clean(l.sku)===comparisonSnapshot.sku)?.unitPrice],
   ['Merchandise',q=>q.merchandise],['Installation / Set-Up',q=>q.installation],['Freight',q=>q.freight],['Local delivery',q=>comparisonSnapshot.fulfillment==='DELIVERY'?q.delivery:0],['Package subtotal',q=>q.subtotal],['Tax',q=>q.tax],['Out-the-Door Price',q=>q.total],
   ['Required down payment',q=>q.financePlans?.[0]?.requiredDown],['Application fee (financed)',q=>q.financePlans?.[0]?.applicationFee],['Amount financed including fee',q=>q.financePlans?.[0]?.principalWithFees],['Estimated Total of Payments',q=>pricingIssues(q).length?null:estimateTotalPayments(q.financePlans?.[0])],['Estimated monthly payment',q=>pricingIssues(q).length?null:q.financePlans?.[0]?.monthlyPayment]
  ];
  for(const [label,get,discount] of rows){const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=label;row.append(th);if(label==='Out-the-Door Price'||label==='Estimated monthly payment')row.className='wep-payment-total';
   for(const col of comparisonColumns){const td=document.createElement('td');td.className=col.method;const v=col.quote?get(col.quote):undefined;td.textContent=!col.quote?'—':!col.program&&label.match(/down payment|fee|financed|monthly payment|Total of Payments/)?'—':validMoney(v)?(discount&&v>0?'−':'')+money(v):'Needs confirmation';row.append(td);}body.append(row);
  }
  for(const label of ['Rebate compatibility','Program details','Application']){const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=label;row.append(th);
   for(const col of comparisonColumns){const td=document.createElement('td');td.className=col.method;const p=col.quote?.financePlans?.[0]?.program||col.program;
    if(label==='Rebate compatibility')td.textContent=p?(/^(F|FALSE|NO|N|0)$/i.test(clean(p.RebateCompatible))?'In lieu of customer rebates':'Compatible rebates included'):'—';
    else if(label==='Program details')td.textContent=[col.quote?.issues?.join(' '),p?clean(p.Lender):'',p?clean(p.EndDate)?'Ends '+clean(p.EndDate):'':'',...(p?[p.Disclaimer,p.Disclosure,p.Requirements,p.Terms].map(clean).filter(Boolean):[])].filter(Boolean).join(' · ')||'—';
    else{td.textContent='—';try{const u=new URL(clean(p?.ApplicationURL));if(u.protocol==='https:'){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Online Application ↗';a.onclick=remember;td.replaceChildren(a);}}catch(_){}}
    row.append(td);
   }body.append(row);
  }comparisonTable.append(body);
  const remaining=comparisonColumns.filter(c=>!c.quote&&!c.error&&!c.loading).length;comparisonMore.hidden=!remaining;comparisonMore.disabled=comparisonBusy;comparisonMore.textContent='Load More Payment Options ('+remaining+' remaining)';
 }
 function acceptComparison(col){
  try{
   if(!comparisonFresh())throw Error('Your build changed. Reopen payment options for current pricing.');
   applyPaymentQuote(col,previewBuild(comparisonSnapshot));comparisonDialog.close();if(checkoutPending){queueMicrotask(()=>document.getElementById('review-package')?.click());}
  }catch(error){comparisonStatus.textContent=error.message;}
 }

 async function loadComparisonBatch(batch,id){
  if(comparisonBusy||!batch.length)return;comparisonBusy=true;comparisonNotice.hidden=false;renderComparison();
  let cursor=0;
  async function next(){for(;;){const col=batch[cursor++];if(!col||id!==comparisonGeneration||!comparisonDialog.open||!comparisonFresh())return;col.loading=true;renderComparison();comparisonStatus.textContent='Building prices and payments for your selected package. Choose any option as soon as it is ready.';
   try{const signal=comparisonController.signal;if(id!==comparisonGeneration||!comparisonFresh())return;
    const s=comparisonSnapshot,q=await packageQuote({items:s.items,paymentMethod:col.method,fulfillment:s.fulfillment,zip:s.zip,financeProgramIds:col.program?{[s.brandId]:clean(col.program.ProgramID)}:{}},signal,col.program);
    if(id!==comparisonGeneration||!comparisonFresh()||!comparisonDialog.open)return;
    if(!Array.isArray(q.lines)||!q.lines.length||!Array.isArray(q.issues)||!Number.isFinite(Date.parse(q.createdAt)))throw Error('Current pricing could not be confirmed.');
    if(s.items.some(x=>x.inventoryId)&&q.stockPricingVersion!==1)throw Error('In-stock pricing needs confirmation.');
    if(col.program&&!q.financePlans?.some(p=>clean(p.brandId).toUpperCase()===s.brandId&&clean(p.program?.ProgramID)===clean(col.program.ProgramID)))throw Error('This financing program could not be confirmed.');
    col.quote=q;
   }catch(error){if(id!==comparisonGeneration||comparisonController.signal.aborted)return;col.error=pricingFailure(error);}finally{col.loading=false;}
   renderComparison();
  }}
  try{await Promise.all([next(),next()]);}finally{if(id===comparisonGeneration){comparisonBusy=false;comparisonNotice.hidden=true;renderComparison();comparisonStatus.textContent=comparisonColumns.some(col=>col.quote)?'Choose Select This Option to apply a payment method to your build.':'Current payment pricing could not be confirmed. Your build is saved. Close this window and retry.';}}
 }
 async function openComparison(financingOnly=false,group='any'){
  financingOnly=financingOnly===true;group=financingOnly&&['compatible','inlieu'].includes(group)?group:'any';comparisonOpener=document.activeElement;
  if(deliverySelect.value==='SHIP'){shippingCheckout();return;}
  if(!comparisonDialog){comparisonDialog=document.createElement('dialog');comparisonDialog.className='wep-payment-dialog';comparisonDialog.setAttribute('aria-labelledby','wep-payment-dialog-title');
   const header=document.createElement('div');header.className='wep-payment-dialog-header';const title=document.createElement('h2');title.id='wep-payment-dialog-title';title.textContent='View Price & Payment Options';const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>{checkoutPending=false;comparisonDialog.close();};comparisonDialog.addEventListener('cancel',()=>{checkoutPending=false;});header.append(title,close);
   comparisonStatus=note('','wep-payment-dialog-status');comparisonStatus.setAttribute('role','status');comparisonStatus.setAttribute('aria-live','polite');const wrap=document.createElement('div');wrap.className='wep-payment-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Payment options comparison. Scroll horizontally for more options.');comparisonTable=document.createElement('table');wrap.append(comparisonTable);
   comparisonNotice=document.createElement('div');comparisonNotice.className='wep-package-loading';comparisonNotice.setAttribute('role','status');comparisonNotice.setAttribute('aria-live','polite');const loadingTitle=document.createElement('strong');loadingTitle.textContent='Building payment options for your package…';comparisonNotice.append(loadingTitle,note('We’re calculating prices and payments for the equipment, options, and delivery you selected. This may take a moment.'));
   comparisonMore=document.createElement('button');comparisonMore.type='button';comparisonMore.onclick=()=>loadComparisonBatch(comparisonColumns.filter(c=>!c.quote&&!c.error).slice(0,2),comparisonGeneration);
   comparisonDialog.append(header,note('Compare your complete build, including selected options, installation, freight, delivery and estimated tax. Select one payment option to continue.'),comparisonNotice,comparisonStatus,wrap,comparisonMore,note('Estimated Total of Payments excludes your down payment. The final lender payment may vary.'),note('Financing is subject to credit approval. Rates, eligibility and pricing are rechecked before purchase.'));document.body.append(comparisonDialog);
   comparisonDialog.addEventListener('close',()=>{++comparisonGeneration;comparisonController?.abort();comparisonBusy=false;(comparisonOpener?.isConnected?comparisonOpener:document.getElementById('wep-open-payment-options'))?.focus({preventScroll:true});queueMicrotask(()=>{if(paymentConfirmed&&!lastResponse&&!comparisonDialog.open)schedule(true);});});
  }
  document.getElementById('wep-payment-dialog-title').textContent=group==='compatible'?'Financing + Rebates':group==='inlieu'?'Financing in Lieu of Rebates':financingOnly?'View All Financing Options':'View Price & Payment Options';
  comparisonDialog.dataset.financingOnly=String(financingOnly);comparisonDialog.dataset.financeGroup=group;
  try{
   if(!inventoryReady)throw Error('Wait for the stock check or retry Check Stock before comparing prices.');
   comparisonSnapshot=compareState();if(comparisonSnapshot.fulfillment==='DELIVERY'&&!/^\d{5}$/.test(comparisonSnapshot.zip))throw Error('Enter a five-digit delivery ZIP before comparing payment options.');
   ++generation;controller?.abort();clearTimeout(timer);comparisonController?.abort();comparisonController=new AbortController();const id=++comparisonGeneration;comparisonBusy=false;comparisonColumns=[];comparisonTable.replaceChildren();comparisonMore.hidden=true;comparisonNotice.hidden=false;comparisonStatus.textContent='Checking current offers for your selected package…';if(!comparisonDialog.open)comparisonDialog.showModal();
   const s=comparisonSnapshot,main=s.items[0],selectionItems=s.items.slice(1).map(x=>({sku:x.sku,quantity:x.quantity}));let programError='';
   const result=await eligiblePrograms(s,comparisonController.signal).catch(error=>{if(comparisonController.signal.aborted)throw error;programError='Financing could not be loaded. Close and reopen to retry.';return {programs:[]};});
   if(id!==comparisonGeneration||!comparisonFresh())return;programs=validPrograms(result.programs);if(financeLayout.hasRebate)programs.sort((a,b)=>Number(rebateCompatible(b))-Number(rebateCompatible(a))||number(a.APR)-number(b.APR)||number(b.TermMonths)-number(a.TermMonths));comparisonColumns=[...(financingOnly?[]:[{method:'cash'},{method:'credit'}]),...programs.filter(program=>group==='any'||financeGroup(program)===group).map(program=>({method:'finance',program}))];renderComparison();
   if(!comparisonColumns.length){comparisonNotice.hidden=true;comparisonStatus.textContent=programError||'No eligible financing programs are available for this package. Cash / Bank Check and Credit Card remain available on the page.';return;}
   const starters=[comparisonColumns.find(c=>c.program&&rebateCompatible(c.program)),comparisonColumns.find(c=>c.program&&!rebateCompatible(c.program)),...comparisonColumns].filter((c,i,rows)=>c&&rows.indexOf(c)===i).slice(0,3);
   await loadComparisonBatch(starters,id);if(programError&&id===comparisonGeneration)comparisonStatus.textContent+=' '+programError;
  }catch(error){if(error.name==='AbortError')return;output.append(note(error.message));if(comparisonDialog.open){comparisonNotice.hidden=true;comparisonStatus.textContent=error.message;}}
 }

 let inventoryRows=null,inventoryPromise=null,inventoryReady=false,inventoryNotice,inventoryVersion=0,autoSaving=false,cartPaused=false,cartResetting=false,departing=false;
 const stockChoices=new Map();
 function sourceKey(type,sku){return type+':'+sku;}
 function sourceChoice(type,sku,qty){const row=stockChoices.get(sourceKey(type,sku));if(!row)return undefined;if(row.quantity!==qty||row.value==='__unavailable__')throw Error('Choose in-stock or orderable pricing for the current quantity.');return row.value;}
 window.WEPBuildInventorySelection=(type,sku,qty)=>sourceChoice(type,clean(sku),Number(qty));
 function currentIdentity(){const p=new URL(app.querySelector('.wep-spec-link').href,location.href).searchParams;return {brandId:clean(p.get('brand')).toUpperCase(),sku:clean(p.get('sku'))};}
 function buildLines(){const s=currentIdentity();return [{type:'tool',sku:s.sku,quantity:Number(app.querySelector('#equipment-qty').value),target:app.querySelector('.wep-build-stock .stock-details'),name:app.querySelector('h1')?.textContent||s.sku},...[...app.querySelectorAll('.option-check')].map(c=>({type:c.dataset.type,sku:c.dataset.sku,quantity:Number([...app.querySelectorAll('[data-qty]')].find(q=>q.dataset.qty===c.dataset.sku)?.value),target:c.closest('.card')?.querySelector('.wep-option-stock-content,.stock-details'),name:c.dataset.name||c.dataset.sku}))];}
 function refreshStockControls(){
  if(!inventoryRows)return;
  const identity=currentIdentity(),saved=cart();
  for(const line of buildLines()){
   if(!line.target)continue;
   const exact=inventoryRows.filter(x=>clean(x.sku).toUpperCase()===line.sku.toUpperCase());
   const all=exact.length===1?(exact[0].selections||[]).filter(x=>clean(x.selectionId)&&!/^INCOMING:/i.test(x.selectionId)):[];
   const available=all.filter(x=>Number(x.quantity)>=line.quantity&&(!x.serialized||line.quantity===1));
   const key=sourceKey(line.type,line.sku),existing=stockChoices.get(key),stored=saved.find(x=>clean(x.brandId).toUpperCase()===identity.brandId&&x.packageId===identity.brandId+':'+identity.sku&&x.type===line.type&&clean(x.sku)===line.sku&&Number(x.quantity)===line.quantity);
   let value=existing?.value;
   if(!existing){if(line.type==='tool'&&query.has('inventoryId'))value=clean(query.get('inventoryId'));else if(line.type==='tool'&&query.get('unit'))value=clean(available.find(x=>clean(x.unitRef)===clean(query.get('unit')))?.selectionId)||'__unavailable__';else if(stored?.inventoryId)value=clean(stored.inventoryId);else if(stored?.quoteStockChoice==='orderable')value='';else value=available.length?clean(available[0].selectionId):'';}
   if(value&&(!available.some(x=>clean(x.selectionId)===value)||exact.length>1))value='__unavailable__';
   stockChoices.set(key,{value,quantity:line.quantity});
   let wrap=line.target.querySelector('.wep-build-stock-choice');if(!wrap){wrap=document.createElement('label');wrap.className='wep-build-stock-choice';wrap.append(document.createTextNode('Availability'));const select=document.createElement('select');select.setAttribute('aria-label','Pricing source for '+line.name);wrap.append(select);line.target.append(wrap);select.addEventListener('change',()=>{stockChoices.set(key,{value:select.value,quantity:Number(line.type==='tool'?app.querySelector('#equipment-qty').value:[...app.querySelectorAll('[data-qty]')].find(q=>q.dataset.qty===line.sku)?.value)});cartPaused=false;schedule(true);});}
   const select=wrap.querySelector('select');select.replaceChildren();
   if(value==='__unavailable__'){const o=new Option('Previous stock unavailable — choose again','__unavailable__');o.disabled=true;select.append(o);}
   const groups=new Map();
   for(const choice of available){
    // Pricing groups are computed by the API from actual cost, freight and dealer pricing rules.
    // Missing group metadata must never imply equal pricing.
    const group=clean(choice.pricingGroup),key=group&&!(choice.includedItems||[]).length?JSON.stringify([group,choice.factoryFreight??null]):'unit:'+clean(choice.selectionId);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(choice);
   }
   let groupIndex=0;
   for(const rows of groups.values()){
    const choice=rows.find(x=>clean(x.selectionId)===value)||rows[0];
    const count=rows.reduce((n,x)=>n+Number(x.quantity),0);
    const label='In Stock — '+count+' available'+(groups.size>1?' · Price '+String.fromCharCode(65+groupIndex):'');
    select.append(new Option(label,clean(choice.selectionId)));groupIndex++;
   }
   select.append(new Option('Order Unit',''));select.value=value;
   const selectedStock=available.find(choice=>clean(choice.selectionId)===value);
   const includedText=(selectedStock?.includedItems||[]).map(item=>(clean(item.description)||clean(item.sku))+' (Qty '+Number(item.quantity)+')').join('; ');
   let included=wrap.querySelector('.wep-stock-included');if(!included){included=document.createElement('small');included.className='wep-stock-included';wrap.append(included);}
   const includedLabel=includedText?'Included with this unit: '+includedText:'';if(included.textContent!==includedLabel)included.textContent=includedLabel;included.hidden=!includedText;

   const showInventory=available.length>0;
   for(const child of [...line.target.children]){
    if(child===wrap)continue;
    if(showInventory){if(!child.hasAttribute('data-wep-before-stock-hidden'))child.setAttribute('data-wep-before-stock-hidden',child.hidden?'true':'false');child.hidden=true;}
    else if(child.hasAttribute('data-wep-before-stock-hidden')){child.hidden=child.getAttribute('data-wep-before-stock-hidden')==='true';child.removeAttribute('data-wep-before-stock-hidden');}
   }
   // No serial numbers, cost data or raw inventory IDs are shown in labels.
   wrap.hidden=!all.length&&!value;
   if(available.length&&line.target.matches('details')&&!line.target.dataset.wepStockOpened){line.target.open=true;line.target.dataset.wepStockOpened='true';}
  }
  const main=buildLines()[0],value=stockChoices.get(sourceKey('tool',main.sku))?.value;
  const selected=inventoryRows.find(row=>clean(row.sku).toUpperCase()===main.sku.toUpperCase())?.selections?.find(row=>clean(row.selectionId)===value);
  window.WEPBuildSetIncludedEquipment?.(selected?.includedItems||[]);
  if(value!=='__unavailable__'&&window.WEPBuildSyncRequiredComponents?.(selected?.includedItems||[],main.quantity))refreshStockControls();
 }
 let lastInventoryCheck=0,inventoryRetryTimer,inventoryRetryCount=0;
 function inventoryPricingStatus(message,retry=false){
  showListedBuild(message);promoOutput?.replaceChildren(note(message));creditOutput?.replaceChildren(note(message));
  panel?.querySelector('.wep-retry-payment-prices')?.remove();
  if(retry){const button=document.createElement('button');button.type='button';button.className='wep-retry-payment-prices';button.textContent='Retry payment prices';button.onclick=()=>{inventoryRetryCount=0;loadInventory(true);};panel?.append(button);}
  syncPaymentCards();
 }

 async function loadInventory(force=false){
  if(inventoryPromise)return inventoryPromise;
  clearTimeout(inventoryRetryTimer);panel?.querySelector('.wep-retry-payment-prices')?.remove();
  const quiet=force&&inventoryReady,previous=JSON.stringify(inventoryRows),version=++inventoryVersion,identity=currentIdentity();
  if(!quiet){inventoryReady=false;if(inventoryNotice)inventoryNotice.textContent='Checking stock…';inventoryPricingStatus('Checking stock before calculating payment prices…');}
  const ac=new AbortController();
  inventoryPromise=(async()=>{try{
   const result=await post('/inventory-availability',{brandId:identity.brandId},ac.signal);if(version!==inventoryVersion)return;
   if(!Array.isArray(result.availability))throw Error('Inventory could not be checked.');
   inventoryRows=result.availability;inventoryReady=true;inventoryRetryCount=0;lastInventoryCheck=Date.now();
   if(inventoryNotice)inventoryNotice.textContent='';
   // An unchanged background check must not clear prices, restart offers, or close a customer's payment comparison.
   if(quiet&&JSON.stringify(inventoryRows)===previous)return;
   refreshStockControls();schedule(true);
  }catch(error){if(version!==inventoryVersion)return;
   if(!quiet)inventoryReady=false;
   if(inventoryNotice){inventoryNotice.replaceChildren(document.createTextNode(quiet?'Stock refresh unavailable; please retry before continuing. ':'Stock check unavailable. '));const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>loadInventory(true);inventoryNotice.append(retry);}
   if(!quiet){const retrying=inventoryRetryCount<2;inventoryPricingStatus(retrying?'Stock check interrupted. Retrying payment prices…':'Stock check unavailable. Retry payment prices to load cash, card and financing.',true);if(retrying){const delay=1500*(++inventoryRetryCount);inventoryRetryTimer=setTimeout(()=>loadInventory(true),delay);}}
  }finally{if(version===inventoryVersion)inventoryPromise=null;}})();return inventoryPromise;
 }
 function saveCurrentBuild(){
  if(autoSaving||cartPaused||departing||!inventoryReady)return;
  selection();const button=app.querySelector('#save-options');if(!button)return;const message=document.getElementById('options-message'),before=message?.textContent;autoSaving=true;try{button.click();if(message?.textContent.startsWith('Package saved in cart.'))message.textContent=before||'';}finally{autoSaving=false;}
 }
 window.WEPBuildSaveForImplements=function(){
  if(!inventoryReady||!panel||cartPaused)throw Error('Please wait for the quote to finish loading, then try again.');
  const snapshot=selection();saveCurrentBuild();
  const identity=currentIdentity(),saved=cart().filter(row=>row.packageId===identity.brandId+':'+identity.sku);
  if(saved.length!==snapshot.items.length||snapshot.items.some(item=>!saved.some(row=>row.type===item.type&&row.sku===item.sku&&Number(row.quantity)===item.quantity&&row.setupSelected===item.setupSelected&&clean(row.inventoryId)===clean(item.inventoryId))))throw Error('Your quote could not be saved. Please try again.');
  sessionStorage.setItem(draftKey(),JSON.stringify({...state(),paymentConfirmed,updated:Date.now()}));
 };
 function removeEquipment(){
  const s=currentIdentity(),rows=cart(),remaining=rows.filter(row=>!(clean(row.brandId).toUpperCase()===s.brandId&&row.packageId===s.brandId+':'+s.sku));
  departing=true;cartPaused=true;++generation;controller?.abort();clearTimeout(timer);comparisonController?.abort();
  writeCart(remaining);sessionStorage.removeItem(draftKey());sessionStorage.removeItem('wepBuildCheckoutChoices');
  const back=document.getElementById('return-link')||app.querySelector('.summary-actions a[href]:not([href="cart.html"])');if(back)back.click();else location.assign('marketplace.html?'+new URLSearchParams({brand:s.brandId}));
 }

 function mount(){
  const price=app.querySelector('.hero .price');if(!price||panel?.isConnected)return;
  const middle=price.parentElement;if(!middle||middle.closest('.wep-compact-actions'))return;
  panel=document.createElement('section');panel.className='wep-build-finance';panel.setAttribute('aria-label','Current package financing estimate');
  const title=document.createElement('h3');title.textContent='Financing available';output=document.createElement('div');output.className='wep-build-finance-output';output.setAttribute('role','status');output.setAttribute('aria-live','polite');panel.append(title,output);
  const heading=document.createElement('div');heading.className='wep-build-heading';
  while(middle.firstChild&&middle.firstChild!==price)heading.append(middle.firstChild);
  const h=heading.querySelector('h1');for(const p of heading.querySelectorAll('p'))if(clean(p.textContent)===clean(h?.textContent))p.hidden=true;
  const inclusions=heading.querySelector('#wep-package-includes'),identity=document.createElement('div');identity.className='wep-build-identity';
  for(const child of [...heading.childNodes])if(child!==inclusions)identity.append(child);
  const identitySku=identity.querySelector('.wep-build-sku');if(inclusions){if(identitySku)identitySku.before(inclusions);else identity.append(inclusions);}
  heading.append(identity);
  const info=document.createElement('div');info.className='wep-build-product-info';while(middle.firstChild)info.append(middle.firstChild);

  middle.classList.add('wep-finance-hero-details');middle.append(heading,info);
  const stock=document.createElement('div');stock.className='wep-build-stock';
  for(const el of [...info.children])if(el.matches('.stock-details')||el.querySelector('#equipment-qty')||el.id==='equipment-qty')stock.append(el);
  const quantity=stock.querySelector('#equipment-qty');if(quantity){quantity.setAttribute('aria-label','Equipment quantity');const label=quantity.closest('label');if(label){for(const node of [...label.childNodes])if(node.nodeType===3)node.textContent='';label.prepend(document.createTextNode('Qty '));}}
  const specs=info.querySelector('.wep-spec-link'),assembly=[...info.querySelectorAll('p.note')].find(n=>/Set-Up \/ Assembly Included/i.test(n.textContent));if(specs){if(assembly)assembly.after(specs);else info.append(specs);}
  middle.append(stock);
  const delivery=document.createElement('section');delivery.className='wep-build-delivery';delivery.innerHTML='<h3>Delivery Options</h3><label><select id="wep-build-fulfillment" aria-label="Delivery option"><option value="NEW_MILFORD">Pickup — New Milford</option><option value="DANBURY">Pickup — Danbury</option><option value="DELIVERY">Local Delivery</option><option value="SHIP" hidden disabled>Ship To — UPS Ground</option></select></label><label id="wep-build-zip-label" hidden>Delivery ZIP<input id="wep-build-zip" inputmode="numeric" autocomplete="postal-code" maxlength="5" pattern="[0-9]{5}"></label>';
  deliverySelect=delivery.querySelector('select');zipInput=delivery.querySelector('input');middle.append(delivery);
  const quickSpecs=document.createElement('section');quickSpecs.className='wep-build-quick-specs';quickSpecs.setAttribute('aria-label','Equipment specifications');const specsList=document.createElement('dl');
  for(const spec of (Array.isArray(window.WEPBuildProductSpecs)?window.WEPBuildProductSpecs:[]).slice(0,3)){
   const label=clean(spec.label),value=clean(spec.value);if(label&&value)specsList.append(field(label,value));
  }
  quickSpecs.hidden=!specsList.children.length;quickSpecs.append(specsList);middle.append(quickSpecs);
  const fulfillmentStack=document.createElement('div');fulfillmentStack.className='wep-build-fulfillment-stack';fulfillmentStack.append(stock,delivery);middle.append(fulfillmentStack);

  panel.querySelector('h3').remove();panel.setAttribute('aria-label','Configured package prices and financing');panel.hidden=false;
  promoOutput=document.createElement('div');promoOutput.className='wep-build-promotions';creditOutput=document.createElement('div');creditOutput.className='wep-build-credit-preview';
  inLieuOutput=document.createElement('div');inLieuOutput.className='wep-build-finance-output';
  const previews=document.createElement('div');previews.className='wep-package-payment-previews';
  for(const [method,label,content] of [['cash','Cash / Bank Check',promoOutput],['credit','Credit Card',creditOutput],['finance','Financing',output],['finance-inlieu','Financing in Lieu of Rebates',inLieuOutput]]){
   const card=document.createElement('section');card.className='wep-package-payment-card';card.dataset.paymentPreview=method;const heading=document.createElement('h4');heading.textContent=label;const selected=note('Selected','wep-payment-selected');selected.hidden=true;card.append(heading,selected,content);if(financeMethod(method)){card.setAttribute('aria-label',label);heading.remove();}if(method==='finance-inlieu')card.hidden=true;
   const choice=document.createElement('button');choice.type='button';choice.className='wep-payment-card-choice';choice.setAttribute('aria-label','Select '+label);choice.setAttribute('aria-pressed','false');card.append(choice);
   if(financeMethod(method)){const all=document.createElement('button');all.type='button';all.className='wep-view-all-payments';all.textContent='View All Financing Options';card.append(all);}
   previews.append(card);
  }
  panel.append(previews);middle.append(panel);
  catalogPrice=price.textContent;
  const choose=document.createElement('div');choose.className='wep-build-payment-choices';
  const open=document.createElement('button');open.type='button';open.id='wep-open-payment-options';open.className='wep-build-payment-open';open.textContent='Select Payment Option';open.addEventListener('click',openComparison);
  paymentSelect=document.createElement('select');paymentSelect.id='wep-build-payment';paymentSelect.hidden=true;paymentSelect.setAttribute('aria-label','Selected payment option');paymentSelect.append(new Option('Choose a payment option',''),new Option('Cash / Bank Check','cash'),new Option('Credit Card','credit'));paymentSelectionNote=note('Payment: Not selected','wep-payment-selection-note');paymentSelectionNote.setAttribute('role','status');paymentSelectionNote.setAttribute('aria-live','polite');choose.append(open,paymentSelect,paymentSelectionNote);panel.append(choose);
  priceExtra=document.createElement('div');priceExtra.className='wep-build-price-extra';price.after(priceExtra);
  const summary=app.querySelector('.wep-compact-actions');if(summary)summary.before(panel);totals=document.createElement('div');totals.className='wep-build-totals';totals.setAttribute('aria-live','polite');summary?.prepend(totals);
  const oldSubtotal=app.querySelector('.wep-subtotal');if(oldSubtotal)oldSubtotal.hidden=true;
  if(summary){summary.prepend(choose);const actions=summary.querySelector('.summary-actions');if(actions){const empty=document.createElement('button');empty.type='button';empty.id='wep-empty-cart';empty.className='wep-empty-cart';empty.textContent='Remove Equipment';empty.onclick=removeEquipment;empty.setAttribute('aria-label','Remove this equipment package');const undo=document.createElement('button');undo.type='button';undo.id='wep-undo-empty-cart';undo.className='wep-empty-cart';undo.textContent='Undo Empty Cart';undo.hidden=true;undo.onclick=undoEmptyCart;const view=[...actions.querySelectorAll('a')].find(a=>a.getAttribute('href')==='cart.html');const media=app.querySelector('.hero>.media');if(media){const mediaColumn=document.createElement('div');mediaColumn.className='wep-build-media-column';media.before(mediaColumn);mediaColumn.append(media,empty,undo);}else stock.append(empty,undo);}}
  const review=app.querySelector('#review-package');if(review){const checkout=document.createElement('button');checkout.type='button';checkout.id='wep-build-checkout';checkout.textContent='Checkout';checkout.onclick=()=>{checkoutPending=true;review.click();};review.before(checkout);}
  const save=app.querySelector('#save-options');if(save)save.hidden=true;app.querySelector('#wep-print-build')?.remove();for(const link of app.querySelectorAll('.summary-actions a[href="cart.html"]'))link.remove();
  inventoryNotice=note('Checking stock…','wep-build-inventory-status');app.querySelector('.wep-build-stock')?.append(inventoryNotice);
  const draft=readDraft();if(draft&&Date.now()-draft.updated<86400000){
   if(['NEW_MILFORD','DANBURY','DELIVERY'].includes(draft.fulfillment))deliverySelect.value=draft.fulfillment;
   zipInput.value=/^\d{5}$/.test(draft.zip)?draft.zip:'';
   if(draft.paymentConfirmed===true){if(['cash','credit'].includes(draft.paymentMethod)){paymentSelect.value=draft.paymentMethod;paymentConfirmed=true;}else if(draft.programId){preferred=draft.programId;paymentSelect.append(new Option('Selected financing','finance:'+draft.programId));paymentSelect.value='finance:'+draft.programId;paymentConfirmed=true;}}
   for(const item of draft.items||[]){const input=item.type==='tool'?app.querySelector('#equipment-qty'):[...app.querySelectorAll('[data-qty]')].find(x=>x.dataset.qty===item.sku);const check=[...app.querySelectorAll('.option-check')].find(x=>x.dataset.type===item.type&&x.dataset.sku===item.sku);if(check&&!check.disabled)check.checked=true;if(input&&Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=20)input.value=item.quantity;const setup=[...app.querySelectorAll('.setup-choice')].find(x=>x.dataset.installType===item.type&&x.dataset.installSku===item.sku);if(setup)setup.checked=item.setupSelected===true;}
   // Unselected options are also restored, so a removed attachment stays removed.
   for(const c of app.querySelectorAll('.option-check'))if(!(draft.items||[]).some(x=>x.type===c.dataset.type&&x.sku===c.dataset.sku))c.checked=false;
   app.querySelector('#equipment-qty')?.dispatchEvent(new Event('input',{bubbles:true}));
  }
  const updateZip=()=>{delivery.querySelector('#wep-build-zip-label').hidden=deliverySelect.value!=='DELIVERY';};updateZip();
  deliverySelect.addEventListener('change',()=>{updateZip();schedule(true);});zipInput.addEventListener('input',()=>schedule(true));
  paymentSelect.addEventListener('change',()=>{paymentConfirmed=!!paymentSelect.value;preferred=paymentSelect.value.startsWith('finance:')?paymentSelect.value.slice(8):'';schedule(true);});
  for(const n of app.querySelectorAll('p.note'))if(n.textContent.startsWith('Freight, delivery, tax and payment options are calculated in your quote.'))n.textContent='Prices and availability are subject to change. Totals reflect your selected equipment, options, payment method and delivery choice. Financing is subject to credit approval. Availability is confirmed before order acceptance. Pricing errors are subject to correction.';
  updatePaymentSelection();loadInventory();

 }
 app.addEventListener('click',event=>{
  if(event.target.closest('#review-package')){
   if(!checkoutPending){
    event.preventDefault();event.stopImmediatePropagation();
    const section=document.getElementById('wep-itemized-quote');
    section?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    section?.focus({preventScroll:true});return;
   }
   if(cartPaused){event.preventDefault();event.stopImmediatePropagation();const message=document.getElementById('options-message');if(message)message.textContent='Your cart is empty. Choose equipment or options to continue.';return;}
   if(deliverySelect.value==='SHIP'){event.preventDefault();event.stopImmediatePropagation();shippingCheckout();return;}
   if(!paymentConfirmed){event.preventDefault();event.stopImmediatePropagation();openComparison();return;}
   if(!lastResponse||!lastSnapshot||JSON.stringify(state())!==JSON.stringify(lastSnapshot)||Date.now()-Date.parse(lastResponse.createdAt)>300000){event.preventDefault();event.stopImmediatePropagation();openComparison();return;}
   checkoutPending=false;
   if(window.WEPInlineCheckout){event.preventDefault();event.stopImmediatePropagation();saveCurrentBuild();window.WEPInlineCheckout.open();return;}
   remember();sessionStorage.setItem('wepBuildCheckoutChoices',JSON.stringify({paymentConfirmed:true,paymentMethod:lastSnapshot.paymentMethod,fulfillment:lastSnapshot.fulfillment,zip:lastSnapshot.zip,brandId:lastSnapshot.brandId,sku:lastSnapshot.sku,items:lastSnapshot.items,financeProgramIds:lastSnapshot.paymentMethod==='finance'?{[lastSnapshot.brandId]:lastSnapshot.programId}:{},...checkoutCarry(),updated:Date.now()}));
  }
 },true);
 function optionChoice(button){return [...app.querySelectorAll('.option-check')].find(c=>c.dataset.type===button.dataset.type&&c.dataset.sku===button.dataset.sku);}
 function syncOptionButtons(){
  for(const button of app.querySelectorAll('.add-option-cart')){
   const choice=optionChoice(button);if(!choice||!['attachment','accessory','part'].includes(choice.dataset.type))continue;
   if(choice.dataset.wepRequired==='true'){button.disabled=true;if(button.textContent!=='Required with package')button.textContent='Required with package';button.classList.remove('wep-remove-option');button.setAttribute('aria-label','Required with package: '+choice.dataset.name);continue;}
   const label=choice.checked?'Remove':'Add to Cart';if(button.textContent!==label)button.textContent=label;
   button.classList.toggle('wep-remove-option',choice.checked);button.setAttribute('aria-label',(choice.checked?'Remove ':'Add to Cart: ')+(choice.dataset.name||button.closest('.card')?.querySelector('h3')?.textContent||choice.dataset.sku));
  }
 }
 function writeCart(rows){const oldValue=localStorage.getItem('wepCart');const value=JSON.stringify(rows);localStorage.setItem('wepCart',value);window.dispatchEvent(new StorageEvent('storage',{key:'wepCart',oldValue,newValue:value,storageArea:localStorage}));}
 let emptyUndo=null;
 function clearCart(){
  try{
   const raw=localStorage.getItem('wepCart')||'[]',rows=JSON.parse(raw);if(!Array.isArray(rows))throw Error('Your cart could not be read. Use View Cart before clearing it.');
   if(!rows.length&&emptyUndo){const message=document.getElementById('options-message');if(message)message.textContent='Your cart is already empty. Undo Empty Cart is still available.';return;}
   const drafts={};for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key?.startsWith('wepBuildDraft:')||key==='wepBuildCheckoutChoices')drafts[key]=sessionStorage.getItem(key);}
   emptyUndo={raw,drafts,confirmed:paymentConfirmed,payment:paymentSelect.value,preferred,controls:[...app.querySelectorAll('.option-check,.qty,.setup-choice')].map(input=>({input,value:input.value,checked:input.checked}))};
   cartPaused=true;cartResetting=true;writeCart([]);for(const key of Object.keys(drafts))sessionStorage.removeItem(key);
   for(const c of app.querySelectorAll('.option-check'))c.checked=false;
   const qty=app.querySelector('#equipment-qty');for(const input of app.querySelectorAll('.qty'))input.value='1';
   paymentConfirmed=false;preferred='';paymentSelect.value='';lastApplied='';quoteCache.clear();sessionStorage.removeItem(quoteSessionKey);
   qty?.dispatchEvent(new Event('input',{bubbles:true}));schedule(true);syncOptionButtons();
   const message=document.getElementById('options-message');if(message)message.textContent='Cart emptied. The equipment stays on screen so you can start a new build.';
   document.getElementById('wep-undo-empty-cart').hidden=false;cartResetting=false;
  }catch(error){const message=document.getElementById('options-message');if(message)message.textContent=error.message;}
 }
 function undoEmptyCart(){
  try{
   if(!emptyUndo)return;
   if((localStorage.getItem('wepCart')||'[]')!=='[]')throw Error('Your cart has new items. Undo is unavailable so those items are preserved.');
   const previous=emptyUndo;emptyUndo=null;cartPaused=false;cartResetting=true;writeCart(JSON.parse(previous.raw));
   for(const [key,value] of Object.entries(previous.drafts))sessionStorage.setItem(key,value);
   for(const row of previous.controls)if(row.input.isConnected){row.input.value=row.value;row.input.checked=row.checked;}
   paymentSelect.value=previous.payment;paymentConfirmed=previous.confirmed;preferred=previous.preferred;lastApplied='';
   app.querySelector('#equipment-qty')?.dispatchEvent(new Event('input',{bubbles:true}));schedule(true);syncOptionButtons();document.getElementById('wep-undo-empty-cart').hidden=true;
   const message=document.getElementById('options-message');if(message)message.textContent='Your previous cart has been restored.';cartResetting=false;
  }catch(error){const message=document.getElementById('options-message');if(message)message.textContent=error.message;}
 }
 app.addEventListener('click',event=>{
  const button=event.target.closest('.add-option-cart');if(!button)return;
  const choice=optionChoice(button);if(!choice||!['attachment','accessory','part'].includes(choice.dataset.type)||!choice.checked){queueMicrotask(syncOptionButtons);return;}
  event.preventDefault();event.stopImmediatePropagation();
  try{
   const params=new URL(app.querySelector('.wep-spec-link').href,location.href).searchParams,s={brandId:clean(params.get('brand')).toUpperCase(),sku:clean(params.get('sku'))},rows=JSON.parse(localStorage.getItem('wepCart')||'[]');if(!s.brandId||!s.sku||!Array.isArray(rows))throw Error('Your cart could not be read. Use View Cart to review it.');
   // Remove only this package's line; another equipment package may use the same option.
   writeCart(rows.filter(row=>!(clean(row.brandId).toUpperCase()===s.brandId&&row.packageId===s.brandId+':'+s.sku&&row.type===choice.dataset.type&&clean(row.sku)===choice.dataset.sku)));
   choice.checked=false;choice.dispatchEvent(new Event('change',{bubbles:true}));syncOptionButtons();remember();
   const message=document.getElementById('options-message');if(message)message.textContent=(choice.dataset.name||'Item')+' removed from this build and its saved cart package.';
  }catch(error){const message=document.getElementById('options-message');if(message)message.textContent=error.message;}
 },true);

 window.addEventListener('pagehide',remember);
 app.addEventListener('input',event=>{if(event.target.matches('.qty:not(.wep-review-qty),.setup-choice,.option-check')){if(!cartResetting)cartPaused=false;schedule();}});
 app.addEventListener('change',event=>{if(event.target.matches('.qty:not(.wep-review-qty),.setup-choice,.option-check')){if(!cartResetting)cartPaused=false;schedule();}});
 app.addEventListener('click',event=>{if(!autoSaving&&event.target.closest('.add-option-cart,#save-options,[data-review-remove-type]')){cartPaused=false;schedule();}});
 // Another product tab may save a different package. It must not cancel this build's quote.
 function cartPackageSignature(raw){
  const identity=currentIdentity(),group=identity.brandId+':'+identity.sku,rows=JSON.parse(raw||'[]');
  if(!Array.isArray(rows))throw Error('Invalid saved cart');
  return JSON.stringify(rows.filter(row=>clean(row.brandId).toUpperCase()===identity.brandId&&(row.packageId===group||(!row.packageId&&clean(row.equipmentSku||row.sku)===identity.sku))).map(row=>JSON.stringify(row)).sort());
 }
 window.addEventListener('storage',event=>{
  if(event.key!=='wepCart'||autoSaving||departing)return;
  try{if(cartPackageSignature(event.oldValue)===cartPackageSignature(event.newValue))return;}catch(_){return;}
  // Recheck relevant changes without saving back and triggering another tab's storage listener.
  schedule(false,false);
 });
 setInterval(()=>{if(!document.hidden)loadInventory(true);},300000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastInventoryCheck>300000)loadInventory(true);});
 // Public builder state shared with its own customer form; no separate review page.
 window.WEPBuilderCheckout={
  refresh:()=>schedule(true),
  current:()=>{
   const selection=state(),matches=lastSnapshot&&JSON.stringify(selection)===JSON.stringify(lastSnapshot);
   const q=matches&&lastResponse&&Date.now()-Date.parse(lastResponse.createdAt)<300000?JSON.parse(JSON.stringify(lastResponse)):null;
   if(q){for(const line of q.lines){
    const option=[...app.querySelectorAll('.option-check')].find(c=>c.dataset.type===line.type&&clean(c.dataset.sku)===clean(line.sku));
    const regular=line.type==='tool'?number(app.querySelector('.hero .price')?.dataset.wepMsrp):number(option?.dataset.regularPrice);
    line.regularUnitPrice=Math.max(validMoney(regular)?regular:0,validMoney(line.baseUnitPrice)?line.baseUnitPrice:0,line.unitPrice);
    const input=[...app.querySelectorAll('[data-review-qty-sku]')].find(el=>el.dataset.reviewQtyType===line.type&&el.dataset.reviewQtySku===line.sku),freight=input?.closest('tr')?.nextElementSibling;
    if(freight?.classList.contains('wep-implement-freight-row'))line.freightNote=clean(freight.textContent);
   }}
   return {selection,quote:q,paymentConfirmed,api,testMode:local||query.get('test')==='1'};
  },
  review:()=>{checkoutPending=true;document.getElementById('review-package')?.click();},
  shippingQuote:async(address,signal)=>{
   paymentSelect.value='credit';paymentConfirmed=true;preferred='';remember();
   const snapshot=state();if(snapshot.fulfillment!=='SHIP'||!shippingEligible||shippingKey!==shippingSignature(snapshot))throw Error('Choose an eligible shipping option.');
   const q=await packageQuote({items:snapshot.items,paymentMethod:'credit',fulfillment:'SHIP',zip:'',financeProgramIds:{},shippingAddress:address},signal);
   if(signal.aborted||JSON.stringify(snapshot)!==JSON.stringify(state()))throw new DOMException('Changed','AbortError');
   render(q,null,snapshot);return q;
  }
 };
 window.addEventListener('resize',()=>syncPaymentCards());
 new MutationObserver(()=>{mount();syncOptionButtons();syncPaymentCards();}).observe(app,{childList:true,subtree:true});mount();syncOptionButtons();syncPaymentCards();
})();
