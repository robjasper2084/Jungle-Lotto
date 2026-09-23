/** Rotate posts with the panel and sample each footing, never the sign centre. */
export function signSupports(x:number,z:number,yaw:number,width:number,top:number,height:(x:number,z:number)=>number){
 return [-1,1].map(side=>{const px=x+Math.cos(yaw)*side*width*.36,pz=z-Math.sin(yaw)*side*width*.36,base=height(px,pz)-.12;
 return {x:px,z:pz,y:(top+base)/2,height:top-base,base,top};});
}
