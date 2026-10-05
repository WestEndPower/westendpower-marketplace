'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {parse,isPrivate}=require('./marketplace-sync.cjs');
const BRANDS=['STIHL','YANMAR','BILLYGOAT','TORO','HONDA','REDMAX','GREENWORKS','MITM'];
function packTable(table){
  const dense=table.rows.map(r=>table.headers.map(h=>r[h]??''));
  const sparse=dense.map(r=>{const a=[];r.forEach((v,i)=>{if(v!=='')a.push(i,v);});return a;});
  const useSparse=JSON.stringify(sparse).length<JSON.stringify(dense).length;
  return {headers:table.headers,encoding:useSparse?'sparse':'dense',rows:useSparse?sparse:dense};
}
function readTable(root,file){
  const table=parse(fs.readFileSync(path.join(root,file),'utf8'));
  const prohibited=table.headers.filter(isPrivate);
  if(prohibited.length)throw Error('Public catalog input contains private columns: '+file+' ('+prohibited.join(', ')+')');
  return table;
}
function writeAtomic(file,contents){
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===contents)return false;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.catalog-'+process.pid;
  try{fs.writeFileSync(temp,contents,'utf8');fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return true;
}
function buildCatalog({root=path.resolve(__dirname,'..')}={}){
  const productSources=BRANDS.map(brand=>{
    const table=readTable(root,'brands/'+brand.toLowerCase()+'/data/products.csv');
    if(!table.headers.includes('SKU')||!table.rows.length)throw Error('Missing product data for '+brand);
    return {brand,...packTable(table)};
  });
  const files={batteries:'batteries.csv',chargers:'chargers.csv',compatibility:'compatibility-runtime.csv',financePrograms:'finance-programs.csv'};
  const tables={};for(const [name,file] of Object.entries(files))tables[name]=packTable(readTable(root,'brands/stihl/data/'+file));
  tables.settingsRows=packTable(readTable(root,'data/dealer-settings.csv'));
  const bundle={schema:1,brands:BRANDS,componentBrand:'STIHL',productSources,tables};
  const json=JSON.stringify(bundle)+'\n';
  const version=crypto.createHash('sha256').update(json).digest('hex').slice(0,16);
  const htmlFile=path.join(root,'marketplace.html');
  const html=fs.readFileSync(htmlFile,'utf8');
  const preload='<link rel="preload" href="data/marketplace-catalog.json?v='+version+'" as="fetch" crossorigin="anonymous" data-marketplace-catalog>';
  const preloadPattern=/<link\b[^>]*\bdata-marketplace-catalog\b[^>]*>/g;
  const matches=html.match(preloadPattern)||[];
  let nextHtml;
  if(matches.length>1)throw Error('Multiple catalog preload entries');
  if(matches.length===1)nextHtml=html.replace(preloadPattern,preload);
  else{
    if((html.match(/<head\b[^>]*>/gi)||[]).length!==1)throw Error('Marketplace HTML head not found');
    nextHtml=html.replace(/<head\b[^>]*>/i,match=>match+'\n'+preload);
  }
  const catalogFile=path.join(root,'data/marketplace-catalog.json');
  const oldCatalog=fs.existsSync(catalogFile)?fs.readFileSync(catalogFile,'utf8'):null;
  let catalogChanged=false;
  try{catalogChanged=writeAtomic(catalogFile,json);writeAtomic(htmlFile,nextHtml);}
  catch(e){if(catalogChanged){if(oldCatalog===null)fs.unlinkSync(catalogFile);else writeAtomic(catalogFile,oldCatalog);}throw e;}
  return {version,bytes:Buffer.byteLength(json),products:productSources.reduce((n,t)=>n+t.rows.length,0),changed:catalogChanged};
}
if(require.main===module){try{const r=buildCatalog();console.log('CATALOG BUILD PASS: '+r.products+' products, '+r.bytes+' bytes, version '+r.version);}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={packTable,buildCatalog};
