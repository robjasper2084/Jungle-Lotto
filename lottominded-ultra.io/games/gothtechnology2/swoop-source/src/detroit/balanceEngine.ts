import {RIDE_TUNING as tune,advanceSpring,clamp,damp,spring} from './rideDynamics.ts';

export type BalanceInput={steer:number;speed:number;grounded:boolean;crouch:boolean;grip:number};
/** Original EUC balance model. Steering shifts weight; the bank then bends the
 * contact trajectory. At walking pace a blended body pivot keeps tight turns usable.
 * No reference-game code or constants are used here. Units: metres, seconds, radians. */
export class BalanceEngine {
  private input=spring();
  private bank=spring();
  private yaw=0;
  private load=0;

  step(dt:number,a:BalanceInput){
    const speed=Math.abs(a.speed),direction=a.speed<-.05?-1:1;
    const raw=Number.isFinite(a.steer)?clamp(a.steer,-1,1):0;
    // Gentle around stick centre, but keyboard/full stick still reaches full lock.
    const command=.82*raw+.18*raw*raw*raw;
    const intent=advanceSpring(this.input,command,16,dt);
    const moving=clamp(speed/.8,0,1),technical=1-clamp((speed-1.5)/3.8,0,1);
    const maxYaw=tune.highSpeedYaw+(tune.lowSpeedYaw-tune.highSpeedYaw)*Math.exp(-speed/4.8);
    const yawDemand=-intent*maxYaw*moving*direction;
    const lateralLimit=tune.gravity*Math.min(Math.tan(tune.maxLean),a.grip);
    const desiredLateral=clamp(yawDemand*a.speed,-lateralLimit,lateralLimit);
    // Only the last 15% of steering above 36 km/h asks for an overlean.
    // The tyre still limits yaw; an overlean can physically ground the pedal.
    const overlean=clamp((Math.abs(intent)-.85)/.15,0,1)*clamp((speed-10)/5,0,1)*clamp((a.grip-.7)/.2,0,1)*.20;
    const requestedBank=clamp(Math.atan2(desiredLateral,tune.gravity)-Math.sign(intent)*overlean,-tune.maxLean,tune.maxLean);
    let targetYaw:number;
    if(a.grounded){
      advanceSpring(this.bank,requestedBank,15,dt);
      const bankYaw=tune.gravity*Math.tan(this.bank.value)/Math.max(speed,.8)*direction;
      // Pivot on the tyre at walking pace; progressively let weight/bank own the arc.
      targetYaw=yawDemand*technical+bankYaw*(1-technical);
      targetYaw=clamp(targetYaw,-lateralLimit/Math.max(speed,.8),lateralLimit/Math.max(speed,.8));
    }else{
      // Air input rotates the rider/EUC; it does not steer the airborne momentum.
      advanceSpring(this.bank,this.bank.value*.98,3,dt);
      targetYaw=-intent*(a.crouch?7.2:4.4);
    }
    this.yaw=damp(this.yaw,targetYaw,a.grounded?16:10,dt);
    this.load=damp(this.load,a.grounded?clamp(Math.abs(this.yaw*a.speed)/Math.max(.1,lateralLimit),0,1):0,12,dt);
    return {intent,bank:this.bank.value,bankVelocity:this.bank.velocity,yawRate:this.yaw,
      technical:technical*Math.abs(intent)*moving,
      weightShift:a.grounded?clamp((requestedBank-this.bank.value)*.18,-.055,.055):0,
      lateralAcceleration:a.grounded?this.yaw*a.speed:0,tractionUsage:this.load};
  }
}
