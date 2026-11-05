const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('universal/webpage-builder-save.js','utf8');
const saved=(action='preview',version=1)=>({ok:true,slug:'toro-zero-turns',version,changeId:'revision-'+version,editorUrl:'/webpage-builder?slug=toro-zero-turns',nextUrl:action==='preview'?'/webpage-builder/preview?slug=toro-zero-turns':'/webpage-builder?slug=toro-zero-turns&saved='+action});
function harness(reply,{marker='1',version='0',changeId=''}={}){
 const listeners={},windowListeners={},requests=[],navigations=[],historyCalls=[],attributes=new Map(),classes=new Set();let reloads=0;
 const status={hidden:true,textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}},reopen={hidden:true,href:''};
 const fields={slug:{name:'slug',value:'toro-zero-turns',type:'text',disabled:false},version:{name:'version',value:version,type:'hidden'},changeId:{name:'changeId',value:changeId,type:'hidden'},title:{name:'title',value:'My entered Toro title',type:'text',disabled:false}};
 const elements=Object.assign(Object.values(fields),fields),form={dataset:{builderAsyncSave:marker},elements,querySelector:s=>s==='[data-builder-save-status]'?status:reopen,getAttribute:()=>'/webpage-builder',setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k),addEventListener:(k,fn)=>listeners[k]=fn};
 class FormData {constructor(form){this.values=[...form.elements].filter(e=>!e.disabled&&e.name).map(e=>[e.name,e.value]);}[Symbol.iterator](){return this.values[Symbol.iterator]();}}
 const location={origin:'https://dealer.test',assign:u=>navigations.push(u),reload:()=>reloads++};
 const sandbox={document:{getElementById:()=>form},window:{addEventListener:(k,fn)=>windowListeners[k]=fn},location,history:{replaceState:(_a,_b,u)=>historyCalls.push(u)},URL,URLSearchParams,FormData,fetch:async(url,options)=>{requests.push({url,body:new URLSearchParams(options.body),options});return reply(url,options);}};
 vm.runInNewContext(source,sandbox);
 return {form,fields,status,reopen,requests,navigations,historyCalls,attributes,classes,windowListeners,get reloads(){return reloads;},submit:action=>listeners.submit?.({submitter:{value:action},preventDefault(){}}),listeners};
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('preview confirms the saved revision and fixes Back navigation to reopen that saved editor',async()=>{
 const h=harness(()=>json(saved()));await h.submit('preview');
 assert.equal(h.requests[0].body.get('action'),'preview');assert.equal(h.requests[0].body.get('version'),'0');assert.equal(h.requests[0].options.headers.Accept,'application/json');
 assert.equal(h.fields.version.value,'1');assert.equal(h.fields.changeId.value,'revision-1');assert.equal(h.fields.slug.readOnly,true);
 assert.deepEqual(h.historyCalls,['https://dealer.test/webpage-builder?slug=toro-zero-turns']);assert.deepEqual(h.navigations,['https://dealer.test/webpage-builder/preview?slug=toro-zero-turns']);
 h.windowListeners.pageshow({persisted:true});assert.equal(h.reloads,1);
 const returned=harness(()=>json(saved('publish',2)),{version:h.fields.version.value,changeId:h.fields.changeId.value});await returned.submit('publish');
 assert.equal(returned.requests[0].body.get('version'),'1');assert.equal(returned.requests[0].body.get('changeId'),'revision-1');assert.equal(returned.fields.version.value,'2');assert.match(returned.navigations[0],/saved=publish/);
});
test('a real conflict preserves typed fields and shows the latest-draft link without retrying',async()=>{
 const h=harness(()=>json({ok:false,error:'This page has a newer saved version.',editorUrl:'/webpage-builder?slug=toro-zero-turns'},409));await h.submit('publish');
 assert.equal(h.fields.title.value,'My entered Toro title');assert.equal(h.fields.version.value,'0');assert.equal(h.requests.length,1);assert.equal(h.navigations.length,0);
 assert.equal(h.status.hidden,false);assert.match(h.status.textContent,/newer saved version/);assert.equal(h.reopen.hidden,false);assert.equal(h.reopen.href,'https://dealer.test/webpage-builder?slug=toro-zero-turns');assert.equal(h.fields.title.disabled,false);assert.equal(h.attributes.has('aria-busy'),false);
});
test('double submissions cause one request and validation failures leave the editor usable',async()=>{
 let complete;const pending=new Promise(resolve=>complete=resolve),h=harness(()=>pending);
 const first=h.submit('publish');await h.submit('publish');assert.equal(h.requests.length,1);assert.equal(h.fields.title.disabled,true);
 complete(json({ok:false,error:'No equipment matches these rules.'},400));await first;
 assert.match(h.status.textContent,/No equipment/);assert.equal(h.fields.title.disabled,false);assert.equal(h.navigations.length,0);
});
test('network errors keep the entered page and never automatically retry a possibly completed save',async()=>{
 const h=harness(()=>{throw Error('Connection interrupted');});await h.submit('save');
 assert.equal(h.requests.length,1);assert.equal(h.fields.title.value,'My entered Toro title');assert.equal(h.fields.title.disabled,false);assert.equal(h.navigations.length,0);assert.match(h.status.textContent,/save could not be confirmed/);
});
test('untrusted or mismatched response destinations cannot redirect or change the local revision',async()=>{
 for(const result of [{...saved(),nextUrl:'https://untrusted.example/'},{...saved(),nextUrl:'/webpage-builder?slug=another-page'}]){
  const h=harness(()=>json(result));await h.submit('preview');assert.equal(h.navigations.length,0);assert.equal(h.historyCalls.length,0);assert.equal(h.fields.version.value,'0');assert.match(h.status.textContent,/could not be confirmed/);
 }
});
test('older builder templates keep their native save flow until the matching server update is deployed',()=>{
 const old=harness(()=>json(saved()),{marker:''});assert.equal(old.listeners.submit,undefined);assert.equal(old.requests.length,0);
});
