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
function merge(source,current){
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
    for(const h of LINKS)if(String(old[h]||'').trim())out[h]=old[h];
    if(!String(out.MarketplaceFamily||'').trim()&&old.MarketplaceFamily)out.MarketplaceFamily=old.MarketplaceFamily;
    rows.push(out);
  }
  if(!rows.length)throw Error('Products export has no usable rows; Marketplace left unchanged');
  return {headers,rows};
}
function sync({brand,sourceFile,root=path.resolve(__dirname,'..'),backupRoot}){
  if(!BRANDS.includes(brand))throw Error('Unknown brand');
  if(path.basename(sourceFile).toLowerCase()!=='products.csv')throw Error('Only public products.csv exports are supported');
  if(/configuratorprivate/i.test(sourceFile))throw Error('Private export path rejected');
  const target=path.join(root,'brands',brand,'data','products.csv');
  if(!fs.existsSync(target))throw Error('Marketplace brand products file not found: '+target);
  const old=fs.readFileSync(target,'utf8');
  const result=merge(parse(fs.readFileSync(sourceFile,'utf8')),parse(old));
  const data=encode(result.headers,result.rows);
  if(data===old)return {changed:false,rows:result.rows.length};
  const directory=backupRoot||path.join(process.env.USERPROFILE||os.homedir(),'Desktop','Marketplace-Brand-Backups','automatic-product-sync');
  fs.mkdirSync(directory,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  fs.copyFileSync(target,path.join(directory,`${brand}-${stamp}-${process.pid}.csv`));
  const temp=target+'.sync-'+process.pid;
  try{fs.writeFileSync(temp,data,'utf8');fs.renameSync(temp,target);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return {changed:true,rows:result.rows.length};
}
if(require.main===module){
  const [brand,sourceFile]=process.argv.slice(2);
  try{const result=sync({brand,sourceFile});console.log(`${brand}: ${result.changed?'updated':'unchanged'}, ${result.rows} product rows`);}
  catch(e){const message=new Date().toISOString()+' '+String(brand)+' '+e.message+'\r\n';try{const logDir=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'WestEndPower');fs.mkdirSync(logDir,{recursive:true});fs.appendFileSync(path.join(logDir,'marketplace-sync.log'),message);}catch{}console.error(message);process.exitCode=1;}
}
module.exports={parse,encode,merge,sync,isPrivate};
