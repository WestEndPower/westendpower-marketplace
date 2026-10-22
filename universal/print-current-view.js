/* Freeze the current overview's screen layout, then print with white backgrounds. */
(function(){
 'use strict';
 let preparing=false;
 function cleanup(){document.body.classList.remove('wep-print-current');document.getElementById('wep-print-current-sheet')?.remove();}
 window.addEventListener('afterprint',cleanup);
 function check(){
  const current=window.WEPBuilderCheckout?.current();
  if(document.getElementById('app')?.classList.contains('wep-package-updating'))throw Error('Wait for current prices to finish updating, then print.');
  if(!current?.quote)throw Error('Refresh this page to update current prices, then print.');
  return current;
 }
 function freeze(source){
  const copy=source.cloneNode(false),style=getComputedStyle(source);
  copy.removeAttribute('id');copy.removeAttribute('class');copy.removeAttribute('inert');
  // Inline computed screen styles prevent print breakpoints from rearranging the view.
  for(const property of style)copy.style.setProperty(property,style.getPropertyValue(property),'important');
  copy.style.setProperty('background-color','transparent','important');
  copy.style.setProperty('background-image','none','important');
  copy.style.setProperty('color','#111','important');
  copy.style.setProperty('-webkit-text-fill-color','#111','important');
  if(source.matches('.wep-package-update,.wep-print-status'))copy.style.setProperty('display','none','important');
  copy.style.setProperty('box-shadow','none','important');
  copy.style.setProperty('text-shadow','none','important');
  for(const side of ['top','right','bottom','left'])if(parseFloat(style.getPropertyValue('border-'+side+'-width'))>0)copy.style.setProperty('border-'+side+'-color','#aaa','important');
  if(source.matches('[data-factory-option][aria-pressed="true"],[data-factory-tire][aria-pressed="true"]')){copy.style.setProperty('background-color','#eee','important');copy.style.setProperty('font-weight','700','important');}
  for(const child of source.childNodes)copy.append(child.nodeType===Node.ELEMENT_NODE?freeze(child):child.cloneNode(true));
  if(source instanceof HTMLInputElement){copy.value=source.value;copy.setAttribute('value',source.value);copy.checked=source.checked;}
  if(source instanceof HTMLSelectElement)copy.selectedIndex=source.selectedIndex;
  if(source instanceof HTMLImageElement)copy.src=source.currentSrc||source.src;
  return copy;
 }
 window.WEPBuildPrintCurrent=async function(button){
  if(preparing)return;preparing=true;
  const host=button?.closest('.wep-build-print-prompt');let message=host?.querySelector('[role="status"]');
  if(host&&!message){message=document.createElement('p');message.className='wep-print-status';message.setAttribute('role','status');host.append(message);}if(message)message.textContent='';
  try{
   const current=check(),signature=JSON.stringify(current.selection),source=document.querySelector('#app .hero');
   if(!source)throw Error('The current view is not ready to print.');
   cleanup();const root=document.createElement('section');root.id='wep-print-current-sheet';root.className='wep-print-sheet wep-print-measuring';
   const content=freeze(source),bounds=source.getBoundingClientRect();
   content.style.setProperty('width',bounds.width+'px','important');content.style.setProperty('margin','0','important');
   content.style.setProperty('background-color','#fff','important');root.append(content);document.body.append(root);
   await Promise.all([...content.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));
   await new Promise(resolve=>requestAnimationFrame(resolve));
   if(JSON.stringify(check().selection)!==signature)throw Error('Your configuration changed. Print again after prices update.');
   // Letter landscape retains the wide overview and all four payment columns.
   const width=Math.max(bounds.width,content.scrollWidth),height=Math.max(bounds.height,content.scrollHeight),scale=Math.min(1,988/width,748/height);
   content.style.setProperty('zoom',String(scale),'important');root.style.height=Math.ceil(height*scale)+'px';
   root.classList.remove('wep-print-measuring');document.body.classList.add('wep-print-current');window.print();
  }catch(error){cleanup();if(message)message.textContent=error.message;}
  finally{preparing=false;}
 };
})();
