import type {RidePose} from './controller.ts';
import {advanceSpring,clamp,spring} from './rideDynamics.ts';
import type {Spring} from './rideDynamics.ts';
import {stanceTargets} from './riderMotion.ts';

/** Original fixed-step articulation: pelvis leads, gaze anticipates, arms retain inertia.
 * No Three.js objects or wall-clock animation; replay and render interpolation share the same pose.
 */
export class NaturalMotionEngine {
  private channels=new Map<string,Spring>();
  private idleTime=0;
  private move(name:string,target:number,frequency:number,dt:number){
    let state=this.channels.get(name);
    if(!state){state=spring();state.value=target;this.channels.set(name,state);}
    return advanceSpring(state,target,frequency,dt);
  }
  step(dt:number,p:RidePose,acceleration:number){
    const t=stanceTargets(p),live=1-clamp(p.crashBlend,0,1);
    const move=(name:string,target:number,frequency:number)=>this.move(name,target,frequency,dt);
    this.idleTime+=dt;
    const idle=(1-clamp(Math.abs(p.speed)/.7,0,1))*(1-p.airBlend)*live,breath=Math.sin(this.idleTime*1.6)*idle;
    t.drop+=breath*.004;t.pitch+=breath*.006;
    t.headYaw+=Math.sin(this.idleTime*.31)*idle*.045;

    p.bodyDrop=move('drop',t.drop,p.landingCompression>.12?23:14);
    p.bodyShift=move('shift',t.shift,14);p.bodyLateral=move('lateral',t.lateral,13);
    p.bodyHipTilt=move('hipTilt',t.hipTilt,13);p.bodyPitch=move('pitch',t.pitch,9);
    p.bodyHipYaw=move('hipYaw',t.hipYaw,12);
    p.bodyChestRoll=move('chestRoll',t.chestRoll,9);p.bodyHeadRoll=move('headRoll',t.headRoll,18);
    p.bodyTwist=move('twist',t.chestYaw,8.5);p.bodyLook=move('look',t.headYaw,19);
    const counter=clamp(p.rollVelocity*.017,-.045,.045)*live;
    const foreaft=clamp(-acceleration*.011,-.065,.065)*live;
    const yawLag=clamp(this.channels.get('twist')!.velocity*.022,-.035,.035);
    const lift=Math.abs(this.channels.get('lateral')!.velocity)*.04;
    // A loose arm follows apparent gravity in a sustained turn, then trails a reversal.
    // Keep this response separate from the faster eyes, spine and pelvis.
    p.armBank=move('armBank',clamp(Math.atan2(-p.lateralAcceleration,9.81),-.5,.5)*(1-p.airBlend),6);
    p.armSwing=move('armSwing',clamp(Math.atan2(-acceleration,9.81),-.25,.25)*(1-p.airBlend),5.5);
    const shoulderLift=(.055*p.airBlend+.035*p.landingCompression+.06*p.takeoffExtension)*live;
    p.shoulderL=move('shoulderL',clamp(shoulderLift+p.rollVelocity*.045,-.07,.16),8);
    p.shoulderR=move('shoulderR',clamp(shoulderLift-p.rollVelocity*.045,-.07,.16),8);
    const hands=t.hands.map((h,i)=>{
      const side=i===0?1:-1;
      // Loose hands breathe with the chest at rest. At steady road speed, small,
      // unsynchronised corrections keep the arms alive without a walking arm pump.
      // Steering, tuck and flight take priority over this background balance.
      const cruising=clamp(Math.abs(p.speed)/6,0,1)*(1-clamp(Math.abs(p.turnIntent)*2,0,1))
        *(1-p.airBlend)*(1-clamp(Math.max(p.crouch,p.tuck),0,1))*live;
      const sway=Math.sin(this.idleTime*(i===0?1.35:1.12)+(i===0?0:1.7))*cruising;
      const x=move(`hand${i}x`,h.x+counter+side*(breath*.002+sway*.007),7);
      const y=move(`hand${i}y`,h.y+lift+breath*.003+Math.abs(sway)*.006,9);
      const z=move(`hand${i}z`,h.z+foreaft-side*yawLag+breath*.002+sway*.018,6.5);
      // Wrist flex trails both arm reach and apparent gravity, relative to the
      // forearm rather than holding a world-facing palm through a turn.
      const lag=clamp(-this.channels.get(`hand${i}z`)!.velocity*.10
        -this.channels.get(`hand${i}y`)!.velocity*.06
        -(this.channels.get('armSwing')?.velocity??0)*.035,-.12,.12)*live;
      return {x,y,z,wrist:move(`wrist${i}`,clamp(h.wrist+lag,-.24,.24),6)};
    });
    [p.handLX,p.handLY,p.handLZ,p.wristL]=[hands[0].x,hands[0].y,hands[0].z,hands[0].wrist];
    [p.handRX,p.handRY,p.handRZ,p.wristR]=[hands[1].x,hands[1].y,hands[1].z,hands[1].wrist];
    p.naturalMotion=1;
  }
}
