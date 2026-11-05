const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('universal/webpage-builder.js','utf8');
function urlHarness(definition={}){
 const controls=[['brands',['TORO']],['categories',['Mowers']],['subcategories',['Zero-Turns']],['seriesValues',[]]].map(([name,values])=>({name,values}));
 const form={elements:{use:{value:''},stockOnly:{checked:false},clearanceOnly:{checked:false},clearImported:{checked:false},sort:{value:'workbook'},sourceUrl:{value:''}}};
 const input={},summary={},data={definition},document={querySelector:s=>s==='[data-builder-marketplace-url]'?input:s==='[data-builder-selection-summary]'?summary:null};
 const code=source.slice(source.indexOf(' function syncMarketplaceURL(){'),source.indexOf(' function updateSuggestions(){'));
 const sandbox={URL,controls,form,data,document,selected:c=>c.values,brandName:b=>b==='TORO'?'Toro':b};vm.runInNewContext(code,sandbox);
 return {controls,form,input,summary,sync:()=>{sandbox.syncMarketplaceURL();return new URL(input.value);}};
}
test('builder selections and the displayed and saved Marketplace URL stay aligned',()=>{
 const h=urlHarness(),u=h.sync();assert.equal(u.pathname,'/westendpower-marketplace/shop-by-product.html');
 assert.equal(u.searchParams.get('brand'),'TORO');assert.equal(u.searchParams.get('category'),'Mowers');assert.equal(u.searchParams.get('subcategory'),'Zero-Turns');assert.equal(u.searchParams.has('use'),false);assert.equal(u.searchParams.has('series'),false);
 assert.equal(h.form.elements.sourceUrl.value,h.input.value);assert.match(h.summary.textContent,/Toro.*Mowers.*Zero-Turns.*All uses/);
 h.controls[3].values=['TimeCutter','TITAN'];h.form.elements.use.value='Commercial';const changed=h.sync();
 assert.equal(changed.searchParams.get('use'),'Commercial');assert.equal(changed.searchParams.get('series'),'TimeCutter,TITAN');assert.equal(h.form.elements.sourceUrl.value,changed.href);
});
test('URL synchronization retains imported restrictions and removes them only when explicitly cleared',()=>{
 const h=urlHarness({deck:'42',power:'Gas',model:'X',search:'narrow search',promoOnly:true,buyOnline:true,availability:['order'],fields:[{field:'B1-Engine',values:['Kawasaki']},{field:'P1-Loader',values:['T']}]});
 let u=h.sync();assert.equal(u.searchParams.get('deck'),'42');assert.equal(u.searchParams.get('q'),'narrow search');assert.equal(u.searchParams.get('spec.B1-Engine'),'Kawasaki');assert.equal(u.searchParams.get('package'),'P1-Loader');assert.equal(u.searchParams.get('availability'),'order');
 h.form.elements.clearImported.checked=true;h.form.elements.stockOnly.checked=true;h.form.elements.clearanceOnly.checked=true;h.form.elements.sort.value='price';u=h.sync();
 for(const key of ['deck','power','model','q','promo','online','spec.B1-Engine','package'])assert.equal(u.searchParams.has(key),false);
 assert.equal(u.searchParams.get('availability'),'stock');assert.equal(u.searchParams.get('clearance'),'1');assert.equal(u.searchParams.get('sort'),'price');assert.equal(u.searchParams.get('brand'),'TORO');
});
test('automatic saved-page names do not overwrite custom wording or a fixed page address',()=>{
 const controls=[['brands',['TORO']],['categories',['Mowers']],['subcategories',['Zero-Turns']],['seriesValues',[]]].map(([name,values])=>({name,values}));
 const form={elements:{use:{value:'Commercial'},clearanceOnly:{checked:false},title:{value:'Old title'},description:{value:'Custom search wording'},intro:{value:'Custom introduction'},slug:{value:'keep-this-address'}}};
 const preview={},sandbox={controls,form,products:[],matches:()=>true,selected:c=>c.values,skuTokens:()=>[],brandName:()=> 'Toro',data:{saved:true},slugEdited:true,document:{querySelector:()=>preview}};
 vm.runInNewContext(source.slice(source.indexOf(' function suggest('),source.indexOf(' function syncMarketplaceURL(){')),sandbox);sandbox.suggest({keepWording:true});
 assert.equal(form.elements.title.value,'Toro Zero-Turns Commercial');assert.equal(form.elements.description.value,'Custom search wording');assert.equal(form.elements.intro.value,'Custom introduction');assert.equal(form.elements.slug.value,'keep-this-address');assert.equal(preview.textContent,'keep-this-address');
});
