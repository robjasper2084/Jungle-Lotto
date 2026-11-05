import type {RidePose} from '../controller.ts';
import type {TerrainSampler,Vec3} from '../terrain.ts';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function footEyeHeight(scale:number,crouch:number,prone:number){return ((1.64-.42*clamp(crouch))*(1-clamp(prone))+.46*clamp(prone))*scale;}
/** Match the captured whole-body lean's stance and locomotion mask. */
export function footLeanWeight(p:Partial<RidePose>){
 if(p.footMode!==2||p.footJump||(p.footProne??0)>.1||(p.airBlend??0)>.05||(p.crashBlend??0)>.05)return 0;
 const t=clamp((Math.abs(p.speed??0)-2)/1.5);return 1-t*t*(3-2*t);
}
/** Positive input means screen-right. Riders face +Z, so right is local -X. */
export function footLeanOffset(p:Partial<RidePose>,lean:number,scale=1){
 const amount=Math.max(-1,Math.min(1,lean))*footLeanWeight(p);
 return {side:-.30*amount*scale,down:-.035*Math.abs(amount)*scale,roll:.12*amount};
}
export function combatFootEye(p:RidePose,scale:number,lean:number,terrain?:Pick<TerrainSampler,'raycastObstacle'>):Vec3{
 const offset=footLeanOffset(p,lean,scale),base={x:p.x,y:p.y+footEyeHeight(scale,p.footCrouch,p.footProne),z:p.z};
 const delta={x:Math.cos(p.headingY)*offset.side,y:offset.down,z:-Math.sin(p.headingY)*offset.side},length=Math.hypot(delta.x,delta.y,delta.z);
 let weight=1;
 if(terrain&&length>.00001){const hit=terrain.raycastObstacle(base,{x:delta.x/length,y:delta.y/length,z:delta.z/length},length,.08*scale);if(hit!==null)weight=clamp((hit-.025*scale)/length);}
 return {x:base.x+delta.x*weight,y:base.y+delta.y*weight,z:base.z+delta.z*weight};
}
/** Host-side wall clearance uses both the head and weapon height. */
export function limitCombatLean(p:RidePose,skin:string,requested:number,terrain:Pick<TerrainSampler,'raycastObstacle'>){
 requested=Math.max(-1,Math.min(1,requested));if(!p.footMode)return requested;
 if(!footLeanWeight(p))return 0;
 const scale=skin.startsWith('DS_Mascot_')?.48:1,offset=footLeanOffset(p,requested,scale),length=Math.abs(offset.side);
 if(length<.00001)return requested;
 const side=Math.sign(offset.side),direction={x:Math.cos(p.headingY)*side,y:0,z:-Math.sin(p.headingY)*side};let weight=1;
 for(const height of [footEyeHeight(scale,p.footCrouch,p.footProne),(1.23-.34*p.footCrouch)*scale]){
  const hit=terrain.raycastObstacle({x:p.x,y:p.y+height,z:p.z},direction,length,.12*scale);
  if(hit!==null)weight=Math.min(weight,clamp((hit-.025*scale)/length));
 }
 return requested*weight;
}
