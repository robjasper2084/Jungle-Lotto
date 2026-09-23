/** Shared gameplay constants, in metres/seconds. No alternate movement owner. */
export const RIDE_RULES=Object.freeze({cruiseSpeed:24/3.6,settleSeconds:.6,comboBankSeconds:5,recoveryNeutralSeconds:.15});

/** Only suppresses stale device intents. The controller still owns movement/falls. */
export class NeutralRearm {
 private remaining=0;
 interrupt(){this.remaining=RIDE_RULES.recoveryNeutralSeconds;}
 sample(dt:number,active:boolean){
  if(this.remaining<=0)return true;
  this.remaining=active?RIDE_RULES.recoveryNeutralSeconds:Math.max(0,this.remaining-dt);
  return false;
 }
 get blocked(){return this.remaining>0;}
}
