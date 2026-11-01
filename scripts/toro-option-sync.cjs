'use strict';
const fs=require('node:fs'),path=require('node:path');
const datasets=['attachments','accessories','parts'];
function prepare(sourceFile,root,{parse,encode,isPrivate}){
 const sourceFolder=path.dirname(sourceFile),destination=path.join(root,'brands','toro','data');
 const images=new Map();
 const tables=datasets.map(name=>{
  const source=path.join(sourceFolder,name+'.csv'),target=path.join(destination,name+'.csv');
  if(!fs.existsSync(source))throw Error('Export Toro '+name+'.csv before publishing: '+source);
  const parsed=parse(fs.readFileSync(source,'utf8'));
  if(!parsed.headers.includes('SKU'))throw Error(name+'.csv missing SKU');
  const headers=parsed.headers.filter(h=>!isPrivate(h));
  if(!headers.length)throw Error(name+'.csv has no public columns');
  const rows=[];
  for(const row of parsed.rows){
   const sku=String(row.SKU||'').trim().toUpperCase();
   if(sku==='STOP')break;
   if(!sku||sku==='REFERENCE_ONLY'||sku==='0000 000 0000')continue;
   const brand=String(row.BrandID||'').trim().toUpperCase();
   if(brand&&brand!=='TORO')throw Error(name+'.csv contains a non-Toro row');
   rows.push(row);
  }
  for(const image of require('./toro-option-images.cjs').prepareImages(rows,sourceFile,root))images.set(image.target,image);
  if(rows.some(row=>row.ImageURL)&&!headers.includes('ImageURL'))headers.push('ImageURL');
  const after=encode(headers,rows),before=fs.existsSync(target)?fs.readFileSync(target):null;
  return {name,target,before,after,rows:rows.length};
 });
 return [...tables,...images.values()];
}
function apply(jobs,backupRoot){
 const changed=jobs.filter(j=>j.before===null||!j.before.equals(Buffer.from(j.after,'utf8')));
 const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
 for(const j of changed)if(j.before!==null){const saved=path.join(backupRoot,'toro-options-'+stamp,j.backupPath||j.name+'.csv');fs.mkdirSync(path.dirname(saved),{recursive:true});fs.writeFileSync(saved,j.before);}
 const written=[];
 try{
  for(const j of changed){fs.mkdirSync(path.dirname(j.target),{recursive:true});const temp=j.target+'.sync-'+process.pid;
   try{fs.writeFileSync(temp,j.after,'utf8');fs.renameSync(temp,j.target);written.push(j);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
 }catch(error){for(const j of written.reverse()){if(j.before===null)fs.rmSync(j.target,{force:true});else fs.writeFileSync(j.target,j.before);}throw error;}
 for(const j of jobs)console.log('PASS Toro '+j.name+': '+(j.image?'image ready':j.rows+' rows'));
 return changed.length;
}
module.exports={prepare,apply};
