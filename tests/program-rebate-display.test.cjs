const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../universal/build-finance.js'),'utf8');
const extract=(name,next)=>source.slice(source.indexOf(' function '+name+'('),source.indexOf(' function '+next+'('));

test('selected program waits for priced rebates instead of using standard catalog metadata',()=>{
 const hint=new Function('clean','offerMetadataActive',extract('rebateMetadataHint','resetProgramPaymentOffers')+'return rebateMetadataHint;')(v=>String(v||'').trim(),o=>o.active);
 const snapshot={items:[{type:'tool',sku:'72525'}]},offers=[{type:'tool',sku:'72525',amount:1250,active:true}];
 assert.equal(hint(snapshot,offers,'2026-11-03'),true);
 for(const key of ['FleetTier1','FirstResponders','NALP'])assert.equal(hint({...snapshot,dealerPrograms:{TORO:{key}}},offers,'2026-11-03'),false);
 assert.equal(hint({...snapshot,dealerPrograms:{}},offers,'2026-11-03'),true);
 assert.equal(hint(snapshot,[{...offers[0],active:false}],'2026-11-03'),false);
 const included=new Function('validMoney',extract('includedRebate','paymentSavings')+'return includedRebate;')(Number.isFinite);
 assert.equal(included({merchandise:10000},{merchandise:10000,lines:[{discount:0}]}),0);
 assert.equal(included({merchandise:10000},{merchandise:9000,lines:[{discount:0}]}),1000);
 assert.equal(included({merchandise:10000},{merchandise:9800,lines:[{discount:200}]}),0);
});

test('no rebate uses one generic financing card; standard rebates restore both headings',()=>{
 const card=()=>({hidden:false,heading:{textContent:'old'},choice:{label:'',getAttribute(){return this.label},setAttribute(_k,v){this.label=v}},querySelector(s){return s==='h4'?this.heading:this.choice;}});
 const cards={finance:card(),'finance-inlieu':card()},panel={querySelector(s){return cards[s.includes('finance-inlieu')?'finance-inlieu':'finance'];}};
 const set=new Function('panel','highlightPayment','let financeLayout;'+extract('setFinanceLayout','savedFinance')+'return setFinanceLayout;')(panel,()=>{});
 set({}, {primary:'any',dual:false,hasRebate:false});
 assert.equal(cards.finance.heading.textContent,'Financing');assert.equal(cards.finance.choice.label,'Select Financing');assert.equal(cards['finance-inlieu'].hidden,true);
 set({}, {primary:'compatible',dual:true,hasRebate:true});
 assert.equal(cards.finance.heading.textContent,'Financing + Rebates');assert.equal(cards['finance-inlieu'].heading.textContent,'Financing in Lieu of Rebates');assert.equal(cards['finance-inlieu'].hidden,false);
});

test('program change cancels old offers and clears rebate footers before syncing copied cards',()=>{
 const calls=[],panel={querySelectorAll(selector){assert.equal(selector,'.wep-payment-rebate-footer,.wep-finance-expiry-footer');return [{remove(){calls.push('remove rebate');}},{remove(){calls.push('remove expiry');}}];}};
 const reset=new Function('stopOffers','panel','setFinanceLayout','inLieuOutput','syncPaymentCards',extract('resetProgramPaymentOffers','includedRebate')+'return resetProgramPaymentOffers;')(()=>calls.push('cancel'),panel,(_s,l)=>{assert.deepEqual(l,{primary:'any',dual:false,hasRebate:false});calls.push('layout');},{replaceChildren(){calls.push('clear secondary');}},()=>calls.push('sync'));
 reset();assert.deepEqual(calls,['cancel','remove rebate','remove expiry','layout','clear secondary','sync']);
 assert.match(source,/wep:toro-choice',event=>\{if\(event.detail\?\.kind==='program'\)\{[^}]*resetProgramPaymentOffers\(\)/);
});
