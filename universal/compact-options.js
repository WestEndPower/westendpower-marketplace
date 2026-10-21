/* WEP_COMPACT_OPTION_CAROUSELS_V1: retain the existing cart and installation handlers. */
(function(){
 'use strict';
 const app=document.getElementById('app');if(!app)return;
 let nextId=0;
 const carousels=new Map();
 function resetDock(){
  document.body.classList.remove('wep-options-docked');
  document.documentElement.style.removeProperty('--wep-options-dock-height');
  document.documentElement.style.removeProperty('--wep-options-panel-height');
 }
 let imageDialog,imagePreview,imageTitle,imageNotice,imageOpener;
 function openImage(img,opener){
  if(!imageDialog){
   imageDialog=document.createElement('dialog');imageDialog.className='wep-option-image-dialog';imageDialog.setAttribute('aria-labelledby','wep-option-image-title');
   const head=document.createElement('div');head.className='wep-option-image-dialog-head';
   imageTitle=document.createElement('h2');imageTitle.id='wep-option-image-title';
   const close=document.createElement('button');close.type='button';close.textContent='Close';close.setAttribute('aria-label','Close enlarged image');close.onclick=()=>imageDialog.close();head.append(imageTitle,close);
   imagePreview=document.createElement('img');imageNotice=document.createElement('p');imageNotice.className='wep-option-image-notice';imageNotice.hidden=true;imageNotice.setAttribute('role','status');
   imagePreview.onerror=()=>{imagePreview.hidden=true;imageNotice.hidden=false;imageNotice.textContent='This image is unavailable. Please close this view and try another image.';};
   imageDialog.append(head,imagePreview,imageNotice);document.body.append(imageDialog);
   imageDialog.addEventListener('click',event=>{if(event.target===imageDialog)imageDialog.close();});
   imageDialog.addEventListener('close',()=>imageOpener?.focus());
  }
  imageOpener=opener;imageTitle.textContent=img.alt||'Equipment image';imagePreview.alt=img.alt||'Equipment image';imagePreview.hidden=false;imageNotice.hidden=true;
  imagePreview.src=img.currentSrc||img.src;
  if(!imageDialog.open)imageDialog.showModal();
 }
 function zoomImages(){
  for(const img of app.querySelectorAll('.media img,.card-media img')){
   if(img.dataset.wepZoom||!img.getAttribute('src')||img.closest('a,button'))continue;
   img.dataset.wepZoom='true';
   const button=document.createElement('button');button.type='button';button.className='wep-option-image-zoom';button.setAttribute('aria-label','View larger image: '+(img.alt||'equipment'));button.title='Click to enlarge';
   img.before(button);button.append(img);button.addEventListener('click',()=>openImage(img,button));
  }
 }
 function updateArrows(){for(const [row,controls] of carousels){
  if(!row.isConnected){carousels.delete(row);continue;}
  if(row.closest('[hidden]'))continue;
  const max=row.scrollWidth-row.clientWidth;controls.hidden=max<3;
  const buttons=controls.querySelectorAll('button');buttons[0].disabled=row.scrollLeft<3;buttons[1].disabled=row.scrollLeft>=max-3;
 }}
 function setPanel(button,scroll){
  for(const other of app.querySelectorAll('[data-wep-panel]'))other.setAttribute('aria-expanded',String(other===button));
  for(const panel of app.querySelectorAll('.wep-option-panel'))panel.hidden=panel.id!=='wep-panel-'+button.dataset.wepPanel;
  // Show the selected row below the tabs without moving the page.
  resetDock();requestAnimationFrame(()=>{resetDock();updateArrows();});
 }
 function enhanceImplementTypes(panel,heading){
  const row=panel.querySelector('[data-wep-implement-types]');if(!row||row.dataset.wepTypeCarousel)return;row.dataset.wepTypeCarousel='true';
  row.id='wep-implement-type-carousel';const controls=document.createElement('div');controls.className='wep-carousel-controls';controls.hidden=true;
  function advance(direction){const width=row.querySelector('.wep-inline-implement-tile')?.getBoundingClientRect().width||210;row.scrollBy({left:direction*Math.max(width+12,row.clientWidth-width-12),behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  for(const [direction,text,label] of [[-1,'‹','Previous implement types'],[1,'›','Next implement types']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);button.setAttribute('aria-controls',row.id);button.addEventListener('click',()=>advance(direction));controls.append(button);}
  heading.append(controls);carousels.set(row,controls);row.addEventListener('scroll',updateArrows,{passive:true});
  row.addEventListener('keydown',event=>{if(event.target!==row||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();advance(event.key==='ArrowLeft'?-1:1);});
  if(window.ResizeObserver)new ResizeObserver(updateArrows).observe(row);
 }
 function addViewAll(panel,heading){
  if(panel.dataset.wepViewAll)return;
  panel.dataset.wepViewAll='true';
  const button=document.createElement('button');button.type='button';button.className='wep-view-all-options';button.textContent='View All';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);
  button.setAttribute('aria-label','View all '+(panel.id==='wep-panel-implement'?'compatible implements':heading.querySelector('h2')?.textContent?.toLowerCase()||'options'));
  button.addEventListener('click',()=>{
   const expanded=!panel.classList.contains('wep-view-all-active');panel.classList.toggle('wep-view-all-active',expanded);button.textContent=expanded?'Close':'View All';button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',expanded?'Close expanded options':'View all '+(panel.id==='wep-panel-implement'?'compatible implements':heading.querySelector('h2')?.textContent?.toLowerCase()||'options'));
   const tiles=panel.querySelector('[data-wep-implement-types]');if(tiles){
    tiles.hidden=expanded;panel.querySelector('.wep-implement-back').hidden=true;
    panel.querySelectorAll('[data-wep-implement-group-content]').forEach(group=>group.hidden=!expanded);
    panel.querySelectorAll('[data-wep-implement-group]').forEach(tile=>tile.setAttribute('aria-expanded','false'));
   }
   requestAnimationFrame(updateArrows);
  });heading.append(button);
 }
 function compactCard(card){
  if(card.dataset.wepCompact)return;card.dataset.wepCompact='true';card.classList.add('wep-carousel-card');
  const body=card.querySelector('.card-body'),media=card.querySelector('.card-media'),title=body?.querySelector('h3'),price=body?.querySelector('.card-price');
  if(!body||!title||!price)return;
  const check=body.querySelector('.option-check'),qty=body.querySelector('.select-row .qty'),selection=body.querySelector('.select-row'),add=body.querySelector('.add-option-cart'),stock=body.querySelector('details.stock-details');
  const name=title.textContent,top=document.createElement('div'),info=document.createElement('div');top.className='wep-option-card-top';info.className='wep-option-card-info';
  if(media)top.append(media);top.append(info);
  // Move the title, SKU, description and price together; installation stays below.
  let node=title;while(node){const following=node.nextSibling;info.append(node);if(node===price)break;node=following;}
  const heading=document.createElement('div');heading.className='wep-option-card-title';title.before(heading);heading.append(title);
  // Cart/package logic keeps the selection input; Add to Cart is the visible control.
  if(check&&add){const state=document.createElement('span');state.className='wep-card-select';state.hidden=true;state.append(check);heading.append(state);}
  body.prepend(top);
  const actions=document.createElement('div');actions.className='wep-option-actions';let stockPanel;
  if(stock){
   const button=document.createElement('button');button.type='button';button.className='wep-option-stock-toggle';button.textContent='Check Stock';button.setAttribute('aria-expanded','false');
   stockPanel=document.createElement('div');stockPanel.id='wep-option-stock-'+(++nextId);stockPanel.className='wep-option-stock-content';stockPanel.hidden=true;
   button.setAttribute('aria-controls',stockPanel.id);
   for(const child of [...stock.childNodes])if(!(child.nodeType===1&&child.tagName==='SUMMARY'))stockPanel.append(child);
   button.addEventListener('click',()=>{stockPanel.hidden=!stockPanel.hidden;button.setAttribute('aria-expanded',String(!stockPanel.hidden));});actions.append(button);stock.remove();
  }
  if(qty){const label=document.createElement('label');label.className='wep-option-qty';label.append(document.createTextNode('Qty'),qty);qty.setAttribute('aria-label','Quantity for '+name);actions.append(label);}
  if(add){actions.append(add);selection?.remove();}
  // Unpriced or non-cart items keep their existing selection control.
  else if(selection&&qty)selection.append(document.createTextNode(' '));
  body.append(actions);if(stockPanel)body.append(stockPanel);
 }
 function enhance(){
  const nav=app.querySelector('.wep-option-nav');
  if(nav&&!nav.dataset.wepCompact){
   nav.dataset.wepCompact='true';nav.classList.add('wep-floating-options');
   // Keep one tab selected; intercept the original collapse/scroll handler.
   nav.addEventListener('click',event=>{const button=event.target.closest('[data-wep-panel]');if(!button||!nav.contains(button))return;event.preventDefault();event.stopImmediatePropagation();setPanel(button,true);},true);
   const first=nav.querySelector('[data-wep-panel="implement"]')||nav.querySelector('[data-wep-panel="attachment"]')||nav.querySelector('[aria-expanded="true"]')||nav.querySelector('[data-wep-panel]');if(first)setPanel(first,false);
  }
  for(const type of ['attachment','implement','accessory','part']){
   const panel=document.getElementById('wep-panel-'+type);if(!panel)continue;
   const implementHeading=panel.querySelector('.wep-implements-main-heading');if(implementHeading){addViewAll(panel,implementHeading);enhanceImplementTypes(panel,implementHeading);}
   for(const row of panel.querySelectorAll('.grid')){
    if(row.dataset.wepCarousel)continue;row.dataset.wepCarousel='true';row.classList.add('wep-options-carousel');
    const section=row.closest('section'),title=section?.querySelector('h2');if(!section||!title)continue;
    section.classList.add('wep-carousel-section');
    for(const card of row.querySelectorAll(':scope>.card'))compactCard(card);
    const id='wep-options-carousel-'+(++nextId);row.id=id;row.tabIndex=0;row.setAttribute('role','region');row.setAttribute('aria-label',title.textContent);
    const heading=document.createElement('div');heading.className='wep-carousel-heading';title.before(heading);heading.append(title);
    const controls=document.createElement('div');controls.className='wep-carousel-controls';controls.hidden=true;
    function advance(direction){const width=row.querySelector('.card')?.getBoundingClientRect().width||320;row.scrollBy({left:direction*Math.max(width+12,row.clientWidth-width-12),behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    for(const [direction,text,label] of [[-1,'‹','Previous'],[1,'›','Next']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label+' '+title.textContent.toLowerCase());b.setAttribute('aria-controls',id);b.addEventListener('click',()=>advance(direction));controls.append(b);}
    if(!implementHeading)addViewAll(panel,heading);
    heading.append(controls);carousels.set(row,controls);row.addEventListener('scroll',updateArrows,{passive:true});
    row.addEventListener('keydown',event=>{if(event.target!==row||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();advance(event.key==='ArrowLeft'?-1:1);});
    if(window.ResizeObserver)new ResizeObserver(updateArrows).observe(row);
   }
  }
  zoomImages();resetDock();requestAnimationFrame(updateArrows);
 }
 window.addEventListener('resize',updateArrows);
 new MutationObserver(enhance).observe(app,{childList:true,subtree:true});enhance();
})();
