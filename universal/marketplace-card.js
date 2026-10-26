/* Shared shopping card. Selection, inventory and prices use existing catalog functions. */
(() => {
 'use strict';
 const clean=value=>String(value??'').trim();
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function expiration(value){
  const raw=clean(value);if(!raw)return '';
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw),date=match?new Date(+match[1],+match[2]-1,+match[3],12):new Date(raw);
  if(!Number.isFinite(date.getTime()))return '';
  return 'Expires '+['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sept.','Oct.','Nov.','Dec.'][date.getMonth()]+' '+date.getDate()+', '+date.getFullYear();
 }
 function banner(variant,context){
  const promo=context.promoInfo(variant);if(!promo||!(promo.savings>0))return '';
  const amount=context.money(promo.savings).replace(/\.00$/,'');
  const heading=promo.type==='rebate'?amount+' Rebate':'Save '+amount,end=expiration(promo.end);
  return '<div class="market-offer-row market-savings-banner"><div class="market-offer-promo"><strong>'+escape(heading)+'</strong>'+(end?'<small>'+escape(end)+'</small>':'')+'</div></div>';
 }
 function render(f,context){
  const {selectedPriceVariant,priceChoices,pricePanel,selectedStock,stockHeaderMarkup,sawHeaderBars,cardFinanceMarkup,paymentSelectionUrl,state}=context;
  const equipment=window.WestEndEquipmentPackages,battery=/battery/i.test(f.power);
  if(battery)equipment?.render(f,context); // Clear any previous fallback context before battery initialization.
  const batteryMarkup=battery?window.WestEndPackagePricing?.render(f,context):null;
  const packageMarkup=batteryMarkup??equipment?.render(f,battery?{...context,emptyBattery:true}:context)??window.WestEndPackagePricing?.render(f,context)??null;
  const compact=clean(f.brand).toUpperCase()==='YANMAR'&&/^compact tractors?$/i.test(clean(f.category)),v=selectedPriceVariant(f),tool=(compact?context.compactBaseVariant?.(f,v,true):null)||equipment?.tool(f)||window.WestEndPackagePricing?.tool(f,context)||v,heading=clean(tool.description)||clean(f.model)||clean(tool.sku),displaySku=compact?v.sku:tool.sku;
  let product='product.html?'+new URLSearchParams({brand:f.brand,sku:tool.sku||''});
  try{const url=new URL(clean(tool.marketplaceRow?.ProductURL||tool.productUrl||f.productUrl));if(['http:','https:'].includes(url.protocol))product=url.href;}catch{}
  const build=new URL(equipment?.buildUrl(f,context)||window.WestEndPackagePricing?.buildUrl(f,context)||paymentSelectionUrl(f));build.pathname=build.pathname.replace(/payment-options(?:\.html)?\/?$/,'product-options.html');
  const runtime=new URL(build);runtime.searchParams.set('view','runtime');
  const image=clean(tool.marketplaceRow?.ImageURL)||f.image;
  const packageSelected=/kit|package/i.test(v.type);
  const choices=selectedStock(f)?[{label:packageSelected?'Package:':'MSRP:',v,variants:[v],isPackage:packageSelected}]:priceChoices(f);
  const specs=Object.entries(Object.values(v.specs||{}).some(clean)?v.specs:f.specs||{}).filter(([,value])=>clean(value));
  if(battery){
   if(!document.querySelector('link[href*="build-buy.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='universal/build-buy.css';document.head.append(link);}
   if(!window.WEPBuildBuy&&!document.querySelector('script[src*="build-buy-tools.js"]')){const script=document.createElement('script');script.src='universal/build-buy-tools.js';document.head.append(script);}
  }
  return '<article class="market-card wep-blended-card wep-restored-card" data-key="'+escape(f.key)+'" data-brand="'+escape(clean(f.brand).toUpperCase())+'">'+
   '<header class="market-card-head"><h3><strong class="market-card-title" title="'+escape(heading)+'">'+escape(heading)+'</strong><div class="wep-card-sku"><span>SKU: '+escape(displaySku)+(tool.chainsawBarTrial?'':sawHeaderBars(f))+'</span>'+stockHeaderMarkup(f)+'</div></h3></header>'+
   '<div class="market-card-body"><div class="market-card-overview"><section class="market-card-left">'+
    '<div class="market-image-wrap">'+banner(equipment?.tool(f)||v,context)+'<a class="market-image" href="'+escape(product)+'" target="_blank" rel="noopener noreferrer" title="View product details" aria-label="View product details for '+escape(heading)+'">'+(image?'<img src="'+escape(image)+'" alt="'+escape(heading)+'" loading="lazy">':'<span>Image Coming Soon</span>')+'</a></div>'+
   '</section>'+
   (specs.length?'<dl class="market-specs market-card-side-specs" tabindex="0" aria-label="Product specifications">'+specs.map(([label,value])=>'<div><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl>':'<div class="market-empty-specs" aria-hidden="true"></div>')+
   '</div>'+(window.WestEndPackagePricing?.warranty(tool.marketplaceRow||{})||'<div class="market-card-warranty" aria-hidden="true"></div>')+'<section class="market-buy">'+
    '<div class="market-price-lines">'+(packageMarkup??choices.map(choice=>pricePanel(choice.label,choice.v,choice.isPackage,f,choice.variants,true)).join(''))+'</div>'+
    '<div class="market-card-action-row"><button type="button" class="market-inventory-button" data-pp-inventory title="Check tool and package inventory"><span aria-hidden="true">✓</span> Inventory</button><label class="market-compare-detail" title="Compare this product"><input type="checkbox" data-compare="'+escape(f.key)+'" '+(state.compare.has(f.key)?'checked':'')+'> <span>Compare</span></label>'+
    (battery?'<a href="'+escape(runtime.href)+'" title="View run and charge times" data-wep-runtime-brand="'+escape(f.brand)+'" data-wep-runtime-sku="'+escape(tool.sku)+'">Run Times</a>':'')+
    (equipment?.actions(f,context)||window.WestEndPackagePricing?.actions(f,context)||'')+
    '</div><span class="pp-cart-status" role="status" aria-live="polite"></span>'+cardFinanceMarkup(f,build.href)+
   '</section></div></article>';
 }
 window.WestEndMarketplaceCard={render,expiration};
})();
