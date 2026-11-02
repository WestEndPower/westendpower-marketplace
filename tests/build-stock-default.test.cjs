'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('universal/build-finance.js','utf8');
const body=source.slice(source.indexOf(' function initialStockChoice('),source.indexOf(' function refreshStockControls('));
const choose=(search='',window={})=>new Function('query','window','clean',body+';return initialStockChoice;')(new URLSearchParams(search),window,v=>String(v??'').trim());
const tool={type:'tool',sku:'77501',quantity:1},stock=[{selectionId:'STOCK-A',unitRef:'PUBLIC-A'},{selectionId:'STOCK-B',unitRef:'PUBLIC-B'}];
test('fresh in-stock equipment selects stock even when the link or saved card used empty orderable inventory',()=>{for(const search of ['', 'inventoryId=']){assert.equal(choose(search)(tool,stock), 'STOCK-A');assert.equal(choose(search)(tool,stock,{inventoryId:'',quoteStockChoice:'orderable'}),'STOCK-A');}});
test('exact inventory and public unit links retain their chosen stock unit and unavailable units remain blocked',()=>{assert.equal(choose('inventoryId=STOCK-B')(tool,stock),'STOCK-B');assert.equal(choose('unit=PUBLIC-B')(tool,stock),'STOCK-B');assert.equal(choose('unit=SOLD')(tool,stock),'__unavailable__');assert.equal(choose()(tool,stock,{inventoryId:'STOCK-B'}),'STOCK-B');});
test('no eligible stock defaults to orderable while dealer edits and resumed builds retain deliberate orderable choices',()=>{assert.equal(choose()(tool,[]),'');for(const window of [{WEPDealerOrderEdit:{}},{WEPBuildSession:{}}])assert.equal(choose('',window)(tool,stock,{quoteStockChoice:'orderable'}),'');assert.equal(choose('stockChoice=orderable')(tool,stock),'');assert.equal(choose()({type:'attachment'},stock,{quoteStockChoice:'orderable'}),'');});
