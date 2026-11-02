'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bars=require('../universal/bar-options.js'),factory=require('../universal/factory-options.js');
const {parse}=require('../scripts/marketplace-sync.cjs');
const row=(SKU,Description,extra={})=>({SKU,Description,Model:'MS 462 C-M',BrandID:'STIHL',Category:'Chainsaws',PowerType:'Gas',ProductType:'Tool',Active:'T',MSRP:1600,SortOrder:1,...extra});
const current=row('STD16','Chainsaw w/16"');
test('builder offers the published MS462 C-M standard and light sizes with the original exact SKU selected',()=>{
 const products=parse(fs.readFileSync('brands/stihl/data/products.csv','utf8')).rows;
 const selected=products.find(r=>r.SKU==='1142 200 0134');assert.ok(selected);
 const choices=bars.variants(products,selected,'STIHL');
 assert.deepEqual(choices.filter(c=>!c.light).map(c=>c.size).sort((a,b)=>a-b),[16,18,20,25,28,32,36]);
 assert.deepEqual(choices.filter(c=>c.light).map(c=>c.size).sort((a,b)=>a-b),[25,28,32,36]);
 assert.equal(choices.find(c=>!c.light&&c.size===16).row.SKU,selected.SKU);
 assert.ok(choices.every(c=>c.row.Model===selected.Model));
});
test('families, power type, activity and workbook sort order retain exact variant identities',()=>{
 const products=[current,row('LATER','Chainsaw w/20"',{SortOrder:5}),row('FIRST','Chainsaw w/20"',{SortOrder:2}),row('LIGHT','Chainsaw w/20" Light',{SortOrder:3}),row('OFF','Chainsaw w/25"',{Active:'F'}),row('OTHER','Chainsaw w/28"',{Model:'MS 462'}),row('BAT','Chainsaw w/30"',{PowerType:'Battery'}),row('KIT','Chainsaw w/32"',{ProductType:'Kit'}),row('BRAND','Chainsaw w/36"',{BrandID:'OTHER'})];
 assert.deepEqual(bars.variants(products,current,'STIHL').map(c=>c.row.SKU),['STD16','FIRST','LIGHT']);
 assert.equal(bars.variants(products,{...current,PowerType:'Battery'},'STIHL').length,0);
 const shared=products.map(r=>({...r,MarketplaceFamily:r.Model==='MS 462'?'Shared':''}));
 shared.push(row('SHARED','Chainsaw w/18"',{Model:'Alternate',MarketplaceFamily:'Shared'}));
 assert.equal(bars.variants(shared,{...current,MarketplaceFamily:'Shared'},'STIHL').length,2);
});
function mounted({stocked=false,ready=true,fail=false}={}){
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.isConnected=true;this.textContent='';}
  append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs[k]=v;}after(node){this.next=node;}addEventListener(){}
 }
 const app=new Element('div'),price=new Element('p'),changes=[];let refresh;
 const window={WEPBuildConfiguration:{status:()=>({ready,stocked})}},document={createElement:tag=>new Element(tag),querySelector:()=>price,getElementById:()=>app};
 vm.runInNewContext(fs.readFileSync('universal/bar-options.js','utf8'),{window,document,MutationObserver:class{constructor(fn){refresh=fn;}observe(){}disconnect(){}},queueMicrotask:fn=>fn()});
 const next=row('LIGHT25','Chainsaw w/25" Light');
 const section=window.WEPBarOptions.mount({products:[current,next],product:current,brand:'STIHL',onChange:p=>{if(fail)throw Error('Could not save this build');changes.push(p);}});
 const buttons=section.children.slice(0,2).flatMap(r=>r.children[1].children);
 return {section,buttons,changes,next,refresh,setReady:v=>ready=v,setStocked:v=>stocked=v};
}
test('bar controls keep the incoming selection and send the exact chosen SKU to the configuration change',()=>{
 const f=mounted();assert.equal(f.buttons[0].attrs['aria-pressed'],'true');assert.equal(f.buttons[0].disabled,true);
 assert.equal(f.buttons[1].attrs['aria-pressed'],'false');assert.equal(f.buttons[1].disabled,false);
 f.buttons[1].onclick();assert.equal(f.changes[0].SKU,'LIGHT25');assert.ok(f.buttons.every(b=>b.disabled));
});
test('stock units and pending availability lock changes; errors keep the current build usable',()=>{
 const f=mounted({ready:false});assert.ok(f.buttons.every(b=>b.disabled));f.buttons[1].onclick();assert.equal(f.changes.length,0);
 f.setReady(true);f.setStocked(true);f.refresh();assert.ok(f.buttons.every(b=>b.disabled));assert.match(f.section.children[2].textContent,/bar is fixed/);
 f.setStocked(false);f.refresh();assert.equal(f.buttons[1].disabled,false);
 const failed=mounted({fail:true});failed.buttons[1].onclick();assert.match(failed.section.children[2].textContent,/Could not save/);assert.equal(failed.buttons[1].disabled,false);
});
test('bar SKU transfer retains quantity and compatible extras without replacing another saved package',()=>{
 const next=row('LIGHT25','Chainsaw w/25" Light',{MSRP:1679.99}),extra={SKU:'CASE',Description:'Saw case',MSRP:50};
 const snapshot={items:[{type:'tool',sku:'STD16',quantity:2,inventoryId:'',setupSelected:false},{type:'accessory',sku:'CASE',quantity:1}],paymentMethod:'cash',fulfillment:'DANBURY',zip:'06810',financeDownPayments:{STIHL:100}};
 const unrelated={packageId:'HONDA:GENERATOR',sku:'GENERATOR',quantity:1};
 const plan=factory.transfer({snapshot,current,next,brand:'STIHL',cart:[unrelated],allowed:[{type:'accessory',row:extra}]});
 assert.equal(plan.draft.sku,'LIGHT25');assert.equal(plan.draft.items[0].quantity,2);assert.equal(plan.draft.fulfillment,'DANBURY');assert.equal(plan.draft.items[1].sku,'CASE');
 assert.ok(plan.cart.some(r=>r===unrelated));assert.equal(plan.cart.find(r=>r.type==='tool').itemPrice,1679.99);
 assert.throws(()=>factory.transfer({snapshot:{...snapshot,items:[{...snapshot.items[0],inventoryId:'SERIAL'}]},current,next,brand:'STIHL',cart:[],allowed:[]}),/Build to Order/);
});
test('builder change handler navigates to the chosen bar and carries the new draft instead of old card options',()=>{
 const source=fs.readFileSync('universal/product-options.js','utf8'),start=source.indexOf('const changeConfiguration=next=>{'),end=source.indexOf('   WEPFactoryOptions.mount(',start);
 assert.ok(start>0&&end>start);
 const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const next=row('LIGHT25','Chainsaw w/25" Light'),snapshot={items:[{type:'tool',sku:'STD16',quantity:2,inventoryId:''}],fulfillment:'DANBURY',paymentMethod:'cash'};
 let navigated='',left=false;
 const sandbox={next,product:current,selectedBrand:'stihl',products:[current,next],runtime:[],batteries:[],chargers:[],attachments:[],accessories:[],parts:[],factoryCategories:[],
  clean:v=>String(v??'').trim(),compatibleRows:()=>[],horsepowerImplements:()=>[],hasImplementHPLimits:()=>false,
  WEPBuildBuy:{context:()=>({batteries:[],chargers:[]}),usable:()=>true},WEPFactoryOptions:factory,
  window:{WEPBuildConfiguration:{snapshot:()=>snapshot,leave:()=>left=true}},buildStorage:storage,sessionStorage:storage,URL,
  location:{href:'https://dealer.test/product-options.html?brand=stihl&sku=STD16&quantity=1&cardOptions=%5B%5D&inventoryId=old&unit=old&configuration=build123&return=marketplace.html',replace:url=>navigated=url}};
 vm.runInNewContext(source.slice(start,end)+'changeConfiguration(next);',sandbox);
 const url=new URL(navigated);assert.equal(url.searchParams.get('sku'),'LIGHT25');assert.equal(url.searchParams.get('quantity'),'2');assert.equal(url.searchParams.get('configuration'),'build123');
 for(const name of ['cardOptions','inventoryId','unit'])assert.equal(url.searchParams.has(name),false);
 assert.equal(url.searchParams.get('return'),'marketplace.html');assert.equal(left,true);
 const draft=JSON.parse(saved.get('wepBuildDraft:STIHL:LIGHT25'));assert.equal(draft.items[0].sku,'LIGHT25');assert.equal(draft.fulfillment,'DANBURY');
});
