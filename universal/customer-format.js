/* WEP_CUSTOMER_FORMAT_V1: store formatted values, including pasted/autofilled entries. */
(function(root){
 'use strict';
 const titleFields=new Set(['firstName','lastName','companyName','address1','city']);
 function phone(value){let digits=String(value??'').replace(/\D/g,'');if(digits.length===11&&digits[0]==='1')digits=digits.slice(1);if(digits.length!==10)return String(value??'').trim();return '('+digits.slice(0,3)+') '+digits.slice(3,6)+'-'+digits.slice(6);}
 function value(name,input){const text=String(input??'');if(titleFields.has(name))return text.replace(/(^|[\s-])(\p{L})/gu,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase('en-US'));if(name==='state')return text.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2);if(name==='email')return text.toLowerCase();if(name==='phone'||name==='cell')return phone(text);return text;}
 function customer(raw={}){return Object.fromEntries(Object.entries(raw).map(([name,input])=>[name,value(name,input).trim()]));}
 root.WEPCustomerFormat={value,phone,customer};if(typeof module!=='undefined'&&module.exports)module.exports=root.WEPCustomerFormat;
})(typeof window==='undefined'?globalThis:window);
