import {actorContact,isCharacter} from './actorAvoidance.ts';
import {FallMotion,getUpPose} from './fallMotion.ts';
import {safeRecovery,DEFAULT_MOUNTED_VOLUME,type MountedVolume,type RideSpawn} from './recovery.ts';
import {RideFeedback} from './rideFeedback.ts';
import {SpecialMoves} from './specialMoves.ts';
import {BalanceEngine} from './balanceEngine.ts';
import {NaturalMotionEngine} from './naturalMotion.ts';
import {createGroundSample} from './terrain.ts';
import type {TerrainSampler,Vec3,ActorImpact,NavigationObstacle} from './terrain.ts';
import {RIDE_TUNING as tune,clamp,damp,angle,spring,advanceSpring,advanceDrive} from './rideDynamics.ts';

export const NEUTRAL_ACTIONS={throttle:0,steer:0,crouch:false,hop:false,hopHeld:false,reset:false,trick:0};
export type RideActions=typeof NEUTRAL_ACTIONS & {seated?:boolean};
export function createPose(){return {
  seated:0,stopFoot:0,stopFootX:0,stopFootY:0,stopFootZ:0,warningLevel:0,beepPulse:0,scrape:0,scrapeSide:0,scrapeX:0,scrapeY:0,scrapeZ:0,scrapeHard:0,
  trickFoot:0,x:0,y:0,z:0,headingY:0,speed:0,wheelSpin:0,groundPitch:0,groundRoll:0,
  rollAngle:0,riderRoll:0,riderPitch:0,wheelPitch:0,suspensionOffset:0,
  crouch:0,tuck:0,attack:0,carveStance:0,technicalTurn:0,riderTurnTwist:0,riderLookYaw:0,
  reverseBlend:0,restFactor:0,airBlend:0,airHeight:0,wobble:0,wobbleSway:0,wobbleFight:0,wobbleYaw:0,wobbleRoll:0,
  crashMotion:0,crashContact:0,crashReach:0,crashAbsorb:0,crashCurl:0,crashHeadTuck:0,crashStagger:0,crashSide:0,crashDirection:0,crashBrace:0,crashRelease:0,crashSettle:0,crashLegTuck:0,crashImpactPulse:0,wheelCrashForward:0,wheelCrashLateral:0,crashBlend:0,crashLateral:0,crashDrop:0,crashForward:0,crashTumble:0,crashRoll:0,
  wheelCrashPop:0,wheelCrashSpin:0,wheelCrashLean:0,crashRecovery:0,
  velocityX:0,velocityZ:0,yawRate:0,turnIntent:0,brakeAmount:0,landingCompression:0,
  takeoffExtension:0,landingAnticipation:0,bodyBob:0,motorLoad:0,tiltback:0,slipAngle:0,rollVelocity:0,
  weightShift:0,lateralAcceleration:0,tractionUsage:0,driveIntent:0,hipSway:0,balanceReach:0,
  naturalMotion:0,terrainBend:0,hopPreload:0,bodyDrop:.08,bodyShift:0,bodyPitch:.10,bodyLateral:0,bodyHipTilt:0,
  bodyChestRoll:0,bodyHeadRoll:0,bodyTwist:0,bodyLook:0,
  bodyHipYaw:0,armBank:0,armSwing:0,shoulderL:0,shoulderR:0,
  handLX:0,handLY:0,handLZ:0,handRX:0,handRY:0,handRZ:0,wristL:0,wristR:0,
};}
export type RidePose=ReturnType<typeof createPose>;
export function copyPose(from:RidePose,to:RidePose){Object.assign(to,from);}
export function lerpPose(a:RidePose,b:RidePose,t:number,out:RidePose){const f=clamp(t,0,1);for(const key of Object.keys(a) as (keyof RidePose)[])out[key]=a[key]+(b[key]-a[key])*f;}
type Spawn={position:Vec3;headingY:number};

/** Original Motion 4: jerk-limited motor, bank-led steering and articulated body at 120 Hz. */
export class RideController {
  terrain:TerrainSampler;
  wheelScale=.86;
  mountedVolume:MountedVolume={...DEFAULT_MOUNTED_VOLUME};
  private recoveryAge=0;
  private recoveryPose:RidePose|undefined;private recoveryDuration=0;
  private pose=createPose();private ground=createGroundSample();private ahead=createGroundSample();
  private spawn:Spawn={position:{x:0,y:0,z:0},headingY:Math.PI};private safe:Spawn=this.spawn;
  private velocityY=0;private vx=0;private vz=0;private acceleration=0;
  private motor=0;private charge=0;private brakeLatch=false;private reverseReady=false;
  private balance=new BalanceEngine();private pitch=spring();private suspension=spring();private hip=spring();private arms=spring();
  private naturalMotion=new NaturalMotionEngine();
  private feedback=new RideFeedback();
  private stoppedFor=0;
  readonly tricks=new SpecialMoves();
  private grounded=true;private groundAge=0;private hopQueue=0;private hopDown=false;
  private hopWindup=0;private pendingCharge=0;
  private crashAge=0;private fallMotion:FallMotion|undefined;private flightYaw=0;private distance=0;private idlePhase=0;
  private counts={hops:0,landings:0,crashes:0,spins:0};
  crashed=false;crashCause='';groundClearance=0;touchedDown=false;
  lastLandingImpact=0;lastLandingQuality='clean';lastHopCharge=0;
  constructor(terrain:TerrainSampler,options?:{spawn:Spawn}){this.terrain=terrain;this.reset(options?.spawn);}
  reset(spawn:Spawn=this.spawn){
    this.spawn={position:{...spawn.position},headingY:spawn.headingY};this.safe=this.spawn;
    this.pose=createPose();Object.assign(this.pose,this.spawn.position,{headingY:spawn.headingY});
    this.pose.y=this.terrain.sampleGround(this.pose.x,this.pose.z,this.ground,this.pose.y).height;
    this.velocityY=this.vx=this.vz=this.acceleration=this.charge=this.motor=this.crashAge=this.distance=this.idlePhase=0;
    this.balance=new BalanceEngine();this.pitch=spring();this.suspension=spring();this.hip=spring();this.arms=spring();
    this.naturalMotion=new NaturalMotionEngine();this.feedback=new RideFeedback();this.tricks.reset();
    this.stoppedFor=0;this.recoveryAge=0;this.recoveryPose=undefined;
    this.hopWindup=this.pendingCharge=0;this.fallMotion=undefined;
    this.counts={hops:0,landings:0,crashes:0,spins:0};this.grounded=true;this.crashed=false;this.crashCause='';
    this.groundClearance=0;this.touchedDown=false;this.groundAge=0;this.hopQueue=0;this.hopDown=false;
    this.brakeLatch=false;this.reverseReady=false;this.lastLandingImpact=0;this.lastHopCharge=0;this.lastLandingQuality='clean';
  }
  private fall(reason:string,impact?:ActorImpact){if(this.crashed)return;this.crashed=true;this.crashCause=reason;this.counts.crashes++;this.crashAge=0;this.fallMotion=new FallMotion(this.pose,reason,tune.wheelRadius*this.wheelScale,impact);this.charge=this.hopQueue=this.hopWindup=this.pendingCharge=this.motor=0;this.pose.driveIntent=0;this.tricks.cancel();}
  receiveImpact(impact:ActorImpact){
    if(!Number.isFinite(impact.speed+impact.vx+impact.vz)||impact.speed<2.2||this.crashed||this.recoveryPose)return false;
    this.fall('collision',impact);return true;
  }
  /** The reserved fallen envelope follows both body and wheel, not an invisible upright rider. */
  obstacle(id:string):NavigationObstacle{
    const p=this.pose,s=Math.sin(p.headingY),c=Math.cos(p.headingY),l=p.crashLateral,f=p.crashForward,fallen=this.crashed||!!this.recoveryPose;
    return {id,x:p.x+c*l+s*f,y:p.y,z:p.z-s*l+c*f,radius:fallen?.8:this.mountedVolume.radius,height:this.mountedVolume.height,kind:'rider',vx:fallen?0:this.vx,vz:fallen?0:this.vz,fallen,onImpact:impact=>{this.receiveImpact(impact);}};
  }
  obstacles(id:string){const body=this.obstacle(id);if(!body.fallen)return [body];const p=this.pose,s=Math.sin(p.headingY),c=Math.cos(p.headingY);return [body,{id:id+'-wheel',x:p.x+c*p.wheelCrashLateral+s*p.wheelCrashForward,y:p.y,z:p.z-s*p.wheelCrashLateral+c*p.wheelCrashForward,radius:.33,height:.45,kind:'wheel',vx:0,vz:0}];}
  recover(preferred:RideSpawn=this.safe){
    const candidate=safeRecovery(this.terrain,preferred,this.mountedVolume);if(!candidate)return false;
    this.terrain.reserveRecoverySpace?.(candidate.position,this.mountedVolume.radius,this.mountedVolume.height);
    const rest=this.crashed?{...this.pose}:undefined,severity=this.fallMotion?.severity??0;
    const counts={...this.counts},distance=this.distance,origin=this.spawn;this.reset(candidate);this.spawn=origin;this.counts=counts;this.distance=distance;this.recoveryAge=.18;
    if(rest){
      this.recoveryDuration=1.6+severity*.8;this.recoveryAge=this.recoveryDuration;
      this.recoveryPose={...rest,...candidate.position,headingY:candidate.headingY,speed:0,velocityX:0,velocityZ:0,airHeight:0,airBlend:0,crashForward:.3,crashLateral:(rest.crashSide||1)*.6,wheelCrashForward:0,wheelCrashLateral:0};
      getUpPose(this.recoveryPose,0,this.pose,true);
    }
    return true;
  }
  step(dt:number,input:RideActions){
    if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1/30);this.touchedDown=false;
    if(input.reset){this.recover();return;}const p=this.pose;
    if(this.recoveryPose){
      this.recoveryAge=Math.max(0,this.recoveryAge-dt);getUpPose(this.recoveryPose,1-this.recoveryAge/this.recoveryDuration,p,true);
      if(this.recoveryAge===0){const {x,y,z,headingY,wheelSpin}=p;Object.assign(p,createPose(),{x,y,z,headingY,wheelSpin});this.recoveryPose=undefined;}
      return;
    }
    if(this.recoveryAge>0){this.recoveryAge=Math.max(0,this.recoveryAge-dt);input={...NEUTRAL_ACTIONS};}
    const sit=!!input.seated&&this.grounded&&!this.crashed&&!input.crouch&&!input.hop&&!input.hopHeld&&!input.trick&&!this.tricks.active;
    p.seated=damp(p.seated,sit?1:0,sit?4:12,dt);if(p.seated<.001)p.seated=0;
    const special=this.tricks.beginStep(input.trick||0,this.grounded,this.crashed,p.speed,p.rollAngle,input.steer,dt,!input.trick||this.trickClearance());
    input={...input,crouch:input.crouch||special.crouch,hop:this.tricks.active?special.hop:input.hop,hopHeld:this.tricks.active?false:input.hopHeld};
    if(this.tricks.active&&this.tricks.phase!=='glide'&&this.tricks.phase!=='settle')input={...input,steer:0};
    if(this.tricks.targetSpeed!==null){
      const target=this.tricks.targetSpeed;
      // Release the normal brake latch before reversing in the pendulum; no position teleport.
      if(Math.abs(p.speed)<.08){this.reverseReady=true;this.brakeLatch=false;}
      input={...input,throttle:clamp((target-p.speed)*1.8,-.5,.5),steer:0};
    }
    if(this.crashed){
      p.stopFoot=p.scrape=p.beepPulse=p.warningLevel=0;
      this.crashAge+=dt;this.fallMotion!.sample(this.crashAge,p);p.speed=damp(p.speed,0,5,dt);
      const floor=this.terrain.sampleGround(p.x,p.z,this.ground,p.y).height;
      if(p.y>floor){this.velocityY-=tune.gravity*dt;p.y=Math.max(floor,p.y+this.velocityY*dt);}else p.y=floor;
      this.grounded=p.y<=floor+.001;this.groundClearance=p.airHeight=Math.max(0,p.y-floor);
      // Sweep the body and wheel drift independently; a fall must not teleport through a wall.
      const sweep=(lateral:number,forward:number)=>{const x=lateral*Math.cos(p.headingY)+forward*Math.sin(p.headingY),z=-lateral*Math.sin(p.headingY)+forward*Math.cos(p.headingY),length=Math.hypot(x,z);
        if(length<.001)return 1;const hit=this.terrain.raycastObstacle({x:p.x,y:p.y+.55,z:p.z},{x,y:0,z},length+.25,.25);return hit===null?1:clamp((hit-.25)/length,0,1);};
      const bodySweep=sweep(p.crashLateral,p.crashForward),wheelSweep=sweep(p.wheelCrashLateral,p.wheelCrashForward);
      p.crashLateral*=bodySweep;p.crashForward*=bodySweep;p.wheelCrashLateral*=wheelSweep;p.wheelCrashForward*=wheelSweep;
      return;
    }
    const throttle=Number.isFinite(input.throttle)?clamp(input.throttle,-1,1):0,steer=Number.isFinite(input.steer)?clamp(input.steer,-1,1):0;
    this.terrain.sampleGround(p.x,p.z,this.ground,p.y);
    const rough=['grass','gravel','sand','dirt'].includes(this.ground.surface),ice=this.ground.surface==='ice';
    const groundedBefore=this.grounded,oldX=p.x,oldY=p.y,oldZ=p.z,speedBefore=p.speed,absSpeed=Math.abs(p.speed);
    const resting=this.grounded&&!input.seated&&p.seated<.01&&absSpeed<.12&&Math.abs(steer)<.12&&!input.crouch&&!input.hop&&!input.hopHeld&&!this.tricks.active&&(Math.abs(throttle)<.05||(throttle<0&&this.brakeLatch));
    this.stoppedFor=resting?this.stoppedFor+dt:0;
    const plantX=p.x+Math.cos(p.headingY)*.39+Math.sin(p.headingY)*.035,plantZ=p.z-Math.sin(p.headingY)*.39+Math.cos(p.headingY)*.035;
    this.terrain.sampleGround(plantX,plantZ,this.ahead,p.y);
    const safePlant=Math.abs(this.ahead.height-this.ground.height)<.08&&!this.ahead.offCourse;
    p.stopFoot=damp(p.stopFoot,this.stoppedFor>.45&&safePlant?1:0,resting?7:24,dt);
    if(p.stopFoot<.001)p.stopFoot=0;
    p.stopFootX=plantX;p.stopFootY=this.ahead.height;p.stopFootZ=plantZ;
    if(absSpeed<.08&&throttle>=-.05){this.reverseReady=true;this.brakeLatch=false;}
    let requested=0;
    if(throttle<-.05){
      if(p.speed>.04){requested=throttle*tune.brakeAcceleration;this.brakeLatch=true;this.reverseReady=false;}
      else if(this.reverseReady&&!this.brakeLatch)requested=throttle*3.4;
    }else if(throttle>.05){requested=throttle*(p.speed<0?tune.brakeAcceleration:tune.driveAcceleration);this.brakeLatch=false;}
    const braking=(requested*p.speed<-.02)||this.brakeLatch;
    this.motor=advanceDrive(this.motor,requested,braking,dt);p.brakeAmount=damp(p.brakeAmount,braking?Math.abs(throttle):0,12,dt);
    // Hold a stationary wheel against the hill while both boots stay on the pedals.
    if(resting)this.motor=0;
    p.tiltback=damp(p.tiltback,clamp((absSpeed-18.5)/3,0,1),4,dt);
    const powerTaper=clamp((tune.maxSpeed-absSpeed)/6.5,0,1),force=this.motor*(braking||p.speed<0?1:powerTaper);
    const drag=p.speed*(rough?.5:.055)+p.speed*absSpeed*(input.crouch?.004:.006);
    const hill=tune.gravity*(this.ground.normal.x*Math.sin(p.headingY)+this.ground.normal.z*Math.cos(p.headingY));
    if(this.grounded){
      let speed=p.speed+(force-drag+hill)*dt;
      if(this.brakeLatch&&speed<.04){speed=0;this.motor=0;}
      if(!throttle&&Math.abs(speed)<.025){speed=0;this.motor=0;}
      if(resting)speed=0;
      p.speed=clamp(speed,-tune.reverseSpeed,tune.maxSpeed);
    }
    this.acceleration=damp(this.acceleration,(p.speed-speedBefore)/dt,10,dt);
    const balance=this.balance.step(dt,{steer,speed:p.speed,grounded:this.grounded,crouch:input.crouch,grip:ice?.14:rough?.60:.9});
    const intent=balance.intent,moving=clamp(absSpeed/.8,0,1),technical=1-clamp((absSpeed-1.5)/3.8,0,1);
    p.yawRate=balance.yawRate;p.headingY+=p.yawRate*dt+this.tricks.airStep(dt)+this.tricks.groundYaw;
    const s=Math.sin(p.headingY),c=Math.cos(p.headingY);
    p.rollAngle=balance.bank;p.rollVelocity=balance.bankVelocity;p.weightShift=balance.weightShift;
    p.lateralAcceleration=balance.lateralAcceleration;p.tractionUsage=balance.tractionUsage;
    p.riderRoll=damp(p.riderRoll,p.rollAngle*(.78-.15*technical)+p.weightShift*2-intent*.025*moving,10,dt);
    p.turnIntent=intent;p.technicalTurn=balance.technical;
    p.driveIntent=damp(p.driveIntent,throttle,12,dt);
    // A small pelvis translation creates unequal knee flex; the arms settle later.
    // These are body reactions, never additional forces on the wheel trajectory.
    p.hipSway=advanceSpring(this.hip,this.grounded?clamp(p.rollAngle*.055+p.rollVelocity*.016,-.065,.065):0,10,dt);
    p.balanceReach=advanceSpring(this.arms,clamp(Math.abs(p.rollVelocity)*.13+Math.abs(this.acceleration)*.018+p.landingCompression*.2,0,.42),8,dt);
    if(this.grounded){
      const grip=ice?1.5:rough?9:24,a=1-Math.exp(-grip*dt);
      this.vx+=(s*p.speed-this.vx)*a;this.vz+=(c*p.speed-this.vz)*a;
      if(!p.speed){this.vx=this.vz=0;}
    }
    // Air steering changes body orientation but never redirects the flight trajectory.
    p.velocityX=this.vx;p.velocityZ=this.vz;p.slipAngle=absSpeed>.2?angle(Math.atan2(this.vx,this.vz)-p.headingY-(p.speed<0?Math.PI:0)):0;
    this.groundAge=this.grounded?0:this.groundAge+dt;
    // Track the launch request independently of the held charge button. A release
    // request must still launch after touch/gamepad/XR has held hopHeld for a charge.
    const hopPressed=input.hop&&!this.hopDown;this.hopDown=input.hop;
    this.hopQueue=hopPressed?tune.hopBuffer:Math.max(0,this.hopQueue-dt);
    this.charge=input.crouch?clamp(this.charge+dt*1.25,0,1):Math.max(0,this.charge-dt*2.8);
    let launch=false;
    if(this.hopQueue>0&&!this.hopWindup&&(this.grounded||this.groundAge<tune.coyoteTime)){
      this.pendingCharge=this.charge;this.hopQueue=0;
      if(this.grounded)this.hopWindup=.083;else launch=true;
    }
    if(this.hopWindup>0){this.hopWindup=Math.max(0,this.hopWindup-dt);p.hopPreload=Math.sin(Math.PI*(1-this.hopWindup/.083));if(!this.hopWindup)launch=true;}
    else p.hopPreload=0;
    if(launch){
      p.stopFoot=0;
      this.lastHopCharge=this.pendingCharge;this.velocityY=tune.hopSpeed+this.pendingCharge*tune.chargedHopSpeed+Math.max(0,this.velocityY)*.35;
      this.grounded=false;this.groundAge=1;this.flightYaw=p.headingY;this.charge=this.hopQueue=0;this.counts.hops++;p.takeoffExtension=1;this.tricks.launch(this.velocityY);
    }
    const dx=this.vx*dt,dz=this.vz*dt,travel=Math.hypot(dx,dz);
    if(travel>1e-8){
      const hit=this.terrain.raycastObstacle({x:p.x,y:p.y+.65,z:p.z},{x:dx,y:0,z:dz},travel+.32,.28);
      const actors=(this.terrain.navigationObstacles?.(p.x,p.z,travel+2)??[]).filter(isCharacter);
      const {fraction,actor}=actorContact(p,dx,dz,this.mountedVolume.radius,this.mountedVolume.height,actors);
      const solidFraction=hit===null?1:clamp((hit-.33)/travel,0,1);
      if(actor&&fraction<1&&fraction<=solidFraction){
        p.x+=dx*fraction;p.z+=dz*fraction;
        const nx=actor.x-p.x,nz=actor.z-p.z,n=Math.hypot(nx,nz)||1;
        const closing=Math.max(0,((this.vx-actor.vx)*nx+(this.vz-actor.vz)*nz)/n);
        if(closing>=2.2&&actor.kind!=='dog'){
          this.receiveImpact({speed:closing,vx:this.vx,vz:this.vz});
          actor.onImpact?.({speed:closing,vx:actor.vx*.5+nx/n*closing*.85,vz:actor.vz*.5+nz/n*closing*.85});
        }
        this.vx=this.vz=this.motor=0;if(!this.crashed)p.speed=0;
        if(this.crashed)return;
      }
      else if(hit!==null){const clear=clamp(hit-.33,0,travel);p.x+=dx*clear/travel;p.z+=dz*clear/travel;if(Math.hypot(this.vx,this.vz)>1.6)this.fall('collision');else{p.speed=this.vx=this.vz=this.motor=0;}}
      else{p.x+=dx;p.z+=dz;}
    }
    this.terrain.sampleGround(p.x,p.z,this.ground,p.y);const floor=this.ground.height;
    if(this.grounded){
      if(oldY-floor>.07&&Math.abs(p.speed)>2){this.grounded=false;this.groundAge=0;this.flightYaw=p.headingY;this.velocityY=Math.max(0,this.velocityY);}
      else{p.y=floor;this.velocityY=damp(this.velocityY,(floor-oldY)/dt,18,dt);}
    }
    if(!this.grounded){
      this.velocityY-=tune.gravity*dt;p.y+=this.velocityY*dt;
      if(p.y<=floor&&this.velocityY<=0){
        this.lastLandingImpact=Math.abs(this.velocityY);p.y=floor;this.grounded=true;this.velocityY=0;this.touchedDown=true;this.counts.landings++;
        this.counts.spins+=Math.floor((Math.abs(p.headingY-this.flightYaw)+.15)/(Math.PI*2));
        const momentum=Math.hypot(this.vx,this.vz),alignment=momentum>.1?Math.cos(Math.atan2(this.vx,this.vz)-p.headingY):1;
        p.speed=momentum*(alignment<0?-1:1)*(.9+.1*Math.abs(alignment));p.landingCompression=clamp(this.lastLandingImpact/6,0,1);this.suspension.velocity-=this.lastLandingImpact*.26;
        this.lastLandingQuality=this.lastLandingImpact>tune.crashImpact?'crash':this.lastLandingImpact>6.5?'heavy':this.lastHopCharge>.45?'charged':'clean';
        if(this.lastLandingImpact>tune.crashImpact)this.fall('hard landing');
        else if(momentum*Math.sqrt(Math.max(0,1-alignment*alignment))>5.5){this.lastLandingQuality='crash';this.fall('sideways landing');}
        this.tricks.land(this.lastLandingQuality);
      }
    }
    this.groundClearance=Math.max(0,p.y-floor);p.airHeight=this.groundClearance;p.airBlend=damp(p.airBlend,this.grounded?0:1,14,dt);
    const timeToLand=this.velocityY<-.1?this.groundClearance/-this.velocityY:1;
    p.landingAnticipation=damp(p.landingAnticipation,!this.grounded?clamp(1-timeToLand/.22,0,1):0,16,dt);
    p.takeoffExtension=damp(p.takeoffExtension,0,9,dt);p.landingCompression=damp(p.landingCompression,0,5.5,dt);
    const crouchTarget=input.crouch?1:p.hopPreload*.5;p.crouch=damp(p.crouch,crouchTarget,12,dt);p.tuck=damp(p.tuck,this.grounded?crouchTarget:Math.max(crouchTarget*.65,.32)*(1-p.landingAnticipation),10,dt);
    const bump=rough&&this.grounded?Math.sin(this.distance*5.5)*Math.min(.014,absSpeed*.0014):0;
    this.idlePhase+=dt;
    const breath=this.grounded?Math.sin(this.idlePhase*1.85)*.005*p.restFactor*(1-p.crouch):0;
    // Pedal chassis loads before takeoff and extends as the tyre leaves the floor.
    // The same travel feeds the rider and pedal IK, keeping the boots attached.
    const suspensionTarget=-p.crouch*.018-p.hopPreload*.014-p.landingCompression*.04+p.takeoffExtension*.012+bump;
    p.suspensionOffset=clamp(advanceSpring(this.suspension,suspensionTarget,19,dt),-.10,.025);p.bodyBob=damp(p.bodyBob,bump*.65+breath,8,dt);
    const pitchTarget=clamp(this.acceleration*.065+clamp(p.speed/22,0,1)*.09-p.tiltback*.14,-.54,.44);
    p.riderPitch=advanceSpring(this.pitch,this.grounded?pitchTarget:clamp(this.velocityY*.025,-.14,.14),12,dt);p.wheelPitch=damp(p.wheelPitch,this.acceleration*.006-p.tiltback*.095,14,dt);
    const contact=this.terrain.sampleGround(p.x+s*.24,p.z+c*.24,this.ahead,p.y),terrainPitch=Math.atan2(this.ground.normal.x*s+this.ground.normal.z*c,this.ground.normal.y);
    p.groundPitch=damp(p.groundPitch,this.grounded?terrainPitch:0,16,dt);p.groundRoll=damp(p.groundRoll,this.grounded?-Math.atan2(this.ground.normal.x*c-this.ground.normal.z*s,this.ground.normal.y):0,16,dt);
    if(groundedBefore&&this.grounded)this.suspension.velocity+=clamp((floor-contact.height)*.12,-.01,.01);
    // Anticipate a raised seam relative to the current grade, rather than crouching on every hill.
    const lookDistance=.65*(p.speed<0?-1:1);
    const aheadHeight=this.terrain.sampleGround(p.x+s*lookDistance,p.z+c*lookDistance,this.ahead,p.y).height;
    const expectedRise=-(this.ground.normal.x*s+this.ground.normal.z*c)/Math.max(.1,this.ground.normal.y)*lookDistance;
    p.terrainBend=damp(p.terrainBend,this.grounded?clamp((aheadHeight-floor-expectedRise)*1.2,0,.055)*moving+Math.abs(bump)*1.8:0,14,dt);
    const travelled=Math.hypot(p.x-oldX,p.z-oldZ);this.distance+=travelled;
    const signedTravel=(p.x-oldX)*Math.sin(p.headingY)+(p.z-oldZ)*Math.cos(p.headingY);
    p.wheelSpin+=(this.grounded?signedTravel:p.speed*dt)/(tune.wheelRadius*this.wheelScale);
    p.attack=clamp(this.acceleration/6,0,1);p.carveStance=clamp(Math.abs(p.rollAngle)/.65,0,1);
    p.riderTurnTwist=damp(p.riderTurnTwist,-intent*(.16+.20*technical)*moving,9,dt);p.riderLookYaw=damp(p.riderLookYaw,-intent*(.36+.22*technical)*moving,12,dt);
    p.reverseBlend=damp(p.reverseBlend,p.speed<-.1?1:0,5,dt);p.restFactor=damp(p.restFactor,1-clamp(absSpeed/.8,0,1),4,dt);
    // Terrain excites the suspension; clean riding never adds an artificial steering wobble.
    p.wobble=p.wobbleSway=p.wobbleFight=p.wobbleYaw=p.wobbleRoll=0;p.motorLoad=clamp(Math.abs(this.motor)/tune.driveAcceleration,0,1);
    this.naturalMotion.step(dt,p,this.acceleration);
    if(this.crashed){this.tricks.cancel();this.tricks.award=0;}
    p.trickFoot=damp(p.trickFoot,this.tricks.foot,20,dt);p.bodyLateral-=p.trickFoot*.05;
    p.bodyTwist+=this.tricks.twist;p.bodyLook+=this.tricks.twist*.6;
    p.bodyDrop+=this.tricks.tuck;p.handLY+=this.tricks.reach;p.handRY+=this.tricks.reach;
    p.handLX+=this.tricks.reach*.5;p.handRX-=this.tricks.reach*.5;
    this.feedback.update(dt,p,this.terrain,this.grounded,this.crashed,this.wheelScale);
    if(p.scrape>0){
      const before=Math.abs(p.speed),after=Math.max(0,before-p.scrape*(p.scrapeHard?4.5:1.8)*dt),ratio=before?after/before:0;
      p.speed*=ratio;this.vx*=ratio;this.vz*=ratio;
    }
    if(this.ground.offCourse)this.fall('trail boundary');
    if(this.grounded&&!this.crashed&&Math.abs(p.rollAngle)<.12&&this.terrain.raycastObstacle({x:p.x,y:p.y+.65,z:p.z},{x:s,y:0,z:c},3,.35)===null)this.safe={position:{x:p.x,y:floor,z:p.z},headingY:p.headingY};
  }
  private trickClearance(){
    const p=this.pose,s=Math.sin(p.headingY),c=Math.cos(p.headingY),height=this.mountedVolume.height;
    const overhead=this.terrain.raycastObstacle({x:p.x,y:p.y+height,z:p.z},{x:0,y:1,z:0},1.3,this.mountedVolume.radius,{x:c,y:0,z:-s});
    const ahead=this.terrain.raycastObstacle({x:p.x,y:p.y+.5,z:p.z},{x:s,y:0,z:c},Math.max(1.2,Math.abs(p.speed)*.8),this.mountedVolume.radius);
    return overhead===null&&ahead===null;
  }
  writePose(out:RidePose){copyPose(this.pose,out);}
  snapshot(){const p=this.pose;return {
    speed:p.speed,speedKph:p.speed*3.6,position:{x:p.x,y:p.y,z:p.z},headingY:p.headingY,riderPitch:p.riderPitch,rollAngle:p.rollAngle,grounded:this.grounded,crashed:this.crashed,
    fallPhase:this.fallMotion?.phase??'none',crashCause:this.crashCause,powerStage:p.tiltback>.2?'tiltback':Math.abs(p.speed)>17?'speed warning':'normal',crouchCharge:this.charge,distanceTravelled:this.distance,...this.counts,
    trick:this.tricks.snapshot(),oneFootStop:p.stopFoot,pedalScrape:p.scrape,warningLevel:p.warningLevel,
    velocity:{x:this.vx,y:this.velocityY,z:this.vz},yawRate:p.yawRate,
    engine:tune.version,tractionUsage:p.tractionUsage,lateralAcceleration:p.lateralAcceleration,
    state:this.crashed?(this.fallMotion?.phase==='settled'?'fallen':'falling'):this.recoveryAge>0?'recovering':!this.grounded?'airborne':p.landingCompression>.15?'landing':p.brakeAmount>.15?'braking':Math.abs(p.speed)<.12?'balancing':Math.abs(p.turnIntent)>.1?'carving':p.speed<0?'reversing':'riding',
  };}
}

