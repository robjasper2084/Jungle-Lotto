import type {GroundSample,Vec3} from './terrain.ts';

/** Fit each shoe to its own contact plane without dragging the pelvis down
 * when the other shoe is still on the lower side of a curb. */
export function supportedFootHeight(target:Vec3,hip:Vec3,ground:GroundSample|undefined,rootY:number,legLength:number,scale:number){
 if(!ground||ground.offCourse||!Number.isFinite(ground.height)||ground.normal.y<.55)return target.y;
 const delta=ground.height-rootY;
 // A roof or a different bridge deck is not this foot's support surface.
 if(Math.abs(delta)>.45*Math.max(.6,scale))return target.y;
 const offset=Math.max(-.25*scale,Math.min(.25*scale,delta));
 const horizontal=(hip.x-target.x)**2+(hip.z-target.z)**2,reach=legLength*.985;
 const lowest=hip.y-Math.sqrt(Math.max(0,reach*reach-horizontal))-.025*scale;
 return Math.max(target.y+offset,Math.min(target.y,lowest));
}
