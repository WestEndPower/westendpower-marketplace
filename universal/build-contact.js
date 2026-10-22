/* Builder contact controls open the customer's text/email app; no message is sent here. */
(function(){
 'use strict';
 if(document.getElementById('wep-build-contact-launch'))return;
 const clean=value=>String(value??'').trim();
 let stores=[{LocationID:'NM',ShortName:'New Milford',Email:'sales@westendpower.com',Phone:'860-355-8722'},{LocationID:'DA',ShortName:'Danbury',Email:'dawepe@westendpower.com',Phone:'475-444-3901'}];
 let opener,storeChosen=false;
 const launcher=document.createElement('button');launcher.id='wep-build-contact-launch';launcher.type='button';launcher.setAttribute('aria-label','Contact us');launcher.title='Contact us';launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls','wep-build-contact-dialog');
 launcher.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z"/></svg>';
 const dialog=document.createElement('dialog');dialog.id='wep-build-contact-dialog';dialog.setAttribute('aria-labelledby','wep-build-contact-title');
 dialog.innerHTML='<div class="wep-build-contact-head"><h2 id="wep-build-contact-title">Contact West End Power</h2><button type="button" data-contact-close aria-label="Close contact window">×</button></div><p class="wep-build-contact-context"></p><label class="wep-contact-store-label">Your store<select aria-label="Contact store" data-contact-store></select></label><fieldset><legend>How would you like to contact us?</legend><label><span><input type="radio" name="wep-build-contact-method" value="text"> Text</span><a data-contact-text></a></label><label><span><input type="radio" name="wep-build-contact-method" value="email"> Email</span><a data-contact-email></a></label></fieldset><label for="wep-build-contact-question">Your question</label><textarea id="wep-build-contact-question" rows="4" placeholder="How can we help?"></textarea><p class="wep-build-contact-hint">Your text or email app will open with your question and equipment details ready. Press Send there to deliver it.</p><div class="wep-build-contact-actions"><a data-contact-send role="button" href="#">Send Question</a><a data-contact-call>Call Us</a></div>';
 document.body.append(launcher,dialog);
 const storeSelect=dialog.querySelector('[data-contact-store]'),question=dialog.querySelector('textarea'),send=dialog.querySelector('[data-contact-send]');
 const phoneLike=window.matchMedia('(pointer: coarse) and (max-width: 800px)').matches||/Android|iPhone|iPod/i.test(navigator.userAgent);
 dialog.querySelector('input[value="'+(phoneLike?'text':'email')+'"]').checked=true;
 function selectedStore(){return stores.find(store=>store.LocationID===storeSelect.value)||stores[0];}
 function updateStores(){
  const previous=storeSelect.value;storeSelect.replaceChildren();
  for(const store of stores)storeSelect.append(new Option(clean(store.ShortName||store.LocationName),store.LocationID));
  if(stores.some(store=>store.LocationID===previous))storeSelect.value=previous;
  update();
 }
 function buildContext(){
  const main=document.querySelector('.hero h1'),params=new URLSearchParams(location.search),brand=clean(params.get('brand')).toUpperCase(),sku=clean(params.get('sku'));
  const lines=['Equipment: '+(clean(main?.textContent)||[brand,sku].filter(Boolean).join(' '))];
  if(brand)lines.push('Brand: '+brand);if(sku)lines.push('Equipment SKU: '+sku);
  const included=clean(document.getElementById('wep-package-includes')?.textContent);if(included)lines.push(included);
  const quantity=document.getElementById('equipment-qty');if(quantity)lines.push('Equipment quantity: '+quantity.value);
  const source=document.querySelector('.wep-build-stock>.wep-build-stock-choice select');
  if(source)lines.push('Availability: '+clean(source.selectedOptions[0]?.textContent));
  for(const choice of document.querySelectorAll('.option-check:checked')){
   const qty=[...document.querySelectorAll('[data-qty]')].find(input=>input.dataset.qty===choice.dataset.sku);
   lines.push('Added option: '+clean(choice.dataset.name)+' (Qty '+(qty?.value||1)+')');
  }
  const fulfillment=document.getElementById('wep-build-fulfillment');
  if(fulfillment)lines.push(clean(fulfillment.selectedOptions[0]?.textContent));
  if(fulfillment?.value==='DELIVERY'){
   const zip=clean(document.getElementById('wep-build-zip')?.value);if(zip)lines.push('Delivery ZIP: '+zip);
  }
  // Share a public equipment link, never local preview addresses or inventory identifiers.
  const link=new URL('https://westendpower.github.io/westendpower-marketplace/product-options.html');
  if(brand)link.searchParams.set('brand',brand.toLowerCase());if(sku)link.searchParams.set('sku',sku);
  lines.push('Equipment link: '+link.href);return lines.join('\n');
 }
 function update(){
  const store=selectedStore();if(!store)return;
  const phone=clean(store.Phone).replace(/[^0-9+]/g,''),email=clean(store.Email),sms='sms:'+phone;
  const textLink=dialog.querySelector('[data-contact-text]'),emailLink=dialog.querySelector('[data-contact-email]'),call=dialog.querySelector('[data-contact-call]');
  textLink.textContent=clean(store.Phone);textLink.href=sms;emailLink.textContent=email;emailLink.href='mailto:'+email;call.textContent='Call Us: '+clean(store.Phone);call.href='tel:'+phone;
  dialog.querySelector('.wep-build-contact-context').textContent='Regarding: '+(clean(document.querySelector('.hero h1')?.textContent)||'your equipment build');
  const body=clean(question.value)+'\n\n'+buildContext(),method=dialog.querySelector('input[name="wep-build-contact-method"]:checked')?.value;
  const separator=/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?';
  send.href=method==='text'?sms+separator+'body='+encodeURIComponent(body):'mailto:'+email+'?subject='+encodeURIComponent('Question about '+(clean(document.querySelector('.hero h1')?.textContent)||'my equipment build'))+'&body='+encodeURIComponent(body);
 }
 function show(source){
  opener=source||launcher;
  if(!storeChosen){const preferred=document.getElementById('wep-build-fulfillment')?.value==='DANBURY'?'DA':'NM';if(stores.some(store=>store.LocationID===preferred))storeSelect.value=preferred;}
  update();if(!dialog.open)dialog.showModal();
 }
 launcher.onclick=()=>show(launcher);
 dialog.querySelector('[data-contact-close]').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>opener?.isConnected&&opener.focus({preventScroll:true}));
 storeSelect.addEventListener('change',()=>{storeChosen=true;update();});
 for(const radio of dialog.querySelectorAll('input[name="wep-build-contact-method"]'))radio.addEventListener('change',update);
 question.addEventListener('input',update);
 send.addEventListener('click',event=>{if(!clean(question.value)){event.preventDefault();question.focus();return;}update();});
 send.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();send.click();}});
 updateStores();
 fetch('data/locations.csv').then(response=>{if(!response.ok)throw Error('Locations unavailable');return response.text();}).then(text=>{
  const rows=window.WEPBuildBuy?.parseCSV(text).filter(row=>(!clean(row.Active)||/^(T|TRUE|YES|Y|1|X)$/i.test(clean(row.Active)))&&clean(row.LocationID)&&clean(row.Phone).replace(/[^0-9]/g,'').length>=10&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(row.Email)));
  if(rows?.length){stores=rows;updateStores();}
 }).catch(()=>{});
 function placeHelp(){
  const factory=document.querySelector('.hero>.wep-finance-hero-details>.wep-factory-options');if(!factory)return;
  const column=document.createElement('div');column.className='wep-build-configuration-column';factory.before(column);column.append(factory);
  const prompt=document.createElement('section');prompt.className='wep-build-print-prompt';prompt.setAttribute('aria-label','Print this equipment view');
  const button=document.createElement('button');button.type='button';button.textContent='Print Current View';button.onclick=()=>window.WEPBuildPrintCurrent(button);
  prompt.append(button);column.append(prompt);
 }
 const app=document.getElementById('app');if(app)new MutationObserver(placeHelp).observe(app,{childList:true,subtree:true});placeHelp();
})();
