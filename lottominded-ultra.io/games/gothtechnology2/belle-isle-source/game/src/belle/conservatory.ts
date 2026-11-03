export type ConservatoryLayout={id:string;center:number[];yaw:number;outline:number[][];walls:{a:number[];b:number[]}[];gardenWalls?:{a:number[];b:number[]}[];beds:{u:number;v:number;rx:number;ry:number;type:string}[];entrance:number[];approach:number[];rooms:{name:string;point:number[]}[]};
export function greenhouseWorld(c:ConservatoryLayout,u:number,v:number){return{x:c.center[0]+Math.cos(c.yaw)*u-Math.sin(c.yaw)*v,z:c.center[1]-Math.sin(c.yaw)*u-Math.cos(c.yaw)*v};}
export function greenhouseLocal(c:ConservatoryLayout,x:number,z:number){const dx=x-c.center[0],dz=z-c.center[1];return{u:dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw),v:-dx*Math.sin(c.yaw)-dz*Math.cos(c.yaw)};}
function distance(u:number,v:number,a:number[],b:number[]){const x=b[0]-a[0],y=b[1]-a[1],l=x*x+y*y,t=l?Math.max(0,Math.min(1,((u-a[0])*x+(v-a[1])*y)/l)):0;return Math.hypot(u-a[0]-x*t,v-a[1]-y*t);}
export function greenhouseBlocked(c:ConservatoryLayout,x:number,z:number,margin=.4){
 const {u,v}=greenhouseLocal(c,x,z);if(Math.abs(u)>26+margin||Math.abs(v)>45+margin)return false;
 if(c.walls.some(w=>distance(u,v,w.a,w.b)<.14+margin)||(c.gardenWalls||[]).some(w=>distance(u,v,w.a,w.b)<.06+margin))return true;
 return c.beds.some(b=>((u-b.u)/(b.rx+.16+margin))**2+((v-b.v)/(b.ry+.16+margin))**2<1);
}
export function greenhouseInside(c:ConservatoryLayout,x:number,z:number){
 const {u,v}=greenhouseLocal(c,x,z);let inside=false;
 for(let i=0,j=c.outline.length-1;i<c.outline.length;j=i++){
  const a=c.outline[i],b=c.outline[j];if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
export function greenhouseRoom(c:ConservatoryLayout,x:number,z:number){
 if(!greenhouseInside(c,x,z))return null;
 const {u,v}=greenhouseLocal(c,x,z);return c.rooms.reduce((a,b)=>Math.hypot(a.point[0]-u,a.point[1]-v)<Math.hypot(b.point[0]-u,b.point[1]-v)?a:b).name;
}
export function greenhouseRay(c:ConservatoryLayout,o:{x:number;y:number;z:number},d:{x:number;z:number},max:number,half=.4){
 if(Math.hypot(o.x-c.center[0],o.z-c.center[1])>65+max)return null;
 // Small, bounded swept steps avoid crossing a thin pane at speed. This path
 // only runs near this building; the island retains its existing broad phase.
 const count=Math.max(1,Math.ceil(max/.15));for(let i=0;i<=count;i++){
  const t=max*i/count;if(greenhouseBlocked(c,o.x+d.x*t,o.z+d.z*t,half))return t;
 }return null;
}
