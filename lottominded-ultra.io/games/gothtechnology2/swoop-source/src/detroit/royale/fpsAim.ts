import type {RidePose} from '../../../../ride-core/src/controller.ts';
import type {BattleTerrain} from '../../../../ride-core/src/royale/battleTerrain.ts';
import {weaponSocket} from '../../../../ride-core/src/royale/rules.ts';
import {stanceBounds} from '../../../../ride-core/src/royale/stanceVolume.ts';
import {footEyeHeight} from './fpsMotion.ts';
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
/** Trace the exact crosshair ray, then converge the authority's physical muzzle
 * on that point. No target attraction, damage prediction or through-cover aim. */
export function fpsAim(p:RidePose,skin:string,yaw:number,pitch:number,blend:number,lean:number,terrain:BattleTerrain,others:readonly {pose:RidePose;skin:string;alive:boolean}[]=[]){
 const scale=skin.startsWith('DS_Mascot_')?.48:1,o={x:p.x,y:p.y+footEyeHeight(scale,p.footCrouch,p.footProne),z:p.z},d={x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};
 let distance=terrain.raycast(o,d,160)??160;
 for(const actor of others){if(!actor.alive)continue;const b=stanceBounds(actor.pose,actor.skin),q=actor.pose;let near=0,far=distance;
  for(const [origin,v,low,high] of [[o.x,d.x,q.x-b.x,q.x+b.x],[o.y,d.y,q.y+b.minY,q.y+b.maxY],[o.z,d.z,q.z-b.z,q.z+b.z]]){if(Math.abs(v)<1e-8){if(origin<low||origin>high){far=-1;break;}}else{const a=(low-origin)/v,z=(high-origin)/v;near=Math.max(near,Math.min(a,z));far=Math.min(far,Math.max(a,z));}}
  if(near<=far&&far>0)distance=Math.min(distance,near);
 }
 distance=Math.max(.8,distance);const target={x:o.x+d.x*distance,y:o.y+d.y*distance,z:o.z+d.z*distance};let aimYaw=angle(yaw-p.headingY),aimPitch=pitch;
 for(let i=0;i<3;i++){const grip=weaponSocket(p,skin,aimYaw,aimPitch,blend,lean).grip;aimYaw=angle(Math.atan2(target.x-grip.x,target.z-grip.z)-p.headingY);aimPitch=Math.atan2(target.y-grip.y,Math.hypot(target.x-grip.x,target.z-grip.z));}
 return {aimYaw:Math.max(-1.25,Math.min(1.25,aimYaw)),aimPitch:Math.max(-.65,Math.min(.65,aimPitch)),distance};
}
