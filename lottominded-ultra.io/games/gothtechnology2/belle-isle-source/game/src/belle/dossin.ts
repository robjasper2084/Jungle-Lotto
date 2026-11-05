type Wall={a:number[];b:number[];kind:string;height:number};
type Solid={u:number;v:number;w:number;d:number;height:number;kind:string};
export type DossinLayout={id:string;ids:string[];center:number[];yaw:number;walls:Wall[];solids:Solid[];floors:{u:number;v:number;w:number;d:number}[];entrance:number[];approach:number[];entry:number[]};
// Same right-handed authored coordinate frame as the other enterable landmarks.
export function dossinWorld(c:DossinLayout,u:number,v:number){return{x:c.center[0]+Math.cos(c.yaw)*u-Math.sin(c.yaw)*v,z:c.center[1]-Math.sin(c.yaw)*u-Math.cos(c.yaw)*v};}
export function dossinLocal(c:DossinLayout,x:number,z:number){const dx=x-c.center[0],dz=z-c.center[1];return{u:dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw),v:-dx*Math.sin(c.yaw)-dz*Math.cos(c.yaw)};}
export function dossinInside(c:DossinLayout,x:number,z:number){const {u,v}=dossinLocal(c,x,z);return c.floors.some(f=>Math.abs(u-f.u)<f.w/2&&Math.abs(v-f.v)<f.d/2);}
export function dossinRoom(c:DossinLayout,x:number,z:number){if(!dossinInside(c,x,z))return null;const {u,v}=dossinLocal(c,x,z);return 'Dossin · '+(u< -21?'Miss Pepsi Pavilion':u< -8?'Welcome Center':v>17?'Riverfront gallery':v> -8?'Built by the River':u> -1.6?'Gothic Room':'Polk Family Hall');}
export function dossinBlocked(c:DossinLayout,x:number,z:number,margin=0,y=3){const {u,v}=dossinLocal(c,x,z);if(u< -36-margin||u>30+margin||v< -22-margin||v>36+margin)return false;
 if(c.walls.some(({a,b,height})=>{if(y>2+height)return false;const dx=b[0]-a[0],dv=b[1]-a[1],t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dv)/(dx*dx+dv*dv)));return Math.hypot(u-a[0]-t*dx,v-a[1]-t*dv)<.16+margin;}))return true;
 return c.solids.some(s=>y<2+s.height&&Math.abs(u-s.u)<s.w/2+margin&&Math.abs(v-s.v)<s.d/2+margin);
}
export function dossinRay(c:DossinLayout,o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half=.4){if(Math.hypot(o.x-c.center[0],o.z-c.center[1])>48+max)return null;const count=Math.max(1,Math.ceil(max/.08));for(let i=0;i<=count;i++){const t=max*i/count;if(dossinBlocked(c,o.x+d.x*t,o.z+d.z*t,half,o.y+d.y*t))return t;}return null;}
