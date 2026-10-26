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
  const packageMarkup=window.WestEndPackagePricing?.render(f,context)??null;
  const v=selectedPriceVariant(f),heading=clean(v.description)||clean(f.model)||clean(v.sku);
  const product='product.html?'+new URLSearchParams({brand:f.brand,sku:v.sku||''});
  const build=new URL(paymentSelectionUrl(f));build.pathname=build.pathname.replace(/payment-options(?:\.html)?\/?$/,'product-options.html');
  const runtime=new URL(build);runtime.searchParams.set('view','runtime');
  const image=clean(v.marketplaceRow?.ImageURL)||f.image;
  const packageSelected=/kit|package/i.test(v.type);
  const choices=selectedStock(f)?[{label:packageSelected?'Package:':'MSRP:',v,variants:[v],isPackage:packageSelected}]:priceChoices(f);
  const specs=Object.entries(Object.values(v.specs||{}).some(clean)?v.specs:f.specs||{}).filter(([,value])=>clean(value)).slice(0,4);
  const battery=/battery/i.test(f.power);
  if(battery){
   if(!document.querySelector('link[href*="build-buy.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='universal/build-buy.css';document.head.append(link);}
   if(!window.WEPBuildBuy&&!document.querySelector('script[src*="build-buy-tools.js"]')){const script=document.createElement('script');script.src='universal/build-buy-tools.js';document.head.append(script);}
  }
  return '<article class="market-card wep-blended-card wep-restored-card" data-key="'+escape(f.key)+'">'+
   '<header class="market-card-head"><h3><strong class="market-card-title" title="'+escape(heading)+'">'+escape(heading)+'</strong><div class="wep-card-sku"><span>SKU: '+escape(v.sku)+sawHeaderBars(f)+'</span>'+stockHeaderMarkup(f)+'</div></h3></header>'+
   '<div class="market-card-body"><section class="market-card-left">'+
    '<div class="market-image-wrap">'+banner(v,context)+'<a class="market-image" href="'+escape(product)+'">'+(image?'<img src="'+escape(image)+'" alt="'+escape(heading)+'" loading="lazy">':'<span>Image Coming Soon</span>')+'</a></div>'+
    '<div class="market-detail-actions"><a class="market-product-details" href="'+escape(product)+'">View Details</a><label class="market-product-details market-compare-detail"><input type="checkbox" data-compare="'+escape(f.key)+'" '+(state.compare.has(f.key)?'checked':'')+'> <span>Compare</span></label></div>'+
    cardFinanceMarkup(f)+
   '</section><section class="market-buy">'+
    '<h4 class="market-package-prices-title">Package Pricing</h4><div class="market-price-lines">'+(packageMarkup??choices.map(choice=>pricePanel(choice.label,choice.v,choice.isPackage,f,choice.variants)).join(''))+'</div>'+
    (battery?'<div class="market-actions"><a href="'+escape(runtime.href)+'" data-wep-runtime-brand="'+escape(f.brand)+'" data-wep-runtime-sku="'+escape(v.sku)+'">Run &amp; Charge Times</a></div>':'')+
    (window.WestEndPackagePricing?.actions(f,context)||'')+
    '<a '+(packageMarkup!==null?'data-pp-build ':'')+'class="market-product-page-link wep-card-build" href="'+escape(build.href)+'">Build &amp; Buy ↗</a><p class="wep-card-build-note">Configure your equipment and review current pricing.</p>'+
   '</section></div>'+
   (specs.length?'<dl class="market-specs market-card-footer-specs">'+specs.map(([label,value])=>'<div><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>').join('')+'</dl>':'')+(window.WestEndPackagePricing?.warranty(v.marketplaceRow||{})||'')+'</article>';
 }
 window.WestEndMarketplaceCard={render,expiration};
})();
