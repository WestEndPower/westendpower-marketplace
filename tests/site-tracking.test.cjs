const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../universal/site-tracking.js','utf8');
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]||null,get length(){return values.size;}};};
function browser({url='https://westendpower.github.io/westendpower-marketplace/product-options.html',localStorage=storage(),preview=false,fail=false,labels=[]}={}){
 const calls=[],tags=[],handlers={},timers=[];
 const document={currentScript:{src:'https://westendpower.github.io/westendpower-marketplace/universal/site-tracking.js'},referrer:'https://www.westendpower.com/private?email=SECRET',readyState:'loading',visibilityState:'visible',head:{append:el=>tags.push(el)},body:{},createElement:()=>({}),getElementById:id=>preview&&id==='wep-catalog-data'?{textContent:'{"preview":true}'}:null,querySelectorAll:()=>labels,addEventListener:(key,fn)=>handlers[key]=fn};
 const window={addEventListener:(key,fn)=>handlers[key]=fn};let count=0;const receipts=new Set();
 const context={window,document,location:new URL(url),navigator:{webdriver:false},localStorage,sessionStorage:storage(),URL,URLSearchParams,Intl,Date,Map,Set,JSON,Number,String,Object,Array,Uint8Array,crypto:webcrypto,MutationObserver:class{observe(){}},setInterval:()=>0,clearTimeout:()=>{},setTimeout:fn=>{timers.push(fn);return timers.length;},fetch:async(url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).endsWith('dealer-settings.csv'))return {ok:true,text:async()=> 'DealerName,GA4MeasurementID\n"West End Power, Inc",G-B7KTECFBFB\n'};
  const body=JSON.parse(options.body);
  if(fail)return {ok:false};
  if(String(url).endsWith('/product-view-counts'))return {ok:true,json:async()=>({ok:true,items:body.items.map(i=>({...i,views:count}))})};
  const key=body.day+body.brandId+body.sku+body.key,was=receipts.has(key);receipts.add(key);if(!was)count++;return {ok:true,json:async()=>({ok:true,counted:!was})};
 }};
 vm.runInNewContext(source,context);
 return {api:window.WEPSiteTracking,calls,tags,window,document,handlers,timers,async start(){handlers.DOMContentLoaded();await new Promise(resolve=>setImmediate(resolve));},async timersRun(){for(const fn of timers.splice(0))await fn();}};
}
test('local files, localhost, preview, demo and local API tests make no tracking requests',async()=>{
 for(const options of [{url:'http://localhost:8000/product.html'},{url:'http://127.0.0.1:5500/product.html'},{url:'file:///tmp/product.html'},{url:'https://preview.test/product.html'},{preview:true},{url:'https://westendpower.github.io/westendpower-marketplace/product-options.html?api=local'},{url:'https://westendpower.github.io/westendpower-marketplace/product-options.html?wepDemo=yanmar'},{url:'https://westendpower-configurator-api.westendpower-nm.workers.dev/q/SECRET'}]){
  const b=browser(options);await b.start();b.api.configure({GA4MeasurementID:'G-B7KTECFBFB'});await b.api.productOpened('TORO','88920');b.api.event('quote_requested',{email:'SECRET'});assert.equal(b.calls.length,0);assert.equal(b.tags.length,0);
 }
});
test('one tag and page view; URL queries, private referrers, search text and customer fields never enter events',async()=>{
 const b=browser({url:'https://westendpower.github.io/westendpower-marketplace/product-options.html?email=SECRET&quote=PRIVATE&entry=dealerspike'});await b.start();b.api.configure({GA4MeasurementID:'G-B7KTECFBFB'});
 b.api.event('quote_requested',{brand_id:'TORO',email:'SECRET',phone:'PRIVATE',quote:'PRIVATE',page_location:'SECRET',search_term:'SECRET'});
 b.api.event('unknown_event',{sku:'SECRET'});
 const commands=b.window.dataLayer.map(args=>Array.from(args));assert.equal(b.tags.length,1);assert.equal(commands.filter(c=>c[0]==='event'&&c[1]==='page_view').length,1);assert.equal(commands.filter(c=>c[0]==='event'&&c[1]==='dealer_spike_entry').length,1);assert.equal(/SECRET|PRIVATE/.test(JSON.stringify(commands)),false);assert.equal(commands.at(-1)[2].brand_id,'TORO');
});
test('details and builder use the same durable daily token after reload; no customer data is posted',async()=>{
 const store=storage(),b=browser({localStorage:store});await b.start();await b.api.productOpened('TORO','88920','details');await b.api.productOpened('TORO','88920','builder');
 const writes=b.calls.filter(c=>c.url.endsWith('/product-view'));assert.equal(writes.length,1);const first=JSON.parse(writes[0].options.body);assert.deepEqual(Object.keys(first).sort(),['brandId','day','key','sku']);assert.match(first.key,/^[a-f0-9]{32}$/);
 const next=browser({localStorage:store});await next.start();await next.api.productOpened('TORO','88920');assert.equal(JSON.parse(next.calls.find(c=>c.url.endsWith('/product-view')).options.body).key,first.key);
});
test('storage failure skips counting instead of assigning a fresh visitor on every refresh',async()=>{
 const b=browser({localStorage:{getItem(){throw Error('blocked');}}});await b.start();await b.api.productOpened('TORO','88920');assert.equal(b.calls.some(c=>c.url.endsWith('/product-view')),false);
});
test('single views show honestly; zero or unavailable totals stay hidden',async()=>{
 const label={dataset:{wepViewBrand:'TORO',wepViewSku:'88920'},textContent:'',hidden:true};const b=browser({labels:[label]});await b.start();await b.timersRun();assert.equal(label.hidden,true);await b.api.productOpened('TORO','88920');await b.timersRun();assert.equal(label.textContent,'1 view in the last 7 days');assert.equal(label.hidden,false);
 const unavailable={dataset:label.dataset,textContent:'',hidden:true};const down=browser({fail:true,labels:[unavailable]});await down.start();await down.timersRun();assert.equal(unavailable.hidden,true);assert.equal(unavailable.textContent,'');
});
test('all shopping entry pages load exactly one shared tag and no standalone GA loader remains',()=>{
 for(const name of ['marketplace','shop-by-product','shop-by-brand','promotions','product','product-options','cart','checkout','checkout-success']){const html=fs.readFileSync(__dirname+'/../'+name+'.html','utf8');assert.equal((html.match(/src="universal\/site-tracking\.js/g)||[]).length,1,name);assert.equal(html.includes('googletagmanager.com/gtag/js'),false,name);}
 assert.match(fs.readFileSync(__dirname+'/../universal/marketplace-card.js','utf8'),/data-wep-view-sku/);
});

test('a background product tab counts only after it becomes visible',async()=>{
 const b=browser();b.document.visibilityState='hidden';b.window.WEPViewedProduct={brandId:'TORO',sku:'88920',kind:'builder'};await b.start();assert.equal(b.calls.some(c=>c.url.endsWith('/product-view')),false);b.document.visibilityState='visible';b.handlers.visibilitychange();await new Promise(resolve=>setImmediate(resolve));assert.equal(b.calls.filter(c=>c.url.endsWith('/product-view')).length,1);
});
