export type Rect={x:number;y:number;width:number;height:number};
export const TOUCH_ACTIONS=['aim','hop','fire','reload','switch','utility','crouch','repair','burst','recover','swap','cycleMode','lean-left','lean-right','scope','camera','free-look','prone','dog-attack','dog-radar','brawl','evade','holster','vault','smoke'] as const;
/** Reserve the joystick and HUD before placing controls. Keep 44px targets even
 * when a saved large-button preference cannot fit a small phone. */
export function touchLayout(width:number,height:number,requested=60,hudBottom=188,safe={left:0,right:0,top:0,bottom:0}){
 const portrait=height>=width,gap=6,left=safe.left+12,right=safe.right+12,bottom=safe.bottom+(portrait?36:20);
 const pad=portrait?108:106,columns=portrait?3:6,rows=portrait?7:3;
 const reserved=portrait?left+pad+12:Math.max(left+pad+12,safe.left+234);
 const top=portrait?Math.max(hudBottom+12,safe.top+68):safe.top+68;
 const size=Math.max(44,Math.floor(Math.min(requested,portrait?requested:(reserved-left-pad-gap*3)/2,(width-right-reserved-gap*(columns-1))/columns,(height-bottom-top-gap*(rows-1))/rows)));
 const stride=size+gap,buttons:Record<string,Rect>={};
 TOUCH_ACTIONS.filter(a=>!['prone','dog-attack','dog-radar','brawl','evade','holster','vault','smoke'].includes(a)).forEach((action,i)=>{const col=i%columns,row=Math.floor(i/columns);buttons[action]={x:width-right-size-(columns-1-col)*stride,y:height-bottom-size-row*stride,width:size,height:size};});
 buttons['dog-attack']={x:portrait?left:left+pad+gap,y:portrait?height-bottom-pad-2*(size+gap):height-bottom-2*size-gap,width:size,height:size};
 buttons['dog-radar']={x:portrait?left:left+pad+2*gap+size,y:portrait?height-bottom-pad-3*(size+gap):height-bottom-2*size-gap,width:size,height:size};
 buttons.prone={x:portrait?left:left+pad+gap,y:portrait?height-bottom-pad-size-gap:height-bottom-size,width:size,height:size};
 buttons.brawl={x:portrait?left:left+pad+2*gap+size,y:portrait?buttons['dog-radar'].y-stride:height-bottom-size,width:size,height:size};
 buttons.evade={x:left,y:portrait?buttons['dog-radar'].y-stride*2:height-bottom-pad-stride,width:size,height:size};
 buttons.holster={x:portrait?width-right-size:left+pad+gap,y:portrait?height-bottom-size-6*stride:height-bottom-3*size-2*gap,width:size,height:size};
 const occupied:Rect[]=[...Object.values(buttons),...(width>=700?[{x:width-safe.right-194,y:64,width:182,height:225}]:[]),{x:left,y:height-bottom-pad,width:pad,height:pad},{x:10,y:68,width:220,height:hudBottom-68}];
 const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.width+3&&a.x+a.width+3>b.x&&a.y<b.y+b.height+3&&a.y+a.height+3>b.y;
 for(const name of ['vault','smoke']){let found:Rect|undefined;for(let y=Math.max(64,safe.top+8);y<=height-safe.bottom-44&&!found;y+=4)for(let x=width-right-44;x>=left;x-=4){const r={x,y,width:44,height:44};if(!occupied.some(o=>overlap(r,o))){found=r;break;}}
  if(!found)return presetTouchLayout(width,height,requested,'two');buttons[name]=found;occupied.push(found);
 }
 return {size,move:{x:left,y:height-bottom-pad,width:pad,height:pad},buttons};
}



export type ControlPreset='custom'|'two'|'three'|'four';
export function presetTouchLayout(width:number,height:number,requested=60,preset:ControlPreset='two'){
 const gap=7,left=12,right=12,bottom=20,pad=106,portrait=height>=width,reserved=portrait?132:132;
 const columns=portrait?3:Math.max(6,Math.min(9,Math.floor((width-reserved-right)/51))),rows=Math.ceil(TOUCH_ACTIONS.length/columns);
 const size=Math.max(44,Math.min(requested,Math.floor((width-reserved-right-gap*(columns-1))/columns),Math.floor((height-90-bottom-gap*(rows-1))/rows))),stride=size+gap;
 const buttons:Record<string,Rect>={};TOUCH_ACTIONS.forEach((action,i)=>{buttons[action]={x:width-right-size-(i%columns)*stride,y:height-bottom-size-Math.floor(i/columns)*stride,width:size,height:size};});
 // Move the firing controls into index-finger reach; vacated grid cells stay empty.
 if(preset==='three'||preset==='four')buttons.fire={x:left,y:90,width:size,height:size};
 if(preset==='four'){const top=Object.entries(buttons).filter(([name])=>name!=='fire'&&name!=='aim').sort((a,b)=>a[1].y-b[1].y||b[1].x-a[1].x)[0];const old=buttons.aim;buttons.aim=top[1];buttons[top[0]]=old;}
 return{size,move:{x:left,y:height-bottom-pad,width:pad,height:pad},buttons};
}
