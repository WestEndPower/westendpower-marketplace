const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(length,referrer='https://westendpower.github.io/westendpower-marketplace/marketplace.html?category=Power+Brooms&promo=fleet'){
 const source=fs.readFileSync('universal/equipment-return.js','utf8'),start=source.indexOf(" oldLink.addEventListener('click'"),end=source.indexOf(" const app=",start),actions=[];let handler,timer;
 vm.runInNewContext(source.slice(start,end),{oldLink:{addEventListener:(_name,fn)=>handler=fn},validDeparture:()=>false,referrer,cleanUrl:v=>v,fallback:referrer,write:()=>{},restoreKey:'restore',history:{length,back:()=>actions.push('back')},window:{close:()=>actions.push('close')},setTimeout:fn=>{timer=fn;},location:{href:'https://westendpower.github.io/westendpower-marketplace/product-options.html',assign:url=>actions.push(url)}});
 return {actions,click:extra=>handler({button:0,preventDefault:()=>actions.push('prevented'),...extra}),fallback:()=>timer?.(),referrer};
}
test('Return to Equipment closes a newly opened builder tab to reveal the original filtered results',()=>{
 const f=fixture(1);f.click();assert.deepEqual(f.actions,['prevented','close']);
 // If a browser refuses to close the tab, normal navigation remains available.
 f.fallback();assert.equal(f.actions[2],f.referrer);
});
test('same-tab builds return through browser history and modified clicks retain normal link behavior',()=>{
 const f=fixture(2);f.click();assert.deepEqual(f.actions,['prevented','back']);
 const modified=fixture(1);modified.click({ctrlKey:true});assert.deepEqual(modified.actions,[]);
});
