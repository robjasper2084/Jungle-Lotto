export function splitViewports(width:number,height:number){
 const top=52,h=Math.max(1,height-top);
 return width>=height*1.15?
  [{x:0,y:top,width:Math.floor(width/2),height:h},{x:Math.floor(width/2),y:top,width:width-Math.floor(width/2),height:h}]:
  [{x:0,y:top,width,height:Math.floor(h/2)},{x:0,y:top+Math.floor(h/2),width,height:h-Math.floor(h/2)}];
}
