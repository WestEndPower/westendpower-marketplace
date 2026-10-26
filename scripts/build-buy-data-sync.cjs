/* WEP_BUILD_BUY_DATA_SYNC_V1 */
'use strict';
const fs=require('fs'),path=require('path');
const names=['batteries','chargers','compatibility-runtime','attachments','accessories','parts','packages','battery-requirements'];
function prepare(brand,sourceFile,root,{parse,encode,isPrivate}){
 if(!['stihl','toro','yanmar','honda','billygoat','redmax','greenworks','mitm'].includes(brand))throw Error('Unknown Build & Buy brand');
 if(/configuratorprivate/i.test(sourceFile))throw Error('Private export path rejected');
 const jobs=[];
 for(const name of names){const source=path.join(path.dirname(sourceFile),name+'.csv');if(!fs.existsSync(source))continue;
  const parsed=parse(fs.readFileSync(source,'utf8')),headers=parsed.headers.filter(h=>!isPrivate(h)&&(name!=='packages'||['ParentSKU','ToolSKU','BaseToolSKU','Description','Active','DeliveryGroup','SortOrder'].includes(h)||/^(Battery|Charger|Attachment|Accessory|Part)(SKU|Qty)\d+$/.test(h)));const id=name==='compatibility-runtime'?'ToolSKU':name==='packages'?'ParentSKU':name==='battery-requirements'?'ToolSKU':'SKU';
  if(!headers.includes(id))throw Error(name+' export missing '+id);
  const rows=[];for(const row of parsed.rows){const sku=String(row[id]||'').trim();if(sku.toUpperCase()==='STOP')break;if(!sku||['REFERENCE_ONLY','0000 000 0000'].includes(sku.toUpperCase()))continue;if(row.BrandID&&String(row.BrandID).trim().toLowerCase()!==brand)throw Error('Wrong brand in '+name+' export');rows.push(row);}
  const file=path.join(root,'brands',brand,'data',name+'.csv'),before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null,after=encode(headers,rows);
  if(before!==after)jobs.push({file,before,after,brand,name});
 }
 return jobs;
}
function apply(jobs,backup){for(const j of jobs)if(j.before!==null){const dest=path.join(backup,'build-buy-data',j.brand,j.name+'.csv');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,j.before);}
 try{for(const j of jobs){fs.mkdirSync(path.dirname(j.file),{recursive:true});fs.writeFileSync(j.file,j.after,'utf8');}}catch(e){for(const j of jobs)if(j.before===null)fs.rmSync(j.file,{force:true});else fs.writeFileSync(j.file,j.before,'utf8');throw e;}
 return jobs.length;
}
module.exports={prepare,apply};
