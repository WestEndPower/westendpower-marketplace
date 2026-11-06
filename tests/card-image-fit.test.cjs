const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bounds}=require('../universal/card-image-fit.js');
function picture(width,height,rect,transparent=false){
 const data=new Uint8ClampedArray(width*height*4).fill(255);
 if(transparent)for(let i=3;i<data.length;i+=4)data[i]=0;
 if(rect)for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++)data.set([60,30,20,255],(y*width+x)*4);
 return data;
}
test('white image margins shrink while all equipment and safety margin remain',()=>{
 const b=bounds(picture(100,100,{x:15,y:25,width:70,height:50}),100,100);
 assert.deepEqual(b,{x:12,y:22,width:76,height:56});
});
test('transparent borders fit tall tools without clipping',()=>{
 const b=bounds(picture(100,100,{x:45,y:10,width:10,height:80},true),100,100);
 assert.deepEqual(b,{x:41,y:6,width:18,height:88});
});
test('blank sources and full-frame photography remain unchanged',()=>{
 assert.equal(bounds(picture(100,100),100,100),null);
 assert.equal(bounds(picture(100,100,{x:0,y:0,width:100,height:100}),100,100),null);
});
