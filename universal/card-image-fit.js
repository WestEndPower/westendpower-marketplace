/* Fit equipment rather than unused white/transparent source-image borders. */
(function(root){
  'use strict';
  function bounds(data,width,height){
    const blank=i=>data[i+3]<16||(data[i]>238&&data[i+1]>238&&data[i+2]>238);
    // Keep photographs with a non-white background intact.
    if(![0,(width-1)*4,(height-1)*width*4,(width*height-1)*4].every(blank))return null;
    let left=width,top=height,right=-1,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!blank((y*width+x)*4)){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(right<left||bottom<top)return null;
    const margin=Math.max(2,Math.ceil(Math.max(right-left+1,bottom-top+1)*.04));
    left=Math.max(0,left-margin);top=Math.max(0,top-margin);
    right=Math.min(width-1,right+margin);bottom=Math.min(height-1,bottom+margin);
    if((right-left+1)*(bottom-top+1)>width*height*.9)return null;
    return {x:left,y:top,width:right-left+1,height:bottom-top+1};
  }
  if(typeof module==='object'&&module.exports)module.exports={bounds};
  if(!root.document)return;
  const cache=new Map(),seen=new WeakMap();
  function fit(img){
    if(!img.matches('.market-image img')||!img.complete||!img.naturalWidth)return;
    const src=img.currentSrc||img.src;
    if(src.startsWith('data:')||seen.get(img)===src)return;
    seen.set(img,src);
    // Cross-origin images retain their original display and need no CORS request.
    if(new URL(src,document.baseURI).origin!==location.origin)return;
    try{
      let cropped=cache.get(src);
      if(cropped===undefined){
        const scale=Math.min(1,256/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const box=bounds(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
        cropped=null;
        if(box){
          const sx=box.x/scale,sy=box.y/scale;
          const sw=Math.min(img.naturalWidth-sx,box.width/scale),sh=Math.min(img.naturalHeight-sy,box.height/scale);
          canvas.width=Math.ceil(sw);canvas.height=Math.ceil(sh);
          ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
          cropped=canvas.toDataURL('image/png');
        }
        cache.set(src,cropped);
      }
      if(cropped){img.removeAttribute('srcset');img.removeAttribute('sizes');img.src=cropped;}
    }catch(_){/* Keep the original image if canvas access is unavailable. */}
  }
  document.addEventListener('load',event=>{if(event.target.tagName==='IMG')fit(event.target);},true);
  function scan(node){if(node.nodeType!==1)return;if(node.tagName==='IMG')fit(node);node.querySelectorAll('.market-image img').forEach(fit);}
  new MutationObserver(records=>records.forEach(record=>{
    if(record.type==='attributes')fit(record.target);
    else record.addedNodes.forEach(scan);
  })).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  document.querySelectorAll('.market-image img').forEach(fit);
})(typeof window==='undefined'?{}:window);
