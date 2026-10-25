import test from 'node:test';
import assert from 'node:assert/strict';
import '../universal/payment-pricing.js';
const payments=globalThis.WestEndPayments;
test('API APR percentage points are not converted a second time in quotes or monthly payments',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/inventory-availability')?{availability:[]}:{ok:true,customerLinePrice:10000,customerRebate:0,customerFreightQuote:{confirmed:true,amount:0,source:'inventory'}}});
 try{
  const q=await payments.quote('HONDA','TEST',{Taxable:'F'},'finance',{APR:0.99,TermMonths:36,EndDate:'2026-10-31'},'',1);
  assert.equal(q.apr,0.99);assert.equal(q.aprLabel,'0.99%');
  const rate=0.99/1200,expected=10000*rate/(1-Math.pow(1+rate,-36));
  assert.ok(Math.abs(q.monthly-expected)<0.000001);assert.ok(q.monthly<300);assert.equal(q.expirationLabel,'Expires Oct. 31, 2026');
 }finally{globalThis.fetch=original;}
});
test('program ordering keeps the lowest APR and longest term at that rate',()=>{
 const chosen=payments.bestMarketplaceFinanceProgram([{APR:1.99,TermMonths:84},{APR:0.99,TermMonths:24},{APR:0.99,TermMonths:36}]);
 assert.equal(chosen.APR,0.99);assert.equal(chosen.TermMonths,36);
 assert.equal(payments.programExpirationLabel({EndDate:''}),'');assert.equal(payments.programExpirationLabel({EndDate:'invalid'}),'');
});
