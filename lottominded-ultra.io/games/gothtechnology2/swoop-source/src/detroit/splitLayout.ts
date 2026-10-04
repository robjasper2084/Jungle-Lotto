export function splitViewports(width:number,height:number,count=2){
 const top=52,h=Math.max(1,height-top);
 if(count>2){const w=Math.floor(width/2),half=Math.floor(h/2);return Array.from({length:Math.min(4,count)},(_,i)=>({x:i%2?w:0,y:top+(i>1?half:0),width:i%2?width-w:w,height:i>1?h-half:half}));}
 return width>=height*1.15?
  [{x:0,y:top,width:Math.floor(width/2),height:h},{x:Math.floor(width/2),y:top,width:width-Math.floor(width/2),height:h}]:
  [{x:0,y:top,width,height:Math.floor(h/2)},{x:0,y:top+Math.floor(h/2),width,height:h-Math.floor(h/2)}];
}
