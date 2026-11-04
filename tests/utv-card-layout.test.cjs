const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Kit=require('../universal/package-components.js');
function render({power='Battery',category="UTV's",stock=false,subCategory='',accessory=false}={}){
 const window={WEPKitComponents:Kit,crypto:require('node:crypto').webcrypto},document={querySelector:()=>({})};
 const sandbox={window,document,URL,URLSearchParams,Intl,CustomEvent:class{},localStorage:{getItem:()=>null}};
 for(const file of ['package-pricing.js','equipment-package-pricing.js','marketplace-card.js'])vm.runInNewContext(fs.readFileSync('universal/'+file,'utf8'),sandbox);
 const row={SKU:'UTV1',BrandID:'GREENWORKS',Model:'CU400W',Description:'Greenworks utility vehicle',MSRP:18000,Active:'T',Category:category,SubCategory:subCategory};
 const variant={sku:row.SKU,type:'Tool',description:row.Description,price:18000,msrp:18000,marketplaceRow:row};
 const f={key:'UTV1',brand:'GREENWORKS',model:'CU400W',category,power,variants:[variant]};
 const c={DATA:{componentSources:{GREENWORKS:{products:[row],attachments:[],accessories:accessory?[{SKU:'COVER',Description:'Vehicle cover',Active:'T',MSRP:100,UTV1:'T'}]:[],parts:[],packages:[],batteries:[],chargers:[]}}},selectedPriceVariant:()=>variant,selectedStock:()=>stock?{selectionId:'UNIT1'}:null,priceChoices:()=>[],pricePanel:()=>'',stockHeaderMarkup:()=>stock?'<button>View In-Stock (1)</button>':'',sawHeaderBars:()=>'',cardFinanceMarkup:()=>'',paymentSelectionUrl:()=> 'https://dealer.example/payment-options.html?brand=GREENWORKS&sku=UTV1',promoInfo:()=>null,money:n=>'$'+n,state:{compare:new Set()},currentPrice:Kit.current,inventoryMarkup:()=>'',selectPackageVariant:()=>{},refreshSelectedCard:()=>{},selectedPriceQuantity:()=>1};
 return window.WestEndMarketplaceCard.render(f,c);
}
test('UTV tags consistently show attachments/accessories for blank, battery, gas and diesel power',()=>{
 for(const power of ['', 'Battery','Gas','Diesel'])for(const stock of [false,true]){
  const html=render({power,stock});assert.match(html,/>Attach:</);assert.match(html,/>Access:</);assert.doesNotMatch(html,/>Batteries<|>Chargers<|Batteries and chargers sold separately|Run Times/);
 }
});
test('vehicle categories and subcategories work without hard-coded models or manufacturer SKUs',()=>{
 for(const category of ["UTV's",'UTV','UTVs','Utility Vehicle','Utility Vehicles'])assert.match(render({category}),/>Attach:</);
 assert.match(render({category:'Equipment',subCategory:'Utility Vehicle'}),/>Access:</);
});
test('UTV accessory links retain compatibility and direct builder destinations',()=>{
 const html=render({accessory:true});assert.match(html,/View Accessories \(1 Available\)/);assert.match(html,/group=accessory/);assert.match(html,/#wep-panel-accessory/);
});
test('handheld battery fallback retains battery/charger labels, contents and runtime action',()=>{
 const html=render({category:'Blowers'});assert.match(html,/>Batteries</);assert.match(html,/>Chargers</);assert.match(html,/Batteries and chargers sold separately/);assert.match(html,/Run Times/);
});
