/** Pointer ownership is independent for steering, looking and held buttons. */
export class PointerTrack {
 id:number|null=null;x=0;y=0;
 begin(id:number,x:number,y:number){if(this.id!==null)return false;this.id=id;this.x=x;this.y=y;return true;}
 delta(id:number,x:number,y:number){if(this.id!==id)return null;const d={x:x-this.x,y:y-this.y};this.x=x;this.y=y;return d;}
 end(id:number){if(this.id!==id)return false;this.id=null;return true;}
 clear(){this.id=null;}
}
export function stickAxes(x:number,y:number,radius=45){
 if(!Number.isFinite(x)||!Number.isFinite(y))return {steer:0,throttle:0};
 const d=Math.hypot(x,y),dead=radius*.09;
 if(d<=dead)return {steer:0,throttle:0};
 const strength=Math.min(1,(d-dead)/(radius-dead));
 return {steer:x/d*strength,throttle:-y/d*strength};
}
export function brakeThrottle(speed:number){return Math.abs(speed)<.12?0:-Math.sign(speed);}
export class HeldControls {
 private owners=new Map<number,string>();
 press(id:number,action:string){if(this.owners.has(id))return false;this.owners.set(id,action);return true;}
 release(id:number){return this.owners.delete(id);}
 has(action:string){return [...this.owners.values()].includes(action);}
 clear(){this.owners.clear();}
}
