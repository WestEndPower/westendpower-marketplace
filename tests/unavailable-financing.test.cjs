const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../universal/build-finance.js'),'utf8');
const setCode=source.slice(source.indexOf(' function setPrograms('),source.indexOf(' let offersController'));
const runCode=source.slice(source.indexOf(' async function run('),source.indexOf(' function schedule('));
function setup({id='OLD',failure=false}={}){
 const selected={items:[{brandId:'TORO',type:'tool',sku:'72525',quantity:1}],dealerPrograms:{TORO:{key:'FleetTier1',verified:true,reference:''}},sku:'72525',brandId:'TORO',financeDownPayments:{TORO:0},fulfillment:'NEW_MILFORD',zip:''};
 const calls=[],renders=[],results=[],failures=[],message={children:[],replaceChildren(...nodes){this.children=nodes;},append(node){this.children.push(node);}},document={getElementById:()=>message,createTextNode:text=>({textContent:text}),createElement:()=>({})};
 const select={value:'finance:'+id,options:[],replaceChildren(...rows){this.options=rows;},append(row){this.options.push(row);}},Option=function(text,value){this.textContent=text;this.value=value;};
 const env={selected,select,id,calls,renders,results,failures,document,Option,failure,message};
 const code=`
 const {selected,select:paymentSelect,id:planId,calls,renders,results,failures,document,Option,failure,message}=env;
 let preferred=planId,paymentConfirmed=true,checkoutPending=true,checkoutRefreshPending=true,programs=[];
 const clean=v=>String(v??'').trim(),number=Number,programLabel=p=>p.ProgramID;
 let generation=1,controller,activeSignature,lastStarted,lastApplied,lastResponse,lastSnapshot,updateProblem='',offersBuildKey='';
 const panel={isConnected:true},pricingUpdate={},buildDeadline=Date.now()+90000,post=()=>{};
 const state=()=>({...structuredClone(selected),paymentMethod:!paymentConfirmed?'standard':paymentSelect.value.startsWith('finance:')?'finance':paymentSelect.value,programId:paymentSelect.value.startsWith('finance:')?paymentSelect.value.slice(8):''});
 const window={WEPToroCustomerOptions:{load:async()=>{}}};
 const eligiblePrograms=async()=>({programs:[{ProgramID:'NEW',APR:4.49,TermMonths:36}]});
 const packageQuote=async body=>{calls.push(body);if(failure)throw Error('Actual pricing failed');return {paymentMethod:body.paymentMethod,lines:[{unitPrice:1}],issues:[],financePlans:[],total:1};};
 const toroChoices=s=>({dealerPrograms:s.dealerPrograms}),downPayments=s=>s.financeDownPayments;
 const pricingIssues=q=>q.issues,render=(q,p,s)=>renders.push({q,p,s});
 const endUpdate=(_token,result)=>results.push(result),setTimeout=()=>1,clearTimeout=()=>{};
 const console={error:m=>failures.push(m)},pricingFailure=e=>e.message,showListedBuild=m=>failures.push(m),output={setAttribute(){}},savedFinance=()=>false,compareState=state,previewBuild=s=>s,restoreFinance=()=>{};
 const openComparison=(...args)=>calls.push({comparison:args});
 ${setCode}${runCode}
 return {run:()=>run(1),get:()=>({preferred,paymentConfirmed,checkoutPending,checkoutRefreshPending,state:state(),options:paymentSelect.options}),message};`;
 return {...new Function('env',code)(env),calls,renders,results,failures,selected};
}
test('an unavailable saved plan clears payment confirmation and still prices the selected Fleet build',async()=>{
 const f=setup(),before=structuredClone(f.selected);await f.run();assert.equal(f.failures.length,0);assert.deepEqual(f.results,['ready']);assert.equal(f.calls.length,1);assert.equal(f.calls[0].paymentMethod,'standard');assert.deepEqual(f.calls[0].financeProgramIds,{});assert.equal(f.calls[0].dealerPrograms.TORO.key,'FleetTier1');assert.equal(f.renders.length,1);assert.equal(f.renders[0].s.paymentMethod,'standard');
 const state=f.get();assert.equal(state.preferred,'');assert.equal(state.paymentConfirmed,false);assert.equal(state.checkoutPending,false);assert.equal(state.checkoutRefreshPending,false);assert.deepEqual(f.selected,before);assert(state.options.some(row=>row.value==='finance:NEW'));assert(state.options.some(row=>row.value==='cash'));assert(state.options.some(row=>row.value==='credit'));
 const choose=f.message.children.find(node=>node.textContent==='Choose compatible financing');assert(choose);choose.onclick();assert.deepEqual(f.calls.at(-1),{comparison:[true,'any']});
});
test('a compatible saved plan stays selected and is quoted with its validated id',async()=>{
 const f=setup({id:'NEW'});await f.run();assert.equal(f.failures.length,0);assert.equal(f.get().paymentConfirmed,true);assert.equal(f.calls[0].paymentMethod,'finance');assert.equal(f.calls[0].financeProgramIds.TORO,'NEW');assert.equal(f.renders[0].s.programId,'NEW');
});
test('real pricing failures still use the error state instead of pretending that recovery succeeded',async()=>{
 const f=setup({failure:true});await f.run();assert(f.failures.some(text=>text.includes('Actual pricing failed')));assert.deepEqual(f.results,['error']);assert.equal(f.renders.length,0);
});
