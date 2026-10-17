import type {RidePose} from '../../../../ride-core/src/controller.ts';
import type {BattleTerrain} from '../../../../ride-core/src/royale/battleTerrain.ts';
import {weaponSocket} from '../../../../ride-core/src/royale/rules.ts';
import {stanceBounds} from '../../../../ride-core/src/royale/stanceVolume.ts';
import {footEyeHeight} from './fpsMotion.ts';
import type {Vec3} from '../../../../ride-core/src/terrain.ts';
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
/** Trace the exact crosshair ray, then converge the authority's physical muzzle
 * on that point. No target attraction, damage prediction or through-cover aim. */
export function fpsAim(p:RidePose,skin:string,yaw:number,pitch:number,blend:number,lean:number,terrain:BattleTerrain,others:readonly {pose:RidePose;skin:string;alive:boolean}[]=[],view?:{origin:Vec3;range:number;kickYaw:number;kickPitch:number;targets?:readonly {center:Vec3}[];targetHeading?:number}){
 const scale=skin.startsWith('DS_Mascot_')?.48:1,o=view?.origin??{x:p.x,y:p.y+footEyeHeight(scale,p.footCrouch,p.footProne),z:p.z},d={x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)},range=view?.range??500;
 let distance=terrain.raycast(o,d,range)??range;
 // Training boards are visual targets, not live actors or invented damage hits.
 if(view?.targets){const nx=Math.sin(view.targetHeading??0),nz=Math.cos(view.targetHeading??0),den=d.x*nx+d.z*nz;
  if(Math.abs(den)>1e-8)for(const t of view.targets){const at=((t.center.x-o.x)*nx+(t.center.z-o.z)*nz)/den;if(at<=.05||at>=distance)continue;const x=o.x+d.x*at-t.center.x,y=o.y+d.y*at-t.center.y,z=o.z+d.z*at-t.center.z;if(Math.abs(x*nz-z*nx)<=.65&&Math.abs(y)<=.85)distance=at;}
 }
 for(const actor of others){if(!actor.alive)continue;const b=stanceBounds(actor.pose,actor.skin),q=actor.pose;let near=0,far=distance;
  for(const [origin,v,low,high] of [[o.x,d.x,q.x-b.x,q.x+b.x],[o.y,d.y,q.y+b.minY,q.y+b.maxY],[o.z,d.z,q.z-b.z,q.z+b.z]]){if(Math.abs(v)<1e-8){if(origin<low||origin>high){far=-1;break;}}else{const a=(low-origin)/v,z=(high-origin)/v;near=Math.max(near,Math.min(a,z));far=Math.min(far,Math.max(a,z));}}
  if(near<=far&&far>0)distance=Math.min(distance,near);
 }
 distance=Math.max(.8,distance);const target={x:o.x+d.x*distance,y:o.y+d.y*distance,z:o.z+d.z*distance};let aimYaw=angle(yaw-p.headingY),aimPitch=pitch;
 for(let i=0;i<3;i++){const grip=weaponSocket(p,skin,aimYaw,aimPitch,blend,lean).grip;aimYaw=angle(Math.atan2(target.x-grip.x,target.z-grip.z)-p.headingY);aimPitch=Math.atan2(target.y-grip.y,Math.hypot(target.x-grip.x,target.z-grip.z));}
 const muzzle=weaponSocket(p,skin,aimYaw,aimPitch,blend,lean).muzzle,dx=target.x-muzzle.x,dy=target.y-muzzle.y,dz=target.z-muzzle.z,length=Math.hypot(dx,dy,dz);
 const obstruction=length>.01?terrain.raycast(muzzle,{x:dx/length,y:dy/length,z:dz/length},Math.min(length,2)):null;
 // The authority adds recoil itself. Converge on the recoiled crosshair once,
 // then remove that component from the input so it is never applied twice.
 return {aimYaw:Math.max(-1.25,Math.min(1.25,aimYaw-(view?.kickYaw??0))),aimPitch:Math.max(-.65,Math.min(.65,aimPitch-(view?.kickPitch??0))),distance,blocked:obstruction!==null&&obstruction<Math.min(length,2)-.05};
}
