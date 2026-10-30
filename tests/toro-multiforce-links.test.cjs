const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parse}=require('../scripts/marketplace-sync.cjs');
const Kit=require('../universal/package-components.js');
const expected={72530:15,72531:15,72524:14,72525:14};
const read=name=>parse(fs.readFileSync('brands/toro/data/'+name+'.csv','utf8')).rows;
const unpack=table=>table.rows.map(values=>{const row={};if(table.encoding==='sparse'){for(let i=0;i<values.length;i+=2)row[table.headers[values[i]]]=values[i+1];}else table.headers.forEach((h,i)=>row[h]=values[i]);return row;});
function fixture(published){
 const bundle=JSON.parse(fs.readFileSync('data/marketplace-catalog.json','utf8')),table=bundle.componentSources.find(t=>t.brand==='TORO');
 const products=published?unpack(bundle.productSources.find(t=>t.brand==='TORO')):read('products');
 const source=Object.fromEntries(['attachments','accessories','parts'].map(name=>[name,published?unpack(table[name]):read(name)]));
 let sequence=0,selected;const window={crypto:{randomUUID:()=> 'test-build-'+(++sequence)}};
 vm.runInNewContext(fs.readFileSync('universal/equipment-package-pricing.js','utf8'),{window,URL,URLSearchParams,Intl});
 const api=window.WestEndEquipmentPackages,c={DATA:{componentSources:{TORO:source}},selectedStock:()=>null,selectedPriceVariant:()=>selected,selectPackageVariant:(_,v)=>selected=v,currentPrice:Kit.current,money:n=>n.toFixed(2),promoInfo:()=>null,paymentSelectionUrl:f=>'https://westendpower.github.io/westendpower-marketplace/payment-options.html?brand=TORO&sku='+selected.sku+'&quantity=2'};
 function render(sku){const row=products.find(p=>p.SKU===sku);assert.ok(row,sku);selected={sku,price:Kit.current(row),msrp:Number(row.MSRP),marketplaceRow:row};const f={key:'TORO|'+sku,brand:'TORO',model:row.Model,category:row.Category,power:row.PowerType,variants:[selected]};return {html:api.render(f,c),f};}
 return {api,c,render,source,products};
}
for(const published of [false,true])test('MULTI FORCE links use exact unit, workbook count and direct builder section in '+(published?'combined catalog':'CSV data'),()=>{
 const r=fixture(published);
 for(const [sku,count] of Object.entries(expected)){
  const {html,f}=r.render(sku);
  assert.match(html,new RegExp('View Attachments \\('+count+' Available\\)'));
  assert.match(html,/disabled aria-label="View Accessories \(0 Available\)"/);
  const href=html.match(/class="pp-option-picker" href="([^"]+)"/)[1].replaceAll('&amp;','&'),url=new URL(href);
  assert.equal(url.pathname,'/westendpower-marketplace/product-options.html');assert.equal(url.searchParams.get('brand'),'TORO');assert.equal(url.searchParams.get('sku'),sku);assert.equal(url.searchParams.get('quantity'),'2');
  assert.equal(url.searchParams.get('group'),'attachment');assert.equal(url.hash,'#wep-panel-attachment');assert.equal(url.searchParams.get('cardOptions'),'[]');
  assert.match(html,/target="_blank" rel="noopener"/);assert.notEqual(url.searchParams.get('configuration'),new URL(r.api.pickerUrl(f,r.c,'attachment')).searchParams.get('configuration'));
 }
});
test('model-specific companion quantities remain exact and missing workbook SKU is not substituted',()=>{
 const r=fixture(false),product=sku=>r.products.find(p=>p.SKU===sku),row=sku=>r.source.attachments.find(p=>p.SKU===sku),plain=v=>JSON.parse(JSON.stringify(v));
 assert.deepEqual(plain(r.api.requirementSlots(row('78598'),product('72530'))),[{sku:'78601',quantity:1},{sku:'133-5386',quantity:1},{sku:'140-4311',quantity:2}]);
 assert.deepEqual(plain(r.api.requirementSlots(row('78524'),product('72531'))),[{sku:'79526',quantity:1}]);
 assert.throws(()=>r.api.requirements([{type:'attachment',row:row('78524'),quantity:1}],r.source.attachments.map(row=>({type:'attachment',row})),product('72531')),/confirmation/);
 assert.equal(r.api.compatibility(row('78598'),product('72524')),false);
});
