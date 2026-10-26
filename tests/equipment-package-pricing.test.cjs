'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parse}=require('../scripts/marketplace-sync.cjs'),Kit=require('../universal/package-components.js');
const rows=name=>parse(fs.readFileSync('brands/stihl/data/'+name+'.csv','utf8')).rows;
function fixture(published=false){
 let source={attachments:rows('attachments'),accessories:rows('accessories'),parts:rows('parts')};
 let row=rows('products').find(r=>r.SKU==='WB01 011 3600 US');
 if(published){
  const bundle=JSON.parse(fs.readFileSync('data/marketplace-catalog.json','utf8')),tables=bundle.componentSources.find(x=>x.brand==='STIHL');
  const unpack=table=>table.rows.map(values=>{const out={};if(table.encoding==='sparse'){for(let i=0;i<values.length;i+=2)out[table.headers[values[i]]]=values[i+1];}else table.headers.forEach((h,i)=>out[h]=values[i]);return out;});
  source={attachments:unpack(tables.attachments),accessories:unpack(tables.accessories),parts:unpack(tables.parts)};row=unpack(bundle.productSources.find(x=>x.brand==='STIHL')).find(x=>x.SKU===row.SKU);
 }
 const tool={sku:row.SKU,model:row.Model,description:row.Description,type:'Tool',price:Kit.current(row),msrp:Number(row.MSRP),marketplaceRow:row};
 const f={key:'STIHL|RZ142',brand:'STIHL',model:'RZ 142',category:'Mowers',power:'Gas',variants:[tool]};
 let selected=tool,quantity=1;const saved=new Map(),status={textContent:''},host={dataset:{key:f.key},querySelector:()=>status},window={WEPKitComponents:Kit,dispatchEvent(){}},document={querySelector:()=>null};
 const context={window,document,URL,URLSearchParams,Intl,CustomEvent:class{},localStorage:{getItem:k=>saved.get(k)||'[]',setItem:(k,v)=>saved.set(k,v)}};
 vm.runInNewContext(fs.readFileSync('universal/equipment-package-pricing.js','utf8'),context);
 const c={DATA:{componentSources:{STIHL:source}},selectedStock:()=>null,selectedPriceVariant:()=>selected,selectPackageVariant:(_,v)=>selected=v,currentPrice:Kit.current,money:n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n),promoInfo:()=>({type:'rebate',savings:400,regular:4399.99,price:3999.99}),paymentSelectionUrl:()=> 'https://dealer.example/payment-options.html?brand=STIHL&sku='+encodeURIComponent(tool.sku)+'&quantity='+quantity,selectedPriceQuantity:()=>quantity,updateCartFloat(){},track(){}};
 const api=window.WestEndEquipmentPackages;c.refreshSelectedCard=()=>api.render(f,c);
 const click=(selector,button)=>api.handle({target:{closest:s=>s==='.wep-restored-card'?host:s===selector?button:null}});
 const toggle=sku=>click('[data-eqp-option]',{dataset:{eqpOption:sku}}),base=()=>click('[data-eqp-select]',{dataset:{eqpSelect:'tool'}}),add=()=>click('[data-eqp-add]',{});
 return {api,f,c,source,tool,saved,status,toggle,base,add,window,context,setQuantity:q=>quantity=q};
}
test('real RZ142 workbook rows drive base/default layout and compatible button names',()=>{
 const r=fixture(),html=r.api.render(r.f,r.c);
 assert.match(html,/pp-equipment-base pp-selected/);assert.match(html,/STIHL Base Price:/);assert.match(html,/Package MSRP:/);assert.match(html,/\$4,399\.99/);
 for(const sku of ['WB00 007 1005','WB00 007 1010','WB00 700 9700','WB00 780 2700']){const row=r.source.attachments.find(p=>p.SKU===sku);assert.equal(r.api.shortName(row),row.Description);assert.ok(html.includes('title="'+row.Description.replaceAll('&','&amp;').replaceAll('\"','&quot;')+'"'));}
 assert.match(html,/role="group" aria-label="Accessories"><\/div>/);assert.doesNotMatch(html,/>Mower Boot Kit<|>Bagging Blower</);
 assert.equal(r.c.selectedPriceVariant(r.f).sku,r.tool.sku);assert.equal(r.c.selectedPriceVariant(r.f).price,3999.99);
 assert.match(r.api.tool(r.f).marketplaceRow.ImageURL,/RZ142\.jpg$/);
});
test('bagger includes the correct required boot once in totals and builder options; removal clears it silently',()=>{
 const r=fixture();r.api.render(r.f,r.c);r.toggle('WB00 700 9700');const html=r.api.render(r.f,r.c),v=r.c.selectedPriceVariant(r.f);
 assert.equal(v.msrp,5309.97);assert.equal(v.price,4909.97);assert.match(html,/Includes required Mower Boot Kit/);
 assert.equal(v.packageItems.filter(p=>p.sku==='WB00 710 7600').length,1);assert.equal(v.packageItems.some(p=>p.sku==='WB00 760 0500'),false);
 const url=new URL(r.api.buildUrl(r.f,r.c)),parts=JSON.parse(url.searchParams.get('cardOptions'));
 assert.deepEqual(parts.map(p=>p.sku),['WB00 700 9700']); // Builder derives and locks required components itself.assert.equal(url.searchParams.get('sku'),r.tool.sku);
 assert.equal(r.api.publishedPrice(r.f,false),5309.97);assert.equal(r.api.publishedPrice(r.f,true),4909.97);
 r.toggle('WB00 700 9700');assert.equal(JSON.parse(new URL(r.api.buildUrl(r.f,r.c)).searchParams.get('cardOptions')).length,0);assert.match(r.api.render(r.f,r.c),/pp-equipment-base pp-selected/);
});
test('multiple options, mandatory requirements and package quantity reach cart without duplicate charges',()=>{
 const r=fixture();r.api.render(r.f,r.c);r.toggle('WB00 700 9700');r.toggle('WB00 780 2700');r.setQuantity(2);r.add();
 let cart=JSON.parse(r.saved.get('wepCart'));assert.equal(cart.length,4);assert.ok(cart.every(p=>p.quantity===2));assert.equal(new Set(cart.map(p=>p.packageId)).size,1);
 assert.ok(cart.filter(p=>p.type!=='tool').every(p=>p.packageComponent&&p.perToolQuantity===1));assert.equal(cart.find(p=>p.sku==='WB00 710 7600').autoRequiredComponent,true);assert.equal(cart.reduce((n,p)=>n+p.quantity*Math.round(p.itemPrice*100),0),1000192);
 r.add();cart=JSON.parse(r.saved.get('wepCart'));assert.ok(cart.every(p=>p.quantity===4));
 r.base();r.add();cart=JSON.parse(r.saved.get('wepCart'));assert.equal(cart.length,5);assert.equal(new Set(cart.map(p=>p.packageId)).size,2);assert.equal(r.status.textContent,'Added to Cart ✓');
});
test('compatible workbook additions/removals populate the right row and explicit exclusions beat group flags',()=>{
 const r=fixture();r.api.render(r.f,r.c);r.source.accessories.push({SKU:'TEST-ACCESS',Description:'Seat Cover',Active:'T',MSRP:'50','WB01 011 3600 US':'T'});
 assert.match(r.api.render(r.f,r.c),/aria-label="Accessories"/);r.toggle('TEST-ACCESS');assert.equal(r.c.selectedPriceVariant(r.f).msrp,4449.99);
 r.source.accessories.find(p=>p.SKU==='TEST-ACCESS').Active='F';assert.doesNotMatch(r.api.render(r.f,r.c),/data-eqp-option="TEST-ACCESS"/);assert.equal(r.c.selectedPriceVariant(r.f).sku,r.tool.sku);
 assert.equal(r.api.compatibility({'WB01 011 3600 US':'F','Group_ALL_STIHL':'T'},r.tool.marketplaceRow),false);
});
test('missing required items block adding an incomplete package; unrelated cards and stock flow are unchanged',()=>{
 const r=fixture();r.source.attachments=r.source.attachments.filter(p=>p.SKU!=='WB00 710 7600');r.api.render(r.f,r.c);r.toggle('WB00 700 9700');
 assert.match(r.api.render(r.f,r.c),/Required package items need store confirmation/);r.add();assert.equal(r.saved.has('wepCart'),false);
 for(const patch of [{model:'RZ 252'},{model:'BGA60',power:'Battery'},{brand:'YANMAR',category:'Compact Tractors'}])assert.equal(r.api.render({...r.f,key:JSON.stringify(patch),...patch},r.c),null);
 r.c.selectedStock=()=>({selectionId:'UNIT'});assert.equal(r.api.render(r.f,r.c),null);assert.equal(r.api.tool(r.f),undefined);
});

test('RZ142 card keeps the base identity and rebate while carrying configured options to both price links',()=>{
 const r=fixture();Object.assign(r.c,{priceChoices:()=>[],pricePanel:()=>'',stockHeaderMarkup:()=>'',sawHeaderBars:()=>'',state:{compare:new Set()},cardFinanceMarkup:(_,url)=>'<a class="test-build" href="'+url+'">Build</a>'});
 vm.runInNewContext(fs.readFileSync('universal/marketplace-card.js','utf8'),r.context);
 let html=r.window.WestEndMarketplaceCard.render(r.f,r.c);assert.match(html,/src="brands\/stihl\/images\/Products\/RZ142\.jpg"/);assert.match(html,/pp-equipment-base pp-selected/);assert.match(html,/\$400 Rebate/);
 r.toggle('WB00 700 9700');html=r.window.WestEndMarketplaceCard.render(r.f,r.c);assert.match(html,/SKU: WB01 011 3600 US/);assert.match(html,/\$400 Rebate/);assert.match(html,/Package MSRP:/);assert.match(html,/\$5,309\.97/);assert.match(html,/pp-equipment-package pp-selected/);
 const url=new URL(r.api.buildUrl(r.f,r.c));assert.equal(JSON.parse(url.searchParams.get('cardOptions')).length,1);
});
test('shopping pages load equipment package support before shared cards and route clicks through it',()=>{
 for(const path of ['marketplace.html','shop-by-product.html','shop-by-brand.html']){
  const html=fs.readFileSync(path,'utf8');assert.ok(html.indexOf('src="universal/equipment-package-pricing.js')<html.indexOf('src="universal/marketplace-card.js'));
 }
 for(const path of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html'])assert.match(fs.readFileSync(path,'utf8'),/if\(window\.WestEndEquipmentPackages\?\.handle\(e\)\)return;/);
});

test('the published combined workbook export contains the RZ142 choices and correct requirement pricing',()=>{
 const r=fixture(true);r.api.render(r.f,r.c);r.toggle('WB00 700 9700');
 assert.equal(r.c.selectedPriceVariant(r.f).msrp,5309.97);assert.equal(r.c.selectedPriceVariant(r.f).packageItems.length,2);
});

test('Attachments and Accessories show every full name and remain empty when no options apply',()=>{
 const r=fixture();
 for(let i=0;i<6;i++)r.source.accessories.push({SKU:'ACCESS-'+i,Description:'Accessory '+i,Active:'T',MSRP:'10',SortOrder:String(i),'WB01 011 3600 US':'T'});
 let html=r.api.render(r.f,r.c);assert.equal((html.match(/class="pp-component-row"/g)||[]).length,2);
 for(let i=0;i<6;i++)assert.ok(html.includes('data-eqp-option="ACCESS-'+i+'"'));
 r.source.attachments=[];r.source.accessories=[];r.source.parts=[];html=r.api.render(r.f,r.c);
 assert.match(html,/>Attachments<\/span><div role="group" aria-label="Attachments"><\/div>/);assert.match(html,/>Accessories<\/span><div role="group" aria-label="Accessories"><\/div>/);assert.match(html,/Package MSRP:/);
});
