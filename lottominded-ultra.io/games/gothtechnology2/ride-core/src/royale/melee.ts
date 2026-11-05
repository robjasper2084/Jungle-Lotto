import type {RidePose} from '../controller.ts';
import type {Vec3} from '../terrain.ts';
import profile from './meleeProfiles.json' with {type:'json'};
export type MeleeState={brawl:boolean;kind:number;start:number;end:number;serial:number;staggerUntil:number;evadeUntil:number;evadeDir:number};
export const initialMelee=():MeleeState=>({brawl:false,kind:0,start:-1,end:0,serial:0,staggerUntil:0,evadeUntil:0,evadeDir:0});
export function meleeTargets(m:MeleeState,tick:number){
 const clips=profile.clips,clip=clips[Math.max(0,m.kind)]??clips[0],phase=m.kind?Math.max(0,Math.min(1,(tick-m.start)/Math.max(1,m.end-m.start))):0;
 const keys=clip.keys;let hi=keys.findIndex(k=>k.t>=phase);if(hi<0)hi=keys.length-1;const a=keys[Math.max(0,hi-1)],b=keys[hi],f=b.t===a.t?0:(phase-a.t)/(b.t-a.t);
 const blend=(key:'left'|'right'|'kick')=>a[key].map((v,i)=>v+(b[key][i]-v)*f);
 return {left:blend('left'),right:blend('right'),kick:blend('kick'),twist:a.twist+(b.twist-a.twist)*f,phase};
}
export function meleeTrigger(m:MeleeState,p:RidePose,scale:number,tick:number){
 const age=tick-m.start;if(!m.kind||age<(m.kind>2?12:6)||age>(m.kind>2?24:15))return null;
 const targets=meleeTargets(m,tick),local=m.kind===3?targets.kick:m.kind===1?targets.left:targets.right;
 const yaw=p.headingY,c=Math.cos(yaw),s=Math.sin(yaw);return {x:p.x+(c*local[0]+s*local[2])*scale,y:p.y+local[1]*scale,z:p.z+(-s*local[0]+c*local[2])*scale};
}
/** A separate fist/foot capsule trigger; no projectile IDs or weapon damage are reused. */
export function sweepMelee(from:Vec3,to:Vec3,p:RidePose,b:{x:number;z:number;minY:number;maxY:number},radius=.19){
 const lo=[p.x-b.x-radius,p.y+b.minY-radius,p.z-b.z-radius],hi=[p.x+b.x+radius,p.y+b.maxY+radius,p.z+b.z+radius],origin=[from.x,from.y,from.z],d=[to.x-from.x,to.y-from.y,to.z-from.z];let a=0,c=1;
 for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(origin[i]<lo[i]||origin[i]>hi[i])return false;}else{let u=(lo[i]-origin[i])/d[i],v=(hi[i]-origin[i])/d[i];if(u>v)[u,v]=[v,u];a=Math.max(a,u);c=Math.min(c,v);if(a>c)return false;}}return true;
}
