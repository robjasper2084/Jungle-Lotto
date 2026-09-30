import type {RidePose} from './controller.ts';
import {clamp} from './rideDynamics.ts';
/** Flat-screen body-mounted view. Head position already follows the animated rig. */
export function firstPersonMotion(p:RidePose,reducedMotion=false){
 const amount=reducedMotion?.18:1;
 return {pitch:clamp(-p.riderPitch*.65-p.landingCompression*.075+p.takeoffExtension*.04,-.22,.22)*amount,roll:clamp(-p.rollAngle*.65,-.28,.28)*amount};
}
