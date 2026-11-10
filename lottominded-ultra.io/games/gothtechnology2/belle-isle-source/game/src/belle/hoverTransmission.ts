export type DriveGear='auto'|0|1|2|3;
export const DRIVE_GEARS:readonly DriveGear[]=['auto',0,1,2,3];
export function gearLabel(gear:DriveGear){return gear==='auto'?'AUTO':gear===0?'N':String(gear);}
/** Virtual drive ranges control propulsion only; lift remains independent. */
export class HoverTransmission{
 gear:DriveGear='auto';clutch=0;throttle=0;brake=0;
 select(gear:DriveGear,landed:boolean){if(!DRIVE_GEARS.includes(gear)||(!landed&&this.clutch<.8))return false;this.gear=gear;return true;}
 sample(throttle:number,clutch:number|undefined,brake:boolean){
  this.throttle=Number.isFinite(throttle)?Math.max(-1,Math.min(1,throttle)):0;
  this.clutch=Number.isFinite(clutch)?Math.max(0,Math.min(1,clutch!)):0;this.brake=brake?1:0;
  return this.gear===0||brake?0:this.throttle*(1-this.clutch);
 }
 get ratio(){return this.gear===1?.38:this.gear===2?.67:1;}
 clear(){this.throttle=this.clutch=this.brake=0;}
}
