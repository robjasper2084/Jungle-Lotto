import type {Vec3,TerrainSampler} from '../terrain.ts';
import {createGroundSample} from '../terrain.ts';
export type SmokeCloud={id:string;owner:string;p:Vec3;start:number;end:number};
export const SMOKE_LIFE=1080,SMOKE_RADIUS=3.6;
export function smokeRadius(c:SmokeCloud,tick:number){return SMOKE_RADIUS*Math.max(0,Math.min(1,(tick-c.start)/45,(c.end-tick)/90));}
export function smokeBlocks(clouds:readonly SmokeCloud[],from:Vec3,to:Vec3,tick:number){
 const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=dx*dx+dy*dy+dz*dz;
 return clouds.some(c=>{const radius=smokeRadius(c,tick);if(radius<.4)return false;
  const cy=c.p.y+1.4,u=length?Math.max(0,Math.min(1,((c.p.x-from.x)*dx+(cy-from.y)*dy+(c.p.z-from.z)*dz)/length)):0;
  return Math.hypot(from.x+dx*u-c.p.x,(from.y+dy*u-cy)*1.4,from.z+dz*u-c.p.z)<radius;
 });
}
export function smokeLanding(t:TerrainSampler,p:Vec3,heading:number):Vec3|null{
 const dir={x:Math.sin(heading),y:0,z:Math.cos(heading)},origin={...p,y:p.y+1.1};
 const hit=t.raycastObstacle(origin,dir,7,.15),distance=Math.max(.4,Math.min(7,(hit??7)-.35));
 const x=p.x+dir.x*distance,z=p.z+dir.z*distance,g=t.sampleGround(x,z,createGroundSample(),p.y);
 return g.offCourse||Math.abs(g.height-p.y)>2?null:{x,y:g.height,z};
}
