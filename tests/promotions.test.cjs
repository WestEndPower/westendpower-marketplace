'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=require('../universal/promotions.js'),{parse,isPrivate}=require('../scripts/marketplace-sync.cjs');
const base={SKU:'72530',Active:'T',BrandID:'TORO',MSRP:'18000',SalePrice:'16999',FinancingEligible:'T',FleetEligible:'T'};
const program={Active:'T',Public:'T',Display:'T',BrandID:'TORO',APR:'0',TermMonths:'60',StartDate:'2026-11-01',EndDate:'2027-01-31',Group_ALL_TORO:'T'};
test('switching promotion type leaves stale category, manufacturer and search filters on every shopping route',()=>{
 const vm=require('node:vm');
 for(const file of ['universal/marketplace.js','shop-by-product.html','shop-by-brand.html']){
  const source=fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),start=source.indexOf('  function renderPromotionControls(){'),end=source.indexOf('  function marketplaceRowMatches(',start);
  let change;const location={href:'https://westendpower.github.io/westendpower-marketplace/marketplace.html?category=Blowers&brand=STIHL&q=BGA&promo=current'};
  const host={append(){}};
  vm.runInNewContext(source.slice(start,end)+';renderPromotionControls();',{location,URL,URLSearchParams,state:{promoOnly:true,promoView:'current'},DATA:{},$:()=>host,document:{createElement:()=>({})},window:{WestEndPromotions:{renderControls:(_host,_view,onChange)=>{change=onChange;}}}});
  change('coming');assert.equal(location.href,'https://westendpower.github.io/westendpower-marketplace/promotions.html?promo=coming',file);
 }
});
test('rebates roll from coming to current at Eastern midnight and expire after their inclusive end date',()=>{
 const row={...base,RebateToCustomer:'1000',RebateStartDate:'2026-11-01',RebateEndDate:'2027-01-31'};
 assert.equal(p.matches(row,'coming',[],'2026-10-31'),true);assert.equal(p.matches(row,'current',[],'2026-10-31'),false);
 assert.equal(p.matches(row,'current',[],'2026-11-01'),true);assert.equal(p.matches(row,'coming',[],'2026-11-01'),false);
 assert.equal(p.matches(row,'current',[],'2027-01-31'),true);assert.equal(p.matches(row,'current',[],'2027-02-01'),false);
 assert.equal(p.today(new Date('2026-11-01T03:59:59Z')),'2026-10-31');assert.equal(p.today(new Date('2026-11-01T04:00:00Z')),'2026-11-01');
});
test('expiring soon includes only active offers ending in the current calendar month',()=>{
 const row={...base,RebateToCustomer:'100',RebateStartDate:'2026-10-01',RebateEndDate:'2026-10-31'};
 assert.equal(p.matches(row,'expiring',[],'2026-10-01'),true);assert.equal(p.matches(row,'expiring',[],'2026-10-31'),true);assert.equal(p.matches(row,'expiring',[],'2026-11-01'),false);
 assert.equal(p.matches({...row,RebateStartDate:'2026-10-29'},'expiring',[],'2026-10-28'),false);
 assert.equal(p.matches({...row,RebateEndDate:'2026-11-02'},'expiring',[],'2026-10-31'),false);
});
test('MAP fallback, dealer-only rebates, zero and invalid dates never invent promotions',()=>{
 assert.equal(p.matches(base,'current',[],'2026-10-31'),false);
 for(const RebateToCustomer of ['', '0', '#VALUE!'])assert.equal(p.matches({...base,RebateToCustomer,RebateToDealer:'100'},'current',[],'2026-10-31'),false);
 for(const date of ['#VALUE!','00-Jan-00','2026-02-30'])assert.equal(p.matches({...base,RebateToCustomer:'100',RebateStartDate:date},'current',[],'2026-10-31'),false);
 assert.equal(p.matches({...base,SaleStartDate:'2026-11-01',SaleEndDate:'2026-10-31'},'current',[],'2026-10-31'),false);
 assert.equal(p.matches({...base,SaleStartDate:'2026-10-01',SaleEndDate:'2026-10-31'},'current',[],'2026-10-31'),true);
});
test('0% finance requires public active matching programs; SKU exclusion wins and nonzero or missing APR is excluded',()=>{
 assert.equal(p.financeMatches(base,program),true);
 for(const changes of [{APR:'0.0599'},{APR:''},{Active:'F'},{Public:'F'},{Display:'F'},{BrandID:'STIHL'},{72530:'F'}])assert.equal(p.financeMatches(base,{...program,...changes}),false);
 assert.equal(p.financeMatches({...base,FinancingEligible:'F'},program),false);
 assert.equal(p.financeMatches(base,{...program,Group_ALL_TORO:'F',72530:'T'}),true);
});
test('financing alone cannot qualify categories or SKUs for any dated promotion view',()=>{
 for(const [view,day] of [['coming','2026-10-31'],['current','2026-11-01'],['expiring','2027-01-01']])assert.equal(p.matches(base,view,[program],day),false);
 const row={...base,RebateToCustomer:'1000',RebateStartDate:'2026-10-01',RebateEndDate:'2026-10-31'};
 assert.equal(p.matches(row,'current',[program],'2026-10-31'),true);
 assert.equal(p.matches(row,'expiring',[program],'2026-10-31'),true);
 assert.equal(p.matches(row,'coming',[program],'2026-10-31'),false);
 assert.equal(p.matches(row,'current',[program],'2026-11-01'),false);
 assert.ok(p.offers(base,[program],'2026-11-01').some(o=>o.type==='finance'),'financing data remains available independently');
 const future={...base,SaleStartDate:'2026-11-01',SaleEndDate:'2026-11-30'};
 assert.equal(p.matches(future,'coming',[program],'2026-10-31'),true);
 assert.ok(p.offerLabels(future,'coming',[program],'2026-10-31').every(label=>!label.includes('financing')));
});
test('0.00% Offers is separate from sales and rebates and includes only active eligible financing',()=>{
 assert.equal(p.matches(base,'zero',[program],'2026-10-31'),false);
 assert.equal(p.matches(base,'zero',[program],'2026-11-01'),true);
 assert.equal(p.matches(base,'zero',[program],'2027-02-01'),false);
 for(const change of [{APR:'0.0599'},{APR:''},{Public:'F'},{Active:'F'},{Display:'F'},{72530:'F'},{BrandID:'STIHL'}])assert.equal(p.matches(base,'zero',[{...program,...change}],'2026-11-01'),false);
 assert.equal(p.matches({...base,FinancingEligible:'F'},'zero',[program],'2026-11-01'),false);
 assert.equal(p.matches({...base,RebateToCustomer:'1000'},'zero',[],'2026-11-01'),false);
 assert.deepEqual(Object.values(p.views),['Current','Expiring Soon','Coming Soon','0.00% Offers','1st Responder','Fleet Programs']);
});
test('special programs require customer discount and equipment eligibility, without NALP or dealer rebate qualification',()=>{
 assert.equal(p.matches({...base,FirstRespondersDiscount:'100'},'responders'),true);
 assert.equal(p.matches({...base,FirstRespondersRebate:'100'},'responders'),false);
 assert.equal(p.matches({...base,FleetTier1Rebate:'100'},'fleet'),false);
 assert.equal(p.matches({...base,FleetTier2Discount:'100'},'fleet'),true);
 assert.equal(p.matches({...base,FleetEligible:'F',FleetTier2Discount:'100'},'fleet'),false);
 assert.equal(p.matches({...base,Active:'F',FirstRespondersDiscount:'100'},'responders'),false);
 assert.equal(Object.keys(p.views).length,6);assert.ok(!('nalp' in p.views));
});
test('published Toro data carries November rebates and compatible 0% finance without spreadsheet errors',()=>{
 const root=path.resolve(__dirname,'..'),read=name=>parse(fs.readFileSync(path.join(root,'brands/toro/data/'+name+'.csv'),'utf8'));
 const products=read('products'),finance=read('finance-programs'),row=products.rows.find(r=>r.SKU==='72530');
 for(const table of [products,finance]){assert.ok(table.headers.every(h=>!isPrivate(h)));assert.ok(table.rows.every(r=>Object.values(r).every(v=>!/^#(?:VALUE!|REF!|N\/A)/.test(v))));}
 assert.equal(row.RebateToCustomer,'1000');assert.equal(row.RebateStartDate,'2026-11-01');assert.equal(p.matches(row,'coming',finance.rows,'2026-10-31'),true);
 assert.equal(p.matches(row,'coming',finance.rows,'2026-11-01'),false);assert.equal(p.matches(row,'current',finance.rows,'2026-11-01'),true);
 const bundle=JSON.parse(fs.readFileSync(path.join(root,'data/marketplace-catalog.json'),'utf8'));assert.equal(bundle.financeSources.length,8);assert.equal(bundle.financeSources.find(s=>s.brand==='TORO').rows.length,finance.rows.length);
});
