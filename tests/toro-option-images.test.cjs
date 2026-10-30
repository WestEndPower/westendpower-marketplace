const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const sync=require('../scripts/toro-option-sync.cjs'),{prepareImages}=require('../scripts/toro-option-images.cjs'),csv=require('../scripts/marketplace-sync.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'toro-option-images-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const source=path.join(root,'source'),target=path.join(root,'marketplace');fs.mkdirSync(path.join(source,'data'),{recursive:true});fs.mkdirSync(path.join(source,'images/products'),{recursive:true});return {root,source,target,file:path.join(source,'data/products.csv')};}
test('Toro option sync discovers SKU photos, copies original bytes, publishes links and strips private fields',t=>{
 const f=fixture(t),bytes=Buffer.from([255,216,255,0,100,255,217]);fs.writeFileSync(path.join(f.source,'images/products/78690.JPG'),bytes);
 for(const name of ['attachments','accessories','parts'])fs.writeFileSync(path.join(f.source,'data',name+'.csv'),name==='attachments'?'SKU,BrandID,DealerCost,72530-Rec1\n78690,TORO,123,140-4310\n':'SKU,BrandID\n');
 const jobs=sync.prepare(f.file,f.target,csv);assert.equal(jobs.length,4);const table=csv.parse(jobs[0].after);assert(!table.headers.includes('DealerCost'));assert.equal(table.rows[0].ImageURL,'brands/toro/images/products/78690.JPG');assert.equal(table.rows[0]['72530-Rec1'],'140-4310');
 sync.apply(jobs,path.join(f.root,'backups'));assert.deepEqual(fs.readFileSync(path.join(f.target,table.rows[0].ImageURL)),bytes);
 assert.equal(sync.apply(sync.prepare(f.file,f.target,csv),path.join(f.root,'backups')),0);
});
test('explicit image links keep their meaning; missing and ambiguous local images are caught before writes',t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.source,'images/products/Custom.JPG'),'photo');
 const rows=[{SKU:'A',ImageURL:'https://example.com/photo.jpg'},{SKU:'B',ImageURL:'images/products/custom.jpg'}];const jobs=prepareImages(rows,f.file,f.target);assert.equal(jobs.length,1);assert.equal(rows[0].ImageURL,'https://example.com/photo.jpg');assert.equal(rows[1].ImageURL,'brands/toro/images/products/Custom.JPG');
 assert.throws(()=>prepareImages([{SKU:'C',ImageURL:'images/products/missing.jpg'}],f.file,f.target),/missing/);
 assert.throws(()=>prepareImages([{SKU:'C',ImageURL:'images/products/../private.jpg'}],f.file,f.target),/Unsupported/);
 fs.writeFileSync(path.join(f.source,'images/products/A.jpg'),'one');fs.writeFileSync(path.join(f.source,'images/products/A.png'),'two');assert.throws(()=>prepareImages([{SKU:'A'}],f.file,f.target),/Choose one image/);
});
test('current MULTI FORCE image links resolve to published images in both CSV and combined catalog',()=>{
 const csvRows=csv.parse(fs.readFileSync('brands/toro/data/attachments.csv','utf8')).rows,bundle=JSON.parse(fs.readFileSync('data/marketplace-catalog.json','utf8')),table=bundle.componentSources.find(x=>x.brand==='TORO').attachments;
 const packed=table.rows.map(values=>{const row={};if(table.encoding==='sparse')for(let i=0;i<values.length;i+=2)row[table.headers[values[i]]]=values[i+1];else table.headers.forEach((h,i)=>row[h]=values[i]);return row;});
 const source=fs.readFileSync('universal/product-options.js','utf8'),ctx={clean:v=>String(v??'').trim(),selectedBrand:'toro'};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function imageUrl('),source.indexOf('function img(')),ctx);
 for(const rows of [csvRows,packed])for(const sku of ['78690','78694','78593','78596','78597','78697','78598','STB13567B','STB13759B']){
  const row=rows.find(r=>r.SKU===sku),url=ctx.imageUrl(row);assert.equal(url,'brands/toro/images/products/'+sku+'.jpg');const bytes=fs.readFileSync(url);assert.equal(bytes[0],255);assert.equal(bytes[1],216);
 }
 for(const sku of ['78601','78691'])assert.equal(csvRows.find(r=>r.SKU===sku).ImageURL,'');
});
