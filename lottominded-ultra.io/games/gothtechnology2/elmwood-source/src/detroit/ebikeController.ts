import {BicycleController} from '@digital-static/ridecore/cycling';
import {createPose,createGroundSample,type TerrainSampler,type RideActions,type RidePose} from '@digital-static/ridecore';
import {EBIKES,type EbikeProfile} from './electricVehicles.ts';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v)),damp=(v:number,t:number,r:number,dt:number)=>t+(v-t)*Math.exp(-r*dt);
/** SI motor force, two tire contacts, traction-limited steering and swept scenery contact. */
export class EbikeController extends BicycleController {
 profile:EbikeProfile;private motoSpawn={position:{x:0,y:0,z:0},headingY:0};private front=createGroundSample();private rear=createGroundSample();private next=createGroundSample();private reverseTimer=0;private drive=0;
 constructor(terrain:TerrainSampler,profile:EbikeProfile=EBIKES[0]){super(terrain);this.profile=profile;this.reset();}
 override reset(spawn=this.motoSpawn){if(!this.profile){super.reset(spawn);return;}this.motoSpawn={position:{...spawn.position},headingY:spawn.headingY};Object.assign(this.cycle,createPose(),spawn.position,{headingY:spawn.headingY});this.drive=this.reverseTimer=this.steeringAngle=this.pedalPhase=this.travel=0;this.blocked=this.crashed=this.pedaling=false;this.contacts(0,true);}
 override recoverBike(){this.reset(this.motoSpawn);}
 private contacts(dt:number,immediate=false){const p=this.cycle,f=this.profile,s=Math.sin(p.headingY),c=Math.cos(p.headingY);this.terrain.sampleGround(p.x-s*f.wheelbase/2,p.z-c*f.wheelbase/2,this.rear,p.y);this.terrain.sampleGround(p.x+s*f.wheelbase/2,p.z+c*f.wheelbase/2,this.front,p.y);const y=(this.rear.height+this.front.height)/2,rate=12+(.31-f.suspension)*20;p.suspensionOffset=clamp(p.y-y,-f.suspension*.3,f.suspension*.2);p.y=immediate?y:damp(p.y,y,rate,dt);p.groundPitch=damp(p.groundPitch,-Math.atan2(this.front.height-this.rear.height,f.wheelbase),10,dt);}
 override step(dt:number,input:RideActions){if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1/30);if(input.reset){this.recoverBike();return;}const p=this.cycle,f=this.profile,old=p.speed,t=Number.isFinite(input.throttle)?clamp(input.throttle,-1,1):0,steer=Number.isFinite(input.steer)?clamp(input.steer,-1,1):0;const mass=f.mass+80,rough=['grass','dirt','gravel','sand'].includes(this.front.surface),grip=this.front.surface==='ice'?.15:rough?f.grip*.65:f.grip;
 const desired=-steer*(.8+.2*steer*steer)*f.steering/(1+Math.abs(p.speed)*.085);this.steeringAngle=damp(this.steeringAngle,desired,f.steerResponse,dt);
 this.reverseTimer=t<-.08&&p.speed<.04?this.reverseTimer+dt:0;
 const motor=Math.min(f.torque/f.rearRadius/mass,f.peakWatts*.90/Math.max(3,Math.abs(p.speed))/mass,f.acceleration)*Math.max(0,t);
 this.drive=damp(this.drive,motor,8,dt);const resistance=(p.speed>.02?.09:0)+p.speed*Math.abs(p.speed)*.32/mass+(rough?p.speed*.10:0),grade=Math.sin(-p.groundPitch)*9.81;
 if(p.speed<0||this.reverseTimer>.6)p.speed=damp(p.speed,t<-.08?-1.0:0,3,dt);else if(p.speed<.025&&t<=.08)p.speed=0;else {const brake=t<0?-t*f.braking:!t?f.regen:0;p.speed=clamp(p.speed+(this.drive-brake-resistance-grade)*dt,0,f.topKph/3.6);}
 const yaw=p.speed*Math.tan(this.steeringAngle)/f.wheelbase,lateral=9.81*grip;p.yawRate=clamp(yaw,-lateral/Math.max(.5,Math.abs(p.speed)),lateral/Math.max(.5,Math.abs(p.speed)));const heading=p.headingY+p.yawRate*dt,sign=p.speed<0?-1:1,dx=Math.sin(heading)*p.speed*dt,dz=Math.cos(heading)*p.speed*dt,look=f.wheelbase/2+.25+Math.hypot(dx,dz),moving=Math.abs(p.speed)>.003;
 const hit=moving?this.terrain.raycastObstacle({x:p.x,y:p.y+.56,z:p.z},{x:Math.sin(heading)*sign,y:0,z:Math.cos(heading)*sign},look,.31):null;
 const ground=this.terrain.sampleGround(p.x+dx,p.z+dz,this.next,p.y);
 // Group riders may pass through each other. Static walls and scenery remain solid.
 const blockedPerson=(this.terrain.navigationObstacles?.(p.x,p.z,look+2)??[]).some(o=>{if(o.raycastSolid||['cyclist','rider','dog'].includes(o.kind)||Math.abs(o.y-p.y)>2)return false;const x=o.x-p.x,z=o.z-p.z,forward=(x*Math.sin(heading)+z*Math.cos(heading))*sign,side=Math.abs(x*Math.cos(heading)-z*Math.sin(heading));return forward>.1&&forward<look+o.radius&&side<o.radius+.28&&!(Math.hypot(x,z)<o.radius+.6&&Math.hypot(x-dx,z-dz)>Math.hypot(x,z));});
 this.blocked=moving&&(hit!==null&&hit<look||ground.offCourse||Math.abs(ground.height-p.y)>.55||blockedPerson);
 if(this.blocked){p.speed=p.yawRate=0;this.drive=0;this.lastBlock={x:p.x,y:p.y,z:p.z,heading,hit,groundHeight:ground.height,offCourse:ground.offCourse,actors:blockedPerson?['pedestrian']:[]};}else{p.x+=dx;p.z+=dz;p.headingY=heading;this.travel+=Math.hypot(dx,dz);p.wheelSpin+=p.speed*dt/f.rearRadius;}
 this.contacts(dt);p.velocityX=Math.sin(p.headingY)*p.speed;p.velocityZ=Math.cos(p.headingY)*p.speed;p.rollAngle=damp(p.rollAngle,clamp(-Math.atan2(p.speed*p.yawRate,9.81),-.65,.65),f.steerResponse,dt);p.riderRoll=p.rollAngle;p.riderPitch=damp(p.riderPitch,clamp((p.speed-old)/dt*.025,-.16,.20),6,dt);p.stopFoot=damp(p.stopFoot,Math.abs(p.speed)<.18?1:0,8,dt);p.driveIntent=t;p.turnIntent=steer;p.brakeAmount=Math.max(0,-t);p.motorLoad=clamp(this.drive/f.acceleration,0,1);p.weightShift=clamp((p.speed-old)/dt*.013,-.1,.1);p.lateralAcceleration=p.speed*p.yawRate;this.pedaling=false;
 }
 override snapshot(){return {...super.snapshot(),vehicle:'electric-moto',model:this.profile.id,topSpeedKph:this.profile.topKph,state:this.blocked?'blocked':this.cycle.speed<.1?'stopped':this.cycle.brakeAmount?'braking':'riding'};}
 override writePose(out:RidePose){Object.assign(out,this.cycle);}
}
