/* One compact shopping-advice entry point beside the filters. No messages are sent here. */
(() => {
 'use strict';
 const clean=v=>String(v??'').trim();
 let stores=[],dialog,opener,restoreFocus=true;
 function pageContext(){
  const url=new URL(location.href);url.hash='';
  for(const name of [...url.searchParams.keys()])if(!['brand','category','subcategory','series','power','use','deck','shop','availability','promo'].includes(name))url.searchParams.delete(name);
  return 'Equipment page: '+url.href;
 }
 function create(){
  dialog=document.createElement('dialog');dialog.className='wep-shopping-help-dialog';dialog.setAttribute('aria-labelledby','wep-shopping-help-title');
  dialog.innerHTML='<div class="wep-help-heading"><h2 id="wep-shopping-help-title">Need help choosing?</h2><button type="button" data-help-close aria-label="Close choosing help">×</button></div><p>Tell us about your property, intended use, budget and priorities. Talk with our team.</p><label class="wep-help-store">Your store <select data-help-store aria-label="Contact store"></select></label><fieldset><legend>How would you like to contact us?</legend><label><input type="radio" name="wep-help-method" value="text"> Text</label><label><input type="radio" name="wep-help-method" value="email"> Email</label></fieldset><label for="wep-help-question">Your question</label><textarea id="wep-help-question" rows="3" placeholder="How can we help?"></textarea><div class="wep-help-actions"><a data-help-send>Send Question</a><a data-help-call>Call store</a></div><p class="wep-help-hint">Your text or email app opens with a draft. Press Send there.</p><button type="button" data-help-compare hidden>Compare the current results below ↓</button>';
  document.body.append(dialog);
  const method=matchMedia('(pointer:coarse)').matches?'text':'email';dialog.querySelector('[value="'+method+'"]').checked=true;
  dialog.querySelector('[data-help-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(restoreFocus)opener?.focus();});
  dialog.addEventListener('change',update);dialog.querySelector('textarea').addEventListener('input',update);
  dialog.querySelector('[data-help-compare]').onclick=()=>{
   restoreFocus=false;dialog.close();document.body.classList.remove('market-mobile-filters-open');
   const target=document.getElementById('wep-model-comparison');if(target){target.scrollIntoView({block:'start'});const heading=target.querySelector('h2');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});}
  };
 }
 function update(){
  if(!dialog)return;
  const select=dialog.querySelector('select'),store=stores.find(s=>clean(s.LocationID)===select.value)||stores[0];
  const send=dialog.querySelector('[data-help-send]'),call=dialog.querySelector('[data-help-call]');
  if(!store){send.removeAttribute('href');call.removeAttribute('href');return;}
  const name=clean(store.ShortName||store.LocationName),phone=clean(store.Phone).replace(/[^0-9+]/g,''),email=clean(store.Email);
  const body=(clean(dialog.querySelector('textarea').value)||'Please help me choose equipment for my property, intended use, budget and priorities.')+'\n\nStore: '+name+'\n'+pageContext();
  const text=dialog.querySelector('[value="text"]').checked;
  if(text&&phone)send.href='sms:'+phone+(/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(body);
  else if(!text&&/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email))send.href='mailto:'+email+'?subject='+encodeURIComponent('Equipment advice — '+name)+'&body='+encodeURIComponent(body);
  else send.removeAttribute('href');
  call.textContent='Call '+name;if(phone)call.href='tel:'+phone;else call.removeAttribute('href');
 }
 function show(event){
  opener=event.currentTarget;restoreFocus=true;if(!dialog)create();
  const select=dialog.querySelector('select'),previous=select.value;select.replaceChildren();
  for(const store of stores)select.append(new Option(clean(store.ShortName||store.LocationName),clean(store.LocationID)));
  if(stores.some(s=>clean(s.LocationID)===previous))select.value=previous;
  dialog.querySelector('[data-help-compare]').hidden=!document.getElementById('wep-model-comparison');update();dialog.showModal();
 }
 function mount(rows=[]){
  stores=rows.filter(s=>!clean(s.Active)||/^(T|TRUE|YES|Y|1)$/i.test(clean(s.Active)));
  const sidebar=document.querySelector('.market-sidebar');if(!sidebar)return;
  let column=sidebar.parentElement;
  if(!column.classList.contains('wep-filter-column')){
   column=document.createElement('div');column.className='wep-filter-column';sidebar.before(column);column.append(sidebar);
  }
  if(!column.querySelector('[data-shopping-help]')){
   const button=document.createElement('button');button.type='button';button.className='wep-shopping-help-button';button.dataset.shoppingHelp='';button.textContent='Need help choosing?';button.setAttribute('aria-haspopup','dialog');button.onclick=show;column.prepend(button);
  }
  // Retain the server's contact/compare fallback without JavaScript, but save a row in shopping mode.
  document.querySelector('.wep-equipment-help')?.remove();
 }
 window.WEPShoppingHelp={mount};
})();
