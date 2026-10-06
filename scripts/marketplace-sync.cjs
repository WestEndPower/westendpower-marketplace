'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const BRANDS=['stihl','yanmar','toro','honda','billygoat','redmax','greenworks','mitm'];
const LINKS=['ImageURL','ProductURL','ManualURL','InventoryURL'];
const privateNames=new Set(('advertisingfee advertisingfeepercent rebatetodealer mfgrebatetodealer financemaximumfee financemaximumfeepercent maxprogramfeepercent maximumfeepercent dealerfeepercent credittier creditscoremin creditscoremax maximumadvancepercent biddealerrebate fleettier1rebate fleettier2rebate fundingsource').split(' '));
function isPrivate(h){const s=h.toLowerCase().replace(/[\s_-]/g,'');return /cost|profit|bonus|dealerrebate|serialnumber|serialno|customeremail|customerphone/.test(s)||privateNames.has(s);}
function parse(text){
  const records=[];let row=[],field='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c==='"'){if(field||closed)throw Error('Invalid CSV quote');quoted=true;}
    else if(c===','||c==='\n'||c==='\r'){
      row.push(field);field='';closed=false;
      if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))records.push(row);row=[];}
    }else{if(closed)throw Error('Unexpected text after CSV quote');field+=c;}
  }
  if(quoted)throw Error('Incomplete CSV: export may still be writing');
  if(field!==''||row.length||closed){row.push(field);if(row.some(v=>v!==''))records.push(row);}
  if(!records.length)throw Error('Empty CSV');
  const headers=records.shift().map(h=>h.trim());
  if(new Set(headers.map(h=>h.toLowerCase())).size!==headers.length||headers.some(h=>!h))throw Error('Blank or duplicate CSV headers');
  const rows=records.map(r=>{if(r.length!==headers.length)throw Error('CSV row width does not match headers');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
  return {headers,rows};
}
function encode(headers,rows){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[headers.map(q).join(','),...rows.map(r=>headers.map(h=>q(r[h])).join(','))].join('\r\n')+'\r\n';}
function merge(source,current,{preferWorkbookImage=false}={}){
  for(const h of ['SKU','Category','Model','Series'])if(!source.headers.includes(h))throw Error('Public products export missing '+h);
  const headers=source.headers.filter(h=>!isPrivate(h));
  for(const h of [...LINKS,'MarketplaceFamily'])if(current.headers.includes(h)&&!headers.includes(h))headers.push(h);
  const oldBySKU=new Map();for(const r of current.rows){const k=String(r.SKU||'').trim().toUpperCase();if(k&&!oldBySKU.has(k))oldBySKU.set(k,r);}
  const rows=[];
  for(const r of source.rows){
    const sku=String(r.SKU||'').trim();
    if(sku.toUpperCase()==='STOP')break;
    if(!sku||sku.toUpperCase()==='REFERENCE_ONLY'||sku==='0000 000 0000')continue;
    const old=oldBySKU.get(sku.toUpperCase())||{};
    const out=Object.fromEntries(headers.map(h=>[h,r[h]??'']));
    // Marketplace's curated image and external links survive data refreshes.
    for(const h of LINKS)if(String(old[h]||'').trim()){if(h==='ImageURL'&&preferWorkbookImage&&String(r[h]||'').trim())continue;out[h]=old[h];}
    if(!String(out.MarketplaceFamily||'').trim()&&old.MarketplaceFamily)out.MarketplaceFamily=old.MarketplaceFamily;
    rows.push(out);
  }
  if(!rows.length)throw Error('Products export has no usable rows; Marketplace left unchanged');
  return {headers,rows};
}
function copyBillyGoatImages(rows,sourceFile,root,directory){
  const sourceRoot=path.dirname(path.dirname(sourceFile));
  const jobs=[];
  for(const row of rows){
    const image=String(row.ImageURL||'').trim().replace(/\\/g,'/');
    if(!/^images\/products\/[A-Za-z0-9_. -]+\.(?:jpe?g|png|webp|svg)$/i.test(image))continue;
    const source=path.join(sourceRoot,image),target=path.join(root,image);
    if(!fs.existsSync(source)){if(fs.existsSync(target))continue;throw Error('Billy Goat image missing: '+source+'. Put the image in the configurator images/products folder and retry.');}
    const bytes=fs.readFileSync(source);
    if(!bytes.length)throw Error('Billy Goat image is empty: '+source);
    if(fs.existsSync(target)&&fs.readFileSync(target).equals(bytes))continue;
    jobs.push({source,target,bytes});
  }
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const journal=[];
  try{
    for(const job of jobs){
      fs.mkdirSync(path.dirname(job.target),{recursive:true});
      const saved=path.join(directory,'images-'+stamp+'-'+process.pid,path.basename(job.target));
      const exists=fs.existsSync(job.target);
      if(exists){fs.mkdirSync(path.dirname(saved),{recursive:true});fs.copyFileSync(job.target,saved);}
      journal.push({target:job.target,saved,exists});
      fs.writeFileSync(job.target,job.bytes);
    }
  }catch(error){for(const job of journal.reverse()){if(job.exists)fs.copyFileSync(job.saved,job.target);else fs.rmSync(job.target,{force:true});}throw error;}
  return jobs.length;
}
function sync({brand,sourceFile,root=path.resolve(__dirname,'..'),backupRoot}){
  if(!BRANDS.includes(brand))throw Error('Unknown brand');
  if(path.basename(sourceFile).toLowerCase()!=='products.csv')throw Error('Only public products.csv exports are supported');
  if(/configuratorprivate/i.test(sourceFile))throw Error('Private export path rejected');
  const target=path.join(root,'brands',brand,'data','products.csv');
  if(!fs.existsSync(target))throw Error('Marketplace brand products file not found: '+target);
  const old=fs.readFileSync(target,'utf8');
  const result=merge(parse(fs.readFileSync(sourceFile,'utf8')),parse(old),{preferWorkbookImage:brand==='billygoat'});
  const data=encode(result.headers,result.rows);
  const directory=backupRoot||path.join(process.env.USERPROFILE||os.homedir(),'Desktop','Marketplace-Brand-Backups','automatic-product-sync');
  fs.mkdirSync(directory,{recursive:true});
  const imageCount=brand==='billygoat'?copyBillyGoatImages(result.rows,sourceFile,root,directory):0;
  if(data===old)return {changed:false,rows:result.rows.length,imageCount};
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  fs.copyFileSync(target,path.join(directory,`${brand}-${stamp}-${process.pid}.csv`));
  const temp=target+'.sync-'+process.pid;
  try{fs.writeFileSync(temp,data,'utf8');fs.renameSync(temp,target);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return {changed:true,rows:result.rows.length,imageCount};
}
module.exports={parse,encode,merge,sync,isPrivate};
if(require.main===module){
  const [brand,sourceFile]=process.argv.slice(2);
  try{const result=sync({brand,sourceFile});const catalog=require('./build-marketplace-catalog.cjs').buildCatalog();console.log(`${brand}: ${result.changed?'updated':'unchanged'}, ${result.rows} product rows; catalog ${catalog.version}`);}
  catch(e){const message=new Date().toISOString()+' '+String(brand)+' '+e.message+'\r\n';try{const logDir=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'WestEndPower');fs.mkdirSync(logDir,{recursive:true});fs.appendFileSync(path.join(logDir,'marketplace-sync.log'),message);}catch{}console.error(message);process.exitCode=1;}
}
