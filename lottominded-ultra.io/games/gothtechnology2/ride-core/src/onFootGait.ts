const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const footCycleDistance=(speed:number)=>1.10+.30*smooth(1,2.35,Math.abs(speed))+1.60*smooth(2.35,5.4,Math.abs(speed));
/** Distance matched contact: the planted ankle travels backwards at ground speed.
 * Low swing clearance keeps the current cadence without high stepping.
 * Smaller heroes use their own reach, rather than inheriting a human stride. */
export function footGait(phase:number,speed:number,legLength:number){
 const jog=smooth(1.9,3.6,speed),stance=.62-.24*jog;
 const cycleDistance=footCycleDistance(speed)*Math.max(.2,legLength/.9);
 const travel=cycleDistance*stance;
 const t=((phase%1)+1)%1,heel=.12-.07*jog,toe=.40-.06*jog;
 if(t<stance){const s=t/stance;return{z:travel*(.5-s),lift:0,pitch:-heel*(1-smooth(0,.20,s))+toe*smooth(.48,1,s),contact:true};}
 // Match the planted foot's backwards velocity at lift-off and touchdown.
 // A zero-tangent swing made each ankle visibly stop at every step boundary.
 const u=(t-stance)/(1-stance),tangent=-(1-stance)/stance;
 const s=u*u*(3-2*u)+tangent*u*(1-u)*(1-2*u);
 return{z:travel*(s-.5),lift:Math.min(.075+.12*jog,legLength*.24)*Math.sin(Math.PI*u)**1.3*(1+.20*jog*Math.cos(Math.PI*u)),pitch:toe*(1-smooth(0,.70,u))-heel*smooth(.70,1,u),contact:false};
}
/** Sprint feet spend less time reaching along the ground and recover beneath
 * the hips; the planted portion still moves backwards at controller speed. */
export function sprintGait(phase:number,speed:number,legLength:number){
 const t=((phase%1)+1)%1,stance=.24,follow=.06;
 const distance=footCycleDistance(speed)*Math.max(.2,legLength/.9),half=distance*stance*.5;
 if(t<stance){const u=t/stance;return{z:half-distance*t,lift:0,pitch:-.05*(1-smooth(0,.20,u))+.30*smooth(.48,1,u),contact:true};}
 // Short follow-through arcs preserve contact velocity without the long
 // forward overshoot of a single cubic swing (which pulled the hips down).
 const extra=distance*follow*.5,reach=half+extra;
 let z:number;
 if(t<stance+follow){const u=(t-stance)/follow;z=-half-distance*follow*(u-u*u*.5);}
 else if(t>1-follow){const u=(t-(1-follow))/follow;z=reach-distance*follow*u*u*.5;}
 else z=reach*(2*smooth(stance+follow,1-follow,t)-1);
 const u=(t-stance)/(1-stance);
 return{z,lift:Math.min(.195,legLength*.24)*Math.sin(Math.PI*u)**1.3*(1+.20*Math.cos(Math.PI*u)),pitch:.30*(1-smooth(0,.70,u))-.05*smooth(.70,1,u),contact:false};
}

/** Small root weight transfer. The retargeter retains captured torso rotations;
 * this helper supplies only the planted-body translation. */
export function footBodyMotion(phase:number,speed:number){
 const effort=smooth(0,.85,Math.abs(speed)),run=smooth(2.5,5.4,Math.abs(speed));
 return {weight:Math.sin(phase*Math.PI*2)*(.012+.008*run)*effort,
  bob:-Math.cos(phase*Math.PI*4)*(.008+.009*run)*effort};
}

/** Low ready, unarmed hero walk. The arm opposes its own foot's actual
 * contact cycle, with a short follow-through delay at each weight transfer.
 * Weapon and melee overlays can still take control after locomotion. */
export function heroArmMotion(phase:number,speed:number){
 const pace=Math.abs(speed),effort=smooth(0,.85,pace),run=smooth(2.5,4.1,pace);
 const stance=.62-.24*smooth(1.9,3.6,pace);
 const step=footGait(phase-.025,pace,.9).z/(footCycleDistance(pace)*stance*.5);
 const opposite=-Math.max(-1,Math.min(1,step))*(speed<0?-1:1);
 return {shoulder:(-.10+(.34+.18*run)*opposite)*effort,
  elbow:.18+(.54+.26*run+.10*opposite)*effort,
  wrist:-.045*opposite*effort};
}
