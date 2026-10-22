const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../universal/quote-transport.js');
const body=(paymentMethod='standard',extra={})=>({items:[{brandId:'YANMAR',sku:'SA325BI-LB',quantity:1}],paymentMethod,fulfillment:'DELIVERY',zip:'06776',financeDownPayments:{YANMAR:500},...extra});
function harness(version=1){
 const sent=[],reserved=[];
 const transport=create({delay:0,reserve:async signal=>{assert.equal(signal.aborted,false);reserved.push(1);},send:async (data,signal)=>{
  sent.push(data);assert.equal(signal.aborted,false);
  const quote=request=>({ok:true,quoteBatchVersion:version,paymentMethod:request.paymentMethod,total:123,financeDownPayments:request.financeDownPayments});
  return data.requests?{ok:true,quoteBatchVersion:1,quotes:data.requests.map(request=>({ok:true,quote:quote(request)}))}:quote(data);
 }});
 return {transport,sent,reserved};
}
test('initial quote discovers support; four payment previews use one budget slot',async()=>{
 const h=harness(),signal=new AbortController().signal;await h.transport.quote(body(),signal);
 const options=[body('cash'),body('credit'),body('finance',{financeProgramIds:{YANMAR:'A'}}),body('finance',{financeProgramIds:{YANMAR:'B'}})];
 const results=await Promise.all(options.map(b=>h.transport.quote(b,signal)));
 assert.equal(h.sent.length,2);assert.equal(h.reserved.length,2);assert.deepEqual(h.sent[1].requests,options);assert.equal(results[3].paymentMethod,'finance');assert.deepEqual(results[3].financeDownPayments,{YANMAR:500});
});
test('duplicate in-flight and completed requests share a job',async()=>{
 const h=harness(),signal=new AbortController().signal;
 const first=h.transport.quote(body(),signal),second=h.transport.quote(body(),signal);assert.equal(first,second);await first;await h.transport.quote(body(),signal);assert.equal(h.sent.length,1);
});
test('older service uses individual quotes without sending a batch',async()=>{
 const h=harness(0),signal=new AbortController().signal;await h.transport.quote(body(),signal);await Promise.all(['cash','credit'].map(method=>h.transport.quote(body(method),signal)));
 assert.equal(h.sent.length,3);assert(h.sent.every(b=>!b.requests));
});
test('aborted pending delivery previews do not consume a quote slot',async()=>{
 const h=harness();await h.transport.quote(body(),new AbortController().signal);
 const ac=new AbortController(),pending=['cash','credit'].map(method=>h.transport.quote(body(method),ac.signal));ac.abort();
 const results=await Promise.allSettled(pending);assert(results.every(r=>r.status==='rejected'&&r.reason.name==='AbortError'));assert.equal(h.sent.length,1);assert.equal(h.reserved.length,1);
});
test('an aborted old build does not cancel a new build',async()=>{
 const h=harness();await h.transport.quote(body(),new AbortController().signal);
 const old=new AbortController(),next=new AbortController();
 const stale=h.transport.quote(body('cash'),old.signal);old.abort();
 const [a,b]=await Promise.allSettled([stale,h.transport.quote(body('cash',{zip:'06810'}),next.signal)]);
 assert.equal(a.status,'rejected');assert.equal(b.status,'fulfilled');assert.equal(h.sent[1].zip,'06810');
});
test('one ineligible program does not discard another returned quote',async()=>{
 let requests=0;const transport=create({delay:0,reserve:async()=>{},send:async data=>{
  requests++;return data.requests?{ok:true,quoteBatchVersion:1,quotes:[{ok:false,status:400,error:'Not eligible'},{ok:true,quote:{ok:true,total:42}}]}:{ok:true,quoteBatchVersion:1};
 }}),signal=new AbortController().signal;await transport.quote(body(),signal);
 const [a,b]=await Promise.allSettled([transport.quote(body('finance'),signal),transport.quote(body('cash'),signal)]);
 assert.equal(a.reason.httpStatus,400);assert.equal(b.value.total,42);assert.equal(requests,2);
});
test('shipping remains a single request and an expired build cannot start a request',async()=>{
 const h=harness();await h.transport.quote(body(),new AbortController().signal);const signal=new AbortController().signal;
 await Promise.all(['cash','credit'].map(method=>h.transport.quote(body(method,{fulfillment:'SHIP'}),signal)));
 assert(h.sent.every(b=>!b.requests));const ac=new AbortController();ac.abort();await assert.rejects(h.transport.quote(body(),ac.signal),{name:'AbortError'});assert.equal(h.sent.length,3);
});
