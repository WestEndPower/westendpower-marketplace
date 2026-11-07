const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('universal/shopping-help.js','utf8');
function contact({store='NM',text=false,question='Please compare equipment',ios=false}={}){
 const nodes={select:{value:store},textarea:{value:question},'[value="text"]':{checked:text},'[data-help-send]':{removeAttribute(k){delete this[k];}},'[data-help-call]':{removeAttribute(k){delete this[k];}}};
 const box={URL,location:{href:'https://dealer.test/pages/blowers?brand=STIHL&category=Blowers&q=private-search&wep-cart=PRIVATE#wep-cart=PRIVATE'},navigator:{userAgent:ios?'iPhone':'Desktop'},stores:[{LocationID:'NM',ShortName:'New Milford',Phone:'860-355-8722',Email:'sales@westendpower.com'},{LocationID:'DA',ShortName:'Danbury',Phone:'475-444-3901',Email:'dawepe@westendpower.com'}],dialog:{querySelector:s=>nodes[s]},clean:v=>String(v??'').trim()};
 const context=source.slice(source.indexOf(' function pageContext(){'),source.indexOf(' function create(){'));
 const update=source.slice(source.indexOf(' function update(){'),source.indexOf(' function show('));
 vm.runInNewContext(context+update+';update();',box);return nodes;
}
test('help drafts follow the chosen store/method and include the question with safe filter context',()=>{
 const email=contact(),url=new URL(email['[data-help-send]'].href);
 assert.equal(url.pathname,'sales@westendpower.com');assert.match(url.searchParams.get('body'),/Please compare equipment/);assert.match(url.searchParams.get('body'),/brand=STIHL&category=Blowers/);assert.doesNotMatch(url.searchParams.get('body'),/PRIVATE|private-search|wep-cart/);
 const text=contact({store:'DA',text:true}),sms=new URL(text['[data-help-send]'].href);assert.equal(sms.protocol,'sms:');assert.equal(sms.pathname,'4754443901');assert.match(sms.searchParams.get('body'),/Store: Danbury/);assert.equal(text['[data-help-call]'].href,'tel:4754443901');
 const ios=contact({store:'DA',text:true,ios:true});assert.match(ios['[data-help-send]'].href,/^sms:4754443901&body=/);
 const blank=contact({question:''});assert.match(new URL(blank['[data-help-send]'].href).searchParams.get('body'),/property, intended use, budget and priorities/);
});
