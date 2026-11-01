'use strict';
const fs=require('node:fs'),path=require('node:path');
const imageName=/^[A-Za-z0-9_. -]+\.(?:jpe?g|png|webp|gif|svg)$/i;
function prepareImages(rows,sourceFile,root){
 const sourceRoot=path.dirname(path.dirname(sourceFile)),folder=path.join(sourceRoot,'images','products');
 const names=fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>imageName.test(name)):[],jobs=new Map();
 for(const row of rows){
  let image=String(row.ImageURL||'').trim().replace(/\\/g,'/');
  if(/^(?:https?:)?\/\//i.test(image))continue;
  image=image.replace(/^\.\//,'').replace(/^brands\/toro\//i,'');
  if(!image){
   const sku=String(row.SKU||'').trim().toUpperCase();
   const matches=names.filter(name=>path.parse(name).name.toUpperCase()===sku);
   if(matches.length>1)throw Error('Choose one image or specify ImageURL for Toro SKU '+sku);
   if(!matches.length)continue;
   image='images/products/'+matches[0];
  }
  const filename=image.replace(/^images\/products\//i,'');
  if(!/^images\/products\//i.test(image)||!imageName.test(filename))throw Error('Unsupported Toro option image path: '+image);
  const matches=names.filter(name=>name.toLowerCase()===filename.toLowerCase());
  if(matches.length>1)throw Error('Ambiguous Toro image capitalization: '+image);
  image='images/products/'+(matches[0]||filename);
  const source=path.join(sourceRoot,image),relativeTarget='brands/toro/'+image,target=path.join(root,relativeTarget);
  row.ImageURL=relativeTarget;
  if(!fs.existsSync(source)){if(fs.existsSync(target))continue;throw Error('Toro option image missing: '+source);}
  if(!fs.statSync(source).isFile())throw Error('Toro option image is not a file: '+source);
  const after=fs.readFileSync(source);if(!after.length)throw Error('Toro option image is empty: '+source);
  jobs.set(relativeTarget,{name:image,target,before:fs.existsSync(target)?fs.readFileSync(target):null,after,image:true,backupPath:image,rows:1});
 }
 return [...jobs.values()];
}
module.exports={prepareImages};
