export type Rect={x:number;y:number;width:number;height:number};
export const TOUCH_ACTIONS=['aim','hop','fire','reload','switch','utility','crouch','repair','burst','recover','swap','cycleMode','lean-left','lean-right','scope','camera','fire-left','free-look','prone','dog-attack','dog-radar'] as const;
/** Reserve the joystick and HUD before placing controls. Keep 44px targets even
 * when a saved large-button preference cannot fit a small phone. */
export function touchLayout(width:number,height:number,requested=60,hudBottom=188,safe={left:0,right:0,top:0,bottom:0}){
 const portrait=height>=width,gap=6,left=safe.left+12,right=safe.right+12,bottom=safe.bottom+(portrait?36:20);
 const pad=portrait?108:106,columns=portrait?3:6,rows=6/(portrait?1:2);
 const reserved=portrait?left+pad+12:Math.max(left+pad+12,safe.left+234);
 const top=portrait?Math.max(hudBottom+12,safe.top+68):safe.top+68;
 const size=Math.max(44,Math.floor(Math.min(requested,portrait?requested:(reserved-left-pad-gap*3)/2,(width-right-reserved-gap*(columns-1))/columns,(height-bottom-top-gap*(rows-1))/rows)));
 const stride=size+gap,buttons:Record<string,Rect>={};
 TOUCH_ACTIONS.filter(a=>a!=='prone'&&a!=='dog-attack'&&a!=='dog-radar').forEach((action,i)=>{const col=i%columns,row=Math.floor(i/columns);buttons[action]={x:width-right-size-(columns-1-col)*stride,y:height-bottom-size-row*stride,width:size,height:size};});
 buttons['dog-attack']={x:portrait?left:left+pad+gap,y:portrait?height-bottom-pad-2*(size+gap):height-bottom-2*size-gap,width:size,height:size};
 buttons['dog-radar']={x:portrait?left:left+pad+2*gap+size,y:portrait?height-bottom-pad-3*(size+gap):height-bottom-2*size-gap,width:size,height:size};
 buttons.prone={x:portrait?left:left+pad+gap,y:portrait?height-bottom-pad-size-gap:height-bottom-size,width:size,height:size};
 return {size,move:{x:left,y:height-bottom-pad,width:pad,height:pad},buttons};
}


