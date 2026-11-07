/* Card-sized copies only; product/detail links keep the original image. */
(() => {
 'use strict';
// BEGIN GENERATED MANIFEST
 const images={"brands/stihl/images/Products/BGA30.jpg":{"height":475,"variants":[{"src":"brands/stihl/images/Products/responsive/BGA30-efdb4534daa8d162-320.webp","width":320},{"src":"brands/stihl/images/Products/responsive/BGA30-efdb4534daa8d162-640.webp","width":640}],"width":1167},"brands/stihl/images/Products/BGA50.jpg":{"height":833,"variants":[{"src":"brands/stihl/images/Products/responsive/BGA50-717de22106a5b03c-320.webp","width":320},{"src":"brands/stihl/images/Products/responsive/BGA50-717de22106a5b03c-640.webp","width":640}],"width":1140},"brands/stihl/images/Products/BGE61.jpg":{"height":222,"variants":[{"src":"brands/stihl/images/Products/responsive/BGE61-95e2acdb41c1e93d-320.webp","width":320},{"src":"brands/stihl/images/Products/responsive/BGE61-95e2acdb41c1e93d-480.webp","width":480}],"width":480},"brands/stihl/images/Products/BGE71.jpg":{"height":223,"variants":[{"src":"brands/stihl/images/Products/responsive/BGE71-02bbe1e3570f9e41-320.webp","width":320},{"src":"brands/stihl/images/Products/responsive/BGE71-02bbe1e3570f9e41-480.webp","width":480}],"width":480}};
// END GENERATED MANIFEST
 const root=new URL('../',document.currentScript.src);
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function attributes(source){
  try{
   const url=new URL(source,document.baseURI);
   if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return '';
   const entry=images[decodeURIComponent(url.pathname.slice(root.pathname.length))];
   if(!entry)return '';
   const srcset=entry.variants.map(v=>new URL(v.src,root).href+' '+v.width+'w').join(', ');
   return 'width="'+entry.width+'" height="'+entry.height+'" srcset="'+escape(srcset)+'" sizes="(max-width: 700px) calc(100vw - 48px), (max-width: 1200px) 320px, 400px" data-wep-original-image="'+escape(url.href)+'"';
  }catch{return '';}
 }
 document.addEventListener('error',event=>{
  const img=event.target,original=img?.dataset?.wepOriginalImage;
  if(img?.tagName!=='IMG'||!original)return;
  delete img.dataset.wepOriginalImage;
  img.removeAttribute('srcset');img.removeAttribute('sizes');img.src=original;
 },true);
 window.WEPResponsiveImages={attributes};
})();
