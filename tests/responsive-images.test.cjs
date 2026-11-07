const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
function runtime(){
 const window={},listeners={},document={currentScript:{src:'https://westendpower.github.io/westendpower-marketplace/universal/responsive-images.js'},baseURI:'https://westendpower.github.io/westendpower-marketplace/',addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(fs.readFileSync('universal/responsive-images.js','utf8'),{window,document,URL});return {api:window.WEPResponsiveImages,listeners};
}
test('responsive candidates exist, use source hashes and preserve originals as fallback',()=>{
 const {api}=runtime();
 for(const name of ['BGA50','BGA30','BGE61','BGE71']){
  const original='brands/stihl/images/Products/'+name+'.jpg',attrs=api.attributes(original);
  const hash=crypto.createHash('sha256').update(fs.readFileSync(original)).update('wep-card-v1-crop-q82').digest('hex').slice(0,16);
  assert.match(attrs,/width="\d+" height="\d+"/);assert.match(attrs,/sizes=/);assert.match(attrs,/data-wep-original-image=/);
  const set=attrs.match(/srcset="([^"]+)"/)[1].split(', ');assert.equal(set.length,2);
  for(const entry of set){const [url,width]=entry.split(' ');assert.ok(url.includes(hash));assert.ok(parseInt(width)>0&&parseInt(width)<=640);const bytes=fs.readFileSync(decodeURIComponent(new URL(url).pathname.replace('/westendpower-marketplace/','')));assert.equal(bytes.toString('ascii',8,12),'WEBP');}
 }
 assert.equal(api.attributes('brands/stihl/images/Products/UNKNOWN.jpg'),'');
 assert.equal(api.attributes('https://other.example/brands/stihl/images/Products/BGA50.jpg'),'');
});
test('a failed responsive copy falls back to the original once',()=>{
 const {listeners}=runtime(),removed=[],img={tagName:'IMG',dataset:{wepOriginalImage:'original.jpg'},removeAttribute:name=>removed.push(name)};
 listeners.error({target:img});assert.equal(img.src,'original.jpg');assert.deepEqual(removed,['srcset','sizes']);assert.equal(img.dataset.wepOriginalImage,undefined);
 listeners.error({target:img});assert.equal(removed.length,2);
});
test('all shopping headers reserve the embedded logo aspect ratio and load responsive support before cards',()=>{
 for(const file of ['marketplace.html','shop-by-product.html','shop-by-brand.html']){
  const html=fs.readFileSync(file,'utf8'),tag=html.match(/<img[^>]+id="market-dealer-logo"[^>]*>/)[0];
  assert.match(tag,/width="200"/);assert.match(tag,/height="61"/);
  const png=Buffer.from(tag.match(/src="data:image\/png;base64,([^"]+)"/)[1],'base64');assert.equal(png.readUInt32BE(16),200);assert.equal(png.readUInt32BE(20),61);
  assert.ok(html.indexOf('universal/responsive-images.js')<html.indexOf('universal/marketplace-card.js'));
 }
});
