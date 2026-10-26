'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepare}=require('../scripts/build-buy-data-sync.cjs');
const {parse,encode,isPrivate}=require('../scripts/marketplace-sync.cjs');
const {buildCatalog}=require('../scripts/build-marketplace-catalog.cjs');
function temporary(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'wep-package-data-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function write(root,file,headers,rows){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,encode(headers,rows));}
test('workbook package exports retain parent SKU and quantities while excluding dealer data and internal notes',t=>{
 const root=temporary(t),source=path.join(root,'export'),target=path.join(root,'public');
 write(source,'products.csv',['SKU'],[{SKU:'TOOL'}]);
 write(source,'packages.csv',['ParentSKU','Description','Active','BatterySKU1','BatteryQty1','ChargerSKU1','ChargerQty1','DealerCost','Notes'],[{ParentSKU:'KIT',Description:'Two battery kit',Active:'T',BatterySKU1:'BAT',BatteryQty1:'2',ChargerSKU1:'CHG',ChargerQty1:'1',DealerCost:'123',Notes:'Internal note'}]);
 const jobs=prepare('stihl',path.join(source,'products.csv'),target,{parse,encode,isPrivate});assert.equal(jobs.length,1);
 const projected=parse(jobs[0].after);assert.equal(projected.rows[0].ParentSKU,'KIT');assert.equal(projected.rows[0].BatteryQty1,'2');assert.ok(!projected.headers.includes('DealerCost'));assert.ok(!projected.headers.includes('Notes'));
});
test('published catalog carries brand-specific package contents and changes its version when a package changes',t=>{
 const root=temporary(t),brands=['stihl','yanmar','billygoat','toro','honda','redmax','greenworks','mitm'];
 for(const brand of brands)write(root,'brands/'+brand+'/data/products.csv',['SKU','BrandID','Model'],[{SKU:brand+'-TOOL',BrandID:brand.toUpperCase(),Model:'Model'}]);
 for(const name of ['batteries','chargers','compatibility-runtime','finance-programs'])write(root,'brands/stihl/data/'+name+'.csv',['SKU','Active'],[]);
 write(root,'data/dealer-settings.csv',['DealerName'],[{DealerName:'West End'}]);fs.writeFileSync(path.join(root,'marketplace.html'),'<html><head></head><body></body></html>');
 const headers=['ParentSKU','Active','BatterySKU1','BatteryQty1'];
 write(root,'brands/stihl/data/packages.csv',headers,[{ParentSKU:'KIT',Active:'T',BatterySKU1:'BAT',BatteryQty1:'2'}]);
 const first=buildCatalog({root}),bundle=JSON.parse(fs.readFileSync(path.join(root,'data/marketplace-catalog.json')));
 const source=bundle.componentSources.find(s=>s.brand==='STIHL');assert.deepEqual(source.packages.headers,headers);assert.equal(source.packages.rows.length,1);assert.equal(bundle.componentSources.length,8);
 write(root,'brands/stihl/data/packages.csv',headers,[{ParentSKU:'KIT',Active:'T',BatterySKU1:'BAT',BatteryQty1:'1'}]);assert.notEqual(buildCatalog({root}).version,first.version);
 write(root,'brands/stihl/data/packages.csv',['ParentSKU','DealerCost'],[{ParentSKU:'KIT',DealerCost:'100'}]);assert.throws(()=>buildCatalog({root}),/private columns/);
});
