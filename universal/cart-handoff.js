/* Carry public cart additions between our shopping origins; never analytics or customer fields. */
(() => {
 'use strict';
 const market='https://westendpower.github.io',pages='https://westendpower-configurator-api.westendpower-nm.workers.dev',origins=new Set([market,pages]);
 const fields=['brandId','type','sku','quantity','productName','description','itemPrice','shipping','packageId','equipmentSku','inventoryId','quoteStockChoice','assemblyOption','assemblyAmount','setupSelected','setupAmount','cardConfiguration','packageComponent','autoRequiredComponent','perToolQuantity','kitComponents','kitBreakdownIssue'];
 const componentFields=['brandId','sku','type','quantity','productName','description','itemPrice','unitPrice','price','perToolQuantity','included','name','amount','extendedPrice','itemTotal','regularUnitPrice','standaloneUnitPrice','locked','perPackageQuantity','perPackageTotal','parentSku'];
 const pendingKey='wepCartPendingAdds',receiptsKey='wepCartAppliedAdds';
 function cleanCart(value){
  if(!Array.isArray(value)||value.length>200)throw Error('Invalid cart.');
  return value.map(row=>{
   if(!row||typeof row.sku!=='string'||!row.sku.trim()||!Number.isInteger(Number(row.quantity))||Number(row.quantity)<1||Number(row.quantity)>99)throw Error('Invalid cart item.');
   const result={};for(const field of fields){const v=row[field];if(v===undefined)continue;
    if(field==='kitComponents'){if(!Array.isArray(v)||v.length>30)throw Error('Invalid package.');result[field]=v.map(p=>Object.fromEntries(componentFields.filter(k=>['string','number','boolean'].includes(typeof p[k])).map(k=>[k,p[k]])));}
    else if(v===null||['number','boolean'].includes(typeof v)||typeof v==='string'&&v.length<=4000)result[field]=v;
   }return result;
  });
 }
 const identity=row=>JSON.stringify([row.brandId||'',row.type||'tool',row.sku.trim().toUpperCase(),row.packageId||'',row.inventoryId||'']);
 const readCart=()=>cleanCart(JSON.parse(localStorage.getItem('wepCart')||'[]'));
 function quantity(row,q){const result={...row,quantity:q};if(row.kitComponents)result.kitComponents=row.kitComponents.map(c=>({...c,quantity:(c.perPackageQuantity??Number(c.quantity)/Number(row.quantity))*q,itemTotal:Math.round((c.perPackageTotal??Number(c.itemTotal)/Number(row.quantity))*q*100)/100}));return result;}
 function readPending(){const ops=JSON.parse(localStorage.getItem(pendingKey)||'[]');if(!Array.isArray(ops)||ops.length>200)throw Error('Too many pending cart additions.');return ops;}
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.has('wep-cart')&&origins.has(location.origin)){
  try{
   const text=hash.get('wep-cart');if(text.length>60000)throw Error('Cart is too large.');
   const payload=JSON.parse(decodeURIComponent(escape(atob(text))));
   if(payload.mode==='snapshot'&&location.origin===pages){localStorage.setItem('wepCart',JSON.stringify(cleanCart(payload.cart)));localStorage.setItem(pendingKey,'[]');}
   else if(payload.mode==='add'&&location.origin===market){
    if(!Array.isArray(payload.ops)||payload.ops.length>200)throw Error('Invalid cart additions.');
    const cart=readCart(),before=JSON.stringify(cart),saved=localStorage.getItem(receiptsKey)||'[]',seen=new Set(JSON.parse(saved));
    for(const op of payload.ops){
     if(typeof op.id!=='string'||!op.id||op.id.length>128)throw Error('Invalid addition receipt.');if(seen.has(op.id))continue;
     for(const row of cleanCart(op.rows)){const i=cart.findIndex(item=>identity(item)===identity(row));if(i<0)cart.push(row);else{const q=Number(cart[i].quantity)+Number(row.quantity);if(q>99)throw Error('Cart quantity exceeds 99.');cart[i]=quantity(row,q);}}
     seen.add(op.id);
    }
    if(cart.length>200)throw Error('Cart has too many items.');
    try{localStorage.setItem('wepCart',JSON.stringify(cart));localStorage.setItem(receiptsKey,JSON.stringify([...seen].slice(-2048)));}
    catch(error){localStorage.setItem('wepCart',before);localStorage.setItem(receiptsKey,saved);throw error;}
   }else throw Error('Invalid cart direction.');
  }catch(error){console.warn('Cart transfer was not accepted.',error);if(typeof alert==='function')alert('Your cart additions could not be transferred. Please review your cart before continuing.');}
  const anchor=hash.get('wep-cart-anchor')||'';history.replaceState(null,'',location.pathname+location.search+(anchor?'#'+anchor:''));
 }
 let previous;
 try{previous=readCart();}catch{previous=[];}
 function changed(){
  if(location.origin!==pages)return;
  const cart=readCart(),rows=[];
  for(const row of cart){const old=previous.find(p=>identity(p)===identity(row)),delta=Number(row.quantity)-Number(old?.quantity||0);if(delta>0)rows.push(quantity(row,delta));}
  if(rows.length){const ops=readPending();if(ops.length>=200)throw Error('Please review your cart before adding more items.');ops.push({id:window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),rows});localStorage.setItem(pendingKey,JSON.stringify(ops));}
  previous=cart;
 }
 function url(value){
  const target=new URL(value,document.baseURI);
  if(!origins.has(location.origin)||!origins.has(target.origin)||target.origin===location.origin)return target.href;
  if(target.origin===pages&&!/^\/pages\//.test(target.pathname)||target.origin===market&&!target.pathname.startsWith('/westendpower-marketplace/'))return target.href;
  changed();const payload=location.origin===market?{mode:'snapshot',cart:readCart()}:{mode:'add',ops:readPending()};
  const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));if(encoded.length>60000)throw Error('Cart is too large to transfer.');
  const old=new URLSearchParams(target.hash.slice(1)),anchor=old.has('wep-cart-anchor')?old.get('wep-cart-anchor'):target.hash.slice(1);
  target.hash=new URLSearchParams({'wep-cart':encoded,'wep-cart-anchor':anchor}).toString();return target.href;
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||link.hasAttribute('download'))return;
  try{const target=new URL(link.href,document.baseURI);if(!origins.has(target.origin)||target.origin===location.origin)return;link.href=url(target.href);}
  catch(error){event.preventDefault();alert('Your cart could not be carried to the next page. Please review your cart before continuing.');}
 },true);
 window.WEPCartHandoff={url,changed,cleanCart};
})();
