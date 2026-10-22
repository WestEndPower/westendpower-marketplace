/* One printable PDF for the builder and customer checkout. */
(function(root){
 'use strict';
 async function create(snapshot){
  const D=root.WEPQuoteDocument||require('./quote-document.js');
  const P=root.PDFLib||require('./vendor/pdf-lib.min.js');
  const doc=await P.PDFDocument.create(),font=await doc.embedFont(P.StandardFonts.Helvetica),bold=await doc.embedFont(P.StandardFonts.HelveticaBold);
  doc.setTitle((snapshot.reference||'Equipment')+' Quote');doc.setAuthor('West End Power Equipment');
  const money=n=>n===null?'Needs confirmation':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const safe=value=>Array.from(String(value??'')).map(c=>{try{font.encodeText(c);return c;}catch(_){return '?';}}).join('');
  const wrap=(value,width,size=9,f=font)=>{
   const lines=[];for(const paragraph of safe(value).split('\n')){
    let line='';for(const word of paragraph.split(/\s+/)){
     if(line&&f.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line='';}
     for(const c of word){if(f.widthOfTextAtSize(line+c,size)>width){lines.push(line);line='';}line+=c;}
     line+=' ';
    }lines.push(line.trimEnd());
   }return lines;
  };
  let page,y;const left=42,right=570,bottom=62;
  function draw(value,x,top,size=9,f=font,color=P.rgb(.13,.17,.14)){page.drawText(safe(value),{x,y:792-top-size,size,font:f,color});}
  function rule(top,color=P.rgb(.8,.83,.81)){page.drawLine({start:{x:left,y:792-top},end:{x:right,y:792-top},thickness:.7,color});}
  function newPage(){page=doc.addPage([612,792]);y=40;draw('West End Power Equipment',left,y,18,bold);draw(snapshot.reference||'Equipment Quote',390,y+4,10,bold);y+=26;draw('New Milford & Danbury, Connecticut',left,y,9);y+=20;rule(y,P.rgb(.7,.08,.15));y+=16;}
  function room(height){if(y+height>792-bottom)newPage();}
  function paragraph(value,{size=9,f=font,width=528,x=left}={}){for(const line of wrap(value,width,size,f)){room(size+5);draw(line,x,y,size,f);y+=size+4;}y+=5;}
  newPage();paragraph('Equipment Quote',{size:14,f:bold});paragraph('Prepared '+new Date(snapshot.createdAt).toLocaleString('en-US'));
  const customer=D.customerText(snapshot);if(customer.length){paragraph('Prepared for',{f:bold});for(const line of customer)paragraph(line);}
  paragraph(D.fulfillmentLabel(snapshot));paragraph('Payment preference: '+D.paymentLabel(snapshot));y+=5;
  const widths=[183,27,65,80,80,93],labels=['Equipment & options','Qty','Installation','Regular price','Your price','Item total'];
  function tableHeader(){room(34);page.drawRectangle({x:left,y:792-y-27,width:528,height:27,color:P.rgb(.93,.95,.93)});let x=left;labels.forEach((label,i)=>{draw(label,x+5,y+8,8,bold);x+=widths[i];});y+=30;}
  tableHeader();
  for(const item of snapshot.lines){
   const description=wrap(item.productName,173,9,bold).concat(wrap(item.brandId+' - SKU '+item.sku,173,8));
   if(item.pricingSource)description.push(item.pricingSource==='stock'?'In-stock pricing':'Available to order');
   const cells=[description,[String(item.quantity)],wrap(item.setupTotal?money(item.setupTotal):'-',55),wrap(money(item.regularUnitPrice),70),wrap(money(item.unitPrice),70),wrap(money(item.itemTotal),83)];
   let index=0;const count=Math.max(...cells.map(c=>c.length));
   if(count*13+9<580&&y+count*13+9>792-bottom){newPage();tableHeader();}
   while(index<count){if(y+22>792-bottom){newPage();tableHeader();}const take=Math.min(count-index,Math.floor((792-bottom-y-9)/13));let x=left;
    cells.forEach((lines,col)=>{lines.slice(index,index+take).forEach((line,n)=>draw(line,x+5,y+n*13,col===0&&index+n>0?8:9,col===0&&index+n===0?bold:font));x+=widths[col];});y+=take*13+9;index+=take;
   }rule(y);y+=7;if(item.freightNote)paragraph(item.freightNote,{size:8});
  }
  paragraph('Item totals exclude installation. Installation is included in the totals below.',{size:8});
  const totals=D.totalRows(snapshot);room(totals.length*22+32);y+=8;paragraph('Quote total',{f:bold,x:310,width:260});
  totals.forEach(([label,value],i)=>{const last=i===totals.length-1;if(last){rule(y);y+=7;}draw(label,310,y,last?11:9,last?bold:font);const formatted=money(value),size=last?12:10;draw(formatted,right-bold.widthOfTextAtSize(formatted,size),y,size,bold);y+=last?29:22;});
  for(const plan of snapshot.plans){room(110);paragraph('Financing estimate - '+plan.brandId+' - '+plan.name,{f:bold});paragraph(plan.apr+'% APR / '+plan.termMonths+' months');
   for(const [label,value] of [['Required down payment',plan.requiredDown],['Amount financed before fee',plan.amountFinanced],['Application fee',plan.applicationFee],['Financed amount including fee',plan.principalWithFees],['Estimated monthly payment',plan.monthlyPayment]])paragraph(label+': '+money(value));
   if(plan.minimumCreditScore)paragraph('Minimum credit score: '+plan.minimumCreditScore);
   paragraph(plan.rebateCompatible?'Compatible customer rebates included':'In lieu of customer rebates');paragraph('Subject to credit approval. Fees are included in the financed amount. Final lender terms are confirmed through the store.',{size:8});
  }
  for(const rebate of snapshot.rebates||[])paragraph(rebate.name+' - '+money(rebate.amount)+' - '+rebate.status+(rebate.endDate?' - Ends '+rebate.endDate:''));
  if(snapshot.customer.notes){paragraph('Customer notes',{f:bold});paragraph(snapshot.customer.notes);}
  if(snapshot.issues.length){paragraph('Needs confirmation',{f:bold});for(const issue of snapshot.issues)paragraph(issue);}
  paragraph('Pricing recorded at the time shown. Please confirm availability and final pricing with the store. This quote does not create a payment, order or inventory reservation.',{size:8});
  const pages=doc.getPages();pages.forEach((p,i)=>{page=p;rule(746);draw('New Milford - 265 Danbury Road - 860-355-8722',left,754,8);draw('Danbury - 56 Beaver Brook Road - 203-792-3030',left,767,8);draw((i+1)+' / '+pages.length,540,767,8);});
  return doc.save();
 }
 root.WEPQuotePDF={create};if(typeof module!=='undefined'&&module.exports)module.exports=root.WEPQuotePDF;
})(typeof window==='undefined'?globalThis:window);
