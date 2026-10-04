import {gentleSteering} from './rideComfort.ts';
import {RideController,createPose,type RideActions,type RidePose} from './controller.ts';
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from './terrain.ts';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const BICYCLE={wheelbase:1.09,rear:-.53,front:.56,radius:.34,maxSpeed:8,reverseSpeed:1.1,steering:.55,version:2} as const;
/** Kinematic two-contact bicycle. Uses the host's terrain and obstacle queries. */
export class BicycleController extends RideController {
  cycle=createPose();steeringAngle=0;pedalPhase=0;pedaling=false;travel=0;blocked=false;
  lastBlock?:{x:number;y:number;z:number;heading:number;hit:number|null;groundHeight:number;offCourse:boolean;actors:string[]};
  private bikeSpawn={position:{x:0,y:0,z:0},headingY:0};
  private a=createGroundSample();private b=createGroundSample();
  private reverseHold=0;
  constructor(terrain:TerrainSampler){super(terrain);this.reset();}
  override reset(spawn=this.bikeSpawn){
    if(!this.cycle){super.reset(spawn);return;}
    this.bikeSpawn={position:{...spawn.position},headingY:spawn.headingY};
    Object.assign(this.cycle,createPose(),spawn.position,{headingY:spawn.headingY,stopFoot:1});
    this.steeringAngle=this.travel=this.pedalPhase=this.reverseHold=0;this.pedaling=this.blocked=this.crashed=false;this.lastBlock=undefined;this.contact();
  }
  recoverBike(){this.reset(this.bikeSpawn);}
  private contact(){const p=this.cycle,s=Math.sin(p.headingY),c=Math.cos(p.headingY);
    this.terrain.sampleGround(p.x+s*BICYCLE.rear,p.z+c*BICYCLE.rear,this.a,p.y);
    this.terrain.sampleGround(p.x+s*BICYCLE.front,p.z+c*BICYCLE.front,this.b,p.y);
    p.y=this.a.height+(this.b.height-this.a.height)*(-BICYCLE.rear/BICYCLE.wheelbase);
    p.groundPitch=-Math.atan2(this.b.height-this.a.height,BICYCLE.wheelbase);p.groundRoll=0;
  }
  override step(dt:number,input:RideActions){
    if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1/30);if(input.reset){this.recoverBike();return;}
    const p=this.cycle,t=Number.isFinite(input.throttle)?clamp(input.throttle,-1,1):0,oldSpeed=p.speed;
    this.steeringAngle+=(-gentleSteering(input.steer)*BICYCLE.steering/(1+Math.abs(p.speed)*.065)-this.steeringAngle)*(1-Math.exp(-dt*5.5));
    // Brake to a full stop first. Continuing to pull back then walks the bike
    // backwards slowly, with a foot down and a stationary crank.
    this.reverseHold=t<-.08&&p.speed<=.05?this.reverseHold+dt:0;
    const grade=Math.sin(-p.groundPitch)*9.81;
    if(p.speed<0||this.reverseHold>=.3){
      const target=t<-.08?t*BICYCLE.reverseSpeed:0;
      p.speed+=clamp(target-p.speed,-.9*dt,2.4*dt);
      if(Math.abs(p.speed)<.005)p.speed=0;
    }else p.speed=p.speed<.08&&t<=.08?0:clamp(p.speed+(t>0?t*2.35:t*5.5)*dt-(.13+p.speed*p.speed*.009+grade)*dt,0,BICYCLE.maxSpeed);
    this.pedaling=t>.08&&p.speed>.05&&p.speed<BICYCLE.maxSpeed;
    p.yawRate=p.speed*Math.tan(this.steeringAngle)/BICYCLE.wheelbase;
    const heading=p.headingY+p.yawRate*dt,dx=Math.sin(heading)*p.speed*dt,dz=Math.cos(heading)*p.speed*dt;
    const moving=Math.abs(p.speed)>.005,sign=p.speed<0?-1:1,look=(sign>0?BICYCLE.front:-BICYCLE.rear)+.25+Math.abs(p.speed)*dt;
    const hit=moving?this.terrain.raycastObstacle({x:p.x,y:p.y+.55,z:p.z},{x:Math.sin(heading)*sign,y:0,z:Math.cos(heading)*sign},look,.31):null;
    const lead=sign>0?BICYCLE.front:BICYCLE.rear;
    const ground=this.terrain.sampleGround(p.x+dx+Math.sin(heading)*lead,p.z+dz+Math.cos(heading)*lead,this.b,p.y);
    const actors=this.terrain.navigationObstacles?.(p.x,p.z,4)??[];
    const blockedActor=actors.some(o=>{const x=o.x-p.x,z=o.z-p.z,forward=(x*Math.sin(heading)+z*Math.cos(heading))*sign,side=Math.abs(x*Math.cos(heading)-z*Math.sin(heading));
      // The bounding radius of a long wall can cover open pavement metres away.
      // Static props use the exact physical sweep above; circles are for actors.
      if(o.raycastSolid)return false;
      // A crowd may arrive while we are stopped. Allow movement out of an
      // existing overlap; never allow movement deeper into it.
      if(Math.hypot(x,z)<o.radius+.65&&Math.hypot(x-dx,z-dz)>Math.hypot(x,z)+1e-7)return false;
      return Math.abs(o.y-p.y)<2&&forward>-.15&&forward<look+o.radius&&side<o.radius+.32;});
    this.blocked=moving&&((hit!==null&&hit<look)||ground.offCourse||Math.abs(ground.height-p.y)>.5||blockedActor);
    if(this.blocked){this.lastBlock={x:p.x,y:p.y,z:p.z,heading,hit,groundHeight:ground.height,offCourse:!!ground.offCourse,actors:blockedActor?actors.map(o=>o.id):[]};p.speed=0;p.yawRate=0;}else{p.x+=dx;p.z+=dz;p.headingY=heading;this.travel+=Math.hypot(dx,dz);p.wheelSpin+=p.speed*dt/BICYCLE.radius;}
    if(this.pedaling&&p.speed>.1)this.pedalPhase=(this.pedalPhase+p.speed*dt/(BICYCLE.radius*2.5))%(Math.PI*2);
    this.contact();p.velocityX=Math.sin(p.headingY)*p.speed;p.velocityZ=Math.cos(p.headingY)*p.speed;
    p.rollAngle+=(clamp(-Math.atan(p.speed*p.yawRate/9.81),-.38,.38)-p.rollAngle)*(1-Math.exp(-dt*8));
    p.stopFoot+=(p.speed<.2?1-p.stopFoot:-p.stopFoot)*(1-Math.exp(-dt*7));p.reverseBlend=p.speed<-.05?1:0;p.riderRoll=p.rollAngle;p.riderPitch+=((clamp((p.speed-oldSpeed)/Math.max(dt,.001),-5,3)*.045+p.speed*.009)-p.riderPitch)*(1-Math.exp(-dt*5));p.driveIntent=t;p.turnIntent=input.steer;p.brakeAmount=p.speed<0?Math.max(0,t):Math.max(0,-t);p.motorLoad=0;p.bodyBob=0;
    p.lateralAcceleration=p.speed*p.yawRate;p.weightShift=(p.speed-oldSpeed)/Math.max(dt,.001)*.015;
  }
  override writePose(out:RidePose){Object.assign(out,this.cycle??createPose());}
  moveReadiness(_id:number){return 'Bicycle: pedal, coast and brake. EUC hops and tricks are unavailable.';}
  override snapshot(){const base=super.snapshot();if(!this.cycle)return base;const p=this.cycle;return {...base,speed:p.speed,speedKph:p.speed*3.6,position:{x:p.x,y:p.y,z:p.z},headingY:p.headingY,riderPitch:p.riderPitch,rollAngle:p.rollAngle,grounded:true,crashed:false,crouchCharge:0,distanceTravelled:this.travel,hops:0,landings:0,crashes:0,spins:0,velocity:{x:p.velocityX,y:0,z:p.velocityZ},vehicle:'bicycle',state:this.blocked?'blocked':p.speed<-.05?'reversing':p.speed<.1?'stopped':p.brakeAmount>0?'braking':this.pedaling?'pedaling':'coasting'};}
  bikeObstacle(id:string):NavigationObstacle {const p=this.cycle;return {id,x:p.x,y:p.y,z:p.z,radius:.65,height:1.8,kind:'cyclist',vx:p.velocityX,vz:p.velocityZ};}
}
