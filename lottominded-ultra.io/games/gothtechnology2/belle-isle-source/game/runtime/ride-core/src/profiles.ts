/** Fit values are authored for the supplied Digital Static rigs and EUC asset. */
export type RiderProfile=Readonly<{
  id:string;wheelScale:number;motionScale:number;pedalHeight:number;
  pedalHalfSpacing:number;footDownStop:boolean;
}>;
export const HUMAN_PROFILE:RiderProfile=Object.freeze({id:'human',wheelScale:.86,motionScale:1,pedalHeight:.296,pedalHalfSpacing:.195,footDownStop:true});
export const MASCOT_PROFILE:RiderProfile=Object.freeze({id:'mascot',wheelScale:.75,motionScale:.48,pedalHeight:.296,pedalHalfSpacing:.195,footDownStop:false});
