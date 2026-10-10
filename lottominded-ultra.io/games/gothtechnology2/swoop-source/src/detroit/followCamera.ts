import {clearCameraBoom} from './cameraSafety.ts';
import type {RidePose} from './controller.ts';
import {fallCameraOffset} from './fallMotion.ts';
import {underpassCameraHeight} from './cameraClearance.ts';
import type {TerrainSampler} from './terrain.ts';
import {createGroundSample} from './terrain.ts';
import {advanceSpring,spring,damp} from './rideDynamics.ts';
type Point={x:number;y:number;z:number};
/** Preserve enough horizontal framing for the rider and nearby companion on phones. */
export function chaseFrameFov(vertical:number,aspect:number){return Math.min(95,Math.max(vertical,2*Math.atan(Math.tan(Math.PI/8)/Math.max(.3,aspect))*180/Math.PI));}
const axes=['x','y','z'] as const;
/** Critically damped chase rig: turn anticipation, travel lead, impact isolation and collision clearance. */
export class FollowCamera {
  world:TerrainSampler;
  eye:Point={x:0,y:2,z:5};target:Point={x:0,y:1,z:0};
  fov=55;roll=0;impact=0;
  private previousEye:Point={x:0,y:2,z:5};private previousTarget:Point={x:0,y:1,z:0};private previousRoll=0;private previousFov=55;
  readonly frame={eye:{x:0,y:2,z:5},target:{x:0,y:1,z:0},roll:0,fov:55};
  sample(alpha:number){const t=Math.max(0,Math.min(1,alpha));for(const k of axes){this.frame.eye[k]=this.previousEye[k]+(this.eye[k]-this.previousEye[k])*t;this.frame.target[k]=this.previousTarget[k]+(this.target[k]-this.previousTarget[k])*t;}this.frame.roll=this.previousRoll+(this.roll-this.previousRoll)*t;this.frame.fov=this.previousFov+(this.fov-this.previousFov)*t;return this.frame;}
  distance=4.3;calm=false;
  private ground=createGroundSample();
  private eyeSpring={x:spring(),y:spring(),z:spring()};
  private targetSpring={x:spring(),y:spring(),z:spring()};
  constructor(world:TerrainSampler){this.world=world;}
  reset(p:RidePose){
    this.target={x:p.x,y:p.y+1.05,z:p.z};this.eye={x:p.x-Math.sin(p.headingY)*4.3,y:p.y+2.2,z:p.z-Math.cos(p.headingY)*4.3};
    this.eye.y=Math.min(underpassCameraHeight(this.world,p,this.eye.y),underpassCameraHeight(this.world,this.eye,this.eye.y,p.y));
    this.impact=0;this.roll=0;this.fov=55;Object.assign(this.previousEye,this.eye);Object.assign(this.previousTarget,this.target);this.previousRoll=this.roll;this.previousFov=this.fov;
    for(const k of axes){Object.assign(this.eyeSpring[k],{value:this.eye[k],velocity:0});Object.assign(this.targetSpring[k],{value:this.target[k],velocity:0});}
  }
  landing(impact:number){this.impact=Math.min(.14,impact*.013);}
  step(dt:number,p:RidePose){
    Object.assign(this.previousEye,this.eye);Object.assign(this.previousTarget,this.target);this.previousRoll=this.roll;this.previousFov=this.fov;
    const speed=Math.abs(p.speed),distance=this.distance+Math.min(2,speed*.1);
    // Keep the landing zone in view during an air rotation.
    const velocity=Math.hypot(p.velocityX,p.velocityZ);
    const travel=velocity>.3?Math.atan2(p.velocityX,p.velocityZ):p.headingY;
    const heading=p.airBlend>.5?travel+(p.speed<0?Math.PI:0):p.headingY+p.yawRate*.1;
    const s=Math.sin(heading),c=Math.cos(heading),lead=Math.min(1.8,speed*.09);
    const fall=fallCameraOffset(p);
    const desired={x:p.x+Math.sin(travel)*lead+fall.x,y:p.y+1.08-p.landingCompression*.04+fall.y,z:p.z+Math.cos(travel)*lead+fall.z};
    for(const k of axes)this.target[k]=advanceSpring(this.targetSpring[k],desired[k],18,dt);
    this.impact=damp(this.impact,0,11,dt);
    const wanted={x:p.x-s*distance+fall.x,y:p.y+2.25+distance*.05-this.impact,z:p.z-c*distance+fall.z};
    wanted.y=Math.min(underpassCameraHeight(this.world,p,wanted.y),underpassCameraHeight(this.world,wanted,wanted.y,p.y));
    clearCameraBoom(wanted,this.target,(o,d,max)=>this.world.raycast(o,d,max),this.world.sampleGround(wanted.x,wanted.z,this.ground,p.y).height);
    for(const k of axes)this.eye[k]=advanceSpring(this.eyeSpring[k],wanted[k],k==='y'?11:14,dt);
    const ex=this.eye.x,ey=this.eye.y,ez=this.eye.z;
    clearCameraBoom(this.eye,this.target,(o,d,max)=>this.world.raycast(o,d,max),this.world.sampleGround(this.eye.x,this.eye.z,this.ground,p.y).height);
    if(ex!==this.eye.x||ey!==this.eye.y||ez!==this.eye.z)for(const k of axes){this.eyeSpring[k].value=this.eye[k];this.eyeSpring[k].velocity=0;}
    const floor=this.world.sampleGround(this.eye.x,this.eye.z,this.ground,p.y).height+.35;
    if(this.eye.y<floor){this.eye.y=floor;this.eyeSpring.y.value=floor;this.eyeSpring.y.velocity=Math.max(0,this.eyeSpring.y.velocity);}
    const ceiling=Math.min(underpassCameraHeight(this.world,p,this.eye.y),underpassCameraHeight(this.world,this.eye,this.eye.y,p.y));
    if(this.eye.y>ceiling){this.eye.y=ceiling;this.eyeSpring.y.value=ceiling;this.eyeSpring.y.velocity=Math.min(0,this.eyeSpring.y.velocity);}
    this.fov=damp(this.fov,this.calm?55:55+Math.min(12,speed*.6),5,dt);
    this.roll=damp(this.roll,this.calm?0:-p.rollAngle*.055,7,dt);
  }
}
