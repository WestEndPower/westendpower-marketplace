/* Group payment previews without changing prices or bypassing the quote request budget. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WEPQuoteTransport=api;
})(typeof window==='object'?window:this,function(){
 'use strict';
 function create({send,reserve,delay=25}){
  let supported=false;
  const jobs=new WeakMap(),queues=new WeakMap();
  const aborted=()=>new DOMException('Changed','AbortError');
  async function dispatch(body,signal){
   if(signal.aborted)throw aborted();
   await reserve(signal);if(signal.aborted)throw aborted();
   const value=await send(body,signal);
   if(value.quoteBatchVersion===1)supported=true;
   return value;
  }
  async function flush(signal,queue){
   queues.delete(signal);
   // Ship-to quotes continue through the single-quote flow.
   for(let start=0;start<queue.length;start+=5){
    const rows=queue.slice(start,start+5);
    try{
     if(signal.aborted)throw aborted();
     if(rows.length===1){rows[0].resolve(await dispatch(rows[0].body,signal));continue;}
     const result=await dispatch({quoteBatchVersion:1,requests:rows.map(row=>row.body)},signal);
     if(!Array.isArray(result.quotes)||result.quotes.length!==rows.length)throw Error('Payment previews could not be confirmed. Please retry pricing.');
     for(let index=0;index<rows.length;index++){
      const value=result.quotes[index];
      if(value?.ok===true&&value.quote?.ok===true)rows[index].resolve(value.quote);
      else{const error=Error(value?.error||'This payment option could not be confirmed.');error.httpStatus=value?.status||400;rows[index].reject(error);}
     }
    }catch(error){for(const row of rows)row.reject(error);}
   }
  }
  function quote(body,signal){
   if(signal.aborted)return Promise.reject(aborted());
   let byBody=jobs.get(signal);if(!byBody){byBody=new Map();jobs.set(signal,byBody);}
   const key=JSON.stringify(body);if(byBody.has(key))return byBody.get(key);
   const job=supported&&body.fulfillment!=='SHIP'?new Promise((resolve,reject)=>{
    let queue=queues.get(signal);if(!queue){queue=[];queues.set(signal,queue);setTimeout(()=>flush(signal,queue),delay);}
    queue.push({body,resolve,reject});
   }):dispatch(body,signal);
   byBody.set(key,job);return job;
  }
  return {quote};
 }
 return {create};
});
