import {createGroundSample,type TerrainSampler} from './terrain.ts';

export const FOOT_SPEED={walk:2.35,run:5.4,reverse:2.05,reverseRun:3.8} as const;
export const footFields=()=>({footMode:0,footBlend:0,footPhase:0,footCycle:0,footTime:0,footJump:0,footCrouch:0,footProne:0,parkX:0,parkY:0,parkZ:0,parkHeading:0});
export type FootPose=ReturnType<typeof footFields>&{x:number;y:number;z:number;headingY:number;speed:number;airHeight:number;airBlend:number;velocityX:number;velocityZ:number;rollAngle:number;groundPitch:number;groundRoll:number;stopFoot:number};
export const footState=()=>({mode:0,age:0,latch:false,jumpLatch:false,vy:0,turn:0,fromX:0,fromY:0,fromZ:0,fromHeading:0,toX:0,toY:0,toZ:0,phase:0,time:0,land:0});
export type FootActions={throttle:number;steer:number;hop?:boolean;hopHeld?:boolean;crouch?:boolean;prone?:boolean;run?:boolean;dismount?:boolean};
export function interpolateFoot(a:ReturnType<typeof footFields>,b:ReturnType<typeof footFields>,t:number,out:ReturnType<typeof footFields>){
 out.footMode=b.footMode;out.footJump=b.footJump;
 for(const key of ['parkX','parkY','parkZ','parkHeading'] as const)out[key]=b[key];
 const phase=b.footPhase-a.footPhase;out.footPhase=(a.footPhase+(phase-Math.round(phase))*t+1)%1;
 if(!b.footMode)out.footBlend=0;
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const ease=(n:number)=>{n=clamp(n,0,1);return n*n*(3-2*n);};
const angle=(n:number)=>Math.atan2(Math.sin(n),Math.cos(n));
export function footLabel(p:Partial<FootPose>){
 if(!p.footMode)return Math.abs(p.speed??0)>1?'Slow to get off':'Get off wheel';
 if(p.footMode===1)return 'Getting off…';if(p.footMode===3)return 'Getting on…';
 const d=Math.hypot(p.x!-p.parkX!,p.z!-p.parkZ!);return d>1.3?'Wheel · '+Math.ceil(d)+' m':'Get on wheel';
}
/** Fixed-step, serializable movement. Only inputs cross the network; the authority
 * chooses the parking spot, collision sweep, jump trajectory and mount distance. */
export function stepOnFoot(s:ReturnType<typeof footState>,p:FootPose,t:TerrainSampler,dt:number,a:FootActions,crashed=false){
 const toggle=!!a.dismount&&!s.latch;s.latch=!!a.dismount;
 const jump=!!(a.hop||a.hopHeld)&&!s.jumpLatch;s.jumpLatch=!!(a.hop||a.hopHeld);
 const ground=createGroundSample();
 const clear=(x:number,y:number,z:number,nx:number,ny:number,nz:number)=>{
  const dx=nx-x,dz=nz-z,d=Math.hypot(dx,dz);if(d<1e-7)return true;
  const low=p.footProne>.5,heights=low?[.25,.45]:p.footCrouch>.5?[.4,.85]:[.45,1.2];
  const offsets=low?[-.75,0,.65]:[0];
  return offsets.every(offset=>heights.every(h=>{const hit=t.raycastObstacle({x:x+Math.sin(p.headingY)*offset,y:Math.min(y,ny)+h,z:z+Math.cos(p.headingY)*offset},{x:dx/d,y:0,z:dz/d},d+.3,.27);return hit===null||hit>d+.27;}));
 };
 if(toggle&&!s.mode&&!crashed&&Math.abs(p.speed)<=1&&p.airHeight<.04){
  // Try both sides; never dismount inside a wall or over a drop.
  for(const side of [1,-1]){
   const x=p.x+Math.cos(p.headingY)*.68*side,z=p.z-Math.sin(p.headingY)*.68*side;
   t.sampleGround(x,z,ground,p.y);
   if(ground.offCourse||Math.abs(ground.height-p.y)>.3||!clear(p.x,p.y,p.z,x,ground.height,z))continue;
   Object.assign(s,{mode:1,age:0,fromX:p.x,fromY:p.y,fromZ:p.z,fromHeading:p.headingY,toX:x,toY:ground.height,toZ:z,vy:0});
   Object.assign(p,{parkX:p.x,parkY:p.y,parkZ:p.z,parkHeading:p.headingY,speed:0});break;
  }
 }else if(toggle&&s.mode===2&&p.airHeight<.04&&Math.hypot(p.x-p.parkX,p.z-p.parkZ)<=1.3&&Math.abs(p.y-p.parkY)<.3&&clear(p.x,p.y,p.z,p.parkX,p.parkY,p.parkZ)){
  Object.assign(s,{mode:3,age:0,fromX:p.x,fromY:p.y,fromZ:p.z,fromHeading:p.headingY,toX:p.parkX,toY:p.parkY,toZ:p.parkZ,vy:0});
 }
 if(!s.mode){p.footMode=p.footBlend=p.footCrouch=p.footProne=0;return false;}
 s.time+=dt;p.footTime=s.time;p.footMode=s.mode;
 p.stopFoot=p.rollAngle=p.groundPitch=p.groundRoll=0;p.velocityX=p.velocityZ=0;
 if(s.mode===1||s.mode===3){
  s.age+=dt;const f=ease(s.age/.7);p.x=s.fromX+(s.toX-s.fromX)*f;p.y=s.fromY+(s.toY-s.fromY)*f;p.z=s.fromZ+(s.toZ-s.fromZ)*f;
  p.headingY=s.fromHeading+angle(p.parkHeading-s.fromHeading)*f;p.footBlend=s.mode===1?f:1-f;p.speed=p.airHeight=p.airBlend=p.footJump=0;
  if(s.age>=.7){s.mode=s.mode===1?2:0;p.footMode=s.mode;p.footBlend=s.mode?1:0;}
  return true;
 }
 p.footBlend=1;
 const beforeX=p.x,beforeZ=p.z,run=!!a.run,demand=clamp(Number.isFinite(a.throttle)?a.throttle:0,-1,1);
 let prone=!!a.prone&&!jump,crouch=!!a.crouch&&!prone&&!jump;
 if(!prone&&!crouch&&(p.footProne>.1||p.footCrouch>.1)&&t.raycastObstacle({x:p.x,y:p.y+.25,z:p.z},{x:0,y:1,z:0},1.45,.27)!==null){prone=p.footProne>.1;crouch=!prone;}
 p.footProne+=((prone?1:0)-p.footProne)*(1-Math.exp(-8*dt));p.footCrouch+=((crouch?1:0)-p.footCrouch)*(1-Math.exp(-10*dt));
 s.turn+=(clamp(Number.isFinite(a.steer)?a.steer:0,-1,1)*2.7-s.turn)*(1-Math.exp(-16*dt));
 p.headingY-=s.turn*dt;
 const limit=prone||p.footProne>.3?(demand<0?.55:.75):crouch||p.footCrouch>.3?(demand<0?1.1:1.4):demand<0?(run?FOOT_SPEED.reverseRun:FOOT_SPEED.reverse):(run?FOOT_SPEED.run:FOOT_SPEED.walk);
 const target=demand*limit,braking=Math.abs(target)<Math.abs(p.speed)||target*p.speed<0;
 p.speed+=(target-p.speed)*(1-Math.exp(-(braking?15:9)*dt));if(Math.abs(p.speed)<.002)p.speed=0;
 const x=p.x+Math.sin(p.headingY)*p.speed*dt,z=p.z+Math.cos(p.headingY)*p.speed*dt;
 t.sampleGround(x,z,ground,p.y-p.airHeight);
 if(!ground.offCourse&&ground.height<=p.y+.34&&clear(p.x,p.y,p.z,x,p.y,z)){p.x=x;p.z=z;}else p.speed=0;
 t.sampleGround(p.x,p.z,ground,p.y-p.airHeight);
 if(jump&&p.airHeight<.02&&s.vy<=0&&p.footProne<.15&&p.footCrouch<.15){s.vy=4.4;s.land=0;}
 s.vy-=13*dt;const nextY=p.y+s.vy*dt;
 if(s.vy>0&&t.raycastObstacle({x:p.x,y:p.y+1.55,z:p.z},{x:0,y:1,z:0},Math.max(.05,nextY-p.y+.2),.25)!==null)s.vy=0;
 p.y=Math.max(ground.height,p.y+s.vy*dt);
 if(p.y<=ground.height+.001){if(s.vy<-1)s.land=.22;s.vy=0;}
 s.land=Math.max(0,s.land-dt);p.airHeight=Math.max(0,p.y-ground.height);p.airBlend=p.airHeight>.01?1:0;
 p.footJump=p.airHeight>.01?(s.vy>0?1:2):s.land>0?3:0;
 p.velocityX=(p.x-beforeX)/dt;p.velocityZ=(p.z-beforeZ)/dt;
 // Continuous cycle count allows differently sized rigs to fit cadence without
 // a discontinuity whenever the human-sized cycle wraps. Advance by actual travel.
 const stride=1.65+(3.6-1.65)*ease((Math.abs(p.speed)-2.35)/3.05);
 s.phase+=Math.hypot(p.x-beforeX,p.z-beforeZ)/stride;
 p.footCycle=s.phase;p.footPhase=s.phase%1;
 return true;
}
