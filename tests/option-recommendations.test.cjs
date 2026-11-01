const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Rec=require('../universal/option-recommendations.js'),{parse}=require('../scripts/marketplace-sync.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
function builder(rows,{store=storage(),model='72530',configuration='one'}={}){
 const product={SKU:model,BrandID:'TORO'},controls=rows.map(item=>({checked:false,disabled:false,dataset:{type:item.type,sku:item.row.SKU,name:item.row.Description||item.row.SKU},closest:()=>null})),qty=Object.fromEntries(rows.map(item=>[item.row.SKU,{value:1,readOnly:false}]));
 const window={WEPOptionRecommendations:Rec,WEPBuildSession:{id:configuration}};
 vm.runInNewContext(fs.readFileSync('universal/equipment-package-pricing.js','utf8'),{window,URL,URLSearchParams,Intl});
 const ctx={window,sessionStorage:store,selectedBrand:'toro',sku:model,selectedProduct:product,clean:v=>String(v??'').trim(),CSS:{escape:v=>v},factoryPackageIncludedSkus:new Set(),inventoryPackageIncludes:[],trueish:()=>false,packageIncludedSku:()=>false,WEPBuildBuy:{usable:r=>r.Active!=='F'},batteryRequirementRules:[],
  compatibilityChoice:r=>window.WestEndEquipmentPackages.compatibility(r,product),document:{querySelectorAll:()=>controls,querySelector:selector=>qty[selector.match(/data-qty="([^"]+)"/)?.[1]]},catalog:rows};
 const source=fs.readFileSync('universal/product-options.js','utf8');vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('let optionRequirementRows='),source.indexOf('function byId('))+'\noptionRequirementRows=catalog;optionRequirementCatalog=catalog;',ctx);
 const control=sku=>controls.find(c=>c.dataset.sku===sku),sync=()=>ctx.syncOptionRequirements();
 function change(sku,checked){const c=control(sku);c.checked=checked;vm.runInContext('optionRecommendationState()',ctx).change(c.dataset.type+':'+sku,checked);sync();}
 return {ctx,window,controls,qty,control,sync,change,store};
}
const row=(sku,fields={})=>({type:'accessory',row:{SKU:sku,Description:sku,Active:'T','72530':'T',...fields}});
function fixture(){return [row('P',{'72530-Req1':'R','72530-Qty1':'1','72530-Rec1':'A','72530-RecQty1':'2'}),row('R'),row('A',{'72530-Req1':'B','72530-Qty1':'1'}),row('B')];}
test('recommendation slots are numbered, model-specific, and accept the published Qtyt typo',()=>{
 assert.deepEqual(plain(Rec.slots({'72530-Rec2':'B','72530-RecQty2':3,'72530-Rec1':'A','72530-RecQtyt1':2,'72525-Rec1':'WRONG'},{SKU:'72530'})).map(({sku,quantity})=>({sku,quantity})),[{sku:'A',quantity:2},{sku:'B',quantity:3}]);
 assert.deepEqual(Rec.slots({'72530-Req1':'REQUIRED'},{SKU:'72530'}),[]);
});
test('automatic recommendations have quantities, removable controls, mandatory children and persistent opt-outs',()=>{
 const b=builder(fixture());b.qty.P.value=2;b.change('P',true);
 assert.equal(b.control('A').checked,true);assert.equal(b.qty.A.value,4);assert.equal(b.control('A').disabled,false);assert.equal(b.control('A').dataset.wepRecommended,'true');
 assert.equal(b.control('R').disabled,true);assert.equal(b.control('B').disabled,true);assert.equal(b.qty.B.value,4);
 b.change('A',false);for(let i=0;i<3;i++)b.sync();assert.equal(b.control('A').checked,false);assert.equal(b.control('B').checked,false);assert.equal(b.control('R').checked,true);
 const restored=builder(fixture(),{store:b.store});restored.change('P',true);assert.equal(restored.control('A').checked,false);
 const other=builder(fixture(),{store:b.store,configuration:'two'});other.change('P',true);assert.equal(other.control('A').checked,true);
});
test('parent removal clears automatic recommendations and their requirements; explicit choices remain',()=>{
 const b=builder(fixture());b.change('P',true);b.change('P',false);assert.equal(b.control('A').checked,false);assert.equal(b.control('B').checked,false);assert.equal(b.control('R').checked,false);
 b.change('A',true);b.change('P',true);b.change('P',false);assert.equal(b.control('A').checked,true);assert.equal(b.control('B').checked,true);
});
test('draft restoration after initial page setup preserves automatic provenance',()=>{
 const before=builder(fixture());before.change('P',true);
 const after=builder(fixture(),{store:before.store});after.sync();
 after.control('P').checked=true;after.control('A').checked=true;after.sync();
 assert.equal(after.control('A').dataset.wepRecommended,'true');after.change('P',false);
 assert.equal(after.control('A').checked,false);assert.equal(after.control('B').checked,false);
});
test('shared recommendations appear once, scale to the largest parent, and required status wins',()=>{
 const rows=fixture();rows.push(row('Q',{'72530-Rec1':'A','72530-RecQty1':'1'}));const b=builder(rows);b.change('P',true);b.qty.Q.value=3;b.change('Q',true);assert.equal(b.qty.A.value,3);b.change('Q',false);assert.equal(b.qty.A.value,2);
 rows[0].row['72530-Req2']='A';rows[0].row['72530-Qty2']='1';b.sync();assert.equal(b.control('A').disabled,true);b.change('P',false);assert.equal(b.control('A').checked,false);
});
test('missing, inactive and excessive recommendations never block purchasing their parent',()=>{
 for(const mutate of [rows=>rows.splice(2,1),rows=>rows[2].row.Active='F',rows=>rows[0].row['72530-RecQty1']='0',rows=>rows[0].row['72530-RecQty1']='21',rows=>rows.splice(3,1)]){
  const rows=fixture();mutate(rows);const b=builder(rows);assert.doesNotThrow(()=>b.change('P',true));assert.equal(b.control('P').checked,true);assert.match(vm.runInContext('recommendationWarning',b.ctx),/recommended items are unavailable/);
 }
});
test('cyclic recommendations terminate without duplicate or unrelated items',()=>{
 const b=builder([row('P',{'72530-Rec1':'A'}),row('A',{'72530-Rec1':'P'})]);assert.doesNotThrow(()=>b.change('P',true));assert.equal(b.controls.filter(c=>c.checked).length,2);
});
test('both published snow blades default the two recommended kits on all four models',()=>{
 const names={attachment:'attachments',accessory:'accessories',part:'parts'},rows=Object.entries(names).flatMap(([type,name])=>parse(fs.readFileSync('brands/toro/data/'+name+'.csv','utf8')).rows.map(row=>({type,row})));
 for(const model of ['72530','72531','72524','72525'])for(const blade of ['STB13567B','STB13759B']){
  const b=builder(rows,{model});b.qty[blade].value=2;b.change(blade,true);
  for(const sku of ['133-5386','140-4310']){assert.equal(b.control(sku).checked,true);assert.equal(b.control(sku).disabled,false);assert.equal(b.qty[sku].value,2);}
  assert.equal(b.control('136-0513').disabled,true);b.change('140-4310',false);b.sync();assert.equal(b.control('140-4310').checked,false);assert.equal(b.control('133-5386').checked,true);
 }
});
test('builder pages load recommendations before itemized quote code; recommendations keep Remove controls',()=>{
 for(const page of ['product-options.html','choose-implements.html']){const s=fs.readFileSync(page,'utf8');assert.ok(s.indexOf('option-recommendations.js')<s.indexOf('universal/product-options.js'));}
 const source=fs.readFileSync('universal/product-options.js','utf8');assert.match(source,/line\.type!=='tool'&&!line\.required\?'<button type="button" data-review-remove-type/);assert.match(source,/Recommended with /);
});
