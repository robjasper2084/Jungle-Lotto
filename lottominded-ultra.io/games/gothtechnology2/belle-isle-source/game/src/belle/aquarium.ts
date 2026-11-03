export type AquariumLayout={id:string;center:number[];yaw:number;walls:{a:number[];b:number[]}[];tanks:{u:number;v:number;w:number;d:number;side:number}[];solids:{u:number;v:number;w:number;d:number;height:number}[];stairs?:{rise:number;count:number;tread:number;width:number;outsideStart:number;landingStart:number;landingEnd:number;insideEnd:number;centerRailStart:number;centerRailEnd:number};entrance:number[];approach:number[];rooms:{name:string;point:number[]}[]};
export function aquariumWorld(c:AquariumLayout,u:number,v:number){return{x:c.center[0]+Math.cos(c.yaw)*u-Math.sin(c.yaw)*v,z:c.center[1]-Math.sin(c.yaw)*u-Math.cos(c.yaw)*v};}
export function aquariumLocal(c:AquariumLayout,x:number,z:number){const dx=x-c.center[0],dz=z-c.center[1];return{u:dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw),v:-dx*Math.sin(c.yaw)-dz*Math.cos(c.yaw)};}
export function aquariumInside(c:AquariumLayout,x:number,z:number){const {u,v}=aquariumLocal(c,x,z);return Math.abs(u)<6.8&&Math.abs(v)<38;}
export function aquariumRoom(c:AquariumLayout,x:number,z:number){if(!aquariumInside(c,x,z))return null;const {v}=aquariumLocal(c,x,z);return c.rooms[v< -6?0:v>6?2:1].name;}
export function aquariumBlocked(c:AquariumLayout,x:number,z:number,margin=0,y=3){const {u,v}=aquariumLocal(c,x,z);if(Math.abs(u)>7.2+margin||Math.abs(v)>43+margin)return false;
 const steps=c.stairs;if(steps&&Math.abs(u)<.04+margin&&v>steps.centerRailStart-.2&&v<steps.centerRailEnd+.2&&y<(aquariumFloor(c,x,z)??2)+1.08)return true;
 if(steps&&Math.abs(Math.abs(u)-(steps.width/2-.12))<.055+margin&&(v>steps.landingEnd-.25&&v<steps.insideEnd+.2)){const floor=aquariumFloor(c,x,z)??2;if(y<floor+1.08)return true;}
 if(y<9&&c.walls.some(({a,b})=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(u-a[0]-t*dx,v-a[1]-t*dz)<.2+margin;}))return true;
 return c.solids.some(s=>y<2+s.height&&Math.abs(u-s.u)<s.w/2+margin&&Math.abs(v-s.v)<s.d/2+margin);
}
export function aquariumRay(c:AquariumLayout,o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half=.4){
 if(Math.hypot(o.x-c.center[0],o.z-c.center[1])>46+max)return null;const count=Math.max(1,Math.ceil(max/.1));for(let i=0;i<=count;i++){const t=max*i/count;if(aquariumBlocked(c,o.x+d.x*t,o.z+d.z*t,half,o.y+d.y*t))return t;}return null;
}

/** Support exactly matches the authored tread tops; the existing motor accepts 15 cm steps. */
export function aquariumFloor(c:AquariumLayout,x:number,z:number):number|null{
 const s=c.stairs;if(!s)return null;const {u,v}=aquariumLocal(c,x,z);
 if(Math.abs(u)>s.width/2||v<s.outsideStart||v>s.insideEnd)return null;
 const height=s.rise*s.count;
 if(v<s.landingStart)return 2+s.rise*Math.min(s.count,Math.floor((v-s.outsideStart+1e-8)/s.tread)+1);
 if(v<=s.landingEnd)return 2+height;
 return 2+s.rise*Math.max(0,s.count-1-Math.floor((v-s.landingEnd+1e-8)/s.tread));
}
