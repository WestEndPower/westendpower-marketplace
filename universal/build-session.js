/* Picker builds use a tab-local cart; the marketplace's shared cart is untouched. */
(function(root){
 'use strict';
 function create(id,local,session){
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error('Invalid build session.');
  const key='wepBuildCart:'+id;
  return {getItem:k=>k==='wepCart'?(session.getItem(key)||'[]'):local.getItem(k),
   setItem:(k,v)=>k==='wepCart'?session.setItem(key,String(v)):local.setItem(k,v),
   removeItem:k=>k==='wepCart'?session.removeItem(key):local.removeItem(k)};
 }
 if(typeof module==='object'&&module.exports)module.exports={create};
 if(!root?.location)return;
 const id=new URLSearchParams(root.location.search).get('configuration');if(!id)return;
 let storage;
 try{storage=create(id,root.localStorage,root.sessionStorage);}catch(error){
  const blocked=()=>{throw Error('This build could not use private tab storage. Please reopen it from the marketplace.');};
  storage={getItem:blocked,setItem:blocked,removeItem:blocked};
 }
 function url(href){const value=new URL(href,root.location.href);if(value.origin===root.location.origin&&/\/(?:product-options|choose-implements|checkout|cart)\.html$/.test(value.pathname)){
  if(/\/cart\.html$/.test(value.pathname))value.pathname=value.pathname.replace(/cart\.html$/,'checkout.html');
  value.searchParams.set('configuration',id);
 }return value.href;}
 root.WEPBuildStorage=storage;root.WEPBuildSession={id,url};
 root.document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link)link.href=url(link.href);},true);
})(typeof window==='undefined'?null:window);
