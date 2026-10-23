/* WEP_QUOTE_FORM_V2: shared builder/checkout data in the dealer's established form. */
(function(root){
 'use strict';
 async function create(s){
  const D=root.WEPQuoteDocument||require('./quote-document.js'),P=root.PDFLib||require('./vendor/pdf-lib.min.js');
  const doc=await P.PDFDocument.create(),font=await doc.embedFont(P.StandardFonts.Helvetica),bold=await doc.embedFont(P.StandardFonts.HelveticaBold);
  doc.setTitle((s.reference||'Equipment')+' Quote');doc.setAuthor('West End Power Equipment');
  const red=P.rgb(.82,.04,.1),ink=P.rgb(.08,.08,.08),gray=P.rgb(.65,.65,.65),white=P.rgb(1,1,1);
  const money=n=>n===null?'Needs confirmation':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const safe=v=>Array.from(String(v??'')).map(c=>{try{font.encodeText(c);return c;}catch(_){return '?';}}).join('');
  function wrap(value,width,size=9,f=font){
   const lines=[];for(const paragraph of safe(value).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){
    if(line&&f.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line='';}
    for(const c of word){if(f.widthOfTextAtSize(line+c,size)>width){lines.push(line);line='';}line+=c;}line+=' ';
   }lines.push(line.trimEnd());}return lines;
  }
  let logo=null;try{
   let bytes;if(typeof window==='undefined')bytes=require('node:fs').readFileSync(require('node:path').join(__dirname,'../images/West-End-Logo.png'));
   else{const response=await fetch(new URL('images/West-End-Logo.png',document.baseURI));if(!response.ok)throw Error('Logo unavailable');bytes=await response.arrayBuffer();}
   logo=await doc.embedPng(bytes);
  }catch(_){}
  let page;const left=28,right=584,width=556,boxWidth=272,summaryTop=544,tableTop=238,tableBottom=530,extra=[];
  const draw=(value,x,top,size=9,f=font,color=ink)=>page.drawText(safe(value),{x,y:792-top-size,size,font:f,color});
  function line(x1,x2,top,color=gray){page.drawLine({start:{x:x1,y:792-top},end:{x:x2,y:792-top},thickness:.55,color});}
  function box(x,top,w,h){page.drawRectangle({x,y:792-top-h,width:w,height:h,borderWidth:.6,borderColor:gray});}
  function fit(value,x,top,w,size=11,f=font){
   const text=safe(value);let adjusted=size;while(adjusted>9&&f.widthOfTextAtSize(text,adjusted)>w)adjusted-=.25;
   if(f.widthOfTextAtSize(text,adjusted)>w){extra.push(text);let short=text;while(short&&f.widthOfTextAtSize(short+'...',adjusted)>w)short=short.slice(0,-1);draw(short+'...',x,top,adjusted,f);}else draw(text,x,top,adjusted,f);
  }
  function header(){
   if(logo){const dimensions=logo.scaleToFit(200,48);page.drawImage(logo,{x:left,y:792-28-dimensions.height,width:dimensions.width,height:dimensions.height});}
   else draw('WEST END POWER EQUIPMENT',left,32,16,bold,red);
   draw('QUOTE',left,78,16,bold);
   [['Quote #',s.reference||'Equipment Quote'],['Date',new Date(s.createdAt).toLocaleDateString('en-US')],['Phone','(860) 355-8722'],['Email','sales@westendpower.com']].forEach(([k,v],i)=>{draw(k+':',348,28+i*15,9,bold);fit(v,401,28+i*15,181,9);});
  }
  function infoBox(x,title,c){
   box(x,104,boxWidth,100);draw(title,x+7,110,11,bold);
   const phone=safe(c.phone||'');fit(phone,x+265-Math.min(129,font.widthOfTextAtSize(phone,10)),110,129,10);line(x+6,x+266,125);
   const info=[[c.firstName,c.lastName].filter(Boolean).join(' '),c.companyName||'', [c.address1,c.address2].filter(Boolean).join(' '),[c.city,c.state,c.zip].filter(Boolean).join(' - '),...(c.cell?['Cell: '+c.cell]:[]),c.email||''];info.forEach((v,i)=>fit(v,x+7,129+i*(c.cell?12:14),258,c.cell?10.5:11.5,i===0?bold:font));
  }
  function deliveryInfo(){
   if(s.fulfillment==='SHIP')return {...s.customer,...s.destination,firstName:s.customer.firstName,lastName:s.customer.lastName,companyName:s.customer.companyName,phone:s.customer.phone,cell:s.customer.cell,email:s.customer.email};
   if(s.fulfillment==='DELIVERY')return {...s.customer,city:s.customer.city||s.deliveryTown,state:s.customer.state||s.deliveryState,zip:s.customer.zip||s.zip};
   const nm=s.fulfillment==='NEW_MILFORD';return {firstName:nm?'Pickup - New Milford':'Pickup - Danbury',companyName:'West End Power Equipment',address1:nm?'265 Danbury Road':'56 Beaver Brook Road',city:nm?'New Milford':'Danbury',state:'CT',zip:nm?'06776':'06810',phone:nm?'(860) 355-8722':'(203) 792-3030',email:nm?'sales@westendpower.com':'dawepe@westendpower.com'};
  }
  const notes=wrap(s.customer.notes||'',470,9);if(notes.length>1)extra.push('Customer notes: '+s.customer.notes);
  const widths=[25,68,247,72,72,72],labels=['QTY','SKU','DESCRIPTION','MSRP','SALE PRICE','TOTAL'];
  function tableHeader(){let x=left;page.drawRectangle({x:left,y:792-tableTop-20,width,height:20,color:red});labels.forEach((label,i)=>{draw(label,i>=3?x+widths[i]-4-bold.widthOfTextAtSize(label,9):x+4,tableTop+5,9,bold,white);x+=widths[i];});return tableTop+20;}
  function makePage(continuation=false){page=doc.addPage([612,792]);header();infoBox(left,'CUSTOMER INFO',s.customer);infoBox(312,'DELIVER TO',deliveryInfo());box(left,211,width,20);draw('Notes / Instructions:',left+6,216,9,bold);fit((notes[0]||'')+(notes.length>1?' (continued)':''),130,216,446,9);if(continuation)draw('Continued',520,83,8);return tableHeader();}
  const totalRows=D.totalRows(s);
  const paymentLines=s.plans.flatMap(plan=>[
   ...(s.plans.length>1?[{text:plan.brandId,size:9}]:[]),
   {text:'Rate: '+plan.apr+'% APR | Term: '+plan.termMonths+' months',size:9},
   {text:'Estimated monthly payment: '+money(plan.monthlyPayment),size:10}
  ]);
  const expandedPayment=paymentLines.flatMap(row=>wrap(row.text,256,row.size||9).map(text=>({...row,text})));
  const sumPlans=key=>s.plans.every(p=>typeof p[key]==='number'&&Number.isFinite(p[key]))?s.plans.reduce((sum,p)=>sum+p[key],0):null;
  const minimumDown=s.plans.length?(s.plans.every(p=>typeof p.minimumRequiredDown==='number')?sumPlans('minimumRequiredDown'):null):null;
  const financed=s.plans.length?sumPlans('principalWithFees'):null;
  const preferred=({cash:'Cash / Bank Check',credit:'Credit Card',finance:'Financing'})[s.paymentMethod];
  function summary(final){
   box(left,summaryTop,boxWidth,165);box(312,summaryTop,boxWidth,165);draw('PAYMENT INFORMATION',left+7,summaryTop+7,11,bold);line(left+6,left+266,summaryTop+25);
   if(final){
    const paymentRows=[['Amount Paid:','$________________'],['Balance Due:','$________________'],['Amount Financed:',s.plans.length?money(financed):'Not applicable']];
    paymentRows.forEach(([label,value],i)=>{const top=summaryTop+31+i*16;draw(label,left+7,top,9);draw(value,left+265-font.widthOfTextAtSize(value,9),top,9);});
    line(left,left+boxWidth,summaryTop+84);
    draw('SELECTED PAYMENT OPTION',left+7,summaryTop+91,9,bold);
    draw(preferred,left+7,summaryTop+104,9);
    if(s.plans.length<=2){s.plans.forEach((p,i)=>{const top=summaryTop+116+i*24;draw('Rate: '+p.apr+'% APR | Term: '+p.termMonths+' months',left+7,top,9);draw('Estimated monthly payment: '+money(p.monthlyPayment),left+7,top+11,10);});}
    else draw('Rates, terms and estimated monthly payments follow.',left+7,summaryTop+120,8);
   }
   else draw('Payment information and totals on final item page.',left+7,summaryTop+34,9);
   if(final){const start=summaryTop+9,step=totalRows.length>7?16:18;totalRows.forEach(([label,value],i)=>{const last=i===totalRows.length-1,top=start+i*step+(last?4:0);if(last)line(319,577,top-3,ink);draw(last?'ESTIMATED TOTAL':label,319,top,last?11:9,last?bold:font,last?red:ink);const text=money(value),size=last?13:10;draw(text,577-bold.widthOfTextAtSize(text,size),top,size,bold,last?red:ink);
     if(last&&s.plans.length){const note='Minimum down payment required: '+money(minimumDown);draw(note,312+(boxWidth-font.widthOfTextAtSize(note,9))/2,top+22,9);}
    });}
   else draw('Continued on next page',320,summaryTop+12,10,bold);
   draw('Changing your payment option may change discounts, rebates and the total.',left,716,7);
   draw('We will confirm pricing and availability and contact you if there are any discrepancies.',left,728,8);
  }
  const prepared=s.lines.map(item=>{
   const sku=wrap(item.sku,60,9);
   const description=wrap(item.productName,239,9);if(item.freightNote)description.push(...wrap(item.freightNote,239,9));
   const cells=[[String(item.quantity)],sku,description,wrap(money(item.regularUnitPrice),64),wrap(money(item.unitPrice),64),wrap(money(item.itemTotal),64)];
   return {cells,height:Math.max(18,Math.max(...cells.map(c=>c.length))*11+4)};
  });
  let y=makePage(),itemPages=[];
  function endItems(final){while(y+18<=tableBottom){let x=left;widths.forEach(w=>{box(x,y,w,18);x+=w;});y+=18;}summary(final);itemPages.push(page);}
  for(const row of prepared){
   // Normal items stay together. Oversized descriptions continue with repeated headings.
   if(row.height<=tableBottom-tableTop-20&&y+row.height>tableBottom){endItems(false);y=makePage(true);}
   let offset=0,count=Math.max(...row.cells.map(c=>c.length));
   while(offset<count){if(y+18>tableBottom){endItems(false);y=makePage(true);}const take=Math.min(count-offset,Math.max(1,Math.floor((tableBottom-y-4)/11))),height=Math.max(18,take*11+4);let x=left;
    row.cells.forEach((lines,col)=>{box(x,y,widths[col],height);lines.slice(offset,offset+take).forEach((text,n)=>draw(text,col>=3?x+widths[col]-4-font.widthOfTextAtSize(text,9):x+4,y+3+n*11,9,font));x+=widths[col];});y+=height;offset+=take;
   }
  }endItems(true);
  // Keep long notes, confirmation messages, and financing readable without squeezing the fixed form.
  if(s.plans.length>2)extra.push('Payment details: '+expandedPayment.map(r=>r.text).join('\n'));
  extra.push(...s.issues.map(v=>'Needs confirmation: '+v));
  if(extra.length){page=doc.addPage([612,792]);header();y=112;draw('ADDITIONAL QUOTE DETAILS',left,y,12,bold);y+=25;
   for(const text of extra)for(const row of wrap(text,width,10)){if(y+15>730){page=doc.addPage([612,792]);header();y=112;}draw(row,left,y,10);y+=14;}
  }
  const pages=doc.getPages();pages.forEach((p,i)=>{page=p;line(left,right,744);const center=(text,top,size=8)=>draw(text,(612-bold.widthOfTextAtSize(text,size))/2,top,size,bold);center('NEW MILFORD - 265 Danbury Rd., New Milford, CT 06776 - (860) 355-8722 - sales@westendpower.com',751,7.7);center('DANBURY - 56 Beaver Brook Rd., Danbury, CT 06810 - (203) 792-3030 - dawepe@westendpower.com',763,7.7);center('westendpower.com',775,8);draw((i+1)+' / '+pages.length,558,775,7);});
  return doc.save();
 }
 root.WEPQuotePDF={create};if(typeof module!=='undefined'&&module.exports)module.exports=root.WEPQuotePDF;
})(typeof window==='undefined'?globalThis:window);
